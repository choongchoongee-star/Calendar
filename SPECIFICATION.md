# Monthly Schedule Service - Product Specification

**Last Updated:** 2026-02-12
**Status:** Active / In Development

## 1. Project Overview
The **Monthly Schedule Service** is a responsive, cross-platform calendar application designed for personal and shared schedule management. It seamlessly transitions between a lightweight local-only tool (Guest Mode) and a fully synchronized cloud application (Supabase Mode). The project targets both web browsers and iOS devices (via Capacitor).

## 2. Technical Architecture

### 2.1 Technology Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Backend:** Supabase
    - **Database:** PostgreSQL.
    - **Authentication:** Supabase Auth.
    - **Storage:** Supabase Storage (for `.ics` export).
- **Mobile Wrapper:** Capacitor (specifically targeting iOS).
- **Hosting:** Static Web Hosting (e.g., GitHub Pages).

### 2.2 Integration Points
- **Supabase Client:** Handles direct DB connections and Auth.
- **Apple Sign-In:** Native plugin integration for iOS, web fallback.
- **LocalStorage:** Persists data for Guest Mode and caches user preferences.

## 3. Functional Requirements

### 3.1 Authentication & User Accounts
- **Guest Mode:**
    - Allows immediate usage without account creation.
    - Data is stored locally in the browser/device `localStorage`.
    - Cannot share calendars or sync across devices.
- **Supabase Login:**
    - **Google OAuth:** Standard web redirection flow.
    - **Apple Sign-In:** Uses Capacitor native plugin on iOS for seamless experience, falls back to OAuth on web.
- **Session Management:**
    - Persistent sessions with auto-refresh.
    - Handling of OAuth redirects (hash parsing).
- **Account Controls:**
    - **Logout:** Clears session and local state.
    - **Delete Account:** Cascading deletion of user's calendars and schedules from the database.

### 3.2 Calendar Management
- **Multi-Calendar Support:** Users can own and manage multiple distinct calendars.
- **CRUD Operations:**
    - **Create:** Initialize new calendars with a custom title.
    - **Read:** List all calendars the user owns or has joined.
    - **Update:** Rename calendars.
    - **Delete:** Owners can permanently delete calendars; Members can "leave" shared calendars.
- **Sharing & Collaboration:**
    - **Invite System:** URL-based invites (`?invite_calendar_id=...`) allow other logged-in users to join a calendar as editors.
    - **Public Subscription:** Auto-generates and updates an `.ics` file in Supabase Storage for external subscription (e.g., in Outlook/Google Calendar).

### 3.3 Schedule Management
- **Event Attributes:**
    - Title (`text`)
    - Date Range (`start_date` to `end_date`)
    - Time Range (`start_time` to `end_time`) - Optional
    - Color Coding (Selection from preset palette)
- **Recurrence:**
    - Support for **Daily**, **Weekly**, and **Yearly** repetition.
    - Recurring events are linked via a `group_id`.
- **CRUD Operations:**
    - **Create:** Single or recurring events.
    - **Update:** Modify details. (Logic handles single vs. series updates implicitly via group checks).
    - **Delete:** Remove single event or entire recurring series.
- **Sync:** Changes trigger an update to the public `.ics` file in cloud storage.

### 3.4 User Interface (UI)
- **Calendar View:**
    - Full-month grid layout.
    - Visual "bars" for multi-day events.
    - Responsive handling (stacking bars, overflowing events).
    - Holiday Integration: Hardcoded display of major Korean holidays.
- **Navigation:**
    - Year/Month dropdown selectors.
    - Previous/Next month buttons.
    - **Touch Gestures:** Swipe left/right to change months on mobile.
- **Side Drawer:**
    - Lists available calendars.
    - Controls for adding calendars and accessing settings.
- **Modals:**
    - **Daily List:** Detailed view of all events for a clicked date.
    - **Add/Edit:** Form with date/time pickers and recurrence options.
    - **Settings:** User profile, login methods, and app info.

## 4. Data Model (Schema)

### 4.1 Supabase Tables
*Inferred from client-side logic:*

| Table Name | Column | Type | Description |
| :--- | :--- | :--- | :--- |
| **calendars** | `id` | UUID/String | Primary Key |
| | `title` | String | Display name of the calendar |
| | `owner_id` | UUID | Foreign Key to `auth.users` |
| | `created_at` | Timestamp | Creation time |
| **schedules** | `id` | UUID/String | Primary Key |
| | `calendar_id` | UUID | Foreign Key to `calendars` |
| | `text` | String | Event title |
| | `start_date` | Date/String | ISO Date (YYYY-MM-DD) |
| | `end_date` | Date/String | ISO Date (YYYY-MM-DD) |
| | `start_time` | Time/String | HH:mm (Optional) |
| | `end_time` | Time/String | HH:mm (Optional) |
| | `color` | String | Hex color code |
| | `group_id` | String | ID for grouping recurring events |
| **calendar_members** | `calendar_id` | UUID | FK to `calendars` |
| | `user_id` | UUID | FK to `auth.users` |
| | `role` | String | e.g., 'editor', 'viewer' |

### 4.2 LocalStorage Keys (Guest Mode)
- `isGuest`: Boolean flag.
- `guest_calendars`: JSON array of calendar objects.
- `guest_schedules`: JSON array of schedule objects.

## 5. Security & Configuration
- **Supabase Credentials:** Currently stored in `script.js` (Note: Should be moved to environment variables or secured via RLS policies in production).
- **RLS (Row Level Security):** Database policies must enforce that users can only access calendars they own or are members of.

## 6. Known Issues / To-Do
- **Hardcoded Credentials:** API keys are visible in client code.
- **Conflict Resolution:** No complex merging strategy for simultaneous edits.
- **Offline Support:** Limited to Guest Mode; logged-in users require connection.
- **Widget Deep Linking:** Add JavaScript listener to handle `vibe://date/YYYY-MM-DD` URLs from the widget to auto-open specific dates.
- **SDK Compliance (ITMS-90725):** Update build environment to iOS 26 SDK / Xcode 26 before April 28, 2026.
