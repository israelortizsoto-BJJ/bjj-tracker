# Hydration Orchestration v1

| Field | Value |
|-------|--------|
| **Status** | Grounded architecture record |
| **Scope** | Parent canonical writes, coach writer-session reconcile, Summary/Compete hydration boundaries |
| **Companion** | `competition-overlay-architecture-v2.md` (governing doctrine); this doc records **observed runtime order** |

---

## Hydration planes

| Plane | Canonical stores | Coach mirror stores | Transport |
|-------|-------------------|---------------------|-----------|
| **Parent** | `kidCompetitionStore` (shells), `competitionStore` (`competitions` detail key) | — | Worker session PUT/POST from parent writer |
| **Coach shells** | — | `kidCompetitionStore` via `upsertSharedCompetitionsForKid` | `session.competitions[]` |
| **Coach topology** | — | `coachCompetitionTopologyStore` | `session.competitionTopologyByAthleteId` |
| **Coach aggregate** | — | `coachCompetitionAggregateStore` | `session.competitionAggregateByAthleteId` |
| **Coach overlays** | — | `coachMatchBreakdownArtifactStore`, `coachMatchBreakdownOverlayByLineage` | Session cache + local coach writes |
| **Training proof** | — | `coachTrainingProofStore` | `session.trainingProofByAthleteId` |
| **Weekly** | — | `coachWeeklySyncCacheStore` | `session.weekly`, `weeklyByAthleteId` |

All coach competition artifacts are keyed by `sharedAthleteId` (OAI). Route params (`kidId`, `entryId`) are join hints only.

---

## Coach reconcile entry point

Single orchestrator: `refreshCoachWriterSessionsAndReconcileStores` in `coachKidStore.ts`.

**Preconditions:** `isCoachSyncConfigured()` and at least one active writer link with a successful `coachSyncFetchSession`.

**Observed reconcile order (code, not aspirational):**

```text
1. reconcileCoachKidRosterFromWriterSessions
   └─ prune orphan roster rows → deleteKidPilot (when authoritative)
   └─ pruneCoachCompetitionAggregates / Topology / TrainingProof (roster union)
2. reconcileCoachLinkedCompetitionEntriesFromWriterSessions   (shells)
3. reconcileCoachCompetitionAggregatesFromWriterSessions      (aggregate)
4. reconcileCoachCompetitionTopologyFromWriterSessions        (topology)
5. reconcileCoachTrainingProofFromWriterSessions
6. reconcileCoachMatchBreakdownArtifacts
7. pruneCoachMatchBreakdownArtifactsAfterRosterReconcile
8. bumpCoachSyncHydrationVersion({ reason: "refreshCoachWriterSessionsAndReconcileStores_complete" })
```

**Note:** Aggregate reconcile runs **before** topology reconcile in the current implementation.

---

## Parent publish (post-mutation)

After parent create/edit/delete (`CompetitionSync`, `parentKidCompetitionDelete`):

```text
kidCompetitionStore + competitionStore (parent-only detail writes)
  → remote worker shell PUT/POST/DELETE
  → schedulePublishParentCompetitionAggregate(sharedAthleteId)
  → schedulePublishParentCompetitionTopology(sharedAthleteId)   [gated: topologyPublishV2 flag]
```

Both publishes are fire-and-forget; local saves do not await network.

---

## Consumer hydration boundaries

### Summary (coach)

| Stage | Source | Invalidation |
|-------|--------|--------------|
| Competition slice | `useAthleteData` → `loadCanonicalAthleteCompetitionSlice` → `competitionStore` merge | `useFocusEffect`, `coachSyncHydrationVersion` |
| Signals base | `useSignals` → `computeSignals` (local competitions + sessions) | Same + `coachAggregateVersion` |
| Aggregate overlay | `overlayCompetitionAggregateSignals` ← `coachCompetitionAggregateStore` | `hydrationVersion`, `coachAggregateVersion` |
| Training proof overlay | `overlayTrainingProofSignals` ← `coachTrainingProofStore` | `hydrationVersion` |

`hasFullLocalMatchLineage` **always returns `false`** (suppression retired). Coach aggregate overlay is attempted whenever a bounded artifact exists.

### Compete (coach)

| Stage | Source | Invalidation |
|-------|--------|--------------|
| Entry list | `compete.tsx` → `getKidCompetitionEntriesWithMatchDetailForKid/SharedAthlete` | `useFocusEffect`, `competitionVersion`, `coachSyncHydrationVersion` |
| Per-card projection | `CompetitionCard` → `projectCompetitionCompeteView` + `peekCoachCompetitionTopology` | Render-time (not persisted) |

Compete tab list load does **not** call `projectCompetitionCompeteView`; topology projection happens at card render for `deviceRole === "coach"`.

---

## Divergence boundaries

| Boundary | Parent behavior | Coach behavior |
|----------|-----------------|----------------|
| Match rows in list API | `competitionStore.mergeCompetitionMatchDetailIntoEntries` (local detail) | Same merge for shells; card may override via topology projection |
| Summary metrics | `computeSignals` from merged local matches | `overlayCompetitionAggregateSignals` replaces bounded metrics from hydrated aggregate |
| Summary placement/trends | From local shell `result` fields | Unchanged by aggregate overlay (metrics-only overlay) |
| Compete match cardinality | Local detail | Topology artifact when present; else `fallbackMatches` from detail merge |
| `competitionCount` in Summary overlay | Local shell count | Overwritten from topology artifact length when topology peek succeeds |

**Known split pipeline:** Summary aggregate trace can show parent-published totals while Compete card falls back to local detail when `peekCoachCompetitionTopology` returns null or topology row missing for `sharedCompetitionId`.

---

## Navigation-triggered refresh

| Surface | Trigger | Network reconcile? |
|---------|---------|-------------------|
| **Summary focus** | `refreshWeeklySessionSnapshot` (coach: fetch or cache-only weekly) | Focus alone: weekly fetch only; **not** full `refreshCoachWriterSessionsAndReconcileStores` |
| **Summary pull-to-refresh** | `refreshCoachWeeklySessionSnapshot` + `refreshActiveAthleteAuthority` | Yes — authority refresh calls `refreshCoachWriterSessionsAndReconcileStores` |
| **Summary hydration bump** | `useEffect` on `coachSyncHydrationVersion` → cache-only weekly | No full reconcile |
| **Compete focus** | `loadCompetitions` via `useFocusEffect` | Reloads local merge; relies on prior reconcile for topology/aggregate caches |
| **Compete** | Subscribes to `competitionVersion` + `coachSyncHydrationVersion` | Re-loads when topology write calls `emitCompetitionChange` |

`bumpCoachSyncHydrationVersion` subscribers: `useAthleteData`, `useSignals`, `useActiveAthlete`, `compete.tsx`.

---

## Aggregate vs topology projection

| Artifact | Built by (parent) | Coach store write rule | Consumed by |
|----------|-------------------|------------------------|-------------|
| **Aggregate** | `buildCompetitionAggregateArtifact` | `writeCoachCompetitionAggregate`: accept if `updatedAt >= existing` | Summary via `overlayCompetitionAggregateSignals` |
| **Topology** | `buildCompetitionTopologyArtifact` | `writeCoachCompetitionTopology`: accept only if `updatedAt > existing` (equal timestamp rejected) | Compete via `projectCompetitionCompeteView` |

Aggregate carries bounded metrics only. Topology carries structural match rows (`matchLineageKey`, `ordinal`, `result`, `finishType`, media refs).

---

## Stale-state observations (logged / traced)

- **Topology memory not loaded:** `peekCoachCompetitionTopology` returns null until AsyncStorage read or write populates in-process mirror.
- **Topology equal-timestamp replay:** Incoming artifact with same `updatedAt` as cache → `hydrate_skipped_stale` (strict newer-wins for topology).
- **Aggregate same-timestamp refresh:** Incoming artifact with equal `updatedAt` → accepted (`same_timestamp_refresh`).
- **Shell coach notes on parent Compete:** `CompetitionCard` logs `readingStaleCompetitionShell` when shell carries `coachNote` but hydrated overlay artifacts are empty.
- **Coach overlay without topology join:** `projection_missing_overlay_attachment` when overlay keys exist but no matching topology `matchLineageKey`.
- **Compete projection unchanged skip:** `competeEntriesSameProjection` prevents `setEntries` when shell + match signatures unchanged.

---

## Deterministic orchestration goals (documented targets, not yet fully enforced)

From governing spec + trace infrastructure:

- Parent save schedules topology + aggregate publish from same mutation boundary.
- Coach reconcile is overwrite-only; no local topology minting on coach device.
- `bumpCoachSyncHydrationVersion` drives signal recompute without navigation remount.
- Summary aggregate gate intended to use hydrated topology presence (`overlayCompetitionAggregateSignals` already peeks topology for `competitionCount`).
- Single projection entry for coach Compete (`projectCompetitionCompeteView`) — active at card level today.
