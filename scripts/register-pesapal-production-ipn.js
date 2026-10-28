/**
 * Register PesaPal IPN for production Railway API.
 * Usage: node scripts/register-pesapal-production-ipn.js
 */
require('dotenv').config();

const { isPesapalConfigured, registerIpnUrl } = require('../src/utils/pesapal');

const productionBase = 'https://api-production-4f51.up.railway.app';

async function main() {
  if (!isPesapalConfigured()) {
    console.error('Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in backend/.env');
    process.exit(1);
  }

  process.env.BASE_URL = productionBase;
  const ipn = await registerIpnUrl(`${productionBase}/api/subscriptions/pesapal/ipn`);
  const ipnId = ipn.ipn_id || ipn.ipnId;
  if (!ipnId) {
    console.error('PesaPal did not return ipn_id:', ipn);
    process.exit(1);
  }

  console.log('\nProduction IPN registered.');
  console.log(`PESAPAL_IPN_ID=${ipnId}`);
  console.log(`IPN URL: ${productionBase}/api/subscriptions/pesapal/ipn`);
  console.log('\nAdd PESAPAL_IPN_ID to backend/.env and run: npm run railway:sync-payments');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
