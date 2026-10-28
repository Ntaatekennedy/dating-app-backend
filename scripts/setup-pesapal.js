const fs = require('fs');
const path = require('path');

const key = process.argv[2];
const secret = process.argv[3];
if (!key || !secret) {
  console.error('Usage: node scripts/setup-pesapal.js <CONSUMER_KEY> <CONSUMER_SECRET>');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');
let content = fs.readFileSync(envPath, 'utf8');

function upsert(k, v) {
  const line = `${k}=${v}`;
  const pattern = new RegExp(`^${k}=.*$`, 'm');
  content = pattern.test(content) ? content.replace(pattern, line) : `${content}\n${line}`;
}

upsert('PESAPAL_CONSUMER_KEY', key);
upsert('PESAPAL_CONSUMER_SECRET', secret);
upsert('PESAPAL_SANDBOX', 'true');
upsert('PESAPAL_CURRENCY', 'UGX');
upsert('PESAPAL_COUNTRY_CODE', 'UG');
upsert('MOBILE_MONEY_SIMULATE', 'false');

fs.writeFileSync(envPath, content);
console.log('Saved PesaPal Uganda sandbox credentials to backend/.env');
console.log('Next: npm run pesapal:test && npm run pesapal:register-ipn');
