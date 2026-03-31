# Phase 8: B2B Data Capture Layer - Research

**Researched:** 2026-03-31
**Domain:** React Native / Expo (TypeScript) — data modelling, navigation gating, AppState lifecycle, AsyncStorage patterns
**Confidence:** HIGH — all findings are based on direct source-code inspection of the live codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Equipment onboarding gate: hard gate, no skip, shown on every fresh install or storage clear. Gate check: `equipment_changelog` key empty/missing → show EquipmentOnboardingScreen. Four mandatory pickers, one optional pen needle picker (only when delivery method is a pen type).
- Equipment changelog data model: `src/types/equipment.ts` (verbatim interfaces in CONTEXT.md). `src/utils/equipmentProfile.ts` (verbatim function signatures in CONTEXT.md). Single shared timestamp in `changeEquipment` — `ended_at === started_at`.
- Equipment change confirmation modal: `EquipmentChangeConfirmation.tsx` — user must confirm before `changeEquipment()` is called.
- Equipment settings section: "My Equipment" section in SettingsScreen, all active fields with edit capability.
- Meal stamping: `getCurrentEquipmentProfile()` called once at save time → `rapidInsulinBrand` → `insulin_brand`, `deliveryMethod` → `delivery_method`. Read-only chip shown after units input. `Meal` interface extended with optional `insulin_brand?` and `delivery_method?`. Stamped fields are immutable — never edited.
- Hypo treatment quick log: "Treating a low?" button on HomeScreen below AveragedStatsPanel, above Log Meal / Quick Log buttons, red/amber colour token, always visible. HypoTreatmentSheet: current glucose read-only, treatment type picker, amount_value + amount_unit inline, Save / Cancel. Recovery curve: next app foreground after logged_at + 60 min window.
- TIR calculation: `src/utils/timeInRange.ts`. `calculateDailyTIR()` pure function. Triggered on app foreground once per calendar day. Calculates yesterday's TIR. Writes if no record for date. Prunes to 90 days. No UI display.
- Data consent toggle: "Data & Research" section in SettingsScreen. OFF by default. `DataConsent` with `consented`, `consented_at`, `version`. Re-consent modal when version changes. CURRENT_CONSENT_VERSION = "1.0".
- Unit tests: `src/__tests__/equipmentProfile.test.ts` (11 cases), `src/__tests__/timeInRange.test.ts` (6 cases) — see CONTEXT.md for exact case descriptions.
- Safety rules: no dosing advice, no prediction logic, stamped meal fields immutable, no AI features.
- AsyncStorage keys: `equipment_changelog`, `hypo_treatments`, `daily_tir`, `data_consent`.

### Claude's Discretion

- Navigation implementation for onboarding gate (conditional stack vs modal stack)
- Exact styling of equipment pickers (consistent with existing SettingsScreen patterns)
- Exact hypo treatment button label copy (keep medically neutral)
- AppState foreground listener placement (App.tsx or a custom hook)
- Error handling for missing equipment profile at meal save time (edge case: storage cleared mid-session)

### Deferred Ideas (OUT OF SCOPE)

- TIR UI display
- Data export / anonymisation pipeline
- Aggregation dashboards
- Hypo "Other" free-text field
- Backend migration
- Consent copy legal review
- IRB / ethics review
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| B2B-01 | Mandatory equipment onboarding gate — full-screen before HomeScreen, 4 mandatory pickers + 1 optional pen needle | Navigation gate pattern in App.tsx identified; no AppState listener currently exists |
| B2B-02 | Equipment changelog data model — `src/types/equipment.ts`, `src/utils/equipmentProfile.ts`, all 4 utility functions | `src/types/` directory does not exist yet; `src/utils/` directory exists and holds formatDate, glucoseColor, glucoseToArcAngle, mealFingerprint, outcomeClassifier |
| B2B-03 | Equipment change confirmation modal — shown before any equipment change | SettingsScreen modal pattern confirmed (uses Alert or inline Modal); HomeScreen inline Modal pattern is the reference |
| B2B-04 | Equipment settings section — "My Equipment" in SettingsScreen | SettingsScreen structure fully mapped: SectionHeader + card + NavRow/SettingRow primitives available |
| B2B-05 | Meal stamping — `getCurrentEquipmentProfile()` at save in MealLogScreen; Meal interface extended | `saveMeal()` call site in MealLogScreen.handleSave() identified; Meal interface in storage.ts identified for extension |
| B2B-06 | Hypo treatment quick log — button on HomeScreen, HypoTreatmentSheet, recovery curve on next foreground | HomeScreen layout fully mapped; AveragedStatsPanel is the last item before actionRow; no AppState listener currently in HomeScreen |
| B2B-07 | TIR calculation — `src/utils/timeInRange.ts`, once per day on foreground, 90-day pruning | Nightscout `fetchGlucoseRange` and `fetchGlucosesSince` patterns identified for fetching yesterday's readings |
| B2B-08 | Data consent toggle — "Data & Research" section in SettingsScreen, OFF by default, version-aware | SettingsScreen save pattern confirmed: `saveSettings()` with partial merge; new consent stored under separate key |
</phase_requirements>

---

## Summary

Phase 8 is a pure data-capture phase built on top of a completed Phase 4 codebase. The primary technical challenge is not any single feature but the coordination of eight related deliverables across navigation, storage, UI, and background lifecycle layers.

The codebase is clean and well-structured. There are no existing `src/types/` files — this phase creates the first one (`equipment.ts`). The `src/utils/` directory exists and holds five utility files. The `src/services/` directory holds storage, nightscout, settings, matching, and carbEstimate. No AppState listener exists anywhere in the current codebase — this phase will introduce the first one.

The navigation gate (B2B-01) is the load-bearing foundation for all other features: it must be implemented first, since every subsequent feature assumes the `equipment_changelog` key is populated. The planner should sequence this as Wave 1. Meal stamping (B2B-05) and the TIR calculation (B2B-07) both depend on equipment profile data being present.

**Primary recommendation:** Gate implementation in this order — (1) types + equipmentProfile utilities + tests, (2) onboarding gate screen + navigation wire-in, (3) SettingsScreen equipment section + confirmation modal, (4) meal stamping + read-only chip, (5) HypoTreatmentSheet + HomeScreen button, (6) TIR utility + AppState trigger + tests, (7) consent toggle.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-native-async-storage/async-storage` | 2.2.0 | All new key/value stores | Already the project storage layer |
| `react-native` (Modal) | 0.81.5 | HypoTreatmentSheet, EquipmentChangeConfirmation | Already used for QuickLog and HbA1c modals in HomeScreen |
| `react-native` (AppState) | 0.81.5 | TIR foreground trigger, hypo recovery curve trigger | Built-in; no extra install |
| `@react-navigation/native-stack` | 7.14.4 | Onboarding gate navigation | Already the navigation layer |

### No New Dependencies Required

All features in Phase 8 can be implemented using existing installed packages. The table below confirms this explicitly:

| Feature | Package Needed | Status |
|---------|----------------|--------|
| Equipment types | TypeScript only | Already in project |
| AsyncStorage CRUD | `@react-native-async-storage/async-storage` | Already installed |
| Picker (equipment fields) | React Native `Modal` + `Pressable` list | Already installed |
| AppState listener | `react-native` AppState | Already installed |
| Navigation gate | `@react-navigation/native-stack` | Already installed |
| Nightscout fetch for TIR | `src/services/nightscout.ts` | Already exists |

**Installation:** No new `npm install` required for this phase.

---

## Architecture Patterns

### Recommended Project Structure (additions)

```
src/
├── types/
│   └── equipment.ts         # NEW — EquipmentChangeEntry, HypoTreatment, DailyTIR, DataConsent
├── utils/
│   ├── equipmentProfile.ts  # NEW — getActiveEquipment, getCurrentEquipmentProfile, getEquipmentAtTime, changeEquipment
│   ├── timeInRange.ts       # NEW — calculateDailyTIR, getDailyTIRHistory
│   ├── formatDate.ts        # existing
│   ├── glucoseColor.ts      # existing
│   ├── glucoseToArcAngle.ts # existing
│   ├── mealFingerprint.ts   # existing
│   └── outcomeClassifier.ts # existing
│   └── __tests__/
│       ├── formatDate.test.ts     # existing
│       └── glucoseToArcAngle.test.ts  # existing
├── components/
│   └── EquipmentChangeConfirmation.tsx  # NEW
├── screens/
│   └── EquipmentOnboardingScreen.tsx   # NEW
├── services/
│   └── storage.ts           # MODIFIED — Meal interface extended
└── __tests__/
    ├── equipmentProfile.test.ts  # NEW — 11 cases
    └── timeInRange.test.ts       # NEW — 6 cases
```

Note: the `src/__tests__/` directory does not currently exist. The two new test files go there per the CONTEXT.md specification. The Jest `testMatch` pattern `<rootDir>/src/**/*.test.ts` will pick them up automatically.

### Pattern 1: Navigation Gate (B2B-01)

**What:** App.tsx reads `equipment_changelog` from AsyncStorage before rendering. If empty/missing, renders EquipmentOnboardingScreen as the initial route instead of HomeScreen.

**When to use:** First-launch and fresh-install guard.

**Recommended approach (Claude's Discretion — conditional initial route):**

```typescript
// App.tsx addition
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [gateChecked, setGateChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('equipment_changelog')
      .then(raw => {
        const entries = raw ? JSON.parse(raw) : [];
        setNeedsOnboarding(!Array.isArray(entries) || entries.length === 0);
      })
      .catch(() => setNeedsOnboarding(true))
      .finally(() => setGateChecked(true));
  }, []);

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: '#050706' }} />;
  if (!gateChecked) return <View style={{ flex: 1, backgroundColor: '#050706' }} />;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={needsOnboarding ? 'EquipmentOnboarding' : 'Home'}>
          <Stack.Screen name="EquipmentOnboarding" component={EquipmentOnboardingScreen}
            options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          {/* ... existing screens ... */}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
```

`RootStackParamList` must be extended with `EquipmentOnboarding: undefined`.

After the user completes onboarding, EquipmentOnboardingScreen calls `navigation.replace('Home')` — which removes the onboarding screen from the stack and prevents back navigation.

**Why conditional initial route over a modal stack:** The gate must be a hard block with no back gesture. `gestureEnabled: false` + `navigation.replace` on the onboarding screen is simpler to reason about than a modal navigator and avoids any possibility of the user dismissing it.

### Pattern 2: AppState Foreground Listener (B2B-06, B2B-07)

**What:** React Native's `AppState` API fires when the app transitions to `'active'`.

**When to use:** TIR calculation (once per calendar day) and hypo recovery curve fetch (if logged_at + 60 min < now).

**Recommended placement (Claude's Discretion):** A custom hook `useAppForeground(callback)` called from App.tsx. This keeps App.tsx clean and the hook reusable.

```typescript
// src/hooks/useAppForeground.ts
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useAppForeground(callback: () => void) {
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current !== 'active' && next === 'active') {
        callback();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [callback]);
}
```

Called from App.tsx:

```typescript
useAppForeground(useCallback(() => {
  handleForeground().catch(err => console.warn('[App] foreground handler error', err));
}, []));
```

The `handleForeground` async function calls both `runTirCalculation()` and `fetchPendingHypoRecoveries()`. Both are fire-and-forget; errors must be caught and swallowed (never crash the app on foreground).

### Pattern 3: Equipment Profile Utilities (B2B-02)

**What:** `src/utils/equipmentProfile.ts` — pure async functions that read/write `equipment_changelog` in AsyncStorage.

**Key invariant:** `changeEquipment` MUST generate one `Date.now()` call and use the result as both `ended_at` on the closing entry and `started_at` on the new entry. Two separate calls would violate data integrity.

```typescript
// Correct — single timestamp
const now = new Date(Date.now()).toISOString();
closingEntry.ended_at = now;
newEntry.started_at = now;

// WRONG — two separate calls, timestamps could differ by milliseconds
closingEntry.ended_at = new Date().toISOString();
newEntry.started_at = new Date().toISOString();
```

### Pattern 4: Meal Stamping (B2B-05)

**What:** In `MealLogScreen.handleSave()`, call `getCurrentEquipmentProfile()` before calling `saveMeal()`, then spread the equipment fields onto the meal object.

**Error handling (Claude's Discretion):** If `getCurrentEquipmentProfile()` returns null fields (storage cleared mid-session), log a warning and proceed without stamping rather than blocking the save. The gate ensures this is a near-impossible edge case but should be handled gracefully.

```typescript
// MealLogScreen.handleSave() addition
let equipmentStamp: { insulin_brand?: string; delivery_method?: string } = {};
try {
  const profile = await getCurrentEquipmentProfile();
  if (profile) {
    equipmentStamp = {
      insulin_brand: profile.rapidInsulinBrand,
      delivery_method: profile.deliveryMethod,
    };
  }
} catch (err) {
  console.warn('[MealLogScreen] could not fetch equipment profile for stamping', err);
}

const meal = await saveMeal({
  name: mealName.trim(),
  photoUri,
  insulinUnits: isNaN(units) ? 0 : units,
  startGlucose,
  carbsEstimated: parseCarbsGrams(carbEstimate),
  ...equipmentStamp,
}, loggedAt);
```

### Pattern 5: HypoTreatmentSheet (B2B-06)

**What:** A bottom-sheet modal following the exact same pattern as the QuickLog modal in HomeScreen.

**Props contract (to define in `src/components/types.ts`):**

```typescript
export interface HypoTreatmentSheetProps {
  visible: boolean;
  currentGlucose: number | null;   // latest Nightscout reading, null if unavailable
  onClose: () => void;
  onSave: (treatment: Omit<HypoTreatment, 'id' | 'logged_at' | 'glucose_readings_after'>) => void;
}
```

The sheet is opened from HomeScreen state (`hypoSheetVisible`) and the `reading` state (already available in HomeScreen) is passed as `currentGlucose`.

### Pattern 6: TIR Calculation Fetch

**What:** Yesterday's glucose readings fetched via the existing `fetchGlucosesSince` / `fetchGlucoseRange` API.

**How to fetch yesterday's readings:**

```typescript
// In timeInRange.ts or a helper called from the foreground handler
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const startMs = new Date(yesterday.toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
const endMs = startMs + 24 * 60 * 60 * 1000 - 1;

const readings = await fetchGlucoseRange(startMs, endMs);
const mmolValues = readings.map(r => r.mmol);
const tir = calculateDailyTIR(mmolValues);
```

`fetchGlucoseRange` already exists in `src/services/nightscout.ts` and returns `CurvePoint[]` with `mmol` values. No new Nightscout API surface required.

### Anti-Patterns to Avoid

- **Calling `getActiveEquipment()` per field at meal save time:** Always call `getCurrentEquipmentProfile()` once. Multiple individual field reads could return inconsistent state if a change occurs mid-save.
- **Two `Date.now()` calls in `changeEquipment`:** Violates the timestamp invariant. Use a single captured value.
- **Making `insulin_brand` / `delivery_method` editable after stamping:** The `updateMeal()` function's `Pick` type for `changes` already excludes these fields — keep them excluded.
- **Using a modal navigator for the gate:** Swipeable-to-dismiss modals cannot be made hard gates. Use a conditional `initialRouteName` with `gestureEnabled: false`.
- **Background fetch for hypo recovery curve:** iOS background execution restrictions make this unreliable. The decision to use foreground AppState trigger is correct and must not be changed.
- **Storing TIR as a rolling average rather than daily records:** The spec requires individual `DailyTIR` records per date to support future querying. Never collapse to a single running average.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet modal | Custom animation layer | React Native `Modal` with `animationType="slide"` | Already used in HomeScreen (QuickLog, HbA1c) and MealLogScreen (MealBottomSheet) — consistent pattern |
| Picker overlays | Custom dropdown | Modal + FlatList/Pressable list | No native picker library is needed; the SettingsScreen pattern uses TextInput rows; for multi-option pickers use the inline list-in-modal approach |
| AppState subscription | Custom polling | `AppState.addEventListener('change', ...)` | Built into React Native; already the correct primitive |
| Date arithmetic for TIR window | Custom date parser | `new Date().toISOString().slice(0, 10)` + epoch math | Simple and already used throughout the codebase (see `computeAndCacheHba1c`, `loadCachedHba1c`) |

**Key insight:** This phase has no novel primitives. Every UI pattern needed (modal bottom sheet, settings row, nav gate) already exists in the codebase with a working reference implementation.

---

## Common Pitfalls

### Pitfall 1: Gate Check Race with Font Loading

**What goes wrong:** The onboarding gate check (`AsyncStorage.getItem('equipment_changelog')`) is async. If it completes before `fontsLoaded` resolves, the navigation renders before fonts are ready, causing a flash of unformatted text.

**Why it happens:** Two independent async operations (font load and gate check) with no coordination.

**How to avoid:** Gate the navigation render on BOTH `fontsLoaded || fontError` AND `gateChecked`. Both booleans must be true before rendering the `NavigationContainer`.

**Warning signs:** Navigation flashes or renders with system fonts on first launch.

### Pitfall 2: Equipment Picker "Other" Value Storage

**What goes wrong:** Picker options like "Other" are stored as the string `"Other"` in `equipment_changelog`. If UI code later tries to compare the value to a typed union, a `"Other"` string that isn't in the union will cause TypeScript errors or silent mismatches.

**Why it happens:** The picker values are user-facing strings, not typed enum values.

**How to avoid:** The `EquipmentChangeEntry.value` is typed as `string`, not a union — this is intentional. Do not add a union type for the value field; it would break extensibility for future "Other" free-text improvements.

### Pitfall 3: Long-Acting Insulin `null` vs `"I don't take long-acting insulin"`

**What goes wrong:** The "I don't take long-acting insulin" option stores `null` as the value, not the string. Code that reads `getCurrentEquipmentProfile().longActingInsulinBrand` must handle `null` explicitly — it is a valid opt-out, not a missing value.

**Why it happens:** The `null` value is a deliberate signal, not an error state.

**How to avoid:** `getCurrentEquipmentProfile()` return type specifies `longActingInsulinBrand: string | null`. All callsites must handle null. In `EquipmentChangeEntry.value`, store the literal string `"null"` for this option OR handle null as the stored JS value explicitly — the interface says `value: string` so store the string `"NO_LONG_ACTING"` or similar, and map it to `null` in `getCurrentEquipmentProfile()`. **Decision for planner:** confirm the storage value for this opt-out (string vs null) and ensure consistency between storage and the profile getter.

### Pitfall 4: TIR "Yesterday" Boundary on Timezone

**What goes wrong:** If the app calculates "yesterday" using local time but Nightscout stores timestamps in UTC, the readings window may be misaligned by up to 12 hours.

**Why it happens:** JavaScript `new Date()` uses local time. Nightscout `find[date][$gte]` filters on epoch ms (timezone-agnostic).

**How to avoid:** Calculate the yesterday window using midnight-to-midnight in UTC. The epoch math `startMs = Date.UTC(y, m, d)` is unambiguous. Since Nightscout stores `date` as epoch ms, the filter is timezone-safe when expressed as epoch.

**Warning signs:** TIR records appearing to cover partial days or days shifting by ±1.

### Pitfall 5: Recovery Curve Double-Fetch on Multiple Foregrounds

**What goes wrong:** If `handleForeground` is called on every app foreground, and a HypoTreatment already has `glucose_readings_after` populated, the function may redundantly re-fetch Nightscout.

**Why it happens:** No guard on already-fetched records.

**How to avoid:** `fetchPendingHypoRecoveries()` must filter to records where `glucose_readings_after` is `undefined` AND `logged_at + 60 min < now`. Once a record has `glucose_readings_after` set (even a partial array), it must never be fetched again.

### Pitfall 6: SettingsScreen `saveSettings()` Pattern Does Not Cover New Keys

**What goes wrong:** `AppSettings` in `settings.ts` uses a merged-object approach. The new `DataConsent` and equipment data are stored under separate AsyncStorage keys (`data_consent`, `equipment_changelog`) — NOT inside `AppSettings`. If the implementer mistakenly adds them to `AppSettings`, they will be saved under the single `glucolog_settings` key and lose the independent lifecycle of the equipment changelog.

**Why it happens:** The SettingsScreen save button triggers `saveSettings()`. It is tempting to add new fields there.

**How to avoid:** `DataConsent` is saved via its own storage helper (e.g., `saveDataConsent()` writing to `data_consent`). Equipment fields are written via `changeEquipment()`. The "Data & Research" toggle in SettingsScreen calls its own save function, not `saveSettings()`.

---

## Code Examples

Verified patterns from the live codebase:

### AsyncStorage Key Pattern (from storage.ts)

```typescript
// Naming convention: all keys use 'glucolog_' prefix
const EQUIPMENT_CHANGELOG_KEY = 'equipment_changelog';
const HYPO_TREATMENTS_KEY = 'hypo_treatments';
const DAILY_TIR_KEY = 'daily_tir';
const DATA_CONSENT_KEY = 'data_consent';

// Load helper pattern (matches all existing load functions)
export async function loadEquipmentChangelog(): Promise<EquipmentChangeEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(EQUIPMENT_CHANGELOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EquipmentChangeEntry[];
  } catch {
    console.warn('[equipmentProfile] loadEquipmentChangelog: getItem/parse failed', EQUIPMENT_CHANGELOG_KEY);
    return [];
  }
}
```

Note: the existing keys use `'glucolog_'` prefix but the new B2B keys in the CONTEXT.md spec do NOT use this prefix (e.g., `equipment_changelog` not `glucolog_equipment_changelog`). This is intentional — they are new keys for a new data domain. Use the exact keys from the spec.

### Settings Section/Row Pattern (from SettingsScreen.tsx)

```typescript
// Existing primitive components — reuse these
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.navRow} onPress={onPress}>
      <Text style={styles.navRowLabel}>{label}</Text>
      <Text style={styles.navRowChevron}>›</Text>
    </Pressable>
  );
}

// "My Equipment" section in SettingsScreen:
<SectionHeader title="My Equipment" />
<View style={styles.card}>
  {/* Each equipment field as a NavRow that opens inline picker + confirmation */}
  <NavRow label={`Rapid insulin: ${activeProfile?.rapidInsulinBrand ?? '...'}`} onPress={() => openPicker('rapid_insulin_brand')} />
  <View style={styles.divider} />
  <NavRow label={`Delivery: ${activeProfile?.deliveryMethod ?? '...'}`} onPress={() => openPicker('delivery_method')} />
  {/* ... */}
</View>
```

### Modal Bottom Sheet Pattern (from HomeScreen.tsx — QuickLog modal)

```typescript
// Pattern for HypoTreatmentSheet — replicate this structure
<Modal
  visible={hypoSheetVisible}
  animationType="slide"
  transparent
  onRequestClose={() => setHypoSheetVisible(false)}
>
  <Pressable style={styles.modalBackdrop} onPress={() => setHypoSheetVisible(false)} />
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrapper}>
    <View style={styles.modalSheet}>
      <View style={styles.modalHandle} />
      <Text style={styles.modalTitle}>Treating a low?</Text>
      {/* sheet fields */}
    </View>
  </KeyboardAvoidingView>
</Modal>
```

### Meal Interface Extension (from storage.ts)

```typescript
// CURRENT Meal interface — extend with optional fields
export interface Meal {
  id: string;
  name: string;
  photoUri: string | null;
  insulinUnits: number;
  startGlucose: number | null;
  carbsEstimated: number | null;
  loggedAt: string;
  sessionId: string | null;
  glucoseResponse: GlucoseResponse | null;
  // PHASE 8 ADDITIONS — optional so existing records remain valid
  insulin_brand?: string;
  delivery_method?: string;
}
```

The `saveMeal()` function signature accepts `Omit<Meal, 'id' | 'loggedAt' | 'glucoseResponse' | 'sessionId'>` — the new optional fields will flow through automatically once added to the `Meal` interface.

### Test Pattern (from storage.test.ts and MealBottomSheet.test.tsx)

```typescript
// AsyncStorage mock is global — declared in package.json moduleNameMapper:
// "@react-native-async-storage/async-storage": "...async-storage-mock"
// The mock auto-clears between tests when combined with:
beforeEach(async () => {
  await AsyncStorage.clear();
});

// For equipmentProfile.test.ts — use AsyncStorage directly (same as storage.test.ts)
// No React renderer needed — all functions are pure async

// For timeInRange.test.ts — all pure functions, no AsyncStorage mock needed for calculateDailyTIR
// getDailyTIRHistory uses AsyncStorage — apply the same beforeEach clear pattern
```

### Theme Tokens for Hypo Button (from theme.ts)

```typescript
// Available tokens for the "Treating a low?" button:
COLORS.red    = '#FF3B30'  // low glucose / hypo — PRIMARY choice per spec
COLORS.amber  = '#FF9500'  // high glucose — secondary option

// CONTEXT.md says "red/amber colour token" — use COLORS.red for the button border/text
// (The condition is hypo, so red is semantically correct)
```

---

## Navigation Architecture (detailed — B2B-01)

### Current Stack

App.tsx uses a single flat `createNativeStackNavigator` with 9 screens: Home, MealLog, MealHistory, InsulinLog, EditMeal, EditInsulin, Settings, Account, Help.

There is no existing AppState listener in App.tsx. The only startup logic is:
1. Font loading (`useFonts`)
2. SplashScreen management
3. `migrateLegacySessions()` (fire-and-forget in `useEffect`)

### Gate Implementation (Claude's Discretion — recommended approach)

Add `EquipmentOnboarding` to the stack with `gestureEnabled: false` and determine `initialRouteName` from a pre-navigation async check. The check must complete before the NavigationContainer renders (gated by a `gateChecked` boolean state in App.tsx alongside the existing font gate).

This is simpler than a nested navigator approach and follows the existing migration pattern (run async logic in `useEffect` before render completes).

**RootStackParamList addition:**

```typescript
export type RootStackParamList = {
  EquipmentOnboarding: undefined;  // ADD
  Home: undefined;
  // ... existing screens
};
```

### Exit from Onboarding

EquipmentOnboardingScreen calls `navigation.replace('Home')` after the user completes all 4 mandatory pickers. `replace` removes the onboarding screen from history — the user cannot go back.

---

## HomeScreen Layout (detailed — B2B-06)

The current HomeScreen ScrollView renders elements in this order:
1. Header row (BolusBrain title + settings button)
2. Arc gauge (SVG, 200px tall)
3. Stats row (12HR AVG + EST. HBA1C) — `cardAnims[0]`
4. **Action row** (+ Log meal + History) — `cardAnims[1]`
5. Quick log snack button — `cardAnims[2]`
6. Insulin row (3 buttons) — `cardAnims[3]`
7. Range guide

**AveragedStatsPanel is NOT currently on HomeScreen.** It is in `MealLogScreen`. The CONTEXT.md requirement (B2B-06) says the hypo button should be "below AveragedStatsPanel" — but since AveragedStatsPanel is not on HomeScreen, the intended meaning is: above the "+ Log meal" and "Quick log snack" buttons.

**Exact insertion point:** Between the stats row (`cardAnims[0]`) and the action row (`cardAnims[1]`). The button becomes a new animated card between the HbA1c panel and the "Log meal" button.

The existing `cardAnims` array has 4 entries (indices 0–3). Adding a new button between items will require either adding a 5th animation or rendering the hypo button without the entrance animation (acceptable since it does not need stagger animation).

---

## Storage Inventory (existing keys — for planner reference)

| Key | Type | Owner | Notes |
|-----|------|-------|-------|
| `glucolog_meals` | `Meal[]` | storage.ts | Extended with `insulin_brand?`, `delivery_method?` in this phase |
| `glucolog_sessions` | `Session[]` | storage.ts | Unchanged |
| `glucolog_insulin_logs` | `InsulinLog[]` | storage.ts | Unchanged |
| `glucolog_migration_v1` | `'true'` | storage.ts | Unchanged |
| `glucolog_hba1c_cache` | `Hba1cEstimate` | storage.ts | Unchanged |
| `glucolog_glucose_store` | `GlucoseStore` | storage.ts | Unchanged |
| `glucolog_settings` | `AppSettings` | settings.ts | Unchanged (DataConsent goes to its own key) |
| `equipment_changelog` | `EquipmentChangeEntry[]` | equipmentProfile.ts | NEW |
| `hypo_treatments` | `HypoTreatment[]` | new helper | NEW |
| `daily_tir` | `DailyTIR[]` | new helper | NEW |
| `data_consent` | `DataConsent` | new helper | NEW |

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest-expo 54.0.17 + jest 29.7.0 |
| Config | `package.json` `"jest"` key — `preset: "jest-expo"`, `testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"]` |
| AsyncStorage mock | `moduleNameMapper` → `@react-native-async-storage/async-storage/jest/async-storage-mock` |
| Quick run | `npm test -- --testPathPattern="equipmentProfile|timeInRange" --watchAll=false` |
| Full suite | `npm test` (runs `jest --watchAll=false --passWithNoTests`) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| B2B-02 | equipmentProfile utility functions — 11 cases | unit | `npm test -- --testPathPattern="equipmentProfile" --watchAll=false` | No — Wave 0 |
| B2B-07 | timeInRange utility functions — 6 cases | unit | `npm test -- --testPathPattern="timeInRange" --watchAll=false` | No — Wave 0 |
| B2B-01 | Onboarding gate blocks navigation | manual smoke | Manual: fresh install or `AsyncStorage.clear()` | N/A |
| B2B-03 | Confirmation modal shown before equipment change | manual smoke | Manual: tap edit in Settings, verify modal appears | N/A |
| B2B-05 | Meal stamped with insulin_brand + delivery_method | manual smoke | Manual: log meal, inspect AsyncStorage | N/A |
| B2B-06 | Hypo sheet opens and saves | manual smoke | Manual: tap button, fill form, verify saved | N/A |
| B2B-08 | Consent toggle saves DataConsent | manual smoke | Manual: toggle, inspect AsyncStorage | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- --watchAll=false`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/equipmentProfile.test.ts` — 11 cases covering B2B-02 (directory does not exist yet)
- [ ] `src/__tests__/timeInRange.test.ts` — 6 cases covering B2B-07 (directory does not exist yet)

The `src/__tests__/` directory must be created. No framework install needed — jest-expo is already configured.

---

## Open Questions

1. **Long-acting insulin null storage representation**
   - What we know: CONTEXT.md says `"I don't take long-acting insulin"` stores `null`, not a string. But `EquipmentChangeEntry.value` is typed as `string`.
   - What's unclear: How is `null` stored in the `value: string` field — as the JS `null` literal (which JSON.stringify serialises as `null`) or as a sentinel string like `"NO_LONG_ACTING"`?
   - Recommendation: Store the JSON literal `null` in the `value` field — TypeScript will allow this at runtime even if the type says `string`. In `getCurrentEquipmentProfile()`, check `entry.value === null || entry.value === 'null'` and return `longActingInsulinBrand: null`. The planner should make this explicit in the implementation task for `changeEquipment`.

2. **Pen needle picker visibility persistence**
   - What we know: The pen needle picker is only shown when delivery method is a pen type. The onboarding screen is stateful.
   - What's unclear: Should the pen needle picker also appear/disappear reactively in the SettingsScreen equipment section when the user changes delivery method?
   - Recommendation: Yes — the "My Equipment" section in SettingsScreen should hide the pen needle row when delivery method is not a pen type. This is consistent with the onboarding behaviour.

3. **`cardAnims` array in HomeScreen for hypo button**
   - What we know: `cardAnims` is `useRef([0, 1, 2, 3].map(() => new Animated.Value(0)))` — 4 entries. The stagger animation iterates all 4.
   - What's unclear: Does the hypo button need a staggered entrance animation?
   - Recommendation: Add a 5th entry to `cardAnims` for the hypo button. This keeps the entrance animation consistent with all other HomeScreen cards.

---

## Sources

### Primary (HIGH confidence)
- `src/services/storage.ts` — Meal interface, Session interface, all AsyncStorage key patterns, save/load CRUD patterns, `migrateLegacySessions` pattern
- `src/screens/HomeScreen.tsx` — Full layout, existing modal patterns, COLORS/FONTS imports, existing action row structure
- `src/screens/SettingsScreen.tsx` — SectionHeader, NavRow, SettingRow primitives, card+divider pattern, `saveSettings` pattern
- `src/components/MealBottomSheet.tsx` — Modal sheet reference for HypoTreatmentSheet
- `src/components/types.ts` — MealBottomSheetProps, component prop contract pattern
- `src/components/MealBottomSheet.test.tsx` — Pure logic test pattern (no React renderer)
- `src/services/storage.test.ts` — AsyncStorage mock pattern, `beforeEach(AsyncStorage.clear)`, `jest.spyOn` pattern
- `src/services/nightscout.ts` — `fetchGlucoseRange` signature and return type (CurvePoint[])
- `src/theme.ts` — All colour tokens (COLORS.red, COLORS.amber confirmed)
- `App.tsx` — Navigation stack structure, font loading gate, migration hook pattern
- `package.json` — jest config (preset, testMatch, moduleNameMapper), all installed dependencies
- `.planning/phases/08-b2b-data-capture-layer/08-CONTEXT.md` — All locked decisions and interface definitions

### Secondary (MEDIUM confidence)
- React Native AppState documentation — addEventListener pattern verified against existing RN 0.81.5 install

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed by package.json; no new dependencies
- Architecture: HIGH — all patterns verified in live source files
- Navigation gate: HIGH — App.tsx read directly; recommended approach verified against existing font gate pattern
- Pitfalls: HIGH — identified from direct code inspection (null value issue, SettingsScreen pattern mismatch, timezone issue)
- HomeScreen insertion point: HIGH — HomeScreen.tsx read in full; AveragedStatsPanel confirmed NOT on HomeScreen

**Research date:** 2026-03-31
**Valid until:** 2026-06-30 (stable codebase; no fast-moving dependencies introduced)
