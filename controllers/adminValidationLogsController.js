/**
 * controllers/adminValidationLogsController.js
 * 역할: 관리자용 API Key 검증 로그 조회
 * 특징: adminAuthMiddleware로 관리자 인증 필수
 */

const adminValidationLogsService = require('../services/adminValidationLogsService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

/**
 * 검증 로그 조회 핸들러
 * 
 * @route GET /api/admin/validation-logs?page=1&limit=20
 * @admin 필수 (adminAuthMiddleware)
 * @query {number} [page=1] - 페이지 번호
 * @query {number} [limit=20] - 페이지당 아이템 수
 * 
 * @returns {200} 검증 로그 목록 + 페이지네이션
 * @throws {401} 토큰 없음 또는 유효하지 않음
 * @throws {403} 관리자 권한 필요
 * @throws {500} 서버 오류
 */
async function getValidationLogs(req, res) {
    try {
        // 쿼리 파라미터에서 page, limit 추출 (기본값: 1, 20)
        const { page = 1, limit = 20 } = req.query;

        // Service 호출: 검증 로그 조회
        const result = await adminValidationLogsService.getValidationLogs(
            parseInt(page),
            parseInt(limit)
        );

        // 성공 응답
        successResponse(
            res,
            result.logs,
            '검증 로그 조회 성공',
            200,
            {
                pagination: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    totalPages: result.totalPages
                }
            }
        );
    } catch (err) {
        console.error('[GET_VALIDATION_LOGS_ERROR]', err);
        errorResponse(res, err.message, 500, 'INTERNAL_ERROR');
    }
}

/**
 * 모듈 내보내기
 */
module.exports = {
    getValidationLogs
};