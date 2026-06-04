# Runtime Dependency Maps v1

Grounded dependency flows for competition hydration, signals, Summary, and Compete. Arrows mean **reads** or **derives from** at runtime.

---

## Store ownership

| Store | AsyncStorage key | Writer(s) | Reader(s) |
|-------|------------------|-----------|-----------|
| `kidCompetitionStore` | `mm:v1:kidCompetitionEntries` | Parent save, coach shell reconcile | Compete, Summary slice, artifact builders |
| `competitionStore` | `competitions` | Parent `setCompetitionDetailForEntryId` only | Detail merge, parent publish builders |
| `coachCompetitionTopologyStore` | `mm:v1:coachCompetitionTopologyByAthleteId` | `writeCoachCompetitionTopology` (hydrate) | `peekCoachCompetitionTopology`, `projectCompetitionCompeteView` |
| `coachCompetitionAggregateStore` | `mm:v1:coachCompetitionAggregatesByAthleteId` | `writeCoachCompetitionAggregate` (hydrate) | `useSignals`, `peekCoachCompetitionAggregate` |
| `coachSyncHydrationStore` | in-process version counter | `bumpCoachSyncHydrationVersion` | `useAthleteData`, `useSignals`, `compete.tsx` |
| `coachMatchBreakdownArtifactStore` | `mm:v1:coachMatchBreakdownArtifactsByAthleteId` | Session cache hydrate, coach publish | `CompetitionCard`, overlay merge |

---

## Parent mutation → remote → coach (high level)

```text
CompetitionSync.save/delete
  → kidCompetitionStore
  → competitionStore.setCompetitionDetailForEntryId (parent only)
  → coachSync worker (shell)
  → schedulePublishParentCompetitionAggregate
  → schedulePublishParentCompetitionTopology [flag-gated]

Coach device (later):
  refreshCoachWriterSessionsAndReconcileStores
    → kidCompetitionStore (shells)
    → coachCompetitionAggregateStore
    → coachCompetitionTopologyStore
    → bumpCoachSyncHydrationVersion
```

---

## `useSignals` dependency chain

```text
useActiveAthlete (athleteId, linkedKidId)
  → useAthleteData
       → getSessions()
       → loadCanonicalAthleteCompetitionSlice
            → getKidCompetitionEntriesWithMatchDetailForKid | ForSharedAthlete
                 → mergeCompetitionMatchDetailIntoEntries
                      → getCompetitionDetailForEntry (competitionStore)

useSignals
  → computeSignals({ sessions, competitions, ... })     // base SignalOutput
  → [coach only]
       peek/getCoachCompetitionAggregate
       hasBoundedAggregateVisibility?
         → overlayCompetitionAggregateSignals
              → peekCoachCompetitionTopology (competitionCount only)
       peek/getCoachTrainingProof
         → overlayTrainingProofSignals
```

**Version deps:** `useCoachSyncHydrationVersion`, `useCoachCompetitionAggregateVersion`.

---

## `computeSignals` inputs (competition lane)

- Flattens `competitions[].matches` from caller-provided entries.
- Computes wins/losses, win rate, submission rate, placement trends, bucket history from **local merged entries**.
- Does not read `coachCompetitionAggregateStore` or topology store directly.

Coach Summary final competition metrics come from overlay **after** `computeSignals`, not from replacing `computeSignals` inputs.

---

## Summary runtime graph

```text
SummaryScreen
  ├─ useActiveAthlete
  ├─ useAthleteData(activeAthleteId, linkedKidId)
  │    └─ competitions: KidCompetitionEntryWithMatchDetail[]
  ├─ useSignals({ athleteId, kidId, sessions, competitions, declaredInput })
  │    └─ signals.competition.* (possibly aggregate-overlaid)
  ├─ buildSummaryViewModel(signals, ...)
  └─ SummaryCompetitionCard / SummaryHeroCard (consume signals.competition)

Parity trace (DEV):
  canonicalCompetitionSliceFingerprint(competitions)
  devGetCompeteTabCompetitionSnapshot — compares Summary vs Compete sources
```

**Weekly side path (orthogonal):** `refreshCoachWeeklySessionSnapshot` → `coachWeeklySyncCacheStore` → weekly UI trust surfaces. Full competition reconcile requires `refreshActiveAthleteAuthority` → `buildAthleteAuthoritySnapshot` → `refreshCoachWriterSessionsAndReconcileStores`.

---

## Compete runtime graph

```text
compete.tsx
  ├─ useActiveAthlete
  ├─ useCoachSyncHydrationVersion
  ├─ subscribeCompetition → competitionVersion
  ├─ loadCompetitions (focus + version deps)
  │    └─ getKidCompetitionEntriesWithMatchDetailForKid | ForSharedAthlete
  │         └─ mergeCompetitionMatchDetailIntoEntries
  └─ visibleEntries filter by linkedKidId | sharedAthleteId

CompetitionCard (per entry)
  ├─ peekCoachCompetitionTopology(sharedAthleteId)
  ├─ hydrate overlay annotations (async)
  └─ [coach] projectCompetitionCompeteView({ shell, topologyArtifact, overlayAnnotations, fallbackMatches: entry.matches })
  └─ [parent] mergeCoachBreakdownIntoMatches on entry.matches
```

**Important:** List load in `compete.tsx` does not apply topology projection; projection is **card-scoped**.

---

## Aggregate overlay application point

| Location | Function | What changes |
|----------|----------|----------------|
| `useSignals` (coach branch) | `overlayCompetitionAggregateSignals` | Shallow merge into `signals.competition`: totals, win rate, submission rate, timing, winStyle, record; optionally `competitionCount` from topology peek |

Does **not** modify: `recentResults`, `placementTrend`, `bucketHistory`, `lastCompetition*`, raw match arrays.

---

## Topology projection application points

| Location | Function | What changes |
|----------|----------|----------------|
| `CompetitionCard` (coach) | `projectCompetitionCompeteView` | Ephemeral `matches[]` from topology + overlay annotations |
| `projectCompetitionEditorView` | wraps `projectCompetitionCompeteView` | Editor read model; marks `source: canonical_topology \| legacy_fallback` |

Join keys: `(sharedAthleteId, sharedCompetitionId, matchLineageKey)`.

---

## Artifact build dependencies (parent-only)

```text
buildCompetitionTopologyArtifact(sharedAthleteId)
  → getKidCompetitionEntriesWithMatchDetailForSharedAthlete
  → buildCompetitionTopologyArtifactFromEntries
       → match.id → matchLineageKey
       → throws on missing sharedCompetitionId or duplicate lineage

buildCompetitionAggregateArtifact(sharedAthleteId, competitions)
  → collectMatches from merged entries
  → bounded SyncedCompetitionAggregateArtifact (no raw rows on wire)
```

Both builders log `[SHELL_AUTHORITY_TRACE]` and prefer shell entries (`shared-comp-{workerId}`) as canonical detail input.

---

## `canonicalCompetitionSource`

Thin adapter used by `useAthleteData`:

- `loadCanonicalAthleteCompetitionSlice(athleteId, linkedKidId)` — same selector as Compete tab (`by kid` if linked, else `by sharedAthleteId`).
- `canonicalCompetitionSliceFingerprint` — DEV parity fingerprint for Summary traces.

No topology or aggregate reads; purely local shell + detail merge.

---

## Invalidation fan-out

| Event | Stores / hooks affected |
|-------|-------------------------|
| `writeCoachCompetitionTopology` | `emitCompetitionChange` → `competitionVersion` → compete reload |
| `writeCoachCompetitionAggregate` | `coachAggregateVersion` → `useSignals` reload |
| `bumpCoachSyncHydrationVersion` | `useAthleteData`, `useSignals`, compete focus deps |
| `setCompetitionDetailForEntryId` | `emitCompetitionChange` |
| Parent shell CRUD | `kidCompetitionStore` listeners (if emit called) |
