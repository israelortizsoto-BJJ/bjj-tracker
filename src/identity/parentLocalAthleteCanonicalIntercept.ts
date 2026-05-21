import { normalizeInviteLinkToken } from "../coachShare/inviteLinkToken";
import { parentStrictWeeklyLinkedCoachLinksForUi } from "../coachShare/coachLinkBinding";
import { isCoachSyncConfigured } from "../config/coachSync";
import { coachSyncFetchSession } from "../services/coachWeeklySyncApi";
import { getCachedWeeklyForLinkToken } from "../storage/coachWeeklySyncCacheStore";
import { getCoachLinks } from "../storage/coachShareStore";
import type { ParentAthlete } from "../storage/athleteStore";
import type { CoachLink } from "../types/coachShare";
import type { KidsById } from "../types/coachKid";
import type { SyncedSharedAthlete } from "../types/coachWeeklySync";

import {
  isSharedAthleteLineageId,
  resolveCanonicalBindBeforeSessionAthletePost,
  type CanonicalBindDecision,
  type ResolveCanonicalBindResult,
} from "./canonicalBindResolution";
import { logIdentityBindInterceptTrace } from "./identityBindInterceptTrace";

export type ParentLocalAthleteCanonicalInterceptInput = {
  athleteName: string;
  parentAthletes: readonly ParentAthlete[];
  kidsById: KidsById;
  /** When parent navigated from Link athletes, prefer that invite channel. */
  preferredCoachLinkId?: string | null;
};

export type ParentLocalAthleteCanonicalInterceptResult = {
  intercepted: boolean;
  canonicalSharedAthleteId: string | null;
  bindDecision: CanonicalBindDecision | null;
  bindSource: string | null;
  inviteTokenNorm: string | null;
  coachLinkId: string | null;
  resolution: ResolveCanonicalBindResult | null;
};

function coachLineageExistsInKids(kidsById: KidsById, inviteTokenNorm: string): boolean {
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (!isSharedAthleteLineageId(sid)) continue;
    const token = (k.sharedFromInviteTokenNorm ?? "").trim();
    if (inviteTokenNorm && token === inviteTokenNorm) return true;
    if (!inviteTokenNorm && sid) return true;
  }
  return false;
}

function orderedWeeklyLinksForIntercept(
  links: CoachLink[],
  preferredCoachLinkId?: string | null,
): CoachLink[] {
  const weekly = parentStrictWeeklyLinkedCoachLinksForUi(links);
  const prefer = (preferredCoachLinkId ?? "").trim();
  if (!prefer) return weekly;
  const hit = weekly.find((l) => l.id === prefer);
  if (!hit) return weekly;
  return [hit, ...weekly.filter((l) => l.id !== prefer)];
}

async function sessionAthletesForLink(link: CoachLink): Promise<SyncedSharedAthlete[]> {
  const ws = link.weeklySync;
  const token = typeof ws?.linkToken === "string" ? ws.linkToken.trim() : "";
  if (!token) return [];

  const cached = await getCachedWeeklyForLinkToken(token);
  const fromCache =
    cached?.session?.athletes?.length
      ? cached.session.athletes
      : cached?.athletes?.length
        ? cached.athletes
        : [];
  if (fromCache.length > 0) return fromCache;

  if (!isCoachSyncConfigured() || !ws?.parentWriterSecret?.trim()) {
    return [];
  }

  try {
    const session = await coachSyncFetchSession(token, ws.apiBaseUrl);
    return session.athletes ?? [];
  } catch {
    return [];
  }
}

function shouldInterceptLocalMint(decision: CanonicalBindDecision): boolean {
  return decision === "bind_existing_session" || decision === "bind_existing_canonical";
}

/**
 * Pre-mint authority gate for `athleteStore.addAthlete`.
 * When an invite / coach lineage exists, resolve canonical `shared_ath_*` before any `pa_*` mint.
 */
export async function resolveCanonicalBindBeforeLocalAthletePost(
  input: ParentLocalAthleteCanonicalInterceptInput,
): Promise<ParentLocalAthleteCanonicalInterceptResult> {
  const athleteName = input.athleteName.trim();
  const links = await getCoachLinks();
  const weeklyLinks = orderedWeeklyLinksForIntercept(links, input.preferredCoachLinkId);

  if (weeklyLinks.length === 0) {
    const kidsById = input.kidsById;
    const hasPriorShared = Object.values(kidsById).some((k) =>
      isSharedAthleteLineageId(k?.sharedAthleteId),
    );
    if (!hasPriorShared) {
      return {
        intercepted: false,
        canonicalSharedAthleteId: null,
        bindDecision: null,
        bindSource: null,
        inviteTokenNorm: null,
        coachLinkId: null,
        resolution: null,
      };
    }
  }

  let best: ParentLocalAthleteCanonicalInterceptResult | null = null;

  for (const link of weeklyLinks) {
    const ws = link.weeklySync;
    const linkToken = typeof ws?.linkToken === "string" ? ws.linkToken.trim() : "";
    if (!linkToken || !ws?.parentWriterSecret?.trim()) continue;

    const inviteTokenNorm = normalizeInviteLinkToken(linkToken);
    logIdentityBindInterceptTrace("invite_detected", {
      sourceFlow: "parent_add_athlete",
      callerFunction: "resolveCanonicalBindBeforeLocalAthletePost",
      athleteName,
      inviteToken: inviteTokenNorm,
      coachLinkId: link.id,
    });

    const sessionAthletes = await sessionAthletesForLink(link);
    const resolution = resolveCanonicalBindBeforeSessionAthletePost({
      athleteName,
      inviteTokenNorm,
      sessionAthletes,
      parentAthletes: input.parentAthletes,
      kidsById: input.kidsById,
      flowSource: "parent_add_athlete",
    });

    logIdentityBindInterceptTrace("intercept", {
      sourceFlow: "parent_add_athlete",
      callerFunction: "resolveCanonicalBindBeforeLocalAthletePost",
      athleteName,
      inviteToken: inviteTokenNorm,
      coachLinkId: link.id,
      bindDecision: resolution.decision,
      bindSource: resolution.bindSource,
      sessionAthleteCount: sessionAthletes.length,
      canonicalSharedAthleteId: resolution.canonicalSharedAthleteId,
      extra: {
        softNameDuplicateSharedIds: resolution.softNameDuplicateSharedIds,
      },
    });

    if (!shouldInterceptLocalMint(resolution.decision)) {
      const lineageOnPhone = coachLineageExistsInKids(input.kidsById, inviteTokenNorm);
      if (lineageOnPhone && resolution.decision === "mint_new") {
        logIdentityBindInterceptTrace("fallback_mint_allowed", {
          sourceFlow: "parent_add_athlete",
          callerFunction: "resolveCanonicalBindBeforeLocalAthletePost",
          athleteName,
          inviteToken: inviteTokenNorm,
          coachLinkId: link.id,
          bindDecision: resolution.decision,
          extra: { reason: "invite_active_no_session_canonical_match" },
        });
      }
      continue;
    }

    const canonicalId = (resolution.canonicalSharedAthleteId ?? "").trim();
    if (!canonicalId) continue;

    logIdentityBindInterceptTrace("canonical_resolved", {
      sourceFlow: "parent_add_athlete",
      callerFunction: "resolveCanonicalBindBeforeLocalAthletePost",
      athleteName,
      inviteToken: inviteTokenNorm,
      coachLinkId: link.id,
      canonicalSharedAthleteId: canonicalId,
      bindDecision: resolution.decision,
      bindSource: resolution.bindSource,
    });

    logIdentityBindInterceptTrace("mint_blocked", {
      sourceFlow: "parent_add_athlete",
      callerFunction: "resolveCanonicalBindBeforeLocalAthletePost",
      athleteName,
      inviteToken: inviteTokenNorm,
      coachLinkId: link.id,
      canonicalSharedAthleteId: canonicalId,
      bindDecision: resolution.decision,
      bindSource: resolution.bindSource,
      extra: { blockedIdKind: "pa_", projectedIdKind: "shared_ath" },
    });

    const candidate: ParentLocalAthleteCanonicalInterceptResult = {
      intercepted: true,
      canonicalSharedAthleteId: canonicalId,
      bindDecision: resolution.decision,
      bindSource: resolution.bindSource,
      inviteTokenNorm,
      coachLinkId: link.id,
      resolution,
    };

    if (resolution.decision === "bind_existing_session") {
      return candidate;
    }
    if (!best || best.bindDecision !== "bind_existing_session") {
      best = candidate;
    }
  }

  if (best) return best;

  return {
    intercepted: false,
    canonicalSharedAthleteId: null,
    bindDecision: null,
    bindSource: null,
    inviteTokenNorm: null,
    coachLinkId: null,
    resolution: null,
  };
}
