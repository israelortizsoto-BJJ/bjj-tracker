# ODS-EOS Roadmap

Architectural milestones in dependency order. Each milestone closes a boundary before the next begins. See `04-operational-doctrine.md`: one boundary at a time.

Evidence basis: `00-architecture-review-2026-06-30.md`.

---

## Milestone Progression

```text
Foundation
    ↓
Event Engine
    ↓
Mission Engine
    ↓
Projection Engine
    ↓
Automation
    ↓
Executive Dashboards
    ↓
Analytics
    ↓
Multi-Interface Support
```

---

## Foundation

**Goal:** Prove the persistence and generation stack with a working CLI.

**Delivers:**

* CLI command dispatch
* JSON persistence (interim knowledge projection shape)
* Basic collectors (session, activity)
* EOS and Morning Brief generators
* Store validation

**Status:** Largely complete in v0.1 implementation. Serves as the base for engine extraction.

---

## Event Engine

**Goal:** Establish the Event Store as the canonical source of truth.

**Delivers:**

* Append-only event store contract
* Event validation and schema
* Promotion events (via Promotion Bridge)
* Repository operation events: git status, commit, tag, build, QA, deployment, TestFlight
* Event ingestion from collectors and CLI

**Replaces:** Direct record writes to knowledge store as canonical path.

---

## Mission Engine

**Goal:** Organize all work around missions and mission sessions. Own live Mission State.

**Delivers:**

* Mission registry
* Begin Mission / Close Mission lifecycle
* Mission Session boundaries (independent of calendar days)
* Mission-scoped event attribution
* Mission switching without data loss
* Mission State (heartbeat — live runtime state)

**Replaces:** Daily session as the primary organizational unit. Mission State as a Projection Engine output.

---

## Projection Engine

**Goal:** Derive knowledge projections and generated views from events and Mission State.

**Delivers:**

* Knowledge projections (typed records per `05-knowledge-store-schema.md`)
* EOS, Mission Brief, Mission Timeline, Operational Timeline, Decision Log as generated views
* Projection refresh on event append (consumes Mission State)
* Backward-compatible knowledge-store-shaped JSON for existing generators

**Replaces:** Generators reading the knowledge store as canonical source. Mission State as a projection output.

---

## Automation

**Goal:** Reduce operator work by reacting directly to events.

**Delivers:**

* Event-driven subscriptions to the Event Store
* Repository collection on `git.commit`, `mission.close`, and related events
* Build, QA, TestFlight reactions
* Notion sync and notification triggers
* Store validation on schedule
* Promotion Bridge automation (remove operator as integration layer)

**Principle:** Automation subscribes to events, never depends on rendered documents. Automation reduces operator work; it does not replace judgment or promotion approval.

---

## Executive Dashboards

**Goal:** Surface Mission State and cross-mission visibility for leadership.

**Delivers:**

* Mission Dashboard projection
* Notion sync as visualization layer
* Weekly Review generation
* Attention surfacing (what requires action now)

---

## Analytics

**Goal:** Derive patterns from event history across missions.

**Delivers:**

* Cross-mission operational timeline
* Mission timeline event sequences
* Decision and investigation velocity
* Build and QA trends
* Confidence tracking over time
* Actor-based operational metrics (automation percentage, AI participation)

---

## Multi-Interface Support

**Goal:** Attach new operator surfaces without redesigning persistence.

**Delivers:**

* Voice, mobile, Slack interfaces
* Same Promotion Bridge payload contract
* Interface-specific adapters only; no schema changes per interface

See `06-promotion-bridge-v1.md` §6 Future Interfaces.

---

## Deferred (Not on Critical Path)

* Cloud sync and multi-operator collaboration
* Full-text search across projections
* Knowledge linking and cross-document references (moves under Projection Engine or Analytics when prioritized)
