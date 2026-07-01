# ODS-EOS Architecture Review — 2026-06-30

> **Status:** Engineering review artifact. Not long-term doctrine.
>
> This document records what founder dogfooding on 2026-06-30 proved about the architecture and why v0.2 evolved from v0.1. It is historical context for the refactor captured in documents `01`–`06` and `07-changelog.md`.

---

## Context

On 2026-06-30, the founder operated ODS-EOS across a full working day spanning multiple repositories, context switches, builds, QA cycles, and conversational capture sessions. The v0.1 architecture—a linear pipeline from collectors through a JSON knowledge store to markdown generators—worked mechanically but did not match how the operator actually organized work.

This review captures operational evidence and drives the controlled architectural refactor to v0.2. It is not a greenfield redesign.

---

## What Was Learned

### Mission is the primary organizational unit

Work was not organized by calendar day. It was organized by **Mission**: a bounded body of operational work with a clear objective (e.g. architecture review, feature implementation, investigation closure).

Within a single calendar day, the operator:

- Began and closed multiple missions
- Switched between missions without closing the day
- Expected morning briefs, EOS reports, and conversational context to belong to the active mission—not to "today"

Sessions, briefs, EOS, and conversational state all naturally clustered under missions, not under dates.

### Mission Sessions replace Daily Sessions

The v0.1 `Session` record anchored work to time windows that implicitly mapped to days. In practice, the operator's rhythm was:

1. **Begin Mission** — open operational context for a mission
2. Work — implementation, conversation, promotion, repository operations
3. **Close Mission** — end the bounded mission session

Mission Sessions are independent of calendar days. Multiple mission sessions may occur in one day. One mission may span multiple calendar days. The Begin/Close boundary is the operator's natural unit of work—not midnight.

### Events are the natural source of truth

Throughout the day, discrete things happened:

- Git status snapshots
- Commits and tags
- Builds and QA runs
- Promotions of decisions and investigations
- Mission begin/close
- Context switches

These are **events**: immutable facts about what occurred. The operator did not think in terms of "update the session record's relationship arrays." They thought in terms of "a commit happened," "QA passed," "I promoted a decision."

Mutable records in a knowledge store are useful projections. They should be derived from events, not authored directly as the canonical layer.

### Mission State is the operational heartbeat

When resuming work or switching missions, the operator needed immediate answers:

- What is the current objective?
- What question am I answering?
- What phase and branch am I on?
- What was the latest commit, build, and QA?
- What was the last EOS?
- How confident am I in the current state?

This is **Mission State**: one live operational snapshot per mission, owned by the Mission Engine and continuously updated from events—not manually maintained and not a generated report.

### Documents are views, not sources of truth

EOS, morning briefs, weekly reviews, timelines, decision logs, and dashboards were consumed as generated output. The operator did not want to author them. They wanted the system to produce them from what actually happened.

The v0.1 doctrine already stated "documentation is generated, not authored." Operational evidence confirmed this and extended it: all operational documents are **projections** over an event store.

### Repository operations are high-frequency events

A single mission session included multiple git operations, builds, and QA cycles. Treating these as rare atomic records updated in place does not match operational reality. Each occurrence is an event. Projections (Mission State, EOS, timeline) surface the latest relevant occurrence.

### Layer separation held

The three-layer separation validated in v0.1 held under real usage:

| Layer | Role | Evidence |
|-------|------|----------|
| ChatGPT | Reasoning, conversation, promotion proposals | Operator relied on GPT for synthesis and extraction |
| Python | Validation, persistence, projection | CLI and store remained authoritative |
| Notion | Visualization (future) | Not used in today's session; separation remains correct |

Python must own the event store, validation, persistence, and projection generation. Notion remains a visualization layer. ChatGPT remains the reasoning layer.

---

## Assumptions Validated

| Assumption | Evidence |
|------------|----------|
| Conversation is ephemeral; promotion is intentional | Operator promoted selectively; most dialogue did not persist |
| Python is the canonical persistence engine | All durable writes went through CLI/Python |
| Documents are generated views | Operator consumed generated EOS and briefs without hand-authoring |
| GPT vs Python boundary is correct | GPT proposed; operator approved; Python persisted |
| Atomic facts (Decision, Investigation, Risk, etc.) are the right granularity | Promoted facts mapped cleanly to typed records |
| Promotion Bridge concept is needed | Operator acted as integration layer before bridge automation |
| One fact, one place | Duplicated facts in session summaries caused confusion |
| Operator flow must not be interrupted by documentation | Reconstruction overhead was the primary pain point |

---

## Assumptions Disproven or Insufficient

| Assumption | What happened | Architectural response |
|------------|---------------|------------------------|
| **Session = daily work unit** | Operator switched missions multiple times per day; sessions are mission-scoped, not day-scoped | Mission Sessions replace Daily Sessions |
| **Knowledge Store is the canonical source of truth** | Operator thinks in events ("a commit happened"); mutable records are projections | Event Store becomes canonical; knowledge records become event-derived projections |
| **Linear pipeline is sufficient** | Collection → store → generation is too rigid for mission switching, state heartbeat, and multi-occurrence repo ops | Event-driven architecture with Projection Engine |
| **Calendar day anchors operational rhythm** | Morning brief and EOS belong to missions, not dates | Mission-centric organization |
| **Collectors write records; generators read records** | Repository ops need append-only event log with derived state | Collectors emit events; Projection Engine derives records and state |
| **Session container holds operational context** | Context spans objective, phase, branch, build, QA, confidence—beyond session fields | Mission State owned by Mission Engine |

---

## Why the Architecture Evolved

v0.1 proved the persistence and generation stack works. v0.2 reframes **what is canonical** and **what organizes work**:

```text
v0.1                              v0.2
────────────────────────────────  ────────────────────────────────
Daily Session                     Mission Session (Begin / Close)
Knowledge Store (canonical)       Event Store (canonical)
Records (authored by collectors)  Projections (derived from events)
Linear pipeline                   Event-driven engines
Generators read store             Projection Engine reads events
No live operational state         Mission State (Mission Engine — live runtime)
```

The refactor preserves every working concept—promotion, atomic facts, GPT/Python separation, generated documents—and relocates them within an event-driven, mission-centric model.

---

## Concepts Preserved

- Conversation is ephemeral
- Promotion is intentional
- Operations are persistent
- GPT owns reasoning; Python owns persistence and validation; Notion owns visualization
- Promotion Bridge as the boundary between conversation and persistence
- Atomic fact record types (Decision, Investigation, Boundary, QA Run, Parking Lot Item, Doctrine, Insight, Risk)
- Containers vs atomic facts distinction
- One fact, one place
- Evidence before opinion
- Documents are generated, not authored
- Schema field definitions in `05-knowledge-store-schema.md` (unchanged in v0.2)
- Operational intents: Explore, Operate, Promote, Switch, Close
- Operator approval before persistence

---

## Concepts Superseded

| Superseded concept | Replaced by | Notes |
|--------------------|-------------|-------|
| Daily Session as primary work unit | Mission Session | Session record type preserved; semantics evolve |
| Knowledge Store as canonical source of truth | Event Store as canonical; knowledge records as projections | JSON store may remain interim persistence shape |
| Linear Collectors → Store → Generators pipeline | Event-driven: ingest → Event Store → Projection Engine → views | Collectors become event emitters |
| Calendar-day anchoring for briefs and EOS | Mission anchoring | Generators become projection renderers |
| Session as operational context holder | Mission State (Mission Engine — live runtime) | Session remains a container; state is separate, owned by Mission Engine |
| Direct record mutation as primary write path | Event append + projection derivation | Promotions emit events; records update via projections |
| "Knowledge Store" as architectural term for canonical layer | "Event Store" for canonical; "Knowledge projections" for derived records | Terminology shift; schema fields unchanged in v0.2 |

---

## Documents Updated

| Document | Change scope |
|----------|--------------|
| `01-vision.md` | Mission-centric wording, event-driven framing, minimal structural change |
| `02-architecture-v0.2.md` | Major refactor: Mission Engine, Event Store, Projection Engine, Mission State, Automation Engine |
| `03-roadmap.md` | Architectural milestones instead of feature lists |
| `04-operational-doctrine.md` | Six new governing principles |
| `05-knowledge-store-schema.md` | Evolution notes toward Event Store; no field redesign |
| `06-promotion-bridge-v1.md` | Updated flow diagrams |
| `07-changelog.md` | Version history and per-document change rationale |

---

## Out of Scope for This Review

- Python implementation
- Automation scripts
- Schema field additions or removals
- Notion integration
- New record types

Implementation proceeds against the frozen architecture without further redesign. See `04-operational-doctrine.md` § Architecture Freeze and `07-changelog.md` § v0.2 Freeze Pass.
