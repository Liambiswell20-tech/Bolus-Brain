# Phase 8: B2B Data Capture Layer - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Source:** PRD Express Path (~/.gstack/projects/Liambiswell20-tech-Bolus-Brain/Liamb-main-design-20260331-165716.md)

<domain>
## Phase Boundary

This phase builds a structured data capture layer that makes the BolusBrain dataset commercially
credible for acquisition/partnership positioning. It captures: which insulin brand and delivery
device was active at every data point (equipment changelog), hypo treatment events with recovery
curves, time-in-range longitudinally (silent background store), and user consent for research use.

**What this phase delivers (and nothing more):**
- Equipment onboarding gate (hard block before HomeScreen until 4 fields answered)
- Equipment changelog data model with full audit trail (EquipmentChangeEntry)
- Equipment settings section in SettingsScreen with change confirmation modal
- Meal stamping — insulin_brand + delivery_method copied immutably at save time
- Hypo treatment quick log (optional button on HomeScreen → bottom sheet)
- TIR calculation — silent 90-day rolling DailyTIR store, no UI display
- Data consent toggle in Settings (OFF by default, versioned)
- Unit tests for equipmentProfile.ts (11 cases) and timeInRange.ts (6 cases)

**Explicitly NOT in this phase:**
- No data export or anonymisation pipeline
- No aggregation dashboards
- No sharing with any external service
- No TIR display in UI
- No advice, recommendations, or predictive language
- No editing of already-stamped meal records' insulin_brand — immutable

</domain>

<decisions>
## Implementation Decisions

### Equipment Onboarding Gate

- Shown full-screen on first launch AND on every fresh install or storage clear — including returning users
- Hard gate: no skip path exists, user cannot reach HomeScreen without completing the gate
- Gate check: if `equipment_changelog` key is empty or missing in AsyncStorage → show EquipmentOnboardingScreen
- Mandatory pickers (all 4 must be answered to pass gate):
  1. Rapid-acting insulin: NovoRapid, Humalog, Fiasp, Apidra, Lyumjev, Other
  2. Long-acting insulin: Lantus, Levemir, Tresiba, Toujeo, Abasaglar, Other, **"I don't take long-acting insulin"** (this option stores `null`, not a string — it signals deliberate opt-out)
  3. Delivery method: Disposable pen, Reusable pen, Insulin pump, Syringe & vial
  4. CGM device: FreeStyle Libre 2, FreeStyle Libre 3, Dexcom G7, Dexcom ONE, Medtronic Guardian, Other
- Optional picker (only when delivery method is a pen type):
  5. Pen needle brand: BD Micro-Fine, Unifine Pentips, NovoFine, GlucoRx, Other, Skip
- Pen needle is NOT required to pass the gate

### Equipment Changelog Data Model

New file: `src/types/equipment.ts`

```typescript
export interface EquipmentChangeEntry {
  id: string;
  field: 'rapid_insulin_brand' | 'long_acting_insulin_brand' | 'delivery_method'
       | 'cgm_device' | 'pen_needle_brand';
  value: string;
  started_at: string;        // ISO — when this value became active
  ended_at?: string;         // ISO — when replaced (undefined = currently active)
                             // CRITICAL: ended_at === started_at on new entry
                             // Both generated from a single Date.now() call
  reason_for_change?: string;
  previous_value?: string;   // undefined for initial setup
}

export interface HypoTreatment {
  id: string;
  logged_at: string;
  glucose_at_event: number;           // mmol/L from latest Nightscout reading
  treatment_type: string;             // Glucose tablets | Juice | Sweets | Gel | Other
  amount_value: number;
  amount_unit: 'tablets' | 'ml' | 'g';
  insulin_brand?: string;             // stamp from active equipment profile
  glucose_readings_after?: number[];  // up to 12 readings, partial arrays valid
}

export interface DailyTIR {
  date: string;             // YYYY-MM-DD
  readings_count: number;
  in_range_count: number;   // 3.9–10.0 mmol/L inclusive
  tir_percentage: number;
  below_range_pct: number;  // < 3.9
  above_range_pct: number;  // > 10.0
}

export interface DataConsent {
  consented: boolean;
  consented_at?: string;    // ISO
  version: string;          // "1.0" — for future consent versioning
}
```

### Equipment Profile Utilities

New file: `src/utils/equipmentProfile.ts`

```typescript
// Returns the currently active entry for a field (entry with no ended_at)
getActiveEquipment(field: string): EquipmentChangeEntry | null

// Returns all active fields as a flat object — THE ONLY function to call at meal save time
// longActingInsulinBrand is null when user selected "I don't take long-acting insulin"
getCurrentEquipmentProfile(): {
  rapidInsulinBrand: string;
  longActingInsulinBrand: string | null;
  deliveryMethod: string;
  cgmDevice: string;
  penNeedleBrand?: string;
}

// Returns the entry active at a specific historical timestamp
getEquipmentAtTime(field: string, timestamp: string): EquipmentChangeEntry | null

// Records a change: closes previous entry (sets ended_at), opens new one (sets started_at)
// Both timestamps generated from a SINGLE Date.now() call — ended_at === started_at
changeEquipment(field: string, newValue: string, reason?: string): Promise<void>
```

AsyncStorage key for changelog: `equipment_changelog` (array of EquipmentChangeEntry)
AsyncStorage key for hypo treatments: `hypo_treatments` (array of HypoTreatment)
AsyncStorage key for TIR: `daily_tir` (array of DailyTIR)
AsyncStorage key for consent: `data_consent` (DataConsent object)

### Equipment Change Confirmation Modal

- New component: `src/components/EquipmentChangeConfirmation.tsx`
- Shown before any equipment field change is committed in Settings
- User must explicitly confirm — cancel leaves the existing value unchanged
- Only calls `changeEquipment()` on confirm

### Equipment Settings Section

- "My Equipment" section added to SettingsScreen
- Shows all active fields (rapid insulin, long-acting insulin, delivery method, CGM device, pen needle if applicable)
- Each field has an edit button → shows picker overlay → shows EquipmentChangeConfirmation modal before saving

### Meal Stamping

At meal save time in `MealLogScreen.saveMeal()`:
```typescript
const profile = await getCurrentEquipmentProfile();
const meal = {
  ...otherFields,
  insulin_brand: profile.rapidInsulinBrand,
  delivery_method: profile.deliveryMethod,
};
```
- NEVER call `getActiveEquipment()` per field — always use `getCurrentEquipmentProfile()`
- `insulin_brand` and `delivery_method` are immutable once stamped — no editing ever
- Show read-only insulin brand chip after units input in MealLogScreen (display only, not editable)
- Extend `Meal` interface in `src/services/storage.ts` with optional `insulin_brand?: string` and `delivery_method?: string`

### Hypo Treatment Quick Log

Button placement on HomeScreen:
- Below AveragedStatsPanel
- Above "+ Log meal" / "⚡ Quick log snack" buttons
- Label: "Treating a low?" (or similar)
- Colour: red/amber colour token from `theme.ts`
- Always visible — NOT conditional on current glucose level (low detection is unreliable)

HypoTreatmentSheet fields (in order):
1. Current glucose — read-only display (latest Nightscout reading in mmol/L)
2. Treatment type picker: Glucose tablets, Juice, Sweets, Gel, Other
3. Amount: numeric input (amount_value) + inline unit picker (amount_unit: tablets / ml / g)
4. Save / Cancel buttons

Recovery curve fetch:
- Fetched on NEXT app foreground after 60-min window from logged_at has elapsed
- Fetch up to 12 readings (5-min intervals = 60 min window from Nightscout)
- Partial arrays are valid — store whatever is available
- NOT via background job (iOS background execution restrictions)
- Check on app foreground: if any HypoTreatment has no glucose_readings_after AND logged_at + 60 min < now → fetch and update

### TIR Calculation

New file: `src/utils/timeInRange.ts`

- `calculateDailyTIR(readings: number[]): DailyTIR` — pure function, takes mmol/L values
- In-range definition: 3.9–10.0 mmol/L inclusive (matches existing glucose colour ranges)
- Trigger: on app foreground (AppState change to 'active'), once per calendar day
- Calculates TIR for yesterday (today - 1 calendar day)
- Writes DailyTIR record ONLY if no record exists for that date (never overwrites)
- Prunes store to 90 days on each write — drops any record where date < (today - 90 days)
- No UI display this phase — silent background store only

### Data Consent Toggle

Settings section: "Data & Research"
- Toggle: "Help improve T1D research" (or similar neutral copy — final copy needs legal review)
- OFF by default
- On toggle ON: saves DataConsent { consented: true, consented_at: ISO, version: "1.0" }
- On toggle OFF: saves DataConsent { consented: false, version: "1.0" }
- CURRENT_CONSENT_VERSION constant: "1.0"
- On app launch: if stored version !== CURRENT_CONSENT_VERSION → show re-consent modal and reset consented to false
- Consent copy note: "Your personal data is never shared" is legally incompatible with any future commercial data use — this phase captures the toggle and version only; copy to be revised with legal review before any backend pipeline

### Unit Tests

`src/__tests__/equipmentProfile.test.ts` — 11 cases:
1. Initial onboarding creates one entry per field with started_at and no ended_at
2. changeEquipment closes the previous entry and opens a new one
3. changeEquipment: ended_at on closing entry === started_at on new entry (same timestamp)
4. changeEquipment records previous_value correctly
5. changeEquipment records reason_for_change when provided
6. getActiveEquipment returns the entry with no ended_at
7. getEquipmentAtTime returns the correct entry for a timestamp mid-window
8. getEquipmentAtTime returns null before any entries exist
9. getEquipmentAtTime returns correct entry when multiple changes have occurred
10. getCurrentEquipmentProfile returns all active fields as a flat object
11. getCurrentEquipmentProfile returns longActingInsulinBrand: null when user selected opt-out

`src/__tests__/timeInRange.test.ts` — 6 cases:
1. Empty readings array → 0 for all values
2. All readings in range → 100% TIR
3. Mixed readings calculate correctly
4. Boundary readings (3.9 and 10.0 mmol/L) count as in-range
5. getDailyTIRHistory trims store to 90 days when a new record pushes total beyond 90
6. getDailyTIRHistory returns records in ascending date order

### Safety Rules (Non-Negotiable)

- Never display dosing advice or "you should take X units" language anywhere in this phase
- All new fields are data capture only — they inform history, not suggestions
- No new AI features or prediction logic
- Historical meal insulin_brand stamps are immutable — never allow editing

### Claude's Discretion

- Navigation implementation for onboarding gate (conditional stack vs modal stack)
- Exact styling of equipment pickers (consistent with existing SettingsScreen patterns)
- Exact hypo treatment button label copy (keep medically neutral)
- AppState foreground listener placement (App.tsx or a custom hook)
- Error handling for missing equipment profile at meal save time (edge case: storage cleared mid-session)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Model & Storage
- `src/services/storage.ts` — Meal interface definition, AsyncStorage key patterns, existing CRUD helpers
- `src/types/` — Existing type definitions to extend (check for Session, Meal types)

### UI Patterns
- `src/screens/SettingsScreen.tsx` — Existing settings structure and section patterns to replicate
- `src/screens/HomeScreen.tsx` — Button placement and layout (AveragedStatsPanel position)
- `src/components/` — Existing component patterns (MealBottomSheet as reference for HypoTreatmentSheet)
- `src/utils/theme.ts` — Colour tokens (red/amber token for hypo button)

### Navigation
- `App.tsx` — Navigation stack configuration, AppState listener patterns

### Testing
- `src/__tests__/` — Existing test patterns and Jest configuration
- `jest.config.js` (or `jest.config.ts`) — Test configuration

### Design Decisions from PRD
- `~/.gstack/projects/Liambiswell20-tech-Bolus-Brain/Liamb-main-design-20260331-165716.md` — Full office-hours design doc with rationale for every decision

### Project Rules
- `CLAUDE.md` — Security rules (no hardcoded keys), glucose display rules (mmol/L only), safety rules (no dosing advice)
- `.planning/REQUIREMENTS.md` — B2B-01 through B2B-08 requirement definitions

</canonical_refs>

<specifics>
## Specific Ideas

### Data interfaces (verbatim from design doc)
All TypeScript interfaces are fully specified in the `<decisions>` section above — use them verbatim.

### Equipment picker options (exact values)
All picker option strings are specified in the `<decisions>` section — use them verbatim for the storage values.

### Timestamp invariant (critical for data integrity)
`changeEquipment()` MUST generate a single timestamp and use it for both `ended_at` on the closing entry and `started_at` on the new entry. Not two separate `Date.now()` calls.

### Recovery curve window
60 minutes = 12 readings at 5-minute intervals from Nightscout. Fetch on next foreground after `logged_at + 60 min < now`. Partial arrays (fewer than 12) are valid and should be stored.

### TIR range
3.9–10.0 mmol/L inclusive — matches existing glucose colour range constants in theme.ts / existing code.

</specifics>

<deferred>
## Deferred Ideas

- **TIR UI display** — Phase 8 stores the data silently. Surfacing TIR to users as a personal metric is explicitly deferred to a future phase.
- **Data export / anonymisation pipeline** — Out of scope until backend decision is made and legal consent copy is revised.
- **Aggregation dashboards** — Out of scope.
- **Hypo "Other" free-text field** — Design doc flagged this as an open question. Deferred — use a plain "Other" string value for now.
- **Backend migration** — AsyncStorage is the storage layer for this phase. Portability-first interfaces are designed for a future storage-layer swap. Backend decision (Supabase vs Node/Express) must be resolved before data has commercial value.
- **Consent copy legal review** — "Your personal data is never shared" cannot ship before legal review under GDPR Art.9. The consent toggle ships as a placeholder this phase; copy and pipeline in a later phase.
- **IRB / ethics review** — Worth pursuing before any pharma partnership approach, but not blocking this phase.

</deferred>

---

*Phase: 08-b2b-data-capture-layer*
*Context gathered: 2026-03-31 via PRD Express Path*
