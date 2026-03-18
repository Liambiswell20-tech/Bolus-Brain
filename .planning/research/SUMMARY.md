# Project Research Summary

**Project:** BolusBrain — T1D Meal and Insulin Tracking App
**Domain:** Personal health tracking, CGM integration, pattern recognition (React Native / Expo)
**Researched:** 2026-03-18
**Confidence:** HIGH (architecture from direct codebase inspection; stack from npm registry; features and pitfalls from domain expertise)

## Executive Summary

BolusBrain is at the transition point between a data-collection app and an intelligent personal health companion. Phases 1–7 built a complete data pipeline: live CGM display, meal photo logging, AI carb estimation, insulin logging, post-meal curve capture, session grouping, Jaccard matching engine, rolling glucose store, and estimated HbA1c. Phase 8 now has a fully built matching engine that has never been surfaced in any UI — the opportunity is to expose that intelligence through a set of focused UX improvements. The recommended approach is to ship the intelligence layer incrementally: first establish the foundational UX surface (expandable history cards, day grouping, traffic light outcome badges), then wire in the matching engine and glucose graph, then extend the data model for longer-horizon features.

The single most important technical prerequisite is migrating `MealHistoryScreen` from the flat `loadMeals()` call to `loadSessionsWithMeals()`. Every intelligence feature in this milestone (match display, outcome badges, day grouping, expandable card state) depends on the screen working with session objects rather than raw meals. This must go first. Alongside this, three existing bugs must be fixed before new UI is shipped: the `GlucoseStore` sum drift (corrupts HbA1c), the duplicate `GlucoseResponse` build logic (blocks adding new fields), and the `expo-file-system/legacy` import (latent SDK upgrade risk). Shipping new UI on top of silent data corruption erodes user trust and is harder to fix once visible.

The principal risk for this milestone is regulatory language drift: as the pattern-recognition UI is built, framing must remain strictly historical and descriptive. Every UI string that surfaces a pattern must describe what the glucose did, not what the user should do. The traffic light badge must label glucose outcomes ("Glucose in range") not dose quality ("Good dose"). The matching card must say "Last time: X units, glucose peaked at Y mmol/L" not "You typically need X units." This framing discipline must be established as a review checklist in Phase 1 and applied to every new string before merge — not retroactively audited after features ship.

---

## Key Findings

### Recommended Stack

The existing stack (Expo SDK 54 / React Native 0.81.5 / TypeScript) is unchanged. Two new libraries are required for this milestone and both are already bundled in Expo SDK 54's managed workflow.

**Core technology additions:**
- `react-native-gifted-charts` (1.4.76): SVG line charts for glucose curves and sparklines — chosen because it requires only `react-native-svg` as a peer (already bundled), with no Reanimated dependency, eliminating the main compatibility risk. Handles 36-point post-meal sparklines and 288-point daily graphs adequately. If 30-day scrollable trend graphs are added in a future milestone, switch to `victory-native` (Skia-based, GPU-accelerated).
- `react-native-reanimated` (~4.1.1): Smooth expandable card animations using `useAnimatedStyle` + `useSharedValue` — bundled with Expo SDK 54, zero additional install risk. Public API (useSharedValue, useAnimatedStyle, withTiming, withSpring) is backward-compatible with v3. Add `react-native-reanimated/plugin` to `babel.config.js` as the last plugin entry.
- `react-native-svg` (15.12.1): SVG primitives; install with `npx expo install react-native-svg` for the exact SDK-54-compatible version.

**Install sequence:** `npx expo install react-native-svg react-native-reanimated react-native-gesture-handler` then `npm install react-native-gifted-charts`.

**Libraries to avoid:** `react-native-chart-kit` (dead, last published 2022), `react-native-svg-charts` (dead, 2020), `recharts` (web-only, incompatible with React Native). Never pin Reanimated to v3.x — SDK 54 bundles v4 and version conflict will result.

For the interactive glucose graph on HomeScreen, the chart is simple enough (single line, coloured range bands, no axis labels) that `react-native-svg` primitives directly — without any charting library — is a viable and lower-dependency approach. Use gifted-charts for history card sparklines where the convenience of a charting API is worth the dependency.

### Expected Features

T1D users arrive with established expectations from Dexcom Clarity, LibreView, mySugr, and Apple Health. The history UX and glucose graph are table stakes they expect; the matching engine and per-meal outcome intelligence are genuine differentiators not found in any competitor.

**Must have (this milestone — table stakes gaps):**
- Expandable history cards — progressive disclosure; collapsed glanceable card with badge + meal + dose + time, tap reveals full stats, curve, matched sessions
- Day folder grouping with sticky date headers — history beyond ~30 entries is unusable without it; SectionList with "Today / Yesterday / Mon 16 Mar" sections is the universal pattern
- Traffic light outcome badge — auto-derived from `GlucoseResponse`; Green/Orange/Red describing what the glucose did, never what the user did
- Interactive glucose graph on HomeScreen — modal triggered by tapping the mmol reading; 24-hour rolling window from `GlucoseStore.readings`

**Must have (this milestone — differentiators):**
- "You've eaten this before" at meal log time — matching engine is built; surface top 3 matches with outcome badge and dose as user types (debounced ~300ms)
- "You've eaten this before" in expanded history cards — call `findSimilarSessions()` on card expand; render as `MatchCard` list inside the expanded section

**Should have (v1.x after validation):**
- HbA1c disclaimer modal on tap — modal with "est." always visible inline; must wait for `GlucoseStore` sum fix to ship first
- Dose editing — correct mistaken insulin entries; append-only correction preserving the original for audit
- Long-acting insulin 10pm→7am overnight window — pair bedtime and morning readings on `InsulinLogCard` for Lantus/Levemir entries; novel feature with no competitor equivalent
- AI carb estimate confidence model — track estimate accuracy against glucose outcome; requires 10+ completed curves and MHRA informal guidance before surfacing

**Defer (v2+):**
- Pattern reports — 90-day data gate; no point building until 3 months of data exists
- Outcome-weighted matching — filter to "in range" sessions only; builds on traffic light
- Backend sync — required for multi-device, sharing, or public distribution
- Prediction engine — requires MHRA guidance, 50+ meals, and potentially regulatory solicitor review

**Anti-features — deliberately excluded:**
- Dosing recommendations in any form (SaMD regulatory risk; hospitalisation liability)
- Gamification or goal-tracking (glucose outcomes are partly outside user control)
- Push notifications for logging (CGM alarm fatigue; T1D management is reactive, not scheduled)
- USDA-based nutritional lookup (UK CoFID standards only; USDA carb figures are materially wrong for UK products)
- Multi-user household sharing without a secure backend

### Architecture Approach

The architecture is a layered React Native app with screens → components → services → AsyncStorage. The milestone adds four new components (`GlucoseChart`, `OutcomeBadge`, `MatchCard`, `ExpandableCard`), one new service (`outcomes.ts`), and significantly refactors `MealHistoryScreen` to use the session abstraction that already exists in storage but is currently bypassed.

**Major components (after this milestone):**
1. `GlucoseChart` — stateless SVG line chart accepting `CurvePoint[]`; used in HomeScreen graph modal and expanded history cards
2. `ExpandableCard` — animated `maxHeight` wrapper; collapsed and expanded slots, `isOpen` controlled by parent screen
3. `OutcomeBadge` — traffic-light pill computed at render time from `GlucoseResponse` by `classifyOutcome()` in `outcomes.ts`
4. `MatchCard` — single `SessionMatch` result: meal name, date, outcome badge, avg rise stat

**Key patterns:**
- Outcome classification is computed at render time from existing `GlucoseResponse` fields — not stored (avoids migration debt if thresholds change)
- `carbEstimateConfidence` is stored at write time (AI response not recoverable later) as an additive optional field on `Meal`
- `OvernightWindow` stored as additive optional on `InsulinLog` — fire-and-forget fetch with `isPartial` guard for morning-after completion
- New schema fields are always `field?: Type | null`; no migration scripts required for additive changes
- Match state is local to the expanded card, not global — `findSimilarSessions()` is called inline on expand (sub-millisecond at current data volumes)

**Build sequence (from architecture research):**
Group 0 (tech debt) → Group 1 (history session migration + library install + GlucoseChart) → Group 2 (ExpandableCard, OutcomeBadge, DayGroupHeader, SectionList) → Group 3 (wire intelligence into expanded cards + MatchCard) → Group 4 (data model extensions) → Group 5 (HomeScreen graph) → Group 6 (dose editing)

### Critical Pitfalls

1. **Regulatory language drift** — Pattern UI gradually acquires words like "suggest", "typically", or "ideal" which cross into clinical decision support (SaMD classification under MHRA). Prevention: establish a string review checklist before Phase 1 ships; every new UI string must pass a one-sentence test: "does this describe what the user did, or what they should do?" Traffic light badges must label glucose, not dose quality. Apply the checklist to every PR.

2. **AsyncStorage history performance collapse** — Inline curve storage in meal records means the full history JSON blob (curves included) is parsed on every `MealHistoryScreen` focus. After ~5 months of daily use (~150 meals) this causes a visible freeze on older devices. Prevention: separate curve storage into per-meal AsyncStorage keys (`glucolog_curve_<mealId>`), load summary fields for the list, lazy-fetch curves on card expand. This must be done before expandable cards ship, not after.

3. **GlucoseStore sum drift corrupting HbA1c** — Incremental sum accumulation has a known drift bug. The HbA1c disclaimer modal (planned this milestone) draws user attention to the HbA1c number — shipping the modal before fixing the sum is actively harmful. Fix first: `readings.reduce()` instead of incremental sum in `updateGlucoseStore`. Add NaN guard in `loadGlucoseStore`. This is a one-line change that must ship in Group 0.

4. **Expandable card scroll performance** — FlatList with dynamically measured item heights causes full re-measurement on every expand/collapse; invisible at 10 items in development, severe at 60+ in production. Prevention: use fixed maximum expanded height constants (not `onLayout`-measured), animate `maxHeight` to the constant, never animate `height` to `'auto'`. The graph canvas inside expanded cards must declare a fixed height before the chart library is chosen.

5. **Pattern framing with insufficient historical data** — The matching engine returns results after 1 previous match. A single data point presented as "the pattern" is actively misleading for T1D glucose responses (highly variable by activity, hormones, sleep). Prevention: enforce a minimum of 2 previous matches before the "You've eaten this before" card appears; always show the spread of outcomes (e.g. "peaked at 9.2, 11.4, 8.7 mmol/L") never just an average; always display starting glucose on historical sessions.

---

## Implications for Roadmap

Based on combined research, the architecture's build order maps naturally to 5 roadmap phases:

### Phase 1: Tech Debt and Foundation Fixes
**Rationale:** Three blockers prevent any new feature from being built correctly. All are quick fixes that unblock everything else. Shipping new UI before fixing them creates visible quality problems.
**Delivers:** Data integrity (HbA1c accurate), clean codebase (no duplicate logic), correct long-acting screen behaviour, environment variable security
**Addresses:** `GlucoseStore` sum drift, `buildGlucoseResponse` duplication, `expo-file-system/legacy` import, `InsulinLogType` condition bug, Nightscout/Anthropic secrets moved to `.env`
**Avoids:** Pitfall 6 (HbA1c corruption visible when disclaimer modal is added), Pitfall 3 (unit conversion audit before any graph code is written)
**Research flag:** No additional research needed — these are mechanical fixes

### Phase 2: History Refactor and Core UX Components
**Rationale:** The history screen migration to `loadSessionsWithMeals()` is the single most impactful change in the milestone; everything else builds on it. Library installation must happen before any component that uses those libraries. Building components without wiring them into screens keeps PRs focused and reviewable.
**Delivers:** `MealHistoryScreen` on session data model, `react-native-svg` and `react-native-reanimated` installed with correct babel config, `GlucoseChart` component, `ExpandableCard` component, `OutcomeBadge` + `outcomes.ts`, `DayGroupHeader` and `SectionList` migration
**Uses:** `react-native-gifted-charts`, `react-native-reanimated` ~4.1.1, `react-native-svg` 15.12.1
**Implements:** Session-based history view, expandable card wrapper, traffic-light classification engine, day-grouped SectionList
**Avoids:** Pitfall 7 (fixed expanded heights established before animation code is written), Pitfall 2 (curve storage separated from summary list before expandable cards wire in)
**Research flag:** No additional research needed — patterns are well-documented (SectionList, Reanimated useAnimatedStyle)

### Phase 3: Intelligence Layer — Matching and Outcome Surfacing
**Rationale:** Components from Phase 2 are now available. The matching engine has been built since Phase 5 and is waiting for a UI surface. This phase wires the engine into the UX and builds `MatchCard`. By this point the history screen has session data, outcome badges exist, and expandable cards are tested.
**Delivers:** Expanded history cards fully wired (stats, GlucoseChart, outcome badge, match list), `MatchCard` component, "You've eaten this before" inline at meal log time (debounced name matching)
**Uses:** `findSimilarSessions()` from `matching.ts` (no changes needed), `classifyOutcome()` from `outcomes.ts`, `OutcomeBadge`, `GlucoseChart`
**Implements:** Match display architecture, minimum-2-match enforcement, historical spread framing, regulatory language checklist applied to all new strings
**Avoids:** Pitfall 1 (regulatory framing enforced by checklist before strings are merged), Pitfall 4 (minimum match threshold prevents single-point framing), Pitfall 5 (carb confidence score deferred until MHRA guidance obtained)
**Research flag:** No additional research needed — matching engine is complete; only UI wiring remains

### Phase 4: HomeScreen Glucose Graph and HbA1c Disclaimer
**Rationale:** The interactive glucose graph is a table-stakes feature but depends on `GlucoseChart` (Phase 2) being stable. The HbA1c disclaimer modal depends on the sum drift fix (Phase 1) being verified in production. Grouping these together means both HomeScreen improvements ship together.
**Delivers:** Glucose graph modal on HomeScreen (tap mmol reading, 24h slice of `GlucoseStore.readings`), reference lines at 3.9 and 10.0 mmol/L, HbA1c disclaimer modal on tap, "est." label always visible inline
**Uses:** `GlucoseChart` (Phase 2), `GlucoseStore.readings` (already populated by polling)
**Avoids:** Pitfall 3 (graph data path verified through `nightscout.ts` mmol/L conversion boundary before rendering; y-axis value range assertion added as a sanity check), Pitfall 6 (sum fix confirmed before disclaimer modal draws attention to the number)
**Research flag:** No additional research needed — glucoseStore pattern is established

### Phase 5: Data Model Extensions and Editing
**Rationale:** These features extend the data model (new optional fields) and add editing capability. They are grouped last because they are independent of the UX work above and have no unblocked dependencies on each other. Dose editing should ship after the match display is stable, so the audit-trail implications of corrected doses in pattern matching are understood before design.
**Delivers:** `carbEstimateConfidence` field on `Meal`, `OvernightWindow` on `InsulinLog` with overnight fetch and display, dose editing with original-value preservation, long-acting 10pm→7am tracking surface on `InsulinLogCard`
**Implements:** Additive schema extensions (no migration scripts), `updateInsulinLog()` in `storage.ts`, `fetchAndStoreOvernightWindow()` service function
**Avoids:** Pitfall 5 (AI confidence surfacing deferred until MHRA guidance; feature-flagged if built before guidance received)
**Research flag:** Overnight window Nightscout query requires a scoped API call not currently in `nightscout.ts` — minimal research needed on nearest-reading-to-time-window query pattern. AI confidence model requires MHRA informal guidance before surfacing.

### Phase Ordering Rationale

- Tech debt goes first because it unblocks data integrity and prevents shipping new UX on top of silent bugs
- The session migration goes early in Phase 2 because it is the dependency root for all intelligence features; delaying it delays everything
- Components are built before they are wired in — this keeps PRs reviewable and allows parallel development of Phase 2 components
- Intelligence wiring (Phase 3) follows components (Phase 2) strictly — no wiring without stable components
- HomeScreen graph (Phase 4) uses `GlucoseChart` from Phase 2 and the sum-fix from Phase 1 — cannot be correctly built until both are stable
- Data model extensions (Phase 5) are independent and can slip if earlier phases take longer without blocking the core milestone

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Overnight window):** Nightscout nearest-reading-to-timestamp query pattern is not currently implemented in `nightscout.ts`. Requires a scoped `fetchGlucoseRange()` call with a narrow time window around 22:00 and 07:00 — simple but should be verified against the Nightscout API's `count` and `from`/`to` parameters before implementation.
- **Phase 5 (AI confidence model):** MHRA informal guidance email should be sent before this feature is built. Framing as estimate reliability (not outcome prediction) needs a language review prior to implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1:** All fixes are mechanical changes to existing code — no unknowns
- **Phase 2:** SectionList, Reanimated useAnimatedStyle with maxHeight, gifted-charts LineChart are all well-documented with clear implementation patterns
- **Phase 3:** Matching engine is complete; UI wiring follows established component patterns
- **Phase 4:** GlucoseStore data flow is established; modal pattern already exists in HomeScreen

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm registry version checks confirmed; Expo SDK 54 bundled versions verified from `node_modules/expo/bundledNativeModules.json`; victory-native Reanimated 4 compat is MEDIUM (semver-compatible but not explicitly documented) |
| Features | MEDIUM | Competitor analysis from training data (pre-August 2025); cannot be verified against current app store releases; regulatory framing from MHRA published guidance is HIGH confidence |
| Architecture | HIGH | Direct codebase inspection of all source files; build order derived from confirmed dependency graph |
| Pitfalls | HIGH | Two pitfalls (GlucoseStore drift, session migration blocker) confirmed from existing `CONCERNS.md` codebase audit; performance pitfalls from documented React Native FlatList behaviour |

**Overall confidence:** HIGH

### Gaps to Address

- **Reanimated 4 / victory-native compatibility:** Semver-compatible but not explicitly confirmed by Formidable's maintainers. If victory-native is chosen over gifted-charts in a future milestone, verify with a minimal test component before committing.
- **Nightscout nearest-reading query:** The overnight window feature needs `fetchGlucoseRange()` adapted for narrow time-window queries. Verify the Nightscout API's `count=1` + `from=` + `to=` parameter behaviour for readings near 22:00 and 07:00 before implementing `fetchAndStoreOvernightWindow()`.
- **AI confidence model framing:** MHRA informal guidance via `devices@mhra.gov.uk` should be sent before this feature is built in Phase 5. The framing (estimate reliability, not outcome prediction) is documented in PROJECT.md but the regulatory position needs a paper trail.
- **Competitor features post-August 2025:** FEATURES.md competitor table is from training data. Verify against current app store listings before using as competitive positioning material in any marketing copy.

---

## Sources

### Primary (HIGH confidence)
- `C:/Users/Liamb/bolusbrain-app/node_modules/expo/bundledNativeModules.json` — Expo SDK 54 bundled package versions
- `npm info react-native-gifted-charts@1.4.76` — peer dependencies confirmed (react-native-svg only, no reanimated)
- `npm info react-native-reanimated@4.2.2` — v4 worklets peer, backward-compatible public API
- `C:/Users/Liamb/bolusbrain-app/.planning/codebase/CONCERNS.md` — existing bugs and fragile areas confirmed in codebase
- Direct inspection of all source files in `src/` — architecture, build order, dependency graph
- MHRA "Software and AI as a Medical Device" guidance (2024) — SaMD classification and regulatory framing

### Secondary (MEDIUM confidence)
- Training data: competitive analysis of Dexcom Clarity, LibreView, mySugr, Gluroo (pre-August 2025)
- JDRF app landscape surveys (2023–2024) — T1D feature expectations
- Apple HIG health data guidelines — progressive disclosure, colour-coding patterns
- React Native FlatList performance characteristics — fixed-height vs measured-height animation tradeoffs
- T1D glucose variability (clinical fact) — minimum sample sizes for pattern validity

### Tertiary (LOW confidence)
- victory-native / Reanimated 4 compatibility — inferred from semver; not explicitly documented by maintainers
- AsyncStorage performance degradation threshold — approximately 1MB per key; no documented hard limit; practical observation from community reports

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
