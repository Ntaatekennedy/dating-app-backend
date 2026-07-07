const pool = require('../config/db');

async function ensureAuthMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS phone_otps (
      id CHAR(36) PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      code VARCHAR(6) NOT NULL,
      purpose ENUM('login', 'register') NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_phone_otps_phone_purpose (phone, purpose),
      INDEX idx_phone_otps_expires (expires_at)
    ) ENGINE=InnoDB
  `);

  const [emailCol] = await pool.query(`
    SELECT IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'email'
  `);

  if (emailCol.length && emailCol[0].IS_NULLABLE === 'NO') {
    await pool.query('ALTER TABLE users MODIFY email VARCHAR(255) NULL');
  }

  const [passCol] = await pool.query(`
    SELECT IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'password_hash'
  `);

  if (passCol.length && passCol[0].IS_NULLABLE === 'NO') {
    await pool.query('ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_reset_email (email),
      INDEX idx_password_reset_expires (expires_at)
    ) ENGINE=InnoDB
  `);
}

module.exports = { ensureAuthMigrations };
