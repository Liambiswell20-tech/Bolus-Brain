# Phase 3: Intelligence Layer — Matching and Outcome Surfacing - Research

**Researched:** 2026-03-21
**Domain:** React Native UI wiring — debounced live search, conditional slot rendering, TypeScript type widening
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Match Row Display (history cards)**
- D-01: Each match row shows: meal name + units + outcome badge + date + peak glucose
- D-02: Format: "[Meal name] — Xu · [date] · peak [X.X] mmol/L · [badge]"
- D-03: Up to 5 matches shown (enforced by `findSimilarSessions` MAX_MATCHES = 5)
- D-04: Section only appears when 2 or more matches exist — hide entirely if < 2 matches
- D-05: Section header: "You've eaten this before" (no advice, no recommendation language)

**Meal Log Live Matching**
- D-06: Matching triggers live as the user types the meal name — after a minimum of 2 characters
- D-07: Results appear inline directly below the meal name TextInput — no separate screen, no tap required
- D-08: Tapping a match row auto-fills the meal name field with that match's name
- D-09: Previous insulin amount shown as a hint in brackets next to the insulin field: "(Xu last time)" — factual display only, NEVER pre-filled, NEVER framed as a suggestion
- D-10: If no matches meet the threshold, the inline list is hidden entirely — no "no results" message

**"This Went Well" Success Indicator (PATT-02)**
- D-11: When a match's outcome badge is Green, show a green dot icon + short text "Went well" on that match row
- D-12: Indicator appears ONLY when outcome badge is Green — never shown when data is incomplete (Pending), no curve (None), or any other outcome
- D-13: Language is strictly factual: "Went well" describes what happened, not what to do

**No-Match State**
- D-14: When a meal has fewer than 2 past matches, the entire matching slot is hidden — no placeholder text, no "first time" message, complete silence
- D-15: This applies to both history cards and the meal log screen

**Safety / Legal (non-negotiable)**
- D-16: All match display text must be historical framing only — "last time", "previously", "went well" — never "you should", "try", "recommended", or any forward-looking language
- D-17: Insulin hint "(Xu last time)" is display-only. The insulin field must never be auto-populated or have a default derived from past data.

### Claude's Discretion

- Exact match row layout (flex direction, spacing, font sizes) — consistent with existing card styles
- Debounce delay for live matching (300–500ms recommended to avoid thrashing)
- How to bridge meal → session for history card matching (meal has sessionId; load sessions, find the one containing this meal, run findSimilarSessions against it)
- Whether to load all sessions once at MealHistoryScreen level and pass down, or load per-card on expand

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PATT-01 | When viewing an expanded history card or logging a new meal, user sees a "You've eaten this before" section showing up to 5 matching past sessions — displayed as historical format with no advice or recommendation | `findSimilarSessions` already built and tested; `MatchSummary.matches` returns up to MAX_MATCHES=5; wire into ExpandableCard matching slot stub and MealLogScreen inline list |
| PATT-02 | Meals where glucose stayed in range (Green outcome) are marked as successful — when a matching meal appears in the section, the successful flag is surfaced ("This went well last time") | `classifyOutcome()` already classifies per-session; GREEN = peakGlucose ≤ 10.0 AND endGlucose 3.9–10.0; "Went well" indicator shown conditionally on badge === 'GREEN' |
</phase_requirements>

---

## Summary

Phase 3 is a pure UI wiring phase. The matching engine (`findSimilarSessions`), outcome classifier (`classifyOutcome`), and the `OutcomeBadge` component are all fully built from Phase 2. The matching slot stub in `ExpandableCard` (lines 181–185) renders a greyed-out "Loading..." placeholder and explicitly marks itself as a Phase 3 wire-in point. The `MatchingSlotProps` interface in `types.ts` holds `matchData: null` with an inline comment saying Phase 3 will widen this type.

The two integration surfaces are: (1) expanded history cards — which have sessions already loaded at screen level via `loadSessionsWithMeals()`, making session lookup free; and (2) MealLogScreen — which needs a debounced `useEffect` on `mealName` state to build a synthetic target session and call `findSimilarSessions`. No new packages, no new data model changes, no migrations. The full UI specification has already been produced in `03-UI-SPEC.md` with exact copy, colors, font sizes, spacing, and states — this is a rare phase where the UI-SPEC is the primary implementation contract.

The only non-trivial design decision remaining for the planner is the session-loading strategy for ExpandableCard: load all sessions once at MealHistoryScreen level and pass them down through props, or load per-card on expand. Research finding: load-once at screen level is clearly correct — `loadSessionsWithMeals()` is already called at screen load in `MealHistoryScreen`, so the sessions array is available in state at `silentRefresh` time. Passing it as a prop to `ExpandableCard` avoids any AsyncStorage calls inside a per-card expand handler.

**Primary recommendation:** Wire Phase 3 in three tasks: (1) widen `MatchingSlotProps` type and build the `MatchingSlot` sub-component inside `ExpandableCard`; (2) update `MealHistoryScreen` to pass `allSessions` down to each `ExpandableCard` and compute `matchData` per meal; (3) add debounced live matching and insulin hint to `MealLogScreen`.

---

## Standard Stack

No new packages are introduced in this phase. All functionality uses existing dependencies.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native | 0.81.5 | Core UI primitives (View, Text, Pressable, TextInput, Keyboard) | App foundation |
| react (hooks) | 19.1.0 | `useState`, `useEffect`, `useCallback`, `useRef` | App foundation |
| TypeScript | ~5.9.2 | Type widening for `MatchingSlotProps.matchData` | App foundation |

### Reusable Project Assets
| Asset | Location | Purpose |
|-------|----------|---------|
| `findSimilarSessions` | `src/services/matching.ts` | Returns `MatchSummary | null` with up to 5 `SessionMatch[]` |
| `classifyOutcome` | `src/utils/outcomeClassifier.ts` | Determines GREEN / ORANGE / DARK_AMBER / RED / PENDING / NONE |
| `OutcomeBadge` | `src/components/OutcomeBadge.tsx` | Coloured pill badge, supports `size="small"` |
| `glucoseColor(mmol)` | `src/components/ExpandableCard.tsx` (local) | Returns `#FF3B30` / `#30D158` / `#FF9500` based on mmol range |
| `loadSessionsWithMeals()` | `src/services/storage.ts` | Loads all sessions with their meals, newest-first |
| `SessionWithMeals` | `src/services/storage.ts` | Interface with `.meals`, `.startedAt`, `.glucoseResponse`, `.confidence` |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No new files or folders are created. Modifications are:

```
src/
├── components/
│   ├── types.ts             # Widen MatchingSlotProps.matchData type
│   └── ExpandableCard.tsx   # Replace placeholder block, add allSessions prop
├── screens/
│   ├── MealHistoryScreen.tsx  # Pass allSessions to each ExpandableCard
│   └── MealLogScreen.tsx      # Add debounced live matching + insulin hint
└── services/
    └── matching.ts          # No changes — already complete
```

### Pattern 1: Type Widening for MatchingSlotProps

**What:** Widen `matchData` from `null` to `null | MatchSummary`. `ExpandableCardProps.matchingSlot` flows through automatically — no other interface changes.

**When to use:** Exactly once, in `src/components/types.ts`.

**Example:**
```typescript
// src/components/types.ts
import type { MatchSummary } from '../services/matching';

export interface MatchingSlotProps {
  matchData: null | MatchSummary;
}
```

Note: `ExpandableCardProps.matchingSlot: MatchingSlotProps` already exists — no change needed there. All callers currently pass `{ matchData: null }` which remains valid.

### Pattern 2: Session-Level Data Flow (Load-Once Strategy)

**What:** `MealHistoryScreen` already loads all sessions at screen level. The plan is to pass `allSessions` as a prop to each `ExpandableCard`, which then calls `findSimilarSessions` when expanded, rather than making async calls per card.

**Why load-once beats per-card async:**
- `loadSessionsWithMeals()` is already called on every `useFocusEffect` and `silentRefresh` — sessions are already in memory
- Per-card async loading on expand would mean repeated AsyncStorage reads and introduce async state within `ExpandableCard`
- `findSimilarSessions` is a pure synchronous function — it only needs the sessions array, no I/O

**Implementation:** Add `allSessions: SessionWithMeals[]` to `ExpandableCardProps`. In `MealHistoryScreen`, pass `sessions` state down. In `ExpandableCard`, when `expanded` becomes true, call `findSimilarSessions(targetSession, allSessions)` synchronously.

**Bridge from Meal to Session:** `Meal.sessionId` is the link. The expanded card knows its `meal.sessionId`. Find the matching session from `allSessions` using `allSessions.find(s => s.id === meal.sessionId)`. If not found (legacy meal with no sessionId), treat as `null` — no matching slot shown.

```typescript
// Inside ExpandableCard when expanded
const targetSession = allSessions.find(s => s.id === meal.sessionId) ?? null;
const matchSummary = targetSession ? findSimilarSessions(targetSession, allSessions) : null;
```

### Pattern 3: Debounced Live Search in MealLogScreen

**What:** `useEffect` watching `mealName` state, using `setTimeout`/`clearTimeout` pattern for 300ms debounce. Calls `findSimilarSessions` with a synthetic target session built from current text input. Clears results when input < 2 chars.

**When to use:** Exactly in `MealLogScreen`, triggered by `mealName` state changes.

**Example:**
```typescript
// Source: CONTEXT.md D-06, D-07 + 03-UI-SPEC.md
const [liveMatches, setLiveMatches] = useState<SessionMatch[]>([]);
const [lastTappedSession, setLastTappedSession] = useState<SessionWithMeals | null>(null);

useEffect(() => {
  if (mealName.trim().length < 2) {
    setLiveMatches([]);
    return;
  }
  const timer = setTimeout(async () => {
    const allSessions = await loadSessionsWithMeals();
    // Build synthetic session from current input
    const syntheticSession: SessionWithMeals = {
      id: '__live_search__',
      mealIds: [],
      startedAt: new Date().toISOString(),
      confidence: 'high',
      glucoseResponse: null,
      meals: [{
        id: '__live_search_meal__',
        name: mealName.trim(),
        photoUri: null,
        insulinUnits: 0,
        startGlucose: null,
        carbsEstimated: null,
        loggedAt: new Date().toISOString(),
        sessionId: '__live_search__',
        glucoseResponse: null,
      }],
    };
    const summary = findSimilarSessions(syntheticSession, allSessions);
    setLiveMatches(summary?.matches ?? []);
  }, 300);
  return () => clearTimeout(timer);
}, [mealName]);
```

**Key detail on insulin hint state:** After a user taps a match row, store the tapped session's insulin total as `lastTappedInsulinHint: number | null`. This drives the `(Xu last time)` display next to the insulin label. The `insulinUnits` TextInput state itself is NEVER touched. Clear the hint when `mealName` changes after a tap (if the user edits the name again, the hint is stale).

### Pattern 4: MatchingSlot Component (Inline in ExpandableCard)

**What:** Replace lines 181–185 (the placeholder block) in `ExpandableCard.tsx` with a conditional render using the resolved `matchSummary`. If `matchSummary === null` or `matchSummary.matches.length < 2`, render nothing — not even the `<View style={styles.matchingSlot}>` wrapper.

**Why render nothing (not empty container):** D-04/D-14 require complete silence when < 2 matches. Rendering an empty bordered container would look like a visual bug.

**Match row per-row data needed:**
- `match.session.meals[0].name` — first meal name in matched session (use first meal for display)
- Total insulin: `match.session.meals.reduce((sum, m) => sum + (m.insulinUnits ?? 0), 0)`
- Date: `match.session.startedAt` formatted as `"Wed 18 Mar"`
- Peak glucose: `match.session.glucoseResponse!.peakGlucose` — safe because `findSimilarSessions` only includes sessions with non-null, non-partial `glucoseResponse`
- Outcome badge: `classifyOutcome(match.session.glucoseResponse)` — compute at render time
- "Went well" indicator: only when badge === `'GREEN'`
- Confidence warning: when `match.session.confidence !== 'high'`

### Anti-Patterns to Avoid

- **Pre-filling insulin units:** The insulin `TextInput` value must never be set from past data. Only the hint label text changes. Violates D-17 and legal constraint.
- **Async per-card match loading:** Each expand firing `loadSessionsWithMeals()` causes performance degradation on lists with many meals. Use the load-once pattern.
- **Showing the matching slot wrapper when empty:** Renders a visible empty area with a border line. Silence means no `<View>` rendered, not an empty `<View>`.
- **Re-running `findSimilarSessions` on every render:** Compute match results once on expand/name-change, cache in local state inside ExpandableCard.
- **Using forward-looking language:** Any string containing "should", "try", "recommended", "next time", "your usual dose" violates REQUIREMENTS.md and CLAUDE.md safety rules.
- **Showing insulin hint before a match is tapped:** The `(Xu last time)` hint only appears after the user taps a row in the live list — not while they are browsing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Outcome classification | Custom badge logic | `classifyOutcome()` in `outcomeClassifier.ts` | Already built, tested (8 test cases in `outcomeClassifier.test.ts`), covers all 6 states |
| Session matching | Custom similarity algorithm | `findSimilarSessions()` in `matching.ts` | Built with Jaccard tokenization, weighted insulin similarity, SIMILARITY_THRESHOLD=0.25, MAX_MATCHES=5 |
| Debounce | Custom hook or lodash.debounce | `useEffect` + `setTimeout`/`clearTimeout` | CONTEXT.md explicitly says "implement with useEffect + setTimeout clearTimeout"; no new package needed |
| Outcome badge rendering | Custom pill component | `OutcomeBadge` in `components/OutcomeBadge.tsx` | Already built with 5-state CONFIG, two sizes, returns null for NONE |
| Glucose value coloring | Custom color function | `glucoseColor(mmol)` already in `ExpandableCard.tsx` | Use by extracting to a shared util or duplicating the 3-line function — do not reinvent |

**Key insight:** This phase is intentionally a wiring phase — all the hard logic was built in earlier phases. The risk is over-engineering: adding new matching logic, new storage fields, or new packages where none are needed.

---

## Common Pitfalls

### Pitfall 1: Session Not Found for Legacy Meals

**What goes wrong:** Some meals have `sessionId = null` (pre-migration data) or `sessionId` that resolves to a `legacy_` session created by `migrateLegacySessions`. Calling `allSessions.find(s => s.id === meal.sessionId)` returns `undefined` for `null` sessionId.

**Why it happens:** Legacy migration creates sessions with `id: 'legacy_migrated_${m.id}'` — these exist in the sessions array. But some meals may have `sessionId: null` if migration hasn't run yet or failed.

**How to avoid:** Always guard: `const targetSession = meal.sessionId ? allSessions.find(s => s.id === meal.sessionId) ?? null : null`. If `null`, skip matching entirely — render nothing in the slot.

**Warning signs:** TypeScript will not warn — `Array.find` returns `SessionWithMeals | undefined` which needs a `?? null` fallback.

### Pitfall 2: findSimilarSessions Called with Sessions Array Containing Target

**What goes wrong:** `findSimilarSessions` filters out `s.id !== target.id` — this works for real sessions. But the synthetic target session created in `MealLogScreen` has id `'__live_search__'` — no real session will have that id, so no exclusion bug. However if a real session is accidentally passed as the target AND is also in `allSessions`, the filter handles it correctly.

**Why it happens:** Not a real risk with the synthetic session approach, but worth confirming the id uniqueness guard exists.

**How to avoid:** Use a clearly impossible id like `'__live_search__'` for the synthetic session.

### Pitfall 3: glucoseColor() Not Exported from ExpandableCard

**What goes wrong:** `glucoseColor()` is declared as a module-level function in `ExpandableCard.tsx` but is NOT exported. It cannot be imported by `MealLogScreen.tsx` or an inline `MatchingSlot` component.

**Why it happens:** Was built as a private helper for that file only.

**How to avoid:** Two valid options:
1. Duplicate the 3-line function in each file that needs it (acceptable — it's trivial and unlikely to change)
2. Extract to `src/utils/glucoseColor.ts` and export — then import from both files

The planner should pick option 2 (extract) if both `ExpandableCard` and `MealLogScreen` need it. This avoids duplication and aligns with the "pure function shared util" pattern already used for `classifyOutcome` and `buildGlucoseResponse`.

**Warning signs:** TypeScript import error — `glucoseColor` not found in module.

### Pitfall 4: Debounce Fires After Component Unmount (MealLogScreen)

**What goes wrong:** User starts typing, navigates away before the 300ms debounce fires, `setLiveMatches` called on unmounted component — React warning in development, potential stale state issue.

**Why it happens:** The `return () => clearTimeout(timer)` cleanup in `useEffect` handles navigation away correctly — the cleanup runs on unmount. This is the standard React pattern.

**How to avoid:** The `useEffect` cleanup (`return () => clearTimeout(timer)`) is the correct and complete solution. No `isMounted` ref needed. Confirm cleanup is present in implementation.

### Pitfall 5: Stale Insulin Hint After Name Edit

**What goes wrong:** User types "pasta", sees matches, taps a match (insulin hint appears showing "6u last time"), then edits the meal name field. The hint still shows "6u last time" from the previous tap even though they've changed the name.

**Why it happens:** The hint state (`lastTappedInsulinHint`) is only cleared on tap, not on subsequent name changes.

**How to avoid:** Clear `lastTappedInsulinHint` in the debounce `useEffect` whenever `mealName` changes. Or clear it explicitly in the `onChangeText` handler for the meal name input. Either is correct — the planner should specify which.

### Pitfall 6: MatchingSlot Renders During Collapse Animation

**What goes wrong:** `ExpandableCard` uses `LayoutAnimation.easeInEaseOut` for expand/collapse. If matching data is computed synchronously on expand, the slot renders immediately and may flicker during the animation.

**Why it happens:** The existing animation triggers in `handleToggle` synchronously sets `expanded = true`. If matchSummary is computed on first render with `expanded = true`, React renders everything at once before the animation begins.

**How to avoid:** This is not actually a problem — `LayoutAnimation.configureNext` tells the layout system to animate the NEXT layout change. The content renders immediately; only the geometry transition is animated. The match slot appearing instantly inside an animating card is the correct, intended behaviour.

### Pitfall 7: matchData Prop Mismatch — All Callers Pass `{ matchData: null }`

**What goes wrong:** After widening `MatchingSlotProps.matchData` to `null | MatchSummary`, all existing call sites in `MealHistoryScreen` still pass `{ matchData: null }`. This is valid TypeScript (null is still assignable). However the passing of real data requires changing the prop at each `<ExpandableCard>` call site. Easy to forget one.

**Why it happens:** There are two `<ExpandableCard>` call sites in `MealHistoryScreen` (one for `today-meal` rows, one for `past-meal` rows — both at line 455-461 in the same renderItem block).

**How to avoid:** Search for all occurrences of `matchingSlot={{ matchData: null }}` after implementing — there should be zero after the migration. The planner should make this a verification step.

---

## Code Examples

Verified patterns from official codebase inspection:

### MatchingSlot Visibility Gate
```typescript
// Source: CONTEXT.md D-04, D-14 + ExpandableCard.tsx current stub
// Replace lines 181–185 in ExpandableCard.tsx
{matchSummary && matchSummary.matches.length >= 2 && (
  <View style={styles.matchingSlot}>
    {/* section header + rows */}
  </View>
)}
```

### Session Total Insulin (for match row display)
```typescript
// Source: matching.ts totalInsulin() function (internal) — replicate pattern
const sessionInsulin = (session: SessionWithMeals): number =>
  session.meals.reduce((sum, m) => sum + (m.insulinUnits ?? 0), 0);
```

### Match Row Date Formatting
```typescript
// Source: 03-UI-SPEC.md Copywriting Contract
new Date(session.startedAt).toLocaleDateString('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
// Output: "Wed 18 Mar"
```

### "Went well" Indicator
```typescript
// Source: 03-UI-SPEC.md Component Inventory — MatchingSlot section
// ONLY rendered when badge === 'GREEN'
{badge === 'GREEN' && (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#30D158' }} />
    <Text style={{ fontSize: 11, fontWeight: '600', color: '#30D158' }}>Went well</Text>
  </View>
)}
```

### Confidence Warning Text
```typescript
// Source: 03-UI-SPEC.md — confidence warning for matched sessions
{match.session.confidence !== 'high' && (
  <Text style={{ fontSize: 11, color: '#636366', fontStyle: 'italic' }}>
    Other meals may have affected these results
  </Text>
)}
```

### Insulin Hint Display (MealLogScreen)
```typescript
// Source: CONTEXT.md D-09, D-17 + 03-UI-SPEC.md
// Adjacent to the "Insulin units" label — NOT in the TextInput
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  <Text style={styles.label}>Insulin units</Text>
  {insulinHint !== null && (
    <Text style={{ fontSize: 12, color: '#636366', fontStyle: 'italic' }}>
      ({insulinHint}u last time)
    </Text>
  )}
</View>
```

### Debounce + Synthetic Session Pattern
```typescript
// Source: CONTEXT.md Claude's Discretion + 03-UI-SPEC.md Interaction Contract
useEffect(() => {
  if (mealName.trim().length < 2) {
    setLiveMatches([]);
    setInsulinHint(null); // clear stale hint when input goes below threshold
    return;
  }
  const timer = setTimeout(async () => {
    const allSessions = await loadSessionsWithMeals();
    const syntheticSession: SessionWithMeals = {
      id: '__live_search__',
      mealIds: [],
      startedAt: new Date().toISOString(),
      confidence: 'high',
      glucoseResponse: null,
      meals: [{
        id: '__live_search_meal__',
        name: mealName.trim(),
        photoUri: null,
        insulinUnits: 0,
        startGlucose: null,
        carbsEstimated: null,
        loggedAt: new Date().toISOString(),
        sessionId: '__live_search__',
        glucoseResponse: null,
      }],
    };
    const summary = findSimilarSessions(syntheticSession, allSessions);
    setLiveMatches(summary?.matches ?? []);
  }, 300);
  return () => clearTimeout(timer);
}, [mealName]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 2 placeholder: `<Text style={styles.matchingPlaceholder}>Loading...</Text>` | Phase 3 wire-in: real match data or silence | Phase 3 | Replace lines 181–185 in ExpandableCard |
| `matchData: null` (locked type) | `matchData: null \| MatchSummary` | Phase 3 | Type widening in types.ts |
| No live matching in MealLogScreen | Debounced live search on `mealName` | Phase 3 | New useEffect + state in MealLogScreen |

---

## Open Questions

1. **glucoseColor() extraction**
   - What we know: Function exists in `ExpandableCard.tsx` as a private helper — not exported. `MealLogScreen` will also need it for peak glucose coloring on match rows.
   - What's unclear: Whether to extract to `src/utils/glucoseColor.ts` or duplicate inline.
   - Recommendation: Extract to `src/utils/glucoseColor.ts` and update `ExpandableCard` to import it. This is a small task that prevents a copy-paste pattern.

2. **MatchSummary export for session-level insulin display**
   - What we know: Each `SessionMatch` in `MatchSummary.matches` contains the full `SessionWithMeals` object. The meal name used for display is `match.session.meals[0].name` (first meal in the matched session). Total insulin is computed from `meals.reduce`.
   - What's unclear: For multi-meal sessions (confidence !== 'high'), which meal name to show — first by time, or the one with the highest name-token overlap with the target?
   - Recommendation: Always show `match.session.meals[0].name` (first by `loggedAt`). This is consistent with how `sessionTokens()` in `matching.ts` treats multi-meal sessions as a bag of tokens without hierarchy. Keep it simple.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest-expo 54.0.17 + jest 29.7.0 |
| Config file | `package.json` (jest key) — `testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"]` |
| Quick run command | `npm test -- --testPathPattern="matching"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PATT-01 | `findSimilarSessions` returns null when < 2 matches exist | unit | `npm test -- --testPathPattern="matching"` | ❌ Wave 0 |
| PATT-01 | `findSimilarSessions` returns MatchSummary with correct matches when >= 2 exist | unit | `npm test -- --testPathPattern="matching"` | ❌ Wave 0 |
| PATT-01 | MatchingSlot renders nothing when matchData is null | unit | `npm test -- --testPathPattern="ExpandableCard"` | ❌ Wave 0 (manual-only acceptable for RN component) |
| PATT-02 | "Went well" indicator only shown when classifyOutcome returns GREEN | unit | `npm test -- --testPathPattern="outcomeClassifier"` | ✅ existing — classifyOutcome tested for GREEN |
| PATT-02 | "Went well" indicator NOT shown for ORANGE, RED, DARK_AMBER, PENDING, NONE | unit | `npm test -- --testPathPattern="outcomeClassifier"` | ✅ existing — all 5 non-GREEN states tested |

**Note on React Native component tests:** `ExpandableCard.tsx` and `MealLogScreen.tsx` are React Native components that use native modules (`LayoutAnimation`, `UIManager`, `Keyboard`). Testing them with jest-expo requires setting up mocks for native modules. The value-to-effort ratio for unit testing UI rendering logic in this phase is LOW — the logic being tested (conditional rendering, debounce firing) is better verified by the full suite smoke tests. The `findSimilarSessions` function and `classifyOutcome` are the safety-adjacent logic worth unit testing.

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="matching|outcomeClassifier|storage"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/matching.test.ts` — covers PATT-01: `findSimilarSessions` returns null for 0/1 matches, returns MatchSummary for 2+ matches, excludes same-day sessions, excludes partial glucoseResponse sessions, enforces MAX_MATCHES=5

*(Existing test infrastructure: `src/utils/outcomeClassifier.test.ts` and `src/services/storage.test.ts` cover all PATT-02 classification logic. Only matching.test.ts is missing.)*

---

## Sources

### Primary (HIGH confidence)
- `src/services/matching.ts` — full source read; `findSimilarSessions`, `SessionMatch`, `MatchSummary` interfaces; `SIMILARITY_THRESHOLD=0.25`, `MAX_MATCHES=5`, `sameDay` exclusion, partial exclusion
- `src/components/ExpandableCard.tsx` — full source read; matching slot stub at lines 181–185; `glucoseColor()` local function; existing style tokens
- `src/components/types.ts` — full source read; `MatchingSlotProps.matchData: null`; Phase 3 wire-in comment
- `src/utils/outcomeClassifier.ts` — full source read; `classifyOutcome` logic; `OutcomeBadge` type union
- `src/services/storage.ts` — full source read; `SessionWithMeals`, `Meal`, `Session` interfaces; `loadSessionsWithMeals()`, `Meal.sessionId`
- `src/screens/MealHistoryScreen.tsx` — full source read; `sessions` state already loaded; `<ExpandableCard matchingSlot={{ matchData: null }}>`; two call sites for ExpandableCard
- `src/screens/MealLogScreen.tsx` — full source read; `mealName` state; `useEffect` already imported; no existing debounce
- `src/components/OutcomeBadge.tsx` — full source read; CONFIG map; `size="small"` support; returns null for NONE
- `.planning/phases/03-intelligence-layer-matching-and-outcome-surfacing/03-UI-SPEC.md` — full read; exact copy strings; color tokens; spacing scale; states table; confidence warning exact text
- `.planning/phases/03-intelligence-layer-matching-and-outcome-surfacing/03-CONTEXT.md` — full read; all locked decisions D-01 through D-17

### Secondary (MEDIUM confidence)
- `package.json` jest config — confirmed `testMatch` scope, `jest-expo` preset, AsyncStorage mock
- `src/services/storage.test.ts`, `src/utils/outcomeClassifier.test.ts` — existing test patterns; confirms test file naming convention

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all code read directly from source
- Architecture: HIGH — matching engine, type interfaces, and integration points fully verified
- Pitfalls: HIGH — derived from direct code inspection (glucoseColor not exported, dual ExpandableCard call sites, null sessionId guard)
- Validation: HIGH — test framework confirmed from package.json; existing tests confirmed as covering classifyOutcome

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable codebase; no external API dependencies in this phase)
