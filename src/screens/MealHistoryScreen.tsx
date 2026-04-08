import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import {
  fetchAndStoreBasalCurve,
  fetchAndStoreHypoRecoveryCurve,
  BasalCurve,
  GlucoseResponse,
  InsulinLog,
  Meal,
  SessionWithMeals,
  loadSessionsWithMeals,
  loadInsulinLogs,
  loadHypoTreatments,
} from '../services/storage';
import type { HypoTreatment } from '../types/equipment';
import { MealHistoryCard } from '../components/MealHistoryCard';
import { MealBottomSheet } from '../components/MealBottomSheet';
import { GlucoseChart } from '../components/GlucoseChart';
import { DayGroupHeader } from '../components/DayGroupHeader';
import { SessionSubHeader } from '../components/SessionSubHeader';
import { getMealFingerprint } from '../utils/mealFingerprint';
import { COLORS, FONTS } from '../theme';

// Enable LayoutAnimation on Android — wrapped in try/catch so it degrades
// gracefully on New Architecture (Fabric) where this API may not exist.
if (Platform.OS === 'android') {
  try { UIManager.setLayoutAnimationEnabledExperimental?.(true); } catch {}
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

// --- date helpers ---

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return localDateKey(new Date().toISOString());
}

function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function basalWindowComplete(loggedAt: string): boolean {
  return Date.now() - new Date(loggedAt).getTime() >= TWELVE_HOURS_MS;
}

function minsUntilBasalReady(loggedAt: string): number {
  const elapsed = Date.now() - new Date(loggedAt).getTime();
  return Math.ceil((TWELVE_HOURS_MS - elapsed) / 60000);
}

// --- shared stat component ---

function Stat({
  label,
  value,
  unit,
  color = '#FFFFFF',
  delta,
  deltaColor,
}: {
  label: string;
  value: string;
  unit: string;
  color?: string;
  delta?: string;
  deltaColor?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      {delta !== undefined && (
        <Text style={[styles.statDelta, { color: deltaColor ?? '#8E8E93' }]}>{delta}</Text>
      )}
    </View>
  );
}

// --- basal curve card ---

function BasalCurveCard({ curve }: { curve: BasalCurve }) {
  const dropColor = curve.totalDrop > 0 ? '#30D158' : '#FF9500';
  return (
    <View style={styles.responseCard}>
      <View style={styles.responseRow}>
        <Stat label="At injection" value={curve.startGlucose.toFixed(1)} unit="mmol/L" />
        <Stat
          label="Trough"
          value={curve.lowestGlucose.toFixed(1)}
          unit="mmol/L"
          color={curve.lowestGlucose < 3.9 ? '#FF3B30' : '#30D158'}
        />
        <Stat
          label="Drop"
          value={`${curve.totalDrop > 0 ? '-' : '+'}${Math.abs(curve.totalDrop).toFixed(1)}`}
          unit="mmol/L"
          color={dropColor}
        />
        <Stat label="To trough" value={`${curve.timeToTroughMins}`} unit="mins" />
      </View>
      <View style={styles.responseRow}>
        <Stat label="After 12h" value={curve.endGlucose.toFixed(1)} unit="mmol/L" />
      </View>
      {curve.isPartial && (
        <Text style={styles.partialNote}>12hr window still in progress</Text>
      )}
    </View>
  );
}

// --- insulin log card ---

function InsulinLogCard({ log, onRefresh }: { log: InsulinLog; onRefresh: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fetching, setFetching] = useState(false);
  const isLongActing = log.type === 'long-acting';
  const complete = basalWindowComplete(log.loggedAt);
  const minsLeft = minsUntilBasalReady(log.loggedAt);

  async function handleFetchCurve() {
    setFetching(true);
    try {
      await fetchAndStoreBasalCurve(log.id);
      onRefresh();
    } finally {
      setFetching(false);
    }
  }

  return (
    <View style={[styles.card, styles.insulinCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(log.loggedAt)}</Text>
        <View style={[styles.badge, {
          backgroundColor: isLongActing ? '#3A0A0A' : log.type === 'tablets' ? '#0A3A1A' : '#0A1A3A'
        }]}>
          <Text style={[styles.badgeText, {
            color: isLongActing ? '#FF3B30' : log.type === 'tablets' ? '#30D158' : '#0A84FF'
          }]}>
            {isLongActing ? '❤️ Long-acting' : log.type === 'tablets' ? '💊 Tablets' : '💉 Correction'}
          </Text>
        </View>
        <Pressable
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditInsulin', { logId: log.id })}
          hitSlop={8}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.insulinSummaryRow}>
        <Text style={styles.insulinUnits}>
          <Text style={[styles.insulinUnitsValue, { color: isLongActing ? '#FF3B30' : '#0A84FF' }]}>
            {log.units}
          </Text>
          {' '}units
        </Text>
        {log.startGlucose !== null && (
          <Text style={styles.insulinStartGlucose}>
            Glucose: {log.startGlucose.toFixed(1)} mmol/L
          </Text>
        )}
      </View>

      {isLongActing && (
        <>
          {log.basalCurve ? (
            <>
              <BasalCurveCard curve={log.basalCurve} />
              {log.basalCurve.isPartial && complete && (
                <Pressable style={styles.refreshBtn} onPress={handleFetchCurve} disabled={fetching}>
                  {fetching
                    ? <ActivityIndicator size="small" color="#FF3B30" />
                    : <Text style={[styles.refreshBtnText, { color: '#FF3B30' }]}>Refresh 12hr curve</Text>
                  }
                </Pressable>
              )}
            </>
          ) : complete ? (
            <Pressable style={[styles.fetchBtn, { backgroundColor: '#FF3B30' }]} onPress={handleFetchCurve} disabled={fetching}>
              {fetching
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[styles.fetchBtnText, { color: '#fff' }]}>Load overnight curve</Text>
              }
            </Pressable>
          ) : (
            <View style={styles.pendingRow}>
              <Text style={styles.pendingText}>
                12hr curve ready in ~{minsLeft > 60
                  ? `${Math.ceil(minsLeft / 60)}h`
                  : `${minsLeft}min`}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// --- hypo treatment card ---

function buildHypoChartResponse(treatment: HypoTreatment): GlucoseResponse | null {
  const readings = treatment.glucose_readings_after;
  if (!readings || readings.length < 2) return null;
  const fromMs = new Date(treatment.logged_at).getTime();
  return {
    startGlucose: readings[0],
    peakGlucose: Math.max(...readings),
    timeToPeakMins: 0,
    totalRise: 0,
    endGlucose: readings[readings.length - 1],
    fallFromPeak: 0,
    timeFromPeakToEndMins: 0,
    readings: readings.map((mmol, i) => ({ mmol, date: fromMs + i * 15 * 60 * 1000 })),
    isPartial: readings.length < 8,
    fetchedAt: new Date().toISOString(),
  };
}

function HypoTreatmentCard({ treatment, onRefresh }: { treatment: HypoTreatment; onRefresh: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fetching, setFetching] = useState(false);
  const chartResponse = buildHypoChartResponse(treatment);

  async function handleFetchCurve() {
    setFetching(true);
    try {
      await fetchAndStoreHypoRecoveryCurve(treatment.id);
      onRefresh();
    } finally {
      setFetching(false);
    }
  }

  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#FF3B30' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(treatment.logged_at)}</Text>
        <View style={[styles.badge, { backgroundColor: '#3A0A0A' }]}>
          <Text style={[styles.badgeText, { color: '#FF3B30' }]}>Hypo treatment</Text>
        </View>
        <Pressable
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditHypo', { treatmentId: treatment.id })}
          hitSlop={8}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.insulinSummaryRow}>
        <Text style={styles.insulinUnits}>
          {treatment.treatment_type}
          {treatment.amount_value != null ? ` — ${treatment.amount_value} ${treatment.amount_unit ?? ''}` : ''}
        </Text>
        <Text style={styles.insulinStartGlucose}>
          {treatment.glucose_at_event.toFixed(1)} mmol/L
        </Text>
      </View>

      {treatment.brand ? (
        <Text style={styles.hypoNotes}>{treatment.brand}</Text>
      ) : null}

      {treatment.notes ? (
        <Text style={styles.hypoNotes}>{treatment.notes}</Text>
      ) : null}

      {chartResponse ? (
        <GlucoseChart response={chartResponse} height={120} />
      ) : (
        <Pressable style={styles.fetchBtn} onPress={handleFetchCurve} disabled={fetching}>
          {fetching
            ? <ActivityIndicator size="small" color="#FF3B30" />
            : <Text style={[styles.fetchBtnText, { color: '#fff' }]}>
                {treatment.glucose_readings_after && treatment.glucose_readings_after.length > 0
                  ? 'Refresh recovery curve'
                  : 'Load recovery curve'}
              </Text>
          }
        </Pressable>
      )}
    </View>
  );
}

// --- tab bar ---

function HistoryTabBar({ activeTab, onTabChange }: { activeTab: 0 | 1; onTabChange: (tab: 0 | 1) => void }) {
  return (
    <View style={tabStyles.container}>
      <Pressable
        style={[tabStyles.tab, activeTab === 0 && tabStyles.activeTab]}
        onPress={() => onTabChange(0)}
      >
        <Text style={[tabStyles.tabText, activeTab === 0 && tabStyles.activeTabText]}>
          Meals
        </Text>
      </Pressable>
      <Pressable
        style={[tabStyles.tab, activeTab === 1 && tabStyles.activeTab]}
        onPress={() => onTabChange(1)}
      >
        <Text style={[tabStyles.tabText, activeTab === 1 && tabStyles.activeTabText]}>
          Long-acting
        </Text>
      </Pressable>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.green,
  },
  tabText: {
    fontSize: 15,
    color: COLORS.textMuted,
    fontFamily: FONTS.regular,
  },
  activeTabText: {
    color: COLORS.text,
    fontFamily: FONTS.semiBold,
  },
});

// --- long-acting card ---

function LongActingCard({ log, onRefresh }: { log: InsulinLog; onRefresh: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fetching, setFetching] = useState(false);
  const complete = basalWindowComplete(log.loggedAt);
  const minsLeft = minsUntilBasalReady(log.loggedAt);

  // Convert BasalCurve to GlucoseResponse shape for GlucoseChart
  const chartResponse: GlucoseResponse | null = log.basalCurve ? {
    startGlucose: log.basalCurve.startGlucose,
    peakGlucose: Math.max(...log.basalCurve.readings.map(r => r.mmol)),
    timeToPeakMins: 0,
    totalRise: 0,
    endGlucose: log.basalCurve.endGlucose,
    fallFromPeak: 0,
    timeFromPeakToEndMins: 0,
    readings: log.basalCurve.readings,
    isPartial: log.basalCurve.isPartial,
    fetchedAt: log.basalCurve.fetchedAt,
  } : null;

  // Find morning reading — closest to 7am the day after injection
  const morningReading = useMemo(() => {
    if (!log.basalCurve || log.basalCurve.readings.length === 0) return null;
    const injectionDate = new Date(log.loggedAt);
    const nextDay7am = new Date(injectionDate);
    nextDay7am.setDate(nextDay7am.getDate() + 1);
    nextDay7am.setHours(7, 0, 0, 0);
    const target7amMs = nextDay7am.getTime();
    let closest = log.basalCurve.readings[0];
    let closestDiff = Math.abs(closest.date - target7amMs);
    for (const r of log.basalCurve.readings) {
      const diff = Math.abs(r.date - target7amMs);
      if (diff < closestDiff) {
        closest = r;
        closestDiff = diff;
      }
    }
    // Only show if within 2 hours of 7am
    return closestDiff <= 2 * 60 * 60 * 1000 ? closest : null;
  }, [log.basalCurve, log.loggedAt]);

  async function handleFetchCurve() {
    setFetching(true);
    try {
      await fetchAndStoreBasalCurve(log.id);
      onRefresh();
    } finally {
      setFetching(false);
    }
  }

  return (
    <View style={[styles.card, styles.insulinCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(log.loggedAt)}</Text>
        <View style={[styles.badge, { backgroundColor: '#3A0A0A' }]}>
          <Text style={[styles.badgeText, { color: '#FF3B30' }]}>Long-acting</Text>
        </View>
        <Pressable
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditInsulin', { logId: log.id })}
          hitSlop={8}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.insulinSummaryRow}>
        <Text style={styles.insulinUnits}>
          <Text style={[styles.insulinUnitsValue, { color: '#FF3B30' }]}>{log.units}</Text>
          {' '}units
        </Text>
        {log.startGlucose !== null && (
          <Text style={styles.insulinStartGlucose}>
            Glucose: {log.startGlucose.toFixed(1)} mmol/L
          </Text>
        )}
      </View>

      {chartResponse ? (
        <>
          <GlucoseChart response={chartResponse} height={160} showTimeLabels />
          {log.basalCurve && <BasalCurveCard curve={log.basalCurve} />}
          {morningReading && (
            <View style={longActingStyles.morningRow}>
              <Text style={longActingStyles.morningLabel}>Morning reading</Text>
              <Text style={[longActingStyles.morningValue, {
                color: morningReading.mmol < 3.9 ? COLORS.red : morningReading.mmol > 10.0 ? COLORS.amber : COLORS.green
              }]}>
                {morningReading.mmol.toFixed(1)} mmol/L
              </Text>
            </View>
          )}
          {log.basalCurve?.isPartial && complete && (
            <Pressable style={styles.refreshBtn} onPress={handleFetchCurve} disabled={fetching}>
              {fetching
                ? <ActivityIndicator size="small" color="#FF3B30" />
                : <Text style={[styles.refreshBtnText, { color: '#FF3B30' }]}>Refresh 12hr curve</Text>
              }
            </Pressable>
          )}
        </>
      ) : complete ? (
        <Pressable style={[styles.fetchBtn, { backgroundColor: '#FF3B30' }]} onPress={handleFetchCurve} disabled={fetching}>
          {fetching
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={[styles.fetchBtnText, { color: '#fff' }]}>Load overnight curve</Text>
          }
        </Pressable>
      ) : (
        <View style={styles.pendingRow}>
          <Text style={styles.pendingText}>
            12hr curve ready in ~{minsLeft > 60 ? `${Math.ceil(minsLeft / 60)}h` : `${minsLeft}min`}
          </Text>
        </View>
      )}
    </View>
  );
}

const longActingStyles = StyleSheet.create({
  morningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  morningLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  morningValue: {
    fontSize: 17,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
});

// --- long-acting tab ---

function LongActingTab({ insulinLogs, onRefresh }: { insulinLogs: InsulinLog[]; onRefresh: () => void }) {
  const longActingLogs = useMemo(
    () => insulinLogs.filter(l => l.type === 'long-acting').sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()),
    [insulinLogs]
  );

  if (longActingLogs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No long-acting insulin logged</Text>
        <Text style={styles.emptyHint}>Log a long-acting dose from the home screen</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={longActingLogs}
      keyExtractor={log => `la_${log.id}`}
      contentContainerStyle={styles.list}
      renderItem={({ item: log }) => (
        <LongActingCard log={log} onRefresh={onRefresh} />
      )}
    />
  );
}

// --- screen ---

type ListRow =
  | { type: 'today-meal';      meal: Meal; sessionId: string }
  | { type: 'today-session';   session: SessionWithMeals }
  | { type: 'today-insulin';   data: InsulinLog }
  | { type: 'today-hypo';      data: HypoTreatment }
  | { type: 'day-header';      dateKey: string; label: string; count: number; expanded: boolean }
  | { type: 'session-subhdr';  session: SessionWithMeals; dateKey: string }
  | { type: 'past-meal';       meal: Meal; dateKey: string }
  | { type: 'past-insulin';    data: InsulinLog; dateKey: string }
  | { type: 'past-hypo';       data: HypoTreatment; dateKey: string };

export default function MealHistoryScreen() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [sessions, setSessions] = useState<SessionWithMeals[]>([]);
  const [insulinLogs, setInsulinLogs] = useState<InsulinLog[]>([]);
  const [hypoTreatments, setHypoTreatments] = useState<HypoTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [sheetSessions, setSheetSessions] = useState<SessionWithMeals[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const hasInitialized = useRef(false);

  const mergeItems = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    const [loadedSessions, loadedInsulin, loadedHypo] = await Promise.all([
      loadSessionsWithMeals(),
      loadInsulinLogs(),
      loadHypoTreatments(),
    ]);

    // On first load, open the most recent past day
    if (!hasInitialized.current && (loadedSessions.length > 0 || loadedInsulin.length > 0)) {
      hasInitialized.current = true;
      const today = todayKey();
      const allDates = [
        ...loadedSessions.map(s => localDateKey(s.startedAt)),
        ...loadedInsulin.map(l => localDateKey(l.loggedAt)),
        ...loadedHypo.map(h => localDateKey(h.logged_at)),
      ];
      const pastKeys = [...new Set(allDates)]
        .filter(k => k !== today)
        .sort((a, b) => b.localeCompare(a));
      if (pastKeys.length > 0) {
        setExpandedDays(new Set([pastKeys[0]]));
      }
    }

    setSessions(loadedSessions);
    setInsulinLogs(loadedInsulin);
    setHypoTreatments(loadedHypo);
    if (showSpinner) setLoading(false);
  }, []);

  const load = useCallback(() => mergeItems(true), [mergeItems]);
  const silentRefresh = useCallback(() => mergeItems(false), [mergeItems]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function toggleDay(key: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleCardPress(meal: Meal) {
    // Real sessions use sessionId; legacy pre-session meals get a synthetic session with id 'legacy_<mealId>'
    const targetSession = meal.sessionId
      ? sessions.find(s => s.id === meal.sessionId) ?? null
      : sessions.find(s => s.id === `legacy_${meal.id}`) ?? null;

    if (!targetSession) return;

    // Match by session-level fingerprint (all meals combined) — same logic as matching.ts.
    // Using a single meal's fingerprint caused cross-contamination: two sessions that both
    // contained "Crisps" as a separate meal would show identical "eaten before" results.
    const targetFp = getMealFingerprint(targetSession.meals.map(m => m.name).join(' '));
    const otherInstances = targetFp
      ? sessions
          .filter(s => s.id !== targetSession.id)
          .filter(s => getMealFingerprint(s.meals.map(m => m.name).join(' ')) === targetFp)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          .slice(0, 9)
      : [];

    const list = [targetSession, ...otherInstances];
    setSheetSessions(list);
    setSheetVisible(true);
  }

  const listData = useMemo<ListRow[]>(() => {
    const today = todayKey();

    // Build day buckets for sessions
    const sessionsByDay = new Map<string, SessionWithMeals[]>();
    for (const session of sessions) {
      const key = localDateKey(session.startedAt);
      if (!sessionsByDay.has(key)) sessionsByDay.set(key, []);
      sessionsByDay.get(key)!.push(session);
    }

    // Build day buckets for insulin logs
    const insulinByDay = new Map<string, InsulinLog[]>();
    for (const log of insulinLogs) {
      const key = localDateKey(log.loggedAt);
      if (!insulinByDay.has(key)) insulinByDay.set(key, []);
      insulinByDay.get(key)!.push(log);
    }

    // Build day buckets for hypo treatments
    const hypoByDay = new Map<string, HypoTreatment[]>();
    for (const h of hypoTreatments) {
      const key = localDateKey(h.logged_at);
      if (!hypoByDay.has(key)) hypoByDay.set(key, []);
      hypoByDay.get(key)!.push(h);
    }

    // All unique day keys
    const allDayKeys = [...new Set([
      ...sessionsByDay.keys(),
      ...insulinByDay.keys(),
      ...hypoByDay.keys(),
    ])].sort((a, b) => b.localeCompare(a));

    const rows: ListRow[] = [];

    // Today's items — flat, no header
    const todaySessions = sessionsByDay.get(today) ?? [];
    const todayInsulin = insulinByDay.get(today) ?? [];
    const todayHypo = hypoByDay.get(today) ?? [];

    // Interleave today's sessions (meals), insulin, and hypo by time, newest-first
    type TodayEntry =
      | { kind: 'session'; session: SessionWithMeals; time: number }
      | { kind: 'insulin'; log: InsulinLog; time: number }
      | { kind: 'hypo'; treatment: HypoTreatment; time: number };

    const todayEntries: TodayEntry[] = [
      ...todaySessions.map(s => ({ kind: 'session' as const, session: s, time: new Date(s.startedAt).getTime() })),
      ...todayInsulin.map(l => ({ kind: 'insulin' as const, log: l, time: new Date(l.loggedAt).getTime() })),
      ...todayHypo.map(h => ({ kind: 'hypo' as const, treatment: h, time: new Date(h.logged_at).getTime() })),
    ].sort((a, b) => b.time - a.time);

    for (const entry of todayEntries) {
      if (entry.kind === 'session') {
        const s = entry.session;
        if (s.meals.length >= 2) {
          rows.push({ type: 'today-session', session: s });
        }
        for (const meal of s.meals) {
          rows.push({ type: 'today-meal', meal, sessionId: s.id });
        }
      } else if (entry.kind === 'hypo') {
        rows.push({ type: 'today-hypo', data: entry.treatment });
      } else {
        rows.push({ type: 'today-insulin', data: entry.log });
      }
    }

    // Past days — collapsible
    for (const key of allDayKeys.filter(k => k !== today)) {
      const daySessions = sessionsByDay.get(key) ?? [];
      const dayInsulin = insulinByDay.get(key) ?? [];
      const dayHypo = hypoByDay.get(key) ?? [];
      const count = daySessions.reduce((acc, s) => acc + s.meals.length, 0) + dayInsulin.length + dayHypo.length;
      const expanded = expandedDays.has(key);

      rows.push({
        type: 'day-header',
        dateKey: key,
        label: formatDayLabel(key),
        count,
        expanded,
      });

      if (expanded) {
        // Interleave sessions, insulin, and hypo by time, newest-first
        type PastEntry =
          | { kind: 'session'; session: SessionWithMeals; time: number }
          | { kind: 'insulin'; log: InsulinLog; time: number }
          | { kind: 'hypo'; treatment: HypoTreatment; time: number };

        const pastEntries: PastEntry[] = [
          ...daySessions.map(s => ({ kind: 'session' as const, session: s, time: new Date(s.startedAt).getTime() })),
          ...dayInsulin.map(l => ({ kind: 'insulin' as const, log: l, time: new Date(l.loggedAt).getTime() })),
          ...dayHypo.map(h => ({ kind: 'hypo' as const, treatment: h, time: new Date(h.logged_at).getTime() })),
        ].sort((a, b) => b.time - a.time);

        for (const entry of pastEntries) {
          if (entry.kind === 'session') {
            const s = entry.session;
            if (s.meals.length >= 2) {
              rows.push({ type: 'session-subhdr', session: s, dateKey: key });
            }
            for (const meal of s.meals) {
              rows.push({ type: 'past-meal', meal, dateKey: key });
            }
          } else if (entry.kind === 'hypo') {
            rows.push({ type: 'past-hypo', data: entry.treatment, dateKey: key });
          } else {
            rows.push({ type: 'past-insulin', data: entry.log, dateKey: key });
          }
        }
      }
    }

    return rows;
  }, [sessions, insulinLogs, hypoTreatments, expandedDays]);

  const isEmpty = sessions.length === 0 && insulinLogs.length === 0 && hypoTreatments.length === 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#30D158" />
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🍽</Text>
        <Text style={styles.emptyText}>Nothing logged yet</Text>
        <Text style={styles.emptyHint}>Log a meal or insulin from the home screen</Text>
      </View>
    );
  }

  return (
    <>
      <HistoryTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <View style={{ flex: 1, display: activeTab === 0 ? 'flex' : 'none' }}>
        <FlatList
          data={listData}
          keyExtractor={row => {
            if (row.type === 'day-header') return `header_${row.dateKey}`;
            if (row.type === 'today-meal') return `today_meal_${row.meal.id}`;
            if (row.type === 'today-session') return `today_session_${row.session.id}`;
            if (row.type === 'today-insulin') return `today_insulin_${row.data.id}`;
            if (row.type === 'today-hypo') return `today_hypo_${row.data.id}`;
            if (row.type === 'session-subhdr') return `subhdr_${row.dateKey}_${row.session.id}`;
            if (row.type === 'past-meal') return `past_meal_${row.dateKey}_${row.meal.id}`;
            if (row.type === 'past-hypo') return `past_hypo_${row.dateKey}_${row.data.id}`;
            return `past_insulin_${row.dateKey}_${row.data.id}`;
          }}
          contentContainerStyle={styles.list}
          renderItem={({ item: row }) => {
            if (row.type === 'day-header') {
              return (
                <DayGroupHeader
                  label={row.label}
                  count={row.count}
                  expanded={row.expanded}
                  onToggle={() => toggleDay(row.dateKey)}
                />
              );
            }
            if (row.type === 'session-subhdr') {
              return (
                <SessionSubHeader
                  mealCount={row.session.meals.length}
                  startedAt={row.session.startedAt}
                />
              );
            }
            if (row.type === 'today-session') {
              return (
                <SessionSubHeader
                  mealCount={row.session.meals.length}
                  startedAt={row.session.startedAt}
                />
              );
            }
            if (row.type === 'today-meal' || row.type === 'past-meal') {
              return (
                <MealHistoryCard
                  meal={row.meal}
                  onPress={() => handleCardPress(row.meal)}
                />
              );
            }
            if (row.type === 'today-hypo' || row.type === 'past-hypo') {
              return <HypoTreatmentCard treatment={row.data} onRefresh={silentRefresh} />;
            }
            // today-insulin or past-insulin
            return <InsulinLogCard log={row.data} onRefresh={silentRefresh} />;
          }}
        />
      </View>
      <View style={{ flex: 1, display: activeTab === 1 ? 'flex' : 'none' }}>
        <LongActingTab insulinLogs={insulinLogs} onRefresh={silentRefresh} />
      </View>
      <MealBottomSheet
        sessions={sheetSessions}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 18, color: '#FFFFFF', fontWeight: '600' },
  emptyHint: { fontSize: 14, color: '#8E8E93' },
  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },

  // Edit button (shared between meal + insulin cards)
  editBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editBtnText: {
    fontSize: 13,
    color: '#636366',
  },

  // Glucose stats
  responseCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  responseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: {
    fontSize: 10,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  statUnit: { fontSize: 10, color: '#636366' },
  statDelta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  partialNote: { fontSize: 12, color: '#FF9500', textAlign: 'center' },

  // States
  pendingRow: { alignItems: 'center', paddingVertical: 4 },
  pendingText: { fontSize: 13, color: '#636366', fontStyle: 'italic' },
  fetchBtn: {
    backgroundColor: '#30D158',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  fetchBtnText: { color: '#000', fontWeight: '600', fontSize: 14 },
  refreshBtn: { alignItems: 'center', padding: 8 },
  refreshBtnText: { color: '#0A84FF', fontSize: 14 },

  // Insulin log card
  insulinCard: { gap: 8 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDate: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  insulinSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  insulinUnits: { fontSize: 16, color: '#8E8E93' },
  insulinUnitsValue: { fontSize: 28, fontWeight: '700' },
  insulinStartGlucose: { fontSize: 13, color: '#636366' },
  hypoNotes: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic' },
});
