const express = require('express');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// 구독 생성
router.post('/', auth, async (req, res) => {
  try {
    const { subscriptionType, expiryDate, paymentMethod } = req.body;
    const pool = await getPool();

    const query = `
      INSERT INTO dbo.subscriptions (user_id, subscription_type, status, expiry_date, payment_method)
      OUTPUT INSERTED.id
      VALUES (@userId, @type, 'active', @expiryDate, @paymentMethod)
    `;

    const request = pool.request();
    request.input('userId', sql.Int, req.userId);
    request.input('type', sql.VarChar, subscriptionType);
    request.input('expiryDate', sql.DateTime, new Date(expiryDate));
    request.input('paymentMethod', sql.VarChar, paymentMethod);

    const result = await request.query(query);

    res.status(201).json({
      message: 'Subscription created',
      subscriptionId: result.recordset[0].id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 사용자 구독 조회
router.get('/', auth, async (req, res) => {
  try {
    const pool = await getPool();
    const query = 'SELECT * FROM dbo.subscriptions WHERE user_id = @userId';

    const request = pool.request();
    request.input('userId', sql.Int, req.userId);
    const result = await request.query(query);

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
