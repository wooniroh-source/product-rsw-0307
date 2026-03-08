require('dotenv').config();
const express = require('express');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const pool    = require('./src/db');
const auth    = require('./src/middleware/auth');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'cleanpartners_secret';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// AUTH
// =============================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { hash } = req.body;
    const [rows] = await pool.query('SELECT password_hash FROM admin_config LIMIT 1');
    if (!rows.length || rows[0].password_hash !== hash) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/auth/password', auth, async (req, res) => {
  try {
    const { currentHash, newHash } = req.body;
    const [rows] = await pool.query('SELECT password_hash FROM admin_config LIMIT 1');
    if (!rows.length || rows[0].password_hash !== currentHash) {
      return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    }
    await pool.query('UPDATE admin_config SET password_hash = ? WHERE id = 1', [newHash]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================
// RESERVATIONS
// =============================================
app.get('/api/reservations/recent', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT name, date, time, service, status FROM reservations ORDER BY created_at DESC LIMIT 5'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reservations', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const { name, phone, service, date, time } = req.body;
    const [result] = await pool.query(
      'INSERT INTO reservations (name, phone, service, date, time) VALUES (?, ?, ?, ?, ?)',
      [name, phone, service, date, time]
    );
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/reservations/:id/status', auth, async (req, res) => {
  try {
    await pool.query('UPDATE reservations SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reservations/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM reservations WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// CONTACTS
// =============================================
app.get('/api/contacts', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const { name, phone, message } = req.body;
    const [result] = await pool.query(
      'INSERT INTO contacts (name, phone, message) VALUES (?, ?, ?)',
      [name, phone, message]
    );
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/contacts/:id/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE contacts SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/contacts/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM contacts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// BANNERS
// =============================================
app.get('/api/banners/:type', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM banners WHERE banner_type = ? ORDER BY sort_order ASC',
      [req.params.type]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/banners/:type', auth, async (req, res) => {
  try {
    const { badge, title, description, image_url, btn_text, btn_link } = req.body;
    const [max] = await pool.query(
      'SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM banners WHERE banner_type = ?',
      [req.params.type]
    );
    const [result] = await pool.query(
      'INSERT INTO banners (banner_type, badge, title, description, image_url, btn_text, btn_link, sort_order) VALUES (?,?,?,?,?,?,?,?)',
      [req.params.type, badge||null, title, description||null, image_url||null, btn_text||null, btn_link||null, max[0].next]
    );
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/banners/:type/:id', auth, async (req, res) => {
  try {
    const { badge, title, description, image_url, btn_text, btn_link } = req.body;
    await pool.query(
      'UPDATE banners SET badge=?, title=?, description=?, image_url=?, btn_text=?, btn_link=? WHERE id=? AND banner_type=?',
      [badge||null, title, description||null, image_url||null, btn_text||null, btn_link||null, req.params.id, req.params.type]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/banners/:type/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM banners WHERE id = ? AND banner_type = ?', [req.params.id, req.params.type]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// PROCESS STEPS
// =============================================
app.get('/api/process', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM process_steps ORDER BY step_order ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/process', auth, async (req, res) => {
  try {
    const { steps } = req.body;
    for (const s of steps) {
      await pool.query(
        'UPDATE process_steps SET title=?, description=?, image_url=?, icon=? WHERE step_order=?',
        [s.title, s.description, s.image_url, s.icon, s.step_order]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// Fallback → index.html
// =============================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
