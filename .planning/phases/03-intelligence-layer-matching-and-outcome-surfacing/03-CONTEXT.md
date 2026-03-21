# Phase 3: Intelligence Layer — Matching and Outcome Surfacing - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing `findSimilarSessions()` matching engine into two UI surfaces:
1. Expanded history cards — "You've eaten this before" section with up to 5 past matches
2. Meal log screen — live inline matching as the user types a meal name

No new matching logic. No aggregate stats. No advice language. Everything is framed as historical fact only.

</domain>

<decisions>
## Implementation Decisions

### Match Row Display (history cards)
- **D-01:** Each match row shows: meal name + units + outcome badge + date + peak glucose
- **D-02:** Format: "[Meal name] — Xu · [date] · peak [X.X] mmol/L · [badge]"
- **D-03:** Up to 5 matches shown (enforced by `findSimilarSessions` MAX_MATCHES = 5)
- **D-04:** Section only appears when 2 or more matches exist — hide entirely if < 2 matches
- **D-05:** Section header: "You've eaten this before" (no advice, no recommendation language)

### Meal Log Live Matching
- **D-06:** Matching triggers live as the user types the meal name — after a minimum of 2 characters
- **D-07:** Results appear inline directly below the meal name TextInput — no separate screen, no tap required
- **D-08:** Tapping a match row auto-fills the meal name field with that match's name
- **D-09:** Previous insulin amount shown as a hint in brackets next to the insulin field: "(Xu last time)" — this is factual display only, NEVER pre-filled, NEVER framed as a suggestion or recommendation
- **D-10:** If no matches meet the threshold, the inline list is hidden entirely — no "no results" message

### "This Went Well" Success Indicator (PATT-02)
- **D-11:** When a match's outcome badge is Green (glucose stayed in range), show a green dot icon + short text "Went well" on that match row
- **D-12:** Indicator appears ONLY when outcome badge is Green — never shown when data is incomplete (Pending), no curve (None), or any other outcome
- **D-13:** Language is strictly factual: "Went well" describes what happened, not what to do

### No-Match State
- **D-14:** When a meal has fewer than 2 past matches, the entire matching slot is hidden — no placeholder text, no "first time" message, complete silence
- **D-15:** This applies to both history cards and the meal log screen

### Safety / Legal (non-negotiable)
- **D-16:** All match display text must be historical framing only — "last time", "previously", "went well" — never "you should", "try", "recommended", or any forward-looking language
- **D-17:** Insulin hint "(Xu last time)" is display-only. The insulin field must never be auto-populated or have a default derived from past data.

### Claude's Discretion
- Exact match row layout (flex direction, spacing, font sizes) — consistent with existing card styles
- Debounce delay for live matching (300–500ms recommended to avoid thrashing)
- How to bridge meal → session for history card matching (meal has sessionId; load sessions, find the one containing this meal, run findSimilarSessions against it)
- Whether to load all sessions once at MealHistoryScreen level and pass down, or load per-card on expand

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — PATT-01, PATT-02 — exact acceptance criteria for this phase
- `.planning/ROADMAP.md` §Phase 3 — success criteria (3 items) that must all be TRUE

### Matching Engine
- `src/services/matching.ts` — `findSimilarSessions(target, allSessions)` returns `MatchSummary | null`; `SessionMatch` interface; `SIMILARITY_THRESHOLD = 0.25`; `MAX_MATCHES = 5`

### Component Contracts
- `src/components/types.ts` — `MatchingSlotProps` (Phase 3 wire-in point, line 28); `ExpandableCardProps` (matchingSlot field, line 37); comment says "Phase 3 will widen this type: null | MatchResult[]"
- `src/components/ExpandableCard.tsx` — matching slot stub at lines 181–185; styles.matchingSlot at line 227

### Data Model
- `src/services/storage.ts` — `SessionWithMeals` interface; `loadSessionsWithMeals()`; `Meal.sessionId` field (bridge from meal to session)

### Codebase Rules
- `CLAUDE.md` — safety rules, "never give insulin dosing advice", "frame everything as last time you ate this"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `findSimilarSessions(target, allSessions)` in `src/services/matching.ts` — fully built, returns `MatchSummary | null` with up to 5 `SessionMatch[]` objects. Each `SessionMatch` has `.session` (full `SessionWithMeals`) and `.score`.
- `classifyOutcome(glucoseResponse)` in `src/utils/outcomeClassifier.ts` — use to determine if a match is Green for PATT-02 indicator
- `ExpandableCard` matching slot stub — line 183 renders greyed "Loading..." — Phase 3 replaces this block entirely
- `OutcomeBadge` component in `src/components/OutcomeBadge.tsx` — reuse for each match row badge

### Established Patterns
- Dark card background: `#1C1C1E`, secondary surface: `#2C2C2E`, divider: borderTopColor `#2C2C2E`
- Insulin badge style: `#0A1A3A` background, `#0A84FF` text — reuse or similar for insulin hint
- `glucoseColor(mmol)` already defined in ExpandableCard — reuse for peak glucose colouring on match rows
- Debounced live search pattern not yet in codebase — implement with `useEffect` + `setTimeout` clearTimeout

### Integration Points
- `ExpandableCard.tsx` — widen `MatchingSlotProps.matchData` from `null` to `null | MatchSummary`; replace placeholder block with real match list
- `MealHistoryScreen.tsx` — load sessions once on screen load; pass session context down to each `ExpandableCard` so it can call `findSimilarSessions` on expand (or pre-compute and pass `matchData`)
- `MealLogScreen.tsx` — add `useEffect` on `mealName` state with debounce; call `findSimilarSessions` with a synthetic session built from current input; render inline match list below TextInput; show insulin hint when match tapped

</code_context>

<specifics>
## Specific Ideas

- Insulin hint: "(Xu last time)" next to the insulin field label — parenthesised, small, grey — factual only
- "Went well" indicator: green dot + text on the match row — only for Green outcome badge
- The inline match list on MealLogScreen should feel like a lightweight autocomplete — not a modal, not a separate screen
- Auto-fill on tap fills the name field only — keyboard should dismiss after tap so user can proceed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-intelligence-layer-matching-and-outcome-surfacing*
*Context gathered: 2026-03-21*
