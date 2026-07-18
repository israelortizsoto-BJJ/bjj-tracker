# INV8 Proposed Change Statement v1

| Field | Value |
|-------|--------|
| **Status** | Engineering proposal for Architecture Review Board review — v1 |
| **Document class** | Proposed Change Statement (Ownership-Preserving Change Review Procedure v1, Required Input **RI-6**) |
| **Authority class** | Engineering submission; ARB decides |
| **Date** | 2026-07-15 |
| **Governing investigation** | INV8 — Parent Runtime Publication Corridor |
| **Is not** | Constitutional law; governance procedure; runtime design; implementation guidance; Implementation Authorization |
| **Immutable inputs** | Parent Initialization Ownership Contract v1; Consumer Observation Contract v1; Ownership-Preserving Change Review Procedure v1; Certified Architecture Register; Protected Systems Register; Active Investigation Register |
| **Does not authorize** | Code changes, production design, Publication epoch certification (A/B), or redesign of certified systems |

---

## Classification of statements in this proposal

| Class | Meaning |
|-------|---------|
| **Repository Certified** | Proven by repository / architecture certification cited below. |
| **Runtime Certified** | Proven by captured runtime evidence cited below. |
| **Structured Investigation Conclusion** | Checkpoint / handoff conclusion subordinate to certification (Parent Init C-D11). |
| **Ownership Claim** | Proposal claim to be evaluated by the ARB under the review procedure — not certification. |

Every normative claim below is backed by a cited evidence class. This document contains no implementation technique, call-site redesign, or API prescription.

---

# SECTION 1 — Current Constitutional Violation

## 1.1 What constitutional behavior is currently violated

**Ownership Claim (illegality defined by constitution; mechanism Runtime Certified).**

During cold Parent Compete startup, Observation Delivery of corridor invalidation / artifact-stage publication signaling produces an **Init-Affecting Reaction**: Parent Initialization is cancelled / starved before the Minimum Parent Initialization floor is reached, so Parent Initialization Authority never reaches `INIT_COMPLETE`.

That reaction class is constitutionally prohibited.

| Prohibited meaning | Contract citation |
|--------------------|-------------------|
| Observation-derived cancel / abort / terminate of Parent Initialization | Consumer Observation Contract v1 **XR-1**, **CO-R5** |
| Observation-derived starve / block of `INIT_COMPLETE` | Consumer Observation Contract v1 **XR-2**; Parent Init §6.5 (non-blockers) |
| Artifact publication treated as Parent Initialization cancellation | Parent Init **C-R4**, **OR-15**; Consumer Observation **OR-15** / **CO-R8** |
| Observation treated as Init ownership / cancellation authority | Consumer Observation **CO-R3**, **OOR-2**, **OOR-5**; Parent Init **OR-3**, **OR-5** |

**Repository Certified.**  
Artifact publication is authorized only as artifact-stage notification. No architecture document authorizes it as Parent Initialization cancellation (Parent Init C-R4; Engineering Checkpoint 2026-07-14, Artifact publication contract CERTIFIED).

**Architectural Design Decision (already frozen in constitution).**  
Observation Delivery is never Reaction Authorization for Init-Affecting Reactions in any Observation Epoch (Consumer Observation CO-R5 hard rule; epoch matrix Init-Affecting column prohibited in all epochs).

## 1.2 Which contract(s) define that violation

| Contract | Binding provisions |
|----------|-------------------|
| **Parent Initialization Ownership Contract v1** | C-R4; C-R5 / C-R6 (floor vs enrichment); §6.4–§6.5; OR-15; C-RT3 / C-RT4 recognition |
| **Consumer Observation Contract v1** | CO-R5; XR-1; XR-2; §8 Hard rule; OOR-5; OOR-10; §14.1 item 6 (starvation chain = ownership-collision mechanism, not legal Init cancellation) |

## 1.3 Which runtime evidence demonstrates it

**Runtime Certified (binding).**

| Evidence ID | Statement | Source |
|-------------|-----------|--------|
| **C-RT3** | `coachSyncHydrationVersion++` → cleanup → new focus callback → `cancelled=true` → `RETURN_BEFORE_LOAD_COMPETITIONS` is the certified starvation mechanism | Parent Init §3.2; Consumer Observation §3.1; Engineering Checkpoint 2026-07-14 §3 Runtime starvation cause CERTIFIED |
| **C-RT4** | Cold Parent startup sequence: `FOCUS_ENTER` (athleteId=null) → `REFRESH_BEGIN` → `COMP_CACHE_INVALIDATION` (`hydrationVersionNext=2`) → cleanup → `FOCUS_ENTER` (`coachSyncHydrationVersion=2`) → `REFRESH_END` → `CANCELLED_CHECK=true` → `RETURN_BEFORE_LOAD_COMPETITIONS` | Parent Init §3.2; Engineering Checkpoint 2026-07-14 “Runtime evidence captured” |
| **Repository pairing** | Compete focus effect remains subscribed to `coachSyncHydrationVersion`; bridge probe stage `RETURN_BEFORE_LOAD_COMPETITIONS` remains the convergence comparison anchor | `src/domain/competition/tests/inv8ParentPublicationCorridor.test.ts` (Gate B); Engineering Checkpoint 2026-07-14 confirmed probes `COMPETE_FOCUS_DEP_TRACE`, `COMPETE_INIT_BRIDGE`, `COMP_CACHE_INVALIDATION` |

**Structured Investigation Conclusion (subordinate to C-RT3/C-RT4).**  
Engineering Checkpoint 2026-07-14: “Runtime evidence now proves the starvation mechanism.” Consumer Observation Contract v1 §8: that chain, interpreted as Init-Affecting Reaction from Observation, is constitutionally non-compliant; recognition of the mechanism is not authorization of the mechanism.

**Preserved non-violations (must not be misread as the defect).**

| Constraint | Statement | Classification |
|------------|-----------|----------------|
| **C-RT1** | Empty→resolved athlete transition recreating Compete focus once is expected, not the Init bug | Runtime Certified |
| **C-RT2** | Only Instance B legally owns `cancelled` at `CANCELLED_CHECK` | Runtime Certified |
| **C-RT5** | Eliminated root-cause classes remain closed as ownership premises | Runtime Certified |
| **C-RT6** | Match Breakdown / enrichment visibility is separate from Init floor reachability | Runtime Certified |

---

# SECTION 2 — Smallest Ownership-Preserving Correction Hypothesis (C-D6)

## 2.1 Required runtime behavior (implementation-independent)

**Ownership Claim under Parent Init C-D6.**

The smallest ownership-preserving correction is the smallest change of **runtime meaning** that restores constitutional legality without reopening certified owners:

1. **Parent Initialization progress must remain Init-owned through the Minimum Parent Initialization floor.**  
   After Identity resolves athlete scope (C-R5, C-R10; C-RT1 preserved), Parent Initialization Authority must be able to advance through: athlete scope resolved → `loadCompetitions` → P1 merge → `setEntries` → CompetitionCard render floor — and thereby become eligible to declare `INIT_COMPLETE` (Parent Init §4.2, §6.3; C-R5).

2. **Observation Delivery of corridor publication / hydration invalidation must not produce Init-Affecting Reactions.**  
   When Observation Delivery occurs while Parent Initialization is `INITIALIZING` (including the certified cold-start interleaving of C-RT4), that delivery must not cancel, abort, starve, or block Parent Initialization or `INIT_COMPLETE` (Consumer Observation CO-R5 / XR-1 / XR-2; Parent Init §6.5).

3. **Publication ownership and Publication occurrence meaning remain unchanged.**  
   Artifact-stage publication remains corridor-owned notification only (C-R2, C-R4). This hypothesis does not redefine Publication as Init completion, does not transfer Publication ownership to CompetitionTab, and does not require mid-refresh observation as an ownership necessity (C-R3, C-R11).

4. **Enrichment remains excluded from Init success.**  
   Overlay, topology, coach notes, artifact hydrate, publication occurrence, and `hydrationVersion` advance remain non-completers and non-redefiners of Minimum Parent Initialization (C-R6; C-RT6; OR-10).

5. **Certified expected cancellation ownership is preserved.**  
   Bootstrap empty→resolved re-entry (C-RT1) and Instance B ownership of `cancelled` at `CANCELLED_CHECK` (C-RT2) remain legal. The correction targets unauthorized Init-Affecting meaning from Observation, not those certified behaviors.

## 2.2 Why this is the smallest ownership-preserving shape (RI-11 substance)

**Ownership Claim.**

| Larger / alternate shapes (not selected) | Why rejected as larger than C-D6 for this proposal |
|------------------------------------------|-----------------------------------------------------|
| Certify / enforce Publication epoch Candidate A or B as the primary fix | Epoch remains uncertified (Parent Init C-D5; Consumer Observation CO-R6). Epoch selection is a separate gated companion decision only if a correction shape depends on it (Review Procedure §5 / RE-6). |
| Redefine Minimum Parent Initialization to include enrichment / Match Breakdown | Violates C-R5 / C-R6 / C-RT6 / OR-10; expands Init ownership surface. |
| Transfer or fuse Publication, Hydration, or Rendering ownership into Init | Violates C-R1 / C-R7 / OR-1; reopens certified boundaries (C-R8). |
| Elevate CompetitionTab Class B subscription into ownership or mid-refresh mandate | Violates C-R3 / OR-9 / CO-R8 / C-R11. |
| Treat restored list visibility as the acceptance criterion | Violates Parent Init C-D3; Review Procedure RJ-10. |
| Reopen eliminated root-cause classes (C-RT5) as ownership premises | Violates C-RT5 / OR-16; Review Procedure RJ-8. |

The selected hypothesis changes only the **unconstitutional ownership meaning**: Observation-derived Init-Affecting Reaction during the certified starvation chain. It preserves every certified owner and every certified floor content.

**This section does not decide how the runtime achieves that behavior.**

---

# SECTION 3 — Certified Ownership Boundaries Preserved

Every boundary below must remain untouched by the correction. Each is preserved because the hypothesis alters only illegal Init-Affecting reaction meaning from Observation, not the owner or floor of these responsibilities.

| Ownership boundary | Owner (unchanged) | Why untouched | Evidence |
|--------------------|-------------------|---------------|----------|
| **Identity / Canonical Athlete Authority** | Identity | Init consumes resolved scope only; does not absorb identity ownership | Parent Init C-R8, C-R10; Certified Architecture Register §1 CERTIFIED; Protected Systems Register row |
| **Parent Initialization / `INIT_COMPLETE`** | Parent Initialization Authority | Correction restores exclusive Init completion authority; does not reassign it | Parent Init §4.2, §6; OR-1 |
| **Publication** | Parent Runtime Publication Corridor | Remains corridor-owned notification; CompetitionTab does not regain ownership | Parent Init C-R2, C-R4; Checkpoint Publication ownership CERTIFIED |
| **Hydration meaning** | Hydration Orchestration Authority | Independent counters and hydration meaning preserved; hydration does not complete Init | Parent Init C-R6, C-R7, C-R12; OR-6; OR-13 |
| **Rendering floor contents** | Competition Rendering Pipeline | Floor remains athlete scope → loadCompetitions → P1 merge → setEntries → CompetitionCard; enrichment still excluded | Parent Init C-R5, C-R6; Certified Architecture Register §5 PARTIALLY CERTIFIED (floor certified; Parent persistence still open) |
| **Eventual Consistency** | Eventual Consistency Authority | EC not claimed automatic from Publication/Observation | Parent Init C-D8; OR-14; Consumer Observation CO-R9 |
| **Overlay Merge** | Overlay Runtime | Enrichment; not Init floor; not reopened | Parent Init C-R8; Protected Systems Register; Overlay CERTIFIED |
| **Competition Topology** | Competition Runtime | Enrichment relative to Init floor; not reopened | Parent Init C-R6, C-R8; Topology PARTIALLY CERTIFIED |
| **Coach Artifact Pipeline / Artifact Persistence meaning** | Coach Runtime / artifact ownership | Artifact-stage notification meaning preserved; not redefined as Init cancellation authority | Parent Init C-R4, C-R8; CO-R10; Coach Artifact Pipeline PARTIALLY CERTIFIED |
| **CompetitionTab eligibility** | Class B convenience subscriber | Remains Class B; no ownership elevation | Parent Init C-R3; Consumer Observation §9.3 |
| **Eliminated root-cause classes** | Closed premises | Remain closed | Parent Init C-RT5; OR-16 |

**Adjacent ACTIVE investigations remain separately owned / uncertified** (Active Investigation Register): Parent Match Breakdown Publication; Runtime Persistence; Parent Competition Runtime unknown (zero competitions after baseline). This proposal does not absorb them into Init ownership (Review Procedure PV-8 discipline).

---

# SECTION 4 — Protected Systems Impact

Findings use the proposal taxonomy required for this statement. **Behavioral Impact** is asserted only where repository/runtime evidence shows the protected system’s behavior is part of the certified violation surface or would necessarily change under the required Init behavior. Ownership/certified floor meaning remains NO-REOPEN for all rows (aligned with Review Procedure §7 NO TOUCH / BOUNDED TOUCH; no REOPEN REQUEST).

| Protected system | Impact | Evidence / reasoning |
|------------------|--------|----------------------|
| **Canonical Identity Ownership** | **No Impact** | C-RT1 / C-R10 preserved; correction does not modify identity authority. Register: CERTIFIED. |
| **Overlay Merge Contract** | **No Impact** | Overlay is enrichment, not Init floor (C-R6). Correction does not modify overlay merge ownership. Register: CERTIFIED. |
| **Competition Rendering Pipeline** | **Observational Impact** | Certified floor **contents** and ownership unchanged (C-R5). If Init ceases to starve before `loadCompetitions`, the existing certified render path may become observable again (`LOAD_COMPETITIONS_*` / `SET_ENTRIES_APPLY` / CompetitionCard). That is observation of Init floor reachability, not a change to Rendering ownership or floor definition. Register: PARTIALLY CERTIFIED (Parent runtime persistence remains open — Active Investigation Register). **No Behavioral Impact claimed against Rendering ownership/floor meaning.** |
| **Competition Topology** | **No Impact** | Topology not part of Minimum Parent Initialization (C-R6). Register: PARTIALLY CERTIFIED. |
| **Coach Artifact Pipeline** | **Observational Impact** | Artifact-stage publication / `coach_match_breakdown_artifacts_hydrated` signaling participates in the certified starvation *observation surface* (C-RT3/C-RT4; Gate B corridor bump reason; Operator Protocol Run A signature). The hypothesis preserves artifact-stage notification meaning (C-R4) and forbids Init-Affecting reaction meaning. Pipeline ownership and authoring→hydration certification remain closed. Register: PARTIALLY CERTIFIED (Parent publication/runtime interaction under investigation — register text). **No Behavioral Impact claimed against Coach Artifact Pipeline ownership or certified authoring path.** |

### Additional closed owners (Review Procedure §7)

| Closed owner | Impact | Evidence / reasoning |
|--------------|--------|----------------------|
| **Canonical Athlete Authority** | **No Impact** | Same as Identity (C-R8 / C-R10). |
| **Artifact Persistence ownership meaning** | **No Impact** | Persistence meaning not redefined; publication remains notification (C-R4). |
| **Coach Runtime ownership** | **No Impact** | C-R8 / CO-R10; not reopened. |
| **Parent Runtime Publication Corridor ownership of Publication** | **No Impact** to ownership; **Observational Impact** to Init legality when publication is observed during INITIALIZING | Publication remains corridor-owned (C-R2). Required behavior: Observation must not Init-Affect (CO-R5). |

**Behavioral Impact (corridor Init legality only — not a Protected Systems Register row).**  
Repository/runtime evidence (C-RT3, C-RT4; Checkpoint 2026-07-14) shows Parent Initialization currently fails to reach the floor via observation-coupled cancellation. The hypothesis requires that illegal Init-Affecting behavior to cease. That is Behavioral Impact on **Parent Initialization legality**, which is the INV8 correction target, not a Protected System reopen.

---

# SECTION 5 — Remaining Architectural Dependency

## Determination

**A. Completely epoch-independent**

## Why not B

**Repository Certified / Architectural Design Decision (already frozen).**

1. Consumer Observation Contract v1 **CO-R5** hard rule: Init-Affecting Reactions from Observation are prohibited in **every** Observation Epoch. The hard rule “does not depend on Candidate A or Candidate B” and “does not authorize Publication timing” (Consumer Observation §8 Hard rule; CO-R6; OOR-9).

2. Parent Initialization Ownership Contract v1 **C-D5**: earliest architecturally safe publication epoch remains uncertified; ownership definition is separated from epoch determination. Candidates A/B must not be declared certified by this proposal (Review Procedure CC-15 / RJ-9).

3. The Section 2 hypothesis remediates **illegal reaction authorization** (Observation → Init-Affecting), not the open question of **when Publication may legally occur** relative to `INIT_COMPLETE` / `LOAD_COMPETITIONS_BEGIN` (Parent Init §6.6 / §12.1; Checkpoint remaining question).

4. Review Procedure **RE-6** is therefore satisfied by explicit epoch-independence: this Proposed Change Statement does **not** depend on resolving Candidate A/B, and does **not** request companion Publication epoch certification.

**If a later implementation shape under Correction Authorization were to depend on epoch legality, that would be a different proposal requiring gated Step 5 companion decision.** This v1 shape does not.

---

# SECTION 6 — Runtime Validation Package

Evidence required to prove success after an authorized change. **No implementation. No test code. Observable runtime evidence only.**

Aligned to Ownership-Preserving Change Review Procedure v1 **PV-1…PV-8** and runtime evidence classes **RE-1…RE-6**.

| Evidence gate | Observable runtime evidence required | Maps to |
|---------------|--------------------------------------|---------|
| **V-1 Illegal Init-Affecting meaning absent** | On cold Parent Compete startup under the certified reproduction conditions of C-RT4, Observation Delivery of corridor invalidation / artifact-stage signaling must **not** be followed by Init cancellation that yields `RETURN_BEFORE_LOAD_COMPETITIONS` as unauthorized Init denial before the Init floor runs | PV-1; PV-3; RE-1; RE-2; CO-R5 |
| **V-2 Init floor progress observable** | After Identity resolution (and after any single expected C-RT1 bootstrap re-entry), Instance B Init path reaches `LOAD_COMPETITIONS_BEGIN` and continues through certified floor stages to `SET_ENTRIES_APPLY` (probe vocabulary already certified in Checkpoint / Operator Protocol comparison set) | PV-4; C-R5 |
| **V-3 Expected behaviors preserved** | Empty→resolved athlete transition still recreates Compete focus exactly once (C-RT1). Only Instance B owns `cancelled` at `CANCELLED_CHECK` (C-RT2). No “fix” of those behaviors | PV-2; RE-3 |
| **V-4 Enrichment not redefined as Init success** | Success is **not** claimed from overlay/topology/coach notes/artifact visibility alone. Match Breakdown visibility remains a separate concern (C-RT6). Active Investigation “Parent Match Breakdown Publication” remains ACTIVE unless independently certified | PV-4; PV-8; RE-4; C-D3 |
| **V-5 Independent counters preserved** | `competitionVersion`, aggregate version, and `hydrationVersion` remain distinguishable monotonic signals; no collapse into one ownership/completion meaning in observed invalidation traces | PV-6; C-R12; XR-6 |
| **V-6 Epoch independence preserved** | Post-change runtime must not introduce a de facto Candidate A/B certification claim; Publication may still occur as corridor notification without this proposal having certified epoch legality | PV-7; RE-6; Section 5 |
| **V-7 Protected / closed owners unchanged** | No runtime evidence of Identity, Overlay Merge, Topology, Artifact Persistence, Rendering floor contents, or Coach Runtime ownership redefinition | PV-5; Section 3–4 |
| **V-8 Adjacent ACTIVE not falsely closed** | Runtime Persistence and Parent Match Breakdown Publication remain separately ACTIVE on the Active Investigation Register unless independently certified | PV-8 |

**Insufficient alone (explicitly rejected as success evidence).**  
Restored competition list visibility without V-1…V-4 (Parent Init C-D3; Review Procedure RJ-10). Class B convenience. Call-stack proximity during Parent Refresh. Uncaptured assumed behavior (Review Procedure §8).

**Existing probe sufficiency (Repository / Checkpoint Certified).**  
Engineering Checkpoint 2026-07-14: `COMPETE_FOCUS_DEP_TRACE`, `COMPETE_INIT_BRIDGE`, `COMP_CACHE_INVALIDATION` remain sufficient; no new instrumentation required for the certified comparison vocabulary. Operator Protocol comparison set remains: `FOCUS_ENTER`, `REFRESH_BEGIN`, artifact hydration bump / suppression probe, `LOAD_COMPETITIONS_BEGIN`, `SET_ENTRIES_APPLY`, `RETURN_BEFORE_LOAD_COMPETITIONS`.

---

# SECTION 7 — Risk Assessment

| Risk | Class | Statement | Evidence basis |
|------|-------|-----------|----------------|
| **R-1** Production correction may still be withheld by ARB | **Governance** | Parent Init §12.3 “whether production correction is required” remains open until Correction Authorization AUTHORIZE | Parent Init §12.3; Review Procedure §11; Consumer Observation §14 |
| **R-2** Compliance Approval ≠ Implementation Authorization | **Governance** | This Proposed Change Statement can pass review and still leave engineering unauthorized to design/code | Review Procedure §9 / §11; Consumer Observation §14.2 |
| **R-3** Multi-generation Init overlap underspecified | **Constitutional** | Constitutions forbid Init-Affecting Reactions but lack full multi-generation epoch algebra; a correction validated only on single cold-start C-RT4 may leave concurrent-generation cases unproven | Parent Init Constitutional Review item 2; Consumer Observation Constitutional Review item 1 |
| **R-4** Failure / abort taxonomy incomplete | **Constitutional** | Hard abort vs retryable starvation vs expected bootstrap re-entry incomplete beyond C-RT1/C-RT2 | Parent Init Constitutional Review item 3; Consumer Observation §13 adjacent |
| **R-5** Adjacent ACTIVE Persistence may mask Init “success” | **Runtime** | Active Investigation Register: Runtime Persistence unknown — runtime state may survive Metro restart/rebuild; Init floor reachability in one session may not equal durable Parent Compete correctness | Active Investigation Register — Runtime Persistence ACTIVE |
| **R-6** Match Breakdown visibility confused with Init success | **Engineering** | Operators may treat enrichment visibility as proof; constitution forbids that acceptance basis | C-RT6; C-D3; RJ-10 |
| **R-7** Temporary INV8 suppression harness misread as production shape | **Engineering** | `__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__` is temporary experiment / harness (Dev Settings; Operator Protocol; Gate B). It is **not** this proposal’s selected implementation and must not be smuggled in as certified correction shape | `debug-logs/inv8/OPERATOR_PROTOCOL.md`; `app/(tabs)/profile/dev-settings.tsx`; Gate B test; Checkpoint: no production correction authorized |
| **R-8** Epoch smuggling under “epoch-independent” claim | **Governance** | A later design might silently encode Candidate A/B; would violate CC-15 / RJ-9 / PV-7 unless companion certification opened | Parent Init C-D5; Review Procedure RE-6 |
| **R-9** Class B elevation under implementation pressure | **Constitutional** / **Engineering** | Convenience subscribers must remain non-owning (C-R3 / OR-9) | Parent Init; Consumer Observation §9.3 |
| **R-10** Proposal package incomplete for AUTHORIZE without RI-7…RI-11 companions | **Governance** | This document is RI-6. Full Implementation Authorization review requires RI-7…RI-11 as well | Review Procedure §4 |

---

# SECTION 8 — Explicit Non-Goals

This proposal intentionally does **not** change, certify, authorize, or absorb:

1. **Constitutional law** — no amendment to Parent Initialization Ownership Contract v1 or Consumer Observation Contract v1.  
2. **Governance procedure** — no amendment to Ownership-Preserving Change Review Procedure v1.  
3. **Publication epoch Candidates A / B / B₁ / B₂** — remain uncertified (C-D5 / CO-R6).  
4. **Implementation Authorization** — not granted by this document; requires INV8 Ownership-Preserving Correction Authorization v1.  
5. **Production design or code** — including APIs, equality gates, host-function refactoring, probe redesign, module redesign.  
6. **Temporary INV8 suppression harness** — not promoted to production correction by this statement.  
7. **Identity / Canonical Athlete Authority ownership or behavior** beyond consuming resolved scope.  
8. **Overlay Merge Contract.**  
9. **Competition Topology ownership.**  
10. **Coach Artifact Pipeline authoring path** and Artifact Persistence ownership meaning.  
11. **Competition Rendering Pipeline certified floor contents** (C-R5 list unchanged).  
12. **CompetitionTab Class B → ownership elevation** or mid-refresh mandate (C-R3 / C-R11).  
13. **Independent invalidation counter ontology** (C-R12).  
14. **Minimum Parent Initialization enrichment expansion** (C-R6).  
15. **Eventual Consistency automatic-on-Publication claims.**  
16. **Active Investigation Register items**: Parent Match Breakdown Publication; Runtime Persistence; Parent Competition Runtime residual unknown — not closed by this proposal.  
17. **Success metric of restored list visibility** as ownership acceptance (C-D3).  
18. **Eliminated root-cause classes** (C-RT5) — remain closed; not reopened as premises.  
19. **Cross-plane Init floors** (Summary / Coach / Incident Capture) — out of Parent Corridor scope (C-D10).  
20. **Complete mandated-consumer registry** across planes.  
21. **Engineering Observatory / Knowledge Graph** parallel initiatives.  
22. **Any Protected System REOPEN REQUEST.**

These non-goals make implementation-scope expansion non-compliant with this proposal.

---

# EXIT QUESTIONS

### 1. What are we still not thinking about that could invalidate this proposal?

1. **Multi-generation INITIALIZING overlap** — constitutions note missing generation algebra; C-RT4 certifies a single cold-start chain. A proposal validated only against that chain could be incomplete if concurrent Init generations receive interleaved Observation Delivery under different legality.  
2. **Runtime Persistence ACTIVE** — Init floor reachability may be session-true and persistence-false; operators could invalidate “correction success” without the proposal having claimed Persistence ownership.  
3. **Second starvation mechanism outside Observation→Init-Affecting framing** — C-RT5 closed many classes, but any newly evidenced mechanism not reducible to XR-1/XR-2 would require a different Proposed Change Statement.  
4. **Incomplete mandated-consumer registry** — an unnamed mandated consumer could later claim mid-refresh necessity contradicting C-R11’s current repository certification.

### 2. What assumption is still unproven?

1. **That production correction is required** — still explicitly open until ARB AUTHORIZE closes Parent Init §12.3.  
2. **That an epoch-independent production shape exists that realizes Section 2 behavior without de facto epoch certification** — Review Procedure Governance Review assumption; RE-6 independence is claimed here as ownership hypothesis, not yet proven by an authorized change.  
3. **That post-change validation can keep “mechanism gone” distinct from “list visible”** under operator pressure (C-D3 / RJ-10 risk).  
4. **That adjacent ACTIVE investigations remain non-owning of Parent Initialization after correction** — asserted by registers and PV-8, not re-proven by this document alone.

### 3. If this proposal were approved tomorrow, would engineering have enough information to begin production design?

**No.**

Approval of this Proposed Change Statement can yield at most Constitutional Compliance progress under Review Procedure §9. It is **not** Implementation Authorization (§11).

**Single missing engineering artifact:**  
**INV8 Ownership-Preserving Correction Authorization v1**  
(Review Procedure §11; Consumer Observation Contract v1 §14.2 — explicit authorization clause, C-D6 shape selection binding, epoch-independence confirmation or companion epoch certification, protected-boundary confirmations).

Until that artifact emits AUTHORIZE or AUTHORIZE WITH CONDITIONS, engineering may refine RI-7…RI-11 review inputs only — not production design.

### 4. (Most Important) Does completing this Proposed Change Statement measurably reduce the distance to fixing the Parent Runtime starvation issue?

**YES.**

Without RI-6, the ARB cannot open Implementation Authorization review (Review Procedure §4: absence of RI-6…RI-11 is a hard stop for Implementation Authorization review). The governance path to production correction is:

```text
Proposed Change Statement (this document, RI-6)
    → ARB Compliance Review (CC / Protected Systems / Runtime Evidence)
    → INV8 Ownership-Preserving Correction Authorization v1 (§11)
    → production design (only then)
    → PV-1…PV-8 validation against C-RT3/C-RT4 illegality
```

Constitution and governance are already complete and explicitly withhold implementation. This statement is the first engineering ownership claim that converts certified illegality (CO-R5 + C-RT3/C-RT4) into a C-D6-bounded correction hypothesis the ARB can accept or reject. That is a measurable advance on the only authorized path to fixing Parent Runtime starvation.

---

## Submission posture

This document is submitted as **RI-6 — Proposed Change Statement** under Ownership-Preserving Change Review Procedure v1.

Companion Required Inputs still owed for full AUTHORIZE review: **RI-7** Ownership Impact Matrix; **RI-8** Protected System Impact Declaration (may incorporate Section 4); **RI-9** Constitutional Compliance Self-Assessment (CC-1…CC-16); **RI-10** Runtime Evidence Bundle (may incorporate Section 1.3 / Section 6); **RI-11** Smallest-Change Claim (may incorporate Section 2.2).

No production change is authorized by authorship of this statement.
