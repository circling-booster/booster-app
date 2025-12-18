/**
 * subscriptionController.js
 * 역할: 구독 신청, 구독 정보 조회, Tier 조회
 * 특징: authMiddleware로 인증 필수
 */

const subscriptionService = require('../services/subscriptionService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

/**
 * 구독 신청 핸들러
 * 
 * @route POST /api/subscriptions/request
 * @header Authorization: Bearer {accessToken}
 * @param {number} tierId - Tier ID (1: Basic, 2: Premium, 3: Enterprise)
 * 
 * @returns {201} { subscriptionId: "uuid" }
 * @throws {400} Tier ID 누락
 * @throws {409} 이미 활성화된 구독 존재
 * @throws {500} 서버 오류
 * 
 * 참고:
 * - 새 구독은 pending 상태로 생성
 * - 관리자의 승인 후 active 상태로 변경
 * - 한 사용자당 1개의 활성화 구독만 가능
 */
async function requestSubscription(req, res) {
    try {
        const userId = req.user.userId;
        const { tierId } = req.body;

        // Tier ID 필수 확인
        if (!tierId) {
            return errorResponse(res, 'Tier ID는 필수입니다', 400);
        }

        // Service 호출: 구독 신청 처리
        // 1. 기존 활성화 구독 확인
        // 2. 새 구독 생성 (pending 상태)
        // 3. 구독 ID 반환
        const subscriptionId = await subscriptionService.requestSubscription(userId, tierId);

        // 성공 응답 (201 Created)
        successResponse(res, { subscriptionId }, '구독 신청이 완료되었습니다', 201);
    } catch (err) {
        // 기존 구독 존재 에러
        if (err.message.includes('이미 활성화')) {
            return errorResponse(res, err.message, 409, 'SUBSCRIPTION_ALREADY_EXISTS');
        }
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * 내 구독 정보 조회 핸들러
 * 
 * @route GET /api/subscriptions/my-subscription
 * @header Authorization: Bearer {accessToken}
 * 
 * @returns {200} {
 *   id, userId, tierId, status, tierName,
 *   apiCallLimit, createdAt, expiresAt, approvalDate
 * } or null (구독 없음)
 * @throws {500} 서버 오류
 */
async function getMySubscription(req, res) {
    try {
        const userId = req.user.userId;

        // Service 호출: 사용자의 구독 정보 조회
        const subscription = await subscriptionService.getUserSubscription(userId);

        // 구독 없는 경우 null 반환
        if (!subscription) {
            return successResponse(res, null, '구독 정보가 없습니다');
        }

        // 성공 응답
        successResponse(res, subscription, '구독 정보 조회 성공');
    } catch (err) {
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * 구독 Tier 목록 조회 핸들러
 * 
 * @route GET /api/subscriptions/tiers
 * @header Authorization: Bearer {accessToken}
 * 
 * @returns {200} [
 *   { id: 1, tierId: 'Basic', apiCallLimit: 1000, price: 0, features: [...] },
 *   { id: 2, tierId: 'Premium', apiCallLimit: 5000, price: 99, features: [...] },
 *   { id: 3, tierId: 'Enterprise', apiCallLimit: 999999, price: null, features: [...] }
 * ]
 * @throws {500} 서버 오류
 * 
 * 참고:
 * - 인증된 사용자만 조회 가능
 * - Enterprise는 커스텀 가격
 */
async function getSubscriptionTiers(req, res) {
    try {
        // Service 호출: 모든 Tier 조회
        const tiers = await subscriptionService.getSubscriptionTiers();

        // 성공 응답
        successResponse(res, tiers, '구독 Tier 조회 성공');
    } catch (err) {
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * 모듈 내보내기
 */
module.exports = {
    requestSubscription,
    getMySubscription,
    getSubscriptionTiers
};