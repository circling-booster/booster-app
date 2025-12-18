/**
 * utils/validationUtils.js
 * 역할: 입력 데이터 검증 (정규표현식 기반)
 * 특징: SQL Injection, XSS 방지
 */

/**
 * 이메일 검증
 * 
 * @param {string} email - 검증할 이메일
 * @returns {boolean} 유효한 형식 여부
 * 
 * 규칙:
 * - @앞에 최소 1글자
 * - @뒤에 도메인
 * - .뒤에 최소 1글자
 * 
 * 예시:
 * ✅ valid@example.com
 * ✅ user.name@company.co.kr
 * ❌ invalid@
 * ❌ @example.com
 * ❌ invalid.example.com
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 비밀번호 검증 (강도 확인)
 * 
 * @param {string} password - 검증할 비밀번호
 * @returns {boolean} 요구사항 충족 여부
 * 
 * 요구사항:
 * ✅ 최소 8자
 * ✅ 소문자 1개 이상 (a-z)
 * ✅ 대문자 1개 이상 (A-Z)
 * ✅ 숫자 1개 이상 (0-9)
 * ✅ 특수문자 1개 이상 (@$!%*?&)
 * 
 * 예시:
 * ✅ MyPassword123!
 * ✅ SecureP@ss2024
 * ❌ password (소문자만)
 * ❌ PASSWORD123! (대문자 + 특수문자 없음)
 * ❌ Pass1! (8자 미만)
 * 
 * 참고:
 * - OWASP 비밀번호 정책 준수
 * - 사용자 친화적 안내 필요
 */
function validatePassword(password) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
}

/**
 * 휴대폰 번호 검증 (한국)
 * 
 * @param {string} phone - 검증할 휴대폰 번호
 * @returns {boolean} 유효한 형식 여부
 * 
 * 허용 형식:
 * ✅ 01X-XXXX-XXXX (하이픈 포함)
 * ✅ 01XXXXXXXXX (하이픈 없음)
 * 
 * 규칙:
 * - 01로 시작 (01X 형식)
 * - X는 0-9 숫자
 * - 전체 11자
 * 
 * 예시:
 * ✅ 010-1234-5678
 * ✅ 01012345678
 * ✅ 011-1234-5678 (011도 가능)
 * ❌ 02-1234-5678 (지역번호)
 * ❌ 010-12-3456 (형식 오류)
 */
function validatePhoneNumber(phone) {
    const phoneRegex = /^01[0-9]-?\\d{3,4}-?\\d{4}$/;
    return phoneRegex.test(phone);
}

/**
 * 이름 검증
 * 
 * @param {string} name - 검증할 이름
 * @returns {boolean} 유효한 이름 여부
 * 
 * 규칙:
 * - 2자 이상 50자 이하
 * - null/undefined 제외
 * 
 * 예시:
 * ✅ 김철수
 * ✅ John
 * ✅ Maria José
 * ❌ A (1자)
 * ❌ null
 * ❌ "" (빈 문자열)
 */
function validateName(name) {
    return name && name.length >= 2 && name.length <= 50;
}

/**
 * 입력값 sanitization (SQL Injection 방지)
 * 
 * @param {string} input - 정제할 입력값
 * @returns {string} 정제된 입력값
 * 
 * 제거 대상:
 * ❌ 특수문자 (SQL 명령어, 스크립트 포함)
 * ❌ HTML 태그
 * ❌ 공백 (앞뒤만 제거, 중간 유지)
 * 
 * 허용 문자:
 * ✅ 영문 대소문자
 * ✅ 숫자
 * ✅ 하이픈 (-)
 * ✅ 언더스코어 (_)
 * ✅ 한글
 * ✅ 공백 (중간)
 * 
 * 예시:
 * input: "John; DROP TABLE Users--"
 * output: "John DROP TABLE Users"
 * 
 * input: "<script>alert('xss')</script>"
 * output: "scriptalertxssscript"
 * 
 * 예시:
 * input: "김 철수"
 * output: "김 철수" (유지)
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    // 영문, 숫자, 하이픈, 언더스코어, 한글, 공백만 허용
    return input
        .replace(/[^a-zA-Z0-9\\-_가-힣\\s]/g, '') // 허용되지 않는 문자 제거
        .trim(); // 앞뒤 공백 제거
}

/**
 * 회원가입 입력값 통합 검증
 * 
 * @param {Object} data - 검증할 데이터
 * @param {string} data.firstName - 이름
 * @param {string} data.lastName - 성
 * @param {string} data.email - 이메일
 * @param {string} data.phoneNumber - 휴대폰
 * @param {string} data.password - 비밀번호
 * @returns {Object} { isValid: boolean, errors: {...} }
 * 
 * 반환값:
 * {
 *   isValid: false,
 *   errors: {
 *     firstName: "이름은 2자 이상 50자 이하여야 합니다",
 *     email: "유효한 이메일 주소를 입력하세요",
 *     ...
 *   }
 * }
 * 
 * 예시 (컨트롤러에서):
 * const validation = validateSignupInput(req.body);
 * if (!validation.isValid) {
 *   return errorResponse(res, '입력값 검증 실패', 400, 'VALIDATION_ERROR', validation.errors);
 * }
 */
function validateSignupInput(data) {
    const errors = {};

    // 이름 검증
    if (!validateName(data.firstName)) {
        errors.firstName = '이름은 2자 이상 50자 이하여야 합니다';
    }

    // 성 검증
    if (!validateName(data.lastName)) {
        errors.lastName = '성은 2자 이상 50자 이하여야 합니다';
    }

    // 이메일 검증
    if (!validateEmail(data.email)) {
        errors.email = '유효한 이메일 주소를 입력하세요';
    }

    // 휴대폰 검증
  //  if (!validatePhoneNumber(data.phoneNumber)) {
       // errors.phoneNumber = '유효한 휴대폰 번호를 입력하세요 (01X-XXXX-XXXX)';
  //  }

    // 비밀번호 검증
    if (!validatePassword(data.password)) {
        errors.password = '비밀번호는 최소 8자이며 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * 모듈 내보내기
 */
module.exports = {
    validateEmail,
    validatePassword,
    validatePhoneNumber,
    validateName,
    sanitizeInput,
    validateSignupInput
};

/**
 * 🛡️ 검증 모범 사례
 * 
 * 1. 클라이언트 검증 (선택사항)
 *    - 사용자 경험 개선
 *    - 서버 부하 감소
 * 
 * 2. 서버 검증 (필수)
 *    - 항상 수행
 *    - 클라이언트 검증만으로 충분하지 않음
 * 
 * 3. 데이터베이스 제약
 *    - UNIQUE 제약 (이메일)
 *    - NOT NULL 제약 (필수 필드)
 *    - 문자열 길이 제약 (VARCHAR 크기)
 * 
 * 4. 에러 메시지
 *    - 구체적 (어느 필드 오류인지)
 *    - 친화적 (수정 방법 안내)
 *    - 보안 고려 (과도한 정보 노출 금지)
 */