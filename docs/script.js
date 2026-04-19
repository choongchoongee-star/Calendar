// --- Firebase Configuration ---
// Config is loaded from config.js (injected by CI, not committed)

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

    updateWidgetCalendar() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const WidgetBridge = window.Capacitor.Plugins.WidgetBridge;
            if (!WidgetBridge) {
                console.error("WidgetBridge plugin NOT FOUND");
                // Temporary alert for user diagnosis
                // alert("시스템: 위젯 연동 플러그인을 찾을 수 없습니다.");
                return;
            }
            // Aggressive data fetching: Check all possible keys
            let rawSchedules = this.schedules || [];
            if (rawSchedules.length === 0) {
                const guestSch = localStorage.getItem('guest_schedules');
                const cloudSch = localStorage.getItem('schedules_cache');
                try {
                    const p1 = guestSch ? JSON.parse(guestSch) : [];
                    const p2 = cloudSch ? JSON.parse(cloudSch) : [];
                    rawSchedules = [...p1, ...p2];
                } catch(e) {}
            }

            let rawCalendars = this.calendars || [];
            if (rawCalendars.length === 0) {
                const guestCal = localStorage.getItem('guest_calendars');
                const cloudCal = localStorage.getItem('calendars_cache');
                try {
                    const c1 = guestCal ? JSON.parse(guestCal) : [];
                    const c2 = cloudCal ? JSON.parse(cloudCal) : [];
                    rawCalendars = [...c1, ...c2];
                } catch(e) {}
            }

            // If still empty and we are in guest mode, force re-check
            if (rawCalendars.length === 0 && localStorage.getItem('isGuest') === 'true') {
                const stored = localStorage.getItem('guest_calendars');
                if (stored) {
                    try { rawCalendars = JSON.parse(stored); } catch(e) {}
                }
            }

            // Prepare clean lists (Failsafe mapping)
            const calendarList = rawCalendars.map(c => ({
                id: String(c.id || "default"),
                title: String(c.title || "캘린더")
            }));

            const scheduleList = rawSchedules.map(s => {
                const idStr = String(s.id || Math.random());
                const txtStr = String(s.text || s.title || "일정");
                let sd = s.start_date || s.startDate || "";
                let ed = s.end_date || s.endDate || sd;
                if (typeof sd !== 'string') sd = String(sd);
                if (typeof ed !== 'string') ed = String(ed);
                return {
                    id: idStr,
                    text: txtStr,
                    start_date: sd.substring(0, 10),
                    end_date: ed.substring(0, 10),
                    color: String(s.color || "#5DA2D5")
                };
            }).filter(s => s.start_date.length === 10);

            // Send all data to widget
            WidgetBridge.setSelectedCalendar({
                calendarId: this.currentCalendarId ? String(this.currentCalendarId) : (calendarList[0] ? calendarList[0].id : "all"),
                calendarsJson: JSON.stringify(calendarList),
                schedulesJson: JSON.stringify(scheduleList)
            }).then(() => {
            }).catch(err => {
                console.error("Widget sync failed:", err);
            });
        }
    },

    init(config) {
        if (typeof firebase === 'undefined') {
            console.error("Firebase SDK not loaded.");
            return;
        }
        firebase.initializeApp(config);
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.client = true;
    },

    async checkSession() {
        if (localStorage.getItem('isGuest') === 'true') {
            this.isGuest = true;
            this.session = { user: { id: 'guest', email: 'guest@local' } };
            return this.session;
        }

        if (!this.auth) {
            console.error("Firebase Auth not initialized.");
            return null;
        }

        return new Promise((resolve) => {
            const unsubscribe = this.auth.onAuthStateChanged((user) => {
                unsubscribe();
                if (user) {
                    this.session = { user: { id: user.uid, email: user.email } };
                } else {
                    this.session = null;
                }
                resolve(this.session);
            });
        });
    },

    async enableGuestMode() {
        this.isGuest = true;
        this.session = { user: { id: 'guest', email: 'guest@local' } };
        localStorage.setItem('isGuest', 'true');
        
        // Ensure at least one default calendar exists for guest
        const guestCalendars = JSON.parse(localStorage.getItem('guest_calendars') || '[]');
        if (guestCalendars.length === 0) {
            await this.createCalendar("내 캘린더");
        } else if (!this.currentCalendarId) {
            this.currentCalendarId = guestCalendars[0].id;
        }
        this.updateWidgetCalendar();
    },

    async signIn(provider) {
        if (provider === 'guest') {
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

        if (!this.auth) {
            alert("로그인 서비스를 사용할 수 없습니다. (Firebase 초기화 실패)");
            return;
        }

        try {
            // 1. Native Apple Sign-In (iOS)
            if (provider === 'apple' &&
                window.Capacitor &&
                window.Capacitor.isNativePlatform()) {

                const AppleSignIn = window.Capacitor.Plugins.SignInWithApple;
                if (AppleSignIn) {
                    try {
                        const rawNonce = generateNonce();
                        const hashedNonce = await sha256(rawNonce);

                        const result = await AppleSignIn.authorize({
                            clientId: 'com.dangmoo.calendar',
                            scopes: 'email name',
                            redirectURI: '',
                            nonce: hashedNonce
                        });

                        if (result.response && result.response.identityToken) {
                            const oauthProvider = new firebase.auth.OAuthProvider('apple.com');
                            const oauthCredential = oauthProvider.credential({
                                idToken: result.response.identityToken,
                                rawNonce: rawNonce,
                            });
                            const userCredential = await this.auth.signInWithCredential(oauthCredential);
                            localStorage.removeItem('isGuest');
                            this.isGuest = false;
                            this.calendars = [];
                            this.currentCalendarId = null;
                            this.session = { user: { id: userCredential.user.uid, email: userCredential.user.email } };
                            document.getElementById('login-modal').style.display = 'none';
                            document.getElementById('app').style.filter = 'none';
                            if (window.initializeCalendar) window.initializeCalendar();
                            return;
                        } else {
                            throw new Error("No identity token received from Apple");
                        }
                    } catch (nativeError) {
                        console.error("Native Apple Sign-In error:", nativeError);
                        alert(
                            "Apple 로그인 실패 (네이티브)\n" +
                            "code: " + (nativeError.code || "?") + "\n" +
                            "message: " + (nativeError.message || String(nativeError))
                        );
                        return;
                    }
                }
            }

            // 1b. Native Google Sign-In (iOS) via @capacitor-firebase/authentication
            if (provider === 'google' &&
                window.Capacitor &&
                window.Capacitor.isNativePlatform()) {

                const FirebaseAuth = window.Capacitor.Plugins.FirebaseAuthentication;
                if (FirebaseAuth) {
                    try {
                        const result = await FirebaseAuth.signInWithGoogle({ skipNativeAuth: true });
                        const idToken = result && result.credential && result.credential.idToken;
                        if (!idToken) {
                            throw new Error('No idToken received from FirebaseAuthentication.signInWithGoogle');
                        }
                        const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
                        const userCredential = await this.auth.signInWithCredential(credential);
                        localStorage.removeItem('isGuest');
                        this.isGuest = false;
                        this.calendars = [];
                        this.currentCalendarId = null;
                        this.session = { user: { id: userCredential.user.uid, email: userCredential.user.email } };
                        document.getElementById('login-modal').style.display = 'none';
                        document.getElementById('app').style.filter = 'none';
                        if (window.initializeCalendar) window.initializeCalendar();
                        return;
                    } catch (nativeError) {
                        console.error("Native Google Sign-In error:", nativeError);
                        alert(
                            "Google 로그인 실패 (네이티브)\n" +
                            "code: " + (nativeError.code || "?") + "\n" +
                            "message: " + (nativeError.message || String(nativeError))
                        );
                        return;
                    }
                }
            }

            // 2. Web OAuth (Popup)
            localStorage.removeItem('isGuest');
            this.isGuest = false;
            this.calendars = [];
            this.currentCalendarId = null;
            let authProvider;
            if (provider === 'google') {
                authProvider = new firebase.auth.GoogleAuthProvider();
            } else if (provider === 'apple') {
                authProvider = new firebase.auth.OAuthProvider('apple.com');
                authProvider.addScope('email');
                authProvider.addScope('name');
            }

            const userCredential = await this.auth.signInWithPopup(authProvider);
            this.session = { user: { id: userCredential.user.uid, email: userCredential.user.email } };
            window.location.reload();
        } catch (e) {
            console.error("Sign-in error:", e);
            alert("로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        }
    },

    async signOut() {
        if (this.isGuest) {
            this.isGuest = false;
            localStorage.removeItem('isGuest');
            window.location.reload();
            return;
        }
        await this.auth.signOut();
        window.location.reload();
    },

    async deleteAccount() {
        if (this.isGuest) {
            localStorage.clear();
            window.location.reload();
            return;
        }

        if (!this.session) return;
        // Prevent re-entry if the user taps twice while delete is in flight
        if (this._deleteInFlight) return;
        this._deleteInFlight = true;

        try {
            const userId = this.session.user.id;

            // 1. Delete all calendars owned by the user
            const calendarsSnap = await this.db.collection('calendars')
                .where('ownerId', '==', userId).get();
            const batch = this.db.batch();
            for (const doc of calendarsSnap.docs) {
                // Delete associated schedules
                const schedulesSnap = await this.db.collection('schedules')
                    .where('calendarId', '==', doc.id).get();
                schedulesSnap.docs.forEach(s => batch.delete(s.ref));
                batch.delete(doc.ref);
            }
            await batch.commit();

            // 2. Unlink from shared calendars where user is a member
            const memberSnap = await this.db.collection('calendars')
                .where(`members.${userId}`, 'in', ['editor', 'viewer']).get();
            const memberBatch = this.db.batch();
            memberSnap.docs.forEach(doc => {
                memberBatch.update(doc.ref, {
                    [`members.${userId}`]: firebase.firestore.FieldValue.delete()
                });
            });
            await memberBatch.commit();

            // 3. Delete Firebase Auth account (client-side — no Edge Function needed!)
            const user = this.auth.currentUser;
            if (user) {
                try {
                    await user.delete();
                } catch (authErr) {
                    if (authErr && authErr.code === 'auth/requires-recent-login') {
                        console.warn("Auth deletion requires recent login; Firestore data already cleaned up:", authErr);
                        alert("보안을 위해 다시 로그인 후 탈퇴를 시도해 주세요.");
                        return;
                    }
                    throw authErr;
                }
            }
            window.location.reload();
        } finally {
            this._deleteInFlight = false;
        }
    },

    async fetchCalendars() {
        if (this.isGuest) {
            const stored = localStorage.getItem('guest_calendars');
            this.calendars = stored ? JSON.parse(stored) : [];

            if (this.calendars.length === 0) {
                await this.createCalendar("내 캘린더");
                return await this.fetchCalendars();
            }
            
            if (!this.currentCalendarId && this.calendars.length > 0) {
                this.currentCalendarId = this.calendars[0].id;
            }
            this.updateWidgetCalendar();
            return this.calendars;
        }

        if (!this.session) return [];
        const userId = this.session.user.id;

        // Fetch calendars where user is owner
        const ownedSnap = await this.db.collection('calendars')
            .where('ownerId', '==', userId).get();

        // Fetch calendars where user is a member
        const memberSnap = await this.db.collection('calendars')
            .where(`members.${userId}`, 'in', ['editor', 'viewer']).get();

        const calendarMap = new Map();
        ownedSnap.docs.forEach(doc => calendarMap.set(doc.id, { id: doc.id, ...doc.data() }));
        memberSnap.docs.forEach(doc => {
            if (!calendarMap.has(doc.id)) {
                calendarMap.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });
        this.calendars = Array.from(calendarMap.values());

        // If no calendar exists, create a default one
        if (this.calendars.length === 0) {
            await this.createCalendar("내 캘린더");
            return await this.fetchCalendars();
        }

        // Select first calendar by default if none selected
        if (!this.currentCalendarId && this.calendars.length > 0) {
            this.currentCalendarId = this.calendars[0].id;
        }

        // Always sync with widget when calendars are fetched
        this.updateWidgetCalendar();

        return this.calendars;
    },

    async createCalendar(title) {
        if (this.isGuest) {
            const newCalendar = {
                id: 'guest-cal-' + Date.now(),
                title: title,
                ownerId: 'guest',
                created_at: new Date().toISOString()
            };
            const calendars = JSON.parse(localStorage.getItem('guest_calendars') || '[]');
            calendars.push(newCalendar);
            localStorage.setItem('guest_calendars', JSON.stringify(calendars));
            this.currentCalendarId = newCalendar.id;
            this.updateWidgetCalendar();
            return;
        }

        if (!this.session || !this.session.user) throw new Error("로그인이 필요합니다.");
        const docRef = await this.db.collection('calendars').add({
            title: title,
            ownerId: this.session.user.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            members: {}
        });
        this.currentCalendarId = docRef.id;
        this.updateWidgetCalendar();
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
        await this.db.collection('calendars').doc(id).update({ title: title });
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
                this.updateWidgetCalendar();
            }
            return;
        }

        if (!this.session) throw new Error("로그인이 필요합니다.");
        const calDoc = await this.db.collection('calendars').doc(id).get();
        if (!calDoc.exists) throw new Error("캘린더를 찾을 수 없습니다.");
        const calData = calDoc.data();

        if (calData.ownerId === this.session.user.id) {
            // I am the owner -> Delete calendar + associated schedules
            const schedulesSnap = await this.db.collection('schedules')
                .where('calendarId', '==', id).get();
            const batch = this.db.batch();
            schedulesSnap.docs.forEach(s => batch.delete(s.ref));
            batch.delete(calDoc.ref);
            await batch.commit();
        } else {
            // I am a member -> Remove myself from members map
            await this.db.collection('calendars').doc(id).update({
                [`members.${this.session.user.id}`]: firebase.firestore.FieldValue.delete()
            });
        }

        if (this.currentCalendarId === id) {
            this.currentCalendarId = null;
            this.updateWidgetCalendar();
        }
    },

    async joinCalendar(calendarId) {
        if (!this.session || !this.session.user) throw new Error("로그인이 필요합니다.");
        const userId = this.session.user.id;

        const calDoc = await this.db.collection('calendars').doc(calendarId).get();
        if (!calDoc.exists) throw new Error("캘린더를 찾을 수 없습니다.");

        const calData = calDoc.data();
        if (calData.ownerId === userId || (calData.members && calData.members[userId])) {
            return; // Already owner or member
        }

        await this.db.collection('calendars').doc(calendarId).update({
            [`members.${userId}`]: 'editor'
        });
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

        if (!this.db || !this.currentCalendarId) return [];
        const snap = await this.db.collection('schedules')
            .where('calendarId', '==', this.currentCalendarId).get();

        this.schedules = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                text: d.text,
                startDate: d.startDate,
                endDate: d.endDate,
                startTime: d.startTime || null,
                endTime: d.endTime || null,
                groupId: d.groupId || null,
                color: d.color,
                calendarId: d.calendarId
            };
        });

        // Cache for widget sync
        localStorage.setItem('schedules_cache', JSON.stringify(
            this.schedules.map(s => ({
                id: s.id, text: s.text,
                start_date: s.startDate, end_date: s.endDate,
                start_time: s.startTime, end_time: s.endTime,
                color: s.color, calendar_id: s.calendarId
            }))
        ));

        this.updateWidgetCalendar();
        return this.schedules;
    },

    async addSchedule(payload) {
        payload.calendar_id = this.currentCalendarId; // Assign to current calendar

        if (this.isGuest) {
            const schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            // Simulate SQL insert
            const newId = 'guest-sch-' + Date.now() + Math.random();
            const newSchedule = { ...payload, id: newId };
            schedules.push(newSchedule);
            localStorage.setItem('guest_schedules', JSON.stringify(schedules));
            await this.fetchSchedules(); // Refresh memory state first
            return newId;
        }

        if (!this.db) throw new Error("Firebase not initialized");
        const docRef = await this.db.collection('schedules').add({
            calendarId: payload.calendar_id,
            text: payload.text,
            startDate: payload.start_date,
            endDate: payload.end_date,
            startTime: payload.start_time || null,
            endTime: payload.end_time || null,
            color: payload.color || '#5DA2D5',
            groupId: payload.group_id || null
        });
        await this.fetchSchedules();
        return docRef.id;
    },

    async addSchedules(payloads) {
        payloads.forEach(p => p.calendar_id = this.currentCalendarId);

        if (this.isGuest) {
            const schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            const newIds = [];
            payloads.forEach(p => {
                const newId = 'guest-sch-' + Date.now() + Math.random();
                newIds.push(newId);
                schedules.push({ ...p, id: newId });
            });
            localStorage.setItem('guest_schedules', JSON.stringify(schedules));
            await this.fetchSchedules(); // Refresh memory state first
            return newIds;
        }

        if (!this.db) throw new Error("Firebase not initialized");
        const batch = this.db.batch();
        const newIds = [];
        payloads.forEach(p => {
            const ref = this.db.collection('schedules').doc();
            newIds.push(ref.id);
            batch.set(ref, {
                calendarId: p.calendar_id,
                text: p.text,
                startDate: p.start_date,
                endDate: p.end_date,
                startTime: p.start_time || null,
                endTime: p.end_time || null,
                color: p.color || '#5DA2D5',
                groupId: p.group_id || null
            });
        });
        await batch.commit();
        await this.fetchSchedules();
        return newIds;
    },

    async updateSchedule(id, payload) {
        if (this.isGuest) {
            let schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            const index = schedules.findIndex(s => s.id === id);
            if (index !== -1) {
                schedules[index] = { ...schedules[index], ...payload };
                localStorage.setItem('guest_schedules', JSON.stringify(schedules));
                await this.fetchSchedules();
            }
            return;
        }

        if (!this.db) throw new Error("Firebase not initialized");
        const updateData = {};
        if (payload.text !== undefined) updateData.text = payload.text;
        if (payload.start_date !== undefined) updateData.startDate = payload.start_date;
        if (payload.end_date !== undefined) updateData.endDate = payload.end_date;
        if (payload.start_time !== undefined) updateData.startTime = payload.start_time;
        if (payload.end_time !== undefined) updateData.endTime = payload.end_time;
        if (payload.color !== undefined) updateData.color = payload.color;
        if (payload.group_id !== undefined) updateData.groupId = payload.group_id;
        await this.db.collection('schedules').doc(id).update(updateData);
        await this.fetchSchedules();
    },

    async deleteSchedule(id) {
        // Cancel any pending notification first (same in guest + cloud)
        await cancelScheduleNotification(id);

        if (this.isGuest) {
            let schedules = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            schedules = schedules.filter(s => s.id !== id);
            localStorage.setItem('guest_schedules', JSON.stringify(schedules));
            await this.fetchSchedules();
            return;
        }

        if (!this.db) throw new Error("Firebase not initialized");
        await this.db.collection('schedules').doc(id).delete();
        await this.fetchSchedules();
    },

    async deleteSchedulesByGroupId(groupId) {
        if (this.isGuest) {
            const all = JSON.parse(localStorage.getItem('guest_schedules') || '[]');
            const matching = all.filter(s => s.group_id === groupId);
            for (const s of matching) {
                await cancelScheduleNotification(s.id);
            }
            const remaining = all.filter(s => s.group_id !== groupId);
            localStorage.setItem('guest_schedules', JSON.stringify(remaining));
            await this.fetchSchedules();
            return;
        }

        if (!this.db) throw new Error("Firebase not initialized");
        const snap = await this.db.collection('schedules')
            .where('groupId', '==', groupId).get();
        for (const doc of snap.docs) {
            await cancelScheduleNotification(doc.id);
        }
        const batch = this.db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await this.fetchSchedules();
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
            // HOLIDAYS:START (auto-generated; edit via scripts/fetch-holidays.js)
            // 2025
            {id: 'h25-1', text: "신정", startDate: '2025-01-01', endDate: '2025-01-01', type: 'holiday'},
            {id: 'h25-2', text: "설날", startDate: '2025-01-28', endDate: '2025-01-30', type: 'holiday'},
            {id: 'h25-3', text: "삼일절", startDate: '2025-03-01', endDate: '2025-03-01', type: 'holiday'},
            {id: 'h25-4', text: "어린이날", startDate: '2025-05-05', endDate: '2025-05-05', type: 'holiday'},
            {id: 'h25-5', text: "부처님 오신 날", startDate: '2025-05-05', endDate: '2025-05-05', type: 'holiday'},
            {id: 'h25-5d', text: "부처님오신날 대체", startDate: '2025-05-06', endDate: '2025-05-06', type: 'holiday'},
            {id: 'h25-6', text: "현충일", startDate: '2025-06-06', endDate: '2025-06-06', type: 'holiday'},
            {id: 'h25-7', text: "광복절", startDate: '2025-08-15', endDate: '2025-08-15', type: 'holiday'},
            {id: 'h25-8', text: "추석", startDate: '2025-10-05', endDate: '2025-10-07', type: 'holiday'},
            {id: 'h25-8d', text: "추석 대체", startDate: '2025-10-08', endDate: '2025-10-08', type: 'holiday'},
            {id: 'h25-9', text: "개천절", startDate: '2025-10-03', endDate: '2025-10-03', type: 'holiday'},
            {id: 'h25-10', text: "한글날", startDate: '2025-10-09', endDate: '2025-10-09', type: 'holiday'},
            {id: 'h25-11', text: "성탄절", startDate: '2025-12-25', endDate: '2025-12-25', type: 'holiday'},

            // 2026
            {id: 'h26-1', text: "신정", startDate: '2026-01-01', endDate: '2026-01-01', type: 'holiday'},
            {id: 'h26-2', text: "설날", startDate: '2026-02-16', endDate: '2026-02-18', type: 'holiday'},
            {id: 'h26-3', text: "삼일절", startDate: '2026-03-01', endDate: '2026-03-01', type: 'holiday'},
            {id: 'h26-3d', text: "삼일절 대체", startDate: '2026-03-02', endDate: '2026-03-02', type: 'holiday'},
            {id: 'h26-4', text: "어린이날", startDate: '2026-05-05', endDate: '2026-05-05', type: 'holiday'},
            {id: 'h26-5', text: "부처님 오신 날", startDate: '2026-05-24', endDate: '2026-05-24', type: 'holiday'},
            {id: 'h26-5d', text: "부처님오신날 대체", startDate: '2026-05-25', endDate: '2026-05-25', type: 'holiday'},
            {id: 'h26-6', text: "현충일", startDate: '2026-06-06', endDate: '2026-06-06', type: 'holiday'},
            {id: 'h26-7', text: "광복절", startDate: '2026-08-15', endDate: '2026-08-15', type: 'holiday'},
            {id: 'h26-7d', text: "광복절 대체", startDate: '2026-08-17', endDate: '2026-08-17', type: 'holiday'},
            {id: 'h26-8', text: "추석", startDate: '2026-09-24', endDate: '2026-09-26', type: 'holiday'},
            {id: 'h26-8d', text: "추석 대체", startDate: '2026-09-28', endDate: '2026-09-28', type: 'holiday'},
            {id: 'h26-9', text: "개천절", startDate: '2026-10-03', endDate: '2026-10-03', type: 'holiday'},
            {id: 'h26-9d', text: "개천절 대체", startDate: '2026-10-05', endDate: '2026-10-05', type: 'holiday'},
            {id: 'h26-10', text: "한글날", startDate: '2026-10-09', endDate: '2026-10-09', type: 'holiday'},
            {id: 'h26-11', text: "성탄절", startDate: '2026-12-25', endDate: '2026-12-25', type: 'holiday'},

            // 2027
            {id: 'h27-1', text: "신정", startDate: '2027-01-01', endDate: '2027-01-01', type: 'holiday'},
            {id: 'h27-2', text: "설날", startDate: '2027-02-06', endDate: '2027-02-08', type: 'holiday'},
            {id: 'h27-2d', text: "설날 대체", startDate: '2027-02-09', endDate: '2027-02-09', type: 'holiday'},
            {id: 'h27-3', text: "삼일절", startDate: '2027-03-01', endDate: '2027-03-01', type: 'holiday'},
            {id: 'h27-4', text: "어린이날", startDate: '2027-05-05', endDate: '2027-05-05', type: 'holiday'},
            {id: 'h27-5', text: "부처님 오신 날", startDate: '2027-05-13', endDate: '2027-05-13', type: 'holiday'},
            {id: 'h27-6', text: "현충일", startDate: '2027-06-06', endDate: '2027-06-06', type: 'holiday'},
            {id: 'h27-6d', text: "현충일 대체", startDate: '2027-06-07', endDate: '2027-06-07', type: 'holiday'},
            {id: 'h27-7', text: "광복절", startDate: '2027-08-15', endDate: '2027-08-15', type: 'holiday'},
            {id: 'h27-7d', text: "광복절 대체", startDate: '2027-08-16', endDate: '2027-08-16', type: 'holiday'},
            {id: 'h27-8', text: "추석", startDate: '2027-09-14', endDate: '2027-09-16', type: 'holiday'},
            {id: 'h27-9', text: "개천절", startDate: '2027-10-03', endDate: '2027-10-03', type: 'holiday'},
            {id: 'h27-9d', text: "개천절 대체", startDate: '2027-10-04', endDate: '2027-10-04', type: 'holiday'},
            {id: 'h27-10', text: "한글날", startDate: '2027-10-09', endDate: '2027-10-09', type: 'holiday'},
            {id: 'h27-11', text: "성탄절", startDate: '2027-12-25', endDate: '2027-12-25', type: 'holiday'},

            // 2028
            {id: 'h28-1', text: "신정", startDate: '2028-01-01', endDate: '2028-01-01', type: 'holiday'},
            {id: 'h28-2', text: "설날", startDate: '2028-01-26', endDate: '2028-01-28', type: 'holiday'},
            {id: 'h28-3', text: "삼일절", startDate: '2028-03-01', endDate: '2028-03-01', type: 'holiday'},
            {id: 'h28-4', text: "어린이날", startDate: '2028-05-05', endDate: '2028-05-05', type: 'holiday'},
            {id: 'h28-5', text: "부처님 오신 날", startDate: '2028-05-02', endDate: '2028-05-02', type: 'holiday'},
            {id: 'h28-6', text: "현충일", startDate: '2028-06-06', endDate: '2028-06-06', type: 'holiday'},
            {id: 'h28-7', text: "광복절", startDate: '2028-08-15', endDate: '2028-08-15', type: 'holiday'},
            {id: 'h28-8', text: "추석", startDate: '2028-10-02', endDate: '2028-10-04', type: 'holiday'},
            {id: 'h28-9', text: "개천절", startDate: '2028-10-03', endDate: '2028-10-03', type: 'holiday'},
            {id: 'h28-8d', text: "추석 대체", startDate: '2028-10-05', endDate: '2028-10-05', type: 'holiday'},
            {id: 'h28-10', text: "한글날", startDate: '2028-10-09', endDate: '2028-10-09', type: 'holiday'},
            {id: 'h28-11', text: "성탄절", startDate: '2028-12-25', endDate: '2028-12-25', type: 'holiday'},

            // 2029
            {id: 'h29-1', text: "신정", startDate: '2029-01-01', endDate: '2029-01-01', type: 'holiday'},
            {id: 'h29-2', text: "설날", startDate: '2029-02-12', endDate: '2029-02-14', type: 'holiday'},
            {id: 'h29-3', text: "삼일절", startDate: '2029-03-01', endDate: '2029-03-01', type: 'holiday'},
            {id: 'h29-4', text: "어린이날", startDate: '2029-05-05', endDate: '2029-05-05', type: 'holiday'},
            {id: 'h29-4d', text: "어린이날 대체", startDate: '2029-05-07', endDate: '2029-05-07', type: 'holiday'},
            {id: 'h29-5', text: "부처님 오신 날", startDate: '2029-05-20', endDate: '2029-05-20', type: 'holiday'},
            {id: 'h29-5d', text: "부처님오신날 대체", startDate: '2029-05-21', endDate: '2029-05-21', type: 'holiday'},
            {id: 'h29-6', text: "현충일", startDate: '2029-06-06', endDate: '2029-06-06', type: 'holiday'},
            {id: 'h29-7', text: "광복절", startDate: '2029-08-15', endDate: '2029-08-15', type: 'holiday'},
            {id: 'h29-8', text: "추석", startDate: '2029-09-21', endDate: '2029-09-23', type: 'holiday'},
            {id: 'h29-8d', text: "추석 대체", startDate: '2029-09-24', endDate: '2029-09-24', type: 'holiday'},
            {id: 'h29-9', text: "개천절", startDate: '2029-10-03', endDate: '2029-10-03', type: 'holiday'},
            {id: 'h29-10', text: "한글날", startDate: '2029-10-09', endDate: '2029-10-09', type: 'holiday'},
            {id: 'h29-11', text: "성탄절", startDate: '2029-12-25', endDate: '2029-12-25', type: 'holiday'},

            // 2030
            {id: 'h30-1', text: "신정", startDate: '2030-01-01', endDate: '2030-01-01', type: 'holiday'},
            {id: 'h30-2', text: "설날", startDate: '2030-02-02', endDate: '2030-02-04', type: 'holiday'},
            {id: 'h30-2d', text: "설날 대체", startDate: '2030-02-05', endDate: '2030-02-05', type: 'holiday'},
            {id: 'h30-3', text: "삼일절", startDate: '2030-03-01', endDate: '2030-03-01', type: 'holiday'},
            {id: 'h30-4', text: "어린이날", startDate: '2030-05-05', endDate: '2030-05-05', type: 'holiday'},
            {id: 'h30-4d', text: "어린이날 대체", startDate: '2030-05-06', endDate: '2030-05-06', type: 'holiday'},
            {id: 'h30-5', text: "부처님 오신 날", startDate: '2030-05-09', endDate: '2030-05-09', type: 'holiday'},
            {id: 'h30-6', text: "현충일", startDate: '2030-06-06', endDate: '2030-06-06', type: 'holiday'},
            {id: 'h30-7', text: "광복절", startDate: '2030-08-15', endDate: '2030-08-15', type: 'holiday'},
            {id: 'h30-8', text: "추석", startDate: '2030-09-11', endDate: '2030-09-13', type: 'holiday'},
            {id: 'h30-9', text: "개천절", startDate: '2030-10-03', endDate: '2030-10-03', type: 'holiday'},
            {id: 'h30-10', text: "한글날", startDate: '2030-10-09', endDate: '2030-10-09', type: 'holiday'},
            {id: 'h30-11', text: "성탄절", startDate: '2030-12-25', endDate: '2030-12-25', type: 'holiday'},
            // HOLIDAYS:END
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
    window.initializeCalendar = initializeCalendar;

    // 1. Initialize Firebase (only if config is available)
    if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey) {
        DataManager.init(firebaseConfig);
    } else {
        console.warn("Firebase config not found. Running in guest-only mode.");
    }

    // 2. Select Elements
    const loginModal = document.getElementById('login-modal');
    const loginAppleBtn = document.getElementById('login-apple-btn');
    const loginGoogleBtn = document.getElementById('login-google-btn');
    const loginGuestBtn = document.getElementById('login-guest-btn');
    const appContainer = document.getElementById('app');

    const handleLogin = (provider) => {
        DataManager.signIn(provider);
    };

    loginAppleBtn.addEventListener('click', () => handleLogin('apple'));
    loginGoogleBtn.addEventListener('click', () => handleLogin('google'));
    loginGuestBtn.addEventListener('click', () => handleLogin('guest'));

    // Check for pending invite
    async function checkInvite() {
        window.checkInvite = checkInvite;
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCalendarId = urlParams.get('invite_calendar_id');

        if (inviteCalendarId && DataManager.session) {
            if (DataManager.isGuest) {
                alert("공유 캘린더에 참여하려면 로그인이 필요합니다. 로그인 후 다시 링크를 클릭해주세요.");
                const newUrl = window.location.href.split('?')[0];
                window.history.replaceState({}, document.title, newUrl);
                return;
            }

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

    // Firebase Auth state listener — only attached if Firebase initialized.
    // When config is missing we still want the guest-only flow below to run.
    if (DataManager.client) {
        DataManager.auth.onAuthStateChanged(async (user) => {
            if (user) {
                DataManager.session = { user: { id: user.uid, email: user.email } };
                loginModal.style.display = 'none';
                appContainer.style.filter = 'none';
                if (window.initializeCalendar) {
                    window.initializeCalendar();
                }
                await checkInvite();
            } else if (!DataManager.isGuest) {
                loginModal.style.display = 'flex';
                appContainer.style.filter = 'blur(5px)';
                DataManager.session = null;
            }
        });
    }

    // Check Session (Initial Load)
    const session = await DataManager.checkSession();

    if (session) {
        loginModal.style.display = 'none';
        appContainer.style.filter = 'none';
        initializeCalendar();
        checkInvite();
        setTimeout(() => {
            DataManager.updateWidgetCalendar();
        }, 1500);
    } else {
        // Auto-enable Guest Mode
        await DataManager.enableGuestMode();
        loginModal.style.display = 'none';
        appContainer.style.filter = 'none';
        initializeCalendar();
        checkInvite();
    }

    async function initializeCalendar() {
        window.initializeCalendar = initializeCalendar; // Expose for DataManager
        
        window.refreshCalendarApp = async (targetCalendarId) => {
            if (targetCalendarId) {
                DataManager.currentCalendarId = targetCalendarId;
                DataManager.updateWidgetCalendar();
            }
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
        const drawerLoginBtn = document.getElementById('drawer-login-btn');
        const logoutBtn = document.getElementById('logout-btn');

        // Settings Elements
        const settingsBtn = document.getElementById('settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        const closeSettingsBtn = document.querySelector('.settings-close');
        const settingsLoginBtn = document.getElementById('settings-login-btn');
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

        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 50; y <= currentYear + 10; y++) {
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
                span.textContent = cal.title + (cal.id === DataManager.currentCalendarId ? ' ✓' : '');
                span.style.flex = '1'; // Take up all available space
                span.style.overflow = 'hidden';
                span.style.textOverflow = 'ellipsis';
                span.style.whiteSpace = 'nowrap';
                
                if (cal.id === DataManager.currentCalendarId) span.style.fontWeight = 'bold';
                
                li.onclick = async () => {
                    DataManager.currentCalendarId = cal.id;
                    DataManager.updateWidgetCalendar();
                    await DataManager.fetchSchedules(); 
                    updateLiveLink(); 
                    drawer.style.display = 'none';
                    drawerOverlay.style.display = 'none';
                    loadCalendars(); 
                };

                const isOwner = cal.ownerId === DataManager.session.user.id;
                
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

        const showLoginModal = () => {
            const loginModal = document.getElementById('login-modal');
            const appContainer = document.getElementById('app');
            loginModal.style.display = 'flex';
            appContainer.style.filter = 'blur(5px)';
            // Ensure sidebar and settings close when login opens
            drawer.style.display = 'none';
            drawerOverlay.style.display = 'none';
            settingsModal.style.display = 'none';
        };

        drawerLoginBtn.onclick = showLoginModal;
        settingsLoginBtn.onclick = showLoginModal;

        if (DataManager.isGuest) {
            logoutBtn.style.display = 'none';
            settingsLogoutBtn.style.display = 'none';
            deleteAccountBtn.style.display = 'none';
            drawerLoginBtn.style.display = 'block';
            settingsLoginBtn.style.display = 'block';
        } else {
            logoutBtn.style.display = '';
            settingsLogoutBtn.style.display = '';
            deleteAccountBtn.style.display = '';
            drawerLoginBtn.style.display = 'none';
            settingsLoginBtn.style.display = 'none';
        }

        deleteAccountBtn.onclick = async () => {
            if (!confirm("정말로 계정을 탈퇴하시겠습니까?\n작성하신 모든 캘린더와 일정 데이터가 영구적으로 삭제됩니다.")) {
                return;
            }

            // Shared-calendar impact warning (owner's withdrawal deletes the calendar for everyone)
            if (!DataManager.isGuest && DataManager.db && DataManager.session) {
                try {
                    const myId = DataManager.session.user.id;
                    const ownedSnap = await DataManager.db.collection('calendars')
                        .where('ownerId', '==', myId).get();
                    let sharedCount = 0;
                    let impactedMembers = 0;
                    ownedSnap.docs.forEach(doc => {
                        const members = doc.data().members || {};
                        const others = Object.keys(members).filter(uid => uid !== myId);
                        if (others.length > 0) {
                            sharedCount += 1;
                            impactedMembers += others.length;
                        }
                    });
                    if (sharedCount > 0) {
                        const msg = `⚠️ 공유 달력 ${sharedCount}개가 삭제되며, 해당 달력에 초대된 ${impactedMembers}명은 더 이상 접근할 수 없게 됩니다.\n\n계속 진행할까요?`;
                        if (!confirm(msg)) return;
                    }
                } catch (e) {
                    console.warn("Shared calendar pre-check failed; proceeding with generic warning:", e);
                }
            }

            if (!confirm("마지막 확인입니다. 정말로 모든 데이터를 삭제하고 탈퇴하시겠습니까?")) return;
            try {
                await DataManager.deleteAccount();
                alert("탈퇴 처리가 완료되었습니다.");
            } catch (e) {
                alert("탈퇴 처리 중 오류가 발생했습니다: " + e.message);
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
            
            linkInput.value = "현재 사용 불가 (Storage 미연결)";
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
            listModal.style.display = 'flex'; lockBodyScroll();
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
        function closeListModal() { listModal.style.display = 'none'; unlockBodyScroll(); }
        
        function lockBodyScroll() {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        }
        function unlockBodyScroll() {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        }

        function openAddScheduleModal(d, s = null) {
            modal.style.display = 'flex';
            lockBodyScroll();
            const modalTitle = modal.querySelector('h2');
            editingScheduleId = s ? s.id : null;
            editingGroupId = s ? s.groupId : null;
            selectedColor = s ? (s.color || colorPalette[0]) : colorPalette[0];
            renderPalette();
            if (s) {
                scheduleTextInput.value = s.text; startDateInput.value = s.startDate; endDateInput.value = s.endDate;
                startTimeInput.value = s.startTime || ''; endTimeInput.value = s.endTime || '';
                if (s.groupId) {
                    // Default: edit THIS instance only. User can tick the box to re-define the series.
                    enableRecurrenceCheckbox.checked = false;
                    recurrenceOptions.style.display = 'none';
                    modalTitle.textContent = "일정 수정 (이 일정만)";
                } else {
                    enableRecurrenceCheckbox.checked = false;
                    recurrenceOptions.style.display = 'none';
                    modalTitle.textContent = "일정 수정";
                }
            } else {
                modalTitle.textContent = "일정 추가";
                startDateInput.value = d; endDateInput.value = d; scheduleTextInput.value = '';
                startTimeInput.value = ''; endTimeInput.value = '';
                enableRecurrenceCheckbox.checked = false;
                recurrenceOptions.style.display = 'none';
            }
        }
        function closeAddScheduleModal() { modal.style.display = 'none'; unlockBodyScroll(); }

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
                    const newIds = await DataManager.addSchedules(payloads);
                    payloads.forEach((p, i) => scheduleScheduleNotification({ ...p, id: newIds && newIds[i] }));
                } else if (editingScheduleId && editingGroupId && !enableRecurrenceCheckbox.checked) {
                    // Edit a single instance of a recurring series, leaving siblings intact
                    await cancelScheduleNotification(editingScheduleId);
                    await DataManager.updateSchedule(editingScheduleId, payload);
                    scheduleScheduleNotification({ ...payload, id: editingScheduleId });
                } else if (editingGroupId && enableRecurrenceCheckbox.checked) {
                    // User explicitly re-defines the series: confirm, then delete+recreate
                    if (!confirm("전체 반복 일정을 덮어씌웁니다. 계속하시겠습니까?")) return;
                    await DataManager.deleteSchedulesByGroupId(editingGroupId);
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
                    const newIds = await DataManager.addSchedules(payloads);
                    payloads.forEach((p, i) => scheduleScheduleNotification({ ...p, id: newIds && newIds[i] }));
                } else {
                    // Plain edit (non-recurring) or brand new single schedule
                    if (editingScheduleId) {
                        await cancelScheduleNotification(editingScheduleId);
                        await DataManager.updateSchedule(editingScheduleId, payload);
                        scheduleScheduleNotification({ ...payload, id: editingScheduleId });
                    } else {
                        const newId = await DataManager.addSchedule(payload);
                        scheduleScheduleNotification({ ...payload, id: newId });
                    }
                }
                await DataManager.fetchSchedules();
                DataManager.updateWidgetCalendar();
                closeAddScheduleModal();
                renderCalendar();
            } catch (e) { alert("오류: " + e.message); }
        }

        async function deleteSchedule(id) {
            if (!confirm("삭제하시겠습니까?")) return;
            try {
                await DataManager.deleteSchedule(id);
                await DataManager.fetchSchedules();
                DataManager.updateWidgetCalendar();
                renderCalendar();
            } catch (e) { alert("삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."); }
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
        enableRecurrenceCheckbox.onchange = (e) => {
            recurrenceOptions.style.display = e.target.checked ? 'block' : 'none';
            // If editing a recurring instance, reflect current scope in the title
            if (editingScheduleId && editingGroupId) {
                const modalTitle = modal.querySelector('h2');
                modalTitle.textContent = e.target.checked ? "일정 수정 (반복 전체)" : "일정 수정 (이 일정만)";
            }
        };
        settingsBtn.onclick = () => settingsModal.style.display = 'flex';
        closeSettingsBtn.onclick = () => settingsModal.style.display = 'none';
        
        // Swipe handlers: registered once per page load. initializeCalendar()
        // can be re-invoked (e.g. when onAuthStateChanged fires after a native
        // sign-in), and addEventListener would otherwise stack duplicates.
        if (!window._calendarSwipeBound) {
            window._calendarSwipeBound = true;
            let touchStartX = 0, touchEndX = 0;
            calendarElement.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, {passive:true});
            calendarElement.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                if (touchEndX < touchStartX - 50) nextMonthButton.click();
                if (touchEndX > touchStartX + 50) prevMonthButton.click();
            }, {passive:true});
        }

        window.onclick = (e) => {
            if (e.target === modal) closeAddScheduleModal();
            if (e.target === listModal) closeListModal();
            if (e.target === settingsModal) settingsModal.style.display = 'none';
        };

        // Initialize
        (async () => {
            DataManager.updateWidgetCalendar(); // Sync immediately with whatever cache exists
            await loadCalendars();
            DataManager.updateWidgetCalendar();

            // Cold start deeplink: handle URL when app was launched fresh from widget tap
            if (window.Capacitor) {
                try {
                    const { App } = window.Capacitor.Plugins;
                    if (App) {
                        const launchUrlResult = await App.getLaunchUrl();
                        if (launchUrlResult && launchUrlResult.url) {
                            window.handleDeepLink(launchUrlResult.url);
                        }
                    }
                } catch (e) { /* getLaunchUrl not available on this platform */ }
            }
        })();

        // --- Deep Linking Support (Widget -> App) ---
        window.handleDeepLink = async (urlStr) => {
            try {
                const url = new URL(urlStr);
                if (url.protocol === 'chaeuda:' || url.protocol === 'vibe:') {
                    if (url.host === 'date') {
                        const dateStr = url.pathname.replace('/', ''); // format: YYYY-MM-DD
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                            const targetDate = new Date(dateStr + 'T00:00:00');
                            currentDate = targetDate;
                            renderCalendar();
                            openScheduleListModal(dateStr);
                        }
                    } else if (url.host === 'add') {
                        // Support chaeuda://add?date=YYYY-MM-DD
                        let targetDateStr = url.searchParams.get('date');
                        if (!targetDateStr) {
                             targetDateStr = CalendarUtils.formatDate(new Date());
                        }
                        
                        // Set calendar view to that month first
                        const d = new Date(targetDateStr + 'T00:00:00');
                        currentDate = d;
                        renderCalendar();
                        
                        openAddScheduleModal(targetDateStr);
                    }
                }
            } catch (e) {
                console.error("Deep Link Error:", e);
            }
        };

        // Capacitor listeners: register once per page load. Sign-in/out may
        // call initializeCalendar() again, and re-registering would stack
        // duplicate handlers so each deep link would fire N times.
        if (window.Capacitor && !window._capacitorListenersBound) {
            window._capacitorListenersBound = true;
            window.Capacitor.Plugins.App.addListener('appUrlOpen', (data) => {
                window.handleDeepLink(data.url);
            });
            window.Capacitor.Plugins.App.addListener('appStateChange', () => {
                DataManager.updateWidgetCalendar();
            });

            try {
                const { LocalNotifications } = window.Capacitor.Plugins;
                if (LocalNotifications) {
                    await LocalNotifications.requestPermissions();
                }
            } catch (e) { /* LocalNotifications not available on this platform */ }
        }
    }
});

// Hash a schedule id into a 32-bit positive integer for LocalNotifications
function notifIdFromScheduleId(id) {
    if (!id) return null;
    const seed = String(id).split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0);
    return Math.abs(seed) % 2147483647;
}

async function cancelScheduleNotification(id) {
    if (!window.Capacitor) return;
    try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        if (!LocalNotifications) return;
        const notifId = notifIdFromScheduleId(id);
        if (notifId == null) return;
        await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    } catch (e) { /* ignore */ }
}

// Schedule a local notification 30 minutes before a schedule starts
async function scheduleScheduleNotification(schedule) {
    if (!window.Capacitor) return;
    if (!schedule.id) return; // Defensive: without an id we'd collide with other schedules
    if (!schedule.start_time) return; // All-day events: don't surprise users with a 9 AM notif
    try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        if (!LocalNotifications) return;
        const { display } = await LocalNotifications.checkPermissions();
        if (display !== 'granted') return;

        const startStr = schedule.start_date + 'T' + schedule.start_time;
        const startDate = new Date(startStr);
        const notifyAt = new Date(startDate.getTime() - 30 * 60 * 1000);
        if (notifyAt <= new Date()) return;

        const notifId = notifIdFromScheduleId(schedule.id);
        if (notifId == null) return;
        await LocalNotifications.schedule({
            notifications: [{
                id: notifId,
                title: '📅 곧 일정이 시작됩니다',
                body: schedule.text + (schedule.start_time ? ' · ' + schedule.start_time : ''),
                schedule: { at: notifyAt },
                sound: 'default',
                iconColor: schedule.color || '#5DA2D5'
            }]
        });
    } catch (e) { /* Notification scheduling failed — non-critical, silently ignored */ }
}