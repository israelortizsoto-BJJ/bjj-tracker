# Coach Workspace Roadmap

## Purpose

This roadmap describes the planned evolution of the Coach Workspace from its current MVP into a complete athlete development platform.

Each release builds intentionally on the previous release.

The roadmap is driven by coaching outcomes rather than software features.

It answers one question:

> What order should we build the Coach Workspace?

It does not answer how those capabilities are implemented. Engineering execution belongs in Epics, Features, Stories, and the Engineering OS.

This document is the official product bridge between the [Coach Experience Vision](./coach-experience-vision.md) and sequenced product delivery.

---

## Guiding Principles

These principles govern release order and capability priority. They should remain stable as MatMind matures.

- **Coach first.** The coach authors meaning. The product serves coaching judgment, not the other way around.
- **Athlete development over data collection.** Every capability should deepen understanding of the athlete, not merely accumulate records.
- **Voice before typing whenever practical.** Coaches think verbally. Capture should follow how coaches naturally express insight.
- **AI amplifies coaching rather than replacing it.** Intelligence organizes, preserves, and surfaces coaching truth. It never becomes the coach.
- **Competition provides Day One value.** An athlete with competition history should already be coachable in MatMind. Training completeness is not a prerequisite for value.
- **Every release should reduce coach friction.** Progress is measured by how much easier it becomes to coach well, not by how many surfaces exist.
- **Build complete workflows rather than isolated features.** Each release should close a meaningful coaching loop, not leave half-finished habits behind.

---
#EPIC — Coach Commentary 7/17/26
Status

Investigated

Architecture Certified

Implementation Deferred

Repository Investigation Findings

Completed.

Investigation determined:

Already Certified
Voice recording
Whisper transcription
Transcript editing
Match Breakdown persistence
Parent transcript hydration
Missing Capability

Audio artifact persistence.

Specifically:

Permanent audio storage
Audio metadata
Sync metadata
Parent playback
Offline lifecycle
Architectural Decision

Do NOT build a second voice pipeline.

Instead extend the certified Match Breakdown corridor.

Current

Record

↓

Transcript

↓

coachNote

Future

Record

├── Transcript

└── Audio Artifact

↓

Match Breakdown
Future Milestones
Phase 1

Audio Artifact Infrastructure

persistence
metadata
sync
offline
Phase 2

Coach Commentary UX

playback
duration
parent experience
Phase 3

Premium Coaching

waveform
AI highlights
playback improvements

# Release 1

## Coach Foundations

### Goal

Transform the Coach Workspace from disconnected forms into a structured athlete development workflow.

### Capabilities

#### Current State Assessment

Establish a clear, interpretive picture of the athlete as they are now — developmental position, confidence, execution quality, consistency, and pressure response — so coaching begins from truth rather than assumption.

#### Future State

Define the developmental destination worth coaching toward. Direction should feel longitudinal and intentional, not like a temporary task list.

#### What Matters Next

Capture standing developmental guidance that persists until the coach intentionally changes it. This becomes the athlete's durable coaching compass between sessions and cycles.

#### Weekly Focus

Turn long-term direction into an active reinforcement cycle. The coach can express what this week is for, and why it matters now.

#### Behavior Under Pressure

Observe and interpret how the athlete shows up when stakes rise. Pressure truth becomes a first-class coaching signal, not an afterthought.

#### Carry Forward

Close the loop by naming what should persist into the next cycle. Insight does not evaporate at the end of a week or competition.

### Success Criteria

Coaches can move an athlete through Assess → Develop → Train → Reinforce as one continuous developmental workflow.

A coach leaves the workspace feeling they understand the athlete more clearly — not that they completed another set of forms.

The Coach Workspace begins to feel like an athlete understanding system rather than a collection of disconnected inputs.

---

# Release 2

## Voice-first Coaching

### Goal

Allow coaches to think naturally without stopping to type.

### Capabilities

#### Voice Current State

Speak the athlete's present reality while the observation is fresh, preserving tone, emphasis, and intuition that typing often flattens.

#### Voice Future State

Draft developmental destination and direction of growth through spoken coaching language, then refine structure when needed.

#### Voice Weekly Focus

Capture active reinforcement language verbally so weekly coaching intent can be expressed at the speed of thought.

#### Voice Competition Notes

Record event-level and match-level interpretation without interrupting competitive presence or post-match reflection flow.

#### Voice Behavior Under Pressure

Narrate pressure observations as they crystallize, preserving urgency and nuance that structured fields alone cannot hold.

#### Voice Carry Forward

Speak what should persist into the next cycle while meaning is still alive, reducing the drop-off between insight and continuity.

#### Reusable Voice Components

Establish voice as a durable coaching input pattern across the workspace — available wherever long-form coaching meaning is being captured, without forcing voice into short structural fields.

### Success Criteria

Coaches can capture coaching thought at the speed of speech across the core development workflow.

Typing remains available for structure, labels, and precision. Voice becomes the default path for meaning.

The coaching experience feels less like form completion and more like uninterrupted teaching.

---

# Release 3

## Coach Presence

### Goal

Allow athletes to continue learning from the coach outside the academy.

### Capabilities

#### Voice Match Breakdown

Layer spoken coaching interpretation onto competitive moments so the coach's teaching travels with the match, not only with the memory of it.

#### Timestamped Commentary

Anchor coaching to specific moments in time, making teaching precise, replayable, and durable.

#### Guided Playback

Shape review experiences around coaching intent so athletes revisit competition through the coach's lens.

#### Coach Replay

Return to prior coaching moments with context intact — what was said, why it mattered, and how it connected to development.

#### Director's Commentary

Enable the coach to narrate what matters in a sequence, preserving authorship and teaching authority.

#### Searchable Coaching Moments

Find exact teaching moments later — by theme, athlete, competition, or developmental question — so coaching knowledge compounds instead of disappearing.

### Success Criteria

Athletes can continue learning from their coach beyond the mat and beyond the moment of instruction.

The coach's voice becomes a durable developmental asset rather than a fleeting conversation.

Competition review shifts from raw footage or forgotten notes into guided teaching that reinforces identity, decision-making, and growth.

---

# Release 4

## Coaching Intelligence

### Goal

Transform accumulated coaching evidence into long-term athlete intelligence.

### Capabilities

#### Pattern Recognition

Surface recurring technical, emotional, and strategic tendencies across time so coaches see what one week cannot reveal.

#### Competition Intelligence

Turn competition history into developmental orientation — pressure identity, recurring outcomes under stakes, and coaching priorities that matter on Day One.

#### Development Timeline

Make the athlete's journey visible as an evolving arc across assessment, direction, training reinforcement, and pressure validation.

#### Behavior Trends

Track how the athlete responds under pressure across seasons and cycles, distinguishing noise from durable change.

#### Growth Tracking

Show movement toward Future State and What Matters Next, including breakthroughs, plateaus, and regressions.

#### Coach Insights

Organize interpreted coaching memory so the coach can retrieve meaning, compare cycles, and coach with longitudinal clarity.

#### Suggested Development Areas

Surface candidate areas of attention based on accumulated evidence — always as support for coach judgment, never as replacement for it.

### Success Criteria

MatMind becomes more valuable the longer a coach and athlete work together.

Coaches can see trajectory, recurrence, and developmental signal without reconstructing history from memory.

Intelligence amplifies coaching expertise. The coach remains the authority on meaning and next action.

---

# Release 5

## Family Experience

### Goal

Extend the coaching relationship into the home.

### Capabilities

#### Family Huddle

Create a shared developmental conversation space where coaching intent can be understood and reinforced by the family.

#### Parent Dashboard

Give parents a clear, coach-aligned view of what matters now — without turning the home into a second coaching workspace.

#### At Home Reinforcement

Enable families to support Weekly Focus and Carry Forward outside the academy in ways that respect coach authorship.

#### Coach Recommendations

Allow coaches to communicate targeted reinforcement guidance that parents can act on with confidence and clarity.

#### Progress Sharing

Share meaningful developmental progress in a way that strengthens trust and continuity, not performance theater.

#### Home Accountability

Help families participate in follow-through so coaching intent does not stop at the academy door.

### Success Criteria

Families become active participants in athlete development without replacing the coach.

Home reinforcement extends the coaching loop rather than inventing a parallel one.

Athletes experience continuity between academy coaching, competition pressure, and family support.

---

# Capability Dependencies

Each release exists because the previous release makes it coherent.

**Release 1 → Release 2**

Structured athlete development must exist before voice can amplify it. Voice without a developmental workflow only accelerates disconnected capture. Foundations create the places where spoken coaching meaning belongs.

**Release 2 → Release 3**

Voice-first coaching establishes that the coach's spoken insight is first-class product material. Coach Presence extends that same voice into time-anchored teaching, replay, and searchable learning — preserving the coach as teacher beyond the academy.

**Release 3 → Release 4**

Presence creates durable coaching moments. Intelligence needs that durable evidence — assessments, weekly direction, pressure observations, carry-forward meaning, and spoken teaching — before pattern recognition can be trustworthy. Without accumulated coaching authorship, intelligence would be empty summarization.

**Release 4 → Release 5**

Families should reinforce coach-authored developmental truth, not invent their own. Coaching Intelligence and clear developmental direction give the home something coherent to support. Family Experience extends the loop only after the coaching core is strong enough to guide it.

In short:

```text
Foundations create structure
↓
Voice makes capture natural
↓
Presence preserves teaching beyond the mat
↓
Intelligence compounds meaning over time
↓
Family extends the coaching relationship into the home
```

---

# Product Maturity Model

MatMind evolves through capability maturity. These levels describe product depth, not calendar milestones.

### Level 1 — Digital Coaching Notes

Coaching information can be recorded digitally, but meaning remains fragmented across forms and moments. The product stores input more than it shapes development.

### Level 2 — Structured Athlete Development

The Coach Workspace mirrors the real coaching loop. Assessment, direction, weekly reinforcement, pressure behavior, and carry-forward form one continuous developmental workflow.

### Level 3 — Voice-first Coaching

Coaches can think and capture at the speed of speech. Voice becomes the primary path for coaching meaning, while typing remains the path for structure.

### Level 4 — Coach Presence

The coach's teaching travels with the athlete outside the academy. Competition review, commentary, replay, and searchable moments preserve the coach as teacher over time.

### Level 5 — Coaching Intelligence

Accumulated coaching evidence becomes longitudinal athlete intelligence. Patterns, trajectory, and developmental signal compound without replacing coach authorship.

### Level 6 — Integrated Family Development

The coaching relationship extends into the home. Families reinforce coach-authored direction, creating continuity across academy, competition, and daily life.

```text
Level 1
Digital Coaching Notes
↓
Level 2
Structured Athlete Development
↓
Level 3
Voice-first Coaching
↓
Level 4
Coach Presence
↓
Level 5
Coaching Intelligence
↓
Level 6
Integrated Family Development
```

---

# Long-term Product Vision

The destination is not a denser dashboard, a larger note archive, or an automated coaching engine.

MatMind becomes:

**A coach-first athlete development platform that preserves coaching knowledge, guides athlete growth, extends coaching beyond the academy, and uses AI to organize and amplify coaching expertise rather than replace it.**

In that future:

- Coaches understand athletes more clearly with less friction.
- Athletes continue learning from their coach beyond the mat.
- Competition reveals pressure truth from Day One.
- Developmental memory compounds into intelligence.
- Families reinforce coaching rather than inventing parallel systems.
- AI remains subordinate to coaching authorship.

The Coach Workspace exists so that coaching insight does not evaporate — and so that athlete development becomes intentional, continuous, and durable.

---

# Not in Scope (Yet)

The following ideas are intentionally excluded from the current roadmap. Their omission reflects prioritization, not rejection.

- AI-generated coaching (the coach remains the authority)
- Automated skill grading
- Public social feeds
- Gamification for its own sake
- Marketplace features
- Coach replacement workflows

---

# Document Status

This is a permanent Product OS roadmap.

It should be revised when product sequencing or maturity philosophy changes — not when engineering implementation details change.

Related North Star: [Coach Experience Vision](./coach-experience-vision.md)
