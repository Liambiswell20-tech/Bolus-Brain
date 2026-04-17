---
phase: 11-supabase-migration-multi-user-backend
plan: 06
subsystem: database
tags: [supabase, migration, upsert, asyncstorage, idempotent, chunked]

# Dependency graph
requires:
  - phase: 11-01
    provides: "storage.ts consolidated exports (loadMeals, loadEquipmentChangelog, loadDataConsentRaw, STORAGE_KEYS)"
  - phase: 11-02
    provides: "lib/supabase.ts client, types/supabase.ts row types, migrations/001_initial.sql schema"
  - phase: 11-04
    provides: "AuthContext with useAuth hook (session, signOut)"
provides:
  - "Idempotent migration runner (migrateToSupabase) with chunked upserts and progress callback"
  - "getMigrationStatus() for checking if migration has been completed"
  - "dataSharingFilter() enforcement helper for future aggregation queries"
  - "SettingsScreen Cloud Backup section with migration button and progress UI"
  - "SettingsScreen sign-out button in Account section"
affects: [11-08, phase-12]

# Tech tracking
tech-stack:
  added: []
  patterns: [chunked-upsert-50, idempotent-migration-via-onConflict, progress-callback-pattern]

key-files:
  created:
    - src/services/migration.ts
  modified:
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "Chunked at 50 rows per request for PostgREST body limit safety with glucose_response JSONB"
  - "MIGRATION_COMPLETED_KEY only set on full success (partial failure allows retry)"
  - "Tablets excluded from migration entirely (no Supabase table, not counted in totals)"
  - "AsyncStorage NEVER wiped (absolute rule from CLAUDE.md)"
  - "dataSharingFilter SQL helper exported for future aggregation query enforcement"

patterns-established:
  - "Chunked upsert pattern: chunkArray(data, 50) + for-of with break-on-error"
  - "Migration progress callback: onProgress(MigrationProgress) with stage/total/migrated/currentCollection"
  - "Idempotency via UNIQUE(user_id, client_id) + upsert with onConflict"

requirements-completed: [SUPA-06, SUPA-07]

# Metrics
duration: 14min
completed: 2026-04-17
---

# Phase 11 Plan 06: Migration Runner & Settings Integration Summary

**Idempotent chunked migration runner with progress UI in Settings, sign-out button, and data sharing enforcement helper**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-17T19:10:04Z
- **Completed:** 2026-04-17T19:24:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Idempotent migration runner that copies all AsyncStorage data to Supabase via chunked upserts (50 rows/request)
- Progress reporting with current collection name and migrated/total counts
- Partial failure reports which collections failed with retry support
- SettingsScreen "Migrate my data to the cloud" button with live progress
- Sign-out button added to Account section with user email display
- Data sharing enforcement helper (dataSharingFilter) for future aggregation queries
- Tablets correctly excluded from migration (no Supabase table exists)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create idempotent migration runner** - `402888e` (feat)
2. **Task 2: Add migration button and sign-out to SettingsScreen** - `03a964f` (feat)

## Files Created/Modified
- `src/services/migration.ts` - Idempotent chunked migration runner with progress callback and data sharing enforcement helper (314 lines)
- `src/screens/SettingsScreen.tsx` - Cloud Backup section with migration button, progress UI, partial/failed states; Account section with email and sign-out

## Decisions Made
- Chunked at 50 rows per request: safe for PostgREST body limits even with glucose_response JSONB payloads
- MIGRATION_COMPLETED_KEY only set on full success: partial failure allows user to retry without data loss
- Tablets excluded entirely from migration: no Supabase table in schema, not counted in progress totals
- dataSharingFilter returns raw SQL string for future server-side aggregation enforcement
- Account section enhanced with email display and sign-out rather than creating separate section

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired.

## Next Phase Readiness
- Migration runner ready for user testing
- SettingsScreen has all migration + sign-out UI
- Plan 08 (sync engine) can build on the migration patterns established here

## Self-Check: PASSED

---
*Phase: 11-supabase-migration-multi-user-backend*
*Completed: 2026-04-17*
