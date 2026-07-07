const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function bootstrapDatabase() {
  if (process.env.SKIP_DB_BOOTSTRAP === 'true') {
    return;
  }

  const [tables] = await pool.query("SHOW TABLES LIKE 'users'");
  if (tables.length) {
    const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM users');
    if (c > 0) return;

    console.log('Resetting partial schema before bootstrap...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    const [tableRows] = await pool.query('SHOW TABLES');
    for (const row of tableRows) {
      const name = Object.values(row)[0];
      await pool.query(`DROP TABLE IF EXISTS \`${name}\``);
    }
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const schemaPath = path.join(__dirname, 'railway-schema.sql');
  const rawSql = fs.readFileSync(schemaPath, 'utf8');
  const sql = rawSql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '');
  const statements = sql
    .split(/;\s*\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean);

  console.log('Bootstrapping database schema and seed data...');
  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log('Database bootstrap complete.');
}

module.exports = { bootstrapDatabase };
