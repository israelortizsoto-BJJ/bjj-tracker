import { topologyPublishV2 } from "../../config/competitionTopologyFlags";
import {
  createCompetitionTopologyTraceId,
  logCompetitionTopologyTrace,
} from "../../dev/competitionTopologyTrace";
import { logCompPublishGuard, logCompSave } from "../../dev/competitionMutationDevLog";
import { recordParentPublishAudit } from "../../competition-state-auditor/coachSyncAuditWire";
import { generateCompetitionTransitionId } from "../../competition-state-auditor/generateCompetitionTransitionId";
import { peekActiveCompetitionTransition } from "../../competition-state-auditor/competitionTransitionContext";
import { resolveLinkedTargetForParentWriter } from "../../family/parentKidCompetitionDelete";
import { coachSyncPutCompetitionTopology } from "../../services/coachWeeklySyncApi";
import { buildCompetitionTopologyArtifact } from "./buildCompetitionTopologyArtifact";

/**
 * Fire-and-forget: publish a full parent-owned topology overwrite. Local saves never wait on sync.
 */
export function schedulePublishParentCompetitionTopology(
  sharedAthleteId: string,
  auditTransitionId?: string,
): void {
  const trimmed = sharedAthleteId.trim();
  if (!trimmed) return;
  const transitionId =
    auditTransitionId?.trim() ||
    peekActiveCompetitionTransition(trimmed) ||
    generateCompetitionTransitionId();
  const traceId = __DEV__ ? createCompetitionTopologyTraceId("parent-publish") : undefined;
  logCompetitionTopologyTrace("[COMP_TOPOLOGY_TRACE]", "publish_scheduled", {
    traceId,
    sharedAthleteId: trimmed,
  });
  if (!topologyPublishV2) {
    logCompPublishGuard({
      sharedAthleteId: trimmed,
      operationKind: "server",
      surface: "publishParentCompetitionTopology",
      phaseDetail: "topologyPublishV2_flag_off",
    });
    recordParentPublishAudit({
      sharedAthleteId: trimmed,
      transitionId,
      publishLane: "topology_put",
      publishOutcome: "skipped",
      skipReason: "topologyPublishV2_flag_off",
    });
    console.log("[COMP_TOPOLOGY_TRACE] publish_skipped_flag_off", {
      ...(traceId ? { traceId } : {}),
      sharedAthleteId: trimmed,
    });
    return;
  }

  void (async () => {
    logCompSave("PUBLISH", {
      sharedAthleteId: trimmed,
      operationKind: "server",
      surface: "publishParentCompetitionTopology",
      phaseDetail: "scheduled_fire_and_forget",
    });
    try {
      const target = await resolveLinkedTargetForParentWriter(trimmed, undefined, undefined, {
        requireAthleteOnSessionRoster: true,
      });
      if (!target) {
        logCompPublishGuard({
          sharedAthleteId: trimmed,
          operationKind: "server",
          surface: "publishParentCompetitionTopology",
          phaseDetail: "publish_skipped_no_linked_target_rosterOnly",
        });
        recordParentPublishAudit({
          sharedAthleteId: trimmed,
          transitionId,
          publishLane: "topology_put",
          publishOutcome: "skipped",
          skipReason: "publish_skipped_no_linked_target_rosterOnly",
        });
        console.log("[COMP_TOPOLOGY_TRACE] publish_skipped_no_linked_target", {
          sharedAthleteId: trimmed,
          resolverMode: "rosterOnly",
        });
        return;
      }

      const artifact = await buildCompetitionTopologyArtifact(trimmed, traceId);
      const totalMatches = artifact.competitions.reduce(
        (sum, competition) => sum + competition.matches.length,
        0,
      );
      console.log("[COMP_TOPOLOGY_TRACE]", {
        stage: "build_ok",
        ...(traceId ? { traceId } : {}),
        sharedAthleteId: trimmed,
        totalCompetitionCount: artifact.competitions.length,
        totalMatchCount: totalMatches,
        updatedAt: artifact.updatedAt,
      });
      const putPath = `/v1/sessions/${encodeURIComponent(target.linkToken)}/competition-topology`;
      console.log("[COMP_TOPOLOGY_TRACE]", {
        stage: "put_request_payload",
        ...(traceId ? { traceId } : {}),
        sharedAthleteId: trimmed,
        totalCompetitionCount: artifact.competitions.length,
        totalMatchCount: totalMatches,
        updatedAt: artifact.updatedAt,
      });
      console.log("[COMP_TOPOLOGY_TRACE] publish_attempt", {
        ...(traceId ? { traceId } : {}),
        sharedAthleteId: trimmed,
        operation: "PUT",
        putPath,
        apiBaseUrl: target.apiBaseUrl,
        linkTokenTail:
          target.linkToken.length > 8 ? target.linkToken.slice(-8) : target.linkToken,
        competitionCount: artifact.competitions.length,
        totalMatches,
        lineageKeyCount: totalMatches,
        updatedAt: artifact.updatedAt,
      });
      for (const competition of artifact.competitions) {
        console.log("[COACH_TOPOLOGY_MATCH_TRACE]", {
          stage: "parent_topology_publish",
          sharedCompetitionId: competition.sharedCompetitionId,
          updatedAt: artifact.updatedAt,
          matchCount: competition.matches.length,
          firstFiveMatchIds: competition.matches
            .slice(0, 5)
            .map((match) => match.matchLineageKey),
          firstFiveMatchResults: competition.matches.slice(0, 5).map((match) => match.result),
        });
      }
      await coachSyncPutCompetitionTopology(
        target.linkToken,
        target.parentWriterSecret,
        artifact,
        target.apiBaseUrl,
        traceId,
        transitionId,
      );
      logCompSave("COMPLETE", {
        sharedAthleteId: trimmed,
        operationKind: "server",
        surface: "publishParentCompetitionTopology",
        canonicalPayloadIds: artifact.competitions.map((c) => c.sharedCompetitionId),
        overlayCount: totalMatches,
      });
      console.log("[COMP_TOPOLOGY_TRACE] publish_ok", {
        ...(traceId ? { traceId } : {}),
        sharedAthleteId: trimmed,
        competitionCount: artifact.competitions.length,
        totalMatches,
        updatedAt: artifact.updatedAt,
      });
      console.log("[COMP_TOPOLOGY_TRACE]", {
        stage: "put_http_ok",
        ...(traceId ? { traceId } : {}),
        sharedAthleteId: trimmed,
        totalCompetitionCount: artifact.competitions.length,
        totalMatchCount: totalMatches,
        updatedAt: artifact.updatedAt,
      });
    } catch (error) {
      logCompSave("ERROR", {
        sharedAthleteId: trimmed,
        operationKind: "server",
        surface: "publishParentCompetitionTopology",
        error: error instanceof Error ? error.message : String(error),
      });
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: unknown }).status
          : null;
      recordParentPublishAudit({
        sharedAthleteId: trimmed,
        transitionId,
        publishLane: "topology_put",
        publishOutcome: "error",
        httpStatus: typeof status === "number" ? status : null,
        skipReason: error instanceof Error ? error.message : String(error),
      });
      console.log("[COMP_TOPOLOGY_TRACE] publish_failed", {
        traceId,
        sharedAthleteId: trimmed,
        error: error instanceof Error ? error.message : String(error),
        httpStatus: status,
      });
      console.log("[COMP_TOPOLOGY_TRACE]", {
        stage: "put_http_failed",
        traceId,
        sharedAthleteId: trimmed,
        totalCompetitionCount: null,
        totalMatchCount: null,
        updatedAt: null,
        error: error instanceof Error ? error.message : String(error),
        httpStatus: status,
      });
    }
  })();
}
