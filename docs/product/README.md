# MatMind Product OS

Product OS is the permanent home for MatMind's long-term product thinking.

It captures what MatMind should become for coaches, athletes, and families — independent of how the product is currently implemented.

Product OS is not an engineering backlog.
It is not a release plan.
It is not a handoff document.

It is the product layer that keeps vision stable while engineering execution moves.

## Product OS Rules

Product OS documents capture enduring product decisions.

They should evolve slowly.

Do not use these documents for:
- Daily engineering notes
- Implementation details
- Temporary investigations
- Bug tracking

Engineering execution belongs in the Engineering OS.

Product philosophy belongs in the Product OS.
---

## What Product OS Owns

Product OS owns:

- Product vision
- Experience philosophy
- Coach and athlete mental models
- Long-horizon capability themes
- Principles that should outlive any single release

Product OS does **not** own:

- Implementation details
- Routing or screen architecture
- TypeScript contracts
- Investigation evidence
- Sprint tasks or tickets

When product intent and engineering reality diverge, Product OS remains the North Star. Engineering documents record the current path toward it.

---

## How Product OS Relates to the Rest of the System

MatMind operates with complementary layers. Each layer has a distinct job.

### Product Vision

**Home:** `docs/product/`

Product Vision defines the long-term experience MatMind is building toward.

It answers:

- Who is this product for?
- What coaching problem does it solve?
- What should feel true years from now?
- Which principles must remain stable as features evolve?

Living vision documents belong here. The Coach Workspace North Star lives in [`coach-experience-vision.md`](./coach-experience-vision.md).

### Engineering OS

Engineering OS is the operating system for building MatMind safely and recoverably.

It answers:

- How do we investigate?
- How do we certify truth?
- How do we protect architecture?
- How do we resume work without reconstructing context?

Engineering OS turns product intent into governed execution. It does not redefine product vision.

### Dev Handoff

**Home:** `docs/dev-handoff.md`

Dev Handoff is the living engineering source of truth for active work.

It answers:

- What is true in the repository right now?
- What is certified?
- What is blocked?
- What should the next engineer resume?

Dev Handoff is operational. Product OS is directional.

### Engineering Checkpoint

**Home:** `docs/engineering-checkpoint.md`

Engineering Checkpoint is the short recoverable record of an engineering session or investigation slice.

It answers:

- What was the objective?
- What was proven?
- What floor was established?
- What recovery point exists?

Checkpoints preserve engineering memory. They do not redefine long-term product direction.

### Parking Lot

**Home:** `docs/engineering-parking-lot.md`

The Engineering Parking Lot holds intentionally deferred engineering work.

It answers:

- What was deliberately parked?
- Why was it deferred?
- What resume trigger would justify returning?
- What is the first resume step?

Parking Lot items are deferred engineering concerns. They are not product vision statements, and they are not an unstructured idea dump.

---

## Layer Map

| Layer | Purpose | Time Horizon | Primary Question |
| --- | --- | --- | --- |
| **Product Vision** | Long-term product thinking | Years | What should MatMind become? |
| **Engineering OS** | Governed build system | Continuous | How do we build and protect truth? |
| **Dev Handoff** | Living execution truth | Days to weeks | What is true right now? |
| **Engineering Checkpoint** | Recoverable session memory | Session / investigation | What did we prove and leave behind? |
| **Parking Lot** | Governed deferral | Until resume trigger | What waits, and why? |

---

## Working Rule

- Product OS decides **why** and **what kind of experience**.
- Engineering OS decides **how** work is investigated, certified, and shipped.
- Dev Handoff and Checkpoint preserve **current engineering truth**.
- Parking Lot preserves **intentionally deferred engineering work**.

If a document describes screens, contracts, routes, or implementation sequences, it belongs in engineering space.

If a document describes coaching philosophy, athlete development, long-term experience, or durable product principles, it belongs in Product OS.

---

## Current Documents

| Document | Role |
| --- | --- |
| [`coach-experience-vision.md`](./coach-experience-vision.md) | Living North Star for the Coach Workspace |
| [`coach-workspace-roadmap.md`](./coach-workspace-roadmap.md) | Official product roadmap connecting Coach Experience Vision to sequenced release evolution |

Additional product vision documents should be added here as MatMind's product surface expands.
