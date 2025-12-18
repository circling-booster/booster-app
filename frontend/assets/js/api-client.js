/**
 * api-client.js - REST API 요청 클라이언트
 * 
 * 역할:
 * - HTTP 메서드 (GET, POST, PUT, DELETE) 래핑
 * - 자동 JWT 토큰 헤더 추가
 * - 401 응답 시 자동 토큰 갱신 및 재요청
 * - 통일된 에러 처리
 * 
 * 사용 방식:
 * window.apiClient.get('/users/profile')
 * window.apiClient.post('/auth/login', {email, password})
 */

(function (window) {
    /**
     * API 요청을 관리하는 클래스
     */
    class ApiClient {
        /**
         * 생성자
         * @param {string} baseURL - API 기본 URL (window.API_CONFIG.BASE_URL에서 가져옴)
         * @param {number} timeout - 요청 타임아웃 (밀리초)
         */
        constructor(baseURL = window.API_CONFIG.BASE_URL, timeout = window.API_CONFIG.TIMEOUT) {
            this.baseURL = baseURL;
            this.timeout = timeout;
            // 토큰 갱신 중복 요청 방지 플래그
            this.isRefreshing = false;
        }

        /**
         * HTTP 요청 헤더 구성
         * @param {boolean} includeAuth - 인증 헤더 포함 여부
         * @returns {Object} 헤더 객체
         */
        getHeaders(includeAuth = true) {
            const headers = {
                'Content-Type': 'application/json'
            };

            // authManager에서 access token 가져와 Authorization 헤더 추가
            if (includeAuth && window.authManager) {
                const token = window.authManager.getAccessToken();
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }

            return headers;
        }

        /**
         * 실제 fetch 호출 및 에러 처리
         * @param {string} endpoint - API 엔드포인트 (e.g., "/users/profile")
         * @param {Object} options - fetch 옵션
         * @returns {Promise<Object>} 응답 데이터
         */
        async fetch(endpoint, options = {}) {
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                ...options,
                headers: {
                    ...this.getHeaders(options.includeAuth !== false),
                    ...options.headers
                }
            };

            try {
                let response = await fetch(url, config);

                /**
                 * ========== 토큰 갱신 로직 (401 응답 처리) ==========
                 * 서버에서 401 Unauthorized를 받으면:
                 * 1. refresh-token 엔드포인트로 새 access token 요청
                 * 2. 성공하면 localStorage 업데이트 후 원래 요청 재시도
                 * 3. 실패하면 로그아웃 (로그인 페이지로 리다이렉트)
                 */
                if (response.status === 401 && !options._retry) {
                    // 이미 갱신 시도 중이면 중단 (무한 루프 방지)
                    if (this.isRefreshing) {
                        return response;
                    }

                    options._retry = true;
                    this.isRefreshing = true;

                    // 토큰 갱신 시도
                    const refreshSuccess = await this.refreshAccessToken();
                    this.isRefreshing = false;

                    if (refreshSuccess) {
                        // 새 토큰으로 헤더 업데이트 후 원래 요청 재시도
                        config.headers = {
                            ...config.headers,
                            ...this.getHeaders(true)
                        };
                        return await fetch(url, config);
                    } else {
                        // 갱신 실패 시 로그아웃
                        if (window.authManager) {
                            window.authManager.logout();
                        } else {
                            window.location.href = '/pages/auth/login.html';
                        }
                        return;
                    }
                }

                // 응답을 JSON으로 파싱
                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    throw new Error(`Failed to parse response: ${e.message}`);
                }

                // HTTP 에러 상태 확인
                if (!response.ok) {
                    throw new Error(data.message || `HTTP error! status: ${response.status}`);
                }

                return data;
            } catch (err) {
                console.error('API Error:', err);
                throw err;
            }
        }

        /**
         * ========== 토큰 갱신 함수 ==========
         * Refresh Token을 사용하여 새로운 Access Token 획득
         * @returns {Promise<boolean>} 성공 여부
         */
        async refreshAccessToken() {
            try {
                if (!window.authManager) return false;

                const refreshToken = window.authManager.getRefreshToken();
                if (!refreshToken) return false;

                const response = await fetch(`${this.baseURL}/auth/refresh-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ refreshToken })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data.accessToken) {
                        // ✅ isAdmin도 함께 업데이트
                        const newRefreshToken = data.data.refreshToken || window.authManager.getRefreshToken();
                        window.authManager.setTokens(
                            data.data.accessToken,
                            newRefreshToken,
                            data.data.isAdmin  // ✅ 추가
                        );
                        return true;
                    }
                }
                return false;
            } catch (error) {
                console.error("Token refresh failed:", error);
                return false;
            }
        }


        /**
         * GET 요청
         * @param {string} endpoint - 엔드포인트
         * @param {Object} options - fetch 옵션
         * @returns {Promise<Object>} 응답 데이터
         */
        async get(endpoint, options = {}) {
            return this.fetch(endpoint, { ...options, method: 'GET' });
        }

        /**
         * POST 요청
         * @param {string} endpoint - 엔드포인트
         * @param {Object} data - 요청 본문
         * @param {Object} options - fetch 옵션
         * @returns {Promise<Object>} 응답 데이터
         */
        async post(endpoint, data, options = {}) {
            return this.fetch(endpoint, {
                ...options,
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        /**
         * PUT 요청
         * @param {string} endpoint - 엔드포인트
         * @param {Object} data - 요청 본문
         * @param {Object} options - fetch 옵션
         * @returns {Promise<Object>} 응답 데이터
         */
        async put(endpoint, data, options = {}) {
            return this.fetch(endpoint, {
                ...options,
                method: 'PUT',
                body: JSON.stringify(data)
            });
        }

        /**
         * DELETE 요청
         * @param {string} endpoint - 엔드포인트
         * @param {Object} options - fetch 옵션
         * @returns {Promise<Object>} 응답 데이터
         */
        async delete(endpoint, options = {}) {
            return this.fetch(endpoint, { ...options, method: 'DELETE' });
        }
    }

    // 전역 인스턴스 생성
    window.apiClient = new ApiClient();
})(window);
