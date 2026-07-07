const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { mapProfile, mapMatch, mapMessage } = require('../utils/mappers');
const { orderedPair } = require('../utils/helpers');
const { resolveBaseUrl } = require('../utils/baseUrl');
const { setTyping, isUserTyping } = require('../utils/chatRealtime');

const router = express.Router();

function resolvePhotoUrl(baseUrl, userId, rawUrl) {
  if (!rawUrl) return `https://picsum.photos/seed/${userId}/600/800`;
  if (rawUrl.startsWith('http')) return rawUrl;
  return `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}

async function buildOtherUserSummary(meId, otherId, matchRow, isMutual) {
  const baseUrl = resolveBaseUrl();
  const [[profile]] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [otherId]);
  const [[photo]] = await pool.query(
    'SELECT url FROM photos WHERE user_id = ? ORDER BY sort_order ASC LIMIT 1',
    [otherId],
  );

  let last = null;
  let unread = { c: 0 };
  if (isMutual && matchRow.id && !String(matchRow.id).startsWith('pending-')) {
    const [msgs] = await pool.query(
      'SELECT * FROM messages WHERE match_id = ? ORDER BY sent_at DESC LIMIT 1',
      [matchRow.id],
    );
    last = msgs[0];
    [[unread]] = await pool.query(
      `SELECT COUNT(*) AS c FROM messages
       WHERE match_id = ? AND sender_id != ? AND is_read = FALSE`,
      [matchRow.id, meId],
    );
  }

  const [[otherUser]] = await pool.query(
    'SELECT last_active_at FROM users WHERE id = ?',
    [otherId],
  );

  const photoUrl = resolvePhotoUrl(baseUrl, otherId, photo?.url);

  return {
    match: mapMatch(matchRow),
    otherProfile: mapProfile(profile),
    primaryPhotoUrl: photoUrl,
    lastMessage: isMutual ? (last?.content || null) : 'You liked them',
    lastMessageAt: isMutual ? (last?.sent_at || null) : matchRow.matched_at,
    unreadCount: isMutual ? (unread?.c || 0) : 0,
    otherLastActiveAt: otherUser?.last_active_at || null,
    isMutual,
  };
}

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

async function assertMatchMember(matchId, userId) {
  if (String(matchId).startsWith('pending-')) {
    return null;
  }
  const [rows] = await pool.query(
    `SELECT * FROM matches
     WHERE id = ? AND is_active = TRUE AND (user1_id = ? OR user2_id = ?)`,
    [matchId, userId, userId],
  );
  return rows[0] || null;
}

router.get('/', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const [matches] = await pool.query(
      `SELECT * FROM matches
       WHERE is_active = TRUE AND (user1_id = ? OR user2_id = ?)`,
      [meId, meId],
    );

    const summaries = [];
    const matchedOtherIds = new Set();

    for (const m of matches) {
      const otherId = m.user1_id === meId ? m.user2_id : m.user1_id;
      matchedOtherIds.add(otherId);
      summaries.push(await buildOtherUserSummary(meId, otherId, m, true));
    }

    summaries.sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || a.match.matchedAt);
      const bTime = new Date(b.lastMessageAt || b.match.matchedAt);
      return bTime - aTime;
    });

    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load matches' });
  }
});

router.get('/:matchId/live', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const { matchId } = req.params;
    const match = await assertMatchMember(matchId, meId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const otherId = match.user1_id === meId ? match.user2_id : match.user1_id;
    const after = req.query.after;

    let rows = [];
    if (after) {
      [rows] = await pool.query(
        'SELECT * FROM messages WHERE match_id = ? AND sent_at > ? ORDER BY sent_at ASC',
        [matchId, after],
      );
      if (rows.length > 0) {
        await pool.query(
          `UPDATE messages SET is_read = TRUE
           WHERE match_id = ? AND sender_id != ? AND is_read = FALSE`,
          [matchId, meId],
        );
      }
    }

    res.json({
      messages: rows.map(mapMessage),
      otherUserTyping: isUserTyping(matchId, otherId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load live chat update' });
  }
});

router.post('/:matchId/typing', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const { matchId } = req.params;
    const match = await assertMatchMember(matchId, meId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    setTyping(matchId, meId, !!req.body.isTyping);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update typing state' });
  }
});

router.get('/:matchId/messages', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const { matchId } = req.params;
    const match = await assertMatchMember(matchId, meId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const [rows] = await pool.query(
      'SELECT * FROM messages WHERE match_id = ? ORDER BY sent_at ASC',
      [matchId],
    );
    res.json(rows.map(mapMessage));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

router.post('/:matchId/messages', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const { matchId } = req.params;
    const { content } = req.body;

    const match = await assertMatchMember(matchId, meId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const text = (content || '').trim();
    if (!text) return res.status(400).json({ error: 'Message content required' });

    setTyping(matchId, meId, false);

    const id = uuidv4();
    await pool.query(
      'INSERT INTO messages (id, match_id, sender_id, content) VALUES (?, ?, ?, ?)',
      [id, matchId, meId, text],
    );

    const [[msg]] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    res.status(201).json(mapMessage(msg));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/:matchId/read', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const { matchId } = req.params;
    const match = await assertMatchMember(matchId, meId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    await pool.query(
      `UPDATE messages SET is_read = TRUE
       WHERE match_id = ? AND sender_id != ? AND is_read = FALSE`,
      [matchId, meId],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark messages read' });
  }
});

module.exports = router;
