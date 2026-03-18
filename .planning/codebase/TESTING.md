# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework

**Runner:**
- None. No test framework is configured in the project.
- No `jest.config.*`, `vitest.config.*`, or equivalent config files exist.
- No test runner scripts in `package.json` (`scripts` only contains `start`, `android`, `ios`, `web`).

**Assertion Library:**
- None installed.

**Run Commands:**
```bash
# No test commands configured
```

## Test File Organization

**Location:**
- No test files exist anywhere under `src/` or the project root (outside `.claude/skills/`).

**Coverage:**
- Zero test coverage on application code.

**Note on `.claude/skills/gstack/`:**
- Test files do exist under `.claude/skills/gstack/test/` — these belong to the GSD tooling scaffolding, not the BolusBrain app. They use `vitest` and are entirely separate from the app codebase. Do not treat them as app test patterns.

## Current State

The BolusBrain app has no automated tests of any kind. All verification is manual, done by running the app via `expo start`.

## What Exists That Could Be Tested

The following pure/service logic is well-suited to unit testing and has no React Native dependencies:

**Pure computation functions in `src/services/matching.ts`:**
- `tokenize(name: string): Set<string>` — splits meal names into tokens, filters stop words
- `jaccard(a: Set<string>, b: Set<string>): number` — set similarity 0–1
- `insulinSimilarity(a, b): number` — scaled score based on unit difference
- `sameDay(isoA, isoB): boolean` — date comparison
- `findSimilarSessions(target, allSessions): MatchSummary | null` — full matching pipeline

**Pure computation functions in `src/services/storage.ts`:**
- `computeConfidence(mealCount: number): SessionConfidence` — 1→high, 2→medium, 3+→low
- `updateGlucoseStore(newEntries)` — merge, deduplicate, prune, compute averages (depends on AsyncStorage)
- `computeAndCacheHba1c(avgMmol, daysOfData): Hba1cEstimate` — pure formula

**Pure computation functions in `src/services/nightscout.ts`:**
- `trendArrow(direction: TrendDirection): string` — simple map lookup
- `fetchGlucoseRange()` — requires fetch mock

**Helper functions in `src/screens/MealHistoryScreen.tsx`:**
- `formatDate(iso: string): string`
- `mealWindowComplete(loggedAt: string): boolean`
- `minsUntilReady(loggedAt: string): number`
- `glucoseColor(mmol: number): string`

## Recommended Test Setup (if adding tests)

**Framework to add:**
- Jest with `ts-jest`, or Vitest — both work with TypeScript without Expo-specific config
- For functions with no React Native imports, a plain Node test runner suffices

**Install:**
```bash
npm install --save-dev jest ts-jest @types/jest
# or
npm install --save-dev vitest
```

**Suggested config (`jest.config.js`):**
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

**Suggested file placement:**
- Co-locate tests with source: `src/services/__tests__/matching.test.ts`
- Or separate: `__tests__/services/matching.test.ts`

## Patterns to Follow When Writing Tests

Based on the structure of existing logic, tests should follow this pattern:

**Service function tests:**
```typescript
import { findSimilarSessions } from '../../src/services/matching';
import type { SessionWithMeals } from '../../src/services/storage';

describe('findSimilarSessions', () => {
  it('returns null when no past sessions exist', () => {
    const target = makeSession({ meals: [{ name: 'pasta', insulinUnits: 6 }] });
    expect(findSimilarSessions(target, [])).toBeNull();
  });

  it('excludes sessions from the same day', () => {
    // ...
  });
});
```

**Pure helper tests:**
```typescript
import { glucoseColor } from './helpers'; // would need extracting first

describe('glucoseColor', () => {
  it('returns red for values below 3.9', () => {
    expect(glucoseColor(3.5)).toBe('#FF3B30');
  });
  it('returns green for in-range values', () => {
    expect(glucoseColor(7.0)).toBe('#30D158');
  });
  it('returns orange for values above 10', () => {
    expect(glucoseColor(11.5)).toBe('#FF9500');
  });
});
```

**AsyncStorage mocking (if testing storage.ts):**
```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
```

## Mocking

**What to mock when tests are introduced:**
- `@react-native-async-storage/async-storage` — all storage functions depend on it
- `fetch` (global) — `fetchLatestGlucose`, `fetchGlucoseRange`, `fetchGlucosesSince`, `estimateCarbsFromPhoto`
- `expo-file-system` — used in `estimateCarbsFromPhoto` for base64 read
- `Date.now()` — used in window calculations; mock with `jest.spyOn(Date, 'now')`

**What NOT to mock:**
- Pure math/logic functions (Jaccard, HbA1c formula, glucose colour thresholds)
- `tokenize`, `jaccard`, `sameDay`, `computeConfidence` — test these directly with real inputs

## Test Coverage Gaps

**Untested: Session grouping logic (`src/services/storage.ts` — `saveMeal`)**
- What's not tested: The 3-hour session window grouping, existing session detection, confidence computation
- Risk: Regressions in meal session assignment go unnoticed until manual testing
- Priority: High — this is stateful logic with multiple branches and direct impact on history

**Untested: Meal matching (`src/services/matching.ts`)**
- What's not tested: Jaccard threshold filtering, insulin weighting, same-day exclusion
- Risk: Similarity scores drift silently when constants change
- Priority: High — all pure functions, easy to test

**Untested: Glucose store rolling window (`src/services/storage.ts` — `updateGlucoseStore`)**
- What's not tested: Deduplication, 30-day cutoff, avg12h/avg30d computation
- Risk: Off-by-one in cutoff, double-counting in sum
- Priority: High — pure logic aside from AsyncStorage mock

**Untested: HbA1c formula (`src/services/storage.ts` — `computeAndCacheHba1c`)**
- What's not tested: Formula correctness for known input/output pairs
- Risk: Silent formula error goes unnoticed without reference values
- Priority: Medium

**Untested: carbEstimate rate limiting (`src/services/carbEstimate.ts`)**
- What's not tested: Daily limit enforcement, reset on date change, `RateLimitError` throw
- Risk: API over-spend if limit logic breaks
- Priority: Medium

**Untested: Glucose colour thresholds (duplicated in two files)**
- Files: `src/components/GlucoseDisplay.tsx` (as `getGlucoseColor`), `src/screens/MealHistoryScreen.tsx` (as `glucoseColor`)
- Risk: Threshold drift between copies — one gets updated, the other doesn't
- Priority: Low — but extraction into a shared utility would allow a single test

---

*Testing analysis: 2026-03-18*
