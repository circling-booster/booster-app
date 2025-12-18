/**
 * utils/cryptoUtils.js
 * 역할: 비밀번호 해싱, API Key 생성, 서명 생성
 * 라이브러리: bcryptjs, crypto
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * 비밀번호 해싱 (bcryptjs 사용)
 * 
 * 특징:
 * - 단방향 암호화 (복호화 불가능)
 * - 라운드 10으로 설정 (1초 정도 소요)
 * - 매번 다른 salt 생성 (같은 비번도 다른 해시)
 * - 레인보우 테이블 공격 방지
 * 
 * @param {string} password - 평문 비밀번호 (8자 이상)
 * @returns {Promise<string>} bcrypt 해시값 (약 60자)
 * @throws {Error} 해싱 실패
 * 
 * 예시:
 * const hash = await hashPassword('MyPassword123!');
 * // 결과: $2a$10$... (60자 해시)
 * 
 * 보안:
 * ✅ 레이트 리미팅 필수 (회원가입 1회/분)
 * ✅ HTTPS 통신 필수 (중간자 공격 방지)
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, 10); // 라운드 10
}

/**
 * 비밀번호 검증 (bcryptjs 사용)
 * 
 * 용도:
 * - 로그인 시 입력 비밀번호와 저장된 해시값 비교
 * - 비밀번호 변경 시 기존 비밀번호 확인
 * 
 * @param {string} password - 입력된 평문 비밀번호
 * @param {string} hash - DB에 저장된 bcrypt 해시값
 * @returns {Promise<boolean>} true = 일치, false = 불일치
 * 
 * 예시:
 * const valid = await verifyPassword('MyPassword123!', hash);
 * // 결과: true or false
 * 
 * 주의:
 * - bcrypt.compare()는 시간 소요 (약 100-500ms)
 * - 항상 await 사용
 * - 타이밍 공격 방지 내장
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * API Secret 암호화 (SHA256 사용)
 * 
 * 용도:
 * - API Secret은 평문 저장 불가
 * - 생성 시 평문 반환 (1회만)
 * - 검증할 때 해싱 후 비교
 * 
 * @param {string} secret - API Secret 원문 (32자 16진수)
 * @returns {string} SHA256 해시값 (64자)
 * 
 * 예시:
 * const secretHash = encryptApiSecret(apiSecret);
 * // 저장: api_secret_hash = secretHash
 * // 검증: encryptApiSecret(inputSecret) === storedHash
 * 
 * 주의:
 * - SHA256은 단방향 (복호화 불가능)
 * - 매번 같은 결과 (bcrypt와 달리 salt 없음)
 * - 검증용으로만 사용
 */
function encryptApiSecret(secret) {
    return crypto
        .createHash('sha256')
        .update(secret)
        .digest('hex'); // 16진수 문자열 반환
}

/**
 * API Key 생성
 * 
 * 형식: sk_{24바이트 16진수} (약 60자)
 * 예: sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 * 
 * @returns {string} 생성된 API Key (sk_ 접두사)
 * 
 * 특징:
 * ✅ 충돌 거의 불가능 (2^192 경우의 수)
 * ✅ 추측 불가능 (cryptographically secure random)
 * ✅ Stripe 형식 모방 (sk_ 접두사)
 * 
 * 예시:
 * const apiKey = generateApiKey();
 * // 결과: sk_abc123def456ghi789...
 */
function generateApiKey() {
    return 'sk_' + crypto.randomBytes(24).toString('hex');
}

/**
 * API Secret 생성
 * 
 * 형식: 32바이트 16진수 (64자)
 * 
 * @returns {string} 생성된 API Secret (16진수)
 * 
 * 특징:
 * ✅ 충돌 거의 불가능 (2^256 경우의 수)
 * ✅ 추측 불가능
 * ✅ SHA256과 같은 길이 (암호화 후도 64자)
 * 
 * 예시:
 * const apiSecret = generateApiSecret();
 * // 결과: abc123def456ghi789jkl... (64자)
 */
function generateApiSecret() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * UUID 생성 (Node.js 내장)
 * 
 * 용도:
 * - 사용자 ID
 * - 구독 ID
 * - API Key ID
 * - 기타 고유 ID
 * 
 * @returns {string} UUID v4 (36자, 하이픈 포함)
 * 
 * 형식: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * 예: 550e8400-e29b-41d4-a716-446655440000
 * 
 * 특징:
 * ✅ 충돌 거의 불가능
 * ✅ 순서 예측 불가능
 * ✅ 타임스탬프 기반 아님 (보안)
 */
function generateUUID() {
    return crypto.randomUUID();
}

/**
 * 일반 토큰 생성
 * 
 * 용도:
 * - 이메일 검증 토큰
 * - 비밀번호 재설정 토큰
 * - 임시 액세스 토큰
 * 
 * @param {number} [length=32] - 바이트 길이 (기본 32)
 * @returns {string} 생성된 토큰 (16진수)
 * 
 * 길이별 특징:
 * - 16 바이트 = 32자 (기본 보안)
 * - 32 바이트 = 64자 (강력한 보안)
 * - 64 바이트 = 128자 (매우 강력)
 * 
 * 예시:
 * const verificationToken = generateToken(32);
 * // 결과: abc123def456... (64자)
 */
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * HMAC 서명 생성 (Webhook용)
 * 
 * 용도:
 * - Webhook 요청 본문의 서명
 * - 클라이언트가 서명 검증으로 정품 확인
 * 
 * @param {Object} payload - Webhook 페이로드 객체
 * @param {string} secret - Webhook 시크릿 (클라이언트와 공유)
 * @returns {string} HMAC-SHA256 서명 (64자 16진수)
 * 
 * 흐름:
 * 1. 페이로드를 JSON 문자열로 변환
 * 2. secret을 키로 HMAC-SHA256 생성
 * 3. 16진수 문자열 반환
 * 
 * 예시 (Webhook 발송):
 * const payload = { event: 'subscription_activated', userId: 'uuid' };
 * const signature = createHmacSignature(payload, webhookSecret);
 * fetch(webhookUrl, {
 *   method: 'POST',
 *   headers: { 'X-Signature': signature },
 *   body: JSON.stringify(payload)
 * });
 * 
 * 예시 (Webhook 검증 - 클라이언트):
 * const receivedSignature = req.headers['x-signature'];
 * const expectedSignature = createHmacSignature(req.body, webhookSecret);
 * if (receivedSignature !== expectedSignature) {
 *   throw new Error('위조된 Webhook');
 * }
 */
function createHmacSignature(payload, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
}

/**
 * 모듈 내보내기
 */
module.exports = {
    hashPassword,
    verifyPassword,
    encryptApiSecret,
    generateApiKey,
    generateApiSecret,
    generateUUID,
    generateToken,
    createHmacSignature
};

/**
 * 🔒 보안 베스트 프랙티스
 * 
 * 1. 암호화 방식 선택
 *    - 비밀번호: bcrypt (계속 느려짐)
 *    - API Secret: SHA256 (빠름, 일반 저장용)
 *    - Webhook: HMAC (검증용)
 * 
 * 2. 레이트 리미팅
 *    - 회원가입: 1회/분
 *    - 로그인 실패: 5회 이상 차단
 *    - 비밀번호 변경: 1회/일
 * 
 * 3. HTTPS 필수
 *    - 모든 통신 암호화
 *    - API Key/Secret 평문 전송 금지
 * 
 * 4. 토큰 관리
 *    - Access Token: 7일 (짧음)
 *    - Refresh Token: 30일 (길음)
 *    - 검증 토큰: 24시간 (매우 짧음)
 */