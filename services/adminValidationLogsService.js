/**
 * services/adminValidationLogsService.js
 * 역할: 관리자용 API Key 검증 로그 조회 비즈니스 로직
 */

const { executeQuery } = require('../config/database');

/**
 * 검증 로그 조회 (관리자용)
 * 
 * @param {number} page - 페이지 번호 (1부터 시작)
 * @param {number} limit - 페이지당 아이템 수
 * 
 * @returns {Promise<Object>} 
 * {
 *   logs: Array<{
 *     id, api_key_id, user_id, endpoint, method, status_code,
 *     response_time_ms, ip_address, request_body, error_message, created_at
 *   }>,
 *   total: number,
 *   page: number,
 *   limit: number,
 *   totalPages: number
 * }
 * 
 * @throws {Error} DB 연결 오류 등
 * 
 * @flow
 * 1. "/api/validate-key" 엔드포인트의 로그만 필터링
 * 2. created_at 기준 내림차순 정렬 (최신순)
 * 3. 페이지네이션 처리
 * 4. 전체 개수 조회
 * 5. 결과 반환
 */
async function getValidationLogs(page = 1, limit = 20) {
    try {
        const offset = (page - 1) * limit;

        // 1. 검증 로그 조회 (페이지네이션)
        const logs = await executeQuery(
            `SELECT 
                id, api_key_id, user_id, endpoint, method, status_code,
                response_time_ms, ip_address, request_body, error_message, created_at
             FROM [ApiLogs]
             WHERE endpoint = @endpoint
             ORDER BY created_at DESC
             OFFSET @offset ROWS
             FETCH NEXT @limit ROWS ONLY`,
            {
                endpoint: '/api/validate-key',
                offset,
                limit
            }
        );

        // 2. 전체 개수 조회
        const countResult = await executeQuery(
            `SELECT COUNT(*) as total FROM [ApiLogs]
             WHERE endpoint = @endpoint`,
            { endpoint: '/api/validate-key' }
        );

        const total = countResult[0] ? countResult[0].total : 0;
        const totalPages = Math.ceil(total / limit);

        // 3. 결과 반환
        return {
            logs,
            total,
            page,
            limit,
            totalPages
        };

    } catch (err) {
        console.error('[GET_VALIDATION_LOGS_SERVICE_ERROR]', err);
        throw err;
    }
}

/**
 * 모듈 내보내기
 */
module.exports = {
    getValidationLogs
};