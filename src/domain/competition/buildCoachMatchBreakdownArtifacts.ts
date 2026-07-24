import { logCoachMediaCorridorTrace } from "../../dev/coachMediaCorridorTrace";
import { logMatchBreakdownAuthorityTrace } from "../../dev/matchBreakdownAuthorityTrace";
import { listCoachMatchBreakdownOverlaysForAthlete } from "../../storage/coachMatchBreakdownOverlayStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../../types/coachWeeklySync";
import { extractCoachCommentaryMediaMetadata } from "./extractCoachCommentaryMediaMetadata";

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
  const coachNoteCount = overlays.filter((overlay) => Boolean(overlay.coachNote?.trim())).length;
  const analysisCount = overlays.filter((overlay) => Boolean(overlay.analysis?.trim())).length;
  const reflectionCount = overlays.filter((overlay) =>
    Boolean(overlay.dictatedReflection?.trim()),
  ).length;
  logMatchBreakdownAuthorityTrace("ARTIFACT_BUILDER_INPUT", {
    traceId,
    sharedAthleteId: athleteId,
    sharedCompetitionId: overlays[0]?.sharedCompetitionId.trim() ?? null,
    matchLineageKey: overlays[0]?.matchLineageKey.trim() ?? null,
    overlayCount: overlays.length,
    coachNoteCount,
    analysisCount,
    reflectionCount,
  });
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
    .map((overlay) => {
      const media = extractCoachCommentaryMediaMetadata(overlay);
      return {
        sharedAthleteId: overlay.sharedAthleteId.trim(),
        sharedCompetitionId: overlay.sharedCompetitionId.trim(),
        matchLineageKey: overlay.matchLineageKey.trim(),
        ...(overlay.coachNote?.trim() ? { coachNote: overlay.coachNote.trim() } : {}),
        ...(media
          ? {
              mediaId: media.mediaId,
              ...(media.durationMs !== undefined ? { durationMs: media.durationMs } : {}),
              ...(media.mimeType ? { mimeType: media.mimeType } : {}),
              ...(media.alignment ? { alignment: media.alignment } : {}),
            }
          : {}),
        updatedAt: overlay.updatedAt,
      };
    })
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
  const droppedBecauseNoCoachNote = overlays.filter(
    (overlay) => !overlay.coachNote?.trim(),
  ).length;
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
      hasMediaId: Boolean(artifact.mediaId),
    })),
  });
  for (const artifact of artifacts) {
    const artifactMediaId = artifact.mediaId?.trim() || null;
    logCoachMediaCorridorTrace("ARTIFACT_BUILT", {
      traceId,
      sharedAthleteId: artifact.sharedAthleteId,
      sharedCompetitionId: artifact.sharedCompetitionId,
      matchLineageKey: artifact.matchLineageKey,
      hasMediaId: Boolean(artifactMediaId),
      mediaId: artifactMediaId,
    });
  }

  const updatedAt =
    options?.updatedAtOverride?.trim() ||
    (artifacts.reduce<string | null>(
      (latest, artifact) =>
        latest === null || artifact.updatedAt.localeCompare(latest) > 0 ? artifact.updatedAt : latest,
      null,
    ) ?? new Date().toISOString());

  const artifactSet: SyncedCoachMatchBreakdownArtifactSet = {
    // v1 remains the wire shape for unaligned commentary. v2 is emitted only when
    // the complete immutable alignment unit is present.
    schemaVersion: artifacts.some((artifact) => artifact.alignment) ? 2 : 1,
    sharedAthleteId: athleteId,
    updatedAt,
    artifacts,
  };

  logMatchBreakdownAuthorityTrace("ARTIFACT_BUILDER_OUTPUT", {
    traceId,
    sharedAthleteId: athleteId,
    sharedCompetitionId: artifacts[0]?.sharedCompetitionId ?? null,
    matchLineageKey: artifacts[0]?.matchLineageKey ?? null,
    artifactCount: artifacts.length,
    droppedBecauseNoCoachNote,
    artifactSetUpdatedAt: updatedAt,
  });

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
      hasMediaId: Boolean(artifact.mediaId),
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
