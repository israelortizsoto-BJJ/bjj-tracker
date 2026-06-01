# Competition Overlay Migration Plan

| Field | Value |
|-------|--------|
| **Status** | Operational Migration Roadmap — Implementation Sequencing Authority |
| **Branch Baseline** | `rollback-pre-lineage-regression` |
| **Repo Floor** | `rc-authority-floor-v1` |
| **Purpose** | Phased rollout, validation gates, and rollback doctrine for governed competition overlay migration |
| **Scope** | Migration only — does not restate full architecture (see `competition-overlay-architecture-v2.md`) |
| **Governing Spec** | `docs/architecture/competition-overlay-architecture-v2.md` |
| **Historical Lineage** | `docs/overlay-architecture-v1.md` (preserved, not modified) |

---

## Migration objective

Move from: coach Compete + edit depending on coach-local `competitionStore` topology (including `setCompetitionDetailForEntryId` on coach paths).

Move to: parent-published topology hydrate + coach overlay store + render-only `projectCompetitionCompeteView`.

**Success definition:** Coach never writes canonical match arrays for linked athletes; Compete match cardinality matches parent topology under multi-athlete cold restart and hard switching.

---

## Feature-flag doctrine

| Flag | Purpose | Default until gate |
|------|---------|-------------------|
| `competitionTopologyProjectionV2` | Coach Compete reads projection instead of `competitionStore` | `false` |
| `coachMatchBreakdownOverlayV2` | Coach breakdown save uses overlay store only | `false` after Phase 3 entry |
| `topologyPublishV2` | Parent schedules topology artifact publish | `false` until worker route live |

**Rules:**

- Flags are **code flags** (local persisted / dev config pattern per project convention) — not silent production enablement.
- At most **one new consumer flag** enabled per validation gate.
- Flag off must restore last-known-safe behavior without data loss on parent plane.
- No flag may bypass OAI / `sharedAthleteId` scoping.

---

## Protected systems

Do not modify during migration except where a phase explicitly requires it:

| System | Reason |
|--------|--------|
| Athlete authority / OAI | Collapse class: wrong operating scope |
| Weekly sync + `weeklyByAthleteId` invariant | Independent plane; weekly remap is separate program |
| Training proof overlay | Proven bounded overlay pattern — do not conflate with competition phases |
| Hydration orchestration core | Bump/version only via planned hooks |
| Parent canonical `competitionStore` write path | Parent remains writer — extend publish only |
| ACK / parent feedback overlay | Orthogonal lifecycle |
| Navigation / modal stack (except read-only routing to new screens) | Local freeze bugs are not authority fixes |

---

## Migration invariants

These must hold **after every phase** that ships to a test branch:

| ID | Invariant |
|----|-----------|
| M1 | Parent remains sole caller of `setCompetitionDetailForEntryId` for linked athletes |
| M2 | Coach overlay keys use `(sharedAthleteId, sharedCompetitionId, matchLineageKey)` |
| M3 | Hydrate overwrite direction: parent → coach topology cache; never reverse |
| M4 | No coach path creates parallel canonical match rows for synced competitions |
| M5 | Aggregate overlay gate does not use coach-local match rows as canonical lineage |
| M6 | Athlete switch does not replay another athlete's topology or overlays |
| M7 | Orphan overlays never resurrect deleted parent matches in projection |
| M8 | `rc-authority-floor-v1` behaviors for weekly, ACK, training proof remain PASS |

---

## Blast-radius strategy

| Phase bucket | Blast radius | Containment |
|--------------|--------------|-------------|
| 0 Guardrails | Dev-only instrumentation | No production behavior change |
| 1 Parent publish | Parent device + worker KV | Coach ignores new artifact until Phase 2 |
| 2 Coach hydrate + projection | Coach read path only | Flag off → legacy read |
| 3 Overlay store + UI | Coach write path for annotations | No parent canonical mutation |
| 4 Retire coach topology writes | Coach Compete/edit | Highest — requires Phases 1–3 green |
| 5 Summary gate | Coach Summary signals | Isolated to `useSignals` gate logic |
| 6 Future features | Overlay extensions | Behind separate flags |

**Rollback trigger (any phase):** M8 fails, cross-athlete bleed observed, or parent canonical data loss → disable flags → revert to `rc-authority-floor-v1` tree.

---

## Rollback doctrine

| Level | Action |
|-------|--------|
| **L0 — Flag rollback** | Disable `competitionTopologyProjectionV2` / `coachMatchBreakdownOverlayV2`; coach returns to legacy read (known-broken Compete topology acceptable short-term on recovery branch only) |
| **L1 — Branch rollback** | `git checkout rollback-pre-lineage-regression` at tag `rc-authority-floor-v1` |
| **L2 — Worker rollback** | Disable topology PUT route at worker; clients ignore missing artifact (stale topology UX) |
| **L3 — Data** | Parent canonical stores are never deleted by migration scripts without explicit backup; coach overlay store may be cleared in dev only |

**Forbidden rollback actions:** Force-push to main; skip hooks; amend shared recovery commits.

**Recovery floor artifacts:**

- Git tag: `rc-authority-floor-v1`
- Branch: `rollback-pre-lineage-regression`
- Historical spec: `docs/overlay-architecture-v1.md`

---

## Rollout sequencing overview

```text
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
 guard      parent       coach        overlay      retire       summary      future
            publish      hydrate      UI           topology     gate         AI/voice
```

No phase may start until the previous phase **validation gate** is PASS on two-device QA (parent + coach) unless explicitly marked "parallel-safe."

---

## Phase 0 — Guardrails (no behavior change)

**Deliverables:**

- Feature flag scaffolding: `competitionTopologyProjectionV2`
- Instrument all coach paths calling `setCompetitionDetailForEntryId`
- Authority assertions in dev builds (coach must not import canonical topology writer)

**Validation gate:**

- [ ] No new runtime behavior change
- [ ] Inventory of coach topology write call sites documented
- [ ] `npx tsc --noEmit` and `npx eslint .` pass

**Rollback:** Remove instrumentation only.

---

## Phase 1 — Parent topology publish

**Deliverables:**

- `buildCompetitionTopologyArtifact`
- Worker PUT route for `competitionTopologyByAthleteId` (or equivalent session KV shape per v2 spec)
- Parent save schedules topology publish alongside aggregate
- No coach consumer yet

**Validation gate:**

- [ ] Parent save produces topology artifact in worker session GET
- [ ] Artifact keyed by `sharedAthleteId` + `sharedCompetitionId` + `matchLineageKey`
- [ ] Parent Compete unchanged and PASS (regression)
- [ ] M1, M8 PASS

**Rollback:** Disable `topologyPublishV2`; parent canonical save unchanged.

**Blast radius:** Parent + worker only.

---

## Phase 2 — Coach topology hydrate + projection

**Deliverables:**

- `coachCompetitionTopologyStore` (pattern: `coachCompetitionAggregateStore`)
- `reconcileCoachCompetitionTopologyFromWriterSessions`
- `projectCompetitionCompeteView`
- Coach Compete reads projection when `competitionTopologyProjectionV2` on
- **Do not read** `competitionStore` on coach when flag on

**Validation gate:**

- [ ] Two-device: parent N matches → coach Compete shows N (flag on)
- [ ] Cold restart + athlete hard switch: M6 PASS
- [ ] Missing topology: stale/syncing UX, no `deriveInitialMatches()` bootstrap on coach
- [ ] M3, M4, M8 PASS

**Rollback:** Flag off → legacy Compete read (document known Test E gap).

**Blast radius:** Coach read path.

---

## Phase 3 — Coach overlay store + breakdown UI

**Deliverables:**

- `coachMatchBreakdownOverlayStore`
- Match Breakdown screen: read-only topology + editable overlay fields
- `upsertMatchBreakdownOverlay` replaces coach edit save for overlay fields
- Parent Compete: network reconcile for coach breakdown artifacts on focus (not disk-only)

**Validation gate:**

- [ ] Coach dictation/note → save → parent Compete shows overlay (two-device)
- [ ] M2, M7 PASS
- [ ] No `setCompetitionDetailForEntryId` on coach save path (flag on)
- [ ] M8 PASS

**Rollback:** Disable `coachMatchBreakdownOverlayV2`; overlays remain in prior store if any.

**Blast radius:** Coach write + parent overlay read.

---

## Phase 4 — Retire coach topology writes

**Deliverables:**

- Remove coach calls to `setCompetitionDetailForEntryId`
- Remove coach create/delete competition for linked athletes (review-only policy)
- One-time migration: scan coach `competitionStore`; extract `coachNote`-class fields to overlay store where join possible; discard canonical fields on coach device

**Validation gate:**

- [ ] Static: zero coach imports of canonical topology writer
- [ ] Runtime: coach cannot change parent result/outcome on linked competitions
- [ ] Migration log for unmappable overlays reviewed
- [ ] M1–M7, M8 PASS
- [ ] Test E scenario (multi-match Compete + save/close) re-run — navigation freeze tracked separately

**Rollback:** **Not recommended mid-Phase 4** — complete L1 branch rollback if canonical corruption suspected.

**Blast radius:** Highest — coach Compete/edit behavior.

---

## Phase 5 — Summary gate fix

**Deliverables:**

- Replace `hasFullLocalMatchLineage(scopedCompetitions)` with `hasHydratedCanonicalTopology(sharedAthleteId)`
- Verify aggregate + topology never fight on coach Summary

**Validation gate:**

- [ ] Coach Summary metrics match parent when topology hydrated
- [ ] Coach Summary uses aggregate when topology not hydrated (M5)
- [ ] M8 PASS

**Rollback:** Revert gate function only; flags independent.

**Blast radius:** Coach Summary signals only.

---

## Phase 6 — Future MatchBreakdown features (post-convergence)

**Deliverables (sequenced sub-efforts, each behind flag):**

- Voice notes → `voiceNoteRefs` + local audio cache
- Tactical review fields → overlay patch
- AI insights → derived overlay; invalidate on topology hydrate
- Optional coach publish lane (separate from parent topology)

**Validation gate (per sub-effort):**

- [ ] AI/voice outputs remain overlay class per v2 AI coaching doctrine
- [ ] M7, M8 PASS

**Entry criterion:** Phase 4G-style real-device convergence QA PASS (see observability runbooks in execution handoff — not duplicated here).

---

## Real-device convergence QA (gate before Phase 4 completion / Phase 6 entry)

**Not architecture — operational requirement.** Run on two physical devices before declaring migration structurally complete:

| Scenario | Pass criteria |
|----------|---------------|
| Parent creates competition + M matches | Coach sees M under flag on |
| Coach annotates match | Parent renders annotation |
| Athlete switch (2+ athletes) | No cross-athlete totals or notes |
| Cold restart both devices | Hydrate restores topology + overlays |
| Parent deletes match | Coach overlay inert (M7) |
| Offline coach → reconnect | Stale banner; no phantom matches |

Defer **embedded deletion, lane-only enforcement, destructive cleanup** until metrics prove convergence (per RC program pause doctrine).

---

## Validation gates summary

| Gate | Phases | Blocker if FAIL |
|------|--------|-----------------|
| G0 Static | 0+ | Any phase ship |
| G1 Parent publish | 1 | Phase 2 start |
| G2 Coach projection | 2 | Phase 3 start |
| G3 Overlay cross-device | 3 | Phase 4 start |
| G4 Authority retirement | 4 | Phase 5 / production |
| G5 Summary coherence | 5 | Feature 6 / polish |
| G6 Convergence QA | Before Phase 4 close | Destructive cleanup |

---

## Dependencies and deploy order

1. Deploy worker topology route (Phase 1) before enabling parent `topologyPublishV2`
2. Enable parent publish in client after worker verified
3. Enable coach hydrate (Phase 2) after parent publish observed in session GET
4. Enable overlay UI (Phase 3) after topology hydrate stable
5. Retire coach writes (Phase 4) only after G2 + G3 PASS on two devices

---

## What this document does not cover

- Daily execution state, blockers, or active phase status → `docs/dev-handoff.md` (EOD updates only)
- Full data model and projection merge rules → `competition-overlay-architecture-v2.md`
- General app architecture → `docs/architecture.md`

---

## Version history

| Version | Date | Note |
|---------|------|------|
| 1.0 | 2026-06-01 | Extracted migration authority from Architecture v2 approval |
