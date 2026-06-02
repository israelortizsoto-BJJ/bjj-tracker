import { topologyPublishV2 } from "../../config/competitionTopologyFlags";
import { resolveLinkedTargetForParentWriter } from "../../family/parentKidCompetitionDelete";
import { coachSyncPutCompetitionTopology } from "../../services/coachWeeklySyncApi";
import { buildCompetitionTopologyArtifact } from "./buildCompetitionTopologyArtifact";

/**
 * Fire-and-forget: publish a full parent-owned topology overwrite. Local saves never wait on sync.
 */
export function schedulePublishParentCompetitionTopology(sharedAthleteId: string): void {
  const trimmed = sharedAthleteId.trim();
  if (!trimmed) return;
  if (!topologyPublishV2) {
    console.log("[COMP_TOPOLOGY_TRACE] publish_skipped_flag_off", {
      sharedAthleteId: trimmed,
    });
    return;
  }

  void (async () => {
    try {
      const target = await resolveLinkedTargetForParentWriter(trimmed, undefined, undefined, {
        requireAthleteOnSessionRoster: true,
      });
      if (!target) {
        console.log("[COMP_TOPOLOGY_TRACE] publish_skipped_no_linked_target", {
          sharedAthleteId: trimmed,
          resolverMode: "rosterOnly",
        });
        return;
      }

      const artifact = await buildCompetitionTopologyArtifact(trimmed);
      const totalMatches = artifact.competitions.reduce(
        (sum, competition) => sum + competition.matches.length,
        0,
      );
      const putPath = `/v1/sessions/${encodeURIComponent(target.linkToken)}/competition-topology`;
      console.log("[COMP_TOPOLOGY_TRACE] publish_attempt", {
        sharedAthleteId: trimmed,
        operation: "PUT",
        putPath,
        apiBaseUrl: target.apiBaseUrl,
        linkTokenTail:
          target.linkToken.length > 8 ? target.linkToken.slice(-8) : target.linkToken,
        competitionCount: artifact.competitions.length,
        totalMatches,
        updatedAt: artifact.updatedAt,
      });
      await coachSyncPutCompetitionTopology(
        target.linkToken,
        target.parentWriterSecret,
        artifact,
        target.apiBaseUrl,
      );
      console.log("[COMP_TOPOLOGY_TRACE] publish_ok", {
        sharedAthleteId: trimmed,
        competitionCount: artifact.competitions.length,
        totalMatches,
        updatedAt: artifact.updatedAt,
      });
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: unknown }).status
          : null;
      console.log("[COMP_TOPOLOGY_TRACE] publish_failed", {
        sharedAthleteId: trimmed,
        error: error instanceof Error ? error.message : String(error),
        httpStatus: status,
      });
    }
  })();
}
