# ODS-EOS Promotion Bridge v1

## Status

Architecture specification. Contract only. No implementation.

Related documents:

| Document | Relationship |
|----------|--------------|
| `01-vision.md` | Philosophy: conversation, promotion, persistence |
| `02-architecture-v0.2.md` | Python persistence engine, Event Store, Projection Engine |
| `04-operational-doctrine.md` | Engineering rules for capture and facts |
| `05-knowledge-store-schema.md` | Field definitions for knowledge projections |

---

## 1. Purpose

### What is the Promotion Bridge?

The Promotion Bridge is the architectural boundary between conversational reasoning and persistent operational knowledge.

It accepts an operator-approved promotion proposal and translates it into a canonical payload suitable for the Python persistence engine. It does not reason, store data, or generate documents.

### Why does it exist?

During ODS-EOS dogfooding, the operator acted as the integration layer:

```text
Operator
    ↓
ChatGPT
    ↓
Operator manually re-enters information
    ↓
Python CLI
    ↓
Knowledge Store (v0.1 — superseded)
```

Conversation produced structured operational knowledge. The operator then retyped that knowledge into CLI commands. This duplicated effort, introduced transcription errors, and broke the separation between reasoning and persistence.

The Promotion Bridge removes the operator as integration layer.

```text
Operator
    ↓
Natural Conversation
    ↓
Promotion Bridge
    ↓
Python Persistence Engine
    ↓
Event Store
    ↓
Mission Engine
    ↓
Mission State
    ↓
Projection Engine
    ↓
Knowledge Projections · Generated Views
```

### What operational problem does it solve?

| Problem | Bridge response |
|---------|-----------------|
| Operator repeats information already stated in conversation | Conversation content flows forward as a promotion proposal; operator approves, does not re-enter |
| Reasoning layer writes directly to the store | GPT prepares proposals; Python validates and persists |
| Multiple interfaces each invent their own persistence shape | One canonical payload contract; interfaces vary, payload does not |
| Ephemeral discussion becomes durable by accident | Only explicit Promote intent crosses the bridge |

The bridge enforces the vision principle from `01-vision.md`: conversation is ephemeral; promotion is intentional; operations are persistent.

---

## 2. Responsibilities

Responsibility is split at the bridge. Neither side performs the other's work.

```text
┌─────────────────────────────────────┐
│  Conversational Layer (GPT)         │
│  Explore · Operate · Switch · Close │
│  Begin Mission · Close Mission      │
│  Promote (proposal only)            │
└─────────────────┬───────────────────┘
                  │ Promotion Bridge
                  │ (approved proposal → canonical payload → event)
┌─────────────────▼───────────────────┐
│  Persistence Layer (Python)         │
│  Validation · Event Append ·        │
│  Projection · Output                │
└─────────────────────────────────────┘
```

### GPT owns

| Responsibility | Description |
|----------------|-------------|
| Conversation | Natural dialogue with the operator |
| Reasoning | Hypothesis, analysis, synthesis, tradeoff evaluation |
| Organization | Grouping related work, surfacing structure from unstructured input |
| Extraction | Identifying decisions, investigations, risks, and other operational facts in dialogue |
| Classification | Assigning record types and operational intent |
| Operational intent | Determining whether the operator is exploring, operating, promoting, switching, or closing |
| Promotion proposal | Preparing a structured proposal when Promote intent is detected |

GPT reads Mission State and projections when needed to inform conversation. GPT does **not** write to the Event Store.

### Python owns

| Responsibility | Description |
|----------------|-------------|
| Payload validation | Structural and semantic checks on incoming canonical payloads |
| Schema validation | Enforcement of `05-knowledge-store-schema.md` projection shape |
| Event persistence | Append validated promotion events to the Event Store (with Actor) |
| ID generation | Stable, unique event and record identifiers at creation time |
| Reference integrity | Ensuring relationship fields resolve to existing projections of the expected type |
| Mission Engine | Mission lifecycle, Mission State ownership |
| Projection Engine | Derive knowledge projections and generated views from events and Mission State |
| Automation Engine | Event-driven reactions subscribed to the Event Store |
| Collectors | Ingestion of engineering signal events that do not require reasoning |

Python performs no reasoning. It accepts or rejects payloads; it does not infer facts, classify intent, or paraphrase conversation.

### Boundary rule

| Side | May | Must not |
|------|-----|----------|
| GPT | Propose | Persist, validate schema, assign authoritative IDs |
| Python | Validate, persist, generate | Reason, classify intent, interpret conversation |

---

## 3. Promotion Lifecycle

Promotion is a deliberate sequence from conversation to generated output. No stage is skipped.

```text
Conversation
        ↓
Operational Intent
        ↓
Promotion Proposal
        ↓
Operator Approval
        ↓
Canonical Payload
        ↓
Validation
        ↓
Event Append
        ↓
Mission Engine
        ↓
Mission State
        ↓
Projection Engine
        ↓
Knowledge Projections · Generated Views
```

### Stage definitions

| Stage | Owner | Description |
|-------|-------|-------------|
| **Conversation** | GPT + Operator | Ephemeral dialogue. Most content never persists. |
| **Operational Intent** | GPT | Classification of what the operator is doing (see §4). |
| **Promotion Proposal** | GPT | Structured draft of records to persist, derived from conversation. Not yet authoritative. |
| **Operator Approval** | Operator | Explicit confirmation that the proposal accurately represents operational knowledge to persist. Rejection returns to conversation. |
| **Canonical Payload** | Promotion Bridge | Approved proposal normalized to the persistence contract (see §5). |
| **Validation** | Python | Schema and reference-integrity checks per `05-knowledge-store-schema.md`. |
| **Event Append** | Python | Append promotion events to Event Store. Assign IDs and Actor for new events. |
| **Mission State** | Python Mission Engine | Update live Mission State as events arrive. |
| **Projection** | Python | Projection Engine derives knowledge projections from events and Mission State. |
| **Generated Views** | Python | EOS, mission brief, mission timeline, operational timeline, decision log, mission dashboard, and other views from projections. |

Approval is mandatory. Nothing persists without operator confirmation, consistent with `01-vision.md`.

Validation failure returns an error to the interface. The operator and GPT revise the proposal; Python does not repair invalid payloads by inference.

---

## 4. Operational Intent

During operational QA, seven intents were observed in founder workflows. Intent classification is conversational; only Promote crosses the Promotion Bridge. Begin Mission and Close Mission invoke the Mission Engine via Python but do not cross the promotion bridge unless accompanied by Promote intent.

```text
                    ┌──────────────┐
                    │ Explore      │──┐
                    └──────────────┘  │
                    ┌──────────────┐  │
                    │ Operate      │──┤
                    └──────────────┘  │   Conversational
                    ┌──────────────┐  │   (no bridge crossing)
                    │ Switch       │──┤
                    └──────────────┘  │
                    ┌──────────────┐  │
                    │ Close Mission│──┤
                    └──────────────┘  │
                    ┌──────────────┐  │
                    │ Begin Mission│──┘
                    └──────────────┘

                    ┌──────────────┐
                    │ Promote      │──────► Promotion Bridge
                    └──────────────┘
```

### Explore

Open-ended inquiry: research, brainstorming, architecture discussion, learning, hypothesis formation.

Content remains ephemeral. Explore may produce insights in conversation that are not yet operational facts. No promotion proposal is required.

### Operate

Active execution within the current context: implementation, testing, running CLI commands, reviewing generated documents, dogfooding.

Operate uses tools and may invoke Python for mechanical actions (generate EOS, refresh projections, validate event store) that do not create new atomic facts. Operate does not cross the bridge unless the operator explicitly promotes outcomes.

### Promote

The operator decides that specific knowledge must become durable operational memory: a decision, investigation, parking-lot item, risk, doctrine, insight, boundary update, or session linkage.

GPT extracts and classifies the facts, prepares a promotion proposal, and presents it for approval. Only after approval does the bridge emit a canonical payload.

### Switch

Change of operational context: different repository, project, or mission focus.

Switch is navigational. It may coordinate with Python Mission Engine to change active mission context, but switching context is not the same as promoting facts. Deferred items discovered during a switch are promoted only when Promote intent is explicit.

### Begin Mission

Open a Mission Session for a mission. Emits `mission.begin` via Python Mission Engine. Initializes Mission State. May trigger mission brief projection. Does not cross the Promotion Bridge unless the operator also promotes facts.

### Close Mission

End the active Mission Session. Emits `mission.close` via Python Mission Engine. Often triggers EOS projection generation. Closure may **accompany** a promotion proposal (e.g. session summary, final decisions). Close Mission itself does not cross the bridge; accompanying Promote intent does.

### Close

End a bounded unit of work within a mission: close an investigation, boundary, or QA cycle.

Close signals completion. Closure often **triggers** a promotion proposal (e.g. investigation verdict, boundary status). The Close intent itself does not cross the bridge; the resulting Promote intent and its approved payload do.

### Why only Promote crosses the bridge

| Intent | Crosses bridge? | Rationale |
|--------|-----------------|-----------|
| Explore | No | Exploration is ephemeral by design (`01-vision.md`) |
| Operate | No | Execution does not imply durable facts |
| Switch | No | Context change is not fact creation |
| Begin Mission | No | Lifecycle event via Mission Engine; not promotion |
| Close Mission | No | Lifecycle event; may accompany promotion |
| Close | No | Completion may require promotion, but Close is not promotion |
| Promote | Yes | Intentional act to persist operational knowledge as events |

The bridge exists solely to translate approved Promote intent into canonical payloads. All other intents remain in the conversational layer or invoke Python for non-persistent mechanical operations.

---

## 5. Canonical Payload

The canonical payload is the stable contract between the Promotion Bridge and the Python persistence engine. It is not conversation text. It is a structured, validation-ready representation of records to project from promotion events.

Field-level definitions live in `05-knowledge-store-schema.md`. This section defines payload **composition** only. Python appends events; the Projection Engine derives records matching this schema.

### Payload structure

```text
Canonical Payload
├── Project Context
├── Session
├── Atomic Records
└── Metadata
```

### Project Context

Situational anchors for the promotion: active repository, project identifier, and any scope needed to resolve references. Ensures records are attributed to the correct operational context.

Does not duplicate atomic facts. Provides placement, not content.

### Session

The Mission Session container for the current work period. A payload may create a new Session projection, update an existing Session (status, `endedAt`, relationship arrays), or reference an active Session by `id`. Session boundaries align with Begin Mission and Close Mission events.

Session remains a container per `05-knowledge-store-schema.md` and `04-operational-doctrine.md`. The payload links atomic records to the Session; it does not embed fact fields in `Session.summary`.

### Atomic Records

Zero or more typed records to create or update:

Decision, Investigation, Boundary, QA Run, Parking Lot Item, Doctrine, Insight, Risk.

Each record conforms to schema field requirements. New records omit `id` (Python assigns). Updates include existing `id`. Fact promotion across types (e.g. Insight → Investigation) creates a new record and links to the prior record; types are not changed in place.

### Metadata

Promotion traceability: source interface (ChatGPT, CLI, Cursor, etc.) as **Actor**, proposal timestamp, operator approval marker, and optional correlation identifier linking proposal to conversation turn.

Metadata supports audit and debugging. It is not rendered in generated operational documents unless a generator explicitly includes it.

### Validation expectations

Python rejects payloads that:

- Violate schema required fields or enums
- Break reference integrity rules in `05-knowledge-store-schema.md`
- Embed atomic fact content in `Session.summary`
- Duplicate facts already present under different IDs without explicit amendment semantics

---

## 6. Future Interfaces

The Promotion Bridge is interface-agnostic. The payload contract is stable; the surface that produces and approves promotion proposals is not.

```text
┌─────────┐ ┌─────────┐ ┌───────┐ ┌────────┐ ┌───────┐ ┌────────┐ ┌─────┐
│   CLI   │ │ ChatGPT │ │ Voice │ │ Mobile │ │ Slack │ │ Cursor │ │ API │
└────┬────┘ └────┬────┘ └───┬───┘ └───┬────┘ └───┬───┘ └───┬────┘ └──┬──┘
     │           │          │         │          │         │         │
     └───────────┴──────────┴─────────┴──────────┴─────────┴─────────┘
                                    │
                          Promotion Bridge
                          (same payload contract)
                                    │
                          Python Persistence Engine
                                    │
                              Event Store
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            Mission Engine                  Automation Engine
                    │                               │
            Mission State                         │
                    │                               │
            Projection Engine  ←────────────────────┘
```

| Interface | Role |
|-----------|------|
| **ChatGPT** | Primary conversational reasoning and promotion proposal surface |
| **CLI** | Direct payload submission for scripted or operator-initiated promotion |
| **Cursor** | In-IDE conversation with promotion at session boundaries |
| **Voice** | Spoken conversation; approval via voice or companion UI |
| **Mobile** | Capture and approve on the move |
| **Slack** | Team-visible promotion approval workflows |
| **API** | Programmatic integration with external systems |

Adding an interface requires:

1. Conversation or input capture on that surface
2. Promotion proposal presentation and operator approval
3. Emission of canonical payload to Python

Adding an interface does **not** require changes to projection schema semantics, event validation rules, or projection rules—only a new adapter that speaks the payload contract.

---

## 7. Non-Goals

The Promotion Bridge does **not**:

| Non-goal | Clarification |
|----------|---------------|
| Replace ChatGPT | GPT remains the conversational reasoning layer |
| Replace Python | Python remains the event store, validation, projection, and automation engine |
| Replace the schema | `05-knowledge-store-schema.md` remains authoritative for projection field shape |
| Perform persistence | Bridge translates; Python appends events |
| Become another event store | No intermediate durable state; approved payloads flow to the single Event Store |
| Auto-promote conversation | Nothing persists without operator approval |
| Generate documents | Projection Engine and view renderers remain in Python, reading from events and projections |

The bridge has one job: translate approved operational intent into canonical payloads.

---

## 8. Architecture Principles

These principles govern all conversational interfaces and bridge implementations.

1. **Conversation is ephemeral.** Most dialogue never persists. Explore and Operate do not imply storage.

2. **Promotion is intentional.** Only explicit Promote intent, with operator approval, creates durable records.

3. **Operations are persistent.** Once promoted, validated, and appended as events, knowledge lives in projections until amended through the same bridge contract.

4. **Events are canonical.** The Event Store is the source of truth. Every event carries an Actor. Knowledge projections are derived. Mission State is live runtime state owned by the Mission Engine.

5. **The operator never repeats information already present in the conversation.** The bridge carries extracted structure forward; the operator approves or corrects, not retypes.

6. **Interfaces evolve.** New surfaces (voice, mobile, Slack) attach to the bridge without redesigning persistence.

7. **Contracts remain stable.** Canonical payload shape and projection schema validation rules change only through versioned schema documents, not per-interface ad hoc formats.

8. **Mission Sessions bound promotion context.** Facts promoted during a mission session belong to that session's projection, not to a calendar day.

---

## Document Index

| Section | Question answered |
|---------|-------------------|
| §1 Purpose | What, why, which problem |
| §2 Responsibilities | GPT vs Python boundary |
| §3 Promotion Lifecycle | End-to-end flow |
| §4 Operational Intent | Explore, Operate, Promote, Switch, Begin Mission, Close Mission, Close |
| §5 Canonical Payload | Conceptual payload composition |
| §6 Future Interfaces | Interface stability vs contract stability |
| §7 Non-Goals | Explicit exclusions |
| §8 Architecture Principles | Governing rules |
