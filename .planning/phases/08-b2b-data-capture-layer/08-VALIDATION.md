---
phase: 8
slug: b2b-data-capture-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo (Jest 29.x) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npx jest --testPathPattern="equipmentProfile|timeInRange" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="equipmentProfile|timeInRange" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 01 | 0 | B2B-02 | unit stub | `npx jest --testPathPattern="equipmentProfile" --no-coverage` | ❌ W0 | ⬜ pending |
| 08-01-T2 | 01 | 0 | B2B-07 | unit stub | `npx jest --testPathPattern="timeInRange" --no-coverage` | ❌ W0 | ⬜ pending |
| 08-02-T1 | 02 | 1 | B2B-02 | unit | `npx jest --testPathPattern="equipmentProfile" --no-coverage` | ✅ W0 | ⬜ pending |
| 08-02-T2 | 02 | 1 | B2B-07 | unit | `npx jest --testPathPattern="timeInRange" --no-coverage` | ✅ W0 | ⬜ pending |
| 08-03-T1 | 03 | 1 | B2B-01 | manual | — gate visible on fresh storage clear | manual | ⬜ pending |
| 08-03-T2 | 03 | 1 | B2B-05 | manual | — meal save stamps insulin_brand field | manual | ⬜ pending |
| 08-04-T1 | 04 | 2 | B2B-03 B2B-04 | manual | — settings section visible, modal fires | manual | ⬜ pending |
| 08-04-T2 | 04 | 2 | B2B-06 | manual | — hypo button visible, sheet opens | manual | ⬜ pending |
| 08-05-T1 | 05 | 2 | B2B-08 | manual | — consent toggle persists, re-consent fires | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/equipmentProfile.test.ts` — 11 stub test cases for B2B-02 (stubs only, implementations empty)
- [ ] `src/__tests__/timeInRange.test.ts` — 6 stub test cases for B2B-07 (stubs only, implementations empty)
- [ ] `src/types/` directory created — exists for `equipment.ts` to land in Wave 1
- [ ] `src/__tests__/` directory created — exists for test files to land

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Onboarding gate blocks HomeScreen on fresh install | B2B-01 | Requires navigation state; Expo TestFlight or simulator | Clear AsyncStorage, reload app, confirm EquipmentOnboardingScreen appears before HomeScreen |
| Gate passes only when 4 mandatory fields answered | B2B-01 | UI interaction flow | Complete rapid/long-acting/delivery/CGM pickers, confirm HomeScreen accessible |
| Pen needle picker hidden for non-pen delivery methods | B2B-01 | Conditional UI state | Select "Insulin pump", confirm pen needle row not visible |
| Meal stamp: insulin_brand + delivery_method on save | B2B-05 | Storage read after save | Log a meal, read AsyncStorage `meals` key, confirm insulin_brand and delivery_method fields present |
| insulin_brand chip shown read-only in MealLogScreen | B2B-05 | UI presence | Open meal log screen, confirm read-only chip below units input |
| Equipment change confirmation modal fires in Settings | B2B-03/04 | UI interaction | Tap edit on any equipment field in Settings, confirm modal appears before change commits |
| changeEquipment creates closed+new entries correctly | B2B-02 | AsyncStorage state | Change equipment field, read `equipment_changelog`, confirm previous entry has ended_at = new entry started_at |
| Hypo button visible on HomeScreen | B2B-06 | UI presence | Open HomeScreen, confirm "Treating a low?" button visible between stats and log buttons |
| HypoTreatmentSheet fields in correct order | B2B-06 | UI layout | Tap hypo button, confirm: glucose display → type picker → amount + unit → Save/Cancel |
| Recovery curve fetched on next foreground after 60 min | B2B-06 | Time-based async | Log hypo, wait 61 min (or mock timestamp), background/foreground app, confirm glucose_readings_after populated |
| TIR record created silently on foreground | B2B-07 | AsyncStorage state | Foreground app, read `daily_tir` key, confirm record for yesterday present |
| TIR store pruned to 90 days | B2B-07 | Automated in unit test | Covered by timeInRange.test.ts case 5 |
| Data consent toggle OFF by default | B2B-08 | UI state | Open Settings → Data & Research, confirm toggle is OFF |
| Re-consent modal fires on version mismatch | B2B-08 | Version check | Manually set consent.version to "0.9" in AsyncStorage, relaunch app, confirm re-consent modal |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
