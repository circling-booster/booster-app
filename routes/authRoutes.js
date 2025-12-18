/**
 * Auth Routes - 인증 관련 엔드포인트
 * 
 * 역할:
 * - 사용자 회원가입
 * - 사용자 로그인
 * - 토큰 갱신
 * 
 * 인증 미들웨어 필요 여부:
 * - signup: 불필요 (공개 엔드포인트)
 * - login: 불필요 (공개 엔드포인트)
 * - refresh-token: 불필요 (토큰 없이도 refresh token으로 재발급)
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * POST /api/auth/signup
 * 
 * 설명: 새로운 사용자 계정 생성
 * 
 * @request
 * - Method: POST
 * - Headers: Content-Type: application/json
 * - Body: {
 *     firstName: string (2-50자),
 *     lastName: string (2-50자),
 *     email: string (유효한 이메일 형식),
 *     phoneNumber: string (01X-XXXX-XXXX 형식),
 *     password: string (최소 8자, 대소문자, 숫자, 특수문자),
 *     confirmPassword: string (password와 동일)
 *   }
 * 
 * @response
 * - 201 Created: { success: true, data: { userId }, message: '회원가입이 완료되었습니다' }
 * - 400 Bad Request: { success: false, errorCode: 'VALIDATION_ERROR' }
 * - 409 Conflict: { success: false, errorCode: 'EMAIL_ALREADY_EXISTS' }
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. validateSignupRequest 미들웨어: 입력값 검증
 * 2. authController.signup: 비즈니스 로직 처리
 * 3. authService.registerUser: DB에 사용자 정보 저장
 * 4. 응답 반환
 * 
 * @example
 * POST /api/auth/signup
 * {
 *   "firstName": "김",
 *   "lastName": "철수",
 *   "email": "kim@example.com",
 *   "phoneNumber": "010-1234-5678",
 *   "password": "SecurePass123!",
 *   "confirmPassword": "SecurePass123!"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": { "userId": "550e8400-e29b-41d4-a716-446655440000" },
 *   "message": "회원가입이 완료되었습니다"
 * }
 */
router.post('/auth/signup', authController.signup);

/**
 * POST /api/auth/login
 * 
 * 설명: 사용자 로그인 및 JWT 토큰 발급
 * 
 * @request
 * - Method: POST
 * - Headers: Content-Type: application/json
 * - Body: {
 *     email: string,
 *     password: string
 *   }
 * 
 * @response
 * - 200 OK: { 
 *     success: true, 
 *     data: { 
 *       userId, 
 *       accessToken (7일 유효), 
 *       refreshToken (30일 유효),
 *       isAdmin
 *     },
 *     message: '로그인 성공'
 *   }
 * - 400 Bad Request: 이메일 또는 비밀번호 누락
 * - 401 Unauthorized: 이메일 없음 또는 비밀번호 불일치
 * - 403 Forbidden: 계정 차단 또는 비활성화
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. authController.login: 입력값 기본 검증
 * 2. authService.loginUser:
 *    a. Users 테이블에서 이메일로 사용자 조회
 *    b. 차단/비활성화 상태 확인
 *    c. bcrypt로 비밀번호 검증
 *    d. last_login 업데이트
 *    e. JWT 토큰 생성 (access + refresh)
 * 3. 응답 반환
 * 
 * @example
 * POST /api/auth/login
 * {
 *   "email": "kim@example.com",
 *   "password": "SecurePass123!"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "userId": "550e8400-e29b-41d4-a716-446655440000",
 *     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "isAdmin": false
 *   },
 *   "message": "로그인 성공"
 * }
 */
router.post('/auth/login', authController.login);

/**
 * POST /api/auth/refresh-token
 * 
 * 설명: 만료된 Access Token을 Refresh Token으로 갱신
 * 
 * @request
 * - Method: POST
 * - Headers: Content-Type: application/json
 * - Body: {
 *     refreshToken: string (로그인 시 받은 refresh token)
 *   }
 * 
 * @response
 * - 200 OK: { 
 *     success: true, 
 *     data: { 
 *       accessToken (새로운 7일 유효 토큰)
 *     },
 *     message: '토큰 갱신 성공'
 *   }
 * - 400 Bad Request: refreshToken 누락
 * - 401 Unauthorized: 유효하지 않은 또는 만료된 refreshToken
 * - 500 Internal Server Error
 * 
 * @flow
 * 1. authController.refreshToken: 입력값 검증
 * 2. authService.refreshAccessToken:
 *    a. refreshToken 검증 (JWT_REFRESH_SECRET 사용)
 *    b. 토큰에서 userId 추출
 *    c. 새로운 accessToken 생성
 * 3. 응답 반환
 * 
 * @note
 * - Refresh Token은 갱신되지 않음 (30일 유효기간 유지)
 * - Access Token만 새로 생성됨
 * - 클라이언트는 새로운 accessToken으로 업데이트해야 함
 * 
 * @example
 * POST /api/auth/refresh-token
 * {
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   },
 *   "message": "토큰 갱신 성공"
 * }
 */
router.post('/auth/refresh-token', authController.refreshToken);

module.exports = router;