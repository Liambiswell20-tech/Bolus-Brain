import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GlucoseResponse, SessionWithMeals } from '../services/storage';
import { fetchAndStoreCurveForMeal, loadMeals } from '../services/storage';
import { classifyOutcome } from '../utils/outcomeClassifier';
import { glucoseColor } from '../utils/glucoseColor';
import { formatDate } from '../utils/formatDate';
import { GlucoseChart } from './GlucoseChart';
import { OutcomeBadge } from './OutcomeBadge';
import { SafetyDisclaimer } from './SafetyDisclaimer';
import type { MealBottomSheetProps } from './types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Text as UIText } from '~/components/ui/text';
import { cn } from '~/lib/utils';

export function MealBottomSheet({ sessions, visible, onClose }: MealBottomSheetProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Reset to first tab whenever sheet opens with a new set of sessions
  const safeActiveTab = activeTab < sessions.length ? activeTab : 0;
  const activeSession = sessions[safeActiveTab] ?? null;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        <Tabs
          value={activeSession?.id ?? ''}
          onValueChange={(id: string) => {
            const idx = sessions.findIndex(s => s.id === id);
            if (idx >= 0) setActiveTab(idx);
          }}
        >
          {/* Content area — scrollable per session */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {sessions.map(s => (
              <TabsContent key={s.id} value={s.id}>
                <SessionDetail session={s} />
              </TabsContent>
            ))}
          </ScrollView>

          {/* Tab strip — at BOTTOM, above SafetyDisclaimer (per CONTEXT.md Decision 6) */}
          {sessions.length > 1 && (
            <TabsList className="bg-transparent h-auto rounded-none px-4 pt-2 flex-row flex-wrap gap-2 w-full">
              {sessions.map(s => (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className={cn(
                    'rounded-2xl px-3 py-1.5 shadow-none border-0',
                    s.id === (activeSession?.id ?? '') ? 'bg-[#0A84FF]' : 'bg-[#2C2C2E]'
                  )}
                >
                  <UIText className="text-xs">
                    {new Date(s.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </UIText>
                </TabsTrigger>
              ))}
            </TabsList>
          )}
        </Tabs>

        {/* SafetyDisclaimer always at bottom */}
        <SafetyDisclaimer />
      </View>
    </Modal>
  );
}

function SessionDetail({ session }: { session: SessionWithMeals }) {
  const [glucoseResponse, setGlucoseResponse] = useState<GlucoseResponse | null>(session.glucoseResponse);
  const [loadingCurve, setLoadingCurve] = useState(false);

  async function handleLoadCurve() {
    const mealId = session.meals[0]?.id;
    if (!mealId) return;
    setLoadingCurve(true);
    try {
      await fetchAndStoreCurveForMeal(mealId);
      const meals = await loadMeals();
      const updated = meals.find(m => m.id === mealId);
      if (updated?.glucoseResponse) setGlucoseResponse(updated.glucoseResponse);
    } catch {
      // silent failure
    } finally {
      setLoadingCurve(false);
    }
  }

  const badge = classifyOutcome(glucoseResponse);
  const totalInsulin = session.meals.reduce((sum, m) => sum + m.insulinUnits, 0);

  return (
    <View style={styles.sessionDetail}>
      {/* Session name + date */}
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionName} numberOfLines={2}>
          {session.meals.map(m => m.name).join(' + ')}
        </Text>
        <Text style={styles.sessionDate}>{formatDate(session.startedAt)}</Text>
      </View>

      {/* Insulin total */}
      {totalInsulin > 0 && (
        <Text style={styles.insulinText}>{totalInsulin}u insulin</Text>
      )}

      {/* Outcome badge */}
      <View style={styles.badgeRow}>
        <OutcomeBadge badge={badge} size="default" />
      </View>

      {/* Glucose stats + chart */}
      {glucoseResponse ? (
        <>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>START</Text>
              <Text style={[styles.statValue, { color: glucoseColor(glucoseResponse.startGlucose) }]}>
                {glucoseResponse.startGlucose.toFixed(1)}
              </Text>
              <Text style={styles.statUnit}>mmol/L</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>PEAK</Text>
              <Text style={[styles.statValue, { color: glucoseColor(glucoseResponse.peakGlucose) }]}>
                {glucoseResponse.peakGlucose.toFixed(1)}
              </Text>
              <Text style={styles.statUnit}>mmol/L</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>3HR</Text>
              <Text style={[styles.statValue, { color: glucoseColor(glucoseResponse.endGlucose) }]}>
                {glucoseResponse.endGlucose.toFixed(1)}
              </Text>
              <Text style={styles.statUnit}>mmol/L</Text>
            </View>
          </View>

          {glucoseResponse.readings.length >= 2 ? (
            <GlucoseChart response={glucoseResponse} height={140} />
          ) : (
            <View style={styles.noCurveBox}>
              <Text style={styles.noCurveText}>Not enough readings yet</Text>
              <Pressable style={styles.loadCurveBtn} onPress={handleLoadCurve} disabled={loadingCurve}>
                {loadingCurve
                  ? <ActivityIndicator size="small" color="#0A84FF" />
                  : <Text style={styles.loadCurveBtnText}>Refresh curve</Text>
                }
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <View style={styles.noCurveBox}>
          <Text style={styles.noCurveText}>Glucose curve not available</Text>
          <Pressable style={styles.loadCurveBtn} onPress={handleLoadCurve} disabled={loadingCurve}>
            {loadingCurve
              ? <ActivityIndicator size="small" color="#0A84FF" />
              : <Text style={styles.loadCurveBtnText}>Load curve</Text>
            }
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: Dimensions.get('window').height * 0.55,
    paddingBottom: 24,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#48484A',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sessionDetail: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sessionHeader: {
    gap: 4,
  },
  sessionName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sessionDate: {
    fontSize: 12,
    color: '#636366',
  },
  insulinText: {
    fontSize: 14,
    color: '#0A84FF',
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingVertical: 10,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  statUnit: {
    fontSize: 10,
    color: '#636366',
  },
  noCurveBox: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  noCurveText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  loadCurveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#0A84FF',
    minWidth: 100,
    alignItems: 'center',
  },
  loadCurveBtnText: {
    fontSize: 14,
    color: '#0A84FF',
    fontWeight: '600',
  },
});
