# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Feature-layered React Native single-page app with a service/screen split

**Key Characteristics:**
- No global state manager — each screen owns its own `useState` and fetches data on mount/focus
- All persistence via `AsyncStorage` (device-local only — no backend as of current build)
- Services are pure async functions, not classes; no dependency injection
- Navigation is stack-based with typed params defined in `App.tsx`

## Layers

**Navigation Shell:**
- Purpose: Declares all routes, wraps app in `SafeAreaProvider` + `NavigationContainer`
- Location: `App.tsx`
- Contains: `RootStackParamList` type export, `Stack.Navigator` with 7 screens
- Depends on: All screen components, `InsulinLogType` from storage
- Used by: `index.ts` (Expo entry point)

**Screens:**
- Purpose: View + local state + orchestration of service calls
- Location: `src/screens/`
- Contains: `HomeScreen.tsx`, `MealLogScreen.tsx`, `MealHistoryScreen.tsx`, `InsulinLogScreen.tsx`, `SettingsScreen.tsx`, `AccountScreen.tsx`, `HelpScreen.tsx`
- Depends on: Services layer, components layer, React Navigation hooks
- Used by: Navigation shell (`App.tsx`)

**Components:**
- Purpose: Reusable presentational UI with no side effects
- Location: `src/components/`
- Contains: `GlucoseDisplay.tsx` (the only component currently)
- Depends on: `GlucoseReading` and `trendArrow` from `src/services/nightscout.ts`
- Used by: `HomeScreen.tsx`

**Services:**
- Purpose: All I/O — API calls and local storage read/write
- Location: `src/services/`
- Contains: `nightscout.ts`, `storage.ts`, `carbEstimate.ts`, `matching.ts`, `settings.ts`
- Depends on: `AsyncStorage`, `expo-file-system`, Nightscout API, Anthropic API
- Used by: Screens (never by other components)

## Data Flow

**Live Glucose Display (HomeScreen polling):**

1. `HomeScreen` mounts → calls `loadData()`
2. `loadGlucoseStore()` reads `AsyncStorage` to get `lastFetchedAt`
3. `fetchLatestGlucose()` and `fetchGlucosesSince(fromMs)` run in parallel
4. `updateGlucoseStore(newEntries)` merges new readings into local rolling store, returns `avg12h`/`avg30d`
5. HbA1c checked: `loadCachedHba1c()` returns today's cache or triggers `computeAndCacheHba1c(avg30d)`
6. `setReading`, `setAvg12h`, `setHba1c` update screen state
7. `setInterval` repeats every 5 minutes

**Meal Logging Flow:**

1. User fills form in `MealLogScreen.tsx` (optional photo + AI carb estimate, meal name, insulin units)
2. `handleSave()` calls `fetchLatestGlucose()` to capture `startGlucose`
3. `saveMeal()` in `storage.ts` persists the meal and assigns/creates a `Session` (3-hour grouping window)
4. `fetchAndStoreCurve(meal.id)` is called fire-and-forget — fetches 3hr glucose range from Nightscout and writes `GlucoseResponse` onto the meal in `AsyncStorage`

**AI Carb Estimation (within MealLogScreen):**

1. User taps "Estimate carbs with AI"
2. `estimateCarbsFromPhoto(photoUri)` in `carbEstimate.ts` reads photo as base64 via `expo-file-system`
3. POST to `https://api.anthropic.com/v1/messages` with image + UK nutritional standards prompt
4. Rate limit (10/day) enforced via `AsyncStorage` (`glucolog_carb_estimate_usage`)
5. Returned text shown inline; user enters their own insulin units

**Insulin Logging Flow:**

1. User taps long-acting / correction / tablets button on HomeScreen
2. Navigate to `InsulinLogScreen.tsx` with `{ type: InsulinLogType }`
3. `saveInsulinLog()` writes to `glucolog_insulin_logs` in `AsyncStorage`
4. Long-acting only: `fetchAndStoreBasalCurve(log.id)` fire-and-forget — fetches 12hr window and writes `BasalCurve` onto the log

**History Display:**

1. `MealHistoryScreen` uses `useFocusEffect` to reload on screen focus
2. `loadMeals()` and `loadInsulinLogs()` fetched in parallel
3. Merged into a `HistoryItem[]` union type, sorted newest-first
4. Each `MealCard` renders `GlucoseResponseCard` if `meal.glucoseResponse` is present, or a "Load curve" button if window is complete, or a countdown if not yet 3 hours
5. `InsulinLogCard` renders `BasalCurveCard` for long-acting entries on the same pattern

**State Management:**
- No global store. Each screen calls services on mount or focus.
- `useFocusEffect` used in `MealHistoryScreen.tsx` and `SettingsScreen.tsx` to reload stale data when navigating back
- `useCallback` wraps load functions to stabilise `useEffect` dependencies

## Key Abstractions

**Session:**
- Purpose: Groups meals logged within a 3-hour window for pattern matching
- Location: `src/services/storage.ts` (`Session`, `SessionWithMeals` interfaces)
- Pattern: Created/extended automatically inside `saveMeal()`. Sessions are stored separately in `glucolog_sessions` key. `loadSessionsWithMeals()` joins them. Legacy meals (pre-session) are surfaced as synthetic solo sessions.

**GlucoseResponse:**
- Purpose: Captures the 3-hour post-meal glucose curve metrics
- Location: `src/services/storage.ts`
- Pattern: Stored on `Meal.glucoseResponse`. Computed by `fetchAndStoreCurveForMeal()` which calls `fetchGlucoseRange()` then reduces to start/peak/end stats.

**GlucoseStore (rolling window):**
- Purpose: Local cache of 30 days of CGM readings to avoid repeated API calls
- Location: `src/services/storage.ts` (`GlucoseStore` interface, `updateGlucoseStore()`)
- Pattern: On each poll, only readings since `lastFetchedAt` are fetched. `avg12h` and `avg30d` derived locally. Sum maintained incrementally for O(1) average.

**Meal Matching:**
- Purpose: Find past sessions similar to a given session for "you've eaten this before" UI
- Location: `src/services/matching.ts`
- Pattern: Jaccard similarity on tokenized meal names (75% weight) + insulin total similarity (25% weight). Threshold 0.25. Max 5 results. Only sessions with completed `GlucoseResponse` considered.

## Entry Points

**App Bootstrap:**
- Location: `index.ts`
- Triggers: Expo `registerRootComponent`
- Responsibilities: Registers `App` as the root component

**App Root:**
- Location: `App.tsx`
- Triggers: Expo/React Native app launch
- Responsibilities: Declares typed navigation stack, wraps in `SafeAreaProvider`, exports `RootStackParamList`

**Home Screen:**
- Location: `src/screens/HomeScreen.tsx`
- Triggers: App launch (first screen in stack)
- Responsibilities: Live glucose polling, rolling store management, HbA1c derivation, quick log modal, navigation to all other screens

## Error Handling

**Strategy:** Silent catch on fire-and-forget operations; `try/catch` with `Alert.alert` on user-initiated saves; `error` state string displayed inline for polling failures.

**Patterns:**
- `fetchAndStoreCurve(meal.id).catch(() => {})` — curve fetch failures are silently swallowed; user can retry from history
- `try { const r = await fetchLatestGlucose(); startGlucose = r.mmol; } catch {}` — glucose capture at save time is optional; `startGlucose` stays `null` if unavailable
- `HomeScreen` polling: `setError(err.message)` shown in glucose card with "Pull down to retry" hint

## Cross-Cutting Concerns

**Logging:** No logging framework. No `console.log` calls in production paths.
**Validation:** Input validation inline in screen handlers before any async call (e.g. empty name check, `isNaN` for units).
**Authentication:** No auth implemented. All data is device-local. `AccountScreen.tsx` and `SettingsScreen.tsx` store display name/email in `AsyncStorage` only.
**Glucose units:** Always mmol/L in the UI. Conversion (`sgv / 18`) happens exclusively in `src/services/nightscout.ts` at the API boundary.

---

*Architecture analysis: 2026-03-18*
