import type { CompetitionMatchOverlayAnnotation } from "./projectCompetitionCompeteView";
import { extractCoachCommentaryMediaMetadata } from "./extractCoachCommentaryMediaMetadata";
import { readMatchBreakdownOverlay } from "./readMatchBreakdownOverlay";

/** Read-only overlay materialization for ephemeral competition projections. */
export async function hydrateCompetitionMatchOverlayAnnotations(input: {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKeys: readonly string[];
}): Promise<CompetitionMatchOverlayAnnotation[]> {
  const sharedAthleteId = input.sharedAthleteId.trim();
  const sharedCompetitionId = input.sharedCompetitionId.trim();
  const matchLineageKeys = [...new Set(input.matchLineageKeys.map((key) => key.trim()))].filter(
    Boolean,
  );
  if (!sharedAthleteId || !sharedCompetitionId || matchLineageKeys.length === 0) {
    console.log("[COACH_OVERLAY_SYNC_TRACE]", {
      stage: "overlay_hydrate_local_store_skipped",
      sharedAthleteId: sharedAthleteId || null,
      sharedCompetitionId: sharedCompetitionId || null,
      lineageIds: matchLineageKeys,
      hydrateCount: 0,
      reason: !sharedAthleteId
        ? "missing_sharedAthleteId"
        : !sharedCompetitionId
          ? "missing_sharedCompetitionId"
          : "missing_lineage_ids",
    });
    return [];
  }

  const canonicalMatchLineageKeys = new Set(matchLineageKeys);
  const overlays = await Promise.all(
    matchLineageKeys.map((matchLineageKey) =>
      readMatchBreakdownOverlay(
        { sharedAthleteId, sharedCompetitionId, matchLineageKey },
        { canonicalMatchLineageKeys },
      ),
    ),
  );
  const hydrated = overlays
    .filter((overlay): overlay is NonNullable<typeof overlay> => overlay !== null)
    .map((overlay): CompetitionMatchOverlayAnnotation => {
      const media = extractCoachCommentaryMediaMetadata(overlay);
      return {
        matchLineageKey: overlay.matchLineageKey,
        ...(overlay.coachNote?.trim() ? { coachNote: overlay.coachNote.trim() } : {}),
        ...(overlay.voiceNoteRefs?.length ? { voiceNoteRefs: overlay.voiceNoteRefs } : {}),
        ...(media
          ? {
              mediaId: media.mediaId,
              ...(media.durationMs !== undefined ? { durationMs: media.durationMs } : {}),
              ...(media.mimeType ? { mimeType: media.mimeType } : {}),
            }
          : {}),
      };
    });
  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "overlay_hydrate_local_store_complete",
    sharedAthleteId,
    sharedCompetitionId,
    lineageIds: matchLineageKeys,
    hydrateCount: hydrated.length,
    artifactCount: hydrated.length,
  });
  return hydrated;
}
