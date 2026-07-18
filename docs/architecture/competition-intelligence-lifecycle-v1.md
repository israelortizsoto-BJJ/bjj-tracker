# Competition Intelligence Lifecycle v1

| Field | Value |
|-------|--------|
| **Status** | Authoritative product / domain contract — Architecture Certification v1 |
| **Authority class** | Architecture Review Board |
| **Date** | 2026-07-17 |
| **Document class** | Domain lifecycle contract (not implementation; not navigation) |
| **Companions** | Competition Overlay Architecture v2; Competition Runtime Governance / Invariants; Canonical Coaching Workflow; Parent Progress Understanding Doctrine; Competition Navigation Governance v1.1; Competition Navigation Contract (code) |
| **Does not authorize** | Implementation, code changes, navigation redesign, event-bus wiring, notification delivery, or AI feature shipping |

---

## Classification legend

Every certification mark in this document uses exactly one of:

| Mark | Meaning |
|------|---------|
| **CERTIFIED** | Repository evidence establishes the claim as product/domain law engineering may implement against. |
| **PARTIALLY CERTIFIED** | Core ownership or meaning is proven, but sequencing, enforcement, or surface completeness remains incomplete. |
| **FUTURE DESIGN** | Named as architectural intent or open enhancement. Not proven as implemented domain law. |

This document is the authoritative **Competition Intelligence Lifecycle** contract. Navigation is governed separately. Runtime planes and writers are governed by Competition Overlay Architecture v2 and Competition Runtime Governance / Invariants. This lifecycle does not reopen those ownership floors.

---

# 1. Purpose

## Certification: CERTIFIED

Describe the lifecycle of a competition from registration through AI analysis.

### Contract

Competition Intelligence is the product loop by which:

1. a Parent registers a competition against an athlete;
2. the competition exists as upcoming proof-in-waiting;
3. the competition occurs in the real world;
4. the competition becomes completed as an event;
5. outcomes may remain unrecorded (Results Pending);
6. the Parent records results and match structure;
7. the Coach is notified that reviewable artifacts exist;
8. the Coach records Match Breakdown (interpretation);
9. the Parent is notified that coaching meaning is available;
10. AI consumes completed competition artifacts;
11. Athlete Intelligence surfaces longitudinal understanding.

### Evidence

- `docs/canonical-coaching-workflow.md` defines the governing product loop: Training → Competition → Coach Interpretation → Weekly Direction → Parent Reinforcement → Longitudinal Athlete Development.
- `docs/architecture/competition-overlay-architecture-v2.md` separates canonical competition authority (Parent) from coach intelligence overlays and future AI surfaces.
- `docs/parent-progress-understanding-doctrine.md` places Summary as the parent-facing synthesis layer where competition validation converges into athlete understanding.
- Engineering Checkpoint 2026-07-16 records end-to-end Parent ↔ Coach competition synchronization without navigation side effects as an engineering floor — confirming the lifecycle is operationally real, not merely aspirational.

### Boundary

This section certifies **what the lifecycle is**. It does not certify navigation entry/exit, refresh corridors, or publication epochs. Those remain companion contracts.

---

# 2. Artifact Ownership

## Certification: CERTIFIED (core artifacts); PARTIALLY CERTIFIED (AI Analysis, Athlete Dashboard)

Identify the owner of each artifact and why.

| Artifact | Owner | Why | Certification |
|----------|-------|-----|---------------|
| **Competition Metadata** | Parent (athlete-scoped) | Shell facts (name, date, status, format, organization) are parent-authored competition registration truth. Stored on athlete/`kidId` + `sharedAthleteId` scope — not as a family artifact. | **CERTIFIED** |
| **Competition Result** | Parent | Placement / outcome is a factual family-recorded result. Optional until recorded. Coach may not invent or replace it as canonical. | **CERTIFIED** |
| **Matches** | Parent | Match row existence, ordinals, match outcomes, and media refs are parent-owned topology. | **CERTIFIED** |
| **Match Breakdown** | Coach | Breakdown is interpreted athletic truth — overlay intelligence, not competition authority. | **CERTIFIED** |
| **AI Analysis** | Derived consumer (Coach overlay class / future analysis plane) | AI reads completed projections; writes only derived insight overlays; never owns match results or shell metadata. | **PARTIALLY CERTIFIED** |
| **Athlete Dashboard** | Parent-facing synthesis consumer (Summary / longitudinal surfaces) | Dashboard consumes competition proof + coach interpretation; does not author competition topology or Match Breakdown. | **PARTIALLY CERTIFIED** |

### Ownership law

1. **Parent is the authority that creates competitions.**  
   Evidence: Overlay Architecture v2 — “One canonical writer per fact class. Parent owns competition topology and match outcomes.” Parent plane publishes topology and aggregate artifacts; coach plane reconciles mirrors.

2. **Competition ownership belongs to the athlete (kid artifact), not a family artifact.**  
   Evidence:
   - `KidCompetitionEntry` is keyed by `kidId` with optional `sharedAthleteId` / `sharedCompetitionId` (`src/types/coachKid.ts`).
   - Overlay Architecture v2 and Runtime Invariants: all coach competition artifacts keyed by `sharedAthleteId` (OAI); route params are join hints only.
   - Competition Navigation Governance v1.1 treats Family Competition Editor decommissioning as certification-gated precisely because family-scoped authoring is not the enduring ownership model.
   - Status nuance: Family Competition Editor still exists in production routes; athlete-scoped ownership is the certified domain law, while family-scoped authoring remains a transitional surface under decommissioning gate → overall **CERTIFIED** for ownership target, with family editor as non-authoritative legacy risk, not alternate ownership.

3. **Coach owns Match Breakdown.**  
   Evidence: Overlay Architecture v2 data ownership map; `upsertMatchBreakdownOverlay` docstring (“Coach-owned annotation write. Never mutates competition shells or canonical topology.”); INV-O3 overlays may never mutate canonical state; Canonical Coaching Workflow §3 (“Match Breakdown = Coach Interpretation”).

4. **AI consumes completed competition artifacts.**  
   Evidence: Overlay Architecture v2 AI coaching doctrine — AI reads projection rows (topology + existing overlay); output is overlay-class only; human-in-the-loop. Shared competition analysis projection / readiness selection (`projectSharedCompetitionAnalysis`, `selectCompetitionAnalysisForAnalytics`) consumes projected artifact rows under readiness gates. Full generative AI product surface remains incomplete → **PARTIALLY CERTIFIED**.

5. **Athlete Dashboard consumes intelligence; it does not own competition facts.**  
   Evidence: Parent Progress Understanding Doctrine — Summary synthesizes; Compete owns event proof; Summary must not become a second Compete. Premium / longitudinal athlete identity dashboard remains doctrine-forward → **PARTIALLY CERTIFIED**.

---

# 3. Lifecycle

## Certification: PARTIALLY CERTIFIED

Represent the workflow. Each transition is explained and marked.

```text
Parent
↓
Competition Created
↓
Upcoming
↓
Competition Occurs
↓
Completed
↓
Results Pending
↓
Parent Records Results
↓
Coach Notification
↓
Coach Records Match Breakdown
↓
Parent Notification
↓
AI Analysis
↓
Athlete Intelligence
```

### Transition explanations

| Transition | Meaning | Certification | Evidence |
|------------|---------|---------------|----------|
| **Parent → Competition Created** | Parent (or authorized parent-plane workflow) creates an athlete-scoped competition shell. Creation is registration, not outcome. | **CERTIFIED** | Overlay Architecture v2 Parent plane; `kidCompetitionStore` / competition create paths; Navigation Contract preserves athlete scope without transferring ownership. |
| **Competition Created → Upcoming** | Registered competition is planning / appearance state before or until occurrence. `eventStatus` includes `upcoming`. | **CERTIFIED** | `KidCompetitionEventStatus` (`upcoming` \| `completed` \| `cancelled` \| `unknown`); Compete / This Week upcoming partitions. |
| **Upcoming → Competition Occurs** | Real-world occurrence. Domain-distinct from review completion and from result recording. May be inferred from date/status, but is not itself a recorded review artifact. | **FUTURE DESIGN** (as explicit domain event); occurrence concept **PARTIALLY CERTIFIED** via date/status separation | Event status and event date exist; no first-class `CompetitionOccurred` event emitter is certified. |
| **Competition Occurs → Completed** | Event lifecycle reaches completed appearance state. Completion of the *event* ≠ completion of *review*. | **PARTIALLY CERTIFIED** | `eventStatus: "completed"` exists; operators may still leave `result` unset. |
| **Completed → Results Pending** | Completed competitions may have no recorded outcome. Results Pending is a legal domain state. | **CERTIFIED** | `result?: KidCompetitionResult` with comment “Omitted until the family or coach sets an outcome”; Family editor labels **RESULT (OPTIONAL)**; Kid detail presents missing result as **“No result yet”**. |
| **Results Pending → Parent Records Results** | Parent records competition result and/or match outcomes into canonical topology. | **CERTIFIED** | Parent owns match outcomes; CompetitionSync / parent editors write `result` and match detail; topology/aggregate publish from parent save. |
| **Parent Records Results → Coach Notification** | Coach becomes aware that reviewable parent artifacts exist. Awareness may be sync/hydration today; push/SMS later. | **PARTIALLY CERTIFIED** | Cross-device topology/aggregate hydrate notifies coach plane of parent truth; Engineering Checkpoint validates Parent→Coach sync without navigation hacks. Dedicated notification product channel is parking-lot future. |
| **Coach Notification → Coach Records Match Breakdown** | Coach authors overlay interpretation against parent match lineage. | **CERTIFIED** | Coach Match Breakdown overlays; merge is projection-only (`mergeCoachBreakdownIntoMatches`); INV-O3/INV-O4. |
| **Coach Records Match Breakdown → Parent Notification** | Parent becomes aware coaching meaning is available. | **PARTIALLY CERTIFIED** | Parent hydrate of coach breakdown artifacts exists; Engineering Checkpoint documents coach publish → parent observe corridor. Push notification on breakdown publish is parking-lot future (`docs/engineering-parking-lot.md`). |
| **Parent Notification → AI Analysis** | AI consumes completed competition artifacts (topology + breakdown overlays) to produce derived analysis. | **PARTIALLY CERTIFIED** | Analysis projection + readiness eligibility exist; Overlay AI doctrine defines input/output boundaries; generative AI product stage remains future. |
| **AI Analysis → Athlete Intelligence** | Analysis feeds athlete-facing longitudinal understanding (Summary / future Athlete Dashboard). | **PARTIALLY CERTIFIED** | Summary doctrine + shared analysis selection exist; premium Athlete Identity Timeline remains Canonical Coaching Workflow future vision. |

### Lifecycle invariants implied by this section

- Registration precedes occurrence.
- Occurrence precedes (or is independent of) result recording.
- Result recording precedes authoritative Coach review expectation.
- Match Breakdown precedes AI consumption of coaching interpretation.
- Athlete Intelligence is downstream of completed artifacts — never a writer of competition truth.

---

# 4. Domain Invariants

## Certification: CERTIFIED (with one PARTIALLY CERTIFIED enforcement note)

### INV-CIL-1 — Competition occurrence is separate from review completion

**CERTIFIED.**

Occurrence / event status is not Coach Match Breakdown completion, not AI readiness, and not Athlete Dashboard synthesis.

Evidence:

- `eventStatus` models appearance/planning lifecycle independently of coach overlays.
- Overlay Architecture v2 separates parent lifecycle publish from coach overlay lifecycle.
- Parent Init / Consumer Observation treat enrichment / Match Breakdown visibility as separate from Init floor success (C-RT6) — reinforcing that review enrichment is not event completion.

### INV-CIL-2 — `result = undefined` means no outcome has been recorded

**CERTIFIED.**

Optional result represents **Outcome Not Yet Recorded** (Results Pending). Absence is meaningful domain state, not an error and not an implied medal.

Evidence:

- `KidCompetitionEntry.result?: KidCompetitionResult` — “Omitted until the family or coach sets an outcome.”
- Family Competition Editor: **RESULT (OPTIONAL)** with clear-to-undefined interaction.
- Kid detail label: missing result → **“No result yet”**.
- Worker sync accepts result as optional field presence (`hasResult` gating).

### INV-CIL-3 — Presentation defaults must never mutate domain state

**CERTIFIED** as domain law; **PARTIALLY CERTIFIED** as universal enforcement.

Projection and display helpers may derive labels, medal tiers, or empty-state copy without writing stores.

Evidence:

- INV-O4 — Projections are presentation-only; named projectors do not persist.
- INV-O3 — Overlays may never mutate canonical state.
- `competeMedalTierFromKidEntry` / result labels derive display values without claiming they are stored outcomes.
- Competition Navigation Governance: unresolved context must not create replacement records or mutate canonical state.

Enforcement note: some editor draft initializers historically coerce UI drafts (for example defaulting draft result to `"participated"`). That is a known risk class against this invariant. Domain law forbids promoting presentation defaults into persisted outcome. Implementation correction is out of scope for this document.

### INV-CIL-4 — Match Breakdown cannot exist before results exist

**PARTIALLY CERTIFIED.**

Product lifecycle law: Coach Match Breakdown is interpretation of competition proof. Authoritative review expectation follows Parent-recorded results / match structure.

Evidence supporting the law:

- Parent owns topology and match outcomes; Coach overlay attaches by `matchLineageKey` to parent-owned structure.
- Overlay Architecture v2: bounded overlays carry structure parent already owns; coach does not mint canonical matches for linked athletes.
- Lifecycle sequencing in §3 places Parent Records Results before Coach Records Match Breakdown.

Enforcement nuance: overlay attachment is structurally gated by match lineage / topology presence, not always by competition-level `result` being set. Competition-level result may remain undefined while match rows exist. The invariant therefore means: **breakdown interpretation requires parent competition/match artifacts to exist as reviewable proof; it is not a free-floating coach journal.** Hard product gating that forbids any overlay before competition-level result is recorded is not fully certified as enforced.

### INV-CIL-5 — AI requires completed artifacts

**CERTIFIED** as boundary law; **PARTIALLY CERTIFIED** as product completeness.

AI may not invent competition topology, match outcomes, or shell metadata. AI consumes completed (or readiness-gated) projected artifacts.

Evidence:

- Overlay Architecture v2 AI coaching doctrine: input = projection rows; output = derived overlay only.
- `selectCompetitionAnalysisForAnalytics` / readiness states gate analytics selection on artifact readiness timestamps and READY state when eligibility is enabled.
- AI insights marked future / never-canonical in ownership map.

---

# 5. Future Events

## Certification: FUTURE DESIGN

These are architectural domain events. They name lifecycle meaning. They are **not** implementation requirements, queue schemas, or API contracts.

| Event | Fires when | Intended consumers (architectural) |
|-------|------------|--------------------------------------|
| **CompetitionCreated** | Parent creates an athlete-scoped competition shell | Coach awareness corridors; upcoming surfaces; analytics registration |
| **CompetitionOccurred** | Competition has occurred in the real world (distinct from review) | Results Pending UX; reminder systems; coach prep surfaces |
| **CompetitionResultsRecorded** | Parent records competition and/or match outcomes into canonical artifacts | Coach Notification; topology/aggregate consumers; AI eligibility precursors |
| **CoachBreakdownCompleted** | Coach finishes Match Breakdown for the competition’s matches | Parent Notification; AI Analysis; Athlete Intelligence refresh |
| **CompetitionAnalysisGenerated** | AI (or shared analysis projection) produces analysis over completed artifacts | Athlete Intelligence; coach assist surfaces |
| **AthleteInsightsUpdated** | Athlete-facing intelligence surfaces update from new analysis / breakdown | Summary / Athlete Dashboard consumers |

### Explicit non-requirements

- No mandate to introduce an event bus, webhook, SMS, or push provider.
- No mandate that current sync/hydration rename itself to these event titles.
- Existing publication / invalidation corridors may later *emit* or *map to* these events without changing ownership.

---

# 6. Open Questions

## Certification: FUTURE DESIGN

Future enhancements recognized by this lifecycle, without prescribing implementation:

| Theme | Open question |
|-------|----------------|
| **SMS** | Should Results Pending, Coach Breakdown completion, or AI readiness notify via SMS? |
| **Push notifications** | When should Parent or Coach receive push for lifecycle transitions (already parked: push on Match Breakdown publish; push on weekly summaries)? |
| **Parent reminders** | How should Parents be reminded to record results after occurrence without mutating domain defaults? |
| **Coach reminders** | How should Coaches be reminded that reviewable results exist and breakdown is outstanding? |
| **AI recommendations** | What recommendation class is allowed on Athlete Intelligence without becoming competition authority? |
| **Review completion status** | Should “review complete” become an explicit domain status distinct from `eventStatus`, result presence, and overlay non-emptiness? |

These questions may produce future companion contracts. They do not weaken certified ownership in §2 or invariants in §4.

---

# 7. Certification

## Overall verdict: PARTIALLY CERTIFIED

Repository evidence **supports** the Competition Intelligence Lifecycle as the authoritative product/domain contract engineering should implement against. Core ownership and optional-result semantics are certified. Full end-to-end eventing, notification products, AI generation, and Athlete Dashboard completeness remain future or partial.

### Section rollup

| Section | Mark | Basis |
|---------|------|-------|
| **1. Purpose** | **CERTIFIED** | Canonical Coaching Workflow + Overlay Architecture + Summary doctrine define the registration→interpretation→intelligence loop. |
| **2. Artifact Ownership** | **CERTIFIED** (core); **PARTIALLY CERTIFIED** (AI Analysis, Athlete Dashboard) | Parent topology/results + Coach breakdown are repository law; AI and dashboard are bounded consumers with incomplete product surfaces. |
| **3. Lifecycle** | **PARTIALLY CERTIFIED** | Parent create → upcoming/completed → optional result → parent results → coach breakdown → parent observe is evidenced; occurrence event, dedicated notifications, and full AI→dashboard stage are incomplete. |
| **4. Domain Invariants** | **CERTIFIED** (law); **PARTIALLY CERTIFIED** (INV-CIL-4 enforcement / INV-CIL-3 universal enforcement) | Optional result, occurrence≠review, presentation-only projections, AI input boundaries are evidenced; some draft-default and breakdown-gating nuances remain. |
| **5. Future Events** | **FUTURE DESIGN** | Named architectural events only; not implemented requirements. |
| **6. Open Questions** | **FUTURE DESIGN** | Parking-lot and doctrine-forward enhancements; no implementation prescription. |
| **7. Certification** | **PARTIALLY CERTIFIED** | Lifecycle is authoritative enough to govern implementation direction; not every stage is runtime-complete. |

### Repository evidence already certifies (accepted premises)

| Premise | Evidence anchors |
|---------|------------------|
| Parent is the authority that creates competitions | Overlay Architecture v2 Parent plane; Runtime Governance P1 |
| Competition ownership belongs to the athlete (kid artifact), not a family artifact | `KidCompetitionEntry.kidId` / OAI keys; Navigation Governance family-editor decommission gate |
| `result` is intentionally optional | `result?:` type + “Omitted until…”; RESULT (OPTIONAL) UI |
| Optional result represents Outcome Not Yet Recorded | “No result yet”; Results Pending lifecycle state in §3 |
| Coach owns Match Breakdown | Overlay doctrine; INV-O3; Canonical Coaching Workflow §3 |
| AI consumes completed competition artifacts | AI coaching doctrine; analysis readiness / projection gates |
| Navigation Contract exists separately | `competitionNavigationContract.ts`; Competition Navigation Governance v1.1 |

### What this document does not do

- Does not authorize implementation.
- Does not modify navigation ownership or editor routes.
- Does not redefine P1–P6 runtime planes.
- Does not close Active Investigation Register items (including Parent Match Breakdown Publication) by assertion.
- Does not invent SMS/push/event-bus requirements.

### Adoption statement

**Competition Intelligence Lifecycle v1 is hereby adopted as the authoritative product/domain contract for the competition→coaching→AI→athlete-intelligence loop.**

Engineering may implement against §§1–4.  
§§5–6 remain future design.  
Overall certification remains **PARTIALLY CERTIFIED** until occurrence events, notification products, AI generation, review-completion status, and Athlete Dashboard completeness are independently certified or explicitly deferred by companion contracts.

**No runtime changes are authorized by this document alone.**
