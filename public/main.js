/**
 * 클린앤파트너즈 - 통합 관리 시스템 JavaScript (MySQL API 버전)
 */

// =============================================
// 0-A. API 헬퍼
// =============================================
const getToken = () => sessionStorage.getItem('adminToken');

const api = async (method, endpoint, body = null) => {
  const token = getToken();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${endpoint}`, opts);
  if (res.status === 401 && document.body.classList.contains('admin-body')) {
    adminLogout(); return null;
  }
  return res.ok ? res.json() : null;
};

// =============================================
// 0-B. Admin 인증 (SHA-256 + JWT)
// =============================================
const hashPassword = async (pw) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

window.adminLogin = async (e) => {
  e.preventDefault();
  const input   = document.getElementById('admin-password-input').value;
  const errorEl = document.getElementById('login-error');
  const hash    = await hashPassword(input);
  const data    = await api('POST', '/auth/login', { hash });
  if (data?.token) {
    sessionStorage.setItem('adminToken', data.token);
    document.getElementById('admin-login-overlay').style.display = 'none';
    document.getElementById('admin-main-container').style.display = 'flex';
    showSection('reservations');
  } else {
    errorEl.style.display = 'block';
    document.getElementById('admin-password-input').value = '';
    const card = document.querySelector('.login-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }
};

window.adminLogout = () => {
  sessionStorage.removeItem('adminToken');
  document.getElementById('admin-main-container').style.display = 'none';
  document.getElementById('admin-login-overlay').style.display = 'flex';
  document.getElementById('admin-password-input').value = '';
  document.getElementById('login-error').style.display = 'none';
};

window.togglePwVisibility = () => {
  const input = document.getElementById('admin-password-input');
  const icon  = document.getElementById('pw-eye-icon');
  const hide  = input.type === 'password';
  input.type  = hide ? 'text' : 'password';
  icon.className = hide ? 'fas fa-eye-slash' : 'fas fa-eye';
};

window.changeAdminPassword = async (e) => {
  e.preventDefault();
  const current   = document.getElementById('current-password').value;
  const newPw     = document.getElementById('new-password').value;
  const confirm   = document.getElementById('confirm-password').value;
  const errorEl   = document.getElementById('pw-change-error');
  const successEl = document.getElementById('pw-change-success');
  errorEl.style.display = 'none'; successEl.style.display = 'none';

  if (newPw !== confirm) { errorEl.textContent = '새 비밀번호가 일치하지 않습니다.'; return (errorEl.style.display = 'block'); }
  if (newPw.length < 4)  { errorEl.textContent = '비밀번호는 4자 이상이어야 합니다.'; return (errorEl.style.display = 'block'); }

  const currentHash = await hashPassword(current);
  const newHash     = await hashPassword(newPw);
  const result = await api('PUT', '/auth/password', { currentHash, newHash });
  if (result?.ok) { successEl.style.display = 'block'; e.target.reset(); }
  else { errorEl.textContent = '현재 비밀번호가 올바르지 않습니다.'; errorEl.style.display = 'block'; }
};

// =============================================
// 1. Admin 섹션 전환
// =============================================
window.showSection = (sectionId) => {
  const sections = ['reservations','banners','mid-banners','res-banners','svc-banners','about-banners','process','contacts','security'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    const menu = document.getElementById(`menu-${s}`);
    if (el)   el.style.display = (s === sectionId) ? 'block' : 'none';
    if (menu) menu.classList.toggle('active', s === sectionId);
  });
  if      (sectionId === 'reservations')  renderReservationTable();
  else if (sectionId === 'banners')       renderBannerTable('hero',  'bannerTableBody');
  else if (sectionId === 'mid-banners')   renderBannerTable('mid',   'midBannerTableBody');
  else if (sectionId === 'res-banners')   renderBannerTable('res',   'resBannerTableBody');
  else if (sectionId === 'svc-banners')   renderBannerTable('svc',   'svcBannerTableBody');
  else if (sectionId === 'about-banners') renderBannerTable('about', 'aboutBannerTableBody');
  else if (sectionId === 'process')       renderProcessEditForm();
  else if (sectionId === 'contacts')      renderContactTable();
};

// =============================================
// 2. 예약 현황
// =============================================
window.renderReservationTable = async () => {
  const body          = document.getElementById('reservationTableBody');
  const totalCount    = document.getElementById('totalCount');
  const pendingCount  = document.getElementById('pendingCount');
  const confirmedCount= document.getElementById('confirmedCount');
  const noDataMessage = document.getElementById('noDataMessage');
  if (!body) return;

  const reservations = await api('GET', '/reservations') || [];
  if (totalCount)     totalCount.textContent     = `${reservations.length}건`;
  if (pendingCount)   pendingCount.textContent   = `${reservations.filter(r=>r.status==='pending').length}건`;
  if (confirmedCount) confirmedCount.textContent = `${reservations.filter(r=>r.status==='confirmed').length}건`;

  body.innerHTML = '';
  if (reservations.length === 0) { if (noDataMessage) noDataMessage.style.display = 'block'; return; }
  if (noDataMessage) noDataMessage.style.display = 'none';

  const serviceMap = { wall:'벽걸이형', stand:'스탠드형', multi:'2-in-1 멀티', system:'시스템 천장형' };
  reservations.forEach(res => {
    const tr = document.createElement('tr');
    const applyDate = res.created_at ? String(res.created_at).split('T')[0] : '-';
    tr.innerHTML = `
      <td class="text-muted">${applyDate}</td>
      <td class="col-time"><span class="text-bold text-primary">${res.date}</span><small>${res.time}</small></td>
      <td class="text-bold">${res.name}</td>
      <td>${res.phone}</td>
      <td><span class="service-tag">${serviceMap[res.service]||res.service}</span></td>
      <td><span class="badge ${res.status}">${res.status==='pending'?'대기':res.status==='confirmed'?'확정':'취소'}</span></td>
      <td><div class="btn-group">
        ${res.status==='pending'?`<button class="btn-action btn-approve" onclick="updateStatus(${res.id},'confirmed')" title="확정"><i class="fas fa-check"></i></button>`:''}
        ${res.status!=='cancelled'?`<button class="btn-action btn-cancel" onclick="updateStatus(${res.id},'cancelled')" title="취소"><i class="fas fa-times"></i></button>`:''}
        <button class="btn-action btn-delete" onclick="deleteReservation(${res.id})" title="삭제"><i class="fas fa-trash"></i></button>
      </div></td>`;
    body.appendChild(tr);
  });
};

window.updateStatus = async (id, status) => {
  await api('PUT', `/reservations/${id}/status`, { status });
  renderReservationTable();
};
window.deleteReservation = async (id) => {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await api('DELETE', `/reservations/${id}`);
  renderReservationTable();
};

// =============================================
// 3. 배너 Admin (5종 공통)
// =============================================
window.renderBannerTable = async (type, bodyId) => {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const items = await api('GET', `/banners/${type}`) || [];
  const cols = type === 'mid' ? 4 : 3;
  body.innerHTML = items.length === 0 ? `<tr><td colspan="${cols}" class="no-data">등록된 배너가 없습니다.</td></tr>` : '';
  items.forEach((item, index) => {
    const tr = document.createElement('tr');
    if (type === 'mid') {
      const num = String(index + 1).padStart(2, '0');
      const statTags = [
        item.total_units   ? `<span style="font-size:0.72rem;background:#e8f0fe;color:#004499;padding:2px 7px;border-radius:4px;">총대수: ${item.total_units}</span>`   : '',
        item.time_required ? `<span style="font-size:0.72rem;background:#e8f0fe;color:#004499;padding:2px 7px;border-radius:4px;">소요시간: ${item.time_required}</span>` : '',
        item.manpower      ? `<span style="font-size:0.72rem;background:#e8f0fe;color:#004499;padding:2px 7px;border-radius:4px;">투입인원: ${item.manpower}</span>`      : '',
        item.work_date     ? `<span style="font-size:0.72rem;background:#e8f0fe;color:#004499;padding:2px 7px;border-radius:4px;">소요일자: ${item.work_date}</span>`     : ''
      ].filter(Boolean).join(' ');
      tr.innerHTML = `
        <td style="text-align:center;font-size:1.4rem;font-weight:900;color:var(--primary);letter-spacing:-0.02em;">${num}</td>
        <td class="banner-thumb-cell"><img src="${item.image_url||''}" class="banner-thumb-img" onerror="this.alt='이미지 없음';"></td>
        <td class="banner-info-cell">
          ${item.company_name ? `<span style="font-size:0.78rem;color:#888;display:block;margin-bottom:2px;">업체명: ${item.company_name}</span>` : ''}
          <strong style="display:block;">${item.title}</strong>
          <small style="display:block;margin-bottom:4px;">${item.description||''}</small>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">${statTags}</div>
        </td>
        <td><div class="btn-group">
          <button class="btn-action btn-approve" onclick="editBanner('${type}',${item.id})" title="수정"><i class="fas fa-edit"></i></button>
          <button class="btn-action btn-delete"  onclick="deleteBanner('${type}',${item.id})" title="삭제"><i class="fas fa-trash"></i></button>
        </div></td>`;
    } else {
      const badgeHtml = item.badge ? `<span style="display:inline-block;background:var(--primary);color:#fff;font-size:0.7rem;font-weight:800;padding:2px 8px;border-radius:4px;margin-bottom:4px;">${item.badge}</span>` : '';
      tr.innerHTML = `
        <td class="banner-thumb-cell"><img src="${item.image_url||''}" class="banner-thumb-img" onerror="this.alt='이미지 없음';"></td>
        <td class="banner-info-cell">${badgeHtml}<strong style="display:block;">${item.title}</strong><small>${item.description||''}</small></td>
        <td><div class="btn-group">
          <button class="btn-action btn-approve" onclick="editBanner('${type}',${item.id})" title="수정"><i class="fas fa-edit"></i></button>
          <button class="btn-action btn-delete"  onclick="deleteBanner('${type}',${item.id})" title="삭제"><i class="fas fa-trash"></i></button>
        </div></td>`;
    }
    body.appendChild(tr);
  });
};

const bannerFormMap = {
  hero:  { form:'bannerForm',      editId:'bannerEditId',       badge:'',                title:'bannerTitle',       desc:'bannerDesc',       url:'bannerUrl',       btnText:'bannerBtnText',   btnLink:'bannerBtnLink',   submitBtn:'bannerSubmitBtn',       cancelBtn:'bannerCancelBtn',       tableBody:'bannerTableBody' },
  mid:   { form:'midBannerForm',   editId:'midBannerEditId',    badge:'',                title:'midBannerTitle',    desc:'midBannerDesc',    url:'midBannerUrl',    btnText:'',                btnLink:'',                submitBtn:'midBannerSubmitBtn',    cancelBtn:'midBannerCancelBtn',    tableBody:'midBannerTableBody',
           companyName:'midBannerCompany', totalUnits:'midBannerTotalUnits', timeRequired:'midBannerTimeRequired', manpower:'midBannerManpower', workDate:'midBannerWorkDate' },
  res:   { form:'resBannerForm',   editId:'resBannerEditId',    badge:'resBannerBadge',  title:'resBannerTitle',    desc:'resBannerDesc',    url:'resBannerUrl',    btnText:'',                btnLink:'',                submitBtn:'resBannerSubmitBtn',    cancelBtn:'resBannerCancelBtn',    tableBody:'resBannerTableBody' },
  svc:   { form:'svcBannerForm',   editId:'svcBannerEditId',    badge:'svcBannerBadge',  title:'svcBannerTitle',    desc:'svcBannerDesc',    url:'svcBannerUrl',    btnText:'',                btnLink:'',                submitBtn:'svcBannerSubmitBtn',    cancelBtn:'svcBannerCancelBtn',    tableBody:'svcBannerTableBody' },
  about: { form:'aboutBannerForm', editId:'aboutBannerEditId',  badge:'aboutBannerBadge',title:'aboutBannerTitle',  desc:'aboutBannerDesc',  url:'aboutBannerUrl',  btnText:'',                btnLink:'',                submitBtn:'aboutBannerSubmitBtn',  cancelBtn:'aboutBannerCancelBtn',  tableBody:'aboutBannerTableBody' }
};

const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v||''; };

window.handleBannerSubmit = async (e, type) => {
  e.preventDefault();
  const m = bannerFormMap[type];
  const editId = getVal(m.editId);
  const payload = { badge: getVal(m.badge), title: getVal(m.title), description: getVal(m.desc), image_url: getVal(m.url), btn_text: getVal(m.btnText), btn_link: getVal(m.btnLink) };
  if (type === 'mid') {
    payload.company_name  = getVal(m.companyName);
    payload.total_units   = getVal(m.totalUnits);
    payload.time_required = getVal(m.timeRequired);
    payload.manpower      = getVal(m.manpower);
    payload.work_date     = getVal(m.workDate);
  }
  if (editId) { await api('PUT', `/banners/${type}/${editId}`, payload); alert('수정되었습니다.'); }
  else        { await api('POST', `/banners/${type}`, payload);          alert('등록되었습니다.'); }
  cancelBannerEdit(type);
  renderBannerTable(type, m.tableBody);
};

window.editBanner = async (type, id) => {
  const items = await api('GET', `/banners/${type}`) || [];
  const item  = items.find(i => i.id === id);
  if (!item) return;
  const m = bannerFormMap[type];
  setVal(m.editId, item.id);
  if (m.badge)   setVal(m.badge,   item.badge);
  setVal(m.title, item.title); setVal(m.desc, item.description); setVal(m.url, item.image_url);
  if (m.btnText) setVal(m.btnText, item.btn_text);
  if (m.btnLink) setVal(m.btnLink, item.btn_link);
  if (type === 'mid') {
    setVal(m.companyName,  item.company_name);
    setVal(m.totalUnits,   item.total_units);
    setVal(m.timeRequired, item.time_required);
    setVal(m.manpower,     item.manpower);
    setVal(m.workDate,     item.work_date);
  }
  const btn = document.getElementById(m.submitBtn); if (btn) btn.textContent = '배너 수정 저장';
  const cancel = document.getElementById(m.cancelBtn); if (cancel) cancel.style.display = 'inline-block';
  document.getElementById(m.form)?.scrollIntoView({ behavior: 'smooth' });
};

window.cancelBannerEdit = (type) => {
  const m = bannerFormMap[type];
  setVal(m.editId, '');
  document.getElementById(m.form)?.reset();
  const btn = document.getElementById(m.submitBtn); if (btn) btn.textContent = '배너 등록하기';
  const cancel = document.getElementById(m.cancelBtn); if (cancel) cancel.style.display = 'none';
};

window.deleteBanner = async (type, id) => {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await api('DELETE', `/banners/${type}/${id}`);
  renderBannerTable(type, bannerFormMap[type].tableBody);
};

// Admin onsubmit 핸들러 래핑
window.handleBannerSubmitHero  = (e) => handleBannerSubmit(e, 'hero');
window.handleMidBannerSubmit   = (e) => handleBannerSubmit(e, 'mid');
window.handleResBannerSubmit   = (e) => handleBannerSubmit(e, 'res');
window.handleSvcBannerSubmit   = (e) => handleBannerSubmit(e, 'svc');
window.handleAboutBannerSubmit = (e) => handleBannerSubmit(e, 'about');
window.cancelResBannerEdit     = () => cancelBannerEdit('res');
window.cancelSvcBannerEdit     = () => cancelBannerEdit('svc');
window.cancelAboutBannerEdit   = () => cancelBannerEdit('about');
window.editResBanner   = (id) => editBanner('res',   id);
window.editSvcBanner   = (id) => editBanner('svc',   id);
window.editAboutBanner = (id) => editBanner('about', id);
window.deleteResBanner   = (id) => deleteBanner('res',   id);
window.deleteSvcBanner   = (id) => deleteBanner('svc',   id);
window.deleteAboutBanner = (id) => deleteBanner('about', id);

// =============================================
// 4. 상담 문의
// =============================================
window.renderContactTable = async () => {
  const body      = document.getElementById('contactTableBody');
  const total     = document.getElementById('contactTotalCount');
  const unread    = document.getElementById('contactUnreadCount');
  const readCount = document.getElementById('contactReadCount');
  const noMsg     = document.getElementById('noContactMessage');
  if (!body) return;

  const contacts = await api('GET', '/contacts') || [];
  if (total)     total.textContent     = `${contacts.length}건`;
  if (unread)    unread.textContent    = `${contacts.filter(c=>!c.is_read).length}건`;
  if (readCount) readCount.textContent = `${contacts.filter(c=>c.is_read).length}건`;

  body.innerHTML = '';
  if (contacts.length === 0) { if (noMsg) noMsg.style.display = 'block'; return; }
  if (noMsg) noMsg.style.display = 'none';

  contacts.forEach(c => {
    const tr = document.createElement('tr');
    const dt = c.created_at ? String(c.created_at).replace('T',' ').slice(0,16) : '-';
    tr.innerHTML = `
      <td class="text-muted" style="white-space:nowrap;">${dt}</td>
      <td class="text-bold">${c.name}</td>
      <td>${c.phone}</td>
      <td class="contact-message-cell">${c.message}</td>
      <td><span class="badge ${c.is_read?'confirmed':'pending'}">${c.is_read?'확인완료':'미확인'}</span></td>
      <td><div class="btn-group">
        ${!c.is_read?`<button class="btn-action btn-approve" onclick="markContactRead(${c.id})" title="확인완료"><i class="fas fa-check"></i></button>`:''}
        <button class="btn-action btn-delete" onclick="deleteContact(${c.id})" title="삭제"><i class="fas fa-trash"></i></button>
      </div></td>`;
    body.appendChild(tr);
  });
};

window.markContactRead = async (id) => { await api('PUT', `/contacts/${id}/read`); renderContactTable(); };
window.deleteContact   = async (id) => { if (!confirm('정말 삭제하시겠습니까?')) return; await api('DELETE', `/contacts/${id}`); renderContactTable(); };

// =============================================
// 5. 공정 관리
// =============================================
window.renderProcessEditForm = async () => {
  const container = document.getElementById('process-steps-edit-container');
  if (!container) return;
  const data = await api('GET', '/process') || [];
  container.innerHTML = '';
  data.forEach((step, index) => {
    const div = document.createElement('div');
    div.className = 'process-edit-card';
    div.innerHTML = `
      <h4>STEP 0${index+1}</h4>
      <div class="input-group"><label>제목</label><input type="text" class="proc-title" value="${step.title}"></div>
      <div class="input-group"><label>이미지 URL</label><input type="url" class="proc-url" value="${step.image_url||''}"></div>
      <div class="input-group"><label>설명</label><input type="text" class="proc-desc" value="${step.description||''}"></div>
      <div class="input-group"><label>아이콘(FA)</label><input type="text" class="proc-icon" value="${step.icon||''}"></div>`;
    container.appendChild(div);
  });
};

window.handleProcessSubmit = async (e) => {
  e.preventDefault();
  const steps = [];
  document.querySelectorAll('.process-edit-card').forEach((card, i) => {
    steps.push({ step_order: i+1, title: card.querySelector('.proc-title').value, image_url: card.querySelector('.proc-url').value, description: card.querySelector('.proc-desc').value, icon: card.querySelector('.proc-icon').value });
  });
  await api('PUT', '/process', { steps });
  alert('공정 정보가 저장되었습니다.');
};

// 6. 이메일 알림 (Web3Forms - 브라우저에서 직접 호출)
const WEB3FORMS_ACCESS_KEY = '962f5bff-992d-4cc2-b8bf-0b4966759efa';
const sendEmailNotification = (subject, html) => {
  fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_key: WEB3FORMS_ACCESS_KEY, subject, message: html, from_name: '클린앤파트너즈 알림' })
  }).catch(err => console.error('[Web3Forms]', err));
};

// =============================================
// 7. 공통 배너 슬라이더
// =============================================
const renderBannerSlider = (items, containerId, dotsId, prevId, nextId) => {
  const container     = document.getElementById(containerId);
  const dotsContainer = document.getElementById(dotsId);
  const prevBtn       = document.getElementById(prevId);
  const nextBtn       = document.getElementById(nextId);
  if (!container) return;

  container.innerHTML = '';
  if (dotsContainer) dotsContainer.innerHTML = '';
  const isHero = containerId === 'hero-slider-container';
  const isMid  = containerId === 'mid-slider-container';

  items.forEach((item, index) => {
    const slide = document.createElement('div');
    slide.classList.add((isHero || isMid) ? 'slide' : 'res-banner-slide');
    if (index === 0) slide.classList.add('active');
    if (isHero) {
      slide.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('${item.image_url||''}')`;
      slide.innerHTML = `<div class="hero-content"><h2>${item.title}</h2><p>${item.description||''}</p>${item.btn_text?`<div class="hero-btns"><a href="${item.btn_link||'#'}" class="btn">${item.btn_text}</a></div>`:''}</div>`;
    } else if (isMid) {
      const num = String(index + 1).padStart(2, '0');
      slide.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.58),rgba(0,0,0,0.58)),url('${item.image_url||''}')`;
      slide.style.backgroundSize = 'cover';
      slide.style.backgroundPosition = 'center';
      const statsHtml = [
        item.total_units   ? `<div class="mid-stat-item"><span class="mid-stat-label">총대수</span><span class="mid-stat-value">${item.total_units}</span></div>`   : '',
        item.time_required ? `<div class="mid-stat-item"><span class="mid-stat-label">소요시간</span><span class="mid-stat-value">${item.time_required}</span></div>` : '',
        item.manpower      ? `<div class="mid-stat-item"><span class="mid-stat-label">투입인원</span><span class="mid-stat-value">${item.manpower}</span></div>`      : '',
        item.work_date     ? `<div class="mid-stat-item"><span class="mid-stat-label">소요일자</span><span class="mid-stat-value">${item.work_date}</span></div>`     : ''
      ].join('');
      slide.innerHTML = `
        <div class="mid-slide-content">
          <div class="mid-slide-number">${num}</div>
          <div class="mid-slide-info">
            ${item.company_name ? `<div class="mid-slide-company">${item.company_name}</div>` : ''}
            <h2 class="mid-slide-title">${item.title}</h2>
            ${item.description ? `<p class="mid-slide-desc">${item.description}</p>` : ''}
            ${statsHtml ? `<div class="mid-slide-stats">${statsHtml}</div>` : ''}
          </div>
        </div>`;
    } else {
      slide.style.backgroundImage = `linear-gradient(to right,rgba(0,0,0,0.65) 40%,rgba(0,0,0,0.25)),url('${item.image_url||''}')`;
      slide.innerHTML = `<div class="res-banner-content">${item.badge?`<span class="res-banner-badge">${item.badge}</span>`:''}<h4>${item.title}</h4><p>${item.description||''}</p></div>`;
    }
    container.appendChild(slide);

    if (dotsContainer) {
      const dot = document.createElement('span');
      dot.classList.add('dot');
      if (index === 0) dot.classList.add('active');
      dot.dataset.index = index;
      dotsContainer.appendChild(dot);
    }
  });

  const slides = container.querySelectorAll((isHero || isMid) ? '.slide' : '.res-banner-slide');
  const dots   = dotsContainer ? dotsContainer.querySelectorAll('.dot') : [];
  let current  = 0, timer;

  const showSlide = (idx) => {
    slides.forEach(s => s.classList.remove('active')); dots.forEach(d => d.classList.remove('active'));
    if (slides[idx]) { slides[idx].classList.add('active'); current = idx; }
    if (dots[idx])   dots[idx].classList.add('active');
  };
  const next  = () => showSlide((current + 1) % slides.length);
  const prev  = () => showSlide((current - 1 + slides.length) % slides.length);
  const start = () => { clearInterval(timer); if (slides.length > 1) timer = setInterval(next, isHero ? 5000 : 4000); };

  if (nextBtn) nextBtn.addEventListener('click', () => { next(); start(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); start(); });
  if (dotsContainer) dotsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('dot')) { showSlide(parseInt(e.target.dataset.index)); start(); }
  });
  start();
};

// =============================================
// 8. DOMContentLoaded
// =============================================
document.addEventListener('DOMContentLoaded', async () => {

  // 내비게이션
  const menuToggle = document.getElementById('mobile-menu');
  const navMenu    = document.querySelector('.nav-menu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => { menuToggle.classList.toggle('active'); navMenu.classList.toggle('active'); });
    document.querySelectorAll('.nav-menu a').forEach(link => {
      link.addEventListener('click', () => { if (navMenu.classList.contains('active')) { menuToggle.classList.remove('active'); navMenu.classList.remove('active'); } });
    });
  }
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.padding   = window.scrollY > 50 ? '0.8rem 5%' : '1.2rem 5%';
      header.style.boxShadow = window.scrollY > 50 ? '0 2px 10px rgba(0,0,0,0.1)' : 'none';
    });
  }

  // 슬라이더들 병렬 로드
  const sliderConfigs = [
    { id: 'hero-slider-container',  type: 'hero',  dots:'hero-slider-dots',  prev:'hero-prev',         next:'hero-next' },
    { id: 'mid-slider-container',   type: 'mid',   dots:'mid-slider-dots',   prev:'mid-prev',          next:'mid-next' },
    { id: 'res-banner-container',   type: 'res',   dots:'res-banner-dots',   prev:'res-banner-prev',   next:'res-banner-next' },
    { id: 'svc-banner-container',   type: 'svc',   dots:'svc-banner-dots',   prev:'svc-banner-prev',   next:'svc-banner-next' },
    { id: 'about-banner-container', type: 'about', dots:'about-banner-dots', prev:'about-banner-prev', next:'about-banner-next' }
  ];
  await Promise.all(sliderConfigs.map(async cfg => {
    if (!document.getElementById(cfg.id)) return;
    const data = await api('GET', `/banners/${cfg.type}`) || [];
    renderBannerSlider(data, cfg.id, cfg.dots, cfg.prev, cfg.next);
  }));

  // 6단계 공정 (index.html)
  const processDisplay = document.getElementById('process-display-container');
  if (processDisplay) {
    const data = await api('GET', '/process') || [];
    processDisplay.innerHTML = '';
    data.forEach((step, i) => {
      const box = document.createElement('div');
      box.classList.add('process-step-box');
      box.innerHTML = `
        <div class="step-badge">STEP 0${i+1}</div>
        <div class="step-img-wrapper"><img src="${step.image_url||''}" alt="${step.title}"></div>
        <div class="step-icon"><i class="fas ${step.icon||''}"></i></div>
        <h4>${step.title}</h4><p>${step.description||''}</p>`;
      processDisplay.appendChild(box);
    });
  }

  // 실시간 예약 현황 롤링
  const liveList = document.getElementById('live-reservation-list');
  if (liveList) {
    const reservations = await api('GET', '/reservations/recent') || [];
    if (reservations.length === 0) {
      liveList.innerHTML = '<div style="padding:3rem;text-align:center;color:#999;width:100%;">현재 접수된 예약 내역이 없습니다.</div>';
      liveList.style.animation = 'none';
    } else {
      const display = [...reservations, ...reservations];
      liveList.innerHTML = '';
      const serviceMap = { wall:'벽걸이', stand:'스탠드', multi:'2-in-1', system:'시스템' };
      display.forEach(res => {
        const masked = res.name.length > 2
          ? res.name[0] + '*'.repeat(res.name.length-2) + res.name[res.name.length-1]
          : res.name[0] + '*';
        const item = document.createElement('div');
        item.classList.add('rolling-item');
        item.innerHTML = `
          <div class="col">${res.date}</div>
          <div class="col"><span class="status-badge ${res.status==='confirmed'?'confirmed':'pending'}">${res.status==='confirmed'?'예약확정':'접수완료'}</span></div>
          <div class="col">${masked}</div>
          <div class="col">-</div>
          <div class="col">${serviceMap[res.service]||res.service}</div>`;
        liveList.appendChild(item);
      });
      liveList.style.animation = `rollUp ${reservations.length*4}s linear infinite`;
    }
  }

  // 예약 달력
  const calendarDaysGrid = document.getElementById('calendarDays');
  if (calendarDaysGrid) {
    const calendarTitle      = document.getElementById('calendarTitle');
    const prevMonthBtn       = document.getElementById('prevMonthBtn');
    const nextMonthBtn       = document.getElementById('nextMonthBtn');
    const bookingFormSection = document.getElementById('bookingFormSection');
    const displaySelected    = document.getElementById('displaySelectedDate');
    const inputSelected      = document.getElementById('inputSelectedDate');
    let viewDate = new Date();
    const today  = new Date(); today.setHours(0,0,0,0);

    const renderCalendar = () => {
      calendarDaysGrid.innerHTML = '';
      const year = viewDate.getFullYear(), month = viewDate.getMonth();
      if (calendarTitle) calendarTitle.textContent = `${year}년 ${month+1}월`;
      const firstDay = new Date(year, month, 1).getDay();
      const lastDay  = new Date(year, month+1, 0).getDate();
      for (let i = 0; i < firstDay; i++) {
        const e = document.createElement('div'); e.classList.add('day-cell','empty'); calendarDaysGrid.appendChild(e);
      }
      for (let day = 1; day <= lastDay; day++) {
        const cell = document.createElement('div');
        cell.classList.add('day-cell');
        const date = new Date(year, month, day);
        const isPast = date < today;
        cell.innerHTML = `<span class="day-num">${day}</span><span class="day-status ${isPast?'past':'avail'}">${isPast?'종료':'가능'}</span>`;
        if (date.getTime()===today.getTime()) cell.classList.add('today');
        if (isPast) { cell.classList.add('disabled'); }
        else {
          cell.addEventListener('click', () => {
            document.querySelectorAll('.day-cell').forEach(c=>c.classList.remove('active'));
            cell.classList.add('active');
            if (displaySelected) displaySelected.textContent = `${year}년 ${month+1}월 ${day}일`;
            if (inputSelected)   inputSelected.value = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            if (bookingFormSection) { bookingFormSection.style.display='block'; bookingFormSection.scrollIntoView({behavior:'smooth'}); }
          });
        }
        calendarDaysGrid.appendChild(cell);
      }
    };
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()-1); if(bookingFormSection) bookingFormSection.style.display='none'; renderCalendar(); });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()+1); if(bookingFormSection) bookingFormSection.style.display='none'; renderCalendar(); });
    renderCalendar();
  }

  // 예약 폼 제출
  const bookingForm = document.getElementById('realtimeBookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(bookingForm);
      const d  = Object.fromEntries(fd.entries());
      const result = await api('POST', '/reservations', { name:d.user_name, phone:d.user_phone, service:d.service_type, date:d.selected_date, time:d.booking_time });
      if (!result) return alert('예약 접수 중 오류가 발생했습니다.');
      const svcNames = { wall:'벽걸이 에어컨', stand:'스탠드 에어컨', multi:'2-in-1 멀티형', system:'천장형 시스템' };
      sendEmailNotification(
        `[클린앤파트너즈] 새 예약 접수 - ${d.user_name} (${d.selected_date})`,
        `<table style="width:100%;max-width:500px;border-collapse:collapse;font-family:sans-serif;font-size:15px;">
          <tr><td colspan="2" style="background:#1a56db;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold;">📋 새 예약이 접수되었습니다</td></tr>
          <tr><td style="padding:12px 20px;border-bottom:1px solid #eee;color:#555;width:35%;">고객명</td><td style="padding:12px 20px;border-bottom:1px solid #eee;font-weight:bold;">${d.user_name}</td></tr>
          <tr><td style="padding:12px 20px;border-bottom:1px solid #eee;color:#555;">연락처</td><td style="padding:12px 20px;border-bottom:1px solid #eee;">${d.user_phone}</td></tr>
          <tr><td style="padding:12px 20px;border-bottom:1px solid #eee;color:#555;">서비스</td><td style="padding:12px 20px;border-bottom:1px solid #eee;">${svcNames[d.service_type]||d.service_type}</td></tr>
          <tr><td style="padding:12px 20px;border-bottom:1px solid #eee;color:#555;">예약 날짜</td><td style="padding:12px 20px;border-bottom:1px solid #eee;font-weight:bold;color:#1a56db;">${d.selected_date}</td></tr>
          <tr><td style="padding:12px 20px;color:#555;">희망 시간</td><td style="padding:12px 20px;">${d.booking_time}</td></tr>
        </table>`
      );
      alert('예약이 성공적으로 접수되었습니다!');
      bookingForm.reset();
      const sec = document.getElementById('bookingFormSection');
      if (sec) sec.style.display = 'none';
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }

  // 상담 문의 폼
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(contactForm);
      const d  = { name: fd.get('name'), phone: fd.get('phone'), message: fd.get('message') };
      const result = await api('POST', '/contacts', d);
      if (!result) return alert('문의 접수 중 오류가 발생했습니다.');
      sendEmailNotification(
        `[클린앤파트너즈] 새 문의 접수 - ${d.name}`,
        `<table style="width:100%;max-width:500px;border-collapse:collapse;font-family:sans-serif;font-size:15px;">
          <tr><td colspan="2" style="background:#0e9f6e;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold;">💬 새 문의가 접수되었습니다</td></tr>
          <tr><td style="padding:12px 20px;border-bottom:1px solid #eee;color:#555;width:35%;">고객명</td><td style="padding:12px 20px;border-bottom:1px solid #eee;font-weight:bold;">${d.name}</td></tr>
          <tr><td style="padding:12px 20px;border-bottom:1px solid #eee;color:#555;">연락처</td><td style="padding:12px 20px;border-bottom:1px solid #eee;">${d.phone}</td></tr>
          <tr><td style="padding:12px 20px;color:#555;">문의 내용</td><td style="padding:12px 20px;white-space:pre-wrap;">${d.message}</td></tr>
        </table>`
      );
      contactForm.style.display = 'none';
      const successEl = document.getElementById('contact-success');
      if (successEl) successEl.style.display = 'block';
      contactForm.reset();
    });
  }

  // =============================================
  // 서울 서비스 지역 지도
  // =============================================
  const districtGroup = document.getElementById('district-group');
  const mapTooltip   = document.getElementById('map-tooltip');
  const seoulMap     = document.getElementById('seoul-map');

  // 툴팁 클릭/터치 → 예약 페이지 이동
  if (mapTooltip) {
    mapTooltip.addEventListener('click', () => {
      window.location.href = 'reservation.html';
    });
    mapTooltip.addEventListener('touchend', (e) => {
      e.preventDefault();
      window.location.href = 'reservation.html';
    }, { passive: false });
  }

  if (districtGroup && seoulMap) {
    // 지역별 색상
    const REGION_STYLE = {
      seoul:    { fill: '#1d4ed8' },
      incheon:  { fill: '#0284c7' },
      gyeonggi: { fill: '#059669' },
    };
    // 뱃지 공통 치수 (SVG 단위, viewBox 720×560 기준, font-size 10px 기준)
    const BADGE = { charW: 11, padX: 7, padY: 5, lineH: 12, rx: 6 };

    // 서울 (viewBox 720×560, 원본 480×440 → ×0.75 + offset 270,80)
    // 인천·경기 – 직접 좌표 지정
    const DISTRICTS = [
      // ── 서울 25개 구 ──────────────────────────────
      { name: '강북구',   cx: 428, cy: 112, region: 'seoul' },
      { name: '도봉구',   cx: 480, cy: 104, region: 'seoul' },
      { name: '노원구',   cx: 540, cy: 109, region: 'seoul' },
      { name: '은평구',   cx: 329, cy: 161, region: 'seoul' },
      { name: '성북구',   cx: 454, cy: 154, region: 'seoul' },
      { name: '중랑구',   cx: 557, cy: 161, region: 'seoul' },
      { name: '서대문구', cx: 364, cy: 209, region: 'seoul' },
      { name: '종로구',   cx: 428, cy: 202, region: 'seoul' },
      { name: '동대문구', cx: 491, cy: 200, region: 'seoul' },
      { name: '광진구',   cx: 551, cy: 209, region: 'seoul' },
      { name: '강서구',   cx: 303, cy: 249, region: 'seoul' },
      { name: '마포구',   cx: 351, cy: 241, region: 'seoul' },
      { name: '용산구',   cx: 428, cy: 254, region: 'seoul' },
      { name: '중구',     cx: 434, cy: 229, region: 'seoul' },
      { name: '성동구',   cx: 499, cy: 244, region: 'seoul' },
      { name: '영등포구', cx: 351, cy: 304, region: 'seoul' },
      { name: '양천구',   cx: 305, cy: 312, region: 'seoul' },
      { name: '동작구',   cx: 409, cy: 320, region: 'seoul' },
      { name: '서초구',   cx: 471, cy: 334, region: 'seoul' },
      { name: '강남구',   cx: 534, cy: 322, region: 'seoul' },
      { name: '강동구',   cx: 587, cy: 296, region: 'seoul' },
      { name: '송파구',   cx: 563, cy: 361, region: 'seoul' },
      { name: '구로구',   cx: 332, cy: 352, region: 'seoul' },
      { name: '관악구',   cx: 404, cy: 369, region: 'seoul' },
      { name: '금천구',   cx: 341, cy: 386, region: 'seoul' },
      // ── 인천 8개 구 ──────────────────────────────
      { name: '계양구',   cx: 196, cy: 148, region: 'incheon' },
      { name: '서구',     cx: 100, cy: 168, region: 'incheon' },
      { name: '부평구',   cx: 158, cy: 195, region: 'incheon' },
      { name: '동구',     cx: 70,  cy: 248, region: 'incheon' },
      { name: '중구',     cx: 52,  cy: 278, region: 'incheon' },
      { name: '미추홀구', cx: 100, cy: 305, region: 'incheon' },
      { name: '남동구',   cx: 152, cy: 348, region: 'incheon' },
      { name: '연수구',   cx: 88,  cy: 383, region: 'incheon' },
      // ── 경기도 주요 시·군 ──────────────────────────
      { name: '파주시',   cx: 210, cy: 68,  region: 'gyeonggi' },
      { name: '고양시',   cx: 265, cy: 100, region: 'gyeonggi' },
      { name: '김포시',   cx: 182, cy: 115, region: 'gyeonggi' },
      { name: '의정부시', cx: 487, cy: 62,  region: 'gyeonggi' },
      { name: '양주시',   cx: 525, cy: 40,  region: 'gyeonggi' },
      { name: '동두천시', cx: 563, cy: 20,  region: 'gyeonggi' },
      { name: '남양주시', cx: 625, cy: 88,  region: 'gyeonggi' },
      { name: '구리시',   cx: 622, cy: 142, region: 'gyeonggi' },
      { name: '부천시',   cx: 248, cy: 272, region: 'gyeonggi' },
      { name: '광명시',   cx: 278, cy: 360, region: 'gyeonggi' },
      { name: '시흥시',   cx: 215, cy: 420, region: 'gyeonggi' },
      { name: '안산시',   cx: 148, cy: 458, region: 'gyeonggi' },
      { name: '안양시',   cx: 340, cy: 425, region: 'gyeonggi' },
      { name: '군포시',   cx: 385, cy: 458, region: 'gyeonggi' },
      { name: '의왕시',   cx: 425, cy: 454, region: 'gyeonggi' },
      { name: '과천시',   cx: 428, cy: 414, region: 'gyeonggi' },
      { name: '수원시',   cx: 398, cy: 492, region: 'gyeonggi' },
      { name: '화성시',   cx: 320, cy: 524, region: 'gyeonggi' },
      { name: '오산시',   cx: 432, cy: 522, region: 'gyeonggi' },
      { name: '성남시',   cx: 525, cy: 412, region: 'gyeonggi' },
      { name: '용인시',   cx: 514, cy: 472, region: 'gyeonggi' },
      { name: '하남시',   cx: 622, cy: 328, region: 'gyeonggi' },
      { name: '광주시',   cx: 618, cy: 412, region: 'gyeonggi' },
      { name: '이천시',   cx: 628, cy: 472, region: 'gyeonggi' },
    ];

    let activeTooltipBubble = null; // 첫 번째 탭으로 툴팁이 표시된 버블 추적

    DISTRICTS.forEach(d => {
      const style = REGION_STYLE[d.region];
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'district-bubble');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', d.name + ' 예약하기');

      // 뱃지 크기: 글자 수에 맞춰 동적 계산
      const isMultiLine = d.name.length >= 4;
      const mid = isMultiLine ? Math.ceil(d.name.length / 2) : 0;
      const maxChars = isMultiLine ? mid : d.name.length;
      const bw = maxChars * BADGE.charW + BADGE.padX * 2;
      const bh = isMultiLine
        ? BADGE.lineH * 2 + BADGE.padY * 2
        : BADGE.lineH     + BADGE.padY * 2;

      // 둥근 사각형 뱃지
      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      badge.setAttribute('x', d.cx - bw / 2);
      badge.setAttribute('y', d.cy - bh / 2);
      badge.setAttribute('width', bw);
      badge.setAttribute('height', bh);
      badge.setAttribute('rx', BADGE.rx);
      badge.setAttribute('ry', BADGE.rx);
      badge.setAttribute('fill', style.fill);
      badge.setAttribute('stroke', 'rgba(255,255,255,0.45)');
      badge.setAttribute('stroke-width', '1');

      // 텍스트 (4자 이상은 두 줄로 분리)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      if (isMultiLine) {
        const t1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        t1.setAttribute('x', d.cx); t1.setAttribute('dy', '-6');
        t1.textContent = d.name.slice(0, mid);
        const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        t2.setAttribute('x', d.cx); t2.setAttribute('dy', '12');
        t2.textContent = d.name.slice(mid);
        label.appendChild(t1); label.appendChild(t2);
      } else {
        label.textContent = d.name;
      }
      label.setAttribute('x', d.cx);
      label.setAttribute('y', d.cy);

      g.appendChild(badge);
      g.appendChild(label);
      districtGroup.appendChild(g);

      // 마우스 진입 → 툴팁 표시
      g.addEventListener('mouseenter', () => {
        mapTooltip.innerHTML = d.name + '<span>클릭하여 예약하기</span>';
        mapTooltip.style.opacity = '1';
      });

      // 마우스 이동 → 툴팁 위치 갱신
      g.addEventListener('mousemove', (e) => {
        const containerRect = seoulMap.parentElement.getBoundingClientRect();
        mapTooltip.style.left = (e.clientX - containerRect.left) + 'px';
        mapTooltip.style.top  = (e.clientY - containerRect.top)  + 'px';
      });

      // 마우스 이탈 → 툴팁 숨김
      g.addEventListener('mouseleave', () => {
        mapTooltip.style.opacity = '0';
      });

      // 터치: 1탭 → 툴팁 표시, 2탭 → 예약 페이지 이동
      g.addEventListener('touchstart', (e) => {
        e.preventDefault();
      }, { passive: false });

      g.addEventListener('touchend', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const containerRect = seoulMap.parentElement.getBoundingClientRect();

        if (activeTooltipBubble === g) {
          // 두 번째 탭 → 예약 페이지 이동
          mapTooltip.style.opacity = '0';
          activeTooltipBubble = null;
          window.location.href = 'reservation.html';
        } else {
          // 첫 번째 탭 → 툴팁 표시
          mapTooltip.innerHTML = d.name + '<span>탭하여 예약하기</span>';
          mapTooltip.style.left = (touch.clientX - containerRect.left) + 'px';
          mapTooltip.style.top  = (touch.clientY - containerRect.top)  + 'px';
          mapTooltip.style.opacity = '1';
          activeTooltipBubble = g;
        }
      }, { passive: false });

      // 클릭 → 실시간 예약 페이지
      g.addEventListener('click', () => {
        window.location.href = 'reservation.html';
      });
    });
  }

  // Admin 초기화
  if (document.body.classList.contains('admin-body')) {
    if (sessionStorage.getItem('adminToken')) {
      document.getElementById('admin-login-overlay').style.display = 'none';
      document.getElementById('admin-main-container').style.display = 'flex';
      showSection('reservations');
    }
  }
});
