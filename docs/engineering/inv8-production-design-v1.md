# INV8 Production Design v1

| Field | Value |
|-------|--------|
| **Status** | Engineering Design — v1 |
| **Document class** | Production Design (INV8 Ownership-Preserving Correction Authorization v1 §3.2 phase 1) |
| **Authority class** | Engineering, under ARB Implementation Authorization |
| **Date** | 2026-07-15 |
| **Governing investigation** | INV8 — Parent Runtime Publication Corridor |
| **Governing authorization** | INV8 Ownership-Preserving Correction Authorization v1 (**AUTHORIZE WITH CONDITIONS**) |
| **Is not** | Constitutional law; governance procedure; architecture contract; implementation; code; Publication epoch certification |
| **Immutable inputs (frozen)** | Parent Initialization Ownership Contract v1; Consumer Observation Contract v1; Ownership-Preserving Change Review Procedure v1; INV8 Proposed Change Statement v1; INV8 Ownership-Preserving Correction Authorization v1 |
| **Governing freeze** | Governance Freeze active — no constitutional or governance amendment by this document |

---

## Classification of statements in this design

| Class | Meaning |
|-------|---------|
| **Repository Certified** | Proven by repository / architecture certification cited below. |
| **Runtime Certified** | Proven by captured runtime evidence cited below. |
| **Authorization Bound** | Bound by INV8 Ownership-Preserving Correction Authorization v1. |
| **Engineering Design Decision** | Production-design choice within authorized scope — not new constitutional law. |

This document describes the smallest C-D6 production correction as **runtime behavioral design**. It does not prescribe modules, APIs, equality gates, call-site edits, or implementation techniques.

---

# SECTION 1 — Design Objective

Restore Parent Initialization Authority’s ability to complete the certified Minimum Parent Initialization floor on cold Parent Compete startup by eliminating observation-derived Init-Affecting Reactions from corridor publication / hydration invalidation, while leaving every certified ownership boundary and Publication epoch Candidates A/B uncertified and untouched.

---

# SECTION 2 — Current Runtime

Observable behavior only. Evidence classes annotated.

## 2.1 Cold Parent Compete startup (Runtime Certified — C-RT4)

Under certified reproduction conditions, Parent Compete focus produces:

```text
FOCUS_ENTER (athleteId=null)
  → REFRESH_BEGIN
  → COMP_CACHE_INVALIDATION (hydrationVersionNext=2)
  → cleanup
  → FOCUS_ENTER (coachSyncHydrationVersion=2)
  → REFRESH_END
  → CANCELLED_CHECK=true
  → RETURN_BEFORE_LOAD_COMPETITIONS
```

**Source:** Engineering Checkpoint 2026-07-14; Parent Init C-RT4; Consumer Observation §3.1.

## 2.2 Certified starvation mechanism (Runtime Certified — C-RT3)

Observable causal chain:

```text
coachSyncHydrationVersion++
  → cleanup
  → new focus callback
  → cancelled=true
  → RETURN_BEFORE_LOAD_COMPETITIONS
```

Instance progress never reaches stable `LOAD_COMPETITIONS_BEGIN` → floor continuation on the starved generation. **Source:** Parent Init C-RT3; Engineering Checkpoint 2026-07-14 “Runtime starvation cause CERTIFIED.”

## 2.3 Observation surface during Parent Refresh (Repository + Runtime Certified)

During Parent Compete focus refresh:

1. Parent Refresh runs and writes weekly/session cache (Gate B: Compete → `refreshParentWriterSessionSnapshot` → `setCachedWeeklyForLinkToken`).
2. When artifact sets are non-empty, corridor publication advances `coachSyncHydrationVersion` with reason `coach_match_breakdown_artifacts_hydrated` (Gate B; Operator Protocol Run A signature).
3. Compete focus effect remains subscribed to `coachSyncHydrationVersion` among its focus dependencies (Gate B; `COMPETE_FOCUS_DEP_TRACE`).
4. Dependency change triggers focus-effect cleanup; the in-flight generation observes `cancelled=true` at `CANCELLED_CHECK` and returns before loadCompetitions (`COMPETE_INIT_BRIDGE`).

**Publication meaning today (Repository Certified):** artifact-stage notification only (Parent Init C-R4). No architecture document authorizes publication as Init cancellation. The observed cancellation is an ownership-collision mechanism, not legal Init-cancellation authority (Consumer Observation §8; Authorization §1).

## 2.4 Expected behaviors that are not the defect (Runtime Certified)

| Behavior | Status |
|----------|--------|
| Empty→resolved athlete recreating Compete focus exactly once | Expected (C-RT1) |
| Only Instance B owns `cancelled` at `CANCELLED_CHECK` | Expected (C-RT2) |
| Match Breakdown / enrichment visibility separate from Init floor | Separate concern (C-RT6) |

## 2.5 Temporary harness (Repository Certified — not production)

`__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__` (Dev Settings / Operator Protocol Run B) can suppress the artifact hydration bump and alter convergence comparison. Authorization **COND-5** binds: this harness is **not** the authorized production correction shape.

## 2.6 Probe vocabulary currently sufficient (Repository / Checkpoint Certified)

`COMPETE_FOCUS_DEP_TRACE`, `COMPETE_INIT_BRIDGE`, `COMP_CACHE_INVALIDATION` remain sufficient. Operator Protocol comparison set: `FOCUS_ENTER`, `REFRESH_BEGIN`, artifact hydration bump / suppression probe, `LOAD_COMPETITIONS_BEGIN`, `SET_ENTRIES_APPLY`, `RETURN_BEFORE_LOAD_COMPETITIONS`.

---

# SECTION 3 — Target Runtime

Corrected runtime behavior. No code. No implementation.

## 3.1 Init-owned floor progress (Authorization §3.1.1)

After Identity resolves athlete scope (C-R5, C-R10; C-RT1 preserved), Parent Initialization Authority advances through:

```text
athlete scope resolved
  → loadCompetitions
  → P1 merge
  → setEntries
  → CompetitionCard render floor
```

and thereby becomes eligible to declare `INIT_COMPLETE` (Parent Init §4.2, §6.3).

## 3.2 Observation Delivery without Init-Affecting Reactions (Authorization §3.1.2)

When Observation Delivery of corridor publication / hydration invalidation occurs while Parent Initialization is `INITIALIZING` — including certified cold-start interleaving C-RT4 — that delivery does **not**:

- cancel, abort, or terminate Parent Initialization (XR-1 / CO-R5)
- starve or block `INIT_COMPLETE` (XR-2; Parent Init §6.5)

Observable signature of success on the certified reproduction path: Observation Delivery / `COMP_CACHE_INVALIDATION` may still occur as notification, but the Init generation that owns Instance B progress reaches `LOAD_COMPETITIONS_BEGIN` and continues through certified floor stages to `SET_ENTRIES_APPLY` without unauthorized `RETURN_BEFORE_LOAD_COMPETITIONS` as Init denial before the floor runs (Authorization V-1 / V-2).

## 3.3 Publication remains corridor-owned notification (Authorization §3.1.3)

Artifact-stage publication may still occur as Parent Runtime Publication Corridor–owned notification (C-R2, C-R4). Publication does not become Init completion authority and does not become Init cancellation authority.

## 3.4 Certified expected behaviors preserved (Authorization §3.1.4)

- C-RT1 empty→resolved bootstrap re-entry still recreates Compete focus exactly once.
- C-RT2: only Instance B owns `cancelled` at `CANCELLED_CHECK`.
- Those behaviors are not “fixed” away.

## 3.5 Enrichment remains outside Init success (Authorization §3.1.5)

Overlay, topology, coach notes, artifact hydrate, publication occurrence, and `hydrationVersion` advance remain non-completers and non-redefiners of Minimum Parent Initialization (C-R6; C-RT6; OR-10).

## 3.6 Epoch independence preserved (Authorization COND-1 / §6)

Target runtime does not encode or certify Publication epoch Candidates A / B / B₁ / B₂. Publication timing relative to `INIT_COMPLETE` remains uncertified (Parent Init C-D5; Consumer Observation CO-R6).

---

# SECTION 4 — Smallest Behavioral Change

## 4.1 Minimum behavioral difference

| Dimension | Current | Target | Changes? |
|-----------|---------|--------|----------|
| Observation Delivery of corridor invalidation may occur during INITIALIZING | Yes (C-RT4) | Yes (delivery still legal) | **No** |
| Publication as corridor-owned artifact-stage notification | Yes (C-R4) | Yes | **No** |
| Observation-derived Init-Affecting Reaction (cancel/starve Init before floor) | Yes (C-RT3/C-RT4) | **No** | **Yes — sole required change** |
| Init floor contents (C-R5) | Defined; not reached under starvation | Defined; reachable after Identity + C-RT1 | Reachability restored; contents unchanged |
| C-RT1 / C-RT2 | Present | Present | **No** |
| Enrichment as Init success | Not legal; not claimed | Still not legal | **No** |
| Publication epoch A/B | Uncertified | Uncertified | **No** |

**Engineering Design Decision (C-D6).**  
The minimum behavioral difference is a single meaning change:

> Observation Delivery of corridor publication / hydration invalidation during Parent Initialization must cease to carry Init-Affecting Reaction meaning (XR-1 / XR-2). Init progress through the certified floor becomes Init-owned again.

Everything else in Section 2 may continue as observable occurrence (notification, counters, Class B subscription presence) provided it no longer produces unauthorized Init denial before the floor.

## 4.2 Why not more than one subsystem

**Only one constitutional plane must change meaning:** Reaction Authorization for Init-Affecting Reactions after Observation Delivery (Consumer Observation CO-R1 / CO-R5).

| Plane | Role in correction | Ownership change? |
|-------|--------------------|-------------------|
| **Reaction Authorization (Init-Affecting)** | Illegal reaction meaning removed | Meaning restored to constitutional prohibition — this is the correction |
| Publication | Continues as notification | No |
| Observation Delivery | May remain immediate | No |
| Parent Initialization Authority | Regains ability to exercise existing Init ownership through the floor | Ownership not reassigned; legality restored |
| Hydration meaning | Independent counters preserved | No |
| Rendering floor | Contents unchanged; may become observable again if Init stops starving | Observational consequence only (Authorization §5) |

**Not selected (larger than C-D6 — Authorization §3.3):** epoch certification as primary fix; Init floor enrichment expansion; ownership fusion; Class B elevation; list-visibility acceptance; reopening C-RT5 classes; promoting the temporary suppression harness to production shape (COND-5).

If implementation later appears to require a second subsystem ownership change, that shape falls outside this design and outside Authorization §3 — it would require a new Proposed Change Statement, not an in-place expansion of this design.

---

# SECTION 5 — Protected Boundaries

For every protected / closed ownership boundary: why it remains unchanged under this design.

| Boundary | Owner (unchanged) | Why unchanged under this design | Evidence |
|----------|-------------------|----------------------------------|----------|
| **Canonical Identity / Athlete Authority** | Identity | Design consumes resolved scope only; does not alter identity resolution or ownership | C-R8, C-R10; Authorization §5 Preserved |
| **Parent Initialization / `INIT_COMPLETE`** | Parent Initialization Authority | Design restores Init’s ability to exercise existing exclusive completion authority; does not reassign it | Parent Init §4.2, §6; Authorization §3.1.1 |
| **Publication** | Parent Runtime Publication Corridor | Publication remains notification; CompetitionTab does not regain ownership | C-R2, C-R4; Authorization §3.1.3 |
| **Hydration meaning** | Hydration Orchestration Authority | Hydration does not complete Init; counters stay independent | C-R6, C-R7, C-R12; OR-6; OR-13 |
| **Rendering floor contents** | Competition Rendering Pipeline | Floor list unchanged (athlete scope → loadCompetitions → P1 merge → setEntries → CompetitionCard). Possible re-observability is consequence of Init progress, not floor redesign | C-R5; Authorization §5 Observational Impact only |
| **Eventual Consistency** | Eventual Consistency Authority | EC not claimed automatic from Publication or Observation | C-D8; OR-14; CO-R9 |
| **Overlay Merge** | Overlay Runtime | Enrichment; excluded from Init floor | C-R6, C-R8; Protected Systems Register CERTIFIED |
| **Competition Topology** | Competition Runtime | Enrichment relative to Init floor | C-R6, C-R8 |
| **Coach Artifact Pipeline / Artifact Persistence meaning** | Coach Runtime / artifact ownership | Artifact-stage notification meaning preserved; Init-Affecting reaction meaning forbidden — pipeline ownership not redefined | C-R4; CO-R10; Authorization §5 |
| **CompetitionTab eligibility** | Class B convenience subscriber | Remains Class B; no mid-refresh ownership mandate | C-R3; CO-R8; C-R11 |
| **Independent invalidation counters** | Separate signals | `competitionVersion`, aggregate version, `hydrationVersion` not collapsed | C-R12; XR-6; Authorization V-5 |
| **Eliminated root-cause classes** | Closed premises | Remain closed; not reopened as fix premises | C-RT5; OR-16 |
| **Adjacent ACTIVE investigations** | Separate register items | Parent Match Breakdown Publication; Runtime Persistence; Parent Competition Runtime residual unknown stay ACTIVE | Active Investigation Register; COND-4; Authorization V-8 |

---

# SECTION 6 — Engineering Responsibilities

Identify exactly which runtime responsibilities change. Responsibilities only — no code.

## 6.1 Responsibilities that change

| Responsibility | Current illegal / failing meaning | Target legal meaning |
|----------------|-----------------------------------|----------------------|
| **Reaction Authorization for Init-Affecting Reactions after Observation Delivery** | Observation of corridor publication / hydration invalidation during INITIALIZING produces Init cancel / starve before the Minimum Parent Initialization floor (C-RT3/C-RT4 as XR-1/XR-2) | Observation Delivery never authorizes Init-Affecting Reactions (CO-R5). Init progress through the certified floor remains Init-owned during and after such Observation Delivery |
| **Parent Initialization progress legality under interleaved Observation** | Init Authority is denied floor progress by observation-coupled cancellation before `LOAD_COMPETITIONS_BEGIN` on the certified cold-start path | Init Authority can advance athlete scope → loadCompetitions → P1 merge → setEntries → CompetitionCard floor after Identity resolution (and after any single expected C-RT1 re-entry) |

## 6.2 Responsibilities that do not change

| Responsibility | Remains |
|----------------|---------|
| Identity athlete-scope resolution | Unchanged |
| Publication occurrence ownership and notification meaning | Unchanged |
| Observation Delivery opportunity upon Publication | Unchanged (delivery ≠ reaction authorization) |
| Hydration meaning ownership | Unchanged |
| Rendering floor contents ownership | Unchanged |
| Eventual Consistency non-automaticity | Unchanged |
| Class B CompetitionTab eligibility | Unchanged |
| Enrichment exclusion from Init floor | Unchanged |
| C-RT1 bootstrap re-entry responsibility | Unchanged |
| C-RT2 Instance B cancellation-ownership at `CANCELLED_CHECK` | Unchanged |
| Publication epoch certification | Remains uncertified; not a design responsibility |

## 6.3 Explicit non-responsibilities of this design

Per Authorization §4 / Proposed Change Statement §8: this design does not take responsibility for promoting the temporary INV8 suppression harness; certifying epoch A/B; closing Active Investigation Register items; redefining Match Breakdown visibility as Init success; or amending constitutions / governance.

---

# SECTION 7 — Runtime Validation Mapping

Map each design requirement to existing probes, existing runtime evidence, and required production validation. Aligned to Authorization §7 (V-1…V-8) and Review Procedure PV-1…PV-8.

| Design requirement | Existing probes | Existing runtime evidence | Required production validation |
|--------------------|-----------------|---------------------------|--------------------------------|
| **No unauthorized Init-Affecting Reaction from Observation during cold-start INITIALIZING** | `COMPETE_INIT_BRIDGE` (`RETURN_BEFORE_LOAD_COMPETITIONS`, `CANCELLED_CHECK`); `COMP_CACHE_INVALIDATION`; `COMPETE_FOCUS_DEP_TRACE` (cleanup / re-enter) | C-RT3; C-RT4 starvation chain; Checkpoint 2026-07-14 | **V-1:** Under C-RT4 reproduction, Observation Delivery / corridor invalidation must not be followed by Init cancellation yielding unauthorized `RETURN_BEFORE_LOAD_COMPETITIONS` before the Init floor runs |
| **Init floor progress after Identity (+ expected C-RT1)** | `COMPETE_INIT_BRIDGE` (`LOAD_COMPETITIONS_BEGIN`, `SET_ENTRIES_APPLY`); Operator Protocol comparison set | Floor definition C-R5; starved absence of `LOAD_COMPETITIONS_BEGIN` on failing runs (Operator Protocol Run A) | **V-2:** Instance B reaches `LOAD_COMPETITIONS_BEGIN` through `SET_ENTRIES_APPLY` |
| **Preserve expected bootstrap / Instance B cancellation ownership** | `COMPETE_INIT_BRIDGE` (`FOCUS_ENTER`, `CANCELLED_CHECK`); `COMPETE_FOCUS_DEP_TRACE` | C-RT1; C-RT2 | **V-3:** Empty→resolved still recreates focus once; only Instance B owns `cancelled` at `CANCELLED_CHECK` |
| **Enrichment / Match Breakdown ≠ Init success** | Artifact / overlay probes as observational only; Active Investigation Register | C-RT6; C-D3 | **V-4:** Do not certify success from enrichment visibility alone; Parent Match Breakdown Publication remains ACTIVE unless independently certified |
| **Independent invalidation counters** | `COMP_CACHE_INVALIDATION`; hydration vs competition version fields on bridge / focus traces | C-R12; Gate B corridor bump reason preserved as distinct signal | **V-5:** `competitionVersion`, aggregate version, `hydrationVersion` remain distinguishable; no collapse into one ownership/completion meaning |
| **Epoch independence** | No epoch-certification artifact; publication may still appear in traces as notification | C-D5; CO-R6; Authorization §6 determination A; COND-1 | **V-6:** Post-change runtime introduces no de facto Candidate A/B certification claim |
| **Protected / closed owners unchanged** | Ownership registers + absence of ownership-redefining behavior in traces | Authorization §5; Protected Systems Register | **V-7:** No runtime evidence of Identity, Overlay Merge, Topology, Artifact Persistence, Rendering floor contents, or Coach Runtime ownership redefinition |
| **Adjacent ACTIVE not falsely closed** | Active Investigation Register | Register rows ACTIVE | **V-8:** Runtime Persistence and Parent Match Breakdown Publication remain separately ACTIVE unless independently certified |

**Probe sufficiency (Authorization §7).**  
No new instrumentation is required as a precondition of this design. Existing probes above remain the comparison vocabulary.

**Insufficient alone (C-D3; COND-6; RJ-10):** restored competition list visibility without V-1…V-4.

**Harness note:** Operator Protocol Run B / `__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__` remains experimental comparison only. Production validation must prove V-1…V-8 on the **authorized production correction**, not by leaving the temporary harness enabled (COND-5).

---

# SECTION 8 — Rollback

Engineering must revert the production correction when any of the following is observed:

| Rollback trigger | Observable signal | Maps to |
|------------------|-------------------|---------|
| **R-B1** Starvation illegality returns | Cold-start again shows Observation Delivery → unauthorized `RETURN_BEFORE_LOAD_COMPETITIONS` before Init floor (C-RT3/C-RT4 recurrence) | V-1 failure |
| **R-B2** Init floor still unreachable after Identity + C-RT1 | Instance B fails to reach `LOAD_COMPETITIONS_BEGIN` → `SET_ENTRIES_APPLY` under certified reproduction | V-2 failure |
| **R-B3** Expected behaviors broken | Empty→resolved no longer single re-entry, or Instance A incorrectly owns `cancelled` at `CANCELLED_CHECK` | V-3 failure |
| **R-B4** False success via enrichment | Completion claimed from Match Breakdown / overlay / artifact visibility without V-1…V-4 | V-4 / C-D3 / COND-6 |
| **R-B5** Counter ontology collapse | Invalidation traces show collapsed ownership/completion meaning across version counters | V-5 failure |
| **R-B6** De facto epoch certification | Change narrative or runtime gate encodes Candidate A/B as required legality | V-6 / COND-1 failure |
| **R-B7** Protected-owner redefinition | Runtime evidence of Identity, Overlay, Topology, Artifact Persistence, Rendering floor contents, or Coach Runtime ownership change | V-7 failure |
| **R-B8** Adjacent ACTIVE falsely closed | Persistence or Match Breakdown Publication treated as closed by this correction alone | V-8 / COND-4 failure |
| **R-B9** Harness smuggled as production | Temporary `__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__` path treated as the shipped correction shape | COND-5 |

Failure of any Authorization §7 gate returns the change to ARB review. It does not authorize compensatory redesign outside INV8 Ownership-Preserving Correction Authorization v1.

---

# EXIT QUESTIONS

### 1. What are we still not thinking about?

1. **Multi-generation INITIALIZING overlap** — constitutions forbid Init-Affecting Reactions but lack full generation algebra; validating only the single cold-start C-RT4 chain may leave concurrent-generation interleaving unproven (Authorization Exit Q1; Parent Init Constitutional Review item 2).
2. **Runtime Persistence ACTIVE** — Init-floor reachability may be session-true and persistence-false; operators could contest “complete” without this design having claimed Persistence ownership (Active Investigation Register; COND-4).
3. **A second starvation mechanism** not reducible to XR-1/XR-2 — would require a different Proposed Change Statement and would break Governance Freeze via contradictory repository evidence.
4. **De facto epoch encoding** under an “epoch-independent” implementation — would invalidate completion certification even if list visibility improves (COND-1 / PV-7).
5. **Unnamed mandated consumer** later claiming mid-refresh necessity contrary to current C-R11 certification.

### 2. What assumption remains unproven?

1. **That an epoch-independent production implementation exists** that realizes Sections 3–4 without silently certifying Candidate A/B — claimed by Proposed Change Statement §5, bound by Authorization §6, **not yet proven by an implemented change**.
2. **That post-change validation can keep “mechanism gone” distinct from “list visible”** under operator pressure (C-D3 / COND-6).
3. **That multi-generation observation overlap remains covered by CO-R5 alone** without additional generation-algebra evidence.
4. **That adjacent ACTIVE investigations remain non-owning of Parent Initialization after correction** — asserted by registers and V-8, not re-proven by implementation yet.

### 3. Is this demonstrably the smallest ownership-preserving correction?

**Yes, within repository evidence and Authorization bounds.**

Section 4 isolates a single behavioral delta: removal of observation-derived Init-Affecting Reaction meaning during the certified starvation chain. Publication ownership, Observation Delivery opportunity, Init floor contents, Class B status, enrichment exclusion, C-RT1/C-RT2, counter independence, and epoch non-certification remain unchanged. All larger alternate shapes are explicitly rejected by Proposed Change Statement §2.2 and Authorization §3.3. Expanding beyond Reaction Authorization / Init progress legality under Observation would violate C-D6.

### 4. After this design is approved, is engineering ready to begin implementation immediately?

**Yes.**

This Production Design selects the authorized C-D6 behavioral shape, maps protected boundaries, names changing vs non-changing responsibilities, and binds validation and rollback to existing probes and Authorization V-1…V-8. No additional constitutional, governance, or architectural artifact is required under Governance Freeze.

**Single missing engineering input:** none for beginning Production Implementation within Authorization §§3–7.

Remaining unproven items in Exit Q2 are **validation risks**, not missing design inputs. They are discharged by Runtime Validation and Completion Certification after implementation — not by further design authorship before coding begins.

---

## Design freeze statement

INV8 Production Design v1 is hereby authored as the Engineering Design phase deliverable under INV8 Ownership-Preserving Correction Authorization v1.

Governance Freeze remains in effect.  
Constitutions and governance documents are unmodified by this authorship.  
No production code is authored by this document.  
No Publication epoch is certified by this document.  

**Next authorized phase:** Production Implementation within §§3–7 of the Correction Authorization and within Sections 3–8 of this design.
