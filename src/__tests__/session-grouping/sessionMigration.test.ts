/**
 * Phase I — Data Migration for Existing Meals
 * Spec: Session Grouping Design Spec, Section 11 / Build Plan Phase I
 *
 * Tests cover:
 * - Idempotency (running twice = same result)
 * - Classification backfill for all existing meals
 * - matching_key computation for all existing meals
 * - Session re-evaluation against new overlap algorithm
 * - Audit trail (migration_reassigned events)
 * - Data preservation (glucose curves, original fields never lost)
 * - Edge cases: 0 meals, 1 meal, null carbs, no name
 * - Pre-migration backup + rollback
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  migrateToSessionGroupingV2,
  rollbackMigration,
  getMigrationStatus,
  MIGRATION_V2_KEY,
  BACKUP_MEALS_KEY,
  BACKUP_SESSIONS_KEY,
} from '../../services/sessionMigration';
import { STORAGE_KEYS } from '../../services/storage';
import type { Meal, Session, GlucoseResponse } from '../../services/storage';
import { getAllSessionEvents } from '../../services/sessionEventLog';

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMeal(overrides: Partial<Meal> & { id: string; name: string }): Meal {
  return {
    photoUri: null,
    insulinUnits: 2,
    startGlucose: 7.0,
    carbsEstimated: null,
    loggedAt: new Date('2026-04-20T12:00:00.000Z').toISOString(),
    sessionId: null,
    glucoseResponse: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> & { id: string; mealIds: string[] }): Session {
  return {
    startedAt: new Date('2026-04-20T12:00:00.000Z').toISOString(),
    confidence: 'high',
    glucoseResponse: null,
    ...overrides,
  };
}

const fakeGlucoseResponse: GlucoseResponse = {
  startGlucose: 6.5,
  peakGlucose: 10.2,
  timeToPeakMins: 45,
  totalRise: 3.7,
  endGlucose: 7.1,
  fallFromPeak: 3.1,
  timeFromPeakToEndMins: 135,
  readings: [{ mmol: 6.5, date: Date.now() }],
  isPartial: false,
  fetchedAt: new Date().toISOString(),
};

async function seedMeals(meals: Meal[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(meals));
}

async function seedSessions(sessions: Session[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
}

async function loadMeals(): Promise<Meal[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
  return raw ? JSON.parse(raw) : [];
}

async function loadSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS);
  return raw ? JSON.parse(raw) : [];
}

// ---------------------------------------------------------------------------
// 1. Zero meals — no-op
// ---------------------------------------------------------------------------

describe('Migration — edge case: 0 meals', () => {
  test('migration with 0 meals is a no-op', async () => {
    const report = await migrateToSessionGroupingV2();

    expect(report.mealsClassified).toBe(0);
    expect(report.sessionsCreated).toBe(0);
    expect(report.sessionsDissolved).toBe(0);
    expect(report.sessionsUnchanged).toBe(0);
    expect(report.errors).toHaveLength(0);
  });

  test('migration with 0 meals still sets the idempotency flag', async () => {
    await migrateToSessionGroupingV2();
    const status = await getMigrationStatus();
    expect(status.completed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Single meal — classification only, no session changes
// ---------------------------------------------------------------------------

describe('Migration — single meal', () => {
  test('single meal gets classified with correct fields', async () => {
    await seedMeals([
      makeMeal({ id: 'meal-1', name: 'chicken dinner', carbsEstimated: 45, loggedAt: '2026-04-20T18:00:00.000Z' }),
    ]);

    const report = await migrateToSessionGroupingV2();
    expect(report.mealsClassified).toBe(1);

    const meals = await loadMeals();
    const meal = meals[0];
    expect(meal.classificationBucket).toBe('mixed_meal');
    expect(meal.classificationMethod).toBe('carb_bucket');
    expect(meal.digestionWindowMinutes).toBe(180);
    expect(meal.matchingKey).toBe('chicken dinner');
    expect(meal.matchingKeyVersion).toBe(1);
    expect(meal.classificationSnapshot).toBe('mixed_meal');
    expect(meal.classificationKeywordsVersion).toBeTruthy();
  });

  test('single meal creates no sessions', async () => {
    await seedMeals([
      makeMeal({ id: 'meal-1', name: 'apple', carbsEstimated: 10 }),
    ]);

    const report = await migrateToSessionGroupingV2();
    expect(report.sessionsCreated).toBe(0);
    expect(report.sessionsDissolved).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Null carbs — fallback classification
// ---------------------------------------------------------------------------

describe('Migration — null carbs fallback', () => {
  test('meal with null carbs gets fallback classification', async () => {
    await seedMeals([
      makeMeal({ id: 'meal-1', name: 'mystery stew', carbsEstimated: null }),
    ]);

    await migrateToSessionGroupingV2();

    const meals = await loadMeals();
    expect(meals[0].classificationBucket).toBe('mixed_meal');
    expect(meals[0].classificationMethod).toBe('fallback');
    expect(meals[0].digestionWindowMinutes).toBe(180);
  });
});

// ---------------------------------------------------------------------------
// 4. Override keyword classification
// ---------------------------------------------------------------------------

describe('Migration — override keyword', () => {
  test('meal with override keyword gets correct classification', async () => {
    await seedMeals([
      makeMeal({ id: 'meal-1', name: 'pizza margherita', carbsEstimated: 60 }),
    ]);

    await migrateToSessionGroupingV2();

    const meals = await loadMeals();
    expect(meals[0].classificationBucket).toBe('fat_heavy');
    expect(meals[0].classificationMethod).toBe('override_keyword');
    expect(meals[0].classificationMatchedKeyword).toBe('pizza');
    expect(meals[0].digestionWindowMinutes).toBe(240);
  });
});

// ---------------------------------------------------------------------------
// 5. Data preservation — glucose curves + original fields never lost
// ---------------------------------------------------------------------------

describe('Migration — data preservation', () => {
  test('glucose curves are preserved after migration', async () => {
    await seedMeals([
      makeMeal({
        id: 'meal-1',
        name: 'chips',
        carbsEstimated: 40,
        glucoseResponse: fakeGlucoseResponse,
      }),
    ]);

    await migrateToSessionGroupingV2();

    const meals = await loadMeals();
    expect(meals[0].glucoseResponse).toEqual(fakeGlucoseResponse);
  });

  test('original meal fields are preserved (name, carbs, insulin, loggedAt, photoUri)', async () => {
    const original = makeMeal({
      id: 'meal-1',
      name: 'chicken tikka masala',
      carbsEstimated: 55,
      insulinUnits: 4,
      loggedAt: '2026-04-20T19:30:00.000Z',
      photoUri: 'file:///photo.jpg',
      startGlucose: 8.5,
    });
    await seedMeals([original]);

    await migrateToSessionGroupingV2();

    const meals = await loadMeals();
    const m = meals[0];
    expect(m.name).toBe(original.name);
    expect(m.carbsEstimated).toBe(original.carbsEstimated);
    expect(m.insulinUnits).toBe(original.insulinUnits);
    expect(m.loggedAt).toBe(original.loggedAt);
    expect(m.photoUri).toBe(original.photoUri);
    expect(m.startGlucose).toBe(original.startGlucose);
    expect(m.id).toBe(original.id);
  });
});

// ---------------------------------------------------------------------------
// 6. Idempotency — running twice produces same result
// ---------------------------------------------------------------------------

describe('Migration — idempotency', () => {
  test('running migration twice produces identical results', async () => {
    await seedMeals([
      makeMeal({ id: 'meal-1', name: 'apple', carbsEstimated: 10, loggedAt: '2026-04-20T14:00:00.000Z' }),
      makeMeal({ id: 'meal-2', name: 'biscuit', carbsEstimated: 15, loggedAt: '2026-04-20T14:30:00.000Z' }),
    ]);

    const report1 = await migrateToSessionGroupingV2();
    expect(report1.mealsClassified).toBe(2);

    const mealsAfterFirst = await loadMeals();
    const sessionsAfterFirst = await loadSessions();

    // Clear the flag so we can run again
    await AsyncStorage.removeItem(MIGRATION_V2_KEY);

    const report2 = await migrateToSessionGroupingV2();

    const mealsAfterSecond = await loadMeals();
    const sessionsAfterSecond = await loadSessions();

    // Meal classification should be identical
    for (let i = 0; i < mealsAfterFirst.length; i++) {
      expect(mealsAfterSecond[i].classificationBucket).toBe(mealsAfterFirst[i].classificationBucket);
      expect(mealsAfterSecond[i].matchingKey).toBe(mealsAfterFirst[i].matchingKey);
      expect(mealsAfterSecond[i].digestionWindowMinutes).toBe(mealsAfterFirst[i].digestionWindowMinutes);
    }

    // Session count should be the same
    expect(sessionsAfterSecond.length).toBe(sessionsAfterFirst.length);
  });

  test('migration is skipped when idempotency flag is set', async () => {
    await seedMeals([
      makeMeal({ id: 'meal-1', name: 'apple', carbsEstimated: 10 }),
    ]);

    await migrateToSessionGroupingV2(); // first run

    // Second run should be a no-op
    const report = await migrateToSessionGroupingV2();
    expect(report.mealsClassified).toBe(0);
    expect(report.skipped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Session re-evaluation — legacy sessions dissolve if no overlap
// ---------------------------------------------------------------------------

describe('Migration — session re-evaluation', () => {
  test('legacy session dissolves when meals do not overlap under new algorithm', async () => {
    // Two meals 4 hours apart — current V1 grouped them within 3hr window
    // Under V2, chicken dinner is mixed_meal (primary=135min=2h15m)
    // meal-1 at 12:00, primary ends at 14:15
    // meal-2 at 16:00 — well outside primary window → should NOT be in same session
    const meals = [
      makeMeal({ id: 'meal-1', name: 'chicken dinner', carbsEstimated: 45, loggedAt: '2026-04-20T12:00:00.000Z', sessionId: 'legacy-sess-1' }),
      makeMeal({ id: 'meal-2', name: 'pasta', carbsEstimated: 50, loggedAt: '2026-04-20T16:00:00.000Z', sessionId: 'legacy-sess-1' }),
    ];
    await seedMeals(meals);
    await seedSessions([
      makeSession({ id: 'legacy-sess-1', mealIds: ['meal-1', 'meal-2'], startedAt: '2026-04-20T12:00:00.000Z' }),
    ]);

    const report = await migrateToSessionGroupingV2();
    expect(report.sessionsDissolved).toBeGreaterThanOrEqual(1);

    const updatedMeals = await loadMeals();
    // Both should now be solo (no sessionId)
    expect(updatedMeals.find(m => m.id === 'meal-1')?.sessionId).toBeNull();
    expect(updatedMeals.find(m => m.id === 'meal-2')?.sessionId).toBeNull();
  });

  test('meals that overlap under new algorithm get grouped into a session', async () => {
    // Two solo meals within overlap window
    // apple (simple_snack, primary=67.5min) at 14:00, primary ends 15:07:30
    // biscuit (simple_snack) at 14:30 — within apple's primary → should create session
    const meals = [
      makeMeal({ id: 'meal-1', name: 'apple', carbsEstimated: 10, loggedAt: '2026-04-20T14:00:00.000Z', sessionId: null }),
      makeMeal({ id: 'meal-2', name: 'biscuit', carbsEstimated: 15, loggedAt: '2026-04-20T14:30:00.000Z', sessionId: null }),
    ];
    await seedMeals(meals);

    const report = await migrateToSessionGroupingV2();
    expect(report.sessionsCreated).toBeGreaterThanOrEqual(1);

    const updatedMeals = await loadMeals();
    const m1 = updatedMeals.find(m => m.id === 'meal-1');
    const m2 = updatedMeals.find(m => m.id === 'meal-2');
    expect(m1?.sessionId).toBeTruthy();
    expect(m1?.sessionId).toBe(m2?.sessionId);
  });

  test('existing valid session is preserved when meals still overlap', async () => {
    // Two meals 30 min apart — should remain in same session under new algorithm
    // chips (fat_heavy, primary=180min=3hr) at 12:00, primary ends 15:00
    // biscuit at 12:30 — within primary → session preserved
    const meals = [
      makeMeal({ id: 'meal-1', name: 'chips', carbsEstimated: 40, loggedAt: '2026-04-20T12:00:00.000Z', sessionId: 'sess-1' }),
      makeMeal({ id: 'meal-2', name: 'biscuit', carbsEstimated: 15, loggedAt: '2026-04-20T12:30:00.000Z', sessionId: 'sess-1' }),
    ];
    await seedMeals(meals);
    await seedSessions([
      makeSession({ id: 'sess-1', mealIds: ['meal-1', 'meal-2'], startedAt: '2026-04-20T12:00:00.000Z' }),
    ]);

    const report = await migrateToSessionGroupingV2();

    // Should not dissolve the session (meals still overlap)
    const updatedMeals = await loadMeals();
    const m1 = updatedMeals.find(m => m.id === 'meal-1');
    const m2 = updatedMeals.find(m => m.id === 'meal-2');
    // Both should still have a session (could be same or new ID due to rebuild)
    expect(m1?.sessionId).toBeTruthy();
    expect(m1?.sessionId).toBe(m2?.sessionId);
  });
});

// ---------------------------------------------------------------------------
// 8. Audit trail — migration_reassigned events
// ---------------------------------------------------------------------------

describe('Migration — audit trail', () => {
  test('session membership changes are logged with migration_reassigned', async () => {
    // A session that should dissolve → audit trail captures it
    const meals = [
      makeMeal({ id: 'meal-1', name: 'toast', carbsEstimated: 20, loggedAt: '2026-04-20T08:00:00.000Z', sessionId: 'old-sess' }),
      makeMeal({ id: 'meal-2', name: 'lunch', carbsEstimated: 45, loggedAt: '2026-04-20T14:00:00.000Z', sessionId: 'old-sess' }),
    ];
    await seedMeals(meals);
    await seedSessions([
      makeSession({ id: 'old-sess', mealIds: ['meal-1', 'meal-2'], startedAt: '2026-04-20T08:00:00.000Z' }),
    ]);

    await migrateToSessionGroupingV2();

    const events = await getAllSessionEvents();
    const migrationEvents = events.filter(e => e.eventType === 'migration_reassigned');
    expect(migrationEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Pre-migration backup + rollback
// ---------------------------------------------------------------------------

describe('Migration — backup + rollback', () => {
  test('pre-migration backup is created before any changes', async () => {
    const originalMeals = [
      makeMeal({ id: 'meal-1', name: 'apple', carbsEstimated: 10 }),
    ];
    await seedMeals(originalMeals);

    await migrateToSessionGroupingV2();

    // Backup should exist
    const backupMeals = await AsyncStorage.getItem(BACKUP_MEALS_KEY);
    expect(backupMeals).toBeTruthy();
    const parsed = JSON.parse(backupMeals!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('meal-1');
    // Backup should NOT have V2 fields (it's the pre-migration state)
    expect(parsed[0].classificationBucket).toBeUndefined();
  });

  test('rollback restores original data after migration', async () => {
    const originalMeals = [
      makeMeal({ id: 'meal-1', name: 'apple', carbsEstimated: 10, glucoseResponse: fakeGlucoseResponse }),
    ];
    await seedMeals(originalMeals);
    await seedSessions([]);

    await migrateToSessionGroupingV2();

    // Verify migration happened
    let meals = await loadMeals();
    expect(meals[0].classificationBucket).toBe('simple_snack');

    // Now rollback
    const rollbackResult = await rollbackMigration();
    expect(rollbackResult.success).toBe(true);

    // Meals should be back to original (no V2 fields)
    meals = await loadMeals();
    expect(meals[0].classificationBucket).toBeUndefined();
    expect(meals[0].glucoseResponse).toEqual(fakeGlucoseResponse);

    // Migration flag should be cleared
    const status = await getMigrationStatus();
    expect(status.completed).toBe(false);
  });

  test('rollback fails gracefully if no backup exists', async () => {
    const result = await rollbackMigration();
    expect(result.success).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 10. Already classified meals are not re-classified
// ---------------------------------------------------------------------------

describe('Migration — skip already classified', () => {
  test('meals with existing V2 fields are not re-classified', async () => {
    await seedMeals([
      makeMeal({
        id: 'meal-1',
        name: 'apple',
        carbsEstimated: 10,
        classificationBucket: 'simple_snack',
        classificationMethod: 'carb_bucket',
        digestionWindowMinutes: 90,
        matchingKey: 'apple',
        matchingKeyVersion: 1,
        classificationSnapshot: 'simple_snack',
        classificationKeywordsVersion: '1',
      }),
    ]);

    const report = await migrateToSessionGroupingV2();
    // Already classified → should not count as "classified"
    expect(report.mealsClassified).toBe(0);
    expect(report.mealsAlreadyClassified).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 11. Empty name handling
// ---------------------------------------------------------------------------

describe('Migration — empty name', () => {
  test('meal with empty name gets fallback classification', async () => {
    await seedMeals([
      makeMeal({ id: 'meal-1', name: '', carbsEstimated: 20 }),
    ]);

    await migrateToSessionGroupingV2();

    const meals = await loadMeals();
    // Empty name with 20g carbs → simple_snack via carb_bucket
    expect(meals[0].classificationBucket).toBe('simple_snack');
    expect(meals[0].classificationMethod).toBe('carb_bucket');
    expect(meals[0].matchingKey).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 12. Mixed scenario — multiple meals, some in sessions, some solo
// ---------------------------------------------------------------------------

describe('Migration — mixed scenario', () => {
  test('complex migration: solo meals + legacy sessions + overlaps', async () => {
    const meals = [
      // Solo meal — should get classified
      makeMeal({ id: 'meal-1', name: 'banana', carbsEstimated: 25, loggedAt: '2026-04-20T08:00:00.000Z', sessionId: null }),
      // Legacy session: 2 meals far apart — should dissolve
      makeMeal({ id: 'meal-2', name: 'toast', carbsEstimated: 20, loggedAt: '2026-04-20T12:00:00.000Z', sessionId: 'old-sess' }),
      makeMeal({ id: 'meal-3', name: 'pasta', carbsEstimated: 50, loggedAt: '2026-04-20T16:00:00.000Z', sessionId: 'old-sess' }),
      // Two close meals that should end up in a session
      makeMeal({ id: 'meal-4', name: 'apple', carbsEstimated: 10, loggedAt: '2026-04-20T19:00:00.000Z', sessionId: null }),
      makeMeal({ id: 'meal-5', name: 'biscuit', carbsEstimated: 15, loggedAt: '2026-04-20T19:30:00.000Z', sessionId: null }),
    ];
    await seedMeals(meals);
    await seedSessions([
      makeSession({ id: 'old-sess', mealIds: ['meal-2', 'meal-3'], startedAt: '2026-04-20T12:00:00.000Z' }),
    ]);

    const report = await migrateToSessionGroupingV2();

    // All 5 meals should be classified
    expect(report.mealsClassified).toBe(5);
    expect(report.errors).toHaveLength(0);

    const updatedMeals = await loadMeals();

    // meal-1 (banana): solo, simple_snack
    const m1 = updatedMeals.find(m => m.id === 'meal-1')!;
    expect(m1.classificationBucket).toBe('simple_snack');
    expect(m1.sessionId).toBeNull();

    // meal-2 + meal-3: far apart, should be dissolved from old-sess
    const m2 = updatedMeals.find(m => m.id === 'meal-2')!;
    const m3 = updatedMeals.find(m => m.id === 'meal-3')!;
    // toast at 12:00 (simple_snack primary=67.5min, ends 13:07:30)
    // pasta at 16:00 — way outside → should be solo
    expect(m2.sessionId).toBeNull();
    expect(m3.sessionId).toBeNull();

    // meal-4 + meal-5: apple 19:00 + biscuit 19:30 → should overlap and create session
    const m4 = updatedMeals.find(m => m.id === 'meal-4')!;
    const m5 = updatedMeals.find(m => m.id === 'meal-5')!;
    expect(m4.sessionId).toBeTruthy();
    expect(m4.sessionId).toBe(m5.sessionId);

    // Old session should be dissolved
    expect(report.sessionsDissolved).toBeGreaterThanOrEqual(1);
    // New session should be created for meal-4+5
    expect(report.sessionsCreated).toBeGreaterThanOrEqual(1);
  });
});
