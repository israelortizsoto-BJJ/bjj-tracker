import type { CoachMatchBreakdownOverlay } from "../../types/coachMatchBreakdownOverlay";
import { normalizeCoachMatchBreakdownAlignment } from "../../types/coachWeeklySync";

/** Domain media metadata publishable on Match Breakdown artifacts (never URLs or localUri). */
export type CoachCommentaryMediaMetadata = {
  mediaId: string;
  durationMs?: number;
  mimeType?: string;
  alignment?: NonNullable<ReturnType<typeof normalizeCoachMatchBreakdownAlignment>>;
};

/**
 * Reads companion media metadata from a coach-local overlay.
 * Prefers the first voice note that already has a remote mediaId.
 */
export function extractCoachCommentaryMediaMetadata(
  overlay: CoachMatchBreakdownOverlay,
): CoachCommentaryMediaMetadata | null {
  const refs = overlay.voiceNoteRefs;
  if (!refs?.length) return null;
  const withMedia = refs.find((ref) => Boolean(ref.mediaId?.trim()));
  const ref = withMedia ?? refs[0];
  const mediaId = ref?.mediaId?.trim().toLowerCase() ?? "";
  if (!mediaId || !/^[a-f0-9]{32}$/i.test(mediaId)) return null;
  const alignment = normalizeCoachMatchBreakdownAlignment(ref.alignment);
  return {
    mediaId,
    ...(ref.durationMs !== undefined ? { durationMs: ref.durationMs } : {}),
    ...(ref.mimeType?.trim() ? { mimeType: ref.mimeType.trim() } : {}),
    ...(alignment ? { alignment } : {}),
  };
}
