# Roadmap: BolusBrain — Milestone 2

## Overview

Milestone 2 transforms BolusBrain from a data-collection app into an intelligent personal companion. The matching engine is already built but has never been surfaced in any UI. This milestone exposes that intelligence incrementally: first fixing the data integrity bugs and fragile code that would silently corrupt what the user sees, then building the history screen components on a correct data model, then wiring the matching engine into those components, then completing the HomeScreen improvements, then extending the data model for longer-horizon features, and finally establishing the route to market. Every phase delivers a coherent, observable capability that works without the phases that follow it.

## Phases

- [ ] **Phase 1: Tech Debt and Foundation Fixes** - Eliminate data bugs and hardcoded secrets that would corrupt new features built on top of them
- [ ] **Phase 2: History Refactor and Core UX Components** - Migrate history screen to session model and build the reusable components all intelligence features depend on
- [ ] **Phase 3: Intelligence Layer — Matching and Outcome Surfacing** - Wire the existing matching engine into history cards and meal log screen
- [ ] **Phase 4: HomeScreen Glucose Graph and HbA1c Disclaimer** - Expose full-day glucose graph and surface HbA1c with appropriate disclaimer
- [ ] **Phase 5: Data Model Extensions and Editing** - Add AI confidence tracking, long-acting overnight window, and dose editing
- [ ] **Phase 6: Route to Market** - Complete landing page, email capture, and MHRA regulatory contact

## Phase Details

### Phase 1: Tech Debt and Foundation Fixes
**Goal**: The codebase is stable, secrets are secure, and data computations are correct — so every feature built afterward stands on solid ground
**Depends on**: Nothing (first phase)
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Success Criteria** (what must be TRUE):
  1. Nightscout URL and token are read from `.env` environment variables — no credentials appear in any source file
  2. Estimated HbA1c value on HomeScreen is computed from a recomputed sum (not incremental accumulation) — the value is stable and does not drift over repeated app launches
  3. The `GlucoseResponse` build block exists in exactly one place in the codebase — both curve fetch functions call the shared function
  4. The `expo-file-system` import in `carbEstimate.ts` uses the current non-legacy API — no `/legacy` sub-path anywhere in the codebase
**Plans**: TBD

### Phase 2: History Refactor and Core UX Components
**Goal**: The history screen operates on the session data model, new chart and animation libraries are correctly configured, and the reusable `GlucoseChart`, `ExpandableCard`, `OutcomeBadge`, and `DayGroupHeader` components exist — ready to be wired with data in Phase 3
**Depends on**: Phase 1
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-05
**Success Criteria** (what must be TRUE):
  1. History screen loads and displays entries grouped under day headers (e.g. "Wednesday 18 Mar") that collapse and expand on tap
  2. Tapping any history card expands it to reveal full glucose stats and a curve graph — tapping again collapses it
  3. Every history card that has a completed glucose response shows a traffic light badge: Green (3.9–10.0 mmol/L and returned to range), Orange (slight excursion then returned), or Red (below 3.9 or above 13, or above 10 and did not return within 3 hours)
  4. User can tap "Late Entry" when logging a meal and select an earlier time — the glucose curve is fetched from that earlier time rather than now
**Plans**: TBD

### Phase 3: Intelligence Layer — Matching and Outcome Surfacing
**Goal**: The existing matching engine is wired into the UI — users see "You've eaten this before" with past outcomes on both expanded history cards and at meal log time, and successful past sessions are flagged
**Depends on**: Phase 2
**Requirements**: PATT-01, PATT-02
**Success Criteria** (what must be TRUE):
  1. When a history card is expanded, a "You've eaten this before" section appears if 2 or more past matching sessions exist — showing up to 5 matches as "Last time: [meal name], [units] units, [outcome badge]" with no advice or recommendation
  2. When typing a meal name in the meal log screen, matching past sessions appear after a short delay — each showing the same historical format with no suggestion language
  3. Any match where glucose stayed in range (Green outcome) shows a "This went well last time" indicator — the indicator appears only when the outcome badge is Green, never when data is incomplete
**Plans**: TBD

### Phase 4: HomeScreen Glucose Graph and HbA1c Disclaimer
**Goal**: The HomeScreen exposes full-day glucose context on tap and surfaces the HbA1c estimate with a clear disclaimer — completing the user's ability to see their glucose story at a glance
**Depends on**: Phase 1 (sum fix must be verified before disclaimer draws attention to HbA1c), Phase 2 (GlucoseChart component must exist)
**Requirements**: HOME-01, HOME-02, HOME-03, HIST-04
**Success Criteria** (what must be TRUE):
  1. Tapping the main mmol/L reading on HomeScreen opens a full-day line graph showing the last 24 hours of glucose readings with reference lines at 3.9 and 10.0 mmol/L
  2. Tapping the estimated HbA1c value shows a modal that reads: "Please be aware HbA1c is usually calculated over 90 days. You should get accurate testing and take guidance from your diabetes team."
  3. Quick log buttons on HomeScreen are visually centred on screen
  4. User can tap an insulin log entry to edit the dose — the corrected value is saved and the original is preserved
**Plans**: TBD

### Phase 5: Data Model Extensions and Editing
**Goal**: The app captures AI carb estimate confidence for future safety surfacing, tracks long-acting insulin effectiveness via an overnight glucose window, and stores both without requiring migration scripts
**Depends on**: Phase 3
**Requirements**: PATT-03, PATT-04
**Success Criteria** (what must be TRUE):
  1. After each meal's 3-hour glucose curve completes, the app records whether the AI carb estimate agreed with the outcome — if the estimate was wrong last time and the user went low, a warning appears before the next AI estimate for the same meal
  2. Long-acting insulin log cards display a bedtime reading (target 10pm) and a morning reading (target 7am next day) — both appear on the card once readings are available, showing what the glucose did overnight
**Plans**: TBD

### Phase 6: Route to Market
**Goal**: The landing page captures pre-interest signups, the MHRA regulatory paper trail is started, and the public presence reflects the app's current capabilities
**Depends on**: Nothing (independent of app phases)
**Requirements**: MKTG-01, MKTG-02, LEGAL-01
**Success Criteria** (what must be TRUE):
  1. Landing page includes a working AI carb estimation photo demo section and a Dexcom integration teaser — both visible without scrolling past the fold on desktop
  2. A visitor can submit their email address on the landing page and it is captured for pre-interest follow-up
  3. An email has been sent to devices@mhra.gov.uk describing the app and its "no advice, only historical patterns" framing — the response (or sent date if no response) is documented in project records
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5, with Phase 6 independent (can run in parallel)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tech Debt and Foundation Fixes | 0/TBD | Not started | - |
| 2. History Refactor and Core UX Components | 0/TBD | Not started | - |
| 3. Intelligence Layer — Matching and Outcome Surfacing | 0/TBD | Not started | - |
| 4. HomeScreen Glucose Graph and HbA1c Disclaimer | 0/TBD | Not started | - |
| 5. Data Model Extensions and Editing | 0/TBD | Not started | - |
| 6. Route to Market | 0/TBD | Not started | - |
