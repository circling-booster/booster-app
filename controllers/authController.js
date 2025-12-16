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

const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const pool = await getPool();
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

    res.status(201).json({
      message: 'User registered successfully',
      userId,
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

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

    res.json({
      message: 'Login successful',
      userId: user.id,
      email: user.email,
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login };
