const express = require('express');
const { register, login, getProfile, updateProfile, changePassword, logout } = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

// 회원가입
router.post('/register', register);

// 로그인
router.post('/login', login);

// 프로필 조회 (인증 필요)
router.get('/profile', auth, getProfile);

// 프로필 수정 (인증 필요)
router.put('/profile', auth, updateProfile);

// 비밀번호 변경 (인증 필요)
router.post('/change-password', auth, changePassword);

// 로그아웃 (인증 필요)
router.post('/logout', auth, logout);

module.exports = router;