/**
 * TDD tests for MealChips logic — Phase J (Session Grouping Spec Section 8.3).
 *
 * Tests the pure function getMealChips() that determines which chips to show
 * on a meal history card based on confidence, contamination, and curve state.
 *
 * Uses logic-level checks (no React renderer) consistent with project pattern.
 * @see Section 8.3 of the Session Grouping Design Spec for canonical labels.
 */

import type { Meal, Session } from '../services/storage';
import { getMealChips, CHIP_INFO, type ChipConfig } from './MealChips';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    name: 'Toast',
    photoUri: null,
    insulinUnits: 3,
    startGlucose: 6.5,
    carbsEstimated: 30,
    loggedAt: new Date().toISOString(),
    sessionId: null,
    glucoseResponse: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    mealIds: ['meal-1', 'meal-2'],
    startedAt: new Date().toISOString(),
    confidence: 'high',
    glucoseResponse: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chipLabels(chips: ChipConfig[]): string[] {
  return chips.map(c => c.label);
}

function chipVariants(chips: ChipConfig[]): string[] {
  return chips.map(c => c.variant);
}

// ---------------------------------------------------------------------------
// Solo meal, HIGH confidence — clean card (no chips)
// ---------------------------------------------------------------------------

describe('getMealChips: solo HIGH confidence', () => {
  it('returns no chips for a HIGH confidence solo meal', () => {
    const meal = makeMeal({
      classificationMethod: 'carb_bucket',
      cgmCoveragePercent: 90,
    });
    expect(getMealChips(meal, null)).toEqual([]);
  });

  it('returns no chips when V2 fields are absent (V1 rollback safe)', () => {
    const meal = makeMeal();
    // V1 meal has no classification fields at all
    expect(getMealChips(meal, null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Solo meal, MEDIUM confidence
// ---------------------------------------------------------------------------

describe('getMealChips: solo MEDIUM confidence', () => {
  it('shows "Carbs estimated" for fallback classification', () => {
    const meal = makeMeal({
      classificationMethod: 'fallback',
      cgmCoveragePercent: 85,
    });
    const chips = getMealChips(meal, null);
    expect(chipLabels(chips)).toContain('Carbs estimated');
    expect(chips.find(c => c.label === 'Carbs estimated')!.variant).toBe('muted');
  });

  it('shows "Limited sensor data" for CGM coverage 50-80%', () => {
    const meal = makeMeal({
      classificationMethod: 'carb_bucket',
      cgmCoveragePercent: 65,
    });
    const chips = getMealChips(meal, null);
    expect(chipLabels(chips)).toContain('Limited sensor data');
    expect(chips.find(c => c.label === 'Limited sensor data')!.variant).toBe('muted');
  });

  it('shows both chips when fallback AND limited CGM', () => {
    const meal = makeMeal({
      classificationMethod: 'fallback',
      cgmCoveragePercent: 60,
    });
    const chips = getMealChips(meal, null);
    expect(chipLabels(chips)).toContain('Carbs estimated');
    expect(chipLabels(chips)).toContain('Limited sensor data');
  });
});

// ---------------------------------------------------------------------------
// Solo meal, LOW confidence
// ---------------------------------------------------------------------------

describe('getMealChips: solo LOW confidence', () => {
  it('shows "Sensor data incomplete" amber chip for CGM < 50%', () => {
    const meal = makeMeal({
      classificationMethod: 'carb_bucket',
      cgmCoveragePercent: 30,
    });
    const chips = getMealChips(meal, null);
    expect(chipLabels(chips)).toContain('Sensor data incomplete');
    const chip = chips.find(c => c.label === 'Sensor data incomplete')!;
    expect(chip.variant).toBe('amber');
    expect(chip.infoKey).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Session member
// ---------------------------------------------------------------------------

describe('getMealChips: session member', () => {
  it('shows "Eaten alongside other food" for a session member', () => {
    const meal = makeMeal({ sessionId: 'session-1' });
    const session = makeSession();
    const chips = getMealChips(meal, session);
    expect(chipLabels(chips)).toContain('Eaten alongside other food');
    expect(chips.find(c => c.label === 'Eaten alongside other food')!.variant).toBe('muted');
  });

  it('does NOT show solo confidence chips for session members', () => {
    // Session members show "Eaten alongside other food" instead of solo confidence chips
    const meal = makeMeal({
      sessionId: 'session-1',
      classificationMethod: 'fallback',
      cgmCoveragePercent: 40,
    });
    const session = makeSession();
    const chips = getMealChips(meal, session);
    expect(chipLabels(chips)).not.toContain('Carbs estimated');
    expect(chipLabels(chips)).not.toContain('Sensor data incomplete');
    expect(chipLabels(chips)).toContain('Eaten alongside other food');
  });
});

// ---------------------------------------------------------------------------
// Contamination flags (session-level, shown on member cards)
// ---------------------------------------------------------------------------

describe('getMealChips: contamination flags', () => {
  it('shows "Correction taken during this meal" when session curveCorrected', () => {
    const meal = makeMeal({ sessionId: 'session-1' });
    const session = makeSession({ curveCorrected: true });
    const chips = getMealChips(meal, session);
    expect(chipLabels(chips)).toContain('Correction taken during this meal');
    const chip = chips.find(c => c.label === 'Correction taken during this meal')!;
    expect(chip.variant).toBe('amber');
    expect(chip.infoKey).not.toBeNull();
  });

  it('shows "Hypo treated during this meal" when session hypoDuringSession', () => {
    const meal = makeMeal({ sessionId: 'session-1' });
    const session = makeSession({ hypoDuringSession: true });
    const chips = getMealChips(meal, session);
    expect(chipLabels(chips)).toContain('Hypo treated during this meal');
    const chip = chips.find(c => c.label === 'Hypo treated during this meal')!;
    expect(chip.variant).toBe('amber');
    expect(chip.infoKey).not.toBeNull();
  });

  it('does not show contamination flags when session flags are false/absent', () => {
    const meal = makeMeal({ sessionId: 'session-1' });
    const session = makeSession({ curveCorrected: false, hypoDuringSession: false });
    const chips = getMealChips(meal, session);
    expect(chipLabels(chips)).not.toContain('Correction taken during this meal');
    expect(chipLabels(chips)).not.toContain('Hypo treated during this meal');
  });
});

// ---------------------------------------------------------------------------
// Curve characteristics (meal-level)
// ---------------------------------------------------------------------------

describe('getMealChips: curve characteristics', () => {
  it('shows "Glucose still high at window end" when endedElevated', () => {
    const meal = makeMeal({ endedElevated: true });
    const chips = getMealChips(meal, null);
    expect(chipLabels(chips)).toContain('Glucose still high at window end');
    const chip = chips.find(c => c.label === 'Glucose still high at window end')!;
    expect(chip.variant).toBe('neutral');
    expect(chip.infoKey).not.toBeNull();
  });

  it('shows "Glucose low at window end" when endedLow', () => {
    const meal = makeMeal({ endedLow: true });
    const chips = getMealChips(meal, null);
    expect(chipLabels(chips)).toContain('Glucose low at window end');
    const chip = chips.find(c => c.label === 'Glucose low at window end')!;
    expect(chip.variant).toBe('neutral');
    expect(chip.infoKey).not.toBeNull();
  });

  it('does not show curve chips when flags are false/absent', () => {
    const meal = makeMeal({ endedElevated: false, endedLow: false });
    const chips = getMealChips(meal, null);
    expect(chipLabels(chips)).not.toContain('Glucose still high at window end');
    expect(chipLabels(chips)).not.toContain('Glucose low at window end');
  });
});

// ---------------------------------------------------------------------------
// Combined scenarios
// ---------------------------------------------------------------------------

describe('getMealChips: combined scenarios', () => {
  it('session member with correction and ended elevated shows all 3 chips', () => {
    const meal = makeMeal({ sessionId: 'session-1', endedElevated: true });
    const session = makeSession({ curveCorrected: true });
    const chips = getMealChips(meal, session);
    expect(chipLabels(chips)).toContain('Eaten alongside other food');
    expect(chipLabels(chips)).toContain('Correction taken during this meal');
    expect(chipLabels(chips)).toContain('Glucose still high at window end');
    expect(chips).toHaveLength(3);
  });

  it('solo HIGH with ended_elevated shows only the curve chip', () => {
    const meal = makeMeal({
      classificationMethod: 'carb_bucket',
      cgmCoveragePercent: 90,
      endedElevated: true,
    });
    const chips = getMealChips(meal, null);
    expect(chips).toHaveLength(1);
    expect(chipLabels(chips)).toEqual(['Glucose still high at window end']);
  });

  it('solo LOW with ended_low shows both chips', () => {
    const meal = makeMeal({
      cgmCoveragePercent: 20,
      endedLow: true,
    });
    const chips = getMealChips(meal, null);
    expect(chipLabels(chips)).toContain('Sensor data incomplete');
    expect(chipLabels(chips)).toContain('Glucose low at window end');
  });
});

// ---------------------------------------------------------------------------
// Info sheet content — spec Section 8.3 copy audit
// ---------------------------------------------------------------------------

describe('CHIP_INFO: info sheet content', () => {
  const bannedWords = ['recommend', 'should', 'try', 'suggested', 'expected', 'predict', 'advice'];

  it('has entries for all tappable chip types', () => {
    expect(CHIP_INFO['sensor_incomplete']).toBeDefined();
    expect(CHIP_INFO['curve_corrected']).toBeDefined();
    expect(CHIP_INFO['hypo_during']).toBeDefined();
    expect(CHIP_INFO['ended_elevated']).toBeDefined();
    expect(CHIP_INFO['ended_low']).toBeDefined();
  });

  it('contains no predictive or advisory language in any info sheet', () => {
    for (const [key, info] of Object.entries(CHIP_INFO)) {
      const combined = `${info.title} ${info.body}`.toLowerCase();
      for (const word of bannedWords) {
        expect(combined).not.toContain(word);
        // Provide clear error message if it fails
        if (combined.includes(word)) {
          throw new Error(`CHIP_INFO['${key}'] contains banned word "${word}"`);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Session row formatting — spec Section 8.1
// ---------------------------------------------------------------------------

describe('formatSessionRow', () => {
  // Import will be from SessionSubHeader after update
  // For now, test the pure logic

  it('formats with total carbs and peak glucose', () => {
    const { formatSessionRowText } = require('./MealChips');
    const result = formatSessionRowText({
      totalCarbs: 60,
      peakGlucose: 12.1,
      peakTime: '2026-04-22T13:30:00.000Z',
    });
    expect(result).toContain('Eaten alongside other food');
    expect(result).toContain('60g');
    expect(result).toContain('12.1');
  });

  it('omits carbs segment when totalCarbs is null', () => {
    const { formatSessionRowText } = require('./MealChips');
    const result = formatSessionRowText({
      totalCarbs: null,
      peakGlucose: 12.1,
      peakTime: '2026-04-22T13:30:00.000Z',
    });
    expect(result).toContain('Eaten alongside other food');
    expect(result).not.toContain('carbs');
  });

  it('omits peak segment when peakGlucose is null', () => {
    const { formatSessionRowText } = require('./MealChips');
    const result = formatSessionRowText({
      totalCarbs: 60,
      peakGlucose: null,
      peakTime: null,
    });
    expect(result).toContain('60g');
    expect(result).not.toContain('peak');
  });

  it('contains no predictive language', () => {
    const { formatSessionRowText } = require('./MealChips');
    const bannedWords = ['recommend', 'should', 'try', 'suggested', 'expected', 'predict', 'advice'];
    const result = formatSessionRowText({
      totalCarbs: 60,
      peakGlucose: 12.1,
      peakTime: '2026-04-22T13:30:00.000Z',
    });
    const lower = result.toLowerCase();
    for (const word of bannedWords) {
      expect(lower).not.toContain(word);
    }
  });
});
