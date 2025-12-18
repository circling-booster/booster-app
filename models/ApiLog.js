/**
 * ApiLog 모델
 * API 호출 로그 및 통계 조회를 위한 쿼리 헬퍼
 * 역할: API 요청 기록, 성능 모니터링, 통계 수집
 */

class ApiLog {
    // ========== 데이터베이스 필드 매핑 ==========
    static FIELDS = {
        id: 'id',                          // 로그 고유 ID
        apiKeyId: 'api_key_id',            // API Key ID (외래키)
        userId: 'user_id',                 // 사용자 ID
        endpoint: 'endpoint',              // API 엔드포인트 (e.g., "/api/users/profile")
        method: 'method',                  // HTTP 메서드 (GET, POST, PUT, DELETE)
        statusCode: 'status_code',         // HTTP 상태 코드 (200, 404, 500 등)
        responseTimeMs: 'response_time_ms',// 응답 시간 (밀리초)
        ipAddress: 'ip_address',           // 요청 IP 주소
        requestBody: 'request_body',       // 요청 본문 (JSON 저장)
        errorMessage: 'error_message',     // 에러 메시지 (에러 발생 시)
        createdAt: 'created_at'            // 생성 일시
    };

    static TABLE = 'ApiLogs';

    /**
     * API 로그 저장 쿼리
     * @param {Object} logData - 로그 데이터
     * @returns {string} INSERT 쿼리
     */
    static getSaveQuery(logData) {
        const fields = Object.keys(logData)
            .map(f => this.FIELDS[f] || f)
            .join(', ');
        
        const values = Object.keys(logData)
            .map(f => `@${f}`)
            .join(', ');

        return `INSERT INTO [${this.TABLE}] (${fields}) VALUES (${values})`;
    }

    /**
     * 특정 API Key의 로그 조회 (최근 100개)
     * @param {string} apiKeyId - API Key ID
     * @param {number} limit - 조회 수 (기본 100)
     * @returns {string} SELECT 쿼리
     */
    static getLogsByApiKeyQuery(apiKeyId, limit = 100) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE api_key_id = @apiKeyId 
                ORDER BY created_at DESC`;
    }

    /**
     * 특정 사용자의 로그 조회 (페이지네이션)
     * @param {string} userId - 사용자 ID
     * @param {number} page - 페이지 번호 (1부터 시작)
     * @param {number} pageSize - 페이지 크기 (기본 20)
     * @returns {string} SELECT 쿼리
     */
    static getLogsByUserQuery(userId, page = 1, pageSize = 20) {
        const offset = (page - 1) * pageSize;
        return `SELECT * FROM [${this.TABLE}] 
                WHERE user_id = @userId 
                ORDER BY created_at DESC 
                OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
    }

    /**
     * 날짜 범위로 로그 조회
     * @param {Date} startDate - 시작 날짜
     * @param {Date} endDate - 종료 날짜
     * @param {number} page - 페이지 번호
     * @param {number} pageSize - 페이지 크기
     * @returns {string} SELECT 쿼리
     */
    static getLogsByDateRangeQuery(startDate, endDate, page = 1, pageSize = 20) {
        const offset = (page - 1) * pageSize;
        return `SELECT * FROM [${this.TABLE}] 
                WHERE created_at BETWEEN @startDate AND @endDate 
                ORDER BY created_at DESC 
                OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
    }

    /**
     * 엔드포인트별 통계 조회 (지난 30일)
     * 각 엔드포인트별 호출 수, 평균 응답시간, 성공/실패 수
     * @returns {string} SELECT 쿼리
     */
    static getEndpointStatisticsQuery() {
        return `SELECT 
                    endpoint,
                    method,
                    COUNT(*) as total_calls,
                    AVG(response_time_ms) as avg_response_time,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -30, GETDATE())
                GROUP BY endpoint, method
                ORDER BY total_calls DESC`;
    }

    /**
     * 상태 코드별 통계 (지난 30일)
     * @returns {string} SELECT 쿼리
     */
    static getStatusCodeStatisticsQuery() {
        return `SELECT 
                    status_code,
                    COUNT(*) as count,
                    AVG(response_time_ms) as avg_response_time
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -30, GETDATE())
                GROUP BY status_code
                ORDER BY count DESC`;
    }

    /**
     * 응답 시간 분포 (지난 30일)
     * 응답 시간을 범위별로 분류하여 카운트
     * @returns {string} SELECT 쿼리
     */
    static getResponseTimeDistributionQuery() {
        return `SELECT 
                    CASE 
                        WHEN response_time_ms < 100 THEN '0-100ms'
                        WHEN response_time_ms < 500 THEN '100-500ms'
                        WHEN response_time_ms < 1000 THEN '500-1000ms'
                        ELSE '>1000ms'
                    END as response_time_range,
                    COUNT(*) as count
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -30, GETDATE())
                GROUP BY CASE 
                    WHEN response_time_ms < 100 THEN '0-100ms'
                    WHEN response_time_ms < 500 THEN '100-500ms'
                    WHEN response_time_ms < 1000 THEN '500-1000ms'
                    ELSE '>1000ms'
                END`;
    }

    /**
     * 시간대별 트래픽 (지난 24시간)
     * @returns {string} SELECT 쿼리
     */
    static getHourlyTrafficQuery() {
        return `SELECT 
                    DATEPART(HOUR, created_at) as hour,
                    COUNT(*) as count,
                    AVG(response_time_ms) as avg_response_time
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -1, GETDATE())
                GROUP BY DATEPART(HOUR, created_at)
                ORDER BY hour`;
    }

    /**
     * 에러 로그 조회 (상태코드 >= 400 또는 에러 메시지 존재)
     * @param {number} limit - 조회 수
     * @returns {string} SELECT 쿼리
     */
    static getErrorLogsQuery(limit = 50) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE status_code >= 400 OR error_message IS NOT NULL 
                ORDER BY created_at DESC`;
    }

    /**
     * 느린 요청 조회 (응답 시간 > 1초)
     * @param {number} limit - 조회 수
     * @returns {string} SELECT 쿼리
     */
    static getSlowRequestsQuery(limit = 50) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE response_time_ms > 1000 
                ORDER BY response_time_ms DESC`;
    }

    /**
     * 오래된 로그 삭제 (데이터 저장소 관리용)
     * @param {number} days - 기준 일수 (기본 90일)
     * @returns {string} DELETE 쿼리
     */
    static getDeleteOldLogsQuery(days = 90) {
        return `DELETE FROM [${this.TABLE}] 
                WHERE created_at < DATEADD(DAY, -${days}, GETDATE())`;
    }
}

module.exports = ApiLog;