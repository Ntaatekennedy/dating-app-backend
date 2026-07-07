require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

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
    const [result] = await pool.query(statement);
    const info = result?.affectedRows != null ? ` (${result.affectedRows} rows)` : '';
    console.log(`OK:${info} ${statement.slice(0, 80)}...`);
  }
}

async function main() {
  const root = path.join(__dirname, 'migrations');
  const files = [
    path.join(root, 'seed_more_users.sql'),
    path.join(root, 'update_show_me_all_genders.sql'),
  ];

  for (const file of files) {
    console.log(`\nApplying ${path.basename(file)}...`);
    await runSqlFile(file);
  }

  const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM users');
  console.log(`\nDone. users table count: ${c}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
