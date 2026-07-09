const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { mapProfile, mapPreferences, mapPhoto, mapInterest } = require('../utils/mappers');
const { resolveBaseUrl } = require('../utils/baseUrl');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname) || '.jpg'}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.put('/profile', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const p = req.body;

    await pool.query(
      `UPDATE profiles SET
        display_name = ?, bio = ?, date_of_birth = ?, gender = ?,
        interested_in = ?, height_cm = ?, job_title = ?, education = ?,
        latitude = ?, longitude = ?, city = ?, country = ?,
        relationship_type = ?, is_visible = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        p.displayName,
        p.bio,
        p.dateOfBirth,
        p.gender,
        JSON.stringify(p.interestedIn || []),
        p.heightCm,
        p.jobTitle,
        p.education,
        p.latitude,
        p.longitude,
        p.city,
        p.country,
        p.relationshipType,
        p.isVisible !== false,
        userId,
      ],
    );

    const [[row]] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    res.json(mapProfile(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.put('/preferences', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const p = req.body;

    await pool.query(
      `UPDATE preferences SET
        min_age = ?, max_age = ?, max_distance_km = ?, show_me = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [p.minAge, p.maxAge, p.maxDistanceKm, JSON.stringify(p.showMe || []), userId],
    );

    const [[row]] = await pool.query('SELECT * FROM preferences WHERE user_id = ?', [userId]);
    res.json(mapPreferences(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

router.get('/interests', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM interests ORDER BY name');
    res.json(rows.map(mapInterest));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load interests' });
  }
});

router.put('/interests', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { interestIds } = req.body;

    await pool.query('DELETE FROM user_interests WHERE user_id = ?', [userId]);
    for (const id of interestIds || []) {
      await pool.query('INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)', [
        userId,
        id,
      ]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update interests' });
  }
});

router.put('/phone', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { phone } = req.body;
    await pool.query('UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?', [
      phone || null,
      userId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update phone' });
  }
});

router.get('/photos/:userId', authRequired, async (req, res) => {
  try {
    const baseUrl = resolveBaseUrl();
    const [rows] = await pool.query(
      'SELECT * FROM photos WHERE user_id = ? ORDER BY sort_order ASC',
      [req.params.userId],
    );
    res.json(rows.map((r) => mapPhoto(r, baseUrl)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load photos' });
  }
});

router.post('/photo', authRequired, upload.single('photo'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const baseUrl = resolveBaseUrl();
    let url = req.body?.url;

    if (req.file) {
      url = `/uploads/${req.file.filename}`;
    }

    if (!url) {
      return res.status(400).json({ error: 'Photo file or url required' });
    }

    const [[existing]] = await pool.query(
      'SELECT * FROM photos WHERE user_id = ? AND sort_order = 0',
      [userId],
    );

    if (existing) {
      await pool.query('UPDATE photos SET url = ?, is_approved = TRUE WHERE id = ?', [
        url,
        existing.id,
      ]);
      const [[row]] = await pool.query('SELECT * FROM photos WHERE id = ?', [existing.id]);
      return res.json(mapPhoto(row, baseUrl));
    }

    const id = uuidv4();
    await pool.query(
      'INSERT INTO photos (id, user_id, url, sort_order, is_approved) VALUES (?, ?, ?, 0, TRUE)',
      [id, userId, url],
    );
    const [[row]] = await pool.query('SELECT * FROM photos WHERE id = ?', [id]);
    res.json(mapPhoto(row, baseUrl));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

const MAX_PHOTOS = 6;

async function renumberUserPhotos(userId) {
  const [rows] = await pool.query(
    'SELECT id FROM photos WHERE user_id = ? ORDER BY sort_order ASC',
    [userId],
  );
  for (let i = 0; i < rows.length; i++) {
    await pool.query('UPDATE photos SET sort_order = ? WHERE id = ?', [i, rows[i].id]);
  }
}

function deleteStoredPhotoFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const filePath = path.join(__dirname, '../..', url);
  fs.unlink(filePath, () => {});
}

router.post('/photos', authRequired, upload.single('photo'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const baseUrl = resolveBaseUrl();
    let url = req.body?.url;

    if (req.file) {
      url = `/uploads/${req.file.filename}`;
    }

    if (!url) {
      return res.status(400).json({ error: 'Photo file or url required' });
    }

    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS c FROM photos WHERE user_id = ?',
      [userId],
    );
    if (Number(countRow.c) >= MAX_PHOTOS) {
      return res.status(400).json({ error: `Maximum ${MAX_PHOTOS} photos allowed` });
    }

    const [[maxRow]] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM photos WHERE user_id = ?',
      [userId],
    );
    const sortOrder = Number(maxRow.max_order) + 1;

    const id = uuidv4();
    await pool.query(
      'INSERT INTO photos (id, user_id, url, sort_order, is_approved) VALUES (?, ?, ?, ?, TRUE)',
      [id, userId, url, sortOrder],
    );
    const [[row]] = await pool.query('SELECT * FROM photos WHERE id = ?', [id]);
    res.status(201).json(mapPhoto(row, baseUrl));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

router.delete('/account', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[user]] = await conn.query('SELECT email, phone FROM users WHERE id = ?', [userId]);
      if (!user) {
        await conn.rollback();
        return res.status(404).json({ error: 'Account not found' });
      }

      const [photos] = await conn.query('SELECT url FROM photos WHERE user_id = ?', [userId]);
      for (const photo of photos) {
        deleteStoredPhotoFile(photo.url);
      }

      await conn.query('DELETE FROM reports WHERE reporter_id = ? OR reported_id = ?', [
        userId,
        userId,
      ]);
      if (user.email) {
        await conn.query('DELETE FROM password_reset_codes WHERE email = ?', [user.email]);
      }
      if (user.phone) {
        await conn.query('DELETE FROM phone_otps WHERE phone = ?', [user.phone]);
      }

      await conn.query('DELETE FROM users WHERE id = ?', [userId]);
      await conn.commit();
      res.json({ message: 'Account deleted' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

router.delete('/photos/:photoId', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { photoId } = req.params;

    const [[photo]] = await pool.query(
      'SELECT * FROM photos WHERE id = ? AND user_id = ?',
      [photoId, userId],
    );
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS c FROM photos WHERE user_id = ?',
      [userId],
    );
    if (Number(countRow.c) <= 1) {
      await pool.query('DELETE FROM photos WHERE id = ?', [photoId]);
      deleteStoredPhotoFile(photo.url);
      return res.json({ ok: true });
    }

    await pool.query('DELETE FROM photos WHERE id = ?', [photoId]);
    await renumberUserPhotos(userId);
    deleteStoredPhotoFile(photo.url);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
