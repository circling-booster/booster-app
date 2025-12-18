/**
 * userController.js
 * 역할: 사용자 프로필 조회, 수정, 비밀번호 변경
 * 특징: authMiddleware로 인증 필수
 */

const userService = require('../services/userService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');
const { validatePassword, validatePhoneNumber } = require('../utils/validationUtils');

/**
 * 사용자 프로필 조회 핸들러
 * 
 * @route GET /api/users/profile
 * @header Authorization: Bearer {accessToken}
 * 
 * @returns {200} {
 *   id, firstName, lastName, email, phoneNumber,
 *   isAdmin, isActive, createdAt, lastLogin
 * }
 * @throws {404} 사용자를 찾을 수 없음
 * @throws {500} 서버 오류
 */
async function getProfile(req, res) {
    try {
        // authMiddleware에서 설정된 req.user에서 userId 추출
        const userId = req.user.userId;

        // Service 호출: DB에서 사용자 정보 조회
        const userInfo = await userService.getUserInfo(userId);

        // 성공 응답
        successResponse(res, userInfo, '사용자 정보 조회 성공');
    } catch (err) {
        // 사용자 미존재 에러
        if (err.message.includes('찾을 수 없습니다')) {
            return errorResponse(res, err.message, 404, 'USER_NOT_FOUND');
        }
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * 사용자 프로필 수정 핸들러
 * 
 * @route PUT /api/users/profile
 * @header Authorization: Bearer {accessToken}
 * @param {string} [firstName] - 이름 (선택)
 * @param {string} [lastName] - 성 (선택)
 * @param {string} [phoneNumber] - 휴대폰 (선택, 유효한 형식이어야 함)
 * @param {string} [email] - 이메일 (선택, 검증 권장)
 * 
 * @returns {200} { 업데이트된 사용자 정보 }
 * @throws {400} 휴대폰 번호 형식 오류
 * @throws {500} 서버 오류
 */
async function updateProfile(req, res) {
    try {
        const userId = req.user.userId;
        const { firstName, lastName, phoneNumber, email } = req.body;

        // 휴대폰 번호 검증 (입력된 경우만)
        if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
            return errorResponse(res, '유효한 휴대폰 번호를 입력하세요', 400, 'INVALID_PHONE');
        }

        // Service 호출: 프로필 업데이트
        const updatedUser = await userService.updateUserProfile(userId, {
            firstName,
            lastName,
            phoneNumber,
            email
        });

        // 성공 응답
        successResponse(res, updatedUser, '프로필 수정 성공');
    } catch (err) {
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * 비밀번호 변경 핸들러
 * 
 * @route POST /api/users/change-password
 * @header Authorization: Bearer {accessToken}
 * @param {string} oldPassword - 기존 비밀번호 (필수)
 * @param {string} newPassword - 새 비밀번호 (필수, 8자+대소문자+숫자+특수문자)
 * @param {string} confirmPassword - 새 비밀번호 확인 (필수, newPassword와 일치)
 * 
 * @returns {200} { success: true }
 * @throws {400} 필드 누락 또는 비밀번호 형식 오류
 * @throws {400} 새 비밀번호 불일치
 * @throws {401} 기존 비밀번호 오류
 * @throws {500} 서버 오류
 */
async function changePassword(req, res) {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        
        // Step 1: 입력값 검증
        if (!oldPassword || !newPassword || !confirmPassword) {
            return errorResponse(res, '모든 필드를 입력하세요', 400, 'VALIDATION_ERROR');
        }
        
        if (newPassword !== confirmPassword) {
            return errorResponse(res, '새 비밀번호가 일치하지 않습니다', 400, 'VALIDATION_ERROR');
        }
        
        if (oldPassword === newPassword) {
            return errorResponse(res, '새 비밀번호는 기존 비밀번호와 달라야 합니다', 400, 'VALIDATION_ERROR');
        }
        
        // Step 2: 서비스 호출
        const result = await userService.changePassword(
            req.user.userId,
            oldPassword,
            newPassword
        );
        
        // Step 3: 성공 응답
        successResponse(res, result, '비밀번호가 변경되었습니다', 200);
    } catch (err) {
        if (err.statusCode === 403) {
            return errorResponse(res, err.message, 403, 'INVALID_PASSWORD');
        }
        errorResponse(res, err.message, 500, 'CHANGE_PASSWORD_ERROR');
    }
}

/**
 * 모듈 내보내기
 */
module.exports = {
    getProfile,
    updateProfile,
    changePassword
};