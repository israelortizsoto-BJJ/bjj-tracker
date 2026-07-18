# MatMind Product Roadmap

**Status:** Master Product OS source of truth for all product Epics  
**Created:** 2026-07-17  
**Scope:** Full MatMind product — Competition, Coach, Parent, Analytics, AI, Design System, Infrastructure, Premium Experiences, and future platform work  

This document consolidates product Epics and planning previously spread across Product OS vision, Coach Workspace sequencing, Release PRDs, and related product doctrine. It does **not** replace Engineering OS documents (Dev Handoff, Checkpoint, Parking Lot, architecture contracts). Those remain the execution and certification layer.

**Consolidation rule:** Nothing from prior product planning is discarded. Source documents remain authoritative for narrative depth; this roadmap is the Epic index and sequencing authority.

**Related living documents (unchanged):**

| Document | Role |
| --- | --- |
| [`README.md`](./README.md) | Product OS operating rules |
| [`coach-experience-vision.md`](./coach-experience-vision.md) | Coach Workspace North Star |
| [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md) | Coach Workspace release sequencing (historical + detailed) |
| [`releases/release-1-coach-foundations-prd.md`](./releases/release-1-coach-foundations-prd.md) | Release 1 PRD |

---

# Product Mission

MatMind is a **coach-first athlete development platform** that preserves coaching knowledge, guides athlete growth, extends coaching beyond the academy, and uses AI to organize and amplify coaching expertise rather than replace it.

MatMind is **not**:

- a CRM or roster manager
- a checklist tool or stats dashboard
- a notes application
- a BJJ logging app with AI bolted on
- an automated coaching engine that replaces the coach

MatMind **is**:

- an athlete understanding system
- a longitudinal coaching intelligence platform
- a product organized around the real coaching loop rather than application screens

Governing product loop (from Longitudinal Coaching Intelligence Doctrine):

```text
Training
→ Competition
→ Coach Interpretation
→ Weekly Direction
→ Parent Reinforcement
→ Longitudinal Athlete Development
→ Identity / Progression Synthesis
```

A coach should leave the workspace feeling:

> I understand this athlete more clearly.

Not:

> I updated another record.

---

# Product Principles

These principles govern product decisions across Coach, Parent, Competition, Analytics, AI, and Premium surfaces.

1. **Coach first. AI second.** The coach authors meaning. AI assists after coaching truth exists.
2. **Athlete development over data collection.** Every capability should deepen understanding of the athlete, not merely accumulate records.
3. **Capture once. Reuse everywhere.** Coaching insight should be captured once and remain available wherever the athlete journey needs it.
4. **Competition provides Day One value.** An athlete with competition history should already be coachable. Training completeness is not a prerequisite for value.
5. **Voice is for thinking. Typing is for structure.** Speak to capture meaning. Type to organize, refine, and commit structure.
6. **Patterns are more valuable than summaries.** Recurring tendency over months beats a polished paragraph about one week.
7. **AI recognizes patterns. The coach makes decisions.** AI may reveal connections; the coach decides what matters.
8. **Preserve the coach's voice.** MatMind should never replace the coach's voice. The premium experience is durable access to the coach's own teaching.
9. **Transcript is canonical; audio is companion.** Where Coach Commentary exists: transcript remains source of truth; audio strengthens coach–athlete–parent connection and is never required to understand coaching.
10. **Families reinforce coach-authored truth.** Home experience extends the coaching loop; it does not invent a parallel one.
11. **Every release should reduce coach friction.** Progress is measured by how much easier it becomes to coach well.
12. **Build complete workflows rather than isolated features.** Each release should close a meaningful coaching loop.
13. **Restraint is part of the premium experience.** Premium is accumulated coaching understanding — not more charts, KPIs, or visualization density.
14. **Parent delivery is coach-interpreted simplification.** Parents receive direction, reinforcement, and encouragement — not full tactical cognition.

---

# Completed Epics

## EPIC — Voice-first Coach Workspace

**Status:** Completed  
**Also known as:** Release 2 — Voice-first Coaching  
**Original sources:** [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md) (Release 2), [`coach-experience-vision.md`](./coach-experience-vision.md) (Voice Strategy), engineering UX-002 certification  

### Outcome

Voice is a first-class coaching input for long-form coaching meaning. Coaches can think at the speed of speech. Typing remains available for structure, labels, and precision.

### Certified reuse

Reusable voice capture (`CoachVoiceNoteField` → Whisper transcription → editable text) is certified across:

- Match Breakdown
- Progress Reflection
- Current Read
- Direction of Growth
- Weekly Focus
- Behavior Under Pressure

### Boundary preserved

Voice does not replace structured fields where typing is correct (names, titles, URLs, dates, short labels, identity/metadata).

### Note on Release sequencing history

The Coach Workspace Roadmap originally sequenced Voice-first Coaching as Release 2 after Foundations. Product reality advanced reusable voice across core coaching surfaces; this Epic is therefore recorded as **Completed** while Release 1 Foundations workflow coherence remains an Active Epic.

---

## EPIC — Product OS Foundation

**Status:** Completed  
**Original sources:** [`README.md`](./README.md), engineering checkpoint “Recently Completed”  

Established Product OS as the permanent home for long-term product thinking, with clear separation from Engineering OS, Dev Handoff, Checkpoint, and Parking Lot.

---

## EPIC — Coach Experience Vision

**Status:** Completed (living document established)  
**Original source:** [`coach-experience-vision.md`](./coach-experience-vision.md)  

North Star for Coach Workspace philosophy, mental model, athlete development journey, voice strategy, coaching intelligence platform principles, and Coach Presence vision.

---

## EPIC — Coach Workspace Roadmap (v1 sequencing)

**Status:** Completed as sequenced plan document (superseded as Epic index by this master roadmap)  
**Original source:** [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md)  

Defined Releases 1–5, capability dependencies, product maturity model Levels 1–6, and long-term Coach Workspace destination. Retained as historical and narrative companion; Epic status and priority now live here.

---

## EPIC — UX Foundations (UX-001 / UX-002 / UX-003)

**Status:** Completed  
**Original source:** engineering checkpoint “Recently Completed”  

Shipped foundational UX work including certified coach voice corridor reuse (UX-002).

---

# Active Epics

## EPIC — Coach Workspace Evolution

**Status:** Active — Planning  
**Also known as:** Coach Workflow Foundation / Release 1 — Coach Foundations (in progress)  
**Original sources:** engineering checkpoint Active Epic; [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md) Release 1; [`releases/release-1-coach-foundations-prd.md`](./releases/release-1-coach-foundations-prd.md); Candidate Future Epics in [`coach-experience-vision.md`](./coach-experience-vision.md)  

### Business objective

Transform the Coach Workspace from a collection of forms into a guided athlete development system organized around:

```text
Assess → Define Future State → Decide What Matters Next
→ Train with Weekly Focus → Observe Behavior Under Pressure → Carry Forward
```

### Included capabilities (Release 1 PRD)

| Capability | Intent |
| --- | --- |
| Current State Assessment | Interpretive picture of the athlete now |
| Future State | Longitudinal developmental destination |
| What Matters Next | Standing guidance until intentionally changed |
| Weekly Focus | Active reinforcement cycle |
| Behavior Under Pressure | Pressure truth as first-class signal |
| Carry Forward | Continuity into the next cycle |

### Engineering stories (planning lane)

- CW-001 Design Athlete Development Journey (Planning)
- CW-002 Current State Assessment
- CW-003 Future State
- CW-004 What Matters Next
- CW-005 Weekly Focus Evolution
- CW-006 Behavior Under Pressure redesign

### Success criteria

Coaches can move an athlete through Assess → Develop → Train → Reinforce as one continuous developmental workflow. The workspace feels like an athlete understanding system.

### Explicitly out of scope for this Epic

Voice capture amplification (completed separately), Coach Presence, AI Pattern Recognition, Family Dashboard, Competition Intelligence as a product intelligence layer — see Planned / Future sections.

---

## EPIC — Competition Intelligence (Lifecycle & Day One Value)

**Status:** Active — Partially Certified (core artifacts); Partially Certified (AI Analysis, Athlete Dashboard)  
**Original sources:** Candidate Future Epics in [`coach-experience-vision.md`](./coach-experience-vision.md); Competition Intelligence Lifecycle doctrine; Coach Workspace Release 4 capability “Competition Intelligence”; Release 1 PRD “out of scope” note for full Competition Intelligence  

### Product intent

Treat competition as pressure validation and a primary source of Day One athlete understanding. Competition history alone should establish useful developmental orientation.

### Certified product ownership (domain law)

- Parent creates and owns competition topology and match outcomes
- Coach owns Match Breakdown (interpretation overlay)
- AI consumes completed artifacts; never owns results or shell metadata
- Athlete Dashboard / Summary synthesizes; does not author topology

### Remaining product work (preserved from lifecycle planning)

- Explicit Competition Occurred domain event (future design)
- Dedicated Parent/Coach notification channels on lifecycle transitions
- Generative AI analysis product surface
- Premium Athlete Identity Dashboard / Timeline
- Family Competition Editor decommissioning (certification-gated transitional surface)

---

## EPIC — Parent Progress Understanding (Summary / Reinforcement Lane)

**Status:** Active — Doctrine established; product surface evolving  
**Original sources:** Parent Progress Understanding Doctrine; Family Experience capabilities in [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md); Canonical Coaching Workflow Parent Experience  

Parents should receive coach-interpreted simplification: direction, reinforcement, weekly focus clarity, and encouragement — not full tactical cognition or chart-heavy analytics. Summary remains the calm synthesis surface; Compete owns event proof.

---

## EPIC — Design System (Shared Header / Operating Chrome)

**Status:** Active — Investigated (UX-005); product decisions pending  
**Original sources:** UX-005 Shared Header Design System audit; engineering checkpoint product dependencies  

Partial shared header (`OperatingHeader`) exists on primary tabs. Nested Athlete Detail and Competition Detail still use incompatible chrome. Product sign-off required before thin design-spec implementation. Related polish items (pull-to-refresh affordance, loading states, TestFlight spacing/labels) remain intentionally deferred in Engineering Parking Lot until product priority clears them.

---

# Planned Epics

## EPIC — Coach Commentary

**Status:** Investigated · Repository Audit Complete · Implementation Deferred  
**Date recorded:** 2026-07-17  
**Original sources:** [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md) `#EPIC — Coach Commentary`; [`coach-experience-vision.md`](./coach-experience-vision.md) Coach Commentary Vision; architecture investigation 2026-07-17  

### Product goal

Preserve the coach's personality immediately after competition. Transcript captures coaching knowledge. Audio captures coaching emotion. Together they create a coaching experience parents and athletes remember.

### Current scope

- Competition Match Breakdown (emotion is highest)

### Investigation findings

**Existing (certified / present):**

- production recorder
- Whisper transcription
- editable transcript
- transcript persistence
- Match Breakdown persistence corridor
- Parent transcript hydration

**Missing:**

- audio persistence
- audio metadata
- sync
- playback
- offline lifecycle

### Architecture decision

- **Transcript remains canonical.**
- **Audio becomes a companion coaching artifact.**
- Do **not** build a second voice pipeline.
- Extend the certified Match Breakdown corridor:

```text
Current:
Record → Transcript → coachNote

Future:
Record → Transcript + Audio Artifact → Match Breakdown
```

### Future milestones (deferred implementation)

| Phase | Scope |
| --- | --- |
| Phase 1 | Audio Artifact Infrastructure — persistence, metadata, sync, offline |
| Phase 2 | Coach Commentary UX — playback, duration, parent experience |
| Phase 3 | Premium Coaching — waveform, AI highlights, playback improvements |

### Product principles specific to this Epic

- Transcript is always editable and always source of truth
- Audio is never required to understand coaching
- Audio exists to strengthen coach–athlete–parent connection
- Coach Commentary only exists where emotion is highest

---

## EPIC — Coach Presence

**Status:** Planned (Release 3 in Coach Workspace sequencing)  
**Original sources:** [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md) Release 3; [`coach-experience-vision.md`](./coach-experience-vision.md) Coach Presence + Candidate Future Epics  

### Goal

Allow athletes to continue learning from the coach outside the academy. Preserve the coach as teacher.

### Capabilities

- Voice Match Breakdown
- Timestamped Commentary / Timestamped Coaching
- Guided Playback
- Coach Replay
- Director's Commentary
- Searchable Coaching Moments
- AI Indexing (organize; do not replace authorship)

### Dependency

Builds on completed Voice-first capture and durable Foundations developmental context. Coach Commentary audio companion work is a natural bridge into Presence.

---

## EPIC — Coaching Intelligence Platform

**Status:** Planned (Release 4 in Coach Workspace sequencing)  
**Original sources:** [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md) Release 4; [`coach-experience-vision.md`](./coach-experience-vision.md) Coaching Intelligence Platform + Candidate Future Epics; Canonical Coaching Workflow  

### Goal

Transform accumulated coaching evidence into long-term athlete intelligence without replacing coach authorship.

### Capabilities

- Pattern Recognition
- Competition Intelligence (Day One developmental orientation)
- Development Timeline / Athlete Development Timeline
- Behavior Trends
- Growth Tracking
- Coach Insights
- Suggested Development Areas (support judgment; never replace it)

### Evidence sources

Competition Results, Match Breakdowns, Coach Assessments, Weekly Focus, Behavior Under Pressure, Progress Reflections, Training Sessions, Parent Reinforcement.

---

## EPIC — Family Experience

**Status:** Planned (Release 5 in Coach Workspace sequencing)  
**Original sources:** [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md) Release 5; Parent Experience in Canonical Coaching Workflow  

### Goal

Extend the coaching relationship into the home.

### Capabilities

- Family Huddle
- Parent Dashboard
- At Home Reinforcement
- Coach Recommendations
- Progress Sharing
- Home Accountability

### Dependency

Families reinforce coach-authored developmental truth after Foundations + Intelligence give the home something coherent to support.

---

## EPIC — Athlete Development Timeline

**Status:** Planned (also listed under Coaching Intelligence capabilities)  
**Original source:** Candidate Future Epics in [`coach-experience-vision.md`](./coach-experience-vision.md)  

Make the athlete's developmental journey visible as an evolving arc across Assess, Develop, Train, Reinforce, and Coaching Intelligence.

---

## EPIC — AI Pattern Recognition

**Status:** Planned  
**Original sources:** Candidate Future Epics in [`coach-experience-vision.md`](./coach-experience-vision.md); Release 1 PRD out-of-scope; AI Responsibility Boundary in Canonical Coaching Workflow  

Use AI to recognize recurrence, trajectory, and coaching signals — while leaving judgment and decision-making with the coach.

AI may assist with drafting, summarization, pattern surfacing, reinforcement phrasing, longitudinal synthesis, and trend recognition.

AI must never own canonical coaching truth, athlete identity, official coaching interpretation, or final developmental judgment.

---

## EPIC — Premium Athlete Intelligence Surfaces

**Status:** Planned  
**Original sources:** Canonical Coaching Workflow Premium Tier Vision / Future Premium Dashboard; Parent Progress Understanding Doctrine Premium Tier Vision  

Premium is **accumulated coaching understanding**, not more charts.

Future premium dashboard themes:

- Athlete Identity Timeline (strategic identity, pressure tendencies, progression arcs, recurring themes, maturity)
- Coach Intelligence Feed (recurring observations, unresolved gaps, breakthroughs, themes over time)
- Execution vs Direction (coach emphasis vs training proof vs competition execution)

---

# Future Vision

## Product maturity model (Coach Workspace lineage)

Preserved from [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md):

```text
Level 1 — Digital Coaching Notes
↓
Level 2 — Structured Athlete Development
↓
Level 3 — Voice-first Coaching          ← achieved (Voice-first Epic Completed)
↓
Level 4 — Coach Presence
↓
Level 5 — Coaching Intelligence
↓
Level 6 — Integrated Family Development
```

## Capability dependency chain (preserved)

```text
Foundations create structure
↓
Voice makes capture natural          ← Completed
↓
Presence preserves teaching beyond the mat
↓
Intelligence compounds meaning over time
↓
Family extends the coaching relationship into the home
```

## Future voice expansion (vision, not yet Epics)

From Voice Strategy in [`coach-experience-vision.md`](./coach-experience-vision.md):

- spoken drafting across the full athlete development journey
- voice as memory for tone and emphasis, not only transcription
- voice-supported competition review and replay commentary
- searchable spoken coaching moments across athlete history
- hybrid capture where voice creates the first draft and typing refines structure

## Coach Presence long-horizon capabilities

Voice Match Breakdown, Timestamped Coaching, Guided Playback, Director's Commentary, Coach Replay, Searchable Coaching Moments, AI Indexing — with the coach remaining the teacher.

## Platform destination

In the long-term future:

- Coaches understand athletes more clearly with less friction
- Athletes continue learning from their coach beyond the mat
- Competition reveals pressure truth from Day One
- Developmental memory compounds into intelligence
- Families reinforce coaching rather than inventing parallel systems
- AI remains subordinate to coaching authorship

---

# Release Status

| Release | Name | Product status | Notes |
| --- | --- | --- | --- |
| **Release 1** | Coach Foundations | **Active / In Progress** | PRD complete; guided workflow still the active Epic. Stories CW-001–CW-006 in planning. |
| **Release 2** | Voice-first Coaching | **Completed** | Certified reusable voice across Match Breakdown, Progress Reflection, Current Read, Direction of Growth, Weekly Focus, Behavior Under Pressure. |
| **Release 3** | Coach Presence | **Planned** | Depends on Foundations coherence + durable voice teaching moments; Coach Commentary is an early bridge. |
| **Release 4** | Coaching Intelligence | **Planned** | Depends on accumulated authored evidence from Releases 1–3. |
| **Release 5** | Family Experience | **Planned** | Extends coach-authored truth into the home after coaching core is strong. |

### Cross-cutting release tracks (not Coach-only)

| Track | Status |
| --- | --- |
| Competition Intelligence Lifecycle | Active — core certified; AI / Athlete Dashboard / notifications partial |
| Parent Progress Understanding | Active — doctrine + evolving Summary/Compete surfaces |
| Design System / Operating Chrome | Active — UX-005 investigated; decisions pending |
| Coach Commentary | Planned — investigated; implementation deferred |
| Premium Athlete Intelligence | Future / Planned |
| Infrastructure hardening (TestFlight, sync polish, push) | Engineering Parking Lot / release readiness — product-aware, engineering-owned |

### Current release goal (engineering checkpoint alignment)

> Build a coach-first athlete development platform that establishes the foundation for Coaching Intelligence.

Status: In Progress.

---

# Product Backlog

Items intentionally preserved from prior planning that are not yet full Epics, or are deferred / out of current sequencing. Omission from Active/Planned does not mean rejection.

## From Coach Workspace “Not in Scope (Yet)”

- AI-generated coaching (coach remains authority)
- Automated skill grading
- Public social feeds
- Gamification for its own sake
- Marketplace features
- Coach replacement workflows

## From Coach Commentary future phases (deferred)

- Permanent audio storage, metadata, sync, offline lifecycle
- Parent/Athlete playback UX
- Waveform, AI highlights, premium playback improvements

## From Competition / Parent lifecycle parking (product-relevant)

- Push notification when Coach publishes a Match Breakdown
- Push notification when weekly summaries become available
- Evaluate background synchronization versus explicit refresh after MVP stabilization
- Explicit `CompetitionOccurred` domain event modeling
- Family Competition Editor decommissioning (certification-gated)

## From Design System / UX polish (product-aware)

- Shared header product decisions (UX-005 R2–R4)
- Pull-to-refresh affordance and visual feedback on Compete screens
- Loading-state polish during competition synchronization
- Spacing, labels, and interaction polish before TestFlight

## From Canonical Coaching Workflow / Premium doctrine

- Athlete Identity Timeline premium dashboard
- Coach Intelligence Feed
- Execution vs Direction comparative intelligence
- Longitudinal baseline memory deepening on Summary

## Voice opportunity backlog (vision list not yet Epic-scoped)

- Competition-level coach notes (event-level beyond single match) — voice-first opportunity called out in vision
- Session notes optional spoken capture
- Searchable spoken coaching moments
- Hybrid voice-draft + typed-structure workflows beyond certified surfaces

## Infrastructure / platform (product-visible, engineering-owned)

- Release Candidate hardening / TestFlight from certified floor
- Production-device regression against certified QA scenarios
- Engineering Observatory / Digital Twin (post-RC)
- Sync corridor hardening without navigation side effects (certified floor exists; ongoing product trust dependency)

---

# Certified Product Decisions

Durable decisions that should not be quietly reversed. Sources include Product OS principles, Coach Commentary investigation, ownership doctrine, and core product decisions.

| ID | Decision | Source / evidence |
| --- | --- | --- |
| **PD-CC-1** | Transcript remains the canonical coaching record for Match Breakdown / Coach Commentary. | Coach Commentary Vision; architecture investigation 2026-07-17 |
| **PD-CC-2** | Audio is a companion coaching artifact; never required to understand coaching. | Coach Commentary Vision |
| **PD-CC-3** | Do not build a second voice pipeline; extend the certified Match Breakdown corridor. | Coach Commentary Epic investigation |
| **PD-CC-4** | Coach Commentary only exists where emotion is highest; current scope is Competition Match Breakdown. | Coach Commentary Vision |
| **PD-V-1** | Voice is first-class for long-form coaching meaning; typing remains for structure. | Voice Strategy; Voice-first Epic Completed |
| **PD-V-2** | Reusable voice corridor is certified across Match Breakdown, Progress Reflection, Current Read, Direction of Growth, Weekly Focus, Behavior Under Pressure. | UX-002 certification |
| **PD-AI-1** | AI does not replace coaching; coach remains author of meaning. | Product Principles; AI Responsibility Boundary |
| **PD-AI-2** | AI must never own canonical coaching truth, athlete identity, official interpretation, or final judgment. | Canonical Coaching Workflow |
| **PD-COMP-1** | Parent owns competition topology and match outcomes. | Competition Overlay / Lifecycle doctrine |
| **PD-COMP-2** | Coach owns Match Breakdown as interpretation overlay; never mutates canonical competition authority. | Competition Intelligence Lifecycle |
| **PD-COMP-3** | Competition history alone is enough for Day One athlete understanding. | Coaching Intelligence Platform principles |
| **PD-FAM-1** | Parents receive coach-interpreted simplification; not full tactical cognition. | Canonical Coaching Workflow Parent Experience |
| **PD-FAM-2** | Families reinforce coach-authored developmental truth; they do not invent a parallel system. | Family Experience / Release 5 principles |
| **PD-PREM-1** | Premium is accumulated coaching understanding, not chart/KPI density. | Premium Tier Vision |
| **PD-PREM-2** | The premium experience is durable access to the coach's own teaching. | Coach Presence philosophy |
| **PD-SYS-1** | Product OS owns why/what kind of experience; Engineering OS owns how/certify/ship. | Product OS README |
| **PD-SYS-2** | Athlete data is longitudinal; MatMind is an athlete intelligence system, not a profile app. | `docs/decisions.md` |
| **PD-SYS-3** | UI remains calm and distraction-free; if a feature does not improve clarity, it does not ship. | `docs/decisions.md` |

Engineering checkpoint references PD-001 / PD-002 / PD-003 as supporting decisions for Coach Workspace Evolution. Those IDs are retained as dependencies; detailed text should be linked here when the formal Product Decision register is published.

---

# Current Highest Priorities

1. **Complete EPIC — Coach Workspace Evolution (Release 1 Foundations)**  
   Finish the guided Assess → Develop → Train → Reinforce → Carry Forward loop so later Presence, Intelligence, and Family work compound on coherent structure.

2. **Protect certified Voice-first reuse**  
   Do not fork recorders or transcription pipelines. New coaching surfaces must reuse the certified corridor.

3. **Keep EPIC — Coach Commentary implementation deferred until audio infrastructure is ready**  
   Investigation and architecture decision are complete. Resume when Phase 1 (persistence, metadata, sync, offline) can be staffed without inventing a second voice pipeline.

4. **Advance Competition Intelligence remaining partial certifications**  
   Notifications, AI analysis product surface, Athlete Dashboard/Timeline — without reopening Parent/Coach ownership law.

5. **Resolve Design System product decisions (UX-005)**  
   Sign off shared header decisions, then thin implementation — nested chrome consistency before broad redesign.

6. **Preserve Family / Premium sequencing**  
   Do not pull Family Experience or chart-heavy premium analytics ahead of Foundations + coach-authored intelligence.

---

# Epic Index (discovery provenance)

Every Epic discovered during consolidation, with original document(s). Nothing below was discarded.

| Epic | Original document(s) | Status in this roadmap |
| --- | --- | --- |
| Voice-first Coach Workspace / Voice-first Coaching (Release 2) | `coach-workspace-roadmap.md`; `coach-experience-vision.md` (Voice Strategy); UX-002 | **Completed** |
| Product OS Foundation | `product/README.md`; engineering checkpoint | **Completed** |
| Coach Experience Vision | `coach-experience-vision.md` | **Completed** (living North Star) |
| Coach Workspace Roadmap v1 sequencing | `coach-workspace-roadmap.md` | **Completed** as plan doc; Epics migrated here |
| UX-001 / UX-002 / UX-003 | engineering checkpoint | **Completed** |
| Coach Workspace Evolution / Coach Foundations (Release 1) | `coach-workspace-roadmap.md`; `releases/release-1-coach-foundations-prd.md`; engineering checkpoint Active Epic; Candidate Future Epics | **Active** |
| Competition Intelligence | `coach-experience-vision.md` Candidate Future Epics; Competition Intelligence Lifecycle; Release 4 capability | **Active** (partial) |
| Parent Progress Understanding | Parent Progress Understanding Doctrine; Family Experience; Canonical Coaching Workflow | **Active** |
| Design System (Shared Header / UX-005) | UX-005 audit; engineering checkpoint | **Active** (decisions pending) |
| Coach Commentary | `coach-workspace-roadmap.md` `#EPIC — Coach Commentary`; `coach-experience-vision.md` Coach Commentary Vision | **Planned** (Investigated; Implementation Deferred) |
| Coach Presence (Release 3) | `coach-workspace-roadmap.md`; `coach-experience-vision.md` | **Planned** |
| Coaching Intelligence Platform (Release 4) | `coach-workspace-roadmap.md`; `coach-experience-vision.md` | **Planned** |
| Family Experience (Release 5) | `coach-workspace-roadmap.md`; Canonical Coaching Workflow | **Planned** |
| Athlete Development Timeline | `coach-experience-vision.md` Candidate Future Epics | **Planned** |
| AI Pattern Recognition | `coach-experience-vision.md` Candidate Future Epics; Canonical Coaching Workflow | **Planned** |
| Premium Athlete Intelligence Surfaces | Canonical Coaching Workflow Premium Tier Vision; Parent Progress Understanding Doctrine | **Planned** |

### Capability themes preserved inside Epics (not lost)

| Theme / capability cluster | Original home | Carried into |
| --- | --- | --- |
| Current State, Future State, What Matters Next, Weekly Focus, Behavior Under Pressure, Carry Forward | Release 1 PRD + roadmap | Coach Workspace Evolution |
| Voice Current/Future State, Voice Weekly Focus, Voice Competition Notes, Voice Behavior Under Pressure, Voice Carry Forward, Reusable Voice Components | Release 2 | Voice-first Coach Workspace (Completed) |
| Voice Match Breakdown, Timestamped Commentary, Guided Playback, Coach Replay, Director's Commentary, Searchable Coaching Moments | Release 3 + Coach Presence vision | Coach Presence |
| Pattern Recognition, Competition Intelligence, Development Timeline, Behavior Trends, Growth Tracking, Coach Insights, Suggested Development Areas | Release 4 | Coaching Intelligence Platform |
| Family Huddle, Parent Dashboard, At Home Reinforcement, Coach Recommendations, Progress Sharing, Home Accountability | Release 5 | Family Experience |
| Coach Commentary Phases 1–3 | Coach Commentary Epic notes | Coach Commentary Planned milestones |
| Maturity Levels 1–6 + dependency chain | Coach Workspace Roadmap | Future Vision |
| Not-in-scope list | Coach Workspace Roadmap | Product Backlog |
| Premium Athlete Identity Timeline / Coach Intelligence Feed / Execution vs Direction | Canonical Coaching Workflow | Premium Athlete Intelligence Surfaces |
| Push notifications, background sync evaluation | Engineering Parking Lot (product-visible) | Product Backlog |

---

# Document Status

This is the **master Product OS roadmap** and the **single source of truth for product Epics**.

- Revise when Epic status, sequencing, or certified product decisions change.
- Do not use this document for daily engineering notes, bug tracking, or implementation contracts.
- Companion vision and PRD documents remain for depth; they should eventually point here for Epic status (replacements not performed in this consolidation pass).
