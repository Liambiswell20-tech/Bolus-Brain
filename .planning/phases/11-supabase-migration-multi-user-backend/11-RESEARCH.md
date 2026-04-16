# Phase 11: Supabase Migration & Multi-User Backend — Research

**Researched:** 2026-04-16
**Domain:** Supabase (auth + Postgres + RLS) on Expo/React Native + Next.js Route Handler for server-side rate limit
**Confidence:** HIGH (Supabase client setup, RLS, auth, biometrics, UUID polyfill) / MEDIUM (migration runner architecture, exact email rate limits)

## Summary

Phase 11 is the single highest-risk phase in the project: a previous Supabase attempt was reverted (commit `23df7b5`) after `crypto.randomUUID()` turned out not to exist in the React Native Hermes runtime and migration error handling was insufficient. The central discipline for this phase is therefore **additive migration only** — AsyncStorage stays canonical, Supabase writes are best-effort, and every client-generated ID must route through a verified polyfill or come back from Postgres `gen_random_uuid()`.

The stack is essentially fixed by CONTEXT.md: `@supabase/supabase-js` v2 with an `expo-secure-store`-backed session adapter (using the 2 KB-safe `LargeSecureStore` pattern from Supabase's own Expo guide), `expo-local-authentication` for biometric re-entry, a Postgres schema with RLS enforcing `auth.uid() = user_id` on every table, and a small Postgres rate-limit counter surfaced through a Next.js Route Handler in the `bolusbrain-landing` repo that validates Supabase JWTs using `supabase.auth.getUser(jwt)`.

**Primary recommendation:** Build in this order — (1) polyfills + client + env vars, (2) schema + RLS, (3) pre-migration refactor (consolidate 7 scattered AsyncStorage calls into `storage.ts`), (4) auth + AuthContext + biometric unlock, (5) idempotent migration runner with per-record content hash, (6) server-side rate limit on the landing page, (7) AI consent modal + HelpScreen copy, (8) end-to-end verification on Liam's real data. Do NOT combine auth and migration in one wave — they are independent and migration carries the highest blast radius.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth model:** Email + password only. No magic link, no Apple Sign In for MVP. Supabase default password-reset email flow is acceptable for beta. Revisit magic link if beta feedback cites password friction.

**Supabase region:** London (eu-west-2). Lowest latency for UK users, GDPR-friendly, aligns with ICO registration ZC100677.

**Migration trigger:** Manual button in Settings — "Migrate my data to the cloud" — NOT automatic on first login. Button shows progress UI (records migrated / total), error state, and retry.

**Local storage post-migration:** AsyncStorage kept INDEFINITELY as canonical + read-through cache. Writes go to AsyncStorage first, then Supabase (best-effort). Reads come from AsyncStorage.

**Cowork handoff:** None. All implementation in main context. User manually handles dashboard-only tasks (Supabase project creation in London, schema SQL execution, Vercel env vars).

**Env vars:**
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL (client-safe)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-safe under RLS model)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, in landing page `.env`, never bundled into the Expo app
- `.env` is gitignored; never commit.

**Data model:**
- Every user-scoped table has `user_id uuid references auth.users(id)` and RLS policies: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.
- Encryption at rest: Supabase default AES-256 satisfies GDPR Article 9 for MVP. No column-level encryption.
- Timestamps: `created_at timestamptz default now()`, `updated_at timestamptz default now()` on every table.
- Primary keys: `id uuid default gen_random_uuid()` server-side. **NEVER `crypto.randomUUID()` client-side** — that was the bug that killed the last attempt.

**Rate limit:** 10 req/day per authenticated user on `/api/carb-estimate`. Keyed by Supabase JWT `sub` claim. Tracked in `ai_carb_requests` table. HTTP 429 + `Retry-After` header on exceed. Lives in `bolusbrain-landing` repo at `app/api/carb-estimate/route.ts`.

**AI consent:** One-time modal BEFORE first carb estimate (not at signup). Copy: "Your photo is sent to Anthropic's Claude API for carb estimation and is not stored by them. You can revoke this consent in Settings at any time." Version `1.0`. Stored in `ai_consent_records`. Revokable in Settings.

**Data sharing toggle:** Existing `DataConsent` record (Phase 8) migrated to `data_consent_records`. Server-side enforcement: any aggregation query MUST filter `WHERE user_id IN (SELECT user_id FROM data_consent_records WHERE consented = true AND version_current)`. Since no aggregation queries exist yet, enforcement is a helper + test.

**Pre-migration refactor:** Consolidate 7 direct `AsyncStorage` calls (5 in `App.tsx` lines 91, 96, 101, 159, 176; 2 in `HomeScreen.tsx` lines 191, 198) into `src/services/storage.ts` BEFORE migration runner is built.

**Biometric unlock:** `expo-local-authentication` after first successful email+password login. Session in `expo-secure-store` (not AsyncStorage). Fallback to email+password always available.

### Claude's Discretion
- Exact schema column types + indexes (follow Postgres best practices, covering indexes on `user_id + created_at desc`).
- UI layout of SignUpScreen / LoginScreen (use existing RNR components from Phase 10 — Card, Button, Input, Alert).
- Progress UI styling for migration (use RNR Skeleton + progress text).
- Test structure (Jest + `@testing-library/react-native`, match existing `src/__tests__/`).
- Error messages wording (match BolusBrain tone — factual, non-alarming, no "oops").

### Deferred Ideas (OUT OF SCOPE)
- Magic-link auth — revisit post-beta if password friction reported
- Apple Sign In — only needed if Google/Facebook login ever added
- Multi-device sync — not until a beta user specifically needs it; AsyncStorage remains canonical until then
- AsyncStorage wipe — never until beta ends and no regrets
- Column-level encryption — Supabase default AES-256 at rest is enough for GDPR Article 9 for MVP
- Offline-first sync engine (PowerSync, WatermelonDB) — unnecessary since AsyncStorage remains canonical
- Phase 11.5 data integrity audit — separate phase
- Phase 12 beta distribution (TestFlight + Play Internal Testing) — separate phase
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQ-IDs were mapped in `.planning/REQUIREMENTS.md` for Phase 11 (ROADMAP.md lists them as TBD). The de-facto requirements are the 8 Success Criteria from ROADMAP.md Phase 11, re-stated here with research support:

| ID (proposed) | Description | Research Support |
|---|---|---|
| SUPA-01 | Email/password signup + login, biometric unlock after first login | §Auth Implementation (supabase-js `signUp`/`signInWithPassword`), §Biometric Architecture (`expo-local-authentication`) |
| SUPA-02 | All health data in Supabase PostgreSQL with RLS (per-user isolation) | §Schema Design, §RLS Patterns |
| SUPA-03 | Encrypted at rest (GDPR Article 9) | Supabase default AES-256 disk encryption; documented in `going-into-prod` |
| SUPA-04 | Server-side rate limit on `/api/carb-estimate` (10 req/day/user) | §Server-Side Rate Limit (Postgres counter + JWT validation via `supabase.auth.getUser(jwt)`) |
| SUPA-05 | AI consent modal versioned, before first carb estimate | §AI Consent Gate |
| SUPA-06 | Idempotent AsyncStorage → Supabase migration preserving all data | §Migration Runner Architecture |
| SUPA-07 | Data sharing toggle server-side enforced | §Data Sharing Enforcement |
| SUPA-08 | HelpScreen copy mentions photos pass through Anthropic | §Code Examples (content change only) |

The planner SHOULD adopt these IDs (or equivalents) and reference them in PLAN.md files. They should also be added to REQUIREMENTS.md as a follow-up.
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.103.3` (current as of 2026-04-16) | Auth + Postgres client | Official SDK; RN supported as first-class runtime |
| `@react-native-async-storage/async-storage` | `2.2.0` (already installed) | Encrypted body storage for oversized Supabase session (via `LargeSecureStore`) | Already in project; only safe target for > 2 KB values |
| `expo-secure-store` | `~55.0.13` | Stores the AES-256 key that encrypts the session in AsyncStorage | iOS Keychain / Android Keystore — the correct home for a key that unlocks health data |
| `expo-local-authentication` | `~55.0.13` | Face ID / Touch ID / fingerprint gate on app open | Official Expo module; handles hardware detection and enrollment check |
| `aes-js` | `^3.1.2` | AES-256 symmetric encryption used by `LargeSecureStore` | Used verbatim in Supabase's Expo tutorial; pure JS, no native dep |
| `react-native-get-random-values` | `^2.0.0` (`3.0.0` available but confirm Expo SDK 54 compat) | Polyfills `crypto.getRandomValues()` in Hermes — required by `uuid` and `aes-js` | **Without this, `uuid` throws at runtime in RN. This is the category of bug that killed the previous Supabase attempt.** |
| `uuid` | `^11.x` (LTS; `13.x` is CJS-incompatible) | Client-side UUID generation when a client-pre-generated ID is needed | Hermes has no native `crypto.randomUUID()`; this is the verified polyfill path |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-url-polyfill` | `^3.0.0` | Polyfills WHATWG URL in RN | Import in entry file; Supabase SDK uses `URL` internally for endpoint construction. Recommended in older Supabase RN guides; modern RN has partial URL support but the polyfill removes edge-case failures |
| `expo-crypto` | already available via Expo SDK | Alternative `randomUUID()` that works in Hermes | Fallback option if the team prefers not to add `uuid` + `get-random-values`; `Crypto.randomUUID()` from `expo-crypto` is synchronous in modern versions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `LargeSecureStore` (Supabase's AES-wrap-around-AsyncStorage) | Putting session directly in `expo-secure-store` | SecureStore has a ~2 KB soft limit on iOS; Supabase refresh tokens often exceed this. The AES-key-in-SecureStore pattern is Supabase's own guidance — deviating invites runtime failures on real devices |
| `uuid` package | `expo-crypto`'s `Crypto.randomUUID()` | Both work. `expo-crypto` removes two dependencies (`uuid` + `react-native-get-random-values`), but `uuid` is the broader ecosystem default. Either is safe; we must NOT use the global `crypto.randomUUID()` |
| Postgres counter for rate limit | Upstash Redis on Vercel | Postgres counter: one fewer service, cheaper, consistent with Supabase-native stack. Redis: faster, atomic INCR. For 10 req/day/user and 5–10 beta users, Postgres is amply fast |
| Email confirmation ON | Email confirmation OFF for beta | ON: slower first experience, requires working deep-link handling (research below). OFF: instant session on signup, simpler for 5–10 known beta testers. **Recommend OFF for beta**; switch ON before public launch |

**Installation (Expo app):**
```bash
npx expo install @supabase/supabase-js expo-secure-store expo-local-authentication react-native-get-random-values react-native-url-polyfill
npm install aes-js uuid
```

Note: `@react-native-async-storage/async-storage` is already installed. Using `npx expo install` for Expo-managed modules guarantees SDK 54 compatibility.

**Installation (landing page, if not already present):**
```bash
npm install @supabase/supabase-js
```

**Version verification** (run before pinning in `package.json`):
```bash
npm view @supabase/supabase-js version
npm view expo-secure-store version
npm view expo-local-authentication version
```
Verified 2026-04-16: `@supabase/supabase-js@2.103.3`, `expo-secure-store@55.0.13`, `expo-local-authentication@55.0.13`, `react-native-get-random-values@2.0.0`, `uuid@13.0.0` (note: uuid 13 dropped CJS; pin to `^11` for broadest tooling compatibility unless ESM-only is confirmed project-wide).

## Architecture Patterns

### Recommended File Layout

```
bolusbrain-app/
├── App.tsx                          # Wire <AuthProvider>, import polyfills at TOP
├── index.ts                         # Entry file — FIRST line must be: import 'react-native-get-random-values'
├── lib/
│   └── supabase.ts                  # createClient() + LargeSecureStore adapter
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx          # useAuth(), session + loading + signIn/signUp/signOut
│   ├── services/
│   │   ├── storage.ts               # EXISTING — extend, do not break
│   │   ├── migration.ts             # Idempotent one-shot migration runner (NEW, ~200 LOC)
│   │   ├── authStorage.ts           # Secure-store wrapper for biometric unlock state (NEW)
│   │   └── carbEstimate.ts          # EXISTING — add consent check before first call
│   ├── hooks/
│   │   └── useBiometric.ts          # hasHardwareAsync + authenticateAsync wrapper (NEW)
│   ├── screens/
│   │   ├── SignUpScreen.tsx         # NEW
│   │   ├── LoginScreen.tsx          # NEW
│   │   ├── AIConsentModal.tsx       # NEW (modal component, not a Stack screen)
│   │   ├── SettingsScreen.tsx       # EXISTING — add "Migrate my data" button + AI consent toggle
│   │   └── HelpScreen.tsx           # EXISTING — 5 LOC copy edit only
│   └── types/
│       └── supabase.ts              # Generated or hand-authored row types matching schema
└── supabase/
    └── migrations/
        └── 001_initial.sql          # Full schema + RLS policies + triggers
```

```
bolusbrain-landing/
└── app/
    └── api/
        └── carb-estimate/
            └── route.ts              # EXISTING — add JWT extract + Postgres rate-limit check
```

### Pattern 1: Supabase Client with LargeSecureStore Adapter

**What:** The Supabase session object can exceed the 2 KB SecureStore limit on iOS. Supabase's official Expo tutorial uses a wrapper class that stores an AES-256 key in SecureStore and the (encrypted) session body in AsyncStorage.

**When to use:** Every Expo/React Native Supabase project that handles sensitive data.

**Example:**
```typescript
// lib/supabase.ts
// Source: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values'; // MUST be imported somewhere before createClient
import { createClient } from '@supabase/supabase-js';

class LargeSecureStore {
  private async _encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }
  private async _decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return await this._decrypt(key, encrypted);
  }
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // CRITICAL in RN — no browser URL to parse
  },
});
```

### Pattern 2: AppState Auto-Refresh

**What:** Auto-refresh should run only while the app is foregrounded. This is documented in Supabase's auth reference as the required RN pattern.

```typescript
// App.tsx or a dedicated hook
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
  return () => subscription.remove();
}, []);
```
Source: https://supabase.com/docs/reference/javascript/auth-startautorefresh

### Pattern 3: AuthContext with onAuthStateChange

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Load existing session from LargeSecureStore
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // 2. Subscribe to changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```
Source: https://supabase.com/docs/reference/javascript/auth-onauthstatechange — emits `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `PASSWORD_RECOVERY`, `TOKEN_REFRESHED`, `USER_UPDATED`.

### Pattern 4: Default-Deny RLS with Per-Operation Policies

**What:** Supabase tables default to RLS OFF. Enable it, then write a separate policy per verb. `auth.uid() = user_id` is the canonical filter.

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,          -- original AsyncStorage id, for idempotent migration
  name text not null,
  photo_uri text,
  insulin_units numeric not null default 0,
  start_glucose numeric,
  carbs_estimated integer,
  logged_at timestamptz not null,
  session_id text,
  glucose_response jsonb,           -- full GlucoseResponse shape
  insulin_brand text,
  delivery_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)       -- IDEMPOTENCY anchor: re-running migration = no-op
);

alter table public.meals enable row level security;

create policy "meals_select_own"
  on public.meals for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "meals_insert_own"
  on public.meals for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "meals_update_own"
  on public.meals for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "meals_delete_own"
  on public.meals for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index meals_user_id_logged_at_idx
  on public.meals (user_id, logged_at desc);
```

### Pattern 5: `updated_at` Trigger

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger meals_set_updated_at
  before update on public.meals
  for each row execute procedure public.set_updated_at();
-- Repeat per table.
```

### Pattern 6: Idempotent Migration Runner

**What:** Iterate each AsyncStorage-backed collection, upsert into Supabase keyed by `(user_id, client_id)`. Store a `migrated_at` flag in AsyncStorage AFTER successful server acknowledgment.

```typescript
// src/services/migration.ts (skeleton — full implementation ~200 LOC)
type MigrationProgress = {
  stage: 'idle' | 'running' | 'succeeded' | 'partial' | 'failed';
  totalRecords: number;
  migratedRecords: number;
  failedCollections: string[];
  error?: string;
};

export async function migrateToSupabase(
  onProgress: (p: MigrationProgress) => void
): Promise<MigrationProgress> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { stage: 'failed', totalRecords: 0, migratedRecords: 0, failedCollections: [], error: 'Not signed in' };

  // Count first (for progress UI)
  const meals = await loadMeals();
  const insulin = await loadInsulinLogs();
  const hypos = await loadHypoTreatments();
  const profile = await loadUserProfile();
  const equipment = await loadEquipmentChangelog();
  const tir = await getDailyTIRHistory();
  const consent = await loadDataConsent();
  const tablets = await loadTabletDosing();
  const total = meals.length + insulin.length + hypos.length + equipment.length + tir.length + (profile ? 1 : 0) + (consent ? 1 : 0) + tablets.length;

  onProgress({ stage: 'running', totalRecords: total, migratedRecords: 0, failedCollections: [] });
  let migrated = 0;
  const failed: string[] = [];

  // Upsert each collection — on conflict (user_id, client_id) do update
  for (const chunk of chunkBy(meals, 50)) {
    const { error } = await supabase.from('meals').upsert(
      chunk.map(m => ({
        user_id: user.id,
        client_id: m.id,
        name: m.name,
        photo_uri: m.photoUri,
        insulin_units: m.insulinUnits,
        start_glucose: m.startGlucose,
        carbs_estimated: m.carbsEstimated,
        logged_at: m.loggedAt,
        session_id: m.sessionId,
        glucose_response: m.glucoseResponse,
        insulin_brand: m.insulin_brand ?? null,
        delivery_method: m.delivery_method ?? null,
      })),
      { onConflict: 'user_id,client_id' }
    );
    if (error) { failed.push('meals'); break; }
    migrated += chunk.length;
    onProgress({ stage: 'running', totalRecords: total, migratedRecords: migrated, failedCollections: failed });
  }
  // ... repeat for every collection ...

  // IMPORTANT: AsyncStorage is NEVER wiped. On partial failure, we report and allow retry.
  if (failed.length === 0) {
    await AsyncStorage.setItem('supabase_migration_v1_completed_at', new Date().toISOString());
    return { stage: 'succeeded', totalRecords: total, migratedRecords: migrated, failedCollections: [] };
  }
  return { stage: 'partial', totalRecords: total, migratedRecords: migrated, failedCollections: failed };
}
```

**Idempotency anchor:** The `UNIQUE (user_id, client_id)` constraint + `upsert(..., { onConflict: 'user_id,client_id' })`. Re-running migration = no-op, no duplicates, no data loss.

**Chunk size:** 50 rows per request is safe. Supabase PostgREST has no hard documented row limit per batch, but request body sizes above ~1 MB start to hit edge function limits; 50 meal rows is well under that even with `glucose_response` JSON.

### Pattern 7: Server-Side Rate Limit (Next.js Route Handler)

```typescript
// bolusbrain-landing/app/api/carb-estimate/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,          // bypasses RLS — server only
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const DAILY_LIMIT = 10;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const jwt = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!jwt) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  // supabase.auth.getUser(jwt) performs a network call to Auth server and is authoritative.
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  const userId = userData.user.id;

  // Count requests in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabaseAdmin
    .from('ai_carb_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('requested_at', since);

  if (countError) return NextResponse.json({ error: 'Rate check failed' }, { status: 500 });
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: 'Daily limit reached. Please try again tomorrow.' },
      { status: 429, headers: { 'Retry-After': '86400' } }
    );
  }

  // Record the attempt BEFORE calling Anthropic so we don't over-serve on partial failure
  const { error: insertError } = await supabaseAdmin
    .from('ai_carb_requests')
    .insert({ user_id: userId, requested_at: new Date().toISOString() });
  if (insertError) return NextResponse.json({ error: 'Rate insert failed' }, { status: 500 });

  // ... existing Anthropic call ...
}
```

Client side: every call to the proxy must attach the Supabase access token.
```typescript
const { data: { session } } = await supabase.auth.getSession();
const resp = await fetch(CARB_ESTIMATE_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  },
  body: JSON.stringify({ imageBase64 }),
});
```

### Pattern 8: AI Consent Gate

```typescript
// src/services/carbEstimate.ts (modification)
async function ensureAIConsent(): Promise<boolean> {
  const { data, error } = await supabase
    .from('ai_consent_records')
    .select('version')
    .eq('user_id', userId)
    .eq('version', CURRENT_AI_CONSENT_VERSION)  // '1.0'
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
// Caller: if (!await ensureAIConsent()) { showConsentModal(); return; }
```

### Pattern 9: Biometric Unlock on App Open

```typescript
// src/hooks/useBiometric.ts
import * as LocalAuthentication from 'expo-local-authentication';

export async function promptBiometric(reason: string): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return false; // fall back to password
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Use password',
    disableDeviceFallback: false, // allow device PIN/passcode fallback
  });
  return result.success;
}
```

**App.tsx flow on startup:**
1. `supabase.auth.getSession()` — hydrates from LargeSecureStore (AES-encrypted in AsyncStorage).
2. If session exists AND user previously enabled biometric (flag in `expo-secure-store`):
   - Call `promptBiometric('Unlock BolusBrain')`.
   - Success → render app.
   - Failure or fallback → `supabase.auth.signOut()` → Login screen.
3. If no session → Login screen.

**`app.json` for Face ID:**
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSFaceIDUsageDescription": "BolusBrain uses Face ID to unlock your health data quickly."
      }
    }
  }
}
```
Required by `expo-local-authentication`; without it, iOS silently fails on Face ID and the build may be rejected from TestFlight.

### Anti-Patterns to Avoid

- **Storing the Supabase session in plain AsyncStorage.** Health app, GDPR Article 9 data. The encrypted-key-in-SecureStore wrapper is the minimum bar.
- **Wiping AsyncStorage after migration.** Explicit CLAUDE.md absolute rule. Even after successful migration, AsyncStorage stays.
- **Calling `crypto.randomUUID()` anywhere in RN code.** Not available in Hermes. Killed the previous attempt.
- **Generating client IDs in migration runner that don't match existing AsyncStorage IDs.** Migration idempotency depends on `client_id === original_asyncstorage_id`. Generating fresh UUIDs on migration would create duplicate records on retry.
- **Enabling RLS but forgetting to write any policy.** Table becomes inaccessible even to the owner. Always write at least one policy when enabling RLS.
- **Creating a table without RLS enabled.** The anon key makes it readable by anyone on the internet. Default-deny posture: enable RLS on every table in the `public` schema the moment it is created.
- **Using `service_role` key client-side.** It bypasses RLS entirely. Only use in the landing page server env; never in Expo bundle.
- **Trusting `supabase.auth.getSession()` in server code.** Use `supabase.auth.getUser(jwt)` — it calls the Auth server and validates. `getSession()` just reads local storage.
- **Forgetting `detectSessionInUrl: false`.** The default `true` tries to parse a browser URL; in RN this is a no-op at best, a runtime warning at worst.
- **Running migration automatically on login.** CONTEXT.md explicitly locks this to a manual Settings button — the previous auto-migration attempt failed silently and had to be reverted.
- **Atomic "all or nothing" migration.** One bad row would block the entire data set. Use per-collection upsert loops with progress reporting; on failure, record which collection failed and allow retry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation on the landing page | Custom JWT signature verification with the JWT secret | `supabaseAdmin.auth.getUser(jwt)` — Supabase docs explicitly recommend this over local JWKS verification | Supabase's docs "strongly recommend against" local shared-secret verification; `getUser(jwt)` handles revocation, signing key rotation, and edge cases |
| Secure session persistence on RN | Rolling your own AES-256 wrapper | Supabase's `LargeSecureStore` pattern (verbatim from official tutorial) | The 2 KB SecureStore limit is a real iOS keychain constraint; the tutorial code is battle-tested and audited |
| Password complexity validation | Custom regex for password strength | Supabase Auth dashboard "Password Strength" setting | Validates server-side so clients can't bypass; returns structured errors |
| UUID generation in RN | `crypto.randomUUID()` (broken) or `Math.random()` (insecure) | `gen_random_uuid()` in Postgres for server-created rows; `uuid` + `react-native-get-random-values` when you truly need a client-pre-generated ID | Hermes has no `crypto.randomUUID()`; the v4 spec requires cryptographic randomness which `Math.random()` doesn't provide |
| Rate limiting atomically | In-memory counter on serverless | Postgres counter table with `(user_id, requested_at)` + `SELECT count(*)` | Serverless = stateless; in-memory counters reset on cold start. Postgres gives atomic, shared, observable rate state |
| `updated_at` maintenance | Application-level updated_at on every write | Postgres `before update` trigger | One place to maintain; impossible to forget when adding new write paths |
| Email deliverability for password reset in beta | Custom SMTP setup | Supabase built-in SMTP (accept rate limits as a known trade-off) | Beta is 5–10 users, built-in SMTP suffices; custom SMTP is a post-beta improvement |

**Key insight:** Supabase has intentional guardrails — `getUser(jwt)` over local JWT, RLS over app-level authorization, default-deny policies, `gen_random_uuid()` — that remove entire categories of bugs. Don't fight the framework. The `crypto.randomUUID()` bug from the last attempt was literally a case of not using Postgres `gen_random_uuid()` for server rows.

## Runtime State Inventory

Phase 11 is primarily additive (new tables, new screens) — but the pre-migration refactor and migration runner both touch **existing runtime state** stored outside git. This inventory covers what breaks if ignored.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data (local)** | AsyncStorage keys used by existing app: `glucolog_meals`, `glucolog_sessions`, `glucolog_insulin_logs`, `glucolog_migration_v1`, `glucolog_hba1c_cache`, `glucolog_glucose_store`, `hypo_treatments`, `user_profile`, `tablet_dosing`, `equipment_changelog`, `daily_tir`, `data_consent`, `data_sharing_onboarding_completed`, `about_me_completed` — enumerated in `src/services/storage.ts` and `App.tsx`. | Migration runner MUST load each key via the appropriate `storage.ts` helper (or raw `AsyncStorage.getItem` for the ones that don't yet have helpers — see Pre-Migration Refactor). **AsyncStorage is NEVER wiped post-migration.** |
| **Stored data (server)** | No existing server data to migrate FROM (this phase creates the server). On the server: new tables described in §Schema Design. | Schema migration file `supabase/migrations/001_initial.sql` creates all 9 tables + policies + triggers. |
| **Live service config** | Supabase project itself (created by Liam in dashboard), Supabase Auth settings (email templates, rate limits, auto-confirm flag), Vercel env vars on `bolusbrain-landing` (`SUPABASE_SERVICE_ROLE_KEY` must be added). | Provide a step-by-step manual checklist to Liam: (1) create project in London region, (2) copy URL + anon key to Expo `.env`, (3) run `001_initial.sql` in SQL editor, (4) set Auth > "Confirm email" to OFF for beta, (5) add `SUPABASE_SERVICE_ROLE_KEY` to Vercel for the landing repo. |
| **OS-registered state** | iOS Keychain entries under app bundle ID (`NSFaceIDUsageDescription` permission grant; Keychain entries for `expo-secure-store` written via `LargeSecureStore` and biometric flag). Android Keystore equivalents. | `NSFaceIDUsageDescription` must be in `app.json` BEFORE first prompt, otherwise iOS silently fails. On app re-install, iOS may preserve Keychain (and thus an encrypted session body that is no longer decryptable if the app bundle is re-signed) — migration runner must tolerate a corrupt/unreadable session by falling through to login. |
| **Secrets / env vars** | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `bolusbrain-app/.env`. `SUPABASE_SERVICE_ROLE_KEY` in `bolusbrain-landing/.env` (NOT in the Expo app). Existing `EXPO_PUBLIC_NIGHTSCOUT_*` and `EXPO_PUBLIC_ANTHROPIC_API_KEY` unchanged. | Add new entries to each `.env`; update `.env.example` (if one exists) to document the keys without values. Never commit the real values. |
| **Build artifacts** | Expo `node_modules` will regenerate; no stale artifacts to clean. The one risk: adding native modules (`expo-secure-store`, `expo-local-authentication`) requires a **new EAS build** — the JS bundle alone will not pick up native code. | Flag in PLAN.md: after Phase 11 ships, Phase 9.5 (EAS/TestFlight) MUST rebuild. No native-module install can ship via OTA updates. |

**What's explicitly NOT found / required:** No Nightscout schema changes. No Anthropic API changes. No Task Scheduler / cron / background job registrations. No Docker images. No deployment webhooks that reference old names.

## Common Pitfalls

### Pitfall 1: `crypto.randomUUID is not a function` (the killer)
**What goes wrong:** The previous Supabase attempt (commit `c487925`, reverted in `23df7b5`) used `crypto.randomUUID()` to mint IDs client-side. Hermes (Expo SDK 54's JS engine) does not implement `crypto.randomUUID()`, only partial `crypto.getRandomValues()` when polyfilled. Runtime `TypeError`, app hangs silently in migration path.
**Why it happens:** `crypto.randomUUID()` is a browser/Node API. Hermes intentionally ships a minimal global scope. `@supabase/supabase-js` itself does not call `crypto.randomUUID()` in its main paths, but ancillary libraries (nanoid, some JWT helpers) have done so historically.
**How to avoid:**
- Let Postgres generate all primary keys (`id uuid default gen_random_uuid()`).
- For the rare case a client-generated ID is needed: `import 'react-native-get-random-values'` in `index.ts` as the FIRST statement, then `import { v4 as uuidv4 } from 'uuid'`.
- Grep the codebase for `crypto.randomUUID` before merging. Add a lint rule banning it if feasible.
**Warning signs:** Migration runner throws on first row; Jest tests pass (Node has `crypto.randomUUID`, Hermes doesn't); error only visible in the device log or Sentry.

### Pitfall 2: Session in the wrong storage
**What goes wrong:** Storing the Supabase session in plain AsyncStorage. The JWT access token + refresh token are unencrypted at rest. Stolen device backup = account takeover.
**Why it happens:** The 2 KB SecureStore limit pushes naive implementations to AsyncStorage.
**How to avoid:** `LargeSecureStore` adapter (code in §Pattern 1). Encryption key in SecureStore (iOS Keychain / Android Keystore), encrypted body in AsyncStorage.
**Warning signs:** Session tokens visible in `adb` backup on Android, or in iOS keychain inspector without biometric prompt.

### Pitfall 3: RLS enabled but no policy written
**What goes wrong:** After `alter table ... enable row level security;` with no accompanying `create policy`, the table becomes unreadable and unwritable by anon + authenticated users. App appears broken.
**Why it happens:** Developer enables RLS per security best practice, then writes policies in a separate migration that hasn't been applied.
**How to avoid:** Always commit the `ENABLE RLS` statement and its policies in the **same SQL file**. Add a smoke test: after schema creation, insert a row as the authenticated user and read it back.
**Warning signs:** `{ data: [] }` on a query you know has rows; no error message (RLS silently filters).

### Pitfall 4: Forgetting RLS entirely on a table
**What goes wrong:** Opposite problem — RLS is off by default for tables created via SQL (dashboard-created tables default ON since late 2024). Table is globally readable with just the anon key.
**How to avoid:** Every table in `public` schema must have an explicit `enable row level security;` line. A lint pass on the migration file (`grep -c 'enable row level security' 001_initial.sql` should equal the number of `create table public.` statements).
**Warning signs:** Supabase dashboard warns with a red "RLS disabled" badge on the Table Editor.

### Pitfall 5: `detectSessionInUrl: true` in RN
**What goes wrong:** Default is `true` for OAuth / magic-link URL parsing. In RN, there is no browser URL, so the client waits on `window.location` (doesn't exist) and logs confusing warnings.
**How to avoid:** Explicitly set `detectSessionInUrl: false` in the `auth` config of `createClient()`. Documented in Supabase's own Expo tutorial.
**Warning signs:** Warnings on app boot; session restore slightly delayed.

### Pitfall 6: Email confirmation ON without deep-link handling
**What goes wrong:** Supabase default on hosted projects is `Confirm email: ON`. After `signUp`, `session` is `null` until the user clicks a link in an email. In RN, that link opens a browser that has no way to tell the app "you're confirmed."
**How to avoid:** For beta, set `Confirm email: OFF` in Supabase Auth settings. `signUp` returns a session immediately, app works. Re-enable with deep-link handling post-beta.
**Alternative:** Confirm-email ON + user-re-types-password-to-sign-in. Works but adds friction beta testers won't tolerate.

### Pitfall 7: Rate-limit window off-by-one
**What goes wrong:** Counting requests with `WHERE requested_at > now() - interval '24 hours'` — at exactly request #11 on a 10-limit, the query still returns 10 because the 11th hasn't been inserted yet. User gets "free" requests on race conditions.
**How to avoid:** Insert the `ai_carb_requests` row BEFORE calling Anthropic, as a reservation. If Anthropic fails, the request still counts (protects you from retry storms). If a hard failure, user can retry tomorrow.
**Warning signs:** Users reporting 11th or 12th request succeeding when they expected to be blocked.

### Pitfall 8: Supabase built-in SMTP rate limit on password reset
**What goes wrong:** Supabase built-in SMTP has a low rate limit (recently reported as 2 messages per hour for the built-in provider — see Sources). A beta tester who fat-fingers their password twice in one hour and requests a reset may get no email.
**How to avoid:** For beta, accept this — 5–10 users rarely hit it in anger. Document the workaround: "If you don't receive a reset email within 5 minutes, text Liam." For public launch, set up custom SMTP (Resend, Postmark, SES).

### Pitfall 9: Native-module install requires a new build
**What goes wrong:** Adding `expo-secure-store` and `expo-local-authentication` are native modules. Expo OTA updates do NOT ship native code. Attempting to test via `expo start` on a development build without native modules installed results in "Native module not found" errors.
**How to avoid:** After `npx expo install expo-secure-store expo-local-authentication`, run a new EAS dev build. Flag this in PLAN.md under setup tasks.
**Warning signs:** `NativeModule: ExpoSecureStore is null` in the Metro console.

### Pitfall 10: iOS Face ID silent failure without Info.plist
**What goes wrong:** Calling `LocalAuthentication.authenticateAsync()` without `NSFaceIDUsageDescription` in `app.json` results in: on iOS 13+, a crash; pre-13, a silent `success: false`.
**How to avoid:** Set `ios.infoPlist.NSFaceIDUsageDescription` in `app.json` before first test. Verify in the generated `Info.plist` after `npx expo prebuild`.

### Pitfall 11: `supabase.auth.getSession()` on the server
**What goes wrong:** In the Next.js Route Handler, calling `getSession()` reads local storage (on the server, that's nothing). Always returns null, or worse — trusts unvalidated local state.
**How to avoid:** Use `supabase.auth.getUser(jwt)` on the server. This performs a network call to the Auth server and returns the authoritative user.

### Pitfall 12: Migration not idempotent
**What goes wrong:** Running migration twice creates duplicate rows. Liam retries after a network failure, ends up with two copies of every meal.
**How to avoid:** `UNIQUE (user_id, client_id)` on every migratable table + `upsert(..., { onConflict: 'user_id,client_id' })`. Where `client_id` = the original AsyncStorage-generated ID. Re-running migration = upsert = no-op for existing rows.
**Warning signs:** Second migration attempt reports "migrated N records" instead of "0 new records, N already present" — even no-op should report counts honestly.

## Code Examples

### Example 1: Entry file with polyfills at top
```typescript
// index.ts — FIRST lines of the app
import 'react-native-get-random-values';  // Polyfill FIRST, before anything that might use uuid or crypto
import 'react-native-url-polyfill/auto';  // Polyfill URL for Supabase SDK
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```
Source: https://github.com/LinusU/react-native-get-random-values + Supabase Expo tutorial.

### Example 2: Schema for all 9 tables (abridged; only meals + user_profiles shown, full SQL lives in `001_initial.sql`)

```sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  about_me_completed boolean not null default false,
  data_sharing_onboarding_completed boolean not null default false,
  equipment_onboarding_completed boolean not null default false,
  age_range text,
  gender text,
  t1d_duration text,
  hba1c_mmol_mol numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
create policy "user_profiles_own" on public.user_profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Auto-insert profile on signup
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Example 3: `meals` table (see §Pattern 4 above for full version)

### Example 4: `ai_carb_requests` (rate-limit counter table)
```sql
create table public.ai_carb_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  estimate_grams integer,
  created_at timestamptz not null default now()
);

alter table public.ai_carb_requests enable row level security;
create policy "ai_carb_own_select" on public.ai_carb_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "ai_carb_own_insert" on public.ai_carb_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- no UPDATE, no DELETE — append-only audit log
-- service_role bypasses RLS, so the landing page's insert from server works.

create index ai_carb_requests_user_time_idx
  on public.ai_carb_requests (user_id, requested_at desc);
```

### Example 5: Pre-migration refactor — consolidate direct AsyncStorage calls

**Before** (App.tsx lines 91-107 — direct AsyncStorage reads for onboarding gate):
```typescript
const dsCompleted = await AsyncStorage.getItem('data_sharing_onboarding_completed');
const amCompleted = await AsyncStorage.getItem('about_me_completed');
const equipRaw = await AsyncStorage.getItem('equipment_changelog');
```

**After** (add to `src/services/storage.ts`, call from App.tsx):
```typescript
// storage.ts — new helpers
export type OnboardingStatus = {
  dataSharing: boolean;
  aboutMe: boolean;
  equipment: boolean;
};

export async function loadOnboardingStatus(): Promise<OnboardingStatus> {
  try {
    const [ds, am, equip] = await Promise.all([
      AsyncStorage.getItem('data_sharing_onboarding_completed'),
      AsyncStorage.getItem('about_me_completed'),
      AsyncStorage.getItem('equipment_changelog'),
    ]);
    const equipArr = equip ? JSON.parse(equip) : [];
    return {
      dataSharing: ds === 'true',
      aboutMe: am === 'true',
      equipment: Array.isArray(equipArr) && equipArr.length > 0,
    };
  } catch {
    console.warn('[storage] loadOnboardingStatus: failed, returning all-incomplete');
    return { dataSharing: false, aboutMe: false, equipment: false };
  }
}
```
Same treatment for HomeScreen's hypo storage calls (lines 191, 198) — promote to `saveHypoTreatment(record)` in `storage.ts` (existing `loadHypoTreatments` already there).

**Why this matters:** Migration runner iterates `storage.ts` functions. If any write path bypasses `storage.ts`, migration misses it, and the gap is invisible until a beta tester's data doesn't match.

### Example 6: HelpScreen copy update (minimal)
```typescript
// src/screens/HelpScreen.tsx — 5 LOC change
// Add/modify the relevant section:
<Text style={styles.p}>
  When you use the AI carb estimation feature, your photo is sent to Anthropic's
  Claude API for analysis. Anthropic does not store your photo. You can turn off
  AI estimation at any time in Settings → Data & Research.
</Text>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-*` packages | `@supabase/ssr` (server) + direct `@supabase/supabase-js` (RN) | 2024 | Only affects Next.js Route Handlers. RN code uses supabase-js directly, no auth-helpers. |
| `persistSession` in AsyncStorage | `LargeSecureStore` (AES-wrap around AsyncStorage) | Supabase Expo tutorial canonicalised this pattern 2023+ | Session tokens now encrypted at rest; required for health app compliance posture |
| Manual `fetch` with JWT validation | `supabase.auth.getUser(jwt)` on server | 2023+ | Supabase docs now "strongly recommend against" local shared-secret verification |
| `crypto.randomUUID()` in RN | `gen_random_uuid()` server-side + `uuid` + `react-native-get-random-values` client-side | Always — never worked in Hermes | Mandatory to avoid the bug that killed the previous attempt |
| Postgres `uuid-ossp` extension `uuid_generate_v4()` | Built-in `gen_random_uuid()` (Postgres 13+) | Postgres 13 | Simpler; no extension needed; Supabase uses Postgres 15+ |

**Deprecated / outdated:**
- Any tutorial that uses `crypto.randomUUID()` in RN code without polyfill context — ignore.
- `@supabase/auth-helpers-nextjs` — superseded by `@supabase/ssr` for the landing page.
- Storing entire sessions directly in `expo-secure-store` — fails on iOS for larger sessions; use `LargeSecureStore`.

## Open Questions

1. **Does Liam want emails to come from `noreply@bolusbrain.app` (requires custom SMTP setup) or accept default Supabase-branded emails for beta?**
   - What we know: Default built-in SMTP is rate-limited and sends from a Supabase address. Custom SMTP requires DNS records for a custom domain.
   - What's unclear: Whether beta friction from Supabase-branded reset emails is acceptable.
   - Recommendation: Ship beta with default SMTP; document as a pre-public-launch TODO.

2. **Should `uuid` be pinned to `^11` (CJS-compatible) or `^13` (ESM-only)?**
   - What we know: `uuid@13` dropped CJS support; Jest's default module resolution may need extra config. `uuid@11` is still maintained.
   - What's unclear: Whether Jest-Expo presets handle ESM-only packages cleanly out of the box.
   - Recommendation: Pin `^11` for safety; revisit if dep tree later forces `^13`.

3. **When a user signs out, do we wipe local AsyncStorage?**
   - What we know: CONTEXT.md says AsyncStorage is kept indefinitely as canonical.
   - What's unclear: If a beta tester hands the phone to someone else and signs out, the next login might want a clean slate — or the same user logging back in wants their data.
   - Recommendation: Sign-out wipes Supabase session ONLY. AsyncStorage untouched. Document behaviour explicitly in the Settings screen. A future "Delete my account" button would handle the wipe case.

4. **What happens if `LargeSecureStore` fails to decrypt (key rotated, backup restore, etc.)?**
   - What we know: The adapter returns `null` — Supabase treats it as "no session" and puts the user at Login.
   - What's unclear: Whether this results in visible corruption that confuses the user.
   - Recommendation: AuthProvider catches and logs decrypt failures gracefully, shows Login screen. Add a test case.

5. **Retry strategy for partial migration failure.**
   - What we know: Migration is per-collection and reports which failed. Retry is manual via the same button.
   - What's unclear: Whether the button should retry only failed collections or re-upsert all (idempotent = safe to re-upsert all; slightly wasteful).
   - Recommendation: Retry all (idempotent upserts make it safe and simpler to reason about). Progress UI skips already-migrated collections based on `migrated_at` flag.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest `^29.7.0` + `jest-expo` `^54.0.17` (already installed) |
| Config file | `package.json` `"jest"` key; `testMatch` scoped to `<rootDir>/src/**/*.test.ts{,x}` |
| Quick run command | `npm test` (which is `jest --watchAll=false --passWithNoTests`) |
| Full suite command | `npm test` (same — no separate integration suite yet) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUPA-01 | `signIn` + `signUp` AuthContext returns error on invalid creds / session on success | unit (mocked `@supabase/supabase-js`) | `npx jest src/contexts/__tests__/AuthContext.test.tsx -x` | ❌ Wave 0 — new |
| SUPA-01 | `promptBiometric` returns true on success, false on cancel, false on no hardware | unit (mocked `expo-local-authentication`) | `npx jest src/hooks/__tests__/useBiometric.test.ts -x` | ❌ Wave 0 — new |
| SUPA-02 | RLS: user A cannot SELECT user B's meals | integration (against a local Supabase instance OR pgTAP) | manual for now; documented test plan | ❌ Wave 0 — deferred to manual Liam verification for beta |
| SUPA-04 | Rate limit returns 429 after 10 requests in 24h | integration on landing page — Jest + mock Supabase client | `npm test` (in `bolusbrain-landing`) | ❌ Wave 0 — new |
| SUPA-04 | Rate limit record inserted before Anthropic call | unit | same as above | ❌ Wave 0 — new |
| SUPA-05 | `ensureAIConsent` returns false when no row, true when current version present | unit | `npx jest src/services/__tests__/aiConsent.test.ts -x` | ❌ Wave 0 — new |
| SUPA-06 | Migration runner: idempotent — running twice yields same row count | unit (mock `supabase.from().upsert()`; assert payload + no duplicate calls) | `npx jest src/services/__tests__/migration.test.ts -x` | ❌ Wave 0 — new |
| SUPA-06 | Migration: partial failure reports failed collections without wiping AsyncStorage | unit | same as above | ❌ Wave 0 — new |
| SUPA-06 | Migration: correctly maps every AsyncStorage key to its Supabase table (regression guard) | unit (snapshot of call payloads) | same as above | ❌ Wave 0 — new |
| SUPA-07 | Data sharing helper filters users with `consented = false` | unit | `npx jest src/services/__tests__/dataSharing.test.ts -x` | ❌ Wave 0 — new |
| SUPA-08 | HelpScreen renders the Anthropic disclosure copy exactly | unit (snapshot or text assertion) | `npx jest src/screens/__tests__/HelpScreen.test.tsx -x` | ❌ Wave 0 — new |
| (Foundational) | `crypto.randomUUID` appears NOWHERE in `src/**` or `lib/**` | lint | `! grep -r 'crypto\.randomUUID' src/ lib/` | ❌ Wave 0 — add as npm script or CI check |

### Sampling Rate
- **Per task commit:** `npm test` — the whole suite is fast, no need to subset.
- **Per wave merge:** `npm test` + manual lint check for `crypto.randomUUID`.
- **Phase gate:** Full suite green + **Liam verifies on his device with real data** — this is the only acceptable SUPA-02 integration signal for a health app with irreplaceable user data. Liam's manual test must include: (a) fresh signup, (b) migrate button runs to completion with his real meal log, (c) post-migration AsyncStorage unchanged (open app offline, verify history still works), (d) sign out, sign back in with biometric, (e) intentionally exceed rate limit and verify 429.

### Wave 0 Gaps
- [ ] `src/contexts/__tests__/AuthContext.test.tsx` — covers SUPA-01 (auth state, sign in/up errors)
- [ ] `src/hooks/__tests__/useBiometric.test.ts` — covers SUPA-01 biometric paths
- [ ] `src/services/__tests__/migration.test.ts` — covers SUPA-06 (idempotency, partial failure, payload shape)
- [ ] `src/services/__tests__/aiConsent.test.ts` — covers SUPA-05
- [ ] `src/services/__tests__/dataSharing.test.ts` — covers SUPA-07
- [ ] `src/screens/__tests__/HelpScreen.test.tsx` — covers SUPA-08
- [ ] Landing page: `app/api/carb-estimate/__tests__/route.test.ts` — covers SUPA-04
- [ ] CI/lint guard script: `grep -r 'crypto\.randomUUID' src/ lib/ && exit 1 || exit 0` — fails build if the banned API appears
- [ ] Jest mock module: `__mocks__/@supabase/supabase-js.ts` — shared mock client for unit tests (or use `jest.mock()` inline per test)
- [ ] `__mocks__/expo-secure-store.ts` and `__mocks__/expo-local-authentication.ts` — needed because `jest-expo` preset does not auto-mock these

## Sources

### Primary (HIGH confidence)
- Supabase Expo/RN tutorial — https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native — `LargeSecureStore` pattern, `createClient` config, polyfill list
- Supabase RLS guide — https://supabase.com/docs/guides/database/postgres/row-level-security — ENABLE RLS syntax, per-verb policies, USING vs WITH CHECK
- Supabase Password auth — https://supabase.com/docs/guides/auth/passwords — signUp/signInWithPassword/resetPasswordForEmail signatures, confirmation flow
- Supabase Auth JWT — https://supabase.com/docs/guides/auth/jwts — claims structure (sub/role/exp/iss), JWKS endpoint, recommendation to use `getUser(jwt)` over local verification
- Supabase Sessions — https://supabase.com/docs/guides/auth/sessions — default access token expiry 1 hour, refresh tokens one-time-use, session removed on sign-out
- Supabase Auth startAutoRefresh — https://supabase.com/docs/reference/javascript/auth-startautorefresh — AppState pattern, exact code snippet
- Supabase managing user data — https://supabase.com/docs/guides/auth/managing-user-data — `handle_new_user` trigger, profile table pattern
- Supabase Rate Limits — https://supabase.com/docs/guides/auth/rate-limits — config variables (specific numbers not in docs; see Secondary below)
- Expo SecureStore — https://docs.expo.dev/versions/latest/sdk/securestore/ — full API, 2 KB iOS soft limit, `requireAuthentication` option
- Expo LocalAuthentication — https://docs.expo.dev/versions/latest/sdk/local-authentication/ — API, `NSFaceIDUsageDescription`, error codes, Android permissions

### Secondary (MEDIUM confidence)
- Supabase Rate Limits — default built-in SMTP reported as 2 messages/hour (per Medium/DEV articles citing Supabase changelog) — https://dev.to/devyoma/bypassing-supabases-email-rate-limits-in-user-registration-a-practical-guide-217o — verified against Supabase docs that confirm "low rate limits on built-in; custom SMTP required for production"
- Supabase JWT server-side verification pattern — https://github.com/orgs/supabase/discussions/13791 — community-verified `supabase.auth.getUser(jwt)` pattern
- Supabase Postgres-based rate limiting — https://supabase.com/docs/guides/functions/examples/rate-limiting — official example for sliding-window counter in Postgres
- Going into prod — https://supabase.com/docs/guides/platform/going-into-prod — recommends custom SMTP, default emails are development-tier

### Tertiary (LOW confidence — flagged for verification during implementation)
- Hermes `crypto.randomUUID()` behaviour — multiple community reports (Medium, Expo GitHub issues #22014, #24021) — consistent across sources but primary verification requires testing on a real Expo SDK 54 device before implementation
- `uuid@13` CJS removal — https://github.com/uuidjs/uuid — README implies breaking change; confirm Jest-Expo behavior before pinning

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library/version verified against npm registry 2026-04-16
- Architecture (client + RLS + JWT verification): HIGH — all three patterns sourced from Supabase's own docs
- Migration runner architecture: MEDIUM — no single canonical pattern; assembled from idempotency-upsert best practices + project-specific constraints (previous revert, indefinite AsyncStorage retention)
- Pitfalls: HIGH — each pitfall either in official docs or reproduced in public GitHub issues
- Rate-limit specifics (exact default email rate): MEDIUM — docs reference config variables without showing the default numbers; cross-referenced to community reports

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — Supabase SDK and Expo SDK 54 are both stable-to-slow-moving; re-verify versions if phase slips past this date)
