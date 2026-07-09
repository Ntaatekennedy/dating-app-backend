const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { haversineKm, calculateAge, orderedPair } = require('../utils/helpers');
const { mapProfile, mapMatch, parseJsonArray } = require('../utils/mappers');
const { resolveBaseUrl } = require('../utils/baseUrl');

const router = express.Router();

function resolvePhotoUrl(baseUrl, userId, rawUrl) {
  if (!rawUrl) return `https://picsum.photos/seed/${userId}/600/800`;
  if (rawUrl.startsWith('http')) return rawUrl;
  return `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}

async function loadDiscoverCandidates(meId) {
  const [[myProfile]] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [meId]);
  const [[prefs]] = await pool.query('SELECT * FROM preferences WHERE user_id = ?', [meId]);
  if (!myProfile || !prefs) return { myProfile: null, prefs: null, rows: [] };

  const [profiles] = await pool.query(
    `SELECT p.*, ph.url AS primary_photo_url, u.last_active_at
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN photos ph ON ph.id = (
       SELECT id FROM photos
       WHERE user_id = p.user_id
       ORDER BY sort_order ASC
       LIMIT 1
     )
     WHERE p.user_id != ? AND p.is_visible = TRUE`,
    [meId],
  );

  return { myProfile, prefs, rows: profiles };
}

function discoverGendersForViewer(_viewerGender, prefsShowMe) {
  return prefsShowMe;
}

function canDiscoverProfile(myProfile, prefs, candidateRow) {
  const showMe = parseJsonArray(prefs.show_me);
  const allowedGenders = discoverGendersForViewer(myProfile.gender, showMe);
  if (!allowedGenders.includes(candidateRow.gender)) return false;
  const theirInterested = parseJsonArray(candidateRow.interested_in);
  return theirInterested.includes(myProfile.gender);
}

function buildDiscoverResults({ myProfile, prefs, rows, excludeSwipedIds, baseUrl }) {
  const showMe = parseJsonArray(prefs.show_me);
  const withinRange = [];
  const outsideRange = [];

  for (const row of rows) {
    if (!canDiscoverProfile(myProfile, prefs, row)) continue;
    if (excludeSwipedIds.has(row.user_id)) continue;

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
    }

    const entry = {
      profile: mapProfile(row),
      primaryPhotoUrl: resolvePhotoUrl(baseUrl, row.user_id, row.primary_photo_url),
      distanceKm,
      interests: [],
      lastActiveAt: row.last_active_at,
      _userId: row.user_id,
    };

    if (distanceKm != null && distanceKm > prefs.max_distance_km) {
      outsideRange.push(entry);
    } else {
      withinRange.push(entry);
    }
  }

  const poolResults = withinRange.length > 0 ? withinRange : outsideRange;
  poolResults.sort((a, b) => {
    const da = a.distanceKm ?? 99999;
    const db = b.distanceKm ?? 99999;
    if (da !== db) return da - db;
    return new Date(b.profile.updatedAt) - new Date(a.profile.updatedAt);
  });

  return poolResults;
}

async function getChattedPartnerIds(meId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END AS partner_id
     FROM matches m
     INNER JOIN messages msg ON msg.match_id = m.id
     WHERE m.is_active = TRUE AND (m.user1_id = ? OR m.user2_id = ?)`,
    [meId, meId, meId],
  );
  return new Set(rows.map((r) => r.partner_id));
}

async function getMatchedPartnerIds(meId) {
  const [rows] = await pool.query(
    `SELECT user1_id, user2_id FROM matches
     WHERE is_active = TRUE AND (user1_id = ? OR user2_id = ?)`,
    [meId, meId],
  );
  const ids = new Set();
  for (const row of rows) {
    ids.add(row.user1_id === meId ? row.user2_id : row.user1_id);
  }
  return ids;
}

async function userHasActiveMatch(meId, otherUserId) {
  const [u1, u2] = orderedPair(meId, otherUserId);
  const [rows] = await pool.query(
    'SELECT id FROM matches WHERE is_active = TRUE AND user1_id = ? AND user2_id = ?',
    [u1, u2],
  );
  return rows.length > 0;
}

router.get('/', authRequired, async (req, res) => {
  try {
    const meId = req.user.userId;
    const baseUrl = resolveBaseUrl();
    const { myProfile, prefs, rows } = await loadDiscoverCandidates(meId);
    if (!myProfile || !prefs) return res.json([]);

    const [swiped] = await pool.query(
      'SELECT swiped_id, action FROM swipes WHERE swiper_id = ?',
      [meId],
    );
    const allSwipedIds = new Set(swiped.map((r) => r.swiped_id));
    const likedSwipedIds = new Set(
      swiped
        .filter((r) => r.action === 'like' || r.action === 'super_like')
        .map((r) => r.swiped_id),
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

    const filteredRows = rows.filter((row) => !blockedIds.has(row.user_id));

    const excludeChatted = req.query.excludeChatted === 'true';

    if (excludeChatted) {
      const chattedIds = await getChattedPartnerIds(meId);
      const excludeIds = new Set([...allSwipedIds, ...chattedIds]);
      const results = buildDiscoverResults({
        myProfile,
        prefs,
        rows: filteredRows,
        excludeSwipedIds: excludeIds,
        baseUrl,
      });

      const userIds = results.map((r) => r._userId);
      const interestMap = new Map();
      if (userIds.length) {
        const placeholders = userIds.map(() => '?').join(',');
        const [interestRows] = await pool.query(
          `SELECT ui.user_id, i.name
           FROM user_interests ui
           JOIN interests i ON i.id = ui.interest_id
           WHERE ui.user_id IN (${placeholders})`,
          userIds,
        );
        for (const row of interestRows) {
          if (!interestMap.has(row.user_id)) interestMap.set(row.user_id, []);
          interestMap.get(row.user_id).push(row.name);
        }
      }

      const payload = results.slice(0, 20).map(({ _userId, ...rest }) => ({
        ...rest,
        interests: interestMap.get(_userId) || [],
      }));

      return res.json(payload);
    }

    let results = buildDiscoverResults({
      myProfile,
      prefs,
      rows: filteredRows,
      excludeSwipedIds: allSwipedIds,
      baseUrl,
    });

    // When the deck is empty, bring back profiles the user passed on.
    if (results.length === 0 && likedSwipedIds.size < allSwipedIds.size) {
      results = buildDiscoverResults({
        myProfile,
        prefs,
        rows: filteredRows,
        excludeSwipedIds: likedSwipedIds,
        baseUrl,
      });
    }

    // Still empty — show everyone again except current matches.
    if (results.length === 0) {
      const matchedIds = await getMatchedPartnerIds(meId);
      results = buildDiscoverResults({
        myProfile,
        prefs,
        rows: filteredRows,
        excludeSwipedIds: matchedIds,
        baseUrl,
      });
    }

    const userIds = results.map((r) => r._userId);
    const interestMap = new Map();
    if (userIds.length) {
      const placeholders = userIds.map(() => '?').join(',');
      const [interestRows] = await pool.query(
        `SELECT ui.user_id, i.name
         FROM user_interests ui
         JOIN interests i ON i.id = ui.interest_id
         WHERE ui.user_id IN (${placeholders})`,
        userIds,
      );
      for (const row of interestRows) {
        if (!interestMap.has(row.user_id)) interestMap.set(row.user_id, []);
        interestMap.get(row.user_id).push(row.name);
      }
    }

    const payload = results.slice(0, 20).map(({ _userId, ...rest }) => ({
      ...rest,
      interests: interestMap.get(_userId) || [],
    }));

    res.json(payload);
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
      'SELECT id, action FROM swipes WHERE swiper_id = ? AND swiped_id = ?',
      [meId, swipedUserId],
    );
    if (existing.length) {
      const alreadyMatched = await userHasActiveMatch(meId, swipedUserId);
      if (alreadyMatched) {
        const [u1, u2] = orderedPair(meId, swipedUserId);
        const [matches] = await pool.query(
          'SELECT * FROM matches WHERE user1_id = ? AND user2_id = ?',
          [u1, u2],
        );
        if (matches.length) {
          return res.json({ isMatch: true, match: mapMatch(matches[0]) });
        }
      }
      if (existing[0].action !== action) {
        await pool.query(
          'UPDATE swipes SET action = ? WHERE swiper_id = ? AND swiped_id = ?',
          [action, meId, swipedUserId],
        );
      } else {
        return res.status(409).json({ error: 'Already swiped on this user' });
      }
    } else {
      await pool.query(
        'INSERT INTO swipes (id, swiper_id, swiped_id, action) VALUES (?, ?, ?, ?)',
        [uuidv4(), meId, swipedUserId, action],
      );
    }

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
