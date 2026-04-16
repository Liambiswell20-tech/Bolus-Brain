# Phase 11: Supabase Migration & Multi-User Backend - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** Interactive discussion (2026-04-16)

<domain>
## Phase Boundary

Migrate BolusBrain from local-only AsyncStorage to Supabase as the multi-user backend. Everything required to onboard 5–10 external beta testers safely: authentication, encrypted server-side health data, idempotent migration of existing local data, server-side rate limiting on the AI carb estimate proxy, versioned AI consent, and server-enforced data-sharing consent.

**In scope:**
- Supabase client setup + env vars
- Schema + RLS policies (9 tables)
- Auth flow (email/password signup + login)
- Session persistence via `expo-secure-store`
- Biometric unlock (`expo-local-authentication`) after first login
- Manual "Migrate my data" button in Settings (not auto on login)
- AsyncStorage retained indefinitely as canonical/cache — Supabase is additive
- Server-side rate limit on `/api/carb-estimate` (in `bolusbrain-landing` repo) — 10 req/day/user keyed by auth JWT
- AI consent modal (one-time, versioned) before first carb estimate
- Data sharing toggle server-side enforcement
- HelpScreen copy update (photos pass through Anthropic)
- Integration verification on Liam's real data (zero-loss proof)

**Out of scope:**
- Magic-link auth (deferred — email+password only for MVP)
- Apple Sign In (not required unless Google/Facebook added later)
- Automatic migration on login
- Wiping local AsyncStorage after migration
- Phase 11.5 data integrity audit (separate phase)
- Phase 12 beta distribution (separate phase)

</domain>

<decisions>
## Implementation Decisions

### Auth model (LOCKED)
- **Email + password only.** No magic link, no Apple Sign In for MVP.
- **Reason:** 5–10 beta users, simpler UX, no SMTP setup needed, no Expo deep-linking wiring, no Apple policy triggers.
- Supabase default password-reset email flow is acceptable for beta.
- Revisit magic link if beta feedback cites password friction.

### Supabase region (LOCKED)
- **London (eu-west-2).**
- **Reason:** Lowest latency for UK users (Liam + beta testers), GDPR-friendly, data residency aligns with ICO registration ZC100677.

### Migration trigger (LOCKED)
- **Manual button in Settings** — "Migrate my data to the cloud" — NOT automatic on first login.
- **Reason:** Clearer failure mode, user-controlled, allows pre-migration verification. Previous automatic-migration attempt (commit `c487925`) failed silently and had to be reverted (`23df7b5`).
- Button shows progress UI (records migrated / total), error state, and retry.

### Local storage post-migration (LOCKED)
- **AsyncStorage kept INDEFINITELY as canonical + read-through cache.**
- **Reason:** Liam's logged data is irreplaceable (absolute rule in CLAUDE.md). Cannot risk loss. AsyncStorage remains the source of truth until beta ends AND multi-device sync is a proven requirement.
- This means writes go to AsyncStorage first, then Supabase (best-effort). Reads come from AsyncStorage; Supabase only for cross-device if we ever add it.

### Cowork handoff (LOCKED)
- **No Cowork handoff.** All implementation done in main context.
- User manually handles dashboard-only tasks (I'll provide exact steps):
  - Create Supabase project in London region
  - Copy URL + anon key into `.env`
  - Run schema SQL in Supabase SQL editor
  - Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env for landing page rate limit
  - (Future) Add secrets to EAS for builds

### Env vars (LOCKED)
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (safe client-side per Supabase RLS model)
- **Server-only** (in landing page `.env`, never bundled): `SUPABASE_SERVICE_ROLE_KEY` — used only by `/api/carb-estimate` rate-limit check
- Follows existing `.env` pattern (see CLAUDE.md — `EXPO_PUBLIC_NIGHTSCOUT_*`, `EXPO_PUBLIC_ANTHROPIC_API_KEY`)
- Never commit; `.env` is gitignored

### Data model decisions
- **Every user-scoped table has `user_id uuid references auth.users(id)` and RLS policy: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.**
- Encryption at rest: Supabase's default PostgreSQL encryption (AES-256) satisfies GDPR Article 9 at rest. No column-level encryption needed for MVP.
- Timestamps: `created_at timestamptz default now()`, `updated_at timestamptz default now()` on every table.
- Primary keys: `id uuid default gen_random_uuid()` — **NOT** `crypto.randomUUID()` (that JS-side bug killed the previous attempt; use Postgres `gen_random_uuid()` for server IDs; use `react-native-get-random-values`-backed UUIDs or Supabase-returned IDs for client).

### Rate limit (LOCKED)
- **10 req/day per authenticated user** on `/api/carb-estimate`.
- Keyed by Supabase JWT `sub` claim (user ID), not IP (IP-based already exists; JWT is per-user).
- Tracked in `ai_carb_requests` table: `user_id, requested_at`. Count rows in last 24h.
- Returns HTTP 429 with `Retry-After` header when exceeded.
- Lives in `bolusbrain-landing` repo at `app/api/carb-estimate/route.ts`.

### AI consent (LOCKED)
- One-time modal BEFORE first carb estimate (not at signup — only relevant to users who use the photo feature).
- Copy: "Your photo is sent to Anthropic's Claude API for carb estimation and is not stored by them. You can revoke this consent in Settings at any time."
- Versioned (`version: '1.0'`) — stored in `ai_consent_records` table: `user_id, version, accepted_at`.
- Revokable in Settings → "Data & Research" area (next to existing data-sharing toggle).

### Data sharing toggle (LOCKED)
- Existing `DataConsent` record (Phase 8) migrated to Supabase `data_consent_records` table.
- Server-side enforcement: any aggregation/export query MUST `WHERE user_id IN (SELECT user_id FROM data_consent_records WHERE consented = true AND version_current)`.
- Since no aggregation queries exist yet, enforcement is a helper function + test that any future query uses it.

### Pre-migration refactor
- `App.tsx` has 5 direct `AsyncStorage` calls (lines 91, 96, 101, 159, 176).
- `HomeScreen.tsx` has 2 direct `AsyncStorage` calls (lines 191, 198).
- Must be consolidated into `src/services/storage.ts` functions BEFORE migration runner is built.
- **Reason:** Single source of truth for reads/writes. Migration runner then only needs to iterate storage.ts functions, not hunt through screens.

### Biometric unlock (LOCKED)
- `expo-local-authentication` after first successful email+password login.
- Session persisted in `expo-secure-store` (not AsyncStorage — credentials are sensitive).
- On app open: if secure-store has session → prompt biometric → if pass, restore session. Fallback to email+password login always available.

### Claude's Discretion
- Exact schema column types + indexes for each table (follow Postgres best practices, covering indexes on `user_id + created_at desc`).
- UI layout of SignUpScreen / LoginScreen (use existing RNR components from Phase 10 — Card, Button, Input, Alert).
- Progress UI styling for migration (use RNR Skeleton + progress text).
- Test structure (Jest + `@testing-library/react-native`, match existing patterns in `src/__tests__/`).
- Error messages wording (match BolusBrain tone — factual, non-alarming, no "oops").

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project rules
- `CLAUDE.md` — security rules (never hardcode secrets), absolute rules (never data loss), env var conventions, canonical curve location
- `.planning/REQUIREMENTS.md` — project requirements (note: Phase 11 `phase_req_ids` is TBD, no specific IDs mapped yet)
- `.planning/STATE.md` — current project state

### Pre-migration target files (must read before editing)
- `src/services/storage.ts` — current AsyncStorage abstraction, destination for refactored calls
- `App.tsx` — has 5 direct AsyncStorage calls to consolidate (lines 91–176)
- `src/screens/HomeScreen.tsx` — has 2 direct AsyncStorage calls (lines 191, 198)

### Existing patterns to replicate
- `src/components/` — all new screens (SignUp, Login, AIConsent) must use RNR components from Phase 10 (`~/components/ui/*`)
- `src/__tests__/` — Jest test patterns for storage + logic
- `src/hooks/` — if adding `useAuth`, match existing hook conventions

### External docs
- Supabase JS SDK: https://supabase.com/docs/reference/javascript/introduction
- Supabase Expo integration: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- `expo-local-authentication`: https://docs.expo.dev/versions/latest/sdk/local-authentication/
- `expo-secure-store`: https://docs.expo.dev/versions/latest/sdk/securestore/

### Historical context
- **Previous Supabase attempt** (commit `c487925`) was reverted (commit `23df7b5`) — failed due to missing error handling + `crypto.randomUUID()` not existing in React Native runtime. Use `gen_random_uuid()` server-side or Supabase-returned IDs client-side. Never `crypto.randomUUID()`.
- **B2B data capture layer** (Phase 8) already introduced `HypoTreatment`, `DataConsent`, `EquipmentChangelog`, `DailyTIR` types. These need Supabase tables matching their shapes.

</canonical_refs>

<specifics>
## Specific Ideas

### Tables needed (9)
1. `user_profiles` — display name, onboarding flags (mirrors `about_me_completed`, `data_sharing_onboarding_completed`, etc.)
2. `meals` — full `Meal` interface + `glucoseResponse` JSONB
3. `insulin_doses` — rapid + long-acting, with `takenAt`, `units`, `type`
4. `hypo_treatments` — matches Phase 8 `HypoTreatment` type
5. `equipment_changelog` — matches Phase 8 type
6. `data_consent_records` — versioned, matches Phase 8 `DataConsent`
7. `ai_consent_records` — new for Phase 11 (versioned consent for AI carb estimation)
8. `daily_tir` — matches Phase 8 `DailyTIR`
9. `ai_carb_requests` — rate limit counter (user_id, requested_at, estimate returned)

### File additions (estimate)
- `lib/supabase.ts` — client init (~20 LOC)
- `src/contexts/AuthContext.tsx` — auth state + hooks (~80 LOC)
- `src/screens/SignUpScreen.tsx` — ~80 LOC
- `src/screens/LoginScreen.tsx` — ~80 LOC
- `src/screens/AIConsentModal.tsx` — ~60 LOC
- `src/services/migration.ts` — migration runner (~200 LOC — the risky one)
- `src/services/authStorage.ts` — secure-store wrapper (~40 LOC)
- `src/hooks/useBiometric.ts` — ~40 LOC
- `supabase/migrations/001_initial.sql` — schema (~200 LOC of SQL)
- Landing page: `app/api/carb-estimate/route.ts` — add rate-limit check (~40 LOC diff)

### File modifications (estimate)
- `App.tsx` — remove AsyncStorage calls, wire AuthContext (~40 LOC diff)
- `src/screens/HomeScreen.tsx` — remove AsyncStorage calls (~15 LOC diff)
- `src/screens/SettingsScreen.tsx` — add "Migrate my data" button + AI consent toggle (~50 LOC diff)
- `src/services/storage.ts` — add missing helpers (~60 LOC diff)
- `src/services/carbEstimate.ts` — add AI consent gate before first call (~20 LOC diff)
- `src/screens/HelpScreen.tsx` — copy update (~5 LOC diff)

Estimated total: ~700–900 LOC across ~17 files. Confirms GSD territory.

</specifics>

<deferred>
## Deferred Ideas

- **Magic-link auth** — revisit post-beta if password friction reported
- **Apple Sign In** — only needed if Google/Facebook login ever added
- **Multi-device sync** — not until a beta user specifically needs it; AsyncStorage remains canonical until then
- **AsyncStorage wipe** — never until beta ends and no regrets
- **Column-level encryption** — Supabase default AES-256 at rest is enough for GDPR Article 9 compliance for MVP
- **Offline-first sync engine (PowerSync, WatermelonDB, etc.)** — unnecessary since AsyncStorage remains canonical
- **Phase 11.5 data integrity audit** — separate phase, runs after 11 completes
- **Phase 12 beta distribution (TestFlight + Play Internal Testing)** — separate phase

</deferred>

---

*Phase: 11-supabase-migration-multi-user-backend*
*Context gathered: 2026-04-16 via interactive discussion (no /gsd:discuss-phase needed — decisions locked in conversation)*
