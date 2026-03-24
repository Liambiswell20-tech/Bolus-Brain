---
phase: "04"
plan: "05"
subsystem: meal-history-ui
tags: [meal-history, meal-log, bottom-sheet, averaged-stats, wiring]
dependency_graph:
  requires: ["04-03", "04-04"]
  provides: ["meal-history-card-wired", "averaged-stats-panel-wired"]
  affects: ["MealHistoryScreen", "MealLogScreen"]
tech_stack:
  added: []
  patterns: ["caller-manages-sheet-state", "fragment-wrapping-for-modal"]
key_files:
  created: []
  modified:
    - src/screens/MealHistoryScreen.tsx
    - src/screens/MealLogScreen.tsx
decisions:
  - "MealHistoryCard is fully controlled — caller manages sheetSessions + sheetVisible state"
  - "handleCardPress silently no-ops when sessionId missing or findSimilarSessions returns null/0 matches"
  - "Sessions passed to MealBottomSheet are capped at 10 by the caller (slice(0, 10))"
  - "matchSummary is cleared on every path that clears liveMatches — early return, catch block, and main setter"
  - "AveragedStatsPanel rendered unconditionally in JSX — component handles null/< 2 guard internally"
metrics:
  duration_mins: 3
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_modified: 2
---

# Phase 04 Plan 05: Wire MealHistoryCard + MealBottomSheet + AveragedStatsPanel Summary

MealHistoryScreen switched from ExpandableCard to MealHistoryCard (tap → sheet) + MealBottomSheet using findSimilarSessions; MealLogScreen wired AveragedStatsPanel above live match rows using MatchSummary from debounced search.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Wire MealHistoryScreen to MealHistoryCard + MealBottomSheet | 6be0e6e | src/screens/MealHistoryScreen.tsx |
| 2 | Add AveragedStatsPanel to MealLogScreen | c165705 | src/screens/MealLogScreen.tsx |

## What Was Built

### Task 1: MealHistoryScreen wiring

- Removed `ExpandableCard` import — replaced with `MealHistoryCard` + `MealBottomSheet`
- Added `findSimilarSessions` import from matching service
- Added two new state vars: `sheetSessions: SessionWithMeals[]` and `sheetVisible: boolean`
- Added `handleCardPress(meal: Meal)` handler:
  - Returns silently if `meal.sessionId` is missing
  - Finds target session from `sessions` array
  - Calls `findSimilarSessions(targetSession, sessions)`
  - Returns silently if result is null or 0 matches
  - Caps results at 10 via `.slice(0, 10).map(m => m.session)`
  - Sets state and opens sheet
- Replaced `ExpandableCard` render with `MealHistoryCard` + `onPress={() => handleCardPress(row.meal)}`
- Wrapped `FlatList` in a `<>` fragment with `MealBottomSheet` rendered outside/below the list

### Task 2: MealLogScreen AveragedStatsPanel

- Added `AveragedStatsPanel` import from components
- Added `findSimilarSessions` + `MatchSummary` type import from matching service
- Added `matchSummary: MatchSummary | null` state
- Debounced useEffect updated:
  - Clears `matchSummary(null)` on early return (name < 2 chars)
  - After setting `liveMatches`: if `matched.length >= 2`, computes summary via `findSimilarSessions(matched[0].session, allSessions)` and sets it; otherwise sets null
  - Clears `matchSummary(null)` in catch block
- `<AveragedStatsPanel summary={matchSummary} />` rendered immediately above `liveMatchContainer` — no conditional wrapper (component guards internally)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired. MealHistoryCard and MealBottomSheet receive real session data from storage. AveragedStatsPanel receives real MatchSummary computed from live sessions.

## Self-Check: PASSED

- `src/screens/MealHistoryScreen.tsx` — exists and modified
- `src/screens/MealLogScreen.tsx` — exists and modified
- Commit `6be0e6e` — Task 1 (MealHistoryScreen wiring)
- Commit `c165705` — Task 2 (MealLogScreen AveragedStatsPanel)
- ExpandableCard references in MealHistoryScreen: 0
- MealHistoryCard references in MealHistoryScreen: 2
- AveragedStatsPanel references in MealLogScreen: 3
