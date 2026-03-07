document.addEventListener('DOMContentLoaded', () => {

    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Reservation Calendar Logic
    const calendarGrid = document.getElementById('calendarGrid');
    const currentMonthYear = document.getElementById('currentMonthYear');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const reservationFormContainer = document.getElementById('reservationFormContainer');
    const selectedDateText = document.getElementById('selectedDateText');
    const selectedDateInput = document.getElementById('selectedDateInput');
    const reservationForm = document.getElementById('reservationForm');

    let currentDate = new Date();

    function renderCalendar(date) {
        calendarGrid.innerHTML = '';
        const year = date.getFullYear();
        const month = date.getMonth();
        
        currentMonthYear.textContent = `${year}년 ${month + 1}월`;

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const lastDateOfMonth = new Date(year, month + 1, 0).getDate();

        // Previous month days (empty slots)
        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('calendar-day', 'empty');
            calendarGrid.appendChild(emptyDay);
        }

        // Current month days
        const today = new Date();
        for (let i = 1; i <= lastDateOfMonth; i++) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day');
            dayElement.textContent = i;

            if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
                dayElement.classList.add('today');
            }

            dayElement.addEventListener('click', () => {
                document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
                dayElement.classList.add('selected');
                
                const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                selectedDateText.textContent = `${year}년 ${month + 1}월 ${i}일`;
                selectedDateInput.value = selectedDateStr;
                reservationFormContainer.style.display = 'block';
                
                reservationFormContainer.scrollIntoView({ behavior: 'smooth' });
            });

            calendarGrid.appendChild(dayElement);
        }
    }

    if (calendarGrid) {
        renderCalendar(currentDate);

        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar(currentDate);
            reservationFormContainer.style.display = 'none';
        });

        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar(currentDate);
            reservationFormContainer.style.display = 'none';
        });
    }

    if (reservationForm) {
        reservationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(reservationForm);
            const data = Object.fromEntries(formData.entries());
            
            console.log('Reservation Data:', data);
            alert(`${data.date} ${data.time}에 ${data.name}님의 예약이 접수되었습니다. 곧 연락드리겠습니다.`);
            
            reservationForm.reset();
            reservationFormContainer.style.display = 'none';
            document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
        });
    }

    // Form submission confirmation
    const contactForm = document.querySelector('#contact form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // In a real application, you would handle the form submission here (e.g., send data to a server).
            alert('문의해주셔서 감사합니다. 빠른 시일 내에 연락드리겠습니다.');
            contactForm.reset();
        });
    }

});
