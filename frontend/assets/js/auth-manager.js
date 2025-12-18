/**
 * auth-manager.js - 사용자 인증 및 토큰 관리
 * 
 * 역할:
 * - localStorage에서 토큰과 사용자 정보 관리
 * - 로그인/로그아웃 상태 추적
 * - 관리자 권한 확인
 * 
 * 저장 정보:
 * - booster_access_token: JWT Access Token
 * - booster_refresh_token: JWT Refresh Token
 * - booster_user_info: 사용자 정보 (JSON)
 */

(function (window) {
    /**
     * 인증 정보를 관리하는 클래스
     */
    class AuthManager {
        constructor() {
            // STORAGE_KEYS가 정의되지 않았을 경우 기본값 사용
            const keys = window.STORAGE_KEYS || {
                ACCESS_TOKEN: 'booster_access_token',
                REFRESH_TOKEN: 'booster_refresh_token',
                USER_INFO: 'booster_user_info'
            };

            // localStorage에서 저장된 토큰과 사용자 정보 읽기
            this.accessToken = localStorage.getItem(keys.ACCESS_TOKEN);
            this.refreshToken = localStorage.getItem(keys.REFRESH_TOKEN);

            /**
             * 사용자 정보 안전하게 파싱
             * - 값이 없거나 "undefined" 문자열인 경우 처리
             * - JSON 파싱 실패 시 null로 설정
             */
            const storedUserInfo = localStorage.getItem(keys.USER_INFO);
            if (storedUserInfo && storedUserInfo !== "undefined") {
                try {
                    this.userInfo = JSON.parse(storedUserInfo);
                } catch (e) {
                    console.error("사용자 정보 파싱 오류:", e);
                    this.userInfo = null;
                }
            } else {
                this.userInfo = null;
            }
        }

        /**
         * 토큰 저장
         * @param {string} accessToken - Access Token
         * @param {string} refreshToken - Refresh Token
         */
        setTokens(accessToken, refreshToken) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            localStorage.setItem(window.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
            localStorage.setItem(window.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
            if (typeof isAdmin === 'boolean') {
                const currentUser = this.userInfo || {};
                currentUser.is_admin = isAdmin;
                currentUser.isAdmin = isAdmin;
                currentUser.role = isAdmin ? 'admin' : (currentUser.role || 'user');
                this.setUserInfo(currentUser);
            }
        }


        /**
         * 사용자 정보 저장
         * @param {Object} userInfo - 사용자 정보
         */
        setUserInfo(userInfo) {
            this.userInfo = userInfo;
            if (userInfo) {
                localStorage.setItem(window.STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
            } else {
                localStorage.removeItem(window.STORAGE_KEYS.USER_INFO);
            }
        }

        /**
         * Access Token 반환
         * @returns {string|null} Access Token
         */
        getAccessToken() {
            return this.accessToken;
        }

        /**
         * Refresh Token 반환
         * @returns {string|null} Refresh Token
         */
        getRefreshToken() {
            return this.refreshToken;
        }

        /**
         * 사용자 정보 반환
         * @returns {Object|null} 사용자 정보
         */
        getUserInfo() {
            return this.userInfo;
        }

        /**
         * 로그인 상태 확인
         * @returns {boolean} 로그인 여부
         */
        isLoggedIn() {
            return !!this.accessToken && !!this.refreshToken;
        }

        /**
         * 관리자 권한 확인
         * @returns {boolean} 관리자 여부
         */
        isAdmin() {
            // 1차: userInfo 기반
            if (this.userInfo) {
                if (this.userInfo.role === 'admin') return true;
                if (this.userInfo.is_admin === true) return true;
                if (this.userInfo.isAdmin === true) return true;
                if (this.userInfo.isadmin === 1 || this.userInfo.isadmin === true) return true;
            }

            // 2차: 토큰 payload 기반 (fallback)
            try {
                const token = this.getAccessToken();
                if (token) {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payloadBase64 = parts[1];
                        const payloadJson = atob(payloadBase64);
                        const payload = JSON.parse(payloadJson);

                        if (payload.isAdmin === true ||
                            payload.isAdmin === 1 ||
                            payload.isAdmin === '1' ||
                            payload.isAdmin === 'true') {
                            return true;
                        }
                    }
                }
            } catch (e) {
                console.error('토큰 파싱 중 오류:', e);
            }

            return false;
        }

        /**
         * 로그아웃
         * - 로컬 토큰 및 사용자 정보 삭제
         * - localStorage 정리
         * - 로그인 페이지로 리다이렉트
         */
        logout() {
            this.accessToken = null;
            this.refreshToken = null;
            this.userInfo = null;
            localStorage.removeItem(window.STORAGE_KEYS.ACCESS_TOKEN);
            localStorage.removeItem(window.STORAGE_KEYS.REFRESH_TOKEN);
            localStorage.removeItem(window.STORAGE_KEYS.USER_INFO);

            // 로그인 페이지로 리다이렉트
            window.location.href = '/pages/auth/login.html';
        }
    }

    // 전역 인스턴스 생성 (페이지 로드 시 자동으로 토큰 읽기)
    window.authManager = new AuthManager();
})(window);
