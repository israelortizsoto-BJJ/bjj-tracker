import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../../types/coachWeeklySync";
import type { CompetitionMatchOverlayAnnotation } from "./projectCompetitionCompeteView";

export function overlayAnnotationsFromCoachMatchBreakdownArtifactSet(input: {
  artifactSet: SyncedCoachMatchBreakdownArtifactSet | null;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKeys: readonly string[];
}): CompetitionMatchOverlayAnnotation[] {
  const sharedAthleteId = input.sharedAthleteId.trim();
  const sharedCompetitionId = input.sharedCompetitionId.trim();
  const lineageKeys = new Set(input.matchLineageKeys.map((key) => key.trim()).filter(Boolean));
  if (
    !input.artifactSet ||
    input.artifactSet.sharedAthleteId.trim() !== sharedAthleteId ||
    !sharedAthleteId ||
    !sharedCompetitionId ||
    lineageKeys.size === 0
  ) {
    return [];
  }
  return input.artifactSet.artifacts
    .filter(
      (artifact) =>
        artifact.sharedAthleteId.trim() === sharedAthleteId &&
        artifact.sharedCompetitionId.trim() === sharedCompetitionId &&
        lineageKeys.has(artifact.matchLineageKey.trim()) &&
        Boolean(artifact.coachNote?.trim()),
    )
    .map((artifact) => ({
      matchLineageKey: artifact.matchLineageKey.trim(),
      coachNote: artifact.coachNote?.trim(),
    }));
}

export function mergeCoachBreakdownIntoMatches(input: {
  matches: readonly CompetitionDetailMatchSnapshot[];
  overlayAnnotations: readonly CompetitionMatchOverlayAnnotation[];
  sharedAthleteId: string;
  sharedCompetitionId: string;
}): CompetitionDetailMatchSnapshot[] {
  const overlaysByLineageKey = new Map<string, CompetitionMatchOverlayAnnotation>();
  for (const annotation of input.overlayAnnotations) {
    const key = annotation.matchLineageKey.trim();
    if (key && annotation.coachNote?.trim()) overlaysByLineageKey.set(key, annotation);
  }

  let mergeCount = 0;
  const matches = input.matches.map((match) => {
    const overlay = overlaysByLineageKey.get(match.id.trim());
    const coachNote = overlay?.coachNote?.trim();
    if (!coachNote) return match;
    mergeCount += 1;
    return { ...match, coachNote };
  });

  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "parent_overlay_merge_complete",
    sharedAthleteId: input.sharedAthleteId || null,
    sharedCompetitionId: input.sharedCompetitionId || null,
    artifactCount: overlaysByLineageKey.size,
    mergeCount,
    parentRenderCount: matches.filter((match) => (match.coachNote ?? "").trim().length > 0).length,
    lineageIds: matches.map((match) => match.id),
  });

  return matches;
}
