# INV8 Ownership-Preserving Correction Authorization v1

| Field | Value |
|-------|--------|
| **Status** | Architecture Review Board Implementation Authorization — v1 |
| **Authority class** | Architecture Review Board |
| **Date** | 2026-07-15 |
| **Governing investigation** | INV8 — Parent Runtime Publication Corridor |
| **Document class** | Ownership-Preserving Correction Authorization (Ownership-Preserving Change Review Procedure v1 §11) |
| **Is not** | Constitutional law; governance procedure redesign; runtime design; implementation guidance; Publication epoch certification |
| **Immutable inputs** | Parent Initialization Ownership Contract v1; Consumer Observation Contract v1; Ownership-Preserving Change Review Procedure v1; INV8 Proposed Change Statement v1; Certified Architecture Register; Protected Systems Register; Active Investigation Register |
| **Closes** | Parent Initialization Ownership Contract v1 §12.3 (“whether production correction is required”); Consumer Observation Contract v1 §14.2 outstanding authorization artifact |

---

## Classification of statements in this authorization

| Class | Meaning |
|-------|---------|
| **Repository Certified** | Proven by repository / architecture certification cited below. |
| **Runtime Certified** | Proven by captured runtime evidence cited below. |
| **Structured Investigation Conclusion** | Checkpoint / proposal conclusion subordinate to certification (Parent Init C-D11). |
| **ARB Authorization Decision** | Binding ARB decision under Review Procedure §11 — not a redesign of constitutional law. |

This artifact authorizes production engineering only within constitutionally approved behavioral boundaries. It does not redesign the runtime, prescribe implementation, or introduce new constitutional law.

---

# SECTION 1 — Authorization Decision

## Decision

**AUTHORIZE WITH CONDITIONS**

## Meaning

Production correction of the INV8 ownership-collision / starvation illegality is authorized. Engineering may begin production design and subsequent production implementation only within the Approved Engineering Scope (§3), Explicit Engineering Prohibitions (§4), Protected Systems Certification (§5), Publication Epoch determination (§6), and Runtime Validation Requirements (§7).

This decision is not unconditional AUTHORIZE because binding conditions attach: epoch-independence must be preserved; post-change runtime validation must precede completion certification; protected systems and adjacent ACTIVE investigations must remain closed as declared; the temporary INV8 suppression harness must not be treated as the authorized production shape.

## Repository evidence supporting the decision

| Evidence | Classification | Role in decision |
|----------|----------------|------------------|
| Parent Init **C-RT3** / **C-RT4**: certified starvation chain `coachSyncHydrationVersion++` → cleanup → new focus callback → `cancelled=true` → `RETURN_BEFORE_LOAD_COMPETITIONS`; cold-start interleaving through `COMP_CACHE_INVALIDATION` | Runtime Certified | Proves an ownership-collision mechanism exists that currently denies Init floor progress |
| Consumer Observation **CO-R5** / **XR-1** / **XR-2**: observation-derived Init-Affecting Reactions prohibited in every Observation Epoch | Architectural Design Decision (frozen constitution) | Defines the illegal meaning that correction must remove |
| Parent Init **C-R4** / **OR-15**: artifact publication is notification only; not Init cancellation authority | Repository Certified | Confirms Publication may not retain Init-cancellation meaning |
| Engineering Checkpoint 2026-07-14: probes `COMPETE_FOCUS_DEP_TRACE`, `COMPETE_INIT_BRIDGE`, `COMP_CACHE_INVALIDATION` sufficient; starvation mechanism CERTIFIED | Repository / Runtime Certified | Grounds that correction is required against captured evidence, not hypothesis alone |
| INV8 Proposed Change Statement v1 §§1–2: names the unconstitutional Init-Affecting reaction and an epoch-independent C-D6 behavioral hypothesis | Structured Investigation Conclusion + Ownership Claim accepted herein | Supplies the correction shape this authorization binds |
| Parent Init **C-D5** / Consumer Observation **CO-R6**: Publication epoch A/B remains uncertified; Proposed Change Statement §5 claims complete epoch-independence | Repository Certified + Architectural Design Decision | Supports authorization without companion epoch certification (Review Procedure RE-6 path) |
| Consumer Observation §14.2 / Review Procedure §11: Implementation Authorization requires this named artifact | Constitutional / Governance dependency | This document is the required missing authorization clause |
| Parent Init **C-D6**: any later correction must be the smallest ownership-preserving change | Architectural Design Decision | Bounds the authorized shape; larger reopenings remain unauthorized |

## Why not WITHHOLD

Withholding would leave a Runtime Certified illegal mechanism (C-RT3/C-RT4) without a path to restore constitutional Init legality after constitutions and governance already defined illegality criteria and review process. Parent Init §12.3’s open “whether correction is required” is closed by this decision in favor of correction.

## Why not unconditional AUTHORIZE

Conditions are required to prevent epoch smuggling (CC-15 / RJ-9 / PV-7), protected-system reopen, false closure of Active Investigation Register items (PV-8), promotion of the temporary INV8 suppression harness, and declaration of completion without observable runtime validation (Review Procedure §12).

### Binding conditions

| Condition ID | Condition |
|--------------|-----------|
| **COND-1** | Correction remains **epoch-independent**: no de facto certification of Publication epoch Candidates A / B / B₁ / B₂. |
| **COND-2** | Completion certification requires satisfaction of Runtime Validation Requirements (§7) / Review Procedure **PV-1…PV-8**. |
| **COND-3** | Protected Systems Certification in §5 remains binding; no REOPEN of closed owners. |
| **COND-4** | Active Investigation Register items (Parent Match Breakdown Publication; Runtime Persistence; Parent Competition Runtime residual unknown) are **not** closed by this authorization. |
| **COND-5** | Temporary INV8 suppression harness (`__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__` / Dev Settings experiment) is **not** the authorized production correction shape. |
| **COND-6** | Success remains ownership legality and Init-floor progress evidence — **not** restored list visibility alone (Parent Init **C-D3**; Review Procedure **RJ-10**). |

---

# SECTION 2 — Constitutional Basis

Every constitutional contract relied upon for this authorization:

## 2.1 Parent Initialization Ownership Contract v1

| Constitutional clause | Ownership preserved | Evidence |
|-----------------------|---------------------|----------|
| **C-R1** / **OR-1** — one Architectural Owner per responsibility | Single-owner model for Init, Publication, Hydration, Rendering, Eventual Consistency | Contract §3.1, §9; Proposed Change Statement §3 |
| **C-R2** — CompetitionTab consumes publication; does not own it | Publication remains Parent Runtime Publication Corridor–owned | Checkpoint Publication ownership CERTIFIED; Contract §4.3 |
| **C-R3** — CompetitionTab Class B; Init does not depend on immediate mid-refresh observation | Class B remains Class B; no ownership elevation | Contract §3.1; Consumer Observation §9.3 |
| **C-R4** / **OR-15** — artifact publication ≠ Init cancellation | Publication meaning remains notification-only | Contract §3.1; Checkpoint Artifact publication contract CERTIFIED |
| **C-R5** — Minimum Parent Initialization floor | Floor contents unchanged: athlete scope → loadCompetitions → P1 merge → setEntries → CompetitionCard render | Contract §3.1, §6.3; Certified Architecture Register §5 |
| **C-R6** / **OR-10** — enrichment excluded from Init floor | Overlay / topology / coach notes / artifacts / publication / hydrationVersion remain non-floor | Contract §3.1; **C-RT6** |
| **C-R7** — independent responsibilities | No ownership fusion via Parent Refresh hosting | Contract §3.1; **C-D9** |
| **C-R8** / **C-R9** / **C-R10** — closed owners; Init consumes Identity scope only | Identity / Overlay / Topology / Artifact Persistence / Rendering floor / Coach Runtime remain closed | Contract §3.1; Protected Systems Register; Certified Architecture Register |
| **C-R11** — no documented production consumer requires mid-refresh publication timing as ownership necessity | Mid-refresh mandate not created | Contract §3.1 |
| **C-R12** / **OR-13** — independent invalidation counters | competitionVersion / aggregate version / hydrationVersion not collapsed | Contract §3.1 |
| **C-RT1** / **C-RT2** — expected bootstrap re-entry; Instance B owns cancelled at CANCELLED_CHECK | Certified expected behaviors preserved, not “fixed” | Contract §3.2; Checkpoint 2026-07-14 |
| **C-RT3** / **C-RT4** — certified starvation mechanism / cold-start sequence | Mechanism recognized as illegal collision, not legal Init-cancellation authority | Contract §3.2; Checkpoint 2026-07-14 |
| **C-RT5** / **OR-16** — eliminated root-cause classes closed | Correction may not reopen eliminated premises | Contract §3.2 |
| **C-RT6** — Match Breakdown / enrichment visibility ≠ Init completion | Enrichment success criteria forbidden | Contract §3.2 |
| **C-D3** — acceptance is ownership legality, not list visibility | Authorization acceptance basis | Contract §3.3 |
| **C-D5** — earliest safe publication epoch uncertified | Epoch left open; correction authorized as epoch-independent | Contract §3.3, §6.6, §12.1 |
| **C-D6** — smallest ownership-preserving change | Binds authorized correction shape | Contract §3.3; Proposed Change Statement §2 |
| **C-D8** / **OR-14** — Eventual Consistency not automatic from Publication | EC ownership preserved | Contract §3.3, §4.6 |
| **§4.2 / §6** — Parent Initialization Authority exclusive owner of `INIT_COMPLETE` | Init completion authority restored/preserved, not reassigned | Contract §§4–6 |
| **§6.4 / §6.5** — non-completers / non-blockers of `INIT_COMPLETE` | Publication / observation / enrichment cannot complete or legally block Init | Contract §6 |
| **§12.3** — whether production correction is required (previously open) | **Closed by this authorization: correction is required and authorized under conditions** | Contract §12.3; this artifact §1 / §8 |

## 2.2 Consumer Observation Contract v1

| Constitutional clause | Ownership preserved | Evidence |
|-----------------------|---------------------|----------|
| **CO-R1** / **CO-R2** / **OOR-1** — Observation Delivery ≠ Reaction Authorization | Delivery may remain; Init-Affecting reaction authorization removed | Contract §§3–4, §10 |
| **CO-R3** / **OOR-2** — Observation may never alter Parent Initialization ownership | Init ownership exclusive | Contract §4.3 |
| **CO-R4** / **OOR-3** — Observation may never declare/revoke `INIT_COMPLETE` | Only Parent Initialization Authority completes Init | Contract §5.2 |
| **CO-R5** / **XR-1** / **XR-2** / Hard rule — Init-Affecting Reactions prohibited in all epochs | Illegal reaction class that correction must eliminate | Contract §8; C-RT3/C-RT4 as non-compliant mechanism |
| **CO-R6** / **OOR-9** — prohibition does not certify epoch A/B | Epoch remains uncertified | Contract §3.2, §13.1 |
| **CO-R8** / **OOR-6** — Class B cannot mint Init cancellation authority | CompetitionTab remains Class B | Contract §9.3; Parent Init C-R3 |
| **CO-R9** / **OOR-4** — EC not completed by Observation Delivery | Eventual Consistency Authority preserved | Contract §5.5 |
| **CO-R10** — must not reopen protected owners | Same closed set as Parent Init C-R8 | Contract §3.2; Protected Systems Register |
| **XR-3…XR-9** — remaining prohibited reaction classes | Remain prohibited; authorization does not legalize them | Contract §8 |
| **§14.2** — Implementation Authorization requires this artifact | **Satisfied by issuance of this document** | Contract §14.2; Review Procedure §11 |

## 2.3 Ownership-Preserving Change Review Procedure v1

| Governance clause | Ownership preserved | Evidence |
|-------------------|---------------------|----------|
| **§9** Constitutional Compliance Approval prerequisites | CC-1…CC-16 satisfied by Proposed Change Statement ownership claims accepted herein | Procedure §6 / §9; PCS §§1–4 |
| **§7** Protected System Review | No REOPEN REQUEST; NO TOUCH / Observational Impact only as recorded in §5 | Procedure §7; PCS §4 |
| **§8** Runtime Evidence RE-1…RE-6 | RE-1…RE-5 cited from C-RT*; RE-6 satisfied by epoch-independence (§6) | Procedure §8; PCS §§1.3, 5, 6 |
| **§11** AUTHORIZE WITH CONDITIONS + required artifact contents | This document is the required authorization artifact | Procedure §11; Consumer Observation §14.2 |
| **§12** Post-Implementation Validation PV-1…PV-8 | Attach as completion gates (§7) | Procedure §12 |

## 2.4 INV8 Proposed Change Statement v1

| Proposal clause | Ownership preserved | Evidence |
|-----------------|---------------------|----------|
| **§1** Current constitutional violation | Names CO-R5 / XR-1 / XR-2 illegality with C-RT3/C-RT4 | PCS §1 |
| **§2** Smallest ownership-preserving correction hypothesis (C-D6) | Behavioral shape accepted and bound by this authorization | PCS §2; Parent Init C-D6 |
| **§3** Certified ownership boundaries preserved | Owners unchanged | PCS §3 |
| **§4** Protected systems impact | No REOPEN; Observational Impact only where evidenced | PCS §4 |
| **§5** Completely epoch-independent | Bound as COND-1 / §6 determination A | PCS §5 |
| **§6** Runtime validation package | Adopted into §7 observable gates | PCS §6 |
| **§8** Explicit non-goals | Incorporated into §4 prohibitions | PCS §8 |

**ARB note on Required Inputs.**  
Proposed Change Statement v1 supplies RI-6 and embeds RI-7…RI-11 substance (Ownership Impact / Protected System Impact / Compliance claims / Runtime Evidence / Smallest-Change Claim in §§2–6). This authorization treats that package as sufficient for §11 decision under the Founder’s direction that governance is complete except for this artifact.

## 2.5 Certification registers (immutable inputs)

| Register | Role | Evidence |
|----------|------|----------|
| **Certified Architecture Register v1** | Identity CERTIFIED; Overlay CERTIFIED; Topology / Coach Artifact / Rendering PARTIALLY CERTIFIED floors preserved | Register §§1–5 |
| **Protected Systems Register** | Five protected systems reviewed in §5 | Register table |
| **Active Investigation Register** | Adjacent ACTIVE items remain separate (COND-4) | Register: Parent Competition Runtime; Parent Match Breakdown Publication; Runtime Persistence |

---

# SECTION 3 — Approved Engineering Scope

Engineering is authorized to change **runtime behavioral meaning** only as follows. No code, algorithms, APIs, modules, call sites, or implementation techniques are prescribed.

## 3.1 Authorized behavioral outcomes

1. **Restore Init-owned progress through the certified Minimum Parent Initialization floor.**  
   After Identity resolves athlete scope (C-R5, C-R10; C-RT1 preserved), Parent Initialization Authority must be able to advance through athlete scope resolved → loadCompetitions → P1 merge → setEntries → CompetitionCard render floor, and thereby become eligible to declare `INIT_COMPLETE` (Parent Init §4.2, §6.3).

2. **Eliminate observation-derived Init-Affecting Reactions.**  
   When Observation Delivery of corridor publication / hydration invalidation occurs while Parent Initialization is `INITIALIZING` (including certified cold-start interleaving C-RT4), that delivery must not cancel, abort, starve, or block Parent Initialization or `INIT_COMPLETE` (CO-R5 / XR-1 / XR-2; Parent Init §6.5).

3. **Preserve Publication as corridor-owned notification.**  
   Artifact-stage publication may continue to occur as Publication-owned notification (C-R2, C-R4). Engineering is not authorized to redefine Publication as Init completion or Init cancellation authority.

4. **Preserve certified expected cancellation / bootstrap behaviors.**  
   Empty→resolved athlete re-entry recreating Compete focus once (C-RT1) and Instance B ownership of `cancelled` at `CANCELLED_CHECK` (C-RT2) remain legal. The authorized correction targets unauthorized Init-Affecting meaning from Observation, not those certified behaviors.

5. **Keep enrichment outside Init success.**  
   Overlay, topology, coach notes, artifact hydrate, publication occurrence, and hydrationVersion advance remain non-completers and non-redefiners of Minimum Parent Initialization (C-R6; C-RT6; OR-10).

## 3.2 Authorized engineering phases (post-governance)

Within §3.1 boundaries and §4 prohibitions only:

1. Engineering Design  
2. Production Implementation  
3. Runtime Validation (§7)  
4. Completion Certification against PV-1…PV-8 / §7 gates  

## 3.3 Explicitly not selected (larger than C-D6)

Engineering is not authorized to pursue, as the INV8 correction, any of the following larger shapes rejected by Proposed Change Statement §2.2:

- Primary fix via Publication epoch Candidate A/B certification  
- Redefinition of Minimum Parent Initialization to include enrichment / Match Breakdown  
- Ownership fusion across Init / Publication / Hydration / Rendering  
- Elevation of CompetitionTab Class B into ownership or mid-refresh mandate  
- Acceptance criterion of restored list visibility alone  
- Reopening of C-RT5 eliminated root-cause classes as ownership premises  

---

# SECTION 4 — Explicit Engineering Prohibitions

Engineering is **not** authorized to change, reopen, certify, absorb, or redefine:

1. **Parent Initialization Ownership Contract v1** — no constitutional amendment.  
2. **Consumer Observation Contract v1** — no constitutional amendment.  
3. **Ownership-Preserving Change Review Procedure v1** — no governance redesign.  
4. **Architecture Review Board structure or authority.**  
5. **Publication epoch Candidates A / B / B₁ / B₂** — remain uncertified (C-D5 / CO-R6; COND-1).  
6. **Identity / Canonical Athlete Authority ownership or behavior** beyond consuming resolved scope (C-R8, C-R10).  
7. **Overlay Merge Contract** ownership and certified merge meaning.  
8. **Competition Topology** ownership.  
9. **Coach Artifact Pipeline** authoring path and **Artifact Persistence** ownership meaning.  
10. **Competition Rendering Pipeline certified floor contents** (C-R5 list unchanged).  
11. **Publication corridor ownership** — CompetitionTab must not regain Publication ownership (C-R2).  
12. **Hydration meaning ownership** — Hydration Orchestration Authority remains owner; hydration does not complete Init (OR-6).  
13. **Eventual Consistency** as automatic upon Publication or Observation (C-D8 / OR-14 / CO-R9).  
14. **Independent invalidation counter ontology** (C-R12 / OR-13 / XR-6).  
15. **CompetitionTab Class B → ownership elevation** or mid-refresh ownership necessity (C-R3 / C-R11 / OR-9 / CO-R8).  
16. **XR-1…XR-9 prohibited reaction classes** — authorization removes illegal Init-Affecting *occurrence*; it does not legalize those reaction classes.  
17. **Minimum Parent Initialization enrichment expansion** (C-R6 / OR-10).  
18. **Eliminated root-cause classes** (C-RT5 / OR-16) — remain closed.  
19. **Active Investigation Register items**: Parent Match Breakdown Publication; Runtime Persistence; Parent Competition Runtime residual unknown — not closed by this authorization (COND-4 / PV-8).  
20. **Temporary INV8 suppression harness** as certified production shape (COND-5).  
21. **Cross-plane Init floors** (Summary / Coach / Incident Capture) — out of Parent Corridor scope (C-D10).  
22. **Complete multi-plane mandated-consumer registry.**  
23. **Any Protected System REOPEN REQUEST.**  
24. **Success metric of restored list visibility** as substitute for ownership / Init-floor validation (C-D3 / COND-6).  

---

# SECTION 5 — Protected Systems Certification

Findings use Review Procedure §7 vocabulary. **Behavioral modifications** are recorded only where repository/runtime evidence requires them; ownership and certified floor meaning remain closed.

| Protected System | Certification | Finding | Behavioral modification? | Evidence |
|------------------|---------------|---------|---------------------------|----------|
| **Canonical Identity Ownership** | CERTIFIED | **Preserved** | No | C-R8 / C-R10 / C-RT1; PCS §4 No Impact; Register CERTIFIED |
| **Overlay Merge Contract** | CERTIFIED | **Preserved** | No | C-R6 / C-R8; enrichment excluded from Init floor; PCS §4 No Impact; Register CERTIFIED |
| **Competition Rendering Pipeline** | PARTIALLY CERTIFIED | **Preserved** | **Not Applicable** to ownership/floor meaning. Observational consequence only: if Init ceases to starve before loadCompetitions, the existing certified render path may become observable again. Floor contents and Rendering ownership unchanged (C-R5). | Certified Architecture Register §5; PCS §4 Observational Impact; Parent runtime persistence remains ACTIVE separately |
| **Competition Topology** | PARTIALLY CERTIFIED | **Preserved** | No | C-R6 / C-R8; not part of Minimum Parent Initialization; PCS §4 No Impact |
| **Coach Artifact Pipeline** | PARTIALLY CERTIFIED | **Preserved** | **Not Applicable** to pipeline ownership / certified authoring→hydration path. Artifact-stage signaling remains on the certified starvation *observation surface* (C-RT3/C-RT4); notification meaning preserved (C-R4); Init-Affecting reaction meaning forbidden (CO-R5). | Register PARTIALLY CERTIFIED; PCS §4 Observational Impact; Parent publication/runtime interaction remains under Active Investigation separately |

### Additional closed owners (Review Procedure §7)

| Closed owner | Finding | Behavioral modification? | Evidence |
|--------------|---------|---------------------------|----------|
| **Canonical Athlete Authority** | **Preserved** | No | C-R8 / C-R10 |
| **Artifact Persistence ownership meaning** | **Preserved** | No | C-R4; persistence meaning not redefined |
| **Coach Runtime ownership** | **Preserved** | No | C-R8 / CO-R10 |
| **Parent Runtime Publication Corridor ownership of Publication** | **Preserved** | Ownership: No. Init legality when publication is observed during INITIALIZING: correction target is Init-Affecting reaction meaning only (CO-R5), not Publication ownership transfer | C-R2; C-R4; PCS §4 |

**Corridor Init legality (not a Protected Systems Register row).**  
Behavioral modification is authorized solely for Parent Initialization legality: observation-derived Init-Affecting behavior must cease so Init may reach the certified floor (C-RT3/C-RT4; CO-R5). That is the INV8 correction target, not a protected-system reopen.

---

# SECTION 6 — Publication Epoch

## Determination

**A. Correction is epoch-independent.**

Publication Epoch certification is **not** required before implementation.

## Repository evidence

1. **Consumer Observation Contract v1 CO-R5 Hard rule** — Init-Affecting Reactions from Observation are prohibited in every Observation Epoch; the hard rule “does not depend on Candidate A or Candidate B” and “does not authorize Publication timing” (Consumer Observation §8; CO-R6; OOR-9).

2. **Parent Initialization Ownership Contract v1 C-D5** — earliest architecturally safe publication epoch remains uncertified; ownership definition is separated from epoch determination; Candidates A/B must not be declared certified here.

3. **INV8 Proposed Change Statement v1 §5** — determination **A. Completely epoch-independent**; remediates illegal reaction authorization (Observation → Init-Affecting), not the open question of when Publication may legally occur relative to `INIT_COMPLETE` / `LOAD_COMPETITIONS_BEGIN` (Parent Init §6.6 / §12.1).

4. **Review Procedure RE-6** — satisfied by explicit epoch-independence certification rather than companion epoch certification.

5. **COND-1 / PV-7** — post-change runtime must not introduce de facto Candidate A/B certification.

If a later engineering design were to depend on epoch legality, that design would fall outside this authorization and would require a new Proposed Change Statement plus gated Step 5 companion epoch decision. It is not authorized here.

---

# SECTION 7 — Runtime Validation Requirements

Observable runtime evidence required before implementation may be certified complete. No implementation. No test-code prescription. Aligned to Review Procedure **PV-1…PV-8** and Proposed Change Statement §6.

| Gate | Observable runtime evidence required | Maps to |
|------|--------------------------------------|---------|
| **V-1** | On cold Parent Compete startup under certified reproduction conditions of **C-RT4**, Observation Delivery of corridor invalidation / artifact-stage signaling must **not** be followed by Init cancellation that yields `RETURN_BEFORE_LOAD_COMPETITIONS` as unauthorized Init denial before the Init floor runs | PV-1; PV-3; RE-1; RE-2; CO-R5 |
| **V-2** | After Identity resolution (and after any single expected **C-RT1** bootstrap re-entry), Instance B Init path reaches `LOAD_COMPETITIONS_BEGIN` and continues through certified floor stages to `SET_ENTRIES_APPLY` | PV-4; C-R5 |
| **V-3** | Empty→resolved athlete transition still recreates Compete focus exactly once (**C-RT1**). Only Instance B owns `cancelled` at `CANCELLED_CHECK` (**C-RT2**). Those behaviors are not “fixed” away | PV-2; RE-3 |
| **V-4** | Success is **not** claimed from overlay / topology / coach notes / artifact visibility alone. Match Breakdown visibility remains a separate concern (**C-RT6**). Parent Match Breakdown Publication remains ACTIVE unless independently certified | PV-4; PV-8; RE-4; C-D3 |
| **V-5** | `competitionVersion`, aggregate version, and `hydrationVersion` remain distinguishable monotonic signals; no collapse into one ownership/completion meaning in observed invalidation traces | PV-6; C-R12; XR-6 |
| **V-6** | Post-change runtime introduces no de facto Candidate A/B certification claim; Publication may still occur as corridor notification without this authorization having certified epoch legality | PV-7; RE-6; §6 |
| **V-7** | No runtime evidence of Identity, Overlay Merge, Topology, Artifact Persistence, Rendering floor contents, or Coach Runtime ownership redefinition | PV-5; §4–§5 |
| **V-8** | Runtime Persistence and Parent Match Breakdown Publication remain separately ACTIVE on the Active Investigation Register unless independently certified | PV-8; COND-4 |

**Insufficient alone.**  
Restored competition list visibility without V-1…V-4 (C-D3; RJ-10). Class B convenience. Call-stack proximity during Parent Refresh. Uncaptured assumed behavior.

**Existing probe sufficiency (Repository / Checkpoint Certified).**  
Engineering Checkpoint 2026-07-14: `COMPETE_FOCUS_DEP_TRACE`, `COMPETE_INIT_BRIDGE`, `COMP_CACHE_INVALIDATION` remain sufficient comparison vocabulary. Operator Protocol comparison set remains: `FOCUS_ENTER`, `REFRESH_BEGIN`, artifact hydration bump / suppression probe, `LOAD_COMPETITIONS_BEGIN`, `SET_ENTRIES_APPLY`, `RETURN_BEFORE_LOAD_COMPETITIONS`. This authorization does not require new instrumentation as a precondition of design.

Failure of any gate returns the change to ARB review. It does not authorize compensatory redesign outside this Correction Authorization.

---

# SECTION 8 — Implementation Authorization Statement

## Permanent authorization text

> **Architecture Review Board — INV8 Ownership-Preserving Correction Authorization v1**  
> **Date:** 2026-07-15  
> **Decision:** AUTHORIZE WITH CONDITIONS  
>
> The Architecture Review Board hereby authorizes production engineering to design and implement the smallest ownership-preserving correction that restores constitutional Parent Initialization legality on the Parent Runtime Publication Corridor, as follows:
>
> 1. **Correction is required.** Parent Initialization Ownership Contract v1 §12.3 is closed: production correction of the certified ownership-collision / starvation illegality is authorized.  
> 2. **Correction shape (C-D6).** The authorized shape is the behavioral restoration defined in §3: Parent Initialization Authority must be able to reach the certified Minimum Parent Initialization floor; Observation Delivery of corridor publication / hydration invalidation must not produce Init-Affecting Reactions (Consumer Observation CO-R5 / XR-1 / XR-2); Publication remains corridor-owned notification (C-R2 / C-R4); enrichment remains excluded from Init success (C-R6 / C-RT6); certified bootstrap and Instance B cancellation ownership (C-RT1 / C-RT2) remain preserved.  
> 3. **Epoch independence.** The authorized shape does not depend on resolving Publication epoch Candidates A / B / B₁ / B₂. Epoch certification is not granted (Parent Init C-D5; Consumer Observation CO-R6).  
> 4. **Protected boundaries preserved.** Identity / Canonical Athlete Authority, P1 canonical ownership, Overlay Merge, Topology, Competition Rendering Pipeline floor contents, Artifact Persistence meaning, Coach Runtime ownership, Publication corridor ownership, CompetitionTab Class B status, independent invalidation counters, Eventual Consistency non-automaticity, and CO-R5 / XR-1…XR-9 prohibitions remain preserved as stated in §§2–5.  
> 5. **Conditions.** COND-1…COND-6 in §1 bind. Runtime Validation Requirements in §7 / PV-1…PV-8 must be satisfied before the authorized change may be certified complete.  
> 6. **Implementation authorization clause.** Engineering is authorized to begin Engineering Design, then Production Implementation, then Runtime Validation, then Completion Certification — solely within §§3–7 of this artifact. Constitutions remain compliance law; this artifact is the Implementation Authorization those constitutions required (Consumer Observation Contract v1 §14.2; Ownership-Preserving Change Review Procedure v1 §11).  
>
> No other production change is authorized by this document.  
> No constitutional amendment is enacted by this document.  
> No Publication epoch is certified by this document.

---

# SECTION 9 — Governance Freeze

Because this authorization is issued:

**No additional constitutional or governance artifacts shall be created for INV8 unless production implementation reveals new repository evidence that contradicts existing constitutional contracts.**

This is the **Governance Freeze for INV8**.

Future INV8 work belongs exclusively to:

1. Engineering Design  
2. Production Implementation  
3. Runtime Validation  
4. Completion Certification  

under this Authorization’s scope and conditions.

---

# EXIT QUESTIONS

### 1. What are we still not thinking about that could invalidate this authorization?

1. **Multi-generation INITIALIZING overlap** — constitutions forbid Init-Affecting Reactions but lack full generation algebra; validation against only the single cold-start C-RT4 chain may leave concurrent-generation interleaving unproven.  
2. **Runtime Persistence ACTIVE** — Init-floor reachability may be session-true and persistence-false; operators could contest “complete” without this authorization having claimed Persistence ownership.  
3. **A second starvation mechanism** not reducible to XR-1/XR-2 — C-RT5 closed many classes, but newly evidenced mechanisms would require a different Proposed Change Statement and would break Governance Freeze via contradictory repository evidence.  
4. **Unnamed mandated consumer** later claiming mid-refresh necessity contrary to current C-R11 certification.  
5. **De facto epoch encoding** under an “epoch-independent” design — would violate COND-1 / CC-15 / PV-7 and invalidate completion certification even if list visibility improves.

### 2. What assumption remains unproven?

1. **That an epoch-independent production design exists** that realizes §3 behavior without silently certifying Candidate A/B — claimed by PCS §5 and bound here, not yet proven by an implemented change.  
2. **That post-change validation can keep “mechanism gone” distinct from “list visible”** under operator pressure (C-D3 / COND-6).  
3. **That adjacent ACTIVE investigations remain non-owning of Parent Initialization after correction** — asserted by registers and PV-8 / COND-4, not re-proven by implementation yet.  
4. **That multi-generation observation overlap remains covered by CO-R5 alone** without additional generation-algebra evidence.

### 3. After this artifact is complete, is engineering fully authorized to begin production design?

**Yes.**

Governance Phase is complete. All future INV8 work belongs to Engineering Design, Production Implementation, Runtime Validation, and Certification — within this Authorization’s Approved Engineering Scope, Explicit Engineering Prohibitions, Protected Systems Certification, epoch-independence determination, Runtime Validation Requirements, and COND-1…COND-6.

### 4. (Most Important) Does issuing this Authorization measurably reduce the distance to resolving the Parent Runtime starvation issue?

**YES.**

Constitutions defined illegality but withheld implementation. The review procedure defined how to authorize but did not authorize. The Proposed Change Statement supplied the C-D6 ownership claim but was not Implementation Authorization. This artifact is the final governance gate named by Consumer Observation Contract v1 §14.2 and Review Procedure §11. Issuing **AUTHORIZE WITH CONDITIONS** is the only remaining governance act that unlocks production design against the certified C-RT3/C-RT4 starvation chain. Without it, engineering remains frozen; with it, the distance to resolving Parent Runtime starvation is measurably reduced on the only constitutionally lawful path.

---

## Freeze statement

INV8 Ownership-Preserving Correction Authorization v1 is hereby issued by the Architecture Review Board.

Decision: **AUTHORIZE WITH CONDITIONS.**

Governance Freeze for INV8 is in effect (§9).

No production code is authored by this document.  
No runtime redesign is prescribed by this document.  
No new constitutional law is created by this document.
