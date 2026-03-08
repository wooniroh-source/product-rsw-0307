/**
 * 클린앤파트너즈 - 통합 관리 시스템 JavaScript
 */

// --- 1. 기본 데이터 정의 ---
const HERO_DEFAULTS = [
    { id: 1, title: "당신의 숨결을 디자인합니다", desc: "전문 분해 세척으로 시작하는 깨끗한 실내 공기 솔루션", url: "https://images.unsplash.com/photo-1590402444816-05d848218571?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "온라인 예약하기", btnLink: "reservation.html" },
    { id: 2, title: "10년 경력의 베테랑 엔지니어", desc: "까다로운 시스템 에어컨부터 가정용까지 완벽하게 케어합니다", url: "https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "서비스 상세 보기", btnLink: "services.html" },
    { id: 3, title: "친환경 세제 안심 공법", desc: "우리가족 건강을 생각하는 FDA 승인 친환경 약품 사용", url: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "브랜드 스토리", btnLink: "about.html" }
];

const PROCESS_DEFAULTS = [
    { title: "사전 점검", desc: "작동 상태 및 오염도 확인", url: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-clipboard-check" },
    { title: "부품 분해", desc: "완전 분해를 통한 내부 노출", url: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-tools" },
    { title: "고압 세척", desc: "고압 세척기로 찌든때 제거", url: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-faucet-drip" },
    { title: "살균 소독", desc: "99.9% 세균 및 곰팡이 살균", url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-spray-can-sparkles" },
    { title: "제품 조립", desc: "세척된 부품의 정밀 재조립", url: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-laptop-house" },
    { title: "최종 시운전", desc: "정상 작동 확인 및 마무리", url: "https://images.unsplash.com/photo-1581092162384-8987c1d64718?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-power-off" }
];

// --- 2. 관리자 페이지 전역 함수 ---

window.showSection = (sectionId) => {
    const sections = ['reservations', 'banners', 'mid-banners', 'process'];
    sections.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        const menu = document.getElementById(`menu-${s}`);
        if (el) el.style.display = (s === sectionId) ? 'block' : 'none';
        if (menu) menu.classList.toggle('active', s === sectionId);
    });

    if (sectionId === 'reservations') renderReservationTable();
    else if (sectionId === 'banners') renderAdminDataTable('banners', 'bannerTableBody');
    else if (sectionId === 'mid-banners') renderAdminDataTable('midBanners', 'midBannerTableBody');
    else if (sectionId === 'process') renderProcessEditForm();
};

window.renderReservationTable = () => {
    const tableBody = document.getElementById('reservationTableBody');
    const totalCount = document.getElementById('totalCount');
    const pendingCount = document.getElementById('pendingCount');
    const confirmedCount = document.getElementById('confirmedCount');
    const noDataMessage = document.getElementById('noDataMessage');

    if (!tableBody) return;

    const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    
    if (totalCount) totalCount.textContent = `${reservations.length}건`;
    if (pendingCount) pendingCount.textContent = `${reservations.filter(r => r.status === 'pending').length}건`;
    if (confirmedCount) confirmedCount.textContent = `${reservations.filter(r => r.status === 'confirmed').length}건`;

    tableBody.innerHTML = '';
    if (reservations.length === 0) {
        if (noDataMessage) noDataMessage.style.display = 'block';
        return;
    }
    if (noDataMessage) noDataMessage.style.display = 'none';

    reservations.sort((a, b) => b.id - a.id).forEach(res => {
        const tr = document.createElement('tr');
        
        let serviceName = '';
        switch(res.service) {
            case 'wall': serviceName = '벽걸이형'; break;
            case 'stand': serviceName = '스탠드형'; break;
            case 'multi': serviceName = '2-in-1 멀티'; break;
            case 'system': serviceName = '시스템 천장형'; break;
            default: serviceName = res.service || '기타';
        }

        const applyDate = res.createdAt ? res.createdAt.split(' ')[0] : '-';

        tr.innerHTML = `
            <td class="col-date text-muted">${applyDate}</td>
            <td class="col-time"><span class="text-bold text-primary">${res.date}</span><br><small>${res.time}</small></td>
            <td class="col-name text-bold">${res.name}</td>
            <td class="col-phone">${res.phone}</td>
            <td class="col-service"><span class="service-tag">${serviceName}</span></td>
            <td class="col-status"><span class="badge ${res.status}">${res.status === 'pending' ? '대기' : (res.status === 'confirmed' ? '확정' : '취소')}</span></td>
            <td class="col-manage">
                <div class="btn-group">
                    ${res.status === 'pending' ? `<button class="btn-action btn-approve" onclick="updateStatus(${res.id}, 'confirmed')"><i class="fas fa-check"></i></button>` : ''}
                    ${res.status !== 'cancelled' ? `<button class="btn-action btn-cancel" onclick="updateStatus(${res.id}, 'cancelled')"><i class="fas fa-times"></i></button>` : ''}
                    <button class="btn-action btn-delete" onclick="deleteReservation(${res.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
};

window.updateStatus = (id, newStatus) => {
    const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    const index = reservations.findIndex(r => r.id === id);
    if (index !== -1) {
        reservations[index].status = newStatus;
        localStorage.setItem('reservations', JSON.stringify(reservations));
        renderReservationTable();
    }
};

window.deleteReservation = (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    localStorage.setItem('reservations', JSON.stringify(reservations.filter(r => r.id !== id)));
    renderReservationTable();
};

window.renderAdminDataTable = (storageKey, bodyId) => {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
    body.innerHTML = items.length === 0 ? '<tr><td colspan="3" class="no-data">등록된 데이터가 없습니다.</td></tr>' : '';
    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="banner-thumb-cell"><img src="${item.url}" class="banner-thumb-img" onerror="this.src=''; this.alt='이미지 없음';"></td>
            <td class="banner-info-cell"><strong class="text-bold">${item.title}</strong><br><small class="text-muted">${item.desc}</small></td>
            <td><button class="btn-delete-text" onclick="deleteAdminItem('${storageKey}', ${item.id})"><i class="fas fa-trash"></i> 삭제</button></td>
        `;
        body.appendChild(tr);
    });
};

window.deleteAdminItem = (storageKey, id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
    localStorage.setItem(storageKey, JSON.stringify(items.filter(i => i.id !== id)));
    renderAdminDataTable(storageKey, storageKey === 'banners' ? 'bannerTableBody' : 'midBannerTableBody');
};

window.handleBannerSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = JSON.parse(localStorage.getItem('banners') || '[]');
    items.push({ id: Date.now(), title: fd.get('bannerTitle'), url: fd.get('bannerUrl'), desc: fd.get('bannerDesc'), btnText: fd.get('bannerBtnText'), btnLink: fd.get('bannerBtnLink') });
    localStorage.setItem('banners', JSON.stringify(items));
    alert('등록되었습니다.'); e.target.reset(); renderAdminDataTable('banners', 'bannerTableBody');
};

window.handleMidBannerSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = JSON.parse(localStorage.getItem('midBanners') || '[]');
    items.push({ id: Date.now(), title: fd.get('midBannerTitle'), url: fd.get('midBannerUrl'), desc: fd.get('midBannerDesc') });
    localStorage.setItem('midBanners', JSON.stringify(items));
    alert('등록되었습니다.'); e.target.reset(); renderAdminDataTable('midBanners', 'midBannerTableBody');
};

window.renderProcessEditForm = () => {
    const container = document.getElementById('process-steps-edit-container');
    if (!container) return;
    let data = JSON.parse(localStorage.getItem('processData') || '[]');
    if (data.length === 0) data = PROCESS_DEFAULTS;
    container.innerHTML = '';
    data.forEach((step, index) => {
        const div = document.createElement('div');
        div.className = 'process-edit-card';
        div.innerHTML = `
            <h4>STEP 0${index + 1}</h4>
            <div class="input-group"><label>제목</label><input type="text" class="proc-title" value="${step.title}"></div>
            <div class="input-group"><label>이미지 URL</label><input type="url" class="proc-url" value="${step.url}"></div>
            <div class="input-group"><label>설명</label><input type="text" class="proc-desc" value="${step.desc}"></div>
            <div class="input-group"><label>아이콘(FA)</label><input type="text" class="proc-icon" value="${step.icon}"></div>
        `;
        container.appendChild(div);
    });
};

window.handleProcessSubmit = (e) => {
    e.preventDefault();
    const titles = document.querySelectorAll('.proc-title'), urls = document.querySelectorAll('.proc-url'), descs = document.querySelectorAll('.proc-desc'), icons = document.querySelectorAll('.proc-icon');
    const newData = [];
    for (let i = 0; i < titles.length; i++) newData.push({ title: titles[i].value, url: urls[i].value, desc: descs[i].value, icon: icons[i].value });
    localStorage.setItem('processData', JSON.stringify(newData));
    alert('공정 정보가 저장되었습니다.');
};

// --- 3. 초기화 ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('admin-body')) {
        showSection('reservations');
    }
});
