# Consumer Observation Contract v1

| Field | Value |
|-------|--------|
| **Status** | Constitutional architecture — Companion Ownership Contract v1 |
| **Authority class** | Architecture Review Board |
| **Date** | 2026-07-15 |
| **Governing investigation** | INV8 — Parent Runtime Publication Corridor |
| **Companion to** | Parent Initialization Ownership Contract v1 |
| **Relationship to Parent Init §8** | This document is the authoritative Consumer Observation constitution. Parent Initialization Ownership Contract v1 §8 remains a binding summary that must not contradict this v1. Where elaboration is required, this document controls. |
| **Does not authorize** | Implementation, code changes, production correction design, redesign of certified systems, or certification of Publication epoch Candidates A/B |

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
This contract defines permanent architectural law for Consumer Observation on the Parent Runtime Publication Corridor: who may observe, what observation means, when observation is constitutionally authorized relative to adjacent responsibilities, which reactions are permitted or prohibited, and whether observation may ever alter Parent Initialization ownership.

**Repository Certified.**  
The repository certified a publication / notification bus. It did not previously certify a standalone shared Consumer Observation Contract governing reaction authorization relative to Publication and Parent Initialization.

**Repository Certified.**  
Parent Initialization Ownership Contract v1 established ownership of Parent Initialization, Publication, Hydration, Rendering, and Eventual Consistency, and included a binding Consumer Observation summary (§8). This companion elaborates that summary into a complete observation constitution without reopening certified ownership of those responsibilities.

## 1.2 Architectural gap closed

**Architectural Design Decision.**  
This contract closes the observation-authorization gap by:

1. Separating **Observation Delivery**, **Reaction Authorization**, and **Responsibility Ownership** into distinct constitutional planes.
2. Defining observation epochs relative to Publication, Parent Initialization, Hydration, Rendering, and Eventual Consistency.
3. Enumerating permitted and prohibited reaction classes, including an absolute prohibition on Init-cancellation / Init-abort reactions derived from observation.
4. Defining consumer eligibility classes (mandated, optional, Class B convenience) without elevating convenience into ownership.
5. Stating permanently that observation may never alter Parent Initialization ownership or declare `INIT_COMPLETE`.

## 1.3 What this contract does not decide

**Architectural Design Decision (uncertainty preserved with Parent Init C-D5).**  
This contract does **not** certify the earliest architecturally safe Publication epoch (Candidate A vs Candidate B / B₁ / B₂). Publication timing legality remains an open companion decision under Parent Initialization Ownership Contract v1 §6.6 / §12.1.

**Architectural Design Decision.**  
This contract does **not** select a production correction shape, authorize implementation, or designate the smallest ownership-preserving change (Parent Init C-D6 / §12.3 preserved).

---

# 2. Definitions

All definitions in this section are **Architectural Design Decision** and are intentionally implementation-independent. They name architectural roles and epochs, not modules, functions, hooks, or call stacks.

### Observer

A participant that receives awareness that a publication or invalidation has occurred. Observation is awareness of occurrence. An Observer never acquires ownership of Publication, Parent Initialization, Hydration meaning, Rendering, or Eventual Consistency by observing.

### Observation

The delivery of awareness that a publisher-scoped notification or invalidation signal has occurred. Observation guarantees awareness opportunity under the certified bus model. Observation does not guarantee reaction authorization, responsibility completion, or ownership transfer.

### Observation Delivery

The constitutional fact that eligible listeners may become aware upon Publication. Delivery may be immediate under the certified bus model. Delivery is not Reaction Authorization.

### Reaction

Any subsequent act by an Observer or Consumer that changes local work, scheduling, progress, presentation, or claims about another responsibility after Observation Delivery. Reactions are classified as permitted or prohibited by this contract.

### Reaction Authorization

The constitutional permission for a named reaction class to occur after Observation Delivery. Reaction Authorization is never implied by Observation Delivery alone.

### Consumer

A participant that depends on outputs belonging to another owner. A Consumer may read or react within its own authority subject to this contract, but never acquires ownership of the producer’s responsibility by consuming it.

### Mandated Consumer (Class A — mandate)

A Consumer explicitly named by a certified ownership boundary as required to consume a specific substrate for that boundary’s correctness. Mandates are substrate-specific and never silently expand into ownership of Publication or Parent Initialization.

### Optional Consumer

A Consumer not named as mandated. Default status for corridor subscribers absent certified mandate naming.

### Implementation-Convenience Subscriber (Class B)

A participant that observes or fan-outs hydration / publication signals for local convenience. Class B participation is not ownership (Parent Init C-R3, C-D7). Class B never creates mid-refresh reaction necessity as an ownership rule.

### Observation Epoch

An architectural interval defined by which corridor responsibility states are in force when Observation Delivery occurs. Epochs constrain Reaction Authorization; they do not transfer ownership.

### Init-Affecting Reaction

Any reaction that terminates, aborts, cancels, starves, blocks, redefines, or claims completion of Parent Initialization or `INIT_COMPLETE`.

### Local Enrichment Reaction

Any reaction that refreshes, re-reads, or reprojects enrichment substrates (including overlay, topology, coach notes, artifact visibility) under enrichment ownership, without altering Parent Initialization ownership or progress legality.

### Ownership-Neutral Re-read Reaction

Any reaction that re-reads entitled substrate under the reactor’s existing consumer authority without claiming ownership, completion, or cancellation of another responsibility.

---

# 3. Immutable Constraints

## 3.1 Constraints carried from Parent Initialization Ownership Contract v1

The following remain constitutional and are binding inputs to this contract. A later amendment that violates any item is rejected without argument on timing, ergonomics, or runtime convenience.

| ID | Statement | Classification |
|----|-----------|----------------|
| **C-R2** | CompetitionTab consumes publication; it does not own publication. | Repository Certified |
| **C-R3** | CompetitionTab hydration fan-out participation is Class B, not ownership. Parent Initialization does not fundamentally depend on CompetitionTab observing artifact publication immediately. | Repository Certified |
| **C-R4** | Artifact publication is authorized only as artifact-stage notification. Publication is not Parent Initialization cancellation. | Repository Certified |
| **C-R6** | Overlay, topology, coach notes, artifact hydrate, publication, and hydrationVersion are enrichment relative to Minimum Parent Initialization. | Repository Certified |
| **C-R7** | Publication, Initialization, Hydration, Overlay, Topology, Identity, and Rendering are independent responsibilities. | Repository Certified |
| **C-R11** | No documented production consumer requires mid-refresh publication timing as an ownership necessity. | Repository Certified |
| **C-R12** | competitionVersion, aggregate version, and hydrationVersion remain independent monotonic invalidation signals. | Repository Certified |
| **C-RT3** | Certified runtime proves: coachSyncHydrationVersion++ → cleanup → new focus callback → cancelled=true → RETURN_BEFORE_LOAD_COMPETITIONS is the certified starvation mechanism under investigation. | Runtime Certified |
| **C-RT4** | The certified cold Parent startup interleaving sequence remains binding runtime evidence of coupling risk. | Runtime Certified |
| **C-RT5** | Eliminated root-cause classes remain closed as ownership premises. | Runtime Certified |
| **OR-3** | Observation does not imply ownership. | Architectural Design Decision (Parent Init) |
| **OR-5** | Publication does not transfer ownership. | Repository Certified + Architectural Design Decision |
| **OR-9** | Class B convenience never silently becomes Class A ownership. | Repository Certified + Architectural Design Decision |
| **OR-15** | Artifact publication is not Parent Initialization cancellation. | Repository Certified |

## 3.2 Consumer Observation constitutional constraints (this contract)

| ID | Statement | Classification |
|----|-----------|----------------|
| **CO-R1** | Observation Delivery, Reaction Authorization, and Responsibility Ownership are three distinct constitutional planes. | Architectural Design Decision |
| **CO-R2** | Observation Delivery may be immediate; Reaction Authorization is never automatic from delivery. | Repository Certified (bus immediacy) + Architectural Design Decision (auth separation) |
| **CO-R3** | Observation may never alter Parent Initialization ownership. | Architectural Design Decision |
| **CO-R4** | Observation may never declare, complete, or revoke `INIT_COMPLETE`. | Architectural Design Decision |
| **CO-R5** | Init-Affecting Reactions derived from Observation are prohibited in every Observation Epoch. | Architectural Design Decision |
| **CO-R6** | Prohibition of Init-Affecting Reactions does not certify Publication epoch Candidates A/B. | Architectural Design Decision (preserves Parent Init C-D5) |
| **CO-R7** | Consumer eligibility defaults to Optional unless a certified boundary names a Mandated Consumer. | Architectural Design Decision |
| **CO-R8** | Class B subscribers are bound by shared corridor law; local convenience cannot redefine Publication as Init cancellation or as `INIT_COMPLETE`. | Repository Certified + Architectural Design Decision |
| **CO-R9** | Eventual Consistency claims are never authorized solely by Observation Delivery. | Architectural Design Decision (aligns Parent Init C-D8 / OR-14) |
| **CO-R10** | This contract must not reopen Identity, Canonical Athlete Authority, Overlay Merge, Artifact Persistence, Competition Rendering Pipeline floor, Topology Ownership, or Coach Runtime ownership. | Repository Certified (Parent Init C-R8) |

---

# 4. Observer Ownership Model

## 4.1 What Observers own

| Field | Definition |
|-------|------------|
| **Owner of Observation Delivery mechanics** | Parent Runtime Publication Corridor owns Publication occurrence; the certified notification bus delivers Observation. Observers do not own the bus. |
| **Owner of Reaction Authorization for prohibited classes** | This contract (shared corridor law). |
| **Owner of Reaction Authorization for permitted non-Init-Affecting classes** | The reacting Consumer’s own consumer-local authority, unless a future certified shared epoch rule further restricts that class. |
| **Owner of Parent Initialization** | Parent Initialization Authority only (never Observers). |
| **Owner of Publication** | Parent Runtime Publication Corridor only (never Observers). |

**Classification:** Architectural Design Decision layered on Repository Certified Publication ownership (C-R2) and Parent Init §4.

## 4.2 Explicit non-ownership

Observers and Consumers do **not** own:

1. Parent Initialization progress or `INIT_COMPLETE`.
2. Publication occurrence or publication meaning.
3. Hydration meaning (Hydration Orchestration Authority).
4. Competition Rendering floor ownership.
5. Eventual Consistency completion claims.
6. Identity / Canonical Athlete Authority.
7. Canonical P1 competition truth.

Presence in a listener set, effect dependency list, or call stack is not ownership (Parent Init OR-2, OR-3, OR-4).

## 4.3 May observation alter Parent Initialization ownership?

**Architectural Design Decision. Absolute answer: No.**

Observation may never:

| Forbidden alteration | Rule |
|----------------------|------|
| Transfer Parent Initialization ownership to an Observer or Consumer | CO-R3, OR-3 |
| Transfer Parent Initialization ownership to Publication | OR-5, C-R4 |
| Create Init ownership in CompetitionTab by Class B subscription | C-R3, OR-9, CO-R8 |
| Treat Observation Delivery as Init ownership acquisition | CO-R1, CO-R3 |
| Treat cancellation side effects as proof of Init ownership change | Parent Init §5; C-RT3 proves mechanism only |

Runtime evidence that observation currently starves Initialization (C-RT3, C-RT4) proves an ownership-collision mechanism, not a legal ownership transfer.

---

# 5. Observation Relative to Adjacent Responsibilities

## 5.1 Relative to Publication

| Question | Constitutional answer | Classification |
|----------|----------------------|----------------|
| When may Observation Delivery occur? | Upon Publication occurrence, under corridor ownership. | Repository Certified |
| Does Publication guarantee Observation Delivery opportunity? | Yes, to current eligible listeners. | Repository Certified |
| Does Publication authorize Init-Affecting Reactions? | No. | Repository Certified (C-R4) + Architectural Design Decision (CO-R5) |
| Does Publication complete Initialization, Rendering, or Eventual Consistency? | No. | Repository Certified + Architectural Design Decision |
| Does Observation acquire Publication ownership? | No. | Repository Certified (C-R2) |

## 5.2 Relative to Parent Initialization

| Question | Constitutional answer | Classification |
|----------|----------------------|----------------|
| May Observation occur while INITIALIZING? | Delivery may occur as runtime interleaving; delivery is not Init authority. | Runtime Certified (interleaving) + Architectural Design Decision (non-authority) |
| May Observation occur after `INIT_COMPLETE`? | Yes. | Architectural Design Decision |
| May Observation declare `INIT_COMPLETE`? | No. | Architectural Design Decision (CO-R4) |
| May Observation cancel, abort, starve, or block Parent Initialization? | No, in every epoch. | Architectural Design Decision (CO-R5) |
| Is mid-refresh Observation an ownership necessity for Parent Initialization? | No. | Repository Certified (C-R3, C-R11) |
| Who alone may declare `INIT_COMPLETE`? | Parent Initialization Authority. | Parent Init §4.2 / §6 |

## 5.3 Relative to Hydration

| Question | Constitutional answer | Classification |
|----------|----------------------|----------------|
| Is hydrationVersion advance Publication/Observation signaling? | It may carry publisher-scoped invalidation observation; it remains an independent counter. | Repository Certified (C-R12) |
| Does Observation of hydration advance complete Parent Initialization? | No. | Repository Certified (C-R6; Parent Init OR-6) |
| Does Observation of hydration advance authorize Init-Affecting Reactions? | No. | Architectural Design Decision (CO-R5) |
| May Observers perform Ownership-Neutral Re-read Reactions after hydration observation? | Yes, subject to §7–§8. | Architectural Design Decision |
| May Observers elevate Class B hydration fan-out into Init ownership? | No. | Repository Certified (C-R3) |

## 5.4 Relative to Rendering

| Question | Constitutional answer | Classification |
|----------|----------------------|----------------|
| Does Observation authorize Rendering-floor ownership claims? | No. Rendering remains owned by Competition Rendering Pipeline. | Repository Certified |
| May Observation require enrichment presentation before render floor? | No. Enrichment is not the Minimum Parent Initialization floor. | Repository Certified (C-R6) |
| May a Consumer re-render under Rendering authority after observation? | Yes, as Ownership-Neutral or local presentation work, without cancelling Parent Initialization. | Architectural Design Decision |
| Does Rendering own Publication because it observes invalidation? | No. | Repository Certified (Parent Init OR-7) |

## 5.5 Relative to Eventual Consistency

| Question | Constitutional answer | Classification |
|----------|----------------------|----------------|
| Does Observation Delivery complete Eventual Consistency? | No. | Architectural Design Decision (CO-R9; Parent Init OR-14) |
| May Eventual Consistency require Init-Affecting Reactions upon Observation? | No. Eventual Consistency may not block `INIT_COMPLETE` and may not cancel Initialization by observation. | Architectural Design Decision |
| May consumers eventually re-read after Observation? | Yes — eventual re-read is compatible with Eventual Consistency Authority, without Init cancellation. | Repository Certified eventual principle + Architectural Design Decision |

---

# 6. Observation Epochs

Epochs below are architectural intervals for Reaction Authorization analysis. They are not UI screens, function names, or required code stages.

```text
EPOCH_UNSCOPED
    │ Identity unresolved — corridor consumers lack operating athlete scope
    ▼
EPOCH_IDENTITY_RESOLVED
    │ Scope available; Parent Initialization may be INITIALIZING or not yet started
    ▼
EPOCH_INITIALIZING
    │ Parent Initialization Authority in force; INIT_COMPLETE not declared
    ▼
EPOCH_INIT_COMPLETE
    │ Minimum Parent Initialization floor satisfied
    ▼
EPOCH_PUBLISHED_OBSERVED
    │ Observation Delivery has occurred (may interleave earlier in runtime)
    ▼
EPOCH_HYDRATION_AWARE
    │ Observers aware of hydration / invalidation signaling
    ▼
EPOCH_RENDER_FLOOR_ACTIVE
    │ Competition Rendering floor may be presented
    ▼
EPOCH_EVENTUAL_CONSISTENCY_PENDING_OR_CLAIMABLE
    │ Eventual Consistency Authority governs convergence claims
```

**Runtime Certified.**  
Cold-start physics may deliver `EPOCH_PUBLISHED_OBSERVED` / `EPOCH_HYDRATION_AWARE` while still inside `EPOCH_INITIALIZING`. That interleaving is evidence of coupling risk, not authorization of Init-Affecting Reactions.

### Epoch authorization matrix (constitutional)

| Observation Epoch | Observation Delivery legal? | Ownership-Neutral Re-read | Local Enrichment Reaction | Init-Affecting Reaction | Claim `INIT_COMPLETE` | Claim Eventual Consistency complete solely from observation |
|-------------------|-----------------------------|---------------------------|---------------------------|-------------------------|----------------------|---------------------------------------------------------------|
| EPOCH_UNSCOPED | Yes (bus may fire) | Limited / scope-gated by Identity | Not as Init substitute | **Prohibited** | **Prohibited** | **Prohibited** |
| EPOCH_IDENTITY_RESOLVED | Yes | Permitted | Permitted under enrichment owners | **Prohibited** | **Prohibited** | **Prohibited** |
| EPOCH_INITIALIZING | Yes (delivery ≠ authority) | Permitted if non-Init-Affecting | Permitted if non-Init-Affecting | **Prohibited** | **Prohibited** | **Prohibited** |
| EPOCH_INIT_COMPLETE | Yes | Permitted | Permitted under enrichment owners | **Prohibited** | **Prohibited** (Observers never declare it) | **Prohibited** |
| EPOCH_PUBLISHED_OBSERVED | Definitionally yes | Permitted if non-Init-Affecting | Permitted if non-Init-Affecting | **Prohibited** | **Prohibited** | **Prohibited** |
| EPOCH_HYDRATION_AWARE | Yes | Permitted if non-Init-Affecting | Permitted if non-Init-Affecting | **Prohibited** | **Prohibited** | **Prohibited** |
| EPOCH_RENDER_FLOOR_ACTIVE | Yes | Permitted | Permitted under enrichment owners | **Prohibited** | **Prohibited** | **Prohibited** |
| EPOCH_EVENTUAL_CONSISTENCY_* | Yes | Permitted | Permitted under enrichment owners | **Prohibited** | **Prohibited** | **Prohibited** |

**Architectural Design Decision (CO-R5).**  
The Init-Affecting column is prohibition in **all** epochs. There is no Observation Epoch in which observation-derived cancellation, abort, starvation, or blocking of Parent Initialization becomes legal.

**Architectural Design Decision (CO-R6).**  
This matrix does not decide whether Publication itself may legally occur before `INIT_COMPLETE` or before `LOAD_COMPETITIONS_BEGIN`. That remains Parent Init C-D5.

---

# 7. Permitted Reactions

The following reaction classes are constitutionally permitted after Observation Delivery, subject to consumer eligibility (§9) and the absolute prohibitions in §8.

| ID | Permitted reaction class | Conditions | Classification |
|----|--------------------------|------------|----------------|
| **PR-1** | **Ignore** | Always permitted for Optional and Class B observers; Mandated Consumers may ignore only signals outside their certified substrate mandate. | Architectural Design Decision |
| **PR-2** | **Defer** | Always permitted. Deferral does not violate Publication ownership and does not complete any other responsibility. | Architectural Design Decision |
| **PR-3** | **Ownership-Neutral Re-read** | Permitted when the Consumer already has substrate entitlement; must not cancel or block Parent Initialization. | Architectural Design Decision |
| **PR-4** | **Local Enrichment Reaction** | Permitted under Overlay / Topology / artifact enrichment ownership; must not redefine Minimum Parent Initialization and must not abort Init. | Repository Certified (C-R6) + Architectural Design Decision |
| **PR-5** | **Consumer-local presentation refresh** | Permitted under Rendering or surface-local authority without claiming Publication ownership or Init ownership. | Architectural Design Decision |
| **PR-6** | **Eventual re-convergence work** | Permitted as work toward Eventual Consistency without claiming EC completion solely from Observation Delivery and without Init-Affecting behavior. | Architectural Design Decision |

**Architectural Design Decision.**  
Immediate performance of PR-3 through PR-6 is consumer-local unless a future certified shared epoch rule further restricts a non-Init-Affecting class. No such additional shared restriction is certified by this v1 beyond §8’s absolute Init-Affecting prohibition.

---

# 8. Prohibited Reactions

The following reaction classes are constitutionally prohibited after Observation Delivery in every Observation Epoch.

| ID | Prohibited reaction class | Why prohibited | Classification |
|----|---------------------------|----------------|----------------|
| **XR-1** | **Cancel / abort / terminate Parent Initialization** because observation occurred | Observation is not authorization of cancellation; Publication is not Init cancellation | C-R4, OR-15, CO-R5, Parent Init §8.4.1 |
| **XR-2** | **Starve or block `INIT_COMPLETE`** by observation-driven control flow whose architectural meaning is Init denial | Non-blocker cannot block Init (Parent Init §6.5); CO-R5 | Repository Certified + Architectural Design Decision |
| **XR-3** | **Declare or revoke `INIT_COMPLETE`** from observation | Only Parent Initialization Authority owns completion | CO-R4; Parent Init §4.2 |
| **XR-4** | **Treat Observation as ownership transfer** to CompetitionTab, Observer, or Consumer | OR-3, OR-5, CO-R3 | Architectural Design Decision |
| **XR-5** | **Redefine Publication as Init cancellation** via Class B convenience | C-R3, CO-R8, Parent Init §8.4.4 | Repository Certified + Architectural Design Decision |
| **XR-6** | **Collapse hydrationVersion / competitionVersion / aggregate version** into one ownership or completion meaning upon observation | C-R12, OR-13 | Repository Certified |
| **XR-7** | **Claim Eventual Consistency completion** solely because Observation Delivery occurred | CO-R9, OR-14 | Architectural Design Decision |
| **XR-8** | **Require mid-refresh observation timing as ownership necessity** for documented production consumers | C-R11, C-R3 | Repository Certified |
| **XR-9** | **Use enrichment observation to complete Minimum Parent Initialization** | C-R6, OR-10, C-RT6 | Repository Certified |

### Hard rule — Init-Affecting Reactions

**Architectural Design Decision (CO-R5).**  

> Observing Publication, hydrationVersion advance, artifact-stage notification, or any corridor invalidation signal **never** authorizes an Init-Affecting Reaction.

This hard rule is epoch-invariant. It does not depend on Candidate A or Candidate B. It does not authorize Publication timing. It forbids only observation-derived Init-Affecting behavior.

**Runtime Certified.**  
C-RT3 / C-RT4 describe a runtime chain in which observation-adjacent cleanup yields `cancelled=true` and `RETURN_BEFORE_LOAD_COMPETITIONS`. Under this contract that chain, interpreted as Init-Affecting Reaction from Observation, is constitutionally non-compliant. Recognition of the mechanism is not authorization of the mechanism.

---

# 9. Consumer Eligibility

## 9.1 Eligibility classes

| Class | Name | Default? | May observe? | May perform permitted reactions? | May perform Init-Affecting Reactions? | Ownership acquired by observing? |
|-------|------|----------|--------------|----------------------------------|----------------------------------------|----------------------------------|
| **A** | Mandated Consumer | No — must be explicitly named by certified boundary | Yes (for mandated substrate) | Yes, within mandate + §7 | **Never** | **Never** |
| **B** | Implementation-Convenience Subscriber | Common for fan-out | Yes | Yes, within §7; no mid-refresh mandate | **Never** | **Never** |
| **O** | Optional Consumer | Yes (default) | Yes | Yes, within §7 | **Never** | **Never** |

## 9.2 Naming rule for mandates

**Architectural Design Decision (CO-R7).**  

A Mandated Consumer exists only when a certified ownership boundary explicitly names:

1. the consumer surface or role, and  
2. the substrate it is mandated to consume, and  
3. the ownership boundary that creates the mandate.

Absent that naming, subscribers are Optional or Class B. This v1 does **not** publish a complete multi-plane mandated-consumer registry (Parent Init Constitutional Review item preserved).

## 9.3 Corridor-specific eligibility facts (binding)

| Participant | Eligibility class | Classification | Notes |
|-------------|-------------------|----------------|-------|
| CompetitionTab (artifact / hydration observation) | Class B | Repository Certified (C-R3) | Must not treat observation as Init ownership or Init cancellation authority |
| Parent Runtime Publication Corridor | Publisher (not Consumer for its own publish) | Repository Certified (C-R2) | Owns Publication occurrence |
| Parent Initialization Authority | Not an Observer-owner hybrid | Architectural Design Decision | Consumes Identity outputs; does not acquire Observation ownership by being hosted near Publication |
| Competition Rendering Pipeline | Rendering owner; may consume initialized entries | Repository Certified | Does not own Publication by rendering after observation |

## 9.4 Eligibility does not expand reaction classes

**Architectural Design Decision.**  
No eligibility class — including Mandated Consumer — may perform XR-1 through XR-9. Mandate obligates substrate consumption under the mandating boundary; it never obligates Init-Affecting Reactions.

---

# 10. Ownership Rules (Observation-specific)

These rules are constitutional and complementary to Parent Init §9.

| Rule | Statement | Classification |
|------|-----------|----------------|
| **OOR-1** | Observation Delivery ≠ Reaction Authorization. | Architectural Design Decision (CO-R1, CO-R2) |
| **OOR-2** | Observation Delivery ≠ Ownership Transfer. | Architectural Design Decision (CO-R3; Parent Init OR-3) |
| **OOR-3** | Observation Delivery ≠ `INIT_COMPLETE`. | Architectural Design Decision (CO-R4) |
| **OOR-4** | Observation Delivery ≠ Eventual Consistency completion. | Architectural Design Decision (CO-R9) |
| **OOR-5** | Init-Affecting Reactions from Observation are always illegal. | Architectural Design Decision (CO-R5) |
| **OOR-6** | Class B convenience cannot mint Init cancellation authority. | Repository Certified + Architectural Design Decision (CO-R8) |
| **OOR-7** | Deferral and ignore remain legal for non-mandated signals. | Architectural Design Decision |
| **OOR-8** | Shared corridor observation law supersedes local subscriber convenience. | Architectural Design Decision |
| **OOR-9** | Publication epoch A/B remains uncertified by this contract. | Architectural Design Decision (CO-R6; Parent Init C-D5) |
| **OOR-10** | Runtime starvation mechanism evidence cannot amend these rules. | Runtime Certified recognition + Architectural Design Decision (Parent Init C-D2) |

---

# 11. Illegal Transitions (Observation plane)

The following transitions are constitutionally illegal:

1. `OBSERVATION_DELIVERED` → Parent Initialization ownership acquired by Observer/Consumer/CompetitionTab.  
2. `OBSERVATION_DELIVERED` → `INIT_COMPLETE` declared by observation.  
3. `OBSERVATION_DELIVERED` → Init cancelled / aborted / starved as an authorized reaction.  
4. `OBSERVATION_DELIVERED` → Eventual Consistency complete solely by delivery.  
5. `HYDRATION_AWARE` → Init ownership or Init cancellation authority.  
6. Class B subscription → Class A ownership without certified mandate naming.  
7. Any enrichment observation → Minimum Parent Initialization completion.

**Runtime Certified.**  
Observed cold-start sequences may visit publication/observation signaling before the render floor. That remains observed interleaving, not a legal rewrite of the transitions above.

---

# 12. Validation Matrix

| Rule / claim | Protected systems affected | Evidence basis | Existing certifications remain valid? | Changes ownership? |
|--------------|----------------------------|----------------|----------------------------------------|--------------------|
| Observation ≠ ownership | All corridor consumers | Parent Init OR-3; CO-R3 | Yes | No |
| Init-Affecting Reactions always prohibited | Parent Initialization Authority; Publication Corridor | C-R4; CO-R5; C-RT3 mechanism recognized | Yes | No — forbids unauthorized meaning |
| CompetitionTab Class B | Competition Rendering Pipeline | C-R3 | Yes | No |
| Publication ownership unchanged | Parent Runtime Publication Corridor | C-R2 | Yes | No |
| Enrichment excluded from Init floor | Overlay; Topology; Artifact Pipeline | C-R6; C-RT6 | Yes | No |
| Independent counters preserved | Hydration Orchestration | C-R12 | Yes | No |
| A/B epoch still open | Publication Corridor | Parent Init C-D5; CO-R6 | Yes | No — intentionally unresolved |
| Consumer Observation constitution standalone | Shared invalidation bus consumers | Parent Init gap closure + this v1 | Yes | **Adds** authoritative observation reaction law |

---

# 13. Open Decisions

Only true remaining design decisions / uncertified choices after this contract:

1. **Earliest architecturally safe Publication epoch**  
   Candidate A vs Candidate B (including B₁ `LOAD_COMPETITIONS_BEGIN` vs B₂ `INIT_COMPLETE` variants) remains uncertified (Parent Init C-D5; CO-R6).

2. **Whether additional shared deferral rules will later restrict non-Init-Affecting reaction classes** relative to `INIT_COMPLETE` or other epochs  
   This v1 certifies only the absolute Init-Affecting prohibition. Broader mandatory deferral of PR-3…PR-6 is not certified here.

3. **Whether production correction is required, and which smallest ownership-preserving correction is authorized**  
   Explicitly out of scope for this constitutional document (Parent Init C-D6 / §12.3 preserved).

4. **Complete mandated-consumer registry across planes**  
   Naming rule is defined; registry contents are not published here.

Everything else required for Consumer Observation constitution on the Parent Runtime Publication Corridor is resolved above.

---

# 14. Implementation Authorization Determination

## 14.1 What these two contracts now jointly establish

Together, Parent Initialization Ownership Contract v1 and Consumer Observation Contract v1 establish:

1. Single owners for Parent Initialization, Publication, Hydration, Rendering, and Eventual Consistency.  
2. `INIT_COMPLETE` as an owned Init epoch.  
3. Publication ≠ Init completion and Publication ≠ Init cancellation authority.  
4. Observation ≠ ownership and Observation ≠ Reaction Authorization.  
5. **Absolute constitutional prohibition** on observation-derived Init-Affecting Reactions in all epochs (CO-R5 / XR-1 / XR-2).  
6. Recognition that the INV8 certified starvation chain is an ownership-collision mechanism, not legal Init cancellation authority.

## 14.2 Do the two contracts completely authorize implementation of the INV8 fix?

**Architectural Design Decision / ARB determination:**

### No. One additional constitutional artifact is still required.

**Reasoning:**

| Question | Answer |
|----------|--------|
| Do the two contracts define the illegal ownership meaning to be stopped? | **Yes** — observation-derived Init cancellation / starvation is unconstitutional. |
| Do they certify Publication epoch A vs B? | **No** — deliberately left open (C-D5 / CO-R6). |
| Do they authorize code changes or select the smallest ownership-preserving correction? | **No** — both documents explicitly withhold implementation authorization (Parent Init freeze; this document header; C-D6 / §12.3 / §13.3). |
| Is reaction-law completeness sufficient to implement without further constitution? | **No** — legality of *what must not occur* is settled; *which ownership-preserving correction is certified for production* is not. |

### Required additional constitutional artifact

**Name (constitutional class):**  
**INV8 Ownership-Preserving Correction Authorization v1**  
(also satisfiable as a formal **Publication Epoch + Correction Shape Certification** if the ARB elects to bind epoch choice and correction authorization in one artifact)

**Minimum contents required before implementation is authorized:**

1. Explicit statement that production correction is authorized (closing Parent Init §12.3’s “whether correction is required”).  
2. Selection of the **smallest ownership-preserving correction shape** consistent with C-D6, without reopening certified systems.  
3. Either:  
   - certification that the chosen correction does **not** depend on resolving Candidate A/B; or  
   - certification of the Publication epoch (A / B₁ / B₂) if the chosen correction depends on epoch legality.  
4. Confirmation that the correction preserves: Identity, P1 canonical ownership, Overlay/Topology closures, Rendering floor contents, Publication corridor ownership, and CO-R5 / XR-1…XR-9.  
5. Explicit implementation-authorization clause (the clause neither companion constitution presently grants).

Until that artifact exists, implementers may use the two constitutions as **compliance law** and **illegality criteria**, but may not treat them as **authorization to modify the runtime**.

---

# Constitutional Review

## 1. What are we still not thinking about?

1. **Multi-generation observation overlap** — concurrent INITIALIZING generations receiving interleaved Observation Delivery are constrained by CO-R5 but lack a full generation-algebra appendix.  
2. **Cross-plane observers** — Summary / Coach / Incident Capture may require plane-local eligibility annexes under the same observation algebra.  
3. **Failure taxonomy vs observation** — hard abort vs retryable starvation vs expected bootstrap re-entry remain under-specified outside C-RT1/C-RT2.  
4. **Mandated-consumer registry completeness** — naming rule exists; inventory does not.

## 2. What assumptions are still implicit?

1. That consumer-local authority for non-Init-Affecting reactions remains tolerable until any future broader deferral epoch is certified (§13.2).  
2. That Class B CompetitionTab remains Class B absent contradictory certification.  
3. That independent monotonic invalidation counters remain the observation ontology (C-R12).  
4. That Parent Refresh continues as host, not owner, of hosted responsibilities.

## 3. Which sections are still implementation instead of architecture?

None of the normative sections intentionally prescribe implementation. Probe names and certified runtime sequences appear only as **evidence anchors** (C-RT3/C-RT4), not as mandated code structure.

## 4. Could this contract govern other runtime planes without modification?

**Partially yes at the observation algebra layer; not fully yes at the eligibility-floor layer.**

- **Reusable without modification:** Definitions (§2), CO-R constraints, epoch matrix structure, permitted/prohibited reaction taxonomy, ownership non-transfer rules.  
- **Requires plane-specific annexes:** Mandated-consumer lists and plane-local Init floors remain outside this Parent Corridor v1.

---

## Freeze statement

Consumer Observation Contract v1 is hereby authored as constitutional architecture for observation delivery, reaction authorization, consumer eligibility, and observation non-ownership on the MatMind Parent Runtime Publication Corridor.

It is the authoritative elaboration of Parent Initialization Ownership Contract v1 §8. Parent Init §8 remains binding summary text and must not contradict this document.

No implementation is authorized by this document.

**ARB closing determination:**  
Parent Initialization Ownership Contract v1 **plus** Consumer Observation Contract v1 do **not** completely authorize implementation of the INV8 fix. One additional constitutional artifact remains required: **INV8 Ownership-Preserving Correction Authorization v1** (Publication epoch certification included only if the authorized correction shape depends on it).
