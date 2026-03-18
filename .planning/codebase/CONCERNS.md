# Codebase Concerns

**Analysis Date:** 2026-03-18

## Tech Debt

**Hardcoded Nightscout credentials:**
- Issue: Nightscout URL and API token are hardcoded as module-level constants, not environment variables
- Files: `src/services/nightscout.ts` lines 1–2
- Impact: Credentials committed to version control; cannot change URL or token without a code change and redeploy; no per-user configuration possible
- Fix approach: Move `NIGHTSCOUT_URL` and `TOKEN` to `EXPO_PUBLIC_` environment variables (same pattern as `EXPO_PUBLIC_ANTHROPIC_API_KEY`), with a settings screen field for the URL to support multi-user use later

**GlucoseStore running sum can drift:**
- Issue: `GlucoseStore.sum` is maintained by incrementally adding/subtracting `sgv` values across multiple writes. Floating-point accumulation across thousands of readings, plus any bug in deduplication, will silently corrupt the 30-day average
- Files: `src/services/storage.ts` lines 125–151
- Impact: `avg30d` and the estimated HbA1c are silently wrong if `sum` drifts. The HbA1c is cached daily so an incorrect value persists for 24 hours
- Fix approach: Recompute `sum` from `readings` on every `updateGlucoseStore` call (single reduce over the kept array) rather than maintaining an incremental total. The array is already in memory at that point so the cost is negligible

**Legacy meal data surfaced as synthetic sessions:**
- Issue: Meals logged before the session system was introduced have no `sessionId`. They are wrapped in synthetic `SessionWithMeals` objects with `legacy_` prefixed IDs at every `loadSessionsWithMeals` call. The matching engine in `src/services/matching.ts` and `MealHistoryScreen` must both tolerate these objects
- Files: `src/services/storage.ts` lines 366–378
- Impact: Growing technical surface area as legacy sessions age out. `glucoseResponse` on legacy sessions pulls from `meal.glucoseResponse` (the old field) not `session.glucoseResponse`, so history cards may show stale curves for old records
- Fix approach: Run a one-time migration at app start to write `sessionId` onto legacy meals and create proper session records; remove the synthetic path once migration is confirmed

**Duplicate `GlucoseResponse` build logic:**
- Issue: The block that builds a `GlucoseResponse` from raw curve readings is copy-pasted verbatim in `fetchAndStoreCurveForMeal` (lines 395–411) and `_fetchCurveForSession` (lines 439–454)
- Files: `src/services/storage.ts`
- Impact: Any bug fix or field addition must be applied in two places; they have already drifted in where the result is written (meal vs session)
- Fix approach: Extract a `buildGlucoseResponse(fromMs: number, readings: CurvePoint[], nowMs: number): GlucoseResponse` pure function and call it from both fetch functions

**`expo-file-system/legacy` import:**
- Issue: `carbEstimate.ts` imports from the `/legacy` sub-path of `expo-file-system`
- Files: `src/services/carbEstimate.ts` line 2
- Impact: The `/legacy` export is a compatibility shim that may be removed in a future Expo SDK upgrade, which would break carb estimation silently
- Fix approach: Migrate to the current `expo-file-system` API (`FileSystem.readAsStringAsync` still exists in the non-legacy export; confirm the encoding API is compatible)

**`InsulinLogScreen` loads tablet name for the wrong type:**
- Issue: The `useEffect` that loads `tabletName`/`tabletDose` from settings runs when `type === 'long-acting'`, but the rendered UI that shows the tablet reminder is also gated on `type === 'long-acting'`. The two conditions are logically equivalent but the effect label says it is for long-acting, making the intent confusing
- Files: `src/screens/InsulinLogScreen.tsx` lines 54–62 and 130–142
- Impact: Minor — will silently not show tablet info if the condition is ever corrected to `type === 'tablets'`; the feature appears to be wired to the wrong screen type
- Fix approach: Decide which type should show tablet info (tablets or long-acting) and align both the `useEffect` condition and the rendered block

## Known Bugs

**`fetchGlucosesSince` silently swallows network errors:**
- Symptoms: If the Nightscout API returns a non-2xx status during a background glucose store update, the function returns `[]` with no error thrown. The store simply receives zero new entries and `lastFetchedAt` is updated, meaning the missed readings are never fetched again
- Files: `src/services/nightscout.ts` line 75
- Trigger: Any temporary Nightscout outage or rate-limiting during the background poll
- Workaround: Manual pull-to-refresh triggers `fetchLatestGlucose` separately, which does throw on error, so the live reading still shows

**HbA1c estimate cached before store is fully populated:**
- Symptoms: On first-ever app load, 30 days of historical data are fetched. If the user opens the app, the HbA1c is computed and cached from whatever partial data has been stored so far, then not recomputed until the next calendar day
- Files: `src/screens/HomeScreen.tsx` lines 61–65, `src/services/storage.ts` lines 179–193
- Trigger: First app launch or after clearing storage
- Workaround: None until midnight when the daily cache expires

**`sum` not validated when loading a corrupt GlucoseStore:**
- Symptoms: `JSON.parse(raw) as GlucoseStore` in `loadGlucoseStore` performs no runtime validation. A corrupt `sum` field (e.g. NaN or a string from a schema migration) will produce a NaN `avg30d` that propagates silently to the HbA1c display
- Files: `src/services/storage.ts` line 111
- Trigger: AsyncStorage corruption, Expo SDK migration that changes how numbers are stored, or a future schema change
- Workaround: None; NaN would render as `—` only if the component checks for it, which it currently does not (`avg30d` is passed directly to `computeAndCacheHba1c`)

## Security Considerations

**Nightscout API token in source code:**
- Risk: `TOKEN = '[REDACTED - move to .env]'` is a hardcoded string in a committed source file. If the repository is ever made public or shared, the Nightscout API token is fully exposed, allowing anyone to read real-time CGM data
- Files: `src/services/nightscout.ts` lines 1–2
- Current mitigation: Repository appears to be private; this is a personal app with a single user
- Recommendations: Move to `EXPO_PUBLIC_NIGHTSCOUT_TOKEN` env var, add `.env` to `.gitignore` if not already present, and rotate the token

**Anthropic API key in client bundle:**
- Risk: `EXPO_PUBLIC_ANTHROPIC_API_KEY` is read at build time and embedded in the JavaScript bundle. Any user who extracts the app bundle can retrieve the key and make API calls charged to the owner's account
- Files: `src/services/carbEstimate.ts` line 4
- Current mitigation: Client-side rate limit of 10 calls/day stored in AsyncStorage — trivially bypassed by clearing app data or running on a second device
- Recommendations: Move carb estimation to a server-side proxy endpoint that holds the API key server-side; the proxy enforces real rate limiting per authenticated user

**No input sanitisation on meal names used in matching:**
- Risk: Meal names are stored raw from user text input and fed into the `tokenize()` function in matching. No length cap is enforced
- Files: `src/services/matching.ts` line 30, `src/services/storage.ts` line 267
- Current mitigation: Single-user personal app; no injection surface
- Recommendations: Enforce a max length (e.g. 200 chars) at the `saveMeal` call site to prevent unbounded AsyncStorage growth

## Performance Bottlenecks

**`loadSessionsWithMeals` builds a full in-memory join on every history load:**
- Problem: Every focus event on `MealHistoryScreen` calls `loadSessionsWithMeals`, which reads all meals, all sessions, and all legacy meals from AsyncStorage, builds a Map, and sorts the full result
- Files: `src/services/storage.ts` lines 352–379, `src/screens/MealHistoryScreen.tsx` line 336
- Cause: No pagination, no lazy loading, no local in-memory cache
- Improvement path: Paginate the history load (most recent 50 items), or cache the merged list in a React context and only invalidate on explicit saves

**`count=9000` on first Nightscout load:**
- Problem: On first app launch (no local store), `fetchGlucosesSince` requests up to 9000 entries. For a 30-day window this is ~8640 readings. The Nightscout API returns them all in one synchronous JSON response, which can be several MB on a slow connection
- Files: `src/services/nightscout.ts` line 73
- Cause: No pagination or chunked fetch; ceiling chosen to cover the maximum 30-day window
- Improvement path: Fetch in weekly chunks on first load; on subsequent loads the incremental delta is small (few dozen entries per poll)

**Full `readings` array stored inside every `GlucoseResponse`:**
- Problem: Each meal's `glucoseResponse.readings` stores up to 36 `CurvePoint` objects (one per 5-minute interval over 3 hours). Each insulin log's `basalCurve.readings` stores up to 144 objects (12 hours). These are serialised into the main `MEALS_KEY` / `INSULIN_LOGS_KEY` AsyncStorage entries
- Files: `src/services/storage.ts` lines 195–206, 18–27
- Cause: Design choice to keep data self-contained; no separate curve store
- Improvement path: Store curves in a separate key keyed by meal/log ID; only load raw curve data when a specific card is expanded

## Fragile Areas

**Session grouping logic in `saveMeal`:**
- Files: `src/services/storage.ts` lines 281–345
- Why fragile: The 3-hour window check, open-session detection, and back-assignment of `sessionId` to historical meals all happen inside a single non-atomic read-modify-write. Concurrent calls (e.g. quick log from HomeScreen while MealLogScreen is also saving) could create duplicate sessions or orphan meals
- Safe modification: Always test with two rapid saves within the 3-hour window; any change to session grouping needs to handle the existing-session, no-session, and legacy-meal cases
- Test coverage: No unit tests

**GlucoseStore deduplication relies on exact epoch-ms match:**
- Files: `src/services/storage.ts` lines 128–134
- Why fragile: `existingDates` is a `Set<number>` of exact `entry.date` values. If Nightscout ever returns the same reading with a slightly different timestamp (e.g. due to a bridge restart), it is stored as a duplicate, inflating `sum` and skewing averages
- Safe modification: Any change to the fetch window or the Nightscout bridge config could introduce duplicates
- Test coverage: None

**Rate limit enforcement for carb estimates is client-side only:**
- Files: `src/services/carbEstimate.ts` lines 18–36
- Why fragile: Usage count is stored in AsyncStorage. Clearing app data, reinstalling, or running on a second device resets the counter. Any change to `DAILY_LIMIT` takes effect immediately but does not backfill existing usage records
- Safe modification: The count and date check in `getRemainingEstimates` must stay in sync with `incrementUsage`; breaking either side silently removes the limit

## Scaling Limits

**AsyncStorage as the sole data store:**
- Current capacity: AsyncStorage on React Native has no documented hard limit but is typically constrained to a few MB per key on iOS and Android. A 30-day glucose store with 8640 readings plus all meal and insulin records could approach 1–2 MB per key after several months of use
- Limit: Performance degrades noticeably on older devices above ~1 MB per key; large JSON parses block the JS thread
- Scaling path: Implement a backend (Node.js + PostgreSQL as planned) with local AsyncStorage as a cache, not the source of truth

**Matching algorithm is O(n²) over sessions:**
- Current capacity: Acceptable under ~200 sessions (sub-millisecond)
- Limit: At 1000+ sessions with full tokenisation and Jaccard scoring, the blocking call in `findSimilarSessions` will noticeably delay history render
- Scaling path: Move matching to a background task or web worker; index tokens at write time rather than computing per-query

## Dependencies at Risk

**`expo-file-system/legacy` sub-path:**
- Risk: The `/legacy` export is explicitly marked for removal in Expo's migration guides. Expo SDK 55+ may drop it
- Impact: `estimateCarbsFromPhoto` would crash at runtime with a module not found error
- Migration plan: Switch to `expo-file-system` non-legacy API before upgrading past Expo SDK 54

**`react-native-dotenv` in devDependencies but `EXPO_PUBLIC_` pattern used:**
- Risk: `react-native-dotenv` (a Babel plugin approach) is installed as a dev dependency, but `carbEstimate.ts` uses the `EXPO_PUBLIC_` prefix pattern (Expo's built-in env var injection). These are two different systems. If `react-native-dotenv` config is ever applied, it may conflict with the `EXPO_PUBLIC_` pattern or shadow variables
- Impact: Potential build-time breakage or silent env var mismatch
- Migration plan: Remove `react-native-dotenv` if it is not actively configured; rely solely on the `EXPO_PUBLIC_` pattern

## Missing Critical Features

**No data backup or export:**
- Problem: All user data lives in AsyncStorage on the device. There is no export, cloud sync, or backup mechanism
- Blocks: Any device loss, reinstall, or OS reset destroys all meal history, glucose curves, and insulin logs permanently

**No authentication or data isolation:**
- Problem: Any app on the device with AsyncStorage access can read all keys (keys use a predictable `glucolog_` prefix). The Nightscout token is readable from the bundle
- Blocks: Multi-user support, cloud sync, any backend integration

**Matching results are computed but never displayed:**
- Problem: `src/services/matching.ts` is fully implemented and tested against sessions, but `findSimilarSessions` is never called from any screen
- Blocks: The "you've eaten this before" feature (Phase 8) depends on this

## Test Coverage Gaps

**Zero tests for the application source:**
- What's not tested: All business logic in `src/services/storage.ts`, `src/services/matching.ts`, `src/services/nightscout.ts`, `src/services/carbEstimate.ts`, and all screens
- Files: All files under `src/`
- Risk: Session grouping bugs, GlucoseStore sum drift, and matching score regressions are invisible until they affect real data
- Priority: High — session grouping and GlucoseStore are the most critical paths with no safety net

**No integration tests for Nightscout API response parsing:**
- What's not tested: `fetchLatestGlucose`, `fetchGlucosesSince`, `fetchGlucoseRange` response shape assumptions. If Nightscout changes the `direction` field format or adds nulls, the app silently breaks
- Files: `src/services/nightscout.ts`
- Risk: Silent data corruption or crash on CGM bridge updates
- Priority: Medium

---

*Concerns audit: 2026-03-18*
