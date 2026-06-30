# ODS-EOS Knowledge Store Schema v0.2

## Purpose

This document defines the structured records stored in the ODS-EOS knowledge store. Collectors write these records; generators read them. The schema is the contract between collection and document generation.

Scope: v0.2. JSON on local disk. No database. No cloud sync.

---

## Store Envelope

The knowledge store is a single JSON document with a top-level envelope and typed record collections.

| Field | Required | Description |
|-------|----------|-------------|
| `schemaVersion` | yes | Always `"0.2"` for this schema. |
| `updatedAt` | yes | ISO 8601 timestamp of the last store write. |
| `sessions` | yes | Array of Session records. May be empty. |
| `investigations` | yes | Array of Investigation records. May be empty. |
| `boundaries` | yes | Array of Boundary records. May be empty. |
| `qaRuns` | yes | Array of QA Run records. May be empty. |
| `decisions` | yes | Array of Decision records. May be empty. |
| `parkingLot` | yes | Array of Parking Lot Item records. May be empty. |
| `doctrines` | yes | Array of Doctrine records. May be empty. |
| `insights` | yes | Array of Insight records. May be empty. |
| `risks` | yes | Array of Risk records. May be empty. |

Record collections are keyed by record type. Records within a collection are identified by `id`.

---

## Principles

### Stable IDs

Every record has an `id` that never changes for the life of the record. IDs are unique within their record type. Format: lowercase alphanumeric with hyphens (e.g. `inv-20250628-session-freshness`). Collectors assign IDs at creation; generators and other records reference IDs, never titles or descriptions.

### Versioned Schema

The `schemaVersion` field on the store envelope identifies the schema in use. v0.2 implementations read and write only `schemaVersion: "0.2"`. Schema changes require a new version document; do not mutate v0.2 field semantics in place.

### Append-Only History Where Practical

Records are not deleted. Closure, deferral, and correction are expressed through status fields and timestamps. When a record is amended, set `updatedAt` and update fields in place; do not remove prior `id` values or break references from other records. If full audit history is needed later, it is added as a separate concern—not by rewriting referenced records.

### Human-Readable JSON

Field names are descriptive. Timestamps are ISO 8601 strings. Arrays and objects are indented in persisted files. Enum values are lowercase strings separated by underscores. The store must be inspectable and editable in a text editor without tooling.

### Containers vs Atomic Facts

| Classification | Record types |
|----------------|--------------|
| **Container** | Session |
| **Atomic fact** | Decision, Investigation, Boundary, QA Run, Parking Lot Item, Doctrine, Insight, Risk |

Containers group work by time and reference atomic facts by `id`. Atomic facts hold durable engineering knowledge. Generators and collectors must preserve this distinction.

### No Duplication of Facts

A fact exists in exactly one atomic record. Other records reference it by `id`. Evidence is stored once on the owning record (Investigation, QA Run, Decision, Doctrine, Insight, Risk); referencing records use `supportingEvidence` or relationship arrays of IDs. Generators resolve references at render time; they do not introduce new facts.

Container records must not duplicate atomic fact fields. `Session.summary` is an optional one-line focus label only. It must not contain decisions, investigations, parking-lot items, risks, or planning intent. Those facts belong in typed atomic records linked from the Session.

### Fact Promotion

Facts may evolve across record types by creating a new record and linking to the prior record. Do not change a record's type in place.

| From | To | Trigger |
|------|----|---------|
| Insight | Investigation | An observation requires hypothesis-driven examination |
| Insight | Doctrine | A learned model becomes a governing rule |
| Investigation | Decision | A verdict produces a commitment |
| Parking Lot Item | Investigation | Deferred work becomes active inquiry |
| Parking Lot Item | Decision | Deferred work resolves as a commitment |
| Risk | Investigation | A threat requires evidence gathering |
| Risk | Decision | A threat is accepted or mitigated by commitment |

### Documents Are Generated from Records

EOD reports and morning briefs are views over store records. No fact in a generated document may lack a corresponding store record or resolvable reference chain.

---

## Shared Types

### Evidence Reference

Used by Investigation, QA Run, Decision, Doctrine, Insight, and Risk. Points to observable source material without duplicating it.

| Field | Required | Description |
|-------|----------|-------------|
| `ref` | yes | Locator for the evidence: file path, commit hash, log path, URL, or record `id`. |
| `kind` | yes | One of: `file`, `commit`, `log`, `url`, `record`. |
| `summary` | no | Short human-readable description of what the evidence shows. |

### Record Reference

Used when one record points to another record of a specific type.

| Field | Required | Description |
|-------|----------|-------------|
| `kind` | yes | Target record type: `investigation`, `decision`, `boundary`, `qa_run`, `doctrine`, `insight`, `risk`, `parking_lot`. |
| `id` | yes | Stable `id` of the target record. |

### Timestamp Fields

All records include:

| Field | Required | Description |
|-------|----------|-------------|
| `createdAt` | yes | ISO 8601 timestamp when the record was first written. |
| `updatedAt` | yes | ISO 8601 timestamp of the last amendment. |

---

## Session

### Purpose

Represents a bounded period of engineering work. Sessions anchor EOD and morning-brief generation to a time window and group activity by reference. Session is a container, not a fact store.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable session identifier. |
| `createdAt` | string | ISO 8601 timestamp. |
| `updatedAt` | string | ISO 8601 timestamp. |
| `startedAt` | string | ISO 8601 timestamp when the session began. |
| `status` | string | One of: `active`, `closed`. |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `endedAt` | string | ISO 8601 timestamp when the session closed. Required when `status` is `closed`. |
| `summary` | string | Optional one-line session focus. Not a substitute for linked records. Must not contain decisions, investigations, parking-lot items, risks, or planning intent. |
| `planningIntent` | string | Optional forward pointer for where the next session should begin. Not a substitute for Parking Lot or Investigation records. |
| `repository` | string | Root path or name of the repository worked in. |

### Relationships

Sessions do not embed other records. They reference activity by ID:

| Field | Type | Description |
|-------|------|-------------|
| `investigationIds` | string[] | Investigations worked during this session. |
| `decisionIds` | string[] | Decisions made during this session. |
| `qaRunIds` | string[] | QA runs executed during this session. |
| `parkingLotIds` | string[] | Parking lot items created or updated during this session. |
| `boundaryIds` | string[] | Boundaries examined or updated during this session. |
| `doctrineIds` | string[] | Doctrines created or amended during this session. |
| `insightIds` | string[] | Insights recorded during this session. |
| `riskIds` | string[] | Risks identified or updated during this session. |

All relationship arrays are optional and may be empty.

---

## Investigation

### Purpose

Tracks a focused inquiry: a question, hypothesis, or problem under examination until a verdict is reached. Includes runtime-equivalence studies, evidence protocols, and boundary-closure inquiries.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable identifier. |
| `createdAt` | yes | ISO 8601 timestamp. |
| `updatedAt` | yes | ISO 8601 timestamp. |
| `title` | yes | Short label for the investigation. |
| `status` | yes | One of: `open`, `in_progress`, `closed`. |
| `objective` | yes | What the investigation seeks to determine. |
| `evidence` | yes | Array of Evidence Reference objects. May be empty while `status` is `open`. |
| `verdict` | conditional | Required when `status` is `closed`. Statement of finding. Omit while open. |
| `qaRunIds` | no | Array of QA Run `id` values produced during this investigation. |
| `relatedBoundaryIds` | no | Array of Boundary `id` values this investigation examines or supports closing. |
| `closedBoundary` | no | Deprecated. Use `relatedBoundaryIds`. When present, must also appear in `relatedBoundaryIds`. |

---

## Boundary

### Purpose

Represents an architectural or engineering boundary (interface, module edge, runtime pipeline stage, or contract) and its closure state. Aligns with operational doctrine: boundaries close on evidence, reopen only on contradiction.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable identifier. |
| `createdAt` | yes | ISO 8601 timestamp. |
| `updatedAt` | yes | ISO 8601 timestamp. |
| `name` | yes | Short boundary label (e.g. `collector-store`, `store-generator`). |
| `status` | yes | One of: `open`, `closed`, `reopened`. |
| `supportingInvestigations` | yes | Array of Investigation `id` values that provide evidence for the current status. May be empty while `open`. |
| `supportingQaRunIds` | no | Array of QA Run `id` values that provide evidence for the current status. |
| `description` | no | Short description of inputs, outputs, or ownership. Not a substitute for Investigation records. |

---

## QA Run

### Purpose

Records a structured quality-assurance activity: what was tested, against what objective, with what outcome and evidence.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable identifier. |
| `createdAt` | yes | ISO 8601 timestamp. |
| `updatedAt` | yes | ISO 8601 timestamp. |
| `date` | yes | ISO 8601 date (`YYYY-MM-DD`) of the run. |
| `objective` | yes | What was being verified. |
| `result` | yes | One of: `pass`, `fail`, `partial`, `skipped`. |
| `evidence` | yes | Array of Evidence Reference objects. Required when `result` is `fail` or `partial`. |
| `investigationId` | no | `id` of the Investigation this run supports. |

---

## Decision

### Purpose

Records an engineering decision with traceable supporting evidence. Distinct from Investigation: a decision is a commitment, not an open inquiry.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable identifier. |
| `createdAt` | yes | ISO 8601 timestamp. |
| `updatedAt` | yes | ISO 8601 timestamp. |
| `date` | yes | ISO 8601 date (`YYYY-MM-DD`) when the decision was made. |
| `description` | yes | What was decided. |
| `supportingEvidence` | yes | Array of Evidence Reference objects. Must not be empty. |

---

## Parking Lot Item

### Purpose

Captures work intentionally deferred, with an explicit reason. Prevents deferred items from being lost or misrepresented in generated documents.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable identifier. |
| `createdAt` | yes | ISO 8601 timestamp. |
| `updatedAt` | yes | ISO 8601 timestamp. |
| `title` | yes | Short label for the deferred item. |
| `reasonDeferred` | yes | Why this item is not being pursued now. |
| `status` | yes | One of: `open`, `promoted`, `dropped`. Default `open` when omitted on write. |
| `promotedTo` | no | Record Reference to the Investigation or Decision created when this item is promoted. Required when `status` is `promoted`. |

---

## Doctrine

### Purpose

Records a durable normative rule governing how we build, operate, or decide. Distinct from Insight: doctrine states what must be done; insight states what was learned.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable identifier. |
| `createdAt` | yes | ISO 8601 timestamp. |
| `updatedAt` | yes | ISO 8601 timestamp. |
| `statement` | yes | The governing rule. |
| `scope` | yes | One of: `operational`, `product`, `architecture`, `workflow`. |
| `status` | yes | One of: `active`, `superseded`. |
| `supportingEvidence` | no | Array of Evidence Reference objects. |
| `supersedes` | no | `id` of the Doctrine record this one replaces. |
| `supersededBy` | no | `id` of the Doctrine record that replaced this one. Set when `status` is `superseded`. |

---

## Insight

### Purpose

Records a durable descriptive truth: a mental model, observation, research conclusion, or educational discovery. Distinct from Doctrine: insight is descriptive, not normative.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable identifier. |
| `createdAt` | yes | ISO 8601 timestamp. |
| `updatedAt` | yes | ISO 8601 timestamp. |
| `statement` | yes | The learned truth or model. |
| `kind` | yes | One of: `mental_model`, `observation`, `research`, `educational`. |
| `supportingEvidence` | no | Array of Evidence Reference objects. |
| `sourceInvestigationId` | no | `id` of the Investigation that produced this insight, if any. |

---

## Risk

### Purpose

Records an identified engineering threat with lifecycle. Distinct from Parking Lot Item: risk is a concern to track, not work intentionally deferred.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable identifier. |
| `createdAt` | yes | ISO 8601 timestamp. |
| `updatedAt` | yes | ISO 8601 timestamp. |
| `description` | yes | What could go wrong. |
| `status` | yes | One of: `open`, `mitigated`, `accepted`, `closed`. |
| `mitigation` | no | How the risk was addressed. Required when `status` is `mitigated` or `accepted`. |
| `resolution` | no | How the risk was resolved. Required when `status` is `closed`. |
| `supportingEvidence` | no | Array of Evidence Reference objects. |

---

## Rejected Record Types

### Knowledge Investment

Not a record type. A deliberate investment in learning is represented as one or more Session records linked to the atomic outcomes it produced: Doctrine, Insight, Investigation, and Decision records. The investment is reconstructible from references; the learnings are atomic.

---

## Reference Integrity

Generators and collectors should treat these rules as validation targets:

1. Every ID in a relationship or reference field must resolve to an existing record of the expected type.
2. `Investigation.closedBoundary`, when present, must reference a `boundaries[].id` and must also appear in `relatedBoundaryIds`.
3. `Investigation.relatedBoundaryIds` entries must reference `boundaries[].id`.
4. `Investigation.qaRunIds` entries must reference `qaRuns[].id`.
5. `Boundary.supportingInvestigations` entries must reference `investigations[].id`.
6. `Boundary.supportingQaRunIds` entries, when present, must reference `qaRuns[].id`.
7. `QA Run.investigationId`, when present, must reference `investigations[].id`.
8. `Session` relationship arrays must reference records of the matching type.
9. `Decision.supportingEvidence` must contain at least one entry.
10. `Investigation.verdict` is required when `status` is `closed`.
11. `Session.endedAt` is required when `status` is `closed`.
12. `Parking Lot Item.promotedTo` is required when `status` is `promoted`.
13. `Doctrine.supersededBy` is required when `status` is `superseded`.
14. `Doctrine.supersedes` and `Doctrine.supersededBy`, when both present on linked records, must reference each other.
15. `Risk.mitigation` is required when `status` is `mitigated` or `accepted`.
16. `Risk.resolution` is required when `status` is `closed`.
17. `Insight.sourceInvestigationId`, when present, must reference `investigations[].id`.
18. `Session.summary` must not contain structured fact content that belongs in atomic records.

Broken references are store errors. Collectors should not write them; generators should surface them rather than silently omit content.

---

## v0.2 Record Usage

| Record | Role |
|--------|------|
| Session | Container. Required for EOD and morning brief generators. |
| Decision | Atomic fact. Created at capture when a commitment occurs. |
| Investigation | Atomic fact. Created manually or by Investigation Collector. |
| Boundary | Atomic fact. Created manually or derived from investigations. |
| QA Run | Atomic fact. Created manually or by QA Collector. |
| Parking Lot Item | Atomic fact. Created at capture when work is deferred. |
| Risk | Atomic fact. Created at capture when a threat is identified. |
| Doctrine | Atomic fact. Created manually until Doctrine migration tooling exists. |
| Insight | Atomic fact. Created manually until Insight migration tooling exists. |

Generators must read all record types defined here but may render empty sections when no records exist. Collectors must not write durable facts into `Session.summary`.

---

## Migration from v0.1

v0.1 stores used `schemaVersion: "0.1"` with six record collections. v0.2 adds `doctrines`, `insights`, and `risks` collections (empty arrays on upgrade). v0.2 tightens the Session container contract; existing `summary` blobs that embed atomic facts are store errors and must be decomposed into typed records.

| v0.1 field or pattern | v0.2 action |
|-----------------------|-------------|
| `schemaVersion: "0.1"` | Upgrade to `"0.2"`; add empty `doctrines`, `insights`, `risks` arrays |
| `Session.summary` with embedded facts | Decompose into atomic records; retain at most a one-line focus label |
| Missing `planningIntent` | Extract forward intent from summary if present; link concrete items to Parking Lot or Investigation |
| `Investigation.closedBoundary` only | Copy to `relatedBoundaryIds` on read or migration |

---

## Appendix: Repository-to-Store Mapping

Hand-authored markdown in `docs/` is migration input, not source of truth. Decompose using these patterns:

| Repository artifact pattern | Target records |
|-----------------------------|----------------|
| `docs/decisions.md` sections | One Decision per section |
| `docs/investigations/*.md` | One Investigation plus linked Boundaries and QA Runs |
| `docs/architecture/*-doctrine.md`, governing principles sections | Doctrine records |
| Lessons learned, mental model paragraphs | Insight records |
| `docs/qa/*.md` | QA Run records |
| `docs/recaps/*.md`, `docs/handovers/*.md` | Generated views over Sessions — not authoritative store input |
| Risk sections in recaps or capture prompts | Risk records |
