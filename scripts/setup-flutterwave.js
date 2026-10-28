/**
 * Save Flutterwave OAuth credentials to backend/.env
 * Usage: node scripts/setup-flutterwave.js <CLIENT_ID> <CLIENT_SECRET>
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const clientId = process.argv[2] || process.env.FLUTTERWAVE_CLIENT_ID;
const clientSecret = process.argv[3] || process.env.FLUTTERWAVE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/setup-flutterwave.js <CLIENT_ID> <CLIENT_SECRET>');
  console.error('Get credentials from https://dashboard.flutterwave.com → Settings → API keys');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');
let content = fs.readFileSync(envPath, 'utf8');

function upsert(key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    content += `\n${line}`;
  }
}

upsert('FLUTTERWAVE_CLIENT_ID', clientId);
upsert('FLUTTERWAVE_CLIENT_SECRET', clientSecret);
upsert('FLUTTERWAVE_SANDBOX', 'true');
upsert('FLUTTERWAVE_CURRENCY', 'UGX');
upsert('MOBILE_MONEY_SIMULATE', 'false');

fs.writeFileSync(envPath, content);

console.log('Saved Flutterwave credentials to backend/.env');
console.log('MOBILE_MONEY_SIMULATE=false (real popups enabled)');
console.log('\nNext: npm run flutterwave:test && npm start');
