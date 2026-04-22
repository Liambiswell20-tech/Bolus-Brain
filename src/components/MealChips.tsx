/**
 * MealChips — Phase J (Session Grouping Spec Section 8.3)
 *
 * Pure function getMealChips() determines which chips to display on a
 * MealHistoryCard. Chip variants follow the spec's canonical labels:
 *   - muted: MEDIUM confidence or session membership (informational, no tap)
 *   - amber: LOW confidence or contamination flags (tappable → info sheet)
 *   - neutral: curve characteristics (tappable → info sheet)
 *
 * All V2 fields are optional — if absent (V1 meal), no chips are shown.
 * This ensures rollback safety.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Meal, Session } from '../services/storage';
import { COLORS, FONTS } from '../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChipConfig {
  label: string;
  variant: 'muted' | 'amber' | 'neutral';
  /** Key into CHIP_INFO for tap-to-open info sheet. null = not tappable. */
  infoKey: string | null;
}

export interface ChipInfoEntry {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Info sheet content — Section 8.3 copy (zero predictive language)
// ---------------------------------------------------------------------------

export const CHIP_INFO: Record<string, ChipInfoEntry> = {
  sensor_incomplete: {
    title: 'Sensor data incomplete',
    body: 'Less than half the glucose readings were available for this meal\u2019s digestion window. The glucose data shown may not reflect the full picture.',
  },
  curve_corrected: {
    title: 'Correction taken during this meal',
    body: 'A correction dose was given during this meal\u2019s digestion window. The glucose curve reflects both the meal and the correction.',
  },
  hypo_during: {
    title: 'Hypo treated during this meal',
    body: 'A hypo treatment was taken during this meal\u2019s digestion window. The glucose curve was affected by both the meal and the treatment.',
  },
  ended_elevated: {
    title: 'Glucose still high at window end',
    body: 'Glucose was above 10.0 mmol/L when this meal\u2019s digestion window ended.',
  },
  ended_low: {
    title: 'Glucose low at window end',
    body: 'Glucose was below 3.9 mmol/L when this meal\u2019s digestion window ended, without a hypo treatment being logged.',
  },
};

// ---------------------------------------------------------------------------
// Pure logic — getMealChips (spec Section 8.3)
// ---------------------------------------------------------------------------

export function getMealChips(meal: Meal, session: Session | null): ChipConfig[] {
  const chips: ChipConfig[] = [];
  const isSessionMember = session !== null && meal.sessionId != null;

  // --- Confidence / membership chips ---
  if (isSessionMember) {
    // Session members get the membership chip instead of solo confidence chips
    chips.push({ label: 'Eaten alongside other food', variant: 'muted', infoKey: null });
  } else {
    // Solo meal confidence chips
    if (meal.classificationMethod === 'fallback') {
      chips.push({ label: 'Carbs estimated', variant: 'muted', infoKey: null });
    }
    if (meal.cgmCoveragePercent != null) {
      if (meal.cgmCoveragePercent < 50) {
        chips.push({ label: 'Sensor data incomplete', variant: 'amber', infoKey: 'sensor_incomplete' });
      } else if (meal.cgmCoveragePercent < 80) {
        chips.push({ label: 'Limited sensor data', variant: 'muted', infoKey: null });
      }
    }
  }

  // --- Contamination flags (session-level, shown on member cards) ---
  if (session?.curveCorrected) {
    chips.push({ label: 'Correction taken during this meal', variant: 'amber', infoKey: 'curve_corrected' });
  }
  if (session?.hypoDuringSession) {
    chips.push({ label: 'Hypo treated during this meal', variant: 'amber', infoKey: 'hypo_during' });
  }

  // --- Curve characteristics (meal-level) ---
  if (meal.endedElevated) {
    chips.push({ label: 'Glucose still high at window end', variant: 'neutral', infoKey: 'ended_elevated' });
  }
  if (meal.endedLow) {
    chips.push({ label: 'Glucose low at window end', variant: 'neutral', infoKey: 'ended_low' });
  }

  return chips;
}

// ---------------------------------------------------------------------------
// Session row text — Section 8.1
// ---------------------------------------------------------------------------

export function formatSessionRowText(params: {
  totalCarbs: number | null;
  peakGlucose: number | null;
  peakTime: string | null;
}): string {
  const parts: string[] = ['Eaten alongside other food'];

  if (params.totalCarbs != null) {
    parts.push(`total ${params.totalCarbs}g carbs`);
  }

  if (params.peakGlucose != null && params.peakTime != null) {
    const time = new Date(params.peakTime).toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    parts.push(`peak ${params.peakGlucose.toFixed(1)} at ${time}`);
  }

  return parts.join(' \u00B7 ');
}

// ---------------------------------------------------------------------------
// Chip rendering component
// ---------------------------------------------------------------------------

const variantStyles = {
  muted: { bg: '#2C2C2E', text: '#8E8E93' },
  amber: { bg: '#3A2A0A', text: '#FF9500' },
  neutral: { bg: '#1E2A1E', text: '#8E8E93' },
} as const;

export function MealChipRow({
  chips,
}: {
  chips: ChipConfig[];
}) {
  const [infoKey, setInfoKey] = useState<string | null>(null);

  if (chips.length === 0) return null;

  const activeInfo = infoKey ? CHIP_INFO[infoKey] : null;

  return (
    <>
      <View style={chipStyles.row}>
        {chips.map((chip) => {
          const vs = variantStyles[chip.variant];
          const tappable = chip.infoKey != null;
          return (
            <Pressable
              key={chip.label}
              style={[chipStyles.chip, { backgroundColor: vs.bg }]}
              onPress={tappable ? () => setInfoKey(chip.infoKey) : undefined}
              disabled={!tappable}
              hitSlop={4}
            >
              <Text style={[chipStyles.chipText, { color: vs.text }]}>
                {chip.label}
              </Text>
              {tappable && (
                <Text style={[chipStyles.infoIcon, { color: vs.text }]}>{'\u24D8'}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Info sheet modal — Section 8.3 chip tap behaviour */}
      <Modal
        visible={activeInfo != null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoKey(null)}
      >
        <Pressable style={chipStyles.overlay} onPress={() => setInfoKey(null)}>
          <View style={chipStyles.sheet}>
            <Text style={chipStyles.sheetTitle}>{activeInfo?.title}</Text>
            <Text style={chipStyles.sheetBody}>{activeInfo?.body}</Text>
            <Pressable style={chipStyles.sheetClose} onPress={() => setInfoKey(null)}>
              <Text style={chipStyles.sheetCloseText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  infoIcon: {
    fontSize: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONTS.semiBold,
  },
  sheetBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  sheetClose: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceRaised,
    marginTop: 4,
  },
  sheetCloseText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
});
