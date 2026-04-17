-- BolusBrain Phase A: Session Grouping V2 Schema Additions
-- Additive only — no breaking changes, no data mutations.
-- Run AFTER 001_initial.sql has been applied.

-- ============================================================
-- 1. New columns on meals table
-- ============================================================

alter table meals
  add column if not exists classification_bucket text,
  add column if not exists classification_method text,
  add column if not exists classification_matched_keyword text,
  add column if not exists classification_keywords_version text,
  add column if not exists digestion_window_minutes integer,
  add column if not exists matching_key text,
  add column if not exists matching_key_version integer,
  add column if not exists overlap_detected_at_log jsonb,
  add column if not exists classification_snapshot text,
  add column if not exists return_to_baseline_minutes integer,
  add column if not exists ended_elevated boolean,
  add column if not exists ended_low boolean,
  add column if not exists cgm_coverage_percent numeric;

-- Index for "you've eaten this before" pattern lookups
create index if not exists idx_meals_matching_key
  on meals (user_id, matching_key)
  where matching_key is not null;

-- ============================================================
-- 2. session_event_log — append-only audit trail
-- ============================================================

create table if not exists session_event_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  event_type text not null,
  triggered_by_meal_id text,
  before_state jsonb,
  after_state jsonb,
  classification_keywords_version text,
  triggered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table session_event_log enable row level security;

create policy "session_event_log_select" on session_event_log
  for select using ((select auth.uid()) = user_id);
create policy "session_event_log_insert" on session_event_log
  for insert with check ((select auth.uid()) = user_id);

-- No update/delete policies — append-only by design

create index if not exists idx_session_event_log_session
  on session_event_log (session_id, triggered_at);
create index if not exists idx_session_event_log_meal
  on session_event_log (triggered_by_meal_id)
  where triggered_by_meal_id is not null;

-- ============================================================
-- 3. session_corrections — correction doses linked to sessions
-- ============================================================

create table if not exists session_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  insulin_log_id text not null,
  units numeric not null,
  logged_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table session_corrections enable row level security;

create policy "session_corrections_select" on session_corrections
  for select using ((select auth.uid()) = user_id);
create policy "session_corrections_insert" on session_corrections
  for insert with check ((select auth.uid()) = user_id);
create policy "session_corrections_update" on session_corrections
  for update using ((select auth.uid()) = user_id);
create policy "session_corrections_delete" on session_corrections
  for delete using ((select auth.uid()) = user_id);

create index if not exists idx_session_corrections_session
  on session_corrections (session_id);

-- ============================================================
-- 4. session_context_events — metadata annotations on sessions
-- ============================================================

create table if not exists session_context_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  event_type text not null,
  description text not null default '',
  logged_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table session_context_events enable row level security;

create policy "session_context_events_select" on session_context_events
  for select using ((select auth.uid()) = user_id);
create policy "session_context_events_insert" on session_context_events
  for insert with check ((select auth.uid()) = user_id);
create policy "session_context_events_update" on session_context_events
  for update using ((select auth.uid()) = user_id);
create policy "session_context_events_delete" on session_context_events
  for delete using ((select auth.uid()) = user_id);

create index if not exists idx_session_context_events_session
  on session_context_events (session_id);

-- ============================================================
-- 5. session_hypo_annotations — hypo events linked to sessions
-- ============================================================

create table if not exists session_hypo_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  hypo_treatment_id text not null,
  glucose_at_event numeric not null,
  logged_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table session_hypo_annotations enable row level security;

create policy "session_hypo_annotations_select" on session_hypo_annotations
  for select using ((select auth.uid()) = user_id);
create policy "session_hypo_annotations_insert" on session_hypo_annotations
  for insert with check ((select auth.uid()) = user_id);
create policy "session_hypo_annotations_update" on session_hypo_annotations
  for update using ((select auth.uid()) = user_id);
create policy "session_hypo_annotations_delete" on session_hypo_annotations
  for delete using ((select auth.uid()) = user_id);

create index if not exists idx_session_hypo_annotations_session
  on session_hypo_annotations (session_id);

-- ============================================================
-- Verification: new tables count should be 4
-- SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('session_event_log', 'session_corrections', 'session_context_events', 'session_hypo_annotations');
-- ============================================================
