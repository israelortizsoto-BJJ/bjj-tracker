# Invalidation & Cache Systems v1

Current invalidation triggers, cache boundaries, replay behavior, and known convergence gaps. All claims map to existing store implementations.

---

## Invalidation triggers

| Trigger | Emitted by | Subscribers / effect |
|---------|------------|-------------------|
| `competitionVersion++` | `emitCompetitionChange(caller?)` | `compete.tsx` via `useSyncExternalStore(subscribeCompetition)` |
| `coachAggregateVersion++` | `emitCoachCompetitionAggregateChange` | `useCoachCompetitionAggregateVersion` → `useSignals` effect |
| `hydrationVersion++` | `bumpCoachSyncHydrationVersion` | `useCoachSyncHydrationVersion` → `useAthleteData`, `useSignals`, `compete.tsx` focus deps |
| Parent detail write | `setCompetitionDetailForEntryId`, `copyCompetitionDetailToCanonicalKeyForEntry` | `emitCompetitionChange` |
| Topology hydrate accept | `writeCoachCompetitionTopology` → `hydrate_store_overwrite` | `emitCompetitionChange("writeCoachCompetitionTopology")` |
| Breakdown artifact cache write | `setCachedWeeklyForLinkToken` with session artifacts | `bumpCoachSyncHydrationVersion({ reason: "coach_match_breakdown_artifacts_hydrated" })` |
| Reconcile complete | `refreshCoachWriterSessionsAndReconcileStores` end | `bumpCoachSyncHydrationVersion({ reason: "refreshCoachWriterSessionsAndReconcileStores_complete" })` |

---

## Cache layers & update boundaries

| Cache | Location | Populate | Overwrite rule | Never writes |
|-------|----------|----------|----------------|--------------|
| Shell list | `kidCompetitionStore` | Parent CRUD; coach `upsertSharedCompetitionsForKid` | Remote wins for shared ids; local-only rows kept | Match detail rows |
| Match detail | `competitionStore` (`competitions` key) | Parent `setCompetitionDetailForEntryId` | Full replace per entry id | — (parent authority) |
| Topology | `coachCompetitionTopologyStore` + `topologyMemory` | `writeCoachCompetitionTopology` | Strict newer `updatedAt` (`>`); equal rejected | Match rows locally |
| Aggregate | `coachCompetitionAggregateStore` + `aggregatesMemory` | `writeCoachCompetitionAggregate` | `updatedAt >= existing` | Raw matches |
| Weekly session | `coachWeeklySyncCacheStore` | `setCachedWeeklyForLinkToken` | Per link token replace | Competition detail |
| Overlay artifacts | `coachMatchBreakdownArtifactsByAthleteId` | Session hydrate, coach publish | Per-athlete artifact set replace | Canonical results |

**Peek boundary:** `peekCoachCompetitionTopology` / `peekCoachCompetitionAggregate` read in-process mirrors only. Return `null` until first disk read or write — affects synchronous overlay paths (`overlayCompetitionAggregateSignals` topology peek, `CompetitionCard` render).

---

## Refresh behavior by surface

### Summary

| Action | Competition caches updated? | Signals recomputed? |
|--------|----------------------------|---------------------|
| Tab focus | `useAthleteData` reload (local merge) | Yes, via data + hook deps |
| `coachSyncHydrationVersion` change | `useAthleteData` + cache-only weekly | Yes |
| Pull-to-refresh (coach) | `refreshActiveAthleteAuthority` → full reconcile | Yes, after bump + aggregate version |
| Athlete switch | Scope reset in `useAthleteData` | Yes; `[useSignals] athlete scope transition` DEV log |

### Compete

| Action | Behavior |
|--------|----------|
| Tab focus | `loadCompetitions` full async reload |
| `competitionVersion` change | Reload; may skip `setEntries` if `competeEntriesSameProjection` |
| `coachSyncHydrationVersion` change | Focus effect re-runs load |
| Card render | Sync topology peek + async overlay hydrate (no store write) |

---

## Replay behavior

| Store | Equal `updatedAt` | Older incoming | Notes |
|-------|-------------------|----------------|-------|
| Topology | Rejected (`incoming_equal_updatedAt_rejected`) | Rejected | Full artifact replace when accepted |
| Aggregate | Accepted (`same_timestamp_refresh`) | Rejected | Subscriber notification on accept |
| Shell reconcile | N/A | Remote list is authority for shared ids | Re-running reconcile idempotent for unchanged remote |
| `hasFullLocalMatchLineage` | Always `false` | — | Legacy suppression retired; aggregate overlay always eligible |

Re-running `refreshCoachWriterSessionsAndReconcileStores` with unchanged remote session: topology may skip equal timestamps; aggregate may refresh at same timestamp.

---

## Stale overlay findings (observed traces)

| Trace / condition | Meaning |
|-------------------|---------|
| `overlay_skipped_local_matches` | Not emitted with current `hasFullLocalMatchLineage` (always false) |
| `overlay_missing` | No aggregate in store for athlete |
| `overlay_hidden_visibility` | Aggregate fails `hasBoundedAggregateVisibility` (zero matches and zero W+L) |
| `readingStaleCompetitionEntry` (compete.tsx) | Artifacts present for comp but entry match rows lack coach notes |
| `readingStaleCompetitionShell` (CompetitionCard parent) | Shell has `coachNote`; hydrated artifacts empty |
| `projection_fallback_used` | Topology missing for `sharedCompetitionId`; using detail merge |
| `projection_missing_overlay_attachment` | Overlay keys exist but no topology lineage match |
| `stale_projection_skipped` (compete.tsx) | Reload ran but projection fingerprint unchanged |

---

## Hydration timing observations

1. **Reconcile order:** Aggregate hydrate runs before topology hydrate in `refreshCoachWriterSessionsAndReconcileStores` — Summary overlay may update before topology cache in same reconcile tick.
2. **Summary focus vs pull:** Focus path fetches weekly session only; competition aggregate/topology caches update on authority refresh (pull-to-refresh, `buildAthleteAuthoritySnapshot`, CoachRoster refresh).
3. **Topology → compete lag:** `emitCompetitionChange` fires on topology write; compete reloads merged detail immediately but card projection depends on sync `peekCoachCompetitionTopology`.
4. **Async overlay hydrate on Compete cards:** `CompetitionCard` may render before overlay annotations finish loading → transient empty coach notes.
5. **Parent publish flag:** `schedulePublishParentCompetitionTopology` no-ops when `topologyPublishV2` off — coach topology cache never updates from worker for that build.

---

## Convergence gaps

| Gap | Evidence |
|-----|----------|
| Summary metrics vs Compete match count | Aggregate overlay vs topology projection / detail fallback are separate pipelines |
| Compete list vs card projection | List uses detail merge; coach cards use topology — counts can differ on same screen |
| Focus without reconcile | Summary/Compete focus reloads local merge without guaranteed network reconcile |
| Orphan overlays after parent delete | Overlay stores not tombstoned per deleted `matchLineageKey` |
| Topology peek null before first read | First render may miss topology until store warmed |
| Equal topology timestamp replay | Legitimate parent republish with same `updatedAt` skipped |
| Shell reconcile ≠ detail hydrate | Coach device may hold empty `competitionStore` detail while shells exist |

---

## Deterministic invalidation goals (from traces + governing docs)

- Parent mutation co-schedules aggregate + topology publish.
- `bumpCoachSyncHydrationVersion` preferred over navigation remount for coach signal recompute.
- Topology hydrate should drive Compete cardinality; aggregate hydrate should drive Summary bounded metrics.
- Overlay attachment keyed by `matchLineageKey` — invalid when topology row absent.

These are **targets**; gaps above describe current runtime divergence surfaces.
