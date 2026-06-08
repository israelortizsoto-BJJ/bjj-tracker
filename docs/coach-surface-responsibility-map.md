# Coach Surface Responsibility Map

Status: read-only product systems audit  
Scope: coaching language, surface ownership, conceptual duplication, and future consolidation boundaries  
Repo state observed: current working tree after recent stabilization and visual surface passes

This document is evidence-based from the current repo. It does not propose code changes, file movement, deletion, or refactoring. It exists to clarify product language and surface responsibility before any future implementation.

## 1. Surface Inventory

### Coach Dashboard

- Route: `/coach`
- Route file: `app/(tabs)/coach/index.tsx`
- Owning surface file: `src/features/coach/CoachDashboardScreen.tsx`
- Data / VM source: `useCoachInsights()` in `src/features/coach/useCoachInsights.ts`
- Primary user: coach
- Responsibility type: analytics, review, prioritization, operations
- Purpose: team-level coaching command surface. It answers: "Who needs attention, what is the team pattern, and what should I do with the class?"
- Major sections rendered:
  - `OperatingHeader` with "Team / Operations", "Coach Dashboard", "Team operations", roster/settings actions.
  - `Coach Snapshot`: active athlete count, needs attention, on track, monitor.
  - `Team Focus Snapshot`: aggregate training/competition skill buckets, placement trends, momentum, suggested class focus, drill ideas, "Use this for class".
  - Attention groups: "Needs Attention", "Monitor", "On Track".
  - Athlete rows with focus, execution, applied in sparring, outcome, parent feedback view/acknowledgement, attention badge.
  - Drill bucket modal for athletes in a team focus bucket.
- Major concepts rendered:
  - Attention level.
  - Execution score.
  - Applied in sparring.
  - Outcome.
  - Parent feedback state.
  - Current focus.
  - Team focus / bucket momentum.
  - Suggested class focus.
- Coupling notes:
  - Uses `useCoachInsights()` and derived team focus rows. It is not just presentational.
  - It navigates to `/coach/kid/${athlete.id}` for athlete review.
  - It copies class focus to the clipboard, but does not author weekly payloads.

### Coach Athlete Detail

- Route: `/coach/kid/[kidId]`
- Route file: `app/(tabs)/coach/kid/[kidId].tsx`
- Owning surface file: `src/features/kid/KidDetailScreen.tsx`
- Primary user: coach
- Responsibility type: authoring, review, delivery, administration
- Purpose: individual athlete coaching workspace. It currently combines family weekly publishing, coach-only check-ins, hidden training/competition detail substrates, and roster utility.
- Major sections rendered in current tree:
  - Header: athlete name, role-aware explanatory copy.
  - Family / Publish lane:
    - "FAMILY / PUBLISH"
    - "Shared family note"
    - parent feedback status label (`✓ Acknowledged`, `✓ Viewed`, or `• Not viewed yet`)
    - family huddle source rows
    - `WeeklySuggestionCard`
    - "Why this matters"
    - "Weekly focus"
    - "Suggested focus from recent competitions"
    - "Use suggested focus"
    - "Edit focus"
    - "Edit weekly focus & family link" / "Set this week's focus"
    - "Publish to family phones"
    - "Preview Family Huddle"
    - "History"
  - Coach-only lane:
    - "COACH ONLY"
    - "How it's going"
    - AI helper/support line
    - "Applied in sparring"
    - sparring options: not yet / sometimes / yes
    - coach check-in note input
    - saved check-in list for "This week"
  - Roster / Household utility near bottom, collapsed by default.
  - Danger zone: remove athlete from active coach roster.
- Hidden render surfaces currently retained in the file:
  - "This week in action" render block is hidden, but its data substrate and callbacks remain.
  - Coach detail competition archive/cards render block is hidden, but competitions state, load, reconcile, merge, delete/edit handlers, and refresh substrate remain.
  - An earlier top "Roster · Household" block is hidden, while bottom utility remains visible.
- Major concepts rendered:
  - Family note.
  - Family huddle.
  - Why this matters.
  - Weekly focus.
  - Suggested focus.
  - Publish state.
  - Parent read/acknowledgement status.
  - Coach-only check-ins.
  - Applied in sparring.
  - Private notes.
  - Roster / household utility.
- Coupling notes:
  - This file is lifecycle-heavy. It loads weekly focus entries, coach linked sessions, published feedback, competitions, shared competition detail, recommended focus, and roster metadata.
  - Future visual simplification must preserve `load()` orchestration, weekly publish flow, parent feedback cache, training-session substrate, competition reconciliation, and private check-in state.
  - Hidden means not rendered. It does not mean lifecycle-safe to delete.

### Weekly Focus Edit, Coach Lane

- Route: `/coach/kid/[kidId]/weekly-focus`
- Owning file: `app/(tabs)/coach/kid/[kidId]/weekly-focus.tsx`
- Primary user: coach
- Responsibility type: authoring
- Purpose: create or edit weekly focus rows that can later be published from Coach Athlete Detail.
- Major sections rendered:
  - Header: "Set Weekly Focus" / "Edit Weekly Focus".
  - System classification: "SYSTEM CLASSIFICATION", "BJJ system".
  - Tabs: "Templates", "Custom Focus".
  - "MISSION OF THE WEEK" / "Primary weekly message".
  - Template list or custom title/note.
  - "Mission link (optional)" with URL and label.
  - "WHAT WE SHARPENED WITH COACH" / "Supporting context".
  - "STUDY THE MOVE" / "Optional supplemental resource".
  - "REFERENCE VIDEO · COACH ONLY" / "Not shared with family".
  - Save/update action.
- Major concepts rendered:
  - Mission of the week.
  - Weekly focus.
  - System classification.
  - Supporting context.
  - Family note.
  - Mission link.
  - Study the move.
  - Coach-only reference video.
- Source and publish mapping:
  - Local row type: `KidWeeklyFocusEntry` in `src/types/coachKid.ts`.
  - Publish mapper: `kidWeeklyFocusToPublishPayload()` in `src/coach/weeklyFocusPublish.ts`.
  - Published payload intentionally excludes private `coachNotes` and coach-only `youtubeUrl`.
- Coupling notes:
  - This is the correct surface for payload authoring.
  - It does not publish directly; the detail screen owns publish action.

### Weekly Focus Edit, Parent / This Week Lane

- Route: `/this-week/kid/[kidId]/weekly-focus`
- Owning file: `app/(tabs)/this-week/kid/[kidId]/weekly-focus.tsx`
- Primary user: parent-device operator in This Week lane, with coach-like local authoring affordances in the current repo.
- Responsibility type: local authoring / preview / legacy lane
- Purpose: create/edit focus rows in the This Week lane.
- Major sections rendered:
  - "Mission of the week".
  - Template/custom focus.
  - Coach-only reference URL placeholder.
  - "What we sharpened with Coach".
  - "Mission (Optional)".
  - "Study the move".
- Major concepts rendered:
  - Mission of the week.
  - Family note.
  - Mission link.
  - Study the move.
  - Coach recap/supporting context.
- Duplication note:
  - This route overlaps heavily with the coach weekly focus edit route, but wording and hierarchy differ.
  - It uses parent-facing language while still exposing coach/publish concepts.

### Parent This Week

- Route: `/this-week`
- Owning file: `app/(tabs)/this-week/index.tsx`
- Primary user: parent/family
- Responsibility type: delivery, acknowledgement, family reflection, connection management
- Purpose: receive coach-published weekly direction, read it with the athlete, acknowledge it, and manage coach linkage.
- Major sections rendered:
  - `OperatingHeader`: "Coach Direction", "This week’s direction", athlete identity, refresh/link/settings actions.
  - Athlete selector: "Choose who this week is for."
  - Primary weekly direction card:
    - published headline/body
    - suggested focus from recent competitions
    - based-on-last-competition line
    - recent placement trend
    - stale/offline/saved-note messaging
    - "You got it" / "✓ Acknowledged"
  - Mission link card:
    - "MISSION LINK"
    - "Open this week’s link"
  - Family Huddle:
    - "FAMILY HUDDLE · REFLECT TOGETHER"
    - "Walk through this week with your athlete"
  - Looking Back:
    - `CoachingHistoryLogCard`
  - Last competition weekly card.
  - Connection/actions:
    - "Connect with your coach"
    - "Mark weekly focus complete" for legacy assignment
    - "Coach connection"
    - "Manage coach link"
  - Coach tools / preview panels when role and dev/preview state allow.
- Major concepts rendered:
  - This week’s direction.
  - Mission link.
  - Acknowledgement.
  - Family huddle.
  - Coach connection.
  - Looking back.
  - Last competition.
  - Weekly focus preview.
  - Legacy completion.
- Coupling notes:
  - Consumes `SyncedWeeklyMessagePayload` fields: `headline`, `body`, `missionResourceUrl`, `familyResourceUrl`, `familyCoachRecapNote`, `coachOutcome`, and `parentFeedback`.
  - Parent feedback is published back via `schedulePublishParentWeeklyFeedback`.
  - This surface should remain delivery/acknowledgement first, not authoring first.

### Read Together / Family Huddle Modal

- Owner component: `src/family/ReadTogetherStoryModal.tsx`
- Card builder: `src/family/readTogetherStoryCards.ts`
- Primary user: parent/family
- Responsibility type: delivery, family reflection
- Purpose: present published family-safe weekly context as a guided family reading flow.
- Major cards:
  - "What we sharpened with coach"
  - "Study the move"
  - "Why this matters"
- Notable source rules:
  - `buildReadTogetherStoryCards()` explicitly does not use coach-only `youtubeUrl`, private check-ins, or standing guidance.
  - `READ_TOGETHER_TITLES` still includes "Mission of the week", but `READ_TOGETHER_TITLE_ORDER` excludes the mission card because the mission lives on the main This Week card.
- Major concepts rendered:
  - Coach recap.
  - Study link.
  - Why this matters.
  - Acknowledged.

### Summary

- Route: `/summary`
- Route file: `app/(tabs)/summary/index.tsx`
- Owning file: `src/features/summary/SummaryScreen.tsx`
- Primary user: parent or coach, depending on active role/device state
- Responsibility type: analytics, identity, review
- Purpose: athlete operating summary: identity, focus/action/progress, weekly activity, recognized skills, patterns, and competition metrics.
- Major sections rendered:
  - `SummaryHeroCard`, which builds a `SummaryV2Card`.
  - Recognized Skills card.
  - `SummaryWeekCard`.
  - `SummaryPatternsCard`.
  - `SummaryCompetitionCard`.
  - Possibly coaching history/trust/coach linkage UI depending on role/state.
- Major concepts rendered:
  - Focus.
  - Action / Coach direction.
  - Progress.
  - Why.
  - Recognized skills.
  - This week.
  - Game patterns.
  - Competition Snapshot: record, win rate, sub rate, fastest sub, average time, win style, last event, podium counts, placement trend, focus hints.
- Coupling notes:
  - Summary is not a pure visual surface. It reads training sessions, coach weekly sync cache, active athlete authority, competition slices, hydration versions, and signal derivations.
  - It has historically participated in coach/parent freshness arbitration and should remain protected in future language consolidation.

### Training

- Route: `/training`
- Owning file: `app/(tabs)/training.tsx`
- Primary user: athlete/parent/coach operating the device
- Responsibility type: authoring, review, training proof substrate
- Purpose: day-based session log and training review.
- Major sections rendered:
  - `OperatingHeader`: "Training / Execution", "Day-based session log".
  - Training identity message.
  - "LOG TRAINING".
  - Calendar.
  - Add session CTA.
  - Day/week header.
  - "REVIEW TRAINING".
  - Search.
  - Week/day session groups.
  - "Your Game" / "Training patterns" insight carousel region.
- Major concepts rendered:
  - Current focus from sessions.
  - Training patterns.
  - Training proof.
  - Logged techniques/systems.
  - Session media.
- Coupling notes:
  - Training is a proof/source surface. It feeds Summary, coach insight, and training proof publish. It should not become a weekly messaging surface.

### Competition / Compete

- Route: `/compete`
- Owning file: `app/(tabs)/compete.tsx`
- Major components:
  - `src/features/competition/MedalCollection.tsx`
  - `src/features/competition/CompetitionCard.tsx`
  - `src/features/competition/MatchCard.tsx`
- Primary user: parent or coach
- Responsibility type: competition proof, review, event archive
- Purpose: render canonical competition event history, match detail, podium record, and coach match breakdown overlays.
- Major sections rendered:
  - `OperatingHeader`: "Competition / Proof".
  - "Podium record" medal archive.
  - Current/upcoming or recent competition cards.
  - Past month groups.
  - Match cards with "How it ended" and "Coach Match Breakdown".
- Major concepts rendered:
  - Podium record.
  - Competition proof.
  - Match outcomes.
  - Coach Match Breakdown.
  - Medal/tournament timeline.
- Coupling notes:
  - This is the canonical competition render surface. `CompetitionCard` consumes topology via `peekCoachCompetitionTopology`, hydrates overlay annotations, and projects via `projectCompetitionCompeteView`.
  - Future product-language cleanup must not alter topology or overlay attachment semantics.

## 2. Concept Inventory

### Mission of the week

- Originates: `KidWeeklyFocusEntry.title` and template/custom weekly focus flows.
- Edited:
  - `/coach/kid/[kidId]/weekly-focus`
  - `/this-week/kid/[kidId]/weekly-focus`
- Rendered:
  - Coach weekly focus edit screens as "MISSION OF THE WEEK" / "Mission of the week".
  - Parent This Week primary direction card as `focusTitle` / "This week’s direction".
  - Read Together card title set includes "Mission of the week", but the modal order excludes mission because mission is currently on the main This Week card.
- Audience: coach-facing while editing, parent-facing after publish.
- Nature: canonical local row while editing; published family payload after `kidWeeklyFocusToPublishPayload()`.
- Wording drift:
  - "Mission of the week"
  - "Primary weekly message"
  - "This week’s direction"
  - "Weekly focus"

### Weekly focus

- Originates: `KidWeeklyFocusEntry` rows in `src/types/coachKid.ts`.
- Edited: weekly focus edit routes.
- Rendered:
  - Coach Athlete Detail "Weekly focus".
  - Parent This Week legacy / preview areas.
  - Summary as focus/action/progress through signals and weekly coach active state.
- Audience: both coach and parent, but with different responsibilities.
- Nature: canonical local weekly row; publish mapper turns selected row into sync payload.
- Wording drift:
  - "Weekly focus"
  - "Mission of the week"
  - "This week’s direction"
  - "Coach direction"

### Supporting context / Family note / Family coach recap

- Originates:
  - `familyCoachRecapNote` on `KidWeeklyFocusEntry`.
  - Published as `familyCoachRecapNote` on `SyncedWeeklyMessagePayload`.
- Edited:
  - Coach weekly focus edit as "WHAT WE SHARPENED WITH COACH" / "Supporting context".
  - This Week lane edit as "What we sharpened with Coach".
- Rendered:
  - Coach Athlete Detail family huddle source rows.
  - Read Together / Family Huddle as "What we sharpened with coach".
- Audience: parent-facing.
- Nature: canonical local row field, transformed into published payload.
- Wording drift:
  - "Supporting context"
  - "What we sharpened with Coach"
  - "Shared family note"
  - "Family note"
  - "Family Coach Recap" in code.

### Why this matters

- Originates:
  - Coach Athlete Detail local `weeklyWhyThisMatters` authoring field.
  - Parent-side generated/helper copy in `buildReadTogetherStoryCards()`.
- Edited: Coach Athlete Detail "Why this matters".
- Rendered:
  - Coach Athlete Detail family publish lane.
  - Read Together card "Why this matters".
  - Summary V2 section "Why".
- Audience: both parent-facing and summary-facing.
- Nature: partly authored/advisory, partly derived/generative.
- Wording drift:
  - "Why this matters"
  - "Why"
  - "Connect at home" eyebrow.

### Study the move

- Originates:
  - `familyResourceUrl` and `familyResourceLabel` on `KidWeeklyFocusEntry`.
  - Published as `familyResourceUrl` and `familyResourceLabel`.
- Edited:
  - Coach weekly focus edit.
  - This Week lane weekly focus edit.
- Rendered:
  - Read Together / Family Huddle card "Study the move".
- Audience: parent/family.
- Nature: optional family resource link.
- Wording drift:
  - "Study the move"
  - "Optional supplemental resource"
  - "Family resource"

### Mission link

- Originates:
  - `missionResourceUrl` and `missionResourceLabel` on `KidWeeklyFocusEntry`.
  - Published as `missionResourceUrl` and `missionResourceLabel`.
- Edited:
  - Weekly focus edit routes.
- Rendered:
  - Parent This Week "MISSION LINK" card.
  - ReadTogether modal can render mission link if the active card has it.
- Audience: parent/family.
- Nature: optional primary mission link.
- Wording drift:
  - "Mission link (optional)"
  - "Mission (Optional)"
  - "MISSION LINK"
  - "Open this week’s link"

### Acknowledged / Viewed

- Originates:
  - `SyncedWeeklyParentFeedback.viewedAt`
  - `SyncedWeeklyParentFeedback.acknowledgedAt`
- Edited/mutated:
  - Parent This Week via "You got it" / acknowledge flow.
- Rendered:
  - Parent This Week as "✓ Acknowledged".
  - Coach Athlete Detail as feedback status.
  - Coach Dashboard athlete card via parent feedback line.
- Audience: parent action, coach review.
- Nature: parent feedback signal, published back through parent weekly feedback.
- Wording drift:
  - "You got it"
  - "Acknowledged"
  - "✓ Acknowledged at..."
  - "Not viewed yet"

### How it's going / Applied in sparring / Coach check-ins

- Originates:
  - `coachOutcome`, `coachNotes`, `sparringApplication` on `KidWeeklyFocusEntry`.
- Edited:
  - Coach Athlete Detail "How it's going".
  - Dedicated progress reflection route likely under `/coach/kid/[kidId]/progress-reflection`.
- Rendered:
  - Coach Athlete Detail check-in list.
  - Coach Dashboard athlete rows as applied in sparring / outcome.
  - Published payload maps parent-safe `coachOutcome` only, not raw private notes.
- Audience: coach-facing primarily; parent sees a bounded progress signal only if published.
- Nature: coach-owned private observations plus optional parent-safe signal.
- Wording drift:
  - "How it's going"
  - "Applied in sparring"
  - "Outcome"
  - "Progress notes"
  - "Coach check-ins"

### Family Huddle / Read Together

- Originates:
  - Parent This Week action opens `ReadTogetherStoryModal`.
  - Cards generated by `buildReadTogetherStoryCards()`.
- Edited: not directly; receives published weekly payload and derived practice/family copy.
- Rendered:
  - Parent This Week "Family Huddle".
  - Coach Athlete Detail "Preview Family Huddle".
- Audience: parent/family; coach preview.
- Nature: delivery/reflection flow.
- Wording drift:
  - "Family Huddle"
  - "Read together"
  - "Walk through this week with your athlete"

### Suggested focus

- Originates:
  - Derived from recent competitions through competition training skill focus helpers.
- Edited:
  - Coach Athlete Detail can "Use suggested focus" or "Edit focus".
- Rendered:
  - Coach Athlete Detail "Suggested focus from recent competitions".
  - Parent This Week, when published weekly doc includes `recommendedFocusArea`.
  - Coach Dashboard team focus snapshot.
- Audience: coach primarily; parent may see bounded line in weekly direction.
- Nature: derived/advisory.
- Wording drift:
  - "Suggested focus"
  - "Suggested focus from recent competitions"
  - "Suggested class focus"
  - "Team Focus Snapshot"

### Competition Snapshot / Podium record / Coach Match Breakdown

- Originates:
  - Canonical competition detail and topology.
  - Coach overlay artifacts for match breakdowns.
- Edited:
  - Competition edit routes.
  - Coach match breakdown fields in coach competition edit.
- Rendered:
  - Summary `SummaryCompetitionCard`.
  - Compete `MedalCollection`, `CompetitionCard`, `MatchCard`.
  - Coach Athlete Detail competition archive render block is currently hidden.
- Audience: parent and coach.
- Nature: canonical proof plus additive coach-owned overlay.
- Wording drift:
  - "Competition Snapshot"
  - "Competition / Proof"
  - "Podium record"
  - "Coach Match Breakdown"
  - "Local tournament log"

### Training proof / Your Game / Practice Summary

- Originates:
  - Training sessions.
  - Training proof publish and summary signal derivation.
- Edited:
  - Training tab and training detail routes.
- Rendered:
  - Training tab "Day-based session log", "LOG TRAINING", "REVIEW TRAINING", "Your Game".
  - Summary `SummaryWeekCard`, `SummaryPatternsCard`, `PracticeSummaryCard`.
  - Coach Dashboard execution/session count.
- Audience: parent/coach/athlete.
- Nature: canonical local training proof and derived analytics.
- Wording drift:
  - "Training / Execution"
  - "Practice Summary"
  - "This week"
  - "Your Game"
  - "Game Patterns"

### Coach-only

- Originates: local fields and UI boundaries.
- Rendered:
  - Coach Athlete Detail "COACH ONLY".
  - Weekly focus edit "REFERENCE VIDEO · COACH ONLY".
  - Parent This Week "Coach tools" when role indicates coach.
- Audience: coach.
- Nature: explicit privacy/ownership boundary.
- Wording drift:
  - "Coach only"
  - "Not shared with family"
  - "Private check-ins stay coach-only"

### Publish state

- Originates:
  - Coach Athlete Detail `onPublishWeeklyToFamilies()`.
  - `coachSyncPublishWeekly()` and writer link resolution.
- Rendered:
  - Coach Athlete Detail "Publish to family phones", "Publishing…".
  - Parent This Week saved/offline/new update messaging.
  - Coach Dashboard parent feedback status after parent views/acknowledges.
- Audience: coach and parent.
- Nature: sync/delivery state.
- Wording drift:
  - "Publish to family phones"
  - "Published to families"
  - "shared weekly note"
  - "New coach update"

## 3. Duplication Analysis

### Mission / focus vocabulary overlap

The same underlying weekly row is described as "Mission of the week", "Weekly focus", "Primary weekly message", "This week’s direction", and "Coach direction". This is the largest vocabulary drift. The repo currently uses different labels based on surface:

- Edit surfaces: "Mission of the week" and "Weekly focus".
- Coach detail: "Weekly focus" within Family / Publish.
- Parent This Week: "This week’s direction".
- Summary: "Focus" and "Coach direction".

Ambiguity: users may perceive these as separate concepts when they are often the same weekly payload at different lifecycle stages.

### Family note / supporting context / recap overlap

The parent-safe recap appears as "Supporting context", "What we sharpened with Coach", "Shared family note", and code-level `familyCoachRecapNote`. These all refer to related parent-safe narrative, but the labels differ by edit, preview, and family render contexts.

Ambiguity: "Family note" can sound like the whole weekly payload, while `familyCoachRecapNote` is specifically the optional recap card.

### Mission link vs Study the move

The code intentionally distinguishes:

- `missionResourceUrl`: link attached to the mission card.
- `familyResourceUrl`: separate "Study the move" resource.

The UI sometimes compresses the mission link label to "Mission (Optional)" or "Open this week’s link", while Study uses "Optional supplemental resource". The underlying model is sound, but the labels could make parents/coaches think there are multiple competing weekly actions.

### Authoring vs delivery overlap

Coach Athlete Detail currently owns both:

- delivery/publish action
- enough weekly focus authoring shortcuts to feel like an authoring screen

Weekly Focus Edit owns full authoring. Coach Athlete Detail also displays/edit-links parts of the payload and includes suggested focus controls. This creates authoring/review overlap.

### Review vs analytics overlap

Summary, Coach Dashboard, and Compete all render competition-derived concepts:

- Summary renders aggregate metrics and focus hints.
- Coach Dashboard renders team-level bucket/focus/attention.
- Compete renders event and match truth.

This is appropriate by responsibility, but dangerous if language consolidation crosses data boundaries. Compete owns event proof; Summary owns metrics; Coach Dashboard owns triage.

### Hidden legacy/duplicate surfaces

Coach Athlete Detail retains hidden render blocks for:

- "This week in action"
- Competition archive/cards
- top Roster / Household block

These are hidden from the current visual surface, but their supporting state and lifecycle remain in `KidDetailScreen.tsx`. They appear to exist because the detail screen evolved from an all-in-one athlete page into a coaching workspace.

### Parent This Week coach tools overlap

`/this-week` includes coach operational tools and weekly focus preview in certain role/state conditions. This is useful during role switching/dev flows but conceptually overlaps with `/coach` and `/coach/kid/[kidId]`.

## 4. Surface Responsibility Proposal

This section is conceptual only. It does not prescribe code movement.

### Coach Dashboard

Owns:

- team-level triage
- priority / attention groupings
- class-level focus suggestions
- operational scan state
- parent feedback status as a review signal

Does not own:

- full weekly payload authoring
- family-facing copy composition
- competition archive management
- private athlete journal detail

### Coach Athlete Detail

Owns:

- individual athlete review
- private coach observations
- check-in history
- publish readiness/status
- family delivery preview
- final publish action for the selected weekly note
- low-priority roster utility

Does not own:

- full historical training log browsing
- full competition archive browsing
- canonical competition editing authority
- team-level triage
- long-form payload authoring beyond bounded shortcuts

### Weekly Focus Edit

Owns:

- weekly payload authoring
- template/custom focus selection
- system classification
- parent-safe headline/body/recap/link fields
- coach-only reference video field

Does not own:

- final family publish dispatch
- parent acknowledgement
- longitudinal coach check-ins
- team triage
- summary analytics

### Parent This Week

Owns:

- family delivery of the current coach weekly note
- acknowledgement
- mission link access
- family huddle / read-together reflection
- coach connection management
- last competition context only as lightweight support

Does not own:

- coach authoring
- private coach notes
- canonical training proof editing, beyond navigation to training
- competition archive management
- summary analytics

### Summary

Owns:

- athlete identity / operating summary
- recognized skills
- training and competition metrics
- trend/focus signals
- high-level weekly/coach direction synthesis

Does not own:

- weekly payload authoring
- family note delivery
- competition event editing
- coach private check-ins
- roster administration

### Training

Owns:

- session authoring
- day/week training log
- media attached to training sessions
- training proof substrate
- training pattern review

Does not own:

- weekly family message authoring
- coach publish state
- competition topology
- family acknowledgement

### Compete

Owns:

- competition event proof
- podium/career timeline
- match-level detail
- coach match breakdown rendering
- canonical competition edit navigation

Does not own:

- Summary metric copy
- weekly coaching message
- family acknowledgement
- team class-planning triage

## 5. Language Alignment

### Same concept, different labels

| Underlying concept | Current labels | Current surfaces |
|---|---|---|
| Weekly row / weekly mission | Mission of the week, Weekly focus, Primary weekly message, This week’s direction, Coach direction, Focus | Weekly edit, Coach Athlete Detail, Parent This Week, Summary |
| Parent-safe recap | Supporting context, What we sharpened with Coach, Shared family note, familyCoachRecapNote | Weekly edit, Coach Athlete Detail, Read Together |
| Mission URL | Mission link, Mission (Optional), Open this week’s link | Weekly edit, Parent This Week, Read Together modal |
| Supplemental URL | Study the move, Optional supplemental resource, Family resource | Weekly edit, Read Together |
| Parent acknowledgement | You got it, Acknowledged, Viewed, Not viewed yet | Parent This Week, Coach Detail, Coach Dashboard |
| Coach progress note | How it’s going, Applied in sparring, Outcome, Progress notes, Coach check-ins | Coach Detail, Coach Dashboard, progress reflection/history |
| Competition proof | Competition Snapshot, Competition / Proof, Podium record, Local tournament log | Summary, Compete, hidden Coach Detail archive |
| Training proof | Training / Execution, LOG TRAINING, REVIEW TRAINING, This week, Practice Summary, Your Game | Training, Summary |

### Operational vs family-facing language

- Operational coach language:
  - Coach Snapshot
  - Team Focus Snapshot
  - Needs Attention
  - Monitor
  - On Track
  - Applied in Sparring
  - Outcome
  - System Classification
  - Coach only
- Family-facing language:
  - This week’s direction
  - Mission of the week
  - You got it
  - Family Huddle
  - Walk through this week with your athlete
  - What we sharpened with coach
  - Why this matters
- Mixed / transitional language:
  - Weekly focus
  - Supporting context
  - Shared family note
  - Mission (Optional)
  - Weekly focus preview

### Labels that feel legacy or redundant

- "Primary weekly message" and "Mission of the week" appear together in edit surfaces.
- "Mission (Optional)" is ambiguous because the mission itself is not optional; the link is optional.
- "Shared family note" can imply the entire payload, while "What we sharpened with coach" is the specific recap field.
- "Weekly focus preview" appears in This Week coach tools, but full authoring responsibility now lives more clearly in coach/kid edit flows.
- "This week" appears as Summary training activity, parent weekly direction, and coach detail hidden training action list.

## 6. Safety / Architecture Boundaries

### Protected systems for any future consolidation

Future product-language work must not change:

- canonical authority
- coach/parent ownership boundaries
- athlete authority and active athlete selection
- coach weekly sync publish/hydrate paths
- parent feedback publish paths
- training proof persistence and publish paths
- competition lifecycle
- canonical competition detail ownership
- topology publish/hydrate/replay
- aggregate projection lane, unless separately approved
- additive coach overlay model
- overlay lineage and match breakdown publication
- freshness arbitration
- `load()` orchestration in lifecycle-heavy screens
- projection pipelines
- hydration boundaries
- reconcile behavior
- navigation return flows after competition save/edit/delete

### Hidden != Deleted

Several render surfaces in `KidDetailScreen.tsx` are visually hidden but still backed by active data:

- "This week in action"
- Coach detail competition archive/cards
- top roster/household block

These should not be treated as dead code without a separate lifecycle audit. The training and competition data substrates still support family huddle, narrative, recommended focus, competition freshness, and related publish/reconcile behavior.

### Safe visual simplification zones

Usually safe, with inspection:

- labels and section headings
- visual grouping
- placement of pure render blocks
- card density and hierarchy
- whether a render block is shown or hidden, if the backing data remains intact
- family/coach vocabulary alignment when it does not alter payload fields

### Coupled zones requiring architecture review before changes

High-risk:

- `KidDetailScreen.tsx` `load()` and publish paths
- `SummaryScreen.tsx` active athlete, coach weekly sync, competition slice, and signal derivation paths
- `app/(tabs)/this-week/index.tsx` weekly sync hydration, parent feedback, role branching, and link management
- `CompetitionCard` topology/overlay projection
- competition edit save/exit lifecycle
- training proof publish after session edits
- coach roster reconcile and linked-athlete recovery
- weekly payload mapper `kidWeeklyFocusToPublishPayload()`

### Ownership boundaries to preserve

- Coach authors weekly coaching payload and private check-ins.
- Parent consumes weekly payload and publishes bounded feedback/acknowledgement.
- Parent owns canonical athlete/competition authority where applicable.
- Coach consumes bounded synced competition projections and owns additive match breakdown overlays.
- Training sessions remain proof substrate, not family-message authoring.
- Summary consumes signals and metrics; it should not become a publish/edit surface.
- Compete renders event/match proof; it should not become a weekly communication surface.

## Summary Finding

The current app has stabilized technically, but the product language still reflects its evolution through multiple parallel lanes. The biggest conceptual overlaps are:

1. Mission / Weekly Focus / This Week Direction / Coach Direction.
2. Supporting Context / Family Note / What We Sharpened With Coach.
3. Mission Link / Study the Move / Family Resource.
4. Coach check-in progress vs parent-safe progress signal.
5. Summary competition metrics vs Compete event proof.

The safest future consolidation path is to assign each surface a firm job before renaming or hiding anything further:

- Coach Dashboard: team operations and triage.
- Coach Athlete Detail: individual review, check-ins, publish readiness, family preview.
- Weekly Focus Edit: payload authoring.
- Parent This Week: delivery, acknowledgement, family reflection.
- Summary: athlete analytics and synthesis.
- Training: training proof.
- Compete: competition proof.

No implementation should proceed from this map without a slice-specific audit of the exact render block and its lifecycle/data dependencies.
