/**
 * Rate Limit Log 모델
 * Rate Limit 위반 기록
 */

class RateLimitLog {
    static FIELDS = {
        id: 'id',
        apiKeyId: 'api_key_id',
        userId: 'user_id',
        ipAddress: 'ip_address',
        limitType: 'limit_type',
        resetAt: 'reset_at',
        createdAt: 'created_at'
    };

    static TABLE = 'RateLimitLogs';

    /**
     * Rate Limit 위반 로그 저장
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
     * 특정 API Key의 위반 로그 조회
     * @param {string} apiKeyId - API Key ID
     * @param {number} limit - 조회 수
     * @returns {string} SQL 쿼리
     */
    static getViolationsByApiKeyQuery(apiKeyId, limit = 50) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE api_key_id = @apiKeyId 
                ORDER BY created_at DESC`;
    }

    /**
     * 특정 사용자의 위반 로그 조회
     * @param {string} userId - 사용자 ID
     * @param {number} limit - 조회 수
     * @returns {string} SQL 쿼리
     */
    static getViolationsByUserQuery(userId, limit = 50) {
        return `SELECT TOP ${limit} * FROM [${this.TABLE}] 
                WHERE user_id = @userId 
                ORDER BY created_at DESC`;
    }

    /**
     * 특정 IP의 위반 로그 조회
     * @param {string} ipAddress - IP 주소
     * @param {number} hours - 조회 기간 (시간)
     * @returns {string} SQL 쿼리
     */
    static getViolationsByIpQuery(ipAddress, hours = 24) {
        return `SELECT * FROM [${this.TABLE}] 
                WHERE ip_address = @ipAddress 
                AND created_at > DATEADD(HOUR, -${hours}, GETDATE())
                ORDER BY created_at DESC`;
    }

    /**
     * 최근 위반 통계
     * @param {number} hours - 조회 기간 (시간)
     * @returns {string} SQL 쿼리
     */
    static getRecentViolationStatisticsQuery(hours = 24) {
        return `SELECT 
                    limit_type,
                    COUNT(*) as count,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT ip_address) as unique_ips
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(HOUR, -${hours}, GETDATE())
                GROUP BY limit_type`;
    }

    /**
     * 시간대별 위반 로그
     * @returns {string} SQL 쿼리
     */
    static getHourlyViolationsQuery() {
        return `SELECT 
                    DATEPART(HOUR, created_at) as hour,
                    limit_type,
                    COUNT(*) as count
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -1, GETDATE())
                GROUP BY DATEPART(HOUR, created_at), limit_type
                ORDER BY hour`;
    }

    /**
     * 위반 유형별 통계
     * @returns {string} SQL 쿼리
     */
    static getViolationTypeStatisticsQuery() {
        return `SELECT 
                    limit_type,
                    COUNT(*) as total_violations,
                    COUNT(DISTINCT api_key_id) as affected_keys,
                    COUNT(DISTINCT user_id) as affected_users,
                    COUNT(DISTINCT ip_address) as affected_ips
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(DAY, -30, GETDATE())
                GROUP BY limit_type
                ORDER BY total_violations DESC`;
    }

    /**
     * 반복 위반 API Key 조회
     * @param {number} hours - 조회 기간 (시간)
     * @param {number} threshold - 임계값 (기본 3회 이상)
     * @returns {string} SQL 쿼리
     */
    static getRepeatedViolationsQuery(hours = 24, threshold = 3) {
        return `SELECT 
                    api_key_id,
                    user_id,
                    COUNT(*) as violation_count,
                    MAX(created_at) as last_violation
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(HOUR, -${hours}, GETDATE())
                GROUP BY api_key_id, user_id
                HAVING COUNT(*) >= ${threshold}
                ORDER BY violation_count DESC`;
    }

    /**
     * IP 주소 기반 위반 패턴
     * @param {number} hours - 조회 기간 (시간)
     * @returns {string} SQL 쿼리
     */
    static getIpViolationPatternsQuery(hours = 24) {
        return `SELECT 
                    ip_address,
                    COUNT(*) as total_violations,
                    COUNT(DISTINCT api_key_id) as distinct_keys,
                    COUNT(DISTINCT user_id) as distinct_users,
                    limit_type,
                    MIN(created_at) as first_violation,
                    MAX(created_at) as last_violation
                FROM [${this.TABLE}]
                WHERE created_at > DATEADD(HOUR, -${hours}, GETDATE())
                GROUP BY ip_address, limit_type
                HAVING COUNT(*) > 5
                ORDER BY total_violations DESC`;
    }

    /**
     * 위반 로그 정리 (오래된 데이터)
     * @param {number} days - 기준 일수 (기본 30일)
     * @returns {string} SQL 쿼리
     */
    static getDeleteOldViolationsQuery(days = 30) {
        return `DELETE FROM [${this.TABLE}] 
                WHERE created_at < DATEADD(DAY, -${days}, GETDATE())`;
    }

    /**
     * 활성 제한 확인
     * 현재 시간 기준 reset_at이 미래인 레코드
     * @param {string} apiKeyId - API Key ID
     * @returns {string} SQL 쿼리
     */
    static getActiveViolationsQuery(apiKeyId) {
        return `SELECT * FROM [${this.TABLE}] 
                WHERE api_key_id = @apiKeyId 
                AND reset_at > GETDATE()
                ORDER BY reset_at DESC`;
    }

    /**
     * 제한 타입별 활성 제한
     * @returns {string} SQL 쿼리
     */
    static getActiveViolationsByTypeQuery() {
        return `SELECT 
                    limit_type,
                    COUNT(*) as active_count,
                    COUNT(DISTINCT api_key_id) as affected_keys
                FROM [${this.TABLE}]
                WHERE reset_at > GETDATE()
                GROUP BY limit_type`;
    }
}

module.exports = RateLimitLog;