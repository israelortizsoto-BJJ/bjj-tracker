import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { TimedTranscriptFollowing } from "../coach/TimedTranscriptFollowing";
import { hydrateCompetitionMatchOverlayAnnotations } from "../../domain/competition/hydrateCompetitionMatchOverlayAnnotations";
import {
  createFilmRoomSessionCoordinator,
  type FilmRoomSessionCoordinator,
} from "../../playback/FilmRoomSessionCoordinator";
import type { PlaybackCoordinator } from "../../playback/PlaybackCoordinator";
import type { CoachMatchMediaDeliveryFailureKind } from "./coachMatchMediaPlaybackResolve";
import { FilmRoomCoachCommentaryControls } from "./FilmRoomCoachCommentaryControls";
import { FilmRoomVideoPlayer } from "./FilmRoomVideoPlayer";

const UI = {
  bg: "#08090a",
  line: "rgba(255, 255, 255, 0.10)",
  text: "#f7f7f8",
  muted: "#92979f",
} as const;

export type FilmRoomScreenProps = {
  matchLineageKey: string;
  matchIndex: number;
  sharedAthleteId?: string;
  sharedCompetitionId?: string;
  mediaId?: string;
  coachNote?: string;
  videoUri?: string | null;
  durationMs?: number;
  /** Forward-only delivery failure; FilmRoomScreen does not resolve or authorize media. */
  onDeliveryError?: (kind?: CoachMatchMediaDeliveryFailureKind) => void;
};

/**
 * Isolates Session playhead polling so FilmRoomScreen / Video do not re-render
 * every 250ms while video leads the coordinated breakdown.
 */
function FilmRoomTranscriptFollowBridge({
  session,
  videoCoordinator,
  audioUri,
  onCaptionText,
}: {
  session: FilmRoomSessionCoordinator;
  videoCoordinator: PlaybackCoordinator | null;
  audioUri: string | null;
  onCaptionText: (text: string | null) => void;
}) {
  const [transcriptFollowTimeMs, setTranscriptFollowTimeMs] = useState<number | null>(null);

  useEffect(() => {
    const syncFromSessionPlayhead = () => {
      const playhead = session.getPlayhead();
      const active = session.getActiveParticipant();
      if (videoCoordinator && active === videoCoordinator) {
        setTranscriptFollowTimeMs(playhead.currentTimeMs);
      } else {
        setTranscriptFollowTimeMs(null);
      }
    };
    syncFromSessionPlayhead();
    const id = setInterval(syncFromSessionPlayhead, 250);
    return () => {
      clearInterval(id);
    };
  }, [session, videoCoordinator]);

  return (
    <TimedTranscriptFollowing
      audioUri={audioUri}
      currentTimeMs={transcriptFollowTimeMs}
      onActiveSegmentChange={(segment) => {
        onCaptionText(segment?.text?.trim() ? segment.text : null);
      }}
    />
  );
}

/**
 * Coach Match Breakdown Experience v2 — premium parent viewing surface.
 *
 * Entry: Competition → Match Card → "▶ Watch Coach Match Breakdown" (PD-FR-001).
 *
 * Layout: video (muted + CC overlay) → coach commentary → TimedTranscript Following → coachNote.
 * Session: FilmRoomSessionCoordinator owns exclusivity / playhead / seek (certified).
 */
export function FilmRoomScreen({
  matchLineageKey,
  matchIndex,
  sharedAthleteId = "",
  sharedCompetitionId = "",
  mediaId = "",
  coachNote: coachNoteProp = "",
  videoUri = null,
  durationMs,
  onDeliveryError,
}: FilmRoomScreenProps) {
  const [coachNote, setCoachNote] = useState(coachNoteProp.trim());
  const [coachNoteExpanded, setCoachNoteExpanded] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [videoCoordinator, setVideoCoordinator] = useState<PlaybackCoordinator | null>(null);
  const [coachAudioCoordinator, setCoachAudioCoordinator] =
    useState<PlaybackCoordinator | null>(null);
  const [captionText, setCaptionText] = useState<string | null>(null);

  const sessionRef = useRef(
    createFilmRoomSessionCoordinator({
      sessionId: matchLineageKey.trim() || `film-room-${matchIndex}`,
    }),
  );

  useEffect(() => {
    setCoachNote(coachNoteProp.trim());
  }, [coachNoteProp]);

  useEffect(() => {
    const session = sessionRef.current;
    return () => {
      session.destroy();
    };
  }, []);

  // Coach-local TimedTranscript key (voice note URI) when available on this device.
  useEffect(() => {
    const athleteId = sharedAthleteId.trim();
    const competitionId = sharedCompetitionId.trim();
    const lineage = matchLineageKey.trim();
    if (!athleteId || !competitionId || !lineage) {
      setAudioUri(null);
      return;
    }
    let cancelled = false;
    void hydrateCompetitionMatchOverlayAnnotations({
      sharedAthleteId: athleteId,
      sharedCompetitionId: competitionId,
      matchLineageKeys: [lineage],
    }).then((annotations) => {
      if (cancelled) return;
      const row = annotations.find((a) => a.matchLineageKey === lineage);
      const local = row?.voiceNoteRefs?.[0]?.localUri?.trim() || null;
      setAudioUri(local);
      const note = row?.coachNote?.trim();
      if (note) setCoachNote(note);
    });
    return () => {
      cancelled = true;
    };
  }, [sharedAthleteId, sharedCompetitionId, matchLineageKey]);

  useEffect(() => {
    if (!videoCoordinator) return;
    const session = sessionRef.current;
    session.register(videoCoordinator, "video");
    return () => {
      session.unregister(videoCoordinator, "video");
    };
  }, [videoCoordinator]);

  const hasVideo = Boolean(videoUri?.trim());

  /** Video is the sole continuous clock; coach audio is an aligned follower. */
  const playCoachMatchBreakdown = useCallback(async (
    audioFollowerOverride?: PlaybackCoordinator,
  ) => {
    if (!hasVideo || !videoCoordinator) return;
    const session = sessionRef.current;
    const startTimeMs = session.getPlayhead().currentTimeMs;
    const audioFollower = audioFollowerOverride ?? coachAudioCoordinator;

    if (audioFollower) {
      await audioFollower.seek(startTimeMs);
    }
    await videoCoordinator.play();
    if (audioFollower) {
      await audioFollower.play();
    }
  }, [coachAudioCoordinator, hasVideo, videoCoordinator]);

  const pauseCoachMatchBreakdown = useCallback(async (
    audioFollowerOverride?: PlaybackCoordinator,
  ) => {
    if (!hasVideo || !videoCoordinator) return;
    const audioFollower = audioFollowerOverride ?? coachAudioCoordinator;
    await videoCoordinator.pause();
    if (audioFollower) {
      await audioFollower.pause();
    }
  }, [coachAudioCoordinator, hasVideo, videoCoordinator]);

  const replayCoachMatchBreakdown = useCallback(async () => {
    if (!hasVideo || !videoCoordinator) return;
    const session = sessionRef.current;

    // Establish video authority before routing the replay seek through Session.
    await videoCoordinator.play();
    await session.requestSeek(0);
    if (coachAudioCoordinator) {
      await coachAudioCoordinator.seek(0);
      await coachAudioCoordinator.play();
    }
  }, [coachAudioCoordinator, hasVideo, videoCoordinator]);

  const onCaptionText = useCallback((text: string | null) => {
    setCaptionText(text);
  }, []);

  const matchLabel = `Match ${matchIndex + 1}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/compete");
          }}
          style={({ pressed }) => [styles.backBtn, pressed ? styles.pressed : null]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>FILM ROOM</Text>
          <Text style={styles.title} numberOfLines={1}>Coach Match Breakdown</Text>
        </View>
        <Text style={styles.matchLabel}>{matchLabel}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <FilmRoomVideoPlayer
          videoUri={videoUri}
          captionText={captionText}
          onPlaybackCoordinator={setVideoCoordinator}
          onPlay={playCoachMatchBreakdown}
          onPause={pauseCoachMatchBreakdown}
          onReplay={replayCoachMatchBreakdown}
          onDeliveryError={onDeliveryError}
        />

        <View style={styles.body}>
          <FilmRoomCoachCommentaryControls
            mediaId={mediaId}
            durationMs={durationMs}
            matchLineageKey={matchLineageKey}
            autoPlayOnMount
            onPlaybackCoordinator={setCoachAudioCoordinator}
            coordinatedPlaybackAvailable={hasVideo}
            onPlay={playCoachMatchBreakdown}
            onPause={pauseCoachMatchBreakdown}
          />

          <FilmRoomTranscriptFollowBridge
            session={sessionRef.current}
            videoCoordinator={videoCoordinator}
            audioUri={audioUri}
            onCaptionText={onCaptionText}
          />

          {coachNote ? (
            <View style={styles.noteSection}>
              <Text style={styles.noteEyebrow}>COACH INTERPRETATION</Text>
              <Text style={styles.noteLabel}>The coach’s read</Text>
              <Text
                numberOfLines={coachNoteExpanded ? undefined : 3}
                style={styles.noteText}
              >
                {coachNote}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  coachNoteExpanded
                    ? "Collapse coach interpretation"
                    : "Read more coach interpretation"
                }
                onPress={() => setCoachNoteExpanded((v) => !v)}
                style={({ pressed }) => [styles.readMore, pressed ? styles.pressed : null]}
              >
                <Text style={styles.readMoreText}>
                  {coachNoteExpanded ? "Show Less" : "Read More"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: UI.bg,
  },
  backBtn: {
    width: 38,
    height: 38,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  backText: {
    color: UI.text,
    fontSize: 36,
    lineHeight: 36,
    fontWeight: "300",
  },
  heading: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: UI.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  matchLabel: {
    marginLeft: 8,
    color: UI.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 56,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 28,
  },
  noteSection: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderColor: UI.line,
  },
  noteEyebrow: {
    color: UI.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.25,
  },
  noteLabel: {
    marginTop: 7,
    color: UI.text,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.35,
  },
  noteText: {
    marginTop: 12,
    color: "#c7c9cd",
    fontSize: 15,
    lineHeight: 23,
  },
  readMore: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 6,
  },
  readMoreText: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.76,
  },
});
