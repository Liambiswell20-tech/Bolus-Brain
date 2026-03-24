---
phase: 04-homescreen-glucose-graph-and-hba1c-disclaimer
plan: "01"
subsystem: utilities-and-theme
tags: [utilities, theme, tdd, pure-functions]
dependency_graph:
  requires: []
  provides:
    - src/utils/formatDate.ts
    - src/utils/glucoseToArcAngle.ts
    - src/theme.ts
  affects:
    - src/screens/HomeScreen.tsx (will import theme tokens in plan 04-06)
    - src/components/ExpandableCard.tsx (formatDate import in later plan)
    - src/screens/MealHistoryScreen.tsx (formatDate import in later plan)
tech_stack:
  added: []
  patterns:
    - Pure utility functions in src/utils/ with co-located __tests__/
    - Canonical design tokens exported as const objects from src/theme.ts
key_files:
  created:
    - src/utils/formatDate.ts
    - src/utils/glucoseToArcAngle.ts
    - src/utils/__tests__/formatDate.test.ts
    - src/utils/__tests__/glucoseToArcAngle.test.ts
    - src/theme.ts
  modified: []
decisions:
  - "formatDate not yet swapped in callers (ExpandableCard.tsx, MealHistoryScreen.tsx) — deferred to later plans per plan spec"
  - "glucoseToArcAngle uses Math.round for integer degree output matching arc gauge expectations"
  - "theme.ts COLORS.background locked at #050706 per Decision D-03 in Phase 4 CONTEXT.md"
metrics:
  duration_mins: 8
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 04 Plan 01: Utility Extraction and Theme System Summary

**One-liner:** Extracted formatDate (en-GB locale) and created glucoseToArcAngle (270° arc, 2.0–20.0 mmol/L clamp) as tested pure utilities, plus canonical COLORS/FONTS design tokens in theme.ts with locked OLED background #050706.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract formatDate and create glucoseToArcAngle | 37143d6 | src/utils/formatDate.ts, src/utils/glucoseToArcAngle.ts, src/utils/__tests__/formatDate.test.ts, src/utils/__tests__/glucoseToArcAngle.test.ts |
| 2 | Create theme.ts | 1e55641 | src/theme.ts |

## What Was Built

**formatDate** (`src/utils/formatDate.ts`)
- Extracts the inline function duplicated in ExpandableCard.tsx (line 31) and MealHistoryScreen.tsx (line 59)
- Signature: `formatDate(iso: string): string`
- Uses en-GB locale with `weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'`
- Callers not yet updated (deferred to later plans per plan spec)

**glucoseToArcAngle** (`src/utils/glucoseToArcAngle.ts`)
- Pure function: `glucoseToArcAngle(mmol: number | null): number | null`
- Returns null for null or NaN input (guard chain)
- Clamps input to [2.0, 20.0] mmol/L
- Maps to 270-degree arc: -135° (min) to +135° (max) using `Math.round`
- Formula: `Math.round(-135 + ((clamped - 2.0) / 18.0) * 270)`

**theme.ts** (`src/theme.ts`)
- COLORS: background (#050706 locked), surface, surfaceRaised, text, textSecondary, textMuted, green, amber, red, blue, separator
- FONTS: regular (Outfit_400Regular), semiBold (Outfit_600SemiBold), mono (JetBrainsMono_400Regular)
- Exported as `as const` for type safety

## Test Results

- 10 new tests added (2 for formatDate, 8 for glucoseToArcAngle)
- Full suite: 72 tests passing across 7 test suites
- TDD cycle followed: RED → GREEN (no refactor needed)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. No data flows or UI render paths — these are pure utility/constant modules.

## Self-Check: PASSED

- [x] `src/utils/formatDate.ts` exists and exports `formatDate`
- [x] `src/utils/glucoseToArcAngle.ts` exists and exports `glucoseToArcAngle`
- [x] `src/theme.ts` exists, exports `COLORS` and `FONTS`, background is `#050706`
- [x] Commit `37143d6` exists (Task 1)
- [x] Commit `1e55641` exists (Task 2)
- [x] 72/72 tests pass
