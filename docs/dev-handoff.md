# BJJ Tracker - Dev Handoff Notes



## 2026-05-11 → 2026-05-12 Combined Dev Handoff

## Phase: QA Stabilization + Visual Maturity Pass

---

# Current Branch

`summary-rebuild-v2`

---

# High-Level Outcome

This phase successfully stabilized the most fragile architectural layer in the app:

* multi-athlete weekly synchronization
* parent ↔ coach athlete ownership
* competition persistence
* summary recompute
* save/navigation contracts
* stack cleanup behavior
* shell consistency
* visual maturity direction

The product moved from:

* fragmented prototype surfaces
  to:
* a more cohesive athlete operating system.

This was a major stabilization milestone.

---

# Major Systems Stabilized

## 1. Competition Shared-Athlete Propagation

### Root Cause

Competition entries for linked athletes were being saved without `sharedAthleteId`.

Summary and identity pipelines filtered competitions by:

```ts
competition.sharedAthleteId === athleteId
```

Compete loaded correctly because it loaded by `kidId`, but Summary never saw those competitions.

### Fix

On competition save:

* roster `sharedAthleteId` is now resolved from `getKidsById()`
* persisted into create/update competition flows
* legacy rows get repaired on resave

### Result

Competition entries now:

* appear in Summary
* affect identity recompute
* affect patterns/proof
* sync correctly between coach and parent

Commit:
`918bc13`

---

# 2. Save → Compete Product Contract

### Product Requirement

After competition save:

* user lands on Compete
* sees updated entry immediately
* This Week remains This Week
* no stale editor route

### Original Failure

Compete pushed:

```txt
/this-week/kid/[kidId]/competition/edit
```

Save switched active tab to Compete but DID NOT clear the This Week stack.

Result:
Tapping This Week reopened stale competition editor.

### Important Architectural Lesson

The issue was:

* stack preservation
  NOT:
* role corruption
* provider leakage
* Expo Router failure

### Final Fix

* identified actual lane stack owner
* correctly targeted stack navigator
* conditionally dispatched `popToTop`
* guarded against route depth = 1

### Result

Stable behavior:

```txt
Compete → Add → Save → Compete → This Week
```

No stale stack.
No redbox.
No route contamination.

Commit:
`b751fd1`

---

# 3. Summary V2 Stabilization

Summary V2 architecture stabilized around:

* progression engine
* alignment states
* identity tone
* proof system
* pattern tracking
* competition integration
* weekly sync interpretation

Signals now recompute correctly after:

* competition saves
* weekly updates
* linked athlete changes

Important observation:
Summary is becoming the PRIMARY product surface.

It is now:

* athlete mirror
* proof interpreter
* coach direction synthesis layer
* execution narrative surface

---

# 4. Operating Shell Stabilization

Global shell direction aligned around:

* graphite surfaces
* restrained lime accents
* compact density
* premium sports-performance aesthetic

This Week became:

* the calibration surface
* strongest current implementation
* reference point for the other tabs

---

# 5. Visual Maturity Pass

Large unstaged refinement pass currently exists locally.

### Key Areas

* OperatingHeader normalization
* Summary card cleanup
* lime semantic tightening
* Training density polish
* Compete archive/proof energy
* medal restraint
* border normalization
* reduced “AI dashboard” feel
* reduced card soup

### Current Repo Status

UNCOMMITTED LOCAL MODIFICATIONS EXIST.

Includes:

* Summary
* Training
* Compete
* OperatingHeader
* Competition visual system
* Medal surfaces
* Athlete switcher
* Card normalization

`submissionTypes.ts`
is currently UNTRACKED.

---

# Architectural Lessons Learned

## 1. Navigation Truth

Tab switching does NOT clear sibling stacks.

The bug was:

* stale stack preservation
  NOT:
* tab corruption

## 2. Repo Truth > Guessing

The breakthrough occurred only after:

* navigator ownership tracing
* runtime telemetry
* stack hierarchy validation

## 3. Visual Consistency Matters

The app quality increased significantly after:

* reducing visual noise
* reducing decorative green
* tightening density
* normalizing shell language

## 4. MatMind Identity Direction

The product should feel:

* calm
* operational
* premium
* athlete-focused
* restrained

NOT:

* gamified
* flashy
* startup-dashboard-like
* “AI generated”

---

# Current Product Direction

MatMind is becoming:

```txt
an athlete operating system
```

NOT:

```txt
a fitness app
```

Primary visual references:

* Nike Training Club
* Strava
* Whoop

But filtered through:

* coach alignment
* athlete development
* family execution
* proof tracking

---

# Remaining Risks

## Medium

* remaining visual inconsistency between tabs
* possible remaining “card soup” in Summary
* Training calendar still potentially too generic

## Low

* telemetry cleanup still pending
* temporary QA logs still exist
* medal/archive emotional tone refinement

## Resolved

* stale competition editor stack
* summary recompute failures
* competition ownership mismatch
* shared-athlete propagation bug
* Compete → This Week corruption

---

# Tomorrow’s Highest ROI Sequence

## 1. Review Local Uncommitted Polish Pass

Carefully inspect:

```bash
git diff
```

## 2. Stage/Commit Visual Maturity Pass

Potentially separate commit from stabilization logic.

## 3. Full Regression QA

Parent:

* Summary
* This Week
* Training
* Compete
* Multi-save flows

Coach:

* athlete switching
* competition review
* summary visibility
* weekly sync

## 4. Multi-Athlete Validation

Critical:

* athlete isolation
* identity ownership
* competition separation
* weekly sync separation

## 5. Telemetry Cleanup Plan

Remove temporary:

* ownership audit logs
* navigation debug logs
* stabilization telemetry
  after confidence increases.

---

# Important Repo State Reminder

Before continuing tomorrow:

```bash
git status -sb
git diff
```

Large unstaged refinement work currently exists locally and should NOT be forgotten before future QA or merges.




#Date: 2026-05-10

## Major Focus Today
Stabilization, multi-athlete weekly sync reliability, navigation safety, roster lifecycle management, onboarding identity structure, and pre-TestFlight UI polish.

---

# 1. Multi-Athlete Weekly Sync Stabilization

## Core Result
Successfully stabilized parent rendering + per-athlete weekly resolution.

## Verified Behaviors
- Weekly publish remains isolated per athlete.
- Luca and Scenario A maintain separate weekly focus payloads.
- Cold start + app relaunch preserves correct athlete weekly state.
- Parent switching between athletes resolves correct:
  - mission
  - family resource
  - recap
  - weekly payload
- Weekly sync now properly hydrates from:
  - `weeklyByAthleteId`
  - resolved `sharedAthleteId`
  - linked kid mappings

## Validation Performed
- Coach → publish athlete A
- Coach → publish athlete B
- Parent → switch athlete
- Cold restart
- Relaunch
- Multiple render passes
- Identity hydration verification
- Weekly pipeline trace validation

## Important Logs Confirmed
- `WEEKLY PIPELINE TRACE`
- `DERIVED ATHLETE RESOLVE`
- `IDENTITY SHADOW`
- `RENDER ATHLETE SOURCE`
- `weeklyByAthleteIdKeys`

## Commit
- `774ba48`
- "Stabilize multi-athlete weekly sync and parent rendering"

---

# 2. Navigation / Native Stack Crash Fix

## Problem
React Navigation native-stack mismatch:

"The screen 'kid/[kidId]' was removed natively but didn't get removed from JS state"

Caused by:
- `beforeRemove`
- `preventDefault`
- async `router.replace`
- nested stack transitions

## Fix Applied
### Removed
- `beforeRemove` interception logic entirely

### Kept
- Android `BackHandler`

### Simplified
- Weekly focus save:
  - old → `replace(/coach/kid/:id)`
  - new → `replace(/coach)`

## Result
- Reduced native/JS stack race conditions
- Cleaner navigation collapse behavior
- Safer stabilization path before TestFlight

---

# 3. Kids Belt + Experience System

## New Direction
Expanded athlete onboarding/profile identity system.

## Added
### Full Kids Belt Structure
- Grey/White
- Grey
- Grey/Black
- Yellow/White
- Yellow
- Yellow/Black
- Orange/White
- Orange
- Orange/Black
- Green/White
- Green
- Green/Black

### Adult Belts
- White
- Blue
- Purple
- Brown
- Black

## Experience Layer
Per belt:
- Beginner
- Developing
- Experienced

## New Shared Module
`athleteBeltExperience.ts`

Centralizes:
- canonical belt handling
- formatting
- normalization
- identity weighting
- validation

## Product Impact
- More realistic youth athlete identity modeling
- Cleaner onboarding
- Better future summary logic
- Better identity scoring potential

---

# 4. Coach Athlete Archive / Delete Flow

## New Capability
Coach can now archive/remove athletes from active roster.

## Architecture
Soft archive model:
- `coachArchivedAt`

No destructive deletion.

## Preserved
- sync relationships
- history
- competition data
- weekly data

## UI Added
- Coach athlete danger zone
- archive confirmation flow
- redirect after archive

## Behavioral Changes
Archived athletes:
- hidden from coach roster
- removed from insights
- excluded from active rendering
- protected from accidental reconcile resurrection

## Important Design Decision
No hard-delete during stabilization phase.

---

# 5. Training Tab UI Stabilization Pass

## Goal
Improve presentation quality before next TestFlight cut without redesigning architecture.

## Improvements
### Visual Compression
- reduced hero dominance
- reduced spacing
- compressed segmented controls
- tighter rhythm

### Styling Consistency
- unified radius
- normalized padding
- softened active states
- calmer visual hierarchy

### Tonal Improvements
- reduced neon green intensity
- softened black surfaces
- reduced harsh contrast
- improved dark surface cohesion

### Utility UI
- beta feedback card reduced in prominence

## Result
Training tab now:
- calmer
- denser
- more productized
- less prototype-like

---

# 6. QA / Validation Work

## Heavy Real Device Validation
Performed:
- cold starts
- athlete switching
- coach publishing
- parent rendering
- weekly persistence
- stack navigation
- render tracing
- identity hydration verification

## Key Observation
System now behaves reliably under:
- rapid athlete switching
- app relaunches
- weekly publishes
- tab transitions

---

# 7. Current State

## Stable Areas
- multi-athlete weekly sync
- parent athlete rendering
- weekly publish isolation
- navigation stack stability
- onboarding identity structure
- coach archive flow
- training tab presentation polish

## Remaining Before TestFlight
- regression QA pass
- operator validation pass
- trim remaining noisy logs
- final navigation sanity check
- smoke test role switching
- verify archived athlete edge cases
- verify training flows after UI pass

---

# 8. Recommended Next Session

## Highest ROI
1. Full stabilization QA pass
2. Remove temporary debug logging
3. Final TestFlight polish sweep
4. Build candidate freeze
5. Cut next external testing build

EOF



# EOD — 2026-05-08 

SYSTEM STATE (END OF DAY)

Summary V2 engine is now fully implemented, integrated, and pushed to summary-rebuild-v2.

This includes:

* progression engine (step-based, non-repeating, alignment-driven)
* alignment integration (no_data, misaligned, aligned, validated)
* system selection (coach → identity → signals)
* identity tone layer (exploring / building / performing)
* stable stepKey tracking (system:id, no longer string-based)
* AsyncStorage persistence for lastAction
* full SummaryViewModel pipeline contract documented and locked

TypeScript validation passed across all changes. No runtime-breaking errors introduced.

This is the first version of a true decision engine, not just UI logic.

⸻

WHAT WAS PROVEN

1. Progression is now deterministic
    * No repetition loops
    * Stable step identity via stepKey
    * Alignment controls advancement/reset correctly
2. System selection is centralized
    * No more scattered fallback logic
    * Single source of truth: selectFocusSystem
3. Identity is now presentation-only
    * Does not affect progression logic
    * Clean separation of logic vs tone
4. Fallbacks are clean
    * No system → controlled “Pick one position” path
    * No data → forced first step
    * No hidden branching in UI layer
5. Storage is working
    * lastAction persists correctly
    * stepKey used instead of fragile string matching

⸻

WHAT BROKE / FRICTION DISCOVERED

1. QA BLOCKER — Roster visibility (CRITICAL)

Cannot reliably run QA because:

* Coach cannot consistently see athlete roster
* Parent view does not consistently show child
* Athlete linkage feels unstable across flows

This prevents:

* real scenario testing
* progression validation in real use
* coach/parent loop validation

⸻

2. Identity instability (CRITICAL)

Logs show:

* athlete switching unexpectedly
* state resetting (sessionCount / signals dropping to 0 temporarily)
* multiple identity resolutions per render cycle

This indicates:

* multiple competing sources of truth
* identity being recomputed instead of held stable
* dependency chain issues between:
    * derivedActiveAthleteKid
    * session state
    * signals pipeline

⸻

3. Signal inconsistency during session saves

Observed behavior:

* sessionCount spikes (47 → 0 → 1 → 2 → 3)
* signals recompute multiple times per action
* dominance recalculates inconsistently mid-flow

This suggests:

* state rehydration issues
* async updates not synchronized
* possible duplicate signal computations

⸻

WHAT IS LOCKED (DO NOT TOUCH)

* computeProgression
* buildSummaryViewModel
* alignment logic
* identity tone formatting
* system selection logic

All summary engine logic is frozen until QA surface is stable.

⸻

CURRENT PRIORITY (P0)

Fix QA INFRASTRUCTURE

Before any further product iteration, we must fix:

1. Coach roster visibility
2. Parent athlete visibility
3. Active athlete selection stability

Without this, the system cannot be validated.

⸻

ROOT PROBLEM (CLEAR)

System logic is now strong.

But:

Inputs (who is the athlete?) are unstable

Which means:

The engine cannot be trusted yet in real scenarios

⸻

PLAN FOR NEXT SESSION

Step 1 — Stabilize identity

* Ensure a single source of truth for active athlete
* Prevent re-resolution on every render
* Cache or explicitly set active athlete

Step 2 — Audit roster flows

* coach dashboard roster
* parent-athletes screen
* athlete linking logic

Focus:

* filtering issues
* token vs sharedAthleteId mismatches
* missing fallbacks

Step 3 — Add debug visibility

Log:

* roster inputs
* athlete resolution path
* selection changes

⸻

QA SCENARIOS TO RUN (AFTER FIX)

1. Cold start → no data
2. Signal-driven athlete (no coach input)
3. Coach focus override
4. Parent-only flow
5. Athlete switching

⸻

GIT STATE

* Branch: summary-rebuild-v2
* Commit: a469507
* Status: Clean, pushed to origin
* Files changed: 25
* New modules added across summary, identity, storage, and training

⸻

FINAL ASSESSMENT

Today was a major architectural milestone.

You successfully transitioned from:

* UI-driven summaries
    → to
* system-driven progression engine

However:

The system cannot be validated until identity + roster flows are stable

⸻

NEXT DIRECTIVE

Do NOT build new features.

Start next session with:

QA infra fix — roster + identity stabilization

That is the only priority.



# EOD — 2026-05-07  
## MatMind / BJJ Tracker — Developer + Product Audit

---

## 🧠 Summary

Today marked a major transition from feature-building into **system-building**.

The product evolved from:
- passive tracking
→ into
- **behavior-aware coaching system**

Core systems implemented today:
- Exposure persistence + escalation
- Focus locking (behavior guidance)
- Adherence tracking (feedback loop)
- Session plan generation (guidance layer)
- Summary → decision engine (not just reporting)

This is the first time the system:
> observes → reacts → persists → guides → measures

---

## 🚀 What Was Built

### 1. Exposure System (Persistent State)

**Files:**
- `src/storage/summaryExposureTracking.ts`
- `app/(tabs)/training/[id].tsx`

**Capabilities:**
- Detect exposure at save
- Persist exposure per athlete
- Track escalation (`exposureCount`)
- Track recovery (`recoveryCount`)
- Resolve only after:
  - 2 stable sessions
  - exposureCount returns to 0
- TTL protection (3 days)

**Behavior:**
- Exposure is no longer momentary
- It becomes a **state the athlete must work through**

---

### 2. Focus System (Behavior Layer)

**Files:**
- `src/storage/focusTracking.ts`
- `SummaryScreen.tsx`
- `TrainingSessionEditor`

**Capabilities:**
- One active focus per athlete
- Set from Summary ("Lock your focus right now")
- Persisted into training session

**Behavior:**
- System moves from suggestion → **intent shaping**
- Athlete enters training with awareness

---

### 3. Adherence Tracking (Feedback Loop)

**Files:**
- `src/storage/focusAdherenceTracking.ts`
- `TrainingSessionEditor`

**Capabilities:**
- Post-session prompt:
  - Yes / Somewhat / No
- Logged with:
  - athleteId
  - sessionId
  - system
  - adherence

**Behavior:**
- Captures whether athlete followed focus
- Skipped during exposure (correct prioritization)

---

### 4. Session Plan System (Guidance Layer)

**Files:**
- `src/lib/training/generateSessionPlan.ts`
- `SummaryScreen.tsx`

**Capabilities:**
- Generates plans based on:
  - system
  - exposure level (low / medium / high)
- Displays under “Fix the gap”
- Converted to **suggestion (not instruction)**

**Behavior:**
- Reinforces focus during training
- Does not override coach instruction

---

### 5. Summary System Evolution

**Files:**
- `SummaryScreen.tsx`
- `SummaryHeroCard.tsx`
- `SummaryConsistencyCard.tsx`
- `SummaryCompetitionCard.tsx`

**Before:**
- Static insights
- Confidence %
- Suggestions

**Now:**
- Identity state
- Exposure state (persistent)
- Pressure tiers
- Action system (“Fix the gap”)
- Focus locking
- Session plan
- Behavior-aware UI

**Shift:**
> Summary is now a **decision engine**

---

### 6. UI Philosophy Shift

**Decision made:**
- Avoid intrusive UX
- Avoid heavy banners / forced flows
- Move toward **ambient coaching**

**Direction:**
- Subtle
- Always visible
- Low friction
- Behavior nudging

---

## 🧪 QA Findings (Luca Test)

### Setup:
- White belt
- 2 competitions
- 2 wins (points + submission)
- No training sessions initially

### Observed Output:
- Dominant system inferred: `l1.top_passing`
- Weak dominance triggered (threshold = 0.9)
- Exposure state active
- Confidence ~28–34% (low)

### Insight:
- System is **technically correct**
- But **emotionally confusing**

**Problem:**
> Winning athlete sees “low confidence”

---

## ⚠️ Gaps Identified

### 1. Kids Belt System Missing
- No structured belt progression
- No mapping to expectations

**Impact:**
- Identity accuracy suffers
- Skill expectations unclear

---

### 2. Beginner Skill Entry Missing
- Prompt exists (“Add skills…”)
- No actual entry flow

**Impact:**
- No data → low confidence
- System feels incomplete

---

### 3. Confidence Messaging Problem
Current:
> “30% — Low”

Needed:
> “Early signal — building your game”

---

### 4. Video Player Limitations
Current:
- Play / Pause / Replay only

Missing:
- Scrubbing
- Skip forward/back
- Fine control

---

### 5. Identity System Visibility
- Competitor prompt works
- But is reactive, not proactive

---

## 🔥 New Product Insight

### “Execution Gap” (NEW SIGNAL)

Detected need:

> Coach teaches something  
> Athlete trains it  
> It does NOT appear in competition

This is NOT exposure.

This is:
> **Execution Gap**

### Future Signal:
- Coach intent vs competition reality
- Repetition without translation

---

## 🧭 Next Steps

### 🔴 P0 — Core Fixes

1. Implement kids belt system
2. Add beginner skill onboarding
3. Adjust confidence messaging

---

### 🟠 P1 — System Strengthening

4. Build Execution Gap signal
5. Refine focus UI (more subtle)
6. Improve video controls

---

### 🟡 P2 — Expansion

7. Turn adherence into insight
8. Build coach feedback layer

---

## 🧪 Next QA Plan (05/08)

### Luca
- Add 3–5 training sessions
- Observe:
  - Identity formation
  - Exposure persistence
  - Confidence changes

### Self (Israel)
- Add real competitions + training
- Validate:
  - Accuracy
  - Emotional alignment
  - Behavior influence

---

## 🧱 System Status

The product is now:

❌ Not a tracker  
❌ Not a dashboard  

✅ A **behavior-aware coaching system**

---

## 📌 Final Note

Today was a turning point.

The system now:
- detects reality
- persists it
- pressures behavior
- measures response

Next phase is:
> refining trust, clarity, and execution signals

---


## Date: 2026-05-06
Branch: summary-rebuild-v2
Commit: 1aa81dd

---

## 🚨 Core Objective Today

Stabilize the full system pipeline:

Identity → Sessions → Signals → Suggestions

---

## ✅ What Was Achieved

### 1. Signals Data Source (CRITICAL FIX)

Before:
- Signals used inconsistent session sources (weekSessions vs full dataset)
- Result: SIGNALS RUN 0 while data existed

After:
- `useSignals` now depends ONLY on `useAthleteData`
- Removed `weekSessionsRaw` from Training
- Single source of truth established

Result:
- SIGNALS INPUT sessionCount matches ATHLETE DATA
- No more phantom zero runs

---

### 2. Signals Stability Layer

- Introduced `previousSignalsRef`
- Prevents recompute on transient invalid state
- Eliminates UI flicker

---

### 3. Athlete Identity Stabilization

- Guarded `setActiveAthleteId`
- Added fallback via `useActiveAthlete`
- Prevented null identity during render cycles

---

### 4. Suggestion System Overhaul

#### Before
- Dismiss = permanent suppression ❌

#### After
- Dismiss = cooldown (10 min) ✅
- Suggestions reappear when:
  - cooldown expires
  - validation changes
  - trend changes
  - high confidence signals

---

### 5. Time-Based Recompute (Key Unlock)

- Added `nowTick` interval (60s)
- Allows cooldown expiration to trigger UI updates

---

### 6. Identity + Summary Engine (NEW)

New architecture added:

- `computeIdentityScore`
- `validateIdentitySignals`
- `deriveIdentitySuggestions`
- `deriveCoachSignals`
- `deriveSummaryInsights`
- `deriveSummaryExplanation`

This creates:
- identity baseline
- behavioral validation
- suggestion engine
- explanation layer

---

### 7. Summary Tab Refactor

- Converted `summary.tsx` → folder structure
- Added:
  - onboarding
  - profile
  - add-athlete
  - layout

---

## 🧪 QA Status

### Scenario 1 — Data Integrity
✅ PASS

- Sessions persist correctly
- Signals aligned with data
- No mismatch

---

### Scenario 2 — Suggestion Timing

- Dismiss → disappears ✅
- Navigation → stays gone ✅
- Cooldown system implemented ✅
- Resurfacing logic implemented ⚠️ (needs final verification)

---

## ⚠️ Known Issues (Next Priority)

### 1. Confidence Scaling (HIGH)

Current:
- 4 sessions → 100% confidence ❌

Needed:
- confidence weighted by data volume

---

### 2. Label Formatting (HIGH UX)

Current:
- l1.top_passing ❌

Needed:
- human-readable labels

---

### 3. Suggestion Tone

Current:
- robotic phrasing

Needed:
- coaching tone

---

### 4. Signals Lifecycle Logs

- Occasional SIGNALS RUN 0 during hydration
- Expected but should be monitored

---

## 🧠 System State

### Stable:
- Data layer ✅
- Signals input ✅
- Suggestion timing logic ✅

### Not yet refined:
- Confidence ❌
- UX clarity ❌
- Messaging ❌

---

## 🎯 Next Steps (Priority Order)

1. Implement confidence scaling model
2. Fix label formatting layer
3. Improve suggestion tone
4. Complete full QA stress test (5 scenarios)
5. Align with Codex HTML spec

---

## 🔒 Non-Negotiables Maintained

- computeSignals untouched
- no schema changes
- identity engine modular
- suggestion system layered

---

## 📌 Summary

Today we moved from:

"System behaves inconsistently"

→

"System is structurally correct and stable"

Next phase:
Refinement and trust-building.


## Date: 2026-05-05
**Branch:** summary-rebuild-v2
**Focus:** Competition System + Native Dev Environment + Signal Loop Completion

---

# 🔥 TODAY’S OUTCOME (EXECUTIVE SUMMARY)

Today was a **critical inflection point**.

We successfully:

1. **Moved competition into a true performance system**
2. **Unified all competition data into a single source of truth**
3. **Completed the full feedback loop (Competition → Weekly → Training → Coach)**
4. **Established real-device native dev workflow (Expo Dev Build)**
5. **Validated end-to-end UI + signal + coaching infrastructure**

👉 This is no longer a feature — this is a **system layer of the product**

---

# 🧠 CORE PRODUCT SHIFT

## Before:

* Competitions = isolated entries
* Medals = decorative
* Coaching = disconnected from performance

## After:

```text
Competition → Signals → Focus → Weekly → Training → Next Competition
```

👉 You now have a **closed performance loop**

---

# 🏗️ COMPETITION SYSTEM (FINAL STATE)

## ✅ Data Architecture

* Single source:

  ```ts
  getKidCompetitionEntriesWithMatchDetailForKid(kidId)
  ```
* Removed:
  ❌ legacy `mm:v1:competitions` feed
* All surfaces read from same pipeline:

  * Compete tab
  * Summary
  * This Week
  * AI Coach
  * Coach Dashboard

---

## 🥇 Medal System

### Behavior:

* Only **podium results** shown (1st / 2nd / 3rd)
* Grouped by:

  * Year
  * Chronological (newest → oldest)
* Tile includes:

  * Medal image (user or fallback)
  * Placement (1st/2nd/3rd)
  * Date (e.g. Apr 30)
  * Event name

### UX Decisions:

* Performance-based gallery (not decorative)
* No empty grids
* Strong hierarchy (Achievements block)

---

## 📅 Competition Lifecycle

### Future event:

* No matches UI
* No medals
* Planning-only state

### Past event:

* Full match system unlocked
* Media + notes + breakdowns

---

## 🎥 Media System

### Now aligned with Training:

* Uses:

  ```ts
  persistMediaFromCameraRoll
  ```
* Supports:

  * Camera
  * Camera roll
  * URL (for video)

### Key fix:

* Removed raw URI inconsistency (medals now persistent)

---

## 🧩 Match System

* Multiple matches per competition
* Shared editor module:

  ```ts
  competitionMatchEditor.tsx
  ```
* Coach-only enrichment:

  * Media
  * Notes
* Parent sees:

  * Summary + coach notes ONLY

---

## 🔁 Navigation + Editing

* `/competition/[id]` → now a **resolver**
* Routes to:

  * Parent edit flow
  * Coach edit flow

👉 Eliminated duplicate editors

---

# 📊 SIGNAL SYSTEM (MAJOR PROGRESS)

## Competition Signals

Added:

* Recent results (last 5)
* Placement trend:

  * improving / plateau / decline / inconsistent
* Podium counts (30 / 90 days)
* Match W/L aggregation

---

## 🧠 Multi-event Intelligence

* Trend requires ≥3 valid events
* Strict monotonic logic
* Ignores invalid/unknown data

---

## 🥋 Skill Focus System

Derived from:

* Match notes
* Event notes
* Outcomes (submission vs points)

Outputs:

* Buckets:

  * Guard retention
  * Sweeps
  * Submissions
  * Defense
  * Positioning

---

## 🎯 Training Focus

* High-confidence only
* No noise injection
* Flows into:

  * Weekly focus
  * AI draft
  * Coach dashboard

---

# 🔄 FULL LOOP COMPLETED

## Flow:

```text
Competition
→ Match notes
→ Skill inference
→ Weekly focus suggestion
→ Coach decision (accept/edit/ignore)
→ Training session guidance
→ Next competition signal update
```

### Key constraints maintained:

* ❌ No auto-writing coach notes
* ❌ No new persistence
* ✅ Fully derived system

---

# 👨‍🏫 COACH SYSTEM

## Team Focus Snapshot

* Aggregates athlete buckets
* Top 2–3 focus areas
* Drill suggestions
* Clipboard export

---

## Coach Override System

* Tracks:

  * Suggested focus
  * Final coach decision
* Behavior:

  * If coach edits → system backs off
  * If accepted → system reinforces

---

# 📱 NATIVE DEV ENVIRONMENT (MAJOR MILESTONE)

## Completed:

* Expo Dev Build installed on physical iPhone
* Xcode signing configured
* Bundle ID resolved
* Device trust established

---

## Working setup:

```text
MatMind Dev (local build)
MatMind (TestFlight)
```

---

## Workflow:

### Daily:

```bash
npx expo start
```

### Native changes:

```bash
npx expo run:ios --device
```

---

## Issues resolved:

* ❌ Device not recognized
* ❌ Developer disk image error
* ❌ Code signing failure
* ❌ Bundle ID conflict
* ❌ Untrusted developer block
* ❌ Dev server not connecting

---

# ⚠️ KNOWN GAPS / NEXT FIXES

## 1. Parent Edit Flow

* Cannot reopen/edit competition from parent side

## 2. Video Upload (Parent)

* Field exists but not wired to picker

## 3. Keyboard UX

* Video link field hidden behind keyboard

## 4. Sorting UX

* Need:

  * Upcoming vs Past separation
  * Month collapse UX refinement

---

# 🧪 QA PLAN (NEXT SESSION)

You will run:

1. Create athlete
2. Add competitions (3–5)
3. Add match data (coach)
4. Validate:

   * Medal gallery
   * Summary signals
   * Weekly integration
   * Coach dashboard

---

# 🧠 STRATEGIC NOTE

Today you crossed from:

```text
Feature building
```

into:

```text
System building
```

The competition system is now:

* a **performance memory**
* a **coaching engine**
* a **feedback loop driver**

---

# 🚀 NEXT PRIORITY

After QA:

1. Fix parent edit + video flow
2. Polish Compete UX (expand/collapse)
3. Validate signals with real data
4. Prepare next TestFlight build

---

# 🎯 FINAL STATE

```text
MatMind now understands:
- what happened
- what it means
- what to do next
```

That is the product.

---





## Date: 2026-05-04

## Summary

Today focused on **system correction and architectural alignment**, not feature completion.

The primary outcome:
→ Weekly direction is now correctly scoped **per athlete**, resolving a critical data integrity issue.

UI work progressed toward the new “This Week” direction but remains intentionally incomplete pending full decomposition.

---

## Commits

- 7839fa6 — Sync This Week with global athlete selection
- 0fb74e0 — Translate This Week into weekly direction surface
- 7f00652 — Align This Week feed with coach direction mock
- 8e83d61 — Replicate This Week coach feed mock
- 3562cc2 — Align This Week shell with coach feed
- a568b6c — Reorder This Week into weekly story flow
- 75691de — Fix coach redirect from This Week
- 7df7c95 — Wire coach dashboard to roster invites
- 5ab0baa — Ignore local env file
- 8b98926 — Enforce sharedAthleteId on weekly publish
- 843f0f6 — EOD May 4 2026 — Lock per-athlete enforcement + decomposition planning

---

## Key Workstreams

### 1. Weekly System Fix (Critical)
- Enforced `sharedAthleteId`
- Blocked invite-level overwrites
- Updated sync + cache + resolve logic

**Impact:**
Fixes cross-athlete overwrite bug and establishes correct data model moving forward.

---

### 2. This Week Iteration
- Shifted toward coach-led weekly narrative
- Synced athlete selection across surfaces
- Improved navigation and redirects

**Status:**
Transitional — not final

---

### 3. Coach System Alignment
- Dashboard connected to roster invites
- Improved coach → athlete flow

---

### 4. Early Architecture Work
- Introduced identity, navigation, invariants, and test scaffolding folders

**Status:**
Not fully validated — requires review before expansion

---

## Product Insight

“This Week” is currently overloaded and violates single-responsibility.

It includes:
- Weekly direction ✅ (correct)
- Practice summary ❌ (should move)
- Coaching history ❓ (undecided)
- Competition data ❌ (should move)

---

## Risks

- Continuing to iterate on This Week without decomposition will increase complexity
- New system folders are introduced but not yet enforced or validated
- UI may diverge from backend correctness if rebuild is not controlled

---

## Next Steps

1. Repo verification (no assumptions)
2. Surface decomposition (map vs move vs new)
3. Build isolated slice:
   - Practice Summary extraction
4. Plan Competition tab
5. Define final home for Coach Connection + Coaching History

---

## Status

- Backend: ✅ Correct
- UI: ⚠️ Transitional
- Architecture: 🟡 Emerging
- Direction: ✅ Clear

System Correction + This Week Decomposition Setup

### Context
Work resumed from prior dev handoff with full alignment to:
- Pre-flight checklist
- 9-step build system (Mock → Spec → Decomposition → Repo Verification → Build → Integration → Validation → Cleanup → Dead Code)
- Codex design mock as source of truth for “This Week”

---

### What Was Accomplished

#### 1. Weekly System Integrity (CORE FIX)
- Enforced `sharedAthleteId` on weekly publish
- Blocked legacy invite-level weekly writes
- Updated:
  - `resolveWeeklyDoc.ts`
  - `weeklyFocusPublish.ts`
  - `coachWeeklySyncApi.ts`
  - `coachWeeklySyncCacheStore.ts`

**Result:**
- Weekly direction is now **per-athlete**
- Eliminates “last publish wins across household” issue

---

#### 2. Coach System Integration
- Wired coach dashboard to roster invites
- Improved coach roster flow
- Continued alignment between coach dashboard and weekly system

---

#### 3. This Week — Directional Iteration (NOT FINAL)
Multiple passes were made to align This Week toward:
- Coach-led weekly direction
- Athlete-specific flow
- Narrative “weekly story”

Changes included:
- Sync with global athlete selection
- Reorder into weekly story flow
- Align with coach feed mock
- Fix redirect/navigation issues

**Important:**
- This Week is still **structurally overloaded**
- No decomposition or migration has been executed yet

---

#### 4. System Foundations (Early Stage)
Introduced new structural areas (not fully validated yet):
- `src/identity/`
- `src/navigation/`
- `src/storage/invariants/`
- `src/storage/tests/`

These represent movement toward:
- clearer system boundaries
- stronger data contracts
- future-safe architecture

---

### Key Product Realization

“This Week” is currently mixing:
- Weekly direction (should stay)
- Practice summary (should move)
- Coaching history (unclear ownership)
- Competition data (should move)

**Conclusion:**
A full **surface decomposition is required before any further UI work**

---

### Current State

- ✅ Backend weekly system is correct (per-athlete enforced)
- ⚠️ UI layer is transitional / not final
- ❌ This Week is not yet decomposed
- ✅ Repo is stable and pushed (summary-rebuild-v2)

---

### Next Session — Entry Point

#### Step 1 — Repo Verification (MANDATORY)
Cursor must scan and confirm:
- All This Week surfaces
- Weekly data flow (read/write)
- Navigation dependencies
- Athlete selection flow

No assumptions allowed.

---

#### Step 2 — Surface Decomposition
Define:
- KEEP → Weekly Direction (This Week core)
- MOVE → Practice Summary (→ Consistency/Summary surface)
- DECIDE → Coaching History
- REHOME → Coach Connection
- NEW → Competition tab

---

#### Step 3 — Build Slice #1 (Isolated)
- Extract Practice Summary into new surface
- Do NOT delete existing implementation yet
- No direct edits to current This Week screen

---

### Rules Going Forward

- No direct mutation of existing screens
- All work must follow:
  → Isolated build → Controlled integration
- Decomposition must be complete before UI rebuild
- Dead code must be proven before removal

---

### Branch
`summary-rebuild-v2`

---

### Last Commit
`843f0f6 — EOD May 4 2026 — Lock weekly per-athlete enforcement + This Week decomposition planning`



## Date: 2026-05-03

---
## 🔴 FIRST TASK TOMORROW
Fix weekly selection logic so requested === available (no fallback, no guessing)
## 🎯 Summary

Today focused on **system correctness, not feature expansion**.

We validated the full **coach → worker → parent weekly pipeline** and isolated the final blocking issue preventing reliable multi-athlete behavior.

System is now structurally sound, but **parent weekly resolution is not yet stable in multi-athlete scenarios**.

---

## ✅ Completed

### 1. Navigation Fix (Parent Route Gate)

Updated:
- src/deviceRole/coachRouteGate.ts

Changes:
- Allowed parent access to:
  - /this-week/kids
  - /this-week/kid/*

Impact:
- Eliminates forced `router.replace("/this-week")`
- Fixes native/JS navigation mismatch warning
- Stabilizes parent navigation stack

Status: COMPLETE

---

### 2. Weekly Pipeline Audit (End-to-End)

Verified:

Coach:
- `sharedAthleteId` correctly derived from kid row
- included in publish payload

Worker:
- validates `sharedAthleteId`
- writes to:
  `weeklyByAthleteId[sharedAthleteId]`

Parent:
- fetches correct session snapshot
- receives correct `weeklyByAthleteId`

Conclusion:
- Data layer is correct
- No corruption in publish or worker

Status: VERIFIED

---

### 3. Root Cause Identified — Weekly Mismatch

Location:
- app/(tabs)/this-week/index.tsx

Problem:
- Parent selects athlete via:
  resolveParentWeeklyInviteFilteredFamilyCompKidId

Failure behavior:
- Multi-athlete scenario falls back to name-sorted kid
- Selected athlete does NOT match published weekly athlete

Observed logs:
- requested ≠ available
- [weekly-doc-missing-athlete]

Conclusion:
- Issue is NOT write or storage
- Issue is parent-side athlete resolution

Status: IDENTIFIED

---

### 4. Partial Fix Applied (Single Athlete Case)

Logic added:
- If exactly one weeklyByAthleteId key → use it

Result:
- Works for single-athlete scenarios
- Still fails for multi-athlete scenarios

Status: PARTIAL

---

### 5. Suggestion Engine (Stable)

Created:
- deriveWeeklyNarrative.ts
- WeeklySuggestionCard.tsx

Behavior:
- Derives weekly suggestion from sparring + activity
- Fills "Why this matters"
- Hidden after edit

Status: STABLE

---

### 6. Parent Feedback Loop

Added:
- viewedAt
- acknowledgedAt

Behavior:
- Parent marks viewed on open
- Parent can acknowledge
- Coach sees status

Status: COMPLETE

---

## ❌ Outstanding Issues

### 1. Weekly Multi-Athlete Resolution (CRITICAL)

Problem:
- Multiple weekly entries exist
- Parent selects athlete without verifying weekly exists

Failure case:
- weeklyByAthleteId = ["A", "B"]
- selected = "C"

Result:
- No weekly shown
- mismatch logs triggered

---

## 🔥 Required Fix (Next Session)

### Guarded Selection Logic

File:
- app/(tabs)/this-week/index.tsx

Replace multi-key logic with:

- derive rosterSharedId
- ONLY return if exists in weekly map
- otherwise return null

Rules:
- DO NOT fallback to keys[0]
- DO NOT fallback to allowed[0]
- DO NOT guess

Expected result:
- requested === available OR requested === null
- no mismatch logs

---

## 🧪 Validation Plan

Run after fix:

### Case 1:
1 athlete
→ publish
→ parent view

Expected:
- weekly shows correctly

---

### Case 2:
2 athletes
→ publish for one
→ view other

Expected:
- no weekly shown
- no mismatch logs

---

### Case 3:
2 athletes
→ publish for both

Expected:
- correct switching behavior

---

## ⚠️ Known Secondary Risk

Parent cache skip condition:
- when only one session exists

May cause stale weekly snapshot:
- less likely source of mismatch
- monitor but DO NOT fix yet

---

## 🧩 Next System Phase

### Multi-Athlete UX (Not Started)

Problem:
- System can return null (correct)
- UI has no way to resolve ambiguity

Needs:
- explicit athlete selection
- clear empty states
- no implicit switching

---

## 🧱 This Week Tab Migration (In Progress)

Goal:
Move from:
- invite-level weekly
- implicit selection

To:
- per-athlete weekly
- explicit selection

Next steps:
- remove legacy fallback paths
- remove "legacy_assignment" mode
- align UI strictly to `weeklyByAthleteId`

---

## 🧠 Coach Tab Direction

Current:
- mixed responsibilities

Target:
- weekly becomes central object
- training + competition support weekly

Not yet implemented

---

## 📌 Current System Status

Navigation: ✅ stable  
Weekly write: ✅ correct  
Worker storage: ✅ correct  
Parent fetch: ✅ correct  
Single athlete: ✅ correct  
Multi-athlete: ❌ broken  
UI clarity: ⚠️ incomplete  

---

## 🎯 Tomorrow Priorities

### MUST
1. Implement guarded weekly selection logic
2. Validate logs (no mismatch)
3. Confirm all test scenarios

### SHOULD
4. Begin





## Date: 2026-05-02

------------------------------------------------------------------------

## 🚨 CONTEXT (CRITICAL)

Today's work was NOT a bug fix.

We changed the **data model and system contract** between: - Coach
Editor - Publish Payload - Worker - Parent Render

Core shift: 👉 **Mission and Study are now independent fields**

------------------------------------------------------------------------

## ✅ WHAT WAS DONE

### 1. MOCK (Design Truth)

-   Defined separation:
    -   Mission = primary intent
    -   Study = supporting content

------------------------------------------------------------------------

### 2. TRANSLATION SPEC (System Contract)

-   No fallback between Mission and Study
-   No shared source fields
-   Payload must reflect:
    -   missionResourceUrl
    -   familyResourceUrl

------------------------------------------------------------------------

### 3. SURFACE DECOMPOSITION

-   Editor: new Mission inputs
-   Store: extended data model
-   Publish layer: corrected mapping

------------------------------------------------------------------------

### 4. 🔍 REPO VERIFICATION

Confirmed: - weeklyFocusPublish.ts fixed - coachKidStore persists both
fields - types updated correctly

------------------------------------------------------------------------

### 5. ISOLATED BUILD

-   Mission inputs added independently
-   No reuse of Study logic

------------------------------------------------------------------------

### 6. INTEGRATION LAYER

-   Publish payload now clean:
    -   Mission comes ONLY from missionResourceUrl
    -   Study comes ONLY from familyResourceUrl

------------------------------------------------------------------------

### 7. VALIDATION (Partial --- QA pending)

-   TypeScript passes
-   Logs confirm separation
-   UI wired correctly

------------------------------------------------------------------------

### 8. CLEANUP / MIGRATION

-   Removed implicit fallback behavior

------------------------------------------------------------------------

### 9. DEAD CODE VALIDATION

-   Old coupling paths effectively neutralized
-   Need follow-up scan to confirm zero references

------------------------------------------------------------------------

## ⚠️ CURRENT RISK

1.  Parent rendering behavior not fully controlled
2.  Clear behavior relies on omission (not explicit clear signal)
3.  Editor allows empty Mission → must verify no stale data

------------------------------------------------------------------------

## 🧪 QA REQUIRED (BLOCKER FOR COMMIT)

Run:

1.  Study only
2.  Mission only
3.  Both
4.  Clear Mission after set

Validate: - Payload correctness - Parent UI accuracy - No stale values

------------------------------------------------------------------------

## 🎯 NEXT STEPS (5/3/26)

### 🔥 PRIORITY 1 --- QA + COMMIT

-   Run all 4 QA cases
-   Validate logs
-   Commit ONLY if clean

------------------------------------------------------------------------

### 🔥 PRIORITY 2 --- PARENT DISPLAY LOGIC

Define explicitly: - If Mission exists → show Mission - If not → show
Study - No ambiguity

------------------------------------------------------------------------

### 🔥 PRIORITY 3 --- CLEAR BEHAVIOR (HARDEN)

Decide: - Omit field vs explicit null - Align worker + client behavior

------------------------------------------------------------------------

### 🔥 PRIORITY 4 --- WORKER VALIDATION

-   Confirm KV behavior:
    -   Does omission retain old value?
    -   Do we need explicit clearing?

------------------------------------------------------------------------

### 🔥 PRIORITY 5 --- DEAD CODE SWEEP

-   Search for any:
    -   familyResourceUrl used as mission
    -   fallback logic
-   Remove safely

------------------------------------------------------------------------

## 📋 ASANA STYLE RECAP

### Completed

-   Separate Mission vs Study data model
-   Update publish payload mapping
-   Extend store + types
-   Add Mission UI inputs

------------------------------------------------------------------------

### In Progress

-   QA validation across flows
-   Parent rendering consistency

------------------------------------------------------------------------

### Blocked

-   Commit pending QA results

------------------------------------------------------------------------

### Next Actions

-   Run QA scenarios
-   Validate logs
-   Commit + push
-   Define parent display rule

------------------------------------------------------------------------

## 🧠 KEY PRINCIPLE

This system now follows:

👉 Intent (Mission) ≠ Content (Study)

If this breaks again: → it will be from hidden coupling

------------------------------------------------------------------------

## END STATE GOAL

-   Coach sets Mission intentionally
-   Study supports it
-   Parent sees correct priority
-   No overwrite, no fallback, no ambiguity

------------------------------------------------------------------------









## Date: 2026-05-01

---

## 🔥 Executive Summary

Today we completed a **major architectural correction**:

We moved from:
- UI-driven summaries
- implicit/global data assumptions

To:
- **athlete-scoped data**
- **strict signal computation**
- **truthful UI expression**

This is not a feature.
This is a **system integrity milestone**.

---

## 🧠 What Actually Changed (Real Truth)

### 1. Athlete Context Became Real

Before:
- Summary read from global sessions
- Athlete switcher was cosmetic

Now:
- `useAthleteData(activeAthleteId)`
- Sessions + competitions filtered at source
- No fallback to global data

👉 Athlete = data boundary

---

### 2. Signals Are Now STRICT (No Lies)

Inside `computeSignals.ts`:

Removed:
- fake weekly windows
- fallback counts
- “0 instead of null”
- pattern generation from empty data

Now:
- `weeklySessionCount = sessions.length`
- `streak = null` if no sessions
- `topSystem / topTechnique = null` if no signal
- `winRate = null` if unknown
- `competitionCount` independent of match arrays

👉 Signals now represent reality, not assumptions

---

### 3. UI Now Reflects Data Truth

Summary cards now:

State | Behavior
------|--------
No data | Minimal / empty state
Low data | “Early signal” state
Real data | Full expression

Removed:
- fake populated cards
- misleading “Start logging” inside metrics
- masked empty values

👉 UI no longer lies to the user

---

## 🧱 Architecture Now (LOCK THIS)
Athlete Switch
↓
useAthleteData (source of truth)
↓
useSignals (pure compute)
↓
Summary UI (expression only)
Rules:
- UI does NOT compute
- Signals do NOT fetch
- Data layer does NOT guess

---

## ⚠️ Known Gaps

1. Competition card still under-expressive
2. GI vs No-GI not clearly surfaced
3. Pattern confidence not visible
4. Small datasets limit insight clarity

---

## 🎯 Tomorrow Focus (2026-05-02)

### Priority 1 — Competition Card
- Make competition the strongest signal when present
- Show:
  - last result
  - matches (if exist)
  - visual emphasis

### Priority 2 — Pattern Confidence
- Add:
  - “early signal”
  - “emerging pattern”
  - “strong pattern”

### Priority 3 — GI vs No-GI
- Must become a visible signal (not hidden in system)

### Priority 4 — Visual Hierarchy
- Primary vs Secondary cards
- Reduce noise
- Increase signal clarity

---

## 🔒 Non-Negotiables Going Forward

- No fallback logic
- No default values masking truth
- No UI pretending data exists
- Every feature must respect:
  **Athlete → Data → Signals → UI**

---

## 🧠 Big Realization Today

The problem was NOT:
- reactivity
- hooks
- memoization

The problem was:
👉 **lack of a strict data boundary (athlete)**

---

## 🧭 Status

System is now:
- stable
- predictable
- debuggable
- extensible

This is the foundation for everything next.


## 🔄 EOD UPDATE — 2026-04-27

### What changed (competition flow + UI alignment)
- **Competition media persistence is verified and stable:** replay for video/image entries works after save and hydration, and media pills render/behave correctly on return.
- **Competition match delete UX is now stable and predictable:** swipe-to-delete behavior was implemented and validated for multi-match delete paths, single-match reset behavior, no index reordering side effects, stronger swipe responsiveness, and full-height delete action alignment.
- **Submission outcome now supports conditional time input:** submission time was added as a conditional input for submission outcomes, normalized to `m:ss`, and verified for persistence + hydration.
- **Outcome UX is locked to chip-based selection with contextual input:** tile-grid outcome selection is removed in favor of chip-only outcome controls with context-sensitive fields.
- **Coach link row was converted into a Training-style collapsible status row:** linked-state indicator is shown directly in the row, and default state is collapsed to reduce visual noise.
- **Coach actions were restructured for clearer hierarchy:** **Refresh weekly note now** now lives under **Manage coach link** as a secondary action instead of sitting as a peer-level action.

### Remaining polish (explicitly still open)
- **Coach label bug:** `Coach: Coach` must resolve to real coach name when available, with a safe fallback when not.
- **Submission time visual integration:** conditional time input still needs tighter visual cohesion with the outcome chips.
- **Coach row hierarchy/chevron polish:** minor visual hierarchy refinement and chevron treatment are still pending.

### Scope guardrails (unchanged systems)
- No API changes in this slice.
- No storage schema/contract changes in this slice.
- No navigation architecture changes in this slice.
- No training tab logic changes in this slice.

### Product direction reinforced
- Competition remains a key upstream input into the upcoming **Summary** tab.
- Coach-parent clarity remains a top UX priority and continues to drive UI hierarchy decisions.

### Next steps (ordered)
1. Validate coach-side flows end-to-end.
2. Test multi-kid behavior to confirm clean data separation.
3. Begin Summary tab build.

---

## 🔄 EOD UPDATE — 2026-04-26

### 1. What broke (facts only)

- **Missing module:** `pickParentPrimaryWeeklySession`
- **Broken navigation:** Family Huddle, Competition
- **Summary UI divergence** from intended design
- **Overwriting of working components**
- **Tab leakage:** `family-huddle` route exposed

### 2. Root cause

- Cursor executed wide-scope edits without guardrails
- No read-first discipline
- Multiple domains edited simultaneously (Summary + This Week + Competition)
- Expo Router + architecture rules not respected

### 3. Recovery actions

- Rolled back to commit `2b54cc2`
- `git reset --hard`
- `git clean -fd`
- Created branch `summary-rebuild-v2`
- Verified app boots

### 4. Product clarity regained

**This Week = ACTION ENGINE**

- Mission (watch + practice)
- Family Huddle (coach → parent)
- Training CTA
- Competition visibility

**Summary = REFLECTION ENGINE**

- Sessions
- Competition stats
- Trends over time
- Customizable tiles (comp record, submission rate, fastest sub, top submission)

### 5. Competition system (LOCKED)

- **Hero** = next competition
- **Upcoming** = horizontal swipe cards
- **Past** = horizontal swipe cards
- All competitions editable post-event

**Inside competition**

- **Result types:** submission, points, ref decision, DQ, injury stoppage
- **Submission** → time input + technique picker
- Match uploads via camera roll

**Coach side**

- Must be editable (currently broken)

### 6. QA findings

- Bland UI
- Misplaced "no sessions logged"
- Linked state unclear
- Family Huddle broken
- Competition detail broken
- Summary header safe area issue
- Edit Summary mismatch (toggles vs tiles)

### 7. Non-negotiables

- No multi-scope edits
- Always read before edit
- No deleting modules without verification
- UI cannot break data layer
- Validate navigation per tap
- Hidden routes stay hidden
- Cursor = plan → approve → execute only

### 8. Next session plan

1. Fix competition system
2. Restore This Week hierarchy
3. Rebuild Summary (aligned to Stitch)
4. Full navigation QA

---

## 🔄 EOD UPDATE — 2026-04-17

### What changed (UI + UX)
- **This Week tab (parent lane)** — `app/(tabs)/this-week/index.tsx`: editorial layout (design tokens); weekly story as primary hero; **Keep refining** when `familyCoachRecapNote` is present; **Instant insights**; tighter **training + competition** presentation. **Presentation only**—no intentional business-logic or data-source changes in this slice.
- **Link athletes** — `app/(tabs)/this-week/parent-athletes.tsx`: success strip **“You're connected to [coach]”**; optional **“This week's focus:”** from cached weekly **`headline`** via `getCachedWeeklyForLinkToken` (existing cache + storage only).

### What was fixed (paste / editability)
- **Join** — `app/(tabs)/this-week/join.tsx`: invite `TextInput` **`editable={!busy}`** so **paste** works when the field should accept input.

### Connect blocked: build / environment, not product logic
The **connect flow is blocked** because the **running build does not have the coach sync base URL embedded**.

- `isCoachSyncConfigured()` resolves from:
  - `EXPO_PUBLIC_COACH_SYNC_BASE_URL` (env)
  - `extra.coachSyncBaseUrl` (app.config)

- If neither is present in the **actual binary running on device**, the Join screen shows:
  **“Coach sync URL missing”** and Connect cannot proceed.

This is a **build/environment mismatch**, NOT a regression in:
- sync logic
- API
- storage
- navigation

Until one of these resolves to a non-empty URL in the **binary you run**, `isCoachSyncConfigured()` stays false and Join cannot call the worker. **This is a BUILD / ENVIRONMENT mismatch—not redeem logic, not sync architecture.**

### What is NOT broken (unchanged today)
- API contracts, navigation, storage schemas, and worker/sync wiring were **not** changed in this slice.

### Current focus (next session)
1. **Fix environment (non-negotiable)**  
   - Confirm the coach sync base URL exists in the **RUNNING** app.  
   - Rebuild the **correct** variant so env / `extra` match how you install and launch.

2. **Validate connect flow end-to-end**  
   - Paste → Connect → Parent-athletes → Success strip → **This Week**.

3. **QA redesigned This Week tab**  
   - Confirm no regression in: **weekly sync**, **training**, **competition**.

---

## 🔄 EOD UPDATE — 2026-04-01 (Build 22 QA Launch)

### What we did
- Build 22 uploaded to TestFlight
- Internal testers group configured
- Created structured QA plans for parents and coaches
- Generated PDF test sheets for testers
- Defined TestFlight “What to Test” instructions
- Shifted focus from development → real user validation

### What this unlocked
- First real-world validation of parent + coach training loop
- Clear tester guidance and feedback structure

### Current focus (next session)
- Deploy Build 22 to:
  - 3 black belt coaches
  - 3+ families
- Ensure all testers install via TestFlight (not dev builds)

### Known risks
- Coach Share visibility and clarity
- Parent confusion logging first session
- Session visibility bugs (regression check)
- Weak understanding of coach role

### Success criteria (this week)
- Parent logs 2–3 sessions without help
- Coach understands value without explanation
- No data loss or missing sessions
- At least 3 strong feedback insights collected

### Reminder
No new features. Focus on usability, clarity, and habit loop.

# BJJ Tracker —
Action: think-hard look through this Developer Handoff notes, plan out the day. If you are making assumptions, tell me when you are doing so. Let's get to work

## Non-negotiable: Dev/TestFlight coexistence.
Keep two separate bundle IDs forever:
- Prod/TestFlight: `com.ortizdigitalstudio.matmind`
- Dev: `com.ortizdigitalstudio.matmind.dev`

Never overwrite the TestFlight app with dev installs again.
Keep Xcode target stable across variants.
Do not change Expo name per variant (can break Xcode targets / EAS).
Use `ios.infoPlist.CFBundleDisplayName` for the Dev icon label (“MatMind Dev”).

## TestFlight is “beta reality.”
Nothing affects testers until we ship a new TestFlight build.
Validate bugs in TestFlight whenever possible, not only in Dev.

## Feature flags stay (but “code flags,” not build CLI flags).
Keep dev-only flags persisted locally (AsyncStorage) and guarded by `isDev()`.
Flags live under `src/config/*` and are toggled in Dev Settings.
Do not rely on EAS/Expo prebuild CLI flags for product behavior.

## Dev tooling lives in Dev Settings, not onboarding flows.
Avoid putting dev-only navigation inside Welcome/onboarding screens (redirect logic causes loops).
Use Dev Settings “Dev Shortcuts” to reach hidden routes.

## Hidden routes stay hidden from the tab bar by default unless intentionally exposed in dev.
Use `href: null` for internal routes and nested **This Week** / **Learn** stack screens so join flows, kid drill-downs, and legacy tab filenames do not leak as extra tabs.
In Dev, the weekly coach/parent lane is the **This Week** tab (`app/(tabs)/this-week/**`); Profile remains the home for account/settings and dev shortcuts. Black Belt / coach feedback builds still use `docs/release-checklist-ios.md` (prod bundle, Coach Share visibility rules there).
Tester-facing tab exposure in Dev is intentionally simplified to four tabs:
- This Week
- Training
- Learn
- Profile

Welcome remains available as a hidden/onboarding route, not a permanent tab.

## Terminal-first workflow is the default.
Prefer terminal-driven, repeatable edits and commands wherever practical.

**Black Belt / coach feedback TestFlight lane** (Coach Share visible, same prod bundle ID): `npm run build:ios:feedback` → then `npm run submit:ios:feedback`. Full preflight, ASC audience rules, and prod vs feedback distinction: `docs/release-checklist-ios.md` (section *Black Belt / coach feedback build*).
Minimize manual editor changes.
If a task is not easy to do from terminal, treat that as a workflow gap to fix rather than a reason to default to hand-editing.
Use Cursor in a supervised workflow with terminal-visible commands, scoped diffs, gates, and intentional commits.

## No ad-hoc patching as a default workflow.
Avoid brittle regex/sed/perl “injection” edits for features.
Prefer clean, intentional file edits + TS/ESLint gates + clear commits.
Only use patching as emergency repair, not normal iteration.

## Gates are the source of truth (not Cursor summaries).
Always run:
- `npx tsc --noEmit`
- `npx eslint .`

before pushing meaningful app changes.

## Avoid reintroducing router landmines.
Screen names must be unique in `app/(tabs)/_layout.tsx`.
Do not let hidden/internal routes leak into the visible tab bar.

## Operational note to keep running:
When connecting Dev Client:
- Mac + iPhone on same hotspot/Wi-Fi
- macOS Firewall off or allow Metro/Node

Keep a dedicated build terminal untouched while EAS runs; use a separate tab for edits.

---

# BJJ Tracker — Developer Handoff Notes

**Project:** BJJ Tracker / MatMind Jiu Jitsu  
**Branch:** `dev`  
**Repo:** `israelortizsoto-BJJ/bjj-tracker`  
**Date:** 2026-04-17  
**Status:** **Build 21 bridge QA is complete** in Dev: multi-kid **invite truth** is confirmed end-to-end for parent and coach, and the **shared Family Huddle** model is confirmed as **invite-scoped** with **last publish wins** (still a **known product limitation** until Option B). A **critical training bleed bug** is **fixed**—coach-logged kid training sessions **no longer incorrectly surface on the parent side**. **Competition video** support is **shipped coach-side only**: up to **three** videos per competition entry. **Family Huddle** remains **invite-scoped**, not per-athlete. The **build is ready for the release flow** (cut Build 21 → internal testers / coaches); **TestFlight / external tester truth** updates only after upload and verification as documented here.

**2026-04-17 (latest session):** Parent **This Week** UI pass (hero, **Keep refining**, **Instant insights**, compressed training/competition); Join **paste** fix; parent-athletes **connected** strip + optional **This week's focus** from cache. **Connect is blocked when the coach sync base URL is missing from the running build**—**environment**, not product logic. No API, navigation, storage schema, or sync-architecture changes in this slice.

**2026-04-01 (latest):** Final **Build 21 bridge QA pass** closed: multi-kid invite truth across parent and coach verified; shared **Family Huddle** behavior (invite-scoped, last publish wins) explicitly confirmed. **Training bleed fix:** sessions logged by the coach for a linked kid no longer appear on the parent training surface. **Competition:** coach-side entries support up to **three** competition videos per entry (parent-side competition video archive **not** in this build). Release posture: **ready to cut Build 21** and ship to internal testers/coaches.

**2026-03-31:** Multi-kid truth alignment: parent **This Week** now uses **truly linked kids** for the active invite in Dev; coach roster visibility was improved so invite-linked multi-kid truth reads more accurately; parents can open **Athletes on this invite** from the manage-coach link screen; parent and coach views agree more clearly on **invite-linked** kids. Household save-state on coach kid detail: save is **disabled when not dirty**, shows a clear **Saved** state after success, and redundant helper text was removed. **Session persistence Phase 1:** a real raw-session boundary (`getSessions`, `setSessions`, `deleteSessionsForKid`) now backs `app/(tabs)/training/[id].tsx` and `src/storage/coachKidStore.ts`—no storage schema migration. **Shared-vs-child UI honesty:** Family Huddle / weekly note wording was updated for clarity only (shared-per-invite reality).

**2026-03-27:** A narrow **release-shaping** cleanup landed for the next feedback build: **This Week** / **Learn** shells were tightened after two-device QA; duplicate top headers were fixed by letting nested stack headers own those tabs; coach **This Week** root (`/this-week`) is now a short coach landing with a CTA into Kids roster, while the parent root keeps the family-facing weekly experience (coach root no longer shows parent-facing Family Huddle, parent competition shell, parent link-refresh shell, or root weekly-focus preview). Visible internal/dev exposure for feedback logic was reduced; **Profile** internal controls remain intentionally available in dev/internal contexts. This was **not** a sync expansion or architecture refactor—worker-backed weekly scope and the parent-entered training/competition boundary are unchanged. **TestFlight remains older shipped reality** until a new build is uploaded and documented here—nothing below is claimed as external-tester truth yet.

**2026-03-30:** Build 20 QA cleanup + verification landed in Dev with three core outcomes: (1) parent training save flow now returns directly to **This Week** after save, and back-navigation to **This Week** uses clean replace behavior instead of stack-growing push behavior; (2) coach writing keyboard usability for multiline fields was hardened (including stronger re-scroll behavior) for **What Matters Next** and **Weekly Focus**, validated on device; (3) coach workflow cleanup now lands **Log Session** on the main **Training** tab and de-emphasizes Add Kid roster UI in Dev when linked athletes already exist (manual add fallback still available in Dev, production Add Kid behavior unchanged). A **Dev-only** parent-side **New coach update** banner is now implemented as an MVP awareness layer from `weekly.updatedAt` vs local last-seen state; no production/TestFlight rollout is claimed for this banner in this handoff.

On `dev`, the Coach Share lane now includes a role split (**Coach** and **Parent**) with a role picker and role-specific profile entry behavior. Worker-backed sync is deployed and active for invite/redeem + shared athlete linking + weekly note/shared-athlete visibility. Two-device smoke succeeded in Dev: coach creates invite, parent accepts invite, parent adds athlete, and coach sees the athlete as linked. Current limitation remains unchanged for deeper data: parent-entered **training logs** and **competition data** still do **not** sync back to coach and remain local-only on the parent side.

## Git checkpoint

**Before build or release work:** run `git status -sb` (and the usual gates) so you see the exact tree on that machine — branch position and cleanliness can differ between clones.

Earlier handoff language about a **dirty tree**, **ahead by 22**, and **weekly sync living only in uncommitted changes** is **obsolete**. **Dev truth** is the **committed** history on `dev`, especially the **Family Huddle** story, **coach → parent publish**, and **link-binding / reconnect hardening** slice.

**TestFlight** is still **older shipped reality** until a new feedback build is uploaded and noted here — do not assume external testers match Dev.

**Recent commits (this slice):**
- `9d805a6` — Polish: tighten weekly routing and hide internal controls
- `4b37521` — enforce strict parent weekly link state and reconnect flow
- `af919e4` — polish coach-share copy and simplify unlink path
- `1a5d4e1` — improve competition sync recovery and unlink helper messaging
- `4fd1d99` — stabilize coach-parent link binding and publish readiness

## ODS founder roll-up rule
If MatMind had meaningful work today, that work should be reflected in ODS the same day.

Do not copy the full engineering handoff into ODS.
Instead, roll up the founder-level meaning:
- product movement
- user signal
- proof value
- strategic implications
- risks
- next move

## Process note (2026-03-22)
Continued **slice → device QA → fix**. **Family competition** and **household** work are **validated in local dev** on a tree that includes the commits above — not claimed for TestFlight. **Weekly sync** is the next **integration** step: worker + env + **two builds** before end-to-end smoke. Assume **older external tester devices** may be on a **build that does not yet include** sync changes until explicitly verified.

## Product / strategy (planning; not shipped product)
- Michelle feedback pushed **competition/tournament structure** toward **future AI analysis**.
- **Tier model / pricing** exploration started; **AI capabilities likely land in Pro by default**; **dashboard cost posture** under discussion.

## What we completed most recently

### 2026-04-01 — Build 21 bridge QA complete + training bleed fix + competition video upgrade
- **Build 21 bridge QA (final pass):** Multi-kid **invite truth** verified across **parent** and **coach**; **shared Family Huddle** model verified as **invite-scoped** with **last publish wins** (documented limitation until Option B)
- **Training bleed fix (critical):** Coach-logged kid **training sessions** no longer incorrectly appear on the **parent** side
- **Competition videos (coach-side only):** Up to **three** competition videos supported per competition entry on the coach path
- **Release readiness:** Build 21 is **ready for release flow** (cut → internal testers / coaches); external/TestFlight truth still follows upload + handoff update

### 2026-03-31 — Multi-kid truth, household polish, session persistence Phase 1, Family Huddle wording (Dev)
- **Multi-kid / invite alignment:** Parent **This Week** kid selector uses **truly linked kids** for the active invite in Dev; coach roster visibility improved for more accurate invite-linked multi-kid truth; parent can reach **Athletes on this invite** from the manage-coach link screen; parent and coach sides align more clearly on **invite-linked** athletes
- **Household save-state (coach kid detail):** Save control **disabled when not dirty**; **Saved** state after successful save; redundant helper text removed
- **Session persistence Phase 1:** Raw session API—`getSessions()`, `setSessions(next)`, `deleteSessionsForKid(kidId)`—with `app/(tabs)/training/[id].tsx` and `src/storage/coachKidStore.ts` rewired; **no** AsyncStorage key/schema/version change
- **Family Huddle / weekly note copy (clarity only):** Coach and parent screens use wording that reflects the **shared-per-invite** published model; this is **not** Option B (per-athlete published weekly plans inside one invite)
- **Model truth (research / current product, not solved today):** Local coach **weekly focus** remains **kid-scoped**; synced **Family Huddle / weekly note** remains **invite-scoped** with **last publish wins** for the invite; **parent child pills do not change** which published Family Huddle content is shown

### 2026-03-26 — parent weekly dashboard redesign
- Rebuilt the parent weekly screen into a stronger “what to do this week / what to track this week” flow
- Used live spouse/parent usability feedback to tighten copy, hierarchy, CTA clarity, and section behavior
- Preserved the working Family Huddle / publish / training / competition loop while improving the parent experience (same data layer; coach-parent sync behavior unchanged)

### 2026-03-26 — Custom Weekly Focus edit fix
- Fixed weekly-focus editing so **Custom Focus** is active/selectable again when editing an existing entry

### 2026-03-26 — 4-tab IA restructure for external feedback
- Promoted the weekly coach/parent lane to a main **This Week** tab (`app/(tabs)/this-week/**`)
- Consolidated Fundamentals + Gear into **Learn** (`app/(tabs)/learn/**`)
- Removed Welcome from the permanent tab bar (kept as hidden/onboarding entry)
- Updated redirects/dev links and fixed leaked scaffold tabs in Expo Router

### 2026-03-27 — weekly routing polish for next feedback build
- Narrow release-shaping cleanup after two-device QA: coach **This Week** root, parent **This Week** root, **Training**, **Learn**, and routing sanity
- Cleaned up **This Week** / **Learn** shell; fixed duplicate top headers by letting nested stack headers own those tabs
- Coach **This Week** tab root: short coach landing + CTA into Kids roster; coach root no longer shows parent-facing Family Huddle, parent competition shell, parent link-refresh shell, or root weekly-focus preview
- Parent **This Week** tab root: keeps the family-facing weekly experience
- Reduced visible internal/dev exposure for feedback logic; **Profile** internal controls remain available intentionally in dev/internal contexts
- Commit: `9d805a6` — *Polish: tighten weekly routing and hide internal controls*

### 2026-03-30 — Build 20 QA cleanup + verification (Dev)
- Parent training save flow now returns directly to **This Week** after save
- Back to **This Week** behavior moved from stack-growing push to clean replace
- Coach note terminology cleanup in UX copy/actions:
  - **Coach Note**
  - **Optional detail**
  - **Save Note**
  - **Edit Note**
- Multiline keyboard/input visibility fixed across coach writing flows:
  - **What Matters Next**
  - **Weekly Focus**
- Final multiline fix required stronger re-scroll behavior on multiline fields; verified on device
- Coach **Log Session** now lands on main **Training** tab (not forced `/training/new`)
- In Dev, Add Kid roster UI is de-emphasized when linked athletes already exist; manual add fallback remains available
- Production behavior for Add Kid remains unchanged
- Added **Dev-only** parent-side **New coach update** banner MVP:
  - Banner uses server `weekly.updatedAt` + local `lastSeenUpdatedAt` per `linkToken`
  - Banner appears only on successful fetch when server timestamp is newer than last seen
  - Offline cache reads do not advance seen-state
  - No production/TestFlight behavior change

### 2026-03-25 — strict parent link-state + reconnect hardening
- Added canonical invite-token normalization and shared coach-link binding helpers
- Tightened parent weekly “linked” truth so weekly sync now requires a stricter redeemed parent channel, not just any local active weekly row
- Fixed the parent auto-relink contamination loop: after remove-link, parent now stays truly unlinked until an intentional reconnect
- Fresh invite → intentional reconnect → relink existing child → coach publish flow now passes again in Dev
- Added a safe coach publish fallback when exactly one active writer session contains the child, but otherwise fail honestly
- Roster truth and publish truth are now more tightly aligned
- Temporarily added DEV tracing for auto-relink; used it to identify the problem path — final passing QA came after the strict linked-state fix

### 2026-03-25 — coach/parent unlink/revoke honesty
- Revoke/remove-link paths now clear local linked presentation more honestly
- Coach roster no longer relies as heavily on stale local child linkage alone
- Parent and coach are less likely to diverge into “looks linked here, not writable there” states

### 2026-03-25 — external-feedback polish follow-up
- Removed duplicate parent unlink affordance in the main parent weekly flow
- Reduced remaining visible “pilot” language in key user-facing areas
- Tightened parent athlete-linking copy
- Polished Family Huddle copy on the remaining rough cards

### 2026-03-24 — Family Huddle / weekly story rework
- Parent “Read together” was rebuilt into a stronger five-card family story:
  1. Mission of the week
  2. What we sharpened with Coach
  3. On the mats this week
  4. Study the move
  5. The bigger journey
- New shared story-card mapper and modal:
  - `src/family/readTogetherStoryCards.ts`
  - `src/family/ReadTogetherStoryModal.tsx`
- Parent entry CTA updated to **“This week’s family huddle”**
- Parent weekly heading is now family/invite-scoped, not athlete-scoped
- Family link behavior works on parent side, including YouTube / Instagram family links
- Card 2 recap now updates and clears correctly after publish

### 2026-03-24 — Coach Family Huddle publish clarity
- Coach kid detail was simplified and re-ordered:
  - stronger **What matters next**
  - **How it’s going** visually subordinated
  - Family / Publish lane moved higher and made easier to understand
- Coach-side Family Huddle source map now mirrors parent card headings
- Weekly focus editor labels now align with Family Huddle:
  - Mission of the week
  - What we sharpened with Coach
  - Study the move
- Preview CTA renamed to **Preview Family Huddle**

### 2026-03-24 — Parent unlink / relink hardening
- Parent can unlink a child from coach without deleting the child profile
- Parent can relink an **existing** child profile to the invite/session instead of creating duplicates
- Reconnect flow now surfaces existing kids first

### 2026-03-24 — Competition sync hardening
- Parent-to-coach competition create/delete is working in Dev on the intended edit/delete path
- Synced competition rows no longer expose swipe delete on parent weekly list
- Coach-side competition refresh behavior is reliable with explicit refresh control
- Invite clutter on coach side was reduced and invite cards now show linked athlete context

### 2026-03-22 — Family Competition parent lane (**committed** locally: `6e10dd7` → `c1b4369`, `d5cb4af`, `353f6bd`)
- **Parent-owned local lane** on the Coach Share weekly surface: **add / edit / delete** competition entries for the family view, **format** support, **month grouping** with **chevron** expand/collapse, **multi-kid child chips** (selection stored per device; resolves against pilot roster via `src/family/coachShareCompetitionBuckets.ts`), and a **stronger family palette** aligned with the weekly story.
- **Screens / wiring:** `app/(tabs)/profile/coaches/family-competition/edit.tsx` (hidden route in `app/(tabs)/_layout.tsx`); list + navigation from `app/(tabs)/profile/coaches/index.tsx`; shared bucketing/helpers in `coachShareCompetitionBuckets.ts`; stores/types as in `kidCompetitionStore`, `coachKidStore`, `src/types/coachKid.ts`.
- **Explicit scope:** this is **local AsyncStorage / on-device** behavior for the family competition lane — **not** replicated by the weekly sync milestone below.

### 2026-03-22 — Household grouping + editing (**committed:** `83588d7` and related roster work)
- **Household label on create** when adding a pilot kid; **roster grouped by household** on `kids.tsx`; **edit household** on existing **`kid/[kidId]`** detail.
- **Explicit scope:** household metadata is **local** to the device like the rest of the pilot roster until a future sync design ships.

### 2026-03-22 — Coach add-kid form keyboard (**committed:** `f7873a3`)
- **Keyboard visibility** issue on the coach **add-kid** form addressed (layout / scroll behavior as implemented in `kids.tsx`).

### 2026-03-23 — Weekly sync + shared-athlete dev smoke (**deployed + validated in Dev**)
- **Intent in this slice:** worker-backed invite/redeem + shared athlete link + weekly note/shared-athlete visibility, not full parent data replication.
- **Coach path:** create/link session (tokens + writer secret), publish weekly payload (`src/coach/weeklyFocusPublish.ts`), and consume worker APIs through `src/services/coachWeeklySyncApi.ts`.
- **Parent path:** join/redeem invite, parent-side athlete add, weekly document fetch and cache (`src/storage/coachWeeklySyncCacheStore.ts` and related Coach Share UI files).
- **Worker:** `coach-sync-worker/` is now deployed; invite flow and shared-athlete link worked after redeploy.
- **Validated in Dev (two-device):** coach invite -> parent accept -> parent adds athlete -> coach sees linked athlete.
- **Current sync boundary:** parent-entered competition/training rows remain local-only; these do not yet sync back to coach.

### 0) Family Coach Share weekly surface + join + weekly story (`624a50e` → `ec7c8f5`)
- **Profile** entry line: **“This week with your coach”** (`app/(tabs)/profile.tsx`).
- **Coach Share home** weekly framing: **“This week together”**; **finite weekly story** with step label **Read together · N of M**; **early-exit** control so families are not trapped in the story.
- **Join** flow polish and copy (e.g. **“This week together”** privacy note on device-only storage in `join.tsx`).

### 1) Competition: structured context + form polish (`746a1af`, `a3dfaa6`)
- **Types / persistence**: optional **`eventStatus`**, **`organizationOrPromoter`**, **`outcomeKind`** on `KidCompetitionEntry` (`src/types/coachKid.ts`); wired through store and **competition/edit** for future AI-readiness.
- **Form UX**: field visibility and order fixes, **notes** scroll behavior, **save helper**; **Save / Delete** actions moved back into the **normal scroll flow** (not pinned outside scroll).

### 2) AI Drafting Slice 1 — `what-matters-next` (`6d57f00`, `23a4047`)
- **Coach-in-the-loop** flow on `app/(tabs)/profile/coaches/kid/[kidId]/what-matters-next.tsx`: load local payload → **mock generator** → modal **review** → coach **applies** to drafts or **discards** (**no auto-save** from drafting).
- **Implementation**: `src/ai-coach/whatMattersNextDraftTypes.ts`, `loadWhatMattersNextDraftPayload.ts`, `whatMattersNextDraftGenerator.ts` — **deterministic local stand-in** until a real provider exists (`mockWhatMattersNextDraftFromPayload` / `getDefaultWhatMattersNextDraftGenerator`).
- Copy/instructions tuned for **adoption** and clarity that this is **assistive**, not autonomous.

### 3) Coach kid profile: standing guidance, guidance-first stack, swipe deletes (`56f7b43` → `89f0813`) — prior day, still current
- **Standing guidance — “What matters next”** (`kidStandingGuidanceStore`, `what-matters-next`): per-kid headline + optional detail; **top card** on kid detail; cleared when the kid is roster-deleted.
- **Guidance-first top stack** on kid detail: *What matters next* → *This week’s focus* → *How it’s going* (outcome + append-only **check-ins** + this-week list) → *This week’s training* → *Competition*.
- **Lower-half simplification**: compact summary cards; week lists **cap at 3 rows** with overflow to **History** / **Training** where relevant.
- **Editability**: `weekly-focus` and `competition/edit` support **`entryId`** for in-place edits; **`progress-reflection`** screen for editing a saved check-in; **`history`** opens the correct editor (focus vs check-in) per row.
- **Swipe-to-delete** (kid detail): saved **check-ins**, **this-week training sessions**, and **competition** rows — confirm, then persist.
- **Shared delete helpers**: `deleteKidWeeklyFocusEntryById` (`coachKidStore`) and `deleteSessionById` (`sessionsStore`) back the swipe paths and keep persistence aligned with the training editor / weekly-focus log.
- **Tab layout**: hidden routes registered for `what-matters-next` and `progress-reflection` (`app/(tabs)/_layout.tsx`).

### 4) Coach Share kid tracking flow + weekly focus history (`13f09f5`)
- **Kids roster** (`/profile/coaches/kids`): add a kid, list pilot roster, **swipe-to-delete** with confirmation.
- **Kid detail** (`/profile/coaches/kid/[kidId]`): **this week** focus (latest log for Monday-week), **Set / edit this week’s focus** → `weekly-focus` (templates + custom; **append-only** logs; **edit via `entryId`** when improving an existing row), **History** → `history` (grouped by week, expandable; opens appropriate editor).
- **How it’s going (was: progress reflections on detail)**: outcome chips + notes on kid detail append **check-ins** for the week (append-only); gated on having a focus saved for the week. Tap a row → `progress-reflection`; swipe → delete check-in.
- **`coachKidStore`**: `KidsById` + `kidWeeklyFocusEntries` in AsyncStorage; caps (e.g. 60 focus rows/kid); weekly focus rows removed when a kid is hard-deleted (see `9fb7e3a` cascade). Roster hard-delete also removes **standing guidance** (`deleteKidPilot` order: competitions incl. media → linked training sessions → weekly focus → standing guidance → roster).

### 5) Kid competition tracking + roster hard-delete (`9fb7e3a`)
- **Competition** on kid detail: month-grouped list; **Add/edit** via `competition/edit` (tournament name, date, result, notes, optional video; **plus** optional structured fields `eventStatus` / `organizationOrPromoter` / `outcomeKind` as of 2026-03-21).
- **`kidCompetitionStore`**: create/update/delete; per-kid cap (60); **best-effort delete of persisted video files** when entries are removed or a kid is deleted.
- **`persistCameraRollMedia`**: copy picked camera-roll media into `documentDirectory/media/` (same pattern as training sessions); `bestEffortDeletePersistedMedia` for cleanup.
- **Roster delete** (`deleteKidPilot`): ordered cleanup **competitions (incl. media) → linked training sessions (kidId) → weekly focus → standing guidance → roster** to avoid orphan `kidId`s and stray pilot data.

### 6) Kid training linkage + progress reflections (`ab85fcd`)
- **Kid detail** (`/profile/coaches/kid/[kidId]`): **This week’s training** with CTA to log via `/training/new?date=...&kidId=...`; session rows open the training editor; **swipe** deletes via `deleteSessionById`.
- **Training tab** (`app/(tabs)/training.tsx`): when `kidId` param is present, sessions are filtered to that kid and the “Add Session” CTA preserves `kidId`.
- Session editor (app/(tabs)/training/[id].tsx): persists kidId on the saved session so kid linkage survives navigation.
- **Check-ins / reflections**: this-week list on kid detail reflects saved check-ins; deep-edit on `progress-reflection`.

### 7) Still in place from prior Coach Share pilot work (unchanged intent)
Parent-first Coach Share hierarchy, coach pilot preview quality, **custom focus** in templates, and **reference link** support (**YouTube + Instagram**) on the template/preview path.

## What passed

### Gates
- `npx tsc --noEmit` and `npx eslint .` passed at **`83588d7`** for an **earlier** committed batch (per prior session discipline); **re-run both** on current `dev` before trusting release readiness (includes routing polish through **`9d805a6`**).
- The **uncommitted weekly-sync working tree** has **not** been asserted as gated in this handoff — **re-run both** after committing or before any push/release cut.

### Production config validation
Validated:
- `name = MatMind Jiu Jitsu`
- `ios.bundleIdentifier = com.ortizdigitalstudio.matmind`
- `extra.appVariant = prod`

### Product / release validation
Validated:
- Dev-validated parent weekly redesign still preserves **coach → parent weekly publish**
- Dev-validated parent **training** and **competition** flows still pass after the redesign (in the tested Dev loop)
- Dev-validated **Custom Weekly Focus** editing works again (Custom Focus path when editing an existing entry)
- Dev-validated **4-tab** structure (**This Week** / **Training** / **Learn** / **Profile**) is in place in Dev
- **2026-03-27 (Dev):** two-device QA passed after weekly routing polish for coach **This Week** root, parent **This Week** root, **Training**, **Learn**, and basic routing sanity—**not** claimed for TestFlight until a new build ships and is documented here
- **2026-03-30 (Dev):** Build 20 QA cleanup and on-device verification passed for parent save/back nav behavior, coach multiline writing visibility, and coach Log Session landing behavior
- **2026-03-31 (Dev):** Multi-kid invite alignment, household save-state behavior, session persistence Phase 1 wiring, and Family Huddle wording validated in the Dev lane; **TestFlight** is still **not** updated or claimed for this slice until a new build ships and is documented here
- **2026-04-01 (Dev):** Build 21 bridge QA complete—multi-kid invite truth, Family Huddle shared-invite model, training bleed fix, and coach-side multi-video competition entries verified in the Dev lane; **ready to cut Build 21** for internal testers/coaches; **TestFlight** remains stale until a new build ships and is documented here
- **2026-03-30 (Dev):** parent **New coach update** awareness banner is implemented as **Dev-only MVP** and is intentionally not claimed for production/TestFlight
- Dev-validated fresh-path reconnect flow still passes (unlink → fresh invite → intentional reconnect → relink → publish → parent receive)
- Dev-validated parent stays unlinked until intentional reconnect (no surprise auto-link from a fresh invite alone)
- Dev-validated coach publish after fresh reconnect passes
- Broader **TestFlight** reality is still not updated until a new build ships and is documented; treat TestFlight as stale vs Dev until then
- Build 18 is still the latest documented TestFlight reality for broader testers, and is older than the newest Dev-validated shared-athlete role-split slice
- **2026-03-21 batch** (family weekly Coach Share surface, competition structured fields + form polish, mock **What matters next** drafting): treat as **Dev / local** until a new TestFlight is explicitly validated and noted here—not assumed for **broad** TestFlight testers
- **2026-03-22 batch** (**Family Competition** lane, **household** roster/editing, **keyboard** fix, palette): **working in local dev** on commits through **`83588d7`** — **not** claimed for TestFlight or broad testers
- **Weekly two-device sync + shared athletes:** validated in Dev on a two-device setup; worker-backed invite/redeem and athlete linking are working in that lane
- **2026-03-24 batch:** Dev-validated Family Huddle end-to-end (coach publish -> parent weekly family note/link -> parent Read together / Family Huddle flow)
- **2026-03-24 batch:** Dev-validated parent unlink/relink hardening (unlink does not delete child profile; relink reuses the existing child without duplicates)
- **2026-03-24 batch:** Dev-validated competition create/delete sync on the intended edit/delete path (synced competition rows no longer expose swipe delete on the parent weekly list; coach-side competition refresh is reliable with explicit refresh control)
- **TestFlight boundary:** still do not overclaim TestFlight availability until a new build is explicitly shipped and documented
- **Competition/training cross-device sync:** broader training sync remains out of scope here; parent-entered training logs can still reflect device-local training activity realities on parent (no broader parent->coach training replication implied in this slice)
- **Kid roster / standing guidance / weekly focus / check-ins / kid-linked training / competition + swipe row deletes:** exercised via **Dev / local pilot** (not stated as live in the current TestFlight build)
- **TestFlight** navigation may still differ from Dev (4-tab **This Week** / **Learn** stack) until a new build is uploaded and documented
- Weekly template/preview on the coach side remains cleaner (debug data hidden; clearer preview state)
- Custom focus is supported in weekly templates and preview
- Reference link pill supports YouTube + Instagram links

## Commits landed most recently
- `9d805a6` — Polish: tighten weekly routing and hide internal controls
- `83588d7` — Add household editing for existing coach pilot kids  
- `f7873a3` — Fix keyboard visibility in coach kid add form  
- `d5cb4af` — Add family competition child selection for multi-kid households  
- `353f6bd` — Strengthen family palette for weekly story and competition  
- `c1b4369` — Add shared family competition flow and format support  
- `6e10dd7` — Fix family competition add form reset behavior  
- `8510ce8` — Docs: update handoff and recap for family weekly, AI draft, and competition context  
- `23a4047` — Add coach-guidance drafting flow for what matters next  
- `6d57f00` — Simplify AI drafting instructions for coach guidance  
- `746a1af` — Add structured competition context for AI-ready analysis  
- `a3dfaa6` — Move competition actions back into scroll flow  
- `ec7c8f5` — Add early exit control to family weekly story  
- `ee6df4e` — Polish family-facing coach join flow  
- `624a50e` — Refactor Coach Share into a warmer family-facing weekly view  
- `89f0813` — Add shared delete helpers for coach kid row actions  
- `084b355` — Standardize coach kid row deletion with swipe actions  
- `4532ca7` — Refactor coach kid top stack into guidance-first hierarchy  
- `56f7b43` — Feat: add coach guidance hero and harden kid pilot editing flows  
- `ab85fcd` — Feat: add kid training linkage and progress reflections  
- `9fb7e3a` — Feat: add kid competition tracking and roster delete  
- `13f09f5` — Feat: add Coach Share kid tracking flow and weekly focus history  
- `ca25164` — Docs: finalize handoff after Coach Share pilot work  
- `c2daab1` — Docs: update handoff for Coach Share pilot progress  
- `469ea58` — Feat: add custom focus option to Coach Share templates  
- `745059e` — Feat: expand Coach Share pilot preview with custom focus and IG links  

## Locked product / workflow decisions
- Terminal-first execution remains a hard project rule
- Build 12 is the **last documented** coach-testing build in TestFlight until handoff is updated after a new upload (beta reality)
- Feedback triage is intentionally tabled short-term
- Weekly coach/parent flows (**This Week** tab in Dev; historically “Coach Share” family surfaces) are the primary lane for real-world feedback prep; **TestFlight** may still show an older tab layout until a new build ships
- **Per-kid tracking** under **This Week** remains the highest-ROI lane for Kyle internal testing (local pilot / Dev until we ship a new build)
- Kid roster / weekly focus / **coach kid competition** rows / kid-linked training session data remain **local-only (AsyncStorage + on-device media copies)** for the pilot. The **weekly sync experiment** (when committed and deployed) targets a **narrow weekly message document** only — **not** a full multi-device replication of competition or training.
- **AI Drafting Slice 1** is **mock/on-device** only until a real provider is integrated; **no auto-save** from drafting; coach **apply** is the save path

## Open loops
- **Family Huddle / weekly note (explicit):** Still **invite-scoped** with **last publish wins** for the invite—this is the **current shipped model**, not per-athlete switching on the parent side
- **Per-athlete weekly plans:** **Deferred to Option B** (not implemented; design + worker contract are the next strategic slice after Build 21 ships internally)
- **Parent-side competition video archive:** **Not implemented**; multi-video competition support in this build is **coach-side only**
- Final external-feedback TestFlight go/no-go checklist still needs a dedicated pass after internal Build 21 validation
- Parent weekly lane is much stronger but may still get another visual/personality pass
- Still need to decide whether coach should keep “Add a kid” in the external-testing model
- Need a final decision on whether the current IA is the exact external-feedback build IA or a testing-phase simplification
- Broader training sync remains out of scope
- "The bigger journey" card is still mostly auto/fallback driven
- Black Belt testing should focus on comprehension and flow quality, not assume all cross-device data types sync

## Best next-session recommendation
1. **Fix environment (non-negotiable)** — coach sync base URL present in the **RUNNING** app; rebuild the **correct** variant.
2. **Validate connect end-to-end** — Paste → Connect → Parent-athletes → Success strip → **This Week**.
3. **QA redesigned This Week tab** — no regression in weekly sync, training, or competition.

## Suggested restart commands for next session
- `git status -sb`
- `git log -8 --oneline`
- `sed -n '1,280p' "docs/dev-handoff.md"`
- `sed -n '1,220p' "docs/recaps/2026-03-31_dev-recap.md"`
- `sed -n '1,220p' "docs/recaps/2026-04-17_dev-recap.md"`

## Assumptions
- Kyle internal **Coach Share + kid pilot** usability remains the highest-ROI signal for this lane.
- Broader external feedback triage can stay tabled until this pilot lane is stable enough for internal use.
- **Gates** were last fully documented for an older snapshot (**`83588d7`**); latest `dev` includes **`9d805a6`** — **re-run both** gates on the current tree before trust; the **dirty** sync tree (if any) still needs a fresh run before trust.
- **Spouse / external tester device** build age is **unknown** — assume **no sync features** until a matching dev/client build is installed.

### 🔒 Coding Discipline Update — Operator Spec Mode

## 🧠 Operator Spec Mode (Preferred Coding Prompt Style)

Operator Spec Mode is the required prompt format for all coding-related instructions.

This style enforces:
- zero ambiguity
- zero scope drift
- surgical implementation only

Structure:

1. GOAL  
Clear statement of what needs to be done

2. FILE  
Exact file path(s) to be modified

3. PROBLEM  
Precise description of the issue

4. GOAL STATE  
What success looks like

5. IMPLEMENTATION  
Step-by-step numbered actions (no interpretation required)

6. RULES  
Explicit constraints:
- Do NOT expand scope  
- Do NOT refactor unrelated code  
- Do NOT modify architecture unless explicitly instructed  

7. VALIDATION  
Clear pass/fail criteria:
- No errors  
- No regressions  
- Behavior matches expectations  

Usage trigger:

When the user says:
"Operator Spec Mode"

All responses must follow this structure exactly.
