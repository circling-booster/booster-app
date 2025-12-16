require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  }
};

async function test() {
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✅ 데이터베이스 연결 성공!');
    
    const result = await pool.request()
      .query('SELECT COUNT(*) as count FROM dbo.users');
    console.log('✅ 쿼리 실행 성공!');
    console.log('현재 사용자 수:', result.recordset[0].count);
    
    await pool.close();
  } catch (error) {
    console.error('❌ 연결 오류:', error.message);
  }
}

test();
