# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- TypeScript ~5.9.2 - All source files (`src/**`, `App.tsx`, `index.ts`)

**Secondary:**
- JavaScript - Build config only (`babel.config.js`)

## Runtime

**Environment:**
- React Native 0.81.5 — iOS and Android mobile app
- Web target also supported via `react-native-web`

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Expo ~54.0.0 - Managed workflow, build tooling, and native module access
- React 19.1.0 - UI rendering
- React Native 0.81.5 - Native mobile UI primitives

**Navigation:**
- `@react-navigation/native` ^7.1.33 - Navigation container
- `@react-navigation/native-stack` ^7.14.4 - Native stack navigator

**Build/Dev:**
- `babel-preset-expo` - Babel transpilation via `babel.config.js`
- `@expo/ngrok` ^4.1.0 - Local tunnel for device testing

## Key Dependencies

**Critical:**
- `@react-native-async-storage/async-storage` 2.2.0 - All local persistence (meals, sessions, glucose store, settings, HbA1c cache)
- `expo-image-picker` ~17.0.10 - Camera and photo library access for meal photos
- `expo-file-system` ~19.0.21 - Reading photo files as base64 for Anthropic API upload
- `react-native-safe-area-context` ~5.6.0 - Safe area insets (used in `SafeAreaProvider` in `App.tsx`)
- `react-native-screens` ~4.4.0 - Native screen optimisation for React Navigation

**Web:**
- `react-native-web` ^0.21.2 - Web target compilation

**Environment:**
- `react-native-dotenv` ^3.4.11 - Exposes `.env` values via `process.env.EXPO_PUBLIC_*`

## Configuration

**Environment:**
- `.env` file present — contains `EXPO_PUBLIC_ANTHROPIC_API_KEY`
- `.env.example` documents the required key
- `env.d.ts` provides TypeScript types for `process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY`
- Anthropic API key accessed in `src/services/carbEstimate.ts` via `process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY`

**Build:**
- `babel.config.js` — single preset: `babel-preset-expo`
- `tsconfig.json` — extends `expo/tsconfig.base`, strict mode enabled
- `app.json` — Expo app config: slug `glucolog`, portrait orientation, light UI style, Android adaptive icon configured

## Platform Requirements

**Development:**
- Node.js (version not pinned — no `.nvmrc`)
- Expo CLI (`expo start`, `expo start --android`, `expo start --ios`, `expo start --web`)
- Expo Go app or physical device for testing

**Production:**
- Target platforms: iOS, Android, Web
- iOS: tablet supported (`supportsTablet: true`)
- Android: adaptive icon configured, predictive back gesture disabled
- No EAS build configuration detected — local/Expo Go builds only at this stage

---

*Stack analysis: 2026-03-18*
