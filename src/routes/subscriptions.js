const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { mapProfile, mapSubscription } = require('../utils/mappers');
const { planDurationDays } = require('../utils/helpers');

const router = express.Router();

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
      hasChatAccess: !!sub,
      activeSubscription: sub ? mapSubscription(sub) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load subscription status' });
  }
});

router.post('/purchase', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { plan, paymentPhone } = req.body;

    if (!plan || plan === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const phone = (paymentPhone || '').trim();
    if (!phone) {
      return res.status(400).json({ error: 'Enter a phone number to pay with' });
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
      [id, userId, plan, days, phone],
    );

    const [[row]] = await pool.query('SELECT * FROM subscriptions WHERE id = ?', [id]);
    res.status(201).json(mapSubscription(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Purchase failed' });
  }
});

module.exports = router;
