import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { createAudioAdapter } from "../../playback/AudioAdapter";
import {
  createPlaybackCoordinator,
  type PlaybackCoordinator,
} from "../../playback/PlaybackCoordinator";
import { createVideoAdapter } from "../../playback/VideoAdapter";
import { coachSyncResolveCoachMedia } from "../../services/coachMediaApi";
import { resolveCoachMediaSessionTarget } from "../../services/resolveParentCoachMediaSessionTarget";

const UI = {
  text: "#f7f7f8",
  muted: "#92979f",
  accent: "#d8f34a",
  surface: "#151719",
  line: "rgba(255, 255, 255, 0.10)",
} as const;

function formatCommentaryDuration(durationMs: number | undefined): string | null {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) return null;
  const totalSec = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type FilmRoomCoachCommentaryControlsProps = {
  mediaId: string | null | undefined;
  durationMs?: number;
  matchLineageKey: string;
  /** Prefer auto-start when entering Film Room via Listen CTA. */
  autoPlayOnMount?: boolean;
  onPlaybackCoordinator?: (coordinator: PlaybackCoordinator) => void;
  coordinatedPlaybackAvailable: boolean;
  onPlay: (audioFollower: PlaybackCoordinator) => void | Promise<void>;
  onPause: (audioFollower: PlaybackCoordinator) => void | Promise<void>;
};

/**
 * Parent Film Room coach commentary playback.
 *
 * Reuses the certified media resolve corridor (mediaId → ephemeral URL)
 * and PlaybackCoordinator audio field ownership. FilmRoomScreen coordinates
 * it as an unregistered follower of the video-led Session clock.
 */
export function FilmRoomCoachCommentaryControls({
  mediaId: mediaIdRaw,
  durationMs,
  matchLineageKey,
  autoPlayOnMount = true,
  onPlaybackCoordinator,
  coordinatedPlaybackAvailable,
  onPlay,
  onPause,
}: FilmRoomCoachCommentaryControlsProps) {
  const mediaId = mediaIdRaw?.trim() ?? "";
  const [playbackState, setPlaybackState] = useState<"idle" | "loading" | "playing" | "paused">(
    "idle",
  );
  const soundRef = useRef<Audio.Sound | null>(null);
  const playableUrlRef = useRef<string | null>(null);
  const autoPlayAttemptedRef = useRef(false);
  const playbackRef = useRef(
    createPlaybackCoordinator({
      video: createVideoAdapter(() => null),
      audio: createAudioAdapter(() => soundRef.current),
    }),
  );
  const durationLabel = formatCommentaryDuration(durationMs);

  useEffect(() => {
    onPlaybackCoordinator?.(playbackRef.current);
  }, [onPlaybackCoordinator]);

  useEffect(() => {
    const coordinator = playbackRef.current;
    setPlaybackState(coordinator.getSnapshot().playbackState);
    return coordinator.subscribe((snapshot) => {
      setPlaybackState(snapshot.playbackState);
    });
  }, []);

  const unloadPlayback = useCallback(async () => {
    await playbackRef.current.unload();
    soundRef.current = null;
    playableUrlRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      void unloadPlayback();
    };
  }, [unloadPlayback]);

  useEffect(() => {
    void unloadPlayback();
    autoPlayAttemptedRef.current = false;
  }, [mediaId, unloadPlayback]);

  const toggleCoachCommentaryPlayback = useCallback(async () => {
    if (!mediaId || !coordinatedPlaybackAvailable) return;
    if (playbackState === "playing" && soundRef.current) {
      await onPause(playbackRef.current);
      return;
    }
    if (playbackState === "paused" && soundRef.current) {
      await onPlay(playbackRef.current);
      return;
    }

    setPlaybackState("loading");
    try {
      const target = await resolveCoachMediaSessionTarget();
      if (!target) {
        setPlaybackState("idle");
        return;
      }
      const resolved = await coachSyncResolveCoachMedia(
        target.linkToken,
        mediaId,
        target.apiBaseUrl,
      );
      await unloadPlayback();
      setPlaybackState("loading");
      playableUrlRef.current = resolved.url;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: resolved.url },
        { shouldPlay: false },
        (status) => {
          if (!status.isLoaded) return;
          playbackRef.current.applyAudioStatus(status);
          if (status.didJustFinish) {
            void (async () => {
              if (soundRef.current !== sound) return;
              await playbackRef.current.unload();
              soundRef.current = null;
              playableUrlRef.current = null;
            })();
          }
        },
      );
      soundRef.current = sound;
      await onPlay(playbackRef.current);
    } catch (error) {
      console.log("[COACH_MEDIA_TRACE]", {
        stage: "film_room_media_playback_failed",
        mediaId,
        matchLineageKey,
        error: error instanceof Error ? error.message : String(error),
      });
      await unloadPlayback();
    }
  }, [
    coordinatedPlaybackAvailable,
    mediaId,
    matchLineageKey,
    onPause,
    onPlay,
    playbackState,
    unloadPlayback,
  ]);

  useEffect(() => {
    if (
      !autoPlayOnMount ||
      !coordinatedPlaybackAvailable ||
      !mediaId ||
      autoPlayAttemptedRef.current
    ) return;
    if (playbackState !== "idle") return;
    autoPlayAttemptedRef.current = true;
    void toggleCoachCommentaryPlayback();
  }, [
    autoPlayOnMount,
    coordinatedPlaybackAvailable,
    mediaId,
    playbackState,
    toggleCoachCommentaryPlayback,
  ]);

  if (!mediaId) {
    return (
      <View style={styles.section}>
        <Text style={styles.eyebrow}>COACH BREAKDOWN</Text>
        <Text style={styles.label}>No narration available</Text>
        <Text style={styles.muted}>No coach commentary audio for this match.</Text>
      </View>
    );
  }

  const listenLabel =
    !coordinatedPlaybackAvailable
      ? "Match video required for Coach Match Breakdown"
      : playbackState === "loading"
      ? "Loading…"
      : playbackState === "playing"
        ? "❚❚ Pause Coach Commentary"
        : playbackState === "paused"
          ? "▶ Resume Coach Commentary"
          : "▶ Play Coach Commentary";
  const stateLabel =
    !coordinatedPlaybackAvailable
      ? "Match video unavailable"
      : playbackState === "loading"
      ? "Preparing commentary…"
      : playbackState === "playing"
        ? "Coach is talking"
        : playbackState === "paused"
          ? "Breakdown paused"
          : "Listen with your coach";

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>ACTIVE COACH BREAKDOWN</Text>
      <View style={styles.nowPlaying}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listenLabel}
          disabled={!coordinatedPlaybackAvailable || playbackState === "loading"}
          onPress={() => {
            void toggleCoachCommentaryPlayback();
          }}
          style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
        >
          <Text style={styles.buttonText}>
            {playbackState === "playing" ? "❚❚" : "▶"}
          </Text>
        </Pressable>
        <View style={styles.copy}>
          <Text style={styles.label}>{stateLabel}</Text>
          <Text style={styles.muted}>Coach commentary</Text>
        </View>
        {durationLabel ? <Text style={styles.duration}>{durationLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  eyebrow: {
    color: UI.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.25,
  },
  nowPlaying: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.line,
    backgroundColor: UI.surface,
  },
  button: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: UI.accent,
  },
  pressed: {
    opacity: 0.76,
  },
  buttonText: {
    color: "#0b0c0d",
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 2,
  },
  copy: {
    flex: 1,
    marginLeft: 13,
    gap: 3,
  },
  label: {
    color: UI.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.15,
  },
  muted: {
    color: UI.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  duration: {
    color: UI.muted,
    fontSize: 12,
    fontWeight: "600",
  },
});
