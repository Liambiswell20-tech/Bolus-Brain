---
phase: 03-intelligence-layer-matching-and-outcome-surfacing
plan: 02
subsystem: intelligence-ui
tags: [matching, history-ui, outcome-badge, glucose-color, expandable-card]
dependency_graph:
  requires: [03-01]
  provides: [matching-ui-wired, glucoseColor-util, matchingSlot-real-data]
  affects: [MealHistoryScreen, ExpandableCard, types]
tech_stack:
  added: []
  patterns: [tdd-logic-tests, iife-render-pattern, lazy-compute-on-expand]
key_files:
  created:
    - src/utils/glucoseColor.ts
    - src/components/MatchingSlot.test.ts
  modified:
    - src/components/ExpandableCard.tsx
    - src/components/types.ts
    - src/screens/MealHistoryScreen.tsx
decisions:
  - matchSummary computed synchronously on first expand using useState — avoids async complexity since findSimilarSessions is a pure function
  - matchingSlot prop kept in ExpandableCardProps for TypeScript compatibility — real computation uses allSessions passed directly
  - IIFE pattern used for MatchingSlot rendering block to allow early-return null without extracting a separate component
  - Inner expanded guard removed from MatchingSlot IIFE — already inside outer expanded && block
metrics:
  duration: 5 minutes
  completed_date: 2026-03-21
  tasks_completed: 3
  files_changed: 5
---

# Phase 03 Plan 02: Wire Matching Engine into History Card UI Summary

MatchingSlot wired into ExpandableCard with real match data from findSimilarSessions, rendering "YOU'VE EATEN THIS BEFORE" section when 2+ matching past sessions exist, with outcome-coloured rows, "Went well" indicator on GREEN outcomes, and confidence warnings.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Extract glucoseColor to shared util | cd3f863 | src/utils/glucoseColor.ts, src/components/ExpandableCard.tsx |
| 2 | Widen MatchingSlotProps and build MatchingSlot (TDD) | c0f7617 (test), 0c4b746 (impl) | src/components/types.ts, src/components/ExpandableCard.tsx, src/components/MatchingSlot.test.ts |
| 3 | Update MealHistoryScreen to pass allSessions | 249583e | src/screens/MealHistoryScreen.tsx |

## What Was Built

**glucoseColor util (`src/utils/glucoseColor.ts`):** Pure function extracted from ExpandableCard's inline declaration — now a shared export usable across the codebase. ExpandableCard imports it; all existing call sites unchanged.

**MatchingSlotProps widened (`src/components/types.ts`):** `matchData` type widened from `null` to `null | MatchSummary`. `ExpandableCardProps` gains `allSessions: SessionWithMeals[]` prop for passing all sessions from the screen level.

**MatchingSlot in ExpandableCard (`src/components/ExpandableCard.tsx`):**
- `matchSummary` local state computed once on first expand via `findSimilarSessions`
- Guard: renders nothing when matchSummary is null or has fewer than 2 matches
- When 2+ matches: renders "YOU'VE EATEN THIS BEFORE" header + up to 5 rows
- Each row: meal name — insulin units, date (Wed 18 Mar format), peak glucose (colour-coded), OutcomeBadge small
- "Went well" green dot + text only when `classifyOutcome === 'GREEN'`
- Own-session confidence warning above header when `session.confidence !== 'high'`
- Per-row confidence warning below row when `match.session.confidence !== 'high'`
- New styles: matchingHeader, matchingConfidenceWarning, matchRow, matchRowDivider, matchRowPrimary, matchRowName, matchRowDate, matchRowPeak, matchRowBadgeRow, wentWellIndicator, wentWellDot, wentWellText

**MealHistoryScreen wired (`src/screens/MealHistoryScreen.tsx`):** Single `<ExpandableCard>` call site updated to pass `allSessions={sessions}` — the existing `sessions` state already loaded at screen level via `loadSessionsWithMeals()`.

## Test Results

- 35 tests pass across 4 test suites
- TypeScript: `npx tsc --noEmit` exits 0
- 13 new tests in `MatchingSlot.test.ts` covering all behaviour conditions

## Decisions Made

1. **Lazy compute on first expand:** `matchSummary` computed in `handleToggle` when `nextExpanded === true && matchSummary === null`. Avoids redundant computation on every render and keeps the UI fast — `findSimilarSessions` is synchronous and pure.

2. **matchingSlot prop kept:** `matchingSlot` remains in `ExpandableCardProps` for TypeScript compatibility with existing call sites. The real computation uses `allSessions` directly. Prop can be removed in a future cleanup pass if desired.

3. **IIFE render pattern:** `{(() => { if (!matchSummary || ...) return null; return <View>...</View>; })()}` used instead of extracting a named component. Keeps the matching slot logic inline and avoids prop drilling a new component. The plan explicitly specifies this pattern.

## Deviations from Plan

None — plan executed exactly as written. All three tasks implemented in order with no deviations.

## Known Stubs

None — `allSessions` is wired from real state (`loadSessionsWithMeals()`) and `matchSummary` computed from real matching data. The `matchingSlot={{ matchData: null }}` prop is passed for type compatibility but is not used for rendering decisions.

## Self-Check: PASSED
