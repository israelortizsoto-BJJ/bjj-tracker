# BJJ Tracker - Dev Handoff Notes
# DEBUGGING REMINDER

Facts before fixes.
Trace before mutation.
Protected systems remain locked until evidence proves ownership.

Reference:
master-prompt-developer.md

GOVERNING INCIDENT RESPONSE DOCUMENT

docs/architecture/matmind-incident-capture-architecture-v1.md

→ DEBUG DOCTRINE
OVERLAY FORENSIC TOOLKIT

Document:

Primary tag:
[OVERLAY_FORENSIC]

Primary correlation key:
traceId

Primary investigation flow:

1. overlay_write_complete
2. overlay_list_for_publish
3. artifact_build_input
4. artifact_build_output
5. publish_schedule_payload
6. publish_http_request
7. publish_http_success
8. worker_store_artifact_set
9. worker_get_artifact_set

And explicitly document:

If a coach note does not hydrate:

Step 1:
Search traceId from overlay_write_complete

Step 2:
Determine first missing stage

If missing after overlay_write_complete
→ local overlay storage issue

If missing after artifact_build_input
→ artifact filtering issue

If missing after publish_http_request
→ network transport issue

If missing after worker_store_artifact_set
→ worker persistence issue

If present through worker_get_artifact_set
→ parent hydration/render issue

Canonical intermediate checkpoint (ODS documentation pattern, MatMind adaption):
docs/engineering-checkpoint.md

Writers:
scripts/write_engineering_checkpoint.py

---

# DEV HANDOFF — 2026-07-15 21:59

## Runtime Focus

Engineering Design Phase — INV8 Production Design v1 authored under Correction Authorization (AUTHORIZE WITH CONDITIONS). Governance Freeze active. No production code yet.

## Accomplished

Authored **INV8 Production Design v1**:

`docs/engineering/inv8-production-design-v1.md`

C-D6 shape: sole behavioral delta is elimination of observation-derived Init-Affecting Reactions (CO-R5 / XR-1 / XR-2) so Parent Initialization can reach the certified Minimum Parent Initialization floor under C-RT4, epoch-independently.

Exit answers recorded in document: Q3 = YES (demonstrably smallest); Q4 = YES (implementation may begin after design approval; no missing engineering input).

## Explicit non-authorization / freeze

- Constitutions and governance documents unmodified.
- Temporary INV8 suppression harness is **not** production shape (COND-5).
- Publication epoch A/B remains uncertified (COND-1).
- Success is not list visibility alone (C-D3 / COND-6).

## Do Not

- Do not amend constitutional or governance artifacts.
- Do not author additional architecture.
- Do not promote `__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__` to production.
- Do not reopen protected systems or falsely close Active Investigation Register items.

## Next

Production Implementation of the Section 4 single behavioral delta within Authorization §§3–7; then Runtime Validation V-1…V-8; then Completion Certification.

---

# DEV HANDOFF — 2026-07-15 21:45

## Runtime Focus

Engineering Proposal Phase — INV8 Proposed Change Statement v1 (RI-6) authored. No production runtime work authorized.

## Accomplished

Authored **INV8 Proposed Change Statement v1**:

`docs/architecture/governance/inv8-proposed-change-statement-v1.md`

Ownership claim (C-D6): Observation Delivery must not Init-Affect Parent Initialization; Init must reach certified Minimum Parent Initialization floor; epoch-independent (does not require Candidate A/B).

Exit answers recorded in document: Q3 = NO (missing Correction Authorization); Q4 = YES (RI-6 reduces distance on the only authorized path).

## Explicit non-authorization

- Proposed Change Statement does **not** authorize production design or code.
- Required next authorization artifact (if ARB review later passes): **INV8 Ownership-Preserving Correction Authorization v1**.
- Companion Required Inputs still owed: RI-7…RI-11.

## Do Not

- Do not implement INV8 fixes.
- Do not begin production design.
- Do not promote temporary INV8 suppression harness to production shape.
- Do not certify Publication epoch A/B via this proposal.
- Do not reopen protected systems or amend constitution/governance via proposal text.

## Next

Assemble RI-7…RI-11 and submit ARB review package; await §11 AUTHORIZE before any production design.

---

# DEV HANDOFF — 2026-07-15 21:37

## Runtime Focus

Governance Phase — Architecture Review Board procedure authored. No production runtime work authorized.

## Accomplished

Authored **Ownership-Preserving Change Review Procedure v1**:

`docs/architecture/governance/ownership-preserving-change-review-procedure-v1.md`

This is ARB governance procedure, not constitutional law, not runtime design, not implementation.

Immutable inputs bound into review:

1. Parent Initialization Ownership Contract v1
2. Consumer Observation Contract v1
3. Certified Architecture Register
4. Protected Systems Register
5. Active Investigation Register

## Explicit non-authorization

- Procedure does **not** authorize the smallest ownership-preserving implementation.
- Engineering is **not** authorized to begin production design.
- Required next authorization artifact (if review later passes): **INV8 Ownership-Preserving Correction Authorization v1**.

## Do Not

- Do not implement INV8 fixes.
- Do not redesign the runtime.
- Do not amend constitutional contracts via governance paperwork.
- Do not reopen protected systems.

## Next

Assemble Proposed Change Statement + Required Inputs RI-6…RI-11 under the review procedure when directed.

---

# DEV HANDOFF — 2026-07-14 22:11

Runtime Focus

Transition the investigation from runtime debugging to architecture certification.

The investigation is no longer centered on callbacks, hooks, or replay timing.

Instead, the investigation is centered on certifying ownership contracts across the Parent Runtime.

Success is no longer defined as "making competitions appear."

Success is defined as producing a repository-backed ownership model in which every runtime responsibility has exactly one architectural owner.

Major realization

Yesterday established a new engineering doctrine:

Runtime execution is temporary.

Ownership is permanent.

Execution traces explain what happened.

Ownership contracts explain what is allowed to happen.

Future investigations should therefore certify ownership before proposing runtime modifications.

Certified systems that remain closed

Identity

Canonical Athlete Authority

Overlay Merge

Artifact Persistence

Competition Rendering Pipeline

Topology Ownership

Coach Runtime

None of these should be reopened without contradictory evidence.

Active Investigation

Parent Runtime Publication Corridor

Specifically:

Who owns the boundary between

Parent Refresh

↓

Publication

↓

Hydration Bus

↓

Competition Initialization

and what architecture contract governs that ownership?

Primary Goal for 7/15

Produce the missing Parent Initialization Ownership Contract.

Not another runtime probe.

Not another callback investigation.

A formal ownership contract that clearly defines:

initialization owner
publication owner
hydration owner
rendering owner
eventual consistency owner

Once that contract exists, determine whether the publication timing is violating it or whether the contract itself needs to be refined.
# DEV HANDOFF — 2026-07-13

# PART 1 — Executive Summary

## Mission

Complete day's close for MatMind documentation + investigation discipline.

Two tracks ran today:

1. Adopt and exercise the ODS documentation operating pattern (DOCOPS v2).
2. Continue Parent Runtime Convergence via question-driven Competition Lifecycle QA.

## Verified Outcomes

* DOCOPS v2 exercised successfully end-to-end.
* ODS documentation workflow adopted as MatMind operating pattern.
* Question-driven investigation methodology established.
* Competition Lifecycle QA: Q1–Q5 YES; Q6 partial (cold-start convergence).
* Engineering checkpoint written and verified by Python (`scripts/write_engineering_checkpoint.py`).
* Engineering Parking Lot introduced (no new parked items today).

## Responsibility Boundary Proven

```text
GPT generates structured engineering model
↓
Python validates / writes / verifies canonical documents
```

Checkpoint path proven today:

```text
wrote docs/engineering-checkpoint.md
verified docs/engineering-checkpoint.md
```

Python owns the checkpoint.
Living-document updates follow the same ODS terminal-first pattern.

---

# PART 2 — DOCOPS / ODS Documentation Adoption

## Canonical Operating Pattern

Workflow order must remain identical:

1. Inspect repository.
2. Reuse existing script if available.
3. Otherwise generate a terminal-first inline Python updater.
4. Update canonical living documents.
5. Create/update the dated checkpoint/EOD artifact.
6. Preview changes.
7. Provide git checkpoint commands.
8. End with the next restart prompt.

## MatMind Adaption Map

| ODS role | MatMind path |
|---|---|
| Repository root | `/Users/ods/Repos/bjj-tracker` |
| Living handoff | `docs/dev-handoff.md` |
| Daily restart prompt | `docs/master-prompt-daily-restart.md` |
| Developer doctrine prompt | `docs/master-prompt-developer.md` |
| Certification living docs | `docs/architecture/certification/*` |
| Dated checkpoint artifact | `docs/engineering-checkpoint.md` |
| Checkpoint writer | `scripts/write_engineering_checkpoint.py` |
| Handoff ordering helper | `scripts/dev_handoff_ordering.py` |
| Handoff writer (when model-ready) | `scripts/write_dev_handoff.py` |
| Certification writer | `scripts/write_architecture_certification.py` |
| Engineering Parking Lot | `docs/engineering-parking-lot.md` |

## Script Reuse Rule

Prefer existing writers in order:

1. `scripts/write_engineering_checkpoint.py`
2. `scripts/write_dev_handoff.py` + `scripts/dev_handoff_ordering.py`
3. `scripts/write_architecture_certification.py`

If no writer owns the required update, use a terminal-first inline Python updater.

Python validates, formats, writes, and verifies.
GPT supplies engineering content / structured models.

## Architectural Direction (Not Building Now)

Long-term target (founder velocity: capture only, do not implement today):

```text
Engineer → GPT → Engineering Model → Python → Checkpoint / Dev Handoff / Parking Lot / future docs
```

The engineering model becomes canonical source.
Documents become views of that model.

---

# PART 3 — Competition Lifecycle QA (Question-Driven)

Investigation remains:

**Parent Runtime Convergence** (ACTIVE)

Method:

Answer one binary question at a time.
Stop at the first uncertified boundary.
Do not reopen Overlay Merge Contract or Canonical Identity Ownership without new evidence.

## Results

| Question | Result |
|---|---|
| Q1 | YES |
| Q2 | YES |
| Q3 | YES |
| Q4 | YES |
| Q5 | YES |
| Q6 | PARTIAL — cold-start convergence |

Q6 detail:

After cold launch, competitions were absent until the temporary suppression experiment was enabled, after which competitions immediately returned.

A newly created competition initially rendered two matches on Parent while Coach hydrated only one until the Parent competition was edited.

Compete instrumentation in `app/(tabs)/compete.tsx` remains diagnostic-only.

---

# PART 4 — Remaining Investigation Boundaries

Exactly two boundaries remain open:

1. **Parent cold-start convergence**
   Why temporary suppression of artifact hydration publication materially changes Parent initialization after cold launch.

2. **Coach initial match hydration divergence**
   Newly created competition hydrates differently on Coach vs Parent until a subsequent Parent mutation.

Next experiment:

Refocus INV8 on runtime convergence.
Determine why suppression changes Parent initialization, then investigate the Coach match hydration divergence using the newly created competition as the certified reproduction path.

---

# PART 5 — Do Not

* Redesign the ODS documentation workflow
* Add new documentation frameworks
* Expand DOCOPS beyond existing MatMind writers
* Treat documentation adoption as a Parent Compete fix
* Reopen certified architecture boundaries
* Add instrumentation unless an approved question cannot be answered
* Continue investigating downstream after the first uncertified boundary
* Treat suppression as the root cause without runtime proof
* Park work without founder decision + Resume Trigger

# DEV HANDOFF — 2026-07-10

# PART 1 — Executive Summary, Repository State, Mission, Certified Architecture

---

# MATMIND ENGINEERING HANDOFF

**Date**

2026-07-10

---

# Executive Summary

July 10 represented a major reset of the engineering process.

The objective was intentionally **not** to continue broad debugging of the Parent Competition issue.

Instead, the day was dedicated to restoring engineering discipline after several weeks of increasingly broad investigations that repeatedly rediscovered already-proven architecture.

The primary goal became:

> **Create a certification-driven engineering workflow where future investigations begin from repository truth instead of reconstructed chat history.**

This objective was successfully completed.

The result is a new engineering operating model centered around:

* Architecture Certification
* Protected Systems
* Active Investigation Register
* Runtime-first investigation doctrine
* Binary investigation methodology
* Git checkpoint discipline
* Founder Velocity

Although the Parent Competition runtime remains unresolved, the search space has been dramatically reduced.

Ownership has shifted away from generic Competition rendering and toward the Parent runtime publication corridor.

---

# Repository State

Branch

```text
rollback-pre-lineage-regression
```

HEAD

```text
a90f3c8

Establish architecture certification knowledge base
```

Working Tree (End of Day)

```text
M app/(tabs)/compete.tsx
```

Only the active runtime investigation remains uncommitted.

All documentation work completed during the day has been committed or intentionally separated from the runtime investigation.

This separation is now considered part of engineering doctrine.

---

# Mission of July 10

Previous investigations repeatedly suffered from the same failure mode:

* broad debugging
* reopening certified systems
* reconstructing architecture from memory
* multiple simultaneous hypotheses
* unclear ownership

July 10 intentionally paused debugging to establish permanent engineering infrastructure.

The guiding principle became:

> **Do not continue debugging until the repository itself can tell us what is already proven.**

---

# Major Deliverable

## Architecture Certification System

Repository additions:

```text
docs/architecture/certification/

    CertifiedArchitectureRegister-v1.md
    protected-systems-register.md
    active-investigation-register.md
    CERTIFICATION_HISTORY.md

scripts/

    write_architecture_certification.py
```

Commit

```text
a90f3c8

Establish architecture certification knowledge base
```

This became the canonical certification layer for the repository.

Architecture documentation now serves two different purposes:

Architecture Documents

↓

Explain how systems work.

Architecture Certification

↓

States which systems are actually proven.

---

# Engineering Operating Model

The repository startup workflow is now:

```text
git status

↓

git log

↓

Architecture Certification Register

↓

Developer Handoff

↓

Active Investigation Register

↓

Resume exactly one investigation
```

This replaces reconstructing engineering context from previous conversations.

---

# Protected Engineering Philosophy

A certified subsystem is considered protected.

Protected systems may **not** be modified without:

* repository evidence
* runtime evidence
* explicit reason for reopening

This prevents reopening previously solved engineering work.

---

# Certified Architecture (Current)

As of July 10 the following areas are considered certified.

---

## Canonical Identity Ownership

Status

✅ Certified

Reason

Identity ownership has been repeatedly validated through repository investigation.

Ownership boundaries are considered stable.

No further investigation should occur without new runtime evidence.

---

## Overlay Merge Contract

Status

✅ Certified

Reason

Overlay merge behavior has been certified through repository investigation and runtime validation.

No architectural redesign should occur.

---

## Competition Topology

Status

⚠️ Partially Certified

Reason

Core ownership is understood.

Runtime investigations remain active.

---

## Coach Artifact Pipeline

Status

⚠️ Partially Certified

Reason

Multiple boundaries have been certified.

Publication behavior remains under active investigation.

---

## Competition Rendering Pipeline

Status

⚠️ Partially Certified

Reason

Rendering itself is no longer considered the primary owner.

Parent runtime convergence remains unresolved.

---

# Protected Systems

The following systems should not be reopened during future investigations unless new evidence appears.

Examples include:

* Canonical Identity Ownership
* Overlay Merge
* Certified rendering boundaries
* Incident Capture architecture
* Competition State Auditor infrastructure
* Documentation Operations (DOCOPS)
* Git checkpoint workflow

Future investigations should begin by assuming these systems are correct.

---

# Active Investigation Register

Current Active Investigation

```text
Parent Runtime Convergence
```

Current Owner

```text
Parent Runtime Publication Corridor
```

Not

```text
CompetitionTab
```

Current Question

```text
Can the Parent runtime publication corridor converge?
```

Not

```text
Why are competitions missing?
```

This distinction is intentional.

Investigations now target the first unstable owner rather than downstream symptoms.

---

# Founder Velocity Doctrine

July 10 also established a permanent reminder.

The goal is not to produce more documentation.

The goal is to:

* certify architecture
* eliminate uncertainty
* ship investigations
* move engineering forward

Documentation exists to accelerate engineering.

Not replace it.

---

# End of Part 1

# PART 2 — Complete Investigation Timeline, Runtime Certifications, Eliminated Hypotheses, Mental Model

---

# Investigation Timeline

The July 10 investigation intentionally followed the new engineering doctrine.

Each investigation had:

* one owner
* one question
* one success criteria
* repository evidence before runtime conclusions
* no speculative fixes

This was the first full day operating under the new certification-first workflow.

---

# Investigation 1

## Restore Engineering Discipline

### Objective

Before touching Parent Compete again, restore deterministic engineering workflow.

Previous investigations had begun by reconstructing context from memory.

That process officially ended.

---

### Actions

Validated repository state.

Verified:

```text
git status

git log

branch

HEAD

working tree
```

Confirmed:

Branch

```text
rollback-pre-lineage-regression
```

HEAD

```text
a90f3c8
```

Working tree

Initially clean.

---

### Result

Certified startup workflow.

Every future investigation now begins with:

```text
git status

↓

git log

↓

Certification Register

↓

Developer Handoff

↓

Active Investigation
```

---

# Investigation 2

## Identify Runtime Owner

### Original assumption

CompetitionTab was repeatedly suspected to own the bug.

This assumption was intentionally challenged.

Question:

> Which subsystem actually owns repeated runtime activity?

---

### Repository Audit

Mapped all major runtime subscriptions.

Investigated:

```text
subscribeCompetition()

subscribeCoachSyncHydration()

subscribeActiveAthleteChanges()

refreshParentWriterSessionSnapshot()
```

Objective:

Identify every runtime publisher capable of recreating Compete while focused.

---

### Result

Search space reduced.

Ownership moved upstream.

CompetitionTab increasingly appeared to be a consumer rather than the owner.

---

# Investigation 3

## Publisher Convergence Audit

Objective:

Determine whether Parent runtime publication converges.

Repository corridor audited:

```text
refreshParentWriterSessionSnapshot()

↓

coachSyncFetchSession()

↓

setCachedWeeklyForLinkToken()

↓

bumpCoachSyncHydrationVersion()
```

---

### Major Repository Finding

Current publication behavior is **not idempotent**.

Current repository behavior:

```text
same payload

↓

publish

↓

hydrationVersion++
```

No equality gate currently exists before publication.

Publication is driven by:

presence of hydrated artifacts

not

change detection.

---

### Certification

Repository now certifies:

Current publication can repeatedly increment

```text
coachSyncHydrationVersion
```

even when runtime state appears unchanged.

---

# Investigation 4

## Runtime Dependency Investigation

Objective

Determine why logs never stabilize.

---

### Runtime Probe

Instrumented:

```text
FOCUS_ENTER

↓

FOCUS_CLEANUP
```

including:

* hydration version
* competition version
* athlete identity
* device role

---

### Runtime Finding

Observed:

```text
hydration

1

↓

2

↓

3

↓

4

↓

5
```

CompetitionVersion remained stable.

This immediately reduced the likely owner.

---

### Repository + Runtime Combined

Current chain became:

```text
Publication

↓

HydrationVersion++

↓

Focus callback recreated
```

This was the first time repository evidence and runtime evidence described the same behavior.

---

# Investigation 5

## Parent Runtime Bridge

Objective

Determine whether repeated publication actually affects Parent initialization.

---

Instrumentation

```text
FOCUS_ENTER

↓

REFRESH_BEGIN

↓

REFRESH_END

↓

CANCELLED_CHECK

↓

RETURN_BEFORE_LOAD_COMPETITIONS

↓

LOAD_COMPETITIONS_BEGIN

↓

LOAD_COMPETITIONS_END

↓

SET_ENTRIES
```

---

### Major Runtime Finding

Observed runtime:

```text
REFRESH_BEGIN

↓

REFRESH_END

↓

cancelled = true

↓

RETURN_BEFORE_LOAD_COMPETITIONS
```

No corresponding

```text
LOAD_COMPETITIONS_BEGIN
```

was observed during the failing cycles.

---

### Why this mattered

This was the first runtime evidence connecting:

publication

↓

cleanup

↓

cancelled

↓

Parent initialization starvation

This was no longer repository theory.

---

# Investigation 6

## Unexpected Double Focus

Runtime logs showed:

```text
FOCUS_ENTER

↓

FOCUS_ENTER

↓

REFRESH_BEGIN
```

This initially appeared suspicious.

---

### Repository Audit

Investigated:

React Navigation

useFocusEffect

useActiveAthlete

identity resolution

---

### Certified Finding

Two different focus re-entry mechanisms exist.

---

## Mechanism A

Bootstrap Re-entry

```text
athleteId = ""

↓

FOCUS_ENTER

↓

athlete resolves

↓

FOCUS_CLEANUP

↓

FOCUS_ENTER

↓

first REFRESH_BEGIN
```

Status

✅ Certified Expected Behavior

Owner

```text
useActiveAthlete
```

Not a bug.

---

## Mechanism B

Hydration Re-entry

```text
REFRESH_BEGIN

↓

publication

↓

hydrationVersion++

↓

cleanup

↓

cancelled

↓

RETURN_BEFORE_LOAD

↓

repeat
```

Status

⚠️ Active Runtime Investigation

Different owner.

Different lifecycle.

Different problem.

---

### Importance

This became one of the most valuable findings of the day.

Future engineers should never confuse bootstrap re-entry with hydration starvation.

---

# Investigation 7

## Runtime Comparison Framework

Objective

Compare:

Successful Parent startup

vs

Failed Parent startup

without changing production behavior.

---

Framework Created

Canonical startup ladder:

```text
Application Launch

↓

Device Role

↓

Athlete Resolution

↓

FOCUS_ENTER

↓

REFRESH_BEGIN

↓

REFRESH_END

↓

CANCELLED_CHECK

↓

LOAD_COMPETITIONS

↓

SET_ENTRIES

↓

Competition Render
```

This framework now exists for future runtime investigations.

---

# Investigation 8A

## First Publication vs Repeated Publication

Question

Does starvation begin:

on the first hydration publication

or

only after repeated publication?

---

### Result

Investigation closed as:

INCONCLUSIVE

Reason

Current runtime evidence was insufficient.

Required ordered Metro capture had not been preserved.

Engineering doctrine prevented guessing.

---

### Important Process Lesson

This was considered a success.

The team intentionally refused to invent conclusions unsupported by evidence.

Current status:

```text
Unknown

↓

Remain Unknown
```

This represents a major improvement in engineering discipline.

---

# Runtime Certifications

The following runtime behavior became certified during July 10.

---

## Bootstrap Focus Re-entry

Status

✅ Certified Expected Behavior

Repository

*

Runtime

agree.

Do not reopen.

---

## Parent Runtime Starvation Path

Status

Runtime Certified

Observed:

```text
REFRESH_END

↓

CANCELLED_CHECK

cancelled=true

↓

RETURN_BEFORE_LOAD_COMPETITIONS
```

Observed during failing Parent initialization.

---

## Non-idempotent Publication

Status

Repository Certified

Current repository permits repeated publication without payload equality.

---

# Eliminated Hypotheses

The following theories were eliminated.

---

RootLayout owns runtime loop.

❌ Eliminated

---

DeviceRoleProvider owns runtime loop.

❌ Eliminated

---

React Navigation remount causes Parent runtime failure.

❌ Eliminated

---

Bootstrap athlete resolution is the hydration bug.

❌ Eliminated

Bootstrap behavior is expected.

---

CompetitionVersion is the owner of repeated runtime activity.

❌ Eliminated

Observed runtime remained:

```text
competitionVersion = 0
```

while

```text
hydrationVersion
```

continued increasing.

---

CompetitionTab owns the bug.

❌ Ownership moved upstream.

Current owner:

```text
Parent Runtime Publication Corridor
```

---

# New Runtime Mental Model

This represents the single biggest engineering improvement from July 10.

Previous mental model:

```text
Competition

↓

Competition

↓

Competition
```

Current certified mental model:

```text
BOOTSTRAP

↓

Identity Resolution

↓

Expected Focus Re-entry

────────────────────────────

Parent Runtime

↓

Refresh

↓

Publication

↓

HydrationVersion++

↓

Focus Cleanup

↓

Cancelled

↓

RETURN_BEFORE_LOAD

↓

Parent Initialization Starvation
```

This model should guide every future investigation.

---

# Ownership Shift

The investigation officially moved ownership.

Morning assumption:

```text
CompetitionTab
```

End-of-day owner:

```text
Parent Runtime Publication Corridor

↓

Runtime Convergence
```

This ownership shift dramatically reduced the investigation search space.

---

# End of Part 2

This final section ties the investigation back into the new engineering operating system so tomorrow begins from a certified checkpoint rather than another reconstruction.

# PART 3 — Engineering Doctrine, Tomorrow Startup, Active Investigation, DOCOPS, Lessons Learned

---

# Current Engineering Status

At the close of July 10, the engineering state is intentionally **stable but incomplete**.

This is considered a successful stopping point.

Repository status:

```text
Branch

rollback-pre-lineage-regression

HEAD

a90f3c8

Working Tree

M app/(tabs)/compete.tsx
```

The repository intentionally contains only one modified engineering file.

Everything else has been documented and checkpointed.

This separation is now part of engineering doctrine.

---

# Current Active Investigation

Investigation ID

```text
INV8
```

Title

```text
Controlled Runtime Convergence Experiment
```

Current Owner

```text
Parent Runtime Publication Corridor
```

Current Question

> Does repeated Parent runtime publication directly prevent Parent Competition initialization from converging?

This is now the only active engineering question.

Do not reopen previously certified architecture.

---

# Investigation Status

The following investigations are complete.

| Investigation                 | Status                                                    |
| ----------------------------- | --------------------------------------------------------- |
| Architecture Certification    | ✅ Complete                                                |
| Protected Systems             | ✅ Complete                                                |
| Runtime Ownership             | ✅ Complete                                                |
| Publisher Audit               | ✅ Complete                                                |
| Dependency Investigation      | ✅ Complete                                                |
| Parent Runtime Bridge         | ✅ Complete                                                |
| Bootstrap Focus Re-entry      | ✅ Complete                                                |
| Runtime Comparison Framework  | ✅ Complete                                                |
| First vs Repeated Publication | ⚠️ Inconclusive (insufficient preserved runtime evidence) |

---

# Investigation NOT Yet Performed

The following work has **not** been executed.

Controlled Convergence Experiment.

This experiment has only been designed.

No production behavior has been changed.

No repository fix has been attempted.

This is intentional.

---

# Why the Experiment Exists

Current repository and runtime evidence support the following chain.

```text
Parent Refresh

↓

setCachedWeeklyForLinkToken()

↓

bumpCoachSyncHydrationVersion()

↓

Focus Cleanup

↓

cancelled = true

↓

RETURN_BEFORE_LOAD_COMPETITIONS

↓

Parent initialization starvation
```

The remaining engineering question is:

Does suppressing runtime publication allow Parent initialization to converge?

The experiment exists only to answer that question.

---

# Engineering Doctrine (Updated)

The July 10 investigation permanently changes how MatMind engineering should operate.

---

## Repository Before Runtime

Always begin by asking:

What does the repository certify?

Only after repository evidence exists should runtime investigation begin.

---

## Runtime Before Production

Repository evidence proves:

What the application **can** do.

Runtime evidence proves:

What the application **actually did**.

Production changes require both.

---

## Binary Investigations

Every investigation should answer exactly one question.

Avoid investigations with multiple hypotheses.

The investigation ends when uncertainty is removed.

Not when code changes.

---

## Protected Architecture

Certified systems are protected.

Do not reopen:

* Identity
* Overlay Merge
* Incident Capture
* Competition State Auditor
* Certified rendering boundaries

unless new runtime evidence requires it.

---

## Smallest Blast Radius

Repository modifications should:

* affect one owner
* affect one investigation
* remain easily reversible

Investigation code should remain isolated.

---

## Git Discipline

Every engineering session begins with:

```bash
git status -sb

git log --oneline --decorate -8

git diff --stat
```

Every checkpoint ends with:

```bash
git status -sb
```

No engineering session should end with unknown repository state.

---

# Python Documentation Workflow (DOCOPS)

July 10 also clarified the intended relationship between ChatGPT and Python.

The original design remains the correct design.

---

## ChatGPT Responsibilities

Engineering reasoning.

Investigation.

Certification.

Writing.

Organization.

Timeline.

Decision making.

---

## Python Responsibilities

Deterministic document generation.

Formatting.

Updating repository documents.

Verification.

Writing generated artifacts.

No engineering reasoning should occur inside Python.

Python is the writer.

Not the engineer.

---

## Future Workflow

Future EOD workflow should become:

```text
Engineering Complete

↓

ChatGPT produces structured engineering model

↓

Python writes repository documents

↓

Founder reviews diff

↓

git status

↓

git diff

↓

Commit
```

This work remains partially complete.

The certification writer exists.

The Engineering Checkpoint writer exists:

scripts/write_engineering_checkpoint.py

→ docs/engineering-checkpoint.md

MatMind documentation closes follow the ODS documentation workflow order (adapted paths/scripts only).

---

# Tomorrow Morning Startup

The July 11 startup should follow this order exactly.

---

## Step 1

Repository verification.

```bash
git status -sb

git log --oneline --decorate -8

git diff --stat
```

Expected working tree:

```text
M app/(tabs)/compete.tsx
```

Nothing else.

---

## Step 2

Read:

```text
CertifiedArchitectureRegister-v1.md

↓

Developer Handoff

↓

Active Investigation Register
```

Do not reconstruct engineering context from previous conversations.

---

## Step 3

Resume only the active investigation.

Do not reopen completed investigations.

---

## Step 4

Determine whether the Controlled Convergence Experiment should be executed.

No production fixes before the experiment.

---

# Lessons Learned

The July 10 investigation produced several engineering lessons.

---

## Lesson 1

Engineering memory is unreliable.

Repository certification is reliable.

---

## Lesson 2

Runtime observations without repository understanding produce broad debugging.

Repository understanding without runtime evidence produces incorrect certainty.

Both are required.

---

## Lesson 3

The investigation should move upstream until ownership becomes stable.

The investigation began at CompetitionTab.

It ended at the Parent Runtime Publication Corridor.

This represents significant reduction in search space.

---

## Lesson 4

Do not confuse expected runtime behavior with runtime failure.

Bootstrap focus re-entry and hydration re-entry are different systems.

Treating them as one bug delayed previous investigations.

---

## Lesson 5

Unknown is an acceptable engineering outcome.

Investigation 8A intentionally concluded:

"Inconclusive."

This prevented unsupported conclusions.

That is considered successful engineering.

---

## Lesson 6

Preserve runtime evidence.

Today's investigation exposed a process weakness.

Although repository evidence was preserved, the complete Metro runtime sequence was not archived before analysis.

Future runtime investigations should preserve complete Metro captures before interpretation.

Lost runtime evidence should never be reconstructed from memory.

---

# Current Mental Model

Future investigations should begin with this architecture.

```text
Expected Runtime

Application Launch

↓

Identity Resolution

↓

Bootstrap Focus Re-entry

↓

First Parent Refresh

──────────────────────────────

Active Investigation

Parent Refresh

↓

Publication Corridor

↓

HydrationVersion++

↓

Focus Cleanup

↓

Cancelled

↓

RETURN_BEFORE_LOAD_COMPETITIONS

↓

Parent Initialization

↓

Competition Render

↓

Match Breakdown
```

Everything above the divider is certified.

Everything below the divider remains the active investigation.

---

# July 10 Closing Assessment

July 10 represents a significant milestone in the Parent Competition investigation.

Although the original runtime issue remains unresolved, the engineering process itself has fundamentally improved.

The repository now contains:

* Certified Architecture
* Protected Systems
* Active Investigation Register
* Founder Velocity workflow
* Certification-first startup sequence
* Evidence-first runtime doctrine

The search space has been reduced from the entire Competition subsystem to a single runtime publication corridor.

The engineering team should **not** resume broad debugging.

The next session begins with one active investigation, one owner, and one binary question.

That is the intended operating model for MatMind engineering going forward.

---

# Canonical Restart Statement

> **Do not reconstruct yesterday. Begin from certified architecture. Verify the repository. Resume the active investigation. Remove exactly one uncertainty before changing production behavior.**

# DEV HANDOFF — 2026-07-07 → 2026-07-09
Executive Summary

This three-day block became one of the most significant engineering investigations undertaken on MatMind to date.

The original objective was straightforward:

Fix the Parent Match Breakdown hydration issue.

At the beginning of the investigation the application was functionally usable:

Coach application correctly displayed Match Breakdowns.
Parent application displayed competitions.
Parent Match Breakdown failed to hydrate consistently.

During the investigation we became increasingly convinced that the issue lived somewhere inside the Parent CompetitionCard hydration lifecycle.

Multiple runtime probes, certification tooling, and lifecycle instrumentation were introduced to isolate that problem.

Near the end of July 8, a new regression appeared:

Parent Compete stopped displaying competitions entirely.

This immediately became a higher priority than Match Breakdown because it represented a loss of core functionality.

No commit or Developer Handoff was completed before ending work that day.

As a result, July 9 became almost entirely dedicated to reconstructing the previous day's engineering work from Git history, repository evidence, timestamps, runtime logs, and conversation history.

The most important discovery from July 9 is that:

Rolling the repository back to a completely clean a904db4 working tree did NOT restore competitions.

That single observation invalidated our leading hypothesis that the July 8 uncommitted CompetitionCard work was solely responsible for the regression.

Current Repository State

Branch

rollback-pre-lineage-regression

HEAD

a904db4
Automate documentation maintenance and founder knowledge workflow

Working Tree

CLEAN

Stash Inventory

stash@{0}
WIP: Jul 9 regression investigation before recovery

stash@{1}
forensics-and-debug-traces

stash@{2}
post-918bc13-forensics

stash@{3}
wip-topology-and-traces

Important

All July 8–9 investigation work has been preserved inside stash@{0}.

Nothing has been lost.

Original Objective

Restore Parent Match Breakdown hydration.

Known behavior before regression:

Coach

↓

Match Breakdown present

↓

Parent

↓

Competitions visible

↓

Match Breakdown missing

The investigation was focused entirely on why Parent failed to hydrate coach annotations.

Major Engineering Work
1. Runtime Transition Certification

Primary objective:

Determine whether Parent CompetitionCard correctly reacted to:

coachSyncHydrationVersion

↓

hydrateOverlayAnnotations

↓

mergeCoachBreakdownIntoMatches

Multiple runtime probes were created.

The investigation certified:

hydration ordering
lifecycle transitions
merge boundaries
retained overlay state
runtime sequence

This represented the deepest certification work performed on the Parent overlay pipeline.

2. CompetitionCard Refactor

Engineering intent:

Split hydration responsibilities into explicit lifecycle paths.

Major production behavior introduced (uncommitted):

extracted hydrateOverlayAnnotations()
separated focus hydration
added reactive hydration
generation-based stale commit protection
runtime certification hooks

At the time these changes appeared to move us closer to solving Match Breakdown.

3. Unexpected Regression

During QA:

Coach:

MM-FIX-009-QA

confirmed healthy.

Parent:

Competitions disappeared.

This immediately shifted investigation priority.

July 9 Reconstruction

Because no checkpoint commit existed, we reconstructed the entire engineering narrative using:

Git history
Git diff
Git timestamps
Git reflog
repository audit
runtime evidence
conversation timeline

This reconstruction became the basis for understanding what had actually changed.

Major Certified Findings
Finding 1

CompetitionCard changes were the only significant production mutations introduced on July 8.

Confidence:

High

Finding 2

Most remaining repository modifications were instrumentation only.

Examples:

BUILD_CERT
runtime probes
MM-* tracing
certification tooling

Confidence:

High

Finding 3

Evidence from July 8 and July 9 had been unintentionally mixed.

Several contradictions disappeared once runtime observations were separated into independent sessions.

Confidence:

High

Finding 4

setEntries_apply { nextCount: 11 }

does not prove competitions should be visible.

It proves only that one runtime instance committed eleven entries.

Confidence:

High

Finding 5

VISIBLE_ENTRIES_STATE

was introduced after the regression began.

Therefore it cannot explain what originally happened on July 8.

Confidence:

High

Finding 6

Rolling back to a completely clean repository

HEAD = a904db4

working tree clean

did not restore competitions.

This is currently the single most important engineering observation.

Confidence:

Very High

Eliminated Hypotheses

The following are no longer considered leading explanations.

❌ CompetitionCard alone caused the regression

Rollback disproved this.

❌ Yesterday's uncommitted probes broke Parent Compete

Rollback disproved this.

❌ Repository corruption

Current repository is clean.

❌ Lost investigation work

Everything is preserved in stash@{0}.

Remaining Active Hypotheses

These remain open.

1. Runtime publisher never settles

Potential loop involving:

refreshParentWriterSessionSnapshot

↓

coachSyncHydrationVersion

↓

subscriber

↓

render

↓

refresh

Confidence:

Medium

2. Persisted runtime state

AsyncStorage or canonical stores may now contain state inconsistent with clean code.

Rollback does not change persisted data.

Confidence:

Medium

3. Regression predates July 8

The bug may already exist inside committed code.

The July 8 investigation may simply have exposed it.

Confidence:

Medium

Match Breakdown Investigation Status

Important:

The Match Breakdown investigation was not completed.

Current status:

Coach

↓

healthy

↓

Parent

↓

competitions unstable

↓

Match Breakdown investigation paused

Do not continue Match Breakdown until Parent Compete is deterministic again.

Biggest Lesson

The absence of an intermediate checkpoint created an expensive reconstruction effort.

The repository itself survived.

The engineering narrative did not.

Future debugging sessions should never reach multiple hours of investigation without preserving an intermediate checkpoint.

New Engineering Doctrine

From this point forward:

Every meaningful investigation stage should end with:

git status -sb

git diff --stat

git commit

If a commit is not appropriate:

git stash push -u

followed immediately by a short checkpoint note describing:

current hypothesis
latest runtime behavior
next experiment

This creates a recoverable engineering timeline without requiring a full EOD document.

Startup Checklist

Tomorrow morning:

Phase 1

Remain on clean repository.

Do not restore stash@{0}.

Phase 2

Verify current runtime behavior.

Determine whether Parent Compete still exhibits:

missing competitions
continuous runtime activity
refresh loop
Phase 3

Identify the first publisher that never settles.

Binary isolation only.

No new instrumentation until a publisher is isolated.

Phase 4

Once Parent Compete is deterministic again:

Resume the original Match Breakdown investigation.

Final Status
Repository

✅ Clean

Branch

✅ rollback-pre-lineage-regression

HEAD

✅ a904db4

Investigation

✅ Fully reconstructed

July 8 work

✅ Preserved in stash@{0}

Parent Compete

❌ Still unstable

Match Breakdown

⏸ Paused pending Parent runtime stabilization

I also want to record one strategic observation. Today changed the investigation in an important way: instead of chasing individual files, we shifted toward understanding the runtime as a system. The clean rollback not restoring behavior is the strongest evidence we've collected that the remaining problem is not explained solely by the July 8 source edits. That insight should shape the next debugging session and help avoid repeating the same investigation paths.

#Dates:** June 23–24, 2026

---

# Executive Summary

These two days established the new architectural floor for Competition Analysis, Coach Match Breakdown hydration, and forensic debugging.

The primary objective shifted from chasing Match Breakdown symptoms to building a deterministic, evidence-based forensic system capable of identifying the exact authority boundary where synchronization fails.

The result is a stable readiness-governed architecture, complete forensic instrumentation, and a validated DEV synchronization pipeline.

---

# Repository Floor

## Branch

```
rollback-pre-lineage-regression
```

## Current HEAD

```
49865c9
Establish readiness-governed competition analysis and forensic validation pipeline
```

## Tag

```
competition-analysis-readiness-floor-v1
```

## Remote

* Branch pushed
* Tag pushed

## Repository Status

Repository is clean.

Only intentionally untracked:

```
debug-logs/
timeline-builder/
```

No modified tracked files remain.

---

# Major Engineering Milestone #1

# Readiness Architecture Complete

Completed all readiness phases.

## Phase 1

Coach Breakdown parser evidence.

Added:

* parser classification
* athlete evidence
* field validation

Purpose:

Never infer authority from missing data.

---

## Phase 2

Readiness foundation.

Introduced:

```
PENDING
READY
EMPTY_READY
FAILED
```

Generation-aware resolution.

Readiness never mutates authority.

---

## Phase 3

Parent/Coach orchestration.

Implemented:

* generation allocation
* finalize lifecycle
* readiness persistence
* hydration coordination

No rendering behavior changed.

No analytics behavior changed.

---

## Phase 4

Incident Capture observability.

Hydration Snapshot now exports:

* readiness state
* generation
* timestamps
* hydration source
* authority confirmation
* artifact timestamps

---

## Phase 5

Parent hydration delegation.

Readiness coordinator now governs:

* Summary
* Parent Athletes
* Join
* Kid Detail
* This Week

Cache-only paths intentionally excluded.

---

## Phase 6

Analytics Eligibility Gate.

Introduced:

```
selectCompetitionAnalysisForAnalytics()
```

Eligibility:

READY
↓

projection

FAILED / PENDING
↓

last confirmed

Flag:

```
competitionAnalyticsEligibilityEnabled
```

Defaults OFF.

No production consumers migrated.

---

## Phase 7

Readiness validation.

Created comprehensive deterministic validation suite proving:

* READY
* EMPTY_READY
* FAILED
* PENDING

all resolve correctly.

---

## Phase 8

Eligibility Forensics.

Incident Bundles now export:

* current artifact timestamps
* readiness timestamps

making eligibility decisions fully reconstructable offline.

---

# Major Engineering Milestone #2

# Summary Pilot

Implemented new Summary selection architecture.

Added:

```
resolveCompetitionAnalyticsSelection()

useSummaryCompetitionFocusInput()
```

Capabilities:

* async selection
* cancellation
* generation suppression
* projection-aware input
* legacy fallback

Existing analytics algorithms remain untouched.

Everything remains behind:

```
EXPO_PUBLIC_COMPETITION_ANALYTICS_ELIGIBILITY
```

Default OFF.

---

# Major Engineering Milestone #3

# Authority Forensics

A complete authority investigation framework now exists.

Instrumentation added across:

Coach Save

↓

Overlay Store

↓

Artifact Builder

↓

Publish Scheduler

↓

HTTP PUT

↓

Worker PUT

↓

Worker KV

↓

Parent Parser

↓

Artifact Store

↓

Readiness Finalize

Purpose:

Identify the first failed authority boundary rather than debugging symptoms.

---

# Authority Boundary Playbook

Formal investigation workflow established.

Boundaries:

0. Route verification

1. Coach Save

2. Overlay Store

3. Artifact Builder

4. Publish Scheduler

5. HTTP PUT

6. Worker PUT

7. Worker KV

8. Worker GET

9. Parent Parser

10. Artifact Store

11. Readiness

12. Analytics Selection

13. Summary UI

Repository audit refined every boundary.

Important conclusions:

* Boundary 2 may fail while downstream stages still succeed.
* Boundary 8 absence is inconclusive.
* Boundary 11 READY does not guarantee projection.
* Boundary 13 should not be used for authority isolation.

Authority investigations should stop at Boundary 12.

---

# Major Engineering Milestone #4

# DEV Match Breakdown Validation

This became the most important runtime discovery.

Multiple successful reproductions performed.

Validated:

Coach Match 1

↓

Parent Match 1

Coach Match 2

↓

Parent Match 2

The Coach Match Breakdown synchronized successfully.

This proves:

Current DEV branch successfully performs end-to-end Match Breakdown hydration.

The current architecture is functioning correctly.

---

# Important Investigation Shift

At the beginning of this work the question was:

```
Why doesn't Match Breakdown work?
```

Current evidence changes the question to:

```
Why does TestFlight behave differently from DEV?
```

This is now the remaining investigation.

Current DEV branch is considered healthy.

---

# Logging Investigation

A major discovery was made.

Initially believed:

Authority instrumentation was failing.

Repository investigation proved:

Instrumentation exists and is functioning.

Problem:

Wrong capture transport.

React Native forensic traces:

```
MATCH_BREAKDOWN_AUTHORITY_TRACE
```

emit through:

```
console.log()
```

↓

Metro

NOT

macOS unified logging.

Future forensic investigations must capture:

* Coach Metro
* Parent Metro
* Wrangler Tail

Device logs alone are insufficient.

This becomes permanent debugging doctrine.

---

# Environment Investigation

A second investigation emerged.

Observed:

DEV Parent:

* multiple athletes
* historical local data

DEV Coach:

* single linked athlete
* archived invite
* ghost athlete behavior after relinking

Likely caused by differing local histories.

This is independent of Match Breakdown synchronization.

---

# New Strategic Initiative

## Environment Parity System

Promoted to future engineering priority.

Objective:

Move between:

DEV

↓

TestFlight

↓

Future production snapshots

without changing the investigation dataset.

Future capabilities:

* Export dataset
* Import dataset
* Dataset fingerprint
* Environment verification
* Investigation snapshot export

Snapshot should preserve:

* athletes
* competitions
* overlays
* topology
* readiness
* artifact sets
* weekly sessions
* metadata

This is expected to significantly reduce future debugging effort.

---

# Repository Health

Current architectural floor:

```
49865c9
```

Repository:

Clean.

Stable.

Ready for continued investigation.

---

# Current State

Current DEV branch:

Healthy.

Coach Match Breakdown:

Working.

Readiness architecture:

Complete.

Summary pilot:

Implemented.

Authority forensic framework:

Implemented.

Incident Capture:

Expanded.

Logging transport:

Understood.

Current evidence does NOT indicate an architectural synchronization failure on the development branch.

---

# Remaining Open Investigation

Outstanding question:

Why does the TestFlight environment diverge from the current DEV environment?

Areas to compare:

* dataset
* invite lineage
* topology
* cached storage
* migrations
* artifact generations
* readiness state

Do not modify architecture until environment differences are understood.

---

# Next Session Priorities

## Priority 1

Capture a complete "known-good" forensic bundle from the working DEV environment using:

* Coach Metro
* Parent Metro
* Wrangler Tail

This becomes the canonical baseline for future authority investigations.

---

## Priority 2

Perform a structured DEV vs TestFlight comparison.

Determine whether differences originate from:

* local dataset
* build
* migration history
* invite lineage
* topology
* readiness

---

## Priority 3

Design the Environment Parity System.

Do not implement yet.

Produce architecture and requirements first.

---

# Engineering Doctrine Going Forward

Every future synchronization investigation must follow this order:

1. Verify environment parity.
2. Capture evidence.
3. Identify the first failed authority boundary.
4. Fix only the proven failing boundary.
5. Reproduce.
6. Preserve a known-good forensic snapshot before making further architectural changes.

Evidence—not speculation—now governs MatMind debugging.




# EOD DOCUMENTS — 6/20/2026 → 6/22/2026

## MatMind / BJJ Tracker

## Incident Capture Investigation Period

## Status: Active Investigation / Forensics Doctrine Correction

---

# Executive Summary

This period was dominated by investigation of the **TestFlight Incident Bundle export crash**.

The final stabilization result was:

```text
Build 79:
await import("react-native")
→ terminated after load_deps_before_platform_react_native

Build 80:
require("react-native")
→ reached capture_complete and export_complete
```

The proven failure boundary was the React Native dependency binding inside:

```text
loadProductionDeps()
```

The known-good implementation keeps Incident Capture's lazy dependency-loading shape but binds React Native with:

```ts
const { Platform } =
  require("react-native") as typeof import("react-native");
```

This should remain localized to Incident Capture. It is a targeted compatibility result, not a general instruction to replace dynamic imports elsewhere.

The most important process outcome was not only localization of the crash.

The most important outcome was discovery that our forensic instrumentation had begun altering the execution path being measured.

Builds 69–77 progressively added persistence-boundary tracing inside:

```text
persistIncidentCaptureStage()
```

By Build 77, the special-case instrumentation path had grown substantially beyond the original production implementation.

Build 78 restored the original production-shaped execution path and immediately produced a different floor.

That result strongly suggests we had crossed into:

```text
observer effect territory
```

where instrumentation itself was influencing observed behavior.

This is now considered one of the most important engineering lessons of this investigation.

Build 79 then restored the React Native corridor to production-shaped dynamic import execution and still terminated at:

```text
load_deps_before_platform_react_native
```

Build 80 changed only the React Native binding mechanism from dynamic `import("react-native")` to local `require("react-native")`; export completed successfully. That is the first TestFlight proof that Incident Capture export itself is viable again.

---

# Primary Objective

Investigate TestFlight crash occurring during:

```text
Export Incident Bundle
```

while maintaining:

```text
Evidence First
No speculative fixes
No architecture mutations
Forensic localization only
```

---

# Governing Doctrine Reaffirmed

Throughout this period several important doctrine corrections emerged.

---

## 1. Evidence Before Theory

Repeated reminder:

```text
Observed floor
→ Gather evidence
→ Narrow corridor
→ Form theory
```

NOT:

```text
Observed floor
→ Assume root cause
→ Build fix
→ Hope
```

---

## 2. Production Shape Preservation

Major lesson learned.

Instrumentation must not substantially alter:

```text
control flow
storage behavior
native crossings
async sequencing
```

or the resulting data becomes less trustworthy.

This became the central finding of the period.

---

## 3. Forensics Must Be Measured

New realization:

We currently lack a formal system for evaluating whether forensic instrumentation itself has become a source of execution distortion.

Future forensic work must include:

```text
Instrumentation Cost
Execution Shape Impact
Storage Side Effects
Native Crossings Added
```

as first-class review criteria.

---

# Investigation Timeline

---

# Early Investigation State

At the start of this period the crash localization effort was focused around:

```text
load_deps_react_native_import_promise_created
```

within:

```text
loadProductionDeps()
```

inside:

```text
captureIncidentBundle.ts
```

Observed floors repeatedly pointed near:

```text
React Native import promise creation
```

leading to increasingly narrow localization.

---

# Build 69

Commit introduced:

```text
ddffb90
Localize incident stage persistence boundary
```

New markers added:

```text
load_deps_react_native_import_promise_created_persist_entered
load_deps_react_native_import_promise_created_before_storage_write
load_deps_react_native_import_promise_created_after_storage_write
load_deps_react_native_import_promise_created_before_return
```

Goal:

Determine whether failure occurred:

```text
before storage write
during storage write
after storage write
```

Important later realization:

These markers added additional AsyncStorage writes before and after the original target stage.

---

# Builds 70–77

Progressive forensic narrowing continued.

Major additions included:

---

## lastResolvedStorage

Introduced:

```ts
let lastResolvedStorage: StorageAdapter | null = null;
```

Purpose:

Reuse already-resolved storage adapter to emit markers before:

```text
getStorage()
```

---

## writeRawCaptureStage

Introduced helper:

```ts
writeRawCaptureStage(...)
```

Purpose:

Persist marker stages directly.

---

## activeGetStorageTraceCorrelationId

Introduced:

```ts
activeGetStorageTraceCorrelationId
```

Purpose:

Activate tracing within:

```text
getStorage()
```

itself.

---

## getStorage Internal Tracing

Markers added:

```text
entered_get_storage
before_async_storage_import
after_async_storage_import
before_storage_resolution
after_storage_resolution
before_return_storage
```

---

## Invocation Corridor Markers

Markers added around:

```text
before_get_storage_call
after_get_storage_call
```

---

## Gap Markers

Several builds added:

```text
gap_marker_1
gap_marker_2
gap_marker_3
```

at increasingly narrow locations.

---

## Source-Tied Markers

Gap markers later replaced with markers tied directly to specific source statements.

Goal:

Reduce ambiguity.

---

# Major Audit Phase

Multiple repository audits were conducted.

These audits became more valuable than additional instrumentation.

---

## Audit: writeRawCaptureStage

Confirmed:

```ts
writeRawCaptureStage()
→ JSON.stringify()
→ AsyncStorage.setItem()
```

Meaning:

Every marker added:

```text
another AsyncStorage write
```

to the same key.

---

## Audit: AsyncStorage Call Chain

Confirmed production path:

```text
persistIncidentCaptureStage
↓
AsyncStorage.setItem
↓
RCTAsyncStorage.multiSet
↓
RNCAsyncStorage
↓
iOS file-backed manifest storage
```

Important finding:

The incident debug record is small enough to remain:

```text
manifest-backed
```

rather than separate-file-backed.

---

## Audit: Concurrent Export Risk

Confirmed:

```text
Export button remains pressable
```

while exporting.

No guard:

```ts
if (isExportingIncidentBundle) return;
```

exists.

No disabled state exists.

Therefore:

```text
Concurrent exports are repo-supported.
```

---

## Audit: productionDepsPromise

Confirmed:

```ts
let productionDepsPromise: Promise | null
```

is:

```text
globally cached
never reset
```

Meaning:

A rejected promise can poison future exports until process restart.

Important finding but not yet proven as root cause.

---

# Major Realization

After several builds of instrumentation accumulation:

Observed floor became:

```text
load_deps_react_native_before_get_storage
```

This stage:

```text
did not exist in original production code
```

It existed only because of forensic instrumentation.

This triggered a large review.

---

# Repository History Reconstruction

Git archaeology was performed.

Important commits identified:

---

## ddffb90

```text
Localize incident stage persistence boundary
```

First introduction of:

```text
traceReactNativeImportPromiseCreated
```

and special-case persistence path.

---

## ad6d5e8

Introduced:

```text
lastResolvedStorage
writeRawCaptureStage
before_get_storage
```

---

## f4ece24

Introduced:

```text
activeGetStorageTraceCorrelationId
```

and:

```text
getStorage tracing
```

---

## Later commits

Added:

```text
gap markers
call corridor markers
source operation markers
```

---

# Critical Audit Conclusion

Current path had diverged significantly from original production behavior.

Original path:

```text
create record
↓
getStorage()
↓
storage.setItem(actual stage)
↓
return
```

Current path:

```text
many instrumentation writes
↓
special tracing
↓
global state mutation
↓
more instrumentation writes
↓
eventual actual stage write
```

Audit estimated:

```text
~23 writes before actual target write
```

in the forensic path.

Original production path:

```text
0 writes before actual target write
```

---

# Decision: Restore Production Shape

Decision reached:

Return to production-shaped persistence behavior.

Goal:

```text
Observe production reality
not instrumentation reality
```

---

# Build 78

Implemented narrow restoration.

Removed:

```text
traceReactNativeImportPromiseCreated
lastResolvedStorage
activeGetStorageTraceCorrelationId
writeRawCaptureStage
all persistence-boundary markers
all getStorage tracing
```

Kept:

```text
load_deps_react_native_import_promise_created
load_deps_react_native_after_import_promise_created_await_resumed
```

Validation:

```text
Typecheck passed
Targeted tests passed
```

---

# Build 78 Result

Most important result of the period.

Observed floor became:

```text
load_deps_react_native_after_microtask_yield
```

NOT:

```text
load_deps_react_native_before_get_storage
```

NOT:

```text
load_deps_react_native_import_promise_created
```

This means:

The localization floor moved backward immediately after removing instrumentation.

---

# Interpretation

Strong evidence of:

```text
Instrumentation-Induced Observer Effect
```

The forensic machinery itself was affecting:

```text
storage writes
execution ordering
native crossings
observed floors
```

Builds 69–77 were no longer observing purely production behavior.

This is now considered a major finding.

---

# Forensics Doctrine v2

Emerging doctrine:

Before adding instrumentation ask:

```text
How many additional native crossings?
How many additional AsyncStorage writes?
How many global mutations?
How many execution branches?
How much production-shape drift?
```

If the answer is large:

```text
Stop.
```

---

# Impact To Core App Architecture

No production architecture changes occurred.

Protected systems remain intact:

```text
Canonical Authority
Competition Overlay Architecture
Coach Breakdown Overlay System
Hydration Systems
ACK Systems
Athlete Isolation
Competition Authority Model
```

No changes made to:

```text
Competition topology
Hydration flows
Coach review overlays
Competition storage
Training authority
Cross-device sync
```

---

# Competition / Coach Breakdown Relevance

Important clarification reached:

Incident Capture investigation currently appears isolated from:

```text
Competition Hydration
Coach Match Breakdown Hydration
Competition Overlay Publishing
Canonical Competition Records
```

Current evidence does NOT connect:

```text
Incident Capture crash
```

to:

```text
Coach match breakdown hydration
Competition summary divergence
Cross-device competition sync
```

Those remain separate investigative tracks.

---

# Stabilization Result

Incident Capture export is now considered restored for TestFlight based on Build 80.

Build 79 proved the production-shaped dynamic import corridor still failed:

```text
load_deps_before_platform_react_native
→ await import("react-native")
→ termination
```

Build 80 proved the local CommonJS binding succeeds in the same boundary:

```text
load_deps_before_platform_react_native
→ require("react-native")
→ load_deps_after_platform_react_native
→ capture_complete
→ export_complete
```

Remaining open items are stabilization cleanup only:

```text
Keep require("react-native") localized to Incident Capture.
Keep production-shaped persistence.
Do not reintroduce RN-specific forensic promise choreography.
Use Incident Capture on real incidents before designing broader observability.
```

---

# Risks To Avoid

Do NOT:

```text
Reintroduce persistence-boundary tracing
Add multiple AsyncStorage writes
Add getStorage tracing
Add special persistence branches
Add instrumentation that changes production shape
```

Do NOT return to:

```text
Trial-and-error debugging
Speculative fixes
Architecture mutation
```

---

# Deliverables Produced

During this period:

* Extensive repo audits
* AsyncStorage call-chain audit
* productionDepsPromise audit
* Concurrent export audit
* Instrumentation history reconstruction
* Commit lineage reconstruction
* Persistence path restoration
* Forensics doctrine refinement
* Observer-effect discovery

---

# Recommended Starting Point (Next Session)

1. Treat Build 80 as the known-good Incident Capture export path.
2. Keep `require("react-native")` in `captureIncidentBundle.ts`.
3. Do not convert it back to dynamic `import("react-native")`.
4. Do not convert it to top-level static import unless a separate hardening review approves that timing change.
5. Use Incident Capture exports on real Parent / Coach incidents.
6. Continue protecting production execution shape during any future forensic work.

---

## Status At Close Of 6/22

```text
ACTIVE PHASE:
Incident Capture Stabilization

KNOWN-GOOD EXPORT PATH:
load_deps_before_platform_react_native
→ require("react-native")
→ load_deps_after_platform_react_native
→ capture_complete
→ export_complete

BIGGEST FINDING:
Dynamic import("react-native") failed in TestFlight Incident Capture;
localized require("react-native") succeeded.

NEXT DECISION:
Use Incident Capture on real TestFlight incidents;
avoid additional forensic instrumentation unless a new failure appears.
```



# EOD DEV HANDOFF — 6/18/2026

## Branch

```bash
rollback-pre-lineage-regression
```

## Latest Commit

```bash
7d22614 Add end-to-end overlay forensic trace instrumentation
```

## Git Status at Close

```bash
git push origin rollback-pre-lineage-regression

3f310f7..7d22614
rollback-pre-lineage-regression -> rollback-pre-lineage-regression
```

---

# PRIMARY OBJECTIVE

Continue investigation of:

```text
Coach Match Breakdown
Coach → Worker → Parent hydration
```

for canonical competition overlay architecture.

NO architecture mutations performed today.

Focus was:

```text
Evidence collection
Forensic instrumentation
Pipeline proof
```

NOT fixing behavior.

---

# MAJOR DISCOVERY #1

## Worker Snapshot Shows Divergence

Session token inspected:

```text
s:47dd1b8126ad0a0749b3b456deb1c218547c6d75c350727b
```

Worker snapshot:

```json
coachMatchBreakdownArtifacts
```

contained:

```text
Israel athlete:
19 artifacts

Luca athlete:
0 artifacts
```

Evidence:

```json
shared_ath_c1dcd2cdbe8eaad87807a0ac670943ec

artifacts: []
```

This was the first major signal that:

```text
Parent-visible Luca coach notes
may not be coming from current worker hydration
```

---

# MAJOR DISCOVERY #2

## Existing Parent Notes Are Potentially Stale

QA performed:

Coach side:

Changed existing Luca coach breakdowns.

Examples:

```text
24-0
```

changed to:

```text
TEST 6/18 1150pm
```

and

```text
test hydration 6/18 11:50
```

Coach app:

```text
Save successful
Hydration visible locally
```

Parent TestFlight:

```text
Still showed old values
```

Result:

Strong evidence that:

```text
Current Luca notes shown on Parent
are not proving active hydration.
```

They may be:

```text
Historical cache
Historical projection
Legacy locally materialized data
```

rather than live worker-fed hydration.

This is NOT yet proven.

But it is now a lead hypothesis.

---

# MAJOR DISCOVERY #3

## Historical Symptom Reappeared

New competition created.

Observed sequence:

```text
Parent creates competition
↓
Competition missing
↓
Hard close app
↓
Hard close app again
↓
Competition appears
↓
Only 1 match visible
↓
Coach breakdown edited
↓
2nd match appears
```

This is EXTREMELY IMPORTANT.

We have seen this exact family of symptoms before.

Historically:

```text
Topology incomplete
↓
Unrelated event occurs
↓
Missing matches appear
```

Examples previously observed:

```text
coach save
app restart
athlete switch
competition reopen
```

This symptom survives despite the topology stabilization work.

---

# CRITICAL QUESTION ASKED TODAY

Israel asked:

```text
Why do these recurring discoveries
not seem to exist in the handoff notes?
```

Answer:

Because many investigations were documented as:

```text
bug
theory
fix
```

rather than:

```text
observable system behavior
debugging signals
forensic methodology
```

We repeatedly found ourselves:

```text
Searching docs
Searching grep
Remembering history
```

instead of:

```text
Interrogating instrumentation
```

This led to a major shift in strategy.

---

# STRATEGIC DECISION

STOP CHASING INDIVIDUAL BUGS.

Start building:

```text
Competition Forensics Layer
```

The app has reached sufficient complexity that:

```text
Observability
>
Memory
```

---

# MAJOR DISCOVERY #4

## Missing Publish Entry Point Investigation

Today we proved:

Worker PUT path exists:

```text
coach-sync-worker/src/index.ts
```

and correctly stores:

```text
coachMatchBreakdownArtifacts
```

We also proved:

```text
schedulePublishCoachMatchBreakdownArtifacts
```

is only referenced by:

```text
coach competition edit flow
competition delete cleanup
```

Key discovery:

```text
Coach overlay publication is NOT globally wired everywhere.
```

Only specific save paths trigger publication.

---

# MAJOR DISCOVERY #5

## Found Real Overlay Save Pipeline

Cursor investigation located:

```text
app/(tabs)/coach/kid/[kidId]/competition/edit.tsx
```

Actual save sequence:

```text
Save
↓
upsertMatchBreakdownOverlay
↓
writeCoachMatchBreakdownOverlay
↓
schedulePublishCoachMatchBreakdownArtifacts
↓
buildCoachMatchBreakdownArtifacts
↓
coachSyncPutCoachMatchBreakdownArtifacts
↓
Worker PUT
```

This was a significant breakthrough.

Before this we were still hunting for the true publish entry point.

---

# FORENSIC TOOLING BUILT TODAY

Commit:

```bash
7d22614
Add end-to-end overlay forensic trace instrumentation
```

---

## New Trace System

```text
[OVERLAY_FORENSIC]
```

Added throughout:

```text
Local Overlay Write
Artifact Build
Publish Scheduling
HTTP Publish
Worker Store
Worker Read
```

---

## New Trace ID

Every coach save now generates:

```text
traceId
```

Example:

```text
abc123-1718718721234
```

Threaded through:

```text
Coach Save
↓
Overlay Store
↓
Artifact Build
↓
Publish
↓
HTTP
↓
Worker PUT
```

via:

```text
X-Overlay-Forensic-Trace-Id
```

header.

Purpose:

Stop guessing.

Track a single coach note end-to-end.

---

# WHY THIS MATTERS

For months we have debugged by:

```text
grep
logs
memory
theories
```

instead of:

```text
trace
evidence
localization
```

The new forensic chain allows us to prove:

```text
Coach
↓
Overlay Store
↓
Artifact Builder
↓
Publish
↓
Worker
```

without speculation.

---

# IMPORTANT LESSON LEARNED

Israel correctly challenged the process.

Observation:

```text
We keep remembering symptoms
instead of measuring them.
```

This led to the new debugging doctrine.

---

# NEW DEBUG DOCTRINE

Add to top of future handoffs.

```text
Never patch based on theory.

First prove:

1. Canonical truth
2. Hydration truth
3. Topology truth
4. Projection truth
5. Overlay truth
6. Render truth

If a layer cannot be observed:

BUILD OBSERVABILITY FIRST.

Do not modify architecture
until the failing layer is proven.
```

---

# WHAT WE NOW BELIEVE

Most likely current failure categories:

## Possibility A

```text
Coach
↓
Worker

publish failure
```

Worker never receives Luca artifacts.

---

## Possibility B

```text
Coach
↓
Worker

success

Worker
↓
Parent

hydration failure
```

Parent never materializes latest artifacts.

---

## Possibility C

```text
Topology hydration bug

masked by overlay-triggered refresh
```

because:

```text
Coach save
↓
Second match appears
```

should never happen architecturally.

---

# WHAT WE SHOULD NOT DO TOMORROW

Do NOT:

```text
Patch hydration
Patch topology
Patch overlays
Refactor architecture
Add new fallback paths
```

without forensic proof.

---

# STARTING POINT FOR 6/19

## Step 1

Use new forensic instrumentation.

Follow one Luca save.

Capture:

```text
overlay_write_complete
overlay_list_for_publish
artifact_build_input
artifact_build_output
publish_schedule_payload
publish_http_request
publish_http_success
worker_store_artifact_set
```

Goal:

Determine whether failure is:

```text
Coach → Worker
```

or

```text
Worker → Parent
```

---

## Step 2

Build Competition Forensics v1.

High ROI.

Not bug fixes.

Instrumentation.

Desired future command:

```text
dumpCompetitionSnapshot()
```

Output:

```text
Canonical
Hydration
Topology
Projection
Overlay
Render
```

with match counts at every layer.

---

## Step 3

Investigate historical symptom:

```text
Competition appears
↓
1 match
↓
Coach save
↓
2 matches
```

NOT as a bug.

As a:

```text
Forensic trace exercise
```

to identify which recompute path is being triggered.

---

# END OF DAY STATUS

Architecture remains stable.

No architecture mutations.

No new fallbacks.

No new topology mutations.

Major progress achieved in:

```text
observability
forensics
pipeline visibility
```

The biggest win of the day was realizing that future debugging must be evidence-driven and instrumentation-first rather than grep-driven and memory-driven.


# EOD DEV HANDOFF

## Dates: 2026-06-16 → 2026-06-17

### Branch

```txt
rollback-pre-lineage-regression
```

---

# EXECUTIVE SUMMARY

The competition platform remains on the strongest architectural floor it has ever had.

The following systems remain stable:

```txt
canonical authority
topology replay
overlay isolation
lineage ownership
competition persistence
hydration orchestration
coach local review storage
save lifecycle
navigation lifecycle
```

The active issue is now isolated to:

```txt
Coach Match Breakdown
Parent Hydration / Render Lane
```

This is no longer an architecture problem.

This is now a bounded transport + hydrate + attach investigation.

---

# MAJOR ACCOMPLISHMENTS

## 1. Replay-Safe Competition Topology Remains Stable

No evidence found of:

```txt
authority corruption
overlay corruption
lineage corruption
competition mutation corruption
```

Competition system continues operating as:

```txt
governed replay-safe distributed topology architecture
```

This remains a major milestone.

---

## 2. Coach Overlay Ownership Doctrine Confirmed

Ownership remains:

### Parent

Owns:

```txt
competition facts
results
matches
placements
scores
canonical competition record
```

### Coach

Owns:

```txt
analysis
match breakdown
transcript
coaching observations
overlay interpretation
```

This separation remains intact.

No regression observed.

---

## 3. Match Breakdown Persistence Stabilized

Prior work successfully stabilized:

```txt
save lifecycle
overlay lineage
attachment identity
bounded coach ownership
```

Evidence suggests:

Coach device is saving correctly.

Current suspicion is no longer:

```txt
save failure
```

Current suspicion is:

```txt
post-save transport / hydrate failure
```

---

## 4. Developer Operating Doctrine Upgraded

Master prompt updated with:

```txt
DEBUG DOCTRINE
```

Key additions:

```txt
facts before fixes
trace before mutation
prove failure layer first
repo truth > memory
protected systems locked
small blast radius
```

This should significantly reduce future drift.

---

# CURRENT ACTIVE ISSUE

## Symptom

Coach creates:

```txt
match breakdown
transcript
analysis
```

Coach side displays correctly.

Parent side does NOT consistently display breakdown content.

---

# CURRENT HYPOTHESIS

The breakdown is disappearing somewhere within:

```txt
coach publish
↓
worker persistence
↓
worker GET payload
↓
parent hydrate
↓
artifact normalization
↓
artifact store
↓
merge attachment
↓
parent render
```

The failure has NOT yet been proven.

Only bounded.

---

# FAILURE ZONES

## Candidate A

Worker persistence succeeds.

Worker GET response omits:

```txt
coachMatchBreakdownArtifacts
```

Result:

Parent never receives artifact.

---

## Candidate B

GET response contains artifact.

Hydrate layer strips artifact.

Result:

Artifact arrives.

Artifact never reaches store.

---

## Candidate C

Artifact reaches store.

Attachment logic fails.

Result:

Artifact exists.

Never attaches to match.

---

## Candidate D

Artifact attaches correctly.

Render layer hides it.

Result:

Data exists.

UI never shows it.

---

# IMPORTANT DISCIPLINE

DO NOT:

```txt
change authority
change topology
change replay
change lineage
change ownership
change hydration architecture
```

until exact failure layer is proven.

The system is healthy enough now that broad mutation would create more risk than value.

---

# NEXT RESTART PLAN

## PHASE 1

Begin with questions.

NO CODING.

NO CURSOR.

NO CODEX.

Gather evidence first.

---

# QUESTIONS TO ANSWER

## Question 1

When breakdown is saved:

```txt
Does coach still see it after:
- app restart?
- cold boot?
- athlete switch?
```

If yes:

```txt
local persistence works
```

---

## Question 2

Does worker actually receive artifact?

Need proof from:

```txt
publish payload
```

Questions:

```txt
Is coachMatchBreakdownArtifacts present?
How many artifacts?
Expected lineage keys?
```

---

## Question 3

Does worker persist artifact?

Need proof from:

```txt
worker storage
```

Questions:

```txt
Artifact count?
Artifact payload?
Stored lineage?
```

---

## Question 4

Does parent GET receive artifact?

Need proof from:

```txt
GET payload
```

Questions:

```txt
Artifact present?
Artifact count?
Artifact lineage?
```

---

## Question 5

Does hydrate normalize artifact?

Need proof from:

```txt
parent hydrate logs
```

Questions:

```txt
Artifact count before normalize?
Artifact count after normalize?
```

---

## Question 6

Does merge attach artifact?

Need proof from:

```txt
mergeCoachBreakdownIntoMatches
```

Questions:

```txt
Artifacts available?
Lineage match found?
Attachment success?
```

---

## Question 7

Does render receive breakdown?

Need proof from:

```txt
MatchCard
Competition Summary
Competition Detail
```

Questions:

```txt
Breakdown present in props?
Rendered?
Suppressed?
```

---

# FIRST RESTART OBJECTIVE

At next startup we should be able to answer:

```txt
What is the FIRST layer where the artifact disappears?
```

NOT:

```txt
How do we fix it?
```

That distinction is critical.

---

# SUCCESS CONDITION

By next session we should produce:

```txt
Coach Save
✓

Worker Persist
✓

Worker GET
✓

Parent Hydrate
✓

Store
✓

Merge
✓

Render
✗
```

or

```txt
Coach Save
✓

Worker Persist
✓

Worker GET
✗
```

or similar.

Once the first failing layer is proven, the actual fix should become small, surgical, and low-risk.

---

# MORNING RESTART REMINDER

```txt
FACTS BEFORE FIXES

Trace before mutation.

Identify the first failing layer.

Do not modify protected systems until evidence proves ownership.
```

That should be the opening frame for the next engineering session.


# 2026-06-08 → 2026-06-09

## Branch

```text
rollback-pre-lineage-regression
```

Latest key commits:

```text
3f310f7 Add topology publication and hydration proof instrumentation
1cc0ee4 Use Expo File directly for transcription multipart uploads
2238e4a Expose transcription runtime exceptions for release QA
7a41616 Replace transcription upload transport with Expo file upload pipeline
44eb493 Align topology arbitration semantics with aggregate synchronization
```

Repo status at close:

```text
working tree clean
```

---

# PRIMARY OBJECTIVE

Validate end-to-end competition review workflow:

```text
Parent Competition
↓
Coach Match Breakdown
↓
Voice Recording
↓
Transcription
↓
Coach Hydration
↓
Parent Hydration
```

while continuing topology publication investigation.

---

# MAJOR WIN #1

## Coach Transcription Pipeline — RESOLVED

### Original Symptoms

Coach recording produced:

```text
Could not transcribe.
Try again.
```

No useful diagnostics.

---

## Investigation Chain

### Phase 1

Runtime exception exposure added.

Discovered:

```text
Creating blobs from 'ArrayBuffer'
and 'ArrayBufferView'
are not supported
```

---

### Phase 2

Repo investigation traced failure to:

```ts
audioFile.slice(...)
```

inside:

```text
competitionMatchEditor.tsx
```

which internally became:

```text
File.slice()
↓
bytesSync()
↓
Uint8Array
↓
Blob(Uint8Array)
```

and failed on TestFlight.

---

### Phase 3

Transport repaired.

Removed:

```ts
audioFile.slice(...)
```

Removed manual Blob construction.

Moved to:

```ts
formData.append("file", audioFile)
```

using Expo File.

---

### Phase 4

Authentication failure exposed.

New runtime error:

```text
Incorrect API key provided:
sk-YOUR_OPENAI_KEY
```

---

### Root Cause

EAS Production environment contained:

```text
EXPO_PUBLIC_OPENAI_API_KEY=sk-YOUR_OPENAI_KEY
```

Placeholder value.

Not a real key.

---

### Resolution

Created real OpenAI key.

Updated:

```text
EXPO_PUBLIC_OPENAI_API_KEY
```

inside EAS Production environment.

Rebuilt TestFlight.

---

## Final Validation

Successfully verified:

```text
Record Audio
↓
Upload
↓
Whisper
↓
Transcript
↓
Save
↓
Coach Hydration
↓
Parent Hydration
```

Examples validated on device.

### Status

```text
RESOLVED
```

---

# MAJOR WIN #2

## Coach Breakdown Sync — VERIFIED

Verified:

```text
Coach Match Breakdown
↓
Competition Card
↓
Parent App
↓
Coach App
```

Hydrates correctly.

Voice → Transcript → Match Breakdown path operational.

---

# MAJOR WIN #3

## Competition Summary Parity

Validated:

Parent:

```text
15-5
```

Coach:

```text
15-5
```

Aggregate publication healthy.

### Status

```text
PASS
```

---

# TOPOLOGY INVESTIGATION

## Original Reproduction

Comp 9

Parent:

```text
2 matches
```

Coach:

```text
Competition appears
Record updates
Only Match 1 visible
```

Parent:

```text
Open competition
Press Save
(no meaningful edits)
```

Coach:

```text
Match 2 immediately appears
```

---

## Investigation Findings

Repo evidence disproved:

```text
Topology builder reading stale detail
before persistence completes
```

because:

```ts
await setCompetitionDetailForEntry(...)
```

completes before topology scheduling.

---

## Important Discovery

Topology publication is:

```text
fire-and-forget
```

Save flow does not wait for:

```text
Topology PUT success
```

---

## Worker Arbitration Mismatch

Coach store:

```text
Equal timestamp
Different payload
↓
ACCEPT
```

Worker:

```text
Equal timestamp
Different payload
↓
409 REJECT
```

Found in:

```text
coach-sync-worker/src/index.ts
```

This creates divergence between:

```text
Worker acceptance
Coach acceptance
```

---

## Instrumentation Added

Commit:

```text
3f310f7
```

Added:

### Parent

```text
[COMP_TOPOLOGY_TRACE]
```

* build_ok
* put_request_payload
* put_http_ok
* put_http_failed

---

### Worker

```text
[COMP_TOPOLOGY_TRACE]
```

* worker_request_received
* worker_store_ok
* worker_reject_stale
* worker_reject_equal_timestamp_conflict

---

### Coach

```text
[COACH_TOPOLOGY_TRACE]
```

* worker_get_topology
* coach_topology_store_write
* coach_topology_store_reject
* coach_compete_projection

---

# LATE-DAY QA RESULTS

## Comp 10

Hydrated correctly.

No intervention.

---

## Comp 11

Hydrated correctly.

Both matches visible.

Transcription successful.

Coach hydration successful.

Parent hydration successful.

---

## Comp 12+

Hydrated correctly.

Observation:

Sometimes user must:

```text
Navigate away
↓
Return to Compete
```

before newest data appears.

This now looks more like:

```text
Mounted screen refresh
Projection invalidation
Recompute timing
```

than:

```text
Data loss
```

---

# CURRENT SYSTEM HEALTH

## Competition

```text
GOOD
```

---

## Topology

```text
MOSTLY STABLE
```

Need more runtime evidence.

---

## Coach Review

```text
GOOD
```

---

## Parent ↔ Coach Sync

```text
GOOD
```

---

## Transcription

```text
GOOD
```

---

# PRODUCT STRATEGY DISCUSSION

## Future Coach Video Architecture

Decision direction:

Do NOT store coach video inside canonical competition records.

Avoid:

```text
Competition
└── Match
     └── Video
```

because it reintroduces authority complexity.

---

## Proposed Future Architecture

### Canonical Competition

Parent-owned facts:

```text
Results
Matches
Placement
Time
Submission
Opponent
```

---

### Coach Review Overlay

Coach-owned:

```text
Breakdowns
Transcripts
Observations
```

---

### Match Study Library

Future coach-owned domain:

```text
Video
Transcript
Tags
AI Findings
Recommendations
```

References competitions.

Does not live inside competitions.

---

## Future App Placement

No new tab.

Compete remains:

```text
What happened?
```

Coach becomes:

```text
What should we do next?
```

Future Coach tab evolves into:

```text
Weekly
Signals
Match Studies
Pattern Engine
Recommendations
```

---

# PREMIUM TIER VISION

## Coach Tags Moments

Coach watches video.

Adds structured tags:

Examples:

```text
Head Position Lost
Good Entry
Guard Retention Failure
Triangle Finish
```

with timestamps.

---

## AI Findings

AI summarizes:

```text
What happened
```

from tags + transcript.

---

## Pattern Engine

Across many matches:

```text
Recurring weaknesses
Recurring strengths
Recurring positions
Recurring mistakes
```

Example:

```text
Inside-control collapse
appears in 67% of losses.
```

---

## Opportunity Ranking

AI identifies:

```text
Highest-impact weakness
```

not simply most frequent weakness.

---

## Recommendation Engine

Outputs:

```text
Training focus
Drill priorities
Competition preparation
```

based on historical patterns.

---

# NEXT QA PHASE (2026-06-10)

## Real Athlete Stress Test

Keep existing athlete:

```text
Israel
```

intact.

Do NOT delete.

Acts as:

```text
Known-good baseline
```

---

Add:

```text
Luca
```

Real athlete.

---

Add:

```text
iOS
```

Real athlete.

---

Purpose:

```text
3-athlete stress test
```

Validate:

* athlete isolation
* competition hydration
* coach notes
* transcriptions
* summary parity
* fast switching
* close/reopen behavior

---

## QA Focus

### Athlete Isolation

Verify:

```text
Luca data
never appears under iOS

iOS data
never appears under Luca
```

---

### Fast Switching

```text
Israel
↓
Luca
↓
iOS
↓
Israel
```

Check:

* Summary
* Compete
* Coach notes

---

### Hard Close Validation

Parent:

```text
close
reopen
```

Coach:

```text
close
reopen
```

Verify:

* competitions
* summaries
* coach notes
* transcriptions

---

# END OF DAY STATUS

## Architecture Confidence

```text
HIGHER
```

## Transcription

```text
PASS
```

## Competition Review Workflow

```text
PASS
```

## Coach Hydration

```text
PASS
```

## Parent Hydration

```text
PASS
```

## Remaining Investigation

```text
Compete mounted-screen refresh behavior
and topology publication proof traces
```

No active evidence of data corruption.

System is in the strongest state observed since beginning the topology stabilization effort.



## Date Range: 2026-06-06 → 2026-06-07

## Branch

`rollback-pre-lineage-regression`

## Latest Stable Commit

```bash
10c6825 Stabilize canonical athlete retirement and overlay lineage cleanup
```

---

# PRIMARY OBJECTIVE OF THIS WORK CYCLE

Stabilize the complete canonical athlete lifecycle:

```txt
create
→ link
→ hydrate
→ sync
→ topology projection
→ overlay projection
→ delete
→ remote retirement
→ cold-start recovery
→ re-link
→ re-delete
```

WITHOUT:

* authority rewrites
* heuristic lineage recovery
* topology ownership mutations
* hydration hacks
* bootstrap suppression
* multi-owner regressions

This was a major repo-integrity stabilization pass.

---

# HIGH-LEVEL ARCHITECTURAL THEMES

## 1. Competition substrate divergence discovered

Critical finding:

Coach Summary and Coach Compete were reading from DIFFERENT competition substrates.

### Coach Compete

Used:

```txt
projectCompetitionCompeteView(...)
→ peekCoachCompetitionTopology(...)
```

This was already topology-driven and healthy.

### Coach Summary

Used:

```txt
useSignals(...)
→ overlayCompetitionAggregateSignals(...)
```

This depended on:

* aggregate overlays
* bounded aggregate visibility

Topology existed but was NOT used as a metric source.

Result:

* Coach Compete showed matches correctly
* Coach Summary metrics disappeared when aggregate artifacts were absent

---

# FIX — TOPOLOGY FALLBACK FOR SUMMARY

## Files

* `src/domain/competition/overlayCompetitionAggregateSignals.ts`
* `src/hooks/useSignals.ts`

## Behavior Added

Coach Summary now derives bounded metrics directly from hydrated topology IF aggregate artifacts are absent.

### Allowed metric subset only

* wins
* losses
* totalMatches
* winRate
* submissionRate
* fastestSubmission
* averageMatchTime
* winStyle

### Safety constraints

Fallback only runs when:

```txt
deviceRole === "coach"
topology exists
topology contains matches
aggregate artifact absent
```

### Explicitly NOT changed

* parent summary
* topology ownership
* hydration
* worker schema
* aggregate publishing
* authority
* overlays

## Result

Coach Summary metrics stabilized and survived:

* fast switching
* hard close/open
* topology replay

---

# ATHLETE DELETE FAILURE INVESTIGATION

This became the dominant stabilization effort of the cycle.

---

# INITIAL SYMPTOM

Deleting athletes:

* appeared to work
* switched active athlete
* coach app removed athlete
* BUT parent app resurrected athlete after cold start

This triggered a multi-stage forensic investigation.

---

# ROOT CAUSE #1 — WRONG ID TYPE DURING RETIREMENT

## Finding

Delete flow passed:

```txt
pa_*
```

Worker retirement required:

```txt
shared_ath_*
```

### Failure chain

Summary:

```ts
deleteAthlete(activeAthleteId)
```

Delete pipeline incorrectly assumed:

```txt
input id === canonical shared id
```

Remote retirement gate therefore failed:

```txt
retirementSharedAthleteId === null
```

DELETE request never fired.

---

# FIX — EXPLICIT CANONICAL RETIREMENT HANDOFF

## Files

* `src/storage/athleteStore.ts`
* `src/features/summary/SummaryScreen.tsx`

## Change

Delete flow now accepts:

```ts
deleteAthlete({
  athleteId,
  canonicalSharedAthleteId,
})
```

### Canonical resolution priority

1. already canonical `shared_ath_*`
2. `activeKidId -> kid.sharedAthleteId`
3. `summaryLinkedKidId -> kid.sharedAthleteId`
4. else null

### Logs added

```txt
[DELETE_CANONICAL_HANDOFF]
[CANONICAL_RETIREMENT_RESOLUTION]
[CANONICAL_RETIREMENT_SKIPPED]
```

## Result

Remote retirement finally executed correctly.

---

# ROOT CAUSE #2 — STALE OVERLAY ARTIFACT REPLAY

## Symptom

Deleted competitions:

* disappeared locally
* but stale overlay lineage rehydrated later

## Finding

Overlay artifact builder:

```txt
listCoachMatchBreakdownOverlaysForAthlete(...)
```

had:

* no prune path
* no delete-by-lineage
* no overlay retirement publish

Worker behavior was actually correct:
PUT overwrote full artifact set.

Problem:
smaller artifact set was never republished.

---

# FIX — OVERLAY RETIREMENT PROPAGATION

## Files

* `coachMatchBreakdownOverlayStore.ts`
* `buildCoachMatchBreakdownArtifacts.ts`
* `publishCoachMatchBreakdownArtifacts.ts`
* `parentKidCompetitionDelete.ts`

## Added

Exact prune semantics:

```txt
sharedAthleteId + sharedCompetitionId
```

Optional:

```txt
matchLineageKeys[]
```

No:

* name matching
* fuzzy scans
* authority rewrites

### Retirement sequence

1. prune local overlays
2. publish reduced artifact set
3. force fresh updatedAt
4. empty sets publish valid empty artifacts

## Result

Deleted competition overlays stopped replaying.

---

# ROOT CAUSE #3 — BOOTSTRAP ATHLETE RESURRECTION

This was the largest repo-level finding.

---

# Symptom

Athlete:

* deleted successfully
* disappeared
* coach linkage removed
* BUT resurrected after cold start

---

# Forensic Discovery

Bootstrap projection recreated deleted athletes.

## Resurrection source

```txt
ensureOperatingAthletesFromCoachLinkedKids(...)
```

inside:

```txt
buildAthleteAuthoritySnapshot(...)
```

### Recovery logic

If:

```txt
kid.sharedAthleteId exists
AND parent athlete missing
```

bootstrap recreated:

```ts
{
  id: sharedAthleteId,
  name: kid.name
}
```

and persisted it back into parent athletes.

---

# WHY DELETE LOST

Delete removed:

```txt
parentAthletes
```

BUT:

```txt
coachKidsById.sharedAthleteId
```

survived.

Bootstrap trusted linked kid lineage and rebuilt athlete.

---

# FIX — STALE LINEAGE RETIREMENT CLEANUP

## Files

* `src/storage/athleteStore.ts`
* `src/services/coachWeeklySyncApi.ts`

## Critical sequencing rule

Local linkage cleanup only occurs AFTER:

* remote delete success
  OR
* idempotent 404 success

### Exact cleanup behavior

```txt
kid.sharedAthleteId === canonicalSharedAthleteId
→ clearKidSharedAthleteLink(kidId)
```

### Explicitly NOT changed

* bootstrap semantics
* hydration
* reconcile
* topology
* authority

### Logs added

```txt
[CANONICAL_LINKAGE_RETIREMENT]
[BOOTSTRAP_RECOVERY_SOURCE]
```

---

# RESULT — MAJOR QA SUCCESS

Confirmed stable:

## Athlete lifecycle

* create
* link
* hydrate
* topology sync
* overlay sync
* delete
* remote retirement
* hard close/open
* cold start
* re-link
* re-delete

ALL PASSED.

Most important proof:

```txt
deleted athletes no longer resurrect after bootstrap
```

This is the most important stabilization achievement of the cycle.

---

# RUNTIME FORENSIC INSTRUMENTATION ADDED

## Files

* `src/hooks/useActiveAthlete.ts`
* `src/features/summary/SummaryScreen.tsx`

## Runtime logs

```txt
[ACTIVE_ROSTER_RUNTIME]
[ACTIVE_ATHLETE_RUNTIME]
[SUMMARY_SWITCHER_RUNTIME]
[SUMMARY_RENDER_RUNTIME]
```

Purpose:

* roster state tracing
* active athlete mutation tracing
* runtime resurrection tracing
* delete timing tracing

Instrumentation-heavy pass enabled full lifecycle isolation.

---

# FINAL QA RESULTS (END OF DAY)

## PASSED

### Coach Summary Metrics

* topology fallback working
* metrics survive reboot
* metrics survive athlete switching

### Competition Delete

* deletes propagate correctly
* overlays retire correctly
* stale overlays do not replay

### Athlete Delete

* canonical retirement works
* linkage cleanup works
* bootstrap resurrection fixed

### Re-Link QA

* re-link into retired lineage stable
* no duplicate authority
* no stale topology corruption

### Hard Close/Open QA

* no athlete resurrection
* no stale competition replay

---

# REMAINING SMALL ISSUE

## Stale "Existing child profiles" candidates

Deleted athletes still appear inside:

```txt
Link athletes
→ Existing child profiles
```

BUT:

* not active
* not bootstrapped
* not linked
* not hydrated
* not in summary
* not in coach roster

This is now believed to be:

```txt
stale local candidate projection
```

NOT:

* authority corruption
* bootstrap corruption
* topology replay

This is now a bounded UI/projection cleanup task.

---

# CURRENT STABLE STATE

## Branch

```bash
rollback-pre-lineage-regression
```

## HEAD

```bash
10c6825 Stabilize canonical athlete retirement and overlay lineage cleanup
```

## Working tree

Clean.

---

# IMPORTANT ARCHITECTURAL DECISIONS LOCKED

## DO NOT:

* reintroduce heuristic recovery
* name-match lineage
* roster-scan for canonical ids
* mutate bootstrap authority
* widen delete semantics
* add hydration hacks
* make coach authoritative

## KEEP:

* explicit canonical lineage
* exact id matching
* bounded retirement
* topology ownership separation
* overlay ownership separation

---

# TOMORROW’S PLAN (6/7)

## PRIMARY QA GOAL

Fresh coach app onboarding.

### Reason

Today validated:

```txt
dirty-state lifecycle resilience
```

Tomorrow validates:

```txt
clean-device bootstrap onboarding
```

---

# TOMORROW QA PLAN

## Phase 1

Preserve tonight’s stable repo checkpoint.

Run:

```bash
git status -sb
git log --oneline --decorate -5
```

---

# Phase 2 — Fresh Coach App

On Mac:

1. fully quit app
2. delete app/container
3. rebuild clean coach app
4. reconnect via onboarding flow

Goal:

* zero stale persistence
* fresh bootstrap
* first-install hydrate validation

---

# Phase 3 — Fresh Lifecycle QA

Validate:

* invite accept
* weekly hydrate
* training proof hydrate
* competition hydrate
* topology metrics
* summary metrics
* overlay hydrate
* hard close/open persistence

Then:

* delete athlete
* confirm no resurrection

---

# KEY STRATEGIC NOTE

This repo is no longer in:

```txt
chaotic authority collapse
```

It is now in:

```txt
bounded lifecycle stabilization + residual projection cleanup
```

That is a major engineering transition.

The repo integrity floor is substantially healthier tonight than at the start of this cycle.




## Date: 2026-06-02

## Branch: `rollback-pre-lineage-regression`

## Current Stable Tag:

* `coach-overlay-lifecycle-floor-v1`
* `coach-overlay-stability-floor-v1`

---

# HIGH LEVEL SUMMARY

Today was one of the most important stabilization days in the entire Competition Overlay migration effort.
Today was a major architectural stabilization day. You moved from “system integrity uncertainty” into “bounded feature-lane debugging,” which is a huge repo maturity shift.
We successfully moved the Coach Match Breakdown system from:

* unstable persistence
* ambiguous save lifecycle behavior
* lineage drift uncertainty
* navigation replay deadlocks

into:

* stable overlay persistence
* deterministic lineage
* stable save lifecycle
* stable hard-close replay
* bounded navigation topology compatibility

The platform is now operating from a much healthier architectural baseline.

The remaining major unresolved lane is:

```text
Coach MatchBreakdown hydration from Coach → Parent
```

Importantly:
this is now isolated as a bounded transport/hydrate lane issue, NOT a platform integrity issue.

---

# ACTIVE PHASE

```text
Phase 0 — local freeze race proof
```

Transitioning toward:

```text
Phase 1 — bounded parent overlay hydrate lane
```

---

# GOVERNING ARCHITECTURE PRINCIPLES

## Protected Systems

* canonical authority
* bounded overlay ownership
* topology hydration
* newest-wins sync semantics
* stable lineage
* replay determinism
* athlete isolation

## Explicit Non-Goals

We intentionally avoided:

* topology mutation
* fuzzy overlay attachment
* ordinal fallback matching
* multi-owner competition records
* overlay → canonical merge
* router timeout hacks
* artificial navigation delays

---

# MAJOR ARCHITECTURAL MILESTONES ACHIEVED TODAY

---

# 1. MATCH LINEAGE STABILIZATION FLOOR

## Problem

MatchBreakdowns were disappearing because transient local match IDs were being treated as canonical lineage identifiers.

Examples:

* `match-new-*`
* `match-init-*`
* `match-legacy-*`

This caused:

* overlay orphaning
* overlay mismatch
* lineage instability across reopen/rebuilds

## Root Cause

Linked competition persistence canonized editor-local transient IDs before topology publication.

## Solution

Introduced:

```text
src/domain/competition/stabilizeCompetitionMatchLineage.ts
```

Integrated into:

```text
CompetitionSync.ts
```

before:

```text
setCompetitionDetailForEntryId(...)
```

## Stable Precedence Rules

For linked competitions only:

1. preserve existing canonical lineage
2. reuse prior persisted slot lineage
3. generate deterministic fallback:

```text
match-lineage-{sharedCompetitionId}-slot-{ordinal}
```

## Result

Stable lineage now survives:

* save
* reopen
* tab switching
* hard close
* topology replay

---

# 2. OVERLAY PERSISTENCE RACE CONDITION FIX

## Problem

Only the last MatchBreakdown survived after save.

Example:

* Match 1 lost
* Match 2 lost
* Match 3 survived

## Root Cause

Overlay store used:

```text
readStore()
→ mutate map
→ writeStore(map)
```

while save path used:

```ts
Promise.all(matches.map(...))
```

This created classic lost-update races.

## Solution

Serialized overlay writes:

```ts
for (const match of matches) {
  await upsertMatchBreakdownOverlay(...)
}
```

## Result

Confirmed stable:

* multi-match persistence
* reopen replay
* hard-close replay
* cross-tab replay

This was a critical stabilization milestone.

---

# 3. SAVE LIFECYCLE FORENSICS + STABILIZATION

## Problem

Save button visually “misfired.”
UI appeared frozen even though persistence sometimes succeeded.

## Important Discovery

Persistence WAS succeeding.

The issue was:

```text
save-exit orchestration
```

NOT:

```text
save mutation integrity
```

This distinction was extremely important.

## Forensic System Added

```text
[SAVE_LIFECYCLE_TRACE]
```

Instrumented:

* save handler
* mutation begin/complete
* setSaving(false)
* syncTabAndExit
* blur/focus
* unmount lifecycle

## Major Discovery

The lifecycle stalled at:

```text
syncTabAndExit_enter
```

before:

```text
syncTabAndExit_before_navigation
```

Further tracing isolated failure to:

```text
call_normalize_lane_tabs_nav
```

with:

```text
laneStackKey: null
normalized: false
```

---

# 4. NAVIGATION TOPOLOGY COMPATIBILITY REPAIR

## Root Cause

`syncTabAndExit()` assumed a coach lane stack always existed.

In current topology:

* lane stack may legitimately not exist
* normalization silently no-op’d
* orchestration dead-ended before navigation dispatch

## Solution

Added bounded compatibility handling:

If:

```text
laneStackKey === null
```

then:

* emit lifecycle trace
* bypass normalization dead-end
* continue direct compete navigation dispatch

WITHOUT:

* fake stacks
* retries
* router hacks
* delays
* topology mutation

## Result

Save lifecycle is now stable.

Confirmed:

* save exits correctly
* compete focus works
* editor unmount works
* persistence survives replay

---

# 5. COACH OVERLAY LOCAL STABILITY FLOOR ACHIEVED

## Proven Stable

| System                    | Status |
| ------------------------- | ------ |
| overlay save              | ✅      |
| overlay persistence       | ✅      |
| multi-match save          | ✅      |
| lineage stability         | ✅      |
| tab replay                | ✅      |
| hard-close replay         | ✅      |
| save lifecycle            | ✅      |
| compete navigation replay | ✅      |
| topology compatibility    | ✅      |

This is now a legitimate RC stabilization floor.

---

# CURRENT REMAINING ISSUE

# Coach → Parent MatchBreakdown Hydration

## Current Behavior

### Coach App

* MatchBreakdowns save correctly
* Persist locally
* Survive reopen
* Survive hard-close

### Parent App

* canonical competition data hydrates correctly
* match results hydrate correctly
* overlays DO NOT appear

---

# IMPORTANT ARCHITECTURAL FINDING

This is NOT:

* overlay corruption
* topology corruption
* lineage corruption
* save corruption
* authority corruption

The remaining issue is isolated to:

```text
bounded overlay transport + hydrate
```

ONLY.

---

# CURRENT OVERLAY ARCHITECTURE

## Coach Side

Local overlay persistence:

```text
coachMatchBreakdownOverlayStore
```

Bounded artifact build:

```text
buildCoachMatchBreakdownArtifacts.ts
```

Publication:

```text
publishCoachMatchBreakdownArtifacts.ts
```

Worker endpoint:

```text
PUT /v1/sessions/:token/coach-match-breakdowns
```

---

# Parent Side

Hydration store:

```text
coachMatchBreakdownArtifactStore
```

Ephemeral merge:

```text
mergeCoachBreakdownIntoMatches.ts
```

Parent render:

```text
CompetitionCard.tsx
```

Importantly:
overlays are NOT merged into canonical competition ownership.

This remains architecturally correct.

---

# MOST IMPORTANT LEARNING

We now understand the system clearly:

## Parent-Owned

Canonical:

* competitions
* matches
* results
* placements
* topology
* aggregate metrics

## Coach-Owned

Bounded overlays:

* MatchBreakdowns
* commentary
* analysis

This separation is now functioning correctly locally.

The remaining work is ONLY:

```text
cross-device bounded overlay visibility
```

---

# GIT CHECKPOINTS CREATED

## Commit

```text
e49653b
Stabilize coach overlay save lifecycle and navigation replay
```

## Tags

```text
coach-overlay-stability-floor-v1
coach-overlay-lifecycle-floor-v1
```

These are now trusted rollback points.

---

# TOMORROW — HIGHEST ROI PRIORITIES

# PRIORITY 1 — COACH → PARENT OVERLAY HYDRATE

## Objective

Get MatchBreakdowns to hydrate from Coach app into Parent app.

## Investigation Focus

Trace:

```text
coach publish
→ worker persistence
→ session GET payload
→ parent hydrate
→ local artifact store
→ merge attach
→ parent render
```

## Most Likely Remaining Failure Zones

### Candidate A

Worker GET payload omits:

```text
coachMatchBreakdownArtifacts
```

### Candidate B

Hydrate normalization strips artifacts.

### Candidate C

Artifact store hydrates correctly,
but merge lineage matching fails.

---

# PRIORITY 2 — VERIFY EXACT LINEAGE MATCHING

Maintain strict:

```ts
match.id === matchLineageKey
```

DO NOT:

* loosen matching
* add ordinal fallback
* fuzzy attach
* slot guessing

This is critical to prevent reintroducing corruption.

---

# PRIORITY 3 — PARENT UI RENDER PASS

Once hydrate works:

* ensure MatchBreakdown renders in isolated card
* collapsed preview behavior
* “Read More”
* coach-only bounded presentation
* no canonical mutation

---

# KEY LESSONS LEARNED TODAY

## 1. Most “save failures” were NOT persistence failures

The system was saving correctly while lifecycle orchestration stalled.

This distinction changed the debugging strategy entirely.

---

## 2. Trace-first debugging prevented architectural damage

We solved:

* lineage instability
* overwrite races
* navigation deadlocks

WITHOUT reopening:

* authority
* topology
* hydration ownership

This was the correct discipline.

---

## 3. Stable lineage is foundational

Once lineage stabilized:

* overlays persisted deterministically
* replay became predictable
* QA became trustworthy

---

## 4. Bounded overlay ownership is working

Coach overlays are now properly isolated from canonical competition ownership.

This is a major architectural success.

---

# CURRENT REPO HEALTH

| Area                   | Status      |
| ---------------------- | ----------- |
| authority              | stable      |
| overlay persistence    | stable      |
| lineage                | stable      |
| replay                 | stable      |
| save lifecycle         | stable      |
| navigation replay      | stable      |
| topology compatibility | stable      |
| coach local UX         | stable      |
| parent overlay hydrate | active lane |

---

# RECOMMENDED MORNING START

1. Restart Metro clean
2. Validate coach overlay local persistence still healthy
3. Begin bounded parent hydrate investigation
4. Use trace-first approach again
5. DO NOT broaden architecture scope

We are now debugging a bounded transport lane, not stabilizing the entire platform anymore.




# Date: 2026-06-01

# Branch: rollback-pre-lineage-regression

---

# HIGH LEVEL STATUS

Today was the major convergence day for the competition architecture migration.

The repo crossed from:

```txt
synthetic mutable reconstruction architecture
```

into:

```txt
governed replay-safe distributed topology architecture
```

The biggest achievement:
we successfully completed the migration from:

* local synthetic competition authority
* mixed ownership mutation flows
* suppression-based Summary logic
* overlay mutation ambiguity

into:

* canonical topology truth
* topology-backed rendering
* overlay isolation
* canonicalized mutation orchestration
* replay-safe distributed projection

This is the healthiest architectural state the competition system has ever been in.

---

# ACTIVE PHASE

```txt
Phase 0 — local freeze race proof
```

Current operational objective:

```txt
prove save/close lifecycle collision
WITHOUT architecture mutation
```

This is VERY important.

We are no longer debugging:

* authority collapse
* topology poisoning
* replay corruption

We are now debugging:

* lifecycle timing
* projection invalidation
* overlay render attachment
* hydration convergence

That is a MASSIVE maturity improvement.

---

# GOVERNING DOCS

These remain source-of-truth architecture law:

```txt
docs/architecture/competition-overlay-architecture-v2.md
docs/architecture/competition-overlay-migration-plan.md
```

NO changes should violate these docs.

---

# PROTECTED SYSTEMS

DO NOT mutate or redesign these systems casually:

```txt
canonical authority
hydration
training proof
ACK systems
athlete isolation
```

These are now stabilized enough that random fixes could easily reintroduce old corruption patterns.

---

# MOST IMPORTANT ARCHITECTURE STATUS

## COMPLETE

### Canonical Topology Lane

Implemented:

* topology publication
* topology hydration
* topology-backed projection
* replay-safe overwrite semantics
* immutable lineage

### Overlay Lane

Implemented:

* lineage-keyed overlay persistence
* bounded annotation ownership
* overlay-only mutation doctrine
* replay-safe overlay attachment

### Canonical Editor Doctrine

Implemented:

```txt
read topology
write overlays
```

### Summary Canonicalization

Implemented:

```txt
canonical topology = structural truth
bounded aggregates = metric truth
```

### Mutation Canonicalization

Implemented:

* delete orchestration
* save orchestration
* removal of linked local-only mutation paths
* replay-safe delete semantics

---

# BIGGEST ENGINEERING ACHIEVEMENT TODAY

We successfully removed:

```txt
synthetic mutable topology truth
```

from:

* compete rendering
* editor flows
* Summary derivation
* mutation paths
* overlay attachment

This was the root systemic instability behind:

* duplicate competitions
* replay corruption
* hydration resurrection
* overlay drift
* cross-device mismatch
* metric suppression
* lineage collapse

The platform now fundamentally behaves differently.

---

# MAJOR ARCHITECTURE FLOORS CREATED TODAY

## topology-publication-floor-v1

Canonical topology transport floor.

## topology-projection-floor-v1

Topology-backed projection floor.

## overlay-persistence-floor-v1

Lineage-keyed overlay persistence floor.

## canonical-editor-floor-v1

Canonical-read / overlay-write editor floor.

## canonical-summary-floor-v1

Topology-aware Summary floor.

## canonical-platform-floor-v1

Full canonical distributed topology architecture floor.

These rollback points are EXTREMELY important.
DO NOT delete tags.

---

# MAJOR COMMITS TODAY

## Commit

```txt
39d1688
Add forensic navigation topology tracing
```

Purpose:

* forensic navigation topology tracing
* lane-stack debugging
* fail-closed topology inspection

---

## Commit

```txt
f46a628
Add parent canonical competition topology publication lane
```

Purpose:

* canonical topology publication
* worker overwrite semantics
* immutable lineage transport

---

## Commit

```txt
dbbdeff
Add ephemeral coach competition topology projection
```

Purpose:

* topology-backed coach rendering
* projection-only runtime composition
* replay-safe structural rendering

---

## Commit

```txt
187d160
Add lineage-keyed coach match breakdown overlay store
```

Purpose:

* overlay persistence isolation
* lineage-keyed annotation ownership
* replay-safe overlay storage

---

## Commit

```txt
85e4cbd
Canonicalize coach Summary aggregate projection
```

Purpose:

* remove synthetic suppression
* canonicalize Summary projection
* topology-aware aggregate rendering

---

## Commit

```txt
9d817da
Canonicalize linked competition mutation entry points
```

Purpose:

* remove local-only linked mutation paths
* replay-safe delete orchestration
* canonical mutation routing

This was one of the most important commits of the day.

---

# FORENSIC DISCOVERIES TODAY

## HUGE FINDING #1

Coach editor save was bypassing:

```txt
CompetitionSync
```

and writing directly to:

* updateKidCompetitionEntry
* createKidCompetitionEntry
* setCompetitionDetail

This created:

```txt
canonical reads
+
non-canonical writes
```

One of the most dangerous distributed systems states possible.

FIXED TODAY.

---

## HUGE FINDING #2

Linked competition delete paths were still using:

```txt
deleteKidCompetitionEntry
```

directly.

This caused:

```txt
local delete
+
hydration replay
=
competition resurrection
```

FIXED TODAY.

---

## HUGE FINDING #3

Summary suppression was still trusting:

```txt
synthetic local lineage assumptions
```

instead of:

```txt
canonical topology
+
bounded aggregates
```

FIXED TODAY.

---

# CURRENT OPERATIONAL QA STATUS

## COMPETITION SYSTEM

### GOOD

* canonical save persistence
* replay-safe delete
* topology hydration
* archive rendering
* match rendering
* podium rendering mostly healthy
* cross-device convergence significantly improved
* parent/coach Summary parity restored for competitions

### MODERATE

* podium gallery invalidation refresh timing
* editor lifecycle cleanup after save
* stale editor mount persistence

### OPEN

* coach overlay render attachment regression
* overlay pills missing
* match breakdown rendering missing

---

# COACH OVERLAY REGRESSION

This is currently the highest architectural regression remaining.

## Symptoms

* dictated notes save
* overlay store exists
* overlay persistence lane exists
* breakdown pills missing
* match analysis sections missing

Likely regression:

```txt
overlay hydrate/reconcile/merge/render chain disconnected
```

Most likely affected areas:

* mergeCoachBreakdownIntoMatches
* competitionReviewPillMetadata
* overlay hydrate pipeline
* projection attachment

IMPORTANT:
Do NOT solve this by mutating canonical topology.

Correct architecture:

```txt
parent owns facts
coach owns overlays
```

Overlays remain:

```txt
bounded lineage-keyed annotations
```

---

# TRAINING PROOF DIVERGENCE

Another important convergence issue discovered tonight.

## Parent App

Shows:

```txt
guard bottom
Butterfly to X-Guard
```

## Coach App

Shows:

```txt
top passing
Backstep Pass
```

This confirms:
coach Summary still prefers:

```txt
coach-local sessions
```

instead of:

```txt
parent published training proof
```

This EXACT issue existed historically and was previously documented.

Likely affected areas:

* useSignals
* trainingProofStore
* buildSummaryViewModel
* computeProgression
* computeCoachAlignment

IMPORTANT:
DO NOT sync full Session[] to coach.

Correct architecture:

```txt
Parent owns training truth
Coach consumes bounded proof
```

---

# PODIUM GALLERY INVALIDATION BUG

Observed behavior:

```txt
Comp 9 saved correctly
archive updated
gallery did NOT refresh
UNTIL another competition creation forced recompute
```

Interpretation:
This is likely:

```txt
derived projection invalidation timing
```

NOT:

```txt
competition persistence corruption
```

Likely:

* memo dependency
* stale selector
* projection cache invalidation

Data itself persisted correctly.

---

# SAVE/CLOSE LIFECYCLE COLLISION

Current active investigation.

Observed:

* save succeeds
* editor remains mounted
* bottom-tab navigation restores stale editor state
* competition exists correctly afterward

Interpretation:

```txt
post-save lifecycle cleanup incomplete
```

NOT:

```txt
canonical persistence failure
```

Likely affected:

* activeCompetitionId
* editingCompetitionId
* draft state cleanup
* post-save route reset

This is now UI lifecycle convergence, not architecture instability.

---

# CURRENT DIRTY FILES

These remain intentionally dirty tonight:

```txt
app/(tabs)/this-week/family-competition/edit.tsx
app/(tabs)/this-week/kid/[kidId]/competition/edit.tsx
src/domain/competition/CompetitionSync.ts
src/domain/competition/publishParentCompetitionAggregate.ts
src/domain/competition/publishParentCompetitionTopology.ts
src/family/parentKidCompetitionDelete.ts
src/storage/coachKidStore.ts
src/storage/coachMatchBreakdownOverlayStore.ts
src/storage/coachSyncHydrationStore.ts
src/storage/competitionStore.ts
src/storage/kidCompetitionStore.ts
src/dev/competitionMutationDevLog.ts
```

These are primarily:

```txt
forensic instrumentation
+
observability scaffolding
```

NOT:

* hidden authority rewrites
* topology corruption
* replay mutation

Keep instrumentation through convergence QA.

Do NOT mass-delete tomorrow morning.

---

# IMPORTANT QA REALIZATION

The repo is NO LONGER in:

```txt
architecture crisis mode
```

We are now in:

```txt
convergence + projection alignment mode
```

That is a MASSIVE milestone.

The remaining issues are:

* overlay rendering
* proof precedence
* invalidation timing
* lifecycle cleanup

NOT:

* topology collapse
* authority poisoning
* replay corruption

---

# MORNING TODO LIST — 2026-06-02

## PRIORITY 1

Restore coach overlay render pipeline.

Trace:

```txt
publish
→ hydrate
→ reconcile
→ merge
→ projection
→ render
→ pill metadata
```

Determine EXACTLY where overlays disappear.

DO NOT mutate canonical facts.

---

## PRIORITY 2

Fix training proof precedence.

Coach Summary must prefer:

```txt
parent proof lane
```

NOT:

```txt
coach-local sessions
```

---

## PRIORITY 3

Fix editor lifecycle cleanup.

Expected:

```txt
save
→ refresh
→ exit editor
→ stable compete root
```

---

## PRIORITY 4

Fix podium gallery invalidation refresh timing.

Likely:

```txt
memo/cache dependency invalidation
```

NOT persistence corruption.

---

## PRIORITY 5

Continue convergence QA:

* replay
* reconnect
* reorder
* hard close
* athlete switching
* overlay persistence
* delete convergence

---

# FINAL ENGINEERING ASSESSMENT

Today was one of the biggest architecture stabilization days in the history of the repo.

We successfully transformed the competition system from:

```txt
synthetic mutable reconstruction architecture
```

into:

```txt
governed replay-safe distributed topology architecture
```

with:

* immutable lineage
* canonical topology
* topology-backed rendering
* topology-aware Summary
* replay-safe overlays
* canonicalized mutation orchestration
* deterministic overwrite semantics
* rollback-safe migration
* bounded overlay doctrine
* future AI-safe structural truth

This is now genuinely principal-level systems/platform engineering.

The repo is finally behaving like:

```txt
one governed distributed truth system
```

instead of:

```txt
multiple competing mutable ownership planes
```


# DATE: 2026-05-29

# PHASE: Runtime Recovery + Overlay Architecture Reassessment

==================================================
DAY SUMMARY
===========

Today became a major operational correction and architectural reality-check day.

The repo temporarily drifted back into the same failure pattern previously seen during:

* Build 34 experimental layering
* authority overreach
* distributed instrumentation expansion
* patch-storm debugging

The most important outcome of the day:

THE CORE SYSTEM WAS NOT ACTUALLY CORRUPTED.

Instead:
a local runtime/navigation/modal lifecycle freeze was repeatedly misclassified as distributed sync corruption.

That distinction matters enormously going forward.

By EOD:

* repo returned to clean rollback floor
* dictation functionality recovered
* distributed sync floor restored
* canonical authority remained intact
* no evidence of catastrophic GAAL collapse
* no evidence of athlete authority corruption
* no evidence of training-proof corruption
* no evidence of weekly sync corruption

The runtime freeze still exists after save/close on competition edit flows,
BUT the system is back on a stable operational floor.

==================================================
CRITICAL EVENT OF THE DAY
=========================

We drifted into old debugging behavior again.

Specifically:

* widening scope too early
* adding instrumentation before proving the problem layer
* assuming authority corruption before runtime proof existed
* patching speculative systems instead of validating repo/runtime truth

This recreated the exact dangerous conditions from previous collapse cycles.

The repo began drifting toward:

* overlay lineage experimentation
* authority instrumentation expansion
* competition topology tracing
* hydration speculation
* distributed-state theories

Result:
dictation broke again.

This was a MAJOR WARNING SIGN.

==================================================
MOST IMPORTANT LESSON RECONFIRMED
=================================

DO NOT TOUCH PROTECTED SYSTEMS
UNLESS RUNTIME PROOF DEMANDS IT.

Protected systems include:

* athlete authority
* weekly sync
* training proof
* hydration orchestration
* overlay stores
* lineage reconciliation
* distributed persistence

Today proved again:

A LOCAL MODAL/NAVIGATION FREEZE
can LOOK like distributed corruption
if debugging discipline collapses.

==================================================
WHAT ACTUALLY RECOVERED THE SYSTEM
==================================

Recovery came from:

1. STOPPING PATCH EXPANSION
2. RESTORING REPO TRUTH
3. HARD RESETTING TO CLEAN FLOOR
4. REMOVING SPECULATIVE TRACE FILES
5. RETURNING TO LAST KNOWN STABLE RUNTIME

Commands executed:

```bash
git restore .

rm -f docs/competition-runtime-phase-0-observations.md

rm -f src/domain/competition/compEditLifecycleDevTrace.ts

rm -f src/domain/competition/competitionNavigationLifecycleTrace.ts

rm -f src/domain/competition/competitionTopologyRuntimeTrace.ts
```

Result:

* repo clean
* dictation restored
* coach app functional again
* runtime floor stabilized

==================================================
IMPORTANT DISCOVERY
===================

The current bug pattern strongly indicates:

LOCAL NAVIGATION / MODAL LIFECYCLE COLLISION

NOT:

* distributed sync corruption
* athlete authority corruption
* weekly corruption
* overlay corruption
* worker corruption

Evidence:

PASS:

* dictation begins correctly
* transcription completes
* coach overlay editing works
* saves initiate correctly
* authority survives
* athlete switching survives
* sync remains intact

FAIL:

* app freezes AFTER save/close
* compete tab destabilizes until hard close
* modal lifecycle appears stuck
* navigation recovery requires relaunch

This matches historical observations from:
Build 34 regression analysis.

==================================================
MOST IMPORTANT STRATEGIC INSIGHT
================================

WE KEEP MISCLASSIFYING THE BUG LAYER.

The actual issue class appears to be:

```txt
save → modal teardown → navigation transition collision
```

NOT:
distributed system instability.

This explains why:

* hard close recovers
* repo rollback recovers
* dictation recovers
* sync survives
* authority survives

==================================================
WHAT DID NOT WORK (BOTH ATTEMPTS)
=================================

The following approaches repeatedly pushed the repo back into instability
and MUST NOT become default workflow again.

---

1. AUTHORITY EXPANSION DURING RUNTIME INSTABILITY

---

Failed pattern:

* adding lineage tracing
* authority instrumentation
* topology runtime tracing
* hydration tracing
* overlay graph speculation

Why it failed:
The freeze was likely local runtime lifecycle behavior,
not distributed corruption.

Result:

* repo noise
* dictation regression
* protected system contamination
* debugging confusion

---

2. PATCH-STORM DEBUGGING

---

Failed pattern:

* multiple speculative Cursor patches
* broad file touch surface
* runtime assumptions without proof
* layering fixes before isolation

Why it failed:
The true bug layer was never isolated first.

Result:

* unstable runtime
* harder rollback reasoning
* accidental regressions

---

3. OVERLAY-LINEAGE EXPERIMENTATION INSIDE STABLE BRANCH

---

Failed pattern:

* trying to attach overlays through lineage-level experimentation
* runtime slot tracing
* topology tracing
* attachment experimentation directly on stable floor

Why it failed:
Overlay architecture boundaries were not yet isolated enough.

Result:

* regression risk expanded immediately

---

4. ASSUMING SAVE FREEZE = AUTHORITY FAILURE

---

Failed assumption:
save freeze implied:

* sync corruption
* overlay corruption
* athlete corruption

Evidence now suggests:
save freeze is likely:

* modal close race
* router transition issue
* stale mounted screen
* async teardown collision

==================================================
IMPORTANT PRODUCT / ARCHITECTURE DIRECTION
==========================================

Tomorrow must NOT begin with:

* more overlay layering
* more distributed tracing
* more authority expansion

Instead:

The overlay problem needs a NEW mental model.

==================================================
NEW THINKING DIRECTION — COACH OVERLAY SYSTEM
=============================================

Current realization:

Coach annotations are NOT canonical competition truth.

They are:
READ-ONLY ANALYSIS OVERLAYS
attached to parent-owned competition truth.

This means:
we should STOP thinking in terms of:

* ownership mutation
* lineage rewriting
* competition replacement
* distributed graph manipulation

And instead think in terms of:

```txt
stable parent truth
+
bounded coach overlay attachment
```

The likely future-safe architecture direction is:

PARENT OWNS:

* matches
* outcomes
* timestamps
* results
* placements
* competition structure

COACH OWNS:

* annotations
* tactical notes
* strategic observations
* breakdown overlays
* local/media review artifacts

Coach overlays should behave more like:

* annotations
* comments
* review layers

NOT:

* canonical competition rewrites

==================================================
TOMORROW'S PRIORITY
===================

PHASE 1:
ANALYZE ONLY

NO IMPLEMENTATION.

Audit ONLY:

* competition save flow
* modal teardown
* navigation transitions
* router.replace usage
* syncTabAndExit behavior
* save callbacks
* async teardown after dictation

Primary files to inspect:

* competitionMatchEditor.tsx
* syncTabAndExit.ts
* app/competition/[id].tsx
* competition/edit.tsx

Goal:
ISOLATE THE LOCAL LIFECYCLE COLLISION
WITHOUT TOUCHING PROTECTED SYSTEMS.

==================================================
NON-NEGOTIABLE RULES GOING FORWARD
==================================

1. Repo truth > assumptions
2. Runtime proof before architecture edits
3. Protected systems require evidence before modification
4. No patch storms
5. No broad instrumentation under fatigue
6. No speculative overlay expansion on stable branch
7. Local runtime issues must be isolated locally FIRST
8. Overlay architecture must remain bounded and additive

==================================================
CURRENT RECOVERY FLOOR
======================

Current known stable floor:

```txt
1ddc30f
Stabilize bounded athlete authority and cross-device sync
```

Branch:

```txt
rollback-pre-lineage-regression
```

Tags:

```txt
rc-authority-floor-v1
overlay-architecture-floor-v1
```

==================================================
END STATE
=========

The most important thing proven today:

THE SYSTEM DID NOT COLLAPSE.

The debugging process drifted.

That distinction protects the project going forward.

The correct next move is:
surgical runtime isolation,
NOT another distributed architecture spiral.



Authority Stabilization + Overlay Architecture Recovery
May 25 → May 28, 2026

Executive Summary
This stabilization arc resolved the largest systemic architecture problem in the current MatMind platform:
Multiple unstable owners of athlete state causing cross-athlete corruption, stale hydration replay, overlay contamination, and authority collapse.
The platform has now transitioned from:
* mutable multi-owner replay systems
to:
* canonical athlete authority
* bounded overlays
* deterministic hydration
* isolated projections
The resulting stabilization floor is now tagged:
rc-authority-floor-v1
This is currently the strongest known-good rollback floor in the repository.

Core Problem We Were Solving
The visible bugs were symptoms:
* wrong athlete appearing after restart
* “Create Athlete” flashes
* coach hydration loops
* stale overlays replaying
* ACK state crossing athletes
* training proof crossing athletes
* competition aggregates crossing athletes
* empty summaries after refresh
* ghost local coach athletes
* laggy coach app
* recursive sync storms
The actual root problem was:
ROOT CAUSE
The system had drifted into:
multiple mutable owners of athlete state
instead of:
single canonical authority + bounded overlays
This caused:
* replay corruption
* stale hydration restores
* lineage ambiguity
* cache overwrite races
* athlete contamination

MOST IMPORTANT ENGINEERING RULE ESTABLISHED
FACTS BEFORE TOUCHING REPO
This became the most important operational lesson of the stabilization cycle.
We repeatedly saw:
* speculative fixes
* assumption-driven patches
* touching core systems before evidence
* widening ownership accidentally
This caused further instability.
The correct workflow is now LOCKED:
1. Observe exact runtime behavior
2. Capture logs
3. Trace exact render/ownership chain
4. Identify exact failure point
5. Verify bounded insertion point
6. ONLY THEN modify code
NEVER:
guess → patch → regress
This rule must remain permanent for:
* authority systems
* overlays
* sync
* hydration
* lineage
* reconciliation
* future AI layers

Major Architecture Shift
OLD (Broken)
multiple mutable owners
        ↓
shared replay state
        ↓
cross-device overwrites
        ↓
cross-athlete contamination
NEW (Stabilized)
canonical authority
        ↓
bounded overlays
        ↓
projection-only consumers
        ↓
safe hydration
This is the foundational architecture now.

Major Systems Stabilized
1. Athlete Authority Stabilization (GAAL Recovery)
Symptoms
* wrong athlete restores
* empty roster on Summary
* coach hydration divergence
* stale OAI replay
* duplicate coach athletes
* athlete crossover
Root Cause
Authority snapshots were rebuilding from unstable hydration timing and recursive refresh loops.
Key Fixes
* canonical authority rebuild
* sole-operating-athlete repair
* stale snapshot suppression
* snapshot digest suppression
* coach hydration re-evaluation
* reactive cache-only refresh
* hydration gating until role resolved
* lineage-aware reconciliation
* loop suppression via:
    * skipCoachWriterSessionRefresh
    * handled-version dedupe
    * stale generation suppression
Outcome
Passed:
* hard switching
* cold restart
* multi-athlete restore
* coach reconnect
* roster rebuild
* Summary hydration

2. Weekly Overlay Recovery
Symptoms
* stale ACK surviving republish
* wrong weekly on coach
* ACK crossover
* viewed/acknowledged replay corruption
Root Cause
Weekly overlay semantics were behaving like mutable shared state instead of per-athlete overlays tied to publication generations.
Major Fixes
* weeklyByAthleteId
* parentFeedback
* publish invalidation semantics
* bounded overlay projection
* parent overlay publish lane
* deterministic ACK reset
* cache-only rehydration
* athlete-keyed overlay resolution
Outcome
Working:
publish
→ viewed
→ acknowledged
→ republish
→ viewed
→ acknowledged
with:
* no crossover
* no stale replay
* cold persistence stability

3. Training Proof Stabilization
Symptoms
* proof disappearing
* wrong dominant systems
* coach/local ambiguity
* proof crossover
Root Cause
Training proof ownership was unclear between coach-local and parent-derived state.
Key Decisions
Parent owns training proof. Coach consumes bounded aggregates only.
Final Model
Parent:
- raw sessions
- media
- journals

Coach:
- bounded proof overlay
  - counts
  - dominant systems
  - timestamps
Outcome
Multi-athlete proof isolation passed.

4. Competition Overlay Stabilization
Symptoms
* wrong aggregates
* stale match overlays
* coach breakdown corruption
* stat replay after restart
Root Cause
Competition overlays were attaching too broadly and not respecting lineage boundaries.
Key Fixes
* slot/ordinal attachment
* bounded overlays
* lineage-aware merge
* isolated competition aggregates
* projection-only overlays
Outcome
Competition:
* survived cold restart
* survived hard switching
* remained athlete isolated

5. Coach Dashboard ACK Projection
Important Discovery
The issue was NOT:
* sync
* hydration
* authority
* overlay persistence
The issue was:
coach dashboard never consumed ACK metadata
Critical Audit Result
ACK existed in:
resolvedWeeklyDoc.parentFeedback
But was intentionally stripped before Summary VM projection.
This was GOOD architecture.
Correct Fix
ACK was added:
useCoachInsights
→ CoachInsightRow
→ AthleteCard render layer
NOT:
computeCoachInsight
This preserved:
* performance intelligence purity
* overlay separation
* bounded projections
Result
Coach dashboard now correctly shows:
* Viewed
* Acknowledged
* Not viewed yet
per athlete.

Overlay Architecture Doctrine (Critical)
This is now codified in:
docs/overlay-architecture-v1.md
This is one of the most important files in the repository.
Core Principle
Canonical authority owns:
* athlete identity
* competitions
* results
* sessions
* roster membership
Overlays may ONLY:
* augment
* annotate
* project
They may NEVER:
* become owners
* mutate lineage
* mutate canonical records
* replay cross-athlete state

Current Architecture Status
System    Status
Athlete authority    RC-level strong
Weekly overlays    RC-level strong
ACK lifecycle    RC-level strong
Training proof    strong
Competition overlays    strong
Multi-athlete isolation    strong
Cross-device convergence    strong
Cold hydration    strong
Overlay architecture    fundamentally corrected
Remaining Risks
These are now the remaining realistic risks:
Risk    Severity
delayed async overwrite races    medium
offline reconnect ordering    medium
transient fetch failures    medium
large-scale roster stress    unknown
future ownership drift    HIGH if discipline breaks
IMPORTANT FUTURE DEVELOPMENT RULES
NEVER AGAIN:
* multiple mutable owners
* overlay-owned authority
* cross-athlete replay logic
* global mutable sync state
* speculative hydration writes
ALWAYS:
* canonical authority
* athlete-keyed overlays
* projection-only consumers
* deterministic invalidation
* evidence-first debugging

HOW THIS ENABLES MATCH BREAKDOWN ARCHITECTURE
This stabilization work directly unlocks the future coach MatchBreakdown system safely.

FUTURE MATCH BREAKDOWN ARCHITECTURE
Parent Owns (Canonical)
Parents remain the canonical owners of:
* competitions
* matches
* results
* placements
* timestamps
* medals
* media references
This means:
competition history remains parent authoritative
Coach NEVER owns:
* match existence
* result truth
* athlete timeline
This is CRITICAL.

Coach Owns (Overlay Only)
Coach owns:
* match breakdown notes
* tactical analysis
* dictation
* voice reflections
* local video review references
* coaching overlays
This means:
coach annotations are overlays
NOT competition ownership
Exactly the same stabilized pattern used successfully for:
* ACK overlays
* training proof overlays

SAFE FUTURE MATCH BREAKDOWN MODEL
Parent Canonical Layer
Competition
└── Matches
    ├── Result
    ├── Score
    ├── Placement
    └── Timeline
Coach Overlay Layer
MatchBreakdownOverlay
├── sharedAthleteId
├── competitionId
├── matchOrdinal
├── slotKey
├── tacticalNotes
├── dictatedReflection
├── localVideoRefs
├── voiceNoteRefs
└── coachMetadata
This is EXACTLY why:
* slot/ordinal attachment
* bounded overlays
* lineage-aware merge
* projection-only semantics
were so important this week.

WHY THIS IS NOW SAFE
Previously:
coach overlays risked becoming mutable competition owners
That would have recreated the exact authority collapse that caused the stabilization crisis.
NOW:
coach overlays are bounded augmentations only
This means:
* parent truth remains canonical
* coach commentary remains additive
* no overwrite wars
* no duplicate match owners
* no cross-athlete replay

FUTURE VOICE NOTE ARCHITECTURE
Voice notes should follow SAME overlay doctrine.
Coach Device
Stores:
* local recordings
* upload refs
* overlay metadata
Overlay Projection
Hydrates:
* transcript
* summary
* playback ref
But NEVER:
* owns competition truth
* mutates canonical results
* mutates athlete authority

MOST IMPORTANT LONG-TERM RULE
Features must attach TO authority
NOT compete WITH authority.
That single principle is what solved this stabilization crisis.

Current Protected Floors
Git Tag
rc-authority-floor-v1
Architecture Doc
docs/overlay-architecture-v1.md
Safe Branch
rollback-pre-lineage-regression
These should be treated as foundational recovery points.

FINAL STATUS
As of May 28, 2026:
The platform now appears to have:
* deterministic athlete authority
* bounded overlay systems
* stable multi-athlete family behavior
* stable coach/parent synchronization
* stable hydration restore
* isolated overlay projections
This is the first time during the rebuild cycle that the architecture has behaved like a coherent platform instead of competing mutable state systems.
The next phase should be:
RC hardening + operational polish
NOT:
infrastructure rewrites

==================================================
FINAL REPO STATUS — END OF DAY
==============================

Repo status at close:

```bash
git status -sb
```

Output:

```txt
## rollback-pre-lineage-regression
 M docs/dev-handoff.md
```

Meaning:
ALL experimental runtime mutations were successfully removed before EOD.

No unstable lifecycle experiments remain in working tree.

==================================================
CONFIRMED CLEAN RUNTIME FLOOR
=============================

HEAD:

```txt
1ddc30f
Stabilize bounded athlete authority and cross-device sync
```

Branch:

```txt
rollback-pre-lineage-regression
```

Tag:

```txt
rc-authority-floor-v1
```

This is now the official recovery floor.

==================================================
FINAL VERIFIED RUNTIME STATE
============================

PASS:

* dictation restored
* weekly stable
* ACK stable
* Summary stable
* training stable
* athlete isolation stable
* parent/coach communication stable
* repo clean
* authority floor preserved

KNOWN ISSUE STILL PRESENT:

* competition save/close freeze after coach overlay save
* compete tab lifecycle destabilization until hard close

IMPORTANT:
This issue is now classified as:
LOCAL RUNTIME / MODAL / NAVIGATION LIFECYCLE

NOT:
distributed authority corruption.

==================================================
MOST IMPORTANT LESSON OF 5/29/26
================================

The repo itself was healthier than the debugging process.

The actual danger today was:
debugging drift,
NOT architecture collapse.

Future rule:

DO NOT ESCALATE BUG CLASSIFICATION
WITHOUT REPO EVIDENCE.





# MAY 19, 2026 — EOD DEV HANDOFF
# BUILD 33 RECOVERY + BUILD 34 REGRESSION ANALYSIS

==================================================
DAY SUMMARY
==================================================

Today became one of the most important architecture and release-engineering days of the project.

We:
- attempted BUILD 34 feature expansion
- introduced new distributed collaboration/media layers
- cut internal RC builds
- identified severe regressions
- proved rollback discipline
- isolated distributed state contamination
- restored Build 33 operational stability
- validated clean distributed multi-device sync again

The most important outcome:
the core architecture survived.

The regressions were NOT permanent repo corruption.
They were:
- experimental layering issues
- distributed state contamination
- persistence mismatch
- operational execution scope drift

By end of day:
BUILD 33 operational baseline was successfully restored and validated.

==================================================
MOST IMPORTANT LESSON OF THE DAY
==================================================

We are now operating a true distributed system.

This means:
- repo rollback alone is NOT enough
- local storage persists
- worker payloads persist
- invite lineage persists
- authority snapshots persist

A clean operational rollback now requires:
1. repo rollback
2. local storage cleanup
3. app container cleanup
4. fresh distributed graph validation

This was successfully proven today.

==================================================
BUILD 34 — WHAT WE ATTEMPTED
==================================================

Primary Build 34 goals:

1. Coach hydration refresh stabilization
2. Competition media mirror lane
3. Coach-local tactical media workflow
4. Weekly acknowledgment visibility
5. Compete tab lifecycle stabilization
6. Refresh UX refinement
7. Operational collaboration expansion

==================================================
BUILD 34 — MAJOR IMPLEMENTATIONS
==================================================

==================================================
1. COACH HYDRATION INVALIDATION SYSTEM
==================================================

Added:
- coachSyncHydrationStore
- hydration version bump orchestration
- useSignals invalidation reload
- useAthleteData invalidation reload
- refresh-driven recompute

Goal:
remove need for navigation-away to refresh coach overlays.

Status:
partially successful but introduced broader protected-system instability during later layering.

==================================================
2. WEEKLY SUMMARY SEMANTIC ALIGNMENT
==================================================

Major semantic correction:

Previous bug:
weekly surfaces incorrectly used:
sessions.length (full lineage)

Corrected to:
calendar-week scoped sessions only.

Affected:
- Summary
- Consistency
- Patterns
- Hero metrics
- Weekly session counts

This was GOOD architecture work and remained stable through rollback.

==================================================
3. PULL-TO-REFRESH SYSTEM
==================================================

Implemented:
- Summary refresh control
- soft refresh authority reload
- parent weekly refresh path
- coach authority refresh path

Goal:
manual operational refresh without navigation remount dependency.

Architecture:
correctly reused existing authority orchestration.

==================================================
4. WEEKLY ACKNOWLEDGMENT VISIBILITY
==================================================

Implemented:
- coach roster acknowledgment visibility
- parent-owned acknowledgment signal
- coach read-only visibility
- resolveWeeklyDoc support
- writer-session acknowledgment hydration

This aligned strongly with:
“coach-family alignment operating system” philosophy.

==================================================
5. COMPETITION MEDIA MIRROR (BUILD 34 EXPERIMENT)
==================================================

Attempted:
- parent canonical image mirror
- media manifest lane
- worker blob routes
- coach read-only media hydrate
- coach-local tactical video isolation

IMPORTANT:
coach-local review videos intentionally remained local-only.

This was architecturally correct in principle.

HOWEVER:
the implementation layering introduced regressions into protected systems.

==================================================
6. COMPETE TAB LIFECYCLE STABILIZATION
==================================================

Discovered:
coach competition edit path incorrectly opened parent editor lane.

Attempted fixes:
- coach-aware routing
- lifecycle guards
- save sequencing fixes
- modal lifecycle stabilization
- compete trace instrumentation

This area still remains partially unstable and is now isolated as:
LOCAL NAVIGATION / MODAL LIFECYCLE ISSUE

NOT:
authority corruption.

==================================================
CRITICAL FAILURE EVENT — BUILD 34
==================================================

Build 34 introduced regressions into protected operational systems:

Observed failures:
- coach weekly no longer appeared correctly in This Week
- coach athlete hydration disappeared
- Summary visibility failed
- Competition visibility failed
- stale athlete graphs emerged
- ghost athletes persisted
- lineage mismatches appeared

Important realization:
repo rollback alone did NOT restore stability.

Root issue:
distributed persistence contamination.

==================================================
ROOT CAUSE ANALYSIS
==================================================

Build 34 itself did NOT permanently corrupt Build 33 code.

The actual issue was:

1. Local persistent storage survived installs
2. macOS app containers survived uninstall
3. Worker payload shapes changed
4. Invite graphs changed
5. Old athlete lineage persisted
6. AsyncStorage survived reinstall

Result:
Build 33 app
+
Build 34 state
+
stale distributed persistence
=
operational corruption symptoms

==================================================
RECOVERY PROCESS
==================================================

Successful recovery steps:

1. Roll repo back to:
a065578
“Stabilize coach hydration refresh and align weekly summary semantics”

2. Preserve experimental branch:
build-34-experimental-media-lane

3. Remove orphaned experimental files
4. Delete app containers manually
5. Fresh Build 33 reinstall
6. Rebuild distributed graph from scratch

MOST IMPORTANT:
Deleting:
~/Library/Containers/MatMind*

was the critical recovery step.

==================================================
CLEAN GRAPH VALIDATION
==================================================

Fresh QA graph created:

Parent:
- Israel
- Luca O

Coach:
- clean invite link
- fresh linkage

Validation successful:

PASS:
- coach publish
- parent refresh
- This Week hydration
- Summary hydration
- training proof
- competition aggregate
- athlete switching
- cold reopen
- clean linkage
- no ghost athletes
- no stale lineage
- no cross-athlete bleed

The architecture recovered fully.

==================================================
CURRENT STABLE STATE
==================================================

BUILD 33 is now considered:
CURRENT OPERATIONAL BASELINE

Validated:
- distributed sync
- authority orchestration
- proof hydration
- bounded competition aggregates
- weekly routing
- clean reinstall recovery
- multi-athlete switching
- coach-parent alignment

==================================================
KNOWN OPEN ISSUES
==================================================

==================================================
1. COACH COMPETITION EDIT LIFECYCLE
==================================================

Still reproducible:

Coach:
Competition → Edit → Save/Close

can destabilize Compete tab until hard-close.

Current belief:
LOCAL NAVIGATION / MODAL STATE ISSUE

NOT:
distributed corruption.

==================================================
2. ACKNOWLEDGMENT SYSTEM
==================================================

“Got it” acknowledgment currently incomplete.

Desired future behavior:
- parent acknowledgment
- coach visibility
- roster awareness
- operational alignment signal

Architecture direction:
correct and low-risk.

==================================================
3. PROFILE EDIT PARITY
==================================================

Recognized skills editable during onboarding
BUT not exposed during profile edit flow.

Likely:
UI/schema parity gap
NOT data corruption.

==================================================
4. SEMANTIC DRIFT
==================================================

Minor differences observed between:
- recognized skills
- weekly focus
- coach summary semantics
- parent summary semantics

Needs future semantic alignment pass.

==================================================
NEW DEVELOPMENT PROCESS RULES
==================================================

TODAY’S BIGGEST PROCESS IMPROVEMENT:

We officially introduced:
AGENT EXECUTION MODES

==================================================
MODE 1 — ANALYZE ONLY
==================================================

Allowed:
- read
- grep
- inspect
- analyze
- propose

Forbidden:
- implementation
- commits
- deploys
- builds

Must explicitly state:
- DO NOT IMPLEMENT
- DO NOT MODIFY FILES
- DO NOT DEPLOY
- DO NOT BUILD

==================================================
MODE 2 — IMPLEMENT ONLY
==================================================

Allowed:
- isolated repo surgery
- constrained implementation

Forbidden:
- deploys
- builds
- pushes
- releases

Must explicitly state:
- DO NOT DEPLOY
- DO NOT CUT BUILDS
- DO NOT PUSH
- DO NOT RELEASE

==================================================
MODE 3 — EXECUTION MODE
==================================================

Allowed:
- deploy workers
- cut builds
- release QA
- operational rollout

Requires:
- explicit founder approval
- rollout scope
- rollback plan
- validation plan

IMPORTANT:
Today proved why these modes are necessary.

Cursor interpreted operational wording correctly and autonomously executed:
- worker deploy
- EAS build
- App Store submission

The issue was NOT malicious execution.
The issue was:
experimental blast radius exceeded protected-system safety.

==================================================
IMPORTANT STRATEGIC INSIGHT
==================================================

The architecture itself is now proving resilient.

Today validated:

- rollback recovery
- clean reinstall recovery
- distributed state recovery
- bounded ownership
- multi-device orchestration
- authority durability

The project is now evolving from:
“can sync survive?”
to:
“how do we safely layer collaboration?”

That is a major platform milestone.

==================================================
TOMORROW — HIGHEST ROI PRIORITIES
==================================================

1. Preserve Build 33 operational stability
2. Investigate compete edit lifecycle locally
3. Wire acknowledgment visibility cleanly
4. Improve semantic alignment
5. Reintroduce media mirror ONLY on isolated experimental branch
6. Maintain strict execution modes with Cursor
7. Protect operational branch integrity

==================================================
BRANCH STRUCTURE
==================================================

summary-rebuild-v2
=
stable operational branch

build-34-experimental-media-lane
=
future experimental collaboration/media work

DO NOT merge experimental collaboration work directly into stable operational branch again.

==================================================
END STATE
==================================================


==================================================
FINAL REPO STATUS
==================================================

Repository ended the day CLEAN.

Command run:

```bash
git status -sb
git log --oneline -8
git branch --show-current
npx tsc --noEmit
By EOD:
- Build 33 recovered successfully
- distributed sync validated
- clean graph validated
- rollback discipline proven
- architecture confidence restored
- operational branch stabilized

This was one of the most important engineering maturity days in the project so far.
===== CURRENT STATUS =====
## build-34-experimental-media-lane

===== RECENT COMMITS =====
a065578 (HEAD -> build-34-experimental-media-lane, origin/summary-rebuild-v2, summary-rebuild-v2) Stabilize coach hydration refresh and align weekly summary semantics
278b4a0 RC stabilization checkpoint after distributed sync QA
288e105 Mirror parent competition and training proof into coach summary
293c749 Sync bounded competition aggregates to coach summary
949cca3 Restore runtime-safe telemetry recovery stubs after cleanup
97911bb (backup-chaos-state-20260518) Stabilize athlete identity lineage and prevent duplicate shared athlete creation
19bf1de Stabilize athlete authority and coach bootstrap flows
ac41612 Unify competition operations under CompetitionSync

===== CURRENT BRANCH =====
build-34-experimental-media-lane

===== TYPESCRIPT CHECK =====
(no output / passed clean)



## 2026-05-17 → 2026-05-18-- DEV HANDOFF
## RC Stabilization + Distributed Sync Recovery Phase

---

# Executive Summary

This was one of the most important stabilization windows in the project so far.

The repo moved from:
- unstable distributed sync behavior
- fragmented ownership semantics
- stale coach-side data
- hydration inconsistencies
- dual-writer risks
- GAAL/authority instability

into:
- bounded parent-authority mirrors
- stable worker-backed sync transport
- coach-side intelligence overlays
- stable multi-athlete persistence
- real distributed-device synchronization
- production-like distributed QA validation

By end of 5/18:
- competition metrics successfully mirror to coach Summary
- training proof successfully mirrors to coach Summary
- competition events sync correctly across devices
- weekly updates sync correctly across devices
- athlete isolation survives rapid switching + cold relaunch
- no catastrophic GAAL regressions observed
- Build 30 successfully deployed through TestFlight

This is the first truly coherent multi-actor sync architecture the repo has had.

---

# RC Checkpoint + Build State

## Current Repo Recovery Anchor

Primary stabilization checkpoint:

```txt
278b4a0 — RC stabilization checkpoint after distributed sync QA
```

Key preceding sync architecture commits:

```txt
288e105 — Mirror parent competition and training proof into coach summary
293c749 — Sync bounded competition aggregates to coach summary
949cca3 — Restore runtime-safe telemetry recovery stubs after cleanup
97911bb — Stabilize athlete identity lineage and prevent duplicate shared athlete creation
```

Branch:

```txt
summary-rebuild-v2
```

Remote:

```txt
origin/summary-rebuild-v2
```

---

# TestFlight / Release Candidate State

## Current Build

```txt
Build 30
```

Build 30 successfully:
- built through EAS production profile
- submitted to TestFlight
- installed across distributed real-device environment

Validated devices:
- Parent iPhone
- Coach laptop/dev client
- Wife iPhone (fresh install)
- Multi-athlete distributed topology

---

# Build 30 Runtime Validation Results

## PASS
- Weekly sync
- Competition event sync
- Competition Summary metrics
- Training proof Summary metrics
- Cross-device persistence
- Worker-backed hydrate recovery
- Multi-athlete isolation
- Rapid athlete switching
- Hard-close persistence
- Cold-launch recovery
- Distributed parent → coach mirror flow

## Important Runtime Discovery

Current known issue:

```txt
foreground refresh orchestration is incomplete
```

Symptoms:
- newly published data sometimes requires:
  - hard close
  - reopen
  - rebuild/relaunch
to force hydrate refresh

Important:
this is NOT data corruption.

Underlying persistence + authority architecture appears stable.

Likely affected areas:
- focus-triggered refresh
- overlay invalidation
- pull-to-refresh orchestration
- writer-session refresh cadence
- foreground hydrate timing

This is now considered:

```txt
RC stabilization work
```

NOT:

```txt
architecture failure
```

---

# Core Architectural Breakthrough

The major conceptual breakthrough was finalizing the correct ownership philosophy:

| Data Plane | Canonical Owner | Coach Role |
|---|---|---|
| Weekly direction | Coach | Publisher |
| Competition truth | Parent / athlete | Read-only intelligence consumer |
| Training truth | Parent / athlete | Read-only intelligence consumer |
| Coach training tab | Coach local-only | Operational planning |
| Summary intelligence | Derived bounded mirrors | Consumption only |

This eliminated the prior “multiple owners of truth” failure mode.

The system now uses:
- bounded aggregate artifacts
- worker KV persistence
- coach hydrate stores
- overlay-only Summary consumption

Instead of:
- raw match sync
- raw session sync
- shared operational journals
- dual-writer state

This was the critical stabilization move.

---

# 5/17 — Competition Sync Recovery + Authority Stabilization

## Initial State

Beginning of 5/17:
- parent competition entries saved locally
- coach side received shell competition rows
- Summary metrics did NOT hydrate
- coach-side competition data diverged from parent truth
- stale local coach rows suppressed remote aggregate overlays
- runtime debugging became polluted with speculative theories instead of logs

Additional symptoms:
- coach editing competition created local shadow state
- match results diverged from parent
- Summary followed coach-local state instead of parent truth
- athlete duplication concerns emerged
- route replay / authority instrumentation partially removed during cleanup

---

# Major Realization

Critical discovery:
the competition aggregate worker route did NOT exist in deployed production worker.

Parent app correctly attempted:

```txt
PUT /v1/sessions/:token/competition-aggregate
```

but production worker returned:

```txt
404 Not found
```

This meant:
- architecture was mostly correct
- transport layer was missing
- hydrate never received aggregate
- overlays never applied

This was NOT:
- Firestore corruption
- Summary VM failure
- GAAL collapse
- athlete ownership corruption

This realization redirected the entire debugging effort.

---

# Competition Aggregate Architecture Built

## Parent Canonical Flow

Implemented bounded aggregate architecture:

```txt
Parent competitions
    ↓
buildCompetitionAggregateArtifact
    ↓
publishParentCompetitionAggregate
    ↓
coach-sync-worker KV
    ↓
coachCompetitionAggregateStore
    ↓
overlayCompetitionAggregateSignals
    ↓
Coach Summary
```

---

# Key Rules Locked

## Parent owns canonical competition truth

Coach:
- CANNOT mutate results
- CANNOT mutate timing
- CANNOT mutate wins/losses
- CANNOT mutate submissions

Coach only consumes bounded intelligence.

---

# Coach Competition Review Refactor

Coach competition editing converted into:

```txt
review mode only
```

Coach can:
- review competition
- see match data
- eventually annotate

Coach cannot:
- create canonical competitions
- overwrite canonical matches
- delete competitions
- mutate parent-owned metrics

This eliminated dual-owner collision risk.

---

# Worker Deploy Recovery

Deployed:

```txt
PUT /competition-aggregate
```

Confirmed:
- route parity
- worker persistence
- session KV writes
- hydrate retrieval
- overlay application

Logs confirmed:

```txt
publish_ok
hydrate_write
overlay_applied
```

This restored:
- win rate
- submission rate
- fastest sub
- average match time
- dominant win style
- competition totals

on coach Summary.

---

# Runtime QA Successes

Validated:
- rapid athlete switching
- cold launches
- Xcode rebuild persistence
- hard close reopen
- multi-athlete isolation
- no athlete bleed
- no duplicate athlete recreation

---

# 5/18 — Training Proof Mirror Implementation

## Major Discovery

Audit proved:
training proof DID NOT actually exist in repo.

Only architecture stubs existed.

This clarified:
- no hidden regression existed
- training proof was simply unimplemented
- clean bounded architecture could now be built correctly

---

# Training Proof Philosophy Locked

Critical ownership model:

| Plane | Owner |
|---|---|
| Parent training truth | Parent / athlete |
| Coach Training tab | Coach-local operational only |
| Coach Summary | Read-only mirrored proof |

Important rule:

```txt
parent proof > empty
```

NOT:

```txt
coach local > parent proof
```

Coach-local sessions NEVER override parent proof.

This was intentionally DIFFERENT from competition precedence.

---

# Training Proof Architecture

Implemented:

```txt
Parent sessions
    ↓
buildTrainingProofArtifact
    ↓
publishParentTrainingProof
    ↓
worker KV
    ↓
coachTrainingProofStore
    ↓
overlayTrainingProofSignals
    ↓
Coach Summary
```

---

# Mirrored Training Intelligence

Coach Summary now mirrors:
- current week session count
- dominant system
- top systems
- top techniques
- last training date
- weekly goal status

WITHOUT syncing:
- Session[]
- journals
- media
- timelines
- raw training history

Again:
bounded intelligence only.

---

# Critical Technical Success

Training proof correctly:
- excludes coach-local sessions
- scopes strictly by sharedAthleteId
- uses Monday-start current week semantics
- uses 14-day rolling top techniques
- avoids competition-adjusted dominance heuristics

This preserved clean ownership semantics.

---

# Distributed Device QA (Build 30)

## Devices Validated

- Parent phone
- Coach laptop/dev client
- Wife phone (fresh install)
- Multi-athlete distributed environment

---

# Major Runtime Discoveries

## Sync Persistence PASS

Validated:
- competition sync
- training proof sync
- weekly update sync
- aggregate hydration
- athlete isolation
- hard close persistence
- reinstall persistence
- cross-device consistency

---

# Key Remaining Runtime Issue

The system currently requires:

```txt
hard close / reopen
```

to reliably force:
- foreground refresh
- overlay invalidation
- writer-session reconcile
- aggregate refresh

Important:
this is NOT data corruption.

The underlying persistence architecture is functioning correctly.

The likely issue is:

```txt
foreground hydration orchestration
```

Areas suspected:
- focus listeners
- pull-to-refresh wiring
- stale cache invalidation
- foreground refresh cadence
- overlay refresh timing

This is now considered:
- RC stabilization work
NOT
- architecture failure

Huge improvement from prior state.

---

# Important Commits

## `293c749`

```txt
Sync bounded competition aggregates to coach summary
```

## `288e105`

```txt
Mirror parent competition and training proof into coach summary
```

## `278b4a0`

```txt
RC stabilization checkpoint after distributed sync QA
```

These commits now represent the stabilized RC sync foundation.

---

# Current System Status

| System | Status |
|---|---|
| Weekly publish | Stable |
| Competition event sync | Stable |
| Competition Summary metrics | Stable |
| Training proof Summary metrics | Stable |
| Athlete isolation | Stable |
| Rapid switching | Stable |
| Cold relaunch persistence | Stable |
| Worker persistence | Stable |
| Parent authority | Stable |
| Coach bounded mirrors | Stable |
| GAAL catastrophic regressions | Not observed |
| Duplicate athlete explosions | Not observed in current QA |
| Foreground refresh orchestration | NEEDS WORK |

---

# Immediate Next Steps (5/19)

## Priority 1 — Foreground Refresh Stabilization

Investigate:
- app foreground refresh
- focus-triggered hydrate
- pull-to-refresh orchestration
- writer-session invalidation
- overlay refresh timing
- stale aggregate eviction

Goal:
remove need for hard-close/reopen.

---

## Priority 2 — Structured Regression Matrix

Run:
- multi-device
- multi-household
- third-athlete
- slow network
- reconnect
- overnight persistence
- repeated publish/edit/delete

---

## Priority 3 — Duplicate Athlete Cleanup

Now that authority is stabilized:
- remove orphan athletes
- clean old link states
- preserve only active linked athletes

---

## Priority 4 — UX Polish Only

NO major architecture work.

Only:
- refresh UX
- loading states
- overlay timing
- hydration smoothness
- Summary polish

---

# Final Assessment

The repo crossed a major threshold during 5/17–5/18.

The architecture evolved from:

```txt
fragile multi-owner sync
```

into:

```txt
bounded parent-authority mirrors with coach intelligence consumption
```

This is the strongest and most production-shaped sync foundation the project has had so far.




## EOD Handoff — 2026-05-14 → 2026-05-15 stabilization milestone

MOST IMPORTANT RECENT TRUTH
We discovered the real destabilizer was NOT primarily:

navigation corruption
selector architecture collapse
tab divergence architecture
replay corruption

The real issue was:
DUPLICATE SHARED ATHLETE CREATION

Symptoms that came from that:

ghost athletes
duplicate athletes
Summary and This Week resolving different athletes
weekly sync disappearing on parent side
coach roster duplication/staleness
unstable hydration after restart
active athlete identity drift
weekly ownership mismatches

Observed example:

active athlete store could point to one shared_ath_*
weekly owner could point to another shared_ath_*
both represented the same athlete name
2. Containment fix implemented

File:
coach-sync-worker/src/index.ts

Behavior change:
POST /v1/sessions/:token/athletes

Now:

normalize athlete name
search existing session athletes
reuse existing shared athlete if normalized name matches
prevent minting duplicate shared-athlete identities on fresh forward flows

This is containment-first.
Historical reconciliation has NOT been done yet.

Key checkpoint:
97911bb
Meaning:
FIRST STABLE FORWARD ATHLETE LINEAGE BUILD

3. What is currently stable

For NEW / clean lineage flows:

fresh invite flows
fresh athlete creation
parent linkage
weekly publish
competition propagation
cold hydration
athlete switching
weekly isolation
parent ↔ coach sync

Confidence:
moderately high for fresh forward-created sessions

4. What is still historical debt

Old corrupted sessions may still contain:

duplicate historical athletes
polluted coach roster
stale shared athlete ids
unreconciled weekly ownership
stale weeklyByAthleteId mappings

Important:
Historical corruption is NO LONGER actively destabilizing fresh runtime flows.
But it has NOT been reconciled.

OTHER IMPORTANT RECENT ARCHITECTURE TRUTH
5. Coach-side Summary issue was reclassified correctly

The remaining coach-side Summary issue is NOT primarily:

Summary rendering bug
Summary VM bug
progression engine bug
alignment engine bug

It is a DATA-PLANE / ATHLETE-INTELLIGENCE GAP.

Reason:
Coach currently does NOT receive replicated parent training proof.

Coach can receive:

weeklyByAthleteId
competitions
coach-local sessions

Coach does NOT receive:

parent-created training sessions
parent training proof
parent-derived signal lineage

So coach Summary showing low/no proof is currently expected under present architecture.

6. Chosen future direction

Recommendation A — Canonical Training Proof Architecture

Do NOT:

sync raw parent session rows directly
fake session rows
inject synthetic counts
patch Summary with hacks
keep layering fallbacks

Instead:
Parent remains source of truth for:

full sessions
journals
notes
media
detailed logs

Remote replicated lane should eventually contain bounded aggregates such as:

rolling session counts
proof windows
signal dominance
top systems
timestamps
alignment-relevant aggregates

This is future work. It is NOT implemented yet.

ANOTHER RECENT FIX TO REMEMBER
7. Weekly systemKey persistence bug fixed

File:
src/features/kid/KidDetailScreen.tsx

Problem:
systemKey was being lost when coach check-ins appended new weekly rows, causing downstream alignment drift and headline fallback misuse.

Fix:
appended check-in rows now inherit:
systemKey: currentWeekEntry.systemKey

Applies to:

template flows
custom flows

Validated:

coach publish → parent sync works
weekly direction persists correctly
no observed weekly-flow regression
IMPORTANT PRODUCT / EXECUTION LESSON

A major mistake during the prior cycle was drifting into:

governance doctrine
observability architecture
witness systems
registry systems
survivability governance
canonical authority graph theory

before runtime corruption was resolved.

That was stopped intentionally.

Correct move was:
return to

real logs
real device QA
identity tracing
hydration validation
production stabilization discipline

This must remain the operating rule.

NON-NEGOTIABLES FOR THIS THREAD
No fake session rows
No synthetic counts
No Summary hacks
No random fallback layering
No broad architecture rewrites under fatigue
No casual historical migration work
No blind commit of mixed experimental files
Repo truth > guessing
Stabilization first, theory second
RECOMMENDED NEXT PHASE

Runtime QA Hardening

Focus:

training session ownership validation
unlink/relink stability
overwrite weekly behavior
cache invalidation edge cases
stale hydration edge cases
coach restart persistence
multi-athlete overwrite behavior
long-session durability

Do NOT:

start large reconciliation migrations casually
redesign runtime architecture under fatigue
introduce authority rewrite systems prematurely

Historical reconciliation deserves:

dedicated session
rollback planning
migration strategy
isolated QA environment


# EOD Handoff — 2026-05-13

## Branch
`summary-rebuild-v2`

---

# TODAY'S PRIMARY OUTCOME

Today was a major architecture clarification day.

We confirmed that the remaining coach-side Summary issue is NOT a rendering bug, NOT a Summary VM bug, and NOT primarily a competition sync bug.

It is a foundational data-plane / athlete-intelligence architecture issue.

This changes the direction of future work.

---

# WHAT WAS VALIDATED TODAY

## 1. Weekly systemKey persistence bug FIXED

### Root cause discovered
`systemKey` was being lost when:
- coach check-ins appended new weekly rows
- newer rows became the “latest row”
- publish selected latest row
- publish payload omitted `systemKey`
- downstream alignment fell back to headline prose

### Fix implemented
File:
- `src/features/kid/KidDetailScreen.tsx`

Change:
- check-in append rows now inherit:
  `systemKey: currentWeekEntry.systemKey`

Applies to:
- template flows
- custom flows

### Result
Latest weekly rows now preserve taxonomy lineage.

Prevents:
- alignment drift
- headline fallback misuse
- taxonomy loss after coach check-ins

### Validation
Confirmed:
- coach publish → parent sync works
- weekly direction persists correctly
- no observed regression in weekly flows

Typecheck:
- passed

Lint:
- passed

---

# 2. Competition sync architecture confirmed stable

Validated:
- parent-created competitions appear on coach side
- shared athlete propagation works
- reconciliation survives reload
- competition lineage uses proper remote sync path

This reinforced the discovery that:
competition has a remote data plane,
training currently does not.

---

# 3. Major architecture discovery — coach Summary issue

## CONFIRMED FACT

Coach-side Summary currently shows:
- `sessionCount: 0`
- `directed_no_proof`

because:
coach device has NO replicated parent training lineage.

Parent training sessions remain LOCAL ONLY.

---

# IMPORTANT ARCHITECTURE DISCOVERY

## Current architecture

### Coach currently receives remotely:
- weeklyByAthleteId
- competitions
- coach-side local sessions

### Coach does NOT receive:
- parent-created training sessions
- parent training proof
- parent-derived signal lineage

Therefore:
Summary behaves correctly given current inputs.

---

# THIS IS NOT A SUMMARY BUG

Today confirmed:
- Summary VM is behaving consistently
- alignment engine is behaving consistently
- progression engine is behaving consistently

The issue is:
coach-side athlete intelligence has no replicated training proof source.

This is a DATA PLANE GAP.

---

# ARCHITECTURAL DECISION

## Selected direction:
# Recommendation A — Canonical Training Proof Architecture

DO NOT:
- sync raw parent Session rows directly
- fake session rows
- inject synthetic counts
- add Summary hacks

INSTEAD:
introduce a dedicated replicated per-athlete Training Proof lane.

---

# RECOMMENDATION A — TARGET MODEL

## Parent device remains source of truth for:
- full sessions
- journals
- notes
- media
- detailed logs

## Remote worker should eventually replicate:
- rolling session counts
- proof windows
- signal dominance
- top systems
- timestamps
- alignment-relevant aggregates

NOT:
- raw journals
- private parent notes
- media payloads

---

# WHY THIS MATTERS

This architecture:
- scales cleanly
- keeps payloads bounded
- protects privacy
- stabilizes Summary inputs
- avoids route ownership leakage
- prevents future “patch storms”

---

# IMPORTANT DISCOVERY #2

## Competition issue earlier this week may have exposed broader instability

Strong evidence now points toward:
# ROUTE OWNERSHIP + ATHLETE IDENTITY LEAKAGE

Potential root causes:
- multiple athlete truth sources
- stale athlete cache reuse
- fallback ownership behavior
- route crossover between parent/coach flows
- selector instability

NOT primarily:
- worker corruption
- KV corruption
- competition corruption

This changes future stabilization priorities.

---

# TODAY'S LOGGING + TRACE RESULTS

## Key confirmation

Coach Summary logs showed:
- `sessionCountVm: 0`
- `signals.topSystem: null`
- `rawSessionCount: 0`

while:
- competitions existed
- weekly sync existed
- athlete identity resolved correctly

Meaning:
the coach app had no session lineage available.

This matched Recommendation A diagnosis exactly.

---

# IMPORTANT IMPLEMENTATION STATUS

## Recommendation A has NOT been implemented yet.

Current behavior remains EXPECTED:

### Parent side
- training logs visible
- Summary computes proof

### Coach side
- no parent training proof visible
- Summary remains proof-empty

This is now considered expected behavior until the new architecture exists.

---

# FILES TO REVIEW TOMORROW

Potentially valid:
- `src/features/kid/KidDetailScreen.tsx`
- `src/hooks/useAthleteData.ts`
- `src/hooks/useSignals.ts`
- `src/features/summary/SummaryScreen.tsx`
- `src/components/summary/SummaryHeroCard.tsx`

Need careful audit before commit.

---

# CURRENT GIT STATUS

Modified files include:
- Summary plumbing
- athlete lineage experiments
- competition stabilization carryover
- architecture instrumentation
- possible partial Cursor audit changes

DO NOT blindly commit all changes tonight.

---

# RECOMMENDED NEXT SESSION PRIORITIES

## Priority 1
Formalize canonical Athlete Intelligence architecture.

## Priority 2
Audit Recommendation A against entire repo:
- selectors
- route ownership
- sync contracts
- worker assumptions
- lineage semantics
- cache ownership

## Priority 3
Define explicit visibility contract:
What EXACTLY should coaches see from parent training?

## Priority 4
Build formal QA matrix:
- single athlete
- multi athlete
- parent
- coach
- device permutations
- stale cache reloads
- reconnect flows

---

# QA STATUS

## VALIDATED TODAY
- weeklyByAthleteId sync
- coach publish → parent
- parent competition → coach
- shared athlete competition propagation
- weekly systemKey persistence
- no regression in coach/parent weekly flows

## EXPECTED CURRENT LIMITATION
- parent training proof does NOT appear on coach Summary

This is expected until Recommendation A implementation.

---

# IMPORTANT OPERATOR RULES

## NO MORE PATCHES

Do NOT:
- fake session rows
- overload Summary inputs
- inject fake counts
- add temporary proof hacks
- continue “just one more fallback”

All future work must support:
# Canonical Athlete Intelligence Architecture

---

# TOMORROW STARTING POINT

Morning focus:
1. clean git review
2. isolate validated fixes
3. architecture audit
4. Recommendation A repo consistency audit
5. route ownership stabilization planning
6. define canonical athlete intelligence model

Do NOT resume random Summary patching.


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

# DEV HANDOFF — 2026-06-04 21:49

## Runtime Focus

Competition runtime stabilization, replay governance, topology vs aggregate convergence, and architecture governance formalization.

---

# Major Runtime Discoveries

## Summary vs Compete Architectural Split

Confirmed:

* Summary renders through:

  * `computeSignals`
  * aggregate overlay
  * `overlayCompetitionAggregateSignals`
* Compete renders through:

  * topology projection
  * `projectCompetitionCompeteView`
  * `CompetitionCard`

Meaning:
Summary and Compete do NOT render from the same final convergence substrate.

---

## Replay Asymmetry Confirmed

Observed:

* topology replay uses strict `>`
* aggregate replay uses `>=`

This creates deterministic divergence windows under equal timestamp conditions.

---

## Projection Invalidation Root Cause

Grounded finding:
`overlayCompetitionAggregateSignals`
peeked topology state for `competitionCount`,
BUT:
`useSignals`
did NOT subscribe to topology invalidation (`competitionVersion`).

This caused:

* Compete topology updates appearing before Summary convergence
* stale Summary counts
* delayed overlay recompute

---

# Runtime Governance Work Completed

Created architecture governance suite:

* `docs/architecture/hydration-orchestration-v1.md`
* `docs/architecture/runtime-dependency-maps-v1.md`
* `docs/architecture/recovery-systems-v1.md`
* `docs/architecture/invalidation-cache-systems-v1.md`
* `docs/architecture/sequence-diagrams-v1.md`
* `docs/architecture/competition/competition-runtime-governance-v1.md`
* `docs/architecture/competition/competition-runtime-invariants-v1.md`
* `docs/architecture/competition/competition-stabilization-roadmap-v1.md`

Governance now includes:

* runtime planes P1–P6
* ownership doctrine
* replay doctrine
* invalidation doctrine
* stabilization sequencing
* recovery governance
* AI mutation safety zones
* bounded Codex/Cursor governance

---

# Runtime Stabilization Patch Applied

Commit:
`eddc0e7`
`Stabilize coach Summary topology overlay recompute timing`

Patch:

* Added `competitionVersion` subscription inside `useSignals`
* Added coach-gated topology invalidation recompute dependency
* Preserved:

  * replay semantics
  * hydration ordering
  * store ownership
  * invalidation ownership
  * persistence boundaries

Scope:
Read-only projection invalidation alignment only.

---

# QA Results

## PASS

* Summary no longer exhibited obvious topology recompute lag
* Athlete fast switching stable
* Summary/Compete counts stable during navigation
* No replay bleed observed
* No duplicate competitions observed
* No hydration flicker observed

## REMAINING ISSUE

Coach aggregate remains stale:

* Summary shows `30-12`
* Historical topology inspection indicates `30-13`

Important:
This is NOT the same issue as projection invalidation timing.

Likely remaining runtime class:

* aggregate publication staleness
* aggregate replay acceptance
* parent aggregate rebuild omission
* equal timestamp aggregate replay behavior

Projection convergence appears improved.
Aggregate correctness remains unresolved.

---

# Parent App State

Important runtime event:
Parent app was deleted/reinstalled during QA.

Effects:

* P1 canonical local stores lost on parent device
* Parent app relinked Luca only
* Mikey blocked by ghost athlete detection
* Coach app retained:

  * topology artifacts
  * aggregate artifacts
  * overlays
  * shared competition shells

Major discovery:
Coach mirrors already function as a bounded survivability substrate.

Recovery orchestration does NOT yet exist.

---

# Latest Git Status

```text
## rollback-pre-lineage-regression
?? scripts/write_dev_handoff.py
```

---

# Latest Commits

```text
eddc0e7 (HEAD -> rollback-pre-lineage-regression) Stabilize coach Summary topology overlay recompute timing
72ff5ab Establish competition runtime governance and stabilization doctrine
921bfe9 Seed grounded hydration and recovery architecture governance docs
a60c9e8 Stabilize canonical competition topology hydration and reactive projection
af5ca00 Converge canonical competition detail ownership on sharedCompetitionId
```

---

# Recently Changed Files

```text
docs/architecture/competition/competition-runtime-governance-v1.md
docs/architecture/competition/competition-runtime-invariants-v1.md
docs/architecture/competition/competition-stabilization-roadmap-v1.md
docs/architecture/runtime-dependency-maps-v1.md
src/hooks/useSignals.ts
```

---

# Known Runtime Risks

* aggregate replay asymmetry
* equal timestamp divergence
* stale aggregate overlays
* hydration ordering ambiguity
* refresh-dependent convergence
* incomplete recovery orchestration
* parent deletion non-recoverability
* aggregate publication correctness

---

# Recommended Next Steps

## Phase 1 — Replay Governance Investigation

Focus:
Why aggregate artifacts remain stale while topology/history appears newer.

Priority targets:

1. aggregate artifact publication path
2. aggregate builder completeness
3. aggregate replay acceptance behavior
4. equal timestamp handling
5. parent mutation → aggregate rebuild chain
6. aggregate overwrite ordering
7. reconcile timing

DO NOT:

* rewrite hydration
* widen ownership
* add new stores
* introduce speculative recovery systems
* mutate replay semantics broadly

Continue operating inside:

* runtime governance doctrine
* invariant doctrine
* stabilization roadmap sequencing

---

# Operational Notes

Notion operationalization started:

* runtime cognition layer
* proof-of-work engineering case study
* architecture governance capture
* future portfolio narrative
* AI-assisted engineering governance

Current strategic transition:
Reactive debugging → governed distributed runtime engineering.

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
\n
