import { findSimilarSessions } from './matching';
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
// Tests
// ---------------------------------------------------------------------------

describe('findSimilarSessions', () => {
  beforeEach(() => {
    // Reset counter for deterministic IDs per test group
    sessionCounter = 0;
  });

  // Test 1: Returns null when target has no meals (empty token set)
  it('returns null when target has no meals', () => {
    const target = makeSession([], '2026-03-21T12:00:00Z');
    const session1 = makeSession([makeMeal('pasta bolognese')], '2026-03-19T12:00:00Z');
    const session2 = makeSession([makeMeal('pasta bolognese')], '2026-03-18T12:00:00Z');
    const session3 = makeSession([makeMeal('pasta bolognese')], '2026-03-17T12:00:00Z');

    const result = findSimilarSessions(target, [target, session1, session2, session3]);
    expect(result).toBeNull();
  });

  // Test 2: Returns null when 0 sessions meet similarity threshold
  it('returns null when no sessions meet the similarity threshold', () => {
    // target has 4 units insulin; sessions have wildly different insulin AND different meal tokens
    // mealScore will be 0 (no token overlap); insulinScore will be 0 (diff >> 3x tolerance)
    // combined score: 0 * 0.75 + 0 * 0.25 = 0 — below SIMILARITY_THRESHOLD (0.25)
    const target = makeSession([makeMeal('fish and chips', 4)], '2026-03-21T12:00:00Z');
    const session1 = makeSession([makeMeal('banana smoothie', 30)], '2026-03-19T12:00:00Z');
    const session2 = makeSession([makeMeal('mango yoghurt', 28)], '2026-03-18T12:00:00Z');

    const result = findSimilarSessions(target, [session1, session2]);
    expect(result).toBeNull();
  });

  // Test 3: Returns MatchSummary with matches.length === 1 when exactly 1 session matches
  it('returns MatchSummary with 1 match when only 1 session meets threshold', () => {
    // Use same insulin units (4) so insulin similarity doesn't elevate non-matching sessions
    const target = makeSession([makeMeal('pasta bolognese', 4)], '2026-03-21T12:00:00Z');
    // 'pasta' shares a token with 'pasta bolognese' AND same insulin — should match
    const matchingSession = makeSession([makeMeal('pasta', 4)], '2026-03-19T12:00:00Z');
    // 'orange juice' shares no tokens AND very different insulin — combined score below 0.25
    const nonMatchingSession = makeSession([makeMeal('orange juice', 30)], '2026-03-18T12:00:00Z');

    const result = findSimilarSessions(target, [matchingSession, nonMatchingSession]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(1);
  });

  // Test 4: Returns MatchSummary when 2+ sessions match
  it('returns MatchSummary when 2 or more sessions match', () => {
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');
    const session1 = makeSession([makeMeal('chicken pasta bake')], '2026-03-19T12:00:00Z');
    const session2 = makeSession([makeMeal('pasta chicken')], '2026-03-18T12:00:00Z');
    const session3 = makeSession([makeMeal('chicken pasta salad')], '2026-03-17T12:00:00Z');

    const result = findSimilarSessions(target, [session1, session2, session3]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBeGreaterThanOrEqual(2);
  });

  // Test 5: Excludes target session itself from results
  it('excludes the target session itself from results', () => {
    const targetMeal = makeMeal('chicken pasta');
    const target = makeSession([targetMeal], '2026-03-21T12:00:00Z');
    // Give target a glucoseResponse so it would otherwise pass the filter
    target.glucoseResponse = makeGlucoseResponse();

    const session1 = makeSession([makeMeal('chicken pasta bake')], '2026-03-19T12:00:00Z');
    const session2 = makeSession([makeMeal('pasta chicken salad')], '2026-03-18T12:00:00Z');

    // Include target in allSessions — it must be excluded from its own results
    const result = findSimilarSessions(target, [target, session1, session2]);
    expect(result).not.toBeNull();
    expect(result!.matches.every(m => m.session.id !== target.id)).toBe(true);
  });

  // Test 6: Excludes sessions from the same calendar day as target
  it('excludes sessions from the same calendar day as the target', () => {
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');
    // Same day — must be excluded
    const sameDaySession = makeSession([makeMeal('chicken pasta bake')], '2026-03-21T08:00:00Z');
    // Different day — should be included if it scores above threshold
    const differentDaySession = makeSession([makeMeal('chicken pasta salad')], '2026-03-20T12:00:00Z');

    const result = findSimilarSessions(target, [sameDaySession, differentDaySession]);
    if (result !== null) {
      // sameDaySession must not appear in results
      expect(result.matches.every(m => m.session.id !== sameDaySession.id)).toBe(true);
    }
  });

  // Test 7: Excludes sessions with null glucoseResponse
  it('excludes sessions with null glucoseResponse', () => {
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');
    // 2 matching sessions without glucoseResponse — must be excluded
    const noResponse1 = makeSession([makeMeal('chicken pasta bake')], '2026-03-19T12:00:00Z', null);
    const noResponse2 = makeSession([makeMeal('pasta chicken')], '2026-03-18T12:00:00Z', null);
    // 1 matching session with complete glucoseResponse — should be included
    const withResponse = makeSession(
      [makeMeal('chicken pasta salad')],
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
    // 2 matching sessions with isPartial: true — must be excluded
    const partial1 = makeSession(
      [makeMeal('chicken pasta bake')],
      '2026-03-19T12:00:00Z',
      makeGlucoseResponse({ isPartial: true })
    );
    const partial2 = makeSession(
      [makeMeal('pasta chicken')],
      '2026-03-18T12:00:00Z',
      makeGlucoseResponse({ isPartial: true })
    );
    // 1 matching session with isPartial: false — should be included
    const complete = makeSession(
      [makeMeal('chicken pasta salad')],
      '2026-03-17T12:00:00Z',
      makeGlucoseResponse({ isPartial: false })
    );

    const result = findSimilarSessions(target, [partial1, partial2, complete]);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBe(1);
    expect(result!.matches[0].session.id).toBe(complete.id);
  });

  // Test 9: Caps results at MAX_MATCHES (5)
  it('caps results at MAX_MATCHES (5) even when more sessions match', () => {
    const target = makeSession([makeMeal('pasta bolognese')], '2026-03-21T12:00:00Z');

    // 8 strongly matching sessions from different days — all should score well above threshold
    const sessions = [
      makeSession([makeMeal('pasta bolognese mince')], '2026-03-20T12:00:00Z'),
      makeSession([makeMeal('bolognese pasta bake')], '2026-03-19T12:00:00Z'),
      makeSession([makeMeal('pasta bolognese sauce')], '2026-03-18T12:00:00Z'),
      makeSession([makeMeal('pasta bolognese fresh')], '2026-03-17T12:00:00Z'),
      makeSession([makeMeal('bolognese pasta dish')], '2026-03-16T12:00:00Z'),
      makeSession([makeMeal('pasta bolognese leftovers')], '2026-03-15T12:00:00Z'),
      makeSession([makeMeal('bolognese pasta meal')], '2026-03-14T12:00:00Z'),
      makeSession([makeMeal('pasta bolognese dinner')], '2026-03-13T12:00:00Z'),
    ];

    const result = findSimilarSessions(target, sessions);
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBeLessThanOrEqual(5);
  });

  // Test 10: Computes avgPeak, avgRise, avgTimeToPeak correctly
  it('computes avgPeak, avgRise, avgTimeToPeak correctly across matching sessions', () => {
    const target = makeSession([makeMeal('chicken pasta')], '2026-03-21T12:00:00Z');

    const session1 = makeSession(
      [makeMeal('chicken pasta bake')],
      '2026-03-19T12:00:00Z',
      makeGlucoseResponse({
        peakGlucose: 8.0,
        totalRise: 2.0,
        timeToPeakMins: 30,
      })
    );
    const session2 = makeSession(
      [makeMeal('pasta chicken salad')],
      '2026-03-18T12:00:00Z',
      makeGlucoseResponse({
        peakGlucose: 10.0,
        totalRise: 4.0,
        timeToPeakMins: 50,
      })
    );

    const result = findSimilarSessions(target, [session1, session2]);
    expect(result).not.toBeNull();

    // Both sessions must be present in matches for the averages to be meaningful
    expect(result!.matches.length).toBe(2);

    // avgPeak: (8.0 + 10.0) / 2 = 9.0
    expect(result!.avgPeak).toBe(9.0);
    // avgRise: (2.0 + 4.0) / 2 = 3.0
    expect(result!.avgRise).toBe(3.0);
    // avgTimeToPeak: (30 + 50) / 2 = 40
    expect(result!.avgTimeToPeak).toBe(40);
  });
});
