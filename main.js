/**
 * 클린앤파트너즈 - 통합 관리 시스템 JavaScript
 */

// =============================================
// 1. 기본 데이터 상수
// =============================================

const HERO_DEFAULTS = [
    { id: 1, title: "당신의 숨결을 디자인합니다", desc: "전문 분해 세척으로 시작하는 깨끗한 실내 공기 솔루션", url: "https://images.unsplash.com/photo-1590402444816-05d848218571?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "온라인 예약하기", btnLink: "reservation.html" },
    { id: 2, title: "10년 경력의 베테랑 엔지니어", desc: "까다로운 시스템 에어컨부터 가정용까지 완벽하게 케어합니다", url: "https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "서비스 상세 보기", btnLink: "services.html" },
    { id: 3, title: "친환경 세제 안심 공법", desc: "우리가족 건강을 생각하는 FDA 승인 친환경 약품 사용", url: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "브랜드 스토리", btnLink: "about.html" }
];

const MID_DEFAULTS = [
    { id: 1, title: "완벽한 분해, 철저한 살균", desc: "보이지 않는 곳까지 클린앤파트너즈가 책임집니다.", url: "https://images.unsplash.com/photo-1558389186-438424b00a32?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" },
    { id: 2, title: "쾌적한 여름의 시작", desc: "지금 예약하고 시원한 바람을 만나보세요.", url: "https://images.unsplash.com/photo-1563453392212-326f5e854473?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" }
];

const PROCESS_DEFAULTS = [
    { title: "사전 점검", desc: "작동 상태 및 오염도 확인", url: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-clipboard-check" },
    { title: "부품 분해", desc: "완전 분해를 통한 내부 노출", url: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-tools" },
    { title: "고압 세척", desc: "고압 세척기로 찌든때 제거", url: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-faucet-drip" },
    { title: "살균 소독", desc: "99.9% 세균 및 곰팡이 살균", url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-spray-can-sparkles" },
    { title: "제품 조립", desc: "세척된 부품의 정밀 재조립", url: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-laptop-house" },
    { title: "최종 시운전", desc: "정상 작동 확인 및 마무리", url: "https://images.unsplash.com/photo-1581092162384-8987c1d64718?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-power-off" }
];

// =============================================
// 2. 관리자(Admin) 전역 함수
// =============================================

window.showSection = (sectionId) => {
    const sections = ['reservations', 'banners', 'mid-banners', 'process', 'contacts'];
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
    else if (sectionId === 'contacts') renderContactTable();
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
        switch (res.service) {
            case 'wall': serviceName = '벽걸이형'; break;
            case 'stand': serviceName = '스탠드형'; break;
            case 'multi': serviceName = '2-in-1 멀티'; break;
            case 'system': serviceName = '시스템 천장형'; break;
            default: serviceName = res.service || '기타';
        }

        const applyDate = res.createdAt ? res.createdAt.split(' ')[0] : '-';

        tr.innerHTML = `
            <td class="text-muted">${applyDate}</td>
            <td class="col-time"><span class="text-bold text-primary">${res.date}</span><small>${res.time}</small></td>
            <td class="text-bold">${res.name}</td>
            <td>${res.phone}</td>
            <td><span class="service-tag">${serviceName}</span></td>
            <td><span class="badge ${res.status}">${res.status === 'pending' ? '대기' : (res.status === 'confirmed' ? '확정' : '취소')}</span></td>
            <td>
                <div class="btn-group">
                    ${res.status === 'pending' ? `<button class="btn-action btn-approve" onclick="updateStatus(${res.id}, 'confirmed')" title="확정"><i class="fas fa-check"></i></button>` : ''}
                    ${res.status !== 'cancelled' ? `<button class="btn-action btn-cancel" onclick="updateStatus(${res.id}, 'cancelled')" title="취소"><i class="fas fa-times"></i></button>` : ''}
                    <button class="btn-action btn-delete" onclick="deleteReservation(${res.id})" title="삭제"><i class="fas fa-trash"></i></button>
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
            <td class="banner-thumb-cell"><img src="${item.url}" class="banner-thumb-img" onerror="this.alt='이미지 없음';"></td>
            <td class="banner-info-cell"><strong>${item.title}</strong><small>${item.desc || ''}</small></td>
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

window.renderContactTable = () => {
    const tableBody = document.getElementById('contactTableBody');
    const totalCount = document.getElementById('contactTotalCount');
    const unreadCount = document.getElementById('contactUnreadCount');
    const readCount = document.getElementById('contactReadCount');
    const noMsg = document.getElementById('noContactMessage');
    if (!tableBody) return;

    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    if (totalCount) totalCount.textContent = `${contacts.length}건`;
    if (unreadCount) unreadCount.textContent = `${contacts.filter(c => !c.read).length}건`;
    if (readCount) readCount.textContent = `${contacts.filter(c => c.read).length}건`;

    tableBody.innerHTML = '';
    if (contacts.length === 0) {
        if (noMsg) noMsg.style.display = 'block';
        return;
    }
    if (noMsg) noMsg.style.display = 'none';

    contacts.sort((a, b) => b.id - a.id).forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-muted" style="white-space:nowrap;">${c.createdAt}</td>
            <td class="text-bold">${c.name}</td>
            <td>${c.phone}</td>
            <td class="contact-message-cell">${c.message}</td>
            <td><span class="badge ${c.read ? 'confirmed' : 'pending'}">${c.read ? '확인완료' : '미확인'}</span></td>
            <td>
                <div class="btn-group">
                    ${!c.read ? `<button class="btn-action btn-approve" onclick="markContactRead(${c.id})" title="확인완료"><i class="fas fa-check"></i></button>` : ''}
                    <button class="btn-action btn-delete" onclick="deleteContact(${c.id})" title="삭제"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
};

window.markContactRead = (id) => {
    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    const idx = contacts.findIndex(c => c.id === id);
    if (idx !== -1) { contacts[idx].read = true; localStorage.setItem('contacts', JSON.stringify(contacts)); renderContactTable(); }
};

window.deleteContact = (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    localStorage.setItem('contacts', JSON.stringify(contacts.filter(c => c.id !== id)));
    renderContactTable();
};

window.handleProcessSubmit = (e) => {
    e.preventDefault();
    const titles = document.querySelectorAll('.proc-title');
    const urls = document.querySelectorAll('.proc-url');
    const descs = document.querySelectorAll('.proc-desc');
    const icons = document.querySelectorAll('.proc-icon');
    const newData = [];
    for (let i = 0; i < titles.length; i++) {
        newData.push({ title: titles[i].value, url: urls[i].value, desc: descs[i].value, icon: icons[i].value });
    }
    localStorage.setItem('processData', JSON.stringify(newData));
    alert('공정 정보가 저장되었습니다.');
};

// =============================================
// 3. 공통 슬라이더 엔진
// =============================================

const setupSlider = (config) => {
    const { containerId, dotsId, prevId, nextId, storageKey, defaults } = config;
    const sliderContainer = document.getElementById(containerId);
    const dotsContainer = document.getElementById(dotsId);
    const prevBtn = document.getElementById(prevId);
    const nextBtn = document.getElementById(nextId);

    if (!sliderContainer) return;

    let data = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (data.length === 0) data = defaults;

    sliderContainer.innerHTML = '';
    if (dotsContainer) dotsContainer.innerHTML = '';

    data.forEach((item, index) => {
        const slide = document.createElement('div');
        slide.classList.add('slide');
        if (index === 0) slide.classList.add('active');
        slide.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${item.url}')`;

        let contentHtml = `<div class="hero-content"><h2>${item.title}</h2><p>${item.desc}</p>`;
        if (item.btnText && item.btnLink) {
            contentHtml += `<div class="hero-btns"><a href="${item.btnLink}" class="btn">${item.btnText}</a></div>`;
        }
        contentHtml += `</div>`;
        slide.innerHTML = contentHtml;
        sliderContainer.appendChild(slide);

        if (dotsContainer) {
            const dot = document.createElement('span');
            dot.classList.add('dot');
            if (index === 0) dot.classList.add('active');
            dot.setAttribute('data-index', index);
            dotsContainer.appendChild(dot);
        }
    });

    const slides = sliderContainer.querySelectorAll('.slide');
    const dots = dotsContainer ? dotsContainer.querySelectorAll('.dot') : [];
    let currentSlide = 0;
    let slideInterval;

    const showSlide = (index) => {
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        if (slides[index]) { slides[index].classList.add('active'); currentSlide = index; }
        if (dots[index]) dots[index].classList.add('active');
    };

    const nextSlide = () => showSlide((currentSlide + 1) % slides.length);
    const prevSlide = () => showSlide((currentSlide - 1 + slides.length) % slides.length);
    const startAutoSlide = () => { clearInterval(slideInterval); if (slides.length > 1) slideInterval = setInterval(nextSlide, 5000); };

    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAutoSlide(); });
    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startAutoSlide(); });
    if (dotsContainer) {
        dotsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('dot')) {
                showSlide(parseInt(e.target.getAttribute('data-index')));
                startAutoSlide();
            }
        });
    }
    startAutoSlide();
};

// =============================================
// 4. DOMContentLoaded - 페이지별 초기화
// =============================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 내비게이션 & 모바일 메뉴 ---
    const menuToggle = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                if (navMenu.classList.contains('active')) {
                    menuToggle.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            });
        });
    }

    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.style.padding = '0.8rem 5%';
                header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            } else {
                header.style.padding = '1.2rem 5%';
                header.style.boxShadow = 'none';
            }
        });
    }

    // --- 슬라이더 초기화 (index.html) ---
    setupSlider({
        containerId: 'hero-slider-container', dotsId: 'hero-slider-dots',
        prevId: 'hero-prev', nextId: 'hero-next',
        storageKey: 'banners', defaults: HERO_DEFAULTS
    });
    setupSlider({
        containerId: 'mid-slider-container', dotsId: 'mid-slider-dots',
        prevId: 'mid-prev', nextId: 'mid-next',
        storageKey: 'midBanners', defaults: MID_DEFAULTS
    });

    // --- 6단계 공정 표시 (index.html) ---
    const processDisplayContainer = document.getElementById('process-display-container');
    if (processDisplayContainer) {
        let processData = JSON.parse(localStorage.getItem('processData') || '[]');
        if (processData.length === 0) processData = PROCESS_DEFAULTS;
        processDisplayContainer.innerHTML = '';
        processData.forEach((step, index) => {
            const box = document.createElement('div');
            box.classList.add('process-step-box');
            box.innerHTML = `
                <div class="step-badge">STEP 0${index + 1}</div>
                <div class="step-img-wrapper"><img src="${step.url}" alt="${step.title}"></div>
                <div class="step-icon"><i class="fas ${step.icon}"></i></div>
                <h4>${step.title}</h4>
                <p>${step.desc}</p>
            `;
            processDisplayContainer.appendChild(box);
        });
    }

    // --- 실시간 서비스 현황 롤링 (index.html) ---
    const liveList = document.getElementById('live-reservation-list');
    if (liveList) {
        const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
        if (reservations.length === 0) {
            liveList.innerHTML = '<div style="padding: 3rem; text-align: center; color: #999; width: 100%;">현재 접수된 예약 내역이 없습니다.</div>';
            liveList.style.animation = 'none';
        } else {
            const recent = reservations.sort((a, b) => b.id - a.id).slice(0, 5);
            const displayList = [...recent, ...recent]; // 무한 롤링용 복사
            liveList.innerHTML = '';
            displayList.forEach(res => {
                const maskedName = res.name.length > 2
                    ? res.name[0] + '*'.repeat(res.name.length - 2) + res.name[res.name.length - 1]
                    : res.name[0] + '*';

                const phoneParts = res.phone.split('-');
                const maskedPhone = phoneParts.length === 3
                    ? `${phoneParts[0]}-****-${phoneParts[2]}`
                    : res.phone.substring(0, 3) + '****' + res.phone.substring(res.phone.length - 4);

                const statusText = res.status === 'confirmed' ? '예약확정' : '접수완료';
                const statusClass = res.status === 'confirmed' ? 'confirmed' : 'pending';

                let serviceName = '';
                switch (res.service) {
                    case 'wall': serviceName = '벽걸이'; break;
                    case 'stand': serviceName = '스탠드'; break;
                    case 'multi': serviceName = '2-in-1'; break;
                    case 'system': serviceName = '시스템'; break;
                    default: serviceName = res.service || '기타';
                }

                const item = document.createElement('div');
                item.classList.add('rolling-item');
                item.innerHTML = `
                    <div class="col">${res.date}</div>
                    <div class="col"><span class="status-badge ${statusClass}">${statusText}</span></div>
                    <div class="col">${maskedName}</div>
                    <div class="col">${maskedPhone}</div>
                    <div class="col">${serviceName}</div>
                `;
                liveList.appendChild(item);
            });
            liveList.style.animation = `rollUp ${recent.length * 4}s linear infinite`;
        }
    }

    // --- 예약 달력 (reservation.html) ---
    const calendarDaysGrid = document.getElementById('calendarDays');
    if (calendarDaysGrid) {
        const calendarTitle = document.getElementById('calendarTitle');
        const prevMonthBtn = document.getElementById('prevMonthBtn');
        const nextMonthBtn = document.getElementById('nextMonthBtn');
        const bookingFormSection = document.getElementById('bookingFormSection');
        const displaySelectedDate = document.getElementById('displaySelectedDate');
        const inputSelectedDate = document.getElementById('inputSelectedDate');

        let viewDate = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const renderCalendar = () => {
            calendarDaysGrid.innerHTML = '';
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            if (calendarTitle) calendarTitle.textContent = `${year}년 ${month + 1}월`;

            const firstDayIndex = new Date(year, month, 1).getDay();
            const lastDayDate = new Date(year, month + 1, 0).getDate();

            for (let i = 0; i < firstDayIndex; i++) {
                const empty = document.createElement('div');
                empty.classList.add('day-cell', 'empty');
                calendarDaysGrid.appendChild(empty);
            }

            for (let day = 1; day <= lastDayDate; day++) {
                const dayCell = document.createElement('div');
                dayCell.classList.add('day-cell');
                const cellDate = new Date(year, month, day);
                const isPast = cellDate < today;
                const isWeekend = (cellDate.getDay() === 0 || cellDate.getDay() === 6);

                dayCell.innerHTML = `
                    <span class="day-num">${day}</span>
                    <span class="day-status ${isPast ? 'past' : (isWeekend ? 'full' : 'avail')}">
                        ${isPast ? '종료' : (isWeekend ? '마감' : '가능')}
                    </span>
                `;
                if (cellDate.getTime() === today.getTime()) dayCell.classList.add('today');
                if (isPast || isWeekend) {
                    dayCell.classList.add('disabled');
                } else {
                    dayCell.addEventListener('click', () => {
                        document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active'));
                        dayCell.classList.add('active');
                        const formattedDate = `${year}년 ${month + 1}월 ${day}일`;
                        if (displaySelectedDate) displaySelectedDate.textContent = formattedDate;
                        if (inputSelectedDate) inputSelectedDate.value = `${year}-${month + 1}-${day}`;
                        if (bookingFormSection) {
                            bookingFormSection.style.display = 'block';
                            bookingFormSection.scrollIntoView({ behavior: 'smooth' });
                        }
                    });
                }
                calendarDaysGrid.appendChild(dayCell);
            }
        };

        if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() - 1);
            if (bookingFormSection) bookingFormSection.style.display = 'none';
            renderCalendar();
        });
        if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() + 1);
            if (bookingFormSection) bookingFormSection.style.display = 'none';
            renderCalendar();
        });
        renderCalendar();
    }

    // --- 예약 폼 제출 (reservation.html) ---
    const bookingForm = document.getElementById('realtimeBookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(bookingForm);
            const data = Object.fromEntries(formData.entries());
            const newReservation = {
                id: Date.now(),
                createdAt: new Date().toLocaleString(),
                date: data.selected_date,
                time: data.booking_time,
                name: data.user_name,
                phone: data.user_phone,
                service: data.service_type,
                status: 'pending'
            };
            const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
            reservations.push(newReservation);
            localStorage.setItem('reservations', JSON.stringify(reservations));
            alert('예약이 성공적으로 접수되었습니다!');
            bookingForm.reset();
            const bookingFormSection = document.getElementById('bookingFormSection');
            if (bookingFormSection) bookingFormSection.style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- 상담 문의 폼 (contact.html) ---
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(contactForm);
            const contact = {
                id: Date.now(),
                createdAt: new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                name: data.get('name'),
                phone: data.get('phone'),
                message: data.get('message'),
                read: false
            };
            const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
            contacts.push(contact);
            localStorage.setItem('contacts', JSON.stringify(contacts));

            contactForm.style.display = 'none';
            const successEl = document.getElementById('contact-success');
            if (successEl) successEl.style.display = 'block';
            contactForm.reset();
        });
    }

    // --- 관리자 페이지 초기화 ---
    if (document.body.classList.contains('admin-body')) {
        showSection('reservations');
    }
});
