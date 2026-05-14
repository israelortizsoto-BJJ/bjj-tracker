import {
  CoachWeeklySyncApiError,
  coachSyncDeleteSessionCompetition,
  coachSyncFetchSession,
} from "../services/coachWeeklySyncApi";
import { getCoachLinks } from "../storage/coachShareStore";
import {
  deleteKidCompetitionEntry,
  getKidCompetitionEntryById,
  getWorkerCompetitionIdForEntry,
} from "../storage/kidCompetitionStore";
import type { KidId, KidsById } from "../types/coachKid";
import type { CoachLink } from "../types/coachShare";

type LinkedSyncTarget = {
  linkToken: string;
  apiBaseUrl: string;
  parentWriterSecret: string;
};

/** DEV-only context so the family “add competition” path can log without a second session fetch. */
export type ResolveLinkedTargetDevCreateContext = {
  kidLocalId: string;
  kidName: string;
};

function sessionListsAthleteForParentWriter(
  session: Awaited<ReturnType<typeof coachSyncFetchSession>>,
  trimmedAthleteId: string,
  mode: "rosterOrCompetition" | "rosterOnly",
): boolean {
  const onRoster = session.athletes.some((a) => a.id.trim() === trimmedAthleteId);
  if (mode === "rosterOnly") return onRoster;
  if (onRoster) return true;
  return session.competitions.some(
    (c) => c.sharedAthleteId.trim() === trimmedAthleteId,
  );
}

function toOpErrorMessage(e: unknown): string {
  if (e instanceof CoachWeeklySyncApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Try again shortly.";
}

/**
 * Resolves which active parent-writer link can perform competition DELETE/PUT/POST for an athlete.
 * Treats the athlete as present on a session if their id appears on `session.athletes` or as
 * `sharedAthleteId` on any `session.competitions` row (trimmed compare). When
 * `existingSharedCompetitionId` is set, prefers a session that lists that competition but falls
 * back to any session that lists the athlete (GET can omit a row briefly after POST).
 *
 * `requireAthleteOnSessionRoster`: when true (e.g. parent removes athlete from coach session), only
 * `session.athletes` counts. Otherwise a competition-only match can point at a token where DELETE
 * /athletes/:id returns 404 while the athlete still exists on another invite — worker DELETE
 * requires a roster row, not just competitions.
 */
export async function resolveLinkedTargetForParentWriter(
  sharedAthleteId: string,
  existingSharedCompetitionId?: string,
  devCreate?: ResolveLinkedTargetDevCreateContext,
  options?: { requireAthleteOnSessionRoster?: boolean },
): Promise<LinkedSyncTarget | null> {
  const trimmedAthleteId = sharedAthleteId.trim();
  if (!trimmedAthleteId) {
    console.log("[COMP_SYNC_TRACE] resolveLinkedTargetForParentWriter", {
      stage: "reject_empty_sharedAthleteId",
    });
    return null;
  }
  const links = await getCoachLinks();
  const activeParentLinks = links
    .filter((l): l is CoachLink & { weeklySync: NonNullable<CoachLink["weeklySync"]> } =>
      l.status === "active" && Boolean(l.weeklySync?.parentWriterSecret?.trim()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!activeParentLinks.length) {
    console.log("[COMP_SYNC_TRACE] resolveLinkedTargetForParentWriter", {
      stage: "reject_no_active_parent_links",
      trimmedAthleteId,
      existingSharedCompetitionId: existingSharedCompetitionId ?? null,
    });
    return null;
  }

  const listMode: "rosterOrCompetition" | "rosterOnly" = options?.requireAthleteOnSessionRoster
    ? "rosterOnly"
    : "rosterOrCompetition";

  if (__DEV__ && devCreate) {
    console.log("[bjj-sync-debug] parent competition create resolveLinkedTarget start", {
      kidLocalId: devCreate.kidLocalId,
      kidName: devCreate.kidName,
      kidSharedAthleteId: trimmedAthleteId,
      activeParentLinksCount: activeParentLinks.length,
    });
  }

  let athleteOnlyFallback: LinkedSyncTarget | null = null;

  for (const l of activeParentLinks) {
    try {
      const ws = l.weeklySync;
      // Must match stored token casing: same as `coachSyncCreateSessionCompetition` / other call sites.
      // Lowercasing here caused silent fetch failures on case-sensitive workers while the UI still showed “linked”.
      const token = ws.linkToken.trim();
      const session = await coachSyncFetchSession(token, ws.apiBaseUrl);
      const athleteOk = sessionListsAthleteForParentWriter(
        session,
        trimmedAthleteId,
        listMode,
      );
      const tokenTail =
        ws.linkToken.length > 8 ? ws.linkToken.slice(-8) : ws.linkToken;
      const hasSecret = Boolean(ws.parentWriterSecret?.trim());
      const compOk = existingSharedCompetitionId
        ? session.competitions.some((c) => c.id === existingSharedCompetitionId)
        : null;
      if (__DEV__) {
        const athleteIdsInParsedSession = session.athletes.map((a) => a.id);
        const competitionAthleteIdsSample = session.competitions
          .map((c) => c.sharedAthleteId)
          .filter((id, i, arr) => arr.indexOf(id) === i)
          .slice(0, 5);
        let resolverDecision: "accept" | "reject" | "defer-fallback" = "reject";
        if (athleteOk) {
          resolverDecision =
            !existingSharedCompetitionId ||
            session.competitions.some((c) => c.id === existingSharedCompetitionId)
              ? "accept"
              : "defer-fallback";
        }
        console.log(
          devCreate
            ? "[bjj-sync-debug] parent competition create resolveLinkedTarget candidate"
            : "[bjj-sync-debug] resolveLinkedTarget try",
          {
            linkId: l.id,
            linkTokenTail: tokenTail,
            apiBaseUrl: ws.apiBaseUrl,
            parentWriterSecretPresent: hasSecret,
            sharedAthleteId: trimmedAthleteId,
            athleteOk_sessionAthletesOrComps: athleteOk,
            athleteIdsInParsedSession,
            competitionAthleteIdsSample,
            existingSharedCompetitionId: existingSharedCompetitionId ?? null,
            compListedInSession: compOk,
            resolverDecision,
          },
        );
      }
      if (!athleteOk) continue;
      const target: LinkedSyncTarget = {
        linkToken: token,
        apiBaseUrl: ws.apiBaseUrl,
        parentWriterSecret: ws.parentWriterSecret!.trim(),
      };
      if (!existingSharedCompetitionId) {
        console.log("[COMP_SYNC_TRACE] resolveLinkedTargetForParentWriter", {
          stage: "accept_create_path",
          trimmedAthleteId,
          linkTokenTail: tokenTail,
          apiBaseUrl: ws.apiBaseUrl,
        });
        return target;
      }
      if (session.competitions.some((c) => c.id === existingSharedCompetitionId)) {
        console.log("[COMP_SYNC_TRACE] resolveLinkedTargetForParentWriter", {
          stage: "accept_existing_comp_on_session",
          trimmedAthleteId,
          existingSharedCompetitionId,
          linkTokenTail: tokenTail,
        });
        return target;
      }
      if (!athleteOnlyFallback) athleteOnlyFallback = target;
    } catch (err) {
      console.log("[COMP_SYNC_TRACE] resolveLinkedTargetForParentWriter", {
        stage: "session_fetch_threw_swallowed_continue",
        trimmedAthleteId,
        existingSharedCompetitionId: existingSharedCompetitionId ?? null,
        linkId: l.id,
        linkTokenTail:
          l.weeklySync.linkToken.length > 8
            ? l.weeklySync.linkToken.slice(-8)
            : l.weeklySync.linkToken,
        error: err instanceof Error ? err.message : String(err),
      });
      if (__DEV__ && devCreate) {
        const tokenTail =
          l.weeklySync.linkToken.length > 8
            ? l.weeklySync.linkToken.slice(-8)
            : l.weeklySync.linkToken;
        console.log(
          "[bjj-sync-debug] parent competition create resolveLinkedTarget candidate",
          {
            linkId: l.id,
            linkTokenTail: tokenTail,
            parentWriterSecretPresent: Boolean(l.weeklySync.parentWriterSecret?.trim()),
            sharedAthleteId: trimmedAthleteId,
            athleteOk_sessionAthletesOrComps: null,
            fetchError: true,
            resolverDecision: "reject" as const,
          },
        );
      }
      // Keep trying other links.
    }
  }
  if (existingSharedCompetitionId && athleteOnlyFallback) {
    console.log("[COMP_SYNC_TRACE] resolveLinkedTargetForParentWriter", {
      stage: "accept_athlete_only_fallback",
      trimmedAthleteId,
      existingSharedCompetitionId,
    });
    if (__DEV__) {
      console.log("[bjj-sync-debug] resolveLinkedTarget using athlete-only fallback", {
        sharedAthleteId: trimmedAthleteId,
        existingSharedCompetitionId,
      });
    }
    return athleteOnlyFallback;
  }
  console.log("[COMP_SYNC_TRACE] resolveLinkedTargetForParentWriter", {
    stage: "miss_null",
    trimmedAthleteId,
    existingSharedCompetitionId: existingSharedCompetitionId ?? null,
    activeParentLinksTried: activeParentLinks.length,
  });
  if (__DEV__) {
    console.log("[bjj-sync-debug] resolveLinkedTarget miss", {
      sharedAthleteId: trimmedAthleteId,
      existingSharedCompetitionId: existingSharedCompetitionId ?? null,
    });
  }
  return null;
}

export type ParentKidCompetitionDeleteOutcome =
  | { ok: true }
  | { ok: false; alertTitle: string; alertMessage: string };

/**
 * Deletes one parent competition row: issues worker DELETE when the row is synced, then removes
 * local storage. Used from the family edit screen and the main coaches list swipe delete.
 */
export async function deleteParentKidCompetitionEntry(
  entryId: string,
  kidId: KidId,
  getKidsById: () => Promise<KidsById>,
): Promise<ParentKidCompetitionDeleteOutcome> {
  const kids = await getKidsById();
  const kid = kids[kidId];
  const existing = await getKidCompetitionEntryById(entryId);

  if (!existing || existing.kidId !== kidId) {
    if (__DEV__) {
      console.log("[bjj-sync-debug] parent delete path", {
        entryId,
        kidId,
        deletePath: "early-exit",
        notLinkedRemoteReason:
          !existing
            ? "getKidCompetitionEntryById returned null or wrong kid"
            : "entry kidId mismatch",
      });
    }
    await deleteKidCompetitionEntry(entryId);
    return { ok: true };
  }

  const kidSharedAthleteId = kid?.sharedAthleteId?.trim();
  const rowSharedAthleteId = existing.sharedAthleteId?.trim();
  const athleteForRemote =
    (existing.sharedAthleteId ?? kid?.sharedAthleteId)?.trim() ?? "";
  const workerCompetitionId = getWorkerCompetitionIdForEntry(existing);

  const rowSnapshot = {
    id: existing.id,
    kidId: existing.kidId,
    tournamentName: existing.tournamentName,
    sharedCompetitionId: existing.sharedCompetitionId ?? null,
    sharedAthleteId: existing.sharedAthleteId ?? null,
  };

  let deletePath: "linked-remote" | "local-only" | "early-exit" = "local-only";
  let notLinkedRemoteReason: string | null = null;

  if (!workerCompetitionId) {
    deletePath = "local-only";
    notLinkedRemoteReason =
      "no worker competition id (missing sharedCompetitionId and id is not shared-comp-<workerId>)";
  } else if (!athleteForRemote) {
    deletePath = "local-only";
    notLinkedRemoteReason =
      "no sharedAthleteId on row or kid roster (cannot target remote athlete)";
  } else {
    deletePath = "linked-remote";
  }

  if (__DEV__) {
    console.log("[bjj-sync-debug] parent delete path", {
      entryId,
      rowSnapshot,
      deletePath,
      notLinkedRemoteReason: deletePath === "linked-remote" ? null : notLinkedRemoteReason,
      kidSharedAthleteId: kidSharedAthleteId || null,
      rowSharedAthleteId: rowSharedAthleteId || null,
      resolvedAthleteForRemote: athleteForRemote || null,
      resolvedWorkerCompetitionId: workerCompetitionId || null,
    });
  }

  if (deletePath === "linked-remote") {
    if (!workerCompetitionId || !athleteForRemote) {
      if (__DEV__) {
        console.log("[bjj-sync-debug] parent delete early-exit", {
          entryId,
          reason: "linked-remote path missing ids after classification (unexpected)",
        });
      }
      await deleteKidCompetitionEntry(entryId);
      return { ok: true };
    }
    const target = await resolveLinkedTargetForParentWriter(
      athleteForRemote,
      workerCompetitionId,
    );
    if (__DEV__) {
      console.log("[bjj-sync-debug] parent delete resolveLinkedTarget result", {
        entryId,
        hit: Boolean(target),
        linkTokenTail: target?.linkToken ? target.linkToken.slice(-8) : null,
        hasParentWriterSecret: Boolean(target?.parentWriterSecret?.trim()),
      });
    }
    if (!target) {
      if (__DEV__) {
        console.log("[bjj-sync-debug] parent delete blocked", {
          entryId,
          reason: "resolveLinkedTarget returned null (no writable link with this athlete)",
        });
      }
      return {
        ok: false,
        alertTitle: "Could not sync",
        alertMessage:
          "This linked competition could not be matched to a writable invite on this phone. Open Coach link & sharing (from This week together), pick the channel whose code matches your coach, then Athletes on this invite to relink this child.",
      };
    }
    try {
      if (__DEV__) {
        console.log("[bjj-sync-debug] parent delete calling coachSyncDeleteSessionCompetition", {
          entryId,
          workerCompetitionId,
          linkTokenTail: target.linkToken.slice(-8),
        });
      }
      await coachSyncDeleteSessionCompetition(
        target.linkToken,
        workerCompetitionId,
        target.parentWriterSecret,
        target.apiBaseUrl,
      );
      if (__DEV__) {
        console.log("[bjj-sync-debug] parent delete API helper returned OK", { entryId });
      }
    } catch (e) {
      return {
        ok: false,
        alertTitle: "Could not sync",
        alertMessage: toOpErrorMessage(e) || "Try again shortly.",
      };
    }
  } else if (__DEV__) {
    console.log("[bjj-sync-debug] parent delete local-only (no worker DELETE)", {
      entryId,
      notLinkedRemoteReason,
    });
  }

  await deleteKidCompetitionEntry(entryId);
  return { ok: true };
}
