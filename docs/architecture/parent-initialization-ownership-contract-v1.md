# Parent Initialization Ownership Contract v1

| Field | Value |
|-------|--------|
| **Status** | Constitutional architecture — Ownership Contract v1 |
| **Authority class** | Architecture Review Board |
| **Date** | 2026-07-15 |
| **Governing investigation** | INV8 — Parent Runtime Publication Corridor |
| **Primary evidence** | Engineering Checkpoint 2026-07-14; frozen Immutable Design Constraints (ARB pre-contract); Certified Architecture Register; Protected Systems Register; Competition Runtime Governance / Invariants; Hydration Orchestration; Canonical Athlete Authority Spec; Consumer Observation Contract repository certification |
| **Does not authorize** | Implementation, code changes, production correction design, or redesign of certified systems |

---

## Classification legend

Every normative statement in this contract is classified as exactly one of:

| Classification | Meaning |
|----------------|---------|
| **Repository Certified** | Proven by repository / architecture certification. This contract may not contradict it. |
| **Runtime Certified** | Proven by captured runtime evidence. This contract may not invent a model that denies it. |
| **Architectural Design Decision** | Ownership-authorship rule required to close a certified gap. It is constitutional once adopted here, but it is not yet proven by repository or runtime certification. |

Classifications are never mixed inside a single normative statement.

---

# 1. Purpose

## 1.1 Why this contract exists

**Architectural Design Decision.**  
This contract exists to define permanent architectural ownership for Parent Runtime initialization and its adjacent responsibilities: publication, hydration, rendering, and eventual consistency.

**Repository Certified.**  
INV8’s natural deliverable is creation of a new architectural ownership contract, not discovery of an existing Parent Initialization specification. No standalone Parent Initialization specification previously existed in the repository.

**Repository Certified.**  
Success for this investigation is defined as a repository-backed ownership model in which every named runtime responsibility has exactly one architectural owner — not restored list visibility.

## 1.2 Architectural gap closed

**Repository Certified.**  
Architecture previously defined pipelines, ownership of several substrates, and publication as a corridor concern, but did **not** define when Parent Initialization officially completes. The missing concept is `INIT_COMPLETE`.

**Repository Certified.**  
The repository defined a publication/notification bus, not a shared Consumer Observation Contract governing when subscribers are authorized to react relative to publication and initialization.

**Architectural Design Decision.**  
This contract closes those gaps by:

1. Establishing `INIT_COMPLETE` as an owned initialization-completion epoch.
2. Establishing a Consumer Observation Contract that separates publication, observation delivery, and reaction authorization.
3. Binding all Parent Runtime corridor responsibilities to a single-owner ownership model without reopening certified systems.

---

# 2. Definitions

All definitions in this section are **Architectural Design Decision** and are intentionally implementation-independent. They name architectural roles and epochs, not modules, functions, hooks, or call stacks.

### Architectural Owner

The single authority that is exclusively responsible for the legality and completion of one responsibility. Ownership answers: *who is allowed to decide what this responsibility means?* Only one Architectural Owner exists per responsibility.

### Authority

The legal power to mutate the meaning, progress, or completion state of a responsibility. Authority may be exercised only by the Architectural Owner of that responsibility. Presence in a call stack is not authority.

### Responsibility

A bounded architectural duty with independent meaning. Named responsibilities in this contract include Identity, Parent Initialization, Publication, Hydration, Rendering, and Eventual Consistency. Responsibilities may execute near each other without becoming one responsibility.

### Consumer

A participant that depends on outputs belonging to another owner. A Consumer may read or react within its own authority, but never acquires ownership of the producer’s responsibility by consuming it.

### Observer

A participant that receives notification that a publication or invalidation has occurred. Observation is awareness of occurrence. Observation alone never confers ownership, completion authority, or reaction mandate.

### Publisher

The Architectural Owner of Publication for a given publication corridor. The Publisher may emit publication. Emitting publication does not transfer ownership of Initialization, Rendering, or Eventual Consistency.

### Initialization

The owned process of bringing a runtime plane from unresolved operating scope to its minimum completed floor for that plane. For Parent Competition Runtime, Initialization is Parent Initialization as defined in §4.2.

### Completion

The architectural assertion that a responsibility has satisfied its owner-defined success criteria. Completion is owned. Side effects, enrichment, observation, and downstream reactions do not complete another owner’s responsibility.

### INIT_COMPLETE

The ownership epoch at which Parent Initialization has reached Completion under this contract. `INIT_COMPLETE` is not enrichment readiness, publication occurrence, hydrationVersion advance, overlay presence, topology presence, or Match Breakdown visibility.

### Publication

The owned act of notifying eligible observers that a publisher-scoped invalidation or artifact-stage signal has occurred. Publication guarantees occurrence of notification under the Publisher’s authority. Publication does not guarantee Initialization completion, Rendering completion, or Eventual Consistency completion.

### Hydration

The owned act of making published or reconciled substrate available for re-read by entitled consumers after invalidation. Hydration is distinct from Publication (signal of change), Rendering (presentation of a floor), and Initialization (reaching the floor).

### Rendering

The owned act of presenting the minimum projection required by a render plane’s certified floor. Rendering does not own Publication, Hydration, Initialization, or Eventual Consistency.

### Eventual Consistency

The owned duty of converging entitled surfaces onto aligned readable state after invalidate + re-read, without requiring immediate parity at the moment of publication. Eventual Consistency is not an automatic side effect of Publication or of a version counter increment.

---

# 3. Immutable Constraints

The following constraints are carried forward from the frozen ARB Immutable Design Constraints and are now **constitutional rules** of this contract. A later amendment that violates any item is rejected without argument on timing, ergonomics, or runtime convenience.

## 3.1 Certified Repository Constraints

| ID | Statement | Classification |
|----|-----------|----------------|
| **C-R1** | Every Parent Runtime responsibility named by this contract — at minimum Initialization, Publication, Hydration, Rendering, and Eventual Consistency — has exactly one architectural owner. | Repository Certified |
| **C-R2** | CompetitionTab consumes publication; it does not own publication. Publication ownership belongs to the Parent Runtime Publication Corridor. | Repository Certified |
| **C-R3** | CompetitionTab may participate in hydration fan-out, but that participation is Implementation Convenience (Class B), not ownership. Parent Initialization does not fundamentally depend on CompetitionTab observing artifact publication immediately. | Repository Certified |
| **C-R4** | Artifact publication is authorized only as artifact-stage notification. No architecture document authorizes artifact publication as Parent Initialization cancellation. | Repository Certified |
| **C-R5** | Minimum Parent Initialization consists of: athlete scope resolved → loadCompetitions → P1 merge → setEntries → CompetitionCard render. Required floor: athlete scope, loadCompetitions, merge, entries, render. | Repository Certified |
| **C-R6** | Overlay, topology, coach notes, artifact hydrate, publication, and hydrationVersion are downstream enrichment — not required for minimum Parent Initialization. | Repository Certified |
| **C-R7** | Publication, Initialization, Hydration, Overlay, Topology, Identity, and Rendering are independent responsibilities. Coupling during Parent Refresh is a runtime observation, not ownership fusion. | Repository Certified |
| **C-R8** | This contract must not reopen or redefine ownership for: Identity, Canonical Athlete Authority, Overlay Merge, Artifact Persistence, Competition Rendering Pipeline (certified floor), Topology Ownership, or Coach Runtime, absent contradictory evidence. | Repository Certified |
| **C-R9** | Parent Initialization ownership may not assign canonical competition shell/detail authority to hydration, publication, overlays, projections, or coach mirrors. | Repository Certified |
| **C-R10** | Athlete-scope resolution belongs to Identity / Canonical Athlete Authority. The init contract consumes resolved scope; it does not absorb identity ownership. | Repository Certified |
| **C-R11** | No documented production consumer requires mid-refresh publication timing as an ownership necessity. | Repository Certified |
| **C-R12** | competitionVersion, aggregate version, and hydrationVersion are independent monotonic invalidation signals. This contract must not collapse them into a single ownership domain or treat one counter as another’s completion signal. | Repository Certified |
| **C-R13** | The publication corridor may publish without equality gating today: same payload can still advance hydrationVersion because no equality gate precedes publication. | Repository Certified |

## 3.2 Certified Runtime Constraints

| ID | Statement | Classification |
|----|-----------|----------------|
| **C-RT1** | Cold-start transition athleteId="" → shared_ath_* recreates the Compete focus callback exactly once and is expected behavior, not an initialization bug. | Runtime Certified |
| **C-RT2** | Only Instance B (second focus callback after athlete resolution) legally owns cancelled at CANCELLED_CHECK. Instance A cannot legally reach that ownership point. | Runtime Certified |
| **C-RT3** | Certified runtime proves: coachSyncHydrationVersion++ → cleanup → new focus callback → cancelled=true → RETURN_BEFORE_LOAD_COMPETITIONS. This is the certified starvation mechanism under investigation. | Runtime Certified |
| **C-RT4** | The certified cold Parent startup sequence (FOCUS_ENTER athleteId=null → REFRESH_BEGIN → COMP_CACHE_INVALIDATION hydrationVersionNext=2 → cleanup → FOCUS_ENTER coachSyncHydrationVersion=2 → REFRESH_END → CANCELLED_CHECK=true → RETURN_BEFORE_LOAD_COMPETITIONS) is binding runtime evidence. | Runtime Certified |
| **C-RT5** | Eliminated explanations remain closed as ownership premises: bootstrap bug; ghost cleanup ownership; Instance A ownership; CompetitionVersion starvation; Match Breakdown ownership; Overlay ownership; Identity ownership; Athlete authority ownership; publication owned by CompetitionTab; artifact publication required for Parent Initialization. | Runtime Certified |
| **C-RT6** | Parent Match Breakdown / artifact visibility is a separate concern from whether Parent Initialization reaches the rendering floor. Enrichment visibility is not a precondition of initialization completion. | Runtime Certified |

## 3.3 Architectural Design Constraints (constitutional)

| ID | Statement | Classification |
|----|-----------|----------------|
| **C-D1** | This contract explicitly names: initialization owner, publication owner, hydration owner, rendering owner, and eventual consistency owner. | Architectural Design Decision |
| **C-D2** | Ownership is permanent; execution traces are temporary. Traces explain history; this contract constrains legality. | Architectural Design Decision |
| **C-D3** | Contract acceptance is ownership clarity and boundary legality, not restored cold-start list visibility. | Architectural Design Decision |
| **C-D4** | Initialization completion is an ownership epoch (`INIT_COMPLETE`) and is not assigned to enrichment lanes. | Architectural Design Decision |
| **C-D5** | Earliest architecturally safe publication epoch remains uncertified. Ownership definition is separated from epoch determination. Candidates A/B must not be declared certified here. | Architectural Design Decision |
| **C-D6** | Any later correction must be the smallest ownership-preserving change that retains certified boundaries. | Architectural Design Decision |
| **C-D7** | Language must separately classify: (1) architectural owner, (2) mandated consumer, (3) implementation-convenience subscriber. Class B convenience never silently becomes Class A ownership. | Architectural Design Decision |
| **C-D8** | Eventual Consistency is a first-class owner and is not an automatic consequence of Publication or of hydrationVersion increment. | Architectural Design Decision |
| **C-D9** | Parent Refresh may host multiple responsibilities without owning all of them. Host call-stack location is not ownership. | Architectural Design Decision |
| **C-D10** | Contract scope is the Parent Runtime Publication Corridor: Parent Refresh → Publication → Hydration Bus → Competition Initialization. Adjacent actives are out of scope except by reference. | Architectural Design Decision |
| **C-D11** | Evidence precedence: repository certification > runtime certification > structured investigation conclusion > hypothesis. | Architectural Design Decision |

---

# 4. Ownership Model

## 4.1 Identity

| Field | Definition |
|-------|------------|
| **Owner** | Canonical Athlete Authority / Identity |
| **Authority** | Sole authority to define and resolve Operating Athlete scope (OAI / sharedAthleteId semantics). |
| **Inputs** | Athlete roster and persisted operating-athlete selection substrate. |
| **Outputs** | Resolved athlete scope consumable by downstream responsibilities. |
| **Completion Responsibility** | Identity owns completion of athlete-scope resolution. |
| **Required Responsibilities** | Provide stable operating athlete scope for downstream Parent Initialization. |
| **Explicitly Forbidden Responsibilities** | Owning Parent Initialization completion; owning Publication; owning Rendering; absorbing Enrichment; acting as Match Breakdown owner. |

**Classification of ownership assignment:** Repository Certified (Canonical Identity Ownership; C-R10).

---

## 4.2 Parent Initialization

| Field | Definition |
|-------|------------|
| **Owner** | Parent Initialization Authority |
| **Authority** | Sole authority over Parent Initialization progress and over declaration of `INIT_COMPLETE`. |
| **Inputs** | Resolved athlete scope from Identity. |
| **Outputs** | Minimum Parent Initialization floor state: competitions loaded, P1 merge applied, entries present for render, render floor reachable. |
| **Completion Responsibility** | Parent Initialization Authority alone may declare `INIT_COMPLETE`. |
| **Required Responsibilities** | Athlete-scoped loadCompetitions; P1 merge; setEntries; CompetitionCard render floor. |
| **Explicitly Forbidden Responsibilities** | Owning Identity; owning Publication; owning Hydration bus meaning; owning Overlay / Topology / Match Breakdown enrichment; treating hydrationVersion as init completion; authorizing init cancellation via artifact-stage publication. |

**Classification of minimum floor contents:** Repository Certified (C-R5, C-R6).  
**Classification of named Owner title “Parent Initialization Authority”:** Architectural Design Decision (fills previously missing standalone ownership vocabulary).

---

## 4.3 Publication

| Field | Definition |
|-------|------------|
| **Owner** | Parent Runtime Publication Corridor |
| **Authority** | Sole authority to publish corridor invalidation / artifact-stage notification. |
| **Inputs** | Parent Refresh / publisher-scoped substrate eligible for artifact-stage notification. |
| **Outputs** | Publication occurrence (notification that a publisher-scoped change signal has been emitted). |
| **Completion Responsibility** | Publication owns completion of publication occurrence only. |
| **Required Responsibilities** | Emit artifact-stage notification under corridor ownership. |
| **Explicitly Forbidden Responsibilities** | Owning Parent Initialization; cancelling Parent Initialization; owning Rendering; completing Eventual Consistency; transferring ownership to observers or CompetitionTab; collapsing independent version counters into one ownership domain. |

**Classification of ownership assignment:** Repository Certified (Publication ownership CERTIFIED; C-R2, C-R4).  
**Classification of corridor non-idempotent publication property:** Repository Certified (C-R13).

---

## 4.4 Hydration

| Field | Definition |
|-------|------------|
| **Owner** | Hydration Orchestration Authority |
| **Authority** | Sole authority over hydration meaning: making invalidated substrate re-readable after publication or reconcile notification. |
| **Inputs** | Publication occurrence and/or reconcile-complete invalidation signals; entitled substrate caches. |
| **Outputs** | Re-readable hydrated / mirrored state for entitled consumers. |
| **Completion Responsibility** | Hydration owns hydration readiness of entitled substrate, not Parent Initialization completion. |
| **Required Responsibilities** | Preserve independent invalidation signals; support eventual re-read by entitled consumers. |
| **Explicitly Forbidden Responsibilities** | Completing Parent Initialization; owning Identity; owning canonical P1 truth; elevating Class B subscribers into ownership; treating mid-refresh observation timing as an ownership necessity. |

**Classification of independence from Initialization / Rendering / Publication:** Repository Certified (C-R6, C-R7, C-R12; plane model P6).  
**Classification of named Owner title “Hydration Orchestration Authority”:** Architectural Design Decision.

---

## 4.5 Rendering

| Field | Definition |
|-------|------------|
| **Owner** | Competition Rendering Pipeline (Parent Compete render floor) |
| **Authority** | Sole authority over presentation of the certified Competition Rendering floor on Parent Compete. |
| **Inputs** | Initialized entries / P1 merge outputs after Parent Initialization floor work. |
| **Outputs** | CompetitionCard render floor presentation. |
| **Completion Responsibility** | Rendering owns render-floor presentation, not publication occurrence and not eventual cross-surface convergence. |
| **Required Responsibilities** | Present the certified render path from storage through loadCompetitions, setEntries, and CompetitionCard. |
| **Explicitly Forbidden Responsibilities** | Owning Publication; owning Parent Initialization Authority; owning Eventual Consistency; requiring overlay/topology/artifact presence to satisfy render-floor ownership. |

**Classification of ownership assignment / floor:** Repository Certified (Competition Rendering Pipeline certification; C-R5).

---

## 4.6 Eventual Consistency

| Field | Definition |
|-------|------------|
| **Owner** | Eventual Consistency Authority |
| **Authority** | Sole authority over the meaning of post-invalidate convergence across entitled surfaces. |
| **Inputs** | Completed or in-progress Publication, Hydration, and surface re-reads. |
| **Outputs** | Architectural recognition of eventual alignment after invalidate + re-read. |
| **Completion Responsibility** | Eventual Consistency owns convergence completion claims. |
| **Required Responsibilities** | Treat convergence as eventual, not immediate; preserve split-pipeline legality where certified. |
| **Explicitly Forbidden Responsibilities** | Being treated as automatic consequence of Publication; being collapsed into hydrationVersion ownership; blocking `INIT_COMPLETE`; redefining canonical ownership. |

**Classification of eventual-not-immediate convergence principle:** Repository Certified (INV-C1 and Convergence class).  
**Classification of first-class exclusive Owner title:** Architectural Design Decision (C-D8).

---

# 5. Ownership Transfer Timeline

This section describes architectural authority transitions only. It does not describe implementation, scheduling, callbacks, or host call stacks.

```text
UNOWNED_SCOPE
    │
    │  Authority transfer: Identity acquires Athlete Scope ownership
    ▼
IDENTITY_RESOLVED
    │
    │  Authority transfer: Parent Initialization Authority acquires Initialization ownership
    │  (Identity remains Identity owner; scope is input, not transferred ownership of Identity)
    ▼
INITIALIZING
    │
    │  Authority transfer: Parent Initialization Authority declares INIT_COMPLETE
    │  when minimum floor is satisfied
    ▼
INIT_COMPLETE
    │
    │  No ownership transfer to Publication is implied by INIT_COMPLETE.
    │  Publication remains owned by Parent Runtime Publication Corridor at all times.
    │
    │  Publication may occur as a separate owned epoch.
    │  Ordering relative to INIT_COMPLETE is NOT certified (see §6 / §12).
    ▼
PUBLISHED
    │
    │  Authority: Publication completed publication occurrence only.
    │  Observation delivery does not transfer ownership.
    ▼
OBSERVATION_DELIVERED
    │
    │  Observers become aware. Consumers remain Consumers.
    │  No ownership transfer occurs by observation.
    ▼
HYDRATED
    │
    │  Authority remains with Hydration Orchestration Authority for hydration meaning.
    │  Hydration does not complete Initialization and does not own Rendering.
    ▼
RENDERED
    │
    │  Authority remains with Competition Rendering Pipeline for render-floor presentation.
    │  Rendering does not own Publication or Eventual Consistency.
    ▼
EVENTUALLY_CONSISTENT
    │
    │  Authority remains with Eventual Consistency Authority for convergence claims.
```

**Runtime Certified.**  
Current cold-start physics can interleave publication / hydration signaling with Initialization before the render floor is reached. That interleaving is runtime evidence of coupling risk, not proof that ownership transfers to Publication or that Publication is authorized to cancel Initialization.

**Architectural Design Decision.**  
Ownership does not transfer by proximity, hosting, observation, or cancellation side effects. Only the transitions above are legal ownership/authorization transitions under this contract.

---

# 6. INIT_COMPLETE

## 6.1 Who owns INIT_COMPLETE

**Architectural Design Decision.**  
`INIT_COMPLETE` is owned exclusively by **Parent Initialization Authority**.

**Repository Certified.**  
No prior architecture document defined `INIT_COMPLETE`. This section supplies the missing completion epoch required by C-D4.

## 6.2 When INIT_COMPLETE begins

**Architectural Design Decision.**  
`INIT_COMPLETE` as an epoch begins when Parent Initialization Authority starts Initialization after Identity has produced resolved athlete scope.

**Repository Certified.**  
Athlete-scope resolution is upstream of Minimum Parent Initialization and is Identity-owned (C-R5, C-R10). Bootstrap empty-to-resolved athlete transition is expected Mechanism A, not init failure (C-RT1).

## 6.3 When INIT_COMPLETE ends

**Architectural Design Decision.**  
`INIT_COMPLETE` ends when the Minimum Parent Initialization floor is satisfied:

athlete scope resolved → loadCompetitions → P1 merge → setEntries → CompetitionCard render floor.

At that instant, Parent Initialization Authority may declare Completion.

**Repository Certified.**  
That floor content is the certified minimum (C-R5). Enrichment is not part of the floor (C-R6, C-RT6).

## 6.4 What cannot complete INIT_COMPLETE

The following cannot complete `INIT_COMPLETE`:

| Non-completer | Classification |
|---------------|----------------|
| Artifact publication / artifact-stage notification | Repository Certified (C-R4, C-R6) |
| hydrationVersion increment | Repository Certified (C-R6, C-R12) |
| Overlay presence | Repository Certified (C-R6, C-RT5) |
| Topology presence | Repository Certified (C-R6) |
| Coach notes | Repository Certified (C-R6) |
| Match Breakdown / artifact visibility | Runtime Certified + Repository Certified (C-RT6) |
| CompetitionTab observation of publication | Repository Certified (C-R3) |
| Eventual Consistency claims | Architectural Design Decision (C-D8) |
| Rendering owning Publication | Repository Certified (C-R2) + Architectural Design Decision (§9) |

## 6.5 What cannot block INIT_COMPLETE

The following are not legally entitled to block `INIT_COMPLETE`:

| Non-blocker | Classification |
|-------------|----------------|
| Requirement that publication occur | Repository Certified (publication not required for minimum init; C-R6) |
| Requirement that mid-refresh consumers observe publication | Repository Certified (C-R3, C-R11) |
| Enrichment readiness (overlay / topology / coach notes / artifacts) | Repository Certified (C-R6; C-RT6) |
| Eventual Consistency completion | Architectural Design Decision |
| Class B convenience subscription behavior | Repository Certified (C-R3) + Architectural Design Decision (C-D7) |

**Runtime Certified.**  
Publication signaling can currently starve Initialization progress via the certified cancellation chain (C-RT3, C-RT4). That proves an ownership-collision mechanism exists in runtime. It does **not** grant Publication architectural authority to block or cancel Initialization (C-R4).

## 6.6 Whether INIT_COMPLETE is required before publication

**Architectural Design Decision (uncertainty preserved by C-D5).**  
This contract does **not** certify that Publication must wait for `INIT_COMPLETE`, and does **not** certify that Publication may legally precede `INIT_COMPLETE`.

**Repository Certified / investigation status.**  
Earliest architecturally safe publication epoch remains uncertified. Candidates remain:

- **Candidate A:** immediately after Parent Refresh publisher-stage returns.
- **Candidate B:** only after Parent Initialization reaches LOAD_COMPETITIONS_BEGIN (or equivalent init-progress epoch).

Both remain uncertified. Ownership of each responsibility is defined here without smuggling an epoch choice.

**Architectural Design Decision.**  
Regardless of future epoch certification:

1. Publication never completes Initialization.
2. Publication never cancels Initialization by architectural right.
3. `INIT_COMPLETE` never becomes an enrichment gate.

---

# 7. Publication Contract

## 7.1 Publication as ownership responsibility

**Repository Certified.**  
Publication is owned by the Parent Runtime Publication Corridor, not by CompetitionTab.

**Repository Certified.**  
Artifact publication is authorized as artifact-stage notification only.

## 7.2 Separated concepts

| Concept | Meaning under this contract | Classification |
|---------|-----------------------------|----------------|
| **Publication** | Owned emission of corridor notification. | Repository Certified |
| **Observation** | Delivery of awareness that publication occurred. | Repository Certified (bus delivers immediately) + Architectural Design Decision (observation ≠ ownership) |
| **Consumption** | A Consumer using published/invalidated substrate under its own authority. | Architectural Design Decision (C-D7) |
| **Execution** | Temporary runtime performance of work inside a host path. | Architectural Design Decision (C-D2, C-D9) |
| **Rendering** | Owned presentation of the render floor. | Repository Certified |
| **Hydration** | Owned re-readability after invalidation. | Repository Certified independence + Architectural Design Decision owner naming |

## 7.3 Constitutional vs implementation relationships

### Constitutional (this contract)

1. Publication ownership ≠ CompetitionTab ownership.
2. Publication ≠ Initialization completion.
3. Publication ≠ Initialization cancellation authority.
4. Observation ≠ ownership.
5. Consumption ≠ ownership.
6. Execution during Parent Refresh ≠ Refresh ownership of hosted responsibilities.
7. Hydration notification ≠ Eventual Consistency completion.
8. Rendering does not own Publication.
9. Mid-refresh publication timing is not an ownership necessity for documented production consumers.

### Implementation (not constitutionalized here)

1. Exact publisher call sites, store APIs, and probe names.
2. Equality-gating strategies for publication idempotence.
3. Candidate A vs Candidate B epoch selection.
4. Consumer-local filters (role checks, local readiness flags, dedupe).
5. Hosting of multiple responsibilities inside one Refresh function.

Those remain implementation or open investigation concerns and are deliberately excluded from constitutional ownership text.

---

# 8. Consumer Observation Contract

This section closes the INV8 governance gap: the repository certified a publication/notification bus, but not a shared rule for when consumers are authorized to react relative to publication and initialization.

**Companion authority.**  
The authoritative Consumer Observation constitution is `docs/architecture/consumer-observation-contract-v1.md`. This §8 remains a binding summary and must not contradict that companion. Where elaboration is required, Consumer Observation Contract v1 controls.

## 8.1 What publication guarantees

**Repository Certified.**

Publication guarantees:

1. That a publisher-owned notification / invalidation signal has occurred.
2. That artifact-stage publication, when used, is notification of artifact-stage change.
3. That observation may be delivered to current listeners upon publication.

## 8.2 What publication does NOT guarantee

**Repository Certified + Architectural Design Decision.**

Publication does **not** guarantee:

1. Parent Initialization completion (`INIT_COMPLETE`).
2. Authorization to cancel Parent Initialization.
3. Rendering-floor completion.
4. Eventual Consistency completion.
5. That any specific consumer must react immediately.
6. That mid-refresh reaction timing is required for correctness of documented production consumers.
7. Transfer of any ownership to observers or consumers.
8. Collapse of independent version counters into one meaning.

## 8.3 Observation delivery vs reaction authorization

| Question | Contract answer | Classification |
|----------|-----------------|----------------|
| Are observers notified when publication occurs? | Yes — observation delivery is immediate under the certified bus model. | Repository Certified |
| Does immediate observation imply reaction authorization? | No. | Architectural Design Decision |
| Are consumers authorized immediately to **claim ownership**? | No. Consumers never acquire ownership by observation. | Architectural Design Decision |
| May consumers react immediately under their own consumer-local authority? | Yes, unless a future certified epoch rule restricts a specific reaction class. No such shared epoch rule is certified today. | Repository Certified (current delegation model) + Architectural Design Decision (shared authorization vocabulary) |
| May consumers defer reaction? | Yes. Deferral does not violate Publication ownership. | Architectural Design Decision |
| May consumers cancel Parent Initialization because they observed publication? | No. Cancellation of Initialization is not an authorized meaning of Publication. | Repository Certified (C-R4) + Architectural Design Decision |
| May consumers ignore publication? | Yes, except where a surface is a mandated consumer of a specific substrate by its own ownership contract. Ignoring publication never transfers ownership and never completes another responsibility. | Architectural Design Decision |
| Does Class B subscription create a mandate to react mid-refresh? | No. | Repository Certified (C-R3, C-R11) |

## 8.4 Constitutional Consumer Observation Rules

**Architectural Design Decision.**

1. **Observation is not authorization of cancellation.**  
   Observing publication never authorizes a consumer to terminate Parent Initialization.

2. **Observation is not ownership.**  
   Observer and Consumer roles remain non-owning unless a separate certified contract assigns ownership.

3. **Reaction eligibility is consumer-owned unless a shared epoch is later certified.**  
   Until a publication-epoch rule is certified, each consumer retains local authority to defer, perform, or ignore reaction work, subject to §8.3 prohibitions.

4. **Shared corridor law supersedes local convenience.**  
   No Class B convenience subscriber may redefine Publication as Initialization cancellation or as `INIT_COMPLETE`.

5. **Mandate classes are explicit.**  
   A mandated consumer must be named as such by a certified ownership boundary. In the absence of that naming, subscribers default to optional observers/consumers.

This section is the binding summary of the Consumer Observation Contract previously missing from the repository. The full constitution is Consumer Observation Contract v1.

---

# 9. Ownership Rules

These rules are constitutional.

| Rule | Statement | Classification |
|------|-----------|----------------|
| **OR-1** | One responsibility has exactly one owner. | Repository Certified (C-R1) |
| **OR-2** | Execution does not imply ownership. | Architectural Design Decision (C-D2, C-D9) |
| **OR-3** | Observation does not imply ownership. | Architectural Design Decision (§8) |
| **OR-4** | Calling another subsystem does not imply ownership of that subsystem’s responsibility. | Architectural Design Decision |
| **OR-5** | Publication does not transfer ownership. | Repository Certified (C-R2) + Architectural Design Decision |
| **OR-6** | Hydration does not complete Initialization. | Repository Certified (C-R6) |
| **OR-7** | Rendering does not own Publication. | Repository Certified (C-R2) |
| **OR-8** | Parent Refresh hosting does not own all hosted responsibilities. | Architectural Design Decision (C-D9) |
| **OR-9** | Class B convenience never silently becomes Class A ownership. | Repository Certified (C-R3) + Architectural Design Decision (C-D7) |
| **OR-10** | Enrichment cannot complete or redefine Minimum Parent Initialization. | Repository Certified (C-R6, C-RT6) |
| **OR-11** | Identity remains upstream and separately owned. | Repository Certified (C-R10) |
| **OR-12** | Canonical competition truth remains P1 / parent-owned. | Repository Certified (C-R9) |
| **OR-13** | Independent invalidation counters remain independent ownership signals. | Repository Certified (C-R12) |
| **OR-14** | Eventual Consistency is not automatic upon Publication. | Architectural Design Decision (C-D8) + Repository Certified eventual principle (INV-C1) |
| **OR-15** | Artifact publication is not Parent Initialization cancellation. | Repository Certified (C-R4) |
| **OR-16** | Eliminated root-cause classes remain closed as ownership premises. | Runtime Certified (C-RT5) |

---

# 10. Architectural State Machine

States below are architectural epochs/roles, not UI screens or function names.

```text
UNINITIALIZED
    │ Identity unresolved
    ▼
IDENTITY_RESOLVING
    │ Identity Authority in force
    ▼
IDENTITY_RESOLVED
    │ Athlete scope available as input
    ▼
INITIALIZING
    │ Parent Initialization Authority in force
    ▼
INIT_COMPLETE
    │ Minimum Parent Initialization floor satisfied
    │
    ├──────────────────────────────┐
    │                              │
    ▼                              ▼
PUBLISHED                    (publication timing relative
    │                         to INIT_COMPLETE uncertified)
    ▼
OBSERVATION_DELIVERED
    │ Observers aware; ownership unchanged
    ▼
HYDRATED
    │ Hydration Orchestration Authority in force for hydration meaning
    ▼
RENDERED
    │ Competition Rendering Pipeline floor presented
    ▼
EVENTUALLY_CONSISTENT
    │ Eventual Consistency Authority may claim convergence
```

### State meanings

| State | Owner in force | Classification of state necessity |
|-------|----------------|-----------------------------------|
| UNINITIALIZED | none for Parent Initialization | Architectural Design Decision |
| IDENTITY_RESOLVING / IDENTITY_RESOLVED | Identity | Repository Certified |
| INITIALIZING | Parent Initialization Authority | Architectural Design Decision name; Repository Certified floor contents |
| INIT_COMPLETE | Parent Initialization Authority (completion epoch) | Architectural Design Decision (missing concept supplied) |
| PUBLISHED | Parent Runtime Publication Corridor | Repository Certified ownership |
| OBSERVATION_DELIVERED | no new owner; observers non-owning | Architectural Design Decision closing governance gap |
| HYDRATED | Hydration Orchestration Authority | Architectural Design Decision name; Repository Certified independence |
| RENDERED | Competition Rendering Pipeline | Repository Certified |
| EVENTUALLY_CONSISTENT | Eventual Consistency Authority | Architectural Design Decision owner; Repository Certified eventual principle |

### Illegal transitions (constitutional)

1. PUBLISHED → INIT_COMPLETE as if Publication completed Initialization.
2. OBSERVATION_DELIVERED → ownership transfer to CompetitionTab.
3. HYDRATED → INIT_COMPLETE solely because hydrationVersion advanced.
4. Any enrichment state → INIT_COMPLETE.
5. EVENTUALLY_CONSISTENT required before INIT_COMPLETE.

**Runtime Certified.**  
Observed cold-start sequences may visit publication/observation signaling before INITIALIZING reaches the render floor. That is an observed interleaving, not a legal ownership rewrite.

---

# 11. Validation Matrix

| Rule / claim | Protected systems affected | Repository / runtime evidence | Existing certifications remain valid? | Does INV8 change ownership? |
|--------------|----------------------------|-------------------------------|----------------------------------------|-----------------------------|
| Identity separate owner | Canonical Identity Ownership; Athlete Authority | Canonical Athlete Authority Spec; CertifiedArchitectureRegister Identity CERTIFIED; C-R10; C-RT1/5 | Yes | No — Identity remains closed |
| Parent Initialization exclusive owner of INIT_COMPLETE | Competition Rendering Pipeline floor; Parent Runtime corridor | Checkpoint Minimum Parent Initialization reconstruction; absence of prior INIT_COMPLETE | Yes — floor preserved | **Adds** missing Init ownership vocabulary; does not reassign Identity/Overlay/Topology |
| Publication owned by Parent Runtime Publication Corridor | Publication Ownership; Competition Rendering consumer boundary | Checkpoint Publication ownership CERTIFIED; C-R2 | Yes | No — confirms certified shift away from CompetitionTab |
| CompetitionTab Class B only | Competition Rendering Pipeline | Checkpoint CompetitionTab audit; C-R3 | Yes | No |
| Artifact publication ≠ init cancellation | Parent Initialization; Coach Artifact Pipeline | Checkpoint Artifact publication contract; C-R4; C-RT3 proves collision risk only | Yes | No ownership change; forbids unauthorized meaning |
| Enrichment excluded from init floor | Overlay Merge; Topology; Coach Artifact Pipeline | C-R6; C-RT6; Active Investigation Register MB publication remains separate | Yes | No |
| Hydration independent | Hydration Orchestration; invalidation counters | Governance plane model; C-R7; C-R12 | Yes | No ownership fusion |
| Rendering floor owner | Competition Rendering Pipeline | CertifiedArchitectureRegister; runtime dependency maps | Yes — floor remains; Parent runtime persistence/corridor still open beside this contract | No change to certified floor contents |
| Eventual Consistency first-class | Convergence invariants | INV-C1–C5; C-D8 | Yes | **Adds** exclusive owner title; does not rewrite INV-C truths |
| Consumer Observation Contract | Shared invalidation bus consumers; corridor | INV8 Consumer Observation certification (bus ≠ observation contract); C-R11 | Yes | **Adds** shared observation law previously missing |
| Publication epoch A/B unresolved | Parent Runtime Publication Corridor | Checkpoint remaining question; C-D5 | Yes | No — intentionally unresolved |
| Starvation mechanism recognized | Corridor boundary | C-RT3; C-RT4 | Yes | No — mechanism certified; correction not authorized by this document |

---

# 12. Open Decisions

Only true remaining design decisions / uncertified choices:

1. **Earliest architecturally safe publication epoch**  
   Candidate A vs Candidate B remains uncertified. This contract defines ownership without selecting the epoch.

2. **Whether a future certified rule will restrict consumer reaction classes relative to INIT_COMPLETE**  
   This contract forbids cancellation-by-observation and ownership-by-observation, and permits deferral/ignore. It does not yet impose a shared mandatory deferral epoch for all reactions.

3. **Whether production correction is required, and what the smallest ownership-preserving correction is**  
   Explicitly out of scope for this constitutional document (C-D6 preserved; no implementation authorized).

Everything else required for ownership constitution is resolved above.

---

# Constitutional Review

## 1. What are we still not thinking about?

1. **Cross-plane initialization generality.**  
   This contract is Parent Runtime corridor–scoped. Summary, Coach, and Incident Capture planes may need isomorphic *application* of these definitions, but their plane-specific floors are not authored here.

2. **Multi-generation overlap.**  
   The contract forbids ownership transfer by observation, but does not yet define multi-generation initialization overlapping publications (second refresh while first INIT_COMPLETE is in progress) as a first-class epoch algebra.

3. **Failure / abort taxonomy.**  
   We define what cannot complete or block `INIT_COMPLETE`, but not a full owned failure catalog (hard abort vs retryable starvation vs expected bootstrap re-entry) beyond leaving C-RT1/C-RT2 closed.

4. **Mandated-consumer registry.**  
   §8 allows mandated consumers only when explicitly named by certified boundaries, but this document does not publish a complete registry of mandated vs optional consumers across all MatMind planes.

## 2. What assumptions are still implicit?

1. That “CompetitionCard render floor” as certified minimum remains the correct Completion marker for Parent Compete Initialization across future render-surface evolution.
2. That Parent Refresh will continue to be a host of multiple responsibilities rather than an owner — an assumption backed by C-D9, still runtime-coupled today.
3. That independent monotonic counters will remain the invalidation ontology (no later unified generation token is assumed or forbidden beyond C-R12’s non-collapse rule).
4. That Consumer-local eligibility remains tolerable until epoch certification lands — made explicit in §8, still an interim governance posture.
5. That adjacent ACTIVE investigations (Runtime Persistence survival; Parent Match Breakdown publication consistency) do not secretly own Parent Initialization — referenced as separate, not fully re-proven here.

## 3. Which sections are still implementation instead of architecture?

None of the normative ownership/epoch sections intentionally prescribe implementation. Residual risk of leakage exists only by reference when quoting certified floor stage names (`loadCompetitions`, `setEntries`, probe labels). Those names appear as **certified floor anchors**, not as mandated code structure. Candidate epoch names (LOAD_COMPETITIONS_BEGIN, refresh return) remain investigation vocabulary under C-D5 and are not adopted as constitutional ordering law.

## 4. Could this contract govern Summary, Coach, Incident Capture, and future runtime planes without modification?

**Partially yes at the definitional layer; not fully yes at the floor layer.**

- **Reusable without modification:** Definitions (§2), Immutable Constraints discipline (§3 pattern), Ownership Rules (§9), Publication vs Observation vs Consumption separation (§7–§8), single-owner rule, and `INIT_COMPLETE` as a plane-local completion epoch concept.
- **Requires plane-specific floor appendices (not owned by this document):** Minimum Initialization floor content differs by plane (Summary vs Compete vs Coach reconcile vs Incident Capture). This v1 freezes the Parent Competition Initialization floor only.
- **Requires no redesign of certified systems:** Identity, Overlay Merge, Topology, and Rendering floor remain closed; other planes may consume this constitution and supply their own floor schedules under the same ownership algebra.

**ARB conclusion:**  
This contract is sufficient as the Parent Runtime Initialization constitution and as the definitional constitution for future plane init contracts. It is not, by itself, a multi-plane floor schedule. That is intentional and correct.

---

## Freeze statement

Parent Initialization Ownership Contract v1 is hereby authored as constitutional architecture for MatMind Parent Runtime Initialization and the Parent Runtime Publication Corridor.

No implementation is authorized by this document.

Next certification step, when directed: determine the earliest architecturally safe publication epoch against this contract without reopening certified ownership boundaries.
