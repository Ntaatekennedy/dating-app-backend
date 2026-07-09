const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runSqlFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const sql = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '')
    .replace(/^\s*USE\s+\w+\s*;?\s*$/gim, '');
  const statements = sql
    .split(/;\s*\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }
}

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

async function ensureMessageDeliveryMigration() {
  const [col] = await pool.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'messages'
      AND COLUMN_NAME = 'is_delivered'
  `);

  if (!col.length) {
    await pool.query(
      'ALTER TABLE messages ADD COLUMN is_delivered BOOLEAN NOT NULL DEFAULT FALSE AFTER is_read',
    );
  }
}

async function ensureProductionDataMigrations() {
  const migrationsDir = path.join(__dirname, '../../scripts/migrations');
  const files = ['seed_more_users.sql', 'update_show_me_all_genders.sql'];

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) continue;
    console.log(`Applying migration: ${file}`);
    await runSqlFile(filePath);
  }
}

module.exports = { ensureAuthMigrations, ensureMessageDeliveryMigration, ensureProductionDataMigrations };
