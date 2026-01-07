import crypto from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { ensureSchema, pool, withTransaction } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const sessionCookie = process.env.SESSION_COOKIE || 'krm_session';

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const sessions = new Map();

const createSession = (userId) => {
  const token = crypto.randomUUID();
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
};

const getSessionUserId = (req) => {
  const token = req.cookies?.[sessionCookie];
  if (!token) return null;
  const session = sessions.get(token);
  return session?.userId ?? null;
};

const setSessionCookie = (res, token) => {
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
};

const clearSessionCookie = (res) => {
  res.clearCookie(sessionCookie);
};

const fetchSessionProfile = async (userId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, p.full_name, p.role
     FROM users u
     JOIN profiles p ON p.id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const ensureDefaultAdmin = async () => {
  const adminEmail = 'admin@krm.com';
  const adminPassword = 'admin';
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]);
  if (existing.length > 0) {
    return;
  }

  await withTransaction(async (connection) => {
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await connection.query(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, adminEmail, passwordHash]
    );
    await connection.query(
      'INSERT INTO profiles (id, email, full_name, role) VALUES (?, ?, ?, ?)',
      [userId, adminEmail, 'Administrator', 'admin']
    );
  });
};

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

app.get('/auth/session', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.json(null);
    return;
  }

  const profile = await fetchSessionProfile(userId);
  if (!profile) {
    res.json(null);
    return;
  }

  res.json({
    user: { id: profile.id, email: profile.email },
    profile: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
    },
  });
});

app.post('/auth/initialize-admin', async (req, res, next) => {
  try {
    await ensureDefaultAdmin();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ message: 'Email dan password wajib diisi.' });
      return;
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.password_hash, p.full_name, p.role
       FROM users u
       JOIN profiles p ON p.id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user) {
      res.status(401).json({ message: 'Email atau password salah.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ message: 'Email atau password salah.' });
      return;
    }

    const token = createSession(user.id);
    setSessionCookie(res, token);

    res.json({
      user: { id: user.id, email: user.email },
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/auth/logout', (req, res) => {
  const token = req.cookies?.[sessionCookie];
  if (token) {
    sessions.delete(token);
  }
  clearSessionCookie(res);
  res.status(204).end();
});

app.get('/profiles', async (req, res, next) => {
  try {
    const { role } = req.query;
    const { where, values } = buildWhereClause([{ clause: 'role = ?', value: role }]);
    const [rows] = await pool.query(`SELECT id, email, full_name, role FROM profiles ${where}`, values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get('/profiles/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role FROM profiles WHERE id = ? LIMIT 1',
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
    const { full_name, email, password, role } = req.body || {};
    if (!full_name || !email || !password || !role) {
      res.status(400).json({ message: 'Data user belum lengkap.' });
      return;
    }

    const newProfile = await withTransaction(async (connection) => {
      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);

      await connection.query(
        'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
        [userId, email, passwordHash]
      );
      await connection.query(
        'INSERT INTO profiles (id, email, full_name, role) VALUES (?, ?, ?, ?)',
        [userId, email, full_name, role]
      );

      return { id: userId, email, full_name, role };
    });

    res.status(201).json(newProfile);
  } catch (error) {
    next(error);
  }
});

app.put('/profiles/:id', async (req, res, next) => {
  try {
    const { full_name, email, role } = req.body || {};
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
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }

    if (!updates.length) {
      res.status(400).json({ message: 'Tidak ada data untuk diperbarui.' });
      return;
    }

    await withTransaction(async (connection) => {
      if (email) {
        await connection.query('UPDATE users SET email = ? WHERE id = ?', [email, req.params.id]);
      }
      await connection.query(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`, [
        ...values,
        req.params.id,
      ]);
    });

    const [rows] = await pool.query(
      'SELECT id, email, full_name, role FROM profiles WHERE id = ? LIMIT 1',
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
      `SELECT p.*, pr.id AS sales_profile_id, pr.full_name AS sales_name, pr.email AS sales_email
       FROM prospects p
       JOIN profiles pr ON pr.id = p.sales_id
       ${where}`,
      values
    );
    const mapped = rows.map((row) => ({
      ...row,
      sales: {
        id: row.sales_profile_id,
        full_name: row.sales_name,
        email: row.sales_email,
        role: 'sales',
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
              assigned_to.full_name AS assigned_to_name, assigned_to.email AS assigned_to_email
       FROM follow_ups f
       JOIN prospects p ON p.id = f.prospect_id
       JOIN profiles assigned_by ON assigned_by.id = f.assigned_by
       JOIN profiles assigned_to ON assigned_to.id = f.assigned_to
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
        role: 'admin',
      },
      assignedToProfile: {
        id: row.assigned_to,
        full_name: row.assigned_to_name,
        email: row.assigned_to_email,
        role: 'sales',
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
  console.error(error);
  res.status(500).json({ message: error.message || 'Terjadi kesalahan pada server.' });
});

ensureSchema()
  .then(async () => {
    await ensureDefaultAdmin();
    app.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
