# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
bolusbrain-app/
├── index.ts                    # Expo entry point — registers root component
├── App.tsx                     # NavigationContainer, Stack, RootStackParamList export
├── app.json                    # Expo app config (name, slug, icons, splash)
├── babel.config.js             # Babel config (expo preset)
├── tsconfig.json               # TypeScript config (extends expo/tsconfig.base, strict: true)
├── env.d.ts                    # Type declarations for EXPO_PUBLIC_* env vars
├── package.json                # Dependencies and scripts
├── .env                        # Environment variables (not committed) — API keys
├── .env.example                # Example env structure (committed)
├── assets/                     # Static assets (app icon, splash image)
├── src/
│   ├── components/             # Reusable presentational UI
│   │   └── GlucoseDisplay.tsx
│   ├── screens/                # Full-screen views (one per route)
│   │   ├── HomeScreen.tsx
│   │   ├── MealLogScreen.tsx
│   │   ├── MealHistoryScreen.tsx
│   │   ├── InsulinLogScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── AccountScreen.tsx
│   │   └── HelpScreen.tsx
│   └── services/               # I/O layer — API and AsyncStorage
│       ├── nightscout.ts       # Nightscout API client
│       ├── storage.ts          # All AsyncStorage read/write + curve computation
│       ├── carbEstimate.ts     # Anthropic vision API + daily rate limiting
│       ├── matching.ts         # Jaccard session similarity engine
│       └── settings.ts         # App settings (carb ratio, tablet info, account)
├── .planning/                  # GSD planning docs (committed)
│   └── codebase/
├── .claude/                    # Claude Code commands and skills
└── node_modules/               # Dependencies (not committed)
```

## Directory Purposes

**`src/components/`:**
- Purpose: Reusable UI components with no side effects
- Contains: Presentational components that accept typed props
- Key files: `GlucoseDisplay.tsx` — renders colour-coded mmol/L value + trend arrow + age

**`src/screens/`:**
- Purpose: One file per navigation route; owns local state and orchestrates service calls
- Contains: Default-exported React components used directly by `App.tsx` Stack navigator
- Key files:
  - `HomeScreen.tsx` — main dashboard, polling, quick log modal, navigation hub
  - `MealLogScreen.tsx` — photo capture, AI carb estimate, meal + insulin form
  - `MealHistoryScreen.tsx` — chronological list of meals and insulin logs with curve cards
  - `InsulinLogScreen.tsx` — single-field form for long-acting / correction / tablets
  - `SettingsScreen.tsx` — carb:insulin ratio, tablet info, nav to Account + Help

**`src/services/`:**
- Purpose: All external communication and local persistence; no React imports
- Contains: Pure async TypeScript functions and exported types/interfaces
- Key files:
  - `storage.ts` — the central data layer; all `AsyncStorage` keys, `Meal`, `Session`, `InsulinLog`, `GlucoseStore`, `GlucoseResponse`, `Hba1cEstimate` types and their read/write functions
  - `nightscout.ts` — Nightscout API wrapper; `fetchLatestGlucose()`, `fetchGlucosesSince()`, `fetchGlucoseRange()`; performs mg/dL → mmol/L conversion
  - `carbEstimate.ts` — Anthropic Claude vision API call, base64 photo encoding, daily rate limit
  - `matching.ts` — `findSimilarSessions()` with Jaccard + insulin similarity scoring
  - `settings.ts` — `AppSettings` type, `loadSettings()`, `saveSettings()`

**`assets/`:**
- Purpose: Static image assets for Expo
- Contains: App icon, splash screen image
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: By Claude Code GSD commands
- Committed: Yes

## Key File Locations

**Entry Points:**
- `index.ts`: Expo root — calls `registerRootComponent(App)`
- `App.tsx`: Navigation root — defines all routes and `RootStackParamList`

**Configuration:**
- `app.json`: Expo app metadata, bundle identifier, icon paths
- `tsconfig.json`: TypeScript config (strict mode on)
- `babel.config.js`: Expo Babel preset
- `.env`: `EXPO_PUBLIC_ANTHROPIC_API_KEY` (required for carb estimate feature)
- `env.d.ts`: Type declaration for `EXPO_PUBLIC_ANTHROPIC_API_KEY`

**Core Data Logic:**
- `src/services/storage.ts`: All persistence; the single source of truth for data structures
- `src/services/nightscout.ts`: CGM API boundary; only file that handles mg/dL

**Navigation Types:**
- `App.tsx`: Exports `RootStackParamList` — import this for typed navigation in screens

## Naming Conventions

**Files:**
- Screens: `PascalCase` + `Screen` suffix — e.g. `HomeScreen.tsx`, `MealLogScreen.tsx`
- Components: `PascalCase` — e.g. `GlucoseDisplay.tsx`
- Services: `camelCase` — e.g. `carbEstimate.ts`, `nightscout.ts`, `storage.ts`

**Directories:**
- Lowercase plural: `screens/`, `components/`, `services/`

**Functions:**
- Service functions: `camelCase` verb-noun — e.g. `fetchLatestGlucose`, `saveMeal`, `loadInsulinLogs`, `updateGlucoseStore`
- Screen handlers: `handle` prefix for user-triggered actions — e.g. `handleSave`, `handleCamera`, `handleEstimateCarbs`
- Private/internal storage helpers: `_` prefix or `Raw` suffix — e.g. `loadMealsRaw`, `saveMealsRaw`, `_fetchCurveForSession`

**Interfaces/Types:**
- Data entities: `PascalCase` — e.g. `Meal`, `Session`, `InsulinLog`, `GlucoseResponse`, `BasalCurve`
- Extended joins: `WithMeals` suffix — e.g. `SessionWithMeals`
- Union string types: `PascalCase` + `Type` suffix — e.g. `InsulinLogType`, `SessionConfidence`

**AsyncStorage Keys:**
- All prefixed `glucolog_` — e.g. `glucolog_meals`, `glucolog_sessions`, `glucolog_insulin_logs`, `glucolog_glucose_store`, `glucolog_hba1c_cache`

## Where to Add New Code

**New Screen:**
- Implementation: `src/screens/NewFeatureScreen.tsx` (default export)
- Register in: `App.tsx` — add to `RootStackParamList` type and `Stack.Navigator`

**New Reusable UI Component:**
- Implementation: `src/components/ComponentName.tsx`
- Pattern: Accept typed props interface, no async calls, no navigation

**New Service (API or storage):**
- Implementation: `src/services/featureName.ts`
- Pattern: Pure async functions with named exports; types exported alongside functions
- New `AsyncStorage` keys: prefix with `glucolog_` and declare as a `const` at top of file

**New Data Type/Entity:**
- Define interface in `src/services/storage.ts` alongside its read/write functions
- Exception: Types tied to a single external API belong in that service file (e.g. `TrendDirection` in `nightscout.ts`)

**New Navigation Route:**
1. Add key to `RootStackParamList` in `App.tsx`
2. Add `<Stack.Screen>` entry in `App.tsx`
3. Create screen file in `src/screens/`

## Special Directories

**`.planning/`:**
- Purpose: GSD codebase analysis and phase planning docs
- Generated: Yes (by Claude Code)
- Committed: Yes

**`.claude/`:**
- Purpose: Claude Code custom commands and GSD skill configs
- Generated: Partially
- Committed: Yes

**`node_modules/`:**
- Purpose: npm package dependencies
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-03-18*
