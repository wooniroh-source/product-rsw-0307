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
  const sections = ['reservations','banners','mid-banners','res-banners','svc-banners','about-banners','gallery','process','contacts','checklists','reviews','security','hanyoung'];
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
  else if (sectionId === 'gallery')       renderGalleryTable();
  else if (sectionId === 'process')       renderProcessEditForm();
  else if (sectionId === 'contacts')      renderContactTable();
  else if (sectionId === 'checklists')    renderChecklistTable();
  else if (sectionId === 'reviews')       loadReviewsAdmin();
  else if (sectionId === 'hanyoung')      renderHanyoungTable();
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
      <td>${res.district ? `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;">${res.district}</span>` : '<span style="color:#bbb;">-</span>'}</td>
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
// 한영 임직원 예약 어드민 테이블
// =============================================
window.renderHanyoungTable = async () => {
  const body     = document.getElementById('hanyoungTableBody');
  const total    = document.getElementById('hyTotalCount');
  const pending  = document.getElementById('hyPendingCount');
  const confirmed= document.getElementById('hyConfirmedCount');
  const noData   = document.getElementById('hyNoDataMessage');
  if (!body) return;

  const rows = await api('GET', '/hanyoung/reservations') || [];
  if (total)     total.textContent     = `${rows.length}건`;
  if (pending)   pending.textContent   = `${rows.filter(r=>r.status==='pending').length}건`;
  if (confirmed) confirmed.textContent = `${rows.filter(r=>r.status==='confirmed').length}건`;

  body.innerHTML = '';
  if (rows.length === 0) { if (noData) noData.style.display = 'block'; return; }
  if (noData) noData.style.display = 'none';

  const svcNames = { wall:'벽걸이형', stand:'스탠드형', multi:'2-in-1 멀티', system:'시스템 천장형' };
  rows.forEach(res => {
    const tr = document.createElement('tr');
    const applyDate = res.created_at ? String(res.created_at).split('T')[0] : '-';
    tr.innerHTML = `
      <td class="text-muted">${applyDate}</td>
      <td class="col-time"><span class="text-bold text-primary">${res.date}</span><small>${res.time}</small></td>
      <td class="text-bold">${res.name}</td>
      <td>${res.phone}</td>
      <td><span class="service-tag">${svcNames[res.service]||res.service}</span></td>
      <td><span class="badge ${res.status}">${res.status==='pending'?'대기':res.status==='confirmed'?'확정':'취소'}</span></td>
      <td><div class="btn-group">
        ${res.status==='pending'?`<button class="btn-action btn-approve" onclick="updateHanyoungStatus(${res.id},'confirmed')" title="확정"><i class="fas fa-check"></i></button>`:''}
        ${res.status!=='cancelled'?`<button class="btn-action btn-cancel" onclick="updateHanyoungStatus(${res.id},'cancelled')" title="취소"><i class="fas fa-times"></i></button>`:''}
        <button class="btn-action btn-delete" onclick="deleteHanyoungReservation(${res.id})" title="삭제"><i class="fas fa-trash"></i></button>
      </div></td>`;
    body.appendChild(tr);
  });
};
window.updateHanyoungStatus = async (id, status) => {
  await api('PUT', `/hanyoung/reservations/${id}/status`, { status });
  renderHanyoungTable();
};
window.deleteHanyoungReservation = async (id) => {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await api('DELETE', `/hanyoung/reservations/${id}`);
  renderHanyoungTable();
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
// 4-C. 세척 체크리스트 관리
// =============================================
window.renderChecklistTable = async () => {
  const body  = document.getElementById('checklistTableBody');
  const noMsg = document.getElementById('noChecklistMessage');
  const total = document.getElementById('checklistTotalCount');
  const signed= document.getElementById('checklistSignedCount');
  if (!body) return;

  const items = await api('GET', '/checklists') || [];
  if (total)  total.textContent  = `${items.length}건`;
  if (signed) signed.textContent = `${items.filter(i=>i.signed_at).length}건`;

  body.innerHTML = '';
  if (items.length === 0) { if (noMsg) noMsg.style.display = 'block'; return; }
  if (noMsg) noMsg.style.display = 'none';

  items.forEach(item => {
    const tr = document.createElement('tr');
    const createdAt = item.created_at ? String(item.created_at).replace('T',' ').slice(0,16) : '-';
    const signedAt  = item.signed_at  ? String(item.signed_at).replace('T',' ').slice(0,16)  : null;
    const link = `${location.origin}/care?checklist=${item.id}`;
    tr.innerHTML = `
      <td style="white-space:nowrap;">${item.wash_date}</td>
      <td><strong>${item.site_name}</strong></td>
      <td>${item.work_time||'-'}</td>
      <td>
        ${signedAt
          ? `<span class="badge confirmed"><i class="fas fa-signature" style="margin-right:3px;"></i>서명완료</span><br><small style="color:#64748b;font-size:0.72rem;">${signedAt}</small>`
          : `<span class="badge pending">미서명</span>`}
      </td>
      <td style="white-space:nowrap;font-size:0.8rem;color:#64748b;">${createdAt}</td>
      <td><div class="btn-group">
        <button class="btn-action btn-approve" onclick="copyChecklistLink(${item.id})" title="링크 복사"><i class="fas fa-link"></i></button>
        <button class="btn-action" style="background:#f1f5f9;color:#475569;" onclick="editChecklist(${item.id})" title="수정"><i class="fas fa-edit"></i></button>
        <button class="btn-action btn-delete" onclick="deleteChecklist(${item.id})" title="삭제"><i class="fas fa-trash"></i></button>
      </div></td>`;
    body.appendChild(tr);
  });
};

window.handleChecklistSubmit = async (e) => {
  e.preventDefault();
  const editId = document.getElementById('clEditId').value;
  const payload = {
    wash_date:           document.getElementById('clWashDate').value,
    site_name:           document.getElementById('clSiteName').value,
    outdoor_temp:        document.getElementById('clOutdoorTemp').value,
    discharge_temp:      document.getElementById('clDischargeTemp').value,
    work_time:           document.getElementById('clWorkTime').value,
    disassembly_level:   document.getElementById('clDisassembly').value,
    chemicals:           document.getElementById('clChemicals').value,
    contamination_level: document.getElementById('clContamination').value,
    memo:                document.getElementById('clMemo').value,
  };
  if (editId) {
    await api('PUT', `/checklists/${editId}`, payload);
    alert('수정되었습니다.');
  } else {
    const result = await api('POST', '/checklists', payload);
    if (result?.id) {
      const link = `${location.origin}/care?checklist=${result.id}`;
      if (confirm(`체크리스트가 등록되었습니다.\n\n고객 링크:\n${link}\n\n클립보드에 복사하시겠습니까?`)) {
        navigator.clipboard.writeText(link).catch(() => prompt('아래 링크를 복사하세요:', link));
      }
    }
  }
  cancelChecklistEdit();
  renderChecklistTable();
};

window.editChecklist = async (id) => {
  const item = await api('GET', `/checklists/${id}`);
  if (!item) return;
  document.getElementById('clEditId').value           = item.id;
  document.getElementById('clWashDate').value         = item.wash_date || '';
  document.getElementById('clSiteName').value         = item.site_name || '';
  document.getElementById('clOutdoorTemp').value      = item.outdoor_temp || '';
  document.getElementById('clDischargeTemp').value    = item.discharge_temp || '';
  document.getElementById('clWorkTime').value         = item.work_time || '';
  document.getElementById('clDisassembly').value      = item.disassembly_level || '';
  document.getElementById('clChemicals').value        = item.chemicals || '';
  document.getElementById('clContamination').value    = item.contamination_level || '';
  document.getElementById('clMemo').value             = item.memo || '';
  document.getElementById('clSubmitBtn').textContent  = '수정 저장하기';
  document.getElementById('clCancelBtn').style.display = 'inline-block';
  document.getElementById('checklistForm').scrollIntoView({ behavior: 'smooth' });
};

window.cancelChecklistEdit = () => {
  ['clEditId','clWashDate','clSiteName','clOutdoorTemp','clDischargeTemp',
   'clWorkTime','clDisassembly','clChemicals','clContamination','clMemo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const submitBtn = document.getElementById('clSubmitBtn');
  const cancelBtn = document.getElementById('clCancelBtn');
  if (submitBtn) submitBtn.textContent = '체크리스트 등록';
  if (cancelBtn) cancelBtn.style.display = 'none';
};

window.deleteChecklist = async (id) => {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await api('DELETE', `/checklists/${id}`);
  renderChecklistTable();
};

window.copyChecklistLink = (id) => {
  const link = `${location.origin}/care?checklist=${id}`;
  navigator.clipboard.writeText(link)
    .then(() => alert('고객 링크가 클립보드에 복사되었습니다.\n\n' + link))
    .catch(() => prompt('아래 링크를 복사하세요:', link));
};

// =============================================
// 5-G. 갤러리 관리
// =============================================
window.renderGalleryTable = async () => {
  const body = document.getElementById('galleryTableBody');
  const noMsg = document.getElementById('noGalleryMessage');
  if (!body) return;
  const items = await api('GET', '/gallery') || [];
  if (noMsg) noMsg.style.display = items.length === 0 ? 'block' : 'none';
  const baLabel = { before:'청소 전', after:'청소 후', none:'' };
  const baColor = { before:'#ef4444', after:'#10b981', none:'#999' };
  body.innerHTML = items.length === 0 ? '' : '';
  items.forEach(item => {
    const tr = document.createElement('tr');
    const baBadge = item.ba_type && item.ba_type !== 'none'
      ? `<span style="display:inline-block;background:${baColor[item.ba_type]};color:#fff;font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:4px;margin-right:4px;">${baLabel[item.ba_type]}</span>`
      : '';
    const catBadge = `<span style="display:inline-block;background:#0066cc;color:#fff;font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:4px;">${item.category}</span>`;
    tr.innerHTML = `
      <td class="banner-thumb-cell"><img src="${item.image_url||''}" class="banner-thumb-img" onerror="this.alt='이미지 없음';"></td>
      <td class="banner-info-cell">
        <div style="margin-bottom:4px;">${baBadge}${catBadge}</div>
        <strong style="display:block;">${item.title}</strong>
        <small>${item.description||''}</small>
      </td>
      <td><div class="btn-group">
        <button class="btn-action btn-approve" onclick="editGallery(${item.id})" title="수정"><i class="fas fa-edit"></i></button>
        <button class="btn-action btn-delete"  onclick="deleteGallery(${item.id})" title="삭제"><i class="fas fa-trash"></i></button>
      </div></td>`;
    body.appendChild(tr);
  });
};

window.handleGallerySubmit = async (e) => {
  e.preventDefault();
  const editId = document.getElementById('galleryEditId').value;
  const payload = {
    title:       document.getElementById('galleryTitle').value,
    category:    document.getElementById('galleryCategory').value,
    ba_type:     document.getElementById('galleryBaType').value,
    image_url:   document.getElementById('galleryImageUrl').value,
    description: document.getElementById('galleryDescription').value,
  };
  if (editId) { await api('PUT', `/gallery/${editId}`, payload); alert('수정되었습니다.'); }
  else        { await api('POST', '/gallery', payload);           alert('등록되었습니다.'); }
  cancelGalleryEdit();
  renderGalleryTable();
};

window.editGallery = async (id) => {
  const items = await api('GET', '/gallery') || [];
  const item  = items.find(i => i.id === id);
  if (!item) return;
  document.getElementById('galleryEditId').value      = item.id;
  document.getElementById('galleryTitle').value       = item.title;
  document.getElementById('galleryCategory').value    = item.category;
  document.getElementById('galleryBaType').value      = item.ba_type || 'none';
  document.getElementById('galleryImageUrl').value    = item.image_url;
  document.getElementById('galleryDescription').value = item.description || '';
  document.getElementById('gallerySubmitBtn').textContent = '수정 저장하기';
  document.getElementById('galleryCancelBtn').style.display = 'inline-block';
  document.getElementById('galleryForm').scrollIntoView({ behavior: 'smooth' });
};

window.cancelGalleryEdit = () => {
  document.getElementById('galleryEditId').value   = '';
  document.getElementById('galleryTitle').value    = '';
  document.getElementById('galleryCategory').value = '';
  document.getElementById('galleryBaType').value   = 'none';
  document.getElementById('galleryImageUrl').value = '';
  document.getElementById('galleryDescription').value = '';
  document.getElementById('gallerySubmitBtn').textContent = '갤러리 등록하기';
  document.getElementById('galleryCancelBtn').style.display = 'none';
};

window.deleteGallery = async (id) => {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await api('DELETE', `/gallery/${id}`);
  renderGalleryTable();
};

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
const sendEmailNotification = (subject, message) => {
  fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_key: WEB3FORMS_ACCESS_KEY, subject, message, from_name: '클린앤파트너즈 알림' })
  }).catch(err => console.error('[Web3Forms]', err));
};

// =============================================
// 7. 공통 배너 슬라이더
// =============================================
// Unsplash URL에 최적화 파라미터 추가 (이미 파라미터가 있으면 유지)
function optimizeImageUrl(url, width) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('unsplash.com') || u.hostname.includes('images.unsplash.com')) {
      if (!u.searchParams.has('w')) u.searchParams.set('w', width || 1200);
      if (!u.searchParams.has('q')) u.searchParams.set('q', '75');
      if (!u.searchParams.has('auto')) u.searchParams.set('auto', 'format');
      if (!u.searchParams.has('fit')) u.searchParams.set('fit', 'crop');
      return u.toString();
    }
  } catch (_) {}
  return url;
}

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
  const imgWidth = isHero ? 1200 : 800;

  items.forEach((item, index) => {
    const slide = document.createElement('div');
    slide.classList.add((isHero || isMid) ? 'slide' : 'res-banner-slide');
    if (index === 0) slide.classList.add('active');

    // 첫 슬라이드만 즉시 로드, 나머지는 data-bg에 저장해 전환 시 로드
    const imgUrl = optimizeImageUrl(item.image_url, imgWidth);
    const gradient = isHero
      ? 'linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5))'
      : isMid
        ? 'linear-gradient(rgba(0,0,0,0.58),rgba(0,0,0,0.58))'
        : 'linear-gradient(to right,rgba(0,0,0,0.65) 40%,rgba(0,0,0,0.25))';

    if (index === 0) {
      slide.style.backgroundImage = `${gradient},url('${imgUrl}')`;
    } else {
      slide.dataset.bgUrl = imgUrl;
      slide.dataset.bgGradient = gradient;
    }

    if (isHero) {
      slide.innerHTML = `<div class="hero-content"><h2>${item.title}</h2><p>${item.description||''}</p>${item.btn_text?`<div class="hero-btns"><a href="${item.btn_link||'#'}" class="btn">${item.btn_text}</a></div>`:''}</div>`;
    } else if (isMid) {
      const num = String(index + 1).padStart(2, '0');
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
          <div class="mid-slide-info">
            <div class="mid-slide-number">${num}</div>
            ${item.company_name ? `<div class="mid-slide-company"><i class="fas fa-building"></i>${item.company_name}</div>` : ''}
            <h2 class="mid-slide-title">${item.title}</h2>
            ${item.description ? `<p class="mid-slide-desc">${item.description}</p>` : ''}
            ${statsHtml ? `<div class="mid-slide-stats">${statsHtml}</div>` : ''}
          </div>
        </div>`;
    } else {
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

  const loadSlideBg = (slide) => {
    if (slide.dataset.bgUrl && !slide.dataset.bgLoaded) {
      slide.style.backgroundImage = `${slide.dataset.bgGradient},url('${slide.dataset.bgUrl}')`;
      slide.dataset.bgLoaded = '1';
    }
  };
  // 다음 슬라이드 미리 로드
  const preloadNext = (idx) => {
    const nextIdx = (idx + 1) % slides.length;
    if (slides[nextIdx]) loadSlideBg(slides[nextIdx]);
  };
  const showSlide = (idx) => {
    slides.forEach(s => s.classList.remove('active')); dots.forEach(d => d.classList.remove('active'));
    if (slides[idx]) {
      loadSlideBg(slides[idx]);
      slides[idx].classList.add('active');
      current = idx;
      preloadNext(idx);
    }
    if (dots[idx]) dots[idx].classList.add('active');
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
        <div class="step-img-wrapper"><img src="${optimizeImageUrl(step.image_url, 600)}" alt="${step.title}" loading="lazy"></div>
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
          <div class="col">${res.date} ${res.time||''}</div>
          <div class="col">${serviceMap[res.service]||res.service}</div>`;
        liveList.appendChild(item);
      });
      liveList.style.animation = `rollUp ${reservations.length*4}s linear infinite`;
    }
  }

  // URL 파라미터에서 지역명 읽어 표시
  const urlDistrict = new URLSearchParams(window.location.search).get('district');
  if (urlDistrict) {
    const inputDistrict = document.getElementById('inputDistrict');
    const displayDistrict = document.getElementById('displayDistrict');
    const displayDistrictName = document.getElementById('displayDistrictName');
    if (inputDistrict) inputDistrict.value = urlDistrict;
    if (displayDistrict && displayDistrictName) {
      displayDistrictName.textContent = urlDistrict;
      displayDistrict.style.display = 'block';
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
    const ALL_SLOTS = ['09:00', '11:00', '14:00', '16:00', '18:00'];
    let viewDate = new Date();
    const today  = new Date(); today.setHours(0,0,0,0);
    let bookedSlots = {};

    const loadBookedSlots = async () => {
      bookedSlots = await api('GET', '/reservations/booked-slots') || {};
    };

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
        const date    = new Date(year, month, day);
        const isPast  = date < today;
        const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const taken   = bookedSlots[dateKey] || [];
        const isFull  = !isPast && ALL_SLOTS.every(s => taken.includes(s));

        let statusClass, statusText;
        if (isPast)      { statusClass = 'past'; statusText = '종료'; }
        else if (isFull) { statusClass = 'full'; statusText = '예약마감'; }
        else             { statusClass = 'avail'; statusText = '가능'; }

        cell.innerHTML = `<span class="day-num">${day}</span><span class="day-status ${statusClass}">${statusText}</span>`;
        if (date.getTime()===today.getTime()) cell.classList.add('today');
        if (isPast || isFull) { cell.classList.add('disabled'); }
        else {
          cell.addEventListener('click', () => {
            document.querySelectorAll('.day-cell').forEach(c=>c.classList.remove('active'));
            cell.classList.add('active');
            if (displaySelected) displaySelected.textContent = `${year}년 ${month+1}월 ${day}일`;
            if (inputSelected)   inputSelected.value = dateKey;
            // 해당 날짜에 이미 예약된 시간 비활성화
            const timeSelect = document.getElementById('bookingTime');
            if (timeSelect) {
              const timeLabels = { '09:00':'오전 09:00', '11:00':'오전 11:00', '14:00':'오후 02:00', '16:00':'오후 04:00', '18:00':'오후 06:00' };
              Array.from(timeSelect.options).forEach(opt => {
                if (!opt.value) return;
                const isBooked = taken.includes(opt.value);
                opt.disabled = isBooked;
                opt.textContent = isBooked ? `${timeLabels[opt.value]} (마감)` : timeLabels[opt.value];
              });
              timeSelect.value = '';
            }
            if (bookingFormSection) { bookingFormSection.style.display='block'; bookingFormSection.scrollIntoView({behavior:'smooth'}); }
          });
        }
        calendarDaysGrid.appendChild(cell);
      }
    };

    await loadBookedSlots();
    renderCalendar();
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()-1); if(bookingFormSection) bookingFormSection.style.display='none'; renderCalendar(); });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()+1); if(bookingFormSection) bookingFormSection.style.display='none'; renderCalendar(); });
  }

  // 예약 폼 제출
  const bookingForm = document.getElementById('realtimeBookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(bookingForm);
      const d  = Object.fromEntries(fd.entries());
      const result = await api('POST', '/reservations', { name:d.user_name, phone:d.user_phone, service:d.service_type, date:d.selected_date, time:d.booking_time, district:d.district||'' });
      if (!result) return alert('예약 접수 중 오류가 발생했습니다.');
      const svcNames = { wall:'벽걸이 에어컨', stand:'스탠드 에어컨', multi:'2-in-1 멀티형', system:'천장형 시스템' };
      const districtLine = d.district ? `\n서비스 지역 : ${d.district}` : '';
      sendEmailNotification(
        `[클린앤파트너즈] 새 예약 접수 - ${d.user_name} (${d.selected_date})`,
        `📋 새 예약이 접수되었습니다\n` +
        `──────────────────────\n` +
        `고객명   : ${d.user_name}\n` +
        `연락처   : ${d.user_phone}` +
        `${districtLine}\n` +
        `서비스   : ${svcNames[d.service_type] || d.service_type}\n` +
        `예약 날짜 : ${d.selected_date}\n` +
        `희망 시간 : ${d.booking_time}\n` +
        `──────────────────────`
      );
      alert('예약이 성공적으로 접수되었습니다!');
      bookingForm.reset();
      const sec = document.getElementById('bookingFormSection');
      if (sec) sec.style.display = 'none';
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }

  // 한영 임직원 예약 달력 + 폼
  const hyCalendarDays = document.getElementById('hyCalendarDays');
  if (hyCalendarDays) {
    const hyTitle     = document.getElementById('hyCalendarTitle');
    const hyPrev      = document.getElementById('hyPrevMonthBtn');
    const hyNext      = document.getElementById('hyNextMonthBtn');
    const hyFormSec   = document.getElementById('hyBookingFormSection');
    const hyDisplay   = document.getElementById('hyDisplaySelectedDate');
    const hyInput     = document.getElementById('hyInputSelectedDate');
    const ALL_SLOTS   = ['09:00','11:00','14:00','16:00','18:00'];
    let hyView        = new Date();
    const today       = new Date(); today.setHours(0,0,0,0);
    let hyBooked      = {};

    const hyLoadSlots = async () => {
      hyBooked = await api('GET', '/hanyoung/reservations/booked-slots') || {};
    };

    const hyRenderCalendar = () => {
      hyCalendarDays.innerHTML = '';
      const year = hyView.getFullYear(), month = hyView.getMonth();
      if (hyTitle) hyTitle.textContent = `${year}년 ${month+1}월`;
      const firstDay = new Date(year, month, 1).getDay();
      const lastDay  = new Date(year, month+1, 0).getDate();
      for (let i = 0; i < firstDay; i++) {
        const e = document.createElement('div'); e.classList.add('day-cell','empty'); hyCalendarDays.appendChild(e);
      }
      for (let day = 1; day <= lastDay; day++) {
        const cell    = document.createElement('div');
        cell.classList.add('day-cell');
        const date    = new Date(year, month, day);
        const isPast  = date < today;
        const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const taken   = hyBooked[dateKey] || [];
        const isFull  = !isPast && ALL_SLOTS.every(s => taken.includes(s));

        let statusClass, statusText;
        if (isPast)      { statusClass='past';  statusText='종료'; }
        else if (isFull) { statusClass='full';  statusText='예약마감'; }
        else             { statusClass='avail'; statusText='가능'; }

        cell.innerHTML = `<span class="day-num">${day}</span><span class="day-status ${statusClass}">${statusText}</span>`;
        if (date.getTime()===today.getTime()) cell.classList.add('today');
        if (isPast || isFull) { cell.classList.add('disabled'); }
        else {
          cell.addEventListener('click', () => {
            document.querySelectorAll('#hyCalendarDays .day-cell').forEach(c=>c.classList.remove('active'));
            cell.classList.add('active');
            if (hyDisplay) hyDisplay.textContent = `${year}년 ${month+1}월 ${day}일`;
            if (hyInput)   hyInput.value = dateKey;
            const timeSelect = document.getElementById('hyBookingTime');
            if (timeSelect) {
              const timeLabels = {'09:00':'오전 09:00','11:00':'오전 11:00','14:00':'오후 02:00','16:00':'오후 04:00','18:00':'오후 06:00'};
              Array.from(timeSelect.options).forEach(opt => {
                if (!opt.value) return;
                const isBooked = taken.includes(opt.value);
                opt.disabled = isBooked;
                opt.textContent = isBooked ? `${timeLabels[opt.value]} (마감)` : timeLabels[opt.value];
              });
              timeSelect.value = '';
            }
            if (hyFormSec) { hyFormSec.style.display='block'; hyFormSec.scrollIntoView({behavior:'smooth'}); }
          });
        }
        hyCalendarDays.appendChild(cell);
      }
    };

    await hyLoadSlots();
    hyRenderCalendar();
    if (hyPrev) hyPrev.addEventListener('click', () => { hyView.setMonth(hyView.getMonth()-1); if(hyFormSec) hyFormSec.style.display='none'; hyRenderCalendar(); });
    if (hyNext) hyNext.addEventListener('click', () => { hyView.setMonth(hyView.getMonth()+1); if(hyFormSec) hyFormSec.style.display='none'; hyRenderCalendar(); });
  }

  // 한영 예약 폼 제출
  const hyForm = document.getElementById('hyBookingForm');
  if (hyForm) {
    hyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(hyForm);
      const d  = Object.fromEntries(fd.entries());
      const result = await api('POST', '/hanyoung/reservations', { name:d.user_name, phone:d.user_phone, service:d.service_type, date:d.selected_date, time:d.booking_time });
      if (!result) return alert('예약 접수 중 오류가 발생했습니다.');
      alert('임직원 예약이 성공적으로 접수되었습니다!\n담당자가 개별 연락드리겠습니다.');
      hyForm.reset();
      const sec = document.getElementById('hyBookingFormSection');
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
        `💬 새 문의가 접수되었습니다\n` +
        `──────────────────────\n` +
        `고객명   : ${d.name}\n` +
        `연락처   : ${d.phone}\n` +
        `──────────────────────\n` +
        `문의 내용 :\n${d.message}\n` +
        `──────────────────────`
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
          window.location.href = '/reservation?district=' + encodeURIComponent(d.name);
        } else {
          // 첫 번째 탭 → 툴팁 표시
          mapTooltip.innerHTML = d.name + '<span>탭하여 예약하기</span>';
          mapTooltip.style.left = (touch.clientX - containerRect.left) + 'px';
          mapTooltip.style.top  = (touch.clientY - containerRect.top)  + 'px';
          mapTooltip.style.opacity = '1';
          activeTooltipBubble = g;
        }
      }, { passive: false });

      // 클릭 → 실시간 예약 페이지 (지역명 파라미터 포함)
      g.addEventListener('click', () => {
        window.location.href = '/reservation?district=' + encodeURIComponent(d.name);
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

// =============================================
// 후기 관리
// =============================================
let _allReviews = [];
let _rvFilter   = 'all';

window.loadReviewsAdmin = async () => {
  _allReviews = await api('GET', '/reviews/all') || [];
  renderReviewTable();
};

window.filterReviews = (filter) => {
  _rvFilter = filter;
  ['all','pending','approved'].forEach(f => {
    const btn = document.getElementById(`rv-filter-${f}`);
    if (btn) btn.classList.toggle('filter-btn-active', f === filter);
  });
  renderReviewTable();
};

function renderReviewTable() {
  const body   = document.getElementById('reviewTableBody');
  const noMsg  = document.getElementById('noReviewMessage');
  const table  = document.getElementById('reviewTable');
  if (!body) return;

  const filtered = _rvFilter === 'pending'
    ? _allReviews.filter(r => !r.is_approved)
    : _rvFilter === 'approved'
    ? _allReviews.filter(r => r.is_approved)
    : _allReviews;

  const total    = _allReviews.length;
  const approved = _allReviews.filter(r => r.is_approved).length;
  const pending  = total - approved;
  const tc = document.getElementById('reviewTotalCount');
  const ac = document.getElementById('reviewApprovedCount');
  const pc = document.getElementById('reviewPendingCount');
  if (tc) tc.textContent = total + '건';
  if (ac) ac.textContent = approved + '건';
  if (pc) pc.textContent = pending + '건';

  const isEmpty = filtered.length === 0;
  if (table) table.style.display = isEmpty ? 'none' : 'table';
  if (noMsg) noMsg.style.display = isEmpty ? 'block' : 'none';
  if (isEmpty) return;

  body.innerHTML = filtered.map(r => {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const date  = new Date(r.created_at).toLocaleDateString('ko-KR');
    const statusBadge = r.is_approved
      ? '<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">승인됨</span>'
      : '<span style="background:#fef9c3;color:#92400e;padding:2px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">대기중</span>';
    const approveLabel = r.is_approved ? '승인 취소' : '승인';
    const approveCls   = r.is_approved ? 'btn-action btn-cancel' : 'btn-action btn-confirm';
    const content = r.content.replace(/</g,'&lt;').replace(/\n/g,'<br>');
    return `<tr>
      <td style="color:#f59e0b;letter-spacing:1px;font-size:0.9rem;">${stars}</td>
      <td><strong>${r.nickname.replace(/</g,'&lt;')}</strong></td>
      <td>${r.ac_type ? `<span style="background:#e8f4ff;color:#0066cc;padding:2px 8px;border-radius:12px;font-size:0.75rem;">${r.ac_type}</span>` : '-'}</td>
      <td style="max-width:240px;white-space:normal;font-size:0.85rem;line-height:1.6;">${content}</td>
      <td>${date}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="${approveCls}" onclick="approveReview(${r.id})">${approveLabel}</button>
        <button class="btn-action btn-delete" onclick="deleteReview(${r.id})">삭제</button>
      </td>
    </tr>`;
  }).join('');
}

window.approveReview = async (id) => {
  await api('PATCH', `/reviews/${id}/approve`);
  loadReviewsAdmin();
};

window.deleteReview = async (id) => {
  if (!confirm('이 후기를 삭제하시겠습니까?')) return;
  await api('DELETE', `/reviews/${id}`);
  loadReviewsAdmin();
};

// =============================================
// PWA: Service Worker 등록 + 홈화면 추가 배너
// =============================================
(function () {
  if (document.body.classList.contains('admin-body')) return;

  // Service Worker 등록
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  let deferredPrompt = null;
  let autoDismissTimer = null;

  function showBanner() {
    banner.style.display = 'block';
    autoDismissTimer = setTimeout(() => {
      banner.style.display = 'none';
      sessionStorage.setItem('pwa-banner-dismissed', '1');
    }, 20000);
  }

  function hideBanner() {
    banner.style.display = 'none';
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }
  }

  // 배너 HTML 주입
  const banner = document.createElement('div');
  banner.id = 'pwa-banner';
  banner.innerHTML = `
    <div id="pwa-banner-inner">
      <img src="/icon.svg" alt="아이콘" width="40" height="40">
      <div id="pwa-banner-text">
        <strong>클린앤파트너즈</strong>
        <span>홈 화면에 추가하고 빠르게 접속하세요</span>
      </div>
      <button id="pwa-install-btn">추가</button>
      <button id="pwa-close-btn" aria-label="닫기">✕</button>
    </div>
  `;
  document.body.appendChild(banner);

  const style = document.createElement('style');
  style.textContent = `
    #pwa-banner {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: #fff;
      border-top: 1px solid #e2e8f0;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
      z-index: 9999;
      padding: 12px 16px;
      animation: pwa-slide-up 0.3s ease;
    }
    @keyframes pwa-slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    #pwa-banner-inner {
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 600px;
      margin: 0 auto;
    }
    #pwa-banner-inner img { border-radius: 10px; flex-shrink: 0; }
    #pwa-banner-text { flex: 1; display: flex; flex-direction: column; }
    #pwa-banner-text strong { font-size: 0.95rem; color: #1e293b; }
    #pwa-banner-text span { font-size: 0.8rem; color: #64748b; }
    #pwa-install-btn {
      background: #0066cc; color: #fff;
      border: none; border-radius: 8px;
      padding: 8px 18px; font-size: 0.9rem;
      font-weight: 600; cursor: pointer;
      flex-shrink: 0;
    }
    #pwa-install-btn:hover { background: #0052a3; }
    #pwa-close-btn {
      background: none; border: none;
      color: #94a3b8; font-size: 1.1rem;
      cursor: pointer; padding: 4px 6px;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  // Chrome/Edge/Android: beforeinstallprompt 이벤트
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!sessionStorage.getItem('pwa-banner-dismissed')) {
      showBanner();
    }
  });

  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    hideBanner();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });

  document.getElementById('pwa-close-btn').addEventListener('click', () => {
    hideBanner();
    sessionStorage.setItem('pwa-banner-dismissed', '1');
  });

  // 이미 설치된 경우 배너 숨김
  window.addEventListener('appinstalled', () => {
    hideBanner();
    deferredPrompt = null;
  });
})();
