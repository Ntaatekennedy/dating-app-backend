const mysql = require('mysql2/promise');

function dbConfig() {
  if (process.env.MYSQL_URL) {
    const url = process.env.MYSQL_URL;
    return url.includes('?')
      ? `${url}&multipleStatements=true`
      : `${url}?multipleStatements=true`;
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 15000,
    multipleStatements: true,
  };
}

const pool = mysql.createPool(dbConfig());

module.exports = pool;
