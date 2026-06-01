# Competition Overlay Architecture v2

| Field | Value |
|-------|--------|
| **Status** | Governing Architecture Specification |
| **Branch Baseline** | `rollback-pre-lineage-regression` |
| **Repo Floor** | `rc-authority-floor-v1` |
| **Purpose** | Separate canonical competition authority from coach intelligence overlays |
| **Scope** | Competition topology, coach match breakdown overlays, Compete materialization, Summary aggregate gates, cross-device hydration |
| **Supersedes (for competition lane)** | Transition guidance in `docs/overlay-architecture-v1.md` §2 (coach match breakdown row) — v1 remains historical lineage |
| **Companions** | `docs/canonical-athlete-authority-spec.md`, `docs/overlay-architecture-v1.md` (historical), `docs/architecture/competition-overlay-migration-plan.md` (sequencing authority) |
| **Version** | 2.0 — formal governing doctrine for governed competition overlay system |

---

## Governing principles

1. **One canonical writer per fact class.** Parent owns competition topology and match outcomes. Coach owns breakdown overlays only.
2. **Features attach to authority; they do not compete with authority.** No second match array, no coach topology replacement, no dual canonical competition state.
3. **Projection-only consumers.** Coach Compete, Match Breakdown, and future AI surfaces read merged projections. They never persist merged state as canonical.
4. **Bounded overlays.** Cross-device artifacts carry structure or metrics parent already owns — not unbounded journals, not coach-owned results.
5. **Athlete-keyed scope.** All competition artifacts and overlays are keyed by `sharedAthleteId` (OAI). Route params (`kidId`, `entryId`) are join hints, not authority.
6. **Replay safety.** Hydration is overwrite-only into coach caches from parent-published truth. Overlays never resurrect deleted canonical rows. Coach-local legacy blobs never suppress parent aggregates.
7. **Evidence before mutation.** Protected systems (§ Protected systems) are not modified without runtime proof and an explicit migration phase gate.

---

## Problem statement (Test E convergence)

Confirmed runtime findings that motivate v2:

| Finding | Implication |
|---------|-------------|
| Parent owns canonical competition topology | Parent `competitionStore` + publish path remain sole topology writers |
| Coach Summary aggregates are stable | Bounded `SyncedCompetitionAggregateArtifact` path is correct for metrics |
| Coach Compete operates on incomplete local topology | Shell sync ≠ topology hydrate; coach must not bootstrap topology locally |
| Coach edit calls `setCompetitionDetailForEntryId({ matches })` | Topology replacement on coach device violates overlay-only doctrine |
| Aggregate trace can show correct totals while Compete shows one match | Split pipelines: aggregate healthy, detail/topology path broken |

v2 corrects the **class** of failure: coach UI must not depend on coach-local canonical match storage for linked athletes.

---

## Authority model

### Planes

```text
┌─────────────────────────────────────────────────────────────────┐
│ PARENT PLANE (canonical)                                           │
│  kidCompetitionStore (shells)  +  competitionStore (match rows)  │
│         │                              │                           │
│         └──────────┬───────────────────┘                         │
│                    ▼                                               │
│     buildCompetitionTopologyArtifact()                             │
│     buildCompetitionAggregateArtifact()                            │
│                    │                                               │
│     publishParentCompetitionTopology()                             │
│     publishParentCompetitionAggregate()                            │
└────────────────────┼──────────────────────────────────────────────┘
                     ▼
          coach-sync-worker session KV
          ├── competitions[]                    (shells)
          ├── competitionTopologyByAthleteId    (structural match rows)
          └── competitionAggregateByAthleteId   (bounded metrics)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ COACH PLANE (derived + overlay)                                  │
│  reconcile shells → topology cache → aggregate cache             │
│  coachMatchBreakdownOverlayStore (coach annotations only)        │
│                    ▼                                               │
│     projectCompetitionCompeteView()  — render-only               │
│     Coach Compete / Match Breakdown / future AI surfaces         │
└─────────────────────────────────────────────────────────────────┘
```

### Core law

**One canonical writer (parent). One overlay writer (coach). One projection consumer (coach UI).**

### Layering

| Layer | Role | Mutability on coach |
|-------|------|---------------------|
| **Canonical topology** | Parent-owned match structure, results, parent media refs | Read-only |
| **Bounded aggregate** | Parent-owned Summary metrics (wins, losses, rates) | Read-only |
| **Coach breakdown overlay** | Notes, tactics, voice, local media refs, AI-derived insights | Coach-writable |
| **Projection** | Render model for Compete / breakdown | Ephemeral — never canonical |

---

## Data ownership map

| Fact class | Canonical owner | Parent store | Coach store | Cross-device transport |
|------------|-----------------|--------------|-------------|------------------------|
| Competition shell (name, date, medal, status) | Parent | `kidCompetitionStore` | Shell mirror via hydrate | Worker `competitions[]` |
| Match row existence | Parent | `competitionStore.matches[]` | Topology cache (read-only copy) | `SyncedCompetitionTopologyArtifact` |
| Match result / outcome / submission | Parent | match snapshot fields | Topology cache (read-only) | Topology artifact |
| Parent media on matches | Parent | match snapshot | Topology cache (read-only) | Topology artifact |
| Summary win rate / totals | Parent (derived) | aggregate builder | `coachCompetitionAggregateStore` | Existing aggregate PUT |
| Tactical notes / coach reflection | Coach | — | `coachMatchBreakdownOverlayStore` | Coach-local; optional future coach publish lane |
| Voice note refs / transcripts | Coach | — | overlay + local audio cache | Coach-local only |
| Coach local review video refs | Coach | — | overlay store | Coach-local only |
| AI insights (future) | Coach (derived) | — | overlay store | Never canonical; invalidate on topology hydrate |

### Forbidden ownership (non-negotiable)

- Coach-owned match arrays or coach `createKidCompetitionEntry` for linked athletes (review-only creation policy on coach plane)
- Coach writes to `competitionStore` / `setCompetitionDetailForEntryId`
- Dual canonical competition state on coach device
- Coach-local match rows treated as canonical lineage for aggregate suppression
- Invite-scoped or `entryId`-only overlay attachment without `sharedCompetitionId` + lineage key

---

## Replay-safety contract

Replay safety means: **re-running hydrate, restart, or athlete switch never produces cross-athlete bleed, phantom topology, or overlay resurrection.**

### Hydration rules (coach)

| Rule | Requirement |
|------|-------------|
| Overwrite-only | Parent topology → coach topology cache always wins; merge is not bidirectional |
| No alternate owners | Hydrate never mints OAI, `sharedCompetitionId`, or match rows on coach device |
| No coach canonical write | Hydrate paths never call `setCompetitionDetailForEntryId` |
| Empty is valid | Missing topology shows explicit pending/stale UX — not `deriveInitialMatches()` bootstrap on coach |
| Aggregate gate | `hasHydratedCanonicalTopology(sharedAthleteId)` replaces `hasFullLocalMatchLineage` for Summary overlay application |
| Orphan overlays | When parent deletes match/competition, overlay keys remain inert; projection does not render them |

### Cross-athlete isolation

- All caches keyed by `sharedAthleteId`
- Reconcile selects writer session scoped to active athlete linkage
- Projection joins on `sharedCompetitionId`, not local `entryId` alone

### Deterministic invalidation

- Parent save schedules topology + aggregate publish from same canonical transaction boundary
- `bumpCoachSyncHydrationVersion` recomputes signals without navigation remount hacks
- Topology and aggregate share parent `updatedAt` discipline where published together

---

## Overlay attachment model

### Primary key: `matchLineageKey`

Parent mints `matchLineageKey` at match creation (immutable UUID or stable parent-minted id). It does not change when parent reorders or edits outcome.

### Scope key

`(sharedAthleteId, sharedCompetitionId, matchLineageKey)`

```ts
type MatchBreakdownOverlay = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  tacticalNotes?: string;
  dictatedReflection?: string;
  voiceNoteRefs?: VoiceNoteRef[];
  localVideoRefs?: LocalMediaRef[];
  aiInsightRefs?: string[];
  updatedAt: string;
};
```

### Key usage matrix

| Key | Role | Risk if used as primary |
|-----|------|-------------------------|
| `matchLineageKey` | Primary attachment | — |
| `sharedCompetitionId` | Competition scope | Required |
| `ordinal` | Display sort only | Breaks on insert/delete |
| `slotKey` | UI label alias | Not stable across topology versions alone |
| local `entryId` | Shell join hint | Diverges parent/coach |
| coach-generated `match.id` | **Forbidden** | Parallel topology |

### Orphan policy

When parent deletes a match or competition: topology hydrate removes canonical row; overlay may remain keyed by lineage key but projection **must not** display or resurrect it. Optional GC after retention window.

---

## Overlay-intelligence doctrine

Coach intelligence (notes, dictation, transcription, future AI) is **overlay intelligence**, not competition authority.

| Capability | Plane | Persistence | Publishes to parent canonical? |
|------------|-------|-------------|--------------------------------|
| Tactical notes | Coach overlay | `coachMatchBreakdownOverlayStore` | No |
| Voice capture + transcript | Coach overlay + local audio | overlay refs | No |
| Local review video | Coach overlay | overlay refs | No |
| AI summary / insights | Coach derived overlay | overlay store | No — recompute on topology invalidation |
| Suggested result correction | Future workflow | Parent-acknowledged only | Only via parent canonical save |

**Precedence:** Parent match facts in topology artifact always win in UI. Coach annotations render as additive layers on projection rows.

---

## Lifecycle doctrine

### Canonical competition lifecycle (parent)

```text
Parent save/delete
  → kidCompetitionStore + competitionStore
  → remote worker shell PUT/POST (no coach-owned fields)
  → schedulePublishParentCompetitionTopology()
  → schedulePublishParentCompetitionAggregate()
```

Parent is the **only** caller of `setCompetitionDetailForEntryId` for linked athletes.

### Coach overlay lifecycle

```text
Coach MatchBreakdown save
  → upsertMatchBreakdownOverlay({ sharedAthleteId, sharedCompetitionId, matchLineageKey, patch })
  → NO kidCompetitionStore / competitionStore mutation
  → NO remote parent topology write
  → optional future: schedulePublishCoachReviewOverlay() (coach-owned lane only)
```

### Coach Compete / edit screen roles

| Surface | Topology | Overlays |
|---------|----------|----------|
| Coach Compete list | Read-only projection | Read merged breakdown fields |
| Coach Match Breakdown | Read-only per match row | Editable overlay fields only |
| Coach competition edit (legacy path) | **Retire** topology editing | Migrate to breakdown-only |

### Navigation lifecycle (orthogonal)

Modal/navigation freeze after save (observed on `rollback-pre-lineage-regression`) is a **presentation-layer** concern. It must not be “fixed” by writing canonical topology on coach device. v2 separates navigation incidents from authority incidents.

---

## AI coaching doctrine

Future AI features (match insights, tactical suggestions, voice summarization) must obey:

1. **Input boundary:** AI reads projection rows (topology + existing overlay), never raw coach `competitionStore` as canonical input.
2. **Output boundary:** AI writes only `aiInsightRefs` or derived overlay fields — never match results, ordinals, or shell metadata.
3. **Invalidation:** Topology hydrate with newer `updatedAt` invalidates stale AI overlays tied to removed `matchLineageKey`.
4. **Human-in-the-loop:** Coach applies or discards AI output; no auto-publish to parent plane.
5. **No training on parent canonical as coach-owned:** Parent outcomes remain parent facts; AI commentary is coach overlay class.

---

## Hydration topology

### Artifact: `SyncedCompetitionTopologyArtifact`

Separate from aggregate. Aggregate remains metrics-only (Summary). Topology carries structural match rows parent already owns.

```ts
type SyncedCompetitionTopologyArtifact = {
  sharedAthleteId: string;
  updatedAt: string;
  competitions: Array<{
    sharedCompetitionId: string;
    matches: Array<{
      matchLineageKey: string;
      ordinal: number;
      matchResult: "win" | "loss" | null;
      outcome: /* parent outcome enum */;
      submissionTime: string | null;
      submissionType?: string | null;
      imageUri?: string | null;
      videoUri?: string | null;
      imageAssetId?: string | null;
      videoAssetId?: string | null;
    }>;
  }>;
};
```

### Coach reconcile sequence (authoritative order)

On `refreshCoachWriterSessionsAndReconcileStores`:

```text
1. reconcileCoachKidRosterFromWriterSessions
2. reconcileCoachLinkedCompetitionEntriesFromWriterSessions   (shells)
3. reconcileCoachCompetitionTopologyFromWriterSessions        (topology, overwrite-only)
4. reconcileCoachCompetitionAggregatesFromWriterSessions
5. reconcileCoachTrainingProofFromWriterSessions
6. reconcileCoachMatchBreakdownOverlaysFromWriterSessions     (when coach publish lane exists)
7. bumpCoachSyncHydrationVersion
```

**Reconcile direction:** Parent topology → coach cache. Coach overlays → local overlay store only. Never merge overlays into topology cache.

### Local `entryId` mapping

Coach shells use `id: shared-comp-{workerId}`. Topology keys by `sharedCompetitionId`. Projection joins on `sharedCompetitionId`, not local `entryId`.

### Parent overlay hydrate (coach breakdown on parent Compete)

Parent Compete must reconcile coach breakdown artifacts from writer session GET on focus/refresh — not disk-only `ensureCoachMatchBreakdownArtifactsHydrated` without network reconcile. Overlay attachment uses same `(sharedCompetitionId, matchLineageKey)` join as coach plane.

---

## Save and publish flows

### Parent (unchanged canonical path)

```text
CompetitionSync.save
  → updateKidCompetitionEntry / createKidCompetitionEntry
  → setCompetitionDetailForEntryId({ matches })     // parent-only
  → remote worker shell PUT/POST
  → schedulePublishParentCompetitionTopology()
  → schedulePublishParentCompetitionAggregate()
```

### Coach (v2 path)

```text
Coach MatchBreakdown save
  → upsertMatchBreakdownOverlay({ sharedAthleteId, sharedCompetitionId, matchLineageKey, patch })
  → NO competitionStore / kidCompetitionStore canonical mutation
```

### Compete projection

```ts
function projectCompetitionCompeteView(input: {
  shells: KidCompetitionEntry[];
  topology: SyncedCompetitionTopologyArtifact | null;
  overlays: MatchBreakdownOverlay[];
}): CompeteProjectionRow[];
```

Merge rules:

1. Shell → list metadata
2. Topology → `matches[]` per `sharedCompetitionId`
3. Overlays → join on `(sharedCompetitionId, matchLineageKey)`
4. Output is render-only — never written to canonical stores

---

## Failure containment

| Failure | Containment |
|---------|-------------|
| Topology publish fails | Coach keeps last hydrated topology; stale banner; Summary uses last aggregate |
| Topology hydrate missing | Shell-only + “match details syncing”; **no** fallback to coach `competitionStore` |
| Stale coach-local match detail | Ignored when projection flag on; migration deletes |
| Coach overlay save fails | Local draft; canonical untouched |
| Parent deletes annotated match | Overlay orphaned; no resurrection |
| False `hasFullLocalMatchLineage` | Replaced by `hasHydratedCanonicalTopology` |
| Topology + aggregate drift | Co-scheduled publish from parent save; aligned `updatedAt` |

### Authority leak detection (dev/runtime)

- Assert coach paths never import `setCompetitionDetailForEntryId`
- Assert coach save never calls `createKidCompetitionEntry` for rows with `sharedCompetitionId`
- Structured logs: `[TOPOLOGY_HYDRATE]`, `[OVERLAY_SAVE]` with `sharedAthleteId` + `matchLineageKey`

---

## Publication contract (feature declaration)

Every competition or overlay feature crossing parent/coach **must declare**:

| Field | Question |
|-------|----------|
| **Canonical owner** | Which plane owns the source fact if this feature vanished? |
| **Overlay scope** | What fields are derived/read-model only? |
| **Hydration trigger** | What event refetches overlay/topology stores? |
| **Reconcile direction** | On conflict, which side wins? |
| **Publication direction** | Who writes upstream? |

Template:

```text
Canonical owner:
Overlay scope:
Hydration trigger:
Reconcile direction:
Publication direction:
Safety review: (confirm no § Forbidden ownership violations)
```

---

## Safety rule (non-negotiable)

No feature may introduce:

| Violation | Regression |
|-----------|------------|
| Duplicate athlete ownership | OAI + kid/global selectors diverge |
| Alternate canonical entities | Second competition truth on coach device |
| Invite-scoped parallel truth | Token becomes athlete identity |
| Coach-owned athlete identity | Coach mints OAI or global scope |
| Coach topology replacement | `setCompetitionDetailForEntryId` on coach paths |
| Overlay-owned match existence | Phantom Match 1 bootstrap on empty coach detail |

**Pre-merge regression checks:**

- Single OAI per operating context; overlays keyed by same `sharedAthleteId`
- Coach Summary with missing proof/topology shows empty or aggregate — not invented sessions/matches
- Coach cannot mutate parent-owned results or topology source data
- Hydration bump recomputes without navigation remount hacks

---

## Observability doctrine

Minimum signals for governed operation (names normative; implementation may alias):

| Signal | Purpose |
|--------|---------|
| `[TOPOLOGY_HYDRATE]` | Coach topology reconcile applied / skipped |
| `[OVERLAY_SAVE]` | Coach overlay upsert with lineage keys |
| `[COMP_SYNC_*]` | Orchestrator phase outcomes (shell → topology → overlay) |
| `topology_pending` / materialized readiness | Compete may render shells but not assert full match cardinality |
| Orphan overlay classification | `transient_orphan` vs `permanent_unanchored` |
| Aggregate vs topology mismatch | Totals from aggregate ≠ match count from topology |

Counters and diagnostics must use **counts + opaque ids only** — no PII in migration QA telemetry.

---

## Protected systems (do not modify outside migration plan)

- Athlete authority (`athleteStore`, OAI)
- Weekly sync and `weeklyByAthleteId` invariant
- Training proof overlay lane
- Hydration orchestration (`coachSyncHydrationStore`)
- Overlay stores (until phase explicitly migrates them)
- Lineage reconciliation and writer-session selection
- Distributed persistence worker contracts without coordinated deploy

---

## Alignment with repository doctrine

| Document | Relationship |
|----------|----------------|
| `docs/overlay-architecture-v1.md` | Historical transition-era overlay doctrine; v2 concretizes competition match breakdown row |
| `docs/canonical-athlete-authority-spec.md` | OAI and `sharedAthleteId` scope for all competition artifacts |
| `docs/architecture/competition-overlay-migration-plan.md` | Operational sequencing, gates, rollback — not duplicated here |

**Stabilization lesson (retained):** Features must attach **to** authority, not compete **with** authority. That principle ended the RC authority collapse cycle and is embedded as governing law in v2.

---

## Risks and tradeoffs (architectural)

| Risk | Mitigation |
|------|------------|
| Topology artifact size | Bound per athlete; media as refs not bytes; cap matches per competition |
| Worker route deploy dependency | Ship topology route before enabling coach projection flag |
| Legacy coach-local match data | Phase 4 migration extracts coach-owned fields only; log unmappable |
| Parent reorder | `matchLineageKey` primary, not ordinal |
| Coach “correct parent result” | Out of scope — annotation overlay only |
| Offline coach review | Shells + last topology + stale indicator; overlays keyed to last known lineage |
| Dual read paths during migration | Single projection entry behind `competitionTopologyProjectionV2` |

---

## Version history

| Version | Date | Note |
|---------|------|------|
| 2.0 | 2026-06-01 | Governing spec formalized from Test E architecture approval and RC stabilization doctrine |
