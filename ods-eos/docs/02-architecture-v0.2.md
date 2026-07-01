# ODS-EOS Architecture v0.2

## Version History

| Version | Document | Model |
|---------|----------|-------|
| v0.1 | `02-architecture-v1.md` (superseded) | Linear pipeline: Collectors → Knowledge Store → Generators |
| v0.2 | This document | Event-driven: Event Store → Mission Engine → Projection Engine; Automation subscribes to events |

Evidence and rationale: `00-architecture-review-2026-06-30.md`. Change log: `07-changelog.md`.

---

## Overview

ODS-EOS v0.2 is an event-driven operational system organized around **Missions**. The operator works in **Mission Sessions** (Begin Mission → work → Close Mission), independent of calendar days. All operational activity is recorded as **immutable events** in the **Event Store**. Every event carries an **Actor**. **Mission State** is live operational runtime state owned by the **Mission Engine**. Knowledge records and generated documents are **projections** produced by the **Projection Engine**, which consumes Mission State and events.

Python owns the Event Store, validation, persistence, Mission Engine, Projection Engine, and Automation Engine. ChatGPT owns conversational reasoning. Notion owns executive visualization.

```text
Operator
    ↓
Interfaces (ChatGPT · CLI · Cursor · …)
    ↓
Event Store  ←── canonical source of truth
    ├── Mission Engine
    │       ↓
    │   Mission State (heartbeat — live runtime state)
    │       ↓
    └── Projection Engine
            ├── Knowledge Projections (typed records)
            └── Generated Views (EOS · Mission Brief · Timeline · Weekly Review · Notion · Portfolio)

Event Store
    ↓
Automation Engine  ←── subscribes to events; does not depend on rendered documents
    ↓
Git · Build · TestFlight · Notion · Notifications
```

The Event Store is canonical. Mission Engine owns Mission State. Projection Engine consumes Mission State and events. Automation reacts to events directly.

---

## System Flow

```text
Conversation
        ↓
Intent
        ↓
Promotion
        ↓
Event Store
        ↓
Mission Engine
        ↓
Mission State (Heartbeat)
        ↓
Projection Engine
        ├── EOS · Mission Brief · Weekly Review
        ├── Knowledge Views · Notion · Portfolio
        └── Mission Timeline · Operational Timeline
```

Automation runs in parallel, subscribed to the Event Store:

```text
Event Store
        ↓
Automation Engine
        ↓
Git · Build · TestFlight · Notion · Notifications
```

### Event ingestion paths

Two paths append events to the Event Store:

| Path | Source | Examples |
|------|--------|----------|
| **Promotion** | Approved promotion proposals via Promotion Bridge | Decision promoted, investigation closed, doctrine amended |
| **Collection** | Automated collectors and CLI mechanical operations | Git status, commit, build, QA run, deployment |

Both paths validate before append. Neither path writes projections directly.

---

## Engines

### Mission Engine

Owns mission lifecycle, session boundaries, and **Mission State** — live operational runtime state continuously updated while a mission is active.

| Responsibility | Description |
|----------------|-------------|
| Mission registry | Active and historical missions |
| Mission Session lifecycle | Begin Mission opens a session; Close Mission ends it |
| Context binding | Associates events with the active mission and mission session |
| Mission switching | Coordinates Switch intent without losing mission-scoped state |
| **Mission State** | Live heartbeat: current objective, question, phase, repository state, confidence |

Mission State is not a generated report. The Mission Engine updates it continuously as events arrive. The Projection Engine reads Mission State; it does not own or compute it.

A **Mission** is a bounded body of operational work with a stable identifier (e.g. architecture review, feature delivery, investigation closure). A **Mission Session** is one continuous period of work on a mission. Multiple mission sessions may occur in one calendar day. One mission may span multiple calendar days.

Mission Sessions replace Daily Sessions as the operator's natural work unit.

### Event Store

The canonical, append-only source of truth.

| Property | Rule |
|----------|------|
| Immutability | Events are never modified or deleted |
| Append-only | All writes are new events |
| Mission-scoped | Every event carries mission context |
| **Actor** | Every event carries an Actor identifying who or what produced it |
| Human-inspectable | JSON on local disk in v0.2; versionable |
| Validated | Schema and reference checks before append |

### Actors

Every event includes an **Actor** — the entity that produced the event. Actors enable operational analytics: automation percentage, manual work remaining, AI participation, workflow bottlenecks.

| Actor | Role |
|-------|------|
| Israel | Operator |
| ChatGPT | Conversational reasoning |
| Python | Persistence, validation, engines |
| Cursor | In-IDE interface |
| Codex | Code generation |
| Git | Repository operations |
| Apple | Build, TestFlight, deployment |

Future interfaces (Voice, Slack, Mobile) are additional Actors. Actor is an architectural field on every event; implementation is deferred.

Event categories include:

- **Mission lifecycle** — `mission.begin`, `mission.close`, `mission.switch`
- **Promotion** — `fact.promoted`, `fact.amended`, `fact.closed`
- **Repository operations** — `git.status`, `git.commit`, `git.tag`, `build.completed`, `qa.completed`, `deploy.completed`, `testflight.submitted`
- **Operational capture** — `session.summary`, `confidence.updated`

Multiple occurrences of repository events within a single Mission Session are expected and supported.

### Projection Engine

Derives knowledge projections and generated views by consuming the **Event Store** and **Mission State**. Does not own Mission State.

| Projection | Description |
|------------|-------------|
| **Knowledge projections** | Typed records matching `05-knowledge-store-schema.md` — Decision, Investigation, Session, etc. |
| **Generated views** | EOS, Mission Brief, Weekly Review, Knowledge Views, Notion sync, Portfolio |

Projections are regenerable. Deleting a projection and rebuilding from events and Mission State must yield the same result.

The Projection Engine does not reason. It applies deterministic rules to event sequences and reads current Mission State.

### Automation Engine

Subscribes directly to the Event Store. Reacts immediately to events. Never depends on rendered documents.

| Responsibility | Description |
|----------------|-------------|
| Event reaction | Trigger operations when specific event types arrive |
| Repository collection | Git status, commits, tags on event or schedule |
| Build and deploy | Build, QA, TestFlight in response to repository events |
| External sync | Notion updates, notifications |
| Validation | Store integrity checks on schedule or after writes |

Automation depends on **events**, not on generated views. Examples:

```text
git.commit
    ↓
Repository update · Mission State refresh

mission.close
    ↓
Generate EOS · Update Mission State · Update Notion · Prepare Mission Brief
```

Automation reduces operator work. It does not replace promotion approval or engineering judgment.

---

## Mission State

Each Mission owns exactly one **live Mission State** — operational runtime state owned by the Mission Engine and continuously updated while the mission is active.

| Field | Source |
|-------|--------|
| Current Objective | Latest `mission.objective` or promoted fact event |
| Current Question | Latest open investigation or explicit question event |
| Current Phase | Latest phase event or derived from mission lifecycle |
| Current Branch | Latest `git.status` or branch event |
| Latest Commit | Latest `git.commit` event |
| Repository Status | Latest `git.status` event |
| Latest Build | Latest `build.completed` event |
| Latest QA | Latest `qa.completed` event |
| Latest EOS | Latest generated EOS projection timestamp |
| Confidence | Latest `confidence.updated` event |

Mission State is live runtime state, not a generated report. The Mission Engine owns and updates it as events arrive. Interfaces read it. The Projection Engine consumes it when rendering views. Mission State is never authored directly by interfaces.

---

## Layer Responsibilities

### Operator

Invokes commands, begins and closes missions, approves promotions, reviews generated views. Does not edit the Event Store or projections directly in normal operation.

### Interfaces

ChatGPT (primary), CLI, Cursor, and future surfaces. Interfaces capture conversation, classify intent, present promotion proposals, and invoke Python for mechanical operations. Interfaces do not persist canonical data.

### ChatGPT (Reasoning Layer)

| Owns | Does not own |
|------|--------------|
| Conversation and synthesis | Event persistence |
| Intent classification | Schema validation |
| Promotion proposals | ID assignment |
| Operational reasoning | Projection generation |

GPT reads Mission State and projections for context. GPT proposes; Python persists.

### Python (Persistence and Engine Layer)

| Owns | Does not own |
|------|--------------|
| Event Store read/write | Reasoning or intent classification |
| Event validation | Promotion approval |
| Mission Engine and Mission State | Conversation |
| Projection Engine | Inference to repair invalid payloads |
| Automation Engine (event-driven) | Direct operator-facing dialogue |
| ID generation for new events and projected records | |

### Notion (Visualization Layer)

Executive dashboards and knowledge views rendered from projections. Notion is not canonical. Projections sync outward; Notion does not write back to the Event Store in v0.2.

---

## Promotion Bridge Integration

Approved promotion proposals become events in the Event Store. The Promotion Bridge does not write knowledge records directly.

```text
Conversation
        ↓
Intent (Promote)
        ↓
Promotion Proposal
        ↓
Operator Approval
        ↓
Canonical Payload
        ↓
Event Append (Promotion)
        ↓
Mission Engine
        ↓
Mission State
        ↓
Projection Engine
        ↓
Knowledge Projections + Generated Views
```

See `06-promotion-bridge-v1.md` for the full bridge contract.

---

## Generated Views

All operational documents are projections. None are authoritative sources of truth. The Projection Engine consumes Mission State and the Event Store to produce them.

| View | Scope | Trigger |
|------|-------|---------|
| EOS (End of Session) | Mission Session | `mission.close` or on demand |
| Mission Brief | Mission | `mission.begin` or on demand |
| Weekly Review | Cross-mission | Scheduled |
| Decision Log | Mission or cross-mission | On demand |
| Mission Dashboard | Per mission | Continuous projection |
| Knowledge Views | Typed fact projections | On demand |
| Notion · Portfolio | Executive visualization | Automation or on demand |

Generators are projection renderers. They read Mission State and derived knowledge projections; they do not read conversation.

---

## Timelines

Two distinct timeline concepts. Do not merge them.

### Operational Timeline

Represents movement **between missions** — the operator's portfolio of active and completed work.

```text
ODS OS  →  MatMind  →  Performance OS  →  Career
```

Cross-mission. Surfaces where attention moves across the operator's mission portfolio.

### Mission Timeline

Represents **events within one Mission Session** — what happened during a bounded work period.

```text
Mission Start  →  Commit  →  Decision  →  QA  →  Build  →  Commit  →  Mission Close
```

Mission-scoped. Derived from the event sequence for a single mission session. Distinct from the Operational Timeline.

---

## Boundaries

| Boundary | Rule |
|----------|------|
| Interface ↔ Mission Engine | Interfaces invoke mission lifecycle; Mission Engine emits lifecycle events and owns Mission State |
| Interface ↔ Promotion Bridge | Approved proposals become events; bridge does not write projections |
| Promotion Bridge ↔ Event Store | Python validates and appends; no direct projection writes |
| Collectors ↔ Event Store | Collectors emit events with Actor; they do not write projections |
| Event Store ↔ Mission Engine | Mission Engine consumes events; updates Mission State continuously |
| Mission Engine ↔ Projection Engine | Projection Engine reads Mission State and events; does not own Mission State |
| Event Store ↔ Automation Engine | Automation subscribes to events; never depends on rendered documents |
| Projection Engine ↔ Views | Views are rendered output; not fed back as events in v0.2 |
| GPT ↔ Python | GPT proposes; Python validates and appends. No GPT writes to Event Store. |

---

## v0.1 → v0.2 Migration

v0.1 implemented a subset of this architecture:

```text
v0.1 (implemented)                 v0.2 (target)
─────────────────────────────      ─────────────────────────────
Knowledge Store (canonical)   →    Event Store (canonical)
Records written by collectors →    Events appended; records projected
Session = time window         →    Mission Session = Begin/Close boundary
Generators read store         →    Projection Engine derives then renders
No Mission State              →    Mission State (Mission Engine — live runtime)
```

The v0.1 JSON knowledge store remains usable as an interim projection cache during migration. New writes target the Event Store. The Projection Engine can emit knowledge-store-shaped JSON for backward compatibility with existing generators until generators are updated to read projections directly.

---

## v0.2 Scope

In scope:

- Event Store contract and append semantics (including Actor on every event)
- Mission Engine lifecycle (Begin Mission, Close Mission) and Mission State ownership
- Projection Engine for knowledge projections and generated views (consumes Mission State)
- Event-driven Automation Engine (subscribes to Event Store)
- Promotion events via existing Promotion Bridge contract
- Repository operation events (git, build, QA)
- EOS and Mission Brief as mission-scoped generated views
- CLI as primary entry point

Out of scope for v0.2:

- Notion sync
- Multi-operator collaboration
- Cloud event store
- Full Automation Engine scheduling
- Analytics and cross-mission dashboards
- Voice, mobile, Slack interfaces

---

## Related Documents

| Document | Relationship |
|----------|--------------|
| `01-vision.md` | Philosophy and goals |
| `04-operational-doctrine.md` | Engineering rules |
| `05-knowledge-store-schema.md` | Knowledge projection field definitions |
| `06-promotion-bridge-v1.md` | Conversation-to-event bridge |
| `00-architecture-review-2026-06-30.md` | Evidence for this refactor |
| `07-changelog.md` | Version history and change rationale |
