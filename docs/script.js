// --- Supabase Configuration ---
// TODO: Replace these placeholders with your actual Supabase project credentials
const SUPABASE_URL = 'https://rztrkeejliampmzcqbmx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dHJrZWVqbGlhbXBtemNxYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDE4MTksImV4cCI6MjA4NDY3NzgxOX0.ind5OQoPfWuAd_StssdeIDlrKxotW3XPhGOV63NqUWY';

// Crypto helpers for Apple Sign-In
const generateNonce = (length = 16) => {
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    let result = '';
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    randomValues.forEach(v => result += charset[v % charset.length]);
    return result;
};

const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

// Data Manager
const DataManager = {
    client: null,
    session: null,
    isGuest: false,
    currentCalendarId: null,
    calendars: [],
    schedules: [],

    init(url, key) {
        if (typeof window.supabase === 'undefined') {
            console.error("Supabase SDK not loaded.");
            return;
        }
        this.client = window.supabase.createClient(url, key);
        console.log("Supabase initialized.");
    },

    async checkSession() {
        // Check if guest mode was previously active
        if (localStorage.getItem('isGuest') === 'true') {
            this.isGuest = true;
            this.session = { user: { id: 'guest', email: 'guest@local' } };
            return this.session;
        }

        if (!this.client) {
            console.error("Supabase client not initialized.");
            return null;
        }
        console.log("Checking session...");
        const { data: { session }, error } = await this.client.auth.getSession();
        if (error) console.error("Session check error:", error);
        if (session) console.log("Session found:", session.user.email);
        else console.log("No session found.");
        this.session = session;
        return session;
    },

    async enableGuestMode() {
        this.isGuest = true;
        this.session = { user: { id: 'guest', email: 'guest@local' } };
        localStorage.setItem('isGuest', 'true');
        
        // Ensure at least one default calendar exists for guest
        const guestCalendars = JSON.parse(localStorage.getItem('guest_calendars') || '[]');
        if (guestCalendars.length === 0) {
            this.createCalendar("내 캘린더");
        }
    },

    async signIn(provider) {
        if (provider === 'guest') {
            console.log("Guest login initiated");
            await this.enableGuestMode();
            document.getElementById('login-modal').style.display = 'none';
            document.getElementById('app').style.filter = 'none';
            if (window.initializeCalendar) {
                window.initializeCalendar();
            }
            if (window.checkInvite) {
                window.checkInvite();
            }
            return;
        }

        if (!this.client) {
            alert("로그인 서비스를 사용할 수 없습니다. (Supabase 초기화 실패)");
            return;
        }

        try {
            console.log("Signing in with", provider);

            // 1. Native Apple Sign-In (iOS)
            if (provider === 'apple' && 
                window.Capacitor && 
                window.Capacitor.isNativePlatform()) {
                
                const AppleSignIn = window.Capacitor.Plugins.SignInWithApple;
                if (AppleSignIn) {
                    console.log("Attempting native Apple Sign-In via @capacitor-community/apple-sign-in...");
                    try {
                        const rawNonce = generateNonce();
                        const hashedNonce = await sha256(rawNonce);

                        const result = await AppleSignIn.authorize({
                            clientId: 'com.dangmoo.calendar',
                            scopes: 'email name',
                            redirectURI: 'https://rztrkeejliampmzcqbmx.supabase.co/auth/v1/callback',
                            nonce: hashedNonce
                        });

                        console.log("Apple Sign-In authorization result received");

                        if (result.response && result.response.identityToken) {
                            const { data, error } = await this.client.auth.signInWithIdToken({
                                provider: 'apple',
                                token: result.response.identityToken,
                                nonce: rawNonce, 
                            });
                            if (error) throw error;
                            console.log("Native Apple Sign-In successful, session established");
                            
                            this.session = data.session;
                            document.getElementById('login-modal').style.display = 'none';
                            document.getElementById('app').style.filter = 'none';
                            if (window.initializeCalendar) window.initializeCalendar();
                            return;
                        } else {
                            throw new Error("No identity token received from Apple");
                        }
                    } catch (nativeError) {
                        console.error("Native Apple Sign-In error:", nativeError);
                        // Fallthrough to web login if native fails
                    }
                } else {
                    console.warn("SignInWithApple plugin not found in Capacitor Plugins.");
                }
            }

            // 2. Web OAuth (Fallback & Default)
            // Ensure trailing slash for GitHub Pages to prevent 301 redirects dropping the hash
            let redirectUrl = window.location.href.split('?')[0].split('#')[0].replace(/\/index\.html$/, '');
            if (!redirectUrl.endsWith('/')) {
                redirectUrl += '/';
            }
            console.log("Redirect URL:", redirectUrl);
            
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
        if (this.isGuest) {
            this.isGuest = false;
            localStorage.removeItem('isGuest');
            window.location.reload();
            return;
        }
        await this.client.auth.signOut();
        window.location.reload();
    },

    async deleteAccount() {
        if (this.isGuest) {
            localStorage.clear();
            window.location.reload();
            return;
        }

        if (!this.session) return;

        // 1. Delete all calendars owned by the user
        // (Assuming schedules and members are linked with ON DELETE CASCADE in DB)
        const { error: deleteError } = await this.client
            .from('calendars')
            .delete()
            .eq('owner_id', this.session.user.id);

        if (deleteError) throw deleteError;

        // 2. Sign out (Full account deletion from auth.users requires a backend Edge Function)
        await this.signOut();
    },

    async fetchCalendars() {
        if (this.isGuest) {
            console.log("Fetching guest calendars from local storage...");
            const stored = localStorage.getItem('guest_calendars');
            this.calendars = stored ? JSON.parse(stored) : [];
            
            if (this.calendars.length === 0) {
                console.log("No guest calendars. Creating default...");
                await this.createCalendar("내 캘린더");
                return await this.fetchCalendars();
            }
            
            if (!this.currentCalendarId && this.calendars.length > 0) {
                this.currentCalendarId = this.calendars[0].id;
            }
            return this.calendars;
        }

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
        if (this.isGuest) {
            const newCalendar = {
                id: 'guest-cal-' + Date.now(),
                title: title,
                owner_id: 'guest',
                created_at: new Date().toISOString()
            };
            const calendars = JSON.parse(localStorage.getItem('guest_calendars') || '[]');
            calendars.push(newCalendar);
            localStorage.setItem('guest_calendars', JSON.stringify(calendars));
            this.currentCalendarId = newCalendar.id;
            return;
        }

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

    async updateCalendar(id, title) {
        if (this.isGuest) {
            let calendars = JSON.parse(localStorage.getItem('guest_calendars') || '[]');
            const index = calendars.findIndex(c => c.id === id);
            if (index !== -1) {
                calendars[index].title = title;
                localStorage.setItem('guest_calendars', JSON.stringify(calendars));
            }
            return;
        }

        if (!this.session) throw new Error("로그인이 필요합니다.");
        const { error } = await this.client.from('calendars').update({ title: title }).eq('id', id);
        if (error) throw error;
    },

    async deleteCalendar(id) {
        if (this.isGuest) {
            let calendars = JSON.parse(localStorage.getItem('guest_calendars') || '[]');
            calendars = calendars.filter(c => c.id !== id);
            localStorage.setItem('guest_calendars', JSON.stringify(calendars));
            
            // Also delete associated schedules
            let schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            schedules = schedules.filter(s => s.calendar_id !== id);
            localStorage.setItem('guest_schedules', JSON.stringify(schedules));

            if (this.currentCalendarId === id) {
                this.currentCalendarId = null;
            }
            return;
        }

        if (!this.session) throw new Error("로그인이 필요합니다.");
        
        // Check ownership first
        const { data: calendar, error: fetchError } = await this.client
            .from('calendars')
            .select('owner_id')
            .eq('id', id)
            .single();
            
        if (fetchError) throw fetchError;

        if (calendar.owner_id === this.session.user.id) {
            // I am the owner -> Delete completely
            const { error } = await this.client.from('calendars').delete().eq('id', id);
            if (error) throw error;
        } else {
            // I am a member -> Leave calendar
            const { error } = await this.client
                .from('calendar_members')
                .delete()
                .eq('calendar_id', id)
                .eq('user_id', this.session.user.id);
            if (error) throw error;
        }
        
        // Reset selection if needed
        if (this.currentCalendarId === id) {
            this.currentCalendarId = null;
        }
    },

    async joinCalendar(calendarId) {
        if (!this.session || !this.session.user) throw new Error("로그인이 필요합니다.");
        
        // 1. Check if already a member
        const { data: existing, error: checkError } = await this.client
            .from('calendar_members')
            .select('id')
            .eq('calendar_id', calendarId)
            .eq('user_id', this.session.user.id)
            .single();
            
        if (existing) return; // Already joined

        // 2. Insert into calendar_members
        const { error } = await this.client.from('calendar_members').insert([{
            calendar_id: calendarId,
            user_id: this.session.user.id,
            role: 'editor'
        }]);
        
        if (error) throw error;
    },

    async fetchSchedules() {
        if (this.isGuest) {
            if (!this.currentCalendarId) return [];
            const allSchedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            const data = allSchedules.filter(s => s.calendar_id === this.currentCalendarId);
            
            this.schedules = data.map(item => ({
                id: item.id,
                text: item.text,
                startDate: item.start_date,
                endDate: item.end_date,
                startTime: item.start_time,
                endTime: item.end_time,
                groupId: item.group_id,
                color: item.color,
                calendarId: item.calendar_id
            }));
            return this.schedules;
        }

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
        payload.calendar_id = this.currentCalendarId; // Assign to current calendar
        
        if (this.isGuest) {
            const schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            // Simulate SQL insert
            const newSchedule = { ...payload, id: 'guest-sch-' + Date.now() + Math.random() };
            schedules.push(newSchedule);
            localStorage.setItem('guest_schedules', JSON.stringify(schedules));
            return;
        }

        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').insert([payload]);
        if (error) throw error;
    },
    
    async addSchedules(payloads) {
        payloads.forEach(p => p.calendar_id = this.currentCalendarId);
        
        if (this.isGuest) {
            const schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            payloads.forEach(p => {
                schedules.push({ ...p, id: 'guest-sch-' + Date.now() + Math.random() });
            });
            localStorage.setItem('guest_schedules', JSON.stringify(schedules));
            return;
        }

        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').insert(payloads);
        if (error) throw error;
    },

    async updateSchedule(id, payload) {
        if (this.isGuest) {
            let schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            const index = schedules.findIndex(s => s.id === id);
            if (index !== -1) {
                schedules[index] = { ...schedules[index], ...payload };
                localStorage.setItem('guest_schedules', JSON.stringify(schedules));
            }
            return;
        }

        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').update(payload).eq('id', id);
        if (error) throw error;
    },

    async deleteSchedule(id) {
        if (this.isGuest) {
            let schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            schedules = schedules.filter(s => s.id !== id);
            localStorage.setItem('guest_schedules', JSON.stringify(schedules));
            return;
        }

        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteSchedulesByGroupId(groupId) {
        if (this.isGuest) {
            let schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            schedules = schedules.filter(s => s.group_id !== groupId);
            localStorage.setItem('guest_schedules', JSON.stringify(schedules));
            return;
        }

        if (!this.client) throw new Error("Supabase not initialized");
        const { error } = await this.client.from('schedules').delete().eq('group_id', groupId);
        if (error) throw error;
    },

    async syncToCloud() {
        if (this.isGuest) return; // Guest schedules are not synced

        if (!this.client || !this.currentCalendarId) return;
        // Only sync if I am the owner (simplification for now, strictly speaking editors should too)
        // We'll upload to a file named after the Calendar ID to allow multiple subscriptions
        const fileName = `calendar-${this.currentCalendarId}.ics`;
        
        console.log("Syncing calendar to cloud storage...", fileName);
        
        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Calendar//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-PUBLISHED-TTL:PT1H\n";
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
            // No recurring special dates currently defined
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
    // Expose initializeCalendar immediately so it's available for Guest login
    window.initializeCalendar = initializeCalendar;

    // 1. Initialize Supabase
    DataManager.init(SUPABASE_URL, SUPABASE_KEY);

    // FIX: Manually handle OAuth redirect hash if Supabase auto-detect fails on mobile
    if (window.location.hash && window.location.hash.includes('access_token')) {
        console.log("Manual Hash Detection: Attempting to recover session...");
        const params = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken && refreshToken) {
            const { data, error } = await DataManager.client.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });
            if (!error && data.session) {
                console.log("Manual Session Recovery Successful");
                // Do not clear hash immediately if you want Supabase to also see it, 
                // but usually setSession is enough. We can clean it.
                window.location.hash = ''; 
            } else {
                console.warn("Manual Session Recovery Failed:", error);
            }
        }
    }

    // 2. Select Elements
    const loginModal = document.getElementById('login-modal');
    const loginAppleBtn = document.getElementById('login-apple-btn');
    const loginGoogleBtn = document.getElementById('login-google-btn');
    const loginGuestBtn = document.getElementById('login-guest-btn');
    const appContainer = document.getElementById('app');

    // Login Handler Wrapper
    const handleLogin = (provider) => {
        console.log(`${provider} login clicked`);
        DataManager.signIn(provider);
    };

    // Attach Listeners Immediately (Do not wait for async session check)
    loginAppleBtn.addEventListener('click', () => handleLogin('apple'));
    loginGoogleBtn.addEventListener('click', () => handleLogin('google'));
    loginGuestBtn.addEventListener('click', () => handleLogin('guest'));
    
    // Check for pending invite
    async function checkInvite() {
        window.checkInvite = checkInvite; // Expose
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCalendarId = urlParams.get('invite_calendar_id');
        
        if (inviteCalendarId && DataManager.session) {
             if (DataManager.isGuest) {
                 alert("공유 캘린더에 참여하려면 로그인이 필요합니다. 로그인 후 다시 링크를 클릭해주세요.");
                 const newUrl = window.location.href.split('?')[0];
                 window.history.replaceState({}, document.title, newUrl);
                 return;
             }

             // Clean URL
             const newUrl = window.location.href.split('?')[0];
             window.history.replaceState({}, document.title, newUrl);
             
             if (confirm("초대받은 캘린더에 참여하시겠습니까?")) {
                 try {
                     await DataManager.joinCalendar(inviteCalendarId);
                     alert("캘린더에 참여했습니다!");
                     if (window.refreshCalendarApp) {
                         await window.refreshCalendarApp(inviteCalendarId);
                     } else {
                         window.location.reload();
                     }
                 } catch (e) {
                     alert("참여 실패: " + e.message);
                 }
             }
        }
    }

    // Subscribe to Auth Changes (Required for Mobile Web Redirects)
    DataManager.client.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth State Change:", event);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session) {
                DataManager.session = session;
                loginModal.style.display = 'none';
                appContainer.style.filter = 'none';
                // Safe way to init if it hasn't run yet
                if (window.initializeCalendar) {
                    window.initializeCalendar();
                }
                await checkInvite();
            }
        } else if (event === 'SIGNED_OUT') {
            loginModal.style.display = 'flex';
            appContainer.style.filter = 'blur(5px)';
            DataManager.session = null;
        }
    });

    // Check Session (Initial Load)
    const session = await DataManager.checkSession();
    
    // Detect if we are in an OAuth redirect (Hash contains access_token)
    // This prevents showing the login modal while Supabase is still processing the URL
    const isRedirecting = window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token'));

    if (session) {
        loginModal.style.display = 'none';
        appContainer.style.filter = 'none';
        initializeCalendar();
        checkInvite();
    } else if (isRedirecting) {
        console.log("Detected redirect hash, waiting for auth processing...");
        // Do NOT show modal. Wait for onAuthStateChange to fire.
        loginModal.style.display = 'none';
        
        // Fallback: If auth doesn't resolve in 10 seconds, show login
        setTimeout(() => {
            if (!DataManager.session) {
                console.warn("Auth timeout.");
                loginModal.style.display = 'flex';
                appContainer.style.filter = 'blur(5px)';
            }
        }, 10000);
    } else {
        loginModal.style.display = 'flex';
        appContainer.style.filter = 'blur(5px)';
    }

    function initializeCalendar() {
        window.initializeCalendar = initializeCalendar; // Expose for DataManager
        
        window.refreshCalendarApp = async (targetCalendarId) => {
            if (targetCalendarId) DataManager.currentCalendarId = targetCalendarId;
            await loadCalendars();
        };

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
        const deleteAccountBtn = document.getElementById('delete-account-btn');
        const shareLinkBtn = document.getElementById('share-link-btn');

        // Modal Elements
        const modal = document.getElementById('add-schedule-modal');
        const closeModalButton = document.querySelector('#add-schedule-modal .close-button');
        const saveScheduleButton = document.getElementById('save-schedule');
        const scheduleTextInput = document.getElementById('schedule-text');
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');
        const enableRecurrenceCheckbox = document.getElementById('enable-recurrence');
        const recurrenceOptions = document.getElementById('recurrence-options');
        const recurrenceTypeSelect = document.getElementById('recurrence-type');
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
        for (let y = 1900; y <= 2100; y++) {
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
        
        // Set default to current date immediately
        yearSelect.value = new Date().getFullYear();
        monthSelect.value = new Date().getMonth();

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
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                
                const span = document.createElement('span');
                span.textContent = cal.title + (cal.id === DataManager.currentCalendarId ? ' (V)' : '');
                span.style.flex = '1'; // Take up all available space
                span.style.overflow = 'hidden';
                span.style.textOverflow = 'ellipsis';
                span.style.whiteSpace = 'nowrap';
                
                if (cal.id === DataManager.currentCalendarId) span.style.fontWeight = 'bold';
                
                li.onclick = async () => {
                    DataManager.currentCalendarId = cal.id;
                    await DataManager.fetchSchedules(); 
                    updateLiveLink(); 
                    drawer.style.display = 'none';
                    drawerOverlay.style.display = 'none';
                    loadCalendars(); 
                };

                const isOwner = cal.owner_id === DataManager.session.user.id;
                
                // Edit Button (Rename)
                if (isOwner) {
                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
                    editBtn.style.background = '#4A90E2';
                    editBtn.style.color = 'white';
                    editBtn.style.border = 'none';
                    editBtn.style.borderRadius = '50%';
                    editBtn.style.width = '24px';
                    editBtn.style.height = '24px';
                    editBtn.style.marginLeft = '10px';
                    editBtn.style.cursor = 'pointer';
                    editBtn.style.display = 'flex';
                    editBtn.style.justifyContent = 'center';
                    editBtn.style.alignItems = 'center';
                    editBtn.style.padding = '4px';
                    
                    editBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const newName = prompt("캘린더 이름 변경:", cal.title);
                        if (newName && newName !== cal.title) {
                            try {
                                await DataManager.updateCalendar(cal.id, newName);
                                await loadCalendars();
                            } catch (err) {
                                alert("이름 변경 실패: " + err.message);
                            }
                        }
                    };
                    li.appendChild(editBtn);
                }

                // Delete / Leave Button
                const delBtn = document.createElement('button');
                delBtn.innerHTML = isOwner ? '&times;' : 'out'; // X for owner, text/icon for leaver
                if (!isOwner) {
                    delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
                    delBtn.style.background = '#999'; // Grey for leaving
                } else {
                    delBtn.style.background = '#ff6b6b'; // Red for deleting
                }
                
                delBtn.style.color = 'white';
                delBtn.style.border = 'none';
                delBtn.style.borderRadius = '50%';
                delBtn.style.width = '24px';
                delBtn.style.height = '24px';
                delBtn.style.marginLeft = '10px';
                delBtn.style.cursor = 'pointer';
                delBtn.style.display = 'flex';
                delBtn.style.justifyContent = 'center';
                delBtn.style.alignItems = 'center';
                delBtn.style.padding = '4px';

                delBtn.onclick = async (e) => {
                    e.stopPropagation(); 
                    const msg = isOwner 
                        ? `'${cal.title}' 캘린더를 영구 삭제하시겠습니까? \n(모든 멤버에게서 삭제됩니다)` 
                        : `'${cal.title}' 공유 캘린더에서 나가시겠습니까? \n(다른 멤버는 계속 사용할 수 있습니다)`;
                    
                    if (confirm(msg)) {
                        try {
                            await DataManager.deleteCalendar(cal.id);
                            await loadCalendars(); 
                        } catch (err) {
                            alert("작업 실패: " + err.message);
                        }
                    }
                };
                li.appendChild(span);
                li.appendChild(delBtn);

                calendarList.appendChild(li);
            });
            updateLiveLink();
            if (DataManager.currentCalendarId) {
                await DataManager.fetchSchedules();
                renderCalendar(); 
            }
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

        deleteAccountBtn.onclick = async () => {
            if (confirm("정말로 계정을 탈퇴하시겠습니까?\n작성하신 모든 캘린더와 일정 데이터가 영구적으로 삭제됩니다.")) {
                if (confirm("마지막 확인입니다. 정말로 모든 데이터를 삭제하고 탈퇴하시겠습니까?")) {
                    try {
                        await DataManager.deleteAccount();
                        alert("탈퇴 처리가 완료되었습니다.");
                    } catch (e) {
                        alert("탈퇴 처리 중 오류가 발생했습니다: " + e.message);
                    }
                }
            }
        };

        // --- Sharing Logic ---
        shareLinkBtn.onclick = async () => {
            if (DataManager.isGuest) {
                return alert("게스트 모드에서는 공유할 수 없습니다.");
            }
            
            const baseUrl = window.location.href.split('?')[0].split('#')[0];
            // Ensure standard URL format
            const cleanBaseUrl = (baseUrl.endsWith('/') || baseUrl.endsWith('.html')) ? baseUrl : baseUrl + '/';
            const shareUrl = `${cleanBaseUrl}?invite_calendar_id=${DataManager.currentCalendarId}`;
            
            const shareData = {
                title: 'Calendar 초대',
                text: '공유 캘린더에 초대합니다. 링크를 클릭하여 참여하세요.',
                url: shareUrl
            };

            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    console.warn("Share failed:", err);
                }
            } else {
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    alert("초대 링크가 복사되었습니다!\n원하는 곳에 붙여넣어 공유하세요.");
                } catch (err) {
                    prompt("이 링크를 복사해서 공유하세요:", shareUrl);
                }
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
                    
                    const timeDiv = document.createElement('div');
                    timeDiv.className = 'list-item-time';
                    timeDiv.textContent = ev.startTime || '하루 종일';
                    
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'list-item-title';
                    titleDiv.textContent = ev.text;
                    
                    contentDiv.appendChild(timeDiv);
                    contentDiv.appendChild(titleDiv);
                    
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
                    const type = recurrenceTypeSelect.value;
                    const count = parseInt(recurrenceCountInput.value, 10);
                    const payloads = [];
                    const groupId = Math.random().toString(36).substring(2, 15);
                    const baseStart = new Date(startDateInput.value);
                    const baseEnd = new Date(endDateInput.value);
                    for (let i = 0; i < count; i++) {
                        const nextStart = new Date(baseStart);
                        const nextEnd = new Date(baseEnd);
                        
                        if (type === 'daily') {
                            nextStart.setDate(baseStart.getDate() + i);
                            nextEnd.setDate(baseEnd.getDate() + i);
                        } else if (type === 'weekly') {
                            nextStart.setDate(baseStart.getDate() + (i * 7));
                            nextEnd.setDate(baseEnd.getDate() + (i * 7));
                        } else if (type === 'yearly') {
                            nextStart.setFullYear(baseStart.getFullYear() + i);
                            nextEnd.setFullYear(baseEnd.getFullYear() + i);
                        }
                        
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

        // --- Deep Linking Support (Widget -> App) ---
        window.handleDeepLink = async (urlStr) => {
            console.log("Handling Deep Link:", urlStr);
            try {
                const url = new URL(urlStr);
                if (url.protocol === 'vibe:') {
                    if (url.host === 'date') {
                        const dateStr = url.pathname.replace('/', ''); // format: YYYY-MM-DD
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                            const targetDate = new Date(dateStr + 'T00:00:00');
                            currentDate = targetDate;
                            renderCalendar();
                            openScheduleListModal(dateStr);
                        }
                    } else if (url.host === 'add') {
                        // Open add modal for today
                        const todayStr = CalendarUtils.formatDate(new Date());
                        openAddScheduleModal(todayStr);
                    }
                }
            } catch (e) {
                console.error("Deep Link Error:", e);
            }
        };

        if (window.Capacitor) {
            window.Capacitor.Plugins.App.addListener('appUrlOpen', (data) => {
                window.handleDeepLink(data.url);
            });
        }
    }
});