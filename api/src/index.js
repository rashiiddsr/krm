import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');
await fs.mkdir(uploadsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname);
      cb(null, `${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('File harus berupa gambar.'));
      return;
    }
    cb(null, true);
  },
});

const buildWhereClause = (filters) => {
  const clauses = [];
  const values = [];

  filters.forEach((filter) => {
    if (filter.value === undefined || filter.value === null || filter.value === '') {
      return;
    }
    clauses.push(filter.clause);
    values.push(filter.value);
  });

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const { email, identifier, password } = req.body || {};
    const loginId = identifier || email;
    if (!loginId || !password) {
      res.status(400).json({ message: 'Email/username dan password wajib diisi.' });
      return;
    }

    const [rows] = await pool.query(
      `SELECT id, email, password_hash, full_name, username, no_hp, role, profile_photo_url, created_at, updated_at
       FROM users
       WHERE email = ? OR username = ?
       LIMIT 1`,
      [loginId, loginId]
    );

    const user = rows[0];
    if (!user) {
      res.status(401).json({ message: 'Email/username atau password salah.' });
      return;
    }

    let passwordMatch = false;
    if (user.password_hash?.startsWith('$2')) {
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    } else if (password === user.password_hash) {
      passwordMatch = true;
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
        passwordHash,
        user.id,
      ]);
    }
    if (!passwordMatch) {
      res.status(401).json({ message: 'Email/username atau password salah.' });
      return;
    }

    res.json({
      user: { id: user.id, email: user.email },
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        username: user.username,
        no_hp: user.no_hp,
        role: user.role,
        profile_photo_url: user.profile_photo_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/auth/logout', (req, res) => {
  res.status(204).end();
});

app.get('/profiles', async (req, res, next) => {
  try {
    const { role } = req.query;
    const { where, values } = buildWhereClause([{ clause: 'role = ?', value: role }]);
    const [rows] = await pool.query(
      `SELECT id, email, full_name, username, no_hp, role, profile_photo_url, created_at, updated_at FROM users ${where}`,
      values
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get('/profiles/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, username, no_hp, role, profile_photo_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (!rows[0]) {
      res.status(404).json({ message: 'User tidak ditemukan.' });
      return;
    }
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/profiles', async (req, res, next) => {
  try {
    const { full_name, email, username, no_hp, password, role } = req.body || {};
    if (!full_name || !email || !username || !no_hp || !password || !role) {
      res.status(400).json({ message: 'Data user belum lengkap.' });
      return;
    }

    const newProfile = await withTransaction(async (connection) => {
      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);

      await connection.query(
        `INSERT INTO users (id, email, full_name, username, no_hp, password_hash, role)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, email, full_name, username, no_hp, passwordHash, role]
      );

      const [rows] = await connection.query(
        'SELECT id, email, full_name, username, no_hp, role, profile_photo_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
        [userId]
      );

      return rows[0];
    });

    res.status(201).json(newProfile);
  } catch (error) {
    next(error);
  }
});

app.put('/profiles/:id', async (req, res, next) => {
  try {
    const { full_name, email, username, no_hp, role, password } = req.body || {};
    const updates = [];
    const values = [];

    if (full_name) {
      updates.push('full_name = ?');
      values.push(full_name);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (username) {
      updates.push('username = ?');
      values.push(username);
    }
    if (no_hp) {
      updates.push('no_hp = ?');
      values.push(no_hp);
    }
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }

    if (!updates.length && !password) {
      res.status(400).json({ message: 'Tidak ada data untuk diperbarui.' });
      return;
    }

    await withTransaction(async (connection) => {
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push('password_hash = ?');
        values.push(passwordHash);
      }
      if (updates.length) {
        await connection.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [
          ...values,
          req.params.id,
        ]);
      }
    });

    const [rows] = await pool.query(
      'SELECT id, email, full_name, username, no_hp, role, profile_photo_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [req.params.id]
    );

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/profiles/:id/photo', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'Foto profil wajib diunggah.' });
      return;
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE users SET profile_photo_url = ? WHERE id = ?', [
      photoUrl,
      req.params.id,
    ]);

    const [rows] = await pool.query(
      'SELECT id, email, full_name, username, no_hp, role, profile_photo_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [req.params.id]
    );

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/profiles/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/prospects', async (req, res, next) => {
  try {
    const { salesId, startDate, endDate } = req.query;
    const { where, values } = buildWhereClause([
      { clause: 'sales_id = ?', value: salesId },
      { clause: 'created_at >= ?', value: startDate },
      { clause: 'created_at <= ?', value: endDate },
    ]);
    const [rows] = await pool.query(`SELECT * FROM prospects ${where}`, values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get('/prospects/with-sales', async (req, res, next) => {
  try {
    const { salesId } = req.query;
    const { where, values } = buildWhereClause([{ clause: 'p.sales_id = ?', value: salesId }]);
    const [rows] = await pool.query(
      `SELECT p.*, u.id AS sales_profile_id, u.full_name AS sales_name, u.email AS sales_email,
              u.username AS sales_username, u.no_hp AS sales_no_hp, u.role AS sales_role
       FROM prospects p
       JOIN users u ON u.id = p.sales_id
       ${where}`,
      values
    );
    const mapped = rows.map((row) => ({
      ...row,
      sales: {
        id: row.sales_profile_id,
        full_name: row.sales_name,
        email: row.sales_email,
        username: row.sales_username,
        no_hp: row.sales_no_hp,
        role: row.sales_role,
      },
    }));
    res.json(mapped);
  } catch (error) {
    next(error);
  }
});

app.post('/prospects', async (req, res, next) => {
  try {
    const { nama, no_hp, alamat, kebutuhan, status, sales_id } = req.body || {};
    if (!nama || !no_hp || !alamat || !kebutuhan || !sales_id) {
      res.status(400).json({ message: 'Data prospek belum lengkap.' });
      return;
    }

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO prospects (id, nama, no_hp, alamat, kebutuhan, status, sales_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, nama, no_hp, alamat, kebutuhan, status || 'menunggu_follow_up', sales_id]
    );

    const [rows] = await pool.query('SELECT * FROM prospects WHERE id = ? LIMIT 1', [id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put('/prospects/:id', async (req, res, next) => {
  try {
    const fields = ['nama', 'no_hp', 'alamat', 'kebutuhan', 'status', 'sales_id'];
    const updates = [];
    const values = [];

    fields.forEach((field) => {
      if (req.body?.[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (!updates.length) {
      res.status(400).json({ message: 'Tidak ada data untuk diperbarui.' });
      return;
    }

    await pool.query(`UPDATE prospects SET ${updates.join(', ')} WHERE id = ?`, [
      ...values,
      req.params.id,
    ]);

    const [rows] = await pool.query('SELECT * FROM prospects WHERE id = ? LIMIT 1', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/follow-ups', async (req, res, next) => {
  try {
    const { assignedTo, startDate, endDate } = req.query;
    const { where, values } = buildWhereClause([
      { clause: 'f.assigned_to = ?', value: assignedTo },
      { clause: 'f.created_at >= ?', value: startDate },
      { clause: 'f.created_at <= ?', value: endDate },
    ]);

    const [rows] = await pool.query(
      `SELECT f.*, p.nama AS prospect_nama, p.no_hp AS prospect_no_hp, p.alamat AS prospect_alamat,
              p.kebutuhan AS prospect_kebutuhan, p.status AS prospect_status, p.sales_id AS prospect_sales_id,
              assigned_by.full_name AS assigned_by_name, assigned_by.email AS assigned_by_email,
              assigned_by.username AS assigned_by_username, assigned_by.no_hp AS assigned_by_no_hp,
              assigned_by.role AS assigned_by_role, assigned_to.full_name AS assigned_to_name,
              assigned_to.email AS assigned_to_email, assigned_to.username AS assigned_to_username,
              assigned_to.no_hp AS assigned_to_no_hp, assigned_to.role AS assigned_to_role
       FROM follow_ups f
       JOIN prospects p ON p.id = f.prospect_id
       JOIN users assigned_by ON assigned_by.id = f.assigned_by
       JOIN users assigned_to ON assigned_to.id = f.assigned_to
       ${where}`,
      values
    );

    const mapped = rows.map((row) => ({
      ...row,
      prospect: {
        id: row.prospect_id,
        nama: row.prospect_nama,
        no_hp: row.prospect_no_hp,
        alamat: row.prospect_alamat,
        kebutuhan: row.prospect_kebutuhan,
        status: row.prospect_status,
        sales_id: row.prospect_sales_id,
      },
      assignedByProfile: {
        id: row.assigned_by,
        full_name: row.assigned_by_name,
        email: row.assigned_by_email,
        username: row.assigned_by_username,
        no_hp: row.assigned_by_no_hp,
        role: row.assigned_by_role,
      },
      assignedToProfile: {
        id: row.assigned_to,
        full_name: row.assigned_to_name,
        email: row.assigned_to_email,
        username: row.assigned_to_username,
        no_hp: row.assigned_to_no_hp,
        role: row.assigned_to_role,
      },
    }));

    res.json(mapped);
  } catch (error) {
    next(error);
  }
});

app.post('/follow-ups', async (req, res, next) => {
  try {
    const { prospect_id, assigned_by, assigned_to, scheduled_date, status, notes } = req.body || {};
    if (!prospect_id || !assigned_by || !assigned_to || !scheduled_date) {
      res.status(400).json({ message: 'Data follow up belum lengkap.' });
      return;
    }

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO follow_ups (id, prospect_id, assigned_by, assigned_to, scheduled_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, prospect_id, assigned_by, assigned_to, scheduled_date, status || 'pending', notes || '']
    );

    const [rows] = await pool.query('SELECT * FROM follow_ups WHERE id = ? LIMIT 1', [id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put('/follow-ups/:id', async (req, res, next) => {
  try {
    const fields = ['status', 'notes', 'scheduled_date', 'completed_at', 'assigned_to'];
    const updates = [];
    const values = [];

    fields.forEach((field) => {
      if (req.body?.[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (!updates.length) {
      res.status(400).json({ message: 'Tidak ada data untuk diperbarui.' });
      return;
    }

    await pool.query(`UPDATE follow_ups SET ${updates.join(', ')} WHERE id = ?`, [
      ...values,
      req.params.id,
    ]);

    const [rows] = await pool.query('SELECT * FROM follow_ups WHERE id = ? LIMIT 1', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/notifications', async (req, res, next) => {
  try {
    const { userId, limit } = req.query;
    if (!userId) {
      res.status(400).json({ message: 'userId wajib diisi.' });
      return;
    }

    const limitValue = Number(limit || 20);
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limitValue]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post('/notifications', async (req, res, next) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    if (!payload.length) {
      res.status(400).json({ message: 'Payload notifikasi kosong.' });
      return;
    }

    const values = payload.map((item) => [
      crypto.randomUUID(),
      item.user_id,
      item.type,
      item.title,
      item.message,
      item.reference_id,
      item.reference_type,
      item.is_read ? 1 : 0,
    ]);

    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, reference_id, reference_type, is_read)
       VALUES ${values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      values.flat()
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/notifications/:id/read', async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/notifications/read-all', async (req, res, next) => {
  try {
    const { user_id } = req.body || {};
    if (!user_id) {
      res.status(400).json({ message: 'user_id wajib diisi.' });
      return;
    }
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [user_id]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ message: 'Ukuran foto profil maksimal 8MB.' });
    return;
  }
  if (error?.message === 'File harus berupa gambar.') {
    res.status(400).json({ message: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ message: error.message || 'Terjadi kesalahan pada server.' });
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
