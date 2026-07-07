const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { verifyPassword } = require('../utils/helpers');
const { mapUser, mapProfile, mapPreferences } = require('../utils/mappers');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
}

router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      displayName,
      dateOfBirth,
      gender,
      interestedIn,
      profileInput = {},
    } = req.body;

    if (!email || !password || !displayName || !dateOfBirth || !gender || !interestedIn?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const userId = uuidv4();
    const profileId = uuidv4();
    const prefId = uuidv4();
    const photoId = uuidv4();
    const subId = uuidv4();
    const hash = await bcrypt.hash(password, 10);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO users (id, email, phone, password_hash, is_verified)
         VALUES (?, ?, ?, ?, FALSE)`,
        [userId, email, profileInput.phone || null, hash],
      );

      await conn.query(
        `INSERT INTO profiles (
          id, user_id, display_name, bio, date_of_birth, gender, interested_in,
          height_cm, job_title, education, city, country, relationship_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          userId,
          displayName,
          profileInput.bio || null,
          dateOfBirth,
          gender,
          JSON.stringify(interestedIn),
          profileInput.heightCm || null,
          profileInput.jobTitle || null,
          profileInput.education || null,
          profileInput.city || null,
          profileInput.country || null,
          profileInput.relationshipType || null,
        ],
      );

      await conn.query(
        `INSERT INTO preferences (id, user_id, show_me) VALUES (?, ?, ?)`,
        [prefId, userId, JSON.stringify(interestedIn)],
      );

      await conn.query(
        `INSERT INTO photos (id, user_id, url, sort_order, is_approved)
         VALUES (?, ?, ?, 0, TRUE)`,
        [photoId, userId, `https://picsum.photos/seed/${userId}/600/800`],
      );

      await conn.query(
        `INSERT INTO subscriptions (id, user_id, plan, is_active) VALUES (?, ?, 'free', TRUE)`,
        [subId, userId],
      );

      if (profileInput.interestIds?.length) {
        for (const interestId of profileInput.interestIds) {
          await conn.query(
            'INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)',
            [userId, interestId],
          );
        }
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const token = signToken(userId);
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    res.status(201).json({ token, user: mapUser(users[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = ?', [user.id]);
    const token = signToken(user.id);
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    const [profiles] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    const [prefs] = await pool.query('SELECT * FROM preferences WHERE user_id = ?', [userId]);

    res.json({
      user: mapUser(users[0]),
      profile: mapProfile(profiles[0]),
      preferences: mapPreferences(prefs[0]),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

module.exports = router;
