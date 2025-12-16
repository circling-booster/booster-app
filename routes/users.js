const express = require('express');
const { getPool, sql } = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// 사용자 정보 조회
router.get('/:id', auth, async (req, res) => {
  try {
    const pool = await getPool();
    const query = 'SELECT id, email, first_name, last_name, created_at FROM dbo.users WHERE id = @id';

    const request = pool.request();
    request.input('id', sql.Int, req.params.id);
    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
