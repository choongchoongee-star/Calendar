document.addEventListener('DOMContentLoaded', () => {
    const monthYearElement = document.getElementById('month-year');
    const calendarElement = document.getElementById('calendar');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');
    const modal = document.getElementById('add-schedule-modal');
    const closeModalButton = document.querySelector('.modal-content .close-button');
    const saveScheduleButton = document.getElementById('save-schedule');
    const scheduleTextInput = document.getElementById('schedule-text');

    let currentDate = new Date();
    let schedules = JSON.parse(localStorage.getItem('schedules')) || {};

    function renderCalendar() {
        calendarElement.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        monthYearElement.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Create blank days for the first week
        for (let i = 0; i < firstDayOfMonth; i++) {
            const blankDay = document.createElement('div');
            blankDay.classList.add('day', 'blank');
            calendarElement.appendChild(blankDay);
        }

        // Create days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('day');
            dayElement.dataset.day = day;

            const dayNumber = document.createElement('span');
            dayNumber.classList.add('day-number');
            dayNumber.textContent = day;
            dayElement.appendChild(dayNumber);

            // Highlight today
            const today = new Date();
            if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                dayElement.classList.add('today');
            }

            const schedulesContainer = document.createElement('div');
            schedulesContainer.classList.add('schedules');
            dayElement.appendChild(schedulesContainer);

            // Add schedules for the day
            const dateString = `${year}-${month + 1}-${day}`;
            if (schedules[dateString]) {
                schedules[dateString].forEach((scheduleText, index) => {
                    const scheduleItem = createScheduleElement(scheduleText, dateString, index);
                    schedulesContainer.appendChild(scheduleItem);
                });
            }

            dayElement.addEventListener('click', () => openAddScheduleModal(dateString));
            calendarElement.appendChild(dayElement);
        }
    }

    function createScheduleElement(text, dateString, index) {
        const scheduleItem = document.createElement('div');
        scheduleItem.classList.add('schedule-item');
        scheduleItem.textContent = text;
        
        const deleteButton = document.createElement('span');
        deleteButton.classList.add('delete-schedule');
        deleteButton.innerHTML = '&times;';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent modal from opening
            deleteSchedule(dateString, index);
        });
        
        scheduleItem.appendChild(deleteButton);
        return scheduleItem;
    }

    function openAddScheduleModal(dateString) {
        modal.style.display = 'flex';
        modal.dataset.date = dateString;
    }

    function closeAddScheduleModal() {
        modal.style.display = 'none';
        scheduleTextInput.value = '';
    }

    function saveSchedule() {
        const dateString = modal.dataset.date;
        const scheduleText = scheduleTextInput.value.trim();

        if (scheduleText && dateString) {
            if (!schedules[dateString]) {
                schedules[dateString] = [];
            }
            schedules[dateString].push(scheduleText);
            saveSchedulesToLocalStorage();
            renderCalendar();
            closeAddScheduleModal();
        }
    }

    function deleteSchedule(dateString, index) {
        schedules[dateString].splice(index, 1);
        if (schedules[dateString].length === 0) {
            delete schedules[dateString];
        }
        saveSchedulesToLocalStorage();
        renderCalendar();
    }

    function saveSchedulesToLocalStorage() {
        localStorage.setItem('schedules', JSON.stringify(schedules));
    }

    // Event Listeners
    prevMonthButton.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthButton.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    closeModalButton.addEventListener('click', closeAddScheduleModal);
    saveScheduleButton.addEventListener('click', saveSchedule);
    
    // Close modal if clicked outside of it
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAddScheduleModal();
        }
    });

    // Initial render
    renderCalendar();
});
