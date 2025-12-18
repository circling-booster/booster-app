/**
 * validation.js - 클라이언트 측 입력값 검증
 * 
 * 역할:
 * - 이메일, 비밀번호, 휴대폰 번호 등 정규식 검증
 * - 폼 데이터 일괄 검증
 * - XSS 방지를 위한 입력값 정제
 */

(function (window) {
    /**
     * 입력값 검증 유틸리티 클래스
     */
    class Validator {
        /**
         * 이메일 검증
         * @param {string} email - 이메일 주소
         * @returns {boolean} 유효 여부
         */
        static validateEmail(email) {
            // 기본 이메일 정규식: user@domain.com 형식
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return regex.test(email);
        }

        /**
         * 비밀번호 검증 (최소 8자, 대문자, 소문자, 숫자, 특수문자 포함)
         * @param {string} password - 비밀번호
         * @returns {boolean} 유효 여부
         */
        static validatePassword(password) {
            // 요구사항:
            // - 최소 8자
            // - 소문자 포함: (?=.*[a-z])
            // - 대문자 포함: (?=.*[A-Z])
            // - 숫자 포함: (?=.*\d)
            // - 특수문자 포함: (?=.*[@$!%*?&])
            const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            return regex.test(password);
        }

        /**
         * 휴대폰 번호 검증 (010-1234-5678 형식)
         * @param {string} phone - 휴대폰 번호
         * @returns {boolean} 유효 여부
         */
        static validatePhone(phone) {
            // 한국 휴대폰 번호: 010-1234-5678 또는 01012345678
            const regex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
            return regex.test(phone);
        }

        /**
         * 이름 검증 (2자 이상 50자 이하)
         * @param {string} name - 이름
         * @returns {boolean} 유효 여부
         */
        static validateName(name) {
            return name && name.length >= 2 && name.length <= 50;
        }

        /**
         * URL 검증
         * @param {string} url - URL
         * @returns {boolean} 유효 여부
         */
        static validateURL(url) {
            try {
                new URL(url);
                return true;
            } catch (err) {
                return false;
            }
        }

        /**
         * 입력값 정제 (XSS 방지)
         * @param {string} input - 입력값
         * @returns {string} 정제된 값
         */
        static sanitize(input) {
            if (typeof input !== 'string') return input;
            // 공백 제거 및 HTML 태그 제거
            return input.trim().replace(/[<>]/g, '');
        }

        /**
         * 폼 데이터 일괄 검증
         * @param {Object} formData - 폼 데이터 (e.g., {email: "test@example.com", ...})
         * @param {Object} rules - 검증 규칙
         * @returns {Object} {isValid, errors} 검증 결과
         * 
         * @example
         * const rules = {
         *   email: {required: true, type: 'email', label: '이메일'},
         *   password: {required: true, type: 'password', label: '비밀번호'},
         *   firstName: {required: true, minLength: 2, label: '이름'}
         * };
         * const result = Validator.validateForm(formData, rules);
         */
        static validateForm(formData, rules) {
            const errors = {};

            for (const [field, rule] of Object.entries(rules)) {
                const value = formData[field];
                const fieldErrors = [];

                // 필수값 확인
                if (rule.required && (!value || value.trim() === '')) {
                    fieldErrors.push(`${rule.label}은 필수입니다`);
                } else {
                    // 유형별 검증
                    if (rule.type === 'email' && !this.validateEmail(value)) {
                        fieldErrors.push('유효한 이메일 주소를 입력하세요');
                    }
                    if (rule.type === 'password' && !this.validatePassword(value)) {
                        fieldErrors.push('비밀번호는 8자 이상, 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다');
                    }
                   // if (rule.type === 'phone' && !this.validatePhone(value)) {
                    //    fieldErrors.push('유효한 휴대폰 번호를 입력하세요 (01X-XXXX-XXXX)');
                  //  }
                    
                    // 길이 검증
                    if (rule.minLength && value.length < rule.minLength) {
                        fieldErrors.push(`${rule.label}은 최소 ${rule.minLength}자 이상이어야 합니다`);
                    }
                    if (rule.maxLength && value.length > rule.maxLength) {
                        fieldErrors.push(`${rule.label}은 최대 ${rule.maxLength}자 이하여야 합니다`);
                    }
                }

                // 에러 수집
                if (fieldErrors.length > 0) {
                    errors[field] = fieldErrors;
                }
            }

            return {
                isValid: Object.keys(errors).length === 0,
                errors
            };
        }
    }

    // 전역 객체에 할당
    window.Validator = Validator;
})(window);
