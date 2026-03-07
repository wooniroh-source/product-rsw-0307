document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. 내비게이션 및 스크롤 로직 ---
    const setupNavigation = () => {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    };

    // --- 2. 예약 달력 핵심 로직 ---
    const setupCalendar = () => {
        const calendarDaysGrid = document.getElementById('calendarDays');
        const calendarTitle = document.getElementById('calendarTitle');
        const prevMonthBtn = document.getElementById('prevMonthBtn');
        const nextMonthBtn = document.getElementById('nextMonthBtn');
        const bookingFormSection = document.getElementById('bookingFormSection');
        const displaySelectedDate = document.getElementById('displaySelectedDate');
        const inputSelectedDate = document.getElementById('inputSelectedDate');
        
        if (!calendarDaysGrid) return;

        let viewDate = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const render = () => {
            calendarDaysGrid.innerHTML = '';
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();

            calendarTitle.textContent = `${year}년 ${month + 1}월`;

            const firstDayIndex = new Date(year, month, 1).getDay();
            const lastDayDate = new Date(year, month + 1, 0).getDate();

            for (let i = 0; i < firstDayIndex; i++) {
                const emptyDiv = document.createElement('div');
                emptyDiv.classList.add('day-cell', 'empty');
                calendarDaysGrid.appendChild(emptyDiv);
            }

            for (let day = 1; day <= lastDayDate; day++) {
                const dayCell = document.createElement('div');
                dayCell.classList.add('day-cell');
                
                const cellDate = new Date(year, month, day);
                const isPast = cellDate < today;
                const isFull = (cellDate.getDay() === 0 || cellDate.getDay() === 6);

                dayCell.innerHTML = `
                    <span class="day-num">${day}</span>
                    <span class="day-status ${isPast ? 'past' : (isFull ? 'full' : 'avail')}">
                        ${isPast ? '종료' : (isFull ? '마감' : '가능')}
                    </span>
                `;

                if (cellDate.getTime() === today.getTime()) dayCell.classList.add('today');
                if (isPast || isFull) dayCell.classList.add('disabled');

                if (!isPast && !isFull) {
                    dayCell.addEventListener('click', () => {
                        document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active'));
                        dayCell.classList.add('active');

                        const formattedDate = `${year}년 ${month + 1}월 ${day}일`;
                        displaySelectedDate.textContent = formattedDate;
                        inputSelectedDate.value = `${year}-${month + 1}-${day}`;
                        
                        bookingFormSection.style.display = 'block';
                        bookingFormSection.scrollIntoView({ behavior: 'smooth' });
                    });
                }
                calendarDaysGrid.appendChild(dayCell);
            }
        };

        prevMonthBtn.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() - 1);
            bookingFormSection.style.display = 'none';
            render();
        });

        nextMonthBtn.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() + 1);
            bookingFormSection.style.display = 'none';
            render();
        });

        render();
    };

    // --- 3. 예약 폼 제출 로직 ---
    const setupBookingForm = () => {
        const bookingForm = document.getElementById('realtimeBookingForm');
        if (!bookingForm) return;

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
            document.getElementById('bookingFormSection').style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // 실시간 현황 즉시 업데이트 (메인 페이지일 경우)
            if (document.getElementById('live-reservation-list')) setupLiveReservationStatus();
        });
    };

    // --- 4. 관리자 페이지: 예약 현황 ---
    const setupAdminPage = () => {
        const tableBody = document.getElementById('reservationTableBody');
        const refreshBtn = document.getElementById('refreshBtn');
        const totalCount = document.getElementById('totalCount');
        const pendingCount = document.getElementById('pendingCount');
        const confirmedCount = document.getElementById('confirmedCount');
        const noDataMessage = document.getElementById('noDataMessage');

        if (!tableBody) return;

        const renderTable = () => {
            const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
            
            if (totalCount) totalCount.textContent = `${reservations.length}건`;
            if (pendingCount) pendingCount.textContent = `${reservations.filter(r => r.status === 'pending').length}건`;
            if (confirmedCount) confirmedCount.textContent = `${reservations.filter(r => r.status === 'confirmed').length}건`;

            tableBody.innerHTML = '';

            if (reservations.length === 0) {
                noDataMessage.style.display = 'block';
                return;
            } else {
                noDataMessage.style.display = 'none';
            }

            reservations.sort((a, b) => b.id - a.id).forEach(res => {
                const tr = document.createElement('tr');
                
                let statusBadge = '';
                if(res.status === 'pending') statusBadge = '<span class="badge pending">대기중</span>';
                else if(res.status === 'confirmed') statusBadge = '<span class="badge confirmed">확정됨</span>';
                else if(res.status === 'cancelled') statusBadge = '<span class="badge cancelled">취소됨</span>';

                let serviceName = '';
                switch(res.service) {
                    case 'wall': serviceName = '벽걸이'; break;
                    case 'stand': serviceName = '스탠드'; break;
                    case 'multi': serviceName = '2-in-1'; break;
                    case 'system': serviceName = '시스템'; break;
                    default: serviceName = res.service;
                }

                tr.innerHTML = `
                    <td>${res.createdAt.split('. ')[1] || res.createdAt}</td>
                    <td>${res.date}<br><small>${res.time}</small></td>
                    <td>${res.name}</td>
                    <td>${res.phone}</td>
                    <td>${serviceName}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${res.status === 'pending' ? `<button class="btn-sm btn-approve" onclick="updateStatus(${res.id}, 'confirmed')">승인</button>` : ''}
                        ${res.status !== 'cancelled' ? `<button class="btn-sm btn-cancel" onclick="updateStatus(${res.id}, 'cancelled')">취소</button>` : ''}
                        <button class="btn-sm btn-delete" onclick="deleteReservation(${res.id})"><i class="fas fa-trash"></i></button>
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
                renderTable();
            }
        };

        window.deleteReservation = (id) => {
            if(!confirm('정말 삭제하시겠습니까?')) return;
            const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
            const newReservations = reservations.filter(r => r.id !== id);
            localStorage.setItem('reservations', JSON.stringify(newReservations));
            renderTable();
        };

        if (refreshBtn) refreshBtn.addEventListener('click', renderTable);
        renderTable();
    };

    // --- 5. 공통 슬라이더 엔진 로직 ---
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
            slide.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${item.url}')`;
            
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
            if (dots.length > 0) dots.forEach(d => d.classList.remove('active'));
            if (slides[index]) {
                slides[index].classList.add('active');
                if (dots[index]) dots[index].classList.add('active');
                currentSlide = index;
            }
        };

        const nextSlide = () => { let next = (currentSlide + 1) % slides.length; showSlide(next); };
        const prevSlide = () => { let prev = (currentSlide - 1 + slides.length) % slides.length; showSlide(prev); };
        const startAutoSlide = () => { stopAutoSlide(); if (slides.length > 1) slideInterval = setInterval(nextSlide, 5000); };
        const stopAutoSlide = () => { if (slideInterval) clearInterval(slideInterval); };

        if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAutoSlide(); });
        if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startAutoSlide(); });
        if (dotsContainer) {
            dotsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('dot')) {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    showSlide(index);
                    startAutoSlide();
                }
            });
        }
        startAutoSlide();
    };

    // --- 6. 배너 초기화 데이터 ---
    const heroDefaults = [
        { id: 1, title: "당신의 숨결을 디자인합니다", desc: "전문 분해 세척으로 시작하는 깨끗한 실내 공기 솔루션", url: "https://images.unsplash.com/photo-1590402444816-05d848218571?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "온라인 예약하기", btnLink: "reservation.html" },
        { id: 2, title: "10년 경력의 베테랑 엔지니어", desc: "까다로운 시스템 에어컨부터 가정용까지 완벽하게 케어합니다", url: "https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "서비스 상세 보기", btnLink: "services.html" },
        { id: 3, title: "친환경 세제 안심 공법", desc: "우리가족 건강을 생각하는 FDA 승인 친환경 약품 사용", url: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", btnText: "브랜드 스토리", btnLink: "about.html" }
    ];

    const midDefaults = [
        { id: 1, title: "완벽한 분해, 철저한 살균", desc: "보이지 않는 곳까지 클린앤파트너즈가 책임집니다.", url: "https://images.unsplash.com/photo-1558389186-438424b00a32?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" },
        { id: 2, title: "쾌적한 여름의 시작", desc: "지금 예약하고 시원한 바람을 만나보세요.", url: "https://images.unsplash.com/photo-1563453392212-326f5e854473?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" }
    ];

    // --- 7. 6단계 안심 공정 관리 로직 ---
    const defaultProcess = [
        { title: "사전 점검", desc: "작동 상태 및 오염도 확인", url: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-clipboard-check" },
        { title: "부품 분해", desc: "완전 분해를 통한 내부 노출", url: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-tools" },
        { title: "고압 세척", desc: "고압 세척기로 찌든때 제거", url: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-faucet-drip" },
        { title: "살균 소독", desc: "99.9% 세균 및 곰팡이 살균", url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-spray-can-sparkles" },
        { title: "제품 조립", desc: "세척된 부품의 정밀 재조립", url: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-laptop-house" },
        { title: "최종 시운전", desc: "정상 작동 확인 및 마무리", url: "https://images.unsplash.com/photo-1581092162384-8987c1d64718?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", icon: "fa-power-off" }
    ];

    const setupProcessDisplay = () => {
        const container = document.getElementById('process-display-container');
        if (!container) return;
        let processData = JSON.parse(localStorage.getItem('processData') || '[]');
        if (processData.length === 0) processData = defaultProcess;
        container.innerHTML = '';
        processData.forEach((step, index) => {
            const box = document.createElement('div');
            box.classList.add('process-step-box');
            box.innerHTML = `<div class="step-badge">STEP 0${index + 1}</div><div class="step-img-wrapper"><img src="${step.url}" alt="${step.title}"></div><div class="step-icon"><i class="fas ${step.icon}"></i></div><h4>${step.title}</h4><p>${step.desc}</p>`;
            container.appendChild(box);
        });
    };

    // --- 8. 실시간 서비스 현황 로직 ---
    const setupLiveReservationStatus = () => {
        const container = document.getElementById('live-reservation-list');
        if (!container) return;

        const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');

        if (reservations.length === 0) {
            container.innerHTML = '<tr><td colspan="5" style="padding: 3rem; color: #999;">현재 접수된 예약 내역이 없습니다.</td></tr>';
            return;
        }

        const recentReservations = reservations
            .sort((a, b) => b.id - a.id)
            .slice(0, 7);

        container.innerHTML = '';
        recentReservations.forEach(res => {
            const maskedName = res.name.length > 2 
                ? res.name[0] + '*'.repeat(res.name.length - 2) + res.name[res.name.length - 1]
                : res.name[0] + '*';

            const phoneParts = res.phone.split('-');
            let maskedPhone = res.phone;
            if (phoneParts.length === 3) {
                maskedPhone = `${phoneParts[0]}-****-${phoneParts[2]}`;
            } else if (res.phone.length >= 10) {
                maskedPhone = res.phone.substring(0, 3) + '****' + res.phone.substring(res.phone.length - 4);
            }

            const statusText = res.status === 'confirmed' ? '예약확정' : '접수완료';
            const statusClass = res.status === 'confirmed' ? 'confirmed' : 'pending';

            let serviceName = '';
            switch(res.service) {
                case 'wall': serviceName = '벽걸이'; break;
                case 'stand': serviceName = '스탠드'; break;
                case 'multi': serviceName = '2-in-1'; break;
                case 'system': serviceName = '시스템'; break;
                default: serviceName = res.service;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${res.date}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${maskedName} 고객님</td>
                <td>${maskedPhone}</td>
                <td>${serviceName}</td>
            `;
            container.appendChild(tr);
        });
    };

    // --- 9. 관리자 페이지 공통 로직 ---
    window.showSection = (sectionId) => {
        const sections = ['reservations', 'banners', 'mid-banners', 'process'];
        sections.forEach(s => {
            const el = document.getElementById(`section-${s}`);
            const menu = document.getElementById(`menu-${s}`);
            if (el) el.style.display = s === sectionId ? 'block' : 'none';
            if (menu) menu.classList.toggle('active', s === sectionId);
        });
        if (sectionId === 'banners') renderTable('banners', 'bannerTableBody');
        if (sectionId === 'mid-banners') renderTable('midBanners', 'midBannerTableBody');
        if (sectionId === 'process') renderProcessEditForm();
    };

    const renderTable = (storageKey, bodyId) => {
        const body = document.getElementById(bodyId);
        if (!body) return;
        const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
        body.innerHTML = items.length === 0 ? '<tr><td colspan="3" class="no-data">데이터가 없습니다.</td></tr>' : '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${item.url}" style="width: 120px; height: 60px; object-fit: cover; border-radius: 4px;"></td>
                <td><strong>${item.title}</strong><br><small>${item.desc}</small></td>
                <td><button class="btn-sm btn-cancel" onclick="deleteItem('${storageKey}', ${item.id})">삭제</button></td>
            `;
            body.appendChild(tr);
        });
    };

    window.deleteItem = (storageKey, id) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        let items = JSON.parse(localStorage.getItem(storageKey) || '[]');
        localStorage.setItem(storageKey, JSON.stringify(items.filter(i => i.id !== id)));
        const bodyId = storageKey === 'banners' ? 'bannerTableBody' : 'midBannerTableBody';
        renderTable(storageKey, bodyId);
    };

    const setupForms = () => {
        const bForm = document.getElementById('bannerForm');
        if (bForm) {
            bForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(bForm);
                const items = JSON.parse(localStorage.getItem('banners') || '[]');
                items.push({ id: Date.now(), title: formData.get('bannerTitle'), url: formData.get('bannerUrl'), desc: formData.get('bannerDesc'), btnText: formData.get('bannerBtnText'), btnLink: formData.get('bannerBtnLink') });
                localStorage.setItem('banners', JSON.stringify(items));
                alert('등록되었습니다.'); bForm.reset(); renderTable('banners', 'bannerTableBody');
            });
        }
        const mForm = document.getElementById('midBannerForm');
        if (mForm) {
            mForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(mForm);
                const items = JSON.parse(localStorage.getItem('midBanners') || '[]');
                items.push({ id: Date.now(), title: formData.get('midBannerTitle'), url: formData.get('midBannerUrl'), desc: formData.get('midBannerDesc') });
                localStorage.setItem('midBanners', JSON.stringify(items));
                alert('등록되었습니다.'); mForm.reset(); renderTable('midBanners', 'midBannerTableBody');
            });
        }
    };

    const renderProcessEditForm = () => {
        const container = document.getElementById('process-steps-edit-container');
        if (!container) return;
        let processData = JSON.parse(localStorage.getItem('processData') || '[]');
        if (processData.length === 0) processData = defaultProcess;
        container.innerHTML = '';
        processData.forEach((step, index) => {
            const card = document.createElement('div');
            card.classList.add('process-edit-card');
            card.innerHTML = `<h4>STEP 0${index + 1}</h4><div class="input-group"><label>제목</label><input type="text" class="proc-title" value="${step.title}"></div><div class="input-group"><label>URL</label><input type="url" class="proc-url" value="${step.url}"></div><div class="input-group"><label>설명</label><input type="text" class="proc-desc" value="${step.desc}"></div><div class="input-group"><label>아이콘</label><input type="text" class="proc-icon" value="${step.icon}"></div>`;
            container.appendChild(card);
        });
    };

    const setupProcessForm = () => {
        const form = document.getElementById('processForm');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const titles = document.querySelectorAll('.proc-title'), urls = document.querySelectorAll('.proc-url'), descs = document.querySelectorAll('.proc-desc'), icons = document.querySelectorAll('.proc-icon');
            const newData = [];
            for (let i = 0; i < titles.length; i++) newData.push({ title: titles[i].value, url: urls[i].value, desc: descs[i].value, icon: icons[i].value });
            localStorage.setItem('processData', JSON.stringify(newData));
            alert('저장되었습니다.'); setupProcessDisplay();
        });
    };

    // --- 실행 ---
    setupNavigation();
    setupCalendar();
    setupBookingForm();
    setupAdminPage();
    
    // 슬라이더 초기화
    setupSlider({ containerId: 'hero-slider-container', dotsId: 'hero-slider-dots', prevId: 'hero-prev', nextId: 'hero-next', storageKey: 'banners', defaults: heroDefaults });
    setupSlider({ containerId: 'mid-slider-container', dotsId: 'mid-slider-dots', prevId: 'mid-prev', nextId: 'mid-next', storageKey: 'midBanners', defaults: midDefaults });
    
    setupProcessDisplay();
    setupLiveReservationStatus();
    setupForms();
    setupProcessForm();
});
