# ODS-EOS Architecture Changelog

Version history and rationale for architectural document changes.

---

## Version History

| Version | Date | Scope |
|---------|------|-------|
| v0.1 | 2026-06-28 | Linear pipeline: CLI → Collectors → Knowledge Store → Generators → Markdown |
| v0.2 | 2026-06-30 | Event-driven, mission-centric architecture. Evidence from founder dogfooding. |

Review artifact: `00-architecture-review-2026-06-30.md`

---

## v0.2 Freeze Pass — 2026-06-30

Final architecture refinement before implementation. Architecture is frozen after this pass.

### Why

The v0.2 refactor introduced correct concepts but left ambiguities: Mission State was incorrectly attributed to the Projection Engine, Automation was positioned downstream instead of event-driven, and timelines were conflated. This pass tightens correctness without redesign.

### Changes Made

| Change | Why |
|--------|-----|
| **Mission Engine owns Mission State** | Mission State is live runtime state continuously updated while a mission is active — not a generated report. Projection Engine consumes it. |
| **Automation Engine is event-driven** | Automation subscribes directly to the Event Store. Reacts to events (e.g. `git.commit`, `mission.close`). Never depends on rendered documents. |
| **Actor on every event** | Enables operational analytics: automation percentage, AI participation, workflow bottlenecks. Architecture only; implementation deferred. |
| **Operational Timeline vs Mission Timeline** | Operational Timeline = movement between missions. Mission Timeline = events within one Mission Session. Separate concepts. |
| **Architecture Freeze doctrine** | Future changes require contradictory operational evidence or demonstrated boundary failure. New ideas → Parking Lot. |
| **Operational Awareness language** | Vision strengthened: ODS OS presents current operational state requiring attention, not merely remembers. |

### Files Updated

- `01-vision.md` — Operational awareness language; corrected system flow diagram
- `02-architecture-v0.2.md` — Mission/Projection/Automation separation; Actors; Timelines
- `03-roadmap.md` — Mission State ownership; event-driven Automation; timeline distinction
- `04-operational-doctrine.md` — Mission State ownership; Architecture Freeze; automation rules
- `05-knowledge-store-schema.md` — Mission State ownership note; Actor reference
- `06-promotion-bridge-v1.md` — Updated flows; Mission Engine before Projection Engine
- `00-architecture-review-2026-06-30.md` — Mission State ownership alignment

### Concepts Preserved

- GPT / Python separation
- Promotion Bridge
- Conversation is Ephemeral
- Promotion is Intentional
- Operations are Persistent
- One Fact One Place
- Evidence Before Opinion
- Mission-first philosophy
- All schema field definitions unchanged

### New Concepts Added

- **Actor** — entity on every event (Israel, ChatGPT, Python, Cursor, Codex, Git, Apple; future: Voice, Slack, Mobile)
- **Operational Timeline** — cross-mission movement (ODS OS → MatMind → Performance OS → Career)
- **Mission Timeline** — event sequence within one Mission Session
- **Architecture Freeze** — doctrine governing post-freeze changes

### Future Parking Lot Items

- Actor field implementation and event schema document
- Voice, Slack, Mobile interfaces as Actors
- Actor-based operational analytics (automation percentage, AI participation)
- Full Automation Engine scheduling
- Notion sync
- Cloud event store
- Multi-operator collaboration

### Final Objective

ODS OS v0.2 is **implementation-ready**. No further architectural redesign is required before Python implementation begins. Validate through implementation and dogfooding.

---

## v0.2 — 2026-06-30

### Why this version exists

Founder dogfooding on 2026-06-30 proved that work organizes around missions (not days), that immutable events are the natural source of truth, and that operational documents and knowledge records are projections—not things the operator should maintain. v0.2 reframes the architecture without discarding working v0.1 concepts.

### Concepts preserved

See `00-architecture-review-2026-06-30.md` § Concepts Preserved.

### Concepts superseded

See `00-architecture-review-2026-06-30.md` § Concepts Superseded.

---

### `00-architecture-review-2026-06-30.md` (new)

**Why:** Capture operational evidence, validated/disproven assumptions, and refactor rationale in a non-doctrine artifact that can be archived after implementation.

**Changes:** Created. Not part of long-term doctrine.

---

### `01-vision.md`

**Why:** Vision philosophy is sound. Wording needed to reflect mission-centric operation and event-driven persistence without restructuring the document.

**Changes:**

- Added mission as the primary organizational unit in purpose and goals
- Extended the operational memory diagram to include events and projections
- Updated long-term vision to name Event Store, Mission State, and projection layer explicitly
- Reframed success criteria around mission resumption and computed state
- Preserved all three philosophy principles unchanged

**Not changed:** Non-goals, core purpose statement structure, 30-second clarity objective.

---

### `02-architecture-v0.2.md` (was `02-architecture-v1.md`)

**Why:** v0.1 linear pipeline cannot express mission switching, event-sourced repository operations, computed Mission State, or projection-based documents. This document receives the largest update.

**Changes:**

- Renamed from v0.1 to v0.2; v0.1 preserved in version history section
- Replaced linear pipeline with event-driven system flow
- Introduced Mission Engine, Event Store, Projection Engine, Mission State, Automation Engine
- Defined Mission Session lifecycle (Begin Mission / Close Mission)
- Defined repository operations as events
- Preserved GPT vs Python vs Notion separation with updated responsibilities
- Added migration notes from v0.1 linear model

**Not changed:** Principle that layers communicate through a single persistence contract; human-inspectable JSON; CLI as entry point.

---

### `03-roadmap.md`

**Why:** Feature-list roadmap (Git Collector, Investigation Collector) does not reflect architectural dependencies. Milestones should follow engine construction order.

**Changes:**

- Rebuilt as architectural milestone progression: Foundation → Event Engine → Mission Engine → Projection Engine → Automation → Executive Dashboards → Analytics → Multi-interface
- Moved collector and generator features under appropriate engine milestones
- Removed version-numbered sections that implied parallel feature tracks

**Not changed:** Implicit goal of incremental delivery.

---

### `04-operational-doctrine.md`

**Why:** Existing doctrine remains valid. Operational evidence requires explicit governing principles for mission-first and event-canonical operation.

**Changes:**

- Added six principles: Mission First, Events are Canonical, Mission State is Computed, Operator Flow is Sacred, Automation Reduces Operator Work, Mission Sessions replace Daily Sessions
- Updated references from knowledge store to event store where canonical authority is discussed
- Clarified that generated documents are projections over events

**Not changed:** All nine original doctrine sections (One Fact One Place through Rejected Patterns). Field definitions still reference `05-knowledge-store-schema.md`.

---

### `05-knowledge-store-schema.md`

**Why:** Schema fields are stable for v0.2 implementation. The architectural shift is canonical-layer relocation, not field redesign.

**Changes:**

- Added "Architectural Evolution" section describing Event Store as canonical target
- Marked record collections and Session as event-derived projections
- Added event-type mapping table (which operational events produce which records)
- Added note that v0.2 defers schema version bump; fields unchanged
- Updated principle "Documents Are Generated from Records" to reference event-derived projections

**Not changed:** All field definitions, enums, validation rules, migration from v0.1, rejected record types.

---

### `06-promotion-bridge-v1.md`

**Why:** Promotion flow is correct. Persistence target and downstream outputs changed from Knowledge Store to Event Store → Projection Engine → Mission State → Generated Views.

**Changes:**

- Updated system flow diagrams (§1, §3)
- Persistence stage now appends events; Projection Engine derives records and Mission State
- Updated Python responsibilities to include event persistence and projection triggering
- Updated generated outputs list to include Mission State and mission-scoped views
- Added Mission intent (Begin Mission, Close Mission) alongside existing operational intents
- Updated non-goals to reference Event Store instead of knowledge store as canonical

**Not changed:** GPT vs Python boundary, approval requirement, canonical payload composition, interface-agnostic design, architecture principles §8.

---

## v0.1 — 2026-06-28

Initial architecture documentation.

- `01-vision.md` — Conversational EOS vision and philosophy
- `02-architecture-v1.md` — Linear CLI → Collectors → Knowledge Store → Generators pipeline
- `03-roadmap.md` — v0.1/v0.2/v0.3 feature roadmap
- `04-operational-doctrine.md` — Engineering rules
- `05-knowledge-store-schema.md` — v0.2 schema (fields defined ahead of architecture catch-up)
- `06-promotion-bridge-v1.md` — Conversation-to-persistence bridge contract
