/**
 * Supabase implementations of all data operations.
 * Mirrors the public API of storage.ts, settings.ts, equipmentProfile.ts, and timeInRange.ts.
 * Each function is called only when isSupabaseActive() === true.
 */
import { supabase } from './supabase';
import { getSupabaseUserId } from './backend';
import { fetchGlucoseRange, CurvePoint } from './nightscout';
import type { HypoTreatment, EquipmentChangeEntry, DailyTIR } from '../types/equipment';
import type {
  Meal, Session, SessionWithMeals, SessionConfidence,
  GlucoseResponse, InsulinLog, InsulinLogType, BasalCurve,
  GlucoseStore, GlucosePoint, Hba1cEstimate,
} from './storage';
import type { AppSettings } from './settings';

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ── helpers ──────────────────────────────────────────────

function computeConfidence(mealCount: number): SessionConfidence {
  if (mealCount === 1) return 'high';
  if (mealCount === 2) return 'medium';
  return 'low';
}

function buildGlucoseResponse(fromMs: number, readings: CurvePoint[], nowMs: number): GlucoseResponse {
  const startGlucose = readings[0].mmol;
  const peak = readings.reduce((best, r) => (r.mmol > best.mmol ? r : best), readings[0]);
  const endReading = readings[readings.length - 1];
  return {
    startGlucose,
    peakGlucose: peak.mmol,
    timeToPeakMins: Math.round((peak.date - fromMs) / 60000),
    totalRise: Math.round((peak.mmol - startGlucose) * 10) / 10,
    endGlucose: endReading.mmol,
    fallFromPeak: Math.round((peak.mmol - endReading.mmol) * 10) / 10,
    timeFromPeakToEndMins: Math.round((endReading.date - peak.date) / 60000),
    readings,
    isPartial: nowMs < (fromMs + THREE_HOURS_MS),
    fetchedAt: new Date().toISOString(),
  };
}

// ── row → domain mappers ─────────────────────────────────

function rowToMeal(row: any): Meal {
  return {
    id: row.id,
    name: row.name,
    photoUri: row.photo_path,
    insulinUnits: row.insulin_units,
    startGlucose: row.start_glucose,
    carbsEstimated: row.carbs_estimated,
    loggedAt: row.logged_at,
    sessionId: row.session_id,
    glucoseResponse: row.glucose_response,
    insulin_brand: row.insulin_brand,
    delivery_method: row.delivery_method,
  };
}

function rowToInsulinLog(row: any): InsulinLog {
  return {
    id: row.id,
    type: row.type,
    units: row.units,
    startGlucose: row.start_glucose,
    loggedAt: row.logged_at,
    basalCurve: row.basal_curve,
  };
}

// ══════════════════════════════════════════════════════════
//  MEALS
// ══════════════════════════════════════════════════════════

export async function loadMeals(): Promise<Meal[]> {
  const userId = getSupabaseUserId();
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToMeal);
}

export async function saveMeal(
  meal: Omit<Meal, 'id' | 'loggedAt' | 'glucoseResponse' | 'sessionId'>,
  loggedAt?: Date
): Promise<Meal> {
  const userId = getSupabaseUserId();
  const now = loggedAt ?? new Date();
  const threeHoursAgo = new Date(now.getTime() - THREE_HOURS_MS).toISOString();

  // Load recent meals within the session window
  const { data: recentRows } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', threeHoursAgo)
    .lte('logged_at', now.toISOString());
  const recentMeals = (recentRows ?? []).map(rowToMeal);

  // Load active sessions
  const { data: sessionRows } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('started_at', threeHoursAgo);

  const activeSessions = new Set(
    (sessionRows ?? [])
      .filter(s => {
        const elapsed = now.getTime() - new Date(s.started_at).getTime();
        return elapsed >= 0 && elapsed <= THREE_HOURS_MS;
      })
      .map(s => s.id)
  );

  const eligibleMeals = recentMeals.filter(m => {
    const elapsed = now.getTime() - new Date(m.loggedAt).getTime();
    const withinWindow = elapsed >= 0 && elapsed <= THREE_HOURS_MS;
    const sessionOpen = m.sessionId === null || activeSessions.has(m.sessionId);
    return withinWindow && sessionOpen;
  });

  const newMealId = crypto.randomUUID();
  let sessionId: string;

  if (eligibleMeals.length === 0) {
    // New solo session
    sessionId = `s_${now.getTime()}`;
    await supabase.from('sessions').insert({
      id: sessionId,
      user_id: userId,
      started_at: now.toISOString(),
      confidence: 'high',
      glucose_response: null,
    });
  } else {
    const existingSessionId = eligibleMeals.find(m => m.sessionId)?.sessionId ?? null;

    if (existingSessionId) {
      sessionId = existingSessionId;
      const mealCount = eligibleMeals.filter(m => m.sessionId === existingSessionId).length + 1;
      await supabase.from('sessions')
        .update({ confidence: computeConfidence(mealCount) })
        .eq('id', sessionId);
    } else {
      const earliestStart = eligibleMeals.reduce(
        (earliest, m) => (m.loggedAt < earliest ? m.loggedAt : earliest),
        eligibleMeals[0].loggedAt
      );
      sessionId = `s_${now.getTime()}`;
      await supabase.from('sessions').insert({
        id: sessionId,
        user_id: userId,
        started_at: earliestStart,
        confidence: computeConfidence(eligibleMeals.length + 1),
        glucose_response: null,
      });
      // Assign orphan meals to the new session
      const orphanIds = eligibleMeals.filter(m => !m.sessionId).map(m => m.id);
      if (orphanIds.length > 0) {
        await supabase.from('meals')
          .update({ session_id: sessionId })
          .in('id', orphanIds);
      }
    }
  }

  const { error } = await supabase.from('meals').insert({
    id: newMealId,
    user_id: userId,
    session_id: sessionId,
    name: meal.name,
    photo_path: meal.photoUri,
    insulin_units: meal.insulinUnits,
    start_glucose: meal.startGlucose,
    carbs_estimated: meal.carbsEstimated,
    logged_at: now.toISOString(),
    glucose_response: null,
    insulin_brand: meal.insulin_brand,
    delivery_method: meal.delivery_method,
  });
  if (error) throw error;

  return {
    ...meal,
    id: newMealId,
    loggedAt: now.toISOString(),
    glucoseResponse: null,
    sessionId,
  };
}

export async function updateMeal(
  id: string,
  changes: Partial<Pick<Meal, 'name' | 'photoUri' | 'insulinUnits' | 'loggedAt' | 'carbsEstimated'>>
): Promise<void> {
  const patch: Record<string, any> = {};
  if ('name' in changes) patch.name = changes.name;
  if ('photoUri' in changes) patch.photo_path = changes.photoUri;
  if ('insulinUnits' in changes) patch.insulin_units = changes.insulinUnits;
  if ('carbsEstimated' in changes) patch.carbs_estimated = changes.carbsEstimated;
  if ('loggedAt' in changes) {
    patch.logged_at = changes.loggedAt;
    patch.glucose_response = null; // invalidate curve when time changes
  }
  const { error } = await supabase.from('meals').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════
//  SESSIONS
// ══════════════════════════════════════════════════════════

export async function loadSessionsWithMeals(): Promise<SessionWithMeals[]> {
  const userId = getSupabaseUserId();

  const [{ data: mealRows }, { data: sessionRows }] = await Promise.all([
    supabase.from('meals').select('*').eq('user_id', userId),
    supabase.from('sessions').select('*').eq('user_id', userId),
  ]);

  const meals = (mealRows ?? []).map(rowToMeal);
  const sessions = sessionRows ?? [];

  // Group meals by session_id
  const mealsBySession = new Map<string, Meal[]>();
  const orphanMeals: Meal[] = [];

  for (const meal of meals) {
    if (meal.sessionId) {
      const list = mealsBySession.get(meal.sessionId) ?? [];
      list.push(meal);
      mealsBySession.set(meal.sessionId, list);
    } else {
      orphanMeals.push(meal);
    }
  }

  const real: SessionWithMeals[] = sessions.map(row => {
    const sessionMeals = (mealsBySession.get(row.id) ?? [])
      .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

    const glucoseResponse =
      row.glucose_response ??
      sessionMeals.find(m => m.glucoseResponse && !m.glucoseResponse.isPartial)?.glucoseResponse ??
      sessionMeals.find(m => m.glucoseResponse)?.glucoseResponse ??
      null;

    return {
      id: row.id,
      mealIds: sessionMeals.map(m => m.id),
      startedAt: row.started_at,
      confidence: row.confidence,
      glucoseResponse,
      meals: sessionMeals,
    };
  });

  // Orphan meals → synthetic solo sessions (shouldn't normally exist in Supabase)
  const legacy: SessionWithMeals[] = orphanMeals.map(m => ({
    id: `legacy_${m.id}`,
    mealIds: [m.id],
    startedAt: m.loggedAt,
    confidence: 'high' as SessionConfidence,
    glucoseResponse: m.glucoseResponse ?? null,
    meals: [m],
  }));

  return [...real, ...legacy].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

// ══════════════════════════════════════════════════════════
//  GLUCOSE CURVES
// ══════════════════════════════════════════════════════════

export async function fetchAndStoreCurveForMeal(mealId: string): Promise<void> {
  const userId = getSupabaseUserId();
  const { data } = await supabase
    .from('meals')
    .select('logged_at')
    .eq('id', mealId)
    .eq('user_id', userId)
    .single();
  if (!data) return;

  const fromMs = new Date(data.logged_at).getTime();
  const toMs = fromMs + THREE_HOURS_MS;
  const nowMs = Date.now();

  const readings = await fetchGlucoseRange(fromMs, Math.min(toMs, nowMs));
  if (readings.length === 0) return;

  const glucoseResponse = buildGlucoseResponse(fromMs, readings, nowMs);
  await supabase.from('meals')
    .update({ glucose_response: glucoseResponse })
    .eq('id', mealId);
}

export async function fetchAndStoreCurve(mealId: string): Promise<void> {
  await fetchAndStoreCurveForMeal(mealId);
}

export async function fetchAndStoreCurveForSession(sessionId: string): Promise<void> {
  const userId = getSupabaseUserId();
  const { data } = await supabase
    .from('sessions')
    .select('started_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();
  if (!data) return;

  const fromMs = new Date(data.started_at).getTime();
  const toMs = fromMs + THREE_HOURS_MS;
  const nowMs = Date.now();

  const readings = await fetchGlucoseRange(fromMs, Math.min(toMs, nowMs));
  if (readings.length === 0) return;

  const glucoseResponse = buildGlucoseResponse(fromMs, readings, nowMs);
  await supabase.from('sessions')
    .update({ glucose_response: glucoseResponse })
    .eq('id', sessionId);
}

// ══════════════════════════════════════════════════════════
//  INSULIN LOGS
// ══════════════════════════════════════════════════════════

export async function saveInsulinLog(
  type: InsulinLogType,
  units: number,
  startGlucose: number | null,
  loggedAt?: Date
): Promise<InsulinLog> {
  const userId = getSupabaseUserId();
  const now = loggedAt ?? new Date();
  const log: InsulinLog = {
    id: crypto.randomUUID(),
    type,
    units,
    startGlucose,
    loggedAt: now.toISOString(),
    basalCurve: null,
  };
  const { error } = await supabase.from('insulin_logs').insert({
    id: log.id,
    user_id: userId,
    type,
    units,
    start_glucose: startGlucose,
    logged_at: now.toISOString(),
    basal_curve: null,
  });
  if (error) throw error;
  return log;
}

export async function loadInsulinLogs(): Promise<InsulinLog[]> {
  const userId = getSupabaseUserId();
  const { data, error } = await supabase
    .from('insulin_logs')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToInsulinLog);
}

export async function updateInsulinLog(
  id: string,
  changes: Partial<Pick<InsulinLog, 'units' | 'loggedAt'>>
): Promise<void> {
  const patch: Record<string, any> = {};
  if ('units' in changes) patch.units = changes.units;
  if ('loggedAt' in changes) patch.logged_at = changes.loggedAt;
  const { error } = await supabase.from('insulin_logs').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteInsulinLog(id: string): Promise<void> {
  const { error } = await supabase.from('insulin_logs').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAndStoreBasalCurve(logId: string): Promise<void> {
  const userId = getSupabaseUserId();
  const { data } = await supabase
    .from('insulin_logs')
    .select('logged_at, type')
    .eq('id', logId)
    .eq('user_id', userId)
    .single();
  if (!data || data.type !== 'long-acting') return;

  const fromMs = new Date(data.logged_at).getTime();
  const toMs = fromMs + TWELVE_HOURS_MS;
  const nowMs = Date.now();

  const readings = await fetchGlucoseRange(fromMs, Math.min(toMs, nowMs));
  if (readings.length === 0) return;

  const trough = readings.reduce((low, r) => (r.mmol < low.mmol ? r : low), readings[0]);
  const endReading = readings[readings.length - 1];

  const basalCurve: BasalCurve = {
    startGlucose: readings[0].mmol,
    lowestGlucose: trough.mmol,
    timeToTroughMins: Math.round((trough.date - fromMs) / 60000),
    endGlucose: endReading.mmol,
    totalDrop: Math.round((readings[0].mmol - trough.mmol) * 10) / 10,
    readings,
    isPartial: nowMs < toMs,
    fetchedAt: new Date().toISOString(),
  };

  await supabase.from('insulin_logs')
    .update({ basal_curve: basalCurve })
    .eq('id', logId);
}

// ══════════════════════════════════════════════════════════
//  GLUCOSE STORE (rolling 30-day cache)
// ══════════════════════════════════════════════════════════

export async function loadGlucoseStore(): Promise<GlucoseStore | null> {
  const userId = getSupabaseUserId();
  const { data } = await supabase
    .from('glucose_store')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!data) return null;
  return {
    readings: data.readings as GlucosePoint[],
    sum: data.sum,
    lastFetchedAt: data.last_fetched_at,
  };
}

export async function updateGlucoseStore(
  newEntries: GlucosePoint[]
): Promise<{ avg12h: number | null; avg30d: number | null; daysOfData: number }> {
  const userId = getSupabaseUserId();
  const existing = await loadGlucoseStore();
  const now = Date.now();
  const cutoff30d = now - THIRTY_DAYS_MS;
  const cutoff12h = now - TWELVE_HOURS_MS;

  let readings: GlucosePoint[] = existing?.readings ?? [];

  const existingDates = new Set(readings.map(r => r.date));
  for (const e of newEntries) {
    if (!existingDates.has(e.date)) readings.push(e);
  }

  readings = readings.filter(r => r.date >= cutoff30d).sort((a, b) => a.date - b.date);
  const sum = readings.reduce((acc, r) => acc + r.sgv, 0);

  const store = { readings, sum, last_fetched_at: now };

  await supabase.from('glucose_store').upsert({
    user_id: userId,
    ...store,
  });

  const count = readings.length;
  const avg30d = count > 0 ? Math.round((sum / count / 18) * 10) / 10 : null;

  const recent = readings.filter(r => r.date >= cutoff12h);
  const avg12h = recent.length > 0
    ? Math.round((recent.reduce((s, r) => s + r.sgv, 0) / recent.length / 18) * 10) / 10
    : null;

  const oldest = readings.length > 0 ? readings[0].date : now;
  const daysOfData = Math.max(1, Math.min(30, Math.round((now - oldest) / (24 * 60 * 60 * 1000))));

  return { avg12h, avg30d, daysOfData };
}

// ══════════════════════════════════════════════════════════
//  HBA1C CACHE
// ══════════════════════════════════════════════════════════

export async function loadCachedHba1c(): Promise<Hba1cEstimate | null> {
  const userId = getSupabaseUserId();
  const { data } = await supabase
    .from('hba1c_cache')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!data) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (data.calculated_date !== today) return null;
  return {
    percent: data.percent,
    mmolMol: data.mmol_mol,
    daysOfData: data.days_of_data,
    calculatedDate: data.calculated_date,
  };
}

export async function computeAndCacheHba1c(
  avgMmol: number,
  daysOfData: number
): Promise<Hba1cEstimate> {
  const userId = getSupabaseUserId();
  const percent = Math.round(((avgMmol + 2.59) / 1.59) * 10) / 10;
  const mmolMol = Math.round(10.929 * (avgMmol - 2.15));
  const calculatedDate = new Date().toISOString().slice(0, 10);

  await supabase.from('hba1c_cache').upsert({
    user_id: userId,
    percent,
    mmol_mol: mmolMol,
    days_of_data: daysOfData,
    calculated_date: calculatedDate,
  });

  return { percent, mmolMol, daysOfData, calculatedDate };
}

// ══════════════════════════════════════════════════════════
//  HYPO TREATMENTS
// ══════════════════════════════════════════════════════════

export async function saveHypoTreatment(record: HypoTreatment): Promise<void> {
  const userId = getSupabaseUserId();
  const { error } = await supabase.from('hypo_treatments').insert({
    id: record.id,
    user_id: userId,
    logged_at: record.logged_at,
    glucose_at_event: record.glucose_at_event,
    treatment_type: record.treatment_type,
    amount_value: record.amount_value,
    amount_unit: record.amount_unit,
    notes: record.notes ?? null,
    insulin_brand: record.insulin_brand ?? null,
    glucose_readings_after: record.glucose_readings_after ?? null,
  });
  if (error) throw error;
}

export async function loadHypoTreatments(): Promise<HypoTreatment[]> {
  const userId = getSupabaseUserId();
  const { data, error } = await supabase
    .from('hypo_treatments')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    logged_at: row.logged_at,
    glucose_at_event: row.glucose_at_event,
    treatment_type: row.treatment_type,
    amount_value: row.amount_value,
    amount_unit: row.amount_unit,
    notes: row.notes,
    insulin_brand: row.insulin_brand,
    glucose_readings_after: row.glucose_readings_after,
  }));
}

export async function updateHypoTreatment(
  id: string,
  changes: Partial<Pick<HypoTreatment, 'treatment_type' | 'amount_value' | 'amount_unit' | 'notes' | 'logged_at'>>
): Promise<void> {
  const { error } = await supabase.from('hypo_treatments').update(changes).eq('id', id);
  if (error) throw error;
}

export async function deleteHypoTreatment(id: string): Promise<void> {
  const { error } = await supabase.from('hypo_treatments').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAndStoreHypoRecoveryCurve(treatmentId: string): Promise<void> {
  const userId = getSupabaseUserId();
  const { data } = await supabase
    .from('hypo_treatments')
    .select('logged_at')
    .eq('id', treatmentId)
    .eq('user_id', userId)
    .single();
  if (!data) return;

  const fromMs = new Date(data.logged_at).getTime();
  const toMs = fromMs + TWO_HOURS_MS;
  const nowMs = Date.now();

  const readings = await fetchGlucoseRange(fromMs, Math.min(toMs, nowMs));
  if (readings.length === 0) return;

  await supabase.from('hypo_treatments')
    .update({ glucose_readings_after: readings.map(r => r.mmol) })
    .eq('id', treatmentId);
}

// ══════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════

const SETTINGS_DEFAULTS: AppSettings = {
  carbInsulinRatio: null,
  tabletName: '',
  tabletDose: '',
  displayName: '',
  email: '',
};

export async function loadSettings(): Promise<AppSettings> {
  const userId = getSupabaseUserId();
  const [{ data: settings }, { data: profile }] = await Promise.all([
    supabase.from('user_settings').select('*').eq('user_id', userId).single(),
    supabase.from('profiles').select('*').eq('id', userId).single(),
  ]);

  return {
    ...SETTINGS_DEFAULTS,
    carbInsulinRatio: settings?.carb_insulin_ratio ?? null,
    tabletName: settings?.tablet_name ?? '',
    tabletDose: settings?.tablet_dose ?? '',
    displayName: profile?.display_name ?? '',
    email: profile?.email ?? '',
  };
}

export async function saveSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const userId = getSupabaseUserId();
  const current = await loadSettings();
  const updated = { ...current, ...updates };

  // Split between user_settings and profiles tables
  const settingsPayload: Record<string, any> = { user_id: userId };
  if ('carbInsulinRatio' in updates) settingsPayload.carb_insulin_ratio = updates.carbInsulinRatio;
  if ('tabletName' in updates) settingsPayload.tablet_name = updates.tabletName;
  if ('tabletDose' in updates) settingsPayload.tablet_dose = updates.tabletDose;
  settingsPayload.updated_at = new Date().toISOString();

  const profilePayload: Record<string, any> = { id: userId };
  if ('displayName' in updates) profilePayload.display_name = updates.displayName;
  if ('email' in updates) profilePayload.email = updates.email;
  profilePayload.updated_at = new Date().toISOString();

  await Promise.all([
    supabase.from('user_settings').upsert(settingsPayload),
    supabase.from('profiles').upsert(profilePayload),
  ]);

  return updated;
}

// ══════════════════════════════════════════════════════════
//  EQUIPMENT PROFILE
// ══════════════════════════════════════════════════════════

export async function getActiveEquipment(field: string): Promise<EquipmentChangeEntry | null> {
  const userId = getSupabaseUserId();
  const { data } = await supabase
    .from('equipment_changelog')
    .select('*')
    .eq('user_id', userId)
    .eq('field', field)
    .is('ended_at', null)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    field: data.field,
    value: data.value,
    started_at: data.started_at,
    ended_at: data.ended_at ?? undefined,
    reason_for_change: data.reason_for_change ?? undefined,
    previous_value: data.previous_value ?? undefined,
  };
}

export async function getCurrentEquipmentProfile(): Promise<{
  rapidInsulinBrand: string;
  longActingInsulinBrand: string | null;
  deliveryMethod: string;
  cgmDevice: string;
  penNeedleBrand?: string;
} | null> {
  const [rapid, longActing, delivery, cgm, pen] = await Promise.all([
    getActiveEquipment('rapid_insulin_brand'),
    getActiveEquipment('long_acting_insulin_brand'),
    getActiveEquipment('delivery_method'),
    getActiveEquipment('cgm_device'),
    getActiveEquipment('pen_needle_brand'),
  ]);
  if (!rapid || !delivery || !cgm) return null;
  const longActingBrand = longActing
    ? (longActing.value === 'NO_LONG_ACTING' ? null : longActing.value)
    : null;
  return {
    rapidInsulinBrand: rapid.value,
    longActingInsulinBrand: longActingBrand,
    deliveryMethod: delivery.value,
    cgmDevice: cgm.value,
    ...(pen ? { penNeedleBrand: pen.value } : {}),
  };
}

export async function getEquipmentAtTime(field: string, timestamp: string): Promise<EquipmentChangeEntry | null> {
  const userId = getSupabaseUserId();
  const { data } = await supabase
    .from('equipment_changelog')
    .select('*')
    .eq('user_id', userId)
    .eq('field', field)
    .lte('started_at', timestamp)
    .or(`ended_at.is.null,ended_at.gt.${timestamp}`);
  if (!data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id,
    field: row.field,
    value: row.value,
    started_at: row.started_at,
    ended_at: row.ended_at ?? undefined,
    reason_for_change: row.reason_for_change ?? undefined,
    previous_value: row.previous_value ?? undefined,
  };
}

export async function changeEquipment(field: string, newValue: string, reason?: string): Promise<void> {
  const userId = getSupabaseUserId();
  const now = new Date().toISOString();

  // End the current active entry
  await supabase
    .from('equipment_changelog')
    .update({ ended_at: now })
    .eq('user_id', userId)
    .eq('field', field)
    .is('ended_at', null);

  // Get previous value for the record
  const previous = await getActiveEquipment(field);

  await supabase.from('equipment_changelog').insert({
    id: crypto.randomUUID(),
    user_id: userId,
    field,
    value: newValue,
    started_at: now,
    ...(previous ? { previous_value: previous.value } : {}),
    ...(reason ? { reason_for_change: reason } : {}),
  });
}

// ══════════════════════════════════════════════════════════
//  DAILY TIR
// ══════════════════════════════════════════════════════════

export async function getDailyTIRHistory(): Promise<DailyTIR[]> {
  const userId = getSupabaseUserId();
  const { data, error } = await supabase
    .from('daily_tir')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    date: row.date,
    readings_count: row.readings_count,
    in_range_count: row.in_range_count,
    tir_percentage: row.tir_percentage,
    below_range_pct: row.below_range_pct,
    above_range_pct: row.above_range_pct,
  }));
}

export async function storeDailyTIR(record: DailyTIR): Promise<void> {
  const userId = getSupabaseUserId();
  // upsert with onConflict prevents duplicates (composite PK: user_id + date)
  await supabase.from('daily_tir').upsert({
    user_id: userId,
    date: record.date,
    readings_count: record.readings_count,
    in_range_count: record.in_range_count,
    tir_percentage: record.tir_percentage,
    below_range_pct: record.below_range_pct,
    above_range_pct: record.above_range_pct,
  }, { onConflict: 'user_id,date', ignoreDuplicates: true });
}
