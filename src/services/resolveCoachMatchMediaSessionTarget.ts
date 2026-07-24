import { dedupeActiveCoachWriterLinks } from "../coachShare/coachLinkBinding";
import { getCoachLinks } from "../storage/coachShareStore";

/**
 * Coach-writer session authority for Shared Match Media resolve.
 * Requires linkToken + writerSecret; Parent redeemed links alone cannot authorize resolve.
 */
export type CoachMatchMediaSessionTarget = {
  linkToken: string;
  coachWriterSecret: string;
  apiBaseUrl: string | null;
};

/**
 * Resolve the active Coach writer session used for match-media attachment resolve.
 * Memory-only credentials from coach share store — never persist a delivery URL here.
 */
export async function resolveCoachMatchMediaSessionTarget(): Promise<CoachMatchMediaSessionTarget | null> {
  const links = await getCoachLinks();
  const writerWeekly = dedupeActiveCoachWriterLinks(links).find((link) =>
    Boolean(link.weeklySync?.writerSecret?.trim() && link.weeklySync?.linkToken?.trim()),
  )?.weeklySync;
  const linkToken = writerWeekly?.linkToken?.trim() ?? "";
  const coachWriterSecret = writerWeekly?.writerSecret?.trim() ?? "";
  if (!linkToken || !coachWriterSecret) return null;
  return {
    linkToken,
    coachWriterSecret,
    apiBaseUrl: writerWeekly?.apiBaseUrl?.trim() || null,
  };
}
