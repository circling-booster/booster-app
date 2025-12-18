/**
 * config/constants.js
 * 역할: 전체 애플리케이션에서 사용하는 상수 정의
 * 특징: 하드코딩 제거, 유지보수 용이
 */

module.exports = {
    /**
     * 구독 상태 관리
     * 구독 라이프사이클: pending → active → expired/cancelled
     */
    SUBSCRIPTION_STATUS: {
        PENDING: 'pending',      // 승인 대기 중 (관리자 검토 필요)
        ACTIVE: 'active',        // 활성화된 구독 (API 호출 가능)
        EXPIRED: 'expired',      // 만료된 구독 (자동 갱신 안 함)
        CANCELLED: 'cancelled'   // 취소된 구독 (수동 취소 또는 거절됨)
    },

    /**
     * API Key 상태 관리
     * API Key 라이프사이클: active ↔ inactive, 또는 → expired
     */
    API_KEY_STATUS: {
        ACTIVE: 'active',        // 사용 가능한 API Key
        INACTIVE: 'inactive',    // 비활성화됨 (사용 불가)
        EXPIRED: 'expired'       // 만료됨 (자동으로 사용 불가)
    },

    /**
     * Rate Limit 종류
     * IP 기반, 시간 기반, 월 기반 제한 설정
     */
    RATE_LIMIT_TYPE: {
        HOURLY: 'hourly',        // 시간당 제한 (개발 환경)
        MONTHLY: 'monthly',      // 월당 제한 (API 호출량)
        IP_BASED: 'ip_based'     // IP 기반 제한 (DDoS 방어)
    },

    /**
     * 구독 Tier 정의
     * 각 Tier별 기능 및 제한 설정
     */
    SUBSCRIPTION_TIER: {
        BASIC: 'Basic',          // 기본 티어 (무료 또는 저가)
        PREMIUM: 'Premium',      // 프리미엄 티어 (중급)
        ENTERPRISE: 'Enterprise' // 엔터프라이즈 티어 (고급)
    },

    /**
     * Tier별 API 호출 제한
     * 월 단위 API 호출 가능 횟수
     * 
     * 참고:
     * - Basic: 1,000회/월 (개인 개발자)
     * - Premium: 5,000회/월 (스타트업)
     * - Enterprise: 무제한 (기업)
     */
    API_CALL_LIMITS: {
        'Basic': 1000,
        'Premium': 5000,
        'Enterprise': 999999 // 사실상 무제한
    },

    /**
     * Webhook 이벤트 종류
     * 각 이벤트마다 등록된 Webhook으로 POST 요청 발송
     */
    WEBHOOK_EVENTS: {
        SUBSCRIPTION_ACTIVATED: 'subscription_activated',   // 구독 승인됨
        SUBSCRIPTION_EXPIRED: 'subscription_expired',       // 구독 만료됨
        SUBSCRIPTION_CANCELLED: 'subscription_cancelled',   // 구독 취소됨
        API_LIMIT_REACHED: 'api_limit_reached',            // API 호출 제한 도달
        API_LIMIT_WARNING: 'api_limit_warning',            // API 호출 80% 이상 사용
        USER_BLOCKED: 'user_blocked'                       // 사용자 차단됨
    },

    /**
     * 에러 코드 및 메시지
     * API 응답에서 errorCode로 사용
     * 클라이언트가 에러 종류를 인식하도록 도움
     */
    ERROR_CODES: {
        INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',      // 이메일/비번 오류
        USER_NOT_FOUND: 'USER_NOT_FOUND',               // 사용자 미존재
        USER_BLOCKED: 'USER_BLOCKED',                   // 차단된 사용자
        SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',  // 활성 구독 없음
        API_LIMIT_EXCEEDED: 'API_LIMIT_EXCEEDED',       // API 호출 초과
        INVALID_API_KEY: 'INVALID_API_KEY',             // 잘못된 API Key
        INVALID_TOKEN: 'INVALID_TOKEN',                 // 만료/유효하지 않은 토큰
        UNAUTHORIZED: 'UNAUTHORIZED',                   // 인증 필요
        FORBIDDEN: 'FORBIDDEN',                         // 권한 없음 (관리자 필요)
        NOT_FOUND: 'NOT_FOUND',                         // 리소스 미존재
        INTERNAL_ERROR: 'INTERNAL_ERROR'                // 서버 내부 에러
    }
};

/**
 * 사용 예시:
 * 
 * 1. 구독 상태 확인
 *    if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) { ... }
 * 
 * 2. API 호출 제한 확인
 *    if (usage >= API_CALL_LIMITS[tier]) { ... }
 * 
 * 3. 에러 응답
 *    errorResponse(res, msg, 401, ERROR_CODES.INVALID_TOKEN)
 * 
 * 4. Webhook 발송
 *    sendWebhook(WEBHOOK_EVENTS.SUBSCRIPTION_ACTIVATED, payload)
 */