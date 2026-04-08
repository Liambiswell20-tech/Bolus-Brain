# Phase 9: Pre-Beta Polish — Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Source:** User-agreed plan (confirmed 08 April 2026)

<domain>
## Phase Boundary

This phase polishes the app for external beta testers. It adds a 3-screen onboarding flow (data sharing consent → demographic capture → equipment), reworks hypo treatment to be more flexible, adds tablet dosing to settings, splits history into two tabs (meals + long-acting insulin), updates help copy, and fixes keyboard/navigation bugs. No auth, no server-side enforcement, no Supabase.

</domain>

<decisions>
## Implementation Decisions

### Onboarding Flow (3 screens, in order)
- Screen 1: Data Sharing Opt-In — full-screen accept/decline page shown before anything else. Same consent content as existing Settings toggle. Settings toggle stays as-is for changing preference later.
- Screen 2: About Me (NEW) — Age range dropdown: 0-18, 18-25, 26-35, 36-45, 46-55, 56-65, 65+. Gender: Male / Female / Non-binary / Prefer not to say. T1D duration: <1 year, 1-5 years, 5-10 years, 10-20 years, 20+ years (OPTIONAL). HbA1c (mmol/mol): free number input (OPTIONAL). Can prompt for missing fields later via in-app reminder.
- Screen 3: Equipment (existing EquipmentOnboardingScreen, unchanged)
- Navigation: Data Sharing → About Me → Equipment → Home (same gate pattern as current equipment-only onboarding)

### Hypo Treatment Rework
- Presets shown as suggestions (Glucose tablets, Juice, Sweets, Gel, Other) WITH open text box to type freely
- When preset selected → ask brand (free text input, NOT mandatory)
- Amount field OPTIONAL — not required to save
- Single item save (no multi-select)
- Brand field is also optional

### Tablet Dosing (Settings)
- New section under Settings > Dosing area
- Generic "add any tablet" feature — name, mg, amount per day (side by side on same row)
- Support multiple tablet types
- Stored in AsyncStorage

### History Page — Two Tabs
- Tab 1: Meals + rapid insulin (existing view, unchanged)
- Tab 2: Long-acting insulin — list of doses with 12-hour glucose curve (from dose time to +12hrs), show dose units alongside curve, highlight morning reading

### Help & FAQ Copy Update
- Update data sharing section: if they opt in, data is fully anonymised and used to help improve diabetes care

### Bug Fixes
- Keyboard glitchiness on save buttons across all screens (KeyboardAvoidingView improvements)
- Home button white flash on navigation transitions (background colour fix)

### Claude's Discretion
- AsyncStorage key naming for user profile and tablet dosing data
- Specific KeyboardAvoidingView configuration per screen
- Tab component library choice for history page (or custom tabs)
- Layout of long-acting insulin tab entries
- Navigation transition background colour implementation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Onboarding
- `src/screens/EquipmentOnboardingScreen.tsx` — Current onboarding screen (becomes screen 3)
- `App.tsx` — Navigation gate logic for equipment onboarding

### Hypo Treatment
- `src/components/HypoTreatmentSheet.tsx` — Current hypo treatment bottom sheet to rework

### History
- `src/screens/MealHistoryScreen.tsx` — Current history screen (becomes tab 1)

### Settings
- `src/screens/SettingsScreen.tsx` — Where tablet dosing section goes

### Help
- `src/screens/HelpScreen.tsx` — FAQ copy to update

### Storage & Types
- `src/services/storage.ts` — AsyncStorage operations, new keys needed
- `src/types/equipment.ts` — Extend with UserProfile type

### Data Consent (existing)
- Data consent toggle already exists in SettingsScreen (Phase 8)

</canonical_refs>

<specifics>
## Specific Ideas

- B2B strategy context: Primary target is insulin manufacturers (Novo Nordisk, Eli Lilly, Sanofi). Demographic data (age range, gender, T1D duration) makes the dataset commercially valuable.
- Academic partnerships need 100-500 users; pharma engagement at 1,000-5,000 users.
- crypto.randomUUID() does NOT work in React Native — use `${Date.now()}-${Math.random().toString(36).slice(2, 11)}` pattern for all IDs.
- Supabase integration was reverted (commit 23df7b5) — app is AsyncStorage-only. Do NOT import or reference Supabase.

</specifics>

<deferred>
## Deferred Ideas

- Sign in / auth with Face ID / fingerprint → Supabase phase
- Change password in Account settings → Supabase phase
- Server-side data sharing enforcement (when user turns off toggle, stop sharing for that user) → Supabase phase
- In-app reminder to complete optional About Me fields → future phase

</deferred>

---

*Phase: 09-pre-beta-polish*
*Context gathered: 2026-04-08 via user-agreed plan*
