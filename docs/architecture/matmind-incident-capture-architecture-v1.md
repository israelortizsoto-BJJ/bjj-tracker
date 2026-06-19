# MatMind Incident Capture Architecture V1

| Field | Value |
|-------|--------|
| **Status** | Canonical governing architecture (documentation only) |
| **Version** | v1 |
| **Scope** | Incident capture, investigation doctrine, and observability sequencing for MatMind production debugging |
| **Grounding rule** | All claims trace to repository behavior, architecture docs, and completed operational assessments |
| **Companion docs** | `runtime-dependency-maps-v1.md`, `hydration-orchestration-v1.md`, `invalidation-cache-systems-v1.md`, `competition-runtime-governance-v1.md`, `competition-runtime-invariants-v1.md`, `qa-trace-governance.md` |
| **Supersedes** | Ad-hoc forensics proposals, handoff-only debugging doctrine, Competition Forensics as end-state framing |

---

## Section 1 — Executive Summary

### Why this effort exists

MatMind is a **distributed system**. Cross-device truth flows:

```text
Parent Device
    ↓
Worker (matmind-coach-sync / KV SessionRecord)
    ↓
Coach Device
```

Parent and Coach are **device roles** inside one Expo binary — not independent applications. When a TestFlight user reports `"Something is wrong,"` engineers historically required Metro logs, Cloudflare Worker console access, local dev builds, Xcode, and repository memory to localize failures. That workflow routinely consumed **hours to days** per incident.

The objective of this architecture is to reduce localization time for real TestFlight incidents to **~15 minutes** by making the first divergent layer identifiable from structured evidence — not from grep, theory, or repro luck.

### Why debugging has been slow historically

Investigations collapsed into:

```text
Bug report → grep → theory → patch → QA → wrong theory → repeat
```

Root causes documented in repository assessments:

1. **Split pipelines** — Summary (P4) and Compete (P5) intentionally read different substrates (aggregate vs topology). Symptoms on one surface are often misdiagnosed as bugs on the other.
2. **Partial hydration paths** — Tab focus reloads local P1 without invoking `refreshCoachWriterSessionsAndReconcileStores`. Default navigation is not full sync.
3. **Fire-and-forget publish** — Parent and coach mutations schedule network writes asynchronously; local save success does not prove remote persistence.
4. **Fragmented instrumentation** — Traces exist (`[OVERLAY_FORENSIC]`, `[COMP_SYNC_TRACE]`, `[SHELL_AUTHORITY_TRACE]`) but are console-bound, `__DEV__`-gated, or require Cloudflare access. TestFlight users cannot export them.
5. **Authority sensitivity** — Wrong operating athlete (`sharedAthleteId` / OAI) poisons every downstream domain simultaneously and mimics domain-specific failures.

### Why Incident Capture is required

**Incident Capture comes before Observability.**

```text
Incident Capture
    ↓
Investigation Doctrine
    ↓
Observability Platform
    ↓
Advanced Telemetry
```

The bottleneck is not missing logs. It is **missing exportable, correlated evidence** from production builds. Many failure classes cannot be localized from TestFlight today because the evidence exists in consoles engineers cannot reach.

**Competition Forensics is not the end goal.** The end goal is the **MatMind Incident Capture Platform**, with **Competition as the pilot domain**. All domains share one worker transport, one reconcile orchestrator (`refreshCoachWriterSessionsAndReconcileStores`), and one join key (`sharedAthleteId`). Competition has the richest governance and trace maturity; Weekly, Training, Summary, and Roster inherit the same capture primitives.

### Governing escalation rule

If an engineer cannot localize the **first divergent layer** from the Incident Bundle:

```text
The next step is NOT a fix.
The next step is improving Incident Capture.
```

---

## Section 2 — MatMind Runtime Truth Model

### The runtime truth ladder

Every production incident is localized by walking this ladder top-to-bottom. **Stop at the first broken rung.** Do not patch below a proven break.

```text
Authority
    ↓
Publish
    ↓
Worker
    ↓
Hydration
    ↓
Replay
    ↓
Substrate
    ↓
Projection
    ↓
Render
```

This ladder is orthogonal to but mappable onto runtime planes P1–P6.

| Ladder rung | Repo-grounded meaning | Primary modules / stores | Typical failures |
|-------------|----------------------|--------------------------|------------------|
| **Authority** | Which athlete is operating (`parentActiveAthleteId`, OAI scope, roster binding) | `buildAthleteAuthoritySnapshot`, `athleteStore`, `coachKidStore`, P6 | Wrong athlete shown; empty surfaces; ACK crossover; weekly key mismatch (FC-01, FC-02, FC-11) |
| **Publish** | Did the origin device schedule and complete remote write? | `schedulePublish*`, `CompetitionSync`, `coachSyncPublishWeekly`, `publishCoachMatchBreakdownArtifacts` | Local save succeeds; worker never receives artifact; flag-gated skip (`topologyPublishV2`) (FC-03) |
| **Worker** | What does remote session authority contain? | `coach-sync-worker` → KV `SessionRecord` | Partial multi-invite fetch; stale session; transport failure; roster validation reject (FC-04) |
| **Hydration** | Did consumer device reconcile mirrors from worker? | `refreshCoachWriterSessionsAndReconcileStores`, `setCachedWeeklyForLinkToken`, `bumpCoachSyncHydrationVersion` | Focus refresh without full reconcile; `earlyExit`; per-stage skip (FC-05) |
| **Replay** | Did incoming artifact pass timestamp governance? | `writeCoachCompetitionTopology` (strict `>`), `writeCoachCompetitionAggregate` (`>=`) | Equal-timestamp topology reject; aggregate refresh at same timestamp; `hydrate_skipped_stale` (FC-06) |
| **Substrate** | What is persisted locally at each plane? | P1 (`kidCompetitionStore`, `competitionStore`), P2 shells, P3 mirrors, overlay stores | Shell without topology; detail without artifact; orphan overlay keys (FC-07, FC-08) |
| **Projection** | How is substrate merged into derived signals/views? | `computeSignals`, `overlayCompetitionAggregateSignals`, `projectCompetitionCompeteView`, `resolveWeeklyDoc` | Summary ≠ Compete by design; overlay attach miss; fallback path (FC-09) |
| **Render** | Does the UI consumer read the resolved projection? | `SummaryScreen`, `compete.tsx`, `CompetitionCard`, `this-week/index.tsx`, `useCoachInsights` | Correct substrate, wrong card; VM strips field by design (FC-12) |

### Plane mapping

| Plane | Name | Ladder rungs primarily involved |
|-------|------|--------------------------------|
| **P6** | Authority / Hydration Orchestration | Authority, Hydration |
| **P1** | Parent Canonical | Authority (parent), Substrate |
| **P2** | Coach Shell Plane | Substrate (shells) |
| **P3** | Coach Mirror Artifacts | Worker (consumer), Replay, Substrate |
| **P4** | Signal Projection | Projection |
| **P5** | Render Plane | Render |
| **Worker** | Transport + session authority | Publish (destination), Worker |

**Cross-plane rule (locked):** P3 never writes P1. Coach `competitionStore` detail for linked athletes is **non-authoritative**. Topology governs Compete structure. Coach owns overlays only — coach save does not create canonical matches.

---

## Section 3 — Runtime Planes

Six planes partition where data lives, who writes it, and who reads it at render time. All coach artifacts are keyed by `sharedAthleteId` (OAI). Route params (`kidId`, `entryId`) are join hints only.

### P1 — Parent Canonical Plane

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Authoritative competition shells, match detail, training sessions, and parent athlete rows on the parent device |
| **Primary stores** | `kidCompetitionStore`, `competitionStore`, `sessionsStore`, `athleteStore` |
| **Writers** | Parent shell CRUD; `setCompetitionDetailForEntryId`; parent training save; athlete bind |
| **Readers** | `loadCanonicalAthleteCompetitionSlice`, `computeSignals` inputs, parent Compete |
| **Ownership** | Parent device only for canonical facts |
| **Failure surface** | Local write without publish; P1 loss on parent reinstall; non-authoritative reads mistaken for truth on coach |

### P2 — Coach Shell Plane

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Coach-local materialization of remote competition shells (`session.competitions[]`) |
| **Primary stores** | `kidCompetitionStore` (coach reconcile path) |
| **Writers** | `upsertSharedCompetitionsForKid` via `reconcileCoachLinkedCompetitionEntriesFromWriterSessions` |
| **Readers** | Compete list load, shell selectors |
| **Ownership** | Worker session is remote authority; P2 is mirror |
| **Failure surface** | Shell present without P3 topology; shell reconcile lag |

### P3 — Coach Mirror Artifacts Plane

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Hydrated bounded artifacts: topology, aggregate, training proof, match breakdown artifacts, weekly cache |
| **Primary stores** | `coachCompetitionTopologyStore`, `coachCompetitionAggregateStore`, `coachTrainingProofStore`, `coachMatchBreakdownArtifactStore`, `coachWeeklySyncCacheStore` |
| **Writers** | Hydrate-only: `writeCoachCompetitionTopology`, `writeCoachCompetitionAggregate`, reconcile stages |
| **Readers** | `useSignals`, `projectCompetitionCompeteView`, `resolveWeeklyDoc` |
| **Ownership** | Worker artifacts are remote authority; P3 is overwrite cache with replay gates |
| **Failure surface** | Replay reject; stale peek; aggregate/topology asymmetry |

### P4 — Signal Projection Plane

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Pure derivation of Summary metrics and overlays — no persistence |
| **Primary functions** | `computeSignals`, `overlayCompetitionAggregateSignals`, `overlayTrainingProofSignals`, `buildSummaryViewModel` inputs |
| **Readers** | Summary cards, coach dashboard signal inputs |
| **Ownership** | Ephemeral; never canonical |
| **Failure surface** | `overlay_missing`; aggregate overlay vs local computeSignals fallback; topology peek for count only |

### P5 — Render Plane

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Screen and component consumption of projections |
| **Primary surfaces** | `compete.tsx`, `CompetitionCard`, `SummaryScreen`, `this-week/index.tsx`, `KidDetailScreen`, `training.tsx` |
| **Ownership** | Ephemeral; last hop |
| **Failure surface** | List vs card pipeline split; consumer omits field present in resolved doc (FC-12) |

### P6 — Authority / Hydration Orchestration Plane

| Attribute | Definition |
|-----------|------------|
| **Purpose** | Operating athlete selection, writer session fetch, reconcile ordering, invalidation generation |
| **Primary modules** | `refreshCoachWriterSessionsAndReconcileStores`, `buildAthleteAuthoritySnapshot`, `coachSyncHydrationStore`, `useActiveAthlete` |
| **Observed reconcile order** | Roster → shells → aggregate → topology → training proof → breakdown artifacts → `bumpCoachSyncHydrationVersion` |
| **Ownership** | Single orchestrator for all cross-device domains |
| **Failure surface** | `earlyExit` (no successful snapshots); focus path bypasses full reconcile; authority bootstrap storms |

---

## Section 4 — Failure Taxonomy

Twelve failure classes (FC-01 through FC-12) cover observed runtime surfaces. Ordered by **investigation priority** (authority first), not frequency. Full definitions reference Investigation Doctrine (Section 8).

| ID | Name | Definition (concise) | User symptoms | Suspect layers | Required evidence |
|----|------|---------------------|---------------|----------------|-------------------|
| **FC-01** | Operating Authority Failure | Active OAI ≠ user-expected athlete | Wrong kid; empty Summary; ACK on wrong child | P6, P1, P2 | Authority Snapshot; roster map; bootstrap state |
| **FC-02** | Lineage / Identity Binding Failure | `kidId` / route params diverge from OAI; ghost athletes | Data on wrong child; missing roster row; weekly resolve null | P6, P2, P1 | Lineage Snapshot; worker athlete union; integrity codes |
| **FC-03** | Publish Failure | Mutation never reaches worker or publish skipped | Coach sees note, parent doesn't; competition missing remotely | P1, P6, Worker | Publish Intent Snapshot; worker domain keys; flag state |
| **FC-04** | Worker Session / Transport Failure | HTTP/session fetch asymmetric; partial multi-invite | Intermittent fix on retry; one invite updates, another doesn't | Worker, P6 | Worker Session Snapshot; fetch success matrix |
| **FC-05** | Reconcile / Hydration Failure | Full reconcile not run or exits early | Worker correct, device stale until pull-refresh | P6, P2, P3 | Hydration Snapshot; `earlyExit` reason; `hydrationVersion` |
| **FC-06** | Replay / Timestamp Governance Failure | Topology strict `>` vs aggregate `>=` asymmetric accept/reject | Appears after restart; Compete stuck, Summary updated | P3, P5, P4 | Replay Snapshot; topology vs aggregate `updatedAt` |
| **FC-07** | Shell–Detail–Topology Substrate Divergence | Shells without topology or detail cardinality mismatch | Competition missing/partial; list count ≠ card count | P2, P1, P3, P5 | Shell, topology, detail snapshots; projection source flag |
| **FC-08** | Projection / Overlay Attachment Failure | Overlay keys misaligned with topology lineage | Coach note stale on parent; empty notes on first paint | P3, P5, P6 | Overlay Snapshot; lineage intersection; `[OVERLAY_FORENSIC]` traceId |
| **FC-09** | Signal / Cross-Pipeline Divergence | Summary and Compete read different substrates by design | Summary W/L ≠ Compete match count | P4, P3, P5 | Aggregate vs topology side-by-side; overlay apply trace |
| **FC-10** | Invalidation / Convergence Timing Failure | Version counters bump non-atomically; mid-tick reads | Fixes on second open; tab switch reveals data | P6, P4–P5 | Invalidation timeline; subscriber generation markers |
| **FC-11** | Weekly Scope Resolution Failure | `weeklyByAthleteId[OAI]` missing or wrong key | Weekly never on parent; wrong mission | P3, P6, Worker | Weekly Snapshot; authority OAI; worker weekly keys |
| **FC-12** | Render Consumer Wiring Failure | Substrate correct; UI consumer omits field | Debug screen correct; production card wrong | P5, P4 | Consumer boundary snapshot; VM input vs output |

### Historical incident mapping (reference)

| Case | Primary FC | Localization hint |
|------|-----------|-------------------|
| Competition missing | FC-03 + FC-07 | P1 local entry → worker `competitions[]` → topology null |
| Appears after restart | FC-10 + FC-06 | Cold start disk topology peek; pre-restart invalidation gap |
| One match → coach save → two | FC-07 + FC-10 | Topology had hidden matches; save bumped invalidation — not canonical match creation |
| Coach note on coach, stale on parent | FC-03 + FC-05 + FC-08 | `[OVERLAY_FORENSIC]` traceId; worker artifacts vs parent cache |
| Summary metrics ≠ Compete | FC-09 (+ FC-06) | Aggregate vs topology cardinality — often expected divergence |
| Weekly published, parent never sees | FC-11 + FC-03 | Worker `weeklyByAthleteId[OAI]` vs parent `resolveWeeklyDoc` |
| Training proof on parent, not coach | FC-03 + FC-05 | Worker `trainingProofByAthleteId` vs `coachTrainingProofStore` |
| Wrong athlete data | FC-01 (+ FC-02) | Always localize authority before any domain |

### Frequency and misdiagnosis notes

**High probability without capture:** FC-09, FC-05, FC-07, FC-03, FC-10.

**Highest blast radius:** FC-01 (poisons all OAI-keyed domains), FC-03 (stops cross-device truth), FC-05 (freezes mirror plane).

**Easiest to misdiagnose:** FC-09 (two substrates), FC-10 (transient vs stuck), FC-07 (missing competition vs missing topology), FC-08 (sync vs publish path coverage).

---

## Section 5 — Incident Capture Architecture

### Why Incident Capture is the first production capability

TestFlight users have Parent and Coach builds only. They do not have Metro, Cloudflare console, Xcode, or repository access. Engineers currently localize many issues only because they have those tools. **That is not a production incident-response capability.**

Incident Capture closes the gap by exporting a **structured, redacted, correlated evidence package** at the moment of repro — without requiring engineer access to the device console.

### Why logs are insufficient

1. **Not exportable** — `console.log` traces on TestFlight are unreachable without dev tooling.
2. **Not correlated** — Tags like `[COMP_SYNC_TRACE]` and `[OVERLAY_FORENSIC]` require manual grep and memory to join across devices.
3. **`__DEV__`-gated** — Authority bootstrap, weekly resolve, aggregate replay, and lineage integrity traces are off in production.
4. **Stubbed pipeline watch** — `hydrationPipelineTrace.ts` functions are no-ops; cannot be relied upon.
5. **Worker truth off-device** — SessionRecord inspection requires Cloudflare access unless client performs redacted on-device GET.

Logs support **development debugging**. Incident Capture supports **field localization**.

### Why TestFlight changes the problem

TestFlight is **beta reality** — distinct from Dev truth. Builds may lag commits; users cannot install dev clients alongside production bundle ID without confusion. Incidents must be localizable from **production-safe exports** on the builds users actually run.

TestFlight constraints that shape capture design:

- No Metro attachment
- No assumption of engineer-side worker pull as first step
- Cross-device symptoms require **paired Parent + Coach bundles**
- Privacy: no full narrative weekly body, no invite secrets, no raw match detail dumps
- Build parity must be explicit (`buildNumber` on both devices)

### Incident Capture vs Observability Platform

| Incident Capture (V1) | Observability Platform (later) |
|----------------------|-------------------------------|
| Point-in-time export on user action | Continuous capture and aggregation |
| Minimal artifact set for localization | Dashboards, streaming, alerting |
| Proves what evidence is necessary | Automates collection of proven artifacts |
| ≤15 minute engineer workflow | Ongoing operational visibility |

**Sequence is locked:** prove capture artifacts in incidents first; then build observability to collect them continuously.

---

## Section 6 — Incident Bundle V1

### Envelope (always included)

Every bundle includes:

| Field | Purpose |
|-------|---------|
| `bundleVersion` | Schema version (`"1"`) |
| `capturedAt` | ISO timestamp |
| `deviceRole` | `parent` \| `coach` |
| `buildNumber`, `appVariant` | Release parity |
| `syncConfigured`, `writerLinkCount` | Gates FC-04/FC-05 |
| `incidentCorrelationId` | Pairs Parent + Coach exports |

**Exclude from all bundles:** full invite tokens, `writerSecret`, raw AsyncStorage dumps, weekly narrative body, breakdown note text (keys and timestamps only), media credentials.

---

### Device Snapshot

**Purpose:** Establishes which device, which build, and whether sync is configured. Required for every incident.

**Localizes:** All FC classes (context); FC-04, FC-05 (sync gates); build skew detection.

**Contains:** `deviceRole`, `buildNumber`, `appVariant`, `syncConfigured`, `writerLinkCount`, `platform`, `capturedAt`.

---

### Authority Snapshot

**Purpose:** First rung on every investigation. FC-01 mimics every other failure class.

**Localizes:** FC-01, FC-02, FC-11 (scope gate).

**Contains:** `resolvedOperatingAthleteId` (OAI), `parentActiveAthleteId`, `authorityBootstrapState`, `coachSessionRefreshDegraded`, `operatingAthleteRoster[]` (`id`, `name`, `sharedAthleteId`), selected athlete display name.

**Repo source:** `buildAthleteAuthoritySnapshot` / `AthleteAuthoritySnapshot` type — must be exported in production (currently `__DEV__`-gated logging only).

---

### Worker Session Snapshot

**Purpose:** Remote truth proxy on device. Eliminates Cloudflare console as first-step requirement for ~80% of cross-device incidents.

**Localizes:** FC-03, FC-04, FC-05, FC-11, FC-07 (remote structure).

**Contains (redacted):** Per active link: fetch success/failure; per OAI: `competitions[]` ids + count, `weeklyByAthleteId` key presence + `updatedAt`, topology/aggregate/proof/breakdown artifact timestamps, `athletes[]` union.

**Redact:** tokens (tail only), weekly body, note text.

---

### Hydration Snapshot

**Purpose:** Proves whether full reconcile ran and why it may have exited early. Build 30 class: focus refresh ≠ sync.

**Localizes:** FC-05, FC-10.

**Contains:** Last reconcile timestamp, `earlyExit` reason (e.g. `noSuccessfulSnapshots`), per-stage completion flags (roster, shells, aggregate, topology, proof, breakdown), `hydrationVersion`, last bump reason, last trigger class (`focus` \| `pull` \| `boot` \| `save`).

**Repo signals:** `[COMP_SYNC_TRACE] earlyExit:*`, `bumpCoachSyncHydrationVersion`.

---

### Topology Snapshot

**Purpose:** Compete structure truth. Primary substrate for FC-07.

**Localizes:** FC-06, FC-07, FC-08, FC-09 (structure side).

**Contains:** Per `sharedCompetitionId`: match count, `matchLineageKey[]` (keys only), `updatedAt`, peek hit/miss, `memoryLoaded` flag, projection source (`topology` \| `fallback`).

---

### Lineage Snapshot

**Purpose:** Key-intersection problems for roster binding and overlay attachment.

**Localizes:** FC-02, FC-08.

**Contains:** `kidId ↔ sharedAthleteId` map, writer session athlete union vs local roster, integrity codes (`GHOST_ATHLETE_DETECTED`, `STALE_LINEAGE_LINKAGE`, `POTENTIAL_DUPLICATE_HUMAN`), orphan overlay keys, overlay key set ∩ topology `matchLineageKey` set.

---

### Replay Snapshot

**Purpose:** Disambiguates FC-06 and FC-07 "appears after restart" family.

**Localizes:** FC-06.

**Contains:** Last N hydrate accept/reject decisions per artifact type; `incoming.updatedAt` vs `existing.updatedAt`; rule applied (`>` topology vs `>=` aggregate); `rejectionReason`.

---

### Domain-Specific Extensions

Included when symptom domain matches (or as Tier 2 always-on for pilot):

#### Competition

**Purpose:** P1 shell presence on Parent; P2 shell mirror on Coach.

**Localizes:** FC-03, FC-07.

**Contains:** Entry list: `entryId`, `sharedCompetitionId`, date, local match count (cardinality only).

#### Weekly

**Purpose:** Weekly scope and freshness.

**Localizes:** FC-11.

**Contains:** `weeklyKeysAvailable`, `resolvedWeeklySharedAthleteId`, doc `updatedAt`, `systemKey`, cache vs network source, `parentFeedback` metadata (timestamps only).

#### Training

**Purpose:** Training proof cross-device presence.

**Localizes:** FC-03, FC-05 (proof reconcile stage).

**Contains:** Proof `updatedAt`, session count, presence on worker vs `coachTrainingProofStore`.

#### Summary

**Purpose:** Metrics-side of FC-09 split pipeline.

**Localizes:** FC-09.

**Contains:** Aggregate W/L totals, `updatedAt`, overlay applied Y/N, `competitionCount` from topology peek vs aggregate.

#### Roster

**Purpose:** Embedded in Authority + Lineage snapshots; explicit roster reconcile outcome when symptom is roster-only.

**Localizes:** FC-01, FC-02.

**Contains:** Writer athlete union, local kids count, reconcile prune decisions.

#### Coach Breakdown

**Purpose:** Overlay publish and hydrate path for match notes.

**Localizes:** FC-08, FC-03.

**Contains:** Local overlay key count, last `[OVERLAY_FORENSIC]` `traceId` tail, worker artifact key count per OAI.

---

### Tiered bundle composition (V1 recommendation)

```text
TIER 0 — Envelope + Device Snapshot (always)

TIER 1 — Core (non-negotiable)
  1. Authority Snapshot
  2. Worker Session Snapshot (redacted)
  3. Hydration Snapshot
  4. Topology Snapshot
  5. Lineage Snapshot

TIER 2 — Closes competition/weekly gaps
  6. Replay Snapshot
  7. Weekly Snapshot (weekly symptom)
  8. Aggregate Snapshot (Summary symptom)
  9. Competition / Overlay / Training extensions (domain symptom)

TIER 3 — Deferred to Observability Platform
  Invalidation Timeline (FC-10)
  Render Consumer Boundary (FC-12)
  Publish Intent ring buffer (FC-03 fine-grain)
```

**Localization power:** Tier 1 + Tier 2 closes 9/12 FC classes at YES or strong PARTIAL for Parent + Coach paired exports within 15 minutes.

---

## Section 7 — Cross-Device Incident Model

### Parent Bundle (minimum)

```text
envelope.incidentCorrelationId = <shared id>
envelope.deviceRole = parent

artifacts:
  - device
  - authority
  - competition (P1 shells)
  - weekly (if weekly/ACK symptom)
  - workerSession (writer-origin slice, redacted)
  - hydration (parent cache / session GET state)
```

### Coach Bundle (minimum)

```text
envelope.incidentCorrelationId = <same id>
envelope.deviceRole = coach

artifacts:
  - device
  - authority
  - hydration (reconcile trace)
  - topology
  - aggregate (if Summary symptom)
  - lineage
  - replay
  - workerSession (consumer slice, redacted)
  - overlay (if breakdown symptom)
```

### Required shared identifiers

| Identifier | Role |
|------------|------|
| `incidentCorrelationId` | Pairs exports from both devices |
| `sharedAthleteId` | Primary scope key (OAI) — must match on both authority snapshots |
| `sharedCompetitionId` | Competition scope for shell/topology diff |
| `matchLineageKey` | Overlay ↔ topology join |
| `updatedAt` | Per-artifact freshness; replay decisions |
| `buildNumber` | Release parity — note skew if different |
| `hydrationVersion` | Convergence generation on coach |
| `deviceRole` | `parent` \| `coach` |
| `capturedAt` | Temporal ordering (export within 5 minutes of repro) |
| `linkTokenTail` | Last 4 chars — multi-invite disambiguation only |

### Correlation rules

**Prerequisite:** If symptom involves or may involve Parent ↔ Coach divergence, **both devices export within 5 minutes** using the same `incidentCorrelationId`.

**Comparison procedure:**

```text
1. Assert sharedAthleteId match on both authority snapshots
2. Verify buildNumber parity (or document skew)
3. Establish worker truth for affected domain (Worker Session Snapshot)
4. Diff Parent local vs Coach local vs Worker remote
5. Identify first divergence point on truth ladder
6. Map divergence pattern → failure class
```

### Divergence patterns

| Pattern | First suspect | Ladder rung |
|---------|---------------|-------------|
| Parent missing, Worker has | FC-05 parent hydrate or FC-10 timing | Hydration / Invalidation |
| Coach missing, Worker has | FC-05 `earlyExit` or FC-06 replay reject | Hydration / Replay |
| Coach has, Worker missing | FC-03 publish (origin device) | Publish |
| Parent stale, Coach fresh | FC-03 coach publish or FC-08 overlay path | Publish / Substrate |
| Both stale, Worker fresh | FC-05 both sides partial hydrate | Hydration |
| Both fresh, UI wrong | FC-09 split pipeline or FC-12 render | Projection / Render |

### Comparable fields (side-by-side diff)

| Comparison | Identifiers | Localizes |
|------------|-------------|-----------|
| Operating athlete | `sharedAthleteId` | FC-01, FC-11 |
| Competition presence | `sharedCompetitionId`, shell count | FC-03, FC-07 |
| Match structure | `matchLineageKey` set per competition | FC-07, FC-08 |
| Metrics vs structure | aggregate W/L vs topology match count | FC-09, FC-06 |
| Weekly freshness | `weekly.updatedAt`, key in `weeklyByAthleteId` | FC-11 |
| Remote vs local | worker timestamp vs local cache timestamp | FC-04, FC-05, FC-06 |
| Hydration freshness | `hydrationVersion`, last reconcile time | FC-05, FC-10 |

---

## Section 8 — Investigation Doctrine V1

### Canonical procedure

```text
Intake
    ↓
Classification
    ↓
Capture
    ↓
Correlation
    ↓
Localization
    ↓
Fix
```

No stage may be skipped. **Fix without Localization is prohibited.**

---

### Phase 0 — Intake (≤2 minutes)

Collect:

- Symptom device (Parent / Coach / Both)
- Origin device (who performed the action — may differ)
- Athlete name visible on screen (not `kidId` from user)
- Surface (Compete / Summary / Weekly / Training / Roster)
- Trigger (`first open` \| `tab switch` \| `pull-refresh` \| `restart` \| `save`)
- Build number on both devices if cross-device

**Do not request:** `kidId`, invite tokens, Metro logs, Xcode steps, Cloudflare access from user.

---

### Phase 1 — Classification (≤2 minutes)

| User says | Start here |
|-----------|------------|
| Missing until restart | FC-10 → FC-07 → FC-05 |
| Wrong kid | FC-01 (always first) |
| Coach sees X, parent doesn't | FC-03 (coach origin) or FC-05 (parent hydrate) |
| Parent sees X, coach doesn't | FC-03 (parent publish) or FC-05 (coach reconcile) |
| Numbers differ between tabs | FC-09 (not assumed single bug) |
| Note stale on parent | FC-08 + FC-03 (`[OVERLAY_FORENSIC]` traceId) |
| Weekly never arrived | FC-11 → FC-03 |
| More matches after coach save | FC-07/FC-10 (not canonical match creation) |

If multiple surfaces wrong simultaneously → **FC-01 before any domain class**.

---

### Phase 2 — Capture (≤5 minutes)

1. Request Incident Bundle export from symptom device.
2. If cross-device OR origin ≠ symptom device: request bundle from **both** devices with same `incidentCorrelationId`.
3. Competition/breakdown: Coach bundle must include overlay + replay.
4. Weekly: Parent bundle must include weekly snapshot.

If bundle cannot localize → **improve capture** (Section 1 escalation rule). Do not patch.

---

### Phase 3 — Correlation (≤3 minutes)

Walk Section 7 comparison procedure. Establish worker truth before judging local UI.

---

### Phase 4 — Localization (≤3 minutes)

Walk runtime truth ladder. **Stop at first broken rung.**

```text
Authority → Worker → Publish → Reconcile → Replay → Substrate → Projection → Render
```

**Required output (no fix without this):**

```text
Failure Class: FC-__
Plane: P_
Device: Parent | Coach | Worker | Cross
Substrate state: present | missing | stale | rejected
User action that did NOT run: <e.g. full reconcile, topology publish>
NOT the problem: <e.g. render, if substrate stale>
```

---

### Phase 5 — Fix gate

- If localization matches documented convergence gap (`invalidation-cache-systems-v1.md`): classify **EXPECTED DIVERGENCE** vs **REGRESSION** before patching.
- Protected systems (P6, P3, P4) require evidence document before mutation.
- **Facts before fixes. Trace before mutation.** (`master-prompt-developer.md` DEBUG DOCTRINE)
- Cite invariant IDs (INV-O1, INV-R2, etc.) when competition runtime is involved.

### Prime directives (never trust)

1. **Never trust render** — UI is P5; prove substrate first.
2. **Never treat Summary and Compete as one source** — FC-09 is often correct divergence.
3. **Always verify authority before domain caches** — FC-01 mimics all others.
4. **Never trust focus refresh as sync** — focus ≠ `refreshCoachWriterSessionsAndReconcileStores`.
5. **Never trust coach `competitionStore` detail for linked athletes** — non-authoritative.
6. **Never treat coach save as canonical match creation** — coach owns overlays only.
7. **Never patch based on theory** — prove canonical, hydration, topology, projection, overlay, render truth in order (`dev-handoff.md` debugging doctrine).

### Overlay forensic supplement (FC-08)

When coach breakdown is involved, follow documented stage gate:

```text
overlay_write_complete → overlay_list_for_publish → artifact_build_input
→ artifact_build_output → publish_schedule_payload → publish_http_request
→ publish_http_success → worker_store_artifact_set → worker_get_artifact_set
```

First missing stage after `overlay_write_complete` = localization rung. Correlate via `traceId` / `X-Overlay-Forensic-Trace-Id`.

---

## Section 9 — Current Blind Spots

Production visibility assessment per ladder rung / plane. Ratings: **Excellent** | **Good** | **Weak** | **Blind**.

| Area | Rating | Why blind (repo truth) | Dependent FC | Evidence that eliminates |
|------|--------|------------------------|--------------|--------------------------|
| **Authority** | **Blind** | `AthleteAuthoritySnapshot` exists; `logAuthorityBootstrap`, lineage traces are `__DEV__`-only. No production export. | FC-01, FC-02, FC-11 | Authority Snapshot in bundle |
| **Worker** | **Good** (ops) / **Blind** (field) | Rich worker console traces; client has no redacted session export | FC-03, FC-04, FC-05, FC-11 | Worker Session Snapshot (on-device GET) |
| **Hydration** | **Weak** | `[COMP_SYNC_TRACE] earlyExit:*` production-visible but not exportable; bump reasons `__DEV__`-only | FC-05, FC-10 | Hydration Snapshot |
| **Replay** | **Weak** | Topology acceptance partially logged; aggregate replay `__DEV__`-only; not bundled | FC-06 | Replay Snapshot |
| **Lineage** | **Blind** | `runLineageIntegrityScan` surfaced via dev hints only | FC-02, FC-08 | Lineage Snapshot with integrity codes |
| **Projection** | **Weak** | `overlay_missing` exists; Summary weekly traces `__DEV__`; no aggregate/topology parity probe in production | FC-09 | Aggregate + Topology snapshots compared |
| **Render** | **Blind** | `CoachInsightDebugScreen` dev-only; no VM boundary audit | FC-12 | Render consumer boundary snapshot (Tier 3) |

### Additional blind spots

| Blind spot | FC impact | Resolution |
|------------|-----------|------------|
| **Invalidation timeline** | FC-10 | Ordered version event log (Observability Platform) |
| **Publish intent history** | FC-03 fine-grain | Publish Intent Snapshot / ring buffer |
| **`hydrationPipelineTrace` stubs** | FC-05, FC-11 | Implement capture or remove from doctrine references |
| **No correlated incident bundle today** | All | Export Incident Bundle (this architecture) |
| **Worker truth requires Cloudflare** | FC-03, FC-04, FC-11 | On-device redacted Worker Session Snapshot |

### TestFlight localizability today (without Incident Bundle)

| FC | Can localize from TestFlight alone? |
|----|-------------------------------------|
| FC-01, FC-02, FC-09, FC-10, FC-11, FC-12 | **NO** |
| FC-03, FC-05, FC-06, FC-07, FC-08 | **PARTIAL** (traces exist, not exportable) |
| FC-04 | **NO** (requires ops worker access) |

---

## Section 10 — Architecture Principles

Governing rules for all incident response, capture design, and future observability work.

### Evidence and mutation

1. **Facts before fixes.** No code change without localization document.
2. **Never patch based on theory.** Prove each ladder rung before modifying architecture.
3. **Localize before modifying.** Identify FC class and plane before opening a PR.
4. **If bundle cannot localize, improve capture** — not the runtime.

### Trust hierarchy

5. **Do not trust render before verifying projection.**
6. **Do not trust projection before verifying substrate.**
7. **Do not trust substrate before verifying replay decisions.**
8. **Do not trust local mirrors before verifying worker truth (when cross-device).**
9. **Do not trust local writes before verifying publish reached worker.**

### Distributed system truths

10. **MatMind is Parent Device → Worker → Coach Device** — not two independent apps.
11. **OAI (`sharedAthleteId`) is the primary scope key** — route params are join hints only.
12. **Summary and Compete are split pipelines** — divergence is often architectural, not bug.
13. **Coach owns overlays and weekly publish; parent owns canonical facts** — coach save does not create matches.
14. **Focus navigation is not full sync** — `refreshCoachWriterSessionsAndReconcileStores` is the reconcile authority.

### Capture and privacy

15. **Highest signal, lowest noise** — no raw storage dumps, no secrets, no narrative PII in bundles.
16. **Cross-device incidents require paired bundles** — single-device export is insufficient for Parent ↔ Coach divergence.
17. **Correlation ids are mandatory** — `incidentCorrelationId` + `sharedAthleteId` on every export.

### Sequencing

18. **Incident Capture before Observability Platform** — observability collects what capture proved necessary.
19. **Competition is pilot domain, not end state** — platform primitives serve all domains.
20. **Observability Platform before Advanced Telemetry** — dashboards follow proven artifacts.

---

## Section 11 — Implementation Strategy

**This section defines architectural sequencing only.** No implementation details, UI mockups, or code contracts beyond artifact names.

### Phase 0 — Architecture Contracts

**Objective:** Lock governing documents and artifact schemas.

**Deliverables:**

- This document (`matmind-incident-capture-architecture-v1.md`) as canonical reference
- Incident Bundle JSON schema v1 (envelope + Tier 1 artifact shapes)
- Cross-device correlation procedure in release checklist
- FC → evidence matrix as engineer quick-reference

**Exit criteria:** Engineering leadership signs off on Tier 1 artifact set and escalation rule.

---

### Phase 1 — Incident Bundle Core

**Objective:** Enable ≤15-minute localization for authority, hydration, worker, topology, and lineage failures.

**Scope:**

- Hidden **Developer Tools → Export Incident Bundle** (production-safe gate)
- Tier 0 + Tier 1 artifacts: Device, Authority, Worker Session (redacted), Hydration, Topology, Lineage
- Shareable JSON export (AirDrop / email / paste)
- Redaction enforcement

**Closes:** FC-01, FC-02, FC-04, FC-05, FC-07 (strong), FC-11 (with weekly extension) at field-localizable or strong PARTIAL.

**Does not include:** log streaming, dashboards, worker console dependency for first pass.

---

### Phase 2 — Competition Pilot

**Objective:** Full competition + coach breakdown incident families localizable from TestFlight.

**Scope:**

- Tier 2: Replay Snapshot, Competition Snapshot, Overlay Snapshot, Aggregate Snapshot (conditional)
- Cross-device pairing workflow documented for testers
- Overlay forensic `traceId` included in bundle tail
- `[OVERLAY_FORENSIC]` stage correlation in engineer procedure

**Closes:** FC-03, FC-06, FC-08, FC-09 (competition/summary metrics), historical cases 1–5.

**Pilot domain:** Competition — richest traces and governance (`competition-runtime-invariants-v1.md`).

---

### Phase 3 — Weekly / Training / Summary

**Objective:** Extend platform primitives to remaining high-impact domains sharing P6 orchestrator.

**Scope:**

- Weekly Snapshot (FC-11)
- Training Proof Snapshot
- Summary parity probe (aggregate vs topology in bundle)
- Domain-conditional auto-inclusion in export

**Closes:** FC-11 production path; training proof cross-device; Summary FC-09 misdiagnosis rate.

---

### Phase 4 — Observability Platform

**Objective:** Continuous capture of artifacts **already proven necessary** by Incident Capture — not a separate discovery exercise.

**Scope (architectural only):**

- Invalidation Timeline (FC-10)
- Publish Intent ring buffer (FC-03 fine-grain)
- Render consumer boundary probes (FC-12)
- Server-side correlation optional enhancement
- Dashboards and alerting atop proven artifacts

**Prerequisite:** Phase 1–2 demonstrate which artifacts recur in real incidents.

**Does not replace:** Incident Bundle export — remains the field-user capability.

---

## Section 12 — Success Criteria

Measurable outcomes for MatMind Incident Capture Platform V1.

### Localization time

| Scenario | Today (typical) | Target with V1 capture |
|----------|-----------------|------------------------|
| Competition missing | 2–8 hours (dev repro + worker pull) | ≤15 minutes with Parent + Coach bundles |
| Weekly not on parent | Dev client + worker inspection | ≤15 minutes: worker key vs parent cache vs OAI |
| Coach note stale on parent | Metro overlay forensic grep | ≤15 minutes: artifact keys + lineage intersection |
| Summary ≠ Compete metrics | Misdiagnosed as single bug | ≤15 minutes: FC-09 documented with aggregate vs topology diff |
| Wrong athlete | High blast radius, slow | ≤5 minutes: authority snapshot mismatch |

### Engineer workflow

- [ ] Engineer identifies **first divergent layer** on truth ladder before opening code
- [ ] Engineer produces required 5-line localization output for every TestFlight incident
- [ ] Engineer classifies **EXPECTED DIVERGENCE** vs **REGRESSION** before patching split-pipeline symptoms
- [ ] No TestFlight incident requires Metro as **first-pass** localization step
- [ ] Cross-device divergence localized from **Parent + Coach exports** without Cloudflare console as first step (worker snapshot on device)

### Capture quality

- [ ] Tier 1 bundle exports in ≤30 seconds on device
- [ ] Bundles contain no secrets or narrative PII
- [ ] `incidentCorrelationId` pairs cross-device exports in 100% of distributed symptom reports
- [ ] FC-01 localizable from Authority Snapshot alone
- [ ] ≥9 of 12 FC classes localizable at YES or strong PARTIAL with Tier 1 + Tier 2

### Platform sequencing

- [ ] Incident Capture shipped and used on real TestFlight incidents before Observability Platform design begins
- [ ] Observability Platform scope derived from incident bundle artifact frequency — not greenfield
- [ ] Competition pilot completes before Weekly/Training expansion

### Escalation discipline

- [ ] When localization fails, team records **missing artifact** and schedules capture improvement — not runtime patch
- [ ] Protected systems (P6, P3, P4) have evidence document attached to every mutation PR arising from incidents

---

## Appendix A — Quick Reference: FC → Plane → Evidence

| FC | Plane | Minimum evidence |
|----|-------|------------------|
| FC-01 | P6 | Authority Snapshot |
| FC-02 | P6 | Lineage + Worker Session |
| FC-03 | P6, Worker | Publish intent + Worker Session |
| FC-04 | Worker, P6 | Worker Session + Hydration fetch matrix |
| FC-05 | P6 | Hydration Snapshot |
| FC-06 | P3 | Replay + Topology |
| FC-07 | P2, P3, P5 | Topology + Competition shells |
| FC-08 | P3, P5, P6 | Lineage + Overlay + Topology |
| FC-09 | P4, P3 | Aggregate + Topology |
| FC-10 | P6 | Hydration + Invalidation timeline |
| FC-11 | P6, Worker | Weekly + Authority |
| FC-12 | P5 | Render boundary (Tier 3) |

---

## Appendix B — Document lineage

This document consolidates findings from:

1. **Operational Architecture Mapping** — system topology, domain authority, P1–P6 planes, shared orchestrator
2. **Runtime Plane Analysis** — `runtime-dependency-maps-v1.md`, `hydration-orchestration-v1.md`, `competition-runtime-governance-v1.md`
3. **Failure Taxonomy** — FC-01 through FC-12, historical incident mapping, frequency analysis
4. **Investigation Doctrine** — truth ladder, prime directives, playbook V1
5. **Incident Capture Review** — TestFlight bundle specification, cross-device model, blind spots, ROI evidence package

**Conflicts resolved:**

- End goal is **MatMind Incident Capture Platform**, not Competition Forensics silo — competition remains pilot only.
- **Worker Session Snapshot on device** supersedes Cloudflare-first workflow for field incidents.
- **Replay Snapshot** is Tier 2 required for competition pilot, not optional.
- **FC-09 split pipeline** documented as often expected divergence — not default bug classification.

---

*This document is the governing architecture for MatMind incident response. Future engineers, AI assistants, contractors, and maintainers should treat it as authoritative without requiring historical handoff context.*
