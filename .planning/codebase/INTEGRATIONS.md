# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**Glucose Monitoring (CGM):**
- Nightscout REST API - Real-time CGM glucose readings from FreeStyle Libre 2 Plus via LibreLinkUp bridge
  - SDK/Client: Native `fetch` (no SDK)
  - Base URL: `https://p01--nightscout--7x4mdclxhl6z.code.run/api/v1/entries.json`
  - Auth: Token appended as query param (`?token=...`) — hardcoded in `src/services/nightscout.ts`
  - Endpoints used:
    - `?count=1` — latest single reading (live glucose display, `fetchLatestGlucose`)
    - `?count=9000&find[date][$gte]=...` — bulk since-timestamp for rolling store (`fetchGlucosesSince`)
    - `?count=100&find[date][$gte]=...&find[date][$lte]=...` — range fetch for post-meal curves (`fetchGlucoseRange`)
  - Data format: `sgv` field in mg/dL — divided by 18 for mmol/L display
  - Poll interval: 5 minutes (driven by `HomeScreen.tsx` `setInterval`)

**AI Vision (Carb Estimation):**
- Anthropic Messages API - Vision-based carbohydrate estimation from meal photos
  - SDK/Client: Native `fetch` (no SDK)
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - Auth: `EXPO_PUBLIC_ANTHROPIC_API_KEY` from `.env` — sent as `x-api-key` header
  - Model: `claude-opus-4-6`
  - Usage: `src/services/carbEstimate.ts` — `estimateCarbsFromPhoto(photoUri)`
  - Rate limiting: 10 calls per day, tracked in AsyncStorage under key `glucolog_carb_estimate_usage`
  - Photo encoding: JPEG base64, read via `expo-file-system` legacy API before upload

## Data Storage

**Databases:**
- None — no remote database in use

**Local Storage:**
- AsyncStorage (`@react-native-async-storage/async-storage`) — all app data
  - Implementation: `src/services/storage.ts`, `src/services/settings.ts`, `src/services/carbEstimate.ts`
  - Keys in use:
    - `glucolog_meals` — `Meal[]` array
    - `glucolog_sessions` — `Session[]` array
    - `glucolog_insulin_logs` — `InsulinLog[]` array
    - `glucolog_hba1c_cache` — `Hba1cEstimate` (invalidated daily)
    - `glucolog_glucose_store` — `GlucoseStore` rolling 30-day CGM readings
    - `glucolog_settings` — `AppSettings` (carb:insulin ratio, display name, email, tablet info)
    - `glucolog_carb_estimate_usage` — daily API call counter for Anthropic rate limiting

**File Storage:**
- Local device filesystem only
- Meal photos stored at device URI returned by `expo-image-picker`
- No cloud upload — photos remain on-device

**Caching:**
- HbA1c estimate: cached daily in AsyncStorage, recomputed once per day from 30-day glucose average
- Rolling glucose store: append-only with 30-day TTL, avoids repeated bulk API fetches

## Authentication & Identity

**Auth Provider:**
- None — no authentication system implemented
- `AppSettings` has `displayName` and `email` fields stored locally in AsyncStorage
- No login, no remote account — purely local app at current phase

## Monitoring & Observability

**Error Tracking:**
- None — no error tracking service integrated

**Logs:**
- Console only — errors thrown and caught in screen components with no structured logging

## CI/CD & Deployment

**Hosting:**
- Not applicable — mobile app, distributed via device sideload or Expo Go
- No EAS (Expo Application Services) configuration detected

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- `EXPO_PUBLIC_ANTHROPIC_API_KEY` — Anthropic API key for carb estimation feature
  - Declared in `.env.example`
  - Typed in `env.d.ts`
  - Accessed in `src/services/carbEstimate.ts`

**Secrets location:**
- `.env` file (gitignored) — local development only

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None — all integrations are client-initiated request/response

---

*Integration audit: 2026-03-18*
