-- ============================================================
-- BolusBrain Supabase Schema
-- Mirrors all 11 AsyncStorage keys + new insulin metadata fields
-- Run this in Supabase SQL Editor after project creation
-- ============================================================

-- 0. Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  email         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- ============================================================
-- 2. USER_SETTINGS (mirrors glucolog_settings)
-- ============================================================
create table user_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  carb_insulin_ratio  real,
  tablet_name         text not null default '',
  tablet_dose         text not null default '',
  updated_at          timestamptz not null default now()
);

alter table user_settings enable row level security;
create policy "Users can read own settings"
  on user_settings for select using (auth.uid() = user_id);
create policy "Users can upsert own settings"
  on user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on user_settings for update using (auth.uid() = user_id);

-- ============================================================
-- 3. SESSIONS (mirrors glucolog_sessions)
-- ============================================================
create table sessions (
  id                  text primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  started_at          timestamptz not null,
  confidence          text not null check (confidence in ('high', 'medium', 'low')),
  glucose_response    jsonb,
  created_at          timestamptz not null default now()
);

alter table sessions enable row level security;
create policy "Users can read own sessions"
  on sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions"
  on sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions"
  on sessions for update using (auth.uid() = user_id);
create policy "Users can delete own sessions"
  on sessions for delete using (auth.uid() = user_id);

create index idx_sessions_user_started on sessions (user_id, started_at desc);

-- ============================================================
-- 4. MEALS (mirrors glucolog_meals)
-- ============================================================
create table meals (
  id                  text primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  session_id          text references sessions(id) on delete set null,
  name                text not null,
  photo_path          text,
  insulin_units       real not null default 0,
  start_glucose       real,
  carbs_estimated     real,
  logged_at           timestamptz not null,
  glucose_response    jsonb,
  insulin_brand       text,
  delivery_method     text,
  created_at          timestamptz not null default now()
);

alter table meals enable row level security;
create policy "Users can read own meals"
  on meals for select using (auth.uid() = user_id);
create policy "Users can insert own meals"
  on meals for insert with check (auth.uid() = user_id);
create policy "Users can update own meals"
  on meals for update using (auth.uid() = user_id);
create policy "Users can delete own meals"
  on meals for delete using (auth.uid() = user_id);

create index idx_meals_user_logged on meals (user_id, logged_at desc);
create index idx_meals_session on meals (session_id);

-- ============================================================
-- 5. INSULIN_LOGS (mirrors glucolog_insulin_logs)
-- ============================================================
create table insulin_logs (
  id                  text primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  type                text not null check (type in ('long-acting', 'correction', 'tablets')),
  units               real not null,
  start_glucose       real,
  logged_at           timestamptz not null,
  basal_curve         jsonb,
  created_at          timestamptz not null default now()
);

alter table insulin_logs enable row level security;
create policy "Users can read own insulin logs"
  on insulin_logs for select using (auth.uid() = user_id);
create policy "Users can insert own insulin logs"
  on insulin_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own insulin logs"
  on insulin_logs for update using (auth.uid() = user_id);
create policy "Users can delete own insulin logs"
  on insulin_logs for delete using (auth.uid() = user_id);

create index idx_insulin_logs_user_logged on insulin_logs (user_id, logged_at desc);

-- ============================================================
-- 6. EQUIPMENT_CHANGELOG (mirrors equipment_changelog)
-- ============================================================
create table equipment_changelog (
  id                  text primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  field               text not null check (field in (
                        'rapid_insulin_brand', 'long_acting_insulin_brand',
                        'delivery_method', 'cgm_device', 'pen_needle_brand'
                      )),
  value               text not null,
  started_at          timestamptz not null,
  ended_at            timestamptz,
  reason_for_change   text,
  previous_value      text
);

alter table equipment_changelog enable row level security;
create policy "Users can read own equipment"
  on equipment_changelog for select using (auth.uid() = user_id);
create policy "Users can insert own equipment"
  on equipment_changelog for insert with check (auth.uid() = user_id);
create policy "Users can update own equipment"
  on equipment_changelog for update using (auth.uid() = user_id);

create index idx_equipment_user_field on equipment_changelog (user_id, field);

-- ============================================================
-- 7. HYPO_TREATMENTS (mirrors hypo_treatments)
-- ============================================================
create table hypo_treatments (
  id                      text primary key,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  logged_at               timestamptz not null,
  glucose_at_event        real not null,
  treatment_type          text not null,
  amount_value            real not null,
  amount_unit             text not null check (amount_unit in ('tablets', 'ml', 'g', 'food')),
  notes                   text,
  insulin_brand           text,
  glucose_readings_after  jsonb,
  created_at              timestamptz not null default now()
);

alter table hypo_treatments enable row level security;
create policy "Users can read own hypo treatments"
  on hypo_treatments for select using (auth.uid() = user_id);
create policy "Users can insert own hypo treatments"
  on hypo_treatments for insert with check (auth.uid() = user_id);
create policy "Users can update own hypo treatments"
  on hypo_treatments for update using (auth.uid() = user_id);
create policy "Users can delete own hypo treatments"
  on hypo_treatments for delete using (auth.uid() = user_id);

create index idx_hypo_user_logged on hypo_treatments (user_id, logged_at desc);

-- ============================================================
-- 8. DAILY_TIR (mirrors daily_tir)
-- ============================================================
create table daily_tir (
  user_id             uuid not null references auth.users(id) on delete cascade,
  date                date not null,
  readings_count      int not null,
  in_range_count      int not null,
  tir_percentage      int not null,
  below_range_pct     int not null,
  above_range_pct     int not null,
  primary key (user_id, date)
);

alter table daily_tir enable row level security;
create policy "Users can read own TIR"
  on daily_tir for select using (auth.uid() = user_id);
create policy "Users can insert own TIR"
  on daily_tir for insert with check (auth.uid() = user_id);

create index idx_tir_user_date on daily_tir (user_id, date desc);

-- ============================================================
-- 9. GLUCOSE_STORE (mirrors glucolog_glucose_store)
-- ============================================================
create table glucose_store (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  readings            jsonb not null default '[]',
  sum                 real not null default 0,
  last_fetched_at     bigint not null default 0
);

alter table glucose_store enable row level security;
create policy "Users can read own glucose store"
  on glucose_store for select using (auth.uid() = user_id);
create policy "Users can upsert own glucose store"
  on glucose_store for insert with check (auth.uid() = user_id);
create policy "Users can update own glucose store"
  on glucose_store for update using (auth.uid() = user_id);

-- ============================================================
-- 10. HBA1C_CACHE (mirrors glucolog_hba1c_cache)
-- ============================================================
create table hba1c_cache (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  percent             real not null,
  mmol_mol            int not null,
  days_of_data        int not null,
  calculated_date     date not null
);

alter table hba1c_cache enable row level security;
create policy "Users can read own HbA1c"
  on hba1c_cache for select using (auth.uid() = user_id);
create policy "Users can upsert own HbA1c"
  on hba1c_cache for insert with check (auth.uid() = user_id);
create policy "Users can update own HbA1c"
  on hba1c_cache for update using (auth.uid() = user_id);

-- ============================================================
-- 11. INSULIN_TYPES (shared reference table)
-- ============================================================
create table insulin_types (
  id                  uuid primary key default gen_random_uuid(),
  brand_name          text not null,
  generic_name        text not null,
  manufacturer        text not null,
  category            text not null check (category in ('rapid', 'short', 'intermediate', 'long', 'ultra-long', 'mixed')),
  onset_minutes       int,
  peak_hours          real,
  duration_hours      real,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table insulin_types enable row level security;
create policy "Authenticated users can read insulin types"
  on insulin_types for select using (auth.role() = 'authenticated');

insert into insulin_types (brand_name, generic_name, manufacturer, category, onset_minutes, peak_hours, duration_hours) values
  ('NovoRapid',     'Insulin aspart',       'Novo Nordisk',   'rapid',        10, 1.5, 4),
  ('Humalog',       'Insulin lispro',       'Eli Lilly',      'rapid',        10, 1.5, 4),
  ('Apidra',        'Insulin glulisine',    'Sanofi',         'rapid',        10, 1.5, 4),
  ('Fiasp',         'Faster insulin aspart','Novo Nordisk',   'rapid',         5, 1.0, 4),
  ('Lyumjev',       'Faster insulin lispro','Eli Lilly',      'rapid',         5, 1.0, 4),
  ('Lantus',        'Insulin glargine',     'Sanofi',         'long',         60, null, 24),
  ('Levemir',       'Insulin detemir',      'Novo Nordisk',   'long',         60, null, 20),
  ('Tresiba',       'Insulin degludec',     'Novo Nordisk',   'ultra-long',   60, null, 42),
  ('Toujeo',        'Insulin glargine U300','Sanofi',         'long',         60, null, 36),
  ('Humulin I',     'Isophane insulin',     'Eli Lilly',      'intermediate', 60, 6.0, 16),
  ('Insulatard',    'Isophane insulin',     'Novo Nordisk',   'intermediate', 60, 6.0, 16);

-- ============================================================
-- 12. STORAGE BUCKET for meal photos
-- Run in Supabase dashboard or via API:
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false);
--
-- create policy "Users can upload own photos"
--   on storage.objects for insert with check (
--     bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]
--   );
-- create policy "Users can read own photos"
--   on storage.objects for select using (
--     bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]
--   );
-- Photo path convention: {user_id}/{meal_id}.jpg
