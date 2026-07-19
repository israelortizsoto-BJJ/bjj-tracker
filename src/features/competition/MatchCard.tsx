import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatSubmissionTimeDisplay } from "../../domain/competition/matchDurationFormat";
import { logBreakdownPropagationForMatch } from "../../domain/competition/competitionProjectionBreakdownTrace";
import { logCoachMediaCorridorTrace } from "../../dev/coachMediaCorridorTrace";
import { coachSyncResolveCoachMedia } from "../../services/coachMediaApi";
import { resolveCoachMediaSessionTarget } from "../../services/resolveParentCoachMediaSessionTarget";
import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
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
  const [playbackState, setPlaybackState] = useState<"idle" | "loading" | "playing" | "paused">(
    "idle",
  );
  const soundRef = useRef<Audio.Sound | null>(null);
  const playableUrlRef = useRef<string | null>(null);
  const coachBreakdown = snapshot.coachNote?.trim() ?? "";
  const mediaId = snapshot.mediaId?.trim() ?? "";
  const durationLabel = formatCommentaryDuration(snapshot.durationMs);

  logBreakdownPropagationForMatch({
    stage: "match_card_render",
    sharedCompetitionId,
    matchLineageKey: snapshot.id,
    overlaySource,
    source: snapshot,
  });

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: coachBreakdown ? "competition_detail_match_card_overlay_visible" : "competition_detail_match_card_overlay_hidden",
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
  if (coachBreakdown || mediaId) {
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

  const playbackStatusLoggedRef = useRef(false);

  const unloadPlayback = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    playableUrlRef.current = null;
    playbackStatusLoggedRef.current = false;
    setPlaybackState("idle");
    if (!sound) return;
    try {
      await sound.stopAsync();
    } catch {
      // ignore
    }
    try {
      await sound.unloadAsync();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      void unloadPlayback();
    };
  }, [unloadPlayback]);

  useEffect(() => {
    void unloadPlayback();
  }, [mediaId, unloadPlayback]);

  const toggleCoachCommentaryPlayback = useCallback(async () => {
    // Stage 1 — PLAYBACK_BEGIN (instrumentation only)
    const logPlayback = (payload: Record<string, unknown>) => {
      console.log("[PLAYBACK_FORENSICS]", payload);
      try {
        const g = globalThis as typeof globalThis & {
          __PLAYBACK_FORENSICS_LOG__?: Array<Record<string, unknown>>;
        };
        if (!Array.isArray(g.__PLAYBACK_FORENSICS_LOG__)) g.__PLAYBACK_FORENSICS_LOG__ = [];
        g.__PLAYBACK_FORENSICS_LOG__.push({
          ...payload,
          ts: new Date().toISOString(),
        });
      } catch {
        // ignore ring-buffer failures
      }
    };
    logPlayback({
      stage: "PLAYBACK_BEGIN",
      mediaId: mediaId || null,
      currentPlaybackState: playbackState,
      hasSound: Boolean(soundRef.current),
      isPlaying: playbackState === "playing",
    });

    if (!mediaId) {
      logPlayback( { stage: "PLAYBACK_RETURN_NO_MEDIA_ID" });
      return;
    }
    if (playbackState === "playing" && soundRef.current) {
      await soundRef.current.pauseAsync();
      setPlaybackState("paused");
      logPlayback( { stage: "PLAYBACK_RETURN_PAUSE" });
      return;
    }
    if (playbackState === "paused" && soundRef.current) {
      await soundRef.current.playAsync();
      setPlaybackState("playing");
      logPlayback( { stage: "PLAYBACK_RETURN_RESUME" });
      return;
    }

    setPlaybackState("loading");
    let failingBoundary: "target" | "resolve" | "audio" = "target";
    try {
      // Stage 2 — resolveCoachMediaSessionTarget
      logPlayback( { stage: "PLAYBACK_TARGET_BEGIN" });
      const targetStartedAt = Date.now();
      const target = await resolveCoachMediaSessionTarget();
      if (!target) {
        logPlayback( {
          stage: "PLAYBACK_TARGET_NULL",
          elapsedMs: Date.now() - targetStartedAt,
        });
        logPlayback( { stage: "PLAYBACK_RETURN_NO_LINK" });
        setPlaybackState("idle");
        return;
      }
      logPlayback( {
        stage: "PLAYBACK_TARGET_END",
        success: true,
        linkToken: target.linkToken,
        apiBaseUrl: target.apiBaseUrl,
        elapsedMs: Date.now() - targetStartedAt,
      });

      // Stage 3 — coachSyncResolveCoachMedia (HTTP/JSON stages logged inside API)
      failingBoundary = "resolve";
      logPlayback( {
        stage: "PLAYBACK_RESOLVE_BEGIN",
        mediaId,
        linkToken: target.linkToken,
      });
      const resolved = await coachSyncResolveCoachMedia(
        target.linkToken,
        mediaId,
        target.apiBaseUrl,
      );
      // Ephemeral playable URL — never written into the Match Breakdown artifact.
      const previous = soundRef.current;
      soundRef.current = null;
      if (previous) {
        try {
          await previous.stopAsync();
        } catch {
          // ignore
        }
        try {
          await previous.unloadAsync();
        } catch {
          // ignore
        }
      }
      playableUrlRef.current = resolved.url;

      // Stage 4 — Audio.Sound.createAsync
      failingBoundary = "audio";
      let resolvedUrlHost: string | null = null;
      try {
        resolvedUrlHost = new URL(resolved.url).host;
      } catch {
        resolvedUrlHost = null;
      }
      logPlayback( {
        stage: "PLAYBACK_AUDIO_CREATE_BEGIN",
        hasResolvedUrl: Boolean(resolved.url?.trim()),
        urlHost: resolvedUrlHost,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: resolved.url },
        { shouldPlay: true },
      );
      logPlayback( { stage: "PLAYBACK_AUDIO_CREATE_SUCCESS" });
      soundRef.current = sound;
      playbackStatusLoggedRef.current = false;
      sound.setOnPlaybackStatusUpdate((status) => {
        // Stage 5 — first status callback only
        if (!playbackStatusLoggedRef.current) {
          playbackStatusLoggedRef.current = true;
          logPlayback( {
            stage: "PLAYBACK_STATUS",
            isLoaded: status.isLoaded,
            isPlaying: status.isLoaded ? status.isPlaying : null,
            positionMillis: status.isLoaded ? status.positionMillis : null,
            durationMillis: status.isLoaded ? status.durationMillis : null,
            didJustFinish: status.isLoaded ? status.didJustFinish : null,
            error: status.isLoaded ? null : (status.error ?? null),
          });
        }
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setPlaybackState("idle");
          void sound.unloadAsync().catch(() => undefined);
          if (soundRef.current === sound) soundRef.current = null;
        }
      });
      setPlaybackState("playing");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack ?? null : null;
      if (failingBoundary === "audio") {
        logPlayback( {
          stage: "PLAYBACK_AUDIO_CREATE_ERROR",
          error: errMsg,
          stack: errStack,
        });
        logPlayback( { stage: "PLAYBACK_RETURN_AUDIO_ERROR", error: errMsg });
      } else if (failingBoundary === "resolve") {
        logPlayback( {
          stage: "PLAYBACK_RESOLVE_ERROR",
          error: errMsg,
        });
        logPlayback( {
          stage: "PLAYBACK_RETURN_RESOLVE_FAILED",
          error: errMsg,
        });
      } else {
        logPlayback( {
          stage: "PLAYBACK_RETURN_TARGET_FAILED",
          error: errMsg,
        });
      }
      console.log("[COACH_MEDIA_TRACE]", {
        stage: "parent_media_playback_failed",
        mediaId,
        matchLineageKey: snapshot.id,
        error: errMsg,
      });
      setPlaybackState("idle");
    }
  }, [mediaId, playbackState, snapshot.id]);

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

  const listenLabel =
    playbackState === "loading"
      ? "Loading…"
      : playbackState === "playing"
        ? "❚❚ Pause Coach Commentary"
        : playbackState === "paused"
          ? "▶ Resume Coach Commentary"
          : "▶ Listen to Coach Commentary";

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
            {snapshot.outcome === "Submission"
              ? subLabel ?? "—"
              : "—"}
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
          <Text style={styles.value}>{videoLabel(snapshot)}</Text>
        </View>
      </View>
      {coachBreakdown ? (
        <View style={styles.coachSection}>
          <Text style={styles.coachLabel}>Coach Match Breakdown</Text>
          {mediaId ? (
            <View style={styles.commentaryControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${listenLabel} for match ${index + 1}`}
                disabled={playbackState === "loading"}
                onPress={() => {
                  void toggleCoachCommentaryPlayback();
                }}
                style={({ pressed }) => [
                  styles.listenButton,
                  pressed ? styles.listenButtonPressed : null,
                ]}
              >
                <Text style={styles.listenButtonText}>{listenLabel}</Text>
              </Pressable>
              {durationLabel ? (
                <Text style={styles.durationText}>⏱ {durationLabel}</Text>
              ) : null}
            </View>
          ) : null}
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
