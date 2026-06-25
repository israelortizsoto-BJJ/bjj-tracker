import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  type CompetitionBoundaryDiff,
  type CompetitionBoundaryLayer,
  type CompetitionDomainBlock,
  type CompetitionStateSnapshot,
  type CompetitionStateSnapshotKind,
} from "./competitionStateAuditorContract";

function domainFromSnapshot(snapshot: CompetitionStateSnapshot): CompetitionDomainBlock {
  return snapshot.domain;
}

function endpoint(
  snapshot: CompetitionStateSnapshot,
): CompetitionBoundaryDiff["upstream"] {
  const domain = domainFromSnapshot(snapshot);
  return {
    snapshotKind: snapshot.snapshotKind,
    transitionId: snapshot.transitionId,
    competitionCount: domain.competitionCount,
    sharedCompetitionIds: domain.sharedCompetitionIds,
  };
}

export function diffCompetitionBoundarySnapshots(input: {
  layer: CompetitionBoundaryLayer;
  upstream: CompetitionStateSnapshot;
  downstream: CompetitionStateSnapshot;
  comparedAt?: string;
}): CompetitionBoundaryDiff {
  const upstreamDomain = domainFromSnapshot(input.upstream);
  const downstreamDomain = domainFromSnapshot(input.downstream);
  const upstreamSet = new Set(upstreamDomain.sharedCompetitionIds);
  const downstreamSet = new Set(downstreamDomain.sharedCompetitionIds);

  const missingIds = upstreamDomain.sharedCompetitionIds.filter((id) => !downstreamSet.has(id));
  const extraIds = downstreamDomain.sharedCompetitionIds.filter((id) => !upstreamSet.has(id));

  const matchCountDeltas: CompetitionBoundaryDiff["firstDivergence"] extends infer T
    ? T extends { matchCountDeltas: infer M }
      ? M
      : never
    : never = [];

  for (const id of uniqueUnion(upstreamDomain.sharedCompetitionIds, downstreamDomain.sharedCompetitionIds)) {
    const upstreamRow = upstreamDomain.perCompetition.find((row) => row.sharedCompetitionId === id);
    const downstreamRow = downstreamDomain.perCompetition.find((row) => row.sharedCompetitionId === id);
    const upstreamCount = upstreamRow?.matchCount ?? 0;
    const downstreamCount = downstreamRow?.matchCount ?? 0;
    if (upstreamCount !== downstreamCount) {
      matchCountDeltas.push({
        sharedCompetitionId: id,
        upstream: upstreamCount,
        downstream: downstreamCount,
      });
    }
  }

  const hasDivergence =
    missingIds.length > 0 ||
    extraIds.length > 0 ||
    upstreamDomain.competitionCount !== downstreamDomain.competitionCount ||
    matchCountDeltas.length > 0;

  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    comparedAt: input.comparedAt ?? new Date().toISOString(),
    layer: input.layer,
    transitionId: input.upstream.transitionId,
    sharedAthleteId: input.upstream.sharedAthleteId,
    upstream: endpoint(input.upstream),
    downstream: endpoint(input.downstream),
    firstDivergence: hasDivergence
      ? {
          missingIds,
          extraIds,
          matchCountDeltas,
        }
      : null,
  };
}

function uniqueUnion(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b));
}

export function pickBestParentPublishSnapshot(
  snapshots: readonly CompetitionStateSnapshot[],
  transitionId: string,
): CompetitionStateSnapshot | null {
  const candidates = snapshots.filter(
    (snapshot): snapshot is Extract<CompetitionStateSnapshot, { snapshotKind: "parent_publish" }> =>
      snapshot.snapshotKind === "parent_publish" &&
      snapshot.transitionId === transitionId &&
      snapshot.publishOutcome === "ok",
  );
  if (candidates.length === 0) return null;

  const lanePriority: Record<string, number> = {
    topology_put: 3,
    aggregate_put: 2,
    shell_post: 1,
    shell_put: 1,
    shell_delete: 0,
  };

  return [...candidates].sort((a, b) => {
    const laneDelta = (lanePriority[b.publishLane] ?? 0) - (lanePriority[a.publishLane] ?? 0);
    if (laneDelta !== 0) return laneDelta;
    return b.domain.competitionCount - a.domain.competitionCount;
  })[0]!;
}

export function pickLatestWorkerPersistSnapshot(
  snapshots: readonly CompetitionStateSnapshot[],
  transitionId: string,
): CompetitionStateSnapshot | null {
  const candidates = snapshots.filter(
    (snapshot): snapshot is Extract<CompetitionStateSnapshot, { snapshotKind: "worker_persist" }> =>
      snapshot.snapshotKind === "worker_persist" &&
      (snapshot.transitionId === transitionId || snapshot.parentTransitionId === transitionId),
  );
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1]!;
}

export function snapshotKindLabel(kind: CompetitionStateSnapshotKind): string {
  return kind;
}
