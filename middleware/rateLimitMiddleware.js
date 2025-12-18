/**
 * Rate Limit Middleware - 요청 속도 제한
 * 
 * 역할:
 * - IP 기반 Rate Limiting (1시간당 100회)
 * - API Key 기반 Rate Limiting (1시간당 1,000회)
 * - Whitelist IP 설정으로 특정 IP 제한 면제
 * 
 * 참고: Azure Web App은 로드밸런서 뒤에 있으므로 trust proxy 설정 필요
 */

const rateLimit = require('express-rate-limit');
const { executeQuery } = require('../config/database');
const { RATE_LIMIT_TYPE } = require('../config/constants');

/**
 * 화이트리스트 IP 목록
 * - .env의 RATE_LIMIT_WHITELIST_IPS에서 쉼표로 구분된 IP 목록
 * - 예: "127.0.0.1,192.168.1.1"
 */
const whitelistIps = process.env.RATE_LIMIT_WHITELIST_IPS
    ? process.env.RATE_LIMIT_WHITELIST_IPS.split(',').map(ip => ip.trim())
    : [];

/**
 * IP 화이트리스트 확인 함수
 * 
 * @param {Object} req - Express 요청 객체
 * @returns {boolean} - 화이트리스트에 있으면 true
 * 
 * @description
 * - Azure 등 프록시 환경에서는 x-forwarded-for 헤더를 확인
 * - app.set('trust proxy', 1) 설정으로 req.ip가 실제 클라이언트 IP로 설정됨
 */
const isWhitelisted = (req) => {
    // req.ip는 express-rate-limit이 자동으로 처리
    // trust proxy 설정 시 x-forwarded-for 헤더에서 추출
    const clientIp = req.ip;
    return whitelistIps.includes(clientIp);
};

/**
 * IP 기반 Rate Limiter
 * 
 * @description
 * - 1시간(3600000ms) 내에 IP당 100회 요청 제한
 * - 화이트리스트 IP는 skip 함수를 통해 제한 면제
 * - RateLimit 헤더 추가: x-ratelimit-limit, x-ratelimit-remaining
 * 
 * @flow
 * 1. 요청 IP 추출
 * 2. 화이트리스트 IP 확인 → 제한 면제
 * 3. 메모리 저장소에서 해당 IP의 요청 카운트 조회
 * 4. 1시간 윈도우 내에서 카운트 증가
 * 5. 100회 초과 → 429 Too Many Requests
 * 
 * @example
 * app.use(ipLimiter);  // 모든 라우트에 적용
 */
const ipLimiter = rateLimit({
    // 1시간을 milliseconds로 표현
    windowMs: 60 * 60 * 1000,
    
    // IP당 최대 100회 요청
    max: 100,
    
    // 제한 초과 시 응답 메시지
    message: 'IP 요청 한도를 초과했습니다.',
    
    // RateLimit 헤더 표준 형식 사용
    standardHeaders: true,
    
    // 레거시 헤더 비활성화
    legacyHeaders: false,

    // ✅ [중요] skip 함수를 사용하여 화이트리스트 IP 처리
    skip: (req, res) => {
        if (isWhitelisted(req)) {
            // 로그 출력 (선택사항)
            console.log(`Rate Limit Skipped for IP: ${req.ip}`);
            return true;  // true = 이 요청은 Rate Limit 계산에서 제외
        }
        return false;  // false = 정상적으로 Rate Limit 계산
    }
});

/**
 * API Key 기반 Rate Limiter (데이터베이스 사용)
 * 
 * @description
 * - x-api-key 헤더로 API Key 기반 제한
 * - 1시간 내 최대 1,000회 요청 (수정 가능)
 * - ApiLogs 테이블에서 1시간 내 요청 수 조회
 * - 화이트리스트 IP는 DB 조회도 건너뜀
 * 
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 호출
 * 
 * @flow
 * 1. 화이트리스트 IP 확인 → 즉시 통과
 * 2. x-api-key 헤더 추출
 * 3. 1시간 전 시간 계산
 * 4. ApiLogs에서 해당 API Key의 1시간 내 요청 수 조회
 * 5. 1,000회 초과 → 429 에러
 * 6. 미만 → 다음 미들웨어로 진행
 * 
 * @note
 * - API Key가 없으면 다음 미들웨어(예: 인증)로 넘김
 * - DB 조회 실패 시에도 일단 통과시킴 (안정성 우선)
 * - 에러 발생 시 로그만 기록하고 진행
 */
async function apiKeyRateLimiter(req, res, next) {
    try {
        // 1. 화이트리스트 IP인 경우 즉시 통과
        // DB 조회를 줄이기 위해 먼저 확인
        if (isWhitelisted(req)) {
            return next();
        }

        // 2. 요청 헤더에서 API Key 추출
        const apiKey = req.headers['x-api-key'];
        
        // 3. API Key가 없으면 다음 미들웨어로 넘김
        // (예: 인증 미들웨어에서 처리)
        if (!apiKey) return next();

        // 4. 현재 시간과 1시간 전 시간 계산
        const now = new Date();
        const oneHourAgo = new Date(now - 60 * 60 * 1000);

        // 5. ApiLogs 테이블에서 최근 1시간 내 해당 API Key의 요청 수 조회
        // - COUNT(*) 사용으로 총 요청 수 계산
        // - WHERE 절로 시간 범위 제한
        const result = await executeQuery(
            `SELECT COUNT(*) as count FROM [ApiLogs]
             WHERE api_key_id = @apiKey AND created_at > @oneHourAgo`,
            { apiKey, oneHourAgo }
        );
        
        // 6. 요청 수 추출 (결과가 없으면 0)
        const requestCount = result.length > 0 ? result.count : 0;

        // 7. 1시간 제한(1,000회) 초과 확인
        if (requestCount >= 1000) {
            // 429 Too Many Requests 반환
            // retryAfter: 다음 요청 시도 권장 시간 (3600초 = 1시간)
            return res.status(429).json({
                success: false,
                message: 'Rate limit exceeded',
                retryAfter: 3600
            });
        }

        // 8. 제한 미만 → 다음 미들웨어로 진행
        next();
    } catch (err) {
        // 9. DB 조회 중 에러 발생 시 처리
        // 안정성을 위해 에러 시에도 일단 통과시킴
        console.error('Rate limit check error:', err);
        
        // 에러 발생했으나 정책에 따라 처리
        // 옵션1: next()로 통과 (안정성 우선)
        // 옵션2: res.status(500)으로 차단 (보안 우선)
        next(); // 현재는 안정성 우선
    }
}

module.exports = { ipLimiter, apiKeyRateLimiter };