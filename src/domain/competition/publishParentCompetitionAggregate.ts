import { resolveLinkedTargetForParentWriter } from "../../family/parentKidCompetitionDelete";
import { coachSyncPutCompetitionAggregate } from "../../services/coachWeeklySyncApi";
import { getKidCompetitionEntriesWithMatchDetailForSharedAthlete } from "../../storage/competitionStore";
import { buildCompetitionAggregateArtifact } from "./buildCompetitionAggregateArtifact";

/**
 * Fire-and-forget: recompute bounded competition intelligence from parent local storage
 * and publish to the linked invite session. Local saves are never blocked on sync failure.
 */
export function schedulePublishParentCompetitionAggregate(sharedAthleteId: string): void {
  const trimmed = sharedAthleteId.trim();
  if (!trimmed) return;

  void (async () => {
    try {
      // Worker PUT requires a roster row (`rec.athletes`); competition-only session match would 400 after route exists.
      const target = await resolveLinkedTargetForParentWriter(trimmed, undefined, undefined, {
        requireAthleteOnSessionRoster: true,
      });
      if (!target) {
        console.log("[COMP_AGG_TRACE] publish_skipped_no_linked_target", {
          sharedAthleteId: trimmed,
          resolverMode: "rosterOnly",
        });
        return;
      }

      const competitions = await getKidCompetitionEntriesWithMatchDetailForSharedAthlete(trimmed);
      const artifact = buildCompetitionAggregateArtifact(trimmed, competitions);
      const putPath = `/v1/sessions/${encodeURIComponent(target.linkToken)}/competition-aggregate`;
      const kvKey = `s:${target.linkToken.trim().toLowerCase()}`;
      console.log("[COMP_AGG_TRACE] publish_attempt", {
        sharedAthleteId: trimmed,
        operation: "PUT",
        putPath,
        kvKey,
        apiBaseUrl: target.apiBaseUrl,
        linkTokenTail:
          target.linkToken.length > 8 ? target.linkToken.slice(-8) : target.linkToken,
        resolverMode: "rosterOnly",
      });
      await coachSyncPutCompetitionAggregate(
        target.linkToken,
        target.parentWriterSecret,
        artifact,
        target.apiBaseUrl,
      );
      console.log("[COMP_AGG_TRACE] publish_ok", {
        sharedAthleteId: trimmed,
        putPath,
        kvKey,
        totalMatches: artifact.totalMatches,
        wins: artifact.wins,
        losses: artifact.losses,
      });
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: unknown }).status
          : null;
      console.log("[COMP_AGG_TRACE] publish_failed", {
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
