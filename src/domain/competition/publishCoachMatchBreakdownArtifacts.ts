import { dedupeActiveCoachWriterLinks } from "../../coachShare/coachLinkBinding";
import { normalizeInviteLinkToken } from "../../coachShare/inviteLinkToken";
import { coachSyncPutCoachMatchBreakdownArtifacts } from "../../services/coachWeeklySyncApi";
import { getCoachLinks } from "../../storage/coachShareStore";
import { getKidsById } from "../../storage/coachKidStore";
import { buildCoachMatchBreakdownArtifacts } from "./buildCoachMatchBreakdownArtifacts";

export function schedulePublishCoachMatchBreakdownArtifacts(input: {
  sharedAthleteId: string;
  kidId?: string | null;
  updatedAtOverride?: string | null;
}): void {
  const sharedAthleteId = input.sharedAthleteId.trim();
  if (!sharedAthleteId) return;

  void (async () => {
    try {
      const [links, kidsById] = await Promise.all([getCoachLinks(), getKidsById()]);
      const writerLinks = dedupeActiveCoachWriterLinks(links);
      const kid = input.kidId ? kidsById[input.kidId] : null;
      const kidToken = normalizeInviteLinkToken(kid?.sharedFromInviteTokenNorm ?? "");
      const target =
        writerLinks.find((link) => {
          const sync = link.weeklySync;
          if (!sync?.writerSecret?.trim()) return false;
          if (!kidToken) return false;
          return normalizeInviteLinkToken(sync.linkToken) === kidToken;
        }) ??
        (kidToken
          ? null
          : writerLinks.find((link) => Boolean(link.weeklySync?.writerSecret?.trim())) ?? null);

      if (!target?.weeklySync?.writerSecret?.trim()) {
        console.log("[COACH_OVERLAY_SYNC_TRACE]", {
          stage: "coach_overlay_publish_skipped_no_writer_target",
          sharedAthleteId,
          kidId: input.kidId ?? null,
          writerLinkCount: writerLinks.length,
          kidToken: kidToken || null,
        });
        return;
      }

      const artifactSet = await buildCoachMatchBreakdownArtifacts(sharedAthleteId, {
        updatedAtOverride: input.updatedAtOverride ?? null,
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

      await coachSyncPutCoachMatchBreakdownArtifacts(
        target.weeklySync.linkToken,
        target.weeklySync.writerSecret,
        artifactSet,
        target.weeklySync.apiBaseUrl,
      );

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
      console.log("[COACH_OVERLAY_SYNC_TRACE]", {
        stage: "coach_overlay_publish_failed",
        sharedAthleteId,
        error: error instanceof Error ? error.message : String(error),
        httpStatus: status,
      });
    }
  })();
}
