const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const dbConfig = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// 라우트 임포트
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const subscriptionRoutes = require('./routes/subscriptions');
const testRoutes = require('./routes/test');

const app = express();

// 보안 & 미들웨어
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// 정적 파일 라우트
app.get('/register', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages/register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages/login.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages/profile.html'));
});

app.get('/change-password', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages/change-password.html'));
});

// 루트 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'pages/login.html'));
});

// 헬스 체크
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/test', testRoutes);

// 에러 핸들링
app.use(errorHandler);

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Booster App Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📂 Static files serving from: ${publicPath}`);
});