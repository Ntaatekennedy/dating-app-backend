const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { verifyPassword } = require('../utils/helpers');
const { mapUser, mapProfile, mapPreferences } = require('../utils/mappers');
const { normalizePhone, generateOtpCode, sendOtpSms } = require('../utils/otp');
const { sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5);

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

async function createLoginOtp(phone) {
  const code = generateOtpCode();
  const id = uuidv4();
  await pool.query("DELETE FROM phone_otps WHERE phone = ? AND purpose = 'login'", [phone]);
  await pool.query(
    `INSERT INTO phone_otps (id, phone, code, purpose, expires_at)
     VALUES (?, ?, ?, 'login', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [id, phone, code, OTP_TTL_MINUTES],
  );
  const delivery = await sendOtpSms(phone, code);
  return { code, delivery };
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
    const purpose = req.body.purpose || 'login';

    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid phone number with country code' });
    }
    if (purpose !== 'login') {
      return res.status(400).json({ error: 'OTP is only used for sign in' });
    }

    const [users] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (!users.length) {
      return res.status(404).json({ error: 'No account found for this phone number' });
    }

    const { code, delivery } = await createLoginOtp(phone);
    const response = {
      message: delivery.delivered
        ? 'Verification code sent to your phone'
        : 'Verification code generated',
      expiresInMinutes: OTP_TTL_MINUTES,
      smsDelivered: delivery.delivered,
    };
    if (!delivery.delivered) {
      if (process.env.EXPOSE_OTP === 'true') {
        response.debugCode = code;
      }
    }
    res.json(response);
  } catch (err) {
    console.error(err);
    if (err.message === 'Failed to deliver verification code') {
      return res.status(502).json({ error: 'Could not send verification code to this number' });
    }
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
        [prefId, userId, JSON.stringify(['male', 'female', 'non_binary'])],
      );

      await conn.query(
        `INSERT INTO subscriptions (id, user_id, plan, is_active) VALUES (?, ?, 'free', TRUE)`,
        [subId, userId],
      );

      if (profileInput.interestIds?.length) {
        const ids = profileInput.interestIds.filter((id) => Number.isInteger(id));
        if (ids.length) {
          const placeholders = ids.map(() => '?').join(',');
          const [validRows] = await conn.query(
            `SELECT id FROM interests WHERE id IN (${placeholders})`,
            ids,
          );
          for (const row of validRows) {
            await conn.query(
              'INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)',
              [userId, row.id],
            );
          }
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
    console.error('Registration failed:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.json({
        message: 'If an account exists for this email, a reset code has been sent',
      });
    }

    const code = generateOtpCode();
    const id = uuidv4();
    await pool.query('DELETE FROM password_reset_codes WHERE email = ?', [email]);
    await pool.query(
      `INSERT INTO password_reset_codes (id, email, code, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [id, email, code, OTP_TTL_MINUTES],
    );

    let delivery;
    try {
      delivery = await sendPasswordResetEmail(email, code);
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: 'Could not send reset code to this email address' });
    }

    if (!delivery.delivered && process.env.EXPOSE_OTP !== 'true') {
      return res.status(502).json({ error: 'Could not send reset code to this email address' });
    }

    const response = {
      message: delivery.delivered
        ? 'Reset code sent to your email'
        : 'If an account exists for this email, a reset code has been sent',
      expiresInMinutes: OTP_TTL_MINUTES,
      emailDelivered: delivery.delivered,
    };

    if (!delivery.delivered && process.env.EXPOSE_OTP === 'true') {
      response.debugCode = code;
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send reset code' });
  }
});

async function consumePasswordResetCode(email, code) {
  const [rows] = await pool.query(
    `SELECT * FROM password_reset_codes
     WHERE email = ? AND code = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code],
  );
  if (!rows.length) return false;
  await pool.query('UPDATE password_reset_codes SET used_at = NOW() WHERE id = ?', [rows[0].id]);
  return true;
}

router.post('/reset-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, reset code, and new password required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const valid = await consumePasswordResetCode(email, String(code).trim());
    if (!valid) {
      return res.status(401).json({ error: 'Invalid or expired reset code' });
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.status(404).json({ error: 'No account found for this email' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [hash, rows[0].id],
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
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

router.post('/ping', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = ?', [userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

router.post('/offline', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    await pool.query('UPDATE users SET last_active_at = NULL WHERE id = ?', [userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update activity' });
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
      profile: profiles.length ? mapProfile(profiles[0]) : null,
      preferences: prefs.length ? mapPreferences(prefs[0]) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

module.exports = router;
