# Sequence Diagrams v1

Mermaid diagrams grounded in current repo call paths. Participant names match modules/stores.

---

## Parent competition mutation flow

```mermaid
sequenceDiagram
  participant UI as Competition edit UI
  participant Sync as CompetitionSync
  participant Shell as kidCompetitionStore
  participant Detail as competitionStore
  participant Worker as coachWeeklySyncApi
  participant PubAgg as publishParentCompetitionAggregate
  participant PubTopo as publishParentCompetitionTopology
  participant BuildAgg as buildCompetitionAggregateArtifact
  participant BuildTopo as buildCompetitionTopologyArtifact

  UI->>Sync: save / delete
  Sync->>Shell: create/update/deleteKidCompetitionEntry
  Sync->>Detail: setCompetitionDetailForEntryId (parent only)
  Sync->>Worker: POST/PUT/DELETE session competition
  Sync->>PubAgg: schedulePublishParentCompetitionAggregate(sharedAthleteId)
  Sync->>PubTopo: schedulePublishParentCompetitionTopology(sharedAthleteId)
  PubAgg->>BuildAgg: getKidCompetitionEntriesWithMatchDetail + build
  PubAgg->>Worker: PUT competition-aggregate
  PubTopo->>BuildTopo: buildCompetitionTopologyArtifact
  PubTopo->>Worker: PUT competition-topology (if flag on)
  Detail-->>Shell: emitCompetitionChange
```

---

## Coach hydration flow

```mermaid
sequenceDiagram
  participant Trigger as Summary refresh / CoachRoster / buildAthleteAuthoritySnapshot
  participant Orch as refreshCoachWriterSessionsAndReconcileStores
  participant API as coachSyncFetchSession
  participant Cache as coachWeeklySyncCacheStore
  participant Roster as reconcileCoachKidRoster
  participant Shells as reconcileCoachLinkedCompetitionEntries
  participant Agg as reconcileCoachCompetitionAggregates
  participant Topo as reconcileCoachCompetitionTopology
  participant AggStore as coachCompetitionAggregateStore
  participant TopoStore as coachCompetitionTopologyStore
  participant Bump as bumpCoachSyncHydrationVersion

  Trigger->>Orch: invoke
  loop each writer link
    Orch->>API: GET session
    Orch->>Cache: setCachedWeeklyForLinkToken
  end
  Orch->>Roster: merge/prune roster
  Orch->>Shells: upsertSharedCompetitionsForKid
  Orch->>Agg: pickRemote + writeCoachCompetitionAggregate
  Agg->>AggStore: overwrite per athlete
  Orch->>Topo: pickRemote + writeCoachCompetitionTopology
  Topo->>TopoStore: overwrite per athlete
  TopoStore-->>Shell: emitCompetitionChange (on accept)
  Orch->>Bump: reconcile complete
```

---

## Summary render flow

```mermaid
sequenceDiagram
  participant Screen as SummaryScreen
  participant Athlete as useActiveAthlete
  participant Data as useAthleteData
  participant Canon as loadCanonicalAthleteCompetitionSlice
  participant Merge as competitionStore merge
  participant Sig as useSignals
  participant Compute as computeSignals
  participant AggStore as coachCompetitionAggregateStore
  participant Overlay as overlayCompetitionAggregateSignals
  participant VM as buildSummaryViewModel

  Screen->>Athlete: athleteId, linkedKidId
  Screen->>Data: useAthleteData (focus + hydrationVersion)
  Data->>Canon: load slice
  Canon->>Merge: getKidCompetitionEntriesWithMatchDetail*
  Merge-->>Data: competitions[]
  Screen->>Sig: useSignals({ sessions, competitions, athleteId })
  Sig->>Compute: computeSignals
  alt deviceRole coach
    Sig->>AggStore: peek/getCoachCompetitionAggregate
    Sig->>Overlay: overlayCompetitionAggregateSignals
    Overlay->>AggStore: peekCoachCompetitionTopology (competitionCount)
  end
  Screen->>VM: buildSummaryViewModel(signals)
```

---

## Compete render flow

```mermaid
sequenceDiagram
  participant Tab as compete.tsx
  participant Merge as getKidCompetitionEntriesWithMatchDetail*
  participant Ver as competitionVersion / hydrationVersion
  participant Card as CompetitionCard
  participant TopoStore as coachCompetitionTopologyStore
  participant Proj as projectCompetitionCompeteView
  participant Art as coachMatchBreakdownArtifactStore

  Tab->>Ver: subscribe
  Tab->>Merge: loadCompetitions (focus)
  Merge-->>Tab: entries with fallback matches
  Tab->>Card: render entry
  Card->>TopoStore: peekCoachCompetitionTopology
  Card->>Art: overlay annotations (async hydrate)
  alt deviceRole coach
    Card->>Proj: shell + topology + overlays + fallbackMatches
    Proj-->>Card: ephemeral projected matches
  else deviceRole parent
    Card->>Card: mergeCoachBreakdownIntoMatches
  end
```

---

## Topology projection flow

```mermaid
sequenceDiagram
  participant Parent as buildCompetitionTopologyArtifact
  participant Detail as competitionStore + kidCompetitionStore
  participant Worker as coachWeeklySyncApi
  participant Recon as reconcileCoachCompetitionTopology
  participant Store as coachCompetitionTopologyStore
  participant Peek as peekCoachCompetitionTopology
  participant Proj as projectCompetitionCompeteView

  Parent->>Detail: getKidCompetitionEntriesWithMatchDetailForSharedAthlete
  Parent->>Parent: buildCompetitionTopologyArtifactFromEntries
  Parent->>Worker: PUT SyncedCompetitionTopologyArtifact
  Recon->>Worker: read session.competitionTopologyByAthleteId
  Recon->>Store: writeCoachCompetitionTopology (newest wins)
  Store->>Store: emitCompetitionChange
  Peek->>Store: in-process topologyMemory
  Proj->>Peek: topology for sharedCompetitionId
  alt topology row found
    Proj->>Proj: snapshotFromTopologyMatch per ordinal
  else missing
    Proj->>Proj: return fallbackMatches
  end
```

---

## Aggregate overlay flow

```mermaid
sequenceDiagram
  participant Parent as buildCompetitionAggregateArtifact
  participant Detail as competitionStore merge
  participant Worker as coachWeeklySyncApi
  participant Recon as reconcileCoachCompetitionAggregates
  participant Store as coachCompetitionAggregateStore
  participant Sig as useSignals
  participant Compute as computeSignals
  participant Overlay as overlayCompetitionAggregateSignals
  participant UI as Summary competition cards

  Parent->>Detail: merged entries
  Parent->>Parent: build bounded artifact
  Parent->>Worker: PUT SyncedCompetitionAggregateArtifact
  Recon->>Worker: read session.competitionAggregateByAthleteId
  Recon->>Store: writeCoachCompetitionAggregate
  Store->>Store: emitCoachCompetitionAggregateChange
  Sig->>Compute: local competitions → base metrics
  Sig->>Store: get/peek aggregate
  alt hasBoundedAggregateVisibility
    Sig->>Overlay: overlayCompetitionAggregateSignals
    Overlay->>Store: peekCoachCompetitionTopology (optional competitionCount)
    Overlay-->>Sig: merged SignalOutput.competition metrics
  else missing or hidden
    Sig-->>UI: computeSignals metrics only
  end
  UI->>UI: render wins/losses/winRate from signals
```
