import { parentStrictWeeklyLinkedCoachLinksForUi } from "../coachShare/coachLinkBinding";
import { normalizeInviteLinkToken } from "../coachShare/inviteLinkToken";
import { startCoachAnalysisReadinessRun } from "../domain/competition/coachAnalysisReadinessCoordinator";
import { getCoachLinks } from "../storage/coachShareStore";
import { setCachedWeeklyForLinkToken } from "../storage/coachWeeklySyncCacheStore";
import type { CoachWeeklySyncSessionResponse } from "../types/coachWeeklySync";
import { coachSyncFetchSession } from "./coachWeeklySyncApi";

export type RefreshParentWriterSessionSnapshotOptions = {
  initialSharedAthleteIds: readonly string[];
  isCancelled?: () => boolean;
};

export type RefreshParentWriterSessionSnapshotResult =
  | { status: "skipped"; reason: "no_weekly_link" | "cancelled" }
  | {
      status: "success";
      session: CoachWeeklySyncSessionResponse;
      token: string;
      tokenNorm: string;
    }
  | { status: "error"; tokenNorm: string; error: unknown };

function logParentRefreshLifecycle(fields: {
  status: "success" | "error" | "skipped";
  reason?: "no_weekly_link" | "cancelled";
  tokenNorm?: string;
}): void {
  console.log("[PARENT_REFRESH_LIFECYCLE]", {
    status: fields.status,
    ...(fields.reason !== undefined ? { reason: fields.reason } : {}),
    hydrationSource: "parent_session_refresh",
    ...(fields.tokenNorm !== undefined ? { tokenNorm: fields.tokenNorm } : {}),
  });
}

/**
 * Parent P6 session refresh: writer GET → weekly cache write → artifact hydrate → hydration bump.
 * Shared by Summary, Compete focus, and other parent_session_refresh surfaces.
 */
export async function refreshParentWriterSessionSnapshot(
  options: RefreshParentWriterSessionSnapshotOptions,
): Promise<RefreshParentWriterSessionSnapshotResult> {
  const { initialSharedAthleteIds, isCancelled } = options;

  const links = await getCoachLinks();
  if (isCancelled?.()) {
    logParentRefreshLifecycle({ status: "skipped", reason: "cancelled" });
    return { status: "skipped", reason: "cancelled" };
  }

  const weeklyLink = parentStrictWeeklyLinkedCoachLinksForUi(links)[0];
  const weeklySync = weeklyLink?.weeklySync;
  if (!weeklySync?.linkToken?.trim()) {
    logParentRefreshLifecycle({ status: "skipped", reason: "no_weekly_link" });
    return { status: "skipped", reason: "no_weekly_link" };
  }

  const token = weeklySync.linkToken;
  const tokenNorm = normalizeInviteLinkToken(token);

  const readinessRun = await startCoachAnalysisReadinessRun({
    initialSharedAthleteIds,
    linkKeys: [tokenNorm],
    startedAt: new Date().toISOString(),
    hydrationSource: "parent_session_refresh",
  });
  if (isCancelled?.()) {
    logParentRefreshLifecycle({
      status: "skipped",
      reason: "cancelled",
      tokenNorm,
    });
    return { status: "skipped", reason: "cancelled" };
  }

  try {
    const session = await coachSyncFetchSession(token, weeklySync.apiBaseUrl);
    if (isCancelled?.()) {
      logParentRefreshLifecycle({
        status: "skipped",
        reason: "cancelled",
        tokenNorm,
      });
      return { status: "skipped", reason: "cancelled" };
    }
    const nowIso = new Date().toISOString();
    await setCachedWeeklyForLinkToken(
      token,
      session.weekly,
      nowIso,
      session.weeklyByAthleteId ?? {},
      session.athletes,
      session,
      tokenNorm,
    );
    if (isCancelled?.()) {
      logParentRefreshLifecycle({
        status: "skipped",
        reason: "cancelled",
        tokenNorm,
      });
      return { status: "skipped", reason: "cancelled" };
    }
    readinessRun.recordSuccessfulSession(tokenNorm, session);
    await readinessRun.finalize(new Date().toISOString());
    if (isCancelled?.()) {
      logParentRefreshLifecycle({
        status: "skipped",
        reason: "cancelled",
        tokenNorm,
      });
      return { status: "skipped", reason: "cancelled" };
    }
    logParentRefreshLifecycle({ status: "success", tokenNorm });
    return { status: "success", session, token, tokenNorm };
  } catch (error) {
    if (isCancelled?.()) {
      logParentRefreshLifecycle({
        status: "skipped",
        reason: "cancelled",
        tokenNorm,
      });
      return { status: "skipped", reason: "cancelled" };
    }
    readinessRun.recordFailedLink(tokenNorm);
    await readinessRun.finalize(new Date().toISOString());
    logParentRefreshLifecycle({ status: "error", tokenNorm });
    return { status: "error", tokenNorm, error };
  }
}
