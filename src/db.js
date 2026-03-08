const mysql = require('mysql2/promise');

const pool = mysql.createPool(
  process.env.MYSQL_URL
    ? {
        uri: process.env.MYSQL_URL,
        waitForConnections: true,
        connectionLimit: 10,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'cleanpartners',
        waitForConnections: true,
        connectionLimit: 10,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
      }
);

module.exports = pool;
