/**
 * adminController.js
 * 역할: 관리자용 사용자/구독 관리, 통계 조회
 * 특징: adminAuthMiddleware로 관리자 인증 필수 (isAdmin = true)
 */

const adminService = require('../services/adminService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

/**
 * 모든 사용자 조회 핸들러 (페이지네이션)
 * 
 * @route GET /api/admin/users?page=1&limit=20
 * @header Authorization: Bearer {adminToken}
 * @query {number} [page=1] - 페이지 번호
 * @query {number} [limit=20] - 페이지당 아이템 수
 * 
 * @returns {200} {
 *   users: [ { id, firstName, lastName, email, isActive, isBlocked, ... } ],
 *   total, page, limit, totalPages
 * }
 * @throws {403} 관리자 권한 필요
 * @throws {500} 서버 오류
 */
async function getAllUsers(req, res) {
    try {
        // 쿼리 파라미터에서 page, limit 추출 (기본값: 1, 20)
        const { page = 1, limit = 20 } = req.query;

        // Service 호출: 사용자 목록 조회 (구독 정보 JOIN)
        const result = await adminService.getAllUsers(parseInt(page), parseInt(limit));

        // 성공 응답
        successResponse(res, result, '사용자 목록 조회 성공');
    } catch (err) {
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * 대기 중인 구독 조회 핸들러
 * 
 * @route GET /api/admin/subscriptions/pending?page=1&limit=20
 * @header Authorization: Bearer {adminToken}
 * @query {number} [page=1] - 페이지 번호
 * @query {number} [limit=20] - 페이지당 아이템 수
 * 
 * @returns {200} {
 *   subscriptions: [
 *     { id, firstName, lastName, email, phoneNumber, tierName, createdAt }
 *   ],
 *   total, page, limit, totalPages
 * }
 * @throws {403} 관리자 권한 필요
 * @throws {500} 서버 오류
 * 
 * 참고:
 * - status = 'pending'인 구독만 조회
 * - 승인/거절 대기 중인 구독
 */
// adminController.js

async function getPendingSubscriptions(req, res) {
    try {
        const { page = 1, limit = 20 } = req.query;

        // Service 호출: pending 구독 조회
        const result = await adminService.getPendingSubscriptions(
            parseInt(page),
            parseInt(limit)
        );

        // ✅ 배열 직접 반환
        successResponse(
            res,
            result.subscriptions,  // ← 배열만 반환
            '대기중인 구독 목록 조회 성공',
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
        errorResponse(res, err.message, 500);
    }
}

/**
 * 구독 승인 핸들러
 * 
 * @route POST /api/admin/subscriptions/:subscriptionId/approve
 * @header Authorization: Bearer {adminToken}
 * @param {string} subscriptionId - 구독 ID (URL 파라미터)
 * 
 * @returns {200} { message: "구독이 승인되었습니다" }
 * @throws {403} 관리자 권한 필요
 * @throws {500} 서버 오류
 * 
 * 처리:
 * - status: pending → active
 * - approval_date: 현재 시간 저장
 * - approved_by: 관리자 ID 저장
 * - Webhook 이벤트: subscription_activated 발송
 */
async function approveSubscription(req, res) {
    try {
        const { subscriptionId } = req.params;
        const adminId = req.user.userId; // 승인한 관리자 ID

        // Service 호출: 구독 승인
        await adminService.approveSubscription(subscriptionId, adminId);

        // 성공 응답
        successResponse(res, null, '구독이 승인되었습니다');
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

/**
 * 구독 거절 핸들러
 * 
 * @route POST /api/admin/subscriptions/:subscriptionId/reject
 * @header Authorization: Bearer {adminToken}
 * @param {string} subscriptionId - 구독 ID (URL 파라미터)
 * @body {string} reason - 거절 사유 (선택)
 * 
 * @returns {200} { message: "구독이 거절되었습니다" }
 * @throws {403} 관리자 권한 필요
 * @throws {500} 서버 오류
 * 
 * 처리:
 * - status: pending → cancelled
 * - rejection_reason: 거절 사유 저장
 * - Webhook 이벤트: subscription_cancelled 발송
 */
async function rejectSubscription(req, res) {
    try {
        const { subscriptionId } = req.params;
        const { reason } = req.body;

        // Service 호출: 구독 거절
        await adminService.rejectSubscription(subscriptionId, reason);

        // 성공 응답
        successResponse(res, null, '구독이 거절되었습니다');
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

/**
 * 사용자 차단 핸들러
 * 
 * @route POST /api/admin/users/:userId/block
 * @header Authorization: Bearer {adminToken}
 * @param {string} userId - 사용자 ID (URL 파라미터)
 * @body {string} reason - 차단 사유 (필수)
 * 
 * @returns {200} { message: "사용자가 차단되었습니다" }
 * @throws {403} 관리자 권한 필요
 * @throws {500} 서버 오류
 * 
 * 효과:
 * - is_blocked = 1 설정
 * - 로그인 불가
 * - 구독 무효화
 * - API 요청 거부
 */
async function blockUser(req, res) {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        // Service 호출: 사용자 차단
        await adminService.blockUser(userId, reason);

        // 성공 응답
        successResponse(res, null, '사용자가 차단되었습니다');
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

/**
 * 사용자 차단 해제 핸들러
 * 
 * @route POST /api/admin/users/:userId/unblock
 * @header Authorization: Bearer {adminToken}
 * @param {string} userId - 사용자 ID (URL 파라미터)
 * 
 * @returns {200} { message: "사용자 차단이 해제되었습니다" }
 * @throws {403} 관리자 권한 필요
 * @throws {500} 서버 오류
 * 
 * 효과:
 * - is_blocked = 0 설정
 * - blocked_reason NULL 설정
 * - 로그인 재개
 */
async function unblockUser(req, res) {
    try {
        const { userId } = req.params;

        // Service 호출: 사용자 차단 해제
        await adminService.unblockUser(userId);

        // 성공 응답
        successResponse(res, null, '사용자 차단이 해제되었습니다');
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

/**
 * 시스템 통계 조회 핸들러
 * 
 * @route GET /api/admin/stats
 * @header Authorization: Bearer {adminToken}
 * 
 * @returns {200} {
 *   totalUsers,           // 전체 사용자 수
 *   activeSubscriptions,  // 활성 구독 수
 *   pendingSubscriptions, // 대기 중인 구독 수
 *   totalApiCalls,        // 전체 API 호출 수
 *   blockedUsers          // 차단된 사용자 수
 * }
 * @throws {403} 관리자 권한 필요
 * @throws {500} 서버 오류
 * 
 * 용도:
 * - 대시보드에 시스템 상태 표시
 * - 성능 모니터링
 */
async function getSystemStats(req, res) {
    try {
        // Service 호출: 시스템 통계 조회
        const stats = await adminService.getSystemStats();

        // 성공 응답
        successResponse(res, stats, '시스템 통계 조회 성공');
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}

/**
 * 모듈 내보내기
 */
module.exports = {
    getAllUsers,
    getPendingSubscriptions,
    approveSubscription,
    rejectSubscription,
    blockUser,
    unblockUser,
    getSystemStats
};