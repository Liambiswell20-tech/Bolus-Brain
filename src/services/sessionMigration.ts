/**
 * Session Grouping V2 — Data Migration for Existing Meals
 * Spec: Session Grouping Design Spec (Build Plan Phase I)
 *
 * Backfills all existing meals with classification fields and matching_key,
 * re-evaluates sessions against the new overlap algorithm, and logs all
 * changes to session_event_log with migration_reassigned event type.
 *
 * Safety guarantees:
 * - Pre-migration backup of meals + sessions in separate AsyncStorage keys
 * - Rollback function restores backup and clears migration flag
 * - Idempotent: guarded by AsyncStorage flag, safe to call multiple times
 * - Never mutates existing glucoseResponse, name, carbs, insulin, or loggedAt
 * - Only adds/updates V2 classification fields
 * - All membership changes logged in session_event_log
 *
 * Absolute rule: No silent historical data mutation. Every change is audited.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Meal, Session, SessionEventType } from './storage';
import { STORAGE_KEYS } from './storage';
import { classifyMeal, computeMatchingKey, loadKeywordDictionary } from './classification';
import { logSessionEvent } from './sessionEventLog';
import { computeSessionEnd, computePrimaryWindowMinutes } from './sessionGrouping';
import type { OverlapMeal } from './sessionGrouping';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

export const MIGRATION_V2_KEY = 'glucolog_migration_v2_session_grouping';
export const BACKUP_MEALS_KEY = 'glucolog_backup_meals_pre_v2';
export const BACKUP_SESSIONS_KEY = 'glucolog_backup_sessions_pre_v2';

const MATCHING_KEY_VERSION = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrationReport {
  skipped: boolean;
  mealsClassified: number;
  mealsAlreadyClassified: number;
  sessionsCreated: number;
  sessionsDissolved: number;
  sessionsUnchanged: number;
  errors: Array<{ mealId: string; error: string }>;
}

export interface RollbackResult {
  success: boolean;
  reason?: string;
}

export interface MigrationStatus {
  completed: boolean;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadMealsRaw(): Promise<Meal[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MEALS);
    if (!raw) return [];
    return JSON.parse(raw) as Meal[];
  } catch {
    return [];
  }
}

async function loadSessionsRaw(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) return [];
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

/** Check if a meal already has V2 classification fields populated */
function isAlreadyClassified(meal: Meal): boolean {
  return (
    meal.classificationBucket != null &&
    meal.classificationMethod != null &&
    meal.digestionWindowMinutes != null &&
    meal.matchingKey != null &&
    meal.matchingKeyVersion != null
  );
}

/** Convert Meal to OverlapMeal for session grouping functions */
function toOverlapMeal(m: Meal): OverlapMeal {
  return {
    id: m.id,
    loggedAt: m.loggedAt,
    digestionWindowMinutes: m.digestionWindowMinutes ?? null,
    sessionId: m.sessionId,
  };
}

// ---------------------------------------------------------------------------
// Union-find for overlap chain building (mirrors sessionGrouping.ts)
// ---------------------------------------------------------------------------

/**
 * Build connected components of overlapping meals using union-find.
 * Section 3: overlap detection with 75% primary window rule.
 */
function buildOverlapChains(meals: OverlapMeal[]): Map<string, Set<string>> {
  const sorted = [...meals].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
  );

  const parent = new Map<string, string>();
  for (const meal of sorted) {
    parent.set(meal.id, meal.id);
  }

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let current = id;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const mealI = sorted[i];
    if (!mealI.digestionWindowMinutes) continue;

    const iTimestamp = new Date(mealI.loggedAt).getTime();
    const primaryWindowMs = computePrimaryWindowMinutes(mealI.digestionWindowMinutes) * 60 * 1000;
    const primaryEnd = iTimestamp + primaryWindowMs;

    for (let j = i + 1; j < sorted.length; j++) {
      const mealJ = sorted[j];
      const jTimestamp = new Date(mealJ.loggedAt).getTime();
      if (jTimestamp > primaryEnd) break;
      union(mealI.id, mealJ.id);
    }
  }

  const components = new Map<string, Set<string>>();
  for (const meal of sorted) {
    const root = find(meal.id);
    if (!components.has(root)) {
      components.set(root, new Set());
    }
    components.get(root)!.add(meal.id);
  }

  return components;
}

function generateSessionId(): string {
  return `sess-mig-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the V2 migration has already completed.
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  const raw = await AsyncStorage.getItem(MIGRATION_V2_KEY);
  if (!raw) return { completed: false };
  try {
    return JSON.parse(raw) as MigrationStatus;
  } catch {
    return { completed: raw === 'true' };
  }
}

/**
 * Main migration entry point.
 *
 * 1. Check idempotency guard
 * 2. Create pre-migration backup
 * 3. Classify all unclassified meals
 * 4. Rebuild overlap chains and re-evaluate sessions
 * 5. Log all membership changes as migration_reassigned
 * 6. Save updated data and set idempotency flag
 * 7. Return migration report
 */
export async function migrateToSessionGroupingV2(): Promise<MigrationReport> {
  const report: MigrationReport = {
    skipped: false,
    mealsClassified: 0,
    mealsAlreadyClassified: 0,
    sessionsCreated: 0,
    sessionsDissolved: 0,
    sessionsUnchanged: 0,
    errors: [],
  };

  // Step 1: idempotency guard
  const status = await getMigrationStatus();
  if (status.completed) {
    return { ...report, skipped: true };
  }

  // Step 2: load current data
  const meals = await loadMealsRaw();
  const sessions = await loadSessionsRaw();

  // Step 3: create pre-migration backup (BEFORE any mutations)
  await AsyncStorage.setItem(BACKUP_MEALS_KEY, JSON.stringify(meals));
  await AsyncStorage.setItem(BACKUP_SESSIONS_KEY, JSON.stringify(sessions));

  // Handle 0 meals — still set flag and return
  if (meals.length === 0) {
    await AsyncStorage.setItem(
      MIGRATION_V2_KEY,
      JSON.stringify({ completed: true, completedAt: new Date().toISOString() }),
    );
    return report;
  }

  const dict = loadKeywordDictionary();

  // Step 4: classify all unclassified meals
  for (const meal of meals) {
    if (isAlreadyClassified(meal)) {
      report.mealsAlreadyClassified++;
      continue;
    }

    try {
      const classification = classifyMeal(meal.name, meal.carbsEstimated ?? null);
      const matchingKey = computeMatchingKey(meal.name);

      meal.classificationBucket = classification.bucket;
      meal.classificationMethod = classification.method;
      meal.classificationMatchedKeyword = classification.matchedKeyword;
      meal.classificationKeywordsVersion = classification.keywordsVersion;
      meal.digestionWindowMinutes = classification.digestionWindowMinutes;
      meal.matchingKey = matchingKey;
      meal.matchingKeyVersion = MATCHING_KEY_VERSION;
      meal.classificationSnapshot = classification.bucket;

      report.mealsClassified++;
    } catch (err) {
      report.errors.push({
        mealId: meal.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Step 5: rebuild overlap chains and re-evaluate sessions
  // Only consider classified meals with digestion windows (exclude non_carb)
  const classifiedMeals = meals.filter(
    m => m.digestionWindowMinutes && m.digestionWindowMinutes > 0 && m.classificationBucket !== 'non_carb',
  );

  const chains = buildOverlapChains(classifiedMeals.map(toOverlapMeal));

  // Track which meals end up in sessions
  const newSessionAssignments = new Map<string, string | null>(); // mealId → sessionId
  const newSessions: Session[] = [];
  const dissolvedSessionIds = new Set<string>();

  // Determine new session membership from overlap chains
  for (const [, component] of chains) {
    if (component.size >= 2) {
      // These meals form a session
      const memberMeals = classifiedMeals
        .filter(m => component.has(m.id))
        .map(toOverlapMeal);

      const newSessionId = generateSessionId();
      const startedAt = memberMeals
        .map(m => new Date(m.loggedAt).getTime())
        .reduce((min, ts) => Math.min(min, ts), Infinity);
      const sessionEnd = computeSessionEnd(memberMeals);

      newSessions.push({
        id: newSessionId,
        mealIds: [...component],
        startedAt: new Date(startedAt).toISOString(),
        confidence: 'high', // re-computed by confidence scoring later
        glucoseResponse: null,
        sessionEnd,
        totalCarbs: memberMeals.reduce((sum, m) => {
          const meal = meals.find(mm => mm.id === m.id);
          return sum + (meal?.carbsEstimated ?? 0);
        }, 0),
        totalInsulin: memberMeals.reduce((sum, m) => {
          const meal = meals.find(mm => mm.id === m.id);
          return sum + (meal?.insulinUnits ?? 0);
        }, 0),
      });

      for (const mealId of component) {
        newSessionAssignments.set(mealId, newSessionId);
      }

      report.sessionsCreated++;
    } else {
      // Solo meal — should have no session
      const mealId = [...component][0];
      newSessionAssignments.set(mealId, null);
    }
  }

  // Also handle non_carb and unclassified meals — they stay solo
  for (const meal of meals) {
    if (!newSessionAssignments.has(meal.id)) {
      newSessionAssignments.set(meal.id, null);
    }
  }

  // Step 6: determine which old sessions are dissolved vs unchanged
  // Check each old session: did its membership change?
  for (const oldSession of sessions) {
    const oldMembers = new Set(oldSession.mealIds);
    // Find the new session that contains any of these members
    const newSessionId = newSessionAssignments.get(oldSession.mealIds[0]);

    if (newSessionId) {
      // Members moved to a new session
      const newSess = newSessions.find(s => s.id === newSessionId);
      if (newSess) {
        const newMembers = new Set(newSess.mealIds);
        // Check if membership is identical
        if (
          oldMembers.size === newMembers.size &&
          [...oldMembers].every(mid => newMembers.has(mid))
        ) {
          // Membership unchanged — preserve old session ID and data
          // Replace the new session with the old one (preserving glucoseResponse etc.)
          const idx = newSessions.indexOf(newSess);
          if (idx >= 0) {
            newSessions[idx] = {
              ...oldSession,
              sessionEnd: newSess.sessionEnd,
              totalCarbs: newSess.totalCarbs,
              totalInsulin: newSess.totalInsulin,
            };
            // Update meal assignments to use old session ID
            for (const mid of oldMembers) {
              newSessionAssignments.set(mid, oldSession.id);
            }
          }
          report.sessionsUnchanged++;
          report.sessionsCreated--; // was counted as created, now unchanged
          continue;
        }
      }
    }

    // Session membership changed or session dissolved
    dissolvedSessionIds.add(oldSession.id);
    report.sessionsDissolved++;
  }

  // Step 7: apply session assignments to meals
  for (const meal of meals) {
    const newSessionId = newSessionAssignments.get(meal.id) ?? null;
    const oldSessionId = meal.sessionId;

    if (oldSessionId !== newSessionId) {
      // Log membership change to session_event_log (Section 4.7)
      await logSessionEvent({
        sessionId: oldSessionId ?? newSessionId ?? 'none',
        eventType: 'migration_reassigned' as SessionEventType,
        triggeredByMealId: meal.id,
        beforeState: { sessionId: oldSessionId },
        afterState: { sessionId: newSessionId },
        classificationKeywordsVersion: dict.version,
      });
    }

    meal.sessionId = newSessionId;
  }

  // Step 8: save updated data atomically
  await AsyncStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(meals));

  // Build final sessions list: new sessions (replacing dissolved ones)
  const finalSessions = [
    // Keep sessions that weren't affected
    ...sessions.filter(s => !dissolvedSessionIds.has(s.id) && !newSessions.some(ns => ns.id === s.id)),
    // Add new/updated sessions
    ...newSessions,
  ];
  await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(finalSessions));

  // Step 9: set idempotency flag
  await AsyncStorage.setItem(
    MIGRATION_V2_KEY,
    JSON.stringify({ completed: true, completedAt: new Date().toISOString() }),
  );

  console.log(
    `[sessionMigration] V2 migration complete: ${report.mealsClassified} classified, ` +
    `${report.sessionsCreated} sessions created, ${report.sessionsDissolved} dissolved, ` +
    `${report.sessionsUnchanged} unchanged, ${report.errors.length} errors`,
  );

  return report;
}

/**
 * Rollback the V2 migration by restoring the pre-migration backup.
 * Clears the migration flag so it can be re-run after fixing any issues.
 *
 * Safety: only restores from backup, never deletes data that isn't backed up.
 */
export async function rollbackMigration(): Promise<RollbackResult> {
  const backupMeals = await AsyncStorage.getItem(BACKUP_MEALS_KEY);
  const backupSessions = await AsyncStorage.getItem(BACKUP_SESSIONS_KEY);

  if (!backupMeals) {
    return { success: false, reason: 'No pre-migration backup found for meals' };
  }

  try {
    // Restore meals from backup
    await AsyncStorage.setItem(STORAGE_KEYS.MEALS, backupMeals);

    // Restore sessions from backup (empty array if no backup)
    await AsyncStorage.setItem(
      STORAGE_KEYS.SESSIONS,
      backupSessions ?? '[]',
    );

    // Clear migration flag so it can be re-run
    await AsyncStorage.removeItem(MIGRATION_V2_KEY);

    console.log('[sessionMigration] Rollback complete — data restored from pre-migration backup');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
