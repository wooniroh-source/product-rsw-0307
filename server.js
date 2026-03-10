require('dotenv').config();
const express = require('express');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const pool    = require('./src/db');
const auth    = require('./src/middleware/auth');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'cleanpartners_secret';
const WEB3FORMS_KEY = process.env.WEB3FORMS_KEY || '962f5bff-992d-4cc2-b8bf-0b4966759efa';

const sendEmail = async (subject, message) => {
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject, message, from_name: '클린앤파트너즈 알림' })
    });
    const data = await res.json();
    if (data.success) console.log('[Email] 발송 성공:', subject);
    else console.error('[Email] 발송 실패:', data);
  } catch (err) {
    console.error('[Email] 오류:', err.message);
  }
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// DB 자동 초기화 (테이블 없으면 생성 + 기본 데이터)
// =============================================
async function initDB() {
  console.log('🚀 DB 초기화 시작...');
  
  // DB 연결 확인 (최대 3회 시도)
  for (let i = 1; i <= 3; i++) {
    try {
      await pool.query('SELECT 1');
      console.log(`✅ DB 연결 확인됨 (시도 ${i}/3)`);
      break;
    } catch (err) {
      console.error(`❌ DB 연결 실패 (시도 ${i}/3):`, err.message);
      if (i === 3) throw new Error('DB 연결에 최종 실패했습니다.');
      await new Promise(res => setTimeout(res, 2000));
    }
  }

  const runQuery = async (name, sql) => {
    try {
      await pool.query(sql);
      console.log(`✅ 테이블 확인/생성 완료: ${name}`);
    } catch (err) {
      console.error(`❌ 테이블 생성 실패 (${name}):`, err.message);
      throw err;
    }
  };

  try {
    // 1. 관리자 설정 테이블
    await runQuery('admin_config', `
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

    // 2. 나머지 테이블들
    await runQuery('reservations', `
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

    await runQuery('contacts', `
      CREATE TABLE IF NOT EXISTS contacts (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(50)  NOT NULL,
        phone      VARCHAR(20)  NOT NULL,
        message    TEXT         NOT NULL,
        is_read    TINYINT(1)   DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery('banners', `
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

    await runQuery('process_steps', `
      CREATE TABLE IF NOT EXISTS process_steps (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        step_order  INT          NOT NULL,
        title       VARCHAR(100) NOT NULL,
        description VARCHAR(200),
        image_url   VARCHAR(500),
        icon        VARCHAR(50)
      )
    `);

    // 3. 기본 데이터 채우기 (생략 가능 시 건너뜀)
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
      console.log('✅ 기본 배너 데이터 생성 완료');
    }

    console.log('✅ 모든 DB 초기화 작업 완료');
  } catch (e) {
    console.error('❌ DB 초기화 치명적 실패:', e.message);
    throw e;
  }
}

// =============================================
// AUTH
// =============================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { hash } = req.body;
    console.log('[Auth] Login attempt with hash:', hash);
    const [rows] = await pool.query('SELECT password_hash FROM admin_config LIMIT 1');
    if (!rows.length) {
      console.warn('[Auth] No admin_config record found!');
      return res.status(401).json({ error: '관리자 계정이 존재하지 않습니다.' });
    }
    if (rows[0].password_hash !== hash) {
      console.warn('[Auth] Invalid hash. Expected:', rows[0].password_hash, 'Got:', hash);
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
  } catch (e) {
    console.error('[Auth] Login error:', e.message);
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
    console.error('[Auth] Password update error:', e.message);
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
    const svcNames = { wall:'벽걸이 에어컨', stand:'스탠드 에어컨', multi:'2-in-1 멀티형', system:'천장형 시스템' };
    sendEmail(
      `[클린앤파트너즈] 새 예약 접수 - ${name} (${date})`,
      `<h2 style="color:#1a56db;">📋 새 예약이 접수되었습니다</h2>
      <table style="border-collapse:collapse;font-size:15px;font-family:sans-serif;">
        <tr><td style="padding:8px 16px;color:#555;width:100px;">고객명</td><td style="padding:8px 16px;font-weight:bold;">${name}</td></tr>
        <tr><td style="padding:8px 16px;color:#555;">연락처</td><td style="padding:8px 16px;">${phone}</td></tr>
        <tr><td style="padding:8px 16px;color:#555;">서비스</td><td style="padding:8px 16px;">${svcNames[service]||service}</td></tr>
        <tr><td style="padding:8px 16px;color:#555;">예약날짜</td><td style="padding:8px 16px;font-weight:bold;color:#1a56db;">${date}</td></tr>
        <tr><td style="padding:8px 16px;color:#555;">희망시간</td><td style="padding:8px 16px;">${time}</td></tr>
      </table>`
    );
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
    sendEmail(
      `[클린앤파트너즈] 새 문의 접수 - ${name}`,
      `<h2 style="color:#0e9f6e;">💬 새 문의가 접수되었습니다</h2>
      <table style="border-collapse:collapse;font-size:15px;font-family:sans-serif;">
        <tr><td style="padding:8px 16px;color:#555;width:100px;">고객명</td><td style="padding:8px 16px;font-weight:bold;">${name}</td></tr>
        <tr><td style="padding:8px 16px;color:#555;">연락처</td><td style="padding:8px 16px;">${phone}</td></tr>
        <tr><td style="padding:8px 16px;color:#555;vertical-align:top;">문의내용</td><td style="padding:8px 16px;white-space:pre-wrap;">${message}</td></tr>
      </table>`
    );
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
// 이메일 테스트 (배포 환경 확인용)
// =============================================
app.get('/api/test-email', async (req, res) => {
  try {
    const result = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: '[클린앤파트너즈] 이메일 테스트',
        message: '서버에서 발송한 테스트 이메일입니다.',
        from_name: '클린앤파트너즈 알림'
      })
    });
    const data = await result.json();
    console.log('[Email Test]', data);
    res.json(data);
  } catch (err) {
    console.error('[Email Test Error]', err.message);
    res.status(500).json({ error: err.message });
  }
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
}).catch(err => {
  console.error('❌ 서버 시작 실패 (DB 초기화 치명적 오류):', err.message);
  process.exit(1);
});
