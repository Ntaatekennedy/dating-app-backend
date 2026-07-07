const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { mapProfile, mapPhoto } = require('../utils/mappers');
const { maskPhone } = require('../utils/helpers');
const { resolveBaseUrl } = require('../utils/baseUrl');

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

router.get('/:userId/public', authRequired, async (req, res) => {
  try {
    const { userId } = req.params;
    const [[profile]] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const baseUrl = resolveBaseUrl();
    const [photos] = await pool.query(
      'SELECT * FROM photos WHERE user_id = ? ORDER BY sort_order ASC LIMIT 1',
      [userId],
    );
    const photo = photos[0]
      ? mapPhoto(photos[0], baseUrl)
      : { url: `https://picsum.photos/seed/${userId}/600/800` };

    const [interests] = await pool.query(
      `SELECT i.name FROM user_interests ui
       JOIN interests i ON i.id = ui.interest_id
       WHERE ui.user_id = ?`,
      [userId],
    );

    res.json({
      profile: mapProfile(profile),
      primaryPhotoUrl: photo.url,
      interests: interests.map((i) => i.name),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.get('/:userId/phone', authRequired, async (req, res) => {
  try {
    const requesterId = req.user.userId;
    const { userId } = req.params;
    const sub = await getActiveSubscription(requesterId);

    const [[user]] = await pool.query('SELECT phone FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.phone) {
      return res.json({ phone: null, masked: true });
    }

    if (!sub) {
      return res.json({ phone: maskPhone(user.phone), masked: true });
    }

    res.json({ phone: user.phone, masked: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load phone number' });
  }
});

router.post('/:userId/block', authRequired, async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const { userId } = req.params;

    const [existing] = await pool.query(
      'SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, userId],
    );
    if (existing.length) return res.json({ ok: true });

    await pool.query(
      'INSERT INTO blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)',
      [uuidv4(), blockerId, userId],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

router.post('/:userId/report', authRequired, async (req, res) => {
  try {
    const reporterId = req.user.userId;
    const { userId } = req.params;
    const { reason, details } = req.body;

    if (!reason) return res.status(400).json({ error: 'Reason required' });

    await pool.query(
      'INSERT INTO reports (id, reporter_id, reported_id, reason, details) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), reporterId, userId, reason, details || null],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

router.get('/:userId/interests', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.name FROM user_interests ui
       JOIN interests i ON i.id = ui.interest_id
       WHERE ui.user_id = ?`,
      [req.params.userId],
    );
    res.json(rows.map((r) => r.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load interests' });
  }
});

module.exports = router;
