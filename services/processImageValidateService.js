/**
 * services/processImageValidateService.js - 수정 버전
 * 역할: API Key/Secret 및 이미지 검증 비즈니스 로직
 * 특징: 기존 ApiLogs 테이블 사용 (이미지 관련 필드 저장 안 함)
 */

const { executeQuery, executeNonQuery } = require('../config/database');
const { encryptApiSecret } = require('../utils/cryptoUtils');
const { SUBSCRIPTION_STATUS, API_CALL_LIMITS } = require('../config/constants');
const crypto = require('crypto');

/**
 * API Key와 Secret 검증
 * 
 * @param {string} apiKey - 요청된 API Key
 * @param {string} apiSecret - 요청된 API Secret
 * 
 * @returns {Promise}
 * 성공: {
 *   success: true,
 *   api_key_id,
 *   user_id,
 *   created_at,
 *   expires_at,
 *   is_active
 * }
 * 실패: {
 *   success: false,
 *   error: string,
 *   statusCode: number,
 *   errorCode: string
 * }
 * 
 * @throws {Error} DB 연결 오류 등
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
    // 에러 무시 - 검증 결과에 영향 없음
  }
}

/**
 * 이미지 검증 시도 로깅
 * 
 * ⚠️ 변경사항: 기존 ApiLogs 테이블 사용 (이미지 필드 제외)
 * 
 * @param {Object} logData - 로그 데이터
 * - api_key_id: string (성공 시에만)
 * - user_id: string (성공 시에만)
 * - endpoint: string ("/api/process-image-validate")
 * - method: string ("POST")
 * - status_code: number
 * - response_time_ms: number
 * - ip_address: string
 * - request_body: string (JSON)
 * - error_message: string (실패 시에만)
 * 
 * @returns {Promise}
 * @throws {Error} DB 연결 오류 등
 * 
 * @note
 * - 기존 validateApiKeyService의 logValidationAttempt와 동일한 방식
 * - image_length는 저장하지 않음
 * - ApiLogs 테이블에 저장
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
    throw err; // 로깅 실패도 에러로 처리
  }
}

/**
 * 모듈 내보내기
 */
module.exports = {
  validateApiKey,
  logImageValidationAttempt,
  updateApiKeyLastUsed
};