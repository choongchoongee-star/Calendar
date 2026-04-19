# 채우다 (Chaeuda) — 공유 캘린더

함께 채우는 공유 달력. 개인 및 공유 일정 관리를 위한 반응형 크로스플랫폼 캘린더 앱.

## Features

- **Multi-Calendar:** 다중 캘린더 생성/관리/공유
- **Cloud Sync:** Firebase (Firestore) 기반 클라우드 동기화
- **Social Login:** Google OAuth, Apple Sign-In (Firebase Auth)
- **Guest Mode:** 로그인 없이 바로 사용 (localStorage 기반)
- **Sharing:** URL 기반 캘린더 초대 (멤버 모델)
- **iOS Widget:** SwiftUI 위젯 소/중/대형 — 딥링크로 앱 연동 (`chaeuda://`)
- **Push Notification:** 일정 30분 전 로컬 알림
- **Recurring Events:** 일간/주간/연간 반복 일정
- **Holiday:** 한국 공휴일 표시
- **Swipe Navigation:** 좌우 스와이프로 월 이동

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (ES6+), PWA
- **Backend:** Firebase (Auth, Firestore)
- **Mobile:** Capacitor 7 (iOS)
- **Widget:** SwiftUI + WidgetKit + AppIntents
- **CI/CD:** GitHub Actions → GitHub Pages (웹) / TestFlight (iOS)

## Project Structure

```
docs/                  # 웹 앱 소스 (Capacitor webDir, GitHub Pages 배포)
├── index.html         # 메인 진입점
├── script.js          # DataManager + UI 로직
├── style.css          # 스타일
├── config.js          # Firebase 자격증명 (CI 주입)
├── privacy.html       # 개인정보 처리방침
└── manifest.json      # PWA 매니페스트

ios/App/               # iOS 네이티브
├── App/ViewController.swift      # Capacitor 브릿지 (WidgetBridge 등록)
├── App/WidgetBridge.swift        # JS↔Widget 데이터 동기화 플러그인
└── App/WidgetSource/
    └── CalendarWidget.swift      # SwiftUI 위젯 (소/중/대)

.github/workflows/
├── ios.yml            # iOS 빌드 → TestFlight
└── pages.yml          # GitHub Pages 배포
```

## Getting Started

### Web
1. `docs/config.example.js`를 `docs/config.js`로 복사하고 Firebase 자격증명 입력
2. `docs/index.html`을 브라우저에서 열거나 정적 서버로 서빙
3. 자격증명 없이도 Guest Mode로 동작

### iOS
1. `npm install`
2. `npx cap sync ios`
3. `npx cap open ios`로 Xcode에서 빌드

## Specification

상세 기획서와 데이터 모델은 [SPEC.md](./SPEC.md) 참조.
