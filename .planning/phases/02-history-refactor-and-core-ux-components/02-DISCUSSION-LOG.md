# Phase 2: History Refactor and Core UX Components - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 02-history-refactor-and-core-ux-components
**Areas discussed:** Chart library, Card expand animation, Session card layout, Legacy migration UX

---

## Chart Library

| Option | Description | Selected |
|--------|-------------|----------|
| react-native-gifted-charts | Pure JS, no native linking, Expo managed workflow compatible out of the box | ✓ |
| react-native-chart-kit | SVG-based (needs react-native-svg). Harder to add reference lines | |
| react-native-svg + custom | Full control, more code to write | |
| victory-native | Well-known but heavier, overkill for two simple line charts | |

**User's choice:** react-native-gifted-charts

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show reference lines | Horizontal lines at 3.9 and 10.0 mmol/L | ✓ |
| No — just the curve | Simpler look | |

**User's choice:** Show reference lines at 3.9 and 10.0 mmol/L

| Option | Description | Selected |
|--------|-------------|----------|
| Static — display only | Stats shown as text, no tap interaction on chart | ✓ |
| Interactive — tap to inspect | User can tap a point to see exact mmol/L value | |

**User's choice:** Static display only

---

## Card Expand Animation

| Option | Description | Selected |
|--------|-------------|----------|
| LayoutAnimation — same as day headers | Reuses existing easeInEaseOut pattern, no new deps | ✓ |
| Animated height — smooth slide | Animated.View with interpolated height | |
| No animation — instant toggle | Snaps open immediately, simplest | |

**User's choice:** LayoutAnimation (consistent with day headers)

| Option | Description | Selected |
|--------|-------------|----------|
| Stats row + glucose curve chart | Start/Peak/End values + GlucoseChart | ✓ |
| Stats row only (no chart in card) | Chart only on dedicated detail screen | |

**User's choice:** Stats row + glucose curve chart in expanded card

---

## Session Card Layout

| Option | Description | Selected |
|--------|-------------|----------|
| One card per session | Session = one card, meals listed inside | |
| One card per meal, grouped | Each meal its own card under session sub-header | ✓ |

**User's choice:** One card per meal, grouped under session sub-header
**Notes:** User noted the matching engine is not yet finalised — Phase 2 plan must fully specify component API and prop contract for matching slot before implementation begins.

| Option | Description | Selected |
|--------|-------------|----------|
| Time range only | e.g. "Session — 6:45 PM" | |
| Meal count + time | e.g. "Session — 2 meals, 6:45 PM" | ✓ |
| Nothing — meals grouped by proximity | No explicit header | |

**User's choice:** Meal count + time ("Session — X meals, H:MM PM")

| Option | Description | Selected |
|--------|-------------|----------|
| No — omit header for solo meals | Only show sub-header when 2+ meals | ✓ |
| Yes — always show session header | Consistent structure regardless of count | |

**User's choice:** Omit session sub-header for solo meals (most common case)

| Option | Description | Selected |
|--------|-------------|----------|
| Each meal card shows its own badge | Badge reflects that meal's own glucoseResponse | ✓ |
| Session-level badge on sub-header | One combined badge per session | |

**User's choice:** Each meal card shows its own outcome badge

| Option | Description | Selected |
|--------|-------------|----------|
| No placeholders — clean cards for Phase 2 | No matching UI, Phase 3 wires it in | |
| Add placeholder sections | Reserve space for matching content now | ✓ |

**User's choice:** Add placeholder sections

| Option | Description | Selected |
|--------|-------------|----------|
| Empty space / null render | Component accepts optional prop, renders nothing when null | |
| Greyed-out 'Loading...' text | Visible placeholder in expanded card | ✓ |
| Hidden section with 'Coming soon' | Subtle label communicating roadmap | |

**User's choice:** Greyed-out "Loading..." placeholder text in the matching slot

---

## Legacy Migration UX

| Option | Description | Selected |
|--------|-------------|----------|
| Totally silent | Background migration, no spinner or message | ✓ |
| Brief indicator on History screen | "Updating your history..." flash | |

**User's choice:** Totally silent

| Option | Description | Selected |
|--------|-------------|----------|
| Log and carry on | console.warn, synthetic fallback continues to work, retry next launch | ✓ |
| Show an error to the user | Alert popup | |

**User's choice:** Log and carry on

---

## Claude's Discretion

- Exact GlucoseChart sizing, colours, and curve styling
- DayGroupHeader visual styling
- OutcomeBadge exact colours and pill shape (must honour HIST-03 colour semantics)
- Greyed-out "Loading..." placeholder styling

## Deferred Ideas

None.
