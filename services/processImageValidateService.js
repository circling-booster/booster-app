/**
 * services/processImageValidateService.js - OpenAI 통합 버전
 * 역할: API Key/Secret 및 이미지 검증, OpenAI 이미지 분석
 * 특징: GPT-4o-mini를 사용한 이미지 내용 분석
 */

const { executeQuery, executeNonQuery } = require('../config/database');
const { encryptApiSecret } = require('../utils/cryptoUtils');
const { SUBSCRIPTION_STATUS } = require('../config/constants');
const crypto = require('crypto');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY_Captcha;

/**
 * API Key와 Secret 검증
 * 
 * @param {string} apiKey - 요청된 API Key
 * @param {string} apiSecret - 요청된 API Secret
 * 
 * @returns {Promise} 검증 결과
 */
async function validateApiKey(apiKey, apiSecret) {
  try {
    // 1. ApiKeys 테이블에서 API Key로 조회
    const apiKeys = await executeQuery(
      `SELECT ak.id, ak.user_id, ak.api_secret_hash, ak.is_active,
        ak.created_at, ak.expires_at, ak.last_used
        FROM [ApiKeys] ak
        WHERE ak.api_key = @apiKey`,
      { apiKey }
    );

    // 2. API Key 미존재 확인
    if (!apiKeys || apiKeys.length === 0) {
      return {
        success: false,
        error: '유효하지 않은 API Key입니다',
        statusCode: 401,
        errorCode: 'INVALID_API_KEY'
      };
    }

    const keyRecord = apiKeys[0];

    // 3. API Secret 검증 (SHA256 해싱 후 비교)
    const secretHash = encryptApiSecret(apiSecret);
    if (secretHash !== keyRecord.api_secret_hash) {
      return {
        success: false,
        error: '유효하지 않은 API Secret입니다',
        statusCode: 401,
        errorCode: 'INVALID_API_SECRET'
      };
    }

    // 4. API Key 활성화 상태 확인
    if (!keyRecord.is_active) {
      return {
        success: false,
        error: '비활성화된 API Key입니다',
        statusCode: 403,
        errorCode: 'API_KEY_INACTIVE'
      };
    }

    // 5. API Key 만료 시간 확인
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return {
        success: false,
        error: '만료된 API Key입니다',
        statusCode: 403,
        errorCode: 'API_KEY_EXPIRED'
      };
    }

    // 6. 사용자 존재 및 활성화 상태 확인
    const users = await executeQuery(
      `SELECT id, is_active, is_blocked FROM [Users] WHERE id = @userId`,
      { userId: keyRecord.user_id }
    );

    if (!users || users.length === 0) {
      return {
        success: false,
        error: '사용자를 찾을 수 없습니다',
        statusCode: 403,
        errorCode: 'USER_NOT_FOUND'
      };
    }

    const user = users[0];

    // 7. 사용자 활성화 상태 확인
    if (!user.is_active) {
      return {
        success: false,
        error: '비활성화된 사용자 계정입니다',
        statusCode: 403,
        errorCode: 'USER_INACTIVE'
      };
    }

    // 8. 사용자 차단 상태 확인
    if (user.is_blocked) {
      return {
        success: false,
        error: '차단된 사용자입니다',
        statusCode: 403,
        errorCode: 'USER_BLOCKED'
      };
    }

    // 9. 구독 활성화 상태 확인
    const subscriptions = await executeQuery(
      `SELECT us.id, us.status, st.api_call_limit
        FROM [UserSubscriptions] us
        JOIN [SubscriptionTiers] st ON us.tier_id = st.id
        WHERE us.user_id = @userId AND us.status = @status`,
      { userId: keyRecord.user_id, status: SUBSCRIPTION_STATUS.ACTIVE }
    );

    if (!subscriptions || subscriptions.length === 0) {
      return {
        success: false,
        error: '활성화된 구독이 없습니다',
        statusCode: 403,
        errorCode: 'SUBSCRIPTION_INACTIVE'
      };
    }

    const subscription = subscriptions[0];
    const monthlyLimit = subscription.api_call_limit;

    // 10. 월간 API 호출 제한 확인
    const currentMonth = new Date();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const usageResult = await executeQuery(
      `SELECT COUNT(*) as count FROM [ApiLogs]
        WHERE api_key_id = @apiKeyId AND created_at >= @firstDay`,
      { apiKeyId: keyRecord.id, firstDay: firstDayOfMonth }
    );

    const currentUsage = usageResult[0] ? usageResult[0].count : 0;
    if (currentUsage >= monthlyLimit) {
      return {
        success: false,
        error: 'API 호출 제한을 초과했습니다',
        statusCode: 429,
        errorCode: 'API_LIMIT_EXCEEDED'
      };
    }

    // 11. API Key의 last_used 업데이트 (비동기)
    updateApiKeyLastUsed(keyRecord.id).catch(err => {
      console.error('[UPDATE_LAST_USED_ERROR]', err);
    });

    // 12. 검증 성공 - 결과 반환
    return {
      success: true,
      api_key_id: keyRecord.id,
      user_id: keyRecord.user_id,
      created_at: keyRecord.created_at,
      expires_at: keyRecord.expires_at,
      is_active: keyRecord.is_active
    };

  } catch (err) {
    console.error('[VALIDATE_API_KEY_SERVICE_ERROR]', err);
    throw err;
  }
}

/**
 * API Key의 last_used 업데이트
 * 
 * @param {string} apiKeyId - API Key ID
 * @returns {Promise}
 */
async function updateApiKeyLastUsed(apiKeyId) {
  try {
    await executeNonQuery(
      `UPDATE [ApiKeys] SET last_used = GETDATE() WHERE id = @id`,
      { id: apiKeyId }
    );
  } catch (err) {
    console.error('[UPDATE_LAST_USED_ERROR]', err);
  }
}

/**
 * OpenAI API를 사용한 이미지 분석
 * 
 * @param {string} base64Image - Base64 인코딩된 이미지
 * @param {string} targetPrompt - 이미지 분석 프롬프트 (옵션)
 * @returns {Promise} OpenAI 응답 텍스트
 * 
 * @throws {Error} OpenAI API 호출 실패
 * 
 * @note
 * - GPT-4o-mini 모델 사용
 * - Base64 이미지를 data URL로 변환
 * - 이미지 분석 후 텍스트 응답 반환
 */
async function analyzeImageWithOpenAI(base64Image, targetPrompt = null) {
  try {
    // 1. OpenAI API Key 확인
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다');
    }

    // 2. Base64 이미지를 data URL로 변환
    // data URL 형식: data:image/jpeg;base64,{base64_string}
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // 3. 기본 프롬프트 설정 (사용자가 제공하지 않은 경우)
    const userPrompt = targetPrompt || 'Read the 6 uppercase letters in this image. Output ONLY the 6 letters with no spaces, no explanations, no other text.';

    // 4. OpenAI API payload 구성
    const requestPayload = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 유용한 AI 이미지 분석 어시스턴트입니다. 사용자가 요청한 내용에 따라 이미지를 분석하고 명확하고 정확한 답변을 제공합니다.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'auto'
              }
            }
          ]
        }
      ],
      temperature: 1,
      top_p: 1,
      max_tokens: 2048
    };

    // 5. OpenAI Chat Completions API 호출
    console.log('[OPENAI_REQUEST]', { model: requestPayload.model, prompt: userPrompt });

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload),
      timeout: 30000 // 30초 타임아웃
    });

    // 6. OpenAI 응답 상태 확인
    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => '');
      console.error('[OPENAI_API_ERROR]', { status: openaiRes.status, error: errText });
      
      throw new Error(
        `OpenAI API 호출 실패 (${openaiRes.status}): ${errText || 'Unknown error'}`
      );
    }

    // 7. OpenAI 응답 파싱
    const openaiData = await openaiRes.json();

    // 8. 응답에서 텍스트 추출
    const answer = openaiData.choices?.[0]?.message?.content ?? 
                   '(OpenAI API에서 응답 내용을 받지 못했습니다.)';

    console.log('[OPENAI_RESPONSE]', { textLength: answer.length });

    return answer;

  } catch (err) {
    console.error('[ANALYZE_IMAGE_WITH_OPENAI_ERROR]', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

/**
 * 이미지 검증 시도 로깅
 * 
 * @param {Object} logData - 로그 데이터
 * @returns {Promise}
 * @throws {Error} DB 연결 오류 등
 */
async function logImageValidationAttempt(logData) {
  try {
    const logId = crypto.randomUUID();
    await executeNonQuery(
      `INSERT INTO [ApiLogs]
        (id, api_key_id, user_id, endpoint, method, status_code, response_time_ms,
         ip_address, request_body, error_message, created_at)
        VALUES (@id, @apiKeyId, @userId, @endpoint, @method, @statusCode,
                @responseTimeMs, @ipAddress, @requestBody, @errorMessage, GETDATE())`,
      {
        id: logId,
        apiKeyId: logData.api_key_id || null,
        userId: logData.user_id || null,
        endpoint: logData.endpoint,
        method: logData.method,
        statusCode: logData.status_code,
        responseTimeMs: logData.response_time_ms,
        ipAddress: logData.ip_address,
        requestBody: logData.request_body,
        errorMessage: logData.error_message || null
      }
    );
  } catch (err) {
    console.error('[LOGGING_ERROR]', err);
    throw err;
  }
}

/**
 * 모듈 내보내기
 */
module.exports = {
  validateApiKey,
  analyzeImageWithOpenAI,
  logImageValidationAttempt,
  updateApiKeyLastUsed
};