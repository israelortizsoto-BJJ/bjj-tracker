# Runtime Equivalence Matrix — MM-REM-001

| Field | Value |
|-------|-------|
| **Document ID** | MM-REM-001 |
| **Investigation** | Match Breakdown Hydration (Coach → Parent) |
| **Status** | Active — Runtime Equivalence phase |
| **Version** | 2 (audit refinement) |
| **Created** | 2026-06-28 |
| **Updated** | 2026-06-28 |
| **Baseline build** | TestFlight 1.0.0 (82) — commit `00e0a93` (2026-06-23) |
| **Reference build** | Current Dev (`rollback-pre-lineage-regression` @ `b7b47e1` + WIP at time of repo comparison) |

---

## 1. Investigation Goal

**What runtime conditions must be identical for Build 82 and current Dev to produce identical Match Breakdown hydration behavior?**

For both builds to hydrate Coach Match Breakdown onto Parent Compete identically, every boundary in the lane must observe equivalent **inputs, persistence state, network payloads, join keys, and invalidation timing**. Repository evidence establishes that the **code contract** is unchanged between Build 82 and current Dev. Therefore identical behavior requires equivalent **runtime state** at each boundary — not equivalent source code.

Success criterion (observable):

```text
Coach Save → Overlay Persist → Artifact Build → Worker Publish → Worker KV
  → Parent Session GET → Artifact Cache → Parent Merge → CompetitionCard Render
```

Each step must produce equivalent artifacts, keys, and timestamps for the same `(sharedAthleteId, sharedCompetitionId, matchLineageKey)` tuple.

---

## 2. Runtime Contract

Reconstructed from repository modules and architecture docs (`runtime-dependency-maps-v1.md`, `hydration-orchestration-v1.md`, `competition-overlay-architecture-v2.md`).

### 2.1 End-to-end flow

```text
Coach Edit (edit.tsx)
    ↓
Overlay Persist (upsertMatchBreakdownOverlay → coachMatchBreakdownOverlayStore)
    ↓
Artifact Build (buildCoachMatchBreakdownArtifacts)
    ↓
Worker Publish (schedulePublishCoachMatchBreakdownArtifacts → coachSyncPutCoachMatchBreakdownArtifacts)
    ↓
Worker Session (coach-sync-worker KV: SessionRecord.coachMatchBreakdownArtifacts)
    ↓
Parent Session Fetch (coachSyncFetchSession → GET /v1/sessions/:token)
    ↓
Artifact Cache (setCachedWeeklyForLinkToken → writeCoachMatchBreakdownArtifactSet)
    ↓
Merge (mergeCoachBreakdownIntoMatches — parent CompetitionCard only)
    ↓
CompetitionCard Render (parent: artifact hydrate useFocusEffect → merge → MatchCard)
```

**Coach device** also reconciles artifacts via `refreshCoachWriterSessionsAndReconcileStores` → `reconcileCoachMatchBreakdownArtifacts`. This path is **coach-only**; parent does not run writer-session reconcile (`useActiveAthlete` docstring).

### 2.2 Boundary catalog

| # | Boundary | Primary modules | Inputs | Outputs | Persistence | Owner | Runtime dependencies |
|---|----------|-----------------|--------|---------|-------------|-------|----------------------|
| B1 | **Coach Edit Save** | `app/(tabs)/coach/kid/[kidId]/competition/edit.tsx`, `upsertMatchBreakdownOverlay.ts` | `sharedAthleteId`, `sharedCompetitionId`, `matchLineageKey`, overlay patch | Accepted/rejected overlay row | `coachMatchBreakdownOverlayStore` (AsyncStorage) | Coach | `kidId`, canonical read-only gate, overlay scope |
| B2 | **Overlay Persist** | `coachMatchBreakdownOverlayStore.ts` | Overlay identity + patch + `updatedAt` | `CoachMatchBreakdownOverlay` or null | `mm:v1:coachMatchBreakdownOverlayByLineage` | Coach | Stale-reject on `updatedAt`; no shell/canonical mutation |
| B3 | **Artifact Build** | `buildCoachMatchBreakdownArtifacts.ts` | Overlay store rows for athlete | `SyncedCoachMatchBreakdownArtifactSet` | Ephemeral (in-memory for publish) | Coach | Filters artifacts requiring non-empty `coachNote` |
| B4 | **Publish Target Resolution** | `publishCoachMatchBreakdownArtifacts.ts` | `sharedAthleteId`, `kidId`, `getCoachLinks()`, `getKidsById()` | Resolved writer link + token or skip | None | Coach | `kid.sharedFromInviteTokenNorm` must match active writer `linkToken`; `writerSecret` required |
| B5 | **Worker Publish** | `coachWeeklySyncApi.ts`, `coach-sync-worker` PUT `/v1/sessions/:token/coach-match-breakdowns` | Artifact set + Bearer `writerSecret` | HTTP 200; KV updated | Worker KV `SessionRecord.coachMatchBreakdownArtifacts[sharedAthleteId]` | Worker (coach writer) | Stale-reject: incoming `updatedAt` must beat existing |
| B6 | **Worker Session GET** | Worker GET `/v1/sessions/:token`, `coachSyncFetchSession` | Invite/link token | `coachMatchBreakdownArtifacts` map + parse evidence | None (transport) | Worker read / client parse | Field must be present and valid per parser |
| B7 | **Session Cache Write** | `setCachedWeeklyForLinkToken`, `coachWeeklySyncCacheStore.ts` | Full session response | Per-athlete artifact write outcomes | Weekly cache map + triggers artifact store writes | Parent (on session fetch paths) | Only when `cachedFullSession !== undefined` |
| B8 | **Artifact Store** | `coachMatchBreakdownArtifactStore.ts` | `SyncedCoachMatchBreakdownArtifactSet` | Write outcome: accept / reject_stale / reject_invalid | `mm:v1:coachMatchBreakdownArtifactsByAthleteId` | Parent (hydrate) / Coach (reconcile) | `updatedAt` monotonic accept; validation gates |
| B9 | **Coach Reconcile** (coach device only) | `reconcileCoachMatchBreakdownArtifacts.ts` | Writer session snapshots (newest-first) | Artifact store writes | Same artifact store key | Coach | Requires active writer links + successful session fetch |
| B10 | **Parent Card Hydrate** | `CompetitionCard.tsx` `useFocusEffect` | `sharedAthleteId`, `sharedCompetitionId`, topology/entry lineage keys | `hydratedOverlayAnnotations` | Read from artifact store (async) | Parent UI | Resets on focus; key mismatch gates stale state |
| B11 | **Parent Merge** | `mergeCoachBreakdownIntoMatches.ts` | `entry.matches[]`, overlay annotations | Merged matches with `coachNote` | Ephemeral (render-only) | Parent UI | Strict `match.id === matchLineageKey`; no ordinal fallback |
| B12 | **CompetitionCard Render** | `CompetitionCard.tsx`, `selectCompetitionOverlayAnnotations` | Hydrated vs embedded annotations | Visible `coachNote` on MatchCard | None | Parent UI | Parent uses merge path; coach uses `projectCompetitionCompeteView` |

### 2.3 Boundary probes (investigation instrumentation)

| Probe | Boundary | Device | Pass condition (repo-defined) |
|-------|----------|--------|-------------------------------|
| **B1** | Coach overlay upsert | Coach | Overlay write accepted |
| **B3** | Publish | Coach | PUT attempted and not skipped |
| **B5** | Parent session GET parse | Parent | Field `valid`, athlete entry `populated`, artifact with `coachNote` |
| **B7** | Parent merge | Parent | `mergeCount >= 1` and output `coachNote` length > 0 |

Probes ship in current Dev WIP (`matchBreakdownBoundaryProbe.ts`); Build 82 predates most probe call sites.

### 2.4 Join keys (invariants)

All attachment uses:

```text
(sharedAthleteId, sharedCompetitionId, matchLineageKey)
```

Merge rule (parent): `match.id === matchLineageKey` — no slot guessing, no ordinal fallback (`mergeCoachBreakdownIntoMatches.ts`, `competition-runtime-invariants-v1.md`).

### 2.5 Planes and non-dependencies

| Plane | Role in MB lane |
|-------|-----------------|
| **P1** Parent canonical | Provides `entry.matches[]` merge substrate; does not own overlay |
| **P3** Coach mirror artifacts | Topology/aggregate separate from MB artifact store |
| **P5** Compete render | Card-scoped hydrate; list load does not fetch MB |
| **Coach Compete list** | **NONE** dependency on MB lane (Investigation 1) |

---

## 3. Repository Equivalence Summary

Prior investigations completed before MM-REM-001:

| Investigation | ID / source | Conclusion |
|---------------|-------------|------------|
| Repository equivalence | Build 82 vs Current Dev git diff | **No functional behavior changes** in hydration lane after Build 82 |
| Runtime Investigation | MM-RTI-MB-001 (NC-004) | Current Dev **PASS** — full chain hydrates on Parent |
| Runtime Investigation | MM-RTI-MB-002 (Dream A) | **ABORTED** — reproduction target invalid (Parent Dev has competition; Coach Dev does not) |
| Coach Compete dependency | Investigation 1 | Coach Compete list membership **structurally independent** of MB pipeline |
| Build 82 vs Current Dev | Investigation 2 / git `00e0a93..HEAD` | See classification below |

### 3.1 Build 82 baseline

| Reference | Value |
|-----------|-------|
| TestFlight | 1.0.0 (82), uploaded 2026-06-23 |
| Git commit | `00e0a93` — *Align coach competition snapshot with render substrate* |
| Lane files in that commit | **None** — only `captureCompetitionSnapshot.ts` |

### 3.2 Post–Build 82 change classification (hydration lane only)

| Classification | Count | Examples |
|----------------|-------|----------|
| **Functional behavior** | **0** | — |
| **Bug fix** | **0** | — |
| **Refactor only** | 5 | Parser extraction, overlay selection helpers, write return types |
| **Instrumentation only** | ~15 | Authority traces, B1/B3/B5/B7 probes, parse evidence, worker self-GET logs |
| **Architectural change (adjacent)** | 2 | Competition State Auditor; worker audit snapshots on **non-MB** routes |

**Engineering conclusion (repo):** Current Dev hydration success is **not explained** by source-code differences in the hydration lane. Investigation classification shifted to **Runtime Difference** (ODS Checkpoint 2026-06-27).

### 3.3 What repository evidence does not claim

- Build 82 TestFlight was reproduced with probes on identical QA data (not documented).
- Worker KV contents at time of Build 82 failure (not in repo).
- Device-local AsyncStorage state on Build 82 devices (not in repo).

---

## 4. Runtime Variables

| Runtime Variable | Description | Equivalent? | Evidence Source | Unknown? |
|------------------|-------------|-------------|-----------------|----------|
| **Worker KV `coachMatchBreakdownArtifacts`** | Per-session overlay artifacts keyed by `sharedAthleteId` | **Unknown** | Worker PUT/GET in `coach-sync-worker/src/index.ts`; not versioned in git | **Yes** — live KV state |
| **Parent artifact cache (AsyncStorage)** | `mm:v1:coachMatchBreakdownArtifactsByAthleteId` | **Unknown** | `coachMatchBreakdownArtifactStore.ts`; stale-reject on `updatedAt` | **Yes** — device-local |
| **Coach overlay store (AsyncStorage)** | `coachMatchBreakdownOverlayStore` | **Unknown** | Coach save path; local-only until publish | **Yes** — device-local |
| **Weekly session cache** | `coachWeeklySyncCacheStore` session payload | **Unknown** | Parent hydrates artifacts when `cachedFullSession` written | **Yes** — device-local |
| **`sharedAthleteId` (OAI)** | Operating athlete scope on each device | **Unknown** | `useActiveAthlete`, authority snapshot | **Yes** — runtime selection |
| **`sharedCompetitionId`** | Competition join key | **Unknown** | Shell + topology rows | **Yes** — must match across devices |
| **`matchLineageKey`** | Match join key; must equal `match.id` on parent | **Unknown** | Topology builder, merge gate | **Yes** — lineage drift breaks merge |
| **Writer token (`linkToken`)** | Coach publish + parent GET target | **Unknown** | `publishCoachMatchBreakdownArtifacts` resolution | **Yes** — mismatch → publish skip |
| **Invite token (`sharedFromInviteTokenNorm`)** | Kid → writer link binding | **Unknown** | `kid.sharedFromInviteTokenNorm` vs `link.weeklySync.linkToken` | **Yes** |
| **`writerSecret`** | Bearer auth for coach PUT | **Unknown** | `coachShareStore` / active writer links | **Yes** |
| **Session freshness** | Whether parent has fetched session after coach publish | **Unknown** | Parent path: This Week / join / Summary refresh; Compete focus does **not** network-fetch | **Yes** |
| **Hydration timing** | Order: publish complete before parent GET before Compete focus | **Unknown** | Fire-and-forget publish; async focus effects | **Yes** |
| **Cold start state** | Empty memory mirrors; AsyncStorage-only | **Unknown** | `peek*` returns null until disk read | **Yes** |
| **Local AsyncStorage (all stores)** | Cumulative device history | **Unknown** | DEV vs TestFlight different histories documented (`dev-handoff.md`) | **Yes** |
| **Network timing / ordering** | PUT completion vs GET start | **Unknown** | No client await on publish | **Yes** |
| **Focus effects** | Compete card re-hydrates on focus; resets overlay state | **Repo-equivalent** | `CompetitionCard.tsx` unchanged since B82 | No — code same; **timing** unknown |
| **Competition shell existence** | Parent P1 shell row for competition | **Unknown** | Required for Compete card render | **Yes** |
| **Topology existence** | P3 topology artifact for match lineage keys | **Unknown** | Parent merge uses `entry.matches` lineage; topology affects key signature | **Yes** |
| **`coachSyncHydrationVersion`** | In-process invalidation counter | **Unknown** | Bumped on artifact cache hydrate | **Yes** — session-scoped |
| **`competitionVersion`** | Compete list reload counter | **Unknown** | Subscribed in `compete.tsx` | **Yes** |
| **API base URL** | Worker endpoint resolution | **Unknown** | `coachWeeklySyncApi.ts` override vs config | **Yes** — Dev vs TestFlight |
| **Build / probe instrumentation** | B1/B3/B5/B7 availability | **Not equivalent** | Probes added post-B82; B7 absent on B82 | No — observability only |
| **Logging transport** | Metro vs device unified log | **Not equivalent** | `dev-handoff.md` — authority traces via `console.log` | No — capture method differs |
| **Coach Compete list membership** | Whether competition appears on coach Compete tab | **Independent** | Investigation 1 — **NONE** dependency | No — not required for lane |
| **Device role** | `parent` vs `coach` gates hydrate path | **Repo-equivalent** | `CompetitionCard` role gates unchanged | No |
| **Artifact `updatedAt` generation** | Stale-reject at worker, store, publish | **Repo-equivalent** | Logic unchanged since B82 | No — **values** unknown |
| **Active writer link count** | Zero links → publish skip | **Unknown** | `publishCoachMatchBreakdownArtifacts` | **Yes** |
| **Parent session fetch entry point** | Which screen triggered `coachSyncFetchSession` | **Unknown** | This Week, join, Summary, Kid detail paths | **Yes** |

---

## 5. Runtime Difference Hypotheses

Only hypotheses with repository support. No speculative root causes.

### H1 — Worker KV held empty or stale artifacts during Build 82 QA

| | |
|---|---|
| **Evidence supporting** | Publish is fire-and-forget; parent reads KV via GET; no code fix landed post-B82; worker state not in repo |
| **Evidence against** | MM-RTI-MB-001 PASS on Current Dev with same code path implies KV **can** hold valid artifacts; Build 82 worker code for MB PUT/GET unchanged post-B82 |
| **Confidence** | Medium |
| **Required experiment** | Correlated QA: coach PUT + worker tail self-GET + parent B5 on same `qaRunId`; compare Build 82 vs Current Dev |

### H2 — Parent artifact cache stale-rejected incoming artifacts

| | |
|---|---|
| **Evidence supporting** | `writeCoachMatchBreakdownArtifactSet` rejects when `incoming.updatedAt < existing.updatedAt`; device cache persists across sessions |
| **Evidence against** | Stale-reject logic unchanged since B82; fresh install would empty cache |
| **Confidence** | Medium |
| **Required experiment** | Clear `coachMatchBreakdownArtifactStore` on parent device; repeat hydrate; compare outcomes |

### H3 — Publish target resolution failed silently on Build 82

| | |
|---|---|
| **Evidence supporting** | Publish skips when `kidToken` missing or no matching writer link; skip logic unchanged since B82; pre-B82 QA lacked `PUBLISH_TARGET_RESOLUTION` trace visibility |
| **Evidence against** | MM-RTI-MB-001 B3 PASS on Current Dev with same resolution code |
| **Confidence** | Medium |
| **Required experiment** | B3 probe on both builds with same kid/link binding; verify `kid.sharedFromInviteTokenNorm` ↔ writer token |

### H4 — Parent Compete opened before session GET hydrated artifacts

| | |
|---|---|
| **Evidence supporting** | `compete.tsx` focus loads P1 entries only — **no network**; `CompetitionCard` reads local artifact store; parent does not run coach reconcile; architecture doc requires session GET before disk-only hydrate |
| **Evidence against** | Focus effect re-runs hydrate when user revisits card; `coachSyncHydrationVersion` triggers compete reload |
| **Confidence** | Medium–High |
| **Required experiment** | Sequence-controlled QA: coach save → wait → force parent This Week/session refresh → then Compete; vs Compete-first |

### H5 — `matchLineageKey` / `match.id` mismatch at merge

| | |
|---|---|
| **Evidence supporting** | Strict merge gate documented; topology vs entry lineage drives `overlayHydrationKey`; mismatch → empty overlay attach |
| **Evidence against** | Merge logic unchanged since B82; MM-RTI-MB-001 rendered overlay on NC-004 |
| **Confidence** | Low–Medium (for B82 specifically) |
| **Required experiment** | Log/compare lineage keys at B5 (remote) vs B7 (local merge) on same competition |

### H6 — Dev vs TestFlight environment divergence (API URL, cache, logging)

| | |
|---|---|
| **Evidence supporting** | `dev-handoff.md` documents DEV Parent multi-athlete history vs Coach single-athlete; logging transport differs; investigation question explicitly shifted to "Why TestFlight vs DEV?" |
| **Evidence against** | Core MB lane modules identical; environment alone does not explain without state/timing interaction |
| **Confidence** | Medium |
| **Required experiment** | Same `qaRunId`, same athlete/competition, Build 82 TestFlight vs Current Dev side-by-side with frozen QA script |

### H7 — Build 82 lacked instrumentation; failure boundary was unobserved, not absent

| | |
|---|---|
| **Evidence supporting** | ~15 instrumentation-only changes post-B82; MM-RTI-MB-001 notes B7 did not emit despite successful render (probe gap on tested build); Build 82 predates probes |
| **Evidence against** | Does not explain **success** on Current Dev — only explains **visibility** |
| **Confidence** | High (for observability); N/A as root cause |
| **Required experiment** | Run full B1→B3→B5→B7 chain on Build 82 with probe backport or log correlation |

### H8 — Coach Compete list absence blocked hydration

| | |
|---|---|
| **Evidence supporting** | Dream A visible on Parent Dev, absent on Coach Dev — superficially correlated |
| **Evidence against** | Investigation 1: **no code dependency** between Compete list and MB lane; publish reads overlay store, not Compete list |
| **Confidence** | **Eliminated** as structural cause |
| **Required experiment** | None — repo closes this hypothesis unless new runtime evidence contradicts |

---

## 6. Experiment Matrix

Deterministic experiments. Each row is one controlled QA action.

| Experiment | Runtime Variable | Expected Observation (PASS) | Evidence Required | Conclusion if PASS | Conclusion if FAIL |
|------------|------------------|----------------------------|-------------------|--------------------|--------------------|
| **E1 — Correlated QA run** | Full chain | B1→B3→B5 pass; parent overlay visible | `[MB_BOUNDARY_PROBE]` lines with same `qaRunId` on coach, parent, worker tail | Runtime equivalence achieved for that dataset | Identify first failing probe boundary |
| **E2 — Build 82 vs Dev A/B** | Code + environment | Identical probe outcomes on same QA data | Side-by-side logs; Build 82 = `00e0a93` binary | Failure is runtime/state (H6) | Reopen repo equivalence (unexpected code delta) |
| **E3 — Clear parent artifact cache** | Parent artifact cache | B5 pass after refresh; overlay appears | AsyncStorage clear + session refetch | Cache stale-reject (H2) ruled out for that run | Cache or hydrate path failure |
| **E4 — Clear weekly session cache** | Weekly session cache | Artifacts rehydrate from network GET | Clear cache store key for link token | Session cache was serving stale empty session | Deeper fetch or worker issue |
| **E5 — Cold restart both apps** | Cold start / memory mirrors | Hydrate after session fetch + Compete focus | Kill app; relaunch; repeat E1 | Cold start alone not causal | Initialization order issue |
| **E6 — Force parent session refresh before Compete** | Session freshness, hydration timing | Overlay visible after ordered refresh | This Week pull / join reload before Compete | Timing hypothesis (H4) supported | Session GET or worker payload issue |
| **E7 — Compete before session refresh** | Hydration timing | Overlay absent until refresh | Open Compete immediately after coach save | Timing hypothesis (H4) supported | Not timing — earlier boundary failure |
| **E8 — Relink athlete / refresh writer links** | Writer token, invite token, writerSecret | B3 pass with resolved token suffix | Coach links screen + B3 probe | Link binding was misaligned | Publish skip persists — binding data issue |
| **E9 — Fresh competition (NC-004 pattern)** | Lineage keys, shell existence | Full chain pass | MM-RTI-MB-001 reproduction | Known-good runtime path | New failure mode |
| **E10 — Historical competition (Dream A)** | Shell/topology history | **Blocked** — target invalid on Coach Dev | MM-RTI-MB-002 | N/A until reproduction target restored | Cannot conclude |
| **E11 — Existing competition on both devices** | All join keys | B5 artifacts match coach publish keys | Compare `matchLineageKey` in B3 PUT vs B5 GET vs B7 merge | Lineage consistent | Lineage mismatch (H5) |
| **E12 — Worker tail during publish** | Worker KV | PUT logged; self-GET shows artifact count > 0 | Wrangler tail `[OVERLAY_FORENSIC]` / worker PUT logs | Worker persistence OK | Candidate A: worker omit (historical dev-handoff zone) |
| **E13 — Parent GET immediately after coach PUT** | Network timing | B5 `fieldClassification: valid`, `athleteEntryStatus: populated` | Parent Metro + worker tail timestamps | Ordering sufficient | Race: parent GET before KV write visible |
| **E14 — Zero writer links** | Active writer link count | B3 skip / fail | Disconnect coach links | Explains publish skip | Links present — not H3 |
| **E15 — Stale artifact updatedAt replay** | Artifact `updatedAt` | Store rejects older (`rejected_stale`) | Publish older timestamp intentionally | Stale-reject behavior confirmed | Unexpected accept — investigate store logic |
| **E16 — Topology absent vs present** | Topology existence | Parent merge uses entry matches either way; lineage signature may differ | Compare card with/without topology peek | Topology affects hydration key only | Topology corruption (out of lane scope) |

### 6.1 Recommended first experiment

**E1 + E2** with frozen `EXPO_PUBLIC_MB_QA_RUN_ID` (documented in `matchBreakdownBoundaryProbe.ts`):

```text
EXPO_PUBLIC_MB_QA_RUN_ID=build82-rem-001-a
```

Capture: Coach Metro (Xcode), Parent Metro, Wrangler tail — per `dev-handoff.md` logging doctrine.

---

## 7. Known Unknowns

Repository **cannot** answer:

| Category | Unknown |
|----------|---------|
| **Worker runtime state** | KV contents at time of Build 82 failure; whether PUT succeeded; self-GET artifact counts |
| **Session freshness** | Whether parent performed session GET after coach publish in Build 82 QA |
| **Historic Build 82 device cache** | AsyncStorage contents on TestFlight devices |
| **Historical worker KV** | No snapshot of session record at failure time |
| **Environment differences** | Exact API base URL, network conditions, TestFlight vs Metro refresh cadence |
| **Timing** | Publish-to-GET-to-Compete-focus ordering in manual QA |
| **Network ordering** | Whether parent GET raced ahead of KV commit |
| **OAI selection** | Which athlete was active on each device during QA |
| **Dream A reproduction** | Coach Dev no longer lists Dream A — cannot replay historical case |
| **B7 on Build 82** | Probe did not exist; merge may have run unobserved |
| **Exact Build 82 QA steps** | Not fully captured in repo with probe correlation |

---

## 8. Current Investigation Status

### Proven (repository + documented runtime)

| Claim | Source |
|-------|--------|
| Hydration lane code is **functionally identical** Build 82 → Current Dev | Git diff Investigation 2 |
| Current Dev **can** hydrate MB end-to-end (NC-004) | MM-RTI-MB-001 |
| Coach overlay save lifecycle is stable locally | `dev-handoff.md`, stabilization commits |
| Coach Compete list is **not** a structural dependency of MB lane | Investigation 1 |
| Parent merge requires strict lineage match | `mergeCoachBreakdownIntoMatches.ts` |
| Parent Compete focus does not network-fetch MB artifacts | `compete.tsx`, `CompetitionCard.tsx` |
| Investigation classification is **Runtime Difference**, not Code Difference | ODS Checkpoint 2026-06-27 |

### Eliminated (as primary structural explanation)

| Claim | Source |
|-------|--------|
| Missing code fix in hydration lane explains Dev success | Zero functional diffs post-B82 |
| Coach Compete list visibility required for hydration | Investigation 1 |
| Searching git history for "the fix" | Engineering Decision 1 |
| Overlay save failure as primary symptom | Prior stabilization work; coach saves correctly |

### Remains unknown

| Claim | Why unknown |
|-------|-------------|
| Why Build 82 TestFlight failed while Current Dev succeeds | No runtime state capture from B82 failure |
| Which boundary failed on Build 82 | Uninstrumented at time of failure |
| Whether failure was timing, KV, cache, or link binding | All supported by repo; none proven |
| Dream A historical reproduction | MM-RTI-MB-002 aborted |
| Runtime equivalence for any specific QA dataset | Experiments E1–E16 not yet executed under MM-REM-001 |

### Active next step

**P1 in progress** — Session freshness & hydration timing (MM-P1-001). Execute E7 then E6 per `docs/investigations/p1-session-freshness-evidence-mm-p1-001.md`. After P1 concludes, continue with P2 (E12) if timing alone does not explain divergence.

Prior recommendation (E1, E2, E6, E12) remains valid; **E6/E7 are now the active gate** under P1.

**Section 9 is authoritative** for equivalence classification. Section 4 `Equivalent?` column is retained for inventory; use Section 9 for investigation decisions.

---

## 9. Runtime Confidence Matrix

Every runtime variable from Section 4 receives exactly one classification. **Proven Equivalent** requires repository evidence **and** runtime evidence on **both** Build 82 and Current Dev for the same behavioral claim. Code-only sameness without correlated B82 runtime is **Likely Equivalent** at most.

### Classification key

| Classification | Meaning |
|----------------|---------|
| **Proven Equivalent** | Repository + runtime evidence demonstrate identical lane behavior across Build 82 and Current Dev |
| **Likely Equivalent** | Strong evidence (identical code + partial runtime) suggests equivalence; B82-side runtime not yet correlated |
| **Unknown** | Insufficient evidence; runtime investigation required |
| **Known Different** | Verified divergence between environments (may or may not affect hydration outcome) |

### 9.1 Confidence table

| Variable | Classification | Supporting evidence | Remaining uncertainty | Next experiment |
|----------|----------------|---------------------|----------------------|-----------------|
| **Worker KV `coachMatchBreakdownArtifacts`** | Unknown | MB PUT/GET code unchanged since B82; MM-RTI-MB-001 B5 PASS on Dev implies KV **can** hold valid artifacts | B82-era KV contents; whether PUT succeeded during original TestFlight QA | **E12**, **E13**, **E2** |
| **Parent artifact cache (AsyncStorage)** | Unknown | Store logic unchanged since B82; stale-reject rules documented | Device-local cache on B82 TestFlight; whether stale-reject blocked hydrate | **E3**, **E2** |
| **Coach overlay store (AsyncStorage)** | Likely Equivalent | Overlay upsert logic unchanged since B82; coach save lifecycle stabilized pre-investigation; MM-RTI-MB-001 B1 PASS on Dev | B82 TestFlight overlay store state not captured; local-only until publish | **E1** on B82 with B1 probe or log correlation |
| **Weekly session cache** | Unknown | `setCachedWeeklyForLinkToken` hydrates artifacts when session written; logic unchanged | Cached session on B82 parent may have predated coach publish | **E4**, **E6** |
| **`sharedAthleteId` (OAI)** | Unknown | Authority snapshot code unchanged; NC-004 PASS used consistent OAI on Dev | Which athlete was active on each B82 device during failure QA | **E1** with explicit OAI logged in authority snapshot |
| **`sharedCompetitionId`** | Unknown | Join key invariant documented; NC-004 PASS on Dev | B82 QA competition may differ from NC-004; not correlated | **E11**, **E2** |
| **`matchLineageKey`** | Likely Equivalent | Merge gate unchanged since B82; MM-RTI-MB-001 parent overlay rendered on NC-004 | B82 failure case lineage keys not captured; Dream A not replayable | **E11** |
| **Writer token (`linkToken`)** | Unknown | Resolution code unchanged since B82; MM-RTI-MB-001 B3 PASS on Dev | B82 publish may have targeted different or unresolved token | **E8**, **E2** |
| **Invite token (`sharedFromInviteTokenNorm`)** | Unknown | Kid↔writer binding logic unchanged since B82 | Binding state on B82 coach device not captured | **E8** |
| **`writerSecret`** | Unknown | Required for PUT; unchanged validation | Active writer secret presence on B82 coach device | **E14**, **E8** |
| **Session freshness** | Unknown | Parent Compete focus does **not** network-fetch; architecture requires session GET before disk hydrate | Whether B82 QA opened Compete before any parent session refresh | **E6**, **E7** |
| **Hydration timing** | Unknown | Publish is fire-and-forget; focus effects async | Publish→GET→Compete ordering during B82 manual QA | **E6**, **E7**, **E13** |
| **Cold start state** | Unknown | `peek*` null until disk read — documented | Whether B82 cold start left parent artifact store empty at first Compete visit | **E5**, **E6** |
| **Local AsyncStorage (all stores)** | Known Different | `dev-handoff.md` documents DEV Parent multi-athlete history vs Coach single-athlete; TestFlight vs Metro environments | Magnitude of impact on MB lane specifically (not yet isolated) | **E2** with environment parity controls |
| **Network timing / ordering** | Unknown | No client await on publish — repo fact | Race: parent GET before KV write visible on B82 | **E13** |
| **Focus effects** | Likely Equivalent | `CompetitionCard.tsx` focus/hydrate path unchanged since B82; MM-RTI-MB-001 render success on Dev | B82 timing of focus vs cache population | **E7** |
| **Competition shell existence** | Unknown | Required for Compete card; NC-004 had shell on Dev | B82 QA dataset shell state | **E9**, **E2** |
| **Topology existence** | Unknown | Affects `overlayHydrationKey` signature; parent merge can use entry matches | Topology presence/absence during B82 QA | **E16** |
| **`coachSyncHydrationVersion`** | Unknown | Bumped on artifact cache hydrate; in-process only | Counter value at B82 Compete render time | **E6** (observe bump before Compete) |
| **`competitionVersion`** | Unknown | Subscribed in `compete.tsx`; in-process only | Whether B82 list reload preceded card hydrate | **E6** |
| **API base URL** | Unknown | `coachWeeklySyncApi.ts` resolution unchanged in lane | Dev vs TestFlight may hit different worker deployments | **E2** with endpoint logging |
| **Build / probe instrumentation** | Known Different | Probes post-B82 (`49865c9`+); B7 absent on B82; MM-RTI-MB-001 B7 non-emission on Dev | Observability gap only — does not change lane contract | **E2** with alternate correlation for B82 |
| **Logging transport** | Known Different | Authority traces via `console.log` → Metro, not unified device log (`dev-handoff.md`) | Forensic capture method differs; not lane behavior | None for lane — adopt Coach Xcode + Parent Metro + Wrangler tail |
| **Coach Compete list membership** | Proven Equivalent | Investigation 1: **no code dependency** on MB lane; publish reads overlay store only | Values may differ across devices (Dream A) but **lane behavior proven independent** | None — eliminated as structural cause (Section 11) |
| **Device role** | Likely Equivalent | `CompetitionCard` parent/coach gates unchanged since B82; MM-RTI-MB-001 parent render PASS | B82 role misconfiguration not documented | **E1** |
| **Artifact `updatedAt` generation** | Likely Equivalent | Stale-reject logic unchanged at worker, store, publish; NC-004 chain PASS | Actual timestamp values during B82 QA | **E15** |
| **Active writer link count** | Unknown | Zero links → publish skip (unchanged logic) | Writer link count on B82 coach device at save time | **E14**, **E8** |
| **Parent session fetch entry point** | Unknown | Multiple paths call `coachSyncFetchSession` (This Week, join, Summary, Kid detail) | Which path B82 QA used before Compete | **E6** with scripted entry-point |

### 9.2 Confidence summary

| Classification | Count | Variables |
|----------------|-------|-----------|
| **Proven Equivalent** | 1 | Coach Compete list membership (lane independence) |
| **Likely Equivalent** | 5 | Coach overlay store, matchLineageKey, focus effects, device role, artifact `updatedAt` generation |
| **Unknown** | 20 | All persistence, binding, timing, and environment state variables |
| **Known Different** | 3 | Local AsyncStorage history, probe instrumentation, logging transport |

**No Section 4 variable moved to Proven Equivalent for cross-build runtime state** in this audit. One variable (Coach Compete list membership) is Proven Equivalent for **structural lane independence**, not for identical values across builds.

---

## 10. Runtime Investigation Priorities

Ranked by likelihood of explaining **historical Build 82 failure** vs Current Dev success. Only **Unknown** and **Known Different** (lane-impact) variables appear. **Likely Equivalent** variables are deprioritized unless E2 implicates them.

| Priority | Runtime Variable | Why it matters | Current evidence | Experiment | Expected engineering value |
|----------|------------------|----------------|------------------|------------|---------------------------|
| **P1** | **Session freshness** + **Hydration timing** | Parent Compete does not network-fetch MB artifacts; if B82 QA opened Compete before session GET, overlay would be absent despite successful coach publish | H4 medium–high confidence; architecture doc + `compete.tsx`/`CompetitionCard.tsx`; MM-RTI-MB-001 succeeded when Dev QA likely included refresh | **E6** vs **E7** | **Highest** — explains failure without code regression; matches "coach saves, parent doesn't show" symptom |
| **P2** | **Worker KV `coachMatchBreakdownArtifacts`** | Central transport store; empty/stale KV → B5 fail → no parent hydrate | H1 medium confidence; dev-handoff Candidate A; Dev B5 PASS proves path works when KV populated | **E12**, **E13** | Isolates transport vs client; first boundary after publish |
| **P3** | **Writer token** + **Invite token** + **writerSecret** + **Active writer link count** | Publish silently skips when binding fails; B82 lacked `PUBLISH_TARGET_RESOLUTION` visibility | H3 medium confidence; MM-RTI-MB-001 B3 PASS on Dev; skip logic unchanged since B82 | **E8**, **E14** | Explains coach-side "saved locally, never published" |
| **P4** | **Network timing / ordering** | Fire-and-forget publish; parent GET may race KV commit | No client await — repo fact; E13 not yet run | **E13** | Distinguishes race from persistent KV empty |
| **P5** | **Parent artifact cache** | Stale-reject may block newer artifacts if cache held older `updatedAt` | H2 medium confidence; logic unchanged since B82 | **E3** | Rules in-device cache as cause vs transport |
| **P6** | **Weekly session cache** | Stale cached session without MB field would block artifact store hydrate until refetch | Parent hydrates from `cachedFullSession` only | **E4** | Separates session cache from artifact store |
| **P7** | **API base URL** | Dev vs TestFlight may hit different worker/KV namespace | Environment investigation open (`dev-handoff.md`); not verified | **E2** | Confirms same backend for both builds |
| **P8** | **Local AsyncStorage (all stores)** | Known Different environments; cumulative history may affect stale-reject and binding | Documented DEV vs TestFlight history divergence | **E2** with clean-install arm | Bounds environment parity gap |
| **P9** | **`sharedAthleteId` (OAI)** | Wrong athlete scope → artifacts keyed to different OAI | Authority failures mimic hydration failures (FC-01) | **E1** with authority snapshot | Rules out authority misscope |
| **P10** | **Cold start state** | First Compete visit before disk/mirror warm may show empty overlay | Documented peek boundary | **E5** + **E6** | Lower — refocus usually re-hydrates |
| **P11** | **`sharedCompetitionId`** + **Competition shell existence** | No shell → no card; wrong id → join miss | NC-004 had valid shell on Dev | **E9**, **E11** | Dataset validation, not primary B82 theory |
| **P12** | **Topology existence** | Affects hydration key signature; merge can still use entry matches | E16 scope | **E16** | Lowest lane impact per repo contract |
| **P13** | **Parent session fetch entry point** | Determines when session GET runs relative to Compete | Multiple entry points; B82 path unknown | **E6** (scripted) | Operational clarity for QA reproducibility |
| **P14** | **`coachSyncHydrationVersion`** + **`competitionVersion`** | In-process counters; affect reload timing | Session-scoped; secondary to session freshness | **E6** (observe counters) | Fine-grained timing only |

**Default next action:** Run **P1** experiments **E6** and **E7** in the same QA session as **P2** **E12** and **P3** **E8**, with frozen `qaRunId` per Section 6.1.

---

## 11. Runtime Elimination Ledger

Permanent record of explanations **closed** — do not reopen without new runtime evidence contradicting the ledger entry.

| Hypothesis | Evidence | Date eliminated | Investigation |
|------------|----------|-----------------|---------------|
| **Repository regression in MB hydration lane** | Git diff `00e0a93..HEAD`: 0 functional changes, 0 bug fixes; only refactors + instrumentation | 2026-06-27 | Build 82 vs Current Dev (Investigation 2) |
| **Missing post-B82 code fix explains Dev success** | Same git diff; Engineering Decision 1: stop searching git for "the fix" | 2026-06-27 | Build 82 vs Current Dev; ODS Checkpoint |
| **Coach Compete list membership required for hydration** | No imports/reads of Compete list in overlay→publish→fetch→merge chain; Investigation 1 NONE dependency | 2026-06-27 | Coach Compete dependency investigation |
| **Overlay persistence failure (coach save)** | Coach overlay save lifecycle stabilized; overlays persist locally across reopen/hard-close; current suspicion is post-save transport/hydrate | 2026-06-25 (stabilization floor); reaffirmed 2026-06-27 | Overlay stabilization commits; `dev-handoff.md` |
| **Parent render capability absent or broken** | MM-RTI-MB-001: parent overlay rendered on NC-004; `CompetitionCard` parent path unchanged since B82 | 2026-06-27 | MM-RTI-MB-001 |
| **Match Breakdown merge logic regression** | `mergeCoachBreakdownIntoMatches.ts` unchanged since B82; strict `match.id === matchLineageKey`; MM-RTI-MB-001 render success | 2026-06-27 | Build 82 vs Current Dev; MM-RTI-MB-001 |
| **Parent session GET parser regression** | Parser refactor only (`49865c9`); same validation rules; MM-RTI-MB-001 B5 PASS | 2026-06-27 | Build 82 vs Current Dev; MM-RTI-MB-001 |
| **Worker MB PUT/GET route regression** | Worker MB routes unchanged in classification; instrumentation only post-B82 | 2026-06-27 | Build 82 vs Current Dev |
| **Topology/aggregate corruption causes MB miss** | Architectural finding: issue isolated to bounded overlay transport + hydrate; not topology/lineage corruption | 2026-06-27 | `dev-handoff.md`; prior stabilization |
| **Coach Compete list absence blocked hydration (H8)** | Investigation 1 structural independence; publish reads overlay store not Compete list | 2026-06-27 | Coach Compete dependency; MM-REM-001 §5 H8 |
| **Dream A as current reproduction target** | MM-RTI-MB-002 ABORTED: visible Parent Dev, absent Coach Dev; do not substitute | 2026-06-27 | MM-RTI-MB-002 |
| **Instrumentation gap equals hydration failure** | MM-RTI-MB-001: B7 did not emit yet parent overlay rendered | 2026-06-27 | MM-RTI-MB-001 |

---

## 12. Investigation Decision Tree

Deterministic playbook. Start when **Build A behaves differently from Build B** on Match Breakdown hydration.

```text
START: Build A ≠ Build B (Match Breakdown hydration outcome)
│
├─ Q1: Is the hydration lane SOURCE CODE identical between builds?
│   ├─ NO  → STOP: Code Difference investigation (git diff lane files §2.2)
│   │         Fix or document intentional change before runtime phase
│   └─ YES → Continue (this investigation: YES at 00e0a93 vs Current Dev)
│
├─ Q2: Does Build B (reference) PASS end-to-end on a fresh QA dataset?
│   ├─ NO  → Fix reference build health first (MM-RTI-MB-001 pattern on NC-004)
│   └─ YES → Continue (Current Dev PASS documented)
│
├─ Q3: Are there Known Different variables that affect capture or environment?
│   ├─ Logging transport / probe instrumentation → Use §6.1 capture doctrine
│   │   (Coach Xcode, Parent Metro, Wrangler tail; frozen qaRunId)
│   ├─ Local AsyncStorage history → Note E2 clean-install arm
│   └─ Continue
│
├─ Q4: Run correlated QA (E1) on Build B — record B1, B3, B5, (B7) probes
│   ├─ B1 FAIL → Coach overlay save boundary (§2.2 B1–B2) — STOP lane upstream
│   ├─ B3 FAIL → Publish target resolution (§2.2 B4) → run E8, E14
│   ├─ B5 FAIL → Worker GET or parser (§2.2 B5–B6) → run E12, E13
│   └─ ALL PASS on B but overlay not visible → run E6 (session refresh before Compete)
│
├─ Q5: Session timing split (E6 vs E7)
│   ├─ E7 absent until E6 refresh → Classify P1 Session freshness LIKELY CAUSE
│   │                              → Update §9 Session freshness / Hydration timing
│   └─ E6 order still fails → Continue to Q6
│
├─ Q6: Worker KV check during publish (E12)
│   ├─ PUT OK, self-GET empty → Worker persistence failure → STOP at §2.2 B5
│   ├─ PUT OK, self-GET populated, B5 FAIL → GET/parse boundary → §2.2 B6
│   └─ PUT skipped → E8 link binding → §2.2 B4
│
├─ Q7: Repeat E1 on Build A (TestFlight B82) with same qaRunId + QA script
│   ├─ Same probe failure as Q4/Q6 → Known runtime state difference
│   │   → Update §9 classification for failing variable
│   ├─ Different probe failure → Environment parity issue → E2 matrix
│   └─ All probes PASS but no render → E3/E4 cache clears; E11 lineage keys
│
└─ END: Record conclusion in §9, §11 (if eliminated), §8 status
         Do NOT return to git history unless Q1 becomes NO
```

### 12.1 Decision tree experiment map

| Tree step | Experiment | Section reference |
|-----------|------------|-----------------|
| Q4 | E1 | §6 |
| Q5 | E6, E7 | §6, §10 P1 |
| Q6 | E12, E13 | §6, §10 P2–P4 |
| Publish skip | E8, E14 | §6, §10 P3 |
| Q7 | E2 | §6 |
| Cache follow-up | E3, E4 | §6, §10 P5–P6 |
| Lineage follow-up | E11 | §6, §10 P11 |

---

## References

| Artifact | Location |
|----------|----------|
| ODS Checkpoint (runtime + repo summary) | `OrtizDigital-Studio/99_Logs/ODS_Checkpoint_2026-06-26.md` — June 27 section |
| Dev handoff (active issue, logging doctrine) | `docs/dev-handoff.md` |
| Runtime dependency maps | `docs/architecture/runtime-dependency-maps-v1.md` |
| Hydration orchestration | `docs/architecture/hydration-orchestration-v1.md` |
| Overlay architecture v2 | `docs/architecture/competition-overlay-architecture-v2.md` |
| Boundary probe schema | `src/dev/matchBreakdownBoundaryProbe.ts` |
| Build 82 git baseline | Commit `00e0a93` |

---

## Document maintenance

Update this matrix when:

1. A runtime experiment (Section 6) completes — update **Section 9** classification first; then Section 4 `Equivalent?` if needed.
2. A hypothesis (Section 5) is proven or eliminated — add to **Section 11** elimination ledger.
3. Priorities shift — reorder **Section 10**.
4. New runtime variables are discovered — add to Sections 4 and 9; assign priority in Section 10.
5. Decision tree gaps found — update **Section 12**.

Do **not** use this document to record speculative fixes or code changes.
