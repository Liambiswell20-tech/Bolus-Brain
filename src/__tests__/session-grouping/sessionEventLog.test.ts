/**
 * Phase D — session_event_log + Audit Trail Tests
 * Spec: Session Grouping Design Spec, Section 4.7 (Immutable audit trail)
 *
 * Verifies:
 * - All event types produce correct log entries
 * - Log entries include before_state, after_state, classification_keywords_version
 * - Append-only: existing entries never mutated
 * - Batch logging from SessionMutations.auditEvents
 * - Read-back by session ID
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  logSessionEvent,
  logSessionEvents,
  getSessionEvents,
  getAllSessionEvents,
  SESSION_EVENT_LOG_KEY,
} from '../../services/sessionEventLog';
import type { SessionEventLog, SessionEventType } from '../../services/storage';
import type { PendingAuditEvent } from '../../services/sessionGrouping';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBeforeState(mealIds: string[]): Record<string, unknown> {
  return { member_meal_ids: mealIds, session_start: '2026-04-22T12:00:00.000Z', session_end: '2026-04-22T15:00:00.000Z' };
}

function makeAfterState(mealIds: string[]): Record<string, unknown> {
  return { member_meal_ids: mealIds, session_start: '2026-04-22T12:00:00.000Z', session_end: '2026-04-22T16:00:00.000Z' };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ---------------------------------------------------------------------------
// 1. Single event logging — all event types
// ---------------------------------------------------------------------------
describe('logSessionEvent — all event types', () => {
  const eventTypes: SessionEventType[] = [
    'created',
    'extended',
    'dissolved',
    'split',
    'merged',
    'member_added_via_backfill',
    'member_removed_via_delete',
    'member_reassigned_via_edit',
    'correction_attached',
    'hypo_during_session',
    'migration_reassigned',
  ];

  it.each(eventTypes)('logs %s event with correct fields', async (eventType) => {
    const event = await logSessionEvent({
      sessionId: 'session-1',
      eventType,
      triggeredByMealId: 'meal-1',
      beforeState: makeBeforeState(['meal-1']),
      afterState: makeAfterState(['meal-1', 'meal-2']),
      classificationKeywordsVersion: '1',
    });

    expect(event.id).toBeTruthy();
    expect(event.sessionId).toBe('session-1');
    expect(event.eventType).toBe(eventType);
    expect(event.triggeredByMealId).toBe('meal-1');
    expect(event.beforeState).toEqual(makeBeforeState(['meal-1']));
    expect(event.afterState).toEqual(makeAfterState(['meal-1', 'meal-2']));
    expect(event.classificationKeywordsVersion).toBe('1');
    expect(event.triggeredAt).toBeTruthy();
    // triggeredAt should be a valid ISO string
    expect(new Date(event.triggeredAt).toISOString()).toBe(event.triggeredAt);
  });
});

// ---------------------------------------------------------------------------
// 2. Append-only: existing entries never mutated
// ---------------------------------------------------------------------------
describe('Append-only semantics', () => {
  it('second write appends, does not overwrite first', async () => {
    await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'created',
      triggeredByMealId: 'meal-1',
      beforeState: null,
      afterState: makeAfterState(['meal-1']),
      classificationKeywordsVersion: '1',
    });

    await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'extended',
      triggeredByMealId: 'meal-2',
      beforeState: makeBeforeState(['meal-1']),
      afterState: makeAfterState(['meal-1', 'meal-2']),
      classificationKeywordsVersion: '1',
    });

    const allEvents = await getAllSessionEvents();
    expect(allEvents).toHaveLength(2);
    expect(allEvents[0].eventType).toBe('created');
    expect(allEvents[1].eventType).toBe('extended');
  });

  it('events for different sessions are stored together', async () => {
    await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'created',
      triggeredByMealId: 'meal-1',
      beforeState: null,
      afterState: makeAfterState(['meal-1']),
      classificationKeywordsVersion: '1',
    });

    await logSessionEvent({
      sessionId: 'session-2',
      eventType: 'created',
      triggeredByMealId: 'meal-3',
      beforeState: null,
      afterState: makeAfterState(['meal-3']),
      classificationKeywordsVersion: '1',
    });

    const allEvents = await getAllSessionEvents();
    expect(allEvents).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Read by session ID
// ---------------------------------------------------------------------------
describe('getSessionEvents — filter by session ID', () => {
  it('returns only events for the requested session', async () => {
    await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'created',
      triggeredByMealId: 'meal-1',
      beforeState: null,
      afterState: makeAfterState(['meal-1']),
      classificationKeywordsVersion: '1',
    });

    await logSessionEvent({
      sessionId: 'session-2',
      eventType: 'created',
      triggeredByMealId: 'meal-2',
      beforeState: null,
      afterState: makeAfterState(['meal-2']),
      classificationKeywordsVersion: '1',
    });

    await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'extended',
      triggeredByMealId: 'meal-3',
      beforeState: makeBeforeState(['meal-1']),
      afterState: makeAfterState(['meal-1', 'meal-3']),
      classificationKeywordsVersion: '1',
    });

    const s1Events = await getSessionEvents('session-1');
    expect(s1Events).toHaveLength(2);
    expect(s1Events[0].eventType).toBe('created');
    expect(s1Events[1].eventType).toBe('extended');

    const s2Events = await getSessionEvents('session-2');
    expect(s2Events).toHaveLength(1);
    expect(s2Events[0].eventType).toBe('created');
  });

  it('returns empty array for non-existent session', async () => {
    const events = await getSessionEvents('nonexistent');
    expect(events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Batch logging from PendingAuditEvent (Phase C integration)
// ---------------------------------------------------------------------------
describe('logSessionEvents — batch from PendingAuditEvent[]', () => {
  it('logs multiple events atomically with shared state snapshots', async () => {
    const pendingEvents: PendingAuditEvent[] = [
      { sessionId: 'session-1', eventType: 'created', triggeredByMealId: 'meal-2' },
      { sessionId: 'session-1', eventType: 'member_added_via_backfill', triggeredByMealId: 'meal-1' },
    ];

    const beforeState = null; // No session existed before
    const afterState = makeAfterState(['meal-1', 'meal-2']);

    const logged = await logSessionEvents(pendingEvents, {
      beforeState,
      afterState,
      classificationKeywordsVersion: '1',
    });

    expect(logged).toHaveLength(2);
    expect(logged[0].eventType).toBe('created');
    expect(logged[0].afterState).toEqual(afterState);
    expect(logged[1].eventType).toBe('member_added_via_backfill');
    expect(logged[1].afterState).toEqual(afterState);

    // Verify persisted
    const allEvents = await getAllSessionEvents();
    expect(allEvents).toHaveLength(2);
  });

  it('handles empty pending events array gracefully', async () => {
    const logged = await logSessionEvents([], {
      beforeState: null,
      afterState: null,
      classificationKeywordsVersion: '1',
    });
    expect(logged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Nullable fields handled correctly
// ---------------------------------------------------------------------------
describe('Nullable fields', () => {
  it('allows null triggeredByMealId', async () => {
    const event = await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'dissolved',
      triggeredByMealId: null,
      beforeState: makeBeforeState(['meal-1', 'meal-2']),
      afterState: null,
      classificationKeywordsVersion: '1',
    });

    expect(event.triggeredByMealId).toBeNull();
  });

  it('allows null beforeState (session creation)', async () => {
    const event = await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'created',
      triggeredByMealId: 'meal-1',
      beforeState: null,
      afterState: makeAfterState(['meal-1']),
      classificationKeywordsVersion: '1',
    });

    expect(event.beforeState).toBeNull();
    expect(event.afterState).not.toBeNull();
  });

  it('allows null afterState (session dissolution)', async () => {
    const event = await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'dissolved',
      triggeredByMealId: 'meal-1',
      beforeState: makeBeforeState(['meal-1', 'meal-2']),
      afterState: null,
      classificationKeywordsVersion: '1',
    });

    expect(event.afterState).toBeNull();
    expect(event.beforeState).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Event ordering preserved (Section 4.7: indexed on triggered_at)
// ---------------------------------------------------------------------------
describe('Event ordering', () => {
  it('events are returned in insertion order', async () => {
    await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'created',
      triggeredByMealId: 'meal-1',
      beforeState: null,
      afterState: makeAfterState(['meal-1']),
      classificationKeywordsVersion: '1',
    });

    await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'extended',
      triggeredByMealId: 'meal-2',
      beforeState: makeBeforeState(['meal-1']),
      afterState: makeAfterState(['meal-1', 'meal-2']),
      classificationKeywordsVersion: '1',
    });

    await logSessionEvent({
      sessionId: 'session-1',
      eventType: 'dissolved',
      triggeredByMealId: 'meal-3',
      beforeState: makeBeforeState(['meal-1', 'meal-2']),
      afterState: null,
      classificationKeywordsVersion: '1',
    });

    const events = await getSessionEvents('session-1');
    expect(events).toHaveLength(3);
    expect(events[0].eventType).toBe('created');
    expect(events[1].eventType).toBe('extended');
    expect(events[2].eventType).toBe('dissolved');

    // Timestamps should be non-decreasing
    for (let i = 1; i < events.length; i++) {
      expect(new Date(events[i].triggeredAt).getTime())
        .toBeGreaterThanOrEqual(new Date(events[i - 1].triggeredAt).getTime());
    }
  });
});
