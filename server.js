require('dotenv').config();
const express    = require('express');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const https      = require('https');
const nodemailer = require('nodemailer');
const pool       = require('./src/db');
const auth       = require('./src/middleware/auth');
const querystring = require('querystring');

const app = express();

// 이메일 발송 설정
const mailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  tls: { rejectUnauthorized: false }
});

const NOTIFY_EMAILS = ['wooniroh@gmail.com', 'myzerobiz.co@gmail.com'];

// 서버 시작 시 Gmail 연결 테스트
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  mailTransporter.verify((err) => {
    if (err) console.error('[Mail] ❌ Gmail 연결 실패:', err.message, '→ 앱 비밀번호 확인 필요');
    else     console.log('[Mail] ✅ Gmail 연결 성공:', process.env.GMAIL_USER);
  });
} else {
  console.warn('[Mail] ⚠️ GMAIL_USER 또는 GMAIL_PASS 미설정');
}

const sendMail = (subject, text) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return;
  NOTIFY_EMAILS.forEach(to => {
    mailTransporter.sendMail({
      from: `"클린앤파트너즈 알림" <${process.env.GMAIL_USER}>`,
      to, subject, text
    }).then(() => console.log('[Mail] ✅ 발송 완료:', to))
      .catch(err => console.error('[Mail] ❌ 발송 실패:', to, err.message));
  });
};

// Web3Forms 서버 측 백업 발송 (Node.js 내장 https 모듈 사용)
const WEB3FORMS_KEY = '962f5bff-992d-4cc2-b8bf-0b4966759efa';
const sendWeb3Forms = (subject, message) => {
  const data = JSON.stringify({ access_key: WEB3FORMS_KEY, subject, message, from_name: '클린앤파트너즈 알림' });
  const req = https.request({
    hostname: 'api.web3forms.com', port: 443, path: '/submit', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (parsed.success) console.log('[Web3Forms] ✅ 발송 완료');
        else console.warn('[Web3Forms] ⚠️ 발송 실패:', parsed.message);
      } catch(e) {}
    });
  });
  req.on('error', err => console.error('[Web3Forms] ❌ 오류:', err.message));
  req.write(data);
  req.end();
};
// 알리고 SMS/LMS 발송
const sendSMS = (msg, msgType = 'LMS', title = '') => {
  const { ALIGO_KEY, ALIGO_USER_ID, ALIGO_SENDER, ALIGO_RECEIVER } = process.env;
  if (!ALIGO_KEY || !ALIGO_USER_ID || !ALIGO_SENDER || !ALIGO_RECEIVER) {
    console.warn('[SMS] ⚠️ 알리고 환경변수 미설정 (ALIGO_KEY, ALIGO_USER_ID, ALIGO_SENDER, ALIGO_RECEIVER)');
    return;
  }
  const params = { key: ALIGO_KEY, user_id: ALIGO_USER_ID, sender: ALIGO_SENDER, receiver: ALIGO_RECEIVER, msg, msg_type: msgType };
  if (msgType === 'LMS' && title) params.title = title;
  const data = querystring.stringify(params);
  const req = https.request({
    hostname: 'apis.aligo.in', port: 443, path: '/send/', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (String(parsed.result_code) === '1') console.log('[SMS] ✅ 발송 완료, 건수:', parsed.success_cnt);
        else console.warn('[SMS] ⚠️ 발송 실패:', parsed.message);
      } catch(e) { console.error('[SMS] ❌ 응답 파싱 오류:', e.message); }
    });
  });
  req.on('error', err => console.error('[SMS] ❌ 요청 오류:', err.message));
  req.write(data);
  req.end();
};

const JWT_SECRET = process.env.JWT_SECRET || 'cleanpartners_secret';

app.use(express.json());

// www → non-www 리디렉션
app.use((req, res, next) => {
  if (req.headers.host && req.headers.host.startsWith('www.')) {
    const nonWww = req.headers.host.slice(4);
    return res.redirect(301, `https://${nonWww}${req.url}`);
  }
  next();
});

// 부정클릭 방지: 차단된 IP 접근 차단 (API 제외)
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const [rows] = await pool.query(
      'SELECT id FROM blocked_ips WHERE ip = ? AND unblocked_at IS NULL',
      [ip]
    );
    if (rows.length) return res.status(403).send('접근이 일시적으로 제한되었습니다.');
  } catch (_) {}
  next();
});

// favicon.ico 파일 없을 때 204로 응답 (크롤러 4xx 방지)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// .html URL → 클린 URL 301 리디렉션 (express.static보다 먼저 처리해야 함)
const htmlRedirects = {
  '/index.html':       '/',
  '/services.html':    '/services',
  '/reservation.html': '/reservation',
  '/estimate.html':    '/estimate',
  '/gallery.html':     '/gallery',
  '/about.html':       '/about',
  '/contact.html':     '/contact',
  '/privacy.html':     '/privacy',
  '/care.html':        '/care',
};
app.use((req, res, next) => {
  const target = htmlRedirects[req.path];
  if (target) {
    const qs = req.originalUrl.indexOf('?') !== -1 ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(301, target + qs);
  }
  next();
});

// main.js, sw.js, HTML 파일은 항상 최신 버전 제공 (캐시 완전 비활성화)
app.use((req, res, next) => {
  const p = req.path;
  if (p === '/main.js' || p === '/sw.js' || p.endsWith('.html') ||
      ['/reservation','/hanyoung','/com','/services','/estimate','/gallery','/about','/contact','/privacy','/care','/admin','/'].includes(p)) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.get(['/main.js', '/sw.js'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', req.path.slice(1)));
});

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
        address    VARCHAR(200) DEFAULT NULL,
        service    VARCHAR(30)  NOT NULL,
        date       VARCHAR(20)  NOT NULL,
        time       VARCHAR(20)  NOT NULL,
        district   VARCHAR(50)  DEFAULT NULL,
        status     ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 기존 reservations 테이블에 district 컬럼 없으면 추가
    const [districtCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'district'`
    );
    if (districtCols.length === 0) {
      await pool.query(`ALTER TABLE reservations ADD COLUMN district VARCHAR(50) DEFAULT NULL`);
      console.log('✅ reservations.district 컬럼 추가 완료');
    }

    // 기존 reservations 테이블에 address 컬럼 없으면 추가
    const [addressCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'address'`
    );
    if (addressCols.length === 0) {
      await pool.query(`ALTER TABLE reservations ADD COLUMN address VARCHAR(200) DEFAULT NULL AFTER phone`);
      console.log('✅ reservations.address 컬럼 추가 완료');
    }

    await runQuery('hanyoung_reservations', `
      CREATE TABLE IF NOT EXISTS hanyoung_reservations (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(50)  NOT NULL,
        phone      VARCHAR(20)  NOT NULL,
        address    VARCHAR(200) DEFAULT NULL,
        service    VARCHAR(30)  NOT NULL,
        date       VARCHAR(20)  NOT NULL,
        time       VARCHAR(20)  NOT NULL,
        status     ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 기존 hanyoung_reservations 테이블에 address 컬럼 없으면 추가
    const [hyAddressCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hanyoung_reservations' AND COLUMN_NAME = 'address'`
    );
    if (hyAddressCols.length === 0) {
      await pool.query(`ALTER TABLE hanyoung_reservations ADD COLUMN address VARCHAR(200) DEFAULT NULL AFTER phone`);
      console.log('✅ hanyoung_reservations.address 컬럼 추가 완료');
    }

    await runQuery('com_reservations', `
      CREATE TABLE IF NOT EXISTS com_reservations (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(50)  NOT NULL,
        phone      VARCHAR(20)  NOT NULL,
        address    VARCHAR(200) DEFAULT NULL,
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
        id            INT AUTO_INCREMENT PRIMARY KEY,
        banner_type   VARCHAR(50)  NOT NULL,
        badge         VARCHAR(50),
        title         VARCHAR(200) NOT NULL,
        description   TEXT,
        image_url     VARCHAR(500),
        btn_text      VARCHAR(50),
        btn_link      VARCHAR(300),
        sort_order    INT DEFAULT 0,
        company_name  VARCHAR(100),
        total_units   VARCHAR(50),
        time_required VARCHAR(50),
        manpower      VARCHAR(50),
        work_date     VARCHAR(50),
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // banner_type 컬럼을 VARCHAR(50)으로 보장 (hanyoung-hero 등 13자 초과 타입 지원)
    try {
      const [cols] = await pool.query(`SHOW COLUMNS FROM banners LIKE 'banner_type'`);
      if (cols.length > 0 && cols[0].Type === 'varchar(10)') {
        await pool.query(`ALTER TABLE banners MODIFY COLUMN banner_type VARCHAR(50) NOT NULL`);
        console.log('✅ banners.banner_type VARCHAR(10) → VARCHAR(50) 확장 완료');
      }
    } catch(e) {
      console.warn('⚠️ banner_type 마이그레이션:', e.message);
    }

    // 기존 배너 테이블에 새 컬럼이 없을 경우 추가 (기존 배포 호환)
    // errno 1060 = Duplicate column (이미 존재) → 무시, 그 외 오류는 무시
    const midCols = [
      ["company_name",  "VARCHAR(100)"],
      ["total_units",   "VARCHAR(50)"],
      ["time_required", "VARCHAR(50)"],
      ["manpower",      "VARCHAR(50)"],
      ["work_date",     "VARCHAR(50)"]
    ];
    for (const [col, colType] of midCols) {
      try {
        await pool.query(`ALTER TABLE banners ADD COLUMN ${col} ${colType}`);
        console.log(`✅ 컬럼 추가됨: banners.${col}`);
      } catch(e) {
        if (e.errno === 1060) {
          // 이미 존재하는 컬럼 - 정상
        } else {
          console.warn(`⚠️ 컬럼 추가 스킵 (${col}):`, e.message);
        }
      }
    }

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

    await runQuery('gallery', `
      CREATE TABLE IF NOT EXISTS gallery (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        title       VARCHAR(200) NOT NULL,
        category    VARCHAR(50)  NOT NULL,
        ba_type     ENUM('before','after','none') DEFAULT 'none',
        image_url   VARCHAR(500) NOT NULL,
        description VARCHAR(300),
        sort_order  INT DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery('wash_checklists', `
      CREATE TABLE IF NOT EXISTS wash_checklists (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        wash_date           VARCHAR(20)  NOT NULL,
        site_name           VARCHAR(100) NOT NULL,
        outdoor_temp        VARCHAR(20),
        discharge_temp      VARCHAR(20),
        work_time           VARCHAR(50),
        disassembly_level   VARCHAR(50),
        chemicals           VARCHAR(200),
        contamination_level VARCHAR(50),
        memo                TEXT,
        customer_signature  MEDIUMTEXT,
        signed_at           DATETIME,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery('reviews', `
      CREATE TABLE IF NOT EXISTS reviews (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        checklist_id INT DEFAULT NULL,
        nickname     VARCHAR(50)  NOT NULL,
        rating       TINYINT(1)   NOT NULL DEFAULT 5,
        ac_type      VARCHAR(50),
        content      TEXT         NOT NULL,
        is_approved  TINYINT(1)   DEFAULT 0,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery('closed_dates', `
      CREATE TABLE IF NOT EXISTS closed_dates (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        close_date VARCHAR(10) NOT NULL UNIQUE,
        reason     VARCHAR(100) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery('ad_clicks', `
      CREATE TABLE IF NOT EXISTS ad_clicks (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        ip             VARCHAR(45)  NOT NULL,
        user_agent     VARCHAR(500),
        referrer       VARCHAR(500),
        page           VARCHAR(200),
        naver_keyword  VARCHAR(200),
        naver_query    VARCHAR(200),
        is_suspicious  TINYINT(1)   DEFAULT 0,
        clicked_at     DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery('blocked_ips', `
      CREATE TABLE IF NOT EXISTS blocked_ips (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        ip           VARCHAR(45)  NOT NULL UNIQUE,
        reason       VARCHAR(200),
        click_count  INT          DEFAULT 0,
        is_auto      TINYINT(1)   DEFAULT 0,
        blocked_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        unblocked_at DATETIME DEFAULT NULL
      )
    `);

    // 3. 기본 데이터 채우기 (생략 가능 시 건너뜀)
    const [processRows] = await pool.query('SELECT id FROM process_steps LIMIT 1');
    if (!processRows.length) {
      await pool.query(`
        INSERT INTO process_steps (step_order, title, description, image_url, icon) VALUES
        (1, '현장 방문 및 점검', '전문 엔지니어가 방문하여 에어컨 상태를 꼼꼼히 점검합니다.', 'https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?auto=format&fit=crop&w=800&q=80', 'fa-search'),
        (2, '필터 및 외부 분해', '에어컨 필터와 외부 커버를 안전하게 분해합니다.', 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=800&q=80', 'fa-tools'),
        (3, '고압 세척', '고압 스팀으로 내부 열교환기와 팬을 세척합니다.', 'https://images.unsplash.com/photo-1558389186-438424b00a32?auto=format&fit=crop&w=800&q=80', 'fa-shower'),
        (4, '친환경 살균 처리', 'FDA 승인 친환경 약품으로 세균과 곰팡이를 완벽 제거합니다.', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=800&q=80', 'fa-leaf'),
        (5, '건조 및 조립', '완전 건조 후 부품을 꼼꼼하게 재조립합니다.', 'https://images.unsplash.com/photo-1590402444816-05d848218571?auto=format&fit=crop&w=800&q=80', 'fa-wrench'),
        (6, '작동 점검 및 완료', '정상 작동 여부를 최종 확인 후 서비스를 완료합니다.', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80', 'fa-check-circle')
      `);
      console.log('✅ 기본 공정 데이터 생성 완료');
    }

    const [bannerRows] = await pool.query('SELECT id FROM banners LIMIT 1');
    if (!bannerRows.length) {
      await pool.query(`
        INSERT INTO banners (banner_type, title, description, image_url, btn_text, btn_link, sort_order) VALUES
        ('hero', '당신의 숨결을 디자인합니다', '전문 분해 세척으로 시작하는 깨끗한 실내 공기 솔루션', 'https://images.unsplash.com/photo-1590402444816-05d848218571?auto=format&fit=crop&w=1200&q=80', '온라인 예약하기', '/reservation', 1),
        ('hero', '10년 경력의 베테랑 엔지니어', '까다로운 시스템 에어컨부터 가정용까지 완벽하게 케어합니다', 'https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?auto=format&fit=crop&w=1200&q=80', '서비스 상세 보기', '/services', 2),
        ('hero', '친환경 세제 안심 공법', '우리가족 건강을 생각하는 FDA 승인 친환경 약품 사용', 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80', '브랜드 스토리', '/about', 3),
        ('mid', '완벽한 분해, 철저한 살균', '보이지 않는 곳까지 클린앤파트너즈가 책임집니다.', 'https://images.unsplash.com/photo-1558389186-438424b00a32?auto=format&fit=crop&w=1200&q=80', null, null, 1),
        ('mid', '쾌적한 여름의 시작', '지금 예약하고 시원한 바람을 만나보세요.', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=1200&q=80', null, null, 2)
      `);
      console.log('✅ 기본 배너 데이터 생성 완료');
    }

    // btn_link의 .html 확장자 제거 (SEO: 리디렉션 체인 방지)
    const linkMigrations = [
      ['reservation.html', '/reservation'],
      ['services.html',    '/services'],
      ['estimate.html',    '/estimate'],
      ['gallery.html',     '/gallery'],
      ['about.html',       '/about'],
      ['contact.html',     '/contact'],
      ['privacy.html',     '/privacy'],
    ];
    for (const [oldLink, newLink] of linkMigrations) {
      await pool.query(
        "UPDATE banners SET btn_link = ? WHERE btn_link = ? OR btn_link = ?",
        [newLink, oldLink, `/${oldLink}`]
      );
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
app.get('/api/reservations/booked-slots', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT date, time FROM reservations WHERE date >= CURDATE() AND status != 'cancelled'"
    );
    const slots = {};
    rows.forEach(({ date, time }) => {
      const key = date instanceof Date
        ? date.toISOString().slice(0, 10)
        : String(date).slice(0, 10);
      if (!slots[key]) slots[key] = [];
      slots[key].push(time);
    });
    res.json(slots);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    const { name, phone, address, service, date, time, district } = req.body;

    const [[closedRow]] = await pool.query(
      'SELECT id FROM closed_dates WHERE close_date = ?', [date]
    );
    if (closedRow)
      return res.status(409).json({ error: '해당 날짜는 예약 마감일입니다.' });

    const [result] = await pool.query(
      'INSERT INTO reservations (name, phone, address, service, date, time, district) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, phone, address || null, service, date, time, district || null]
    );
    const svcNames = { wall:'상업용 스탠드 에어컨', stand:'가정용 스탠드 에어컨', multi:'2-in-1 멀티형', system:'천장형 시스템' };
    const districtLine = district ? `\n서비스 지역 : ${district}` : '';
    const addressLine  = address  ? `\n상세주소   : ${address}` : '';
    const mailBody = `📋 새 예약이 접수되었습니다\n` +
      `──────────────────────\n` +
      `고객명   : ${name}\n` +
      `연락처   : ${phone}` +
      `${addressLine}` +
      `${districtLine}\n` +
      `서비스   : ${svcNames[service] || service}\n` +
      `예약 날짜 : ${date}\n` +
      `희망 시간 : ${time}\n` +
      `──────────────────────`;
    sendMail(`[클린앤파트너즈] 새 예약 접수 - ${name} (${date})`, mailBody);
    sendWeb3Forms(`[클린앤파트너즈] 새 예약 접수 - ${name} (${date})`, mailBody);
    const smsMsg = `[클린앤파트너즈] 예약접수\n${name} ${phone}\n${date} ${time}`;
    sendSMS(smsMsg, 'SMS');
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
    const contactBody = `💬 새 문의가 접수되었습니다\n` +
      `──────────────────────\n` +
      `고객명   : ${name}\n` +
      `연락처   : ${phone}\n` +
      `──────────────────────\n` +
      `문의 내용 :\n${message}\n` +
      `──────────────────────`;
    sendMail(`[클린앤파트너즈] 새 문의 접수 - ${name}`, contactBody);
    sendWeb3Forms(`[클린앤파트너즈] 새 문의 접수 - ${name}`, contactBody);
    const contactSms = `[클린앤파트너즈] 문의접수\n${name} ${phone}`;
    sendSMS(contactSms, 'SMS');
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

// 배너 테이블에 mid 전용 컬럼이 존재하는지 캐싱
let _midColsExist = null;
async function midColsExist() {
  if (_midColsExist !== null) return _midColsExist;
  try {
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'banners' AND COLUMN_NAME = 'company_name'"
    );
    _midColsExist = rows[0].cnt > 0;
  } catch(e) {
    _midColsExist = false;
  }
  return _midColsExist;
}

app.post('/api/banners/:type', auth, async (req, res) => {
  try {
    const { badge, title, description, image_url, btn_text, btn_link,
            company_name, total_units, time_required, manpower, work_date } = req.body;
    const [max] = await pool.query(
      'SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM banners WHERE banner_type = ?',
      [req.params.type]
    );
    const hasMidCols = await midColsExist();
    let sql, params;
    if (hasMidCols) {
      sql = 'INSERT INTO banners (banner_type, badge, title, description, image_url, btn_text, btn_link, sort_order, company_name, total_units, time_required, manpower, work_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
      params = [req.params.type, badge||null, title, description||null, image_url||null, btn_text||null, btn_link||null, max[0].next,
                company_name||null, total_units||null, time_required||null, manpower||null, work_date||null];
    } else {
      sql = 'INSERT INTO banners (banner_type, badge, title, description, image_url, btn_text, btn_link, sort_order) VALUES (?,?,?,?,?,?,?,?)';
      params = [req.params.type, badge||null, title, description||null, image_url||null, btn_text||null, btn_link||null, max[0].next];
    }
    const [result] = await pool.query(sql, params);
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/banners/:type/:id', auth, async (req, res) => {
  try {
    const { badge, title, description, image_url, btn_text, btn_link,
            company_name, total_units, time_required, manpower, work_date } = req.body;
    const hasMidCols = await midColsExist();
    let sql, params;
    if (hasMidCols) {
      sql = 'UPDATE banners SET badge=?, title=?, description=?, image_url=?, btn_text=?, btn_link=?, company_name=?, total_units=?, time_required=?, manpower=?, work_date=? WHERE id=? AND banner_type=?';
      params = [badge||null, title, description||null, image_url||null, btn_text||null, btn_link||null,
                company_name||null, total_units||null, time_required||null, manpower||null, work_date||null,
                req.params.id, req.params.type];
    } else {
      sql = 'UPDATE banners SET badge=?, title=?, description=?, image_url=?, btn_text=?, btn_link=? WHERE id=? AND banner_type=?';
      params = [badge||null, title, description||null, image_url||null, btn_text||null, btn_link||null,
                req.params.id, req.params.type];
    }
    await pool.query(sql, params);
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
// GALLERY
// =============================================
app.get('/api/gallery', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM gallery';
    const params = [];
    if (category && category !== 'all') {
      sql += ' WHERE category = ?';
      params.push(category);
    }
    sql += ' ORDER BY sort_order ASC, created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gallery', auth, async (req, res) => {
  try {
    const { title, category, ba_type, image_url, description } = req.body;
    const [max] = await pool.query('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM gallery');
    const [result] = await pool.query(
      'INSERT INTO gallery (title, category, ba_type, image_url, description, sort_order) VALUES (?,?,?,?,?,?)',
      [title, category, ba_type||'none', image_url, description||null, max[0].next]
    );
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gallery/:id', auth, async (req, res) => {
  try {
    const { title, category, ba_type, image_url, description } = req.body;
    await pool.query(
      'UPDATE gallery SET title=?, category=?, ba_type=?, image_url=?, description=? WHERE id=?',
      [title, category, ba_type||'none', image_url, description||null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gallery/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM gallery WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// WASH CHECKLISTS
// =============================================
app.get('/api/checklists', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM wash_checklists ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/checklists/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM wash_checklists WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '체크리스트를 찾을 수 없습니다.' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checklists', auth, async (req, res) => {
  try {
    const { wash_date, site_name, outdoor_temp, discharge_temp, work_time,
            disassembly_level, chemicals, contamination_level, memo } = req.body;
    const [result] = await pool.query(
      `INSERT INTO wash_checklists
        (wash_date, site_name, outdoor_temp, discharge_temp, work_time,
         disassembly_level, chemicals, contamination_level, memo)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [wash_date, site_name, outdoor_temp||null, discharge_temp||null, work_time||null,
       disassembly_level||null, chemicals||null, contamination_level||null, memo||null]
    );
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/checklists/:id', auth, async (req, res) => {
  try {
    const { wash_date, site_name, outdoor_temp, discharge_temp, work_time,
            disassembly_level, chemicals, contamination_level, memo } = req.body;
    await pool.query(
      `UPDATE wash_checklists SET
        wash_date=?, site_name=?, outdoor_temp=?, discharge_temp=?, work_time=?,
        disassembly_level=?, chemicals=?, contamination_level=?, memo=?
       WHERE id=?`,
      [wash_date, site_name, outdoor_temp||null, discharge_temp||null, work_time||null,
       disassembly_level||null, chemicals||null, contamination_level||null, memo||null,
       req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/checklists/:id/sign', async (req, res) => {
  try {
    const { signature } = req.body;
    if (!signature) return res.status(400).json({ error: '서명 데이터가 없습니다.' });
    await pool.query(
      'UPDATE wash_checklists SET customer_signature=?, signed_at=NOW() WHERE id=?',
      [signature, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/checklists/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM wash_checklists WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// HANYOUNG RESERVATIONS
// =============================================
app.get('/api/hanyoung/reservations/booked-slots', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT date, time FROM hanyoung_reservations WHERE date >= CURDATE() AND status != 'cancelled'"
    );
    const slots = {};
    rows.forEach(({ date, time }) => {
      const key = date instanceof Date ? date.toISOString().slice(0,10) : String(date).slice(0,10);
      if (!slots[key]) slots[key] = [];
      slots[key].push(time);
    });
    res.json(slots);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/hanyoung/reservations/recent', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT name, date, time, service, status FROM hanyoung_reservations ORDER BY created_at DESC LIMIT 5'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/hanyoung/reservations', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM hanyoung_reservations ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hanyoung/reservations', async (req, res) => {
  try {
    const { name, phone, address, service, date, time } = req.body;
    if (!name || !phone || !service || !date || !time)
      return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });

    const [[closedRow]] = await pool.query(
      'SELECT id FROM closed_dates WHERE close_date = ?', [date]
    );
    if (closedRow)
      return res.status(409).json({ error: '해당 날짜는 예약 마감일입니다.' });

    const [[takenRow]] = await pool.query(
      "SELECT id FROM hanyoung_reservations WHERE date = ? AND time = ? AND status != 'cancelled'",
      [date, time]
    );
    if (takenRow)
      return res.status(409).json({ error: '해당 시간대는 이미 예약이 완료되었습니다.' });

    const [result] = await pool.query(
      'INSERT INTO hanyoung_reservations (name, phone, address, service, date, time) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone, address || null, service, date, time]
    );
    const svcNames = { stand:'가정용 스탠드 에어컨', multi:'2-in-1 멀티형', system:'천장형 4Way 시스템', system1way:'천장형 1Way 시스템' };
    const addressLine = address ? `\n상세주소   : ${address}` : '';
    const hyBody = `📋 한영 임직원 예약이 접수되었습니다\n` +
      `──────────────────────\n` +
      `고객명   : ${name}\n` +
      `연락처   : ${phone}` +
      `${addressLine}\n` +
      `서비스   : ${svcNames[service] || service}\n` +
      `예약 날짜 : ${date}\n` +
      `희망 시간 : ${time}\n` +
      `──────────────────────`;
    sendMail(`[한영 임직원] 새 예약 접수 - ${name} (${date})`, hyBody);
    sendWeb3Forms(`[한영 임직원] 새 예약 접수 - ${name} (${date})`, hyBody);
    const hySms = `[한영임직원] 예약접수\n${name} ${phone}\n${date} ${time}`;
    sendSMS(hySms, 'SMS');
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hanyoung/reservations/:id/status', auth, async (req, res) => {
  try {
    await pool.query('UPDATE hanyoung_reservations SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/hanyoung/reservations/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM hanyoung_reservations WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// COM RESERVATIONS
// =============================================
app.get('/api/com/reservations/booked-slots', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT date, time FROM com_reservations WHERE date >= CURDATE() AND status != 'cancelled'"
    );
    const slots = {};
    rows.forEach(({ date, time }) => {
      const key = date instanceof Date ? date.toISOString().slice(0,10) : String(date).slice(0,10);
      if (!slots[key]) slots[key] = [];
      slots[key].push(time);
    });
    res.json(slots);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/com/reservations/recent', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT name, date, time, service, status FROM com_reservations ORDER BY created_at DESC LIMIT 5'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/com/reservations', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM com_reservations ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/com/reservations', async (req, res) => {
  try {
    const { name, phone, address, service, date, time } = req.body;
    if (!name || !phone || !service || !date || !time)
      return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });

    const [[closedRow]] = await pool.query(
      'SELECT id FROM closed_dates WHERE close_date = ?', [date]
    );
    if (closedRow)
      return res.status(409).json({ error: '해당 날짜는 예약 마감일입니다.' });

    const [[takenRow]] = await pool.query(
      "SELECT id FROM com_reservations WHERE date = ? AND time = ? AND status != 'cancelled'",
      [date, time]
    );
    if (takenRow)
      return res.status(409).json({ error: '해당 시간대는 이미 예약이 완료되었습니다.' });

    const [result] = await pool.query(
      'INSERT INTO com_reservations (name, phone, address, service, date, time) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone, address || null, service, date, time]
    );
    const svcNames = { stand:'가정용 스탠드 에어컨', multi:'2-in-1 멀티형', system:'천장형 4Way 시스템', system1way:'천장형 1Way 시스템' };
    const addressLine = address ? `\n상세주소   : ${address}` : '';
    const coBody = `📋 임직원 예약이 접수되었습니다\n` +
      `──────────────────────\n` +
      `고객명   : ${name}\n` +
      `연락처   : ${phone}` +
      `${addressLine}\n` +
      `서비스   : ${svcNames[service] || service}\n` +
      `예약 날짜 : ${date}\n` +
      `희망 시간 : ${time}\n` +
      `──────────────────────`;
    sendMail(`[임직원] 새 예약 접수 - ${name} (${date})`, coBody);
    sendWeb3Forms(`[임직원] 새 예약 접수 - ${name} (${date})`, coBody);
    const coSms = `[임직원] 예약접수\n${name} ${phone}\n${date} ${time}`;
    sendSMS(coSms, 'SMS');
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/com/reservations/:id/status', auth, async (req, res) => {
  try {
    await pool.query('UPDATE com_reservations SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/com/reservations/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM com_reservations WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// REVIEWS
// =============================================
app.get('/api/reviews', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nickname, rating, ac_type, content, created_at FROM reviews WHERE is_approved = 1 ORDER BY created_at DESC LIMIT 30'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reviews/all', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { checklist_id, nickname, rating, ac_type, content } = req.body;
    if (!nickname || !content) return res.status(400).json({ error: '닉네임과 후기 내용은 필수입니다.' });
    const r = Math.min(5, Math.max(1, parseInt(rating) || 5));
    const [result] = await pool.query(
      'INSERT INTO reviews (checklist_id, nickname, rating, ac_type, content) VALUES (?,?,?,?,?)',
      [checklist_id || null, nickname.trim(), r, ac_type || null, content.trim()]
    );
    res.json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/reviews/:id/approve', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_approved FROM reviews WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });
    const next = rows[0].is_approved ? 0 : 1;
    await pool.query('UPDATE reviews SET is_approved = ? WHERE id = ?', [next, req.params.id]);
    res.json({ ok: true, is_approved: next });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reviews/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// CLOSED DATES (수동 마감 날짜)
// =============================================
app.get('/api/closed-dates', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT close_date, reason FROM closed_dates WHERE close_date >= DATE_FORMAT(CURDATE(), '%Y-%m-%d') ORDER BY close_date ASC"
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/closed-dates/all', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM closed_dates ORDER BY close_date ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/closed-dates', auth, async (req, res) => {
  try {
    const { close_date, reason } = req.body;
    if (!close_date) return res.status(400).json({ error: '날짜를 입력하세요.' });
    await pool.query(
      'INSERT INTO closed_dates (close_date, reason) VALUES (?, ?) ON DUPLICATE KEY UPDATE reason = ?',
      [close_date, reason || null, reason || null]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/closed-dates/:date', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM closed_dates WHERE close_date = ?', [req.params.date]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// 부정클릭 방지
// =============================================
const AD_CLICK_LIMIT = 5;   // 24시간 내 동일 IP 허용 클릭 수
const AD_CLICK_WINDOW_H = 24;

app.post('/api/ad-click', async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const { page, naver_keyword, naver_query } = req.body;
    const user_agent = (req.headers['user-agent'] || '').slice(0, 500);
    const referrer   = (req.headers['referer'] || '').slice(0, 500);

    // 이미 차단된 IP면 기록하지 않음
    const [[blocked]] = await pool.query(
      'SELECT id FROM blocked_ips WHERE ip = ? AND unblocked_at IS NULL', [ip]
    );
    if (blocked) return res.json({ ok: true, blocked: true });

    await pool.query(
      'INSERT INTO ad_clicks (ip, user_agent, referrer, page, naver_keyword, naver_query) VALUES (?,?,?,?,?,?)',
      [ip, user_agent, referrer, page || '/', naver_keyword || null, naver_query || null]
    );

    // 24시간 내 클릭 수 확인 → 초과 시 자동 차단
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM ad_clicks
       WHERE ip = ? AND clicked_at >= NOW() - INTERVAL ? HOUR`,
      [ip, AD_CLICK_WINDOW_H]
    );

    if (cnt >= AD_CLICK_LIMIT) {
      await pool.query(
        `INSERT INTO blocked_ips (ip, reason, click_count, is_auto)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           reason = VALUES(reason), click_count = VALUES(click_count),
           blocked_at = NOW(), unblocked_at = NULL`,
        [ip, `${AD_CLICK_WINDOW_H}시간 내 ${cnt}회 광고 클릭 자동 차단`, cnt]
      );
      // 해당 IP 클릭 로그 의심 표시
      await pool.query(
        'UPDATE ad_clicks SET is_suspicious = 1 WHERE ip = ?', [ip]
      );
      sendMail(
        `[클린앤파트너즈] 부정클릭 자동 차단 알림`,
        `⚠️ 부정클릭 의심 IP가 자동 차단되었습니다\n` +
        `──────────────────────\n` +
        `IP        : ${ip}\n` +
        `클릭 횟수 : ${cnt}회 (${AD_CLICK_WINDOW_H}시간 내)\n` +
        `마지막 페이지: ${page || '/'}\n` +
        `검색어    : ${naver_query || '-'}\n` +
        `──────────────────────`
      );
      return res.json({ ok: true, blocked: true, auto: true });
    }

    res.json({ ok: true, blocked: false, count: cnt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ad-clicks', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM ad_clicks ORDER BY clicked_at DESC LIMIT 500'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/blocked-ips', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM blocked_ips ORDER BY blocked_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/blocked-ips', auth, async (req, res) => {
  try {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP를 입력하세요.' });
    await pool.query(
      `INSERT INTO blocked_ips (ip, reason, is_auto)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), blocked_at = NOW(), unblocked_at = NULL`,
      [ip, reason || '수동 차단']
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/blocked-ips/:ip', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE blocked_ips SET unblocked_at = NOW() WHERE ip = ?',
      [req.params.ip]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================
// 검색엔진 필수 파일 (와일드카드 폴백보다 먼저 처리)
// =============================================
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// =============================================
// 클린 URL → 해당 HTML 파일 서빙 (200 직접 응답)
// =============================================
const cleanRoutes = {
  '/':            'index.html',
  '/services':    'services.html',
  '/reservation': 'reservation.html',
  '/estimate':    'estimate.html',
  '/gallery':     'gallery.html',
  '/about':       'about.html',
  '/contact':     'contact.html',
  '/privacy':     'privacy.html',
  '/care':        'care.html',
  '/admin':       'admin.html',
  '/hanyoung':    'hanyoung.html',
  '/com':         'com.html',
};
Object.entries(cleanRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
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
