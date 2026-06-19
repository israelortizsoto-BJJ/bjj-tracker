import type { SyncedCompetitionTopology, SyncedCompetitionTopologyArtifact } from "../types/coachWeeklySync";

import {
  MAX_COMPETITIONS_PER_ATHLETE,
  MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION,
  TOPOLOGY_SNAPSHOT_CONTRACT_VERSION,
  type TopologyPeekOutcome,
  type TopologyProjectionSource,
  type TopologySnapshot,
  type TopologySnapshotAthleteDomain,
  type TopologySnapshotCompetition,
  type TopologySnapshotCaptureMode,
} from "./topologySnapshotContract";

export type TopologySnapshotCompetitionProbe = {
  sharedCompetitionId: string;
  competitionLineageKey: string;
  updatedAt: string;
  matchLineageKeys: string[];
  projectionSource: TopologyProjectionSource;
};

export type ProjectTopologySnapshotAthleteContext = {
  sharedAthleteId: string;
  memoryLoaded: boolean;
  peekOutcome: TopologyPeekOutcome;
  peekArtifact: SyncedCompetitionTopologyArtifact | null;
  diskArtifact: SyncedCompetitionTopologyArtifact | null;
  competitionProbes: TopologySnapshotCompetitionProbe[];
};

export type ProjectTopologySnapshotContext = {
  capturedAt?: string;
  syncConfigured: boolean;
  captureMode: TopologySnapshotCaptureMode;
  sourceTrigger?: string;
  athleteDomain: ProjectTopologySnapshotAthleteContext;
  additionalAthleteDomains?: ProjectTopologySnapshotAthleteContext[];
  visibleCompetitionIds?: string[];
};

function countMatches(artifact: SyncedCompetitionTopologyArtifact | null): number {
  if (!artifact) return 0;
  return artifact.competitions.reduce((sum, competition) => sum + competition.matches.length, 0);
}

function competitionCount(artifact: SyncedCompetitionTopologyArtifact | null): number {
  return artifact?.competitions.length ?? 0;
}

function sortedCappedLineageKeys(keys: readonly string[]): string[] {
  return [...keys]
    .map((key) => key.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION);
}

function competitionFromArtifacts(
  sharedCompetitionId: string,
  peekArtifact: SyncedCompetitionTopologyArtifact | null,
  diskArtifact: SyncedCompetitionTopologyArtifact | null,
): SyncedCompetitionTopology | null {
  const peekRow =
    peekArtifact?.competitions.find(
      (competition) => competition.sharedCompetitionId === sharedCompetitionId,
    ) ?? null;
  if (peekRow) return peekRow;
  return (
    diskArtifact?.competitions.find(
      (competition) => competition.sharedCompetitionId === sharedCompetitionId,
    ) ?? null
  );
}

function unionCompetitionIds(
  peekArtifact: SyncedCompetitionTopologyArtifact | null,
  diskArtifact: SyncedCompetitionTopologyArtifact | null,
): string[] {
  const ids = new Set<string>();
  for (const competition of peekArtifact?.competitions ?? []) {
    const id = competition.sharedCompetitionId.trim();
    if (id) ids.add(id);
  }
  for (const competition of diskArtifact?.competitions ?? []) {
    const id = competition.sharedCompetitionId.trim();
    if (id) ids.add(id);
  }
  return [...ids].sort((a, b) => a.localeCompare(b)).slice(0, MAX_COMPETITIONS_PER_ATHLETE);
}

function memoryDiskDiverged(
  peekArtifact: SyncedCompetitionTopologyArtifact | null,
  diskArtifact: SyncedCompetitionTopologyArtifact | null,
): boolean | undefined {
  if (!peekArtifact || !diskArtifact) return undefined;
  if (peekArtifact.updatedAt !== diskArtifact.updatedAt) return true;
  if (competitionCount(peekArtifact) !== competitionCount(diskArtifact)) return true;
  if (countMatches(peekArtifact) !== countMatches(diskArtifact)) return true;
  return false;
}

function projectCompetitionRow(
  probe: TopologySnapshotCompetitionProbe,
): TopologySnapshotCompetition {
  const matchLineageKeys = sortedCappedLineageKeys(probe.matchLineageKeys);
  return {
    sharedCompetitionId: probe.sharedCompetitionId,
    competitionLineageKey: probe.competitionLineageKey,
    updatedAt: probe.updatedAt,
    matchCount: matchLineageKeys.length,
    matchLineageKeys,
    projectionSource: probe.projectionSource,
  };
}

function projectAthleteDomain(ctx: ProjectTopologySnapshotAthleteContext): TopologySnapshotAthleteDomain {
  const peekArtifact = ctx.peekArtifact;
  const diskArtifact = ctx.diskArtifact;
  const unionIds = new Set([
    ...unionCompetitionIds(peekArtifact, diskArtifact),
    ...ctx.competitionProbes.map((probe) => probe.sharedCompetitionId),
  ]);
  const competitions: TopologySnapshotCompetition[] = [];

  for (const sharedCompetitionId of [...unionIds].sort((a, b) => a.localeCompare(b))) {
    const probe =
      ctx.competitionProbes.find((row) => row.sharedCompetitionId === sharedCompetitionId) ?? null;
    const substrate = competitionFromArtifacts(sharedCompetitionId, peekArtifact, diskArtifact);
    if (probe) {
      competitions.push(projectCompetitionRow(probe));
      continue;
    }
    if (!substrate) continue;
    const matchLineageKeys = sortedCappedLineageKeys(
      substrate.matches.map((match) => match.matchLineageKey),
    );
    competitions.push({
      sharedCompetitionId: substrate.sharedCompetitionId,
      competitionLineageKey: substrate.competitionLineageKey,
      updatedAt: substrate.updatedAt,
      matchCount: matchLineageKeys.length,
      matchLineageKeys,
      projectionSource: "fallback_missing_topology",
    });
  }

  const schemaVersion =
    peekArtifact?.schemaVersion === 1 || diskArtifact?.schemaVersion === 1 ? (1 as const) : undefined;
  const diverged = memoryDiskDiverged(peekArtifact, diskArtifact);

  return {
    sharedAthleteId: ctx.sharedAthleteId,
    memoryLoaded: ctx.memoryLoaded,
    peekOutcome: ctx.peekOutcome,
    peekArtifactUpdatedAt: peekArtifact?.updatedAt ?? null,
    diskPresent: diskArtifact !== null,
    diskArtifactUpdatedAt: diskArtifact?.updatedAt ?? null,
    peekCompetitionCount: competitionCount(peekArtifact),
    peekMatchCount: countMatches(peekArtifact),
    diskCompetitionCount: competitionCount(diskArtifact),
    diskMatchCount: countMatches(diskArtifact),
    competitions: competitions.slice(0, MAX_COMPETITIONS_PER_ATHLETE),
    ...(schemaVersion ? { schemaVersion } : {}),
    ...(diverged !== undefined ? { memoryDiskDiverged: diverged } : {}),
  };
}

/** Maps topology substrate probes to the frozen Tier 1 export contract. */
export function projectTopologySnapshot(ctx: ProjectTopologySnapshotContext): TopologySnapshot {
  const base: TopologySnapshot = {
    contractVersion: TOPOLOGY_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: ctx.capturedAt ?? new Date().toISOString(),
    deviceRole: "coach",
    syncConfigured: ctx.syncConfigured,
    captureMode: ctx.captureMode,
    athleteDomain: projectAthleteDomain(ctx.athleteDomain),
    ...(ctx.sourceTrigger ? { sourceTrigger: ctx.sourceTrigger } : {}),
    ...(ctx.visibleCompetitionIds && ctx.visibleCompetitionIds.length > 0
      ? { visibleCompetitionIds: ctx.visibleCompetitionIds }
      : {}),
  };

  if (!ctx.additionalAthleteDomains || ctx.additionalAthleteDomains.length === 0) {
    return base;
  }

  return {
    ...base,
    additionalAthleteDomains: ctx.additionalAthleteDomains.map(projectAthleteDomain),
  };
}
