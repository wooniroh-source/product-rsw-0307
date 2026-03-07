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
        
        if (!calendarDaysGrid) return; // 달력이 없는 페이지면 중단

        let viewDate = new Date(); // 현재 보고 있는 달력의 날짜
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const render = () => {
            calendarDaysGrid.innerHTML = '';
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();

            calendarTitle.textContent = `${year}년 ${month + 1}월`;

            const firstDayIndex = new Date(year, month, 1).getDay();
            const lastDayDate = new Date(year, month + 1, 0).getDate();

            // 이전 달 빈칸
            for (let i = 0; i < firstDayIndex; i++) {
                const emptyDiv = document.createElement('div');
                emptyDiv.classList.add('day-cell', 'empty');
                calendarDaysGrid.appendChild(emptyDiv);
            }

            // 이번 달 날짜 채우기
            for (let day = 1; day <= lastDayDate; day++) {
                const dayCell = document.createElement('div');
                dayCell.classList.add('day-cell');
                
                const cellDate = new Date(year, month, day);
                const isPast = cellDate < today;
                const isToday = cellDate.getTime() === today.getTime();
                
                // 가상의 예약 마감 데이터 (주말은 마감으로 가정)
                const isFull = (cellDate.getDay() === 0 || cellDate.getDay() === 6);

                dayCell.innerHTML = `
                    <span class="day-num">${day}</span>
                    <span class="day-status ${isPast ? 'past' : (isFull ? 'full' : 'avail')}">
                        ${isPast ? '종료' : (isFull ? '마감' : '가능')}
                    </span>
                `;

                if (isToday) dayCell.classList.add('today');
                if (isPast || isFull) dayCell.classList.add('disabled');

                if (!isPast && !isFull) {
                    dayCell.addEventListener('click', () => {
                        // 선택 표시 초기화
                        document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active'));
                        dayCell.classList.add('active');

                        // 폼 표시 및 데이터 설정
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

    // --- 3. 예약 폼 제출 로직 (LocalStorage 저장 포함) ---
    const setupBookingForm = () => {
        const bookingForm = document.getElementById('realtimeBookingForm');
        if (!bookingForm) return;

        bookingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(bookingForm);
            const data = Object.fromEntries(formData.entries());

            // 1. 예약 데이터 객체 생성
            const newReservation = {
                id: Date.now(), // 고유 ID
                createdAt: new Date().toLocaleString(),
                date: data.selected_date,
                time: data.booking_time,
                name: data.user_name,
                phone: data.user_phone,
                service: data.service_type,
                status: 'pending' // pending, confirmed, cancelled
            };

            // 2. LocalStorage에서 기존 데이터 가져오기
            const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
            
            // 3. 새 데이터 추가 및 저장
            reservations.push(newReservation);
            localStorage.setItem('reservations', JSON.stringify(reservations));

            console.log('Saved Reservation:', newReservation);
            alert(`예약이 성공적으로 접수되었습니다!\n\n일시: ${data.selected_date} ${data.booking_time}\n성함: ${data.user_name}\n\n관리자 확인 후 확정 문자를 발송해 드리겠습니다.`);
            
            bookingForm.reset();
            document.getElementById('bookingFormSection').style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    // --- 4. 관리자 페이지 로직 ---
    const setupAdminPage = () => {
        const tableBody = document.getElementById('reservationTableBody');
        const refreshBtn = document.getElementById('refreshBtn');
        const totalCount = document.getElementById('totalCount');
        const pendingCount = document.getElementById('pendingCount');
        const confirmedCount = document.getElementById('confirmedCount');
        const noDataMessage = document.getElementById('noDataMessage');

        if (!tableBody) return; // 관리자 페이지가 아니면 중단

        const renderTable = () => {
            const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
            
            // 통계 업데이트
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

            // 최신순 정렬
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

        // 전역 함수로 등록 (HTML onclick에서 접근 가능하도록)
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

        if (refreshBtn) {
            refreshBtn.addEventListener('click', renderTable);
        }

        renderTable();
    };

    // --- 5. 히어로 슬라이더 로직 (동적 로딩 포함) ---
    const setupHeroSlider = () => {
        const sliderContainer = document.querySelector('.slider-container');
        const dotsContainer = document.querySelector('.slider-dots');
        const prevBtn = document.querySelector('.slider-arrow.prev');
        const nextBtn = document.querySelector('.slider-arrow.next');
        
        if (!sliderContainer) return;

        // 1. 배너 데이터 가져오기 (LocalStorage 또는 기본값)
        let banners = JSON.parse(localStorage.getItem('banners') || '[]');
        
        // 데이터가 없으면 기본값 설정
        if (banners.length === 0) {
            banners = [
                {
                    id: 1,
                    title: "당신의 숨결을 디자인합니다",
                    desc: "전문 분해 세척으로 시작하는 깨끗한 실내 공기 솔루션",
                    url: "https://images.unsplash.com/photo-1590402444816-05d848218571?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
                    btnText: "온라인 예약하기",
                    btnLink: "reservation.html"
                },
                {
                    id: 2,
                    title: "10년 경력의 베테랑 엔지니어",
                    desc: "까다로운 시스템 에어컨부터 가정용까지 완벽하게 케어합니다",
                    url: "https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
                    btnText: "서비스 상세 보기",
                    btnLink: "services.html"
                },
                {
                    id: 3,
                    title: "친환경 세제 안심 공법",
                    desc: "우리가족 건강을 생각하는 FDA 승인 친환경 약품 사용",
                    url: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
                    btnText: "브랜드 스토리",
                    btnLink: "about.html"
                }
            ];
        }

        // 2. 슬라이드 DOM 생성
        sliderContainer.innerHTML = '';
        dotsContainer.innerHTML = '';

        banners.forEach((banner, index) => {
            const slide = document.createElement('div');
            slide.classList.add('slide');
            if (index === 0) slide.classList.add('active');
            slide.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${banner.url}')`;
            
            slide.innerHTML = `
                <div class="hero-content">
                    <h2>${banner.title}</h2>
                    <p>${banner.desc}</p>
                    <div class="hero-btns">
                        <a href="${banner.btnLink}" class="btn">${banner.btnText}</a>
                    </div>
                </div>
            `;
            sliderContainer.appendChild(slide);

            const dot = document.createElement('span');
            dot.classList.add('dot');
            if (index === 0) dot.classList.add('active');
            dot.setAttribute('data-index', index);
            dotsContainer.appendChild(dot);
        });

        const slides = document.querySelectorAll('.slide');
        const dots = document.querySelectorAll('.slider-dots .dot');
        
        let currentSlide = 0;
        let slideInterval;

        const showSlide = (index) => {
            slides.forEach(s => s.classList.remove('active'));
            dots.forEach(d => d.classList.remove('active'));
            
            if (slides[index]) {
                slides[index].classList.add('active');
                dots[index].classList.add('active');
                currentSlide = index;
            }
        };

        const nextSlide = () => {
            let next = (currentSlide + 1) % slides.length;
            showSlide(next);
        };

        const prevSlide = () => {
            let prev = (currentSlide - 1 + slides.length) % slides.length;
            showSlide(prev);
        };

        const startAutoSlide = () => {
            stopAutoSlide();
            if (slides.length > 1) {
                slideInterval = setInterval(nextSlide, 5000);
            }
        };

        const stopAutoSlide = () => {
            if (slideInterval) clearInterval(slideInterval);
        };

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                nextSlide();
                startAutoSlide();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                prevSlide();
                startAutoSlide();
            });
        }

        dotsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('dot')) {
                const index = parseInt(e.target.getAttribute('data-index'));
                showSlide(index);
                startAutoSlide();
            }
        });

        startAutoSlide();
    };

    // --- 6. 관리자 페이지: 섹션 전환 및 배너 관리 ---
    window.showSection = (sectionId) => {
        const reservationsSection = document.getElementById('section-reservations');
        const bannersSection = document.getElementById('section-banners');
        const resMenu = document.getElementById('menu-reservations');
        const banMenu = document.getElementById('menu-banners');

        if (reservationsSection) reservationsSection.style.display = sectionId === 'reservations' ? 'block' : 'none';
        if (bannersSection) bannersSection.style.display = sectionId === 'banners' ? 'block' : 'none';
        
        if (resMenu) resMenu.classList.toggle('active', sectionId === 'reservations');
        if (banMenu) banMenu.classList.toggle('active', sectionId === 'banners');

        if (sectionId === 'banners') renderBannerTable();
    };

    const renderBannerTable = () => {
        const bannerTableBody = document.getElementById('bannerTableBody');
        if (!bannerTableBody) return;

        const banners = JSON.parse(localStorage.getItem('banners') || '[]');
        bannerTableBody.innerHTML = '';

        if (banners.length === 0) {
            bannerTableBody.innerHTML = '<tr><td colspan="3" class="no-data">등록된 배너가 없습니다. 기본 배너가 표시됩니다.</td></tr>';
            return;
        }

        banners.forEach(banner => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${banner.url}" style="width: 150px; height: 80px; object-fit: cover; border-radius: 4px;"></td>
                <td>
                    <strong>${banner.title}</strong><br>
                    <small>${banner.desc}</small><br>
                    <span style="font-size: 0.8rem; color: var(--primary);">${banner.btnText} -> ${banner.btnLink}</span>
                </td>
                <td>
                    <button class="btn-sm btn-cancel" onclick="deleteBanner(${banner.id})">삭제</button>
                </td>
            `;
            bannerTableBody.appendChild(tr);
        });
    };

    const setupBannerForm = () => {
        const bannerForm = document.getElementById('bannerForm');
        if (!bannerForm) return;

        bannerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(bannerForm);
            const banners = JSON.parse(localStorage.getItem('banners') || '[]');
            
            const newBanner = {
                id: Date.now(),
                title: formData.get('bannerTitle'),
                url: formData.get('bannerUrl'),
                desc: formData.get('bannerDesc'),
                btnText: formData.get('bannerBtnText'),
                btnLink: formData.get('bannerBtnLink')
            };

            banners.push(newBanner);
            localStorage.setItem('banners', JSON.stringify(banners));
            alert('배너가 등록되었습니다.');
            bannerForm.reset();
            renderBannerTable();
        });
    };

    window.deleteBanner = (id) => {
        if (!confirm('배너를 삭제하시겠습니까?')) return;
        let banners = JSON.parse(localStorage.getItem('banners') || '[]');
        banners = banners.filter(b => b.id !== id);
        localStorage.setItem('banners', JSON.stringify(banners));
        renderBannerTable();
    };

    // 실행
    setupNavigation();
    setupCalendar();
    setupBookingForm();
    setupAdminPage();
    setupHeroSlider();
    setupBannerForm();
});
