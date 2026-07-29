# MatMind Engineering OS

**Version:** 1.1

**Status:** ACTIVE

**Effective:** 2026-07-29

**Authority:** Engineering Leadership

Engineering OS is the operating contract for building MatMind safely, quickly, and recoverably. This document is the supreme MatMind engineering authority for this repository.

It governs how engineering work begins, how evidence changes direction, how certified systems are protected, how documentation is recorded, and how a clean recovery point is left behind.

It does not define product vision. Product intent remains owned by Product OS and the Product Roadmap.

## 1. Operating Principles

1. Repository truth outranks memory.
2. Certified architecture is not reopened without new evidence.
3. One mission owns one bounded outcome.
4. Evidence precedes mutation.
5. The narrowest proven layer receives the change.
6. Runtime ownership is never moved accidentally.
7. Unrelated work is preserved and excluded.
8. A stop condition ends the mission; it does not invite an adjacent repair.
9. Documentation records truth without becoming architecture theater.
10. Every completed slice leaves a recoverable repository floor.

## 2. Responsibility Boundary

### Founder / Operator

The Founder owns mission authorization, product priority, scope expansion, external-state approval, and the decision to proceed after a stop condition.

### GPT

GPT owns engineering cognition:

- repository-grounded reasoning;
- investigation design;
- architecture and tradeoff analysis;
- the five-question challenge;
- certification conclusions;
- prioritization and stop decisions;
- structured documentation content.

GPT must not delegate engineering judgment to Python.

### Python

Python owns deterministic document operations:

- validate GPT-authored structured input;
- enforce required fields and ordering;
- insert or replace content at certified boundaries;
- capture factual repository metadata;
- preview exact changes;
- verify document invariants and idempotence.

Python must not infer conclusions, invent narrative, prioritize work, or alter GPT-authored meaning.

### Codex

Codex owns bounded execution:

- inspect repository and platform evidence;
- implement only the authorized slice;
- run proportionate validation;
- preserve protected and unrelated work;
- stage only owned files;
- create the authorized commit after verification;
- push only when explicitly requested.

### Evidence

Repository state, tests, runtime observations, provider responses, and committed documentation are the authorities for factual claims. Conversation memory is never sufficient evidence by itself.

## 3. Canonical Information Homes

| Information | Canonical home | Rule |
| --- | --- | --- |
| Product direction and sequencing | `docs/product/product-roadmap.md` | Product truth; never an engineering diary |
| Product philosophy | `docs/product/` | Long-horizon intent |
| Engineering operating contract | `docs/ENGINEERING_OS.md` | Versioned doctrine; changes deliberately |
| Daily engineering index | `docs/engineering-daily.md` | One concise append-only entry per engineering day |
| Active engineering floor | `docs/engineering-checkpoint.md` | Recoverable session/investigation state |
| Certified architecture | `docs/architecture/certification/` | Evidence-backed authority only |
| Active investigations | `docs/architecture/certification/active-investigation-register.md` and `docs/investigations/` | Unknown boundaries and their evidence |
| Protected systems | `docs/architecture/certification/protected-systems-register.md` | Mutation boundary |
| Permanent engineering history | `docs/dev-handoff.md` | Append-only; never rewrite history |
| Founder-approved deferral | `docs/engineering-parking-lot.md` | Deferred work with a resume trigger |
| Developer doctrine | `docs/master-prompt-developer.md` | Stable execution guidance |
| Daily startup procedure | `docs/master-prompt-daily-restart.md` | Startup and closeout sequence only |
| Documentation ownership and update triggers | `docs/documentation-governance.md` | Living-document ownership map; update triggers only |

Write information once in its canonical home and reference it elsewhere. Engineering Daily is an index, not a duplicate evidence archive.

### Authority Boundary

Living MatMind engineering memory and procedure use only the Canonical Information Homes above.

`ods-eos/` is a separate portfolio operating system. Its mission, restart, EOD, knowledge, and parking projections do not authorize MatMind code changes and do not override MatMind living documents.

The following are historical reference only and are not authoritative for MatMind living memory or procedure:

- `docs/recaps/`
- `docs/handovers/`
- `docs/dev-handoff.backup.md`
- `docs/codex-system.md`

## 4. Daily Startup

Before planning or editing:

1. Run repository truth:
   - `git status -sb`
   - `git diff --stat`
   - `git diff`
   - `git log --oneline --decorate -10`
   - `git stash list`
2. Read `docs/ENGINEERING_OS.md`.
3. Read the latest entry in `docs/engineering-daily.md`.
4. Read the Product Roadmap for the active product objective.
5. Read the Certified Architecture, Protected Systems, and Active Investigation registers.
6. Read the current Engineering Checkpoint, Parking Lot, and latest Dev Handoff entry as required by the mission.
7. Identify unrelated modified, staged, untracked, generated, Timeline, debug-log, and stash scopes.
8. State the authorized outcome, prohibited work, evidence target, and stop conditions.

No implementation begins until this floor is explicit.

## 5. Mandatory Five-Question Challenge

Before every material action, answer:

1. What do we know from direct evidence?
2. What remains unknown?
3. What is the narrowest falsifiable hypothesis or engineering question?
4. What is the smallest safe action that can answer it?
5. What result causes us to stop, proceed, or change direction?

For routine deterministic actions, the answers may be concise. They may never be skipped when architecture, runtime authority, production state, destructive work, or external resources are involved.

## 6. Mission Contract

Every engineering mission defines:

- engineering tag;
- one objective;
- certified floor;
- in-scope owners and files;
- protected owners and files;
- authorized external-state changes;
- required evidence;
- explicit stop conditions;
- commit and push authority.

Mission completion does not authorize the next mission. A terminal instruction such as “continue” or “do not stop” increases persistence, not scope.

## 7. Execution Protocol

Use this order:

```text
Repository Truth
↓
Certified Boundaries
↓
Five Questions
↓
Smallest Safe Action
↓
Evidence
↓
Validate or Stop
↓
Record
```

Rules:

- Diagnose before repairing unless repair is explicitly authorized.
- Do not combine investigation, architecture redesign, implementation, cleanup, and optimization in one slice.
- Do not modify protected systems to make an experiment easier.
- Do not interpret a platform or authentication failure as application evidence.
- Do not rerun a single-observation experiment unless the mission authorizes a retry.
- If evidence disproves the current model, stop and update the model before acting again.

## 8. Validation and Certification

Validation must be proportionate to risk and must include the mission’s required gates.

A claim is certified only when:

- the authoritative owner was exercised;
- expected and observed identities agree;
- exact outputs or invariants agree;
- retry, failure, release, and cleanup behavior are accounted for when relevant;
- protected paths remain unchanged;
- repository evidence is preserved;
- unknowns are named rather than weakened.

Passing tests alone do not certify runtime behavior. Runtime evidence alone does not authorize architecture changes.

## 9. Stop Discipline

Stop immediately when:

- a mandatory gate fails;
- authorization, identity, version, or ownership cannot be proven;
- the observed failure leaves the mission’s certified boundary;
- an unexpected retry, duplicate, restart, mutation, or protected-path change occurs;
- required evidence is missing;
- continuing would require new authority.

At a stop:

1. preserve evidence;
2. restore temporary substitutions when authorized and safe;
3. return external systems to the required disabled state;
4. verify repository ownership;
5. report the narrowest supported boundary;
6. do not begin the adjacent fix.

## 10. Repository and Git Discipline

- Existing work belongs to its current owner.
- Never stage, rewrite, delete, or “clean up” unrelated work.
- Stage explicit paths only.
- A documentation mission produces a documentation-only commit.
- A runtime mission does not silently absorb documentation or generated evidence.
- Verify `git diff --check`, staged file names, commit contents, final status, and protected stash identity.
- Do not push unless the mission explicitly authorizes it.

## 11. Documentation Pipeline

The canonical documentation pipeline is:

```text
Founder authorizes scope
↓
GPT authors structured content
↓
Python validates and records
↓
Python previews exact changes
↓
Codex verifies repository ownership
↓
Codex commits authorized documentation
```

Canonical MatMind writers:

- `scripts/write_engineering_checkpoint.py`
- `scripts/write_dev_handoff.py`
- `scripts/dev_handoff_ordering.py`
- `scripts/write_architecture_certification.py`

Required rules:

- Reuse an existing repository writer when it owns the target document.
- Otherwise use a bounded Python recorder with explicit target paths and replacement anchors.
- Python must reject missing anchors, duplicate dates, malformed sections, path expansion, or content outside the GPT-authored model.
- Run the recorder twice or perform an equivalent idempotence check.
- Preview the exact diff before staging.
- Update only documents whose ownership trigger fired.
- Do not create a separate EOD artifact.

## 12. Engineering Daily Contract

`docs/engineering-daily.md` is the concise append-only index for engineering days.

Each entry contains:

- date;
- primary objective;
- repository floor;
- completed outcomes;
- evidence and certification movement;
- stop conditions or unresolved boundaries;
- protected/unrelated scopes;
- next authorized mission.

Daily entries link to canonical evidence instead of copying long investigation narratives. A day may have one entry only. Corrections append a clearly labeled amendment; history is never silently rewritten.

Engineering Daily does not replace:

- Engineering Checkpoint for active recoverable state;
- Dev Handoff for permanent detailed history;
- Architecture Certification for certified authority;
- Parking Lot for founder-approved deferral.

## 13. Closeout

The founder command **Run end-of-day tasks** means: execute this Engineering Closeout Procedure.

Do not create a standalone MatMind EOD artifact. ODS EOD is not MatMind authority and does not authorize MatMind documentation or code changes.

Before ending an engineering day or authorized slice:

1. run final validation;
2. classify the outcome as complete, narrowed, blocked, or failed;
3. update `docs/engineering-daily.md` when a daily closeout is authorized;
4. update Checkpoint, Dev Handoff, certification registers, or Parking Lot only when their ownership trigger fired;
5. have Python validate and preview canonical documentation changes;
6. stage owned files only;
7. commit when authorized;
8. report assumptions, blind spots, improvements, and the next separately authorized mission.

## 14. Canonical Engineering Commands

Engineering commands must not rely on conversational interpretation. Each command defines purpose, execution modes or required outputs, and stop conditions.

Canonical Engineering Commands must derive execution mode, mission owner, and active mission scope from repository and environment evidence. They must not infer these from conversational memory.

### Command Routing and Owner Resolution

#### 1. Determine repository availability

**Repository Available:** The actual BJJ Tracker Git worktree and canonical Operating Surface are readable.

**Repository Unavailable:** The environment cannot read the actual BJJ Tracker worktree or canonical Operating Surface.

#### 2. Determine execution mode

- Repository unavailable → Planning Mode.
- Repository available but mutation unavailable or unauthorized → Planning Mode.
- Repository available and required mutation is available and authorized → Execution Mode.

#### 3. Determine mission owner

**Planning Mode:** MISSION OWNER = ChatGPT.

Reason: The work is interpretation, scope determination, sequencing, and blocked-action reporting.

**Execution Mode** involving repository inspection, edits, writers, tests, runtime, or Git preparation: MISSION OWNER = Cursor.

Reason: The work requires direct repository execution.

**Git push or consequential production authorization:** MISSION OWNER = Git Operator / Israel.

**Codex:** Do not assign Codex by default.

Codex may own a mission only when explicitly authorized for:

- independent architecture review;
- unresolved root-cause investigation;
- competing design evaluation;
- high-risk certification review.

#### 4. Determine active mission scope

The active mission must be derived from repository evidence in this order:

1. `docs/engineering-checkpoint.md`
2. `docs/architecture/certification/active-investigation-register.md`
3. `docs/product/product-roadmap.md`
4. current Git state and recent commits
5. canonical living documents

Conversation history may be used only as secondary context.

If repository scope cannot be established:

- state SCOPE UNRESOLVED;
- do not import stale mission details;
- do not fabricate a mission recap;
- limit output to Planning Mode findings and exact blocked actions.

#### 5. Apply to “Run end-of-day tasks”

**Planning Mode:**

- owner must be ChatGPT;
- do not assign Codex;
- do not reconstruct stale product work as current mission truth;
- clearly separate repository-proven facts, conversation-supported context, and unknowns.

**Execution Mode:**

- owner must be Cursor;
- execute the Engineering Closeout Procedure using repository truth.

### Run end-of-day tasks

**Purpose:** Execute the Engineering Closeout Procedure.

**Planning Mode** — Repository mutation unavailable.

Required behavior:

- determine documentation scope;
- determine Git scope;
- identify required writers;
- classify repository mutations as BLOCKED;
- never claim writeback occurred.

**Execution Mode** — Repository mutation available.

Required behavior:

- execute Engineering Closeout Procedure;
- execute Python writers;
- verify;
- stage;
- commit (if authorized).

Stop when Planning Mode would require mutation, when a required writer or ownership gate fails, or when commit is not authorized.

### Restart engineering

**Purpose:** Restore the engineering floor.

Minimum required outputs:

- repository truth;
- checkpoint;
- active investigations;
- certified floors;
- current mission;
- mission owner.

Stop when any minimum required output cannot be established from repository evidence.

### Operator Mode

**Purpose:** Execute bounded engineering missions.

Every mission must begin with:

- MISSION OWNER
- Why this owner
- Objective
- Success Criteria

Every mission must end with:

- Current Mission
- Likely Next

Stop when the mission contract, certified boundary, or required evidence cannot be satisfied.

## 15. Versioning

Engineering OS changes require an explicit Engineering Leadership mission and a version update.

- Patch: clarification without responsibility or sequence changes.
- Minor: additive operating capability that preserves existing authority.
- Major: responsibility, ownership, or lifecycle change.

Historical daily entries and prior certifications are not rewritten when Engineering OS advances.
