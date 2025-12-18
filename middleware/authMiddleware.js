const { verifyToken, extractTokenFromHeader } = require('../utils/tokenUtils');
const errorResponse = require('../utils/errorResponse');

function authMiddleware(req, res, next) {

    try {
        const token = extractTokenFromHeader(req.headers.authorization);

        if (!token) {
            return errorResponse(res, '인증 토큰이 없습니다', 401, 'INVALID_TOKEN');
        }

        const decoded = verifyToken(token, false);

        if (!decoded) {
            return errorResponse(res, '유효하지 않은 토큰입니다', 401, 'INVALID_TOKEN');
        }

        req.user = decoded;
        next();
    } catch (err) {
        console.log(err)
        errorResponse(res, '인증 처리 중 오류가 발생했습니다', 500);
    }
}

// 관리자 전용 미들웨어
function adminAuthMiddleware(req, res, next) {
    try {
        const token = extractTokenFromHeader(req.headers.authorization);

        if (!token) {
            return errorResponse(res, '인증 토큰이 없습니다', 401, 'INVALID_TOKEN');
        }

        const decoded = verifyToken(token, false);

        if (!decoded) {
            return errorResponse(res, '유효하지 않은 토큰입니다', 401, 'INVALID_TOKEN');
        }

        // ✅ 명시적으로 true와 비교
        if (!decoded.isAdmin || decoded.isAdmin !== true) {
            console.log('[관리자 권한] 거부됨', {
                userId: decoded.userId,
                isAdmin: decoded.isAdmin,
                type: typeof decoded.isAdmin
            });
            return errorResponse(res, '관리자 권한이 필요합니다', 403, 'FORBIDDEN');
        }

        req.user = decoded;
        next();
    } catch (err) {
        console.error('[관리자 권한 오류]', err);
        errorResponse(res, '권한 확인 중 오류가 발생했습니다', 500);
    }
}
module.exports = {
    authMiddleware,
    adminAuthMiddleware
};