-- BolusBrain Phase 11: Initial Supabase Schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query
-- Creates 9 tables with RLS, policies, indexes, and triggers.

-- ============================================================
-- Shared trigger function: auto-update updated_at on row change
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. user_profiles
-- ============================================================

create table user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  age_range text,
  gender text,
  t1d_duration text,
  hba1c_mmol_mol numeric,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table user_profiles enable row level security;

create policy "user_profiles_select" on user_profiles
  for select using ((select auth.uid()) = user_id);
create policy "user_profiles_insert" on user_profiles
  for insert with check ((select auth.uid()) = user_id);
create policy "user_profiles_update" on user_profiles
  for update using ((select auth.uid()) = user_id);
create policy "user_profiles_delete" on user_profiles
  for delete using ((select auth.uid()) = user_id);

create index idx_user_profiles_user on user_profiles (user_id);

create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

-- ============================================================
-- 2. meals
-- ============================================================

create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null,
  photo_uri text,
  insulin_units numeric not null default 0,
  start_glucose numeric,
  carbs_estimated integer,
  logged_at timestamptz not null,
  session_id text,
  glucose_response jsonb,
  insulin_brand text,
  delivery_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

alter table meals enable row level security;

create policy "meals_select" on meals
  for select using ((select auth.uid()) = user_id);
create policy "meals_insert" on meals
  for insert with check ((select auth.uid()) = user_id);
create policy "meals_update" on meals
  for update using ((select auth.uid()) = user_id);
create policy "meals_delete" on meals
  for delete using ((select auth.uid()) = user_id);

create index idx_meals_user_logged on meals (user_id, logged_at desc);

create trigger trg_meals_updated_at
  before update on meals
  for each row execute function set_updated_at();

-- ============================================================
-- 3. insulin_doses
-- ============================================================

create table insulin_doses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  type text not null check (type in ('long-acting', 'correction', 'tablets')),
  units numeric not null,
  start_glucose numeric,
  logged_at timestamptz not null,
  basal_curve jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

alter table insulin_doses enable row level security;

create policy "insulin_doses_select" on insulin_doses
  for select using ((select auth.uid()) = user_id);
create policy "insulin_doses_insert" on insulin_doses
  for insert with check ((select auth.uid()) = user_id);
create policy "insulin_doses_update" on insulin_doses
  for update using ((select auth.uid()) = user_id);
create policy "insulin_doses_delete" on insulin_doses
  for delete using ((select auth.uid()) = user_id);

create index idx_insulin_doses_user_logged on insulin_doses (user_id, logged_at desc);

create trigger trg_insulin_doses_updated_at
  before update on insulin_doses
  for each row execute function set_updated_at();

-- ============================================================
-- 4. hypo_treatments
-- ============================================================

create table hypo_treatments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  logged_at timestamptz not null,
  glucose_at_event numeric not null,
  treatment_type text not null,
  brand text,
  amount_value numeric,
  amount_unit text,
  notes text,
  insulin_brand text,
  glucose_readings_after jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

alter table hypo_treatments enable row level security;

create policy "hypo_treatments_select" on hypo_treatments
  for select using ((select auth.uid()) = user_id);
create policy "hypo_treatments_insert" on hypo_treatments
  for insert with check ((select auth.uid()) = user_id);
create policy "hypo_treatments_update" on hypo_treatments
  for update using ((select auth.uid()) = user_id);
create policy "hypo_treatments_delete" on hypo_treatments
  for delete using ((select auth.uid()) = user_id);

create index idx_hypo_treatments_user_logged on hypo_treatments (user_id, logged_at desc);

create trigger trg_hypo_treatments_updated_at
  before update on hypo_treatments
  for each row execute function set_updated_at();

-- ============================================================
-- 5. equipment_changelog
-- ============================================================

create table equipment_changelog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  field text not null,
  value text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  reason_for_change text,
  previous_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

alter table equipment_changelog enable row level security;

create policy "equipment_changelog_select" on equipment_changelog
  for select using ((select auth.uid()) = user_id);
create policy "equipment_changelog_insert" on equipment_changelog
  for insert with check ((select auth.uid()) = user_id);
create policy "equipment_changelog_update" on equipment_changelog
  for update using ((select auth.uid()) = user_id);
create policy "equipment_changelog_delete" on equipment_changelog
  for delete using ((select auth.uid()) = user_id);

create index idx_equipment_changelog_user_started on equipment_changelog (user_id, started_at desc);

create trigger trg_equipment_changelog_updated_at
  before update on equipment_changelog
  for each row execute function set_updated_at();

-- ============================================================
-- 6. data_consent_records
-- ============================================================

create table data_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consented boolean not null default false,
  consented_at timestamptz,
  version text not null default '1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, version)
);

alter table data_consent_records enable row level security;

create policy "data_consent_records_select" on data_consent_records
  for select using ((select auth.uid()) = user_id);
create policy "data_consent_records_insert" on data_consent_records
  for insert with check ((select auth.uid()) = user_id);
create policy "data_consent_records_update" on data_consent_records
  for update using ((select auth.uid()) = user_id);
create policy "data_consent_records_delete" on data_consent_records
  for delete using ((select auth.uid()) = user_id);

create index idx_data_consent_records_user on data_consent_records (user_id);

create trigger trg_data_consent_records_updated_at
  before update on data_consent_records
  for each row execute function set_updated_at();

-- ============================================================
-- 7. ai_consent_records
-- ============================================================

create table ai_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null default '1.0',
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, version)
);

alter table ai_consent_records enable row level security;

create policy "ai_consent_records_select" on ai_consent_records
  for select using ((select auth.uid()) = user_id);
create policy "ai_consent_records_insert" on ai_consent_records
  for insert with check ((select auth.uid()) = user_id);
create policy "ai_consent_records_update" on ai_consent_records
  for update using ((select auth.uid()) = user_id);
create policy "ai_consent_records_delete" on ai_consent_records
  for delete using ((select auth.uid()) = user_id);

create index idx_ai_consent_records_user on ai_consent_records (user_id);

create trigger trg_ai_consent_records_updated_at
  before update on ai_consent_records
  for each row execute function set_updated_at();

-- ============================================================
-- 8. daily_tir
-- ============================================================

create table daily_tir (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  date date not null,
  readings_count integer not null,
  in_range_count integer not null,
  tir_percentage numeric not null,
  below_range_pct numeric not null,
  above_range_pct numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

alter table daily_tir enable row level security;

create policy "daily_tir_select" on daily_tir
  for select using ((select auth.uid()) = user_id);
create policy "daily_tir_insert" on daily_tir
  for insert with check ((select auth.uid()) = user_id);
create policy "daily_tir_update" on daily_tir
  for update using ((select auth.uid()) = user_id);
create policy "daily_tir_delete" on daily_tir
  for delete using ((select auth.uid()) = user_id);

create index idx_daily_tir_user_date on daily_tir (user_id, date desc);

create trigger trg_daily_tir_updated_at
  before update on daily_tir
  for each row execute function set_updated_at();

-- ============================================================
-- 9. ai_carb_requests
-- ============================================================

create table ai_carb_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  estimate_returned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_carb_requests enable row level security;

create policy "ai_carb_requests_select" on ai_carb_requests
  for select using ((select auth.uid()) = user_id);
create policy "ai_carb_requests_insert" on ai_carb_requests
  for insert with check ((select auth.uid()) = user_id);
create policy "ai_carb_requests_update" on ai_carb_requests
  for update using ((select auth.uid()) = user_id);
create policy "ai_carb_requests_delete" on ai_carb_requests
  for delete using ((select auth.uid()) = user_id);

create index idx_ai_carb_requests_user_requested on ai_carb_requests (user_id, requested_at desc);

create trigger trg_ai_carb_requests_updated_at
  before update on ai_carb_requests
  for each row execute function set_updated_at();

-- ============================================================
-- Verification: count of tables with RLS enabled should be 9
-- SELECT count(*) FROM pg_tables t JOIN pg_class c ON t.tablename = c.relname WHERE t.schemaname = 'public' AND c.relrowsecurity = true;
-- ============================================================
