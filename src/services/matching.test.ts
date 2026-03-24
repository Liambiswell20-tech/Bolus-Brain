import { findSimilarSessions } from './matching';
import { getMealFingerprint } from '../utils/mealFingerprint';
import type { SessionWithMeals, Meal, GlucoseResponse } from './storage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGlucoseResponse(
  overrides: Partial<GlucoseResponse> = {}
): GlucoseResponse {
  return {
    startGlucose: 6.0,
    peakGlucose: 9.0,
    timeToPeakMins: 40,
    totalRise: 3.0,
    endGlucose: 7.0,
    fallFromPeak: 2.0,
    timeFromPeakToEndMins: 60,
    readings: [],
    isPartial: false,
    fetchedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMeal(name: string, insulinUnits = 4): Meal {
  return {
    id: `meal-${name}-${Math.random().toString(36).slice(2)}`,
    name,
    photoUri: null,
    insulinUnits,
    startGlucose: 6.0,
    carbsEstimated: null,
    loggedAt: '2026-01-01T12:00:00Z',
    sessionId: null,
    glucoseResponse: null,
  };
}

let sessionCounter = 0;
function makeSession(
  meals: Meal[],
  startedAt: string,
  glucoseResponse: GlucoseResponse | null = makeGlucoseResponse()
): SessionWithMeals {
  sessionCounter++;
  return {
    id: `session-${sessionCounter}`,
    mealIds: meals.map(m => m.id),
    startedAt,
    confidence: 'high',
    glucoseResponse,
    meals,
  };
}

// ---------------------------------------------------------------------------
// Fingerprint correctness tests
// ---------------------------------------------------------------------------

describe('getMealFingerprint', () => {
  it('strips stop words and sorts — "Beans on toast" === "Toast with beans"', () => {
    expect(getMealFingerprint('Beans on toast')).toBe(getMealFingerprint('Toast with beans'));
  });

  it('"Beans and toast" fingerprints the same as "Toast with beans"', () => {
    expect(getMealFingerprint('Beans and toast')).toBe(getMealFingerprint('Toast with beans'));
  });

  it('"Chicken with rice" === "Rice and chicken"', () => {
    expect(getMealFingerprint('Chicken with rice')).toBe(getMealFingerprint('Rice and chicken'));
  });

  it('"Lamb shank and mashed potato" !== "Cheese and crisp sandwich"', () => {
    expect(getMealFingerprint('Lamb shank and mashed potato')).not.toBe(
      getMealFingerprint('Cheese and crisp sandwich')
    );
  });

  it('"Beans on toast" !== "Chicken on rice"', () => {
    expect(getMealFingerprint('Beans on toast')).not.toBe(getMealFingerprint('Chicken on rice'));
  });

  it('returns empty string for a name composed entirely of stop words', () => {
    expect(getMealFingerprint('and with the')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// findSimilarSessions tests
// ---------------------------------------------------------------------------

describe('findSimilarSessions', () => {
  beforeEach(() => {
    sessionCounter = 0;
  });

  // Test 1: Returns null when target has no meals (empty fingerprint)
  it('returns null when target has no meals', () => {
    const target = makeSession([], '2026-03-21T12:00:00Z');
    const session1 = makeSession([makeMeal('pasta bolognese')], '2026-03-19T12:00:00Z');
    const session2 = makeSession([makeMeal('pasta bolognese')], '2026-03-18T12:00:00Z');

    const result = findSimilarSessions(target, [target, session1, session2]);
    expect(result).toBeNull();
  });

  // Test 2: Returns null when no fingerprint matches exist
  it('returns null when no sessions have a matching fingerprint', () => {
    const target = makeSession([makeMeal('fish chips', 4)], '2026-03-21T12:00:00Z');
    const session1 = makeSession([makeMeal('banana smoothie', 4)], '2026-03-19T12:00:00Z');
    const session2 = makeSession([makeMeal('mango yoghurt', 4)], '2026-03-18T12:00:00Z');

    const result = findSimilarSessions(target, [session1, session2]);
    expect(result).toBeNull();
  });

  // Test 3: Exact fingerprint match — "pasta bolognese" matches "bolognese pasta"
  it('returns 1 match when exactly 1 session has a matching fingerprint', () => {
    const target = makeSession([makeMeal('pasta bolognese', 4)], '2026-03-21T12:00:00Z');
    // Same fingerprint: bolognese and pasta sorted = matching session
    const matchingSession = makeSession([makeMeal('bolognese pasta', 4)], '2026-03-19T12:00:00Z');
    // Different fingerprint: no match
    const nonMatchingSession = makeSession([makeMeal('orange juice', 4)], '2026-03-18T12:00:00Z');

    const result = findSimilarSessions(target, [matchingSession, nonMatchingSession]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(1);
    expect(result!.matches[0].session.id).toBe(matchingSession.id);
  });

  // Test 4: Exact fingerprint match returns 2+ sessions
  it('returns MatchSummary when 2 or more sessions share the exact fingerprint', () => {
    // "chicken pasta" → fingerprint: chicken_pasta
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');
    // "pasta chicken" → chicken_pasta ✓
    const session1 = makeSession([makeMeal('pasta chicken')], '2026-03-19T12:00:00Z');
    // "chicken pasta" → chicken_pasta ✓
    const session2 = makeSession([makeMeal('chicken pasta')], '2026-03-18T12:00:00Z');
    // "chicken pasta bake" → bake_chicken_pasta ✗ — different fingerprint, must NOT match
    const nonMatch = makeSession([makeMeal('chicken pasta bake')], '2026-03-17T12:00:00Z');

    const result = findSimilarSessions(target, [session1, session2, nonMatch]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(2);
    expect(result!.matches.every(m => m.session.id !== nonMatch.id)).toBe(true);
  });

  // Test 5: Excludes target session itself from results
  it('excludes the target session itself from results', () => {
    const targetMeal = makeMeal('chicken pasta');
    const target = makeSession([targetMeal], '2026-03-21T12:00:00Z');
    target.glucoseResponse = makeGlucoseResponse();

    const session1 = makeSession([makeMeal('pasta chicken')], '2026-03-19T12:00:00Z');
    const session2 = makeSession([makeMeal('chicken pasta')], '2026-03-18T12:00:00Z');

    const result = findSimilarSessions(target, [target, session1, session2]);
    expect(result).not.toBeNull();
    expect(result!.matches.every(m => m.session.id !== target.id)).toBe(true);
  });

  // Test 6: Excludes sessions from the same calendar day as target
  it('excludes sessions from the same calendar day as the target', () => {
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');
    const sameDaySession = makeSession([makeMeal('pasta chicken')], '2026-03-21T08:00:00Z');
    const differentDaySession = makeSession([makeMeal('chicken pasta')], '2026-03-20T12:00:00Z');

    const result = findSimilarSessions(target, [sameDaySession, differentDaySession]);
    if (result !== null) {
      expect(result.matches.every(m => m.session.id !== sameDaySession.id)).toBe(true);
    }
  });

  // Test 7: Excludes sessions with null glucoseResponse
  it('excludes sessions with null glucoseResponse', () => {
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');
    const noResponse1 = makeSession([makeMeal('pasta chicken')], '2026-03-19T12:00:00Z', null);
    const noResponse2 = makeSession([makeMeal('chicken pasta')], '2026-03-18T12:00:00Z', null);
    const withResponse = makeSession(
      [makeMeal('pasta chicken')],
      '2026-03-17T12:00:00Z',
      makeGlucoseResponse()
    );

    const result = findSimilarSessions(target, [noResponse1, noResponse2, withResponse]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(1);
    expect(result!.matches[0].session.id).toBe(withResponse.id);
  });

  // Test 8: Excludes sessions with partial (isPartial: true) glucoseResponse
  it('excludes sessions with isPartial glucoseResponse', () => {
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');
    const partial1 = makeSession(
      [makeMeal('pasta chicken')],
      '2026-03-19T12:00:00Z',
      makeGlucoseResponse({ isPartial: true })
    );
    const partial2 = makeSession(
      [makeMeal('chicken pasta')],
      '2026-03-18T12:00:00Z',
      makeGlucoseResponse({ isPartial: true })
    );
    const complete = makeSession(
      [makeMeal('pasta chicken')],
      '2026-03-17T12:00:00Z',
      makeGlucoseResponse({ isPartial: false })
    );

    const result = findSimilarSessions(target, [partial1, partial2, complete]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(1);
    expect(result!.matches[0].session.id).toBe(complete.id);
  });

  // Test 9: Caps results at MAX_MATCHES (5)
  it('caps results at MAX_MATCHES (5) even when more sessions share the fingerprint', () => {
    const target = makeSession([makeMeal('pasta bolognese')], '2026-03-21T12:00:00Z');

    // 8 sessions all sharing the fingerprint "bolognese_pasta"
    const sessions = [
      makeSession([makeMeal('pasta bolognese')], '2026-03-20T12:00:00Z'),
      makeSession([makeMeal('bolognese pasta')], '2026-03-19T12:00:00Z'),
      makeSession([makeMeal('pasta bolognese')], '2026-03-18T12:00:00Z'),
      makeSession([makeMeal('bolognese pasta')], '2026-03-17T12:00:00Z'),
      makeSession([makeMeal('pasta bolognese')], '2026-03-16T12:00:00Z'),
      makeSession([makeMeal('bolognese pasta')], '2026-03-15T12:00:00Z'),
      makeSession([makeMeal('pasta bolognese')], '2026-03-14T12:00:00Z'),
      makeSession([makeMeal('bolognese pasta')], '2026-03-13T12:00:00Z'),
    ];

    const result = findSimilarSessions(target, sessions);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBeLessThanOrEqual(5);
  });

  // Test 10: Computes avgPeak, avgRise, avgTimeToPeak correctly
  it('computes avgPeak, avgRise, avgTimeToPeak correctly across matching sessions', () => {
    // "chicken pasta" and "pasta chicken" share fingerprint chicken_pasta
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');

    const session1 = makeSession(
      [makeMeal('pasta chicken')],
      '2026-03-19T12:00:00Z',
      makeGlucoseResponse({
        peakGlucose: 8.0,
        totalRise: 2.0,
        timeToPeakMins: 30,
      })
    );
    const session2 = makeSession(
      [makeMeal('chicken pasta')],
      '2026-03-18T12:00:00Z',
      makeGlucoseResponse({
        peakGlucose: 10.0,
        totalRise: 4.0,
        timeToPeakMins: 50,
      })
    );

    const result = findSimilarSessions(target, [session1, session2]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(2);

    // avgPeak: (8.0 + 10.0) / 2 = 9.0
    expect(result!.avgPeak).toBe(9.0);
    // avgRise: (2.0 + 4.0) / 2 = 3.0
    expect(result!.avgRise).toBe(3.0);
    // avgTimeToPeak: (30 + 50) / 2 = 40
    expect(result!.avgTimeToPeak).toBe(40);
  });

  // Test 11: Partial name no longer matches (regression guard)
  it('does NOT match sessions where one name is a substring of the other', () => {
    // "pasta" vs "pasta bolognese" — different fingerprints, must NOT match
    const target = makeSession([makeMeal('pasta')], '2026-03-21T12:00:00Z');
    const session1 = makeSession([makeMeal('pasta bolognese')], '2026-03-19T12:00:00Z');

    const result = findSimilarSessions(target, [session1]);
    expect(result).toBeNull();
  });

  // Test 12: Stop-word-only difference is ignored
  it('matches sessions that differ only in stop words — "beans on toast" === "toast with beans"', () => {
    const target = makeSession([makeMeal('beans on toast')], '2026-03-21T12:00:00Z');
    const past = makeSession([makeMeal('toast with beans')], '2026-03-19T12:00:00Z');

    const result = findSimilarSessions(target, [past]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(1);
  });
});
