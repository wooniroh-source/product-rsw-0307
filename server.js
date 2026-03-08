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
// DB 자동 초기화 (테이블 없으면 생성 + 기본 데이터)
// =============================================
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(50)  NOT NULL,
        phone      VARCHAR(20)  NOT NULL,
        service    VARCHAR(30)  NOT NULL,
        date       VARCHAR(20)  NOT NULL,
        time       VARCHAR(20)  NOT NULL,
        status     ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(50)  NOT NULL,
        phone      VARCHAR(20)  NOT NULL,
        message    TEXT         NOT NULL,
        is_read    TINYINT(1)   DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        banner_type VARCHAR(10)  NOT NULL,
        badge       VARCHAR(50),
        title       VARCHAR(200) NOT NULL,
        description TEXT,
        image_url   VARCHAR(500),
        btn_text    VARCHAR(50),
        btn_link    VARCHAR(300),
        sort_order  INT DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_steps (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        step_order  INT          NOT NULL,
        title       VARCHAR(100) NOT NULL,
        description VARCHAR(200),
        image_url   VARCHAR(500),
        icon        VARCHAR(50)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        password_hash VARCHAR(64) NOT NULL
      )
    `);

    // 관리자 비밀번호 기본값: 1234 (SHA-256)
    const [adminRows] = await pool.query('SELECT id FROM admin_config LIMIT 1');
    if (!adminRows.length) {
      await pool.query(
        "INSERT INTO admin_config (password_hash) VALUES ('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')"
      );
      console.log('✅ 기본 관리자 비밀번호 생성 완료 (1234)');
    }

    // 배너 기본 데이터
    const [bannerRows] = await pool.query('SELECT id FROM banners LIMIT 1');
    if (!bannerRows.length) {
      await pool.query(`
        INSERT INTO banners (banner_type, title, description, image_url, btn_text, btn_link, sort_order) VALUES
        ('hero', '당신의 숨결을 디자인합니다', '전문 분해 세척으로 시작하는 깨끗한 실내 공기 솔루션', 'https://images.unsplash.com/photo-1590402444816-05d848218571?auto=format&fit=crop&w=1200&q=80', '온라인 예약하기', 'reservation.html', 1),
        ('hero', '10년 경력의 베테랑 엔지니어', '까다로운 시스템 에어컨부터 가정용까지 완벽하게 케어합니다', 'https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?auto=format&fit=crop&w=1200&q=80', '서비스 상세 보기', 'services.html', 2),
        ('hero', '친환경 세제 안심 공법', '우리가족 건강을 생각하는 FDA 승인 친환경 약품 사용', 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80', '브랜드 스토리', 'about.html', 3),
        ('mid', '완벽한 분해, 철저한 살균', '보이지 않는 곳까지 클린앤파트너즈가 책임집니다.', 'https://images.unsplash.com/photo-1558389186-438424b00a32?auto=format&fit=crop&w=1200&q=80', null, null, 1),
        ('mid', '쾌적한 여름의 시작', '지금 예약하고 시원한 바람을 만나보세요.', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=1200&q=80', null, null, 2)
      `);
      await pool.query(`
        INSERT INTO banners (banner_type, badge, title, description, image_url, sort_order) VALUES
        ('res', '이벤트', '봄맞이 에어컨 세척 특가!', '3월 한 달간 벽걸이형 20% 할인 혜택을 드립니다.', 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80', 1),
        ('res', 'NEW', '신규 고객 첫 예약 10% 할인', '클린앤파트너즈 첫 이용 고객님께 드리는 특별 혜택', 'https://images.unsplash.com/photo-1558389186-438424b00a32?auto=format&fit=crop&w=1200&q=80', 2),
        ('res', '안내', '정기 관리 고객 우선 예약', '연 2회 이상 정기 이용 고객님께 우선 예약 혜택을 제공합니다.', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=1200&q=80', 3),
        ('svc', '할인', '벽걸이 에어컨 세척 20% 할인', '3월 한 달간 벽걸이형 단독 예약 시 할인 혜택을 드립니다.', 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80', 1),
        ('svc', '패키지', '2-in-1 멀티형 세트 특가', '스탠드 + 벽걸이 동시 신청 시 세트 할인가 적용됩니다.', 'https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?auto=format&fit=crop&w=1200&q=80', 2),
        ('svc', '안내', '천장형 시스템 에어컨 전문 케어', '상업용 4Way 시스템 에어컨도 클린앤파트너즈가 책임집니다.', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=1200&q=80', 3),
        ('about', '브랜드', '10년의 신뢰, 클린앤파트너즈', '검증된 기술력과 진심 어린 서비스로 고객 곁에 함께합니다.', 'https://images.unsplash.com/photo-1590402444816-05d848218571?auto=format&fit=crop&w=1200&q=80', 1),
        ('about', '철학', '보이지 않는 곳까지 책임집니다', '분해부터 재조립까지 한 치의 타협 없이 완벽하게 처리합니다.', 'https://images.unsplash.com/photo-1581094294329-c8112a89af12?auto=format&fit=crop&w=1200&q=80', 2),
        ('about', '약속', '친환경 인증 약품만 사용합니다', '아이와 반려동물이 있는 가정에서도 안심할 수 있는 안전한 케어', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80', 3)
      `);
      console.log('✅ 기본 배너 데이터 생성 완료');
    }

    // 공정 기본 데이터
    const [processRows] = await pool.query('SELECT id FROM process_steps LIMIT 1');
    if (!processRows.length) {
      await pool.query(`
        INSERT INTO process_steps (step_order, title, description, image_url, icon) VALUES
        (1, '사전 점검', '작동 상태 및 오염도 확인', 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=400&q=80', 'fa-clipboard-check'),
        (2, '부품 분해', '완전 분해를 통한 내부 노출', 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=400&q=80', 'fa-tools'),
        (3, '고압 세척', '고압 세척기로 찌든때 제거', 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=400&q=80', 'fa-faucet-drip'),
        (4, '살균 소독', '99.9% 세균 및 곰팡이 살균', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80', 'fa-spray-can-sparkles'),
        (5, '제품 조립', '세척된 부품의 정밀 재조립', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=400&q=80', 'fa-laptop-house'),
        (6, '최종 시운전', '정상 작동 확인 및 마무리', 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=400&q=80', 'fa-power-off')
      `);
      console.log('✅ 기본 공정 데이터 생성 완료');
    }

    console.log('✅ DB 초기화 완료');
  } catch (e) {
    console.error('❌ DB 초기화 실패:', e.message);
  }
}

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
initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
});
