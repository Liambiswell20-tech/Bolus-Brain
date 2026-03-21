---
phase: 3
slug: intelligence-layer-matching-and-outcome-surfacing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | package.json (`jest` key) |
| **Quick run command** | `npx jest --testPathPattern=matching` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=matching`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | PATT-01 | unit | `npx jest --testPathPattern=matching` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | PATT-01 | integration | `npx jest --testPathPattern=matching` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | PATT-02 | unit | `npx jest --testPathPattern=matching` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/matching.test.ts` — stubs for PATT-01 (findSimilarSessions) and PATT-02 (GREEN outcome indicator)

*Existing infrastructure covers test framework — jest already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "You've eaten this before" section renders in expanded card | PATT-01 | React Native UI rendering | Expand a history card with 2+ matching meals; verify section appears |
| Match rows show correct meal name, units, outcome badge | PATT-01 | Visual rendering | Expand card; confirm format "Last time: [name], [units] units, [badge]" |
| Typing in meal log triggers debounced match display | PATT-01 | User interaction timing | Type meal name; wait 400ms; verify matches appear below input |
| "This went well last time" only on GREEN outcomes | PATT-02 | Conditional UI state | Find a Green match and a non-Green match; verify indicator only on Green |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
