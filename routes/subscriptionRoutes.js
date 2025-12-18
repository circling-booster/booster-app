/**
 * Subscription Routes - 구독 관련 엔드포인트
 * 
 * 역할:
 * - 구독 신청 (Basic, Premium, Enterprise)
 * - 현재 사용자의 구독 정보 조회
 * - 이용 가능한 구독 Tier 목록 조회
 * 
 * 인증 미들웨어: 모든 엔드포인트에 필수 (JWT 토큰)
 * 
 * 구독 Tier:
 * - Basic: 월 1,000 API 호출 (무료)
 * - Premium: 월 5,000 API 호출 ($99/월)
 * - Enterprise: 무제한 API 호출 (커스텀 가격)
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * POST /api/subscriptions/request
 * 
 * 설명: 새로운 구독 신청 (관리자 승인 필요)
 * 
 * @auth
 * - 필수: JWT Access Token
 * 
 * @request
 * - Method: POST
 * - Headers: {
 *     Authorization: "Bearer {accessToken}",
 *     Content-Type: "application/json"
 *   }
 * - Body: {
 *     tierId: string ("BASIC" | "PREMIUM" | "ENTERPRISE")
 *   }
 * 
 * @response
 * - 201 Created: {
 *     success: true,
 *     data: {
 *       subscriptionId: string (UUID)
 *     },
 *     message: "구독 신청이 완료되었습니다"
 *   }
 * - 400 Bad Request: tierId 누락
 * - 401 Unauthorized: 토큰 없음 또는 유효하지 않음
 * - 409 Conflict: 이미 활성화된 구독이 있음
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. authMiddleware: JWT 토큰 검증
 * 2. subscriptionController.requestSubscription:
 *    a. req.user.userId 추출
 *    b. req.body.tierId 확인
 *    c. subscriptionService.requestSubscription 호출
 * 3. subscriptionService.requestSubscription:
 *    a. 사용자가 이미 활성화된 구독을 가졌는지 확인
 *    b. 있으면 409 에러
 *    c. UserSubscriptions 테이블에 INSERT (status='pending')
 *    d. subscriptionId 반환
 * 4. 응답 반환
 * 
 * @note
 * - 신청 직후 상태는 'pending' (관리자 승인 대기)
 * - 관리자가 승인하면 상태가 'active'로 변경
 * - 한 사용자는 동시에 1개의 활성 구독만 가능
 * 
 * @example
 * POST /api/subscriptions/request
 * {
 *   "tierId": "PREMIUM"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "subscriptionId": "550e8400-e29b-41d4-a716-446655440000"
 *   },
 *   "message": "구독 신청이 완료되었습니다"
 * }
 */
router.post('/subscriptions/request', authMiddleware, subscriptionController.requestSubscription);

/**
 * GET /api/subscriptions/my-subscription
 * 
 * 설명: 현재 사용자의 구독 정보 조회
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
 *     data: {
 *       id: string (subscriptionId),
 *       user_id: string,
 *       tier_id: string,
 *       tier_name: string ("Basic" | "Premium" | "Enterprise"),
 *       api_call_limit: number (1000 | 5000 | 999999),
 *       status: string ("pending" | "active" | "expired" | "cancelled"),
 *       start_date: datetime,
 *       end_date: datetime,
 *       created_at: datetime,
 *       approval_date: datetime (null if pending),
 *       approved_by: string (null if pending)
 *     } | null,
 *     message: "구독 정보 조회 성공" | "구독 정보가 없습니다"
 *   }
 * - 401 Unauthorized: 토큰 없음 또는 유효하지 않음
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. authMiddleware: JWT 토큰 검증
 * 2. subscriptionController.getMySubscription:
 *    a. req.user.userId 추출
 *    b. subscriptionService.getUserSubscription 호출
 * 3. subscriptionService.getUserSubscription:
 *    a. UserSubscriptions 테이블에서 user_id로 조회
 *    b. SubscriptionTiers와 JOIN하여 tier 정보 포함
 *    c. 활성 구독만 반환
 * 4. 응답 반환
 * 
 * @note
 * - 활성화된 구독이 없으면 null 반환 (에러 아님)
 * - api_call_limit는 Tier 정보에서 가져옴
 * - 구독이 'pending' 상태면 아직 API 사용 불가
 * 
 * @example
 * GET /api/subscriptions/my-subscription
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "550e8400-e29b-41d4-a716-446655440000",
 *     "user_id": "660e8400-e29b-41d4-a716-446655440001",
 *     "tier_id": "770e8400-e29b-41d4-a716-446655440002",
 *     "tier_name": "Premium",
 *     "api_call_limit": 5000,
 *     "status": "active",
 *     "start_date": "2025-12-17T05:00:00.000Z",
 *     "end_date": "2026-12-17T05:00:00.000Z",
 *     "created_at": "2025-12-15T03:00:00.000Z",
 *     "approval_date": "2025-12-16T10:00:00.000Z",
 *     "approved_by": "880e8400-e29b-41d4-a716-446655440003"
 *   },
 *   "message": "구독 정보 조회 성공"
 * }
 */
router.get('/subscriptions/my-subscription', authMiddleware, subscriptionController.getMySubscription);

/**
 * GET /api/subscriptions/tiers
 * 
 * 설명: 이용 가능한 모든 구독 Tier 정보 조회
 * 
 * @auth
 * - 필수: JWT Access Token (인증된 사용자만)
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
 *         tier_name: string ("Basic"),
 *         tier_limit: number (1000),
 *         tier_price: string ("무료"),
 *         features: array
 *       },
 *       {
 *         id: string,
 *         tier_name: string ("Premium"),
 *         tier_limit: number (5000),
 *         tier_price: string ("$99/월"),
 *         features: array
 *       },
 *       {
 *         id: string,
 *         tier_name: string ("Enterprise"),
 *         tier_limit: number (999999),
 *         tier_price: string ("커스텀"),
 *         features: array
 *       }
 *     ],
 *     message: "구독 Tier 조회 성공"
 *   }
 * - 401 Unauthorized: 토큰 없음 또는 유효하지 않음
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. authMiddleware: JWT 토큰 검증 (인증된 사용자만)
 * 2. subscriptionController.getSubscriptionTiers:
 *    a. subscriptionService.getSubscriptionTiers 호출
 * 3. subscriptionService.getSubscriptionTiers:
 *    a. SubscriptionTiers 테이블에서 모든 Tier 조회
 *    b. 각 Tier별 features 정보 포함
 *    c. tier_limit 기준으로 정렬
 * 4. 응답 반환
 * 
 * @note
 * - 사용자가 구독을 선택하기 전에 호출하여 정보 제공
 * - 각 Tier의 features 항목은 프론트엔드에서 표시
 * - 가격은 문자열로 반환 (다국어 지원 가능)
 * 
 * @example
 * GET /api/subscriptions/tiers
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "550e8400-e29b-41d4-a716-446655440000",
 *       "tier_name": "Basic",
 *       "tier_limit": 1000,
 *       "tier_price": "무료",
 *       "features": [
 *         "월 1,000 API 호출",
 *         "기본 지원",
 *         "Webhook 지원"
 *       ]
 *     },
 *     {
 *       "id": "660e8400-e29b-41d4-a716-446655440001",
 *       "tier_name": "Premium",
 *       "tier_limit": 5000,
 *       "tier_price": "$99/월",
 *       "features": [
 *         "월 5,000 API 호출",
 *         "우선 지원",
 *         "Webhook 지원",
 *         "고급 분석"
 *       ]
 *     }
 *   ],
 *   "message": "구독 Tier 조회 성공"
 * }
 */
router.get('/subscriptions/tiers', authMiddleware, subscriptionController.getSubscriptionTiers);

module.exports = router;