import { resolveLinkedTargetForParentWriter } from "../../family/parentKidCompetitionDelete";
import { coachSyncPutTrainingProof } from "../../services/coachWeeklySyncApi";
import { getSessions } from "../../storage/sessionsStore";
import { buildTrainingProofArtifact } from "./buildTrainingProofArtifact";

/**
 * Fire-and-forget: recompute bounded training proof from parent local sessions
 * and publish to the linked invite session. Local saves are never blocked on sync failure.
 */
export function schedulePublishParentTrainingProof(sharedAthleteId: string): void {
  const trimmed = sharedAthleteId.trim();
  if (!trimmed) return;

  void (async () => {
    try {
      const target = await resolveLinkedTargetForParentWriter(trimmed, undefined, undefined, {
        requireAthleteOnSessionRoster: true,
      });
      if (!target) {
        console.log("[TRAINING_PROOF_TRACE] publish_skipped_no_linked_target", {
          sharedAthleteId: trimmed,
          resolverMode: "rosterOnly",
        });
        return;
      }

      const sessions = await getSessions();
      const artifact = buildTrainingProofArtifact(trimmed, sessions);
      if (__DEV__) {
        console.log("[TRAINING_PROOF_PARENT]", {
          athleteId: trimmed,
          sessionCount: artifact.currentWeekSessionCount,
          topSystems: artifact.topSystems,
          lastTrainingAt: artifact.lastTrainingDateYMD,
          updatedAt: artifact.updatedAt,
        });
      }
      const putPath = `/v1/sessions/${encodeURIComponent(target.linkToken)}/training-proof`;
      const kvKey = `s:${target.linkToken.trim().toLowerCase()}`;
      console.log("[TRAINING_PROOF_TRACE] publish_attempt", {
        sharedAthleteId: trimmed,
        operation: "PUT",
        putPath,
        kvKey,
        apiBaseUrl: target.apiBaseUrl,
        linkTokenTail:
          target.linkToken.length > 8 ? target.linkToken.slice(-8) : target.linkToken,
        resolverMode: "rosterOnly",
      });
      await coachSyncPutTrainingProof(
        target.linkToken,
        target.parentWriterSecret,
        artifact,
        target.apiBaseUrl,
      );
      console.log("[TRAINING_PROOF_TRACE] publish_ok", {
        sharedAthleteId: trimmed,
        putPath,
        kvKey,
        currentWeekSessionCount: artifact.currentWeekSessionCount,
        weeklyGoalMet: artifact.weeklyGoalMet,
      });
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: unknown }).status
          : null;
      console.log("[TRAINING_PROOF_TRACE] publish_failed", {
        sharedAthleteId: trimmed,
        error: error instanceof Error ? error.message : String(error),
        httpStatus: status,
        likelyCause:
          status === 404
            ? "worker_route_missing_or_unmatched_path"
            : status === 400
              ? "sharedAthleteId_not_on_session_roster"
              : null,
      });
    }
  })();
}
