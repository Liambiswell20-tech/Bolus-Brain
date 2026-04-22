/**
 * Session Event Log — Immutable Audit Trail
 * Spec: Session Grouping Design Spec, Section 4.7
 * Phase D — Append-only log of every session membership change.
 *
 * Never mutated after write. Indexed on (session_id, triggered_at)
 * and (triggered_by_meal_id) at the Supabase layer (Phase A migration).
 *
 * Writes to AsyncStorage. Supabase sync via migration runner (Phase I).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionEventLog, SessionEventType } from './storage';
import type { PendingAuditEvent } from './sessionGrouping';

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const SESSION_EVENT_LOG_KEY = 'glucolog_session_event_log';

// ---------------------------------------------------------------------------
// ID generation (same pattern as storage.ts — no crypto.randomUUID)
// ---------------------------------------------------------------------------

function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ---------------------------------------------------------------------------
// Input type for logSessionEvent
// ---------------------------------------------------------------------------

export interface LogSessionEventInput {
  sessionId: string;
  eventType: SessionEventType;
  triggeredByMealId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  classificationKeywordsVersion: string;
}

/** Shared context passed to logSessionEvents for batch writes */
export interface BatchLogContext {
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  classificationKeywordsVersion: string;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

async function readLog(): Promise<SessionEventLog[]> {
  const raw = await AsyncStorage.getItem(SESSION_EVENT_LOG_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SessionEventLog[];
}

async function writeLog(events: SessionEventLog[]): Promise<void> {
  await AsyncStorage.setItem(SESSION_EVENT_LOG_KEY, JSON.stringify(events));
}

// ---------------------------------------------------------------------------
// logSessionEvent — write a single audit log entry (Section 4.7)
// ---------------------------------------------------------------------------

/**
 * Append a single event to the session event log.
 * Returns the created SessionEventLog entry.
 */
export async function logSessionEvent(input: LogSessionEventInput): Promise<SessionEventLog> {
  const entry: SessionEventLog = {
    id: generateEventId(),
    sessionId: input.sessionId,
    eventType: input.eventType,
    triggeredByMealId: input.triggeredByMealId,
    beforeState: input.beforeState,
    afterState: input.afterState,
    classificationKeywordsVersion: input.classificationKeywordsVersion,
    triggeredAt: new Date().toISOString(),
  };

  const existing = await readLog();
  existing.push(entry);
  await writeLog(existing);

  return entry;
}

// ---------------------------------------------------------------------------
// logSessionEvents — batch write from PendingAuditEvent[] (Phase C output)
// ---------------------------------------------------------------------------

/**
 * Convert PendingAuditEvent[] (from sessionGrouping.ts mutations) into
 * full SessionEventLog entries and append them all in a single write.
 *
 * All events in the batch share the same before/after state and keywords version,
 * since they result from a single mutation operation.
 */
export async function logSessionEvents(
  pendingEvents: PendingAuditEvent[],
  context: BatchLogContext,
): Promise<SessionEventLog[]> {
  if (pendingEvents.length === 0) return [];

  const now = new Date().toISOString();
  const entries: SessionEventLog[] = pendingEvents.map((pe) => ({
    id: generateEventId(),
    sessionId: pe.sessionId,
    eventType: pe.eventType,
    triggeredByMealId: pe.triggeredByMealId,
    beforeState: context.beforeState,
    afterState: context.afterState,
    classificationKeywordsVersion: context.classificationKeywordsVersion,
    triggeredAt: now,
  }));

  const existing = await readLog();
  existing.push(...entries);
  await writeLog(existing);

  return entries;
}

// ---------------------------------------------------------------------------
// getSessionEvents — read events for a specific session (Section 4.7)
// ---------------------------------------------------------------------------

/**
 * Return all audit log entries for a given session, in insertion order.
 */
export async function getSessionEvents(sessionId: string): Promise<SessionEventLog[]> {
  const all = await readLog();
  return all.filter((e) => e.sessionId === sessionId);
}

// ---------------------------------------------------------------------------
// getAllSessionEvents — read entire log (for debugging / migration)
// ---------------------------------------------------------------------------

/**
 * Return the full audit log in insertion order.
 */
export async function getAllSessionEvents(): Promise<SessionEventLog[]> {
  return readLog();
}
