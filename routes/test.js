const express = require('express');
const { getPool } = require('../config/database');

const router = express.Router();

router.get('/db-connection', async (req, res) => {
  try {
    const pool = await getPool();
    
    if (!pool) {
      return res.status(500).json({
        status: 'error',
        message: 'Connection pool not initialized'
      });
    }
    
    // 각 테이블의 행 수 확인
    const userResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM dbo.users');
    
    const subscriptionResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM dbo.subscriptions');
    
    const tokenResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM dbo.refresh_tokens');
    
    res.status(200).json({
      status: 'success',
      message: '✅ Database connection test successful',
      timestamp: new Date().toISOString(),
      database: {
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        connected: true
      },
      tables: {
        users: { count: userResult.recordset[0].count },
        subscriptions: { count: subscriptionResult.recordset[0].count },
        refresh_tokens: { count: tokenResult.recordset[0].count }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '❌ Database connection test failed',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: {
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        user: process.env.DB_USER
      }
    });
  }
});

module.exports = router;
