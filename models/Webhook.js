/**
 * Webhook 모델
 * 이벤트 기반 Webhook 등록 및 관리
 * 역할: 사용자 지정 이벤트 알림 시스템
 * 
 * 사용 사례:
 * - 구독 활성화/만료 알림
 * - API 호출 제한 도달 알림
 * - 사용자 차단 알림
 */

class Webhook {
    // ========== 데이터베이스 필드 매핑 ==========
    static FIELDS = {
        id: 'id',                          // Webhook 고유 ID
        userId: 'user_id',                 // 소유자 사용자 ID
        webhookUrl: 'webhook_url',         // POST 요청을 받을 Webhook URL
        eventType: 'event_type',           // 이벤트 종류 (e.g., "subscription_activated")
        isActive: 'is_active',             // 활성화 상태 (0 또는 1)
        secretToken: 'secret_token',       // HMAC-SHA256 서명용 시크릿
        retryCount: 'retry_count',         // 실패 시 재시도 횟수
        timeoutMs: 'timeout_ms',           // 요청 타임아웃 (밀리초)
        createdAt: 'created_at',           // 생성 일시
        updatedAt: 'updated_at'            // 수정 일시
    };

    static TABLE = 'Webhooks';

    /**
     * Webhook 저장 쿼리
     * @param {Object} webhookData - Webhook 데이터
     * @returns {string} INSERT 쿼리
     */
    static getSaveQuery(webhookData) {
        const fields = Object.keys(webhookData)
            .map(f => this.FIELDS[f] || f)
            .join(', ');
        
        const values = Object.keys(webhookData)
            .map(f => `@${f}`)
            .join(', ');

        return `INSERT INTO [${this.TABLE}] (${fields}) VALUES (${values})`;
    }

    /**
     * 특정 사용자의 모든 Webhook 조회
     * @param {string} userId - 사용자 ID
     * @returns {string} SELECT 쿼리
     */
    static getWebhooksByUserQuery(userId) {
        return `SELECT * FROM [${this.TABLE}] 
                WHERE user_id = @userId 
                ORDER BY created_at DESC`;
    }

    /**
     * 활성화된 모든 Webhook 조회
     * @returns {string} SELECT 쿼리
     */
    static getActiveWebhooksQuery() {
        return `SELECT * FROM [${this.TABLE}] 
                WHERE is_active = 1 
                ORDER BY created_at DESC`;
    }

    /**
     * 특정 이벤트 타입의 활성 Webhook 조회
     * @param {string} eventType - 이벤트 타입
     * @returns {string} SELECT 쿼리
     */
    static getWebhooksByEventQuery(eventType) {
        return `SELECT * FROM [${this.TABLE}] 
                WHERE event_type = @eventType AND is_active = 1`;
    }

    /**
     * 사용자의 특정 이벤트 Webhook 조회
     * @param {string} userId - 사용자 ID
     * @param {string} eventType - 이벤트 타입
     * @returns {string} SELECT 쿼리
     */
    static getWebhookByUserAndEventQuery(userId, eventType) {
        return `SELECT * FROM [${this.TABLE}] 
                WHERE user_id = @userId AND event_type = @eventType`;
    }

    /**
     * Webhook 정보 업데이트
     * @param {string} webhookId - Webhook ID
     * @param {Object} updateData - 업데이트할 데이터
     * @returns {string} UPDATE 쿼리
     */
    static getUpdateQuery(webhookId, updateData) {
        const updates = Object.keys(updateData)
            .map(key => `${this.FIELDS[key] || key} = @${key}`)
            .join(', ');

        return `UPDATE [${this.TABLE}] 
                SET ${updates}, updated_at = GETDATE() 
                WHERE id = @webhookId`;
    }

    /**
     * Webhook 활성화/비활성화 토글
     * @param {string} webhookId - Webhook ID
     * @param {boolean} isActive - 활성화 여부
     * @returns {string} UPDATE 쿼리
     */
    static getToggleActiveQuery(webhookId, isActive) {
        return `UPDATE [${this.TABLE}] 
                SET is_active = ${isActive ? 1 : 0}, updated_at = GETDATE() 
                WHERE id = @webhookId`;
    }

    /**
     * Webhook 삭제
     * @param {string} webhookId - Webhook ID
     * @returns {string} DELETE 쿼리
     */
    static getDeleteQuery(webhookId) {
        return `DELETE FROM [${this.TABLE}] WHERE id = @webhookId`;
    }

    /**
     * 사용자의 모든 Webhook 삭제
     * @param {string} userId - 사용자 ID
     * @returns {string} DELETE 쿼리
     */
    static getDeleteByUserQuery(userId) {
        return `DELETE FROM [${this.TABLE}] WHERE user_id = @userId`;
    }

    /**
     * Webhook 통계 조회 (이벤트별)
     * @returns {string} SELECT 쿼리
     */
    static getStatisticsQuery() {
        return `SELECT 
                    event_type,
                    COUNT(*) as total_count,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count,
                    COUNT(DISTINCT user_id) as users_with_webhooks
                FROM [${this.TABLE}]
                GROUP BY event_type
                ORDER BY total_count DESC`;
    }

    /**
     * 사용자별 Webhook 개수 조회
     * @returns {string} SELECT 쿼리
     */
    static getWebhooksPerUserQuery() {
        return `SELECT 
                    user_id,
                    COUNT(*) as webhook_count,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count
                FROM [${this.TABLE}]
                GROUP BY user_id
                ORDER BY webhook_count DESC`;
    }

    /**
     * 재시도 횟수 감소
     * @param {string} webhookId - Webhook ID
     * @returns {string} UPDATE 쿼리
     */
    static getUpdateRetryConfigQuery(webhookId) {
        return `UPDATE [${this.TABLE}] 
                SET retry_count = retry_count - 1, updated_at = GETDATE() 
                WHERE id = @webhookId AND retry_count > 0`;
    }
}

module.exports = Webhook;