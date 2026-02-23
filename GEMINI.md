# Monthly Schedule Service (Calendar) - Developer Guide

This file serves as the primary technical reference for Gemini CLI.

## Project Overview
A responsive, cross-platform calendar application built with Vanilla JS, HTML5, and CSS3, wrapped in Capacitor for iOS. It supports both local-first (Guest) and cloud-synced (Supabase) modes.

## Technical Stack
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Backend:** Supabase (Auth, DB, Storage).
- **Mobile:** Capacitor (iOS Target).
- **Widget:** iOS WidgetKit (SwiftUI) with App Intents.
- **App Group:** `group.com.dangmoo.calendar` (Shared data between App and Widget).

## Key Features & Deep Links
- **Guest Mode:** 
    - Auto-enabled on initial access if no user session is detected.
    - LocalStorage-based persistence (`isGuest`, `guest_calendars`, `guest_schedules`).
    - UI elements for Logout and Account Deletion are hidden in this mode.
- **Supabase Mode:** Real-time sync, Google/Apple Auth.
- **Recurrence:** Daily, Weekly, Yearly (grouped via `group_id`).
- **iOS Widget:**
    - Displays current month with interactive navigation (App Intents).
    - Supports deep links:
        - `vibe://date/YYYY-MM-DD`: Opens the app to a specific date.
        - `vibe://add`: Opens the add schedule modal.
    - Syncs via `WidgetBridge` Capacitor plugin.

## Project Structure
- `docs/`: Web application source (PWA/Capacitor web dir).
    - `script.js`: Core DataManager and UI logic.
    - `index.html`: Main entry and modal definitions.
- `ios/`: Native iOS project.
    - `App/App/WidgetBridge.swift`: Custom Capacitor plugin for Widget sync.
    - `App/App/WidgetSource/CalendarWidget.swift`: SwiftUI Widget code.
- `add_widget_target.rb`: Ruby script to automate Xcode target configuration for the widget.
- `fix-plugin.js`: Post-install patch for `@capacitor-community/apple-sign-in`.

## Critical Logic: Widget Synchronization
The App communicates with the Widget by saving JSON data to the shared `UserDefaults` suite `group.com.dangmoo.calendar`:
- `selectedCalendarId`: Current active calendar UUID.
- `supabaseAuthToken`: JWT for RLS bypass/authentication.
- `allCalendars`: List of metadata for calendar selection.
- `widgetMonthOffset`: Tracks month navigation in the widget.

## Maintenance & Build
- **Xcode SDK Requirement:** Must target iOS 26 SDK / Xcode 26 by April 2026.
- **Manual Signing:** Development Team `XLFLVNJU9Q`.
- **Provisioning:**
    - App: `Calendar`
    - Widget: `Dangmoo Calendar Widget`
- **Git & Build Policy (CRITICAL):**
    - **`git push` to `main` is allowed** for testing on GitHub Pages.
    - **iOS builds will NOT trigger automatically** on push. This is to avoid exceeding Apple/GitHub push limits.
    - To start an iOS build and upload to TestFlight, you must manually trigger the **"Build iOS App"** workflow from the GitHub Actions tab.
    - Major feature releases should still be coordinated, but iterative UI/Web testing on `main` is now safe.

## Development Guidelines
- Always update `GEMINI.md` after adding features.
- Adhere to the `vibe://` deep linking schema.
- Ensure `WidgetBridge.setSelectedCalendar` is called whenever calendar data or auth state changes.
