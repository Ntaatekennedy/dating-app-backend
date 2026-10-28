/**
 * Create MTN MoMo sandbox API user + key (Collections product).
 *
 * Prerequisites:
 *   1. Sign up at https://momodeveloper.mtn.com
 *   2. Subscribe to Collections product → copy Primary Key
 *   3. Set MTN_MOMO_SUBSCRIPTION_KEY in .env
 *
 * Usage:
 *   node scripts/setup-mtn-momo-sandbox.js
 */
require('dotenv').config();

const crypto = require('crypto');

const subscriptionKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY || '';
const baseUrl = (process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com').replace(
  /\/$/,
  '',
);

async function main() {
  if (!subscriptionKey) {
    console.error('Set MTN_MOMO_SUBSCRIPTION_KEY in .env first.');
    console.error('Get it from momodeveloper.mtn.com → Products → Collections → Primary Key');
    process.exit(1);
  }

  const apiUser = crypto.randomUUID();
  const callbackHost = process.env.MTN_MOMO_CALLBACK_HOST || 'spark-dating.local';

  console.log('Creating MTN MoMo sandbox API user...');
  const createUser = await fetch(`${baseUrl}/v1_0/apiuser`, {
    method: 'POST',
    headers: {
      'X-Reference-Id': apiUser,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providerCallbackHost: callbackHost }),
  });

  if (createUser.status !== 201 && createUser.status !== 409) {
    const details = await createUser.text();
    console.error('Failed to create API user:', createUser.status, details);
    process.exit(1);
  }

  const createKey = await fetch(`${baseUrl}/v1_0/apiuser/${apiUser}/apikey`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });

  if (!createKey.ok) {
    const details = await createKey.text();
    console.error('Failed to create API key:', details);
    process.exit(1);
  }

  const payload = await createKey.json();
  const apiKey = payload.apiKey;
  if (!apiKey) {
    console.error('No apiKey in response:', payload);
    process.exit(1);
  }

  console.log('\nAdd these to backend/.env:\n');
  console.log(`MTN_MOMO_ENV=sandbox`);
  console.log(`MTN_MOMO_SUBSCRIPTION_KEY=${subscriptionKey}`);
  console.log(`MTN_MOMO_API_USER=${apiUser}`);
  console.log(`MTN_MOMO_API_KEY=${apiKey}`);
  console.log(`MTN_MOMO_TARGET_ENV=sandbox`);
  console.log(`MTN_MOMO_CURRENCY=EUR`);
  console.log(`MTN_MOMO_USE_PREAPPROVAL=false`);
  console.log(`MOBILE_MONEY_PROVIDER=mtn`);
  console.log(`MOBILE_MONEY_SIMULATE=false`);
  console.log('\nMTN_MOMO_USE_PREAPPROVAL=false sends a direct payment popup (RequestToPay).');
  console.log('Set MTN_MOMO_USE_PREAPPROVAL=true for recurring pre-approval mandates instead.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
