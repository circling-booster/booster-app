/**
* routes/processImageValidateRoutes.js (DB 수정 없음)
* 역할: 이미지 처리 및 API Key 검증 엔드포인트 라우트 정의
* 특징: 타이밍 정보 조회 엔드포인트 추가
*/

const express = require('express');
const router = express.Router();
const processImageValidateController = require('../controllers/processImageValidateController');
const { validateImageMiddleware } = require('../middleware/imageValidationMiddleware');

/**
* POST /api/process-image-validate
*
* 설명: API Key와 Secret을 검증한 후 이미지 분석 수행
* 응답에는 OpenAI 응답 시간과 서버 처리 시간을 분리한 timing 객체 포함
*
* @public (인증 불필요)
* @middleware imageValidationMiddleware (이미지 형식 및 크기 검증)
* @param {string} api_key - API Key (sk_... 형식)
* @param {string} api_secret - API Secret
* @param {string} image - Base64 인코딩된 이미지
* @param {string} url - 

* @param {string} [prompt] - 이미지 분석 프롬프트 (옵션)
*
* @returns {200} 검증 및 분석 성공
* {
*   success: true,
*   data: {
*     user_id: "550e8400-e29b-41d4-a716-446655440000",
*     api_key_id: "660e8400-e29b-41d4-a716-446655440001",
*     creation_date: "2025-12-17T05:00:00.000Z",
*     expiration_date: "2025-12-24T05:00:00.000Z",
*     is_active: true,
*     image_length: 1024567,
*     text: "ABCDEF",
*     timing: {
*       total_time_ms: 2450,
*       openai_response_time_ms: 1800,
*       server_processing_time_ms: 650
*     }
*   },
*   message: "이미지 분석 성공",
*   timestamp: "2025-12-18T05:26:00.000Z"
* }
*
* @returns {400} Bad Request
* @returns {401} Unauthorized
* @returns {403} Forbidden
* @returns {429} Too Many Requests
* @returns {500} Internal Server Error
*/

router.post(
  '/process-image-validate',
  validateImageMiddleware,
  processImageValidateController.processImageValidate
);

/**
* ✅ 추가: GET /api/admin/timing-logs
*
* 설명: 메모리 버퍼에 저장된 최근 타이밍 정보 조회 (관리자용)
* 
* @query {number} [limit=20] - 조회할 로그 개수 (최대 1000개까지 메모리에 저장)
*
* @returns {200} 타이밍 로그 목록
* {
*   success: true,
*   data: {
*     total_logs: 20,
*     logs: [
*       {
*         timestamp: "2025-12-18T09:15:32.123Z",
*         log_id: "abc123...",
*         endpoint: "/api/process-image-validate",
*         method: "POST",
*         total_time_ms: 2450,
*         openai_response_time_ms: 1800,
*         server_processing_time_ms: 650,
*         openai_ratio: "73.47%",
*         status_code: 200,
*         user_id: "550e8400..."
*       },
*       ...
*     ]
*   },
*   message: "타이밍 로그 조회 성공",
*   timestamp: "2025-12-18T09:26:00.000Z"
* }
*
* @example
* GET /api/admin/timing-logs?limit=50
*
* @note
* - 최근 1000개의 요청 정보만 메모리에 유지
* - 서버 재시작 시 데이터 초기화
* - 프로덕션 환경에서는 데이터베이스에 저장하거나 ELK 스택 사용 권장
*/

router.get(
  '/admin/timing-logs',
  processImageValidateController.getTimingLogs
);

/**
* ✅ 추가: GET /api/admin/timing-statistics
*
* 설명: 메모리 버퍼의 타이밍 통계 조회 (관리자용)
* 
* @returns {200} 타이밍 통계
* {
*   success: true,
*   data: {
*     total_requests: 156,
*     total_time: {
*       min: 950,
*       max: 5200,
*       avg: 2340,
*       total: 156
*     },
*     openai_response_time: {
*       min: 650,
*       max: 4100,
*       avg: 1780,
*       total: 156
*     },
*     server_processing_time: {
*       min: 150,
*       max: 1200,
*       avg: 560,
*       total: 156
*     },
*     avg_openai_ratio: "76.07%"
*   },
*   message: "타이밍 통계 조회 성공",
*   timestamp: "2025-12-18T09:26:00.000Z"
* }
*
* @example
* GET /api/admin/timing-statistics
*
* @note
* - 현재 메모리에 있는 모든 로그 기반 통계
* - 최소값(min), 최대값(max), 평균(avg) 제공
* - OpenAI 응답 시간의 전체 응답 시간 대비 비율(avg_openai_ratio) 제공
*/

router.get(
  '/admin/timing-statistics',
  processImageValidateController.getTimingStatistics
);

module.exports = router;
