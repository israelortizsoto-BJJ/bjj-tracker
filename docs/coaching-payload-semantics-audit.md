# Coaching Payload Semantics Audit

Status: read-only semantic architecture audit  
Scope: coaching payload meaning, ownership, lifecycle, surface rights, and protected system boundaries  
Audience: product/engineering governance before future consolidation

This document maps meaning and ownership in the current repo. It does not propose code movement, renaming, deletion, cleanup, or refactoring. The recent technical stabilization work is assumed protected.

## Governing Premise

The app now has stable technical substrates for canonical athlete authority, coach/parent sync, overlay lineage, competition topology, training proof, projection freshness, hydration replay, and athlete isolation. The current risk is no longer basic data integrity; it is semantic ambiguity:

- the same coaching concept appears under different labels;
- authoring, review, delivery, analytics, and administration appear together in a few surfaces;
- AI/advisory copy can look too close to coach-authored truth;
- weekly intent and longitudinal coaching memory overlap.

Future consolidation must clarify responsibility without mutating the stabilized substrates.

## 1. Surface Inventory

### Coach Dashboard

- Files:
  - `app/(tabs)/coach/index.tsx`
  - `src/features/coach/CoachDashboardScreen.tsx`
  - `src/features/coach/useCoachInsights.ts`
  - `src/features/coach/computeCoachInsight.ts`
- Audience: coach.
- Purpose: team-level operations and triage.
- Authoring responsibilities:
  - No weekly payload authoring.
  - Copies a class-focus suggestion to clipboard via "Use this for class"; this is operational convenience, not canonical payload mutation.
- Review responsibilities:
  - Reviews athlete attention levels, execution, current focus, applied-in-sparring state, outcome, and parent feedback status.
  - Reviews team focus buckets and placement/bucket momentum.
- Publish responsibilities:
  - None.
- Operational responsibilities:
  - Groups athletes into "Needs Attention", "Monitor", and "On Track".
  - Surfaces team-level "Suggested class focus" and drill ideas.
  - Navigates into athlete detail.
- Semantic role:
  - Operations dashboard. It should answer "Where does the coach need to look today?"

### Coach Roster Surfaces

- Files:
  - `app/(tabs)/coach/kids.tsx`
  - `src/features/coach/CoachRoster.tsx`
  - shared roster screen from `app/(tabs)/this-week/kids.tsx`
- Audience: coach.
- Purpose: roster entry point and sync-linked athlete visibility.
- Authoring responsibilities:
  - Athlete/roster management through linked kid flows.
  - Not a weekly payload authoring surface.
- Review responsibilities:
  - Shows athlete rows with lightweight insight preview in `CoachRoster`.
- Publish responsibilities:
  - None.
- Operational responsibilities:
  - Refreshes coach writer sessions/reconciles roster via `refreshCoachWriterSessionsAndReconcileStores()`.
  - Filters archived/unlinked rows and active writer athletes.
- Semantic role:
  - Administrative/operational athlete selection. It should not become a coaching narrative owner.

### Coach Athlete Detail

- Files:
  - `app/(tabs)/coach/kid/[kidId].tsx`
  - `src/features/kid/KidDetailScreen.tsx`
- Audience: coach.
- Purpose: athlete-specific coaching workspace.
- Authoring responsibilities:
  - Edits parent-facing "Why this matters" / family recap field for the active weekly entry.
  - Can apply/edit suggested focus copy.
  - Saves coach-private "How it's going" check-ins.
  - Links to full weekly focus edit.
  - Links to What Matters Next.
- Review responsibilities:
  - Reviews current weekly focus, publish state, parent feedback, family huddle preview, coach-only progress/check-ins, and standing guidance.
  - Hidden visual blocks still retain training-session and competition data substrates for narrative/supporting workflows.
- Publish responsibilities:
  - Owns final "Publish to family phones" action for the shared weekly note.
  - Uses `kidWeeklyFocusToPublishPayload()` and `coachSyncPublishWeekly()`.
- Operational responsibilities:
  - Roster/household utility and soft archive/danger-zone action.
  - Link/writer resolution for publish.
- Semantic role:
  - Individual athlete review + publish readiness + private coach check-ins.
  - It should not become the full competition archive, full training log, or team operations surface.
- Protected note:
  - Hidden render blocks for "This week in action" and competition archive are not deleted. Their backing load/reconcile/projection/training/competition substrates remain protected.

### Weekly Focus Edit, Coach

- File: `app/(tabs)/coach/kid/[kidId]/weekly-focus.tsx`
- Audience: coach.
- Purpose: full weekly payload authoring.
- Authoring responsibilities:
  - Weekly focus row title/body/template/custom content.
  - `systemKey` / "SYSTEM CLASSIFICATION".
  - Mission link URL/label.
  - Family recap/supporting context.
  - Study-the-move resource URL/label.
  - Coach-only reference video.
- Review responsibilities:
  - Local preview of fields while editing.
- Publish responsibilities:
  - Does not perform final publish directly; publish is from Coach Athlete Detail.
- Operational responsibilities:
  - Keyboard-aware edit flow, validation for mission links, loading/saving weekly focus rows.
- Semantic role:
  - Authoring console for the weekly coaching payload.

### Weekly Focus Edit, This Week Lane

- File: `app/(tabs)/this-week/kid/[kidId]/weekly-focus.tsx`
- Audience: parent-device / this-week lane operator; current code exposes coach-like authoring affordances.
- Purpose: local weekly focus authoring/editing in the This Week lane.
- Authoring responsibilities:
  - Mission of the week, family note, mission link, study link, reference URL.
- Review responsibilities:
  - Local row preview/edit context.
- Publish responsibilities:
  - Not the main canonical coach publish action.
- Operational responsibilities:
  - Legacy/parallel weekly focus edit path.
- Semantic role:
  - Transitional/legacy authoring lane; high vocabulary overlap with coach weekly edit.

### Parent This Week

- File: `app/(tabs)/this-week/index.tsx`
- Audience: parent/family.
- Purpose: family delivery surface for current weekly coach direction.
- Authoring responsibilities:
  - Parent acknowledgement via `markWeeklyAcknowledged()`.
  - Legacy completion action when relevant.
  - No coach payload authoring.
- Review responsibilities:
  - Reads current coach weekly note, mission link, suggested focus line, last competition context, family huddle, coaching history, and link status.
- Publish responsibilities:
  - Publishes bounded parent feedback/acknowledgement through `schedulePublishParentWeeklyFeedback`.
- Operational responsibilities:
  - Refresh this week.
  - Manage coach link.
  - Select operating athlete.
- Semantic role:
  - Delivery and acknowledgement, not authoring.

### Family Huddle / Read Together

- Files:
  - `src/family/ReadTogetherStoryModal.tsx`
  - `src/family/readTogetherStoryCards.ts`
- Audience: parent/family/athlete.
- Purpose: guided family reflection over the published weekly note.
- Authoring responsibilities:
  - None.
- Review responsibilities:
  - Renders family-safe cards:
    - "What we sharpened with coach"
    - "Study the move"
    - "Why this matters"
- Publish responsibilities:
  - Can surface acknowledgement at final step if provided by parent This Week.
- Operational responsibilities:
  - Opens published mission/study URLs.
- Semantic role:
  - Family reflection and reinforcement.
- Important source rule:
  - The card builder explicitly does not use coach-only `youtubeUrl`, private check-ins, or standing guidance.

### Summary

- Files:
  - `app/(tabs)/summary/index.tsx`
  - `src/features/summary/SummaryScreen.tsx`
  - `src/components/summary/SummaryHeroCard.tsx`
  - `src/components/summary/SummaryV2Card.tsx`
  - `src/components/summary/SummaryWeekCard.tsx`
  - `src/components/summary/SummaryPatternsCard.tsx`
  - `src/components/summary/SummaryCompetitionCard.tsx`
  - `src/lib/summary/buildSummaryViewModel.ts`
  - `src/lib/summary/computeCoachAlignment.ts`
- Audience: parent or coach depending on device/role.
- Purpose: athlete identity, signals, alignment, and progression summary.
- Authoring responsibilities:
  - None for weekly payload.
  - May apply/dismiss identity suggestions in Summary Hero flows, but those are profile suggestions, not weekly coaching payload.
- Review responsibilities:
  - Reviews focus/action/progress/why, recognized skills, weekly activity, game patterns, competition snapshot, and coach alignment/progression.
- Publish responsibilities:
  - None.
- Operational responsibilities:
  - Hydrates coach weekly cache, training/competition slices, and summary signals.
- Semantic role:
  - Derived synthesis and analytics.
- Important source rule:
  - `buildSummaryViewModel()` declares a contract: when `coachWeekly` carries a mission, that mission owns alignment target, progression, progress/why labels, and focus headline; signals prove alignment but do not author the mission.

### Training

- File: `app/(tabs)/training.tsx`
- Audience: athlete/parent/coach operating the device.
- Purpose: session logging and training proof review.
- Authoring responsibilities:
  - Training sessions.
- Review responsibilities:
  - Calendar/day/week session review, search, "Your Game" training patterns, trend-aware training message.
- Publish responsibilities:
  - Training detail save path schedules training proof publication elsewhere.
- Operational responsibilities:
  - Training proof source for Summary and coach insights.
- Semantic role:
  - Proof substrate, not coaching payload composition.

### Competition / Compete

- Files:
  - `app/(tabs)/compete.tsx`
  - `src/features/competition/CompetitionCard.tsx`
  - `src/features/competition/MatchCard.tsx`
  - `src/features/competition/MedalCollection.tsx`
  - `src/features/competition/competitionMatchEditor.tsx`
- Audience: parent and coach.
- Purpose: competition proof, event timeline, match detail, coach match breakdown rendering.
- Authoring responsibilities:
  - Competition edit routes author canonical competition detail where permitted.
  - Coach competition edit route authors additive coach match breakdown overlays.
- Review responsibilities:
  - Podium record, competition cards, match cards, overlays.
- Publish responsibilities:
  - Competition save/delete paths publish topology/aggregate/overlay lanes according to actor/ownership.
- Operational responsibilities:
  - Compete screen loads canonical/topology-backed competition slice and overlay annotations.
- Semantic role:
  - Competition proof and match narrative. Not weekly family guidance.

### What Matters Next

- File: `app/(tabs)/coach/kid/[kidId]/what-matters-next.tsx`
- Payload helpers:
  - `src/ai-coach/loadWhatMattersNextDraftPayload.ts`
  - `src/ai-coach/whatMattersNextDraftGenerator.ts`
  - `src/ai-coach/whatMattersNextDraftTypes.ts`
  - `src/storage/kidStandingGuidanceStore.ts`
- Audience: coach.
- Purpose: standing/longitudinal coach guidance for an athlete.
- Authoring responsibilities:
  - Coach authors/saves a standing "Coach Note" and optional detail.
  - AI can draft suggested headline/detail, but the coach must apply and save.
- Review responsibilities:
  - Presents current standing guidance fields.
  - Draft review sheet explains suggestions are based on current profile data.
- Publish responsibilities:
  - None. The screen explicitly says it does not message parents.
- Operational responsibilities:
  - Loads one-kid draft payload from local weekly focus, recent check-ins, competitions, training skill focus, bucket outcome trends, and coach training focus decision.
- Semantic role:
  - Longitudinal coach memory with AI-assisted phrasing.

### Progress Reflection / Check-In Edit

- File: `app/(tabs)/coach/kid/[kidId]/progress-reflection.tsx`
- Audience: coach.
- Purpose: edit coach-private progress fields on a saved weekly focus row.
- Authoring responsibilities:
  - `coachOutcome`
  - `coachNotes`
- Review responsibilities:
  - Shows weekly focus context and outcome/notes.
- Publish responsibilities:
  - Does not publish the full private note.
- Operational responsibilities:
  - Patches coach fields on the weekly focus entry.
- Semantic role:
  - Weekly/rolling coach-private observation editor.

### Weekly History

- File: `app/(tabs)/coach/kid/[kidId]/history.tsx`
- Audience: coach.
- Purpose: longitudinal review of weekly focus/check-in rows grouped by week.
- Authoring responsibilities:
  - Opens weekly focus or progress reflection editor depending on whether a row has coach reflection fields.
- Review responsibilities:
  - Week-grouped history of weekly focus logs, outcomes, notes, and reference links.
- Publish responsibilities:
  - None.
- Semantic role:
  - Longitudinal weekly log review, not current delivery.

### AI Helper / Suggestion Lanes

- Files:
  - `src/features/coach/components/WeeklySuggestionCard.tsx`
  - `src/features/coach/deriveWeeklyNarrative.ts`
  - `src/ai-coach/*`
  - `src/lib/identity/deriveIdentitySuggestions.ts`
  - `src/components/summary/SummaryHeroCard.tsx`
- Audience: primarily coach, with Summary identity suggestions visible in summary context.
- Purpose: drafting, suggestion, interpretation, and derived guidance support.
- Authoring responsibilities:
  - None as a canonical owner. Suggestions require user action.
- Review responsibilities:
  - Shows suggested copy and provenance/context.
- Publish responsibilities:
  - None directly.
- Operational responsibilities:
  - May prefill authoring fields or guide wording.
- Semantic role:
  - Advisory assistant only.

## 2. Canonical Concept Inventory

### Weekly Focus

- Meaning: the coach-selected emphasis for a specific week and athlete.
- Ownership: coach-owned local weekly row; parent sees only the published family-safe payload.
- Lifecycle: weekly, editable, history-preserving.
- Visibility: coach edit/detail/history; parent delivery after publish; Summary synthesis.
- Surface rights:
  - Author/edit: Weekly Focus Edit routes.
  - Render: Coach Athlete Detail, Parent This Week, Summary, history.
  - Publish: Coach Athlete Detail.
  - Derive from: Summary alignment, What Matters Next AI draft payload, Coach Dashboard insights.
- Classification: canonical weekly coaching intent.

### Mission of the Week

- Meaning: family-facing framing of the weekly focus.
- Ownership: coach-owned, published to parent.
- Lifecycle: weekly, current-message oriented.
- Visibility: coach authoring and parent delivery.
- Surface rights:
  - Author/edit: weekly focus edit.
  - Render: Parent This Week and Family Huddle contexts.
  - Publish: Coach Athlete Detail.
  - Derive from: Summary can use it as focus headline.
- Classification: parent-facing weekly message label, not a separate data entity from Weekly Focus.

### Family Note / Body

- Meaning: parent-safe explanatory body for the weekly focus.
- Ownership: coach-owned.
- Lifecycle: weekly, editable before publish, persisted as weekly row and published snapshot.
- Visibility: parent/family after publish; coach preview/edit.
- Surface rights:
  - Author/edit: weekly focus edit.
  - Render: Parent This Week, Family Huddle, Coach Athlete Detail preview.
  - Publish: Coach Athlete Detail.
- Classification: canonical parent-facing weekly copy.

### Supporting Context / What We Sharpened With Coach

- Meaning: optional parent-safe recap of what the coach worked on with the athlete.
- Ownership: coach-owned.
- Lifecycle: weekly, editable.
- Visibility: parent/family after publish; coach preview/edit.
- Surface rights:
  - Author/edit: weekly focus edit or Coach Athlete Detail "Why this matters" field in current implementation.
  - Render: Read Together / Family Huddle card; Coach Athlete Detail publish lane.
  - Publish: Coach Athlete Detail through weekly payload.
- Classification: parent-facing weekly recap.
- Important boundary: not private check-in notes.

### Why This Matters

- Meaning: reinforcement narrative explaining why the weekly direction matters.
- Ownership: mixed in current repo:
  - coach-authored when stored as weekly recap/body;
  - system-generated/advisory when built by family huddle or Summary VM.
- Lifecycle: weekly when attached to a weekly note; derived/rolling when Summary explains progress.
- Visibility: parent/family and Summary.
- Surface rights:
  - Author/edit: Coach detail/weekly edit only when it maps to a payload field.
  - Render: Parent This Week, Read Together, Summary.
  - Derive from: Summary/Read Together may derive explanatory copy.
- Classification: narrative reinforcement, not always canonical.

### Mission Link

- Meaning: optional link attached to the primary mission/focus.
- Ownership: coach-owned.
- Lifecycle: weekly, optional.
- Visibility: parent/family after publish.
- Surface rights:
  - Author/edit: weekly focus edit.
  - Render: Parent This Week mission link; Read Together modal if card carries it.
  - Publish: Coach Athlete Detail.
- Classification: parent-facing weekly resource.

### Study Link / Study the Move

- Meaning: optional supplemental family resource, separate from the primary mission link.
- Ownership: coach-owned.
- Lifecycle: weekly, optional.
- Visibility: parent/family after publish.
- Surface rights:
  - Author/edit: weekly focus edit.
  - Render: Family Huddle / Read Together.
  - Publish: Coach Athlete Detail.
- Classification: parent-facing supplemental resource.

### What Matters Next

- Meaning: steady standing guidance for an athlete that stays until the coach changes it.
- Ownership: coach-owned.
- Lifecycle: longitudinal, editable, rolling memory.
- Visibility: coach only in current UI.
- Surface rights:
  - Author/edit: What Matters Next screen.
  - Render: Coach Athlete Detail.
  - Publish: no parent publish rights.
  - Derive from: AI may draft suggestions using kid-local data.
- Classification: longitudinal coach-private guidance.

### How It’s Going

- Meaning: coach’s current operational reading of whether the weekly focus is transferring.
- Ownership: coach-owned.
- Lifecycle: weekly/rolling; multiple check-ins form longitudinal history.
- Visibility: coach; parent may see bounded outcome signal only if published.
- Surface rights:
  - Author/edit: Coach Athlete Detail and Progress Reflection.
  - Render: Coach Athlete Detail, Coach Dashboard, Weekly History.
  - Publish: only mapped parent-safe `coachOutcome`, not private notes.
- Classification: coach-private operational review plus bounded parent-safe signal.

### Check-Ins / Coach Notes

- Meaning: coach-private observations attached to weekly focus entries.
- Ownership: coach.
- Lifecycle: historical/longitudinal log, editable/deletable.
- Visibility: coach only.
- Surface rights:
  - Author/edit: Coach Athlete Detail and Progress Reflection.
  - Render: Coach Athlete Detail and History.
  - Derive from: What Matters Next AI draft payload.
  - Publish: raw notes must not publish to parent.
- Classification: coach-private longitudinal evidence.

### Applied in Sparring

- Meaning: coach assessment of whether the focus appears in sparring.
- Ownership: coach.
- Lifecycle: weekly/rolling check-in field.
- Visibility: coach; indirectly influences parent-safe progress signal if mapped.
- Surface rights:
  - Author/edit: Coach Athlete Detail.
  - Render: Coach Athlete Detail and Coach Dashboard.
  - Derive from: `deriveWeeklyNarrative()` and coach insight.
- Classification: coach-private operational signal.

### Outcome / Coach Outcome

- Meaning: normalized progress state for a weekly focus (`not_yet`, `developing`, `on_track`) or mapped parent-safe sync outcome.
- Ownership: coach for source; parent can view only mapped published version.
- Lifecycle: weekly/historical.
- Visibility: coach; parent sees bounded state if published.
- Surface rights:
  - Author/edit: Progress Reflection and Coach Athlete Detail.
  - Render: Coach Dashboard, Coach Detail, History.
  - Publish: `kidWeeklyFocusToPublishPayload()` may include parent-safe `coachOutcome`.
- Classification: coach-authored progress signal.

### Suggested Focus

- Meaning: recommendation from recent competitions/training evidence.
- Ownership: system-derived/advisory until coach accepts/edits.
- Lifecycle: rolling/advisory.
- Visibility: coach; parent may see a published recommended focus line if included in synced doc.
- Surface rights:
  - Author/edit: no direct ownership; coach may apply/edit into weekly focus copy.
  - Render: Coach Athlete Detail, Parent This Week, Coach Dashboard team focus.
  - Publish: only after coach-owned payload includes it.
- Classification: advisory, competition/training-derived.

### Trend

- Meaning: derived interpretation of training/competition trajectory.
- Ownership: system-derived.
- Lifecycle: rolling analytics.
- Visibility: Summary, Parent This Week, Coach Dashboard, Training.
- Surface rights:
  - Author/edit: none.
  - Render/summarize: Summary/Coach Dashboard/This Week/Training.
  - Publish: no direct publish rights.
- Classification: derived analytics.

### Alignment

- Meaning: whether logged training proof matches the resolved coach focus.
- Ownership: system-derived.
- Lifecycle: rolling.
- Visibility: Summary.
- Surface rights:
  - Author/edit: none.
  - Render/summarize: Summary.
  - Derive from: coach weekly mission plus training signals via `computeCoachAlignment()`.
- Classification: derived proof interpretation.

### Acknowledgement

- Meaning: parent/family confirms they saw/accepted the weekly note.
- Ownership: parent-authored feedback signal.
- Lifecycle: weekly.
- Visibility: parent and coach.
- Surface rights:
  - Author/edit: Parent This Week.
  - Render: Parent This Week, Coach Athlete Detail, Coach Dashboard.
  - Publish: parent feedback publisher.
- Classification: parent-owned bounded feedback.

### Training Proof

- Meaning: logged sessions and associated training evidence.
- Ownership: device/user authored; synchronized proof lane where linked.
- Lifecycle: longitudinal immutable-ish activity log with edits via training surfaces.
- Visibility: Training, Summary, Coach Dashboard, AI draft payload.
- Surface rights:
  - Author/edit: Training.
  - Render/summarize: Training, Summary, Coach Dashboard.
  - Publish: training proof lane, not weekly message payload.
- Classification: canonical proof substrate.

### Competition Proof

- Meaning: canonical/topology-backed competition events and match results.
- Ownership: parent canonical where linked; coach consumes topology and owns additive overlays.
- Lifecycle: longitudinal competition history.
- Visibility: Compete, Summary, Coach Dashboard, AI draft payload.
- Surface rights:
  - Author/edit: competition edit routes by authority.
  - Render/summarize: Compete/Summary/Coach Dashboard/Parent This Week lightweight context.
  - Publish: topology/aggregate/overlay lanes according to ownership.
- Classification: canonical proof plus bounded projections.

### Coach Match Breakdown

- Meaning: coach-owned analysis overlay attached to exact competition match lineage.
- Ownership: coach overlay.
- Lifecycle: longitudinal/additive overlay; must be retired when source competition lineage is retired.
- Visibility: Compete match cards; parent consumes read-only when synced.
- Surface rights:
  - Author/edit: coach competition edit.
  - Render: Compete / MatchCard.
  - Publish: coach overlay artifact lane.
  - Derive from: no fuzzy derivation; exact lineage only.
- Classification: additive coach-owned overlay.

### AI Draft / AI Helper

- Meaning: assistant-generated or deterministic draft suggestion based on existing athlete data.
- Ownership: AI-assisted/advisory; coach owns only applied/saved output.
- Lifecycle: ephemeral until applied/saved.
- Visibility: coach.
- Surface rights:
  - Author: no canonical authority.
  - Render: What Matters Next draft review, WeeklySuggestionCard, identity suggestions.
  - Publish: none.
  - Derive from: local kid-scoped data only per helper contract.
- Classification: advisory support.

## 3. Duplication + Vocabulary Drift

### Weekly intent terminology

Same underlying semantic lane appears as:

- "Weekly focus"
- "Mission of the week"
- "Primary weekly message"
- "This week’s direction"
- "Coach direction"
- "Focus"

Repo-grounded interpretation:

- `KidWeeklyFocusEntry` is the local data shape.
- `SyncedWeeklyMessagePayload.headline/body` is the parent-facing published shape.
- Summary uses "Focus" / "Coach direction" as a synthesized view of the same or related mission.

Canonical internal term appears to be "weekly focus" at the storage/type level. "Mission" and "direction" are UI framing terms.

### Parent-safe recap terminology

Same or adjacent field appears as:

- "Family note"
- "Supporting context"
- "What we sharpened with Coach"
- "Shared family note"
- `familyCoachRecapNote`

Canonical internal term is `familyCoachRecapNote`; the clearest parent-facing phrase is "What we sharpened with coach." "Shared family note" is broader and can blur the whole payload with the recap field.

### Link terminology

Two distinct link fields exist:

- `missionResourceUrl` / `missionResourceLabel`
- `familyResourceUrl` / `familyResourceLabel`

Vocabulary drift:

- "Mission link"
- "Mission (Optional)"
- "Open this week’s link"
- "Study the move"
- "Optional supplemental resource"
- "Family resource"

The conceptual separation is valid, but the UI can make link ownership unclear. "Mission (Optional)" is especially ambiguous because the mission is not optional; the link is.

### Progress terminology

Coach progress appears as:

- "How it’s going"
- "Applied in sparring"
- "Outcome"
- "Progress notes"
- "Check-ins"
- "Learning / Developing / Applying"
- `coachOutcome`
- `sparringApplication`

The repo has both legacy `coachOutcome` and newer `sparringApplication` concepts. Current code maps sparring application to coach outcome in `KidDetailScreen`. This should be treated as a semantic bridge, not a signal to delete either field casually.

### AI / suggestion terminology

AI/advisory surfaces appear as:

- "Let AI help you write this"
- "Help me phrase this"
- "Suggested from training"
- "Suggested focus from recent competitions"
- Summary identity suggestions

All imply assistance, but some suggestions are deterministic/system-derived and others are phrasing drafts. The UI should continue to distinguish advice from authorship.

### Analytics / proof terminology

Competition and training proof appears as:

- "Competition / Proof"
- "Competition Snapshot"
- "Podium record"
- "Training / Execution"
- "Practice Summary"
- "Your Game"
- "Game Patterns"

These should remain proof/analytics terms, not weekly messaging terms.

## 4. Authoring Model

Current implied model:

1. Coach authors weekly intent.
   - Source: `KidWeeklyFocusEntry`.
   - Full authoring: weekly focus edit.
   - Final delivery: Coach Athlete Detail publish action.

2. Coach authors private operational notes.
   - Source: `coachNotes`, `sparringApplication`, `coachOutcome`.
   - Surfaces: Coach Athlete Detail and Progress Reflection.
   - Parent receives only bounded/explicitly mapped progress signal, not private notes.

3. Parent consumes weekly direction.
   - Source: `SyncedWeeklyMessagePayload`.
   - Surface: Parent This Week and Family Huddle.
   - Parent can acknowledge/view; parent does not author coach payload.

4. Training creates proof.
   - Source: sessions/training proof.
   - Surfaces: Training, Summary, Coach Dashboard.
   - Training does not author weekly intent.

5. Competition creates proof and bounded overlays.
   - Source: canonical competition detail/topology and coach overlay lane.
   - Surfaces: Compete, Summary, Coach Dashboard, suggestions.
   - Competition does not author weekly intent; it can inform suggested focus.

6. Summary derives synthesis.
   - Source: signals + coach weekly mission + training/competition proof.
   - Summary is read/interpretation, not authoring.

7. AI assists but does not own.
   - AI can draft, summarize, tighten, and suggest.
   - Coach must apply/save; AI output is not canonical until a human-owned flow persists it.

### Author Once / Render Many

Best-supported current pattern:

- Coach authors weekly row once.
- Coach publishes family-safe snapshot once.
- Parent This Week and Family Huddle render the published snapshot.
- Summary derives its focus/progress/why from the published mission and proof.
- Coach Dashboard uses the same sources for operational triage.

### Overlay Governance

- Coach Match Breakdown is not part of canonical competition topology.
- It is coach-owned additive analysis.
- Parent consumes it read-only.
- It must stay exact-lineage bounded.

## 5. Longitudinal vs Weekly Model

### Weekly concepts

These are week-scoped:

- Weekly focus.
- Mission of the week.
- Family note/body.
- Mission link.
- Study link.
- Family coach recap.
- Parent acknowledgement.
- Applied in sparring for the active week.
- Coach outcome for a weekly focus row.
- Weekly focus completion / legacy assignment completion.

Product implication:

- Weekly surfaces should emphasize current direction, family reinforcement, and this week’s status.
- Weekly concepts can be historicized, but their primary job is immediate direction.

### Longitudinal concepts

These accumulate over time:

- What Matters Next standing guidance.
- Coach check-in history.
- Weekly history.
- Training proof.
- Competition proof.
- Coach Match Breakdown overlays.
- Recognized skills.
- Summary identity/progression.
- Team focus trends.

Product implication:

- Longitudinal surfaces should emphasize pattern recognition, memory, and trajectory.
- They should not be overwritten by one weekly message.

### Rolling operational concepts

These are neither purely weekly nor immutable:

- Coach Dashboard attention levels.
- Suggested focus.
- Team focus snapshot.
- Trend.
- Alignment.
- Summary hero progression.

Product implication:

- Rolling concepts should be clearly labeled as derived/current interpretation.
- They should not look like coach-authored canonical statements unless accepted/published by the coach.

### Concept-by-concept classification

| Concept | Weekly | Longitudinal | Rolling/Derived | Notes |
|---|---:|---:|---:|---|
| Weekly focus | Yes | History after week | No | Coach-owned weekly intent |
| Mission of the week | Yes | Published history indirectly | No | Parent-facing framing |
| Family coach recap | Yes | History after week | No | Parent-safe recap |
| Why this matters | Often | Sometimes | Often | Mixed authored/derived narrative |
| What matters next | No | Yes | No | Standing coach guidance |
| Check-ins | Yes source row | Yes as log | No | Private coach memory |
| Applied in sparring | Yes | Yes via history | Operational | Coach assessment |
| Suggested focus | No | No | Yes | Advisory until accepted |
| Alignment | No | No | Yes | Proof interpretation |
| Training proof | No | Yes | Feeds rolling | Canonical proof |
| Competition proof | No | Yes | Feeds rolling | Canonical/topology proof |
| Coach Match Breakdown | No | Yes | No | Additive overlay |

## 6. AI Responsibility Boundary

### Where AI/system assistance currently participates

- `WhatMattersNextScreen`
  - "Let AI help you write this"
  - "Help me phrase this"
  - Draft review sheet.
  - Payload built from the kid’s standing draft, current weekly focus, recent check-ins, recent competitions, last competition weekly context, training skill focus, bucket trends, and coach focus decision.
  - Explicit UI copy: draft only, nothing saves until coach saves, nothing messages parents.

- `WeeklySuggestionCard`
  - "Suggested from training"
  - Based on recent training and sparring.
  - Coach can "Use this" or "Edit".

- `deriveWeeklyNarrative()`
  - Generates advisory language from sparring application, sessions this week, and recent competition count.

- Summary identity suggestions
  - `SummaryHeroCard` renders suggestions from identity/profile derivation.

- Summary VM
  - `buildSummaryViewModel()` derives focus/action/progress/why and alignment/progression copy from signals and coach weekly mission.

### AI may assist

- Phrasing coach-owned standing guidance.
- Drafting based on kid-scoped existing data.
- Suggesting weekly copy from training/sparring/competition evidence.
- Translating proof into parent-safe reinforcement.
- Summarizing patterns or highlighting potential focus areas.

### AI may derive

- Trend interpretation.
- Alignment/progression summary.
- Suggested focus candidates.
- Draft phrasing from explicitly scoped source data.
- Identity/profile suggestions with provenance.

### AI must never own

- Canonical athlete identity.
- Canonical weekly mission.
- Parent-facing publish decision.
- Coach private notes.
- Competition topology.
- Coach match breakdown overlay lineage.
- Training proof.
- Parent acknowledgement.
- Retirement/deletion semantics.
- Authority boundaries between coach and parent.

### Required semantic boundary

AI output is advisory until a human-owned surface persists it. The owner after persistence is the human/source surface, not AI.

## 7. Proposed Responsibility Model

This is conceptual only.

### Authoritative coaching payload hierarchy

1. Weekly Coaching Intent
   - Canonical source: `KidWeeklyFocusEntry`.
   - Owner: coach.
   - Authoring surface: Weekly Focus Edit.
   - Delivery surface: Parent This Week.
   - Publish surface: Coach Athlete Detail.

2. Parent-Facing Weekly Snapshot
   - Canonical source after publish: `SyncedWeeklyMessagePayload`.
   - Owner: coach as writer; parent as consumer.
   - Feedback owner: parent for view/acknowledgement.

3. Coach-Private Operational Memory
   - Source: `coachNotes`, `sparringApplication`, `coachOutcome`, standing guidance.
   - Owner: coach.
   - Surfaces: Coach Athlete Detail, Progress Reflection, History, What Matters Next.

4. Proof Substrates
   - Training proof: sessions/training lane.
   - Competition proof: canonical detail/topology.
   - Overlay proof: coach-owned match breakdown overlays.
   - Owners: according to existing authority boundaries.

5. Derived Synthesis
   - Source: signals, proof, coach weekly mission.
   - Owner: system-derived; no independent authoring rights.
   - Surfaces: Summary, Coach Dashboard, suggestions.

6. AI Assistance
   - Source: scoped existing data.
   - Owner: advisory only.
   - Becomes canonical only after accepted into a human-owned field.

### Coach workflow hierarchy

1. Coach Dashboard: choose where attention goes.
2. Coach Athlete Detail: review athlete, check in, prepare/publish.
3. Weekly Focus Edit: author the weekly payload.
4. What Matters Next: maintain standing longitudinal guidance.
5. Compete/Training: inspect proof when needed.

### Parent consumption hierarchy

1. Parent This Week: current direction and acknowledgement.
2. Family Huddle: read/reflection flow.
3. Summary: broader athlete progression.
4. Training/Compete: proof and history.

### Surface rights summary

| Surface | Author | Edit | Render | Publish | Derive |
|---|---|---|---|---|---|
| Coach Dashboard | No payload | No payload | Yes | No | Yes |
| Coach Athlete Detail | Bounded fields/check-ins | Yes | Yes | Weekly note | Yes |
| Weekly Focus Edit | Weekly payload | Weekly payload | Local preview | No | No |
| Parent This Week | Acknowledgement only | Acknowledgement/link management | Yes | Parent feedback | Limited |
| Family Huddle | No | No | Yes | Acknowledgement via parent wrapper | No |
| Summary | No payload | Profile suggestions only | Yes | No | Yes |
| Training | Training sessions | Training sessions | Yes | Training proof | Yes |
| Compete | Competition/overlay by authority | Competition/overlay by authority | Yes | Topology/overlay lanes by authority | Yes |
| What Matters Next | Standing guidance | Standing guidance | Yes | No | AI draft assist |

## 8. Protected Systems

Semantic consolidation must not casually mutate these systems:

- canonical authority
- athlete ownership and isolation
- coach/parent ownership boundaries
- coach weekly sync publish/hydrate
- parent feedback publishing
- hydration replay governance
- reconcile behavior
- overlay lineage
- coach match breakdown artifact publication/reconciliation
- competition topology
- canonical competition detail ownership
- aggregate/projection freshness arbitration
- training proof
- Summary projection freshness
- active athlete selection
- `load()` orchestration in lifecycle-heavy screens
- navigation return flows after save/delete
- cache arbitration and local/remote fallback behavior

### Why these are protected

The product-language problem is semantic, not a data-substrate failure. Recent stabilization proved that small-looking UI/render changes can sit on top of sensitive lifecycle paths. In particular:

- Hidden render blocks in `KidDetailScreen.tsx` still depend on active `load()`, training, competition, and narrative substrates.
- Summary is a composition surface over athlete authority, weekly sync, training proof, competition proof, and signal derivation.
- Compete is the competition proof surface and consumes topology/overlay lanes.
- Parent This Week owns acknowledgement and delivery semantics; it must not become a coach authoring surface by accident.
- AI helper lanes must remain advisory and scoped.

### Hidden != Deleted

The following have recently been visually hidden, not architecturally removed:

- coach competition render blocks
- "This week in action" render block
- old top roster/household render placement

The underlying state, cache reads, hydrate/reconcile, competition merge, training proof, narrative derivation, overlay lineage, and refresh orchestration remain active and protected. No future semantic cleanup should assume hidden UI equals dead lifecycle.

## Final Governance Finding

The current operating model is viable if the app treats "weekly coaching intent" as the core authored payload and separates it from:

- private coach memory,
- family delivery,
- proof substrates,
- derived analytics,
- and AI assistance.

The most important consolidation target is language, not architecture. The cleanest conceptual hierarchy is:

1. Coach-authored weekly intent.
2. Coach-authored private memory.
3. Parent-consumed weekly delivery.
4. Parent-authored acknowledgement.
5. Training and competition proof.
6. System-derived synthesis.
7. AI-assisted drafts.

Any future UI simplification should begin by choosing which semantic role a surface owns, then only changing labels/render hierarchy inside that role. It should not move ownership, widen publish rights, or delete lifecycle substrates as part of vocabulary cleanup.
