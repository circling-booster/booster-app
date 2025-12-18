/**
 * routes/validateApiKeyRoutes.js
 * 역할: API Key 검증 엔드포인트 라우트 정의
 * 특징: 공개 엔드포인트 (인증 미필요, CORS 허용)
 */

const express = require('express');
const router = express.Router();
const validateApiKeyController = require('../controllers/validateApiKeyController');
const adminValidationLogsController = require('../controllers/adminValidationLogsController');
const { adminAuthMiddleware } = require('../middleware/authMiddleware');

/**
 * POST /api/validate-key
 * 
 * 설명: 제3의 사이트에서 API Key와 Secret을 검증하는 공개 엔드포인트
 * 
 * @public (인증 불필요)
 * @param {string} api_key - API Key (sk_... 형식)
 * @param {string} api_secret - API Secret (64자 16진수)
 * 
 * @returns {200} 검증 성공
 * {
 *   success: true,
 *   data: {
 *     user_id: "550e8400-e29b-41d4-a716-446655440000",
 *     api_key_id: "660e8400-e29b-41d4-a716-446655440001",
 *     creation_date: "2025-12-17T05:00:00.000Z",
 *     expiration_date: "2025-12-24T05:00:00.000Z",
 *     is_active: true
 *   },
 *   message: "API Key 검증 성공",
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @returns {400} Bad Request - API Key 또는 Secret 누락
 * {
 *   success: false,
 *   message: "API Key 또는 Secret이 누락되었습니다",
 *   errorCode: "MISSING_CREDENTIALS",
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @returns {401} Unauthorized - 잘못된 Key/Secret
 * {
 *   success: false,
 *   message: "유효하지 않은 API Key입니다",
 *   errorCode: "INVALID_API_KEY",
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @returns {403} Forbidden - 비활성화된 API Key 또는 사용자
 * {
 *   success: false,
 *   message: "비활성화된 API Key입니다",
 *   errorCode: "API_KEY_INACTIVE",
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @returns {429} Too Many Requests - 월간 API 호출 제한 초과
 * {
 *   success: false,
 *   message: "API 호출 제한을 초과했습니다",
 *   errorCode: "API_LIMIT_EXCEEDED",
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @returns {500} Internal Server Error - 서버 오류
 * {
 *   success: false,
 *   message: "서버 오류가 발생했습니다",
 *   errorCode: "INTERNAL_ERROR",
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @example
 * POST /api/validate-key
 * Content-Type: application/json
 * 
 * {
 *   "api_key": "sk_abc123def456ghi789...",
 *   "api_secret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6..."
 * }
 */
router.post('/validate-key', validateApiKeyController.validateApiKey);

/**
 * GET /api/admin/validation-logs
 * 
 * 설명: 관리자가 모든 API Key 검증 로그를 조회
 * 
 * @auth 필수 (JWT + adminAuthMiddleware)
 * @query {number} [page=1] - 페이지 번호
 * @query {number} [limit=20] - 페이지당 아이템 수
 * 
 * @returns {200} 검증 로그 목록
 * {
 *   success: true,
 *   data: [
 *     {
 *       id: "770e8400-e29b-41d4-a716-446655440002",
 *       api_key_id: "660e8400-e29b-41d4-a716-446655440001",
 *       user_id: "550e8400-e29b-41d4-a716-446655440000",
 *       endpoint: "/api/validate-key",
 *       method: "POST",
 *       status_code: 200,
 *       response_time_ms: 145,
 *       ip_address: "203.0.113.45",
 *       request_body: "{...}",
 *       error_message: null,
 *       created_at: "2025-12-18T05:26:00.000Z"
 *     },
 *     ...
 *   ],
 *   message: "검증 로그 조회 성공",
 *   pagination: {
 *     total: 150,
 *     page: 1,
 *     limit: 20,
 *     totalPages: 8
 *   },
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @throws {401} Unauthorized - 토큰 없음 또는 유효하지 않음
 * @throws {403} Forbidden - 관리자 권한 필요
 * @throws {500} Internal Server Error - 서버 오류
 * 
 * @example
 * GET /api/admin/validation-logs?page=1&limit=20
 * Headers:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
router.get(
    '/admin/validation-logs',
    adminAuthMiddleware,
    adminValidationLogsController.getValidationLogs
);

module.exports = router;