/**
 * authController.js
 * 역할: 회원가입, 로그인, 토큰 갱신 처리
 * 특징: 입력 검증 → Service 호출 → 응답 반환
 */

const authService = require('../services/authService');
const successResponse = require('../utils/successResponse');
const errorResponse = require('../utils/errorResponse');
const { validateSignupInput } = require('../utils/validationUtils');

/**
 * 회원가입 핸들러
 * 
 * @route POST /api/auth/signup
 * @param {string} firstName - 이름 (필수, 2-50자)
 * @param {string} lastName - 성 (필수, 2-50자)
 * @param {string} email - 이메일 (필수, 유효한 형식)
 * @param {string} phoneNumber - 휴대폰 (필수, 01X-XXXX-XXXX 형식)
 * @param {string} password - 비밀번호 (필수, 8자+대소문자+숫자+특수문자)
 * @param {string} confirmPassword - 비밀번호 확인 (필수, password와 일치)
 * 
 * @returns {201} { userId: "uuid" }
 * @throws {400} 입력값 검증 실패
 * @throws {409} 이미 등록된 이메일
 * @throws {500} 서버 오류
 */
async function signup(req, res) {
    try {
        // 요청 바디에서 데이터 추출
        const { firstName, lastName, email, phoneNumber, password, confirmPassword } = req.body;

        // 입력 검증 (validationUtils.validateSignupInput 사용)
        const validation = validateSignupInput({
            firstName,
            lastName,
            email,
            phoneNumber,
            password
        });

        // 검증 실패 시 400 에러와 상세 오류 정보 반환
        if (!validation.isValid) {
            return errorResponse(res, '입력값 검증 실패', 400, 'VALIDATION_ERROR', validation.errors);
        }

        // 비밀번호와 확인 비밀번호 비교
        if (password !== confirmPassword) {
            return errorResponse(res, '비밀번호가 일치하지 않습니다', 400, 'PASSWORD_MISMATCH');
        }

        // Service 호출: DB에 사용자 저장 및 UUID 반환
        const userId = await authService.registerUser({
            firstName,
            lastName,
            email,
            phoneNumber,
            password
        });

        // 성공 응답 (201 Created)
        successResponse(res, { userId }, '회원가입이 완료되었습니다', 201);
    } catch (err) {
        // 중복 이메일 에러 핸들링
        if (err.message.includes('이미 등록')) {
            return errorResponse(res, err.message, 409, 'EMAIL_ALREADY_EXISTS');
        }
        // 기타 에러
        errorResponse(res, err.message, 500);
    }
}

/**
 * 로그인 핸들러
 * 
 * @route POST /api/auth/login
 * @param {string} email - 이메일 (필수)
 * @param {string} password - 비밀번호 (필수)
 * 
 * @returns {200} { userId, accessToken, refreshToken, isAdmin }
 * @throws {400} 이메일 또는 비밀번호 누락
 * @throws {401} 잘못된 이메일/비밀번호
 * @throws {403} 차단된 계정
 * @throws {500} 서버 오류
 */


/**
 * 로그인 API
 * ⭐ 중요: isAdmin이 항상 boolean으로 반환됨
 */
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Step 1: 입력값 검증
        if (!email || !password) {
            return errorResponse(
                res,
                '이메일과 비밀번호를 입력하세요.',
                400,
                'MISSING_CREDENTIALS'
            );
        }

        // Step 2: 로그인 처리
        const result = await authService.loginUser(email, password);

        console.log('[LOGIN API RESPONSE]', {
            userId: result.userId,
            email: result.email,
            isAdmin: result.isAdmin,
            timestamp: new Date().toISOString()
        });

        // ✅ Step 3: 성공 응답 (isAdmin이 boolean 보장)
        successResponse(
            res,
            {
                userId: result.userId,
                firstName: result.firstName,
                lastName: result.lastName,
                email: result.email,
                phoneNumber: result.phoneNumber,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                isAdmin: result.isAdmin
            },
            '로그인 성공',
            200
        );
    } catch (err) {
        console.error('[LOGIN API ERROR]', err.message);

        // 에러 메시지에 따라 구체적인 응답 반환
        if (err.message.includes('blocked')) {
            return errorResponse(
                res,
                err.message,
                403,
                'ACCOUNT_BLOCKED'
            );
        }
        if (err.message.includes('not active')) {
            return errorResponse(
                res,
                err.message,
                403,
                'ACCOUNT_INACTIVE'
            );
        }
        if (err.message.includes('Invalid')) {
            return errorResponse(
                res,
                err.message,
                401,
                'INVALID_CREDENTIALS'
            );
        }

        errorResponse(res, err.message, 500, 'LOGIN_ERROR');
    }
}


/**
 * 토큰 갱신 핸들러
 * 
 * @route POST /api/auth/refresh-token
 * @param {string} refreshToken - Refresh Token (필수, 유효해야 함)
 * 
 * @returns {200} { accessToken }
 * @throws {400} Refresh Token 누락
 * @throws {401} 유효하지 않은 Refresh Token
 * @throws {500} 서버 오류
 * 
 * 참고:
 * - Access Token 만료 시 Refresh Token으로 새 Access Token 획득
 * - Refresh Token 자체는 검증만 하고 갱신하지 않음
 * - 클라이언트는 새 Access Token으로 업데이트 필요
 */
/**
 * Access Token 갱신 API
 */
async function refreshToken(req, res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return errorResponse(
                res,
                'Refresh Token이 필요합니다.',
                400,
                'MISSING_REFRESH_TOKEN'
            );
        }

        const result = await authService.refreshAccessToken(refreshToken);

        // ✅ isAdmin도 함께 반환
        successResponse(
            res,
            {
                accessToken: result.accessToken,
                userId: result.userId,
                isAdmin: result.isAdmin
            },
            '토큰이 갱신되었습니다.',
            200
        );
    } catch (err) {
        if (err.message.includes('Invalid') || err.message.includes('expired')) {
            return errorResponse(
                res,
                '유효하지 않은 Refresh Token입니다.',
                401,
                'INVALID_REFRESH_TOKEN'
            );
        }
        if (err.message.includes('차단') || err.message.includes('비활성화')) {
            return errorResponse(
                res,
                '비활성 또는 차단된 계정입니다.',
                403,
                'ACCOUNT_INACTIVE'
            );
        }

        errorResponse(res, err.message, 500, 'TOKEN_REFRESH_ERROR');
    }
}


/**
 * 로그아웃 API
 */
function logout(req, res) {
    try {
        console.log('[LOGOUT]', {
            userId: req.user?.userId,
            timestamp: new Date().toISOString()
        });

        successResponse(
            res,
            null,
            '로그아웃되었습니다.',
            200
        );
    } catch (err) {
        errorResponse(res, err.message, 500);
    }
}
/**
 * 모듈 내보내기
 * 라우트에서 authController.signup() 형태로 사용
 */
module.exports = {
    signup,
    login,
    refreshToken,
    logout

};