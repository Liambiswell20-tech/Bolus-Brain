---
phase: 1
slug: tech-debt-and-foundation-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 + jest-expo 54.0.17 |
| **Config file** | `package.json` `jest` key — Wave 0 installs |
| **Quick run command** | `npm test -- --watchAll=false` |
| **Full suite command** | `npm test -- --watchAll=false --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --watchAll=false`
- **After every plan wave:** Run `npm test -- --watchAll=false --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Setup Jest | 01 | 0 | TEST-01 | infra | `npm test -- --watchAll=false` | ❌ W0 | ⬜ pending |
| outcomeClassifier extract | 01 | 0 | TEST-01 | unit | `npm test -- --watchAll=false --testPathPattern=outcomeClassifier.test` | ❌ W0 | ⬜ pending |
| TEST-01 HbA1c | 01 | 1 | TEST-01 | unit | `npm test -- --watchAll=false --testPathPattern=storage.test` | ❌ W0 | ⬜ pending |
| TEST-01 badge (5 states) | 01 | 1 | TEST-01 | unit | `npm test -- --watchAll=false --testPathPattern=outcomeClassifier.test` | ❌ W0 | ⬜ pending |
| TEST-01 saveMeal grouping | 01 | 1 | TEST-01 | unit | `npm test -- --watchAll=false --testPathPattern=storage.test` | ❌ W0 | ⬜ pending |
| DEBT-02 sum fix | 02 | 1 | DEBT-02 | manual | n/a — verified by HbA1c test stability | ✅ after W0 | ⬜ pending |
| DEBT-03 extraction | 02 | 1 | DEBT-03 | manual | n/a — pure refactor, TypeScript compile | ✅ after W0 | ⬜ pending |
| DEBT-04 import | 02 | 1 | DEBT-04 | manual | n/a — TypeScript compile passes | ✅ after W0 | ⬜ pending |
| DEBT-05 error log | 02 | 1 | DEBT-05 | manual | n/a — code inspection | ✅ after W0 | ⬜ pending |
| DEBT-06 docs | 02 | 1 | DEBT-06 | manual | n/a — documentation change | ✅ after W0 | ⬜ pending |
| DEBT-07 try/catch | 02 | 1 | DEBT-07 | unit | `npm test -- --watchAll=false --testPathPattern=storage.test` | ❌ W0 | ⬜ pending |
| GitHub Actions CI | 03 | 2 | TEST-01 (D-03) | infra | CI triggers on push | ❌ new file | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install --save-dev jest@29.7.0 jest-expo@54.0.17 @types/jest@29.4.6` — install test framework
- [ ] `package.json` — add `jest` config key with preset + AsyncStorage mock + `"test"` script
- [ ] `src/utils/outcomeClassifier.ts` — extracted pure function (required for TEST-01 badge test)
- [ ] `src/utils/outcomeClassifier.test.ts` — stub file for badge classification tests
- [ ] `src/services/storage.test.ts` — stub file for HbA1c + session grouping tests

*All other fixes (DEBT-02 through DEBT-07) build on Wave 0 infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GlucoseStore sum recomputed correctly | DEBT-02 | Pure logic change — HbA1c unit test stability is indirect proof | Launch app, log 5 readings, force-close and reopen — HbA1c value should remain stable |
| buildGlucoseResponse used by both callers | DEBT-03 | Refactor only — same inputs → same outputs | `grep -r "buildGlucoseResponse" src/` should show 1 definition + 2 call sites |
| expo-file-system import uses new API | DEBT-04 | TypeScript compile + runtime path | `grep -r "expo-file-system/legacy" src/` returns no results |
| fetchGlucosesSince logs non-OK | DEBT-05 | Requires mocked fetch — no test written per TEST-01 scope | Code inspection: `grep -A3 "response.ok" src/services/nightscout.ts` shows console.warn |
| CLAUDE.md documents canonical curve | DEBT-06 | Documentation only | `grep "glucoseResponse" CLAUDE.md` shows canonical path documented |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
