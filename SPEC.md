# Monthly Schedule Service (Calendar) — 기획서

> 마지막 업데이트: 2026-03-21
> 현재 Phase: Phase 2 완료 / Phase 3 진행 중

---

## 1. Overview

- **목적:** 개인 및 공유 일정 관리를 위한 반응형 크로스플랫폼 캘린더 앱
- **핵심 제약사항:** 정적 호스팅 (GitHub Pages), iOS Capacitor 래퍼, Supabase 백엔드
- **기술 스택:** Vanilla JS (ES6+) + Capacitor + Supabase + iOS WidgetKit
- **주요 사용자:** Charlie + 공유 달력 구성원

---

## 2. 아키텍처

### 폴더 구조
```
Calendar/
├── docs/                    # 웹 앱 소스 (Capacitor webDir)
│   ├── script.js            # 핵심 DataManager & UI 로직
│   └── index.html           # 메인 진입점 + 모달 정의
├── ios/App/
│   ├── App/WidgetBridge.swift          # Capacitor 커스텀 플러그인
│   ├── App/ViewController.swift        # CAPBridgeViewController 서브클래스
│   └── App/WidgetSource/
│       └── CalendarWidget.swift        # SwiftUI 위젯
└── add_widget_target.rb     # Xcode 타겟 자동 구성 (GitHub Actions용)
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
- Supabase (Auth, PostgreSQL DB, Storage)
- Apple Sign-In (iOS: Capacitor 플러그인, Web: OAuth 폴백)
- GitHub Actions (iOS 빌드 자동화 → TestFlight)
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
- **Guest Mode:** localStorage 기반, 디바이스 로컬 저장, 공유 불가
- **Google OAuth:** 웹 리다이렉션 플로우
- **Apple Sign-In:** iOS 네이티브 플러그인, 웹 폴백
- **세션:** 자동 갱신, OAuth 리다이렉트 해시 파싱
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

### 🚧 Phase 3 — iOS 위젯
- [x] SwiftUI 위젯 (소/중/대형)
- [x] WidgetBridge Capacitor 플러그인
- [x] GitHub Actions iOS 자동 빌드 (macos-16 / Xcode 26)
- [x] 위젯 딥링크 JS 수신 (`vibe://date/...`, cold start 포함)

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

---

## 8. 미완료 / 알려진 이슈

- [x] 위젯 딥링크 JS 수신 완료 — cold start (`getLaunchUrl`) + foreground (`appUrlOpen`) (2026-03-21)
- [x] Supabase 자격증명 환경변수 이전 완료 — config.js CI 주입, redirectURI·ICS URL 동적화 (2026-03-21)
- [x] ITMS-90725: iOS 26 SDK / Xcode 26 — macos-16 러너로 전환 (2026-03-21)
- [x] 빌드 환경: GitHub Actions macOS 러너 macos-15 → macos-16 업그레이드 완료
