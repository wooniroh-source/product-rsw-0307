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

    // --- 3. 예약 폼 제출 로직 ---
    const setupBookingForm = () => {
        const bookingForm = document.getElementById('realtimeBookingForm');
        if (!bookingForm) return;

        bookingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(bookingForm);
            const data = Object.fromEntries(formData.entries());

            console.log('Booking Data:', data);
            alert(`예약이 성공적으로 접수되었습니다!\n\n일시: ${data.selected_date} ${data.booking_time}\n성함: ${data.user_name}\n\n곧 안내 문자를 발송해 드리겠습니다.`);
            
            bookingForm.reset();
            document.getElementById('bookingFormSection').style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    // 실행
    setupNavigation();
    setupCalendar();
    setupBookingForm();
});
