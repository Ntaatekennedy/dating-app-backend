const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { mapProfile } = require('../utils/mappers');
const { resolveBaseUrl } = require('../utils/baseUrl');
const { resolvePhotoUrl } = require('../utils/photoUrl');

const router = express.Router();

router.get('/received', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const baseUrl = resolveBaseUrl();

    const [matches] = await pool.query(
      `SELECT user1_id, user2_id FROM matches
       WHERE user1_id = ? OR user2_id = ?`,
      [meId, meId],
    );
    const matchedOtherIds = new Set(
      matches.map((m) => (m.user1_id === meId ? m.user2_id : m.user1_id)),
    );

    const [blocks] = await pool.query(
      `SELECT blocker_id, blocked_id FROM blocks
       WHERE blocker_id = ? OR blocked_id = ?`,
      [meId, meId],
    );
    const blockedIds = new Set();
    for (const b of blocks) {
      blockedIds.add(b.blocker_id === meId ? b.blocked_id : b.blocker_id);
    }

    let query = `
      SELECT s.swiper_id, s.action, s.created_at
      FROM swipes s
      WHERE s.swiped_id = ? AND s.action IN ('like', 'super_like')
    `;
    const params = [meId];

    const excludeIds = [...matchedOtherIds, ...blockedIds];
    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => '?').join(',');
      query += ` AND s.swiper_id NOT IN (${placeholders})`;
      params.push(...excludeIds);
    }

    query += ' ORDER BY s.created_at DESC';

    const [rows] = await pool.query(query, params);
    const summaries = [];

    for (const row of rows) {
      const otherId = row.swiper_id;
      const [[profile]] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [otherId]);
      if (!profile) continue;

      const [[photo]] = await pool.query(
        'SELECT url FROM photos WHERE user_id = ? ORDER BY sort_order ASC LIMIT 1',
        [otherId],
      );
      const [[otherUser]] = await pool.query(
        'SELECT last_active_at FROM users WHERE id = ?',
        [otherId],
      );

      summaries.push({
        profile: mapProfile(profile),
        primaryPhotoUrl: resolvePhotoUrl(baseUrl, photo?.url),
        likedAt: row.created_at,
        isSuperLike: row.action === 'super_like',
        otherLastActiveAt: otherUser?.last_active_at || null,
      });
    }

    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load received likes' });
  }
});

module.exports = router;
