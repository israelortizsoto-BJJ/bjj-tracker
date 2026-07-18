# Ownership-Preserving Change Review Procedure v1

| Field | Value |
|-------|--------|
| **Status** | Architecture Review Board governance procedure — v1 |
| **Authority class** | Architecture Review Board |
| **Date** | 2026-07-15 |
| **Governing investigation** | INV8 — Parent Runtime Publication Corridor (and any later corridor change subject to the same constitutional inputs) |
| **Document class** | Governance procedure |
| **Is not** | Architecture specification; runtime design; implementation guidance; constitutional law; production correction authorization |
| **Immutable inputs** | Parent Initialization Ownership Contract v1; Consumer Observation Contract v1; Certified Architecture Register; Protected Systems Register; Active Investigation Register |
| **Does not authorize** | Code changes, production correction design, Publication epoch certification (A/B), or redesign of certified systems |

---

## Classification of statements in this procedure

| Class | Meaning |
|-------|---------|
| **Governance Rule** | Binding ARB process rule for how proposed production changes are evaluated. |
| **Constitutional Dependency** | The constitutional or register input this rule must obey without amending. |
| **Engineering Responsibility** | What engineering must supply, withhold, or await. Not how to implement. |

Classifications are never mixed inside a single normative statement.

---

# 1. Purpose

### Governance Rule

This procedure defines exactly how the Architecture Review Board (ARB) evaluates a proposed production change against the immutable constitutional contracts and certification registers listed in the header.

Its sole purpose is ownership-preserving change review: to determine whether a proposed change is constitutionally legal, whether it preserves certified boundaries, and whether Implementation Authorization may be granted.

Existence of this procedure is not Implementation Authorization.

### Constitutional Dependency

- Parent Initialization Ownership Contract v1 (C-D6: smallest ownership-preserving change; freeze statement: no implementation authorized by constitution alone).
- Consumer Observation Contract v1 §14 (two constitutions are compliance law and illegality criteria only; Implementation Authorization requires a separate ARB authorization artifact).

### Engineering Responsibility

Engineering may use this procedure as the submission and review protocol for a proposed change package.

Engineering may not treat authorship or adoption of this procedure as permission to design, code, or ship a production correction.

---

# 2. Authority

### Governance Rule

1. The ARB is the sole authority to approve, reject, defer, or authorize implementation of ownership-preserving production changes governed by this procedure.
2. Constitutional contracts and certification registers outrank this procedure where they conflict; this procedure may not amend them.
3. Runtime convenience, founder urgency, and restored list visibility are not independent authorities that may override constitutional ownership law.
4. Evidence precedence for review decisions follows Parent Init C-D11: repository certification > runtime certification > structured investigation conclusion > hypothesis.

### Constitutional Dependency

- Parent Initialization Ownership Contract v1 §3 (Immutable Constraints), §9 (Ownership Rules), C-D2, C-D3, C-D11.
- Consumer Observation Contract v1 CO-R* / OOR-* (observation non-ownership and Init-Affecting prohibitions).
- Certified Architecture Register Change Policy (certification updates require evidence classes, not assumption).

### Engineering Responsibility

Engineering proposes; the ARB decides.

Engineering does not self-authorize Implementation Authorization, Publication epoch selection, or reopening of protected systems.

---

# 3. Scope

### Governance Rule

**In scope**

1. Proposed production changes that touch Parent Runtime Publication Corridor responsibilities: Parent Initialization, Publication, Hydration meaning, Rendering floor consumption, Eventual Consistency claims, and Consumer Observation / reaction authorization.
2. Any proposed change whose stated purpose is to remediate the INV8 certified starvation / ownership-collision mechanism without reopening certified systems.
3. Any later proposed change that claims to be “ownership-preserving” under Parent Init C-D6 and must be evaluated against the same constitutional inputs.

**Out of scope**

1. Authoring or amending constitutional law.
2. Runtime redesign, module redesign, or call-stack redesign as a substitute for ownership review.
3. Implementation technique selection (APIs, equality gates, probe placement, host-function refactoring).
4. Unrelated product work outside the corridor and protected-system impact surface.
5. Certification of Publication epoch Candidates A / B₁ / B₂ except as a gated companion decision when a proposed correction shape depends on epoch legality (Consumer Observation §14.2 item 3).

### Constitutional Dependency

- Parent Init C-D10 (corridor scope), C-D5 (epoch uncertainty preserved), C-R8 (must not reopen named certified owners absent contradictory evidence).
- Consumer Observation CO-R6 / OOR-9 (epoch remains uncertified by observation constitution).
- Active Investigation Register (adjacent ACTIVE items remain separate unless the proposal explicitly claims impact).

### Engineering Responsibility

Engineering must bound every submission to in-scope ownership claims and must not smuggle out-of-scope redesign into a review package labeled “smallest ownership-preserving change.”

---

# 4. Required Inputs

### Governance Rule

The ARB shall not open review until all of the following inputs are present and current:

| Input ID | Required input | Role in review |
|----------|----------------|----------------|
| **RI-1** | Parent Initialization Ownership Contract v1 | Constitutional ownership law |
| **RI-2** | Consumer Observation Contract v1 | Constitutional observation / reaction law |
| **RI-3** | Certified Architecture Register (current) | What is already certified |
| **RI-4** | Protected Systems Register (current) | What may not be modified without evidence |
| **RI-5** | Active Investigation Register (current) | What remains ACTIVE / uncertified adjacent |
| **RI-6** | Proposed Change Statement | What production change is claimed, in ownership terms only |
| **RI-7** | Ownership Impact Matrix | Per-responsibility: owner unchanged / owner threatened / owner claimed changed |
| **RI-8** | Protected System Impact Declaration | Touch / no-touch / evidence basis for each protected system |
| **RI-9** | Constitutional Compliance Self-Assessment | Submitter answers against §6 checklist items |
| **RI-10** | Runtime Evidence Bundle | Evidence cited under §8; must not invent uncaptured behavior |
| **RI-11** | Smallest-Change Claim | Explicit C-D6 claim: why this is the smallest ownership-preserving shape, and what larger shapes were rejected without implementing them |

Absence of RI-1 through RI-5 is a hard stop.

Absence of RI-6 through RI-11 is a hard stop for Implementation Authorization review (the ARB may still hold a procedural readiness review, but may not approve a production change).

### Constitutional Dependency

- Parent Init freeze / §12.3; Consumer Observation §13.3 / §14 (correction authorization still required).
- Parent Init C-D6, C-D7, C-R8; Consumer Observation CO-R10.
- Register Change Policies and ACTIVE separation.

### Engineering Responsibility

Engineering assembles RI-6 through RI-11.

Engineering does not modify RI-1 through RI-5 to make a proposal pass.

Engineering may not omit the Smallest-Change Claim (RI-11) and later assert C-D6 compliance by implication.

---

# 5. Review Sequence

### Governance Rule

The ARB shall execute review in this fixed order. Later steps may not be used to bypass earlier failures.

```text
STEP 0  Intake completeness (Required Inputs RI-1…RI-11)
    │
    ▼
STEP 1  Constitutional Compliance Checklist (§6)
    │ fail → REJECT or RETURN FOR REVISION
    ▼
STEP 2  Protected System Review (§7)
    │ fail → REJECT or RETURN FOR REVISION
    ▼
STEP 3  Runtime Evidence Requirements (§8)
    │ fail → REJECT, DEFER PENDING EVIDENCE, or RETURN FOR REVISION
    ▼
STEP 4  Approval Criteria gate (§9) and Rejection Criteria scan (§10)
    │
    ▼
STEP 5  Implementation Authorization Decision (§11)
    │ authorize / withhold / authorize-with-conditions
    ▼
STEP 6  Recordkeeping (§13)
    │
    ▼
STEP 7  If authorized: Post-Implementation Validation obligations attach (§12)
```

**Mandatory sequence rules**

1. No Implementation Authorization before Steps 1–4 succeed.
2. No parallel “design while reviewing” that treats draft production design as review evidence.
3. If Step 1 fails, Steps 2–5 are not reached for approval purposes.
4. Publication epoch A/B may be opened only inside Step 5, and only if the proposed correction shape depends on epoch legality; otherwise epoch remains closed under C-D5 / CO-R6.

### Constitutional Dependency

- Parent Init C-D5, C-D6, C-D11; Consumer Observation §14.2.
- Evidence precedence C-D11; eliminated classes C-RT5 remain closed.

### Engineering Responsibility

Engineering submits once per review cycle with complete inputs.

Engineering waits for Step 5 outcome before production design begins.

Engineering does not treat Step 0 procedural acceptance as authorization.

---

# 6. Constitutional Compliance Checklist

### Governance Rule

Every proposed change must receive an explicit Pass / Fail / Not Applicable determination for each checklist item. Any Fail is a rejection trigger under §10 unless the ARB records a constitutional amendment path (out of scope for this procedure; requires separate constitutional authorship, not this review).

| ID | Checklist question | Pass condition |
|----|--------------------|----------------|
| **CC-1** | Single owner preserved? | Each named responsibility retains exactly one Architectural Owner (Parent Init OR-1 / C-R1). |
| **CC-2** | Init ownership exclusive? | Only Parent Initialization Authority may declare `INIT_COMPLETE` (Parent Init §4.2 / §6). |
| **CC-3** | Publication ≠ Init completion? | Proposal does not treat Publication as completing Initialization. |
| **CC-4** | Publication ≠ Init cancellation authority? | Proposal does not grant Publication architectural right to cancel Initialization (C-R4 / OR-15). |
| **CC-5** | Observation ≠ ownership? | Proposal does not transfer ownership by Observation Delivery (OR-3 / CO-R3 / OOR-2). |
| **CC-6** | Init-Affecting Reactions prohibited? | Proposal does not authorize XR-1…XR-9 or any observation-derived Init-Affecting Reaction (CO-R5). |
| **CC-7** | Class B remains Class B? | CompetitionTab / convenience subscribers are not elevated to ownership (C-R3 / OR-9 / CO-R8). |
| **CC-8** | Enrichment excluded from Init floor? | Overlay / topology / coach notes / artifacts / hydrationVersion do not complete or redefine Minimum Parent Initialization (C-R5 / C-R6 / OR-10). |
| **CC-9** | Identity / athlete authority closed? | Athlete-scope ownership remains Identity; Init consumes scope only (C-R10 / C-R8). |
| **CC-10** | Independent counters preserved? | competitionVersion / aggregate version / hydrationVersion are not collapsed into one ownership or completion meaning (C-R12 / OR-13 / XR-6). |
| **CC-11** | Eventual Consistency not automatic? | EC completion is not claimed solely from Publication or Observation (C-D8 / OR-14 / CO-R9). |
| **CC-12** | Rendering does not own Publication? | Rendering floor ownership remains Competition Rendering Pipeline; Publication remains corridor-owned (OR-7 / C-R2). |
| **CC-13** | Execution ≠ ownership? | Host call-stack location / Parent Refresh hosting is not treated as ownership fusion (C-D2 / C-D9 / OR-2 / OR-8). |
| **CC-14** | Eliminated root-cause classes remain closed? | Proposal does not reopen C-RT5 eliminated premises as ownership bases. |
| **CC-15** | Epoch uncertainty preserved unless gated? | Proposal does not smuggle Candidate A/B certification unless Step 5 explicitly opens that companion decision (C-D5 / CO-R6). |
| **CC-16** | Consumer Observation companion controls? | Where Parent Init §8 and Consumer Observation Contract v1 elaborate the same topic, Consumer Observation Contract v1 controls without contradiction. |

### Constitutional Dependency

Parent Initialization Ownership Contract v1 and Consumer Observation Contract v1 in full, especially §3 immutable constraints, ownership rules, prohibited reactions, and open decisions that must remain open unless separately certified.

### Engineering Responsibility

Engineering completes RI-9 against CC-1…CC-16 with citations to the proposal’s ownership claims only.

Engineering does not rewrite checklist items or mark Fail items Pass by redefining terms.

---

# 7. Protected System Review

### Governance Rule

For each system on the Protected Systems Register, the ARB shall record one of:

| Finding | Meaning |
|---------|---------|
| **NO TOUCH** | Proposal claims no modification of meaning, ownership, or certified floor. |
| **BOUNDED TOUCH** | Proposal claims a bounded interaction that preserves ownership and certified floor; evidence required. |
| **REOPEN REQUEST** | Proposal requires modifying protected ownership or certified meaning; not approvable under this procedure without contradictory evidence and separate constitutional process. |

**Protected systems that must be reviewed for INV8-corridor proposals**

1. Canonical Identity Ownership  
2. Overlay Merge Contract  
3. Competition Rendering Pipeline (certified floor contents)  
4. Competition Topology  
5. Coach Artifact Pipeline  

**Additional closed owners referenced by constitution (must also be reviewed even if not every row is duplicated on the Protected Systems Register)**

6. Canonical Athlete Authority (Identity plane)  
7. Artifact Persistence ownership meaning  
8. Coach Runtime ownership (as closed by Parent Init C-R8 / CO-R10)  
9. Parent Runtime Publication Corridor ownership of Publication (must remain corridor-owned; CompetitionTab must not regain Publication ownership)

**Hard rule**

A REOPEN REQUEST against Identity, Overlay Merge, Topology, Artifact Persistence, Competition Rendering floor contents, or Coach Runtime ownership fails this procedure unless the Active Investigation Register and runtime/repository evidence contradict prior certification — and even then, amendment is constitutional authorship, not this review’s Implementation Authorization path.

### Constitutional Dependency

- Protected Systems Register.
- Parent Init C-R8, C-R9, CO-R10.
- Certified Architecture Register statuses (CERTIFIED / PARTIALLY CERTIFIED remain binding floors where stated).

### Engineering Responsibility

Engineering supplies RI-8 with an explicit finding per protected system.

Engineering may not bury a REOPEN REQUEST inside “implementation detail.”

---

# 8. Runtime Evidence Requirements

### Governance Rule

Implementation Authorization requires that runtime claims used to justify the change are evidence-backed under C-D11.

**Minimum evidence classes for INV8-corridor ownership-preserving proposals**

| Evidence ID | Requirement |
|-------------|-------------|
| **RE-1** | Cite the certified starvation / ownership-collision mechanism (C-RT3 / C-RT4) as the illegal runtime meaning being addressed — not as proof that Publication owns Init cancellation. |
| **RE-2** | Demonstrate that the proposal targets observation-derived Init-Affecting behavior (or equivalent unconstitutional meaning), consistent with CO-R5 / XR-1 / XR-2 recognition. |
| **RE-3** | Preserve certified expected behaviors that must not be “fixed”: bootstrap empty→resolved athlete transition (C-RT1); Instance B ownership of cancelled at CANCELLED_CHECK (C-RT2). |
| **RE-4** | Separate enrichment / Match Breakdown visibility from Init floor success (C-RT6); proposal success criteria may not redefine Init completion as enrichment visibility. |
| **RE-5** | If the proposal asserts a production defect requiring correction, state that assertion as a structured investigation conclusion subordinate to repository/runtime certification — not as a hypothesis presented as certification. |
| **RE-6** | If the proposal depends on Publication epoch legality, supply evidence package for epoch certification; otherwise explicitly certify independence from Candidate A/B (Consumer Observation §14.2 item 3). |

**Evidence that is never sufficient alone**

1. Restored competition list visibility without ownership compliance.  
2. Local convenience of Class B subscribers.  
3. Call-stack proximity during Parent Refresh.  
4. Uncaptured assumed behavior.

### Constitutional Dependency

- Parent Init §3.2 Runtime Certified constraints; C-D3; C-D11.
- Consumer Observation §8 Hard rule; OOR-10 (runtime mechanism cannot amend constitutional prohibition).

### Engineering Responsibility

Engineering supplies RI-10 mapping RE-1…RE-6 to captured evidence references.

Engineering does not invent runtime models that deny certified sequences.

Engineering does not expand probes or redesign instrumentation inside this governance procedure; instrumentation changes, if ever needed, require separate investigation authorization outside this document’s implementation path.

---

# 9. Approval Criteria

### Governance Rule

The ARB may grant **Constitutional Compliance Approval** only when all are true:

1. Required Inputs complete (RI-1…RI-11).  
2. Constitutional Compliance Checklist: no Fail (CC-1…CC-16).  
3. Protected System Review: no REOPEN REQUEST; every BOUNDED TOUCH has evidence.  
4. Runtime Evidence Requirements: RE-1…RE-5 satisfied; RE-6 satisfied by either epoch-independence certification or companion epoch certification decision.  
5. Smallest-Change Claim (RI-11) is accepted as ownership-preserving under C-D6 — meaning the proposal changes the unconstitutional ownership meaning / illegal reaction authorization surface and does not reopen certified systems.  
6. No Rejection Criterion in §10 is triggered.

**Constitutional Compliance Approval ≠ Implementation Authorization.**

Implementation Authorization is a separate decision under §11 and requires emission of the authorization artifact named there.

### Constitutional Dependency

- Parent Init C-D6; Consumer Observation §14.
- Ownership rules OR-* / OOR-*; protected closures C-R8 / CO-R10.

### Engineering Responsibility

Engineering may receive Compliance Approval as a review milestone only.

Engineering still awaits §11 before production design.

---

# 10. Rejection Criteria

### Governance Rule

The ARB shall reject (or return for revision without approval) when any of the following is true:

| ID | Rejection criterion |
|----|---------------------|
| **RJ-1** | Any CC checklist Fail. |
| **RJ-2** | Any protected-system REOPEN REQUEST without contradictory certified evidence and separate constitutional process. |
| **RJ-3** | Proposal treats Publication as Init cancellation authority or Init completion. |
| **RJ-4** | Proposal authorizes observation-derived Init-Affecting Reactions. |
| **RJ-5** | Proposal elevates Class B convenience to ownership or mid-refresh ownership necessity. |
| **RJ-6** | Proposal collapses independent invalidation counters into one ownership/completion meaning. |
| **RJ-7** | Proposal redefines Minimum Parent Initialization to include enrichment. |
| **RJ-8** | Proposal reopens an eliminated root-cause class (C-RT5) as an ownership premise. |
| **RJ-9** | Proposal smuggles Candidate A/B certification without gated Step 5 companion decision. |
| **RJ-10** | Proposal success metric is restored list visibility rather than ownership legality (violates C-D3 as acceptance basis). |
| **RJ-11** | Required Inputs incomplete. |
| **RJ-12** | Runtime evidence insufficient under §8, or invents a model denying certified runtime. |
| **RJ-13** | Proposal is implementation guidance / redesign theater without an ownership claim evaluable under this procedure. |
| **RJ-14** | Proposal claims this procedure itself as Implementation Authorization. |

### Constitutional Dependency

All immutable inputs; especially Parent Init freeze statements and Consumer Observation §14 withholding of implementation authorization.

### Engineering Responsibility

On rejection, engineering revises the ownership claim package or parks the work.

Engineering does not “implement to prove” a rejected ownership claim.

---

# 11. Implementation Authorization Decision

### Governance Rule

After Compliance Approval (§9), the ARB issues exactly one of the following decisions:

| Decision | Meaning |
|----------|---------|
| **WITHHOLD** | Constitutionally reviewed; production change not authorized. |
| **AUTHORIZE** | Production correction is authorized under the named authorization artifact. |
| **AUTHORIZE WITH CONDITIONS** | Authorized only with recorded conditions (for example: epoch-independence confirmation; validation gates in §12; no-touch affirmations). |

**Required authorization artifact**

Name: **INV8 Ownership-Preserving Correction Authorization v1**  
(or successor named artifact for non-INV8 corridor changes governed by this procedure)

That artifact must contain at minimum (per Consumer Observation Contract v1 §14.2):

1. Explicit statement that production correction is authorized (closing Parent Init §12.3 “whether correction is required”).  
2. Selection of the smallest ownership-preserving correction shape consistent with C-D6, without reopening certified systems.  
3. Either certification that the chosen shape does **not** depend on resolving Candidate A/B, **or** certification of the Publication epoch if the shape depends on epoch legality.  
4. Confirmation that the correction preserves Identity, P1 canonical ownership, Overlay/Topology closures, Rendering floor contents, Publication corridor ownership, and CO-R5 / XR-1…XR-9.  
5. Explicit implementation-authorization clause.

**Hard rule**

This procedure document never substitutes for that authorization artifact.

Adoption of this procedure does not emit AUTHORIZE.

### Constitutional Dependency

- Consumer Observation Contract v1 §14.  
- Parent Init §12.3 / C-D6 / freeze statement.  
- Active Investigation Register (authorization must not silently absorb adjacent ACTIVE investigations as Init ownership).

### Engineering Responsibility

Engineering begins production design only after an AUTHORIZE or AUTHORIZE WITH CONDITIONS decision and only within the bounds of the issued Correction Authorization artifact.

Until then, engineering may prepare review packages and evidence bundles only.

---

# 12. Required Post-Implementation Validation

### Governance Rule

If and only if §11 authorizes implementation, the following validation obligations attach. They are acceptance gates for declaring the authorized change complete — not a license to expand scope.

| ID | Validation obligation |
|----|------------------------|
| **PV-1** | Ownership legality: Init-Affecting Reactions from Observation remain absent as architectural meaning (CO-R5). |
| **PV-2** | Certified expected behaviors preserved: C-RT1 and C-RT2 still hold. |
| **PV-3** | Certified illegal mechanism addressed: C-RT3 / C-RT4 starvation chain no longer occurs as unauthorized Init cancellation meaning — without granting Publication Init-cancellation ownership. |
| **PV-4** | Init floor unchanged in content: Minimum Parent Initialization remains athlete scope → loadCompetitions → P1 merge → setEntries → CompetitionCard render floor (C-R5); enrichment still excluded (C-R6 / C-RT6). |
| **PV-5** | Protected systems remain closed per §7 NO TOUCH / BOUNDED TOUCH record. |
| **PV-6** | Independent counters remain independent (C-R12). |
| **PV-7** | If authorization was epoch-independent: confirm no de facto A/B certification was introduced by the change. If authorization included epoch certification: confirm runtime matches the certified epoch only. |
| **PV-8** | Active Investigation Register items not falsely closed: Parent Match Breakdown publication consistency and Runtime Persistence remain separately ACTIVE unless independently certified. |

Failure of post-implementation validation returns the change to ARB review; it does not authorize compensatory redesign outside the issued Correction Authorization.

### Constitutional Dependency

- Parent Init Validation Matrix discipline (§11) and runtime constraints.  
- Consumer Observation Validation Matrix (§12).  
- Registers as living certification state.

### Engineering Responsibility

Engineering captures validation evidence against PV-1…PV-8 after an authorized change.

Engineering does not redefine success as “list visible” in place of PV ownership gates (C-D3).

---

# 13. Recordkeeping Requirements

### Governance Rule

For every review cycle, the ARB shall retain a durable record containing:

1. Date, reviewer authority (ARB), investigation id (e.g., INV8).  
2. Versions/dates of RI-1…RI-5 inputs used.  
3. Proposed Change Statement and Ownership Impact Matrix (RI-6, RI-7).  
4. Checklist determinations CC-1…CC-16.  
5. Protected System findings.  
6. Runtime Evidence Bundle references (not necessarily raw logs in the governance record).  
7. Approval / Rejection outcome with cited criteria (§9 / §10).  
8. Implementation Authorization Decision (§11), including WITHHOLD.  
9. If AUTHORIZE: pointer to the Correction Authorization artifact and any conditions.  
10. If implemented: Post-Implementation Validation results for PV-1…PV-8.

**Record placement (governance, not constitution)**

Review records may live beside engineering checkpoints / handoffs / certification history as ARB review minutes. They must not be written into constitutional contracts as amendments.

**Non-modification rule**

Recordkeeping shall not silently edit Parent Initialization Ownership Contract v1, Consumer Observation Contract v1, or register certifications.

### Constitutional Dependency

- Register Change Policies.  
- Constitutional freeze statements (contracts are not living implementation journals).

### Engineering Responsibility

Engineering supplies evidence references suitable for recordkeeping.

Engineering does not update constitutional documents to reflect review outcomes; only the ARB may direct constitutional authorship as a separate act.

---

# Governance Review

## 1. What are we still not thinking about?

1. **Correction Authorization template binding** — this procedure names the required artifact and minimum contents, but does not yet freeze a fill-in template for INV8 Ownership-Preserving Correction Authorization v1.  
2. **Multi-generation Init overlap** — constitutions note missing generation algebra; this procedure reviews proposals but has no dedicated multi-generation checklist row beyond CO-R5’s absolute prohibition.  
3. **Cross-plane application** — Summary / Coach / Incident Capture plane floors and mandated-consumer registries are still annex-level gaps; this v1 is Parent Corridor–centered.  
4. **Review cadence vs ACTIVE adjacency** — how aggressively ARB must re-check Active Investigation Register coupling when a corridor authorization is issued remains operational judgment, recorded only as PV-8.  
5. **Who may submit** — founder vs engineering vs ARB-self referral is not stratified; intake completeness is the only gate.

## 2. What assumption is still unproven?

1. That a production correction is required at all (Parent Init §12.3 still open until §11 AUTHORIZE closes it).  
2. That a correction shape exists that is both smallest under C-D6 and epoch-independent (RE-6 may still force companion epoch certification).  
3. That Compliance Approval packages can be assembled without drifting into implementation design theater (RJ-13 risk).  
4. That post-implementation validation can distinguish “mechanism gone” from “visibility restored” without collapsing into C-D3 violations.  
5. That adjacent ACTIVE investigations (Match Breakdown publication; Runtime Persistence) remain truly non-owning of Parent Initialization after a corridor correction.

## 3. Does this procedure authorize the smallest ownership-preserving implementation?

**No.**

This procedure defines how the ARB evaluates ownership-preserving proposals and how Implementation Authorization may later be granted.

It does not select a correction shape, does not emit INV8 Ownership-Preserving Correction Authorization v1, and does not authorize code, production design, or runtime modification.

## 4. After this procedure exists, is engineering authorized to begin production design?

**No.**

Per Consumer Observation Contract v1 §14 and this procedure §2 / §5 / §11:

- Constitutions remain compliance law and illegality criteria only.  
- This procedure is review process only.  
- Engineering may prepare Required Inputs (RI-6…RI-11) for ARB review.  
- Production design begins only after an ARB **AUTHORIZE** or **AUTHORIZE WITH CONDITIONS** decision backed by the Correction Authorization artifact.

---

## Freeze statement

Ownership-Preserving Change Review Procedure v1 is hereby adopted as Architecture Review Board governance procedure for evaluating proposed production changes against Parent Initialization Ownership Contract v1, Consumer Observation Contract v1, and the certification registers named herein.

It is not constitutional architecture.

It is not runtime design.

It is not implementation.

No production change is authorized by the existence of this procedure.

**Next governance step, when directed:** assemble or review a Proposed Change Statement under this procedure, culminating — only if Criteria pass — in INV8 Ownership-Preserving Correction Authorization v1.
