/**
 * apiKeyController.js
 * 역할: API Key 생성, 조회, 삭제
 * 특징: authMiddleware로 인증 필수, 활성화된 구독 필요
 */

const apiKeyService = require('../services/apiKeyService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');

/**
 * API Key 생성 핸들러
 * 
 * @route POST /api/api-keys
 * @header Authorization: Bearer {accessToken}
 * @param {string} keyName - Key 이름 (필수, 식별용)
 * 
 * @returns {201} {
 *   keyId, apiKey (sk_...), apiSecret,
 *   warning: "Secret은 한 번만 표시됩니다"
 * }
 * @throws {400} keyName 누락
 * @throws {403} 활성화된 구독 없음
 * @throws {500} 서버 오류
 * 
 * 주의:
 * - API Secret은 최초 1회만 노출
 * - 이후 조회 불가능 (재설정 필요)
 * - API Key는 "sk_" 접두사로 시작
 */
async function createApiKey(req, res) {
    try {
        const userId = req.user.userId;
        const { keyName } = req.body;

        // keyName 필수 확인
        if (!keyName) {
            return errorResponse(res, 'Key name은 필수입니다', 400);
        }

        // Service 호출: API Key 생성
        // 1. 활성화된 구독 확인
        // 2. API Key (sk_...) 및 API Secret 생성
        // 3. API Secret은 SHA256으로 해싱하여 DB 저장
        // 4. API Secret은 평문으로 1회 반환
        const result = await apiKeyService.generateNewApiKey(userId, keyName);

        // 성공 응답 (201 Created)
        successResponse(res, result, 'API Key가 생성되었습니다', 201);
    } catch (err) {
        // 활성화된 구독 없음 에러
        if (err.message.includes('구독')) {
            return errorResponse(res, err.message, 403, 'NO_ACTIVE_SUBSCRIPTION');
        }
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * API Key 목록 조회 핸들러
 * 
 * @route GET /api/api-keys
 * @header Authorization: Bearer {accessToken}
 * 
 * @returns {200} [
 *   { id, keyName, keyPreview (처음 10자), isActive, lastUsed, createdAt },
 *   ...
 * ]
 * @throws {500} 서버 오류
 * 
 * 참고:
 * - API Secret은 조회 불가
 * - API Key는 처음 10자만 표시 (보안)
 */
async function getApiKeys(req, res) {
    try {
        const userId = req.user.userId;

        // Service 호출: 사용자의 모든 API Key 조회
        const keys = await apiKeyService.getUserApiKeys(userId);

        // 성공 응답
        successResponse(res, keys, 'API Key 목록 조회 성공');
    } catch (err) {
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * API Key 삭제(비활성화) 핸들러
 * 
 * @route DELETE /api/api-keys/:keyId
 * @header Authorization: Bearer {accessToken}
 * @param {string} keyId - API Key ID (URL 파라미터)
 * 
 * @returns {200} { message: "API Key가 비활성화되었습니다" }
 * @throws {404} API Key를 찾을 수 없음 (또는 소유권 없음)
 * @throws {500} 서버 오류
 * 
 * 참고:
 * - 물리적 삭제 아님, is_active = 0으로 변경
 * - 사용자 소유 확인 필수
 */
async function revokeApiKey(req, res) {
    try {
        const userId = req.user.userId;
        const { keyId } = req.params;

        // Service 호출: API Key 비활성화
        // 1. keyId 및 userId로 소유권 확인
        // 2. is_active = 0으로 업데이트
        await apiKeyService.revokeApiKey(userId, keyId);

        // 성공 응답
        successResponse(res, null, 'API Key가 비활성화되었습니다');
    } catch (err) {
        // API Key 미존재 에러
        if (err.message.includes('찾을 수 없습니다')) {
            return errorResponse(res, err.message, 404, 'API_KEY_NOT_FOUND');
        }
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * 모듈 내보내기
 */
module.exports = {
    createApiKey,
    getApiKeys,
    revokeApiKey
};