document.addEventListener('DOMContentLoaded', () => {
    const monthYearElement = document.getElementById('month-year');
    const calendarElement = document.getElementById('calendar');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');
    
    // Modal elements
    const modal = document.getElementById('add-schedule-modal');
    const closeModalButton = document.querySelector('.modal-content .close-button');
    const saveScheduleButton = document.getElementById('save-schedule');
    const scheduleTextInput = document.getElementById('schedule-text');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');

    let currentDate = new Date();
    let schedules = [];
    try {
        const storedSchedules = JSON.parse(localStorage.getItem('schedules'));
        if (Array.isArray(storedSchedules)) {
            schedules = storedSchedules;
        }
    } catch (e) {
        console.error("Error parsing schedules from localStorage", e);
    }

    function renderCalendar() {
        calendarElement.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        monthYearElement.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;
        
        const weeks = getWeeksInMonth(year, month);
        
        weeks.forEach(week => {
            const weekRow = document.createElement('div');
            weekRow.classList.add('week-row');
            
            // 1. Create the Day Cells (Background Layer)
            const dayCells = [];
            let currentDay = new Date(week.start);
            
            for (let i = 0; i < 7; i++) {
                const dayEl = document.createElement('div');
                dayEl.classList.add('day-cell');
                
                // Determine if this day is in the current month
                const isCurrentMonth = currentDay.getMonth() === month;
                if (!isCurrentMonth) dayEl.classList.add('other-month');

                const dateString = formatDate(currentDay);
                dayEl.dataset.date = dateString;

                const dayNumber = document.createElement('span');
                dayNumber.classList.add('day-number');
                dayNumber.textContent = currentDay.getDate();
                dayEl.appendChild(dayNumber);

                const today = new Date();
                if (currentDay.toDateString() === today.toDateString()) {
                    dayEl.classList.add('today');
                }

                // Click to add schedule
                dayEl.addEventListener('click', () => openAddScheduleModal(dateString));

                weekRow.appendChild(dayEl);
                dayCells.push({ element: dayEl, date: new Date(currentDay) });
                
                currentDay.setDate(currentDay.getDate() + 1);
            }

            // 2. Process and Render Events for this Week (Events Layer)
            const eventsContainer = document.createElement('div');
            eventsContainer.classList.add('events-container');
            
            const weekEvents = getEventsForWeek(week.start, week.end);
            
            // Sort: Multi-day first (by duration desc), then single-day (by start time)
            weekEvents.sort((a, b) => {
                const aMulti = a.startDate !== a.endDate;
                const bMulti = b.startDate !== b.endDate;
                if (aMulti && !bMulti) return -1;
                if (!aMulti && bMulti) return 1;
                
                if (aMulti && bMulti) {
                    // Both multi: longer duration first
                    const aDur = new Date(a.endDate) - new Date(a.startDate);
                    const bDur = new Date(b.endDate) - new Date(b.startDate);
                    return bDur - aDur;
                } else {
                    // Both single: earlier time first
                    return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
                }
            });

            // Calculate layout tracks
            const tracks = []; // Array of arrays (days occupied)
            
            weekEvents.forEach(event => {
                // Determine span within this week
                const eventStart = new Date(event.startDate + 'T00:00:00');
                const eventEnd = new Date(event.endDate + 'T00:00:00');
                
                const renderStart = eventStart < week.start ? week.start : eventStart;
                const renderEnd = eventEnd > week.end ? week.end : eventEnd;

                // Map to 0-6 index
                const startIndex = Math.floor((renderStart - week.start) / (1000 * 60 * 60 * 24));
                const endIndex = Math.floor((renderEnd - week.start) / (1000 * 60 * 60 * 24));
                
                // Find first available track
                let trackIndex = 0;
                let placed = false;
                while (!placed) {
                    if (!tracks[trackIndex]) tracks[trackIndex] = new Array(7).fill(false);
                    
                    let collision = false;
                    for (let d = startIndex; d <= endIndex; d++) {
                        if (tracks[trackIndex][d]) {
                            collision = true;
                            break;
                        }
                    }
                    
                    if (!collision) {
                        // Place event
                        for (let d = startIndex; d <= endIndex; d++) {
                            tracks[trackIndex][d] = true;
                        }
                        placed = true;
                    } else {
                        trackIndex++;
                    }
                }

                // Render the Event Bar
                const eventBar = document.createElement('div');
                eventBar.classList.add('event-bar');
                if (event.startDate !== event.endDate) eventBar.classList.add('multi-day');
                
                // Content
                let text = event.text;
                if (event.startDate === event.endDate && event.startTime) {
                    text = `${event.startTime} ${text}`;
                }
                eventBar.textContent = text;
                
                // Delete button
                const deleteBtn = document.createElement('span');
                deleteBtn.innerHTML = '&times;';
                deleteBtn.classList.add('delete-btn');
                deleteBtn.onclick = (e) => { e.stopPropagation(); deleteSchedule(event.id); };
                eventBar.appendChild(deleteBtn);

                // Styling & Position
                const leftPercent = (startIndex / 7) * 100;
                const widthPercent = ((endIndex - startIndex + 1) / 7) * 100;
                
                eventBar.style.left = `calc(${leftPercent}% + 2px)`;
                eventBar.style.width = `calc(${widthPercent}% - 4px)`;
                eventBar.style.top = `${trackIndex * 26}px`; // Increased height slightly for better spacing

                // Continuity styling across week boundaries
                if (eventStart < week.start) {
                    eventBar.style.borderTopLeftRadius = '0';
                    eventBar.style.borderBottomLeftRadius = '0';
                    eventBar.style.marginLeft = '-2px';
                    eventBar.style.width = `calc(${widthPercent}% - 2px)`;
                }
                if (eventEnd > week.end) {
                    eventBar.style.borderTopRightRadius = '0';
                    eventBar.style.borderBottomRightRadius = '0';
                    eventBar.style.width = `calc(${eventBar.style.width} + 2px)`;
                }

                eventsContainer.appendChild(eventBar);
            });
            
            // Adjust row height based on number of tracks
            const baseHeight = 120; // Increased base height
            const contentHeight = tracks.length * 26 + 40; 
            const rowHeight = Math.max(baseHeight, contentHeight);
            weekRow.style.height = `${rowHeight}px`;

            weekRow.appendChild(eventsContainer);
            calendarElement.appendChild(weekRow);
        });
    }

    function getEventsForWeek(weekStart, weekEnd) {
        return schedules.filter(s => {
            const start = new Date(s.startDate + 'T00:00:00');
            const end = new Date(s.endDate + 'T00:00:00');
            return start <= weekEnd && end >= weekStart;
        });
    }

    function getWeeksInMonth(year, month) {
        const weeks = [];
        const firstDate = new Date(year, month, 1);
        const lastDate = new Date(year, month + 1, 0);
        
        // Start from the Sunday before or on the 1st
        let current = new Date(firstDate);
        current.setDate(current.getDate() - current.getDay());

        // Loop until we pass the end of the month
        // We also want to include the full week that contains the last day
        const endView = new Date(lastDate);
        endView.setDate(endView.getDate() + (6 - endView.getDay()));

        while(current <= endView) {
            const weekStart = new Date(current);
            const weekEnd = new Date(current);
            weekEnd.setDate(weekStart.getDate() + 6);
            weeks.push({ start: weekStart, end: weekEnd });
            current.setDate(current.getDate() + 7);
        }
        return weeks;
    }
    
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- Modal & Data Management ---

    function openAddScheduleModal(dateString) {
        modal.style.display = 'flex';
        startDateInput.value = dateString;
        endDateInput.value = dateString;
    }

    function closeAddScheduleModal() {
        modal.style.display = 'none';
        scheduleTextInput.value = '';
        startDateInput.value = '';
        endDateInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';
    }

    function saveSchedule() {
        const text = scheduleTextInput.value.trim();
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (text && startDate && endDate) {
            if (new Date(startDate) > new Date(endDate)) {
                alert("End date cannot be before start date.");
                return;
            }
            const newSchedule = {
                id: Date.now(),
                text,
                startDate,
                endDate,
                startTime,
                endTime
            };
            schedules.push(newSchedule);
            saveSchedulesToLocalStorage();
            renderCalendar();
            closeAddScheduleModal();
        }
    }

    function deleteSchedule(id) {
        schedules = schedules.filter(schedule => schedule.id !== id);
        saveSchedulesToLocalStorage();
        renderCalendar();
    }

    function saveSchedulesToLocalStorage() {
        localStorage.setItem('schedules', JSON.stringify(schedules));
    }

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
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAddScheduleModal();
        }
    });

    renderCalendar();
});