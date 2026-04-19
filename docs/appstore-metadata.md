# App Store Connect 메타데이터 초안

> 채우다 (Chaeuda) — `com.dangmoo.calendar`
> 최초 작성: 2026-04-19

App Store Connect에 업로드할 때 그대로 복사/붙여넣기 하도록 준비한 문서입니다.
제출 전 각 항목을 실제 빌드/스크린샷 기준으로 한 번 더 검토해주세요.

---

## 1. 기본 정보

| 항목 | 값 |
| --- | --- |
| App Name (표시명) | 채우다 |
| Subtitle (한글) | 함께 채우는 공유 캘린더 |
| Subtitle (English) | Shared calendar you fill together |
| Primary Category | Productivity |
| Secondary Category | Lifestyle |
| Age Rating | 4+ |
| Bundle ID | com.dangmoo.calendar |

---

## 2. 앱 설명 (한국어)

### Promotional Text (170자 이내)
가족, 연인, 친구와 일정을 함께 채워가는 공유 캘린더. 게스트 모드로 바로 시작하고, 필요할 때만 로그인해 동기화하세요.

### Description (4000자 이내)
**함께 채우는 공유 캘린더, 채우다**

채우다는 개인 일정과 공유 일정을 한 곳에서 관리하는 심플한 캘린더 앱입니다.
로그인 없이 바로 사용할 수 있고, 필요한 순간에만 클라우드로 동기화할 수 있어요.

■ 주요 기능
• 다중 캘린더: 개인용, 가족용, 업무용 등 여러 개의 캘린더를 만들어 색상으로 구분
• URL 초대: 링크 한 줄로 친구를 내 캘린더에 초대
• 반복 일정: 일간/주간/연간 반복 설정
• 한국 공휴일: 2025년부터 2030년까지 국내 공휴일(대체공휴일 포함) 자동 표시
• iOS 위젯: 소/중/대형 위젯으로 홈 화면에서 한 번에 확인
• 로컬 알림: 일정 30분 전 미리 알림
• 게스트 모드: 로그인 없이도 모든 기능 사용 가능 (기기 내 저장)

■ 프라이버시
• 게스트 모드에서는 어떤 데이터도 서버로 전송되지 않습니다
• 로그인 시에도 이메일과 표시 이름만 저장하며, 달력 데이터는 소유자/초대받은 멤버만 조회할 수 있도록 Firestore 보안 규칙으로 보호합니다
• 광고, 추적, 외부 분석 도구를 사용하지 않습니다

■ 누구에게 어울리나요?
• 연인, 가족 등 가까운 사람과 일정을 맞춰 보고 싶은 분
• 복잡한 기능보다 "일정을 적고 공유하기"에 집중하는 캘린더를 찾는 분
• 광고 없는 깔끔한 인터페이스를 선호하는 분

피드백과 버그 리포트는 지원 페이지를 통해 언제든 보내주세요.

### Keywords (100자 이내, 쉼표 구분)
캘린더,달력,공유,일정,가족,커플,공휴일,위젯,반복일정,게스트

### Support URL
https://choongchoongee.github.io/calendar/support.html

### Privacy Policy URL
https://choongchoongee.github.io/calendar/privacy.html

### Marketing URL (선택)
https://choongchoongee.github.io/calendar/

---

## 3. App Description (English — optional secondary locale)

### Promotional Text (170 chars)
A shared calendar for couples, families, and friends. Start instantly as a guest and sync to the cloud only when you need to.

### Description
**Chaeuda — a calendar you fill together**

Chaeuda keeps your personal and shared schedules in one place without the clutter.
Start as a guest with zero setup, and sync to the cloud only when you want to.

■ Features
• Multi-calendar: Create separate calendars for family, work, and personal — color-coded
• Share by link: Invite friends to your calendar with a single URL
• Recurring events: Daily, weekly, or yearly repetition
• Korean holidays: Accurate coverage from 2025 through 2030, including substitute holidays
• iOS widgets: Small, medium, and large widgets for a glance at your home screen
• Local notifications: Get reminded 30 minutes before each event
• Guest mode: Full functionality stays on-device, no account required

■ Privacy
• Guest mode never transmits any data off-device
• Signed-in accounts only store your email and display name; calendar data is locked down to owner and invited members via Firestore security rules
• No ads, no trackers, no third-party analytics

### Keywords
calendar,shared,schedule,family,couple,widget,holiday,recurring,guest mode

---

## 4. App Review Information

### Sign-in 필요 여부
로그인은 선택 사항입니다. 게스트 모드에서 모든 주요 기능이 동작합니다.
리뷰어를 위한 별도 계정은 제공하지 않으며, 필요 시 Apple/Google Sign-In으로 직접 생성해 테스트해주세요.

### Review Notes (영문, 필요시 복사)
Guest mode works without any account. All core features (create calendars, add events, recurring events, widgets, notifications) are available without sign-in. Cloud sync (multi-device, calendar sharing) requires Apple or Google Sign-In via Firebase Auth.

### Contact Information
- First Name: Charlie
- Last Name: (본인 성 입력)
- Email: choongchoongee@gmail.com
- Phone: (App Store Connect 제출 시 입력)

---

## 5. 개인정보 레이블 (App Privacy)

App Store Connect "App Privacy" 섹션 설문 권장 답변:

| 항목 | 선택 |
| --- | --- |
| 데이터를 수집합니까? | Yes (로그인 사용자 한정) |
| Contact Info → Email Address | Collected (App Functionality, Linked to User, Not for Tracking) |
| Contact Info → Name | Collected (App Functionality, Linked to User, Not for Tracking) *— 표시명 저장 시 해당 |
| User Content → Other User Content | Collected (App Functionality, Linked to User) *— 일정 텍스트 |
| Identifiers → User ID | Collected (App Functionality, Linked to User, Not for Tracking) *— Firebase UID |
| Tracking | No (외부 트래커 없음) |

게스트 모드에서는 위 항목 모두 기기 밖으로 나가지 않으므로, "Do you or your third-party partners collect data from this app?" 질문에 Yes로 답하되 모든 수집은 "App Functionality" 목적만 체크하세요.

---

## 6. 스크린샷 체크리스트

- [x] 1290×2796 (iPhone 6.9"/6.7" 공용) — `screenshots-appstore/` 7장 준비 완료
- [ ] 12.9" iPad (필수 아님, 등록 안 해도 무방)
- [ ] 6.5" iPhone (권장) — 필요 시 `resize_screenshots.py` 설정을 1284×2778로 바꿔 재생성

### 캡션 제안 (스크린샷 5장 기준)
1. 함께 채우는 캘린더, 채우다
2. 가족과 친구에게 링크 한 줄로 초대
3. 개인·업무·공유 캘린더를 색으로 구분
4. 반복 일정, 한국 공휴일, 로컬 알림
5. 홈 화면 위젯으로 한눈에

---

## 7. 제출 전 최종 체크

- [ ] TestFlight 빌드가 공휴일 2025-2030 전부 표시하는지 확인
- [ ] App Store Connect에 위 Description / Keywords / URLs 입력
- [ ] Privacy Labels 설정
- [ ] Age Rating 설문 (4+)
- [ ] 스크린샷 5장 업로드
- [ ] What's New in This Version 텍스트 작성 (첫 출시는 "최초 출시" 한 줄로도 OK)
- [ ] Export Compliance: `ITSAppUsesNonExemptEncryption = false` 이미 plist에 반영됨

---

## 8. URL은 실제 Pages 배포 URL로 교체 필요

위에 적힌 `choongchoongee.github.io/calendar/` 경로는 레포 이름 기반 추정입니다.
GitHub Pages 배포 실제 도메인을 한 번 확인하고 다음과 같이 정리하세요:

- Support URL → `/support.html`
- Privacy Policy URL → `/privacy.html`
- Marketing URL → `/` (루트)
