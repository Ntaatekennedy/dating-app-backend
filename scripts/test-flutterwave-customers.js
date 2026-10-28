/**
 * List Flutterwave sandbox customers (OAuth-authenticated).
 * Usage: npm run flutterwave:customers
 *
 * Equivalent to your fetch snippet, but with Bearer token from OAuth.
 */
require('dotenv').config();

const { isFlutterwaveConfigured, listFlutterwaveCustomers } = require('../src/utils/flutterwave');

async function main() {
  if (!isFlutterwaveConfigured()) {
    console.error('Set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET in backend/.env first.');
    console.error('Then: npm run flutterwave:setup -- <CLIENT_ID> <CLIENT_SECRET>');
    process.exit(1);
  }

  const page = Number(process.argv[2]) || 1;
  const size = Number(process.argv[3]) || 10;

  const payload = await listFlutterwaveCustomers(page, size);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
