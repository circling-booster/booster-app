// server.js - 최종 완성본
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initializePool } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { ipLimiter } = require('./middleware/rateLimitMiddleware');

// 라우트 임포트 (첨부된 파일 구조에 맞게 수정)
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

//특정 API 는 cors 허용
const authCors = cors({ origin: '*' });


const app = express();
//Azure Web App은 로드 밸런서 뒤에 있으므로 req.ip가 내부 IP로 찍힐 수 있습니다. 이를 방지
// Azure의 프록시 헤더(X-Forwarded-For)를 신뢰하도록 설정해야 실제 사용자 IP를 가져옵니다.
app.set('trust proxy', 1);

// --- 1. 보안 및 로깅 미들웨어 설정 ---
app.use(helmet({
    contentSecurityPolicy: false // 프론트엔드 리소스 로딩을 위해 CSP 비활성화 (필요시 상세 설정)
}));

// CORS 설정: 로컬 개발 환경과 Azure 배포 환경 모두 지원
app.use(cors({
    origin: [
        'http://localhost:3000',      // 백엔드 로컬
        'http://localhost:5500',      // Live Server
        'http://localhost:8000',      // Python HTTP Server
        'https://booster-app.azurewebsites.net', // Azure App Service
        process.env.CORS_ORIGIN       // .env에서 추가 설정 가능
    ].filter(Boolean),                // undefined 제거
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('combined')); // 로그 기록
app.use(ipLimiter); // IP 기반 Rate Limiting

// Body Parser 설정 (JSON 및 URL-encoded 데이터 처리)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- 2. 헬스 체크 엔드포인트 ---
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

// --- 3. API 라우트 설정 ---
// 모든 API 요청은 /api 접두사로 시작
app.use('/api', authCors,authRoutes);         // ...
app.use('/api', authCors,userRoutes);         // /api/users/...
app.use('/api', authCors,subscriptionRoutes); // /api/subscriptions/...
app.use('/api', authCors,apiKeyRoutes);       // /api/api-keys/...
app.use('/api', authCors,adminRoutes);        // /api/admin/...
app.use('/api', authCors,dashboardRoutes);    // /api/dashboard/...
app.use('/api', authCors,webhookRoutes);      // /api/webhooks/...

// --- 4. 프론트엔드 정적 파일 서빙 (중요) ---
// frontend 폴더를 정적 파일 루트로 설정
app.use(express.static(path.join(__dirname, 'frontend')));

// 루트 경로 접속 시 index.html 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// 프론트엔드 라우팅 지원 (SPA 방식)
// API가 아닌 모든 GET 요청에 대해 index.html 또는 해당 HTML 파일 반환 시도
// 여기서는 다중 페이지 구조이므로 특정 HTML 파일 요청은 express.static이 처리하고,
// 그 외 경로에 대해서는 404를 반환하거나 메인 페이지로 리다이렉트할 수 있음.
// 현재 구조는 HTML 파일 직접 요청 방식이므로 별도 SPA 라우팅 설정 불필요.

// --- 5. 404 에러 처리 (API 및 리소스) ---
app.use((req, res, next) => {
    // API 요청인 경우 JSON 응답
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            success: false,
            message: '요청한 API 엔드포인트를 찾을 수 없습니다'
        });
    }
    // 그 외 요청은 404 페이지 또는 텍스트 반환
    res.status(404).send('페이지를 찾을 수 없습니다.');
});

// --- 6. 전역 에러 핸들러 ---
app.use(errorHandler);

// --- 7. 서버 시작 ---
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // 데이터베이스 연결 초기화 (필수)
        await initializePool();
        console.log('✅ 데이터베이스 연결 성공');

        app.listen(PORT, () => {
            console.log(`🚀 서버가 포트 ${PORT}에서 시작되었습니다`);
            console.log(`📂 프론트엔드 경로: ${path.join(__dirname, 'frontend')}`);
            console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (err) {
        console.error('❌ 서버 시작 실패 (DB 연결 오류 등):', err);
        process.exit(1); // 치명적 오류 시 프로세스 종료
    }
}

startServer();

// --- 8. 프로세스 예외 처리 (안전장치) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // 운영 환경에서는 모니터링 시스템에 알림 전송 권장
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1); // 상태가 불안정하므로 재시작 권장
});
