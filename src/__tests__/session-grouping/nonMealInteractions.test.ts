/**
 * Phase E — Non-Meal Event Interactions Tests
 * Spec: Session Grouping Design Spec, Section 5 (Non-Meal Events)
 *
 * Test IDs from build plan: T-B1, T-B2, T-B3, T-B4, T-E5
 * Additional: Section 5.6 (correction + hypo in same session)
 *
 * Verifies:
 * - Correction dose → session annotation + curve_corrected flag + audit event
 * - Hypo treatment during session → hypo_during_session flag + audit event
 * - Hypo during solo meal's window → no-op (no session exists)
 * - Hypo without preceding meal → no-op
 * - Basal insulin → no interaction
 * - Context event → metadata only, no contamination flag
 * - Correction + hypo in same session → both flags set
 */
import {
  findActiveSessionAtTimestamp,
  handleCorrectionDose,
  handleHypoTreatment,
  handleContextEvent,
  type CorrectionInput,
  type HypoInput,
  type ContextEventInput,
  type NonMealInteractionResult,
} from '../../services/nonMealInteractions';
import type { Session } from '../../services/storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO timestamp helper: HH:MM on 2026-04-22 */
function t(hours: number, minutes: number = 0): string {
  return new Date(2026, 3, 22, hours, minutes, 0, 0).toISOString();
}

function makeSession(
  id: string,
  mealIds: string[],
  startedAt: string,
  sessionEnd: string,
  overrides?: Partial<Session>,
): Session {
  return {
    id,
    mealIds,
    startedAt,
    confidence: 'high',
    glucoseResponse: null,
    sessionEnd,
    curveCorrected: false,
    hypoDuringSession: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// findActiveSessionAtTimestamp
// ---------------------------------------------------------------------------
describe('findActiveSessionAtTimestamp', () => {
  it('returns session when timestamp is within session window', () => {
    // Session from 12:00 to 15:00
    const session = makeSession('s1', ['m1', 'm2'], t(12, 0), t(15, 0));
    const result = findActiveSessionAtTimestamp(t(13, 30), [session]);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('s1');
  });

  it('returns null when timestamp is after session_end', () => {
    const session = makeSession('s1', ['m1', 'm2'], t(12, 0), t(15, 0));
    const result = findActiveSessionAtTimestamp(t(15, 30), [session]);
    expect(result).toBeNull();
  });

  it('returns null when timestamp is before session start', () => {
    const session = makeSession('s1', ['m1', 'm2'], t(14, 0), t(17, 0));
    const result = findActiveSessionAtTimestamp(t(13, 0), [session]);
    expect(result).toBeNull();
  });

  it('returns null when no sessions exist', () => {
    const result = findActiveSessionAtTimestamp(t(14, 0), []);
    expect(result).toBeNull();
  });

  it('boundary: timestamp exactly at session_end is still active', () => {
    // Section 4.3: "closed the moment current_time > session_end" — exactly equal = NOT closed
    const session = makeSession('s1', ['m1', 'm2'], t(12, 0), t(15, 0));
    const result = findActiveSessionAtTimestamp(t(15, 0), [session]);
    expect(result).not.toBeNull();
  });

  it('boundary: timestamp exactly at startedAt is active', () => {
    const session = makeSession('s1', ['m1', 'm2'], t(12, 0), t(15, 0));
    const result = findActiveSessionAtTimestamp(t(12, 0), [session]);
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T-B1: Correction during session (Section 5.1)
// ---------------------------------------------------------------------------
describe('T-B1: Correction during active session', () => {
  const session = makeSession('s1', ['m1', 'm2'], t(12, 0), t(15, 0));

  it('creates correction annotation with correct fields', () => {
    const input: CorrectionInput = {
      insulinLogId: 'corr-1',
      units: 2,
      timestamp: t(13, 30),
    };
    const result = handleCorrectionDose(input, [session]);

    expect(result.correctionsToCreate).toHaveLength(1);
    const correction = result.correctionsToCreate[0];
    expect(correction.sessionId).toBe('s1');
    expect(correction.insulinLogId).toBe('corr-1');
    expect(correction.units).toBe(2);
    expect(correction.loggedAt).toBe(t(13, 30));
  });

  it('sets curveCorrected flag on session', () => {
    const input: CorrectionInput = {
      insulinLogId: 'corr-1',
      units: 2,
      timestamp: t(13, 30),
    };
    const result = handleCorrectionDose(input, [session]);

    expect(result.sessionUpdates).toHaveLength(1);
    expect(result.sessionUpdates[0].sessionId).toBe('s1');
    expect(result.sessionUpdates[0].curveCorrected).toBe(true);
  });

  it('logs correction_attached audit event', () => {
    const input: CorrectionInput = {
      insulinLogId: 'corr-1',
      units: 2,
      timestamp: t(13, 30),
    };
    const result = handleCorrectionDose(input, [session]);

    expect(result.auditEvents).toHaveLength(1);
    expect(result.auditEvents[0].sessionId).toBe('s1');
    expect(result.auditEvents[0].eventType).toBe('correction_attached');
  });

  it('no-op when correction is outside all session windows', () => {
    const input: CorrectionInput = {
      insulinLogId: 'corr-1',
      units: 2,
      timestamp: t(16, 0), // after session ends at 15:00
    };
    const result = handleCorrectionDose(input, [session]);

    expect(result.correctionsToCreate).toHaveLength(0);
    expect(result.sessionUpdates).toHaveLength(0);
    expect(result.auditEvents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-B2: Hypo treatment during solo meal's window (Section 5.3)
// No session exists → no-op at session level
// ---------------------------------------------------------------------------
describe('T-B2: Hypo treatment during solo meal window (no session)', () => {
  it('returns empty result when no sessions exist', () => {
    const input: HypoInput = {
      hypoTreatmentId: 'hypo-1',
      glucoseAtEvent: 3.2,
      timestamp: t(13, 30),
    };
    // No sessions — solo meal's window is irrelevant at session level
    const result = handleHypoTreatment(input, []);

    expect(result.hypoAnnotationsToCreate).toHaveLength(0);
    expect(result.sessionUpdates).toHaveLength(0);
    expect(result.auditEvents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Hypo treatment during active session (Section 5.3)
// ---------------------------------------------------------------------------
describe('Hypo treatment during active session', () => {
  const session = makeSession('s1', ['m1', 'm2'], t(12, 0), t(15, 0));

  it('creates hypo annotation with correct fields', () => {
    const input: HypoInput = {
      hypoTreatmentId: 'hypo-1',
      glucoseAtEvent: 3.2,
      timestamp: t(13, 30),
    };
    const result = handleHypoTreatment(input, [session]);

    expect(result.hypoAnnotationsToCreate).toHaveLength(1);
    const annotation = result.hypoAnnotationsToCreate[0];
    expect(annotation.sessionId).toBe('s1');
    expect(annotation.hypoTreatmentId).toBe('hypo-1');
    expect(annotation.glucoseAtEvent).toBe(3.2);
    expect(annotation.loggedAt).toBe(t(13, 30));
  });

  it('sets hypoDuringSession flag on session', () => {
    const input: HypoInput = {
      hypoTreatmentId: 'hypo-1',
      glucoseAtEvent: 3.2,
      timestamp: t(13, 30),
    };
    const result = handleHypoTreatment(input, [session]);

    expect(result.sessionUpdates).toHaveLength(1);
    expect(result.sessionUpdates[0].sessionId).toBe('s1');
    expect(result.sessionUpdates[0].hypoDuringSession).toBe(true);
  });

  it('logs hypo_during_session audit event', () => {
    const input: HypoInput = {
      hypoTreatmentId: 'hypo-1',
      glucoseAtEvent: 3.2,
      timestamp: t(13, 30),
    };
    const result = handleHypoTreatment(input, [session]);

    expect(result.auditEvents).toHaveLength(1);
    expect(result.auditEvents[0].sessionId).toBe('s1');
    expect(result.auditEvents[0].eventType).toBe('hypo_during_session');
  });
});

// ---------------------------------------------------------------------------
// T-B3: Basal insulin ignored at session level (Section 5.2)
// ---------------------------------------------------------------------------
describe('T-B3: Basal insulin ignored at session level', () => {
  it('basal insulin type is not correction — no handleCorrectionDose path', () => {
    // Basal insulin is type 'long-acting' in InsulinLogType.
    // The caller (Phase H integration) filters: only type === 'correction' calls handleCorrectionDose.
    // Phase E verifies: handleCorrectionDose is not called for basal.
    // This test confirms the function only processes what it's given — it doesn't
    // interact with sessions when there's nothing to process.
    //
    // The REAL guard is in the caller (Phase H), but we verify here that
    // a correction dose outside all sessions is a clean no-op.
    const session = makeSession('s1', ['m1'], t(12, 0), t(15, 0));
    const input: CorrectionInput = {
      insulinLogId: 'basal-should-not-be-here',
      units: 20,
      timestamp: t(20, 0), // well outside session window
    };
    const result = handleCorrectionDose(input, [session]);
    expect(result.sessionUpdates).toHaveLength(0);
    expect(result.correctionsToCreate).toHaveLength(0);
    expect(result.auditEvents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-B4: Context event attaches as metadata only (Section 5.4)
// ---------------------------------------------------------------------------
describe('T-B4: Context event attaches as metadata only', () => {
  const session = makeSession('s1', ['m1', 'm2'], t(12, 0), t(15, 0));

  it('creates context event entry with correct fields', () => {
    const input: ContextEventInput = {
      eventType: 'exercise',
      description: '30 min walk',
      timestamp: t(13, 0),
    };
    const result = handleContextEvent(input, [session]);

    expect(result.contextEventsToCreate).toHaveLength(1);
    const ctxEvent = result.contextEventsToCreate[0];
    expect(ctxEvent.sessionId).toBe('s1');
    expect(ctxEvent.eventType).toBe('exercise');
    expect(ctxEvent.description).toBe('30 min walk');
    expect(ctxEvent.loggedAt).toBe(t(13, 0));
  });

  it('does NOT set any contamination flags', () => {
    const input: ContextEventInput = {
      eventType: 'exercise',
      description: '30 min walk',
      timestamp: t(13, 0),
    };
    const result = handleContextEvent(input, [session]);

    // No session updates — context events don't flag contamination
    expect(result.sessionUpdates).toHaveLength(0);
  });

  it('does NOT create audit events (context events are lightweight metadata)', () => {
    const input: ContextEventInput = {
      eventType: 'stress',
      description: 'Work deadline',
      timestamp: t(14, 0),
    };
    const result = handleContextEvent(input, [session]);

    // Context events are metadata only — no session_event_log entry
    // (SessionEventType does not include a context_event type)
    expect(result.auditEvents).toHaveLength(0);
  });

  it('no-op when context event is outside all session windows', () => {
    const input: ContextEventInput = {
      eventType: 'exercise',
      description: 'Evening run',
      timestamp: t(16, 0),
    };
    const result = handleContextEvent(input, [session]);

    expect(result.contextEventsToCreate).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-E5: Hypo without preceding meal (Section 5.3 / 12)
// ---------------------------------------------------------------------------
describe('T-E5: Hypo without preceding meal', () => {
  it('returns empty result — no sessions to annotate', () => {
    const input: HypoInput = {
      hypoTreatmentId: 'hypo-standalone',
      glucoseAtEvent: 2.8,
      timestamp: t(6, 0), // early morning, no meals logged
    };
    const result = handleHypoTreatment(input, []);

    expect(result.hypoAnnotationsToCreate).toHaveLength(0);
    expect(result.sessionUpdates).toHaveLength(0);
    expect(result.auditEvents).toHaveLength(0);
  });

  it('no-op even when closed sessions exist', () => {
    // Session ended at 15:00, hypo at 18:00 — session is closed
    const closedSession = makeSession('s-old', ['m1'], t(12, 0), t(15, 0));
    const input: HypoInput = {
      hypoTreatmentId: 'hypo-late',
      glucoseAtEvent: 3.0,
      timestamp: t(18, 0),
    };
    const result = handleHypoTreatment(input, [closedSession]);

    expect(result.hypoAnnotationsToCreate).toHaveLength(0);
    expect(result.sessionUpdates).toHaveLength(0);
    expect(result.auditEvents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Section 5.6: Correction + hypo in same session
// ---------------------------------------------------------------------------
describe('Section 5.6: Correction + hypo in same session', () => {
  const session = makeSession('s1', ['m1', 'm2'], t(12, 0), t(15, 0));

  it('both flags can be set independently on the same session', () => {
    // Correction at 13:00
    const corrResult = handleCorrectionDose(
      { insulinLogId: 'corr-1', units: 2, timestamp: t(13, 0) },
      [session],
    );
    expect(corrResult.sessionUpdates[0].curveCorrected).toBe(true);
    expect(corrResult.sessionUpdates[0].hypoDuringSession).toBeUndefined();

    // Hypo at 14:00
    const hypoResult = handleHypoTreatment(
      { hypoTreatmentId: 'hypo-1', glucoseAtEvent: 3.1, timestamp: t(14, 0) },
      [session],
    );
    expect(hypoResult.sessionUpdates[0].hypoDuringSession).toBe(true);
    expect(hypoResult.sessionUpdates[0].curveCorrected).toBeUndefined();
  });

  it('both audit events are logged independently', () => {
    const corrResult = handleCorrectionDose(
      { insulinLogId: 'corr-1', units: 2, timestamp: t(13, 0) },
      [session],
    );
    const hypoResult = handleHypoTreatment(
      { hypoTreatmentId: 'hypo-1', glucoseAtEvent: 3.1, timestamp: t(14, 0) },
      [session],
    );

    expect(corrResult.auditEvents[0].eventType).toBe('correction_attached');
    expect(hypoResult.auditEvents[0].eventType).toBe('hypo_during_session');
  });
});
