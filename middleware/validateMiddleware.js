const { sanitizeInput } = require('../utils/validationUtils');
const errorResponse = require('../utils/errorResponse');

function validateSignupRequest(req, res, next) {
    const { firstName, lastName, email, phoneNumber, password, confirmPassword } = req.body;
    
    const errors = {};
    
    if (!firstName || firstName.trim().length === 0) {
        errors.firstName = '이름은 필수입니다';
    }
    
    if (!lastName || lastName.trim().length === 0) {
        errors.lastName = '성은 필수입니다';
    }
    
    if (!email || email.trim().length === 0) {
        errors.email = '이메일은 필수입니다';
    }
    
    if (!phoneNumber || phoneNumber.trim().length === 0) {
        errors.phoneNumber = '휴대폰 번호는 필수입니다';
    }
    
    if (!password || password.length === 0) {
        errors.password = '비밀번호는 필수입니다';
    }
    
    if (password !== confirmPassword) {
        errors.confirmPassword = '비밀번호가 일치하지 않습니다';
    }
    
    if (Object.keys(errors).length > 0) {
        return errorResponse(res, '입력값 검증 실패', 400, 'VALIDATION_ERROR', errors);
    }
    
    // SQL Injection 방지
    req.body.firstName = sanitizeInput(firstName);
    req.body.lastName = sanitizeInput(lastName);
    req.body.email = sanitizeInput(email);
    req.body.phoneNumber = sanitizeInput(phoneNumber);
    
    next();
}

function validateLoginRequest(req, res, next) {
    const { email, password } = req.body;
    
    if (!email || email.trim().length === 0) {
        return errorResponse(res, '이메일은 필수입니다', 400, 'VALIDATION_ERROR');
    }
    
    if (!password || password.length === 0) {
        return errorResponse(res, '비밀번호는 필수입니다', 400, 'VALIDATION_ERROR');
    }
    
    req.body.email = sanitizeInput(email);
    
    next();
}

module.exports = {
    validateSignupRequest,
    validateLoginRequest
};