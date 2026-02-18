# Monthly Schedule Service (Vibe Calendar)

A modern, responsive, and cross-platform monthly schedule service. This project provides a full-featured calendar with cloud synchronization, social login, and shared calendar capabilities.

## 🚀 Features

- **Multi-Calendar Support:** Create, manage, and share multiple calendars.
- **Cloud Synchronization:** Powered by Supabase for real-time data persistence across devices.
- **Social Login:** Sign in with Google or Apple (Native support for iOS).
- **Guest Mode:** Start immediately without an account; data is saved locally.
- **Sharing & Collaboration:** Invite others to your calendars via shareable links.
- **External Subscription:** Export and subscribe to your calendars via `.ics` (iCal) format.
- **Responsive Design:** Optimized for web browsers and mobile devices (iOS).
- **Schedule Management:** Add, edit, and delete events with support for recurring schedules (Daily, Weekly, Yearly).
- **Holiday Integration:** Visualizes major Korean holidays.

## 🛠 Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (ES6+).
- **Backend-as-a-Service:** Supabase (Auth, Database, Storage).
- **Mobile Framework:** Capacitor (for iOS native integration).

## 📂 Project Structure (Deployment)

The production files are located in the `docs/` directory for hosting on GitHub Pages:
- `docs/index.html`: Main application entry point.
- `docs/style.css`: Application styling.
- `docs/script.js`: Core logic and Supabase integration.
- `docs/manifest.json`: Progressive Web App (PWA) manifest.

## 📱 Mobile Support

This project includes a native iOS wrapper using Capacitor.
- Location: `ios/`
- Plugin: `SignInWithApple` for native authentication.

## 🚀 Getting Started

### Web
1. Open `docs/index.html` in a browser or serve the `docs/` folder using a static web server.
2. If you are a developer, configure your Supabase credentials in `docs/script.js`.

### iOS
1. Ensure you have Xcode installed.
2. Run `npx cap open ios` to open the project in Xcode.

## 📝 Specification

For detailed technical requirements and architecture, see [SPECIFICATION.md](./SPECIFICATION.md).