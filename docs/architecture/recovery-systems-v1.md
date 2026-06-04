# Recovery Systems v1

Bounded recovery substrate: what survives parent competition deletion, what coach caches retain, and what requires remote re-hydration to reconstruct.

---

## Parent deletion path

`parentKidCompetitionDelete` → `deleteKidCompetitionEntry`:

1. Removes match media (best-effort) from detail rows.
2. `removeCompetitionDetailForEntryId(entryId)` — drops `competitionStore` detail key.
3. Removes shell from `kidCompetitionStore`.
4. Remote DELETE via `coachSyncDeleteSessionCompetition` when linked target resolves.
5. Schedules `schedulePublishParentCompetitionAggregate` + `schedulePublishParentCompetitionTopology` for remaining athlete competitions.

**Locally lost immediately on parent device:** shell row, detail match rows, parent media refs tied to deleted entry.

---

## Coach survivability after parent delete

Recovery requires a successful `refreshCoachWriterSessionsAndReconcileStores` (or equivalent writer GET + reconcile) **after** parent publish reaches worker.

| Substrate | Survives parent delete? | Mechanism |
|-----------|-------------------------|-----------|
| **Shell (`kidCompetitionStore`)** | Removed on reconcile | `upsertSharedCompetitionsForKid` drops local shared rows whose `sharedCompetitionId` absent from `session.competitions[]` |
| **Topology cache** | Updated on reconcile | New artifact from worker excludes deleted competition/matches; `writeCoachCompetitionTopology` overwrite |
| **Aggregate cache** | Updated on reconcile | Recomputed parent artifact excludes deleted matches; `writeCoachCompetitionAggregate` overwrite |
| **Coach breakdown overlays** | May persist keyed | Orphan overlays remain in store; projection must not render unmatched lineage keys |
| **Coach breakdown artifacts (remote cache)** | Pruned on roster reconcile | `pruneCoachMatchBreakdownArtifactsAfterRosterReconcile` when all writer fetches succeed |
| **Local `competitionStore` on coach** | Not authoritative for linked athletes | Detail merge may retain stale rows until shell reconcile; Compete coach path prefers topology projection |

**Gap:** Between parent delete and next coach reconcile, coach may still show deleted shell/matches from last local merge or stale topology until hydrate runs.

---

## Topology survivability

- **Storage:** `mm:v1:coachCompetitionTopologyByAthleteId` keyed by `sharedAthleteId`.
- **Write rule:** Newest `updatedAt` wins; equal timestamp rejected (`hydrate_skipped_stale`).
- **Removal:** `removeCoachCompetitionTopology`, `pruneCoachCompetitionTopology` (athlete not in allowed roster set), `clearKidSharedAthleteLink`, `deleteKidPilot`.
- **In-process mirror:** `topologyMemory` — cleared when store not yet read; recovery from disk on next `getCoachCompetitionTopology`.

Deleted parent matches disappear from coach UI only after incoming topology artifact omits those `matchLineageKey` values **and** projection uses topology (coach `CompetitionCard`).

---

## Aggregate survivability

- **Storage:** `mm:v1:coachCompetitionAggregatesByAthleteId`.
- **Write rule:** Accept incoming if no existing or `updatedAt >= existing` (equal allowed).
- **Removal:** Same prune/remove paths as topology.
- **Summary behavior without aggregate:** `useSignals` keeps `computeSignals` local competition metrics (`overlay_missing` / `overlay_hidden_visibility` traces).

Parent delete reduces totals in next published aggregate; coach Summary updates after reconcile + `coachAggregateVersion` bump.

---

## Shell survivability

Coach shells materialized as `id: shared-comp-{workerCompetitionId}`.

| Event | Shell outcome |
|-------|---------------|
| Parent deletes competition | Dropped locally on next `upsertSharedCompetitionsForKid` when remote list omits id |
| Parent edits shell metadata | Upsert merges remote fields into existing shell row |
| Local-only coach row (no `sharedCompetitionId`) | Kept across reconcile — not dropped as stale shared |
| Roster orphan | `deleteKidPilot` removes all competitions for kid |

Shell reconcile does **not** write match detail to `competitionStore` on coach device.

---

## Overlay survivability

| Overlay type | Store | After parent match delete |
|--------------|-------|---------------------------|
| Coach match breakdown artifacts | `coachMatchBreakdownArtifactsByAthleteId` | Keys may remain; `projectCompetitionCompeteView` only attaches overlays to topology rows |
| Coach local overlay store | `coachMatchBreakdownOverlayByLineage` | Orphan keys possible; no resurrection in projection |
| Parent Compete coach notes | Merged via `mergeCoachBreakdownIntoMatches` | Requires hydrated artifacts; stale shell `coachNote` logged as `readingStaleCompetitionShell` |

Overlays are **not** deleted automatically when parent removes a match (no tombstone sync observed in repo).

---

## Roster-level recovery

`reconcileCoachKidRosterFromWriterSessions`:

- When all writer sessions fetch successfully, local kids whose `sharedAthleteId` ∉ remote athlete union → `deleteKidPilot`.
- `deleteKidPilot` removes: competitions, training sessions for kid, weekly focus, standing guidance, and **coach aggregate + topology + training proof** for that `sharedAthleteId`.
- `archiveKidForCoachRoster` — soft archive; **keeps** competitions and sync fields on disk.

`clearKidSharedAthleteLink` — unlinks OAI from kid row; removes aggregate, topology, training proof, breakdown artifact set for that athlete id.

---

## Permanently lost data classes (no coach reconstruction from parent plane)

- Parent-owned match results/outcomes removed by parent delete (by design).
- Parent media files deleted with detail row (`bestEffortDeletePersistedMedia`).
- Worker session competition row after successful remote DELETE.
- Topology/aggregate content for competitions parent removed — not recoverable from coach-local stores alone; requires parent republish or new parent data.

Coach-only data (tactical notes, voice refs, local review video) may survive as orphan overlay keys but is **not** displayed without matching topology lineage.

---

## Recovery reconstruction possibilities

| Desired state | Required actions |
|-------------|------------------|
| Coach Summary metrics match parent | Parent publish aggregate → coach `refreshCoachWriterSessionsAndReconcileStores` → `writeCoachCompetitionAggregate` → `useSignals` overlay |
| Coach Compete match list match parent | Parent publish topology → coach reconcile → `peekCoachCompetitionTopology` hit → `projectCompetitionCompeteView` |
| Shell list match worker | `reconcileCoachLinkedCompetitionEntriesFromWriterSessions` |
| Clear stale coach caches for removed athlete | Roster prune or `removeCoachCompetitionAggregate/Topology` |
| Parent Compete shows coach notes | Session GET hydrates `coachMatchBreakdownArtifacts` → `setCachedWeeklyForLinkToken` → `bumpCoachSyncHydrationVersion` |

**No in-repo path** reconstructs parent canonical match rows on coach device from overlays alone.
