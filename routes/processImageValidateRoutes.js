/**
 * routes/processImageValidateRoutes.js
 * 역할: 이미지 처리 및 API Key 검증 엔드포인트 라우트 정의
 * 특징: 공개 엔드포인트 (인증 미필요, CORS 허용), 이미지 검증 미들웨어 포함
 */

const express = require('express');
const router = express.Router();
const processImageValidateController = require('../controllers/processImageValidateController');
const { validateImageMiddleware } = require('../middleware/imageValidationMiddleware');

/**
 * POST /api/process-image-validate
 * 
 * 설명: API Key와 Secret을 검증한 후 base64 이미지의 길이를 반환하는 공개 엔드포인트
 * 
 * @public (인증 불필요)
 * @middleware imageValidationMiddleware (이미지 형식 및 크기 검증)
 * @param {string} api_key - API Key (sk_... 형식)
 * @param {string} api_secret - API Secret (64자 16진수)
 * @param {string} image - Base64 인코딩된 이미지
 *   - 형식: "data:image/png;base64,..." 또는 순수 base64 문자열
 *   - 최대 크기: 5MB (이진 데이터 기준)
 *   - 지원 형식: PNG, JPEG, JPG, GIF, WebP
 * 
 * @returns {200} 검증 성공
 * {
 *   success: true,
 *   data: {
 *     user_id: "550e8400-e29b-41d4-a716-446655440000",
 *     api_key_id: "660e8400-e29b-41d4-a716-446655440001",
 *     creation_date: "2025-12-17T05:00:00.000Z",
 *     expiration_date: "2025-12-24T05:00:00.000Z",
 *     is_active: true,
 *     image_length: 1024567
 *   },
 *   message: "이미지 검증 성공",
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @returns {400} Bad Request - API Key, Secret 또는 Image 누락/형식 오류
 * {
 *   success: false,
 *   message: "이미지 데이터가 누락되었습니다",
 *   errorCode: "MISSING_IMAGE",
 *   timestamp: "2025-12-18T05:26:00.000Z"
 * }
 * 
 * @returns {400} Bad Request - 이미지 형식 오류
 * {
 *   success: false,
 *   message: "유효한 base64 이미지가 아닙니다",
 *   errorCode: "INVALID_IMAGE_FORMAT",
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
 * POST /api/process-image-validate
 * Content-Type: application/json
 * 
 * {
 *   "api_key": "sk_abc123def456ghi789...",
 *   "api_secret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...",
 *   "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
 * }
 * 
 * @flow
 * 1. 클라이언트에서 POST 요청
 * 2. imageValidationMiddleware에서 이미지 형식 및 크기 검증
 * 3. 검증 실패 시 400 에러 응답
 * 4. 검증 성공 시 req.base64Image에 순수 base64 저장
 * 5. processImageValidateController에서 API Key/Secret 검증
 * 6. 검증 실패 시 401/403/429 에러 응답
 * 7. 모든 검증 통과 시 이미지 길이와 함께 200 응답
 * 8. 모든 요청 로깅 (성공/실패)
 */
router.post(
  '/process-image-validate',
  validateImageMiddleware,
  processImageValidateController.processImageValidate
);

/**
 * GET /api/admin/image-validation-logs
 * 
 * 설명: 관리자가 모든 이미지 검증 요청 로그를 조회
 * 
 * @auth 필수 (JWT + adminAuthMiddleware)
 * @query {number} [page=1] - 페이지 번호
 * @query {number} [limit=20] - 페이지당 아이템 수
 * 
 * @returns {200} 이미지 검증 로그 목록
 * {
 *   success: true,
 *   data: [
 *     {
 *       id: "770e8400-e29b-41d4-a716-446655440002",
 *       api_key_id: "660e8400-e29b-41d4-a716-446655440001",
 *       user_id: "550e8400-e29b-41d4-a716-446655440000",
 *       endpoint: "/api/process-image-validate",
 *       method: "POST",
 *       status_code: 200,
 *       response_time_ms: 145,
 *       ip_address: "203.0.113.45",
 *       request_body: "{...}",
 *       error_message: null,
 *       image_length: 1024567,
 *       created_at: "2025-12-18T05:26:00.000Z"
 *     },
 *     ...
 *   ],
 *   message: "이미지 검증 로그 조회 성공",
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
 * GET /api/admin/image-validation-logs?page=1&limit=20
 * Headers:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
// 주석: adminValidationLogsController 구현 필요 (선택사항)
// router.get(
//   '/admin/image-validation-logs',
//   adminAuthMiddleware,
//   adminImageValidationLogsController.getImageValidationLogs
// );

module.exports = router;