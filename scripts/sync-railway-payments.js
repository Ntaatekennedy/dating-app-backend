/**
 * Sync PesaPal payment vars from backend/.env to Railway (api service).
 * Usage: node scripts/sync-railway-payments.js
 */
require('dotenv').config();
const { spawnSync } = require('child_process');

const productionBase = 'https://api-production-4f51.up.railway.app';

const vars = {
  BASE_URL: productionBase,
  PESAPAL_CONSUMER_KEY: process.env.PESAPAL_CONSUMER_KEY,
  PESAPAL_CONSUMER_SECRET: process.env.PESAPAL_CONSUMER_SECRET,
  PESAPAL_SANDBOX: process.env.PESAPAL_SANDBOX || 'false',
  PESAPAL_CURRENCY: process.env.PESAPAL_CURRENCY || 'UGX',
  PESAPAL_COUNTRY_CODE: process.env.PESAPAL_COUNTRY_CODE || 'UG',
  PESAPAL_IPN_ID: process.env.PESAPAL_IPN_ID,
  MOBILE_MONEY_PROVIDER: 'pesapal',
  MOBILE_MONEY_SIMULATE: 'false',
  SUBSCRIPTIONS_ENABLED: 'true',
};

function setVar(name, value) {
  if (!value) {
    console.warn(`Skipping ${name} - not set in .env`);
    return false;
  }
  console.log(`Setting ${name}...`);
  const result = spawnSync(
    'railway',
    ['variable', 'set', `${name}=${value}`, '--service', 'api'],
    { stdio: 'inherit', shell: true },
  );
  if (result.status !== 0) {
    console.error(`Failed to set ${name}`);
    process.exit(result.status || 1);
  }
  return true;
}

for (const [name, value] of Object.entries(vars)) {
  setVar(name, value);
}

console.log(`\nDone. Railway will redeploy. API: ${productionBase}`);
console.log('Install the latest APK and test mobile money subscription.');
