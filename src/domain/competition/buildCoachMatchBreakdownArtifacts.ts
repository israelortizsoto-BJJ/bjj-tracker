import { listCoachMatchBreakdownOverlaysForAthlete } from "../../storage/coachMatchBreakdownOverlayStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../../types/coachWeeklySync";

export async function buildCoachMatchBreakdownArtifacts(
  sharedAthleteId: string,
): Promise<SyncedCoachMatchBreakdownArtifactSet> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) {
    throw new Error("Cannot build coach match breakdown artifacts without sharedAthleteId.");
  }

  const overlays = await listCoachMatchBreakdownOverlaysForAthlete(athleteId);
  const artifacts = overlays
    .map((overlay) => ({
      sharedAthleteId: overlay.sharedAthleteId.trim(),
      sharedCompetitionId: overlay.sharedCompetitionId.trim(),
      matchLineageKey: overlay.matchLineageKey.trim(),
      ...(overlay.coachNote?.trim() ? { coachNote: overlay.coachNote.trim() } : {}),
      updatedAt: overlay.updatedAt,
    }))
    .filter(
      (artifact) =>
        artifact.sharedAthleteId &&
        artifact.sharedCompetitionId &&
        artifact.matchLineageKey &&
        artifact.coachNote,
    )
    .sort(
      (a, b) =>
        a.sharedCompetitionId.localeCompare(b.sharedCompetitionId) ||
        a.matchLineageKey.localeCompare(b.matchLineageKey),
    );

  const updatedAt =
    artifacts.reduce<string | null>(
      (latest, artifact) =>
        latest === null || artifact.updatedAt.localeCompare(latest) > 0 ? artifact.updatedAt : latest,
      null,
    ) ?? new Date().toISOString();

  const artifactSet: SyncedCoachMatchBreakdownArtifactSet = {
    schemaVersion: 1,
    sharedAthleteId: athleteId,
    updatedAt,
    artifacts,
  };

  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "coach_overlay_artifacts_built",
    sharedAthleteId: athleteId,
    artifactCount: artifacts.length,
    sharedCompetitionIds: [...new Set(artifacts.map((artifact) => artifact.sharedCompetitionId))],
    lineageIds: artifacts.map((artifact) => artifact.matchLineageKey),
    updatedAt,
  });

  return artifactSet;
}
