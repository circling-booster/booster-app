/**
 * controllers/validateApiKeyController.js
 * 역할: API Key/Secret 검증 요청 처리
 * 특징: 공개 엔드포인트 (인증 불필요)
 */

const validateApiKeyService = require('../services/validateApiKeyService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

/**
 * API Key 및 Secret 검증 핸들러
 * 
 * @route POST /api/validate-key
 * @public (인증 불필요)
 * @param {string} api_key - API Key (sk_... 형식)
 * @param {string} api_secret - API Secret (64자 16진수)
 * 
 * @returns {200} 검증 성공
 * {
 *   success: true,
 *   data: {
 *     user_id: string (UUID),
 *     api_key_id: string (UUID),
 *     creation_date: datetime,
 *     expiration_date: datetime,
 *     is_active: boolean
 *   },
 *   message: "API Key 검증 성공",
 *   timestamp: datetime
 * }
 * 
 * @throws {400} Bad Request: Key/Secret 누락
 * @throws {401} Unauthorized: 잘못된 Key/Secret
 * @throws {403} Forbidden: 비활성화된 Key 또는 사용자
 * @throws {429} Too Many Requests: 월간 호출 제한 초과
 * @throws {500} Internal Server Error: 서버 오류
 */
async function validateApiKey(req, res) {
    // 요청 시작 시간 기록 (응답 시간 계산용)
    const startTime = Date.now();

    try {
        // 1. 요청 바디에서 API Key와 Secret 추출
        const { api_key, api_secret } = req.body;

        // 2. 필수값 검증
        if (!api_key || !api_secret) {
            return errorResponse(
                res,
                'API Key 또는 Secret이 누락되었습니다',
                400,
                'MISSING_CREDENTIALS'
            );
        }

        // 3. 입력값 기본 검증 (형식 확인)
        // API Key는 "sk_"로 시작해야 함
        if (!api_key.startsWith('sk_')) {
            return errorResponse(
                res,
                '유효하지 않은 API Key 형식입니다',
                400,
                'INVALID_API_KEY_FORMAT'
            );
        }

        // 4. Service 호출: API Key/Secret 검증
        const result = await validateApiKeyService.validateApiKey(api_key, api_secret);

        // 5. 검증 실패
        if (!result.success) {
            // 응답 시간 계산
            const responseTime = Date.now() - startTime;

            // 로깅 (실패 경우)
            await validateApiKeyService.logValidationAttempt({
                api_key_id: null,  // 검증 실패 시 null
                user_id: null,
                endpoint: '/api/validate-key',
                method: 'POST',
                status_code: result.statusCode || 401,
                response_time_ms: responseTime,
                ip_address: req.ip,
                request_body: JSON.stringify({ api_key: api_key.substring(0, 10) + '...' }),  // 보안: 일부만 표시
                error_message: result.error
            });

            // 에러 응답
            return errorResponse(
                res,
                result.error,
                result.statusCode || 401,
                result.errorCode || 'INVALID_API_KEY'
            );
        }

        // 6. 검증 성공 - 응답 준비
        const responseTime = Date.now() - startTime;

        // 7. 성공 로깅
        await validateApiKeyService.logValidationAttempt({
            api_key_id: result.api_key_id,
            user_id: result.user_id,
            endpoint: '/api/validate-key',
            method: 'POST',
            status_code: 200,
            response_time_ms: responseTime,
            ip_address: req.ip,
            request_body: JSON.stringify({ api_key: api_key.substring(0, 10) + '...' }),
            error_message: null
        });

        // 8. 성공 응답
        successResponse(
            res,
            {
                user_id: result.user_id,
                api_key_id: result.api_key_id,
                creation_date: result.created_at,
                expiration_date: result.expires_at,
                is_active: !!result.is_active
            },
            'API Key 검증 성공',
            200
        );

    } catch (err) {
        // 예상치 못한 에러 처리
        const responseTime = Date.now() - startTime;

        console.error('[VALIDATE_API_KEY_ERROR]', {
            error: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });

        // 에러 로깅
        await validateApiKeyService.logValidationAttempt({
            api_key_id: null,
            user_id: null,
            endpoint: '/api/validate-key',
            method: 'POST',
            status_code: 500,
            response_time_ms: responseTime,
            ip_address: req.ip,
            request_body: req.body ? JSON.stringify(req.body) : null,
            error_message: err.message
        }).catch(logErr => {
            console.error('[LOGGING_ERROR]', logErr.message);
        });

        // 서버 에러 응답
        errorResponse(
            res,
            '서버 오류가 발생했습니다',
            500,
            'INTERNAL_ERROR'
        );
    }
}

/**
 * 모듈 내보내기
 */
module.exports = {
    validateApiKey
};