import type {
  CompetitionStateSnapshot,
  ParentCanonicalSnapshot,
  ParentPublishSnapshot,
  WorkerPersistSnapshot,
} from "./competitionStateAuditorContract";
import {
  pickBestParentPublishSnapshot,
  pickLatestWorkerPersistSnapshot,
} from "./diffCompetitionBoundarySnapshots";

function latestCanonicalForAthlete(
  snapshots: readonly CompetitionStateSnapshot[],
  sharedAthleteId: string,
  transitionId: string | null,
): ParentCanonicalSnapshot | null {
  const sid = sharedAthleteId.trim();
  const matches = snapshots.filter(
    (snapshot): snapshot is ParentCanonicalSnapshot =>
      snapshot.snapshotKind === "parent_canonical" &&
      snapshot.sharedAthleteId === sid &&
      (!transitionId || snapshot.transitionId === transitionId),
  );
  return matches.length > 0 ? matches[matches.length - 1]! : null;
}

export function selectPhaseABoundarySnapshots(input: {
  snapshots: readonly CompetitionStateSnapshot[];
  sharedAthleteId: string;
  transitionId: string | null;
}): {
  s1: ParentCanonicalSnapshot | null;
  s2: ParentPublishSnapshot | null;
  s3: WorkerPersistSnapshot | null;
} {
  const sharedAthleteId = input.sharedAthleteId.trim();
  const transitionId = input.transitionId?.trim() || null;
  if (!sharedAthleteId) {
    return { s1: null, s2: null, s3: null };
  }

  const s1 = latestCanonicalForAthlete(input.snapshots, sharedAthleteId, transitionId);
  const resolvedTransitionId = transitionId ?? s1?.transitionId ?? null;
  if (!resolvedTransitionId) {
    return { s1, s2: null, s3: null };
  }

  const publish = pickBestParentPublishSnapshot(input.snapshots, resolvedTransitionId);
  const worker = pickLatestWorkerPersistSnapshot(input.snapshots, resolvedTransitionId);

  return {
    s1,
    s2: publish?.snapshotKind === "parent_publish" ? publish : null,
    s3: worker?.snapshotKind === "worker_persist" ? worker : null,
  };
}
