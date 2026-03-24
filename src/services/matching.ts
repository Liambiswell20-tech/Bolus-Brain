import { getMealFingerprint } from '../utils/mealFingerprint';
import { SessionWithMeals } from './storage';

export interface SessionMatch {
  session: SessionWithMeals;
  score: number; // 0–1 insulin similarity score
}

export interface MatchSummary {
  matches: SessionMatch[];
  avgRise: number;       // average totalRise across matched sessions
  avgPeak: number;       // average peakGlucose
  avgTimeToPeak: number; // average timeToPeakMins
}

const MAX_MATCHES = 5;

// Insulin units within this tolerance are considered "similar"
const INSULIN_TOLERANCE_UNITS = 2;

/**
 * Canonical fingerprint for an entire session (all meals combined).
 * Multi-meal sessions: join all names, fingerprint the result.
 * "Chicken pasta" + "salad" → getMealFingerprint("Chicken pasta salad")
 */
function sessionFingerprint(session: SessionWithMeals): string {
  return getMealFingerprint(session.meals.map(m => m.name).join(' '));
}

function totalInsulin(session: SessionWithMeals): number {
  return session.meals.reduce((sum, m) => sum + (m.insulinUnits ?? 0), 0);
}

/**
 * Score how similar two sessions' insulin totals are.
 * Returns 1.0 if within tolerance, scaling down to 0 at 3x tolerance.
 */
function insulinSimilarity(a: SessionWithMeals, b: SessionWithMeals): number {
  const diff = Math.abs(totalInsulin(a) - totalInsulin(b));
  if (diff <= INSULIN_TOLERANCE_UNITS) return 1;
  const maxDiff = INSULIN_TOLERANCE_UNITS * 3;
  return Math.max(0, 1 - (diff - INSULIN_TOLERANCE_UNITS) / maxDiff);
}

function sameDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Find past sessions that are an exact fingerprint match for the target session.
 *
 * Matching rule: sessionFingerprint(candidate) === sessionFingerprint(target)
 * This means stop-words are stripped and remaining content words are sorted,
 * so "Beans on toast" matches "Toast with beans" but NOT "Cheese and crisp sandwich".
 *
 * Only considers sessions with a completed glucoseResponse.
 * Excludes the target session itself and any session from the same day.
 * Ranks matches by insulin similarity; caps at MAX_MATCHES.
 */
export function findSimilarSessions(
  target: SessionWithMeals,
  allSessions: SessionWithMeals[]
): MatchSummary | null {
  const targetFp = sessionFingerprint(target);
  if (!targetFp) return null;

  const matches: SessionMatch[] = allSessions
    .filter(
      s =>
        s.id !== target.id &&
        s.glucoseResponse !== null &&
        !s.glucoseResponse.isPartial &&
        !sameDay(s.startedAt, target.startedAt) &&
        sessionFingerprint(s) === targetFp
    )
    .map(s => ({ session: s, score: insulinSimilarity(target, s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);

  if (matches.length === 0) return null;

  const avgRise =
    matches.reduce((sum, m) => sum + m.session.glucoseResponse!.totalRise, 0) /
    matches.length;
  const avgPeak =
    matches.reduce((sum, m) => sum + m.session.glucoseResponse!.peakGlucose, 0) /
    matches.length;
  const avgTimeToPeak =
    matches.reduce((sum, m) => sum + m.session.glucoseResponse!.timeToPeakMins, 0) /
    matches.length;

  return {
    matches,
    avgRise: Math.round(avgRise * 10) / 10,
    avgPeak: Math.round(avgPeak * 10) / 10,
    avgTimeToPeak: Math.round(avgTimeToPeak),
  };
}
