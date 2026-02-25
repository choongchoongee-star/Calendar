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
    - **iOS builds trigger automatically** on push to the `main` branch via GitHub Actions.
    - Major feature releases should still be coordinated, but iterative UI/Web testing on `main` is now safe.

## Development Guidelines
- Always update `GEMINI.md` after adding features.
- Adhere to the `vibe://` deep linking schema.
- Ensure `WidgetBridge.setSelectedCalendar` is called whenever calendar data or auth state changes.

## 진행 기록 및 피드백

### 2026-02-25: 위젯 일정 미표시 문제 수정 및 자동화 강화
- **문제 현상:** 앱 내 일정은 정상이나 위젯(SwiftUI)에서 일정이 표시되지 않음.
- **주요 조치:**
    1.  **데이터 타입 보정:** JS 단에서 전달하는 모든 ID를 `String`으로 명시적 변환 (`docs/script.js`).
    2.  **Swift 모델 유연화:** `Schedule`, `CalendarEntity` 모델에 커스텀 디코딩을 추가하여 숫자/문자열 ID를 모두 수용 가능하도록 수정 (`CalendarWidget.swift`).
    3.  **동기화 로직 추가:** `add/update/deleteSchedule` 등 모든 데이터 변경 시 위젯 갱신 함수(`updateWidgetCalendar`) 호출 누락분 추가 (`docs/script.js`).
    4.  **로그 시스템 강화:** 위젯 브릿지와 데이터 파싱 시점에 상세 에러 로그(`WIDGET_DEBUG`)를 남겨 원인 파악 용이하도록 개선 (`WidgetBridge.swift`, `CalendarWidget.swift`).
    5.  **배포 자동화:** GitHub Actions 워크플로우를 수정하여 `main` 브랜치 푸시 시 iOS 빌드 및 TestFlight 업로드가 자동으로 실행되도록 변경 (`.github/workflows/ios.yml`).
- **결과:** 데이터 타입 안정성 확보 및 실시간 위젯 반영 로직 보강. (GitHub Actions를 통한 자동 배포 프로세스 가동)
