# Architecture Research

**Domain:** Personal T1D meal and insulin tracking — React Native / Expo, device-local storage
**Researched:** 2026-03-18
**Confidence:** HIGH — based on direct codebase inspection of all source files

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Navigation Shell (App.tsx)                   │
│               RootStackParamList  ·  Stack.Navigator              │
├──────────────┬───────────────────┬───────────────────────────────┤
│ HomeScreen   │ MealHistoryScreen │ MealLogScreen · InsulinLog... │
│ (polling)    │ (session view)    │ (forms)                       │
├──────────────┴───────────────────┴───────────────────────────────┤
│                       Components Layer                            │
│  GlucoseDisplay · GlucoseChart · OutcomeBadge · MatchCard        │
│  ExpandableCard · DayGroupHeader (new for this milestone)        │
├──────────────────────────────────────────────────────────────────┤
│                       Services Layer                              │
│  nightscout.ts · storage.ts · matching.ts · carbEstimate.ts      │
│  settings.ts  · outcomes.ts (new)                                │
├──────────────────────────────────────────────────────────────────┤
│                       Persistence Layer                           │
│  AsyncStorage — glucolog_meals · glucolog_sessions               │
│  glucolog_insulin_logs · glucolog_glucose_store · hba1c_cache     │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| `GlucoseDisplay` | Colour-coded mmol reading + trend arrow | `src/components/` (exists) |
| `GlucoseChart` | SVG line chart over `CurvePoint[]` data | `src/components/` (new) |
| `OutcomeBadge` | Traffic-light pill: Green/Orange/Red based on `GlucoseResponse` | `src/components/` (new) |
| `MatchCard` | "You've eaten this before" result card — shows avg rise, peak, date | `src/components/` (new) |
| `ExpandableCard` | Animated wrapper: collapsed summary → expanded detail | `src/components/` (new) |
| `DayGroupHeader` | Date divider in history `FlatList` | `src/components/` (new) |
| `MealCard` | Card for a meal entry in history | `src/screens/MealHistoryScreen.tsx` (exists, refactor) |
| `BasalCurveCard` | Card for insulin log basal overnight data | `src/screens/MealHistoryScreen.tsx` (exists, refactor) |

---

## Recommended Project Structure (after this milestone)

```
src/
├── components/
│   ├── GlucoseDisplay.tsx      # existing — no change
│   ├── GlucoseChart.tsx        # NEW — SVG line chart, accepts CurvePoint[]
│   ├── OutcomeBadge.tsx        # NEW — traffic-light outcome pill
│   ├── MatchCard.tsx           # NEW — single match result display
│   └── ExpandableCard.tsx      # NEW — animated expand/collapse wrapper
├── screens/
│   ├── HomeScreen.tsx          # modify — add glucose graph modal
│   ├── MealHistoryScreen.tsx   # significant refactor — session view, day grouping,
│   │                           #   expandable cards, match display, outcome badges
│   ├── MealLogScreen.tsx       # modify — show matches at log time (optional phase)
│   ├── InsulinLogScreen.tsx    # modify — fix tablet/long-acting condition bug
│   ├── SettingsScreen.tsx      # no change
│   ├── AccountScreen.tsx       # no change
│   └── HelpScreen.tsx          # no change
└── services/
    ├── nightscout.ts           # no change
    ├── storage.ts              # schema changes — add fields to Meal and InsulinLog
    ├── matching.ts             # no change — engine is complete
    ├── carbEstimate.ts         # no change
    ├── settings.ts             # no change
    └── outcomes.ts             # NEW — outcome classification logic
```

---

## Feature-to-Architecture Mapping

Each new feature maps to a specific location. This table is the build plan source of truth.

### 1. Interactive Glucose Graph

**What:** SVG line chart shown when user taps the mmol reading on HomeScreen; also embedded inside expanded history cards.

**New code:**
- `src/components/GlucoseChart.tsx` — pure presentational component, accepts `readings: CurvePoint[]`, `width`, optional `height`. Renders an SVG polyline with range bands (red < 3.9, green 3.9–10, orange > 10).
- HomeScreen: add a `Modal` (same pattern as the existing quick-log modal) triggered by tapping the `GlucoseDisplay`. Feeds `GlucoseStore.readings` (last 24h slice) to `GlucoseChart`.

**Dependencies needed:**
- `react-native-svg` (Expo SDK 54 compatible, included in Expo Go) — confirmed available as `expo install react-native-svg`.
- No separate charting library needed — the chart is simple enough (single line, no axes labels, coloured bands) to implement directly on SVG primitives. A library like `victory-native` would add ~2MB bundle and is overkill here.

**Confidence:** HIGH — `react-native-svg` ships with Expo SDK 54.

**No data schema change required.** `GlucoseStore.readings` already stores the raw `CurvePoint[]`.

---

### 2. Expandable History Cards with Animation

**What:** Tapping a card in history reveals the full detail, graph, and match data. Collapsed state shows just the meal name, outcome badge, and date.

**New code:**
- `src/components/ExpandableCard.tsx` — wraps children in a React Native `Animated.View` with height animation. Accepts `collapsed` (summary JSX) and `expanded` (detail JSX) slots, plus an `isOpen` boolean controlled by the parent.
- `MealHistoryScreen.tsx` — add an `expandedId: string | null` state. On card tap, toggle open/closed. Pass relevant slice to `ExpandableCard`.

**Dependencies needed:**
- `react-native-reanimated` — provides `useAnimatedStyle` + `withTiming` for smooth height animations. The built-in `Animated` API works but produces janky height animations on Android without the native driver for layout animations. Reanimated 3 (included in Expo SDK 54) handles this correctly.
- `expo install react-native-reanimated` — zero config in managed Expo.

**Confidence:** HIGH — Reanimated 3 is bundled with Expo SDK 54.

---

### 3. Traffic Light Outcome Badge

**What:** A coloured pill on each history card summarising the glucose outcome: Green (stayed in range), Orange (rose above 10 but returned), Red (remained high or went low).

**New code:**
- `src/services/outcomes.ts` — pure function `classifyOutcome(response: GlucoseResponse): 'good' | 'elevated' | 'poor'`. Logic:
  - `good`: `peakGlucose <= 10.0` AND `endGlucose` between 3.9–10.0
  - `elevated`: `peakGlucose > 10.0` BUT `endGlucose` between 3.9–10.0 (came back down)
  - `poor`: `endGlucose < 3.9` (went low) OR `endGlucose > 10.0` (remained high)
- `src/components/OutcomeBadge.tsx` — renders the coloured pill given an outcome string.

**No data schema change.** Classification is computed at render time from existing `GlucoseResponse` fields. There is no reason to persist the outcome — it is deterministic from stored data.

**Depends on:** `GlucoseResponse` being present on the meal/session. Cards without a curve show no badge.

---

### 4. "You've Eaten This Before" Match Display

**What:** In `MealHistoryScreen`, after expanding a card, show the top matching past sessions. In `MealLogScreen`, show matches after the meal is named (stretch goal for this milestone).

**New code:**
- `src/components/MatchCard.tsx` — displays one `SessionMatch`: meal name(s), date, outcome badge, avg rise stat.
- `MealHistoryScreen.tsx` — when a card is expanded, call `findSimilarSessions(targetSession, allSessions)` with the already-loaded session list. No additional storage reads. Render `MatchCard` list inside the expanded section.

**Dependencies:** None new. `matching.ts` is fully implemented and only requires `SessionWithMeals[]` which `MealHistoryScreen` must load anyway.

**Critical prerequisite:** `MealHistoryScreen` must switch from `loadMeals()` to `loadSessionsWithMeals()`. Currently the screen uses the flat `loadMeals()` call (line 336) and constructs a simple `HistoryItem[]`. The session abstraction exists in storage but is not used by the history screen. This switch is the single most important architectural change for this milestone. Everything else (expandable cards, outcome badges, match display) depends on the screen working with `SessionWithMeals[]`.

---

### 5. AI Carb Estimate Confidence Tracking

**What:** Store whether the AI estimate was accurate based on the subsequent glucose outcome. Surface a warning if the estimate was wrong and the user went low last time.

**Schema change required on `Meal`:**

```typescript
// Add to Meal interface in storage.ts
carbEstimateConfidence: number | null;
// Range 0.0–1.0. null = no AI estimate was made for this meal.
// Populated at save time from carbEstimate.ts response (if available).
// Future: updated post-hoc when GlucoseResponse is fetched and outcome classified.
```

**Migration strategy:** Add the field as optional (`carbEstimateConfidence?: number | null`) to the `Meal` interface. Existing stored meals will deserialise without it (TypeScript optional means `undefined`). Treat `undefined` and `null` identically throughout. No explicit migration script needed — the field is additive.

**New code:**
- `carbEstimate.ts` — return a `confidence: number` field alongside the carb estimate (model returns this in the structured response, or can be inferred from the response text certainty).
- `MealLogScreen.tsx` — pass `carbEstimateConfidence` into `saveMeal()` when an AI estimate was used.
- `saveMeal()` in `storage.ts` — accept `carbEstimateConfidence: number | null` as part of the input.
- `MatchCard.tsx` — if a matched session has low confidence estimate AND the outcome was `poor`, surface a note: "Last time the carb estimate may have been off — you went [low/high]."

**Confidence:** MEDIUM — the confidence value from the Anthropic API response is available in the text but not as a structured field. This may require prompt engineering to get a numeric value out.

---

### 6. Day Grouping in History

**What:** History entries grouped by calendar day with a collapsible day header.

**Approach:** This is a FlatList data transformation, not a new component. Group the `SessionWithMeals[]` array into `{ date: string; sessions: SessionWithMeals[] }[]` before rendering. Use `SectionList` (React Native built-in) instead of `FlatList` — `SectionList` provides native `renderSectionHeader` and handles sticky headers correctly.

**New code:**
- Helper function `groupSessionsByDay(sessions: SessionWithMeals[]): SectionListData[]` inside `MealHistoryScreen.tsx`.
- `src/components/DayGroupHeader.tsx` — renders the date header (e.g. "Mon 18 Mar") with a count badge ("3 entries").

**No new dependencies.** `SectionList` is React Native built-in.

**Depends on:** Session-based history view (prerequisite above).

---

### 7. Dose Editing

**What:** Allow correction of an existing `InsulinLog` entry (units and type). Meals are not editable in this milestone — insulin logs only, as doses are most likely to be mis-entered.

**New code:**
- `storage.ts` — `updateInsulinLog(id: string, updates: Partial<Pick<InsulinLog, 'units' | 'type'>>): Promise<void>`. Reads all logs, maps, writes back.
- `InsulinLogCard` in `MealHistoryScreen.tsx` — add an edit button (pencil icon) that opens an inline edit mode or a bottom sheet with unit input.
- No new screen required — inline editing within the card is sufficient for dose correction.

**No schema change.** The existing `InsulinLog` interface is sufficient.

---

### 8. Long-Acting Insulin 10pm→7am Tracking Window

**What:** Instead of (or in addition to) the generic 12-hour basal curve, track the specific overnight window: bedtime reading (10pm) and morning reading (7am next day), as this is the clinically relevant window for Lantus-type insulin.

**Schema change required on `InsulinLog`:**

```typescript
// Add to InsulinLog interface in storage.ts
overnightWindow: OvernightWindow | null;
// null = not a long-acting dose, or window not yet defined/fetched
```

```typescript
// New interface in storage.ts
export interface OvernightWindow {
  bedtimeGlucose: number | null;     // mmol/L at 10pm (nearest reading to 22:00)
  morningGlucose: number | null;     // mmol/L at 7am next day (nearest reading to 07:00)
  netChange: number | null;          // morningGlucose - bedtimeGlucose
  fetchedAt: string;                 // ISO
  isPartial: boolean;                // true if morning reading not yet available
}
```

**Migration strategy:** Add `overnightWindow?: OvernightWindow | null` as optional on `InsulinLog`. Existing logs missing the field will have `undefined` — treat as `null`. Additive, no migration script.

**New code:**
- `storage.ts` — `fetchAndStoreOvernightWindow(logId: string): Promise<void>`. Finds the nearest Nightscout readings to 10pm and 7am the next morning using `fetchGlucoseRange`. Called fire-and-forget after `saveInsulinLog()` when type is `long-acting`.
- This function works alongside `fetchAndStoreBasalCurve()` — both populate different fields on the same `InsulinLog`. The basal curve tracks the generic 12-hour drop; the overnight window tracks the clinically specific 10pm–7am window.
- `InsulinLogCard` — display `overnightWindow` when present: "Bedtime: X · Morning: Y · Net: ±Z".

---

## Data Schema Changes Summary

| Entity | Field Added | Type | Migration |
|--------|-------------|------|-----------|
| `Meal` | `carbEstimateConfidence` | `number \| null` | Optional field — additive, no migration script |
| `InsulinLog` | `overnightWindow` | `OvernightWindow \| null` | Optional field — additive, no migration script |
| _(new)_ | `OvernightWindow` interface | — | New type in `storage.ts` |

No breaking schema changes. All new fields are optional and additive. Existing stored data will deserialise correctly because `JSON.parse` returns `undefined` for missing fields, and all code paths must handle `null | undefined` already (TypeScript strict mode).

---

## Critical Tech Debt That Blocks New Features

These items from CONCERNS.md must be addressed before or during this milestone, because new features depend on the fixed behaviour.

### BLOCKER: History screen uses `loadMeals()`, not `loadSessionsWithMeals()`

The `MealHistoryScreen` currently calls `loadMeals()` and works entirely with individual `Meal` objects. The match display, expandable cards, and day grouping all require `SessionWithMeals[]`. This is the largest single refactor in the milestone.

**What breaks if skipped:** Match display cannot be built. Expandable card state must be per-session, not per-meal. Day grouping needs session start times.

**Fix:** Replace `loadMeals()` + `loadInsulinLogs()` with `loadSessionsWithMeals()` + `loadInsulinLogs()`. Render `SessionWithMeals` instead of `Meal` in the FlatList. Inline components (`MealCard`, `GlucoseResponseCard`) can remain but now receive a session.

---

### BLOCKER: `GlucoseStore.sum` drift corrupts HbA1c

The incremental sum in `updateGlucoseStore` can drift silently. The HbA1c displayed on HomeScreen is sourced from this corrupted average. As glucose graph data is about to become visible in the HomeScreen modal (new feature), a corrupted average will be visibly wrong next to the accurate chart line.

**Fix:** Recompute `sum` from `readings.reduce()` on every `updateGlucoseStore` call. Single-line change in `storage.ts` lines 125–151.

---

### BLOCKER: Duplicate `GlucoseResponse` build logic

`fetchAndStoreCurveForMeal` and `_fetchCurveForSession` both contain identical GlucoseResponse construction blocks (lines 396–411 and 439–454). Adding `carbEstimateConfidence` outcome back-population (Phase 5 of this milestone) requires writing to `GlucoseResponse` — if the build logic is duplicated, the field must be added in two places.

**Fix:** Extract `buildGlucoseResponse(fromMs, readings, nowMs)` pure function. Both callers use it. Do this before adding any new `GlucoseResponse` fields.

---

### SHOULD-FIX: `expo-file-system/legacy` import

`carbEstimate.ts` imports from the deprecated `/legacy` sub-path. This does not block current features but may break on Expo SDK upgrade. Fix is low effort and should be done while touching `carbEstimate.ts` to add confidence field support.

---

### SHOULD-FIX: `InsulinLogScreen` tablet/long-acting condition mismatch

The `useEffect` loads tablet info when `type === 'long-acting'` but the UI only displays it for `type === 'long-acting'`. The intent appears to be that tablets should show their info on the tablets screen. Fix the condition before adding overnight window tracking so the long-acting screen has correct behaviour.

---

## Build Order

This is the required sequence based on dependencies between features. Items marked (PARALLEL) can be done concurrently once their prerequisite group is complete.

### Group 0: Tech debt (must go first)

1. **Fix `sum` drift** in `updateGlucoseStore` — one-line change; fixes silent data corruption before it becomes visible on the chart.
2. **Extract `buildGlucoseResponse()`** pure function — prerequisite for adding any new field to `GlucoseResponse` without duplicating the fix.
3. **Fix `expo-file-system/legacy` import** — low effort; do it while the file is being touched for confidence tracking.
4. **Fix `InsulinLogType` condition** in `InsulinLogScreen` — prerequisite before overnight window tracking changes `long-acting` screen behaviour.

### Group 1: Foundation (history refactor + charting)

5. **Switch `MealHistoryScreen` to `loadSessionsWithMeals()`** — the single most impactful change. All new history features build on top of this. Requires replacing the current flat `HistoryItem[]` model with a session-grouped model. Also merge insulin logs correctly by date proximity.
6. **Install `react-native-svg`** — `expo install react-native-svg`. Required for `GlucoseChart`.
7. **Install `react-native-reanimated`** — `expo install react-native-reanimated`. Required for `ExpandableCard`. Must add Babel plugin to `babel.config.js` (`react-native-reanimated/plugin`).
8. **Build `GlucoseChart` component** — pure, takes `CurvePoint[]`, renders SVG line. Used in both HomeScreen modal and expanded history cards.

### Group 2: Core UX (parallel after Group 1)

9. **Build `ExpandableCard` component** (PARALLEL) — animated height wrapper. Reanimated-based.
10. **Build `OutcomeBadge` component + `outcomes.ts`** (PARALLEL) — classification logic + pill display.
11. **Build `DayGroupHeader` component** (PARALLEL) — date header for `SectionList`.
12. **Implement day grouping in `MealHistoryScreen`** — switch `FlatList` to `SectionList`, use `groupSessionsByDay()` helper.

### Group 3: Intelligence layer (after Group 2)

13. **Wire `ExpandableCard` into `MealHistoryScreen`** — connect expand/collapse state, show full session detail + chart inside expanded section.
14. **Wire `findSimilarSessions()` into `MealHistoryScreen`** — call on expand, render `MatchCard` list. The matching engine is already fully built.
15. **Build `MatchCard` component** — single match result display with outcome badge.
16. **Add `GlucoseChart` to expanded history cards** — reuse the same `GlucoseChart` component with `meal.glucoseResponse.readings`.

### Group 4: Data model extensions (parallel with Group 3)

17. **Add `carbEstimateConfidence` to `Meal`** — schema change + `MealLogScreen` wiring + `saveMeal()` signature update.
18. **Add `OvernightWindow` + `overnightWindow` to `InsulinLog`** — schema change + `fetchAndStoreOvernightWindow()` service function + `InsulinLogCard` display.

### Group 5: HomeScreen graph

19. **Add glucose graph modal to `HomeScreen`** — tap `GlucoseDisplay` opens `Modal`, feeds last-24h slice of `GlucoseStore.readings` to `GlucoseChart`.

### Group 6: Editing

20. **Add `updateInsulinLog()` to `storage.ts`** — simple read-modify-write.
21. **Add edit UI to `InsulinLogCard`** — inline edit mode, calls `updateInsulinLog()`.

---

## Data Flow — New Features

### Expanded History Card with Match Display

```
MealHistoryScreen mounts
    → loadSessionsWithMeals() + loadInsulinLogs() in parallel
    → groupSessionsByDay() transforms to SectionList sections
    → SectionList renders collapsed cards via ExpandableCard

User taps card
    → expandedId set to session.id
    → ExpandableCard animates open
    → findSimilarSessions(thisSession, allSessions) called inline
    → MatchSummary rendered as MatchCard list
    → GlucoseChart rendered with session.glucoseResponse.readings
    → OutcomeBadge rendered from classifyOutcome(session.glucoseResponse)
```

### HomeScreen Glucose Graph

```
HomeScreen polling (5 min)
    → updateGlucoseStore() writes GlucoseStore to AsyncStorage
    → GlucoseStore.readings available in local state

User taps GlucoseDisplay
    → graphModalVisible = true
    → slice last 288 readings (24h at 5-min intervals) from GlucoseStore.readings
    → GlucoseChart renders line
```

### Overnight Window Capture

```
User logs long-acting insulin
    → InsulinLogScreen → saveInsulinLog('long-acting', units, startGlucose)
    → fetchAndStoreBasalCurve(log.id)    // existing — fire-and-forget
    → fetchAndStoreOvernightWindow(log.id) // new — fire-and-forget

Background (next morning, when user opens app)
    → MealHistoryScreen loads → InsulinLogCard checks overnightWindow.isPartial
    → If isPartial and now > 07:00 next day → show "Refresh" button
    → Refresh calls fetchAndStoreOvernightWindow() again → fills morningGlucose
```

---

## Architectural Patterns

### Pattern: Additive Optional Fields for Schema Evolution

**What:** Add new fields to existing interfaces as `field?: Type | null` rather than creating migration scripts.

**When to use:** Whenever extending a persisted data type that has existing records in AsyncStorage.

**Trade-offs:** Avoids migration complexity. Requires all code reading the field to handle `undefined`. TypeScript strict mode enforces this. Works because `JSON.parse` on old records produces `undefined` for missing fields, and the existing `as InterfaceName` casts don't validate — they just type-assert.

**Limit:** Acceptable for additive changes. Removing or renaming a field requires a migration script. Changing the type of an existing field requires a migration script.

---

### Pattern: Compute-at-Render vs Store-at-Write for Derived Values

**What:** Decide whether to compute a derived value (e.g. outcome classification) at render time or store it alongside the raw data.

**For this milestone:** `OutcomeBadge` classification is computed at render time from `GlucoseResponse`. Do not store it. Reason: it is deterministic from existing fields, and storing it would require a migration for all existing `GlucoseResponse` records.

**Exception:** `carbEstimateConfidence` is stored at write time because the source data (AI response) is not recoverable after the fact.

---

### Pattern: Fire-and-Forget Curve Fetches with Ispartial Guard

**What:** Background data fetches (curve, basal, overnight window) are triggered fire-and-forget. The `isPartial` flag on the stored result tells the UI whether to offer a refresh button.

**When to use:** Any time the full data window is not yet available at log time (all glucose curve fetches).

**Trade-offs:** Silent failure on network error. User must manually trigger refresh. Acceptable for a single-user personal app. Would require a proper retry queue in a multi-user backend context.

---

## Anti-Patterns

### Anti-Pattern: Calling `loadMeals()` in `MealHistoryScreen`

**What people do:** Use the flat `loadMeals()` call because it's simpler than the session join.

**Why it's wrong:** The session abstraction exists for pattern matching. Bypassing it means every feature that needs sessions (matches, expandable state keyed per session, day grouping) must re-implement the join logic locally or be impossible.

**Do this instead:** Always use `loadSessionsWithMeals()` in history screens. Accept the cost of the join — it's O(n) and the data set is small.

---

### Anti-Pattern: Storing Classification Results That Can Be Derived

**What people do:** Store `outcome: 'good' | 'poor' | 'elevated'` on `GlucoseResponse` at save time.

**Why it's wrong:** Creates migration debt. If the classification logic changes (e.g. range thresholds are adjusted), stored values are stale. The `GlucoseResponse` already stores all the raw values needed.

**Do this instead:** Classify at render time with a pure function. Store raw values only.

---

### Anti-Pattern: Adding Match State to Global State

**What people do:** When building "you've eaten this before", lift `MatchSummary` state to a global context because "it might be needed in multiple places".

**Why it's wrong:** Premature. Matches are currently only needed in one screen. Adding a context adds coordination complexity for no benefit. The matching call is fast enough (sub-millisecond on current data volumes) to run on demand.

**Do this instead:** Call `findSimilarSessions()` inline when a card is expanded. If the call ever becomes slow (>200 sessions), memoize with `useMemo` keyed on the session ID before reaching for a context.

---

## Integration Points

### New Libraries Required

| Library | Install Command | Purpose | Why Not Alternative |
|---------|----------------|---------|-------------------|
| `react-native-svg` | `expo install react-native-svg` | SVG primitives for glucose chart | Already included in Expo SDK 54; `victory-native` adds 2MB for no benefit |
| `react-native-reanimated` | `expo install react-native-reanimated` | Smooth height animations for expandable cards | Built-in `Animated` API cannot animate layout height on Android without the native driver; Reanimated 3 is already available in Expo SDK 54 |

After installing `react-native-reanimated`, add to `babel.config.js`:

```javascript
plugins: ['react-native-reanimated/plugin']
```

This must be the last plugin in the list. Expo managed workflow handles all native linking automatically.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `MealHistoryScreen` ↔ `matching.ts` | Direct function call (`findSimilarSessions`) | No service wrapper needed — pure function |
| `MealHistoryScreen` ↔ `outcomes.ts` | Direct function call (`classifyOutcome`) | Pure function at render time |
| `ExpandableCard` ↔ parent screen | Props (`isOpen: bool`, `onToggle: () => void`) | Screen owns the `expandedId` state; `ExpandableCard` is stateless |
| `GlucoseChart` ↔ parent | Props (`readings: CurvePoint[]`, `width: number`) | Fully stateless; dimensions driven by parent |

---

## Scaling Considerations

| Concern | Now (< 100 sessions) | At 500 sessions | Mitigation |
|---------|---------------------|-----------------|------------|
| `loadSessionsWithMeals()` full join on every focus | Negligible — all in memory | Noticeable parse lag on old devices | Paginate or cache in React context; invalidate on save |
| `findSimilarSessions()` O(n) per expanded card | < 1ms | ~10ms per card expand | Acceptable; memoize by session ID if needed |
| `GlucoseStore.readings` array size | ~1440 entries (7 days) | ~8640 entries (30 days) | Already pruned to 30d; chart slices to 24h |
| AsyncStorage key size (meals + curves) | ~200KB | ~1.5MB | Long-term: separate curve store by ID; short-term: acceptable |

---

## Sources

- Direct inspection of all source files in `src/` — 2026-03-18
- `package.json` — confirmed installed dependencies
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONCERNS.md` — codebase audit
- `.planning/PROJECT.md` — confirmed active milestone requirements
- Expo SDK 54 documentation (react-native-svg, react-native-reanimated) — HIGH confidence both are available in SDK 54 managed workflow

---

*Architecture research for: BolusBrain milestone — Pattern Recognition & UX*
*Researched: 2026-03-18*
