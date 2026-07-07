const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { haversineKm, calculateAge, orderedPair } = require('../utils/helpers');
const { mapProfile, mapMatch, parseJsonArray } = require('../utils/mappers');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;

    const [[myProfile]] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [meId]);
    const [[prefs]] = await pool.query('SELECT * FROM preferences WHERE user_id = ?', [meId]);
    if (!myProfile || !prefs) return res.json([]);

    const showMe = parseJsonArray(prefs.show_me);

    const [swiped] = await pool.query(
      'SELECT swiped_id FROM swipes WHERE swiper_id = ?',
      [meId],
    );
    const swipedIds = new Set(swiped.map((r) => r.swiped_id));

    const [blocks] = await pool.query(
      `SELECT blocker_id, blocked_id FROM blocks
       WHERE blocker_id = ? OR blocked_id = ?`,
      [meId, meId],
    );
    const blockedIds = new Set();
    for (const b of blocks) {
      blockedIds.add(b.blocker_id === meId ? b.blocked_id : b.blocker_id);
    }

    const [profiles] = await pool.query(
      `SELECT p.*, ph.url AS primary_photo_url
       FROM profiles p
       JOIN photos ph ON ph.user_id = p.user_id AND ph.sort_order = 0
       WHERE p.user_id != ? AND p.is_visible = TRUE`,
      [meId],
    );

    const results = [];

    for (const row of profiles) {
      if (!showMe.includes(row.gender)) continue;
      if (swipedIds.has(row.user_id)) continue;
      if (blockedIds.has(row.user_id)) continue;

      const age = calculateAge(row.date_of_birth);
      if (age < prefs.min_age || age > prefs.max_age) continue;

      let distanceKm = null;
      if (
        myProfile.latitude != null &&
        myProfile.longitude != null &&
        row.latitude != null &&
        row.longitude != null
      ) {
        distanceKm = haversineKm(
          Number(myProfile.latitude),
          Number(myProfile.longitude),
          Number(row.latitude),
          Number(row.longitude),
        );
        if (distanceKm > prefs.max_distance_km) continue;
      }

      const [interestRows] = await pool.query(
        `SELECT i.name FROM user_interests ui
         JOIN interests i ON i.id = ui.interest_id
         WHERE ui.user_id = ?`,
        [row.user_id],
      );

      results.push({
        profile: mapProfile(row),
        primaryPhotoUrl: row.primary_photo_url,
        distanceKm,
        interests: interestRows.map((i) => i.name),
      });
    }

    results.sort((a, b) => new Date(b.profile.updatedAt) - new Date(a.profile.updatedAt));
    res.json(results.slice(0, 20));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load discover profiles' });
  }
});

router.post('/swipe', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const { swipedUserId, action } = req.body;

    if (!swipedUserId || !action) {
      return res.status(400).json({ error: 'swipedUserId and action required' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM swipes WHERE swiper_id = ? AND swiped_id = ?',
      [meId, swipedUserId],
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Already swiped on this user' });
    }

    await pool.query(
      'INSERT INTO swipes (id, swiper_id, swiped_id, action) VALUES (?, ?, ?, ?)',
      [uuidv4(), meId, swipedUserId, action],
    );

    if (action === 'pass') {
      return res.json({ isMatch: false, match: null });
    }

    const [reciprocal] = await pool.query(
      `SELECT id FROM swipes
       WHERE swiper_id = ? AND swiped_id = ? AND action IN ('like', 'super_like')`,
      [swipedUserId, meId],
    );

    if (!reciprocal.length) {
      return res.json({ isMatch: false, match: null });
    }

    const [u1, u2] = orderedPair(meId, swipedUserId);
    const [matches] = await pool.query(
      'SELECT * FROM matches WHERE user1_id = ? AND user2_id = ?',
      [u1, u2],
    );

    if (matches.length) {
      return res.json({ isMatch: true, match: mapMatch(matches[0]) });
    }

    const matchId = uuidv4();
    await pool.query(
      'INSERT INTO matches (id, user1_id, user2_id) VALUES (?, ?, ?)',
      [matchId, u1, u2],
    );

    const [newMatch] = await pool.query('SELECT * FROM matches WHERE id = ?', [matchId]);
    res.json({ isMatch: true, match: mapMatch(newMatch[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Swipe failed' });
  }
});

module.exports = router;
