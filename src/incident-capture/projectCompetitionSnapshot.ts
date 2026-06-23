import type { CompetitionDetailMatchSnapshot } from "../storage/competitionStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../types/coachWeeklySync";
import {
  mergeCoachBreakdownIntoMatches,
  overlayAnnotationsFromCoachMatchBreakdownArtifactSet,
} from "../domain/competition/mergeCoachBreakdownIntoMatches";

import {
  COMPETITION_SNAPSHOT_CONTRACT_VERSION,
  type CompetitionSnapshot,
  type CompetitionSnapshotCompetition,
  type CompetitionSnapshotFailureLayer,
} from "./competitionSnapshotContract";

export type CompetitionSnapshotCompetitionInput = {
  sharedCompetitionId: string;
  entryId: string;
  matches: readonly CompetitionDetailMatchSnapshot[];
};

export type ProjectCompetitionSnapshotContext = {
  capturedAt?: string;
  deviceRole: "parent" | "coach";
  sharedAthleteId: string;
  competitions: readonly CompetitionSnapshotCompetitionInput[];
  artifactSet: SyncedCoachMatchBreakdownArtifactSet | null;
};

function trimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map(trimmed).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function rejectReasonsForCompetition(input: {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  entryMatchIds: readonly string[];
  artifactSet: SyncedCoachMatchBreakdownArtifactSet | null;
}): string[] {
  const reasons = new Set<string>();
  const sharedAthleteId = trimmed(input.sharedAthleteId);
  const sharedCompetitionId = trimmed(input.sharedCompetitionId);
  const entryMatchIds = new Set(input.entryMatchIds.map(trimmed).filter(Boolean));

  if (!input.artifactSet) return [];
  if (trimmed(input.artifactSet.sharedAthleteId) !== sharedAthleteId) {
    reasons.add("artifact_set_athlete_mismatch");
    return [...reasons].sort();
  }
  if (!sharedAthleteId) reasons.add("empty_sharedAthleteId");
  if (!sharedCompetitionId) reasons.add("empty_sharedCompetitionId");
  if (entryMatchIds.size === 0) reasons.add("empty_match_lineage_keys");

  for (const artifact of input.artifactSet.artifacts) {
    const artifactAthleteId = trimmed(artifact.sharedAthleteId);
    const artifactCompetitionId = trimmed(artifact.sharedCompetitionId);
    const artifactLineageKey = trimmed(artifact.matchLineageKey);
    const hasCoachNote = Boolean(trimmed(artifact.coachNote));

    if (artifactAthleteId !== sharedAthleteId) reasons.add("athlete_mismatch");
    else if (artifactCompetitionId !== sharedCompetitionId) reasons.add("competition_mismatch");
    else if (!entryMatchIds.has(artifactLineageKey)) reasons.add("lineage_key_not_in_match_set");
    else if (!hasCoachNote) reasons.add("empty_coach_note");
  }

  return [...reasons].sort((a, b) => a.localeCompare(b));
}

function projectCompetitionRow(input: {
  sharedAthleteId: string;
  competition: CompetitionSnapshotCompetitionInput;
  artifactSet: SyncedCoachMatchBreakdownArtifactSet | null;
}): CompetitionSnapshotCompetition {
  const sharedAthleteId = trimmed(input.sharedAthleteId);
  const sharedCompetitionId = trimmed(input.competition.sharedCompetitionId);
  const entryMatchIds = input.competition.matches.map((match) => trimmed(match.id)).filter(Boolean);
  const artifacts = input.artifactSet?.artifacts ?? [];
  const localArtifactsForCompetition = artifacts.filter(
    (artifact) =>
      trimmed(artifact.sharedAthleteId) === sharedAthleteId &&
      trimmed(artifact.sharedCompetitionId) === sharedCompetitionId,
  );
  const localArtifactLineageKeys = uniqueSorted(
    localArtifactsForCompetition.map((artifact) => artifact.matchLineageKey),
  );

  const overlayAnnotations = overlayAnnotationsFromCoachMatchBreakdownArtifactSet({
    artifactSet: input.artifactSet,
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKeys: entryMatchIds,
  });
  const acceptedLineageKeys = uniqueSorted(
    overlayAnnotations.map((annotation) => annotation.matchLineageKey),
  );
  const acceptedSet = new Set(acceptedLineageKeys);
  const projectedMatches = mergeCoachBreakdownIntoMatches({
    matches: input.competition.matches,
    overlayAnnotations,
    sharedAthleteId,
    sharedCompetitionId,
  });
  const projectedCoachNoteIds = new Set(
    projectedMatches
      .filter((match) => Boolean(trimmed(match.coachNote)))
      .map((match) => trimmed(match.id))
      .filter(Boolean),
  );
  const mergeMatchedLineageKeys = uniqueSorted(
    projectedMatches
      .map((match) => trimmed(match.id))
      .filter((id) => acceptedSet.has(id) && projectedCoachNoteIds.has(id)),
  );
  const projectedCoachNoteCount = projectedCoachNoteIds.size;
  const annotationRejectReasons = rejectReasonsForCompetition({
    sharedAthleteId,
    sharedCompetitionId,
    entryMatchIds,
    artifactSet: input.artifactSet,
  });
  const annotationRejectedCount = Math.max(
    0,
    localArtifactsForCompetition.length - acceptedLineageKeys.length,
  );

  let firstFailureLayer: CompetitionSnapshotFailureLayer = "none_detected";
  if (!input.artifactSet || localArtifactsForCompetition.length === 0) {
    firstFailureLayer = "local_artifact_missing";
  } else if (acceptedLineageKeys.length === 0) {
    firstFailureLayer = "annotation_rejected";
  } else if (mergeMatchedLineageKeys.length === 0) {
    firstFailureLayer = "merge_exact_id_mismatch";
  } else if (projectedCoachNoteCount === 0) {
    firstFailureLayer = "render_projection_missing";
  }

  return {
    sharedCompetitionId,
    entryId: trimmed(input.competition.entryId),
    entryMatchCount: input.competition.matches.length,
    entryMatchIds,
    localArtifactSetPresent: Boolean(input.artifactSet),
    localArtifactCount: localArtifactsForCompetition.length,
    localArtifactLineageKeys,
    annotationAcceptedCount: acceptedLineageKeys.length,
    annotationAcceptedLineageKeys: acceptedLineageKeys,
    annotationRejectedCount,
    annotationRejectReasons,
    mergeMatchedCount: mergeMatchedLineageKeys.length,
    mergeMatchedLineageKeys,
    projectedCoachNoteCount,
    firstFailureLayer,
  };
}

export function projectCompetitionSnapshot(
  ctx: ProjectCompetitionSnapshotContext,
): CompetitionSnapshot {
  const sharedAthleteId = trimmed(ctx.sharedAthleteId);
  const competitions = ctx.competitions.map((competition) =>
    projectCompetitionRow({
      sharedAthleteId,
      competition,
      artifactSet: ctx.artifactSet,
    }),
  );

  return {
    contractVersion: COMPETITION_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: ctx.capturedAt ?? new Date().toISOString(),
    deviceRole: ctx.deviceRole,
    sharedAthleteId,
    visibleCompetitionCount: competitions.length,
    competitions,
  };
}
