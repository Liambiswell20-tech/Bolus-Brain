# Feature Research

**Domain:** T1D personal meal and insulin tracking app (Expo / React Native, device-local)
**Researched:** 2026-03-18
**Confidence:** MEDIUM — WebSearch and WebFetch unavailable this session. All findings drawn from training data (cutoff August 2025), covering Dexcom Clarity, LibreView, mySugr, Spike, Gluroo, Sugarmate, Loop, Trio, iAPS, Nightscout UI, and health app UX research. Confidence levels noted per item.

---

## Feature Landscape

### Table Stakes (T1D Users Expect These)

Features that T1D users assume exist in any glucose-aware tracking app. Missing these makes the app feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Confidence | Notes |
|---------|--------------|------------|------------|-------|
| Colour-coded glucose reading at a glance | Every CGM app (Libre, Dexcom, Nightscout) uses red/green/amber — it is the universal T1D visual grammar | LOW | HIGH | Already built — red <3.9, green 3.9–10, orange >10. This is the correct UK clinical split. |
| Trend arrow on live reading | CGM hardware displays trend arrows; users navigate by arrow + number together, not number alone | LOW | HIGH | Already built in GlucoseDisplay component. |
| Historical log sorted newest-first | Users refer back to today and yesterday first; oldest entries almost never consulted | LOW | HIGH | Already built in MealHistoryScreen. |
| Expandable/detail view on log entries | Health logs accumulate fast; glanceable card + tap-for-detail is universal mobile health pattern | MEDIUM | HIGH | Not yet built. Currently cards show all data inline. Tap-to-expand is expected by users familiar with Apple Health, mySugr, LibreView. |
| Day grouping in history | Users think in days ("what did I eat Monday?"); flat newest-first lists become unusable past ~20 entries | MEDIUM | HIGH | Not yet built. Standard in Apple Health, Dexcom Clarity, mySugr. Section headers (Today / Yesterday / Mon 16 Mar) are the universal pattern. |
| Glucose graph for recent period | Seeing the curve is why users use CGM — graph with time axis is the primary view in Dexcom, LibreView, Nightscout, Sugarmate | MEDIUM | HIGH | Not yet built. Expected to be reachable from home screen. At minimum: 12h or 24h rolling window. |
| Post-meal curve visible per meal entry | Users want to see "what happened after I ate that" — this is the core value loop | MEDIUM | HIGH | Partially built — GlucoseResponse data exists and is rendered in GlucoseResponseCard. Needs expandable card to become fully accessible. |
| Ability to correct a logged entry | Users mistype insulin units — if you cannot fix it, the history becomes distrusted and abandoned | MEDIUM | HIGH | Not yet built. Dose editing flagged in PROJECT.md. Users who can't edit stop trusting the log. |
| Clear insulin log entries | Users need to verify what they took — basic safety hygiene | LOW | HIGH | Already built (InsulinLogCard in history). |
| HbA1c estimate disclaimer | Any app showing HbA1c proxy MUST communicate that it is an estimate, not a diagnostic value — this is both UX honesty and MHRA safety framing | LOW | HIGH | Flagged in PROJECT.md. Modal on tap is correct approach. |

### Differentiators (Competitive Advantage for BolusBrain)

Features that set BolusBrain apart. Not table stakes — T1D users would be surprised to find these, and pleased.

| Feature | Value Proposition | Complexity | Confidence | Notes |
|---------|-------------------|------------|------------|-------|
| "You've eaten this before" surface at log time | Matching engine already exists — no competitor surfaces this inline during meal logging. mySugr and Gluroo show food history but not similarity matching with glucose outcome. | MEDIUM | HIGH | Matching engine (Jaccard, 75% meal + 25% insulin, threshold 0.25, max 5 results) is built in `matching.ts`. The UI layer is what's missing. Show at meal log time AND in history. |
| Traffic light outcome badges | Green/Orange/Red on history cards anchors the "what happened" question immediately. Competitors (Dexcom Clarity, LibreView) show graphs but not per-meal outcome badges. mySugr uses star ratings (user-assigned) not auto-derived outcomes. | MEDIUM | HIGH | Badges auto-computed from GlucoseResponse make history scannable. Critical design rule: label must say "glucose stayed in range" not "good bolus" — the framing must be descriptive not evaluative. |
| AI carb estimate with confidence surfacing | No mainstream T1D app does photo-based carb estimation with a per-user confidence track record. Carb estimation apps (Calorie Mama, Noom) exist but without glucose outcome linkage. | HIGH | MEDIUM | Confidence model requires enough outcome data to be meaningful. Surface only after sufficient history (suggest 10+ meals with completed curves). Flag "this type of meal has been underestimated before" is high value. |
| Long-acting insulin window tracking (10pm–7am) | Long-acting (Lantus/Tresiba/Levemir) timing and dose are critical but no app models the overnight window specifically. Loop/Trio model basal rates, not fixed-dose long-acting. | MEDIUM | HIGH | Bedtime reading (10pm window) + morning reading (7am next day) as a pair. Surface: "Last night: 6.2 → this morning: 5.8" per long-acting dose. This is genuinely novel for a simple tracking app. |
| Outcome-weighted meal matching | Surfacing only the matched sessions where the user stayed in range (Green outcome) vs where they went high or low — competitors do not do this. | HIGH | MEDIUM | Requires traffic light to be built first. When showing "you've eaten this before," annotating each match with its outcome gives the user genuine signal without prescribing doses. |
| Pattern report gated at 90 days | Honest data discipline — most apps show statistics with 3 days of data. Gating at 90 days for trend conclusions is medically honest and differentiating. | LOW | HIGH | Already a stated decision in PROJECT.md. Should be communicated to user when they try to access pattern views early ("Come back in X days for meaningful patterns"). |

### Anti-Features (Things to Deliberately NOT Build)

Features that seem helpful but cross into dangerous territory — legally, medically, or in terms of user trust erosion.

| Feature | Why Users Request It | Why It's Problematic | Correct Alternative |
|---------|---------------------|---------------------|---------------------|
| "Suggested dose" based on pattern | Most requested feature in T1D communities — users want the app to "tell them what to take" | This is Software as a Medical Device (SaMD) under MHRA/MDR. Dosing advice requires clinical validation, regulatory clearance, indemnity. A wrong suggestion causes hospitalisation. | Frame as "Last time you ate similar food with similar glucose, you took X units and stayed in range." The user makes the decision — BolusBrain only recalls the fact. |
| "Your average is improving" encouragement nudges | Engagement pattern from fitness apps — celebrate streaks, progress | T1D management is not gamifiable without harm. High glucose is sometimes unavoidable (illness, stress, hormones). "You're doing great!" during a sick week is patronising and factually wrong. | Show data without valuation. "Your 30-day average is 7.2 mmol/L" with no smiley face or judgement. |
| Predicted glucose in X minutes | Algorithmically interesting, highly requested | Requires CGM predictive modelling (Loop/iAPS does this with Medtronic pumps, not FreeStyle Libre). False predictions during sport or illness erode trust catastrophically. | Show trend arrow + trend direction. Leave extrapolation to the user's experience. Explicitly defer until MHRA guidance obtained. |
| Carb counting goal / daily carb budget | Popular in general diet apps | T1D carb management is not about budgets — it is about matching insulin to carbs eaten. A "carb budget" implies restriction is the goal, which conflicts with medical guidance (eat what you need, match insulin accordingly). | Show carb totals per meal for context, never with a target or goal attached. |
| Social sharing / community comparison | Community features drive engagement and revenue | "My HbA1c is better than yours" comparisons in T1D communities are known to cause psychological harm. T1D outcomes are heavily influenced by factors outside the user's control (hormones, illness, CGM calibration). | Solo personal tool only. No leaderboards, no sharing, no averages vs other users. |
| Push notifications for "log your meal" | Habit-building pattern from health apps | T1D users manage their condition reactively to glucose data, not on a schedule. Intrusive reminders when they are already managing a situation create anxiety, not habit. Also: notification fatigue in this population is high (CGM alarms already interrupt sleep). | Passive homescreen widget / live glucose visible on app open is enough prompt. No push notifications for logging. |
| Automatic carb / food database lookup | Barcode scan or food name search linked to USDA/nutritional DB | UK users need UK nutritional standards (CoFID). USDA carb figures are often materially different for UK products and cooking methods. A wrong carb estimate with a dose already taken is dangerous. | AI photo estimation with UK CoFID prompt (already built). Manual gram entry. No auto-lookup from external databases unless they can be verified against UK standards. |
| Multi-user household sharing (spouse/parent view) | Parents of T1D children want to monitor remotely | No backend, no auth, no encryption at rest. Sharing device-local data without a secure backend is a privacy and clinical risk. | Explicitly defer until backend with proper auth and encryption is built. No MVP shortcuts here. |

---

## Feature Dependencies

```
Traffic light outcome badge
    └──requires──> GlucoseResponse completed (3hr curve) per meal  [already built]
                       └──requires──> Post-meal curve fetch [already built]

"You've eaten this before" UI (at log time)
    └──requires──> Matching engine [already built in matching.ts]
                       └──requires──> Sessions with completed GlucoseResponse [already built]

"You've eaten this before" with outcome annotation
    └──requires──> Traffic light outcome badge [must be built first]
    └──requires──> Matching engine [already built]

AI confidence model (per-meal)
    └──requires──> Traffic light outcome badge [must be built first]
    └──requires──> Carb estimate stored per meal [already built]
    └──requires──> Sufficient meal history (10+ completed curves) [data accumulation]

Long-acting insulin overnight window
    └──requires──> Long-acting log entry [already built]
    └──requires──> Morning glucose reading (next day 7am window) [nightscout fetch — needs scoped query]

Pattern reports / trend analysis
    └──requires──> 90+ days of meal+curve data [time gating]
    └──requires──> Traffic light outcome badge [already built by then]

Expandable history cards
    └──enhances──> Traffic light outcome badge (reveals full detail behind badge)
    └──enhances──> "You've eaten this before" (tapping card shows matches)

Day folder grouping
    └──enhances──> Expandable history cards (sections collapse per day)
    └──independent of──> Matching / traffic light (purely presentational)

Interactive glucose graph
    └──independent of──> Matching / outcome badges (home screen feature)
    └──requires──> GlucoseStore rolling window [already built]
```

### Dependency Notes

- **Traffic light must precede AI confidence model:** Confidence is computed from whether past estimates matched good/bad outcomes. Without outcome classification, there is no signal.
- **Matching UI requires matching engine:** Engine exists; UI layer is the only missing piece. Can be built immediately.
- **Expandable cards and day folders are independent:** These are purely presentational and can be built without any matching/intelligence work. They are also the prerequisite UX surface where intelligence features will live.
- **Long-acting window is independent:** Does not depend on matching or traffic light. Requires a dedicated Nightscout query for the 7am window on the morning after dose.

---

## MVP Definition (for this milestone)

The current milestone is Phase 8 of BolusBrain — surfacing existing intelligence and improving history UX.

### Launch With (this milestone)

- [ ] Traffic light outcome badge — auto-derived from GlucoseResponse. Green = peak stayed in range. Orange = peak >10 but returned to range by 3hr. Red = hypo <3.9 at any point OR peak >10 and end glucose still >10. This is the foundation everything else builds on.
- [ ] Expandable history cards — collapsed glanceable card (name, dose, badge, timestamp) + tap reveals full stats, curve, and matched sessions.
- [ ] Day folder grouping — section headers in MealHistoryScreen. Today / Yesterday / date string for older. Folders collapsible for older days.
- [ ] "You've eaten this before" inline at meal log time — when user types a meal name, show up to 3 best matches with outcome badge and insulin units taken. Framing: "Last time: X units, glucose stayed in range."
- [ ] "You've eaten this before" in history cards — tapped expanded card shows similar past sessions with outcome badge.

### Add After Validation (v1.x)

- [ ] AI carb estimate confidence model — surface "this meal type has been underestimated before" after 10+ completed curves. Requires outcome data to accumulate.
- [ ] Long-acting insulin overnight window — pair bedtime + morning readings on InsulinLogCard for long-acting entries.
- [ ] Interactive glucose graph on home screen — tap mmol reading opens 12h/24h graph with touch-to-inspect values. Use Victory Native or react-native-svg chart.
- [ ] Dose editing — correct mistaken insulin entries. Straightforward CRUD; deferred only to maintain launch focus.
- [ ] HbA1c disclaimer modal.

### Future Consideration (v2+)

- [ ] Pattern reports — 90-day minimum gate. Trends, averages by meal type, time-of-day patterns.
- [ ] Outcome-weighted matching — filter matches by "in range" outcome only.
- [ ] Backend sync — required before multi-device or sharing is considered.
- [ ] Prediction engine — only after MHRA guidance, 50+ meals, 90+ days. Requires regulatory solicitor review.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Traffic light outcome badge | HIGH — immediately scannable history | LOW — pure derivation from existing GlucoseResponse | P1 |
| Expandable history cards | HIGH — history is currently information-dense and hard to scan | MEDIUM — accordion pattern, needs layout refactor | P1 |
| Day folder grouping | HIGH — history becomes unusable past ~30 entries without it | MEDIUM — SectionList migration from FlatList | P1 |
| "You've eaten this before" at log time | HIGH — surfaces the matching engine that already exists | MEDIUM — needs real-time name matching as user types, debounced | P1 |
| "You've eaten this before" in history | MEDIUM — useful but secondary to log-time surface | LOW — calls existing findSimilarSessions(), renders in expanded card | P2 |
| HbA1c disclaimer modal | MEDIUM — safety/trust, prevents misuse | LOW — modal with stored "seen" flag | P2 |
| Interactive glucose graph | HIGH — core CGM feature users expect | MEDIUM-HIGH — charting library integration, gesture handling | P2 |
| Dose editing | MEDIUM — trust/accuracy, prevents log abandonment | MEDIUM — edit modal + AsyncStorage update | P2 |
| Long-acting insulin window | MEDIUM — meaningful for Lantus/Levemir users | MEDIUM — scoped Nightscout fetch for morning window | P2 |
| AI confidence model | HIGH long-term — genuinely novel | HIGH — needs enough history, complex derivation logic | P3 |
| Pattern reports | HIGH long-term | HIGH — 90-day gate means months before usable | P3 |

**Priority key:**
- P1: Must have for this milestone launch
- P2: Should have, add when P1 is stable
- P3: Future milestone

---

## UX Patterns That Work vs Patterns to Avoid

### Patterns That Work in T1D Health Apps

**Glanceable card with progressive disclosure**
Show: outcome badge + meal name + insulin + time. Tap reveals: full stats, curve shape, matched sessions. This respects that users often check the app mid-activity with one hand. Dexcom Clarity and Apple Health both use this pattern. HIGH confidence.

**Colour-coded outcome, not numeric grading**
Red/Green/Amber is universally understood in T1D populations (all CGM devices use this). Numeric scores ("7/10 bolus") invite comparison and judgement. Use colour + short descriptor ("glucose stayed in range") with no score. HIGH confidence.

**Historical framing for all pattern data**
"Last time you ate pizza you took 6 units and your glucose peaked at 11.2 before returning to range" is safe. "Take 6 units" is medical advice. The framing must always be past tense and factual. This is both the regulatory position and the correct UX — the user feels informed, not told. HIGH confidence.

**Day section headers, not infinite scroll**
SectionList with sticky day headers is the standard pattern in health apps (Apple Health, mySugr, Clue). Users navigate by day first, not by scrolling from today to last week. HIGH confidence.

**In-context match surfacing at log time**
Showing matches as the user types (debounced, ~300ms) is preferable to a separate "history" lookup. The moment of logging is the moment of decision — that is when historical context is most valuable. MEDIUM confidence (BolusBrain-specific pattern — not observed in mainstream T1D apps, which is what makes it a differentiator).

**Glucose graph: tap for value, not persistent labels**
On mobile, persistent value labels on glucose graphs cause clutter (Nightscout web has this problem). The correct pattern is: tap/long-press a point to see value + timestamp in a tooltip. Default view shows the curve only. HIGH confidence (used in Dexcom app, LibreView mobile).

**Glucose graph: 24h is the right default for daily review**
12h is useful for "how am I doing today" on the home screen. 24h is the standard clinical view and is what endocrinologists and diabetes nurses reference. If offering one default, 24h is the safer choice for a history-review graph. MEDIUM confidence.

### Patterns to Avoid

**Gamification (streaks, badges for logging consistently)**
T1D management is not a fitness habit. Illness, site changes, and CGM calibration issues cause gaps. Penalising gaps in logging causes guilt. Apple Health and Fitbit use streaks — these are appropriate for step counts, not insulin logs. HIGH confidence this is wrong for this domain.

**Averages shown without sample size**
"Your average glucose this week is 7.4" means nothing if the CGM was offline for 3 days. Always show: average + period + % readings captured. MEDIUM confidence.

**Predictive text for food names using global food database**
Autofill from a food database feels helpful but introduces mismatches (UK "chips" vs US "chips"). Keep meal name freeform — the matching engine works on tokens and handles variation better than a constrained taxonomy. HIGH confidence this is correct for BolusBrain's architecture.

**Nested navigation deep into history**
Meal → Tap → Detail screen → Tap → Match detail screen → Tap → Matched meal detail screen is too deep. Maximum 2 levels: List card → expanded card inline (accordion). Keep matched sessions visible in the same expanded card, not navigated to separately. HIGH confidence.

---

## Competitor Feature Analysis

| Feature | Dexcom Clarity | mySugr | LibreView | Gluroo | BolusBrain (current/planned) |
|---------|----------------|--------|-----------|--------|------------------------------|
| Live glucose display | Yes (CGM native) | Yes (CGM sync) | Yes (CGM native) | Yes (CGM sync) | Yes (Nightscout polling) |
| Trend arrow | Yes | Yes | Yes | Yes | Yes |
| Meal logging with photo | No | No | No | Yes (photo, no AI carb est.) | Yes (AI carb estimate, UK CoFID) |
| AI carb estimation | No | No | No | No | Yes |
| Post-meal glucose curve per meal | No | No | No | No | Yes |
| Meal pattern matching ("eaten before") | No | No | No | No | Built, UI pending |
| Traffic light outcome per meal | No | User-assigned stars | No | No | Planned |
| Day grouping in history | Yes | Yes | Yes | Yes | Planned |
| Expandable history cards | Partial | Yes | Partial | Yes | Planned |
| Interactive glucose graph | Yes | Yes | Yes | Yes | Planned |
| Long-acting insulin overnight window | No | No | No | No | Planned |
| AI confidence model for carb estimates | No | No | No | No | Planned |
| 90-day data gating for patterns | No (shows with any data) | No | No | No | Planned (by design) |
| Historical framing (no dosing advice) | N/A | N/A | N/A | N/A | Core constraint |

**Confidence note:** Competitor feature comparison drawn from training data (pre-August 2025). Verify against current app store listings before using as competitive positioning material.

---

## Health App Legal / Safety Anti-Patterns (Explicitly Flagged)

These are the patterns that will attract MHRA scrutiny or cause user harm. They must be avoided and the avoidance should be documented as a design decision.

| Anti-Pattern | Why Dangerous | MHRA Relevance | BolusBrain Mitigation |
|---|---|---|---|
| Dosing recommendation in any form | Wrong dose → hospitalisation. Even "suggested" creates liability. | SaMD classification under UK MDR 2002 if app "informs therapeutic decisions" | All pattern UI uses past-tense factual framing. No "you should" language. Framing guidelines enforced in code review checklist. |
| HbA1c shown as diagnostic value | Users present app HbA1c to GP as if it's a lab result. Proxy from 30-day average differs from gold standard HbA1c (which averages 3 months, weighted to last 30 days). | False diagnostic claims are a regulatory concern | Modal disclaimer on tap: "This is an estimate from your CGM readings, not a blood test. Get accurate HbA1c from your diabetes team." |
| Glucose prediction without clinical validation | Wrong prediction during exercise or illness erodes trust and may cause inappropriate insulin correction | Predictive features require MHRA informal guidance before implementation | Prediction engine explicitly out of scope. No extrapolation of glucose curve forward. |
| Carb estimates presented without uncertainty | Users treat AI estimates as authoritative. AI can be 30–50% wrong on complex meals. | Not a direct SaMD risk but contributes to dosing errors | Confidence warning ("This type of meal has been underestimated before") is safer than a single authoritative number. Confidence model must explicitly communicate uncertainty. |
| Encouraging reduced testing (replacing clinical CGM) | App is complementary, not a replacement | Any claim to replace clinical care is regulated | Onboarding and help text must clearly state: "BolusBrain works alongside your diabetes team, not instead of them." |

---

## Sources

- Training data from competitive analysis of Dexcom Clarity (iOS, as of 2025), LibreView (Abbott), mySugr (Roche), Gluroo, Sugarmate, Loop, Trio, Nightscout web UI
- T1D UX principles derived from: health app design research (Apple HIG health data guidelines), JDRF app landscape surveys (2023–2024), Diabetes UK digital tools guidance
- MHRA SaMD framing: UK Medical Devices Regulations 2002, MHRA "Software and AI as a Medical Device" guidance (published 2024)
- UK carb standards: CoFID (Composition of Foods Integrated Dataset), McCance & Widdowson — applied to anti-feature "USDA lookup" ruling
- Confidence levels: MEDIUM overall — training data is current as of August 2025 but cannot be verified against live competitor app releases post that date

---

*Feature research for: BolusBrain T1D tracking app (subsequent milestone — Phase 8)*
*Researched: 2026-03-18*
