# Phase 2: History Refactor and Core UX Components - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate MealHistoryScreen from `loadMeals()` to the session data model (`loadSessionsWithMeals()`), perform a one-time idempotent migration of legacy pre-session meals to proper session records, install the chart library, and build four reusable components: `GlucoseChart`, `ExpandableCard`, `OutcomeBadge`, and `DayGroupHeader`. No intelligence/matching UI in this phase — that is Phase 3. Components are built ready to accept matching data but do not implement it.

</domain>

<decisions>
## Implementation Decisions

### Chart Library
- **D-01:** `react-native-gifted-charts` — pure JS, no native linking required, fully compatible with Expo managed workflow. Powers both the 3-hour post-meal `GlucoseChart` (Phase 2) and the 24-hour HomeScreen graph (Phase 4).
- **D-02:** GlucoseChart displays horizontal reference lines at 3.9 and 10.0 mmol/L (the in-range band) — makes it immediately obvious whether the curve stayed in range.
- **D-03:** GlucoseChart is static display only — no tap-to-inspect interaction. Glucose stats (start, peak, end values) are shown as a text stats row alongside the chart.

### Card Expand Animation
- **D-04:** `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` — same pattern already used in MealHistoryScreen for day group collapse/expand. No new animation dependencies.
- **D-05:** Expanded card content: stats row (startGlucose / peakGlucose / endGlucose, each as mmol/L) followed by the `GlucoseChart` below. When `glucoseResponse` is null or pending, show appropriate empty/pending state instead of chart.

### Session Card Layout
- **D-06:** One card per meal (not one card per session). Multi-meal sessions are grouped under a session sub-header.
- **D-07:** Session sub-header format: "Session — X meals, H:MM PM" (meal count + time of first meal). Sub-header only appears when a session contains 2 or more meals — solo meals (most common) show no sub-header.
- **D-08:** Each meal card shows its own `OutcomeBadge` derived from that meal's own `glucoseResponse` via `classifyOutcome()`. Badges are independent per card, not aggregated at session level.
- **D-09:** Expanded meal cards include a placeholder slot for Phase 3 "You've eaten this before" matching content. In Phase 2, this slot renders a greyed-out "Loading..." text. Phase 3 replaces this with real matching data.
- **D-10:** IMPORTANT — the matching engine integration is not finalised. The Phase 2 plan must fully specify the component API and prop contract for the matching slot before implementation begins, so Phase 3 can wire into it cleanly.

### Legacy Migration (HIST-06)
- **D-11:** Migration is totally silent — no spinner, no user-visible message. `loadSessionsWithMeals()` already surfaces legacy meals as synthetic sessions so nothing appears broken to the user.
- **D-12:** Migration runs once on app launch after Phase 2 ships. A migration flag in AsyncStorage marks completion — migration is idempotent and skipped on subsequent launches.
- **D-13:** On migration failure (storage write error): `console.warn` and continue. App keeps working via `loadSessionsWithMeals()` synthetic fallback. Migration will retry on next launch.

### Claude's Discretion
- Exact GlucoseChart sizing, colours, and curve styling within gifted-charts API
- DayGroupHeader visual styling (font weight, spacing, colour relative to meal cards)
- OutcomeBadge exact colours and pill shape (must match HIST-03 colour semantics: Green/Orange/Dark Amber/Red/Pending/None)
- Exact greyed-out "Loading..." placeholder styling in the matching slot

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — HIST-01, HIST-02, HIST-03, HIST-05, HIST-06 — exact specs for this phase including outcome badge colour semantics (HIST-03) and late-entry time picker (HIST-05)
- `.planning/ROADMAP.md` §Phase 2 — success criteria (5 items) that must all be TRUE for phase to be complete

### Codebase
- `src/screens/MealHistoryScreen.tsx` — primary target: switch from `loadMeals()` to `loadSessionsWithMeals()`, refactor rendering to session model, integrate new components
- `src/services/storage.ts` — `loadSessionsWithMeals()` (line ~408), `SessionWithMeals` interface (line ~244), `Session` interface (line ~224) — understand these before building components
- `src/utils/outcomeClassifier.ts` — `classifyOutcome()` pure function, `OutcomeBadge` type — `OutcomeBadge` component wraps this, no logic duplication

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `classifyOutcome(glucoseResponse)` in `src/utils/outcomeClassifier.ts` — already tested; `OutcomeBadge` component is a pure renderer wrapping this function
- `loadSessionsWithMeals()` in `src/services/storage.ts` — already handles legacy meals as synthetic `SessionWithMeals` objects; migration writes permanent records so these synthetic wrappers become unnecessary
- `LayoutAnimation` + `Animated` already imported in `MealHistoryScreen.tsx` — day group collapse/expand pattern is the model for card expand/collapse

### Established Patterns
- Day group collapse uses `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` — apply same call before toggling card expanded state
- `UIManager.setLayoutAnimationEnabledExperimental?.(true)` already set for Android in MealHistoryScreen — no repeat needed if card expand lives in same file
- Glucose colour helper already in MealHistoryScreen: `glucoseColor(mmol)` — reuse for stats row colour coding

### Integration Points
- `MealHistoryScreen.tsx` is the primary integration point: replaces `loadMeals()` call (line 431) with `loadSessionsWithMeals()`, re-renders meal list using new session-aware layout
- New components (`GlucoseChart`, `ExpandableCard`, `OutcomeBadge`, `DayGroupHeader`) should live in `src/components/` — consistent with existing `GlucoseDisplay.tsx` location
- Migration function should run in `App.tsx` or as an early side-effect on MealHistoryScreen focus — once, guarded by a flag key in AsyncStorage

</code_context>

<specifics>
## Specific Ideas

- "One card per meal with sub header" — user explicitly chose this over one-card-per-session; the matching engine is not finalised so per-meal cards give more flexibility
- The Phase 2 plan must fully specify the matching slot component API/prop contract before execution — user flagged this as a planning requirement
- Greyed-out "Loading..." placeholder in the matching slot area of expanded cards — Phase 3 replaces with real content

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-history-refactor-and-core-ux-components*
*Context gathered: 2026-03-21*
