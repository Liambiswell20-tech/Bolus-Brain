---
phase: 08-b2b-data-capture-layer
plan: "04"
subsystem: equipment-settings-ui
tags: [equipment, settings, modal, confirmation, react-native]
dependency_graph:
  requires: [08-02, 08-03]
  provides: [equipment-settings-ui, equipment-change-confirmation]
  affects: [SettingsScreen, EquipmentChangeConfirmation]
tech_stack:
  added: []
  patterns: [confirmation-modal, inline-flatlist-picker, conditional-row-visibility]
key_files:
  created:
    - src/components/EquipmentChangeConfirmation.tsx
  modified:
    - src/screens/SettingsScreen.tsx
decisions:
  - "EquipmentChangeConfirmation uses transparent slide Modal matching HomeScreen quick-log sheet pattern"
  - "Picker options defined as getPickerOptions() function (not module-level constants) for co-location with SettingsScreen logic"
  - "confirmOldValue displays resolved label for NO_LONG_ACTING sentinel rather than raw storage value"
  - "Equipment data stored exclusively via changeEquipment() — saveSettings() never touches equipment fields"
  - "SettingsScreen wrapped in Fragment to allow sibling Modals outside KeyboardAvoidingView (avoids z-index stacking issues)"
metrics:
  duration: 4
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_changed: 2
---

# Phase 8 Plan 4: Equipment Settings UI Summary

Equipment settings section and confirmation modal — lets users update their equipment profile post-onboarding with a guarded confirmation step before any changelog entry is written.

## What Was Built

### EquipmentChangeConfirmation modal (new component)

A transparent slide-up `Modal` that blocks any equipment field change until the user explicitly confirms. Props: `visible`, `field` (human label), `oldValue`, `newValue`, `onConfirm`, `onCancel`. Backdrop `Pressable` dismisses via `onCancel`. Two-button row: outlined Cancel and green filled Confirm.

### My Equipment section in SettingsScreen

Added above Dosing section. Loads `getCurrentEquipmentProfile()` on focus via `loadEquipment()` callback (called inside existing `useFocusEffect`). Renders one `NavRow` per active field; pen needle row is conditionally rendered only when `deliveryMethod` is `'Disposable pen'` or `'Reusable pen'`.

**Edit flow:**
1. Tap any NavRow → `openEquipmentPicker()` sets field + options, shows inline `FlatList` picker Modal
2. Select option → `handlePickerSelect()` dismisses picker, sets pending state, opens `EquipmentChangeConfirmation`
3. Cancel → state cleared, existing value unchanged, no changelog write
4. Confirm → `handleEquipmentConfirm()` calls `changeEquipment()` with resolved storage value (`NO_LONG_ACTING` for "I don't take long-acting insulin"), then calls `loadEquipment()` to refresh display

## Deviations from Plan

### Plan was based on older SettingsScreen

The plan template showed the pre-08-03 SettingsScreen (no consent toggle). The actual file from Plan 08-03 already contained `DataConsent` state, `Switch` toggle, and re-consent Modal. The My Equipment section was added atop the existing structure without disrupting any of that code.

Tracked as: no rule violation — plan correctly identified files_modified, just the base state of SettingsScreen had evolved from a parallel plan execution.

## Known Stubs

None. The My Equipment section reads live `getCurrentEquipmentProfile()` data and writes via `changeEquipment()`. No placeholder or hardcoded values flow to the UI.

## Self-Check: PASSED

Files created:
- `src/components/EquipmentChangeConfirmation.tsx` — FOUND
- `src/screens/SettingsScreen.tsx` (modified) — FOUND

Commits:
- `1f92586` feat(08-04): create EquipmentChangeConfirmation modal component — FOUND
- `8fb611f` feat(08-04): add My Equipment section to SettingsScreen — FOUND

TypeScript: clean (0 errors)
Tests: 123/123 passing
