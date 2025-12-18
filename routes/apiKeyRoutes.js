/**
 * API Key Routes - API Key 관리 엔드포인트
 * 
 * 역할:
 * - API Key 생성
 * - 사용자의 API Key 목록 조회
 * - API Key 삭제 (비활성화)
 * 
 * 인증 미들웨어: 모든 엔드포인트에 필수 (JWT 토큰)
 */

const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * POST /api/api-keys
 * 
 * 설명: 새로운 API Key 생성
 * 
 * @auth
 * - 필수: JWT Access Token (Authorization 헤더)
 * - req.user.userId는 미들웨어에서 설정됨
 * 
 * @request
 * - Method: POST
 * - Headers: {
 *     Authorization: "Bearer {accessToken}",
 *     Content-Type: "application/json"
 *   }
 * - Body: {
 *     keyName: string (API Key의 이름, 예: "Production API")
 *   }
 * 
 * @response
 * - 201 Created: {
 *     success: true,
 *     data: {
 *       keyId: string (UUID),
 *       apiKey: string ("sk_" + 48자),
 *       apiSecret: string (64자),
 *       warning: "API Secret은 한 번만 표시됩니다..."
 *     },
 *     message: "API Key가 생성되었습니다"
 *   }
 * - 400 Bad Request: keyName 누락
 * - 401 Unauthorized: 토큰 없음 또는 유효하지 않음
 * - 403 Forbidden: 활성화된 구독 없음
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. authMiddleware: JWT 토큰 검증, req.user 설정
 * 2. apiKeyController.createApiKey:
 *    a. req.body.keyName 확인
 *    b. apiKeyService.generateNewApiKey 호출
 * 3. apiKeyService.generateNewApiKey:
 *    a. 사용자의 활성화된 구독 확인
 *    b. API Key 생성: "sk_" + crypto.randomBytes(24).toString('hex')
 *    c. API Secret 생성: crypto.randomBytes(32).toString('hex')
 *    d. Secret을 SHA256 해싱하여 apiSecretHash 생성
 *    e. ApiKeys 테이블에 INSERT
 *    f. { keyId, apiKey, apiSecret, warning } 반환
 * 4. 응답 반환
 * 
 * @important
 * - API Secret은 이 요청 직후 한 번만 표시됨
 * - 사용자가 Secret을 잃어버리면 새로 생성해야 함
 * - Secret은 DB에 해싱되어 저장되므로 복구 불가능
 * 
 * @example
 * POST /api/api-keys
 * {
 *   "keyName": "Production API"
 * }
 * 
 * Headers:
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "keyId": "550e8400-e29b-41d4-a716-446655440000",
 *     "apiKey": "sk_f8c4a9b2d1e7f5c3a8b9d0e1f2a3b4c5",
 *     "apiSecret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
 *     "warning": "API Secret은 한 번만 표시됩니다. 안전한 곳에 저장하세요"
 *   },
 *   "message": "API Key가 생성되었습니다",
 *   "timestamp": "2025-12-17T07:39:00.000Z"
 * }
 */
router.post('/api-keys', authMiddleware, apiKeyController.createApiKey);

/**
 * GET /api/api-keys
 * 
 * 설명: 현재 사용자의 모든 API Key 목록 조회
 * 
 * @auth
 * - 필수: JWT Access Token
 * 
 * @request
 * - Method: GET
 * - Headers: {
 *     Authorization: "Bearer {accessToken}"
 *   }
 * 
 * @response
 * - 200 OK: {
 *     success: true,
 *     data: [
 *       {
 *         id: string,
 *         key_name: string,
 *         api_key: string (API Key 처음 10자),
 *         is_active: boolean,
 *         last_used: datetime,
 *         created_at: datetime
 *       },
 *       ...
 *     ],
 *     message: "API Key 목록 조회 성공"
 *   }
 * - 401 Unauthorized: 토큰 없음 또는 유효하지 않음
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. authMiddleware: JWT 토큰 검증
 * 2. apiKeyController.getApiKeys:
 *    a. req.user.userId에서 사용자 ID 추출
 *    b. apiKeyService.getUserApiKeys 호출
 * 3. apiKeyService.getUserApiKeys:
 *    a. ApiKeys 테이블에서 user_id로 조회
 *    b. api_key는 처음 10자만 반환 (LEFT(api_key, 10))
 *    c. api_secret_hash는 포함하지 않음 (보안)
 *    d. created_at 기준 내림차순 정렬
 * 4. 응답 반환
 * 
 * @note
 * - API Secret은 반환하지 않음 (생성 시 한 번만)
 * - API Key는 처음 10자만 표시 (전체 노출 방지)
 * - last_used는 API 호출 시마다 업데이트됨
 * 
 * @example
 * GET /api/api-keys
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "550e8400-e29b-41d4-a716-446655440000",
 *       "key_name": "Production API",
 *       "api_key": "sk_f8c4a9b2",
 *       "is_active": true,
 *       "last_used": "2025-12-17T06:30:00.000Z",
 *       "created_at": "2025-12-17T05:00:00.000Z"
 *     }
 *   ],
 *   "message": "API Key 목록 조회 성공"
 * }
 */
router.get('/api-keys', authMiddleware, apiKeyController.getApiKeys);

/**
 * DELETE /api/api-keys/:keyId
 * 
 * 설명: API Key 비활성화 (삭제가 아닌 비활성화)
 * 
 * @auth
 * - 필수: JWT Access Token
 * - 해당 API Key의 소유자만 삭제 가능
 * 
 * @request
 * - Method: DELETE
 * - Path Parameters: {
 *     keyId: string (UUID)
 *   }
 * - Headers: {
 *     Authorization: "Bearer {accessToken}"
 *   }
 * 
 * @response
 * - 200 OK: {
 *     success: true,
 *     data: null,
 *     message: "API Key가 비활성화되었습니다"
 *   }
 * - 401 Unauthorized: 토큰 없음 또는 유효하지 않음
 * - 404 Not Found: 해당 API Key를 찾을 수 없음
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. authMiddleware: JWT 토큰 검증
 * 2. apiKeyController.revokeApiKey:
 *    a. req.params.keyId 추출
 *    b. apiKeyService.revokeApiKey 호출
 * 3. apiKeyService.revokeApiKey:
 *    a. 해당 keyId와 userId로 ApiKeys 테이블 조회 (소유권 확인)
 *    b. 데이터 없으면 404 에러
 *    c. is_active = 0으로 업데이트
 * 4. 응답 반환
 * 
 * @note
 * - 실제 삭제가 아닌 비활성화 (감사 추적용)
 * - 비활성화된 API Key는 검증 미들웨어에서 거절됨
 * - 이전 API 로그는 유지됨
 * 
 * @example
 * DELETE /api/api-keys/550e8400-e29b-41d4-a716-446655440000
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": null,
 *   "message": "API Key가 비활성화되었습니다",
 *   "timestamp": "2025-12-17T07:39:00.000Z"
 * }
 */
router.delete('/api-keys/:keyId', authMiddleware, apiKeyController.revokeApiKey);

module.exports = router;