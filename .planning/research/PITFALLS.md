# Pitfalls Research

**Domain:** T1D personal tracking app — pattern recognition, glucose visualisation, history features
**Researched:** 2026-03-18
**Confidence:** HIGH (codebase analysis + established regulatory/domain knowledge)

---

## Critical Pitfalls

### Pitfall 1: Regulatory Drift — Language That Crosses Into Advice

**What goes wrong:**
A feature framed as "showing history" gradually acquires language that implies action. The app starts saying "last time you ate this, you took 8 units" (historical fact) and drifts into "you typically need 8 units for this meal" (recommendation). This is the single most dangerous pitfall. Under MHRA guidance, Software as a Medical Device (SaMD) classification is triggered when software is *intended* to influence a clinical decision — and "intended" is partly inferred from the UI language and marketing copy. A personal tracking app becomes regulated SaMD the moment it suggests, recommends, or predicts dosing behaviour rather than neutrally recalling historical facts.

**Why it happens:**
Pattern recognition naturally produces comparative statements. Developers add words like "usually", "typically", or "suggests" to make patterns feel useful. The boundary is easy to cross in a single UI string change. Marketing copy compounds this: landing pages that say "helps you dose correctly" or "tells you how much insulin to take" can trigger MHRA scrutiny even if the in-app language is clean.

**How to avoid:**
Every UI string that surfaces a pattern must pass a one-sentence test: "Is this telling the user what they did, or what they should do?" Enforce a fixed vocabulary:
- SAFE: "Last time you ate this, you took X units and your glucose peaked at Y mmol/L"
- SAFE: "3 similar meals in history — glucose peaked at 9.2, 11.4, and 8.7 mmol/L"
- UNSAFE: "You typically need X units for this meal"
- UNSAFE: "Suggested dose: X units"
- UNSAFE: "This worked well last time" (implies prescriptive success framing)

Traffic light badges (Green/Amber/Red) must label the glucose outcome, not the dose decision. "Glucose stayed in range" (GREEN) is safe. "Good dose" is not. The badge describes what the glucose did, not whether the user made the right call.

Maintain a written regulatory decision log (PROJECT.md already references this). For each new feature, document the framing rationale before building it.

**Warning signs:**
- Any UI string containing "suggest", "recommend", "should", "need to", "try", "ideal", "optimal"
- Pattern features that display a single number without historical spread (implies a target)
- Marketing copy on the landing page that references dosing accuracy
- AI carb estimate confidence score UI that implies the user "got it wrong" (could constitute dosing-adjacent advice)

**Phase to address:**
Every phase that adds pattern-surfacing UI. Establish a string review checklist in Phase 1 of this milestone and apply it to every new screen.

---

### Pitfall 2: AsyncStorage Performance Collapse Under History Load

**What goes wrong:**
The full meal history, all insulin logs, and all glucose curves are loaded on every visit to MealHistoryScreen. Each meal's `glucoseResponse.readings` holds up to 36 curve points; each insulin log's `basalCurve.readings` holds up to 144 points. After 6–12 months of daily use, the combined `MEALS_KEY` and `INSULIN_LOGS_KEY` JSON blobs can exceed 1–2 MB. Large JSON parses block the React Native JS thread, causing visible frame drops on history scroll and a freeze on screen focus. On older iPhones (A12 and below) or budget Android devices, this becomes unusable before the year is out.

**Why it happens:**
The current design stores curves inline in the parent record (meal or insulin log). This was the right call for early phases — it keeps each record self-contained and avoids join complexity. But expandable history cards mean the full curve data for every meal is now loaded upfront, even if only 3 cards are visible on screen.

**How to avoid:**
Separate curve storage from summary storage before adding expandable cards. Store `GlucoseResponse.readings` in a separate AsyncStorage key keyed by meal or session ID (e.g. `glucolog_curve_<mealId>`). The history list loads only summary fields (startGlucose, peakGlucose, timeToPeakMins, outcome badge). Curve data is fetched lazily when a card is expanded. This reduces the main list blob by roughly 60–70% and means curve fetches are amortised across user interaction.

Additionally, paginate `loadSessionsWithMeals` to return the most recent 50 items. The in-memory join across all sessions is O(n) but the AsyncStorage parse is the bottleneck.

**Warning signs:**
- MealHistoryScreen focus takes >200ms on a development build (use React Native's `--perf` flag or Flipper)
- `MEALS_KEY` blob exceeds 500 KB (check with a debug log of the raw string length)
- User reports history "freezing" after several months of use
- The app pauses noticeably when navigating back from MealLogScreen (re-focus triggers reload)

**Phase to address:**
Before expanding history cards or adding day-folder grouping. This is a prerequisite to the expandable card UI, not an afterthought.

---

### Pitfall 3: Glucose Graph UX — Too Much Data, Wrong Time

**What goes wrong:**
Glucose graphs built for health apps tend to over-display: every reading, gridlines, axis labels, numeric annotations, and a legend, all visible simultaneously. This fails the mealtime one-handed use constraint. The user has food in one hand. They need to see the shape of the curve quickly, not read numbers off an axis. A common secondary mistake is rendering the graph with no loading state — the chart area is blank for 1–2 seconds while AsyncStorage loads, which looks broken.

A third mistake specific to CGM graphs: displaying mg/dL-scale data without rechecking the conversion boundary. The Nightscout API returns `sgv` in mg/dL. If any graph component receives raw `sgv` values instead of converted mmol/L values, the y-axis shows numbers in the 70–200 range instead of 4–12, and the visual scale is completely wrong. This is a silent correctness failure.

**Why it happens:**
Charting library defaults are calibrated for desktop dashboards, not mobile glanceable UIs. Developers add the chart and accept default options without adapting them for one-handed mobile use. The unit conversion failure happens because the graph receives data from a different code path than the existing text displays, bypassing the existing conversion.

**How to avoid:**
Define a fixed graph specification before writing any chart code: one visible y-axis label (the current value), no x-axis labels (use time markers like "1h ago" instead of timestamps), coloured band for the in-range zone (3.9–10.0 mmol/L) rather than gridlines, and curve only (no dot markers). The graph must show a skeleton/shimmer immediately on mount, before data loads.

For unit safety: create a single `toMmol(sgv: number): number` utility that is the only place in the codebase where mg/dL to mmol/L conversion happens. Every data path that flows into any chart must pass through this function. The current `nightscout.ts` already does this conversion at the API boundary — confirm that no raw `sgv` value escapes that boundary into storage or display.

**Warning signs:**
- Y-axis values above 20 in any glucose chart (indicates mg/dL leak)
- Graph component has more than 3 configurable visual options passed as props (complexity creep)
- Chart renders with a blank flash on first mount (missing loading state)
- User cannot interpret the graph within 2 seconds of looking at it (test with another person)

**Phase to address:**
Interactive glucose graph (HomeScreen tap) phase. Establish the graph specification document and the unit conversion audit before any chart library is installed.

---

### Pitfall 4: Pattern Recognition Framing — Statistical Confidence Without Statistical Validity

**What goes wrong:**
The matching engine surfaces "similar meals" after as few as 1 previous match. If a user has eaten a meal twice and the second time had a very different glucose response (different starting glucose, stress, time of day, exercise), showing both results as a "pattern" implies a consistency that does not exist. Worse, showing a single previous result implies it is the expected outcome. T1D glucose responses are highly variable — insulin sensitivity changes hourly with activity, hormones, illness, and sleep. A pattern shown from 2–3 data points can actively mislead.

**Why it happens:**
Developers ship the matching UI as soon as the algorithm is ready, without considering the minimum data required for a meaningful pattern. The algorithm returns results — therefore the UI shows results. The 90-day data gate in PROJECT.md addresses "pattern reports" but the "you've eaten this before" card has no minimum match count defined.

**How to avoid:**
Define and enforce minimum thresholds before any pattern is surfaced:
- "You've eaten this before" card: require at least 2 previous matches (not 1) so there is always a spread, never a single implied "correct" outcome
- Traffic light badges: require at least 3 data points before showing a badge on a pattern (not on individual meals)
- Always show the spread, never just the average. "Glucose peaked at 9.2, 11.4, and 8.7 mmol/L" is honest. "Average peak: 9.8 mmol/L" hides variability and implies more consistency than exists
- Label starting glucose on historical matches — a match that started at 5.0 is not comparable to one that started at 9.0

**Warning signs:**
- Any UI that shows a single historical data point as if it is representative
- Averages or "typical" numbers displayed without showing the underlying spread
- Pattern cards appearing after the user's first meal log (too early)
- Match cards that don't display starting glucose of historical sessions

**Phase to address:**
"You've eaten this before" UI phase. Write the minimum-data rules before the UI design, not after.

---

### Pitfall 5: AI Carb Estimate Confidence Score Crossing Into Dosing Advice

**What goes wrong:**
The planned "AI carb estimate confidence model" (PROJECT.md) tracks whether the estimate agreed with the glucose outcome. If surfaced carelessly, this becomes "your carb estimate was wrong, causing your high glucose" — which is dosing-adjacent advice. The MHRA concern is not just direct dosing recommendations but any feature that creates a feedback loop from glucose outcome to food/insulin decision-making, especially if framed as corrective guidance.

**Why it happens:**
The feature is genuinely useful — knowing that the AI's estimate for "pad thai" tends to be too low is valuable calibration data. But the framing difference between "the AI estimated 60g carbs; your glucose peaked at 14.2 mmol/L — higher than other similar meals" (historical fact, multiple variables acknowledged) and "the AI underestimated carbs; consider adjusting" (recommendation) is a single sentence rewrite.

**How to avoid:**
The confidence score must be framed as estimate accuracy, not outcome prediction. "The AI's estimate for meals like this has been within 15% of your typical response 4 out of 5 times" describes estimation reliability. Never frame it as "you should expect X from this estimate." Surface it as a calibration indicator, not a dosing signal.

If this feature is built before MHRA informal guidance is obtained, keep it behind a feature flag and exclude it from marketing copy.

**Warning signs:**
- Confidence score UI that displays next to insulin logging fields (spatial proximity implies dosing relationship)
- Wording like "estimate was too low" without explicitly listing all variables that affect glucose response
- Any UI that combines carb estimate confidence + glucose outcome + a call to action

**Phase to address:**
AI carb confidence model phase — likely a later milestone. Requires MHRA informal guidance email first (already in PROJECT.md backlog).

---

### Pitfall 6: GlucoseStore Sum Drift Corrupting HbA1c

**What goes wrong:**
This is an existing known bug (CONCERNS.md). The incremental `sum` field in `GlucoseStore` drifts from floating-point accumulation and potential deduplication misses. The HbA1c estimate is cached daily from this corrupted sum, so a wrong value persists for up to 24 hours. As the rolling window grows and more history is added, the drift compounds. When the new milestone adds HbA1c disclaimer UX (the modal on tap), a visibly wrong HbA1c number next to a disclaimer that says "consult your diabetes team" looks worse than no HbA1c at all — the user will trust the number despite the disclaimer.

**Why it happens:**
Incremental running totals are standard practice in streaming contexts. In an AsyncStorage context with async reads and writes, there is no transaction boundary — a failed write that was partially applied leaves the sum in an inconsistent state. The fix (recompute from array on every update) was identified but not shipped before Phase 8 began.

**How to avoid:**
Fix the sum drift before adding any HbA1c-adjacent UI. The fix is simple: replace the incremental sum with `readings.reduce((acc, r) => acc + r.sgv, 0)` on every `updateGlucoseStore` call. This is O(n) over the kept readings array which is already in memory. Do not ship the HbA1c disclaimer modal until this fix is in — the disclaimer draws attention to the number, which makes correctness more important, not less.

Also add runtime validation on `loadGlucoseStore`: if `sum` is NaN or the store schema is unexpected, reset to a clean state rather than propagating NaN to the HbA1c display.

**Warning signs:**
- HbA1c estimate changes by more than 0.2% between consecutive daily recomputations without a significant change in average glucose
- `avg30d` displayed in the UI is outside the range 3.0–20.0 mmol/L (indicates NaN propagation)
- The sum field in the stored JSON does not equal the sum of the readings array (verify with a one-time debug log)

**Phase to address:**
First phase of this milestone, as a tech debt prerequisite before any HbA1c UI work.

---

### Pitfall 7: Expandable History Cards Breaking Scroll Performance

**What goes wrong:**
FlatList (or ScrollView) in React Native has well-documented performance issues when list items change height dynamically. Expandable cards that animate height from 0 to `auto` (or measure with `onLayout`) cause the list to re-measure its entire layout on every expand/collapse, blocking the JS thread and producing dropped frames. The problem is invisible with 10 items in development and severe with 60+ items in production.

**Why it happens:**
`LayoutAnimation` and `Animated.timing` on height work smoothly when tested with a short list. The `onLayout` callback triggers re-render of surrounding items in a VirtualizedList, which compounds at scale. Day-folder grouping (planned in PROJECT.md) makes this worse because section headers add another layer of measurement.

**How to avoid:**
Use a fixed maximum expanded height rather than `auto`/content height. Define the expanded card height as a constant based on the content you know will be in it (summary stats + graph canvas of fixed height). Animate max-height from 0 to the constant, not from 0 to measured content height. This eliminates `onLayout` re-measurement entirely. The graph canvas height must be declared before the chart library is chosen — pick a library that accepts fixed dimensions (Victory Native, react-native-svg-charts) over one that requires layout measurement (some Recharts ports).

**Warning signs:**
- Using `LayoutAnimation.configureNext` on a FlatList item that has siblings below it (triggers full re-layout)
- Expanded card height calculated from `onLayout` callback (will re-measure on every expand)
- FlatList with `keyExtractor` tied to a value that changes on expand (causes full re-render)
- Smooth at 10 items in dev, janky at 50 in release build

**Phase to address:**
Expandable history cards phase. Decide on fixed heights before implementing animation.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline curve storage in meal records | Self-contained records, simple reads | History list blob grows with every meal; parse time scales with meal count | Phase 1–7 only — must separate before expandable cards are shipped |
| No pagination on history load | Simple implementation, no cursor state | Full in-memory join on every screen focus; will freeze on older devices after ~6 months | Never acceptable beyond ~100 sessions |
| Incremental GlucoseStore sum | Avoids O(n) reduce on every poll | Silent sum drift; HbA1c corruption that persists 24h | Never — fix before HbA1c is prominently surfaced |
| Client-side rate limit for carb estimation | Quick to implement | Trivially bypassed; real cost exposure if app becomes multi-user | Only while app is single-user with no public distribution |
| No tests on session grouping | Faster iteration | Regression invisible until it corrupts real meal data | Never — this is the core data integrity path |
| Single AsyncStorage key for all sessions | Simple architecture | Key size grows unboundedly; 1MB+ parses block JS thread | Phase 1–7 only — needs key-per-session or indexed store before scale |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Nightscout API | Treating `direction` field as an enum — it can be absent, null, or use alternate strings (e.g. `"NONE"`, `"NOT COMPUTABLE"`) depending on the CGM bridge version | Guard every direction access with a null/unknown fallback; never assert the field is one of the known directions |
| Nightscout API | Treating `date` as a reliable unique key for deduplication — bridge restarts can emit the same reading with a millisecond offset | Deduplicate on a `±5 second` window, not exact epoch match |
| Nightscout API | Fetching `count=9000` without pagination on first load — can be several MB of JSON on a slow connection, blocking the UI for several seconds | Fetch in weekly chunks on first load; use incremental delta on subsequent polls |
| Claude API (carb estimation) | API key embedded in the client JS bundle — extractable from the app binary | Move carb estimation to a server-side proxy before any public distribution; the current 10/day client-side limit is trivially bypassed |
| AsyncStorage | Reading the same key from multiple concurrent async calls without a mutex — `saveMeal` already has a race condition between session detection and session creation | Serialise writes to session/meal storage through a queue; never read-modify-write from concurrent paths |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full history load on every screen focus | Noticeable pause when navigating to history; gets worse each month | Paginate to 50 most recent; cache merged list in context; invalidate on save only | ~100 sessions (~3–4 months daily use) |
| Inline curve data in meal records | History list parse time grows linearly with meal count | Separate curve storage; lazy-load on card expand | ~150 meals (~5 months daily use) |
| O(n²) Jaccard matching over all sessions | Visible delay when history loads with matching enabled | Move matching to background task; index tokens at write time | ~200 sessions (~6–7 months daily use) |
| Glucose graph rendering all 288 daily readings | Graph re-renders slowly; 30-day graph has 8640 data points | Downsample to one point per 15 minutes for display; keep full data in store | Any 30-day graph at full resolution |
| `LayoutAnimation` on expandable FlatList items | Dropped frames on expand/collapse; worse with day-folder grouping | Fixed card heights; animate max-height to a constant | Any list with >30 items |
| GlucoseStore sum incremental update | HbA1c silently wrong; compounds over time | Recompute from array on every update | From first floating-point accumulation error |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Anthropic API key in client JS bundle | Anyone who extracts the app bundle can make API calls billed to the owner; no real rate limiting possible client-side | Move to a server-side proxy endpoint before any public distribution |
| Nightscout token in source file or bundle | Real-time CGM data (glucose levels, trends) is exposed to anyone with the token; this is sensitive health data | Move to `.env` with `EXPO_PUBLIC_` prefix; rotate immediately if ever committed; add settings screen for user-provided token |
| AsyncStorage keys with predictable prefix (`glucolog_*`) | Any malicious app granted storage access can read all meal, insulin, and glucose data without authentication | Acceptable for a personal single-user app; unacceptable if app becomes multi-user or distributed |
| No input length cap on meal names | Unbounded meal names can grow `MEALS_KEY` indefinitely; long strings can also cause slow tokenisation in the matching engine | Enforce 200-character maximum at `saveMeal` call site |
| HbA1c displayed without explicit confidence bounds | Users may act on an estimated HbA1c as if it were a lab result | Always label as "estimated", show the range it's derived from, and gate prominent display behind the disclaimer modal |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Glucose graph with numeric axis labels | User cannot read the graph one-handed at a glance; cluttered on small screens | Coloured in-range band (3.9–10.0); single current reading label; no axis numbers |
| Showing a single historical match as "the pattern" | User interprets one previous outcome as what to expect; T1D variability makes this actively misleading | Always show spread across all matches; never show a single number without context |
| Traffic light badge that implies dose quality | "Green = good dose" frames the app as evaluating the insulin decision — regulatory risk and factually wrong (many variables affect outcome) | Badge labels glucose outcome only: "Glucose in range", "Glucose high", "Glucose low" |
| "You've eaten this before" card appearing too soon | With only 1 match, the card implies false certainty; user trusts a sample of 1 | Minimum 2 previous matches before card appears |
| Day-folder grouping without sticky headers | User loses date context when scrolling through a long day's entries | Sticky section headers for day folders; always visible at top of section |
| HbA1c displayed without disclaimer on the main screen | Users may treat the estimate as equivalent to an NHS lab result and not seek proper testing | Show disclaimer label inline (not just on tap modal); "est." prefix always visible |
| Graph blank-loading on first mount | Looks broken; user may think the app crashed | Skeleton/shimmer on graph canvas immediately on mount; real data replaces it |
| Editing insulin doses without audit trail | User corrects a typo but loses the original value; if original was used in a glucose curve calculation, the stored curve now disagrees with the stored dose | Append-only corrections with a "corrected" flag; display the final value but preserve the original |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **"You've eaten this before" UI:** Card appears — but verify: does it only appear for >=2 historical matches? Does it show the starting glucose of each historical session? Does it show glucose spread, not average? Is language purely historical?
- [ ] **Traffic light badges:** Badge renders — but verify: is the label describing glucose outcome, not dose quality? Is the colour threshold matching app-wide colour constants (red <3.9, green 3.9–10.0, orange >10.0)? Is it absent when fewer than 3 data points exist?
- [ ] **Interactive glucose graph:** Graph renders — but verify: are y-axis values in mmol/L (not mg/dL)? Does it show a skeleton before data loads? Is it readable without axis labels? Can it be dismissed one-handed?
- [ ] **Expandable history cards:** Cards expand — but verify: is the expanded height fixed, not measured? Does FlatList scroll stay smooth with 60+ items? Is curve data loaded lazily (not on list mount)?
- [ ] **HbA1c disclaimer modal:** Modal appears on tap — but verify: is the GlucoseStore sum fix shipped first? Is "est." always visible in the inline display (not just in the modal)? Is the modal non-blocking (dismissible with one tap)?
- [ ] **Day folder grouping:** Groups appear — but verify: do section headers stick on scroll? Do legacy meals (pre-session) appear correctly in their day group? Is the expand/collapse of a day group animated without dropping frames?
- [ ] **Dose editing:** Edit saves — but verify: is the original value preserved (audit trail)? Is the corrected dose used for any future matching/pattern calculations? Is there an undo path?
- [ ] **Pattern matching UI:** Matches display — but verify: is `findSimilarSessions` called in a non-blocking way (not on the main render path)? Does the UI handle zero matches gracefully with no empty card?

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Regulatory language drift discovered post-release | HIGH | Audit every UI string against the safe vocabulary checklist; ship a patch; document the corrected framing in the regulatory log; if advice language was in marketing copy, update landing page immediately |
| AsyncStorage history blob causes freeze | MEDIUM | Ship curve storage separation as a hotfix; data migration at app start moves curve readings to separate keys; old records remain valid (summary fields still in meal record) |
| GlucoseStore sum has drifted significantly | LOW | Recompute sum from readings array on next app launch; cache is invalidated; HbA1c is recomputed from correct data within 24 hours; no data loss |
| mg/dL values leaked to a glucose graph | MEDIUM | The graph y-axis will show values 70–200+ instead of 4–12; detectable immediately in testing; fix is ensuring graph data path goes through the existing `sgv / 18` conversion at the API boundary |
| Pattern card shows single match implying certainty | LOW | Update the minimum-match threshold in the matching UI; existing single-match cards are hidden; no data changes required |
| Session grouping race condition creates duplicate sessions | HIGH | Requires a de-duplication pass over stored sessions; affected meals need their `sessionId` repointed; no automated recovery path currently — prevention is the only strategy |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Regulatory language drift | Every phase — establish string review checklist in Phase 1 | Manual review of every new UI string against safe vocabulary before merge |
| AsyncStorage history performance | Before expandable cards | Benchmark history load time on release build with 100+ sessions before shipping expandable UI |
| Glucose graph unit error (mg/dL leak) | Interactive graph phase | Automated check: assert all displayed glucose values are in range 2.0–25.0 mmol/L |
| Pattern framing with insufficient data | "You've eaten this before" UI phase | Confirm minimum 2-match threshold is enforced in matching call sites before UI ships |
| AI confidence score crossing into advice | AI confidence model phase (future milestone) | MHRA informal guidance obtained and documented before feature is built |
| GlucoseStore sum drift | First phase of current milestone (tech debt prerequisite) | After fix: verify sum equals `readings.reduce` result in a debug log |
| Expandable card scroll performance | Expandable history cards phase | FlatList frame rate stays above 55fps with 60+ items expanded/collapsed on a mid-range device |
| Session grouping race condition | Tech debt phase | Serialise session writes through a mutex or queue; add at least one integration test for concurrent rapid saves |
| HbA1c displayed before sum fix | Before HbA1c disclaimer modal ships | GlucoseStore sum fix and NaN guard are merged and verified before modal PR is opened |
| Traffic light badge implying dose quality | Traffic light badge phase | Review badge label text against regulatory language checklist; badge describes glucose, not decision |

---

## Sources

- Codebase analysis: `C:/Users/Liamb/bolusbrain-app/.planning/codebase/CONCERNS.md` — confirmed existing bugs, performance bottlenecks, and fragile areas
- Project requirements: `C:/Users/Liamb/bolusbrain-app/.planning/PROJECT.md` — constraints, out-of-scope items, regulatory framing decisions
- MHRA SaMD classification framework (training knowledge, HIGH confidence): The MHRA's "Decide if your software is a medical device" guidance establishes that software is SaMD when its *intended purpose* is to influence a clinical decision. Personal tracking/logging without dosing recommendations or predictions is generally outside this boundary.
- IMDRF SaMD framework (training knowledge, HIGH confidence): The international SaMD classification uses "intended use" as the primary test. Historical recall features are logging tools; features that generate dosing signals are decision support and trigger classification.
- React Native FlatList performance (training knowledge, HIGH confidence): Dynamic item height measurement via `onLayout` in VirtualizedList is a documented source of frame drops; fixed heights are the standard mitigation.
- T1D glucose variability (clinical fact, HIGH confidence): Insulin sensitivity in T1D varies significantly within a single day due to activity, hormones, stress, and illness. Small sample sizes (1–3 data points) are not statistically meaningful for inferring expected glucose response.
- AsyncStorage size characteristics (training knowledge, MEDIUM confidence): No documented hard limit exists, but practical performance degrades above approximately 1 MB per key on JS thread parse time on mid-range React Native devices.

---
*Pitfalls research for: BolusBrain — T1D tracking app, pattern recognition and history milestone*
*Researched: 2026-03-18*
