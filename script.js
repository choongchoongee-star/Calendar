// --- Supabase Configuration ---
// TODO: Replace these placeholders with your actual Supabase project credentials
const SUPABASE_URL = 'https://rztrkeejliampmzcqbmx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dHJrZWVqbGlhbXBtemNxYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDE4MTksImV4cCI6MjA4NDY3NzgxOX0.ind5OQoPfWuAd_StssdeIDlrKxotW3XPhGOV63NqUWY';

// Data Manager
const DataManager = {
    client: null,
    schedules: [],

    init(url, key) {
        if (typeof window.supabase === 'undefined') {
            console.warn("Supabase library not loaded. Data will not persist.");
            return;
        }
        if (url.includes('YOUR_PROJECT_ID')) {
             console.warn("Supabase credentials not set. Using local mode.");
             return;
        }
        try {
            this.client = window.supabase.createClient(url, key);
            console.log("Supabase initialized successfully.");
        } catch (e) {
            console.error("Failed to initialize Supabase:", e);
        }
    },

    async fetchSchedules() {
        if (!this.client) {
            console.log("Skipping fetch: Supabase not initialized.");
            return [];
        }
        console.log("Fetching schedules...");
        const { data, error } = await this.client.from('schedules').select('*');
        if (error) throw error;
        if (data) {
             console.log(`Fetched ${data.length} schedules.`);
             this.schedules = data.map(item => ({
                id: item.id,
                text: item.text,
                startDate: item.start_date,
                endDate: item.end_date,
                startTime: item.start_time,
                endTime: item.end_time,
                groupId: item.group_id,
                color: item.color
            }));
        }
        return this.schedules;
    },

    async addSchedule(payload) {
        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').insert([payload]);
        if (error) throw error;
    },
    
    async addSchedules(payloads) {
        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').insert(payloads);
        if (error) throw error;
    },

    async updateSchedule(id, payload) {
        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').update(payload).eq('id', id);
        if (error) throw error;
    },

    async upsertSchedules(updates) {
         if (!this.client) throw new Error("Supabase not initialized");
         const { error } = await this.client.from('schedules').upsert(updates);
         if (error) throw error;
    },

    async deleteSchedule(id) {
        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteSchedulesByGroupId(groupId) {
        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').delete().eq('group_id', groupId);
        if (error) throw error;
    },
    
    getSchedules() {
        return this.schedules;
    }
};

// Calendar Utilities
const CalendarUtils = {
    getWeeksInMonth(y, m) {
        const weeks = [];
        let curr = new Date(y, m, 1);
        curr.setDate(curr.getDate() - curr.getDay());
        const end = new Date(y, m + 1, 0);
        end.setDate(end.getDate() + (6 - end.getDay()));
        while (curr <= end) {
            const wStart = new Date(curr);
            const wEnd = new Date(curr);
            wEnd.setDate(wEnd.getDate() + 6);
            weeks.push({ start: wStart, end: wEnd });
            curr.setDate(curr.getDate() + 7);
        }
        return weeks;
    },

    formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    getHolidaysForWeek(s, e) {
        const hols = [
            {id: 'h1', text: "신정", startDate: '2026-01-01', endDate: '2026-01-01', type: 'holiday'},
            {id: 'h2', text: "설날", startDate: '2026-02-16', endDate: '2026-02-18', type: 'holiday'},
            {id: 'h3', text: "삼일절", startDate: '2026-03-01', endDate: '2026-03-01', type: 'holiday'},
            {id: 'h4', text: "어린이날", startDate: '2026-05-05', endDate: '2026-05-05', type: 'holiday'},
            {id: 'h5', text: "부처님 오신 날", startDate: '2026-05-24', endDate: '2026-05-24', type: 'holiday'},
            {id: 'h6', text: "현충일", startDate: '2026-06-06', endDate: '2026-06-06', type: 'holiday'},
            {id: 'h7', text: "광복절", startDate: '2026-08-15', endDate: '2026-08-15', type: 'holiday'},
            {id: 'h8', text: "추석", startDate: '2026-09-24', endDate: '2026-09-26', type: 'holiday'},
            {id: 'h9', text: "개천절", startDate: '2026-10-03', endDate: '2026-10-03', type: 'holiday'},
            {id: 'h10', text: "한글날", startDate: '2026-10-09', endDate: '2026-10-09', type: 'holiday'},
            {id: 'h11', text: "성탄절", startDate: '2026-12-25', endDate: '2026-12-25', type: 'holiday'}
        ];
        return hols.filter(h => {
            const start = new Date(h.startDate + 'T00:00:00');
            const end = new Date(h.endDate + 'T00:00:00');
            return start <= e && end >= s;
        });
    },

    getRecurringSpecialEvents(s, e) {
        const special = [];
        let curr = new Date(s);
        while (curr <= e) {
            const m = curr.getMonth();
            const d = curr.getDate();
            if ((m === 4 && d === 18) || (m === 9 && d === 31)) {
                special.push({id: `sp-${m}-${d}`, text: "HBD❤️", startDate: this.formatDate(curr), endDate: this.formatDate(curr), type: 'special'});
            }
            if (m === 10 && d === 9) {
                special.push({id: `sp-${m}-${d}`, text: "❤️", startDate: this.formatDate(curr), endDate: this.formatDate(curr), type: 'special'});
            }
            curr.setDate(curr.getDate() + 1);
        }
        return special;
    },

    getEventsForWeek(schedules, s, e) {
        return schedules.filter(ev => {
            const start = new Date(ev.startDate + 'T00:00:00');
            const end = new Date(ev.endDate + 'T00:00:00');
            return start <= e && end >= s;
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded. Starting initialization...");

    // 1. Initialize Supabase
    DataManager.init(SUPABASE_URL, SUPABASE_KEY);

    // 2. Select Elements
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const calendarElement = document.getElementById('calendar');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');
    
    // Check if essential elements exist
    if (!yearSelect || !monthSelect || !calendarElement) {
        console.error("Essential calendar elements missing from DOM.");
        return;
    }

    // Initialize Dropdowns
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 10; y <= currentYear + 10; y++) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
    }

    for (let m = 0; m < 12; m++) {
        const option = document.createElement('option');
        option.value = m;
        option.textContent = (m + 1);
        monthSelect.appendChild(option);
    }

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

    // Color Palette logic
    const colorPalette = [
        '#47A9F3', '#8FA9C4', '#B884D6', '#FF5A00',
        '#00B38F', '#6FD0C0', '#FFA0AD', '#F5333F',
        '#7ED957', '#D6DB5A', '#FFD84A', '#FFA31A'
    ];
    const paletteContainer = document.getElementById('color-palette');

    function renderPalette() {
        paletteContainer.innerHTML = '';
        colorPalette.forEach(color => {
            const circle = document.createElement('div');
            circle.className = 'color-option';
            circle.style.backgroundColor = color;
            if (color === selectedColor) circle.classList.add('selected');
            circle.onclick = () => {
                selectedColor = color;
                renderPalette();
            };
            paletteContainer.appendChild(circle);
        });
    }

    let currentDate = new Date();
    let currentSelectedDate = null;
    let editingScheduleId = null;
    let editingGroupId = null;
    let editingOriginalStartDate = null;
    let selectedColor = '#47A9F3'; // Default color
    let schedules = [];

    // 3. Define Functions
    async function fetchSchedules() {
        try {
            schedules = await DataManager.fetchSchedules();
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            renderCalendar();
        }
    }

    function renderCalendar() {
        console.log("Rendering calendar...");
        calendarElement.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Sync Dropdowns
        yearSelect.value = year;
        monthSelect.value = month;
        
        const weeks = CalendarUtils.getWeeksInMonth(year, month);
        
        weeks.forEach(week => {
            const weekRow = document.createElement('div');
            weekRow.classList.add('week-row');
            
            // Render Day Cells
            for (let i = 0; i < 7; i++) {
                const currentDay = new Date(week.start);
                currentDay.setDate(week.start.getDate() + i);

                const dayEl = document.createElement('div');
                dayEl.classList.add('day-cell');
                if (currentDay.getMonth() !== month) dayEl.classList.add('other-month');

                const dateString = CalendarUtils.formatDate(currentDay);
                dayEl.dataset.date = dateString;

                const dayNumber = document.createElement('span');
                dayNumber.classList.add('day-number');
                dayNumber.textContent = currentDay.getDate();
                dayEl.appendChild(dayNumber);

                if (currentDay.toDateString() === new Date().toDateString()) dayEl.classList.add('today');
                dayEl.addEventListener('click', () => openScheduleListModal(dateString));
                weekRow.appendChild(dayEl);
            }

            // Render Events Layer
            const eventsContainer = document.createElement('div');
            eventsContainer.classList.add('events-container');
            
            const weekEvents = [
                ...CalendarUtils.getEventsForWeek(schedules, week.start, week.end),
                ...CalendarUtils.getHolidaysForWeek(week.start, week.end),
                ...CalendarUtils.getRecurringSpecialEvents(week.start, week.end)
            ];
            
            // Sort events: Multi-day first
            weekEvents.sort((a, b) => {
                const aMulti = a.startDate !== a.endDate;
                const bMulti = b.startDate !== b.endDate;
                if (aMulti !== bMulti) return aMulti ? -1 : 1;
                return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
            });

            const tracks = [];
            weekEvents.forEach(event => {
                const eStart = new Date(event.startDate + 'T00:00:00');
                const eEnd = new Date(event.endDate + 'T00:00:00');
                const rStart = eStart < week.start ? week.start : eStart;
                const rEnd = eEnd > week.end ? week.end : eEnd;

                const startIndex = Math.floor((rStart - week.start) / 86400000);
                const endIndex = Math.floor((rEnd - week.start) / 86400000);
                
                let trackIndex = 0;
                while (true) {
                    if (!tracks[trackIndex]) tracks[trackIndex] = new Array(7).fill(false);
                    let collision = false;
                    for (let d = startIndex; d <= endIndex; d++) if (tracks[trackIndex][d]) collision = true;
                    if (!collision) {
                        for (let d = startIndex; d <= endIndex; d++) tracks[trackIndex][d] = true;
                        break;
                    }
                    trackIndex++;
                }

                const bar = document.createElement('div');
                bar.classList.add('event-bar');
                if (event.type === 'holiday') bar.classList.add('holiday');
                
                if (event.color && event.type !== 'holiday' && event.type !== 'special') {
                    bar.style.backgroundColor = event.color;
                    bar.style.color = '#fff';
                }

                bar.textContent = (event.startDate === event.endDate && event.startTime) ? `${event.startTime} ${event.text}` : event.text;
                
                if (event.type !== 'holiday' && event.type !== 'special') {
                    bar.onclick = () => openAddScheduleModal(null, event);
                }

                bar.style.left = `calc(${(startIndex / 7) * 100}% + 2px)`;
                bar.style.width = `calc(${((endIndex - startIndex + 1) / 7) * 100}% - 4px)`;
                bar.style.top = `${trackIndex * 22.65}px`;
                eventsContainer.appendChild(bar);
            });
            
            weekRow.style.height = `${Math.max(120, tracks.length * 22.65 + 40)}px`;
            weekRow.appendChild(eventsContainer);
            calendarElement.appendChild(weekRow);
        });
        console.log("Calendar rendered.");
    }

    // --- Modal Logic ---
    function openScheduleListModal(d) {
        currentSelectedDate = d;
        listDateHeading.textContent = d;
        scheduleListContainer.innerHTML = '';
        listModal.style.display = 'flex';

        const dayEvents = [
            ...CalendarUtils.getEventsForWeek(schedules, new Date(d + 'T00:00:00'), new Date(d + 'T23:59:59')),
            ...CalendarUtils.getHolidaysForWeek(new Date(d + 'T00:00:00'), new Date(d + 'T23:59:59')),
            ...CalendarUtils.getRecurringSpecialEvents(new Date(d + 'T00:00:00'), new Date(d + 'T23:59:59'))
        ];

        if (dayEvents.length === 0) {
            scheduleListContainer.innerHTML = '<p style="color:#999; text-align:center;">일정 없음</p>';
        } else {
            dayEvents.forEach(ev => {
                const item = document.createElement('div');
                item.className = `list-item ${ev.type === 'holiday' ? 'holiday' : ''}`;
                if (ev.color && ev.type !== 'holiday' && ev.type !== 'special') {
                    item.style.borderLeftColor = ev.color;
                }
                
                // Create content container for text
                const contentDiv = document.createElement('div');
                contentDiv.style.flex = '1';
                contentDiv.innerHTML = `<div class="list-item-time">${ev.startTime || '하루 종일'}</div><div class="list-item-title">${ev.text}</div>`;
                item.appendChild(contentDiv);

                if (ev.type !== 'holiday' && ev.type !== 'special') {
                    // Click item to edit
                    item.style.cursor = 'pointer';
                    contentDiv.onclick = () => { closeListModal(); openAddScheduleModal(null, ev); };

                    // Delete Button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '&times;';
                    deleteBtn.className = 'list-delete-btn';
                    deleteBtn.onclick = (e) => { 
                        e.stopPropagation(); // Prevent triggering edit
                        deleteSchedule(ev.id); 
                        // Optionally refresh the list modal immediately without closing it? 
                        // For now, deleteSchedule refreshes the whole calendar. 
                        // We might want to close the list modal to reflect changes or reload the list.
                        // Let's close it for simplicity as per existing flow.
                        closeListModal(); 
                    };
                    item.appendChild(deleteBtn);
                }
                
                scheduleListContainer.appendChild(item);
            });
        }
    }

    function closeListModal() { listModal.style.display = 'none'; }

    function openAddScheduleModal(d, s = null) {
        modal.style.display = 'flex';
        const modalTitle = modal.querySelector('h2');
        editingScheduleId = s ? s.id : null;
        editingGroupId = s ? s.groupId : null;
        editingOriginalStartDate = s ? s.startDate : null;
        
        selectedColor = s ? (s.color || colorPalette[0]) : colorPalette[0];
        renderPalette();

        if (s) {
            modalTitle.textContent = s.groupId ? "일정 수정 (전체 반복 일정)" : "일정 수정";
            scheduleTextInput.value = s.text; startDateInput.value = s.startDate; endDateInput.value = s.endDate;
            startTimeInput.value = s.startTime || ''; endTimeInput.value = s.endTime || '';
            
            // Allow editing recurrence
            enableRecurrenceCheckbox.disabled = false;
            
            if (s.groupId) {
                enableRecurrenceCheckbox.checked = true;
                recurrenceOptions.style.display = 'block';
                
                // Infer recurrence settings
                const groupSchedules = schedules.filter(sch => sch.groupId === s.groupId).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                recurrenceCountInput.value = groupSchedules.length;
                
                if (groupSchedules.length > 1) {
                    const diffTime = Math.abs(new Date(groupSchedules[1].startDate) - new Date(groupSchedules[0].startDate));
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    recurrenceIntervalInput.value = diffDays;
                } else {
                    recurrenceIntervalInput.value = 7; // Default
                }
            } else {
                enableRecurrenceCheckbox.checked = false;
                recurrenceOptions.style.display = 'none';
                recurrenceCountInput.value = 1;
                recurrenceIntervalInput.value = 7;
            }
        } else {
            modalTitle.textContent = "일정 추가";
            startDateInput.value = d; endDateInput.value = d; scheduleTextInput.value = '';
            startTimeInput.value = ''; endTimeInput.value = '';
            
            // Enable recurrence when adding new
            enableRecurrenceCheckbox.disabled = false;
            enableRecurrenceCheckbox.checked = false;
            recurrenceOptions.style.display = 'none';
            recurrenceCountInput.value = 1;
            recurrenceIntervalInput.value = 7;
        }
    }

    function closeAddScheduleModal() { modal.style.display = 'none'; }

    async function saveSchedule() {
        const payload = { 
            text: scheduleTextInput.value.trim(), 
            start_date: startDateInput.value, 
            end_date: endDateInput.value, 
            start_time: startTimeInput.value, 
            end_time: endTimeInput.value,
            color: selectedColor
        };
        if (!payload.text) return;

        // Recurrence Logic
        const isRecurrenceEnabled = enableRecurrenceCheckbox.checked;
        
        try {
            if (isRecurrenceEnabled) {
                // Handle Recurrence (Create New Series)
                const interval = parseInt(recurrenceIntervalInput.value, 10);
                const count = parseInt(recurrenceCountInput.value, 10);
                
                if (interval > 0 && count > 0) {
                    // Cleanup old data if we are editing
                    if (editingGroupId) {
                        await DataManager.deleteSchedulesByGroupId(editingGroupId);
                    } else if (editingScheduleId) {
                        await DataManager.deleteSchedule(editingScheduleId);
                    }

                    const payloads = [];
                    const baseStart = new Date(startDateInput.value);
                    const baseEnd = new Date(endDateInput.value);
                    const groupId = Math.random().toString(36).substring(2, 15); // Generate Group ID
                    
                    for (let i = 0; i < count; i++) {
                        const nextStart = new Date(baseStart);
                        nextStart.setDate(baseStart.getDate() + (i * interval));
                        
                        const nextEnd = new Date(baseEnd);
                        nextEnd.setDate(baseEnd.getDate() + (i * interval));
                        
                        payloads.push({
                            text: payload.text,
                            start_date: CalendarUtils.formatDate(nextStart),
                            end_date: CalendarUtils.formatDate(nextEnd),
                            start_time: payload.start_time,
                            end_time: payload.end_time,
                            group_id: groupId,
                            color: payload.color
                        });
                    }
                    await DataManager.addSchedules(payloads);
                }
            } else {
                // Single Event Mode
                if (editingGroupId) {
                    // Was a group, now single -> Delete group, insert single
                    await DataManager.deleteSchedulesByGroupId(editingGroupId);
                    await DataManager.addSchedule(payload);
                } else if (editingScheduleId) {
                    // Was single, staying single -> Update
                    await DataManager.updateSchedule(editingScheduleId, payload);
                } else {
                    // New single event
                    await DataManager.addSchedule(payload);
                }
            }

            await fetchSchedules();
            closeAddScheduleModal();
        } catch (e) {
            alert("저장 중 오류 발생: " + e.message);
        }
    }

    async function deleteSchedule(id) {
        if (confirm("삭제하시겠습니까?")) {
            try {
                await DataManager.deleteSchedule(id);
                await fetchSchedules();
            } catch (e) {
                console.error("Delete failed:", e);
                // If pure local mode, maybe just remove from local array? 
                // But DataManager throws. Let's handle gracefully.
                if (e.message !== "Supabase not initialized") {
                     alert("삭제 실패: " + e.message);
                }
            }
        }
    }

    // --- Event Listeners ---
    prevMonthButton.onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
    nextMonthButton.onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
    
    yearSelect.onchange = () => { currentDate.setFullYear(parseInt(yearSelect.value)); renderCalendar(); };
    monthSelect.onchange = () => { currentDate.setMonth(parseInt(monthSelect.value)); renderCalendar(); };

    closeModalButton.onclick = closeAddScheduleModal;
    saveScheduleButton.onclick = saveSchedule;
    closeListModalButton.onclick = closeListModal;
    openAddModalBtn.onclick = () => { closeListModal(); openAddScheduleModal(currentSelectedDate); };
    enableRecurrenceCheckbox.onchange = (e) => { recurrenceOptions.style.display = e.target.checked ? 'block' : 'none'; };

    window.onclick = (e) => {
        if (e.target === modal) closeAddScheduleModal();
        if (e.target === listModal) closeListModal();
    };

    // 4. Final Initialization
    console.log("Initial rendering...");
    renderCalendar();
    
    // Fetch data asynchronously without blocking
    fetchSchedules();
});