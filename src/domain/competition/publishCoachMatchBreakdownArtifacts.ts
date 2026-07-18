import { dedupeActiveCoachWriterLinks } from "../../coachShare/coachLinkBinding";
import { normalizeInviteLinkToken } from "../../coachShare/inviteLinkToken";
import { createOverlayForensicTraceId } from "../../dev/overlayForensicTrace";
import {
  inviteTokenSuffix,
  logMatchBreakdownAuthorityTrace,
} from "../../dev/matchBreakdownAuthorityTrace";
import { logMatchBreakdownBoundaryProbe } from "../../dev/matchBreakdownBoundaryProbe";
import { coachSyncPutCoachMatchBreakdownArtifacts } from "../../services/coachWeeklySyncApi";
import { getCoachLinks } from "../../storage/coachShareStore";
import { getKidsById } from "../../storage/coachKidStore";
import { bestEffortUploadCoachCommentaryMedia } from "./bestEffortUploadCoachCommentaryMedia";
import { buildCoachMatchBreakdownArtifacts } from "./buildCoachMatchBreakdownArtifacts";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../../types/coachWeeklySync";

export function schedulePublishCoachMatchBreakdownArtifacts(input: {
  sharedAthleteId: string;
  kidId?: string | null;
  updatedAtOverride?: string | null;
  traceId?: string | null;
}): void {
  const sharedAthleteId = input.sharedAthleteId.trim();
  if (!sharedAthleteId) return;

  void (async () => {
    let traceId = input.traceId?.trim() || "";
    let probeArtifactSet: SyncedCoachMatchBreakdownArtifactSet | null = null;
    try {
      const [links, kidsById] = await Promise.all([getCoachLinks(), getKidsById()]);
      const writerLinks = dedupeActiveCoachWriterLinks(links);
      const kid = input.kidId ? kidsById[input.kidId] : null;
      const kidToken = normalizeInviteLinkToken(kid?.sharedFromInviteTokenNorm ?? "");
      const matchedLink =
        writerLinks.find((link) => {
          const sync = link.weeklySync;
          if (!sync?.writerSecret?.trim()) return false;
          if (!kidToken) return false;
          return normalizeInviteLinkToken(sync.linkToken) === kidToken;
        }) ?? null;
      const target =
        matchedLink ??
        (kidToken
          ? null
          : writerLinks.find((link) => Boolean(link.weeklySync?.writerSecret?.trim())) ?? null);

      if (!target?.weeklySync?.writerSecret?.trim()) {
        if (!traceId) {
          traceId = createOverlayForensicTraceId(sharedAthleteId);
        }
        const publishSkipReason = !kidToken
          ? "missing_kid_invite_token"
          : writerLinks.length === 0
            ? "no_writer_links"
            : "kid_token_no_matching_writer_link";
        logMatchBreakdownAuthorityTrace("PUBLISH_TARGET_RESOLUTION", {
          traceId,
          sharedAthleteId,
          kidSharedFromInviteTokenNorm: kidToken || null,
          resolvedWriterTokenSuffix: null,
          matchedLinkTokenSuffix: matchedLink
            ? inviteTokenSuffix(matchedLink.weeklySync!.linkToken)
            : null,
          publishSkipped: true,
          publishSkipReason,
          writerLinkCount: writerLinks.length,
        });
        console.log("[COACH_OVERLAY_SYNC_TRACE]", {
          stage: "coach_overlay_publish_skipped_no_writer_target",
          sharedAthleteId,
          kidId: input.kidId ?? null,
          writerLinkCount: writerLinks.length,
          kidToken: kidToken || null,
        });
        logMatchBreakdownBoundaryProbe({
          probeId: "B3",
          outcome: "fail",
          deviceRole: "coach",
          traceId,
          sharedAthleteId,
          sharedCompetitionId: null,
          matchLineageKey: null,
          artifactCount: 0,
          publishAttempted: false,
          publishSkipReason,
          httpStatus: null,
          resolvedWriterTokenSuffix: null,
          latencyMs: null,
        });
        return;
      }

      if (!traceId) {
        traceId = createOverlayForensicTraceId(sharedAthleteId);
      }
      const resolvedWriterTokenSuffix = inviteTokenSuffix(target.weeklySync.linkToken);
      logMatchBreakdownAuthorityTrace("PUBLISH_TARGET_RESOLUTION", {
        traceId,
        sharedAthleteId,
        kidSharedFromInviteTokenNorm: kidToken || null,
        resolvedWriterTokenSuffix,
        matchedLinkTokenSuffix: matchedLink
          ? inviteTokenSuffix(matchedLink.weeklySync!.linkToken)
          : resolvedWriterTokenSuffix,
        publishSkipped: false,
        publishSkipReason: null,
        writerLinkCount: writerLinks.length,
        inviteTokenSuffix: resolvedWriterTokenSuffix,
      });
      console.log("[OVERLAY_FORENSIC]", {
        stage: "publish_schedule_begin",
        traceId,
        timestamp: new Date().toISOString(),
        sourceFile: "publishCoachMatchBreakdownArtifacts.ts",
        sharedAthleteId,
        kidId: input.kidId ?? null,
        resolvedWriterTokenSuffix,
      });
      // Best-effort audio upload before artifact build. Transcript publish continues on failure.
      try {
        const uploadSummary = await bestEffortUploadCoachCommentaryMedia({
          sharedAthleteId,
          linkToken: target.weeklySync.linkToken,
          writerSecret: target.weeklySync.writerSecret,
          apiBaseUrl: target.weeklySync.apiBaseUrl,
          traceId,
        });
        console.log("[COACH_MEDIA_TRACE]", {
          stage: "coach_media_upload_batch",
          sharedAthleteId,
          attempted: uploadSummary.attempted,
          uploaded: uploadSummary.uploaded,
          traceId,
        });
      } catch (uploadError) {
        console.log("[COACH_MEDIA_TRACE]", {
          stage: "coach_media_upload_batch_failed",
          sharedAthleteId,
          traceId,
          error: uploadError instanceof Error ? uploadError.message : String(uploadError),
        });
      }
      const artifactSet = await buildCoachMatchBreakdownArtifacts(sharedAthleteId, {
        updatedAtOverride: input.updatedAtOverride ?? null,
        traceId,
      });
      probeArtifactSet = artifactSet;
      console.log("[OVERLAY_FORENSIC]", {
        stage: "publish_schedule_payload",
        traceId,
        timestamp: new Date().toISOString(),
        sourceFile: "publishCoachMatchBreakdownArtifacts.ts",
        sharedAthleteId,
        sharedCompetitionId: artifactSet.artifacts[0]?.sharedCompetitionId ?? null,
        matchLineageKey: artifactSet.artifacts[0]?.matchLineageKey ?? null,
        artifactCount: artifactSet.artifacts.length,
        sharedCompetitionIds: [
          ...new Set(artifactSet.artifacts.map((artifact) => artifact.sharedCompetitionId)),
        ],
        lineageIds: artifactSet.artifacts.map((artifact) => artifact.matchLineageKey),
      });
      console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
        stage: "coach_publish_request",
        sharedAthleteId,
        sharedCompetitionId: artifactSet.artifacts[0]?.sharedCompetitionId ?? null,
        matchLineageKey: artifactSet.artifacts[0]?.matchLineageKey ?? null,
        overlayCount: artifactSet.artifacts.length,
        artifacts: artifactSet.artifacts.map((artifact) => ({
          sharedAthleteId: artifact.sharedAthleteId,
          sharedCompetitionId: artifact.sharedCompetitionId,
          matchLineageKey: artifact.matchLineageKey,
          hasCoachNote: Boolean(artifact.coachNote?.trim()),
        })),
      });
      console.log("[COACH_OVERLAY_SYNC_TRACE]", {
        stage: "coach_overlay_publish_attempt",
        sharedAthleteId,
        artifactCount: artifactSet.artifacts.length,
        sharedCompetitionIds: [
          ...new Set(artifactSet.artifacts.map((artifact) => artifact.sharedCompetitionId)),
        ],
        lineageIds: artifactSet.artifacts.map((artifact) => artifact.matchLineageKey),
      });

      const putStartedAt = Date.now();
      await coachSyncPutCoachMatchBreakdownArtifacts(
        target.weeklySync.linkToken,
        target.weeklySync.writerSecret,
        artifactSet,
        target.weeklySync.apiBaseUrl,
        traceId,
      );
      const targetArtifact =
        artifactSet.artifacts.find((artifact) => Boolean(artifact.coachNote?.trim())) ??
        artifactSet.artifacts[0] ??
        null;
      logMatchBreakdownBoundaryProbe({
        probeId: "B3",
        outcome: "pass",
        deviceRole: "coach",
        traceId,
        sharedAthleteId,
        sharedCompetitionId: targetArtifact?.sharedCompetitionId ?? null,
        matchLineageKey: targetArtifact?.matchLineageKey ?? null,
        artifactCount: artifactSet.artifacts.length,
        publishAttempted: true,
        publishSkipReason: null,
        httpStatus: 200,
        resolvedWriterTokenSuffix,
        latencyMs: Date.now() - putStartedAt,
      });

      console.log("[COACH_OVERLAY_SYNC_TRACE]", {
        stage: "coach_overlay_publish_ok",
        sharedAthleteId,
        artifactCount: artifactSet.artifacts.length,
        lineageIds: artifactSet.artifacts.map((artifact) => artifact.matchLineageKey),
      });
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: unknown }).status
          : null;
      const targetArtifactForProbe =
        probeArtifactSet?.artifacts.find((artifact) => Boolean(artifact.coachNote?.trim())) ??
        probeArtifactSet?.artifacts[0] ??
        null;
      logMatchBreakdownBoundaryProbe({
        probeId: "B3",
        outcome: "fail",
        deviceRole: "coach",
        traceId: traceId || null,
        sharedAthleteId,
        sharedCompetitionId: targetArtifactForProbe?.sharedCompetitionId ?? null,
        matchLineageKey: targetArtifactForProbe?.matchLineageKey ?? null,
        artifactCount: probeArtifactSet?.artifacts.length ?? 0,
        publishAttempted: probeArtifactSet != null,
        publishSkipReason: null,
        httpStatus: typeof status === "number" ? status : null,
        resolvedWriterTokenSuffix: null,
        latencyMs: null,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log("[COACH_OVERLAY_SYNC_TRACE]", {
        stage: "coach_overlay_publish_failed",
        sharedAthleteId,
        error: error instanceof Error ? error.message : String(error),
        httpStatus: status,
      });
    }
  })();
}
