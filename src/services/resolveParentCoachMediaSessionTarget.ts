import {
  dedupeActiveCoachWriterLinks,
  parentStrictWeeklyLinkedCoachLinksForUi,
} from "../coachShare/coachLinkBinding";
import { getCoachLinks } from "../storage/coachShareStore";

export type CoachMediaSessionTarget = {
  linkToken: string;
  apiBaseUrl: string | null;
};

/**
 * Resolve an invite session target for media resolve.
 * Parent redeemed links preferred; coach writer links as fallback.
 * Resolve is token-scoped (no permanent URL storage).
 */
export async function resolveCoachMediaSessionTarget(): Promise<CoachMediaSessionTarget | null> {
  const links = await getCoachLinks();
  const parentWeekly = parentStrictWeeklyLinkedCoachLinksForUi(links)[0]?.weeklySync;
  const parentToken = parentWeekly?.linkToken?.trim() ?? "";
  if (parentToken) {
    return {
      linkToken: parentToken,
      apiBaseUrl: parentWeekly?.apiBaseUrl?.trim() || null,
    };
  }
  const writerWeekly = dedupeActiveCoachWriterLinks(links)[0]?.weeklySync;
  const writerToken = writerWeekly?.linkToken?.trim() ?? "";
  if (writerToken) {
    return {
      linkToken: writerToken,
      apiBaseUrl: writerWeekly?.apiBaseUrl?.trim() || null,
    };
  }
  return null;
}

/** @deprecated Prefer resolveCoachMediaSessionTarget (works for parent + coach). */
export async function resolveParentCoachMediaSessionTarget(): Promise<CoachMediaSessionTarget | null> {
  return resolveCoachMediaSessionTarget();
}
