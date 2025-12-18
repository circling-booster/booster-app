/**
 * API Key Service - API Key 관리 비즈니스 로직
 * 
 * 역할:
 * - API Key 생성 (고유한 key + secret 쌍)
 * - API Key 검증 (요청 시 검증)
 * - API Key 비활성화 (삭제)
 * - 사용자의 API Key 목록 조회
 * 
 * 주요 의존성:
 * - database.js: executeQuery, executeNonQuery
 * - cryptoUtils.js: generateApiKey, generateApiSecret, encryptApiSecret
 * - subscriptionService.js: isSubscriptionActive
 */

const { executeQuery, executeNonQuery } = require('../config/database');
const { generateApiKey, generateApiSecret, encryptApiSecret } = require('../utils/cryptoUtils');
const { isSubscriptionActive } = require('./subscriptionService');

/**
 * 새로운 API Key 생성
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} keyName - API Key 이름 (예: "Production API")
 * 
 * @returns {Promise<Object>}
 *   - keyId: string (UUID)
 *   - apiKey: string ("sk_" + 48자 랜덤)
 *   - apiSecret: string (64자 랜덤)
 *   - warning: string ("API Secret은 한 번만 표시됩니다...")
 * 
 * @throws {Error}
 *   - '활성화된 구독이 없습니다'
 *   - DB 에러
 * 
 * @flow
 * 1. 사용자의 활성화된 구독 확인
 *    - subscriptionService.isSubscriptionActive(userId)
 *    - 구독이 없으면 에러
 * 
 * 2. API Key 생성
 *    - generateApiKey() → "sk_" + crypto.randomBytes(24).toString('hex')
 *    - 예: "sk_f8c4a9b2d1e7f5c3a8b9d0e1f2a3b4c5d6e7f8a9b0c1d2e"
 * 
 * 3. API Secret 생성
 *    - generateApiSecret() → crypto.randomBytes(32).toString('hex')
 *    - 예: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
 * 
 * 4. API Secret 해싱
 *    - encryptApiSecret(secret) → SHA256 해시
 *    - secretHash만 DB에 저장
 *    - 원본 secret은 이 응답에만 포함
 * 
 * 5. keyId 생성 (UUID)
 * 
 * 6. ApiKeys 테이블에 INSERT
 *    - id, user_id, key_name, api_key, api_secret_hash, is_active
 *    - created_at: GETDATE() (기본값)
 * 
 * 7. { keyId, apiKey, apiSecret, warning } 반환
 * 
 * @important
 * - API Secret은 이 응답 외에는 노출되지 않음
 * - Secret을 잃어버리면 새로 생성해야 함
 * - Secret은 SHA256 해싱되어 저장되므로 복구 불가능
 * 
 * @example
 * const result = await generateNewApiKey(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   'Production API'
 * );
 * // {
 * //   keyId: '660e8400-e29b-41d4-a716-446655440001',
 * //   apiKey: 'sk_f8c4a9b2d1e7f5c3a8b9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
 * //   apiSecret: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
 * //   warning: 'API Secret은 한 번만 표시됩니다. 안전한 곳에 저장하세요'
 * // }
 */
async function generateNewApiKey(userId, keyName) {
    try {
        // 1. 구독 활성화 확인
        // - 구독 없으면 API Key 생성 불가
        const isActive = await isSubscriptionActive(userId);
        
        if (!isActive) {
            throw new Error('활성화된 구독이 없습니다');
        }
        
        // 2. API Key 생성
        // - 형식: "sk_" + 24바이트 랜덤 16진수
        // - 예: "sk_f8c4a9b2d1e7f5c3a8b9d0e1f2a3b4c5d6e7f8a9b0c1d2e"
        const apiKey = generateApiKey();

        // 3. API Secret 생성
        // - 32바이트 랜덤 16진수
        // - 예: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
        const apiSecret = generateApiSecret();

        // 4. API Secret 해싱
        // - SHA256 알고리즘 사용
        // - 단방향 암호화 (복호화 불가)
        // - DB에 저장되는 값
        const secretHash = encryptApiSecret(apiSecret);

        // 5. UUID 생성
        const keyId = require('crypto').randomUUID();
        
        // 6. ApiKeys 테이블에 INSERT
        // - api_key: 평문 저장 (요청 시 사용)
        // - api_secret_hash: 해시 저장 (검증용)
        // - is_active: 1 (활성화)
        await executeNonQuery(
            `INSERT INTO [ApiKeys] 
             (id, user_id, key_name, api_key, api_secret_hash, is_active)
             VALUES (@id, @userId, @keyName, @apiKey, @secretHash, 1)`,
            {
                id: keyId,
                userId,
                keyName,
                apiKey,
                secretHash
            }
        );
        
        // 7. 응답 반환
        // - Secret은 이 응답에만 포함됨
        // - 경고 메시지 포함
        return {
            keyId,
            apiKey,
            apiSecret,
            warning: 'API Secret은 한 번만 표시됩니다. 안전한 곳에 저장하세요'
        };
    } catch (err) {
        throw err;
    }
}

/**
 * 사용자의 API Key 목록 조회
 * 
 * @param {string} userId - 사용자 ID
 * 
 * @returns {Promise<Array>} - API Key 배열
 *   - id: string
 *   - key_name: string
 *   - api_key: string (처음 10자만)
 *   - is_active: boolean
 *   - last_used: datetime (null 가능)
 *   - created_at: datetime
 * 
 * @note
 * - API Secret은 절대 반환하지 않음 (보안)
 * - API Key는 처음 10자만 표시 (전체 노출 방지)
 * - 최신 생성순으로 정렬
 * 
 * @example
 * const keys = await getUserApiKeys('550e8400-e29b-41d4-a716-446655440000');
 * // [
 * //   {
 * //     id: '660e8400-e29b-41d4-a716-446655440001',
 * //     key_name: 'Production API',
 * //     api_key: 'sk_f8c4a9b2',
 * //     is_active: 1,
 * //     last_used: '2025-12-17T06:30:00.000Z',
 * //     created_at: '2025-12-17T05:00:00.000Z'
 * //   }
 * // ]
 */
async function getUserApiKeys(userId) {
    try {
        // 1. ApiKeys 테이블에서 조회
        // - LEFT(api_key, 10): 처음 10자만 추출
        // - api_secret_hash는 제외 (보안)
        // - created_at 기준 내림차순 (최신순)
        const keys = await executeQuery(
            `SELECT id, key_name, api_key, is_active, last_used, created_at 
             FROM [ApiKeys]
             WHERE user_id = @userId
             ORDER BY created_at DESC`,
            { userId }
        );
        
        // 2. 결과 반환
        return keys;
    } catch (err) {
        throw err;
    }
}

/**
 * API Key 비활성화 (삭제 아님)
 * 
 * @param {string} userId - 사용자 ID (소유권 확인용)
 * @param {string} keyId - API Key ID
 * 
 * @throws {Error}
 *   - 'API Key를 찾을 수 없습니다' (404)
 *   - DB 에러
 * 
 * @flow
 * 1. 해당 keyId와 userId로 ApiKeys 테이블 조회
 *    - 소유권 확인 (다른 사용자가 삭제하지 못하도록)
 * 
 * 2. 데이터 없으면 에러
 * 
 * 3. is_active = 0으로 업데이트
 *    - 실제 삭제 아닌 소프트 삭제
 *    - 감사 추적용 (이전 로그 유지)
 * 
 * @note
 * - 실제 DB에서 삭제하지 않음 (감사 추적)
 * - 비활성화된 Key는 validateApiKeyMiddleware에서 거절됨
 * - 이전 API 로그는 유지됨
 * 
 * @example
 * await revokeApiKey(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   '660e8400-e29b-41d4-a716-446655440001'
 * );
 */
async function revokeApiKey(userId, keyId) {
    try {
        // 1. 소유권 확인
        // - user_id와 keyId 모두 일치해야 함
        const keys = await executeQuery(
            'SELECT id FROM [ApiKeys] WHERE id = @keyId AND user_id = @userId',
            { keyId, userId }
        );
        
        // 2. 소유권 없음 → 에러
        if (keys.length === 0) {
            throw new Error('API Key를 찾을 수 없습니다');
        }
        
        // 3. is_active = 0으로 업데이트 (소프트 삭제)
        await executeNonQuery(
            'UPDATE [ApiKeys] SET is_active = 0 WHERE id = @keyId',
            { keyId }
        );
    } catch (err) {
        throw err;
    }
}

/**
 * API Key 및 Secret 검증
 * 
 * @param {string} apiKey - x-api-key 헤더 값
 * @param {string} apiSecret - x-api-secret 헤더 값 (평문)
 * 
 * @returns {Promise<Object>} - API Key 정보
 *   - id: string
 *   - user_id: string
 *   - is_active: boolean
 *   - (기타 필드)
 * 
 * @throws {Error}
 *   - '유효하지 않은 API Key 또는 Secret입니다'
 *   - DB 에러
 * 
 * @flow
 * 1. API Secret을 SHA256으로 해싱
 *    - DB에 저장된 해시와 비교하기 위해
 * 
 * 2. ApiKeys 테이블에서 조회
 *    - api_key = @apiKey 정확히 일치
 *    - api_secret_hash = @secretHash 정확히 일치
 *    - is_active = 1 활성화된 것만
 * 
 * 3. 데이터 없으면 에러
 *    - Key가 없거나 Secret 불일치 또는 비활성화
 * 
 * 4. last_used 업데이트
 *    - API 사용 시간 추적
 * 
 * 5. API Key 정보 반환
 * 
 * @note
 * - 이 함수는 apiKeyMiddleware에서 호출됨
 * - API 요청 시마다 검증됨
 * - 보안상 key와 secret 모두 일치해야 통과
 * 
 * @example
 * const keyInfo = await validateApiKey(
 *   'sk_f8c4a9b2d1e7f5c3a8b9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
 *   'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'
 * );
 * // { id: '660e8400-e29b-41d4-a716-446655440001', user_id: '...' }
 */
async function validateApiKey(apiKey, apiSecret) {
    try {
        // 1. API Secret 해싱
        // - DB에 저장된 해시와 비교
        const secretHash = encryptApiSecret(apiSecret);
        
        // 2. ApiKeys 테이블에서 조회
        // - key와 secret 모두 일치
        // - 활성화된 것만
        const keys = await executeQuery(
            `SELECT id, user_id, is_active FROM [ApiKeys] 
             WHERE api_key = @apiKey AND api_secret_hash = @secretHash AND is_active = 1`,
            { apiKey, secretHash }
        );
        
        // 3. 검증 실패
        if (keys.length === 0) {
            throw new Error('유효하지 않은 API Key 또는 Secret입니다');
        }
        
        // 4. last_used 업데이트
        // - API 사용 시간 추적
        await executeNonQuery(
            'UPDATE [ApiKeys] SET last_used = GETDATE() WHERE id = @id',
            { id: keys.id }
        );
        
        // 5. API Key 정보 반환
        return keys;
    } catch (err) {
        throw err;
    }
}

module.exports = {
    generateNewApiKey,
    getUserApiKeys,
    revokeApiKey,
    validateApiKey
};