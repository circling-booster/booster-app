/**
 * API Key Middleware - API Key 검증 및 Rate Limit 확인
 * 
 * 역할:
 * - x-api-key, x-api-secret 헤더 검증
 * - ApiKeys 테이블에서 유효성 확인
 * - 사용자 활성화 상태, 구독 활성화 상태, API 호출 한도 확인
 * - 월간 API 사용량 추적
 */

const apiKeyService = require('../services/apiKeyService');
const subscriptionService = require('../services/subscriptionService');
const errorResponse = require('../utils/errorResponse');
const { executeNonQuery, executeQuery } = require('../config/database');

/**
 * API Key 및 Rate Limit 검증 미들웨어
 * 
 * @param {Object} req - Express 요청 객체
 *   - req.headers['x-api-key']: API Key
 *   - req.headers['x-api-secret']: API Secret
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 호출
 * 
 * @flow
 * 1. 헤더에서 x-api-key, x-api-secret 추출
 * 2. ApiKeys 테이블에서 검증
 * 3. 사용자 활성화 상태 확인
 * 4. 구독 활성화 상태 확인
 * 5. 월간 API 호출 한도 확인
 * 6. 모든 검증 통과 → req.apiKeyInfo, req.currentUsage 설정 후 next()
 * 7. 검증 실패 → 적절한 에러 코드 응답
 * 
 * @example
 * // 사용 시 - router에 미들웨어 추가
 * router.post('/api/data', validateApiKeyMiddleware, controller.getData);
 * // 요청 시 헤더 포함:
 * // headers: {
 * //   'x-api-key': 'sk_abc123...',
 * //   'x-api-secret': 'def456...'
 * // }
 */
async function validateApiKeyMiddleware(req, res, next) {
    try {
        // 1. 요청 헤더에서 API Key와 Secret 추출
        const apiKey = req.headers['x-api-key'];
        const apiSecret = req.headers['x-api-secret'];

        // 2. 필수값 확인
        if (!apiKey || !apiSecret) {
            // 둘 다 없거나 하나가 없으면 401 반환
            return errorResponse(res, 'API Key와 Secret이 필요합니다', 401, 'MISSING_CREDENTIALS');
        }

        // 3. API Key 서비스를 통한 검증
        // - ApiKeys 테이블에서 조회
        // - api_secret 해싱 후 비교
        // - is_active = 1 확인
        const keyInfo = await apiKeyService.validateApiKey(apiKey, apiSecret);

        // 4. 유효하지 않은 Key/Secret 확인
        if (!keyInfo) {
            return errorResponse(res, '유효하지 않은 API Key입니다', 401, 'INVALID_API_KEY');
        }

        // 5. 사용자 활성화 상태 확인
        // - Users 테이블에서 조회
        // - is_active, is_blocked 플래그 확인
        const users = await executeQuery(
            'SELECT is_active, is_blocked FROM [Users] WHERE id = @userId',
            { userId: keyInfo.user_id }
        );

        // 6. 사용자 존재 및 활성화 상태 확인
        if (users.length === 0 || !users.is_active || users.is_blocked) {
            // 사용자가 없거나 비활성화되거나 차단됨
            return errorResponse(res, '사용자 계정이 비활성화되었습니다', 403, 'USER_BLOCKED');
        }

        // 7. 구독 활성화 상태 확인
        // - UserSubscriptions 테이블에서 조회
        // - status = 'active' 확인
        const isSubscriptionActive = await subscriptionService.isSubscriptionActive(keyInfo.user_id);

        // 8. 활성화된 구독 없음
        if (!isSubscriptionActive) {
            return errorResponse(res, '활성화된 구독이 없습니다', 403, 'SUBSCRIPTION_INACTIVE');
        }

        // 9. 월간 API 호출 횟수 확인
        // - 현재 년도 및 월의 MonthlyUsage 조회
        // - 또는 ApiLogs 테이블에서 해당 월의 요청 수 계산
        const monthlyUsage = await executeQuery(
            `SELECT total_requests FROM [MonthlyUsage]
             WHERE api_key_id = @keyId
             AND YEAR(created_at) = YEAR(GETDATE())
             AND MONTH(created_at) = MONTH(GETDATE())`,
            { keyId: keyInfo.id }
        );

        // 10. 기존 사용량 또는 0으로 초기화
        let currentUsage = 0;
        if (monthlyUsage.length > 0) {
            currentUsage = monthlyUsage.total_requests;
        }

        // 11. 구독 Tier별 API 호출 제한 확인
        // - Basic: 1,000회
        // - Premium: 5,000회
        // - Enterprise: 999,999회
        const subscription = await subscriptionService.getUserSubscription(keyInfo.user_id);

        // 12. 월간 한도 초과 확인
        if (currentUsage >= subscription.api_call_limit) {
            // 429 Too Many Requests 반환
            return errorResponse(res, 'API 호출 제한을 초과했습니다', 429, 'API_LIMIT_EXCEEDED');
        }

        // 13. 모든 검증 통과 - 정보를 req에 저장
        req.apiKeyInfo = keyInfo;           // API Key 정보
        req.currentUsage = currentUsage;    // 현재 월간 사용량
        req.usageLimit = subscription.api_call_limit; // 구독 한도

        // 14. 다음 미들웨어로 진행
        next();
    } catch (err) {
        // 예상치 못한 에러 (DB 연결 오류 등)
        errorResponse(res, err.message, 500);
    }
}

module.exports = { validateApiKeyMiddleware };