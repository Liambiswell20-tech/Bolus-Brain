# BolusBrain — Claude Code Project Rules

## What This App Is
A personal meal and insulin tracking app for Type 1 diabetics.
Developer and first user: Liam Biswell (T1D, FreeStyle Libre 2 Plus, UK).

Full project brief: `C:\Users\Liamb\OneDrive\Desktop\Bolus Brain Project\CLAUDE.md`

---

## Security Rules — NON-NEGOTIABLE
- **NEVER hardcode API keys, tokens, URLs with tokens, or credentials in source files**
- All secrets must live in `.env` only — use `EXPO_PUBLIC_*` prefix for Expo access
- `.env` is gitignored — never commit it, never suggest committing it
- When adding a new external service, always use an env var from day one
- If a secret is ever accidentally committed, treat it as compromised immediately — rotate it

**Env vars in use:**
- `EXPO_PUBLIC_NIGHTSCOUT_URL` — Nightscout API endpoint
- `EXPO_PUBLIC_NIGHTSCOUT_TOKEN` — Nightscout access token
- `EXPO_PUBLIC_ANTHROPIC_API_KEY` — Claude API key for carb estimation

---

## Absolute Rules
- Always display glucose in **mmol/L** — never mg/dL
- **Never give insulin dosing advice** — show historical patterns only
- Frame everything as "last time you ate this..." not "you should take X units"
- Keep UI simple — used at mealtimes, often one-handed

## Glucose Colour Ranges (used throughout the app)
- Red: `< 3.9 mmol/L` (low / hypo)
- Green: `3.9 – 10.0 mmol/L` (in range)
- Orange: `> 10.0 mmol/L` (high)

## Nightscout API
- URL: set via `EXPO_PUBLIC_NIGHTSCOUT_URL` in `.env`
- Token: set via `EXPO_PUBLIC_NIGHTSCOUT_TOKEN` in `.env`
- `sgv` is mg/dL — divide by 18 for mmol/L
- Readings every 5 minutes

## Key Architecture Decisions
- **Canonical curve location**: `Meal.glucoseResponse` — always use `fetchAndStoreCurveForMeal(mealId)` to fetch and store curves. The `_fetchCurveForSession` path (which saves to `Session.glucoseResponse`) is deprecated — it exists for backward compatibility only and must not be used for new features.
- Sessions exist in storage for future pattern matching but are NOT displayed in history
- Session grouping caps strictly at `session.startedAt + 3hrs` (no chain-reaction)
- `GlucoseResponse` fields: startGlucose, peakGlucose, timeToPeakMins, totalRise, endGlucose, fallFromPeak, timeFromPeakToEndMins, readings, isPartial, fetchedAt

## Current Build Phase
- GSD project initialized — see `.planning/` for roadmap and requirements
- Do NOT build prediction engine until 50+ meals logged

---

## Tool Orchestration Rules

Three tools are in use. Each has a distinct role — do NOT let them overlap:

| Tool | Role | Owns |
|------|------|------|
| **GSD** | Project orchestrator | Roadmap, phase planning, execution waves, verification |
| **gstack CEO/Eng review** | Strategic review | Plan quality review before execution |
| **Superpowers** | Per-task discipline | TDD enforcement, git worktrees, code review within tasks |

**Rules:**
- GSD drives all phase planning and execution — never invoke `superpowers:writing-plans` or `superpowers:executing-plans` while GSD is managing a phase
- Superpowers TDD (`superpowers:test-driven-development`) SHOULD be invoked for every implementation task within a phase
- Superpowers systematic debugging (`superpowers:systematic-debugging`) SHOULD be invoked when investigating bugs
- Superpowers code review (`superpowers:requesting-code-review`) SHOULD run before completing each plan
- GSD executor subagents automatically skip Superpowers (enforced by `<SUBAGENT-STOP>` in Superpowers itself)
