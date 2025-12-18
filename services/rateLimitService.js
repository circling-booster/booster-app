const { executeQuery, executeNonQuery } = require('../config/database');
const { RATE_LIMIT_TYPE } = require('../config/constants');

/**
 * Rate Limit Service
 * 다층 Rate Limiting 구현 (IP 기반, API Key 기반, 월별)
 */

/**
 * 월별 API 호출량 조회
 * @param {string} apiKeyId - API Key ID
 * @returns {Promise<Object>} 월별 사용량
 */
async function getMonthlyUsage(apiKeyId) {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const result = await executeQuery(
            `SELECT * FROM [MonthlyUsage] 
             WHERE api_key_id = @apiKeyId AND year = @year AND month = @month`,
            { apiKeyId, year, month }
        );

        if (result.length > 0) {
            return result;
        }

        // 첫 호출인 경우 새로 생성
        return {
            api_key_id: apiKeyId,
            year,
            month,
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            total_response_time_ms: 0
        };
    } catch (err) {
        console.error('월별 사용량 조회 오류:', err);
        throw err;
    }
}

/**
 * API 호출 증가
 * @param {string} apiKeyId - API Key ID
 * @param {string} userId - 사용자 ID
 * @param {number} responseTimeMs - 응답 시간 (ms)
 * @param {boolean} isSuccessful - 성공 여부
 */
async function incrementApiCall(apiKeyId, userId, responseTimeMs = 0, isSuccessful = true) {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // 기존 데이터 조회
        const existing = await executeQuery(
            `SELECT * FROM [MonthlyUsage] 
             WHERE api_key_id = @apiKeyId AND year = @year AND month = @month`,
            { apiKeyId, year, month }
        );

        if (existing.length > 0) {
            // 업데이트
            const updateQuery = `
                UPDATE [MonthlyUsage] 
                SET total_requests = total_requests + 1,
                    ${isSuccessful ? 'successful_requests = successful_requests + 1' : 'failed_requests = failed_requests + 1'},
                    total_response_time_ms = total_response_time_ms + @responseTimeMs,
                    updated_at = GETDATE()
                WHERE api_key_id = @apiKeyId AND year = @year AND month = @month
            `;

            await executeNonQuery(updateQuery, {
                apiKeyId,
                year,
                month,
                responseTimeMs
            });
        } else {
            // 신규 삽입
            await executeNonQuery(
                `INSERT INTO [MonthlyUsage] (user_id, api_key_id, year, month, total_requests, successful_requests, failed_requests, total_response_time_ms)
                 VALUES (@userId, @apiKeyId, @year, @month, 1, @successCount, @failCount, @responseTimeMs)`,
                {
                    userId,
                    apiKeyId,
                    year,
                    month,
                    successCount: isSuccessful ? 1 : 0,
                    failCount: isSuccessful ? 0 : 1,
                    responseTimeMs
                }
            );
        }
    } catch (err) {
        console.error('API 호출 증가 오류:', err);
        throw err;
    }
}

/**
 * Rate Limit 위반 확인
 * @param {string} apiKeyId - API Key ID
 * @param {number} limit - 제한 수
 * @returns {Promise<boolean>} 제한 초과 여부
 */
async function isRateLimitExceeded(apiKeyId, limit) {
    try {
        const usage = await getMonthlyUsage(apiKeyId);
        return usage.total_requests >= limit;
    } catch (err) {
        console.error('Rate limit 확인 오류:', err);
        throw err;
    }
}

/**
 * Rate Limit 로그 기록
 * @param {string} apiKeyId - API Key ID
 * @param {string} userId - 사용자 ID
 * @param {string} ipAddress - IP 주소
 * @param {string} limitType - 제한 종류 (hourly, monthly, ip_based)
 */
async function logRateLimitViolation(apiKeyId, userId, ipAddress, limitType = RATE_LIMIT_TYPE.MONTHLY) {
    try {
        const now = new Date();
        const resetTime = new Date(now);

        // reset_at 계산
        if (limitType === RATE_LIMIT_TYPE.HOURLY) {
            resetTime.setHours(resetTime.getHours() + 1);
        } else if (limitType === RATE_LIMIT_TYPE.MONTHLY) {
            resetTime.setMonth(resetTime.getMonth() + 1);
            resetTime.setDate(1);
        } else if (limitType === RATE_LIMIT_TYPE.IP_BASED) {
            resetTime.setHours(resetTime.getHours() + 1);
        }

        await executeNonQuery(
            `INSERT INTO [RateLimitLogs] (api_key_id, user_id, ip_address, limit_type, reset_at)
             VALUES (@apiKeyId, @userId, @ipAddress, @limitType, @resetTime)`,
            {
                apiKeyId,
                userId,
                ipAddress,
                limitType,
                resetTime
            }
        );
    } catch (err) {
        console.error('Rate limit 로그 기록 오류:', err);
        throw err;
    }
}

/**
 * IP 주소별 시간 제한 확인
 * @param {string} ipAddress - IP 주소
 * @param {number} maxRequests - 최대 요청 수 (기본값: 100)
 * @returns {Promise<boolean>} 제한 초과 여부
 */
async function isIpRateLimitExceeded(ipAddress, maxRequests = 100) {
    try {
        const oneHourAgo = new Date(new Date() - 60 * 60 * 1000);

        const result = await executeQuery(
            `SELECT COUNT(*) as count FROM [ApiLogs] 
             WHERE ip_address = @ipAddress AND created_at > @oneHourAgo`,
            { ipAddress, oneHourAgo }
        );

        return result.count >= maxRequests;
    } catch (err) {
        console.error('IP Rate limit 확인 오류:', err);
        throw err;
    }
}

/**
 * 사용량 통계 조회
 * @param {string} apiKeyId - API Key ID
 * @returns {Promise<Object>} 사용량 통계
 */
async function getUsageStatistics(apiKeyId) {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const result = await executeQuery(
            `SELECT 
                total_requests,
                successful_requests,
                failed_requests,
                CAST(total_response_time_ms AS FLOAT) / NULLIF(total_requests, 0) as avg_response_time_ms
             FROM [MonthlyUsage] 
             WHERE api_key_id = @apiKeyId AND year = @year AND month = @month`,
            { apiKeyId, year, month }
        );

        if (result.length > 0) {
            return result;
        }

        return {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            avg_response_time_ms: 0
        };
    } catch (err) {
        console.error('사용량 통계 조회 오류:', err);
        throw err;
    }
}

/**
 * 사용량 경고 확인 (80% 도달)
 * @param {number} currentUsage - 현재 사용량
 * @param {number} limit - 제한량
 * @returns {boolean} 경고 필요 여부
 */
function isUsageWarningNeeded(currentUsage, limit) {
    return currentUsage >= (limit * 0.8);
}

/**
 * 사용량 초과 확인
 * @param {number} currentUsage - 현재 사용량
 * @param {number} limit - 제한량
 * @returns {boolean} 초과 여부
 */
function isUsageExceeded(currentUsage, limit) {
    return currentUsage >= limit;
}

/**
 * 최근 Rate Limit 위반 로그 조회
 * @param {string} userId - 사용자 ID
 * @param {number} hours - 조회 기간 (시간)
 * @returns {Promise<Array>} Rate Limit 위반 로그
 */
async function getRecentViolations(userId, hours = 24) {
    try {
        const timeAgo = new Date(new Date() - hours * 60 * 60 * 1000);

        const result = await executeQuery(
            `SELECT * FROM [RateLimitLogs] 
             WHERE user_id = @userId AND created_at > @timeAgo
             ORDER BY created_at DESC`,
            { userId, timeAgo }
        );

        return result;
    } catch (err) {
        console.error('최근 위반 로그 조회 오류:', err);
        throw err;
    }
}

/**
 * Rate Limit 초기화 (월간)
 * 월말에 실행되어야 함
 */
async function resetMonthlyLimits() {
    try {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const year = lastMonth.getFullYear();
        const month = lastMonth.getMonth() + 1;

        // 이전 달의 데이터는 삭제하지 않고 유지
        // 대신 새로운 달의 데이터가 자동으로 생성됨
        console.log(`Rate Limit 리셋: ${year}-${month}`);
    } catch (err) {
        console.error('Rate Limit 초기화 오류:', err);
        throw err;
    }
}

module.exports = {
    getMonthlyUsage,
    incrementApiCall,
    isRateLimitExceeded,
    logRateLimitViolation,
    isIpRateLimitExceeded,
    getUsageStatistics,
    isUsageWarningNeeded,
    isUsageExceeded,
    getRecentViolations,
    resetMonthlyLimits
};