/**
 * End-to-end Flutterwave mobile money test (sandbox).
 * Usage: npm run flutterwave:test-charge -- +256785015597 daily
 */
require('dotenv').config();

const {
  isFlutterwaveConfigured,
  ensureTokenIsValid,
  initiateFlutterwaveMobileMoneyCharge,
  verifyFlutterwaveCharge,
} = require('../src/utils/flutterwave');

async function main() {
  if (!isFlutterwaveConfigured()) {
    console.error('Missing FLUTTERWAVE_CLIENT_ID / FLUTTERWAVE_CLIENT_SECRET in backend/.env');
    console.error('Run: npm run flutterwave:setup -- <CLIENT_ID> <CLIENT_SECRET>');
    process.exit(1);
  }

  const phone = process.argv[2] || '+256785015597';
  const plan = process.argv[3] || 'daily';
  const amounts = { daily: 1200, weekly: 3500, monthly: 12000 };
  const amountUgx = amounts[plan] || 1200;

  console.log('1. OAuth token...');
  const token = await ensureTokenIsValid();
  console.log('   OK —', `${token.slice(0, 12)}...`);

  console.log(`2. Mobile money charge → ${phone} (${plan}, ${amountUgx} UGX)...`);
  const charge = await initiateFlutterwaveMobileMoneyCharge(phone, plan, amountUgx, {
    userId: 'test-user',
    customerEmail: 'test@spark-dating.local',
  });
  console.log('   chargeId:', charge.chargeId);
  console.log('   status:', charge.status);
  console.log('   network:', charge.network);
  console.log('   instruction:', charge.instruction);

  console.log('3. Verify charge status...');
  const verified = await verifyFlutterwaveCharge(charge.chargeId);
  console.log('   status:', verified.status);
  console.log('   approved:', verified.approved);

  if (!verified.approved) {
    console.log('\nCheck your phone for the MTN/Airtel popup and enter your PIN.');
    console.log('Then re-run verify or tap I\'ve approved in the app.');
  } else {
    console.log('\nPayment succeeded in Flutterwave sandbox.');
  }
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
