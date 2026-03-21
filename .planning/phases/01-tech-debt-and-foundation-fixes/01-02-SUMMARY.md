---
phase: 01-tech-debt-and-foundation-fixes
plan: 02
subsystem: storage
tags: [storage, data-integrity, testing, jest, try-catch, pure-function]

# Dependency graph
requires:
  - 01-01 (jest infrastructure + AsyncStorage mock)
provides:
  - GlucoseStore.sum recomputed from array (no drift)
  - buildGlucoseResponse pure function shared by both curve fetch paths
  - All 5 JSON.parse sites wrapped with safe defaults on corrupt input
  - HbA1c formula unit test
  - saveMeal session grouping unit tests (solo, join, boundary)
affects:
  - 01-03 (sum fix verified — safe to build on)
  - 01-04 (curve functions use shared buildGlucoseResponse)
  - All future plans that read HbA1c or session data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSON.parse wrapped in try/catch returning safe defaults with console.warn
    - Pure function extraction for shared curve-building logic
    - Sum recompute-from-array after every mutation (no incremental accumulation)

key-files:
  created:
    - src/services/storage.test.ts
  modified:
    - src/services/storage.ts

key-decisions:
  - "Computed HbA1c mmolMol from formula at avgMmol=7.0: result is 53 (not 52 as stated in plan — plan had arithmetic error)"
  - "DEBT-02 sum recompute placed after toKeep array is fully built and sorted — single source of truth"
  - "buildGlucoseResponse uses fromMs + THREE_HOURS_MS for isPartial (not caller's toMs) — consistent with constant definition"

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 01 Plan 02: Storage Data Integrity Fixes and Unit Tests Summary

**GlucoseStore sum drift fixed via recompute-from-array; buildGlucoseResponse extracted as shared pure function; all 5 JSON.parse sites wrapped with try/catch; 4 new unit tests passing (HbA1c formula + 3 session grouping scenarios)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-21T10:30:03Z
- **Completed:** 2026-03-21T10:33:00Z
- **Tasks:** 2
- **Files modified:** 2 (storage.ts modified, storage.test.ts created)

## Accomplishments

- DEBT-02: Replaced incremental `sum += e.sgv` / `sum -= r.sgv` pattern in `updateGlucoseStore` with `const sum = readings.reduce((acc, r) => acc + r.sgv, 0)` computed after the eviction pass
- DEBT-03: Extracted `buildGlucoseResponse(fromMs, readings, nowMs)` pure function — single definition, called by both `fetchAndStoreCurveForMeal` and `_fetchCurveForSession`
- DEBT-07: Wrapped all 5 JSON.parse call sites in try/catch blocks returning safe defaults ([], null) with `console.warn('[storage] ...: corrupt data')` messages
- TEST-01: HbA1c formula test — `computeAndCacheHba1c(7.0, 30)` returns `{ percent: 6.0, mmolMol: 53, daysOfData: 30 }`
- TEST-01: Session grouping tests — solo meal, join-existing (30min), boundary (3hr+1min) — all 3 scenarios pass

## Task Commits

1. **Task 1: Fix GlucoseStore sum drift and extract buildGlucoseResponse** - `7055717` (fix)
2. **Task 2: Wrap JSON.parse sites and write unit tests** - `fad0d29` (feat)

## Files Created/Modified

- `src/services/storage.ts` — DEBT-02 sum recompute, DEBT-03 buildGlucoseResponse extracted, DEBT-07 all 5 JSON.parse sites wrapped
- `src/services/storage.test.ts` — 4 tests: HbA1c formula (1) + session grouping (3)

## Decisions Made

- Plan stated `mmolMol` expected value of 52 for `avgMmol=7.0`, but the actual formula `Math.round(10.929 * (7.0 - 2.15))` = `Math.round(53.00565)` = `53`. Test asserts 53 (the correct computed value, not the plan's stated approximation).
- `buildGlucoseResponse` uses `nowMs < (fromMs + THREE_HOURS_MS)` for `isPartial` rather than `nowMs < toMs` — avoids dependency on a local variable in callers and stays consistent with the `THREE_HOURS_MS` constant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan had incorrect HbA1c mmolMol expected value**
- **Found during:** Task 2 (pre-test arithmetic verification)
- **Issue:** Plan stated `mmolMol: 52` for avgMmol=7.0, but `Math.round(10.929 * 4.85) = 53`
- **Fix:** Test asserts `mmolMol: 53` (correct computed value per the actual formula in storage.ts)
- **Files modified:** src/services/storage.test.ts
- **Verification:** Test passes with 53; would fail with 52

## Known Stubs

None — all fixes are complete data integrity corrections. No placeholder values introduced.

## Self-Check: PASSED

- FOUND: src/services/storage.ts
- FOUND: src/services/storage.test.ts
- FOUND: commit 7055717 (fix(01-02): fix GlucoseStore sum drift and extract buildGlucoseResponse)
- FOUND: commit fad0d29 (feat(01-02): wrap JSON.parse sites in try/catch and write storage unit tests)
- npm test: 12 passed, 0 failed (2 suites)
- grep sum -= r.sgv: no results (correct)
- grep buildGlucoseResponse(: 3 results (definition + 2 call sites)
- grep try {: 5 results (all JSON.parse sites wrapped)
