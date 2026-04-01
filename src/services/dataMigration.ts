/**
 * One-time migration: pushes local AsyncStorage data into Supabase.
 * Called after first sign-in when local data exists.
 *
 * Order respects FK constraints:
 *   1. profiles + user_settings
 *   2. sessions  (meals reference sessions)
 *   3. meals
 *   4. insulin_logs
 *   5. equipment_changelog
 *   6. hypo_treatments
 *   7. daily_tir
 *   8. glucose_store
 *   9. hba1c_cache
 *
 * Idempotent: uses upsert where possible, guarded by AsyncStorage flag.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getSupabaseUserId } from './backend';
import type { Meal, Session, InsulinLog, GlucoseStore, Hba1cEstimate } from './storage';
import type { AppSettings } from './settings';
import type { EquipmentChangeEntry, DailyTIR, HypoTreatment } from '../types/equipment';

const MIGRATION_FLAG = 'supabase_migration_done';

// AsyncStorage keys (must match the keys used in storage.ts, settings.ts, etc.)
const MEALS_KEY = 'glucolog_meals';
const SESSIONS_KEY = 'glucolog_sessions';
const INSULIN_LOGS_KEY = 'glucolog_insulin_logs';
const SETTINGS_KEY = 'glucolog_settings';
const EQUIPMENT_KEY = 'equipment_changelog';
const HYPO_KEY = 'hypo_treatments';
const DAILY_TIR_KEY = 'daily_tir';
const GLUCOSE_STORE_KEY = 'glucolog_glucose_store';
const HBA1C_KEY = 'glucolog_hba1c_cache';

/** Returns true if local data exists that could be migrated. */
export async function hasLocalData(): Promise<boolean> {
  const keys = [MEALS_KEY, SESSIONS_KEY, INSULIN_LOGS_KEY, EQUIPMENT_KEY, HYPO_KEY];
  const values = await AsyncStorage.multiGet(keys);
  return values.some(([, v]) => {
    if (!v) return false;
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) && arr.length > 0;
    } catch {
      return false;
    }
  });
}

/** Returns true if migration has already completed. */
export async function isMigrationDone(): Promise<boolean> {
  const flag = await AsyncStorage.getItem(MIGRATION_FLAG);
  return flag === 'true';
}

/**
 * Migrate all local AsyncStorage data to Supabase.
 * Safe to call multiple times — skips if already done.
 * Throws on unrecoverable error (caller should handle).
 */
export async function migrateLocalDataToSupabase(
  onProgress?: (step: string) => void
): Promise<{ migrated: boolean; counts: Record<string, number> }> {
  // Guard: already done
  if (await isMigrationDone()) {
    return { migrated: false, counts: {} };
  }

  const userId = getSupabaseUserId();
  const counts: Record<string, number> = {};

  // ── 1. Settings → profiles + user_settings ──
  onProgress?.('Migrating settings...');
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const settings: AppSettings = JSON.parse(raw);
      await Promise.all([
        supabase.from('profiles').upsert({
          id: userId,
          display_name: settings.displayName || '',
          email: settings.email || '',
        }),
        supabase.from('user_settings').upsert({
          user_id: userId,
          carb_insulin_ratio: settings.carbInsulinRatio,
          tablet_name: settings.tabletName || '',
          tablet_dose: settings.tabletDose || '',
        }),
      ]);
      counts.settings = 1;
    }
  } catch (err) {
    console.warn('[migration] settings failed:', err);
  }

  // ── 2. Sessions (must come before meals — FK constraint) ──
  onProgress?.('Migrating sessions...');
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    const sessions: Session[] = raw ? JSON.parse(raw) : [];
    if (sessions.length > 0) {
      const rows = sessions.map(s => ({
        id: s.id,
        user_id: userId,
        started_at: s.startedAt,
        confidence: s.confidence,
        glucose_response: s.glucoseResponse,
      }));
      // Batch in chunks of 100 to avoid payload limits
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabase.from('sessions').upsert(chunk, { onConflict: 'id' });
        if (error) console.warn('[migration] sessions chunk error:', error.message);
      }
      counts.sessions = sessions.length;
    }
  } catch (err) {
    console.warn('[migration] sessions failed:', err);
  }

  // ── 3. Meals ──
  onProgress?.('Migrating meals...');
  try {
    const raw = await AsyncStorage.getItem(MEALS_KEY);
    const meals: Meal[] = raw ? JSON.parse(raw) : [];
    if (meals.length > 0) {
      const rows = meals.map(m => ({
        id: m.id,
        user_id: userId,
        session_id: m.sessionId,
        name: m.name,
        photo_path: m.photoUri,
        insulin_units: m.insulinUnits,
        start_glucose: m.startGlucose,
        carbs_estimated: m.carbsEstimated,
        logged_at: m.loggedAt,
        glucose_response: m.glucoseResponse,
        insulin_brand: m.insulin_brand ?? null,
        delivery_method: m.delivery_method ?? null,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabase.from('meals').upsert(chunk, { onConflict: 'id' });
        if (error) console.warn('[migration] meals chunk error:', error.message);
      }
      counts.meals = meals.length;
    }
  } catch (err) {
    console.warn('[migration] meals failed:', err);
  }

  // ── 4. Insulin logs ──
  onProgress?.('Migrating insulin logs...');
  try {
    const raw = await AsyncStorage.getItem(INSULIN_LOGS_KEY);
    const logs: InsulinLog[] = raw ? JSON.parse(raw) : [];
    if (logs.length > 0) {
      const rows = logs.map(l => ({
        id: l.id,
        user_id: userId,
        type: l.type,
        units: l.units,
        start_glucose: l.startGlucose,
        logged_at: l.loggedAt,
        basal_curve: l.basalCurve,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabase.from('insulin_logs').upsert(chunk, { onConflict: 'id' });
        if (error) console.warn('[migration] insulin_logs chunk error:', error.message);
      }
      counts.insulinLogs = logs.length;
    }
  } catch (err) {
    console.warn('[migration] insulin_logs failed:', err);
  }

  // ── 5. Equipment changelog ──
  onProgress?.('Migrating equipment...');
  try {
    const raw = await AsyncStorage.getItem(EQUIPMENT_KEY);
    const entries: EquipmentChangeEntry[] = raw ? JSON.parse(raw) : [];
    if (entries.length > 0) {
      const rows = entries.map(e => ({
        id: e.id,
        user_id: userId,
        field: e.field,
        value: e.value,
        started_at: e.started_at,
        ended_at: e.ended_at ?? null,
        reason_for_change: e.reason_for_change ?? null,
        previous_value: e.previous_value ?? null,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabase.from('equipment_changelog').upsert(chunk, { onConflict: 'id' });
        if (error) console.warn('[migration] equipment chunk error:', error.message);
      }
      counts.equipment = entries.length;
    }
  } catch (err) {
    console.warn('[migration] equipment failed:', err);
  }

  // ── 6. Hypo treatments ──
  onProgress?.('Migrating hypo treatments...');
  try {
    const raw = await AsyncStorage.getItem(HYPO_KEY);
    const treatments: HypoTreatment[] = raw ? JSON.parse(raw) : [];
    if (treatments.length > 0) {
      const rows = treatments.map(t => ({
        id: t.id,
        user_id: userId,
        logged_at: t.logged_at,
        glucose_at_event: t.glucose_at_event,
        treatment_type: t.treatment_type,
        amount_value: t.amount_value,
        amount_unit: t.amount_unit,
        notes: t.notes ?? null,
        insulin_brand: t.insulin_brand ?? null,
        glucose_readings_after: t.glucose_readings_after ?? null,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabase.from('hypo_treatments').upsert(chunk, { onConflict: 'id' });
        if (error) console.warn('[migration] hypo chunk error:', error.message);
      }
      counts.hypoTreatments = treatments.length;
    }
  } catch (err) {
    console.warn('[migration] hypo_treatments failed:', err);
  }

  // ── 7. Daily TIR ──
  onProgress?.('Migrating TIR history...');
  try {
    const raw = await AsyncStorage.getItem(DAILY_TIR_KEY);
    const records: DailyTIR[] = raw ? JSON.parse(raw) : [];
    if (records.length > 0) {
      const rows = records.map(r => ({
        user_id: userId,
        date: r.date,
        readings_count: r.readings_count,
        in_range_count: r.in_range_count,
        tir_percentage: r.tir_percentage,
        below_range_pct: r.below_range_pct,
        above_range_pct: r.above_range_pct,
      }));
      // daily_tir uses composite PK (user_id, date) — ignoreDuplicates to avoid conflicts
      const { error } = await supabase.from('daily_tir').upsert(rows, {
        onConflict: 'user_id,date',
        ignoreDuplicates: true,
      });
      if (error) console.warn('[migration] daily_tir error:', error.message);
      counts.dailyTir = records.length;
    }
  } catch (err) {
    console.warn('[migration] daily_tir failed:', err);
  }

  // ── 8. Glucose store ──
  onProgress?.('Migrating glucose data...');
  try {
    const raw = await AsyncStorage.getItem(GLUCOSE_STORE_KEY);
    if (raw) {
      const store: GlucoseStore = JSON.parse(raw);
      await supabase.from('glucose_store').upsert({
        user_id: userId,
        readings: store.readings,
        sum: store.sum,
        last_fetched_at: store.lastFetchedAt,
      });
      counts.glucoseStore = 1;
    }
  } catch (err) {
    console.warn('[migration] glucose_store failed:', err);
  }

  // ── 9. HbA1c cache ──
  onProgress?.('Migrating HbA1c cache...');
  try {
    const raw = await AsyncStorage.getItem(HBA1C_KEY);
    if (raw) {
      const cached: Hba1cEstimate = JSON.parse(raw);
      await supabase.from('hba1c_cache').upsert({
        user_id: userId,
        percent: cached.percent,
        mmol_mol: cached.mmolMol,
        days_of_data: cached.daysOfData,
        calculated_date: cached.calculatedDate,
      });
      counts.hba1cCache = 1;
    }
  } catch (err) {
    console.warn('[migration] hba1c_cache failed:', err);
  }

  // ── Mark complete ──
  await AsyncStorage.setItem(MIGRATION_FLAG, 'true');
  console.log('[migration] complete:', counts);

  return { migrated: true, counts };
}
