import { readCoachMatchBreakdownOverlay } from "../../storage/coachMatchBreakdownOverlayStore";
import type {
  CoachMatchBreakdownOverlay,
  CoachMatchBreakdownOverlayIdentity,
} from "../../types/coachMatchBreakdownOverlay";

/** Lineage-only overlay lookup. Orphans stay persisted but remain unattached when topology omits them. */
export async function readMatchBreakdownOverlay(
  identity: CoachMatchBreakdownOverlayIdentity,
  options?: { canonicalMatchLineageKeys?: ReadonlySet<string> },
): Promise<CoachMatchBreakdownOverlay | null> {
  const overlay = await readCoachMatchBreakdownOverlay(identity);
  if (!overlay) return null;
  const canonicalKeys = options?.canonicalMatchLineageKeys;
  if (canonicalKeys && !canonicalKeys.has(overlay.matchLineageKey)) {
    if (__DEV__) {
      console.log("[COMP_OVERLAY_TRACE] overlay_orphan_detected", {
        sharedAthleteId: overlay.sharedAthleteId,
        sharedCompetitionId: overlay.sharedCompetitionId,
        matchLineageKey: overlay.matchLineageKey,
      });
    }
    return null;
  }
  return overlay;
}
