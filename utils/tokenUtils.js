const jwt = require('jsonwebtoken');

// Access Token 생성
function generateAccessToken(userId, isAdmin = false) {

    console.log('Generating access token for userId:', userId, 'isAdmin:', isAdmin);
    const payload = {
        userId,
        isAdmin: isAdmin === 1 ? true : Boolean(isAdmin)  // ✅ 항상 boolean
    };
    const options = {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    };

    return jwt.sign(payload, process.env.JWT_SECRET, options);

}
/**
 * Refresh Token 생성
 * @param {string} userId - 사용자 ID
 * @param {boolean} isAdmin - 관리자 여부
 * @returns {string} JWT Refresh Token
 */
function generateRefreshToken(userId, isAdmin = false) {

    const payload = {
        userId,
        isAdmin: isAdmin === 1 ? true : Boolean(isAdmin)
    };

    const options = {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, options);
}

/**
 * JWT 토큰 검증
 * ⭐ 핵심 수정: secret을 try 블록 최상단에서 선언하고,
 *    모든 jwt.verify 호출을 try 블록 내에서 처리
 */
function verifyToken(token, isRefresh = false) {
    try {
        // ✅ Step 1: secret을 먼저 선언
        const secret = isRefresh
            ? process.env.JWT_REFRESH_SECRET
            : process.env.JWT_SECRET;

        // ✅ Step 2: secret이 없으면 명확한 에러 던지기
        if (!secret) {
            const secretName = isRefresh ? 'JWT_REFRESH_SECRET' : 'JWT_SECRET';
            throw new Error(`${secretName} is not configured in environment variables`);
        }

        // ✅ Step 3: jwt.verify를 try 블록 내에서만 호출
        const decoded = jwt.verify(token, secret);

        console.log(
            'Token verified successfully - userId:',
            decoded.userId,
            'isAdmin:',
            decoded.isAdmin,
            'type:',
            decoded.type
        );

        return decoded;
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return null;
    }
}


/**
 * Authorization 헤더에서 Bearer 토큰 추출
 */
function extractTokenFromHeader(authHeader) {
    if (!authHeader) {
        console.warn('Authorization header is missing');
        return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
        console.warn('Authorization header format is invalid (expected 2 parts)');
        return null;
    }

    if (parts[0] !== 'Bearer') {
        console.warn('Authorization header type is not Bearer');
        return null;
    }

    return parts[1];
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    extractTokenFromHeader
};