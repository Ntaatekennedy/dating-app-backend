require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const pool = require('../src/config/db');
const { verifyPesapalPayment } = require('../src/utils/pesapal');
const { planDurationDays } = require('../src/utils/helpers');

const orderTrackingId = process.argv[2];
const userIdPrefix = process.argv[3] || 'e6ab56a4';
const plan = process.argv[4] || 'daily';
const paymentPhone = process.argv[5] || '+256759306890';

async function main() {
  if (!orderTrackingId) {
    console.error('Usage: node scripts/grant-pesapal-subscription.js <orderTrackingId> [userIdPrefix] [plan] [phone]');
    process.exit(1);
  }

  const result = await verifyPesapalPayment(orderTrackingId);
  console.log('PesaPal status:', result.status, 'approved:', result.approved);
  if (!result.approved) {
    console.error('Payment is not completed yet.');
    process.exit(1);
  }

  const [users] = await pool.query('SELECT id FROM users WHERE id LIKE ? LIMIT 1', [`${userIdPrefix}%`]);
  if (!users.length) {
    console.error('No user found with id prefix:', userIdPrefix);
    process.exit(1);
  }

  const userId = users[0].id;
  await pool.query(
    `UPDATE subscriptions SET is_active = FALSE
     WHERE user_id = ? AND plan != 'free' AND is_active = TRUE`,
    [userId],
  );

  const days = planDurationDays(plan);
  const id = uuidv4();
  await pool.query(
    `INSERT INTO subscriptions (id, user_id, plan, starts_at, expires_at, is_active, payment_phone)
     VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), TRUE, ?)`,
    [id, userId, plan, days, paymentPhone],
  );

  console.log('Subscription activated for user', userId, 'plan', plan, 'id', id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
