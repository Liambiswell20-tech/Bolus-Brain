# Phase 3: Intelligence Layer — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 03-intelligence-layer-matching-and-outcome-surfacing
**Areas discussed:** Match row display, Meal log matching UX, "This went well" indicator, No-match state

---

## Match Row Display

| Option | Description | Selected |
|--------|-------------|----------|
| Name + units + badge only | Minimal, matches PATT-01 exactly | |
| Add the date | Temporal context — how recent the match was | |
| Add one glucose stat + date | Date + peak glucose alongside badge | ✓ |
| You decide | Claude's choice | |

**User's choice:** Name + units + badge + date + peak glucose per row
**Notes:** Wants enough context to know how the meal went and when — peak glucose gives the key number without overloading the row.

---

## Meal Log Matching UX

| Option | Description | Selected |
|--------|-------------|----------|
| Live inline below name field | Updates as you type (after ~2 chars), no tap required | ✓ |
| Section at bottom of form | Populates on pause, below save button | |
| Appears on blur | Runs when user taps away from field | |

**User's choice:** Live inline list below the name field

**Follow-up — tapping a match:**

| Option | Description | Selected |
|--------|-------------|----------|
| Display only | History visible, user types own name | |
| Auto-fill name | Tapping fills the meal name field | ✓ |
| Auto-fill name + insulin | Pre-populates insulin field too | |

**User's choice:** Auto-fill meal name on tap. Show previous insulin amount as `(Xu last time)` hint next to insulin field — display only, never pre-filled.
**Notes:** "Never suggest or auto fill insulin ratios only say what's happened previously. Factual." — this is a hard safety constraint, not a preference.

---

## "This Went Well" Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Short text label | "Went well" as small grey text | ✓ (combined) |
| Green dot / icon | Coloured indicator next to badge | ✓ (combined) |
| Highlighted row | Subtle green tint background | |
| You decide | Claude's choice | |

**User's choice:** Both — green dot icon + short text label together
**Notes:** Only shown when outcome badge is Green. Never shown for Pending or incomplete data.

---

## No-Match State

| Option | Description | Selected |
|--------|-------------|----------|
| Hide entirely | Slot disappears, no mention | ✓ |
| "First time logging this" | Small grey text acknowledges absence | |
| Hide when < 2 matches | Silence below threshold | |
| You decide | Claude's choice | |

**User's choice:** Hide entirely — complete silence when no matches

---

## Claude's Discretion

- Exact match row layout (flex, spacing, font sizes)
- Debounce delay for live matching
- Session-to-meal bridging implementation detail
- Whether sessions are loaded at screen level or per-card

## Deferred Ideas

None.
