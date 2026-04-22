/**
 * Non-Meal Event Interactions
 * Spec: Session Grouping Design Spec, Section 5
 * Phase E — How correction doses, hypo treatments, and context events
 * interact with active sessions.
 *
 * Pure functions. No storage writes, no network calls.
 * Returns mutation objects for the caller (Phase H) to apply.
 *
 * Rules (Section 5):
 * - Correction dose: annotate session, set curve_corrected, log audit event (5.1)
 * - Basal insulin: ignored entirely at session level (5.2)
 * - Hypo treatment: flag session, truncate pattern curve at hypo timestamp, log audit event (5.3)
 * - Context event: metadata only, no contamination flag, no audit event (5.4)
 */
import type { Session, SessionCorrection, SessionHypoAnnotation, SessionContextEvent, SessionEventType } from './storage';
import type { PendingAuditEvent } from './sessionGrouping';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CorrectionInput {
  insulinLogId: string;
  units: number;
  timestamp: string; // ISO — when the correction was logged
}

export interface HypoInput {
  hypoTreatmentId: string;
  glucoseAtEvent: number; // mmol/L
  timestamp: string;      // ISO — when the hypo treatment occurred
}

export interface ContextEventInput {
  eventType: string;    // e.g. 'exercise', 'stress', 'illness'
  description: string;
  timestamp: string;    // ISO
}

// ---------------------------------------------------------------------------
// Result type — mutations for the caller to apply
// ---------------------------------------------------------------------------

export interface NonMealInteractionResult {
  sessionUpdates: Array<{
    sessionId: string;
    curveCorrected?: boolean;
    hypoDuringSession?: boolean;
  }>;
  correctionsToCreate: SessionCorrection[];
  hypoAnnotationsToCreate: SessionHypoAnnotation[];
  contextEventsToCreate: SessionContextEvent[];
  auditEvents: PendingAuditEvent[];
}

// ---------------------------------------------------------------------------
// ID generation (same pattern as storage.ts — no crypto.randomUUID)
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ---------------------------------------------------------------------------
// Empty result factory
// ---------------------------------------------------------------------------

function emptyResult(): NonMealInteractionResult {
  return {
    sessionUpdates: [],
    correctionsToCreate: [],
    hypoAnnotationsToCreate: [],
    contextEventsToCreate: [],
    auditEvents: [],
  };
}

// ---------------------------------------------------------------------------
// findActiveSessionAtTimestamp
// ---------------------------------------------------------------------------

/**
 * Find the session that was active at a given timestamp.
 * A session is active at time T if: startedAt <= T <= sessionEnd.
 *
 * Boundary: T === sessionEnd is still active (Section 4.3: closed when
 * current_time > session_end, not >=).
 *
 * Returns the first matching session, or null if none.
 */
export function findActiveSessionAtTimestamp(
  timestamp: string,
  sessions: Session[],
): Session | null {
  const ts = new Date(timestamp).getTime();

  for (const session of sessions) {
    if (!session.sessionEnd) continue; // Legacy sessions without sessionEnd — skip

    const startMs = new Date(session.startedAt).getTime();
    const endMs = new Date(session.sessionEnd).getTime();

    // startedAt <= timestamp <= sessionEnd (boundary inclusive)
    if (startMs <= ts && ts <= endMs) {
      return session;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// handleCorrectionDose (Section 5.1)
// ---------------------------------------------------------------------------

/**
 * Handle a correction dose interaction with active sessions.
 *
 * Section 5.1 rules:
 * - Not a session member (only meals are session members)
 * - Attach as annotation: session_corrections join table
 * - Set curve_corrected = true on session
 * - Log correction_attached to session_event_log
 * - If no active session: graceful no-op
 */
export function handleCorrectionDose(
  input: CorrectionInput,
  sessions: Session[],
): NonMealInteractionResult {
  const result = emptyResult();

  const activeSession = findActiveSessionAtTimestamp(input.timestamp, sessions);
  if (!activeSession) return result;

  // Create correction annotation (Section 5.1: session_corrections join table)
  const correction: SessionCorrection = {
    id: generateId('corr'),
    sessionId: activeSession.id,
    insulinLogId: input.insulinLogId,
    units: input.units,
    loggedAt: input.timestamp,
    createdAt: new Date().toISOString(),
  };
  result.correctionsToCreate.push(correction);

  // Flag session as curve-corrected
  result.sessionUpdates.push({
    sessionId: activeSession.id,
    curveCorrected: true,
  });

  // Audit event (Section 5.1: logged in session_event_log with correction_attached)
  result.auditEvents.push({
    sessionId: activeSession.id,
    eventType: 'correction_attached',
    triggeredByMealId: null, // Corrections are not meals
  });

  return result;
}

// ---------------------------------------------------------------------------
// handleHypoTreatment (Section 5.3)
// ---------------------------------------------------------------------------

/**
 * Handle a hypo treatment interaction with active sessions.
 *
 * Section 5.3 rules:
 * - NOT a meal, NOT a session member
 * - When inside an active session's curve capture window:
 *   - Set hypo_during_session = true
 *   - Pattern-matching curve for session members truncated at hypo timestamp
 *     (truncation is a query-time concern — handled in Phase G)
 *   - Full untruncated curve still stored for B2B purposes
 *   - Log hypo_during_session to session_event_log
 * - If no active session: graceful no-op (T-B2, T-E5)
 */
export function handleHypoTreatment(
  input: HypoInput,
  sessions: Session[],
): NonMealInteractionResult {
  const result = emptyResult();

  const activeSession = findActiveSessionAtTimestamp(input.timestamp, sessions);
  if (!activeSession) return result;

  // Create hypo annotation (Section 5.3: session_hypo_annotations join table)
  const annotation: SessionHypoAnnotation = {
    id: generateId('hypo-ann'),
    sessionId: activeSession.id,
    hypoTreatmentId: input.hypoTreatmentId,
    glucoseAtEvent: input.glucoseAtEvent,
    loggedAt: input.timestamp,
    createdAt: new Date().toISOString(),
  };
  result.hypoAnnotationsToCreate.push(annotation);

  // Flag session
  result.sessionUpdates.push({
    sessionId: activeSession.id,
    hypoDuringSession: true,
  });

  // Audit event (Section 5.3: logged in session_event_log with hypo_during_session)
  result.auditEvents.push({
    sessionId: activeSession.id,
    eventType: 'hypo_during_session',
    triggeredByMealId: null, // Hypo treatments are not meals
  });

  return result;
}

// ---------------------------------------------------------------------------
// handleContextEvent (Section 5.4)
// ---------------------------------------------------------------------------

/**
 * Handle a context event (exercise, illness, stress) interaction with active sessions.
 *
 * Section 5.4 rules:
 * - Attach to session: session_context_events join table
 * - No curve contamination flag
 * - No exclusion from solo pattern averages
 * - No audit event (context events are lightweight metadata —
 *   SessionEventType does not include a context event type)
 * - If no active session: no-op
 */
export function handleContextEvent(
  input: ContextEventInput,
  sessions: Session[],
): NonMealInteractionResult {
  const result = emptyResult();

  const activeSession = findActiveSessionAtTimestamp(input.timestamp, sessions);
  if (!activeSession) return result;

  // Create context event entry (Section 5.4: session_context_events join table)
  const contextEvent: SessionContextEvent = {
    id: generateId('ctx'),
    sessionId: activeSession.id,
    eventType: input.eventType,
    description: input.description,
    loggedAt: input.timestamp,
    createdAt: new Date().toISOString(),
  };
  result.contextEventsToCreate.push(contextEvent);

  // No session updates — context events don't flag contamination (Section 5.4)
  // No audit events — SessionEventType doesn't include context events

  return result;
}
