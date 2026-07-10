const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { mapProfile, mapSubscription } = require('../utils/mappers');
const { planDurationDays, maskPhone } = require('../utils/helpers');
const { planPriceUgx, planLabel, sendPaymentPromptSms } = require('../utils/mobileMoney');

const router = express.Router();

const subscriptionsEnabled = process.env.SUBSCRIPTIONS_ENABLED === 'true';

async function getActiveSubscription(userId) {
  const [rows] = await pool.query(
    `SELECT * FROM subscriptions
     WHERE user_id = ? AND is_active = TRUE AND plan != 'free'
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY expires_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

router.get('/status', authRequired, async (req, res) => {
  try {
    const sub = await getActiveSubscription(req.user.userId);
    res.json({
      hasChatAccess: !subscriptionsEnabled || !!sub,
      activeSubscription: sub ? mapSubscription(sub) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load subscription status' });
  }
});

router.post('/mobile-money/prompt', authRequired, async (req, res) => {
  try {
    const { plan, paymentPhone } = req.body;

    if (!plan || plan === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const result = await sendPaymentPromptSms(paymentPhone, plan);
    const amountUgx = planPriceUgx(plan);

    res.json({
      sent: result.delivered,
      channel: result.channel,
      phone: result.phone,
      maskedPhone: maskPhone(result.phone),
      amountUgx,
      planLabel: planLabel(plan),
      message: result.delivered
        ? 'A mobile money popup was sent to this phone. Enter your PIN to approve.'
        : 'Check this phone for the mobile money payment popup and enter your PIN to approve.',
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to send mobile money prompt' });
  }
});

router.post('/purchase', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { plan, paymentPhone, paymentMethod } = req.body;

    if (!plan || plan === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const method = paymentMethod === 'paypal'
      ? 'paypal'
      : paymentMethod === 'card'
        ? 'card'
        : 'phone';
    let storedPayment;

    if (method === 'paypal') {
      storedPayment = 'PayPal';
    } else if (method === 'card') {
      const cardRef = (paymentPhone || '').trim();
      if (!cardRef) {
        return res.status(400).json({ error: 'Enter valid card details' });
      }
      storedPayment = cardRef;
    } else {
      const phone = (paymentPhone || '').trim();
      if (!phone) {
        return res.status(400).json({ error: 'Enter a phone number to pay with' });
      }
      storedPayment = phone;
    }

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
      [id, userId, plan, days, storedPayment],
    );

    const [[row]] = await pool.query('SELECT * FROM subscriptions WHERE id = ?', [id]);
    res.status(201).json(mapSubscription(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Purchase failed' });
  }
});

module.exports = router;
