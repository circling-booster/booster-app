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
    connectionTimeout: 30000,
    requestTimeout: 30000
  }
};

let pool = null;

async function initializePool() {
  try {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✅ Database connection pool initialized');
    return pool;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    setTimeout(initializePool, 5000);
  }
}

async function getPool() {
  if (!pool) {
    await initializePool();
  }
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.close();
  }
}

module.exports = {
  getPool,
  initializePool,
  closePool,
  sql
};
