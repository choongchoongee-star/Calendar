// --- Supabase Configuration ---
// TODO: Replace these placeholders with your actual Supabase project credentials
const SUPABASE_URL = 'https://rztrkeejliampmzcqbmx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dHJrZWVqbGlhbXBtemNxYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDE4MTksImV4cCI6MjA4NDY3NzgxOX0.ind5OQoPfWuAd_StssdeIDlrKxotW3XPhGOV63NqUWY';

// Data Manager
const DataManager = {
    client: null,
    session: null,
    currentCalendarId: null,
    calendars: [],
    schedules: [],

    init(url, key) {
        if (typeof window.supabase === 'undefined') return;
        this.client = window.supabase.createClient(url, key);
        console.log("Supabase initialized.");
    },

    async checkSession() {
        console.log("Checking session...");
        const { data: { session }, error } = await this.client.auth.getSession();
        if (error) console.error("Session check error:", error);
        if (session) console.log("Session found:", session.user.email);
        else console.log("No session found.");
        this.session = session;
        return session;
    },

    async signIn(provider) {
        try {
            // value: https://choongchoongee-star.github.io/Calendar/
            const redirectUrl = window.location.origin + window.location.pathname; 
            
            const { error } = await this.client.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: redirectUrl
                }
            });
            if (error) alert("로그인 오류: " + error.message);
        } catch (e) {
            alert("로그인 시스템 오류: " + e.message);
        }
    },

    async signOut() {
        await this.client.auth.signOut();
        window.location.reload();
    },

    async fetchCalendars() {
        if (!this.session) return [];
        console.log("Fetching calendars...");
        const { data, error } = await this.client.from('calendars').select('*');
        if (error) {
            console.error("Error fetching calendars:", error);
            throw error;
        }
        console.log("Calendars fetched:", data);
        this.calendars = data;
        
        // If no calendar exists, create a default one
        if (this.calendars.length === 0) {
            console.log("No calendars found. Creating default...");
            await this.createCalendar("내 캘린더");
            return await this.fetchCalendars();
        }
        
        // Select first calendar by default if none selected
        if (!this.currentCalendarId && this.calendars.length > 0) {
            this.currentCalendarId = this.calendars[0].id;
        }
        
        return this.calendars;
    },

    async createCalendar(title) {
        if (!this.session || !this.session.user) throw new Error("로그인이 필요합니다.");
        console.log("Creating calendar for user:", this.session.user.id);
        
        const { data, error } = await this.client.from('calendars').insert([{ 
            title: title, 
            owner_id: this.session.user.id 
        }]).select(); // Return the created row
        
        if (error) {
            console.error("Create calendar error:", error);
            throw error;
        }
        
        // Auto-select the new calendar
        if (data && data.length > 0) {
            this.currentCalendarId = data[0].id;
        }
    },

    async shareCalendar(email) {
        // 1. Find user by email (using profiles table)
        const { data: profiles, error: pError } = await this.client
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();
        
        if (pError || !profiles) throw new Error("사용자를 찾을 수 없습니다. 해당 이메일로 가입된 사용자가 있는지 확인하세요.");

        // 2. Add to calendar_members
        const { error } = await this.client.from('calendar_members').insert([{
            calendar_id: this.currentCalendarId,
            user_id: profiles.id,
            role: 'editor'
        }]);
        
        if (error) {
            if (error.code === '23505') throw new Error("이미 공유된 사용자입니다.");
            throw error;
        }
    },

    async fetchSchedules() {
        if (!this.client || !this.currentCalendarId) return [];
        console.log(`Fetching schedules for calendar: ${this.currentCalendarId}`);
        const { data, error } = await this.client
            .from('schedules')
            .select('*')
            .eq('calendar_id', this.currentCalendarId); // Filter by Calendar ID
            
        if (error) throw error;
        
        this.schedules = data ? data.map(item => ({
            id: item.id,
            text: item.text,
            startDate: item.start_date,
            endDate: item.end_date,
            startTime: item.start_time,
            endTime: item.end_time,
            groupId: item.group_id,
            color: item.color,
            calendarId: item.calendar_id
        })) : [];
        
        return this.schedules;
    },

    async addSchedule(payload) {
        if (!this.client) throw new Error("Supabase not initialized");
        payload.calendar_id = this.currentCalendarId; // Assign to current calendar
        const { error } = await this.client.from('schedules').insert([payload]);
        if (error) throw error;
    },
    
    async addSchedules(payloads) {
        if (!this.client) throw new Error("Supabase not initialized");
        payloads.forEach(p => p.calendar_id = this.currentCalendarId);
        const { error } = await this.client.from('schedules').insert(payloads);
        if (error) throw error;
    },

    async updateSchedule(id, payload) {
        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').update(payload).eq('id', id);
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

    async syncToCloud() {
        if (!this.client || !this.currentCalendarId) return;
        // Only sync if I am the owner (simplification for now, strictly speaking editors should too)
        // We'll upload to a file named after the Calendar ID to allow multiple subscriptions
        const fileName = `calendar-${this.currentCalendarId}.ics`;
        
        console.log("Syncing calendar to cloud storage...", fileName);
        
        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Vibe Calendar//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-PUBLISHED-TTL:PT1H\n";
        this.schedules.forEach(event => {
            const start = event.startDate.replace(/-/g, '') + (event.startTime ? 'T' + event.startTime.replace(/:/g, '') + '00' : '');
            const end = event.endDate.replace(/-/g, '') + (event.endTime ? 'T' + event.endTime.replace(/:/g, '') + '00' : '');
            let finalEnd = end;
            if (!event.startTime) {
                 const d = new Date(event.endDate);
                 d.setDate(d.getDate() + 1);
                 finalEnd = d.toISOString().split('T')[0].replace(/-/g, '');
            }
            icsContent += "BEGIN:VEVENT\n";
            icsContent += `UID:${event.id || Math.random()}@vibecalendar\n`;
            icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
            icsContent += `DTSTART;VALUE=${event.startTime ? 'DATE-TIME' : 'DATE'}:${start}\n`;
            icsContent += `DTEND;VALUE=${event.endTime ? 'DATE-TIME' : 'DATE'}:${finalEnd}\n`;
            icsContent += `SUMMARY:${event.text}\n`;
            icsContent += "END:VEVENT\n";
        });
        icsContent += "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const { error } = await this.client.storage
            .from('calendars')
            .upload(fileName, blob, { upsert: true });
            
        if (error) console.error("Cloud sync failed:", error);
    },
    
    getSchedules() { return this.schedules; }
};

// Calendar Utilities (Unchanged)
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

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Supabase
    DataManager.init(SUPABASE_URL, SUPABASE_KEY);

    // 2. Select Elements
    const loginModal = document.getElementById('login-modal');
    const loginAppleBtn = document.getElementById('login-apple-btn');
    const loginGoogleBtn = document.getElementById('login-google-btn');
    const appContainer = document.getElementById('app');
    
    // Check Session
    const session = await DataManager.checkSession();
    if (!session) {
        loginModal.style.display = 'flex';
        appContainer.style.filter = 'blur(5px)';
    } else {
        loginModal.style.display = 'none';
        appContainer.style.filter = 'none';
        initializeCalendar();
    }

    // Login Handlers
    loginAppleBtn.onclick = () => DataManager.signIn('apple');
    loginGoogleBtn.onclick = () => DataManager.signIn('google');

    function initializeCalendar() {
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        const calendarElement = document.getElementById('calendar');
        const prevMonthButton = document.getElementById('prev-month');
        const nextMonthButton = document.getElementById('next-month');
        
        // Drawer Elements
        const menuBtn = document.getElementById('menu-btn');
        const drawer = document.getElementById('calendar-drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const calendarList = document.getElementById('calendar-list');
        const createCalendarBtn = document.getElementById('create-calendar-btn');
        const logoutBtn = document.getElementById('logout-btn');

        // Settings Elements
        const settingsBtn = document.getElementById('settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        const closeSettingsBtn = document.querySelector('.settings-close');
        const settingsLogoutBtn = document.getElementById('settings-logout-btn');
        const shareBtn = document.getElementById('share-btn');
        const shareEmailInput = document.getElementById('share-email');

        // Modal Elements
        const modal = document.getElementById('add-schedule-modal');
        const closeModalButton = document.querySelector('.modal-content .close-button');
        const saveScheduleButton = document.getElementById('save-schedule');
        const scheduleTextInput = document.getElementById('schedule-text');
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');
        const enableRecurrenceCheckbox = document.getElementById('enable-recurrence');
        const recurrenceOptions = document.getElementById('recurrence-options');
        const recurrenceIntervalInput = document.getElementById('recurrence-interval');
        const recurrenceCountInput = document.getElementById('recurrence-count');
        const listModal = document.getElementById('schedule-list-modal');
        const closeListModalButton = document.querySelector('.list-close');
        const listDateHeading = document.getElementById('list-date-heading');
        const scheduleListContainer = document.getElementById('schedule-list-container');
        const openAddModalBtn = document.getElementById('open-add-modal-btn');
        const colorPalette = ['#47A9F3', '#8FA9C4', '#B884D6', '#FF5A00', '#00B38F', '#6FD0C0', '#FFA0AD', '#F5333F', '#7ED957', '#D6DB5A', '#FFD84A', '#FFA31A'];
        const paletteContainer = document.getElementById('color-palette');

        // ... Dropdown Initialization (Same as before) ...
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

        let currentDate = new Date();
        let currentSelectedDate = null;
        let editingScheduleId = null;
        let editingGroupId = null;
        let selectedColor = '#47A9F3';

        // --- Drawer Logic ---
        async function loadCalendars() {
            const calendars = await DataManager.fetchCalendars();
            calendarList.innerHTML = '';
            calendars.forEach(cal => {
                const li = document.createElement('li');
                li.style.padding = '10px';
                li.style.cursor = 'pointer';
                li.style.borderBottom = '1px solid #eee';
                li.textContent = cal.title + (cal.id === DataManager.currentCalendarId ? ' (V)' : '');
                if (cal.id === DataManager.currentCalendarId) li.style.fontWeight = 'bold';
                
                li.onclick = async () => {
                    DataManager.currentCalendarId = cal.id;
                    await DataManager.fetchSchedules(); // Fetch new data
                    updateLiveLink(); // Update the link for iPhone
                    drawer.style.display = 'none';
                    drawerOverlay.style.display = 'none';
                    loadCalendars(); // Refresh list to show checkmark
                };
                calendarList.appendChild(li);
            });
            updateLiveLink();
            await DataManager.fetchSchedules(); // Load initial data
            renderCalendar(); // Explicitly render
        }
        
        menuBtn.onclick = () => {
            drawer.style.display = 'flex';
            drawerOverlay.style.display = 'block';
            loadCalendars();
        };
        
        drawerOverlay.onclick = () => {
            drawer.style.display = 'none';
            drawerOverlay.style.display = 'none';
        };

        createCalendarBtn.onclick = async () => {
            const name = prompt("새 캘린더 이름:");
            if (name) {
                try {
                    await DataManager.createCalendar(name);
                    alert("캘린더가 생성되었습니다!");
                    await loadCalendars(); // Refresh list
                } catch (e) {
                    alert("캘린더 생성 실패: " + e.message);
                }
            }
        };

        logoutBtn.onclick = () => DataManager.signOut();
        settingsLogoutBtn.onclick = () => DataManager.signOut();

        // --- Sharing Logic ---
        shareBtn.onclick = async () => {
            const email = shareEmailInput.value;
            if (!email) return alert("이메일을 입력하세요.");
            try {
                await DataManager.shareCalendar(email);
                alert(`${email}님을 초대했습니다!`);
                shareEmailInput.value = '';
            } catch (e) {
                alert(e.message);
            }
        };

        function updateLiveLink() {
            const linkInput = document.getElementById('live-link-url');
            if (!linkInput) return;
            
            if (DataManager.currentCalendarId) {
                linkInput.value = `https://rztrkeejliampmzcqbmx.supabase.co/storage/v1/object/public/calendars/calendar-${DataManager.currentCalendarId}.ics`;
            } else {
                linkInput.value = "캘린더를 선택해주세요.";
            }
        }
        
        // --- Core Calendar Logic (Same as before but wrapped) ---
        function renderPalette() {
            paletteContainer.innerHTML = '';
            colorPalette.forEach(color => {
                const circle = document.createElement('div');
                circle.className = 'color-option';
                circle.style.backgroundColor = color;
                if (color === selectedColor) circle.classList.add('selected');
                circle.onclick = () => { selectedColor = color; renderPalette(); };
                paletteContainer.appendChild(circle);
            });
        }

        function renderCalendar() {
            calendarElement.innerHTML = '';
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            yearSelect.value = year;
            monthSelect.value = month;
            const weeks = CalendarUtils.getWeeksInMonth(year, month);
            weeks.forEach(week => {
                const weekRow = document.createElement('div');
                weekRow.classList.add('week-row');
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
                const eventsContainer = document.createElement('div');
                eventsContainer.classList.add('events-container');
                const weekEvents = [
                    ...CalendarUtils.getEventsForWeek(DataManager.getSchedules(), week.start, week.end),
                    ...CalendarUtils.getHolidaysForWeek(week.start, week.end),
                    ...CalendarUtils.getRecurringSpecialEvents(week.start, week.end)
                ];
                weekEvents.sort((a, b) => {
                    const aMulti = a.startDate !== a.endDate;
                    const bMulti = b.startDate !== b.endDate;
                    if (aMulti !== bMulti) return aMulti ? -1 : 1;
                    return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
                });
                
                // Track logic (simplified from previous)
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
        }

        // --- Modals ---
        function openScheduleListModal(d) {
            currentSelectedDate = d;
            listDateHeading.textContent = d;
            scheduleListContainer.innerHTML = '';
            listModal.style.display = 'flex';
            const dayEvents = [
                ...CalendarUtils.getEventsForWeek(DataManager.getSchedules(), new Date(d + 'T00:00:00'), new Date(d + 'T23:59:59')),
                ...CalendarUtils.getHolidaysForWeek(new Date(d + 'T00:00:00'), new Date(d + 'T23:59:59')),
                ...CalendarUtils.getRecurringSpecialEvents(new Date(d + 'T00:00:00'), new Date(d + 'T23:59:59'))
            ];
            if (dayEvents.length === 0) scheduleListContainer.innerHTML = '<p style="color:#999; text-align:center;">일정 없음</p>';
            else {
                dayEvents.forEach(ev => {
                    const item = document.createElement('div');
                    item.className = `list-item ${ev.type === 'holiday' ? 'holiday' : ''}`;
                    if (ev.color && ev.type !== 'holiday' && ev.type !== 'special') item.style.borderLeftColor = ev.color;
                    const contentDiv = document.createElement('div');
                    contentDiv.style.flex = '1';
                    contentDiv.innerHTML = `<div class="list-item-time">${ev.startTime || '하루 종일'}</div><div class="list-item-title">${ev.text}</div>`;
                    item.appendChild(contentDiv);
                    if (ev.type !== 'holiday' && ev.type !== 'special') {
                        item.style.cursor = 'pointer';
                        contentDiv.onclick = () => { closeListModal(); openAddScheduleModal(null, ev); };
                        const deleteBtn = document.createElement('button');
                        deleteBtn.innerHTML = '&times;';
                        deleteBtn.className = 'list-delete-btn';
                        deleteBtn.onclick = (e) => { e.stopPropagation(); deleteSchedule(ev.id); closeListModal(); };
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
            selectedColor = s ? (s.color || colorPalette[0]) : colorPalette[0];
            renderPalette();
            if (s) {
                modalTitle.textContent = s.groupId ? "일정 수정 (반복)" : "일정 수정";
                scheduleTextInput.value = s.text; startDateInput.value = s.startDate; endDateInput.value = s.endDate;
                startTimeInput.value = s.startTime || ''; endTimeInput.value = s.endTime || '';
                enableRecurrenceCheckbox.checked = !!s.groupId;
                recurrenceOptions.style.display = s.groupId ? 'block' : 'none';
                if(s.groupId) recurrenceCountInput.value = 1; // Simplify logic for edit
            } else {
                modalTitle.textContent = "일정 추가";
                startDateInput.value = d; endDateInput.value = d; scheduleTextInput.value = '';
                startTimeInput.value = ''; endTimeInput.value = '';
                enableRecurrenceCheckbox.checked = false;
                recurrenceOptions.style.display = 'none';
            }
        }
        function closeAddScheduleModal() { modal.style.display = 'none'; }

        async function saveSchedule() {
            const payload = { 
                text: scheduleTextInput.value.trim(), start_date: startDateInput.value, end_date: endDateInput.value, 
                start_time: startTimeInput.value, end_time: endTimeInput.value, color: selectedColor
            };
            if (!payload.text) return;
            try {
                if (enableRecurrenceCheckbox.checked && !editingGroupId) {
                    // New Recurrence
                    const interval = parseInt(recurrenceIntervalInput.value, 10);
                    const count = parseInt(recurrenceCountInput.value, 10);
                    const payloads = [];
                    const groupId = Math.random().toString(36).substring(2, 15);
                    const baseStart = new Date(startDateInput.value);
                    const baseEnd = new Date(endDateInput.value);
                    for (let i = 0; i < count; i++) {
                        const nextStart = new Date(baseStart); nextStart.setDate(baseStart.getDate() + (i * interval));
                        const nextEnd = new Date(baseEnd); nextEnd.setDate(baseEnd.getDate() + (i * interval));
                        payloads.push({ ...payload, start_date: CalendarUtils.formatDate(nextStart), end_date: CalendarUtils.formatDate(nextEnd), group_id: groupId });
                    }
                    await DataManager.addSchedules(payloads);
                } else {
                    if (editingGroupId) await DataManager.deleteSchedulesByGroupId(editingGroupId);
                    else if (editingScheduleId) await DataManager.deleteSchedule(editingScheduleId);
                    await DataManager.addSchedule(payload);
                }
                await DataManager.fetchSchedules();
                await DataManager.syncToCloud();
                closeAddScheduleModal();
                renderCalendar();
            } catch (e) { alert("오류: " + e.message); }
        }

        async function deleteSchedule(id) {
            if (!confirm("삭제하시겠습니까?")) return;
            try {
                await DataManager.deleteSchedule(id);
                await DataManager.fetchSchedules();
                await DataManager.syncToCloud();
                renderCalendar();
            } catch (e) { alert("삭제 실패"); }
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
        settingsBtn.onclick = () => settingsModal.style.display = 'flex';
        closeSettingsBtn.onclick = () => settingsModal.style.display = 'none';
        
        let touchStartX=0, touchEndX=0;
        calendarElement.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, {passive:true});
        calendarElement.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartX - 50) nextMonthButton.click();
            if (touchEndX > touchStartX + 50) prevMonthButton.click();
        }, {passive:true});

        window.onclick = (e) => {
            if (e.target === modal) closeAddScheduleModal();
            if (e.target === listModal) closeListModal();
            if (e.target === settingsModal) settingsModal.style.display = 'none';
        };

        loadCalendars(); // Start the chain
    }
});