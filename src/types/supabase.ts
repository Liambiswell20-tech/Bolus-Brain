/**
 * TypeScript row types matching the 9 Supabase tables defined in
 * supabase/migrations/001_initial.sql.
 *
 * These types represent the shape of data as returned by Supabase queries.
 * All timestamps are ISO strings. All UUIDs are strings.
 */

export interface MealRow {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  photo_uri: string | null;
  insulin_units: number;
  start_glucose: number | null;
  carbs_estimated: number | null;
  logged_at: string;
  session_id: string | null;
  glucose_response: Record<string, unknown> | null;
  insulin_brand: string | null;
  delivery_method: string | null;
  // V2 session grouping fields
  classification_bucket: string | null;
  classification_method: string | null;
  classification_matched_keyword: string | null;
  classification_keywords_version: string | null;
  digestion_window_minutes: number | null;
  matching_key: string | null;
  matching_key_version: number | null;
  overlap_detected_at_log: string[] | null;
  classification_snapshot: string | null;
  return_to_baseline_minutes: number | null;
  ended_elevated: boolean | null;
  ended_low: boolean | null;
  cgm_coverage_percent: number | null;
  created_at: string;
  updated_at: string;
}

export interface InsulinDoseRow {
  id: string;
  user_id: string;
  client_id: string;
  type: 'long-acting' | 'correction' | 'tablets';
  units: number;
  start_glucose: number | null;
  logged_at: string;
  basal_curve: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface HypoTreatmentRow {
  id: string;
  user_id: string;
  client_id: string;
  logged_at: string;
  glucose_at_event: number;
  treatment_type: string;
  brand: string | null;
  amount_value: number | null;
  amount_unit: string | null;
  notes: string | null;
  insulin_brand: string | null;
  glucose_readings_after: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentChangelogRow {
  id: string;
  user_id: string;
  client_id: string;
  field: string;
  value: string;
  started_at: string;
  ended_at: string | null;
  reason_for_change: string | null;
  previous_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataConsentRow {
  id: string;
  user_id: string;
  consented: boolean;
  consented_at: string | null;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface AiConsentRow {
  id: string;
  user_id: string;
  version: string;
  accepted_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyTirRow {
  id: string;
  user_id: string;
  client_id: string;
  date: string;
  readings_count: number;
  in_range_count: number;
  tir_percentage: number;
  below_range_pct: number;
  above_range_pct: number;
  created_at: string;
  updated_at: string;
}

export interface AiCarbRequestRow {
  id: string;
  user_id: string;
  requested_at: string;
  estimate_returned: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  age_range: string | null;
  gender: string | null;
  t1d_duration: string | null;
  hba1c_mmol_mol: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Session Grouping V2 tables ---

export interface SessionEventLogRow {
  id: string;
  user_id: string;
  session_id: string;
  event_type: string;
  triggered_by_meal_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  classification_keywords_version: string | null;
  triggered_at: string;
  created_at: string;
}

export interface SessionCorrectionRow {
  id: string;
  user_id: string;
  session_id: string;
  insulin_log_id: string;
  units: number;
  logged_at: string;
  created_at: string;
}

export interface SessionContextEventRow {
  id: string;
  user_id: string;
  session_id: string;
  event_type: string;
  description: string;
  logged_at: string;
  created_at: string;
}

export interface SessionHypoAnnotationRow {
  id: string;
  user_id: string;
  session_id: string;
  hypo_treatment_id: string;
  glucose_at_event: number;
  logged_at: string;
  created_at: string;
}
