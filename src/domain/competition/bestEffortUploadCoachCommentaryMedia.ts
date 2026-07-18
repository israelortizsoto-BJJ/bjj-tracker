import { listCoachMatchBreakdownOverlaysForAthlete } from "../../storage/coachMatchBreakdownOverlayStore";
import { upsertMatchBreakdownOverlay } from "./upsertMatchBreakdownOverlay";
import { coachSyncUploadCoachMedia } from "../../services/coachMediaApi";

/**
 * Best-effort upload of coach-local voice notes that lack a remote mediaId.
 * Failures never throw — transcript publish must proceed regardless.
 */
export async function bestEffortUploadCoachCommentaryMedia(input: {
  sharedAthleteId: string;
  linkToken: string;
  writerSecret: string;
  apiBaseUrl?: string | null;
  traceId?: string | null;
}): Promise<{ attempted: number; uploaded: number }> {
  const sharedAthleteId = input.sharedAthleteId.trim();
  if (!sharedAthleteId) return { attempted: 0, uploaded: 0 };

  const overlays = await listCoachMatchBreakdownOverlaysForAthlete(
    sharedAthleteId,
    input.traceId ?? null,
  );
  let attempted = 0;
  let uploaded = 0;

  for (const overlay of overlays) {
    if (!overlay.coachNote?.trim()) continue;
    const refs = overlay.voiceNoteRefs;
    if (!refs?.length) continue;
    const ref = refs[0];
    if (!ref?.localUri?.trim() || ref.mediaId?.trim()) continue;

    attempted += 1;
    try {
      const result = await coachSyncUploadCoachMedia(
        input.linkToken,
        input.writerSecret,
        ref.localUri,
        {
          mimeType: ref.mimeType ?? "audio/mp4",
          durationMs: ref.durationMs ?? null,
          apiBaseUrlOverride: input.apiBaseUrl,
        },
      );
      const nextRefs = [
        {
          ...ref,
          mediaId: result.mediaId,
          mimeType: result.mimeType || ref.mimeType,
          ...(result.durationMs !== undefined
            ? { durationMs: result.durationMs }
            : ref.durationMs !== undefined
              ? { durationMs: ref.durationMs }
              : {}),
        },
        ...refs.slice(1),
      ];
      await upsertMatchBreakdownOverlay({
        identity: {
          sharedAthleteId: overlay.sharedAthleteId,
          sharedCompetitionId: overlay.sharedCompetitionId,
          matchLineageKey: overlay.matchLineageKey,
        },
        patch: { voiceNoteRefs: nextRefs },
        traceId: input.traceId ?? null,
      });
      uploaded += 1;
      console.log("[COACH_MEDIA_TRACE]", {
        stage: "coach_media_upload_ok",
        sharedAthleteId,
        matchLineageKey: overlay.matchLineageKey,
        mediaId: result.mediaId,
        traceId: input.traceId ?? null,
      });
    } catch (error) {
      console.log("[COACH_MEDIA_TRACE]", {
        stage: "coach_media_upload_failed",
        sharedAthleteId,
        matchLineageKey: overlay.matchLineageKey,
        traceId: input.traceId ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { attempted, uploaded };
}
