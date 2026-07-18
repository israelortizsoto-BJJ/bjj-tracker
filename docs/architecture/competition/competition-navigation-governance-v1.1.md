# Competition Navigation Governance v1.1

| Field | Value |
|-------|-------|
| **Status** | Accepted architecture governance |
| **Version** | v1.1 |
| **Date** | 2026-07-17 |
| **Scope** | Competition editor entry, exit, navigation recovery, and Family Competition Editor decommissioning |
| **Implementation posture** | Governance only; this document does not implement Slice 5 or authorize unrelated runtime changes |

---

## Objective

Define a deterministic navigation contract for competition editors that:

- preserves actor, athlete, competition, and return-path context;
- permits current and future launch surfaces without weakening editor safety;
- prevents an editor from becoming interactive when its required context cannot be resolved;
- recovers users to a safe navigation destination when editor entry cannot proceed; and
- prevents decommissioning the Family Competition Editor until its production dependencies have been certified absent or safely replaced.

This document supersedes the proposed Competition Navigation Governance v1.

---

# Governing Decisions

## Decision 1 — Reject unresolved entry

Competition editor entry is governed by context resolution, not by where the request originated.

A launch request may originate from an in-app surface or from a direct-entry workflow, including:

- notifications;
- widgets;
- share links or deep links;
- AI-assisted handoff;
- onboarding;
- draft or crash recovery; and
- future certified launch surfaces.

Direct entry is not inherently invalid. An entry is valid only when the Navigation Contract can resolve all context required to open the intended editor safely.

At minimum, resolution must establish:

1. the actor and the actor's authority to use the requested editor;
2. the athlete or family scope to which the editor belongs;
3. whether the intent is to create or edit;
4. the target competition when the intent is to edit; and
5. a deterministic safe return destination.

Required context may be carried by the launch request or obtained through an authorized resolution step. The editor must not infer ambiguous ownership, silently choose an athlete or competition, or treat a launch source as authority.

If required context is missing, invalid, ambiguous, stale, unauthorized, or cannot be resolved, entry is rejected as **unresolved entry**.

### Consequences

- New launch surfaces do not require an exception to a source-based prohibition.
- Every launch surface is held to the same context-completeness and authority rules.
- A direct link that resolves the contract may enter the editor.
- An in-app navigation action that does not resolve the contract may not enter the editor.

---

## Decision 2 — Fail closed on the editor; recover gracefully in navigation

When entry is unresolved, the editor must fail closed:

- it must not become interactive;
- it must not read or write against an inferred target;
- it must not create a replacement record;
- it must not mutate canonical or mirrored competition state; and
- it must not continue with partially trusted context.

Failing closed on the editor must not strand the user on a terminal unavailable screen.

Navigation must recover to the nearest safe, valid destination available to the actor, such as the relevant athlete surface or the Compete surface. Recovery must:

1. preserve every scope element that was successfully and safely resolved;
2. avoid exposing or implying access to an unresolved or unauthorized target;
3. provide a contextual explanation appropriate to the failure;
4. provide retry or corrective action when resolution may reasonably succeed; and
5. retain enough typed failure meaning for support, telemetry, and future workflow handling.

Failure categories must remain distinguishable at the architecture boundary. At minimum, the system must distinguish:

- missing or malformed context;
- ambiguous or mismatched scope;
- missing or deleted target;
- unauthorized target; and
- temporarily unavailable resolution.

The user experience may vary by category, but no category may bypass the fail-closed editor rule.

---

## Decision 3 — Deterministic exit behavior

Every accepted editor entry must have a deterministic exit contract.

Save, cancel, delete, and load failure must resolve through the accepted launch context to a safe destination. Exit behavior must not depend on incidental router history when that history can be absent, stale, or reconstructed after a cold start.

If the original return destination is no longer valid at exit time, navigation must apply the same rule as unresolved entry: fail closed on any unsafe destination and recover to the nearest safe valid surface.

---

## Decision 4 — Family Competition Editor decommissioning is certification-gated

Before decommissioning the Family Competition Editor, certify that no production data model or workflow depends on it.

This prerequisite is a hard gate. The existence of another competition editor, route, or presentation surface is not sufficient evidence that the Family Competition Editor is redundant.

The certification must determine whether the editor currently provides or owns any of the following:

- creation, editing, correction, or deletion of family-scoped competition records;
- atomic or coordinated multi-athlete competition authoring;
- access to persisted production records that no other supported workflow can modify;
- ownership or correction authority that would become orphaned;
- a launch or return destination used by current navigation, recovery, onboarding, notifications, widgets, links, or external integrations; or
- data normalization, identity linkage, or referential consistency not preserved by the proposed replacement workflow.

### Required certification outcome

Decommissioning may proceed only after one of these outcomes is accepted:

1. **No dependency exists.** Production evidence demonstrates that no data model, persisted record class, or supported workflow depends on the Family Competition Editor.
2. **Dependencies are safely retired or replaced.** Every dependency has an accepted migration or replacement, existing records remain readable and correctable by an authorized owner, and no required capability is lost.

If neither outcome is certified, decommissioning is blocked.

The certification must cover production data and supported workflows; repository reachability or route-reference absence alone is not sufficient.

This v1.1 document establishes the prerequisite. It does not claim that the prerequisite has been satisfied.

---

# Navigation Contract Invariants

The following invariants govern Slice 5 and later competition-navigation work:

1. **Context completeness:** editor access requires resolved actor, authority, target scope, intent, and return behavior.
2. **Source neutrality:** launch source describes provenance; it does not grant authority or determine validity.
3. **No ambiguous defaults:** unresolved athlete, family, competition, or return scope must not be guessed.
4. **Editor safety:** no unresolved request may reach an interactive or mutating editor state.
5. **Graceful recovery:** rejected editor entry must resolve to a safe navigation destination with meaningful user guidance.
6. **Deterministic exit:** accepted launch context governs save, cancel, delete, and failure exits.
7. **Ownership preservation:** navigation must not create a new writer, correction authority, or ownership transfer.
8. **Decommissioning safety:** a capability or correction path may not be removed before its production dependencies are certified absent or replaced.

---

# Slice 5 Architecture Gates

Slice 5 design and implementation must demonstrate:

- every supported competition-editor launch surface supplies or resolves the Navigation Contract;
- direct-entry workflows are evaluated by resolvability rather than rejected by source;
- unresolved requests cannot enter an interactive editor;
- each unresolved-entry category has a safe navigation recovery;
- accepted entries have deterministic save, cancel, delete, and failure exits; and
- any Family Competition Editor decommissioning work is excluded until the prerequisite certification is accepted.

Failure to satisfy any gate is a Navigation Contract violation, not a presentation defect.

---

# Non-Goals

This governance document does not:

- prescribe router APIs, parameter names, storage changes, or component design;
- require implementation of notifications, widgets, share links, AI workflows, onboarding, or recovery features;
- authorize direct writes by any external or automated workflow;
- certify that the Family Competition Editor is unused;
- authorize removal or migration of family-scoped production data;
- redefine competition data ownership, canonical writers, mirror authority, or projection rules; or
- implement Slice 5.

---

## Final Accepted Rule

Competition navigation is valid when the requested editor context is complete, authorized, and deterministically recoverable, regardless of launch source.

When that context cannot be resolved, **fail closed on the editor and recover gracefully in navigation**.

Before decommissioning the Family Competition Editor, **certify that no production data model or workflow depends on it**. Until that certification is accepted, decommissioning remains blocked.

**No runtime changes are authorized by this document alone.**
