# ODS-EOS Operational Doctrine

Engineering rules for building and operating ODS-EOS. These apply to all contributors and to the system itself.

## One Fact, One Place

A durable engineering fact exists in exactly one atomic record in the knowledge projections. Containers reference facts by `id`; they do not embed them. Narrative fields on container records are not authoritative.

Mission Session is a container. Decision, Investigation, Boundary, QA Run, Parking Lot Item, Doctrine, Insight, and Risk are atomic facts. See `05-knowledge-store-schema.md` for field definitions. Facts are derived from events; the Event Store is canonical.

## Evidence Before Opinion

Decisions require observable evidence: logs, diffs, test output, or collected records. Investigations require evidence before a verdict. Boundaries close on evidence from supporting investigations and QA runs. QA runs require evidence when the result is `fail` or `partial`. Assertions without evidence are hypotheses until verified. Generated documents must cite their source events and derived projections.

## One Boundary at a Time

Implement, test, and close one architectural boundary before starting the next. Do not wire collectors and projections in the same change unless the boundary between them is already stable. Partial integrations across boundaries create untraceable failures.

## Architecture Before Implementation

Read `02-architecture-v0.2.md` before writing code. ODS OS v0.2 architecture is frozen per `04-operational-doctrine.md` § Architecture Freeze. If implementation requires a change to the architecture, the change must meet freeze criteria (contradictory operational evidence or demonstrated boundary failure); otherwise it becomes a Parking Lot item.

## Documentation Is Generated, Not Authored

Operational documents (EOS reports, morning briefs, weekly reviews, timelines, decision logs, recaps, handovers, and investigation reports) are projections over the Event Store. Do not hand-write these documents and backfill events to match. Hand-authored markdown in `docs/` is migration input or non-authoritative reference until decomposed into events. Events are canonical; projections and documents are views.

## Capture Discipline

Collectors emit events at capture time. When a mission session produces a decision, investigation, parking-lot item, risk, doctrine amendment, or insight, the collector or promotion path writes the typed event first; the Projection Engine derives the atomic record and links it from the Mission Session by `id`.

Deferral, commitment, inquiry, risk, and planning intent must not be paraphrased into `Session.summary`. Collectors must not write prose blobs that duplicate atomic fact fields.

## Never Reopen a Closed Boundary Without Contradictory Evidence

A boundary is closed when it is implemented, tested, and documented. Reopening it—refactoring interfaces, changing event schemas, or altering projection contracts—requires contradictory evidence: a demonstrated failure that cannot be fixed within the existing boundary. Convenience is not evidence.

## Automation Reinforces Engineering Discipline

Automate repetitive, reliable operations: event collection, projection refresh, document generation, store validation. Automation subscribes to the Event Store and reacts to events directly — it never depends on rendered documents. Automation does not replace judgment; it removes manual steps that introduce inconsistency. If an automated step fails, fix the automation or the underlying data—do not bypass it manually.

## Minimize Manual Repository Operations Where Automation Is Reliable

Prefer scripted or CLI-driven workflows over ad-hoc file edits for event ingestion, projection refresh, and document generation. Manual edits to generated markdown are exceptions that must be justified and reconciled on the next collection cycle. Manual edits to projected atomic records are exceptions that must be justified and reconciled on the next projection cycle.

---

## Governing Principles (v0.2)

These principles derive from founder dogfooding on 2026-06-30. See `00-architecture-review-2026-06-30.md`.

### Mission First

Work organizes around Missions, not calendar days. Sessions, briefs, EOS, events, and conversational context belong to missions. Implementation and interfaces must respect mission scope before date scope.

### Events are Canonical

The Event Store is the single source of truth. Knowledge records and generated documents are projections derived from events. Mission State is live runtime state owned by the Mission Engine. Nothing bypasses the event log to write authoritative state.

### Mission State is Live Runtime State

Each mission owns one live Mission State: current objective, question, phase, branch, latest commit, repository status, latest build, latest QA, latest EOS, and confidence. The Mission Engine owns and continuously updates Mission State as events arrive. Mission State is not a generated report. The Projection Engine consumes Mission State when rendering views; it does not own Mission State. Mission State is never authored directly by interfaces.

### Operator Flow is Sacred

Begin Mission, work, promote, close. The operator's natural rhythm must not be interrupted by documentation overhead, manual data entry, or reconstruction. Interfaces serve the operator flow; the operator does not serve the interfaces.

### Automation Reduces Operator Work

Automate collection, event-driven reactions, and validation. The operator approves promotions and exercises judgment. The system handles everything reliable and repetitive—including removing the operator as integration layer between conversation and persistence. Automation subscribes to events; it does not depend on rendered documents.

### Mission Sessions Replace Daily Sessions

A Mission Session begins with Begin Mission and ends with Close Mission. Mission Sessions are independent of calendar days. Multiple mission sessions may occur in one day. Do not anchor operational rhythm to midnight or calendar boundaries.

---

## Rejected Patterns

The following patterns violate this doctrine and must not be introduced:

- **Session summary as fact store** — embedding decisions, investigations, parking-lot items, risks, or planning intent in `Session.summary`.
- **Compound markdown as source of truth** — monolithic documents that mix investigations, boundary catalogs, evidence matrices, and QA protocols without corresponding atomic projection records.
- **Knowledge Investment as a record type** — deliberate learning is represented as one or more Mission Sessions linked to atomic outcomes (Doctrine, Insight, Investigation, Decision), not as a separate record class.
- **Direct projection writes** — updating knowledge records or Mission State without appending the originating event.
- **Calendar-day anchoring** — organizing EOS, mission briefs, or operational context by date when mission scope is known.
- **Automation depending on rendered documents** — automation must react to events, not read generated views as triggers.

---

## Architecture Freeze

ODS OS v0.2 architecture is **frozen** after the 2026-06-30 final architecture pass.

Future architecture changes require one of:

- **Contradictory operational evidence** — demonstrated failure during real-world dogfooding that cannot be resolved within the frozen model
- **Demonstrated implementation boundary failure** — a documented boundary in `02-architecture-v0.2.md` cannot be implemented as specified

New ideas become **Parking Lot items**. Implementation proceeds against the frozen architecture.

The objective is to prevent architecture churn. Validate the system through implementation and dogfooding, not continued redesign.
