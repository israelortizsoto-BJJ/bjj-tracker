import { activeParentWeeklyLinksWithSecret } from "../../coachShare/coachLinkBinding";
import { resolveLinkedTargetForParentWriter } from "../../family/parentKidCompetitionDelete";
import { getCoachLinks } from "../../storage/coachShareStore";
import { coachSyncPublishWeekly } from "../../services/coachWeeklySyncApi";
import type { SyncedWeeklyParentFeedback } from "../../types/coachWeeklySync";

/**
 * Fire-and-forget: publish parent weekly feedback overlay via the existing weekly PUT lane.
 * Local cache updates are never blocked on sync failure.
 */
export function schedulePublishParentWeeklyFeedback(
  sharedAthleteId: string | null | undefined,
  parentFeedback: SyncedWeeklyParentFeedback | undefined,
): void {
  if (!parentFeedback) return;
  const trimmedAthleteId = (sharedAthleteId ?? "").trim();

  void (async () => {
    try {
      let target = trimmedAthleteId
        ? await resolveLinkedTargetForParentWriter(trimmedAthleteId, undefined, undefined, {
            requireAthleteOnSessionRoster: true,
          })
        : null;
      if (!target && !trimmedAthleteId) {
        const inviteLink = activeParentWeeklyLinksWithSecret(await getCoachLinks())[0];
        const ws = inviteLink?.weeklySync;
        const secret = ws?.parentWriterSecret?.trim();
        const token = ws?.linkToken?.trim();
        if (token && secret) {
          target = {
            linkToken: token,
            parentWriterSecret: secret,
            apiBaseUrl: ws.apiBaseUrl,
          };
        }
      }
      if (!target) {
        console.log("[WEEKLY_FEEDBACK_TRACE] publish_skipped_no_linked_target", {
          sharedAthleteId: trimmedAthleteId || null,
          resolverMode: trimmedAthleteId ? "rosterOnly" : "inviteWeekly",
        });
        return;
      }

      const putPath = `/v1/sessions/${encodeURIComponent(target.linkToken)}/weekly`;
      console.log("[WEEKLY_FEEDBACK_TRACE] publish_attempt", {
        sharedAthleteId: trimmedAthleteId || null,
        operation: "PUT",
        putPath,
        linkTokenTail:
          target.linkToken.length > 8 ? target.linkToken.slice(-8) : target.linkToken,
        hasViewedAt: Boolean(parentFeedback.viewedAt),
        hasAcknowledgedAt: Boolean(parentFeedback.acknowledgedAt),
      });

      await coachSyncPublishWeekly(
        target.linkToken,
        target.parentWriterSecret,
        {
          ...(trimmedAthleteId ? { sharedAthleteId: trimmedAthleteId } : {}),
          parentFeedback,
        },
        target.apiBaseUrl,
      );

      console.log("[WEEKLY_FEEDBACK_TRACE] publish_ok", {
        sharedAthleteId: trimmedAthleteId || null,
        putPath,
      });
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: unknown }).status
          : null;
      console.log("[WEEKLY_FEEDBACK_TRACE] publish_failed", {
        sharedAthleteId: trimmedAthleteId || null,
        error: error instanceof Error ? error.message : String(error),
        httpStatus: status,
      });
    }
  })();
}
