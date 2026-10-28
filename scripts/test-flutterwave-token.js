/**
 * Verify Flutterwave OAuth credentials from backend/.env
 * Usage: npm run flutterwave:test
 */
require('dotenv').config();

const { ensureTokenIsValid, isFlutterwaveConfigured } = require('../src/utils/flutterwave');

async function main() {
  if (!isFlutterwaveConfigured()) {
    console.error(
      'Missing credentials. Set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET in backend/.env',
    );
    process.exit(1);
  }

  try {
    const token = await ensureTokenIsValid();
    console.log('Flutterwave OAuth OK');
    console.log('Token prefix:', `${token.slice(0, 12)}...`);
    console.log('Sandbox:', process.env.FLUTTERWAVE_SANDBOX === 'true' ? 'yes' : 'no');
  } catch (err) {
    console.error('Flutterwave OAuth failed:', err.message);
    process.exit(1);
  }
}

main();
