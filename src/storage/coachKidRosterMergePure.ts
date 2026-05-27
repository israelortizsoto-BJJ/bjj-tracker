import { normalizeInviteLinkToken } from "../coachShare/inviteLinkToken";
import { isKidCoachArchived, type Kid, type KidsById } from "../types/coachKid";
import type { SyncedSharedAthlete } from "../types/coachWeeklySync";

/** Collapse whitespace; trim. Used for roster name matching during shared-athlete hydration. */
export function normalizeKidRosterName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function kidNamesMatchForRosterMerge(localName: string, remoteName: string): boolean {
  return normalizeKidRosterName(localName) === normalizeKidRosterName(remoteName);
}

export function isLocalOnlyCoachKid(k: Kid): boolean {
  return !isKidCoachArchived(k) && !(k.sharedAthleteId?.trim());
}

export function findUniqueLocalOnlyKidForRemoteAthlete(
  roster: KidsById,
  remoteName: string,
): Kid | null {
  const matches = Object.values(roster).filter(
    (k) => isLocalOnlyCoachKid(k) && kidNamesMatchForRosterMerge(k.name, remoteName),
  );
  if (matches.length === 1) return matches[0];
  return null;
}

export function applySharedAthleteToKidRow(
  existing: Kid,
  athlete: SyncedSharedAthlete,
  sharedFromInviteTokenNorm?: string,
  nowIso?: string,
): Kid {
  const updatedAt = nowIso ?? new Date().toISOString();
  const tokenNormRaw = sharedFromInviteTokenNorm?.trim();
  const tokenNorm = tokenNormRaw ? normalizeInviteLinkToken(tokenNormRaw) : "";
  return {
    ...existing,
    name: athlete.name,
    sharedAthleteId: athlete.id,
    updatedAt,
    ...(existing.isParentManagedChildProfile ? { isParentManagedChildProfile: true } : {}),
    ...(tokenNorm ? { sharedFromInviteTokenNorm: tokenNorm } : {}),
  };
}
