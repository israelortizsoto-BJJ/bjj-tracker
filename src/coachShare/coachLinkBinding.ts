import type { CoachWeeklySyncCacheEntry } from "../storage/coachWeeklySyncCacheStore";
import { coachSyncFetchSession } from "../services/coachWeeklySyncApi";
import { isKidCoachArchived, type KidsById, type Kid } from "../types/coachKid";
import type { CoachLink, CoachLinkStatus } from "../types/coachShare";
import { inviteLinkTokenTail, normalizeInviteLinkToken } from "./inviteLinkToken";

/**
 * One active coach-writer row per normalized invite token (newest wins).
 * Preserves the original `linkToken` on the returned link for API calls.
 */
export function dedupeActiveCoachWriterLinks(links: CoachLink[]): CoachLink[] {
  const m = new Map<string, CoachLink>();
  for (const l of links) {
    if (l.status !== "active" || l.revokedAt) continue;
    const ws = l.weeklySync;
    const secret = typeof ws?.writerSecret === "string" ? ws.writerSecret.trim() : "";
    const tokenRaw = typeof ws?.linkToken === "string" ? ws.linkToken.trim() : "";
    if (!ws || !secret || !tokenRaw) continue;
    const key = normalizeInviteLinkToken(tokenRaw);
    if (!key) continue;
    const cur = m.get(key);
    if (
      !cur ||
      l.updatedAt.localeCompare(cur.updatedAt) > 0 ||
      (l.updatedAt === cur.updatedAt && l.createdAt.localeCompare(cur.createdAt) > 0)
    ) {
      m.set(key, l);
    }
  }
  return [...m.values()];
}

export function sortCoachWriterLinksNewestFirst(links: CoachLink[]): CoachLink[] {
  return [...links].sort((a, b) => {
    const u = b.updatedAt.localeCompare(a.updatedAt);
    if (u !== 0) return u;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

type CoachLinkWithWeeklySync = CoachLink & {
  weeklySync: NonNullable<CoachLink["weeklySync"]>;
};

/** Active links that have weekly sync + parent writer secret (usable for parent-side server ops). */
export function activeParentWeeklyLinksWithSecret(links: CoachLink[]): CoachLinkWithWeeklySync[] {
  return links.filter(
    (l): l is CoachLinkWithWeeklySync =>
      l.status === "active" &&
      Boolean(l.weeklySync?.linkToken?.trim()) &&
      Boolean(l.weeklySync?.parentWriterSecret?.trim()),
  );
}

/**
 * One active parent-redeemed weekly row per normalized invite token (newest wins).
 * Canonical local truth for “this phone is subscribed to that weekly channel” after Connect / redeem.
 */
export function dedupeActiveParentWeeklyLinksByInviteToken(links: CoachLink[]): CoachLinkWithWeeklySync[] {
  const m = new Map<string, CoachLinkWithWeeklySync>();
  for (const l of activeParentWeeklyLinksWithSecret(links)) {
    const key = normalizeInviteLinkToken(l.weeklySync.linkToken);
    if (!key) continue;
    const cur = m.get(key);
    if (
      !cur ||
      l.updatedAt.localeCompare(cur.updatedAt) > 0 ||
      (l.updatedAt === cur.updatedAt && l.createdAt.localeCompare(cur.createdAt) > 0)
    ) {
      m.set(key, l);
    }
  }
  return [...m.values()];
}

/**
 * Strict parent weekly linked state for parent UI: deduped per invite token, newest first.
 * Use for weekly session fetch, manage weekly rows, join “already connected”, and athlete↔token coherence.
 */
export function parentStrictWeeklyLinkedCoachLinksForUi(links: CoachLink[]): CoachLink[] {
  return sortCoachWriterLinksNewestFirst(dedupeActiveParentWeeklyLinksByInviteToken(links));
}

/** Active pack / assignment coach-share rows with no weekly channel (legacy path). */
export function parentActiveLegacyCoachShareLinks(links: CoachLink[]): CoachLink[] {
  return links.filter((l) => l.status === "active" && !l.weeklySync);
}

/**
 * Parent “has any coach relationship” for hero + assignments: strict weekly (redeemed) first, then legacy
 * non-weekly links. Weekly rows never count until `parentWriterSecret` is present; coach-writer-only rows
 * on the same phone do not appear here.
 */
export function activeCoachLinksForParentLinkedUi(links: CoachLink[]): CoachLink[] {
  return [...parentStrictWeeklyLinkedCoachLinksForUi(links), ...parentActiveLegacyCoachShareLinks(links)];
}

/**
 * Canonical parent-device “coach linked” boolean for trust-layer UI (This Week + Summary).
 * Semantically identical to `activeCoachLinksForParentLinkedUi(links).length > 0` without
 * allocating the concatenated array.
 */
export function parentDeviceCoachLinkedForTrustUi(links: CoachLink[]): boolean {
  return (
    parentStrictWeeklyLinkedCoachLinksForUi(links).length > 0 ||
    parentActiveLegacyCoachShareLinks(links).length > 0
  );
}

/** DEV-only snapshots for auto-relink tracing; no secrets, token tails only. */
export type DevCoachLinkRowSnap = {
  id: string;
  status: CoachLinkStatus;
  tokenNorm: string | null;
  tokenTail: string | null;
  hasWeeklySync: boolean;
  hasWriterSecret: boolean;
  hasParentWriterSecret: boolean;
};

export function devSnapshotCoachLinkRow(l: CoachLink): DevCoachLinkRowSnap {
  const ws = l.weeklySync;
  const tokenRaw = typeof ws?.linkToken === "string" ? ws.linkToken.trim() : "";
  const tokenNorm = tokenRaw ? normalizeInviteLinkToken(tokenRaw) || null : null;
  return {
    id: l.id,
    status: l.status,
    tokenNorm,
    tokenTail: tokenRaw ? inviteLinkTokenTail(tokenRaw) : null,
    hasWeeklySync: Boolean(ws),
    hasWriterSecret: Boolean(ws?.writerSecret?.trim()),
    hasParentWriterSecret: Boolean(ws?.parentWriterSecret?.trim()),
  };
}

export function buildDevParentWeeklyLinkedStateTrace(links: CoachLink[]): {
  allRows: DevCoachLinkRowSnap[];
  parentWeeklyWithSecretPreDedupe: DevCoachLinkRowSnap[];
  strictWeeklyForUi: DevCoachLinkRowSnap[];
  legacyActiveCount: number;
  activeCoachLinksForParentLinkedUiCount: number;
  chosenActiveWeeklyTokenTail: string | null;
  parentShownAsLinked: boolean;
  useWeeklySyncHero: boolean;
  parentLinkedUiReason: string;
} {
  const allRows = links.map(devSnapshotCoachLinkRow);
  const parentWeeklyWithSecretPreDedupe = activeParentWeeklyLinksWithSecret(links).map(
    devSnapshotCoachLinkRow,
  );
  const strictWeekly = parentStrictWeeklyLinkedCoachLinksForUi(links);
  const strictWeeklyForUi = strictWeekly.map(devSnapshotCoachLinkRow);
  const legacy = parentActiveLegacyCoachShareLinks(links);
  const activeUi = activeCoachLinksForParentLinkedUi(links);
  const hero = strictWeekly[0];
  const tokenRaw = hero?.weeklySync?.linkToken?.trim() ?? "";
  const chosenActiveWeeklyTokenTail = tokenRaw ? inviteLinkTokenTail(tokenRaw) : null;
  const parentShownAsLinked = activeUi.length > 0;
  const useWeeklySyncHero = strictWeekly.length > 0;

  let parentLinkedUiReason: string;
  if (!parentShownAsLinked) {
    parentLinkedUiReason = "not_linked:empty_activeCoachLinksForParentLinkedUi";
  } else if (strictWeekly.length > 0) {
    parentLinkedUiReason = "linked:strict_weekly_redeemed_parentWriterSecret";
  } else if (legacy.length > 0) {
    parentLinkedUiReason = "linked:legacy_active_rows_without_weeklySync";
  } else {
    parentLinkedUiReason = "linked:unexpected_active_ui";
  }

  return {
    allRows,
    parentWeeklyWithSecretPreDedupe,
    strictWeeklyForUi,
    legacyActiveCount: legacy.length,
    activeCoachLinksForParentLinkedUiCount: activeUi.length,
    chosenActiveWeeklyTokenTail,
    parentShownAsLinked,
    useWeeklySyncHero,
    parentLinkedUiReason,
  };
}

/**
 * Parent “linked to coach” presentation: athlete id + token matches an active link with
 * redeemable parent writer state on this device.
 */
export function parentKidPresentedAsLinkedToCoach(kid: Kid, activeLinks: CoachLink[]): boolean {
  const sid = (kid.sharedAthleteId ?? "").trim();
  if (!sid) return false;
  const kt = normalizeInviteLinkToken(kid.sharedFromInviteTokenNorm);
  if (!kt) return false;
  const hit = activeLinks.find(
    (l) =>
      l.status === "active" &&
      normalizeInviteLinkToken(l.weeklySync?.linkToken) === kt &&
      Boolean(l.weeklySync?.parentWriterSecret?.trim()),
  );
  return Boolean(hit);
}

/**
 * For Athletes-on-invite: kid is coherently bound to this invite token on this phone
 * (active link row + parent secret + matching stored token norm).
 */
/**
 * Identity backbone: local `Kid` rows claim `sharedAthleteId` for this invite, but the cached
 * session snapshot’s `athletes[]` does not contain those IDs (empty roster cache, or stale write).
 * `loadCoachShareData` must not `skipSessionNetwork` while this is true.
 */
export function parentLocalLinkageConflictsWithCachedSessionRoster(
  kidsById: KidsById,
  inviteTokenNorm: string,
  cached: CoachWeeklySyncCacheEntry | null,
): boolean {
  if (!inviteTokenNorm) return false;
  const rosterIds = new Set(
    (cached?.athletes ?? [])
      .map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
      .filter(Boolean),
  );
  for (const k of Object.values(kidsById)) {
    if (isKidCoachArchived(k)) continue;
    const kt = normalizeInviteLinkToken(k.sharedFromInviteTokenNorm ?? "");
    if (kt !== inviteTokenNorm) continue;
    const aid = (k.sharedAthleteId ?? "").trim();
    if (!aid) continue;
    if (!rosterIds.has(aid)) {
      return true;
    }
  }
  return false;
}

export function parentKidCoherentlyLinkedToInviteToken(
  kid: Kid,
  inviteTokenNorm: string,
  activeLinks: CoachLink[],
): boolean {
  const sid = (kid.sharedAthleteId ?? "").trim();
  if (!sid) return false;
  const kt = normalizeInviteLinkToken(kid.sharedFromInviteTokenNorm);
  if (kt !== inviteTokenNorm) return false;
  return activeParentWeeklyLinksWithSecret(activeLinks).some(
    (l) => normalizeInviteLinkToken(l.weeklySync?.linkToken) === kt,
  );
}

/** Set of normalized tokens for active coach-writer channels on this device. */
export function activeCoachWriterInviteTokenNorms(links: CoachLink[]): Set<string> {
  const s = new Set<string>();
  for (const l of dedupeActiveCoachWriterLinks(links)) {
    const n = normalizeInviteLinkToken(l.weeklySync?.linkToken);
    if (n) s.add(n);
  }
  return s;
}

/**
 * Coach roster: parent-managed rows only show when their stored token matches an active
 * writer channel here. Other rows unchanged.
 */
export function kidVisibleOnCoachRoster(
  kid: Kid,
  writerTokenNorms: Set<string>,
  activeWriterAthleteIds?: ReadonlySet<string>,
): boolean {
  if (kid.isParentManagedChildProfile && !(kid.sharedAthleteId ?? "").trim()) return false;
  if (kid.isParentManagedChildProfile && (kid.sharedAthleteId ?? "").trim()) {
    const sharedAthleteId = (kid.sharedAthleteId ?? "").trim();
    const kidToken = normalizeInviteLinkToken(kid.sharedFromInviteTokenNorm);
    const tokenCoherent = Boolean(kidToken && writerTokenNorms.has(kidToken));
    const existsInActiveWriterSession = Boolean(
      sharedAthleteId && activeWriterAthleteIds?.has(sharedAthleteId),
    );
    if (!tokenCoherent && !existsInActiveWriterSession) return false;
  }
  return true;
}

/** “· linked” badge on coach roster — same binding rule as visibility for parent-managed athletes. */
export function coachKidShowsFamilyChannelLinkedBadge(
  kid: Kid,
  writerTokenNorms: Set<string>,
): boolean {
  if (!(kid.sharedAthleteId ?? "").trim()) return false;
  const kidToken = normalizeInviteLinkToken(kid.sharedFromInviteTokenNorm);
  return Boolean(kidToken && writerTokenNorms.has(kidToken));
}

export type ResolveCoachPublishWriterResult =
  | { ok: true; link: CoachLink }
  | { ok: false; reason: "no_writers" | "no_match" | "ambiguous_session" };

/**
 * Resolve which writer link to use for weekly publish: primary match on
 * `sharedFromInviteTokenNorm`, else exactly one active writer session whose roster contains
 * `sharedAthleteId` (live session GET per candidate).
 */
export async function resolveCoachPublishWriterLink(
  kidRow: Kid | undefined,
  links: CoachLink[],
): Promise<ResolveCoachPublishWriterResult> {
  const writers = dedupeActiveCoachWriterLinks(links).filter((l) =>
    Boolean(l.weeklySync?.writerSecret?.trim()),
  );
  if (!writers.length) {
    return { ok: false, reason: "no_writers" };
  }

  const kidTokenKey = normalizeInviteLinkToken(kidRow?.sharedFromInviteTokenNorm ?? "");
  if (kidTokenKey.length > 0) {
    const byToken = writers.find(
      (l) => normalizeInviteLinkToken(l.weeklySync?.linkToken ?? "") === kidTokenKey,
    );
    if (byToken?.weeklySync?.writerSecret?.trim()) {
      return { ok: true, link: byToken };
    }
  }

  const sharedId = kidRow?.sharedAthleteId?.trim();
  if (!sharedId) {
    return { ok: false, reason: "no_match" };
  }

  const matches: CoachLink[] = [];
  for (const l of writers) {
    const ws = l.weeklySync!;
    try {
      const session = await coachSyncFetchSession(ws.linkToken.trim(), ws.apiBaseUrl);
      if (session.athletes.some((a) => (typeof a.id === "string" ? a.id.trim() : "") === sharedId)) {
        matches.push(l);
      }
    } catch {
      // Skip failed fetches; ambiguity requires successful hits only.
    }
  }

  if (matches.length === 1) {
    return { ok: true, link: matches[0]! };
  }
  if (matches.length > 1) {
    return { ok: false, reason: "ambiguous_session" };
  }
  return { ok: false, reason: "no_match" };
}
