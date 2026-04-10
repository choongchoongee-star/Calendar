# 채우다 (Chaeuda) — Calendar 기획서

> 마지막 업데이트: 2026-04-10
> 현재 Phase: Phase 3 완료 (iOS 위젯 + 딥링크 + 알림)

---

## 1. Overview

- **앱 이름:** 채우다 (Chaeuda) — App ID: `com.dangmoo.calendar`
- **목적:** 개인 및 공유 일정 관리를 위한 반응형 크로스플랫폼 캘린더 앱
- **핵심 제약사항:** 정적 호스팅 (GitHub Pages), iOS Capacitor 래퍼, Supabase 백엔드
- **기술 스택:** Vanilla JS (ES6+) + Capacitor 7 + Supabase + iOS WidgetKit + SwiftUI
- **주요 사용자:** Charlie + 공유 달력 구성원

---

## 2. 아키텍처

### 폴더 구조
```
Calendar/
├── docs/                    # 웹 앱 소스 (Capacitor webDir)
│   ├── index.html           # 메인 진입점 + 모달 정의
│   ├── script.js            # 핵심 DataManager & UI 로직 (~1,470줄)
│   ├── style.css            # 전체 스타일
│   ├── config.js            # Supabase 자격증명 (CI 주입, 커밋 안 함)
│   ├── config.example.js    # 설정 예시
│   ├── privacy.html         # 개인정보 처리방침
│   └── manifest.json        # PWA 매니페스트
├── ios/App/
│   ├── App/ViewController.swift        # CAPBridgeViewController (WidgetBridge 등록)
│   ├── App/WidgetBridge.swift          # Capacitor 커스텀 플러그인 (JS↔Widget 브릿지)
│   └── App/WidgetSource/
│       └── CalendarWidget.swift        # SwiftUI 위젯 (소/중/대, ~640줄)
├── .github/workflows/
│   ├── ios.yml              # iOS 빌드 → TestFlight 업로드
│   └── pages.yml            # GitHub Pages 배포
├── add_widget_target.rb     # Xcode 타겟 자동 구성 (GitHub Actions용)
└── capacitor.config.json    # Capacitor 설정 (webDir: docs)
```

### 핵심 데이터 흐름
```
웹 앱 (JS)
  → Supabase Client (Auth + DB)
  → updateWidgetCalendar() 호출
  → WidgetBridge.setSelectedCalendar()
  → SharedUserDefaults (group.com.dangmoo.calendar)
  → CalendarWidget.swift 타임라인 갱신
```

### 외부 의존성
- Supabase (Auth, PostgreSQL DB, Storage) — CDN으로 JS SDK 로드
- Apple Sign-In (iOS: `@capacitor-community/apple-sign-in` 플러그인, Web: OAuth 폴백)
- `@capacitor/local-notifications` — 일정 알림
- `@capacitor/app` — 딥링크 수신, 앱 상태 변경 감지
- GitHub Actions (iOS 빌드 자동화 → TestFlight, Pages 배포)
- App Group: `group.com.dangmoo.calendar`

---

## 3. 데이터 모델

### Supabase 테이블

#### calendars
| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | Primary Key |
| `title` | string | 달력 이름 |
| `owner_id` | UUID | FK → auth.users |
| `created_at` | timestamp | 생성 시각 |

#### schedules
| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | Primary Key |
| `calendar_id` | UUID | FK → calendars |
| `text` | string | 일정 제목 |
| `start_date` | date | YYYY-MM-DD |
| `end_date` | date | YYYY-MM-DD |
| `start_time` | time | HH:mm (선택) |
| `end_time` | time | HH:mm (선택) |
| `color` | string | Hex 색상 코드 |
| `group_id` | string | 반복 일정 그룹 ID |

#### calendar_members
| 필드 | 타입 | 설명 |
|------|------|------|
| `calendar_id` | UUID | FK → calendars |
| `user_id` | UUID | FK → auth.users |
| `role` | string | 'editor' / 'viewer' |

### LocalStorage (Guest Mode)
- `isGuest`: boolean
- `guest_calendars`: JSON array
- `guest_schedules`: JSON array

---

## 4. 기능 명세

### 4.1 인증
- **Guest Mode:** localStorage 기반, 디바이스 로컬 저장, 공유 불가, 미로그인 시 자동 진입
- **Google OAuth:** 웹 리다이렉션 플로우 (implicit flow)
- **Apple Sign-In:** iOS 네이티브 플러그인 (nonce+idToken), 웹 폴백
- **세션:** 자동 갱신, OAuth 리다이렉트 해시 파싱, PKCE 리다이렉트 감지
- **계정 탈퇴:** 소유 캘린더 전체 삭제 후 로그아웃 (Guest는 localStorage 초기화)
- **구현 상태:** ✅ 완료

### 4.2 달력 관리 (CRUD)
- 다중 달력 지원 (생성/이름 변경/삭제)
- 초대 시스템: URL 기반 (`?invite_calendar_id=...`)
- 공개 구독: Supabase Storage에 `.ics` 자동 생성/갱신
- **구현 상태:** ✅ 완료

### 4.3 일정 관리 (CRUD)
- 속성: 제목, 날짜 범위, 시간 범위(선택), 색상
- 반복: 일간 / 주간 / 연간 (`group_id` 기반)
- 단일 삭제 / 전체 시리즈 삭제
- **구현 상태:** ✅ 완료

### 4.4 iOS 위젯
- **소형 (1×1):** 오늘 날짜 + 최대 3개 일정
- **중형 (2×1):** 현재 주 (일~토) + 일별 일정 목록
- **대형 (2×2):** 전체 월 그리드 + 날짜별 일정 점+제목
- 인터랙션: 전/다음 월 이동 (`ChangeMonthIntent`), 날짜 탭 딥링크
- 딥링크 스키마: `vibe://date/YYYY-MM-DD`, `vibe://add?date=...`
- 공휴일: 한국 공휴일 하드코딩 (빨간색 표시)
- **구현 상태:** ✅ 완료

### 4.5 위젯 딥링크 JS 수신
- `vibe://date/YYYY-MM-DD` 탭 시 앱 내 해당 날짜로 자동 이동
- `vibe://add?date=YYYY-MM-DD` 탭 시 해당 날짜로 일정 추가 모달 열기
- Foreground: `appUrlOpen` 이벤트로 수신
- Cold start: `App.getLaunchUrl()`로 수신 (loadCalendars 완료 후 처리)
- **구현 상태:** ✅ 완료

### 4.6 로컬 알림
- 일정 시작 30분 전 푸시 알림 (`@capacitor/local-notifications`)
- 시간 미지정 일정: 당일 09:00 기준
- 과거 일정(이미 지난 시간)은 알림 스킵
- 알림 ID: 일정 ID의 해시값 (Int32 범위)
- **구현 상태:** ✅ 완료

### 4.7 스와이프 네비게이션
- 캘린더 영역에서 좌/우 스와이프로 월 이동 (50px 임계값)
- `touchstart`/`touchend` passive 리스너
- **구현 상태:** ✅ 완료

---

## 5. API 명세

| 기능 | 방식 | 설명 |
|------|------|------|
| 달력 조회 | Supabase Client SDK | RLS로 소유/멤버 달력만 반환 |
| 일정 CRUD | Supabase Client SDK | RLS 적용 |
| `.ics` 업로드 | Supabase Storage | 공개 구독용 |
| 위젯 동기화 | WidgetBridge Capacitor Plugin | SharedUserDefaults 경유 |

### Widget SharedUserDefaults 키
| 키 | 설명 |
|----|------|
| `selectedCalendarId` | 현재 활성 달력 UUID |
| `supabaseAuthToken` | JWT (RLS 인증용) |
| `allCalendars` | 달력 메타데이터 목록 |
| `widgetMonthOffset` | 위젯 월 이동 오프셋 |

---

## 6. Phase 계획

### ✅ Phase 1 — Guest Mode + 기본 캘린더
- [x] Guest Mode (localStorage 기반)
- [x] 달력 CRUD
- [x] 일정 CRUD (단일/반복)
- [x] 월간 그리드 UI

### ✅ Phase 2 — 클라우드 + 공유
- [x] Google / Apple 인증
- [x] Supabase 동기화
- [x] 달력 초대 시스템
- [x] `.ics` 공개 구독

### ✅ Phase 3 — iOS 위젯 + 앱 완성
- [x] SwiftUI 위젯 (소/중/대형) — 동적 행 높이, 오버플로 표시기
- [x] WidgetBridge Capacitor 플러그인 (UserDefaults + 파일 백업 이중 동기화)
- [x] GitHub Actions iOS 자동 빌드 (macos-15 러너, Xcode 26 시도 → 최신 가용 버전 폴백)
- [x] 위젯 딥링크 JS 수신 (`vibe://date/...`, `vibe://add?date=...`, cold start 포함)
- [x] 로컬 푸시 알림 (일정 30분 전)
- [x] App Store 출시 준비 (Privacy Manifest, arm64, 개인정보 처리방침)
- [x] 보안/QA 유지보수 (10건 중 8건 자동 수정 완료)

---

## 7. App Store 출시 체크리스트

### ✅ 코드로 완료
- [x] `PrivacyInfo.xcprivacy` 생성 (UserDefaults CA92.1, FileTimestamp C617.1)
- [x] `add_widget_target.rb`에서 Privacy Manifest를 App 타겟에 자동 등록
- [x] `UIRequiredDeviceCapabilities`: armv7 → arm64
- [x] `docs/privacy.html` 개인정보 처리방침 페이지
- [x] `ITSAppUsesNonExemptEncryption = false`
- [x] Sign in with Apple 구현 (Google 로그인 제공 시 필수)
- [x] TestFlight 업로드 파이프라인

### 🙋 직접 해야 하는 작업 (App Store Connect)
- [ ] **스크린샷** — iPhone 6.7인치 필수, 6.5인치 권장 (시뮬레이터로 촬영 가능)
- [ ] **앱 설명·키워드** 작성 (한국어, 영어)
- [ ] **Privacy Policy URL** 등록 — GitHub Pages 배포 후 `docs/privacy.html` URL 입력
- [ ] **개인정보 레이블** 선택 (이메일, 사용자 ID → App Functionality)
- [ ] **연령 등급** 설문 (캘린더 앱 → 4+)
- [ ] **지원 URL** 등록 (GitHub Pages 또는 이메일 페이지)
- [ ] **카테고리** 선택: Productivity

---

## 8. Out of Scope

- 복잡한 동시 편집 충돌 해결
- 오프라인 모드 (로그인 사용자 기준)
- 계정의 auth.users 완전 삭제 (Edge Function 필요)

---

## 9. 알려진 이슈 / 잔여 작업

### 해결 완료
- [x] 위젯 딥링크 JS 수신 — cold start + foreground (2026-03-21)
- [x] Supabase 자격증명 환경변수 이전 — config.js CI 주입 (2026-03-21)
- [x] ITMS-90725: iOS SDK 이슈 — 러너 Xcode 버전 폴백 로직 적용
- [x] 보안: 위젯 동기화/OAuth 에러 메시지 사용자 노출 → 일반 메시지로 교체
- [x] QA: JSON.parse 미보호, 중복 가드, 삭제 에러 핸들링 수정
- [x] 폴리시: HTML lang="en"→"ko", 체크마크 "(V)"→"✓", console.log 제거

### 미해결 (human review 필요)
- [ ] **Supabase 클라이언트 null 시 앱 초기화 차단** — `if (!DataManager.client) { return; }` (script.js:750)가 guest mode 폴백까지 건너뜀. 프로덕션에서는 Supabase가 항상 주입되므로 현재 영향 없으나, 로컬 개발 시 빈 화면 문제 발생. 구조적 리팩터링 필요.
- [ ] **공휴일 데이터 2026년 하드코딩** — script.js `getHolidaysForWeek()`와 CalendarWidget.swift `holidayData`가 모두 2026년만 포함. 2027년부터 공휴일 미표시. 음력 공휴일(설날/추석/석가탄신일)은 API 또는 멀티년 테이블 필요.

---

## 10. 유지보수 기록

- **2026-04-10:** 보안 점검 — git 이력에서 .p8 프라이빗 키 완전 삭제, 민감 파일 7개 추적 해제, .gitignore 보강
- **2026-04-04:** 자동 유지보수 실행 — 10건 점검, 8건 자동 수정, 2건 human review 보류 (상세: `maintenance_report.md`)
- **2026-03 중순:** Phase 3 기능 완성 (위젯, 딥링크, 알림, App Store 준비)
