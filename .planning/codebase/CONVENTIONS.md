# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- Screens: PascalCase with `Screen` suffix — `HomeScreen.tsx`, `MealLogScreen.tsx`, `MealHistoryScreen.tsx`
- Services: camelCase — `nightscout.ts`, `storage.ts`, `carbEstimate.ts`, `matching.ts`, `settings.ts`
- Components: PascalCase — `GlucoseDisplay.tsx`
- Entry point: `App.tsx` (PascalCase), `index.ts` (camelCase re-export)

**Functions:**
- Async service functions: camelCase verb-noun — `fetchLatestGlucose()`, `saveMeal()`, `loadInsulinLogs()`, `updateGlucoseStore()`
- Event handlers in screens: camelCase `handle` prefix — `handleSave()`, `handleCamera()`, `handleEstimateCarbs()`, `handleFetchCurve()`
- Private/internal helpers: camelCase, prefixed with `_` when truly internal to a module — `_fetchCurveForSession()`
- Helper functions: descriptive camelCase — `tokenize()`, `jaccard()`, `totalInsulin()`, `glucoseColor()`, `formatDate()`
- React components (sub-components in screens): PascalCase — `MealCard`, `InsulinLogCard`, `GlucoseResponseCard`, `Stat`, `SectionHeader`

**Variables:**
- camelCase throughout — `avg12h`, `startGlucose`, `newEntries`, `mealMap`
- Boolean state: present-tense adjective or verb — `loading`, `saving`, `refreshing`, `estimating`, `fetching`, `rateLimitHit`
- Constants: SCREAMING_SNAKE_CASE for module-level constants — `POLL_INTERVAL_MS`, `THREE_HOURS_MS`, `MEALS_KEY`, `DAILY_LIMIT`, `STOP_WORDS`, `SIMILARITY_THRESHOLD`

**Types and Interfaces:**
- PascalCase for interfaces and types — `GlucoseEntry`, `GlucoseReading`, `Meal`, `Session`, `InsulinLog`
- Union types for discriminated unions — `InsulinLogType = 'long-acting' | 'correction' | 'tablets'`
- `SessionConfidence = 'high' | 'medium' | 'low'`
- Discriminated union pattern for merged history items: `type HistoryItem = { kind: 'meal'; data: Meal } | { kind: 'insulin'; data: InsulinLog }`
- Navigation params: `RootStackParamList` exported from `App.tsx`, imported as `type` in screens

## Code Style

**Formatting:**
- No formatter config file detected (no `.prettierrc`, no `biome.json`)
- Single quotes for strings consistently
- Trailing commas in multi-line objects and arrays
- Semicolons present throughout
- 2-space indentation

**TypeScript:**
- `strict: true` in `tsconfig.json` via `expo/tsconfig.base` extension
- Explicit return types are absent — inferred throughout
- `as any` used in two places in `src/services/carbEstimate.ts` (lines 94, 98) for untyped API response handling
- Type assertions used for JSON.parse results — `JSON.parse(raw) as Meal[]`
- `Omit<>` used to derive save-function parameter types from storage interfaces

## Import Organization

**Order (observed pattern):**
1. Third-party navigation imports — `@react-navigation/*`
2. Third-party library imports — `expo-image-picker`, `react-native`
3. React itself — `import React, { ... } from 'react'`
4. Local components — `../components/GlucoseDisplay`
5. Local services — `../services/storage`, `../services/nightscout`
6. Type-only imports — `import type { RootStackParamList } from '../../App'`

**Path Aliases:**
- None configured. Relative paths only (`../services/`, `../components/`, `../../App`)

**Destructuring:**
- React Native components always destructured from `'react-native'`
- Named exports destructured at import — `{ fetchLatestGlucose, fetchGlucosesSince, GlucoseReading }`

## Error Handling

**Async service calls in screens:**
- Wrapped in `try/catch` with `Alert.alert()` for user-facing errors
- Loading/saving state set to `false` in `finally` block always
- Non-critical background fetches (curve loading after save) use `.catch(() => {})` to swallow silently: `fetchAndStoreCurve(meal.id).catch(() => {})`
- Silent fallback for start glucose fetch: `try { const r = await fetchLatestGlucose(); startGlucose = r.mmol; } catch {}` — empty catch is intentional, `null` is the valid fallback

**Service functions:**
- Throw `new Error(message)` with descriptive messages: `throw new Error('Nightscout error: ' + response.status)`
- Return empty arrays on non-critical API failures: `if (!response.ok) return []`
- Custom error class for domain errors: `export class RateLimitError extends Error` in `src/services/carbEstimate.ts`
- Instance-check pattern in catch blocks: `err instanceof Error ? err.message : 'fallback'`
- `err instanceof RateLimitError` used to distinguish domain errors from generic ones

**State error display:**
- Error strings stored in state: `const [error, setError] = useState<string | null>(null)`
- Cleared at start of each load: `setError(null)`

## React Patterns

**Hooks:**
- `useState` for all local UI state
- `useCallback` wraps data loading functions to prevent re-creation — always used when passed to `useEffect` or `useFocusEffect`
- `useEffect` with `[loadData]` dependency for polling setup; cleanup returns `clearInterval`
- `useFocusEffect(useCallback(() => { load(); }, [load]))` pattern used in history and settings screens to reload on navigation focus
- `useRef<TextInput>` for programmatic focus

**Component structure:**
- Default export is the screen/component function
- Sub-components defined as named functions above the screen export (not as arrow functions in the same scope)
- `StyleSheet.create({})` called once at module bottom with grouped comments marking sections

**Navigation typing:**
- `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` for typed navigation in screens
- `useRoute<RouteProp<RootStackParamList, 'InsulinLog'>>()` for typed route params

## Logging

**Framework:** None. No logging library is used.

**Patterns:**
- No console.log statements present in source files
- Errors surfaced to user via `Alert.alert()` only

## Comments

**When to Comment:**
- Block comments above logical groups in `StyleSheet.create` — `// Header`, `// Glucose card`, `// Actions`
- Inline comments on interface fields explaining units or semantics — `// mmol/L at start of session`, `// epoch ms`
- Explanatory block comments above complex functions — JSDoc-style `/** ... */` used for `findSimilarSessions()` and `insulinSimilarity()`
- Section dividers in service files — `// --- public API ---`, `// --- rolling 30-day glucose store ---`
- Rationale comments for non-obvious decisions: `// count=9000 is a ceiling that only matters on first load`

**JSDoc/TSDoc:**
- Used selectively on exported service functions in `src/services/matching.ts`
- Not used on React component props or screen functions

## Module Design

**Exports:**
- Services export named functions and types — no default exports from service files
- Components export a single default — `export default function GlucoseDisplay`
- Screens export a single default — `export default function HomeScreen`
- `App.tsx` exports `RootStackParamList` as a named type alongside the default `App` component

**Constants:**
- Module-level storage key constants grouped at top of service files: `const MEALS_KEY = 'glucolog_meals'`
- Config objects keyed by union type used instead of switch statements: `const CONFIG: Record<InsulinLogType, {...}>` in `InsulinLogScreen.tsx`

## Colour System

All glucose colours are defined inline (not a shared constant) but follow a consistent pattern used in every file:
- Low (< 3.9 mmol/L): `'#FF3B30'`
- In range (3.9 – 10.0 mmol/L): `'#30D158'`
- High (> 10.0 mmol/L): `'#FF9500'`

The `glucoseColor()` helper is duplicated in `src/components/GlucoseDisplay.tsx` (as `getGlucoseColor`) and `src/screens/MealHistoryScreen.tsx` (as `glucoseColor`). No shared utility file exists for this.

## Data Formatting

- All glucose values displayed to 1 decimal place: `.toFixed(1)`
- Epoch IDs: `Date.now().toString()` for meal/session IDs
- ISO 8601 dates: `new Date().toISOString()` for `loggedAt` / `fetchedAt` fields
- Short date format: `new Date().toISOString().slice(0, 10)` for YYYY-MM-DD cache keys
- UK locale date display: `toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })`

---

*Convention analysis: 2026-03-18*
