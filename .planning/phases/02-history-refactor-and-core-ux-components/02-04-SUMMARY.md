---
phase: 02-history-refactor-and-core-ux-components
plan: "04"
subsystem: history-screen
tags: [migration, refactor, session-model, components]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [session-aware-history-screen, legacy-data-migration]
  affects: [App.tsx, MealHistoryScreen.tsx, storage.ts]
tech_stack:
  added: []
  patterns: [idempotent-migration, session-model-rendering, component-composition]
key_files:
  created: []
  modified:
    - src/services/storage.ts
    - src/screens/MealHistoryScreen.tsx
    - App.tsx
decisions:
  - "migrateLegacySessions uses MEALS_KEY/SESSIONS_KEY directly via AsyncStorage (raw reads) rather than private helpers — the plan specified this approach and the helpers are not exported"
  - "Sessions with 2+ meals render a SessionSubHeader above their meal cards for both today and past days — solo sessions render no sub-header"
  - "InsulinLogCard and BasalCurveCard kept inline in MealHistoryScreen — not componentised in Phase 2 per plan spec"
  - "loadSessionsWithMeals() synthetic fallback means legacy meals remain visible even if migration has not yet run"
metrics:
  duration: 15
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 3
---

# Phase 2 Plan 4: Migration + MealHistoryScreen Refactor Summary

One-line summary: Legacy meal migration added to storage.ts, MealHistoryScreen rewired to session model using ExpandableCard / DayGroupHeader / SessionSubHeader components.

## What Was Built

**Task 1 — migrateLegacySessions (storage.ts)**

Added `MIGRATION_V1_KEY = 'glucolog_migration_v1'` constant and exported `migrateLegacySessions()` function. The function:
- Guards with `AsyncStorage.getItem(MIGRATION_V1_KEY)` — skips immediately if already run
- Reads meals and sessions raw via `AsyncStorage.getItem(MEALS_KEY/SESSIONS_KEY)` directly
- Identifies legacy meals: meals whose `id` is not in any session's `mealIds` set
- Creates one solo `Session` per legacy meal (`id: legacy_migrated_${m.id}`, `startedAt: m.loggedAt`, `confidence: 'high'`)
- Updates each meal's `sessionId` to match the new session
- Writes both updated arrays back atomically (Promise.all)
- Sets `MIGRATION_V1_KEY = 'true'` only after successful write
- On any failure: `console.warn` and returns — migration retries on next launch; `loadSessionsWithMeals()` synthetic fallback keeps history working in the interim

**Task 2 — MealHistoryScreen refactor + App.tsx migration wire-in**

MealHistoryScreen:
- `loadMeals()` replaced by `loadSessionsWithMeals()` — state now holds `SessionWithMeals[]` and `InsulinLog[]` separately
- Inline `MealCard`, `DayHeader`, `GlucoseResponseCard`, `Stat` components removed
- `ExpandableCard`, `DayGroupHeader`, `SessionSubHeader` imported from `src/components/`
- New `ListRow` type with 7 variants covering today/past meals, sessions, insulin, day headers, session sub-headers
- `buildListData` (via `useMemo`) groups by local date, interleaves sessions+insulin by time (newest-first)
- Today: flat list — session sub-header rendered if `session.meals.length >= 2`, then individual `ExpandableCard` per meal
- Past days: collapsible `DayGroupHeader`, then session sub-header (if 2+ meals) + `ExpandableCard` per meal + `InsulinLogCard` per log
- First-load auto-open of most recent past day preserved
- `silentRefresh` / `load` / `useFocusEffect` pattern preserved
- `InsulinLogCard` and `BasalCurveCard` kept inline (not componentised in Phase 2)

App.tsx:
- Added `React, { useEffect }` import
- Added `import { migrateLegacySessions }` from storage
- `useEffect(() => { migrateLegacySessions().catch(...) }, [])` runs once on app mount before any navigation

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 746d9b6 | feat(02-04): add migrateLegacySessions to storage.ts |
| 2 | ae10626 | feat(02-04): refactor MealHistoryScreen to session model + wire migration |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `matchingSlot={{ matchData: null }}` in all `ExpandableCard` usages — intentional Phase 2 placeholder per D-09. Phase 3 will pass real match data. ExpandableCard renders a greyed-out "Loading..." placeholder; this is the designed Phase 3 wire-in point and does not prevent the plan's goal (session-aware history screen) from being achieved.

## Self-Check: PASSED
