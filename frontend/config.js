(function (window) {

    const API_CONFIG = {
        BASE_URL: window.location.hostname === 'localhost'
            ? 'http://localhost:3000/api'
            : `${window.location.origin}/api`,
        TIMEOUT: 30000,

        // API 엔드포인트
        ENDPOINTS: {
            // 인증
            AUTH: {
                SIGNUP: '/auth/signup',
                LOGIN: '/auth/login',
                REFRESH: '/auth/refresh-token'
            },

            // 사용자
            USER: {
                PROFILE: '/users/profile',
                UPDATE_PROFILE: '/users/profile',
                CHANGE_PASSWORD: '/users/change-password'
            },

            // API 키
            API_KEYS: {
                CREATE: '/api-keys',
                LIST: '/api-keys',
                DELETE: (keyId) => `/api-keys/${keyId}`
            },

            // 구독
            SUBSCRIPTION: {
                REQUEST: '/subscriptions/request',
                MY_SUB: '/subscriptions/my-subscription',
                TIERS: '/subscriptions/tiers'
            },

            // 대시보드
            DASHBOARD: {
                STATS: '/dashboard/stats',
                LOGS: '/dashboard/logs'
            },

            // 관리자
            ADMIN: {
                USERS: '/admin/users',
                SUBSCRIPTIONS: '/admin/subscriptions/pending',
                APPROVE_SUB: (id) => `/admin/subscriptions/${id}/approve`,
                REJECT_SUB: (id) => `/admin/subscriptions/${id}/reject`,
                BLOCK_USER: (id) => `/admin/users/${id}/block`,
                UNBLOCK_USER: (id) => `/admin/users/${id}/unblock`,
                STATS: '/admin/stats'
            },

            // Webhook
            WEBHOOKS: {
                CREATE: '/webhooks',
                LIST: '/webhooks'
            }
        }
    };

    // 로컬 스토리지 키
    const STORAGE_KEYS = {
        ACCESS_TOKEN: 'booster_access_token',
        REFRESH_TOKEN: 'booster_refresh_token',
        USER_INFO: 'booster_user_info',
        THEME: 'booster_theme'
    };

    // 토큰 만료 시간 (밀리초)
    const TOKEN_EXPIRY = {
        ACCESS: 7 * 24 * 60 * 60 * 1000,     // 7일
        REFRESH: 30 * 24 * 60 * 60 * 1000    // 30일
    };

    // UI 설정
    const UI_CONFIG = {
        ITEMS_PER_PAGE: 20,
        CHART_COLORS: ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'],
        DEFAULT_TOAST_DURATION: 3000
    };

    // 구독 Tier 정보
    const SUBSCRIPTION_TIERS = {
        BASIC: {
            name: 'Basic',
            limit: 1000,
            price: '무료',
            features: ['월 1,000 API 호출', '기본 지원', 'Webhook 지원']
        },
        PREMIUM: {
            name: 'Premium',
            limit: 5000,
            price: '\$99/월',
            features: ['월 5,000 API 호출', '우선 지원', 'Webhook 지원', '고급 분석']
        },
        ENTERPRISE: {
            name: 'Enterprise',
            limit: 999999,
            price: '커스텀',
            features: ['무제한 API 호출', 'VIP 지원', 'Webhook 지원', 'SLA 보장']
        }
    };


    // 전역 객체에 할당
    window.API_CONFIG = API_CONFIG;
    window.STORAGE_KEYS = STORAGE_KEYS;
    window.TOKEN_EXPIRY = TOKEN_EXPIRY;
    window.UI_CONFIG = UI_CONFIG;
    window.SUBSCRIPTION_TIERS = SUBSCRIPTION_TIERS;
})(window);