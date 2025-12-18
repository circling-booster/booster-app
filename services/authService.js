/**
 * Auth Service - 인증 관련 비즈니스 로직
 * 
 * 역할:
 * - 사용자 등록 (회원가입)
 * - 사용자 로그인 및 토큰 발급
 * - 토큰 갱신
 * 
 * 주요 의존성:
 * - database.js: executeQuery, executeNonQuery
 * - cryptoUtils.js: hashPassword, verifyPassword, generateApiKey 등
 * - tokenUtils.js: generateAccessToken, generateRefreshToken
 * - validationUtils.js: validateEmail
 */

const { executeQuery, executeNonQuery } = require('../config/database');
const { hashPassword, verifyPassword, generateApiKey, generateApiSecret, encryptApiSecret } = require('../utils/cryptoUtils');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
const { validateEmail } = require('../utils/validationUtils');

/**
 * 새로운 사용자 등록 (회원가입)
 * 
 * @param {Object} userData - 사용자 정보
 *   - firstName: string
 *   - lastName: string
 *   - email: string
 *   - phoneNumber: string
 *   - password: string (평문)
 * 
 * @returns {Promise<string>} - 생성된 userId (UUID)
 * 
 * @throws {Error} - 이미 등록된 이메일, DB 에러 등
 * 
 * @flow
 * 1. 이메일 중복 확인
 *    - Users 테이블에서 email으로 조회
 *    - 이미 존재하면 에러 발생
 * 
 * 2. 비밀번호 해싱
 *    - bcryptjs.hash(password, saltRounds=10)
 *    - 계산량: ~100ms (보안 vs 성능 균형)
 * 
 * 3. UUID 생성
 *    - crypto.randomUUID() 사용
 *    - 예: "550e8400-e29b-41d4-a716-446655440000"
 * 
 * 4. Users 테이블에 INSERT
 *    - id, first_name, last_name, email, phone_number, password_hash
 *    - is_admin 기본값: 0 (false)
 *    - is_active 기본값: 1 (true)
 *    - created_at: GETDATE()
 * 
 * 5. userId 반환
 * 
 * @example
 * const userId = await registerUser({
 *   firstName: '김',
 *   lastName: '철수',
 *   email: 'kim@example.com',
 *   phoneNumber: '010-1234-5678',
 *   password: 'SecurePass123!'
 * });
 * // userId: "550e8400-e29b-41d4-a716-446655440000"
 */
async function registerUser(userData) {
    try {
        // 1. 기존 사용자 확인
        const existingUser = await executeQuery(
            'SELECT id FROM [Users] WHERE email = @email',
            { email: userData.email }
        );

        // 2. 이미 등록된 이메일 확인
        if (existingUser.length > 0) {
            throw new Error('이미 등록된 이메일입니다');
        }

        // 3. 비밀번호 해싱 (bcryptjs, salt=10)
        // - 10번 라운드 계산
        // - 약 100ms 소요
        // - 해시된 비밀번호는 복호화 불가능, 비교만 가능
        const passwordHash = await hashPassword(userData.password);

        // 4. 새로운 userId 생성 (UUID)
        // - Node.js crypto.randomUUID() 사용
        // - RFC 4122 v4 표준
        const userId = require('crypto').randomUUID();

        // 5. Users 테이블에 새로운 사용자 INSERT
        await executeNonQuery(
            `INSERT INTO [Users] 
             (id, first_name, last_name, email, phone_number, password_hash)
             VALUES (@id, @firstName, @lastName, @email, @phoneNumber, @passwordHash)`,
            {
                id: userId,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                phoneNumber: userData.phoneNumber,
                passwordHash
            }
        );

        // 6. 생성된 userId 반환
        return userId;
    } catch (err) {
        throw err;
    }
}

/**
 * 사용자 로그인 및 JWT 토큰 발급
 * 
 * @param {string} email - 사용자 이메일
 * @param {string} password - 사용자 비밀번호 (평문)
 * 
 * @returns {Promise<Object>} - { userId, accessToken, refreshToken, isAdmin }
 *   - userId: string (UUID)
 *   - accessToken: string (JWT, 7일 유효)
 *   - refreshToken: string (JWT, 30일 유효)
 *   - isAdmin: boolean
 * 
 * @throws {Error}
 *   - '가입되지 않은 이메일입니다' (401)
 *   - '차단된 계정입니다' (403)
 *   - '비활성화된 계정입니다' (403)
 *   - '비밀번호가 일치하지 않습니다' (401)
 * 
 * @flow
 * 1. Users 테이블에서 이메일로 사용자 조회
 *    - password_hash, is_active, is_blocked, is_admin 포함
 * 
 * 2. 사용자 존재 확인
 *    - 없으면 에러 발생
 * 
 * 3. 차단 상태 확인
 *    - is_blocked = 1 이면 에러
 * 
 * 4. 활성화 상태 확인
 *    - is_active = 0 이면 에러
 * 
 * 5. 비밀번호 검증
 *    - bcryptjs.compare(평문, 해시)
 *    - 일치 확인
 * 
 * 6. 마지막 로그인 시간 업데이트
 *    - last_login = GETDATE()
 * 
 * 7. JWT 토큰 생성
 *    - Access Token: 7일 유효 (API 요청용)
 *    - Refresh Token: 30일 유효 (토큰 갱신용)
 *    - 페이로드: { userId, isAdmin, type: 'access' }
 * 
 * 8. 응답 객체 반환
 * 
 * @example
 * const result = await loginUser('kim@example.com', 'SecurePass123!');
 * // {
 * //   userId: '550e8400-e29b-41d4-a716-446655440000',
 * //   accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 * //   refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 * //   isAdmin: false
 * // }
 */
async function loginUser(email, password) {
    try {
        const users = await executeQuery(
            `SELECT id, first_name, last_name, email, password_hash, is_active, is_blocked, is_admin 
             FROM [Users] WHERE email = @email`,
            { email }
        );

        if (users.length === 0) {
            throw new Error('가입되지 않은 이메일입니다');
        }

        const user = users[0];
        console.log('[LOGIN] 사용자 조회', users);

        if (user.is_blocked) {
            throw new Error('차단된 계정입니다');
        }

        if (!user.is_active) {
            throw new Error('비활성화된 계정입니다');
        }

        const isPasswordValid = await verifyPassword(password, user.password_hash);

        if (!isPasswordValid) {
            throw new Error('비밀번호가 일치하지 않습니다');
        }

        await executeNonQuery(
            'UPDATE [Users] SET last_login = GETDATE() WHERE id = @id',
            { id: user.id }
        );

        const accessToken = generateAccessToken(user.id, user.is_admin);
        const refreshToken = generateRefreshToken(user.id, user.is_admin);

        // ✅ 명시적으로 result 변수에 할당
        const result = {
            userId: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            accessToken: accessToken,
            refreshToken: refreshToken,
            isAdmin: user.is_admin === 1 ? true : false
        };

        console.log('[LOGIN SERVICE] 결과 반환:', {
            userId: result.userId,
            isAdmin: result.isAdmin
        });

        return result;  // ✅ return 명확하게!

    } catch (err) {
        console.error('[LOGIN SERVICE ERROR]', err.message);
        throw err;
    }
}


/**
 * Access Token 갱신 (Refresh Token 사용)
 * 
 * @param {string} refreshToken - 유효한 Refresh Token
 * 
 * @returns {Promise<string>} - 새로운 Access Token
 * 
 * @throws {Error}
 *   - '유효하지 않은 리프레시 토큰입니다'
 * 
 * @flow
 * 1. Refresh Token 검증
 *    - JWT_REFRESH_SECRET으로 서명 검증
 *    - 만료 여부 확인
 * 
 * 2. Refresh Token 페이로드 추출
 *    - userId, isAdmin 추출
 * 
 * 3. 새로운 Access Token 생성
 *    - 같은 userId, isAdmin으로 새 토큰 생성
 *    - 유효기간: 7일
 * 
 * 4. Access Token 반환
 *    - Refresh Token은 갱신되지 않음
 *    - 유효기간 30일로 유지
 * 
 * @note
 * - Refresh Token 자체는 갱신되지 않음
 * - 30일 동안 유효한 Refresh Token으로 Access Token만 계속 갱신 가능
 * - 30일 후 새로 로그인 필요
 * 
 * @example
 * const newAccessToken = await refreshAccessToken(refreshToken);
 * // newAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 */
async function refreshAccessToken(refreshToken) {
    try {
        const { verifyToken } = require('../utils/tokenUtils');

        const decoded = verifyToken(refreshToken, true);

        if (!decoded) {
            throw new Error('유효하지 않은 리프레시 토큰입니다');
        }

        // ✅ 사용자 상태 확인
        const users = await executeQuery(
            'SELECT is_active, is_blocked, is_admin FROM [Users] WHERE id = @userId',
            { userId: decoded.userId }
        );

        if (users.length === 0) {
            throw new Error('사용자를 찾을 수 없습니다');
        }

        const user = users[0];

        if (user.is_blocked) {
            throw new Error('차단된 계정입니다');
        }

        if (!user.is_active) {
            throw new Error('비활성화된 계정입니다');
        }

        const newAccessToken = generateAccessToken(decoded.userId, user.is_admin);

        // ✅ 객체로 반환
        return {
            accessToken: newAccessToken,
            userId: decoded.userId,
            isAdmin: user.is_admin === 1 ? true : false
        };

    } catch (err) {
        console.error('[REFRESH TOKEN ERROR]', err.message);
        throw err;
    }
}



module.exports = {
    registerUser,
    loginUser,
    refreshAccessToken
};