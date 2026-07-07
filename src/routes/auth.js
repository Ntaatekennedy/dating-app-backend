const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { verifyPassword } = require('../utils/helpers');
const { mapUser, mapProfile, mapPreferences } = require('../utils/mappers');
const { normalizePhone, generateOtpCode, sendOtpSms } = require('../utils/otp');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5);
const PHONE_VERIFY_TTL = '15m';

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function signPhoneVerificationToken(phone) {
  return jwt.sign({ phone, type: 'phone_verify' }, JWT_SECRET, { expiresIn: PHONE_VERIFY_TTL });
}

function verifyPhoneVerificationToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.type !== 'phone_verify' || !payload.phone) {
    throw new Error('Invalid verification token');
  }
  return payload.phone;
}

async function createOtp(phone, purpose) {
  const code = generateOtpCode();
  const id = uuidv4();
  await pool.query('DELETE FROM phone_otps WHERE phone = ? AND purpose = ?', [phone, purpose]);
  await pool.query(
    `INSERT INTO phone_otps (id, phone, code, purpose, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [id, phone, code, purpose, OTP_TTL_MINUTES],
  );
  await sendOtpSms(phone, code);
  return code;
}

async function consumeOtp(phone, code, purpose) {
  const [rows] = await pool.query(
    `SELECT * FROM phone_otps
     WHERE phone = ? AND purpose = ? AND code = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose, code],
  );
  if (!rows.length) return false;
  await pool.query('UPDATE phone_otps SET used_at = NOW() WHERE id = ?', [rows[0].id]);
  return true;
}

router.post('/send-otp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const purpose = req.body.purpose;

    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid phone number with country code' });
    }
    if (!['login', 'register'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid OTP purpose' });
    }

    const [users] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    const exists = users.length > 0;

    if (purpose === 'login' && !exists) {
      return res.status(404).json({ error: 'No account found for this phone number' });
    }
    if (purpose === 'register' && exists) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const code = await createOtp(phone, purpose);
    const response = {
      message: 'Verification code sent',
      expiresInMinutes: OTP_TTL_MINUTES,
    };

    const smsProvider = process.env.SMS_PROVIDER || 'console';
    if (smsProvider === 'console' || process.env.EXPOSE_OTP === 'true') {
      response.debugCode = code;
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

router.post('/verify-otp-login', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const { code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and verification code required' });
    }

    const valid = await consumeOtp(phone, String(code).trim(), 'login');
    if (!valid) {
      return res.status(401).json({ error: 'Invalid or expired verification code' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!rows.length) {
      return res.status(404).json({ error: 'No account found for this phone number' });
    }

    const user = rows[0];
    await pool.query(
      'UPDATE users SET is_verified = TRUE, last_active_at = NOW() WHERE id = ?',
      [user.id],
    );

    const token = signToken(user.id);
    res.json({ token, user: mapUser({ ...user, is_verified: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/verify-otp-register', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const { code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and verification code required' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const valid = await consumeOtp(phone, String(code).trim(), 'register');
    if (!valid) {
      return res.status(401).json({ error: 'Invalid or expired verification code' });
    }

    const phoneVerificationToken = signPhoneVerificationToken(phone);
    res.json({ phoneVerificationToken, phone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const {
      phoneVerificationToken,
      displayName,
      dateOfBirth,
      gender,
      interestedIn,
      profileInput = {},
    } = req.body;

    if (!phoneVerificationToken || !displayName || !dateOfBirth || !gender || !interestedIn?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let phone;
    try {
      phone = verifyPhoneVerificationToken(phoneVerificationToken);
    } catch {
      return res.status(401).json({ error: 'Phone verification expired. Please verify again.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const userId = uuidv4();
    const profileId = uuidv4();
    const prefId = uuidv4();
    const photoId = uuidv4();
    const subId = uuidv4();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO users (id, email, phone, password_hash, is_verified)
         VALUES (?, NULL, ?, NULL, TRUE)`,
        [userId, phone],
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
