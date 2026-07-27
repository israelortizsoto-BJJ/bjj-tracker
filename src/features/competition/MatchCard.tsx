import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatSubmissionTimeDisplay } from "../../domain/competition/matchDurationFormat";
import { logBreakdownPropagationForMatch } from "../../domain/competition/competitionProjectionBreakdownTrace";
import { logCoachMediaCorridorTrace } from "../../dev/coachMediaCorridorTrace";
import { getCoachMatchMediaAttachment } from "../../storage/coachMatchMediaAttachmentStore";
import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { SyncedMatchMediaAttachmentProjection } from "../../types/coachWeeklySync";
import { labelForSubmissionTypeKey } from "./submissionTypes";

const FEED = {
  panel: "#181b1f",
  panel2: "#20242a",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  win: "#eaff9d",
  loss: "#ffc7ca",
  radius: 6,
};

function videoLabel(snapshot: CompetitionDetailMatchSnapshot): string {
  const u = typeof snapshot.videoUri === "string" ? snapshot.videoUri.trim() : "";
  return u.length > 0 ? "Attached" : "None";
}

function formatCommentaryDuration(durationMs: number | undefined): string | null {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) return null;
  const totalSec = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** PD-FR-001: Match Card Listen CTA launches dedicated Film Room (not inline playback). */
export function buildFilmRoomHref(input: {
  matchLineageKey: string;
  matchIndex: number;
  sharedAthleteId?: string;
  sharedCompetitionId?: string;
  mediaId?: string;
  coachNote?: string;
  videoUri?: string | null;
  durationMs?: number;
  /** Hydrated Coach Shared Match Media identity only — never a signed URL. */
  matchMediaAssetId?: string;
  expectedRevision?: number;
  alignment?: CompetitionDetailMatchSnapshot["alignment"];
}): Href {
  const params = new URLSearchParams();
  params.set("matchLineageKey", input.matchLineageKey);
  params.set("matchIndex", String(input.matchIndex));
  if (input.sharedAthleteId?.trim()) params.set("sharedAthleteId", input.sharedAthleteId.trim());
  if (input.sharedCompetitionId?.trim()) {
    params.set("sharedCompetitionId", input.sharedCompetitionId.trim());
  }
  if (input.mediaId?.trim()) params.set("mediaId", input.mediaId.trim());
  if (input.coachNote?.trim()) params.set("coachNote", input.coachNote.trim());
  // Local/legacy Parent URI only. Coach Shared Match Media uses identity params below.
  const videoUri = input.videoUri?.trim();
  if (videoUri && !input.matchMediaAssetId?.trim()) params.set("videoUri", videoUri);
  if (input.durationMs !== undefined && Number.isFinite(input.durationMs)) {
    params.set("durationMs", String(input.durationMs));
  }
  if (input.alignment) {
    params.set("commentaryStartVideoMs", String(input.alignment.commentaryStartVideoMs));
    params.set("commentaryMatchMediaAssetId", input.alignment.matchMediaAssetId);
    params.set("commentaryAttachmentRevision", String(input.alignment.attachmentRevision));
  }
  const matchMediaAssetId = input.matchMediaAssetId?.trim() ?? "";
  if (
    matchMediaAssetId &&
    input.expectedRevision !== undefined &&
    Number.isSafeInteger(input.expectedRevision) &&
    input.expectedRevision >= 1
  ) {
    params.set("matchMediaAssetId", matchMediaAssetId);
    params.set("expectedRevision", String(input.expectedRevision));
  }
  return `/competition/film-room?${params.toString()}` as Href;
}

export function MatchCard({
  snapshot,
  index,
  sharedAthleteId = "",
  sharedCompetitionId = "",
  overlaySource = "render_snapshot",
}: {
  snapshot: CompetitionDetailMatchSnapshot;
  index: number;
  sharedAthleteId?: string;
  sharedCompetitionId?: string;
  overlaySource?: string;
}) {
  const won = snapshot.matchResult === "win";
  const [coachBreakdownExpanded, setCoachBreakdownExpanded] = useState(false);
  const [matchMediaAttachment, setMatchMediaAttachment] =
    useState<SyncedMatchMediaAttachmentProjection | null>(null);
  const coachBreakdown = snapshot.coachNote?.trim() ?? "";
  const mediaId = snapshot.mediaId?.trim() ?? "";
  const durationLabel = formatCommentaryDuration(snapshot.durationMs);
  const attachedMatchMedia =
    matchMediaAttachment?.state === "attached" ? matchMediaAttachment : null;
  const tombstonedMatchMedia =
    matchMediaAttachment?.state === "tombstoned" ? matchMediaAttachment : null;
  // Prefer the canonical Shared Match Media attachment when available. The
  // established Match Breakdown route remains available for hydrated coach media.
  // A device-local videoUri alone never authorizes either route.
  const canOpenSharedFilmRoom = Boolean(attachedMatchMedia);
  const canOpenLegacyFilmRoom = Boolean(mediaId);
  const canOpenFilmRoom = canOpenSharedFilmRoom || canOpenLegacyFilmRoom;

  useEffect(() => {
    const athleteId = sharedAthleteId.trim();
    const competitionId = sharedCompetitionId.trim();
    const lineage = snapshot.id.trim();
    if (!athleteId || !competitionId || !lineage) {
      setMatchMediaAttachment(null);
      return;
    }
    let cancelled = false;
    void getCoachMatchMediaAttachment({
      sharedAthleteId: athleteId,
      sharedCompetitionId: competitionId,
      matchLineageKey: lineage,
    }).then((row) => {
      logCoachMediaCorridorTrace("MATCH_MEDIA_SELECTOR_RESULT", {
        sharedAthleteId: athleteId,
        sharedCompetitionId: competitionId,
        matchLineageKey: lineage,
        attachmentState: row?.state ?? null,
        attachmentRevision: row?.revision ?? null,
        matchMediaAssetId: row?.state === "attached" ? row.matchMediaAssetId : null,
        canOpenFilmRoom: row?.state === "attached",
      });
      if (!cancelled) setMatchMediaAttachment(row);
    });
    return () => {
      cancelled = true;
    };
  }, [sharedAthleteId, sharedCompetitionId, snapshot.id]);

  logBreakdownPropagationForMatch({
    stage: "match_card_render",
    sharedCompetitionId,
    matchLineageKey: snapshot.id,
    overlaySource,
    source: snapshot,
  });

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: coachBreakdown
      ? "competition_detail_match_card_overlay_visible"
      : "competition_detail_match_card_overlay_hidden",
    matchId: snapshot.id,
    matchLineageKey: snapshot.id,
    slotKey: (() => {
      const slotMatch = /-slot-(\d+)$/.exec(snapshot.id.trim());
      return slotMatch ? `slot-${slotMatch[1]}` : null;
    })(),
    index,
    hasCoachNote: Boolean(coachBreakdown),
    hasMediaId: Boolean(mediaId),
    coachNotePreview: coachBreakdown ? coachBreakdown.slice(0, 40) : null,
  });
  if (coachBreakdown || mediaId || attachedMatchMedia) {
    logCoachMediaCorridorTrace("MATCHCARD_RENDER", {
      // MatchCard has no coach-save corridor traceId; correlate via lineage keys.
      traceId: null,
      sharedAthleteId: sharedAthleteId || null,
      sharedCompetitionId: sharedCompetitionId || null,
      matchLineageKey: snapshot.id,
      hasCoachNote: Boolean(coachBreakdown),
      hasMediaId: Boolean(mediaId),
      mediaId: mediaId || null,
    });
  }

  const methodLines: string[] = [];
  const submissionTimeDisplay = formatSubmissionTimeDisplay(snapshot.submissionTime);
  if (snapshot.outcome) {
    if (snapshot.outcome === "Submission" && submissionTimeDisplay) {
      methodLines.push(`${snapshot.outcome} · ${submissionTimeDisplay}`);
    } else {
      methodLines.push(snapshot.outcome);
    }
  }
  const subLabel = labelForSubmissionTypeKey(
    typeof snapshot.submissionType === "string" ? snapshot.submissionType : null,
  );

  const openFilmRoom = () => {
    if (!canOpenFilmRoom) return;
    router.push(
      buildFilmRoomHref({
        matchLineageKey: snapshot.id,
        matchIndex: index,
        sharedAthleteId,
        sharedCompetitionId,
        mediaId,
        coachNote: coachBreakdown,
        videoUri: attachedMatchMedia ? null : snapshot.videoUri,
        durationMs: snapshot.durationMs,
        matchMediaAssetId: attachedMatchMedia?.matchMediaAssetId,
        expectedRevision: attachedMatchMedia?.revision,
        alignment: snapshot.alignment,
      }),
    );
  };

  return (
    <View style={styles.match}>
      <View style={styles.row}>
        <Text style={styles.matchTitle}>Match {index + 1}</Text>
        {snapshot.matchResult === null ? (
          <View style={[styles.pill, styles.pillUnknown]}>
            <Text style={styles.pillText}>—</Text>
          </View>
        ) : (
          <View style={[styles.pill, won ? styles.pillWin : styles.pillLoss]}>
            <Text style={[styles.pillText, won ? styles.pillWinText : styles.pillLossText]}>
              {won ? "Win" : "Loss"}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.matchFields}>
        <View style={styles.matchField}>
          <Text style={styles.label}>How it ended</Text>
          <Text style={styles.value}>{methodLines.length ? methodLines.join("\n") : "None"}</Text>
        </View>
        <View style={styles.matchField}>
          <Text style={styles.label}>Submission type</Text>
          <Text style={styles.value}>
            {snapshot.outcome === "Submission" ? subLabel ?? "—" : "—"}
          </Text>
        </View>
        <View style={styles.matchField}>
          <Text style={styles.label}>Submission time</Text>
          <Text style={styles.value}>
            {snapshot.outcome === "Submission" ? submissionTimeDisplay || "None" : "—"}
          </Text>
        </View>
        <View style={styles.matchField}>
          <Text style={styles.label}>Image</Text>
          <Text style={styles.value}>
            {typeof snapshot.imageUri === "string" && snapshot.imageUri.trim().length > 0
              ? "Attached"
              : "None"}
          </Text>
        </View>
        <View style={styles.matchField}>
          <Text style={styles.label}>Video</Text>
          <Text style={styles.value}>
            {tombstonedMatchMedia
              ? "Video removed"
              : attachedMatchMedia
                ? "Attached"
                : videoLabel(snapshot)}
          </Text>
        </View>
      </View>
      {coachBreakdown || canOpenFilmRoom ? (
        <View style={styles.coachSection}>
          <Text style={styles.coachLabel}>Coach Match Breakdown</Text>
          {canOpenFilmRoom ? (
            <View style={styles.commentaryControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Watch Coach Match Breakdown for match ${index + 1}`}
                onPress={openFilmRoom}
                style={({ pressed }) => [
                  styles.listenButton,
                  pressed ? styles.listenButtonPressed : null,
                ]}
              >
                <Text style={styles.listenButtonText}>▶ Watch Coach Match Breakdown</Text>
              </Pressable>
              {durationLabel ? (
                <Text style={styles.durationText}>⏱ {durationLabel}</Text>
              ) : null}
            </View>
          ) : null}
          {coachBreakdown ? (
            <>
              <Text
                numberOfLines={coachBreakdownExpanded ? undefined : 3}
                style={styles.coachText}
              >
                {coachBreakdown}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${coachBreakdownExpanded ? "Collapse" : "Read more"} coach match breakdown for match ${index + 1}`}
                onPress={() => setCoachBreakdownExpanded((expanded) => !expanded)}
                style={({ pressed }) => [styles.readMore, pressed ? styles.readMorePressed : null]}
              >
                <Text style={styles.readMoreText}>
                  {coachBreakdownExpanded ? "Show Less" : "Read More"}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  match: {
    padding: 11,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  matchTitle: {
    color: FEED.text,
    fontSize: 14,
    fontWeight: "900",
  },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: FEED.radius,
    borderWidth: 1,
  },
  pillUnknown: {
    borderColor: FEED.line,
  },
  pillWin: {
    borderColor: "rgba(214, 255, 63, 0.32)",
  },
  pillLoss: {
    borderColor: "rgba(216, 77, 85, 0.34)",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    color: FEED.muted,
  },
  pillWinText: {
    color: FEED.win,
  },
  pillLossText: {
    color: FEED.loss,
  },
  matchFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  matchField: {
    width: "48%",
    padding: 8,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel,
  },
  label: {
    marginTop: 3,
    color: FEED.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  value: {
    marginTop: 4,
    color: FEED.text,
    fontSize: 13,
    fontWeight: "900",
  },
  coachSection: {
    marginTop: 9,
    padding: 10,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel,
  },
  coachLabel: {
    color: FEED.text,
    fontSize: 12,
    fontWeight: "900",
  },
  commentaryControls: {
    marginTop: 8,
    gap: 4,
  },
  listenButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  listenButtonPressed: {
    opacity: 0.76,
  },
  listenButtonText: {
    color: FEED.text,
    fontSize: 12,
    fontWeight: "900",
  },
  durationText: {
    color: FEED.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  coachText: {
    marginTop: 7,
    color: FEED.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  readMore: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 4,
  },
  readMorePressed: {
    opacity: 0.76,
  },
  readMoreText: {
    color: FEED.text,
    fontSize: 12,
    fontWeight: "900",
  },
});
