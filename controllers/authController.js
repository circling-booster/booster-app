const { getPool, sql } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE }
  );

  return { accessToken, refreshToken };
};

// 회원가입
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // 비밀번호 강도 검사
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const pool = await getPool();

    // 기존 이메일 확인
    const checkQuery = 'SELECT id FROM dbo.users WHERE email = @email';
    const checkRequest = pool.request();
    checkRequest.input('email', sql.VarChar, email);
    const checkResult = await checkRequest.query(checkQuery);

    if (checkResult.recordset.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO dbo.users (email, password_hash, first_name, last_name)
      OUTPUT INSERTED.id
      VALUES (@email, @password, @firstName, @lastName)
    `;

    const request = pool.request();
    request.input('email', sql.VarChar, email);
    request.input('password', sql.VarChar, hashedPassword);
    request.input('firstName', sql.VarChar, firstName || null);
    request.input('lastName', sql.VarChar, lastName || null);

    const result = await request.query(query);
    const userId = result.recordset[0].id;

    const { accessToken, refreshToken } = generateTokens(userId);

    // refresh token을 DB에 저장
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);

    const tokenQuery = `
      INSERT INTO dbo.refresh_tokens (user_id, token, expires_at)
      VALUES (@userId, @token, @expiresAt)
    `;

    const tokenRequest = pool.request();
    tokenRequest.input('userId', sql.Int, userId);
    tokenRequest.input('token', sql.VarChar, refreshToken);
    tokenRequest.input('expiresAt', sql.DateTime, expireDate);
    await tokenRequest.query(tokenQuery);

    res.status(201).json({
      message: 'User registered successfully',
      userId,
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 로그인
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const pool = await getPool();

    const query = 'SELECT * FROM dbo.users WHERE email = @email';
    const request = pool.request();
    request.input('email', sql.VarChar, email);

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.recordset[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    // refresh token을 DB에 저장
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);

    const tokenQuery = `
      INSERT INTO dbo.refresh_tokens (user_id, token, expires_at)
      VALUES (@userId, @token, @expiresAt)
    `;

    const tokenRequest = pool.request();
    tokenRequest.input('userId', sql.Int, user.id);
    tokenRequest.input('token', sql.VarChar, refreshToken);
    tokenRequest.input('expiresAt', sql.DateTime, expireDate);
    await tokenRequest.query(tokenQuery);

    res.json({
      message: 'Login successful',
      userId: user.id,
      email: user.email,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 프로필 조회
const getProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const pool = await getPool();

    const query = `
      SELECT id, email, first_name, last_name, created_at, updated_at 
      FROM dbo.users 
      WHERE id = @id
    `;

    const request = pool.request();
    request.input('id', sql.Int, userId);

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.recordset[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 프로필 업데이트
const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { firstName, lastName } = req.body;

    const pool = await getPool();

    const query = `
      UPDATE dbo.users 
      SET first_name = @firstName, 
          last_name = @lastName,
          updated_at = GETDATE()
      WHERE id = @id
    `;

    const request = pool.request();
    request.input('id', sql.Int, userId);
    request.input('firstName', sql.VarChar, firstName || null);
    request.input('lastName', sql.VarChar, lastName || null);

    await request.query(query);

    res.json({
      message: 'Profile updated successfully',
      firstName: firstName || '',
      lastName: lastName || ''
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 비밀번호 변경
const changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const pool = await getPool();

    // 현재 비밀번호 확인
    const userQuery = 'SELECT password_hash FROM dbo.users WHERE id = @id';
    const userRequest = pool.request();
    userRequest.input('id', sql.Int, userId);
    const userResult = await userRequest.query(userQuery);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.recordset[0];
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // 새 비밀번호 해시
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 비밀번호 업데이트
    const updateQuery = `
      UPDATE dbo.users 
      SET password_hash = @password,
          updated_at = GETDATE()
      WHERE id = @id
    `;

    const updateRequest = pool.request();
    updateRequest.input('id', sql.Int, userId);
    updateRequest.input('password', sql.VarChar, hashedPassword);

    await updateRequest.query(updateQuery);

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 로그아웃
const logout = async (req, res) => {
  try {
    const userId = req.userId;
    const pool = await getPool();

    // refresh token 삭제
    const query = 'DELETE FROM dbo.refresh_tokens WHERE user_id = @userId';
    const request = pool.request();
    request.input('userId', sql.Int, userId);
    await request.query(query);

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  changePassword, 
  logout 
};