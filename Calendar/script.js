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

    // Recurrence elements
    const enableRecurrenceCheckbox = document.getElementById('enable-recurrence');
    const recurrenceOptions = document.getElementById('recurrence-options');
    const recurrenceIntervalInput = document.getElementById('recurrence-interval');
    const recurrenceCountInput = document.getElementById('recurrence-count');

    // List Modal elements
    const listModal = document.getElementById('schedule-list-modal');
    const closeListModalButton = document.querySelector('.list-close');
    const listDateHeading = document.getElementById('list-date-heading');
    const scheduleListContainer = document.getElementById('schedule-list-container');
    const openAddModalBtn = document.getElementById('open-add-modal-btn');

    let currentDate = new Date();
    let currentSelectedDate = null; // Track selected date for adding new schedule
    let editingScheduleId = null; // Track ID of schedule being edited
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

                // Click to open schedule list view instead of add modal directly
                dayEl.addEventListener('click', () => openScheduleListModal(dateString));

                weekRow.appendChild(dayEl);
                dayCells.push({ element: dayEl, date: new Date(currentDay) });
                
                currentDay.setDate(currentDay.getDate() + 1);
            }
            // ... (rest of renderCalendar remains same, just modifying the click listener above)

            // 2. Process and Render Events for this Week (Events Layer)
            const eventsContainer = document.createElement('div');
            eventsContainer.classList.add('events-container');
            
            const userEvents = getEventsForWeek(week.start, week.end);
            const holidays = getHolidaysForWeek(week.start, week.end);
            const specialEvents = getRecurringSpecialEvents(week.start, week.end);
            const weekEvents = [...userEvents, ...holidays, ...specialEvents];
            
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
                if (event.type === 'holiday') eventBar.classList.add('holiday');
                
                // Content
                let text = event.text;
                if (event.startDate === event.endDate && event.startTime) {
                    text = `${event.startTime} ${text}`;
                }
                eventBar.textContent = text;
                
                // Delete button (only for user schedules)
                if (event.type !== 'holiday' && event.type !== 'special') {
                    const deleteBtn = document.createElement('span');
                    deleteBtn.innerHTML = '&times;';
                    deleteBtn.classList.add('delete-btn');
                    deleteBtn.onclick = (e) => { e.stopPropagation(); deleteSchedule(event.id); };
                    eventBar.appendChild(deleteBtn);

                    // Click to edit
                    eventBar.addEventListener('click', () => {
                        openAddScheduleModal(null, event); 
                    });
                }

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

    function getHolidaysForWeek(weekStart, weekEnd) {
        // Korean Holidays for 2026
        const holidays = [
            { id: 'h1', text: "신정", startDate: '2026-01-01', endDate: '2026-01-01', type: 'holiday' },
            { id: 'h2', text: "설날", startDate: '2026-02-16', endDate: '2026-02-18', type: 'holiday' },
            { id: 'h3', text: "삼일절", startDate: '2026-03-01', endDate: '2026-03-01', type: 'holiday' },
            { id: 'h4', text: "어린이날", startDate: '2026-05-05', endDate: '2026-05-05', type: 'holiday' },
            { id: 'h5', text: "부처님 오신 날", startDate: '2026-05-24', endDate: '2026-05-24', type: 'holiday' },
            { id: 'h6', text: "현충일", startDate: '2026-06-06', endDate: '2026-06-06', type: 'holiday' },
            { id: 'h7', text: "광복절", startDate: '2026-08-15', endDate: '2026-08-15', type: 'holiday' },
            { id: 'h8', text: "추석", startDate: '2026-09-24', endDate: '2026-09-26', type: 'holiday' },
            { id: 'h9', text: "개천절", startDate: '2026-10-03', endDate: '2026-10-03', type: 'holiday' },
            { id: 'h10', text: "한글날", startDate: '2026-10-09', endDate: '2026-10-09', type: 'holiday' },
            { id: 'h11', text: "성탄절", startDate: '2026-12-25', endDate: '2026-12-25', type: 'holiday' },
            // Substitute Holidays for 2026
            { id: 'h12', text: "대체공휴일", startDate: '2026-03-02', endDate: '2026-03-02', type: 'holiday' },
            { id: 'h13', text: "대체공휴일", startDate: '2026-05-25', endDate: '2026-05-25', type: 'holiday' }
        ];

        return holidays.filter(h => {
            const start = new Date(h.startDate + 'T00:00:00');
            const end = new Date(h.endDate + 'T00:00:00');
            return start <= weekEnd && end >= weekStart;
        });
    }

    function getRecurringSpecialEvents(weekStart, weekEnd) {
        const specialEvents = [];
        let current = new Date(weekStart);
        while (current <= weekEnd) {
            const month = current.getMonth(); // 0-indexed (Jan is 0)
            const date = current.getDate();
            
            // May 18 (Month 4)
            if (month === 4 && date === 18) {
                specialEvents.push({
                    id: `special-may-18-${current.getFullYear()}`,
                    text: "❤️ HBD ❤️",
                    startDate: formatDate(current),
                    endDate: formatDate(current),
                    type: 'special'
                });
            }
            
            // October 31 (Month 9)
            if (month === 9 && date === 31) {
                specialEvents.push({
                    id: `special-oct-31-${current.getFullYear()}`,
                    text: "❤️ HBD ❤️",
                    startDate: formatDate(current),
                    endDate: formatDate(current),
                    type: 'special'
                });
            }
            current.setDate(current.getDate() + 1);
        }
        return specialEvents;
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

    function openScheduleListModal(dateString) {
        currentSelectedDate = dateString;
        listDateHeading.textContent = dateString;
        scheduleListContainer.innerHTML = '';
        listModal.style.display = 'flex';

        // Calculate week range for this date to leverage existing getXXXForWeek functions
        const dateObj = new Date(dateString + 'T00:00:00');
        const weekStart = new Date(dateObj);
        weekStart.setDate(dateObj.getDate() - dateObj.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Fetch all potential events
        const userEvents = getEventsForWeek(weekStart, weekEnd);
        const holidays = getHolidaysForWeek(weekStart, weekEnd);
        const specialEvents = getRecurringSpecialEvents(weekStart, weekEnd);
        const allEvents = [...userEvents, ...holidays, ...specialEvents];

        // Filter for this specific day
        const dayEvents = allEvents.filter(event => {
            const start = new Date(event.startDate + 'T00:00:00');
            const end = new Date(event.endDate + 'T00:00:00');
            const target = new Date(dateString + 'T00:00:00');
            return target >= start && target <= end;
        });

        // Sort events
        dayEvents.sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

        if (dayEvents.length === 0) {
            scheduleListContainer.innerHTML = '<p style="color:#999; text-align:center;">No schedules</p>';
        } else {
            dayEvents.forEach(event => {
                const item = document.createElement('div');
                item.classList.add('list-item');
                if (event.type === 'holiday' || event.type === 'special') item.classList.add('holiday');

                // Click to edit from list view (only user events)
                if (event.type !== 'holiday' && event.type !== 'special') {
                    item.style.cursor = 'pointer';
                    item.addEventListener('click', () => {
                        closeListModal();
                        openAddScheduleModal(null, event);
                    });
                }

                const timeDiv = document.createElement('div');
                timeDiv.classList.add('list-item-time');
                if (event.startDate !== event.endDate) {
                    timeDiv.textContent = 'All Day (Multi-day)';
                } else if (event.startTime) {
                    timeDiv.textContent = `${event.startTime} - ${event.endTime || ''}`;
                } else {
                    timeDiv.textContent = 'All Day';
                }

                const titleDiv = document.createElement('div');
                titleDiv.classList.add('list-item-title');
                titleDiv.textContent = event.text;

                item.appendChild(timeDiv);
                item.appendChild(titleDiv);
                scheduleListContainer.appendChild(item);
            });
        }
    }

        function closeListModal() {
            listModal.style.display = 'none';
        }
    
            function openAddScheduleModal(dateString, scheduleToEdit = null) {
                modal.style.display = 'flex';
                const modalTitle = modal.querySelector('h2');
                
                // Reset recurrence state
                enableRecurrenceCheckbox.checked = false;
                recurrenceOptions.style.display = 'none';
                recurrenceIntervalInput.value = 7;
                recurrenceCountInput.value = 1;
        
                if (scheduleToEdit) {
                    // Edit Mode
                    editingScheduleId = scheduleToEdit.id;
                    modalTitle.textContent = "Edit Schedule";
                    scheduleTextInput.value = scheduleToEdit.text;
                    startDateInput.value = scheduleToEdit.startDate;
                    endDateInput.value = scheduleToEdit.endDate;
                    startTimeInput.value = scheduleToEdit.startTime || '';
                    endTimeInput.value = scheduleToEdit.endTime || '';
                    
                    // Disable recurrence when editing an existing single instance
                    enableRecurrenceCheckbox.disabled = true;
                } else {
                    // Create Mode
                    editingScheduleId = null;
                    modalTitle.textContent = "Add Schedule";
                    startDateInput.value = dateString;
                    endDateInput.value = dateString;
                    scheduleTextInput.value = '';
                    startTimeInput.value = '';
                    endTimeInput.value = '';
                    
                    enableRecurrenceCheckbox.disabled = false;
                }
            }    
            function closeAddScheduleModal() {
                modal.style.display = 'none';
                scheduleTextInput.value = '';
                startDateInput.value = '';
                endDateInput.value = '';
                startTimeInput.value = '';
                endTimeInput.value = '';
                editingScheduleId = null; // Reset edit state
                
                enableRecurrenceCheckbox.checked = false;
                recurrenceOptions.style.display = 'none';
            }    function saveSchedule() {
        const text = scheduleTextInput.value.trim();
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        
        const isRecurrenceEnabled = enableRecurrenceCheckbox.checked && !enableRecurrenceCheckbox.disabled;

        if (text && startDate && endDate) {
            if (new Date(startDate) > new Date(endDate)) {
                alert("End date cannot be before start date.");
                return;
            }

            if (editingScheduleId) {
                // Update existing schedule (single instance)
                const scheduleIndex = schedules.findIndex(s => s.id === editingScheduleId);
                if (scheduleIndex !== -1) {
                    schedules[scheduleIndex] = {
                        ...schedules[scheduleIndex],
                        text,
                        startDate,
                        endDate,
                        startTime,
                        endTime
                    };
                }
            } else if (isRecurrenceEnabled) {
                // Create recurring schedules
                const interval = parseInt(recurrenceIntervalInput.value, 10);
                const count = parseInt(recurrenceCountInput.value, 10);
                
                if (interval > 0 && count > 0) {
                    const baseStart = new Date(startDate);
                    const baseEnd = new Date(endDate);
                    
                    for (let i = 0; i < count; i++) {
                        const nextStart = new Date(baseStart);
                        nextStart.setDate(baseStart.getDate() + (i * interval));
                        
                        const nextEnd = new Date(baseEnd);
                        nextEnd.setDate(baseEnd.getDate() + (i * interval));
                        
                        const newSchedule = {
                            id: Date.now() + i, // Unique ID
                            text,
                            startDate: formatDate(nextStart),
                            endDate: formatDate(nextEnd),
                            startTime,
                            endTime
                        };
                        schedules.push(newSchedule);
                    }
                }
            } else {
                // Create single new schedule
                const newSchedule = {
                    id: Date.now(),
                    text,
                    startDate,
                    endDate,
                    startTime,
                    endTime
                };
                schedules.push(newSchedule);
            }
            
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

    // Toggle recurrence options
    enableRecurrenceCheckbox.addEventListener('change', (e) => {
        recurrenceOptions.style.display = e.target.checked ? 'block' : 'none';
    });

    // Event Listeners for List Modal
    closeListModalButton.addEventListener('click', closeListModal);
    openAddModalBtn.addEventListener('click', () => {
        closeListModal();
        if (currentSelectedDate) openAddScheduleModal(currentSelectedDate);
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAddScheduleModal();
        }
        if (e.target === listModal) {
            closeListModal();
        }
    });

    renderCalendar();
});