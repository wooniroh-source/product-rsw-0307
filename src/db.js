const mysql = require('mysql2/promise');

// Railway 표준 변수명 및 기존 변수명 모두 지원
const dbConfig = {
  host:     process.env.MYSQLHOST || process.env.DB_HOST || 'mysql.railway.internal',
  port:     parseInt(process.env.MYSQLPORT || process.env.DB_PORT) || 3306,
  user:     process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASS || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'cleanpartners',
  waitForConnections: true,
  connectionLimit: 10,
  ssl: (process.env.MYSQLHOST || process.env.DB_SSL === 'true') ? { rejectUnauthorized: false } : undefined
};

const pool = mysql.createPool(
  process.env.MYSQL_URL
    ? {
        uri: process.env.MYSQL_URL,
        waitForConnections: true,
        connectionLimit: 10,
        ssl: { rejectUnauthorized: false }
      }
    : dbConfig
);

module.exports = pool;
