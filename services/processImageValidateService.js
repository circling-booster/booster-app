/**
* services/processImageValidateService.js - OpenAI 통합 버전 (DB 수정 없음)
* 역할: API Key/Secret 및 이미지 검증, OpenAI 이미지 분석
* 특징: 시간 측정을 메모리 저장소와 콘솔 로그에 기록 (DB 스키마 변경 없음)
*/

const { executeQuery, executeNonQuery } = require('../config/database');
const { encryptApiSecret } = require('../utils/cryptoUtils');
const { SUBSCRIPTION_STATUS } = require('../config/constants');
const crypto = require('crypto');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY_Captcha;

// ✅ 추가: 메모리 기반 타이밍 로그 저장소 (최근 1000개 요청 유지)
const timingLogsBuffer = [];
const MAX_TIMING_LOGS = 1000;

/**
* ✅ 추가: 타이밍 정보를 메모리 버퍼에 저장 (최근 1000개 유지)
*
* @param {Object} timingData - 타이밍 정보 객체
*/
function storeTimingLog(timingData) {
  // 메타데이터와 함께 저장
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...timingData
  };

  timingLogsBuffer.push(logEntry);

  // 버퍼 크기 유지 (최근 1000개만 보관)
  if (timingLogsBuffer.length > MAX_TIMING_LOGS) {
    timingLogsBuffer.shift();
  }

  // 콘솔에 상세 로그 출력
  console.log('[TIMING_LOG]', {
    endpoint: timingData.endpoint,
    total_time_ms: timingData.total_time_ms,
    openai_response_time_ms: timingData.openai_response_time_ms,
    server_processing_time_ms: timingData.server_processing_time_ms,
    openai_ratio: `${((timingData.openai_response_time_ms / timingData.total_time_ms) * 100).toFixed(2)}%`,
    timestamp: logEntry.timestamp
  });
}

/**
* ✅ 추가: 메모리 버퍼에서 타이밍 로그 조회
*
* @param {number} limit - 조회할 로그 개수 (기본값: 20)
* @returns {Array} 타이밍 로그 배열
*/
function getTimingLogs(limit = 20) {
  return timingLogsBuffer.slice(-limit).reverse();
}

/**
* ✅ 추가: 메모리 버퍼 통계 조회
*
* @returns {Object} 통계 정보
*/
function getTimingStatistics() {
  if (timingLogsBuffer.length === 0) {
    return {
      total_requests: 0,
      message: '타이밍 데이터가 없습니다'
    };
  }

  const totalResponseTimes = timingLogsBuffer.map(log => log.total_time_ms);
  const openaiResponseTimes = timingLogsBuffer.map(log => log.openai_response_time_ms);
  const serverProcessingTimes = timingLogsBuffer.map(log => log.server_processing_time_ms);

  const calculate = (arr) => ({
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    total: arr.length
  });

  return {
    total_requests: timingLogsBuffer.length,
    total_time: calculate(totalResponseTimes),
    openai_response_time: calculate(openaiResponseTimes),
    server_processing_time: calculate(serverProcessingTimes),
    avg_openai_ratio: `${(
      (openaiResponseTimes.reduce((a, b) => a + b, 0) /
        totalResponseTimes.reduce((a, b) => a + b, 0)) *
      100
    ).toFixed(2)}%`
  };
}

/**
* API Key와 Secret 검증 (기존 코드 유지 - 변경 없음)
*
* @param {string} apiKey - 요청된 API Key
* @param {string} apiSecret - 요청된 API Secret
* @returns {Promise} 검증 결과
*/
async function validateApiKey(apiKey, apiSecret) {
  try {
    const apiKeys = await executeQuery(
      `SELECT ak.id, ak.user_id, ak.api_secret_hash, ak.is_active,
       ak.created_at, ak.expires_at, ak.last_used
       FROM [ApiKeys] ak
       WHERE ak.api_key = @apiKey`,
      { apiKey }
    );

    if (!apiKeys || apiKeys.length === 0) {
      return {
        success: false,
        error: '유효하지 않은 API Key입니다',
        statusCode: 401,
        errorCode: 'INVALID_API_KEY'
      };
    }

    const keyRecord = apiKeys[0];
    const secretHash = encryptApiSecret(apiSecret);

    if (secretHash !== keyRecord.api_secret_hash) {
      return {
        success: false,
        error: '유효하지 않은 API Secret입니다',
        statusCode: 401,
        errorCode: 'INVALID_API_SECRET'
      };
    }

    if (!keyRecord.is_active) {
      return {
        success: false,
        error: '비활성화된 API Key입니다',
        statusCode: 403,
        errorCode: 'API_KEY_INACTIVE'
      };
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return {
        success: false,
        error: '만료된 API Key입니다',
        statusCode: 403,
        errorCode: 'API_KEY_EXPIRED'
      };
    }

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

    if (!user.is_active) {
      return {
        success: false,
        error: '비활성화된 사용자 계정입니다',
        statusCode: 403,
        errorCode: 'USER_INACTIVE'
      };
    }

    if (user.is_blocked) {
      return {
        success: false,
        error: '차단된 사용자입니다',
        statusCode: 403,
        errorCode: 'USER_BLOCKED'
      };
    }

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

    updateApiKeyLastUsed(keyRecord.id).catch(err => {
      console.error('[UPDATE_LAST_USED_ERROR]', err);
    });

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
* API Key의 last_used 업데이트 (기존 코드 유지 - 변경 없음)
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
* ✅ 수정: OpenAI API를 사용한 이미지 분석 (시간 측정 포함)
*
* @param {string} base64Image - Base64 인코딩된 이미지
* @param {string} targetPrompt - 이미지 분석 프롬프트 (옵션)
* @returns {Promise} { answer: string, openaiResponseTimeMs: number }
* @throws {Error} OpenAI API 호출 실패
*
* 주요 변경:
* - OpenAI API 호출 시간 측정 추가
* - 반환값을 객체로 변경 (answer + openaiResponseTimeMs)
*/
async function analyzeImageWithOpenAI(base64Image, targetPrompt = null, url) {
  var count, type;
  if (url.includes('interpark')) {
    count = '6';
    type = "uppercase letters";
  } else if (url.includes('melon')) {
    count = '6';
    type = "uppercase letters";
  } else if (url.includes('yes24')) {
    count = '6';
    type = "uppercase letters";
  } else if (url.includes('ticketlink')) {
    count = '6';
    type = "uppercase letters";
  }
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다');
    }

    const imageUrl = `data:image/jpeg;base64,${base64Image}`;
    const userPrompt = targetPrompt || `Read  ${count} ${type} in this image. Output ONLY letters with no spaces, no explanations, no other text.`;

    const requestPayload = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI image assistant. You analyze images based on the users request and provide clear and accurate answers.'
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

    // ✅ 추가: OpenAI API 호출 시간 측정 시작
    const openaiStartTime = Date.now();
    console.log('[OPENAI_REQUEST]', { model: requestPayload.model, prompt: userPrompt });

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload),
      timeout: 30000
    });

    // ✅ 추가: OpenAI API 호출 시간 측정 종료
    const openaiResponseTimeMs = Date.now() - openaiStartTime;

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => '');
      console.error('[OPENAI_API_ERROR]', { status: openaiRes.status, error: errText });
      throw new Error(
        `OpenAI API 호출 실패 (${openaiRes.status}): ${errText || 'Unknown error'}`
      );
    }

    const openaiData = await openaiRes.json();
    const answer = openaiData.choices?.[0]?.message?.content ??
      '(OpenAI API에서 응답 내용을 받지 못했습니다.)';

    console.log('[OPENAI_RESPONSE]', { textLength: answer.length, responseTimeMs: openaiResponseTimeMs });

    // ✅ 수정: 답변과 OpenAI 응답 시간 함께 반환
    return {
      answer,
      openaiResponseTimeMs
    };

  } catch (err) {
    console.error('[ANALYZE_IMAGE_WITH_OPENAI_ERROR]', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

/**
* ✅ 수정: 이미지 검증 시도 로깅 (DB 기존 컬럼만 사용)
* 시간 정보는 별도의 메모리 버퍼에 저장
*
* @param {Object} logData - 로그 데이터
* @returns {Promise}
*
* 주요 변경:
* - 기존 DB INSERT는 그대로 유지 (DB 스키마 변경 없음)
* - 타이밍 정보는 메모리 버퍼에 저장 (storeTimingLog 호출)
*/
async function logImageValidationAttempt(logData) {
  try {
    const logId = crypto.randomUUID();

    // ✅ 기존 DB 컬럼만 사용 (변경 없음)
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

    // ✅ 추가: 타이밍 정보는 메모리 버퍼에 저장 (DB 변경 없음)
    storeTimingLog({
      log_id: logId,
      endpoint: logData.endpoint,
      method: logData.method,
      total_time_ms: logData.response_time_ms,
      openai_response_time_ms: logData.openai_response_time_ms || 0,
      server_processing_time_ms: logData.server_processing_time_ms || 0,
      status_code: logData.status_code,
      user_id: logData.user_id || 'anonymous'
    });

  } catch (err) {
    console.error('[LOGGING_ERROR]', err);
    throw err;
  }
}

/**
* ✅ 수정: 모듈 내보내기 (새로운 함수 추가)
*/

module.exports = {
  validateApiKey,
  analyzeImageWithOpenAI,
  logImageValidationAttempt,
  updateApiKeyLastUsed,
  // ✅ 새로운 함수들 내보내기
  storeTimingLog,
  getTimingLogs,
  getTimingStatistics
};
