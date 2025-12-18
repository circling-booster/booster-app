const { executeQuery } = require('../config/database');

async function getDashboardStats(userId) {
    try {
        // 사용자 기본 정보
        const userInfo = await executeQuery(
            `SELECT COUNT(*) as total_api_calls FROM [ApiLogs] WHERE user_id = @userId`,
            { userId }
        );
        
        // 월별 사용량
        const monthlyUsage = await executeQuery(
            `SELECT DATEPART(MONTH, created_at) as month, COUNT(*) as calls
             FROM [ApiLogs]
             WHERE user_id = @userId AND DATEPART(YEAR, created_at) = YEAR(GETDATE())
             GROUP BY DATEPART(MONTH, created_at)
             ORDER BY month`,
            { userId }
        );
        
        // 상태 코드별 분포
        const statusCodeDistribution = await executeQuery(
            `SELECT status_code, COUNT(*) as count FROM [ApiLogs] 
             WHERE user_id = @userId AND created_at > DATEADD(DAY, -30, GETDATE())
             GROUP BY status_code`,
            { userId }
        );
        
        // API Key별 사용량
        const apiKeyUsage = await executeQuery(
            `SELECT ak.key_name, COUNT(*) as calls, AVG(al.response_time_ms) as avg_response_time
             FROM [ApiLogs] al
             JOIN [ApiKeys] ak ON al.api_key_id = ak.id
             WHERE al.user_id = @userId
             GROUP BY ak.key_name`,
            { userId }
        );
        
        return {
            totalApiCalls: userInfo.total_api_calls,
            monthlyUsage,
            statusCodeDistribution,
            apiKeyUsage
        };
    } catch (err) {
        throw err;
    }
}
async function getApiLogs(userId, page = 1, limit = 20) {
    try {
        const offset = (page - 1) * limit;
        
        const logs = await executeQuery(
            `SELECT al.endpoint, al.method, al.status_code, al.response_time_ms, al.ip_address, al.created_at
             FROM [ApiLogs] al
             WHERE al.user_id = @userId
             ORDER BY al.created_at DESC
             OFFSET @offset ROWS
             FETCH NEXT @limit ROWS ONLY`,
            { userId, limit, offset }
        );
        
        const countResult = await executeQuery(
            'SELECT COUNT(*) as total FROM [ApiLogs] WHERE user_id = @userId',
            { userId }
        );
        
        return {
            logs,
            total: countResult[0].total, 
            page,
            limit,
            totalPages: Math.ceil(countResult[0].total / limit)
        };
    } catch (err) {
        console.error('API Logs 조회 오류:', err);
        throw err;
    }
}
module.exports = {
    getDashboardStats,
    getApiLogs
};