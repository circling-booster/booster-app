/**
 * Webhook Log 모델
 * Webhook 배달 및 재시도 로그
 */

class WebhookLog {
    static FIELDS = {
        id: 'id',
        webhookId: 'webhook_id',
        eventType: 'event_type',
        eventData: 'event_data',
        statusCode: 'status_code',
        responseBody: 'response_body',
        attemptNumber: 'attempt_number',
        nextRetryAt: 'next_retry_at',
        errorMessage: 'error_message',
        createdAt: 'created_at'
    };

    static TABLE = 'WebhookLogs';

    /**
     * Webhook 로그 저장
     * @param {Object} logData - 로그 데이터
     * @returns {string} SQL 쿼리
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
     * 특정 Webhook의 로그 조회
     * @param {string} webhookId - Webhook ID
     * @param {number} limit - 조회 수
     * @returns {string} SQL 쿼리
     */
    static getLogsByWebhookQuery(webhookId, limit = 50) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE webhook_id = @webhookId 
                ORDER BY created_at DESC`;
    }

    /**
     * 특정 이벤트 타입의 로그
     * @param {string} eventType - 이벤트 타입
     * @param {number} limit - 조회 수
     * @returns {string} SQL 쿼리
     */
    static getLogsByEventTypeQuery(eventType, limit = 50) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE event_type = @eventType 
                ORDER BY created_at DESC`;
    }

    /**
     * 실패한 배달 조회
     * @param {number} limit - 조회 수
     * @returns {string} SQL 쿼리
     */
    static getFailedDeliveriesQuery(limit = 50) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE status_code IS NULL OR status_code >= 400 
                ORDER BY created_at DESC`;
    }

    /**
     * 재시도 대기 중인 배달
     * @returns {string} SQL 쿼리
     */
    static getPendingRetriesQuery() {
        return `SELECT * FROM [${this.TABLE}] 
                WHERE next_retry_at IS NOT NULL 
                AND next_retry_at <= GETDATE()
                AND attempt_number < 3
                ORDER BY next_retry_at ASC`;
    }

    /**
     * 배달 상태별 통계
     * @returns {string} SQL 쿼리
     */
    static getDeliveryStatisticsQuery() {
        return `SELECT 
                    webhook_id,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status_code IS NULL THEN 1 ELSE 0 END) as network_errors,
                    MAX(created_at) as last_attempt
                FROM [${this.TABLE}]
                GROUP BY webhook_id`;
    }

    /**
     * 이벤트 타입별 배달 통계
     * @returns {string} SQL 쿼리
     */
    static getEventDeliveryStatisticsQuery() {
        return `SELECT 
                    event_type,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed,
                    AVG(CAST(status_code AS FLOAT)) as avg_status_code
                FROM [${this.TABLE}]
                WHERE status_code IS NOT NULL
                GROUP BY event_type
                ORDER BY total_attempts DESC`;
    }

    /**
     * 높은 실패율의 Webhook
     * @param {number} failureThreshold - 실패율 임계값 (기본 50%)
     * @returns {string} SQL 쿼리
     */
    static getHighFailureWebhooksQuery(failureThreshold = 50) {
        return `SELECT TOP 20
                    webhook_id,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed,
                    CAST(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as failure_rate
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -7, GETDATE())
                GROUP BY webhook_id
                HAVING CAST(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) > ${failureThreshold}
                ORDER BY failure_rate DESC`;
    }

    /**
     * 시간대별 배달 패턴
     * @returns {string} SQL 쿼리
     */
    static getHourlyDeliveryPatternQuery() {
        return `SELECT 
                    DATEPART(HOUR, created_at) as hour,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -1, GETDATE())
                GROUP BY DATEPART(HOUR, created_at)
                ORDER BY hour`;
    }

    /**
     * 재시도 횟수별 통계
     * @returns {string} SQL 쿼리
     */
    static getRetryAttemptStatisticsQuery() {
        return `SELECT 
                    attempt_number,
                    COUNT(*) as count,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful,
                    AVG(CAST(status_code AS FLOAT)) as avg_status_code
                FROM [${this.TABLE}]
                GROUP BY attempt_number
                ORDER BY attempt_number`;
    }

    /**
     * 에러 메시지별 통계
     * @returns {string} SQL 쿼리
     */
    static getErrorStatisticsQuery() {
        return `SELECT 
                    error_message,
                    COUNT(*) as count,
                    MAX(created_at) as last_occurrence
                FROM [${this.TABLE}]
                WHERE error_message IS NOT NULL
                GROUP BY error_message
                ORDER BY count DESC`;
    }

    /**
     * 최근 배달 기록
     * @param {number} limit - 조회 수
     * @returns {string} SQL 쿼리
     */
    static getRecentDeliveriesQuery(limit = 100) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                ORDER BY created_at DESC`;
    }

    /**
     * 성공한 배달 조회
     * @param {number} limit - 조회 수
     * @returns {string} SQL 쿼리
     */
    static getSuccessfulDeliveriesQuery(limit = 50) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE status_code >= 200 AND status_code < 300 
                ORDER BY created_at DESC`;
    }

    /**
     * 오래된 로그 정리
     * @param {number} days - 기준 일수 (기본 90일)
     * @returns {string} SQL 쿼리
     */
    static getDeleteOldLogsQuery(days = 90) {
        return `DELETE FROM [${this.TABLE}] 
                WHERE created_at < DATEADD(DAY, -${days}, GETDATE())`;
    }

    /**
     * 상태 코드별 분포
     * @returns {string} SQL 쿼리
     */
    static getStatusCodeDistributionQuery() {
        return `SELECT 
                    CASE 
                        WHEN status_code IS NULL THEN 'Network Error'
                        WHEN status_code >= 200 AND status_code < 300 THEN '2xx Success'
                        WHEN status_code >= 300 AND status_code < 400 THEN '3xx Redirect'
                        WHEN status_code >= 400 AND status_code < 500 THEN '4xx Client Error'
                        WHEN status_code >= 500 THEN '5xx Server Error'
                    END as status_category,
                    COUNT(*) as count
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -30, GETDATE())
                GROUP BY CASE 
                    WHEN status_code IS NULL THEN 'Network Error'
                    WHEN status_code >= 200 AND status_code < 300 THEN '2xx Success'
                    WHEN status_code >= 300 AND status_code < 400 THEN '3xx Redirect'
                    WHEN status_code >= 400 AND status_code < 500 THEN '4xx Client Error'
                    WHEN status_code >= 500 THEN '5xx Server Error'
                END
                ORDER BY count DESC`;
    }
}

module.exports = WebhookLog;