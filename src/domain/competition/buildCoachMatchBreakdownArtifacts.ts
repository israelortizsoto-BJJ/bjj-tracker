import { listCoachMatchBreakdownOverlaysForAthlete } from "../../storage/coachMatchBreakdownOverlayStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../../types/coachWeeklySync";

export async function buildCoachMatchBreakdownArtifacts(
  sharedAthleteId: string,
  options?: { updatedAtOverride?: string | null; traceId?: string | null },
): Promise<SyncedCoachMatchBreakdownArtifactSet> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) {
    throw new Error("Cannot build coach match breakdown artifacts without sharedAthleteId.");
  }

  const traceId = options?.traceId?.trim() || null;
  const overlays = await listCoachMatchBreakdownOverlaysForAthlete(athleteId, traceId);
  console.log("[OVERLAY_FORENSIC]", {
    stage: "artifact_build_input",
    traceId,
    timestamp: new Date().toISOString(),
    sourceFile: "buildCoachMatchBreakdownArtifacts.ts",
    sharedAthleteId: athleteId,
    overlayCount: overlays.length,
    overlays: overlays.map((overlay) => ({
      sharedAthleteId: overlay.sharedAthleteId.trim(),
      sharedCompetitionId: overlay.sharedCompetitionId.trim(),
      matchLineageKey: overlay.matchLineageKey.trim(),
      coachNotePresent: Boolean(overlay.coachNote?.trim()),
    })),
  });
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
  console.log("[OVERLAY_FORENSIC]", {
    stage: "artifact_build_output",
    traceId,
    timestamp: new Date().toISOString(),
    sourceFile: "buildCoachMatchBreakdownArtifacts.ts",
    sharedAthleteId: athleteId,
    sharedCompetitionId: artifacts[0]?.sharedCompetitionId ?? null,
    matchLineageKey: artifacts[0]?.matchLineageKey ?? null,
    artifactCount: artifacts.length,
    artifacts: artifacts.map((artifact) => ({
      sharedAthleteId: artifact.sharedAthleteId,
      sharedCompetitionId: artifact.sharedCompetitionId,
      matchLineageKey: artifact.matchLineageKey,
    })),
  });

  const updatedAt =
    options?.updatedAtOverride?.trim() ||
    (artifacts.reduce<string | null>(
      (latest, artifact) =>
        latest === null || artifact.updatedAt.localeCompare(latest) > 0 ? artifact.updatedAt : latest,
      null,
    ) ?? new Date().toISOString());

  const artifactSet: SyncedCoachMatchBreakdownArtifactSet = {
    schemaVersion: 1,
    sharedAthleteId: athleteId,
    updatedAt,
    artifacts,
  };

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "coach_publish_build",
    sharedAthleteId: athleteId,
    sharedCompetitionId: artifacts[0]?.sharedCompetitionId ?? null,
    matchLineageKey: artifacts[0]?.matchLineageKey ?? null,
    overlayCount: artifacts.length,
    artifacts: artifacts.map((artifact) => ({
      sharedAthleteId: artifact.sharedAthleteId,
      sharedCompetitionId: artifact.sharedCompetitionId,
      matchLineageKey: artifact.matchLineageKey,
      hasCoachNote: Boolean(artifact.coachNote?.trim()),
    })),
  });

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
