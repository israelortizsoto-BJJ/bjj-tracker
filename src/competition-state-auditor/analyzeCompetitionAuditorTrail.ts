import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  type CompetitionAuditorTrailAnalysis,
  type CompetitionBoundaryLayer,
  type CompetitionStateSnapshot,
} from "./competitionStateAuditorContract";
import { loadCompetitionStateAuditorRing } from "./competitionStateAuditorRing";
import {
  diffCompetitionBoundarySnapshots,
  pickBestParentPublishSnapshot,
  pickLatestWorkerPersistSnapshot,
} from "./diffCompetitionBoundarySnapshots";

function latestCanonicalForAthlete(
  snapshots: readonly CompetitionStateSnapshot[],
  sharedAthleteId: string,
): CompetitionStateSnapshot | null {
  const sid = sharedAthleteId.trim();
  const matches = snapshots.filter(
    (snapshot) =>
      snapshot.snapshotKind === "parent_canonical" && snapshot.sharedAthleteId === sid,
  );
  return matches.length > 0 ? matches[matches.length - 1]! : null;
}

function resolveTransitionId(
  canonical: CompetitionStateSnapshot | null,
  explicit?: string,
): string | null {
  if (explicit?.trim()) return explicit.trim();
  return canonical?.transitionId ?? null;
}

export function analyzeCompetitionAuditorSnapshots(input: {
  snapshots: readonly CompetitionStateSnapshot[];
  sharedAthleteId: string;
  transitionId?: string;
  analyzedAt?: string;
  expectedCount?: number;
}): CompetitionAuditorTrailAnalysis {
  const sharedAthleteId = input.sharedAthleteId.trim();
  const canonical = latestCanonicalForAthlete(input.snapshots, sharedAthleteId);
  const transitionId = resolveTransitionId(canonical, input.transitionId);
  const expectedCount = input.expectedCount ?? 5;

  const insufficient: CompetitionAuditorTrailAnalysis = {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
    sharedAthleteId,
    transitionId,
    parentCanonicalCount: canonical?.domain.competitionCount ?? null,
    parentPublishedCount: null,
    workerPersistedCount: null,
    parentContainedFive: canonical ? canonical.domain.competitionCount === expectedCount : null,
    parentPublishedFive: null,
    workerPersistedFive: null,
    firstDivergingBoundary: "insufficient_evidence",
    diffs: [],
  };

  if (!canonical || !transitionId) return insufficient;

  const publish = pickBestParentPublishSnapshot(input.snapshots, transitionId);
  const worker = pickLatestWorkerPersistSnapshot(input.snapshots, transitionId);

  const diffs = [];
  let firstDivergingBoundary: CompetitionBoundaryLayer | "none" | "insufficient_evidence" =
    "insufficient_evidence";

  if (publish) {
    const publishDiff = diffCompetitionBoundarySnapshots({
      layer: "parent_canonical→parent_publish",
      upstream: canonical,
      downstream: publish,
      comparedAt: input.analyzedAt,
    });
    diffs.push(publishDiff);
    if (publishDiff.firstDivergence) {
      firstDivergingBoundary = "parent_canonical→parent_publish";
    }
  }

  if (publish && worker) {
    const workerDiff = diffCompetitionBoundarySnapshots({
      layer: "parent_publish→worker_persist",
      upstream: publish,
      downstream: worker,
      comparedAt: input.analyzedAt,
    });
    diffs.push(workerDiff);
    if (workerDiff.firstDivergence && firstDivergingBoundary === "insufficient_evidence") {
      firstDivergingBoundary = "parent_publish→worker_persist";
    }
  } else if (!publish && worker) {
    const workerDiff = diffCompetitionBoundarySnapshots({
      layer: "parent_canonical→parent_publish",
      upstream: canonical,
      downstream: worker,
      comparedAt: input.analyzedAt,
    });
    diffs.push(workerDiff);
    if (workerDiff.firstDivergence) {
      firstDivergingBoundary = "parent_canonical→parent_publish";
    }
  }

  if (diffs.length > 0 && diffs.every((diff) => !diff.firstDivergence)) {
    firstDivergingBoundary = "none";
  }

  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
    sharedAthleteId,
    transitionId,
    parentCanonicalCount: canonical.domain.competitionCount,
    parentPublishedCount: publish?.domain.competitionCount ?? null,
    workerPersistedCount: worker?.domain.competitionCount ?? null,
    parentContainedFive: canonical.domain.competitionCount === expectedCount,
    parentPublishedFive: publish ? publish.domain.competitionCount === expectedCount : null,
    workerPersistedFive: worker ? worker.domain.competitionCount === expectedCount : null,
    firstDivergingBoundary,
    diffs,
  };
}

export async function analyzeCompetitionAuditorTrail(input: {
  sharedAthleteId: string;
  transitionId?: string;
  expectedCount?: number;
}): Promise<CompetitionAuditorTrailAnalysis> {
  const ring = await loadCompetitionStateAuditorRing();
  return analyzeCompetitionAuditorSnapshots({
    snapshots: ring.snapshots,
    sharedAthleteId: input.sharedAthleteId,
    transitionId: input.transitionId,
    expectedCount: input.expectedCount,
  });
}

export function formatCompetitionAuditorReadout(
  analysis: CompetitionAuditorTrailAnalysis,
): string {
  const lines = [
    `Competition State Auditor (contract v${analysis.contractVersion})`,
    `athlete=${analysis.sharedAthleteId}`,
    `transition=${analysis.transitionId ?? "none"}`,
    `parent_canonical_count=${analysis.parentCanonicalCount ?? "missing"}`,
    `parent_publish_count=${analysis.parentPublishedCount ?? "missing"}`,
    `worker_persist_count=${analysis.workerPersistedCount ?? "missing"}`,
    `parent_contained_five=${analysis.parentContainedFive ?? "unknown"}`,
    `parent_published_five=${analysis.parentPublishedFive ?? "unknown"}`,
    `worker_persisted_five=${analysis.workerPersistedFive ?? "unknown"}`,
    `first_diverging_boundary=${analysis.firstDivergingBoundary}`,
  ];

  for (const diff of analysis.diffs) {
    if (!diff.firstDivergence) {
      lines.push(`${diff.layer}: aligned (${diff.upstream.competitionCount} competitions)`);
      continue;
    }
    lines.push(
      `${diff.layer}: DIVERGED upstream=${diff.upstream.competitionCount} downstream=${diff.downstream.competitionCount}`,
    );
    if (diff.firstDivergence.missingIds.length > 0) {
      lines.push(`  missing_ids=${diff.firstDivergence.missingIds.join(",")}`);
    }
    if (diff.firstDivergence.extraIds.length > 0) {
      lines.push(`  extra_ids=${diff.firstDivergence.extraIds.join(",")}`);
    }
  }

  return lines.join("\n");
}
