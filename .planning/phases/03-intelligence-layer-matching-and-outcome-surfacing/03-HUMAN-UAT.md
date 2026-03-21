---
status: partial
phase: 03-intelligence-layer-matching-and-outcome-surfacing
source: [03-VERIFICATION.md]
started: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### A. History card shows matching section for multi-logged meals
expected: Expanding a history card for a meal you've logged before shows "YOU'VE EATEN THIS BEFORE" with outcome-coloured rows. Cards for single-logged meals show nothing in that section.
result: [pending]

### B. Confidence warning on history card
expected: When a history card's own session has confidence !== 'high', the text "Other meals were logged in this session — results may be affected" appears above the section header.
result: [pending]

### C. Live inline match list on MealLogScreen
expected: Typing 2+ characters in the meal name field shows an inline match list below the input within ~300ms. Clearing back below 2 characters hides the list immediately.
result: [pending]

### D. Tap fills name and shows insulin hint — units field untouched
expected: Tapping a match row auto-fills the meal name field with that session's first meal name. The insulin hint "(Xu last time)" appears adjacent to the "Insulin units" label. The insulin units field remains empty/unchanged.
result: [pending]

### E. Insulin hint clears on name edit
expected: After tapping a match (hint shows), editing the meal name field clears the insulin hint immediately.
result: [pending]

### F. No advice language visible
expected: Neither the history card matching section nor the live match list contains any advice, recommendation, or suggestion language (e.g., "should", "try", "recommended", "your usual dose").
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
