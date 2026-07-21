import { ResizeMode, Video } from "expo-av";
import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { createAudioAdapter } from "../../playback/AudioAdapter";
import {
  createPlaybackCoordinator,
  type PlaybackCoordinator,
} from "../../playback/PlaybackCoordinator";
import { createVideoAdapter } from "../../playback/VideoAdapter";

const UI = {
  panel: "#111315",
  line: "rgba(255, 255, 255, 0.12)",
  text: "#ffffff",
  muted: "#a4a8ae",
  captionBg: "rgba(0, 0, 0, 0.76)",
} as const;

/** A media-first stage: large enough to own the first viewport without cropping match footage. */
const VIDEO_MAX_HEIGHT_RATIO = 0.58;
const CONTROLS_HIDE_MS = 2800;

type FilmRoomVideoPlayerProps = {
  videoUri: string | null | undefined;
  /** Active TimedTranscript segment text for closed-caption overlay. */
  captionText?: string | null;
  onPlaybackCoordinator?: (coordinator: PlaybackCoordinator) => void;
  /** Product-level commands keep both visible controls on one video-led path. */
  onPlay: () => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onReplay: () => void | Promise<void>;
};

/**
 * Read-only Film Room video surface.
 *
 * Reuses certified PlaybackCoordinator + VideoAdapter field ownership.
 * Match video audio is muted by default — coach narration is the storytelling layer.
 * Memoized so Session playhead → transcript polls do not re-render the Video engine.
 */
export const FilmRoomVideoPlayer = memo(function FilmRoomVideoPlayer({
  videoUri,
  captionText = null,
  onPlaybackCoordinator,
  onPlay,
  onPause,
  onReplay,
}: FilmRoomVideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const playbackRef = useRef(
    createPlaybackCoordinator({
      video: createVideoAdapter(() => videoRef.current),
      audio: createAudioAdapter(() => null),
    }),
  );
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [playbackState, setPlaybackState] = useState<"idle" | "loading" | "playing" | "paused">(
    "idle",
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const uri = videoUri?.trim() || null;
  const maxHeight = Math.round(windowHeight * VIDEO_MAX_HEIGHT_RATIO);
  const naturalHeight = windowWidth / aspectRatio;
  const videoHeight = Math.min(naturalHeight, maxHeight);

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

  useEffect(() => {
    void playbackRef.current.unload();
    setAspectRatio(16 / 9);
    setHasStarted(false);
  }, [uri]);

  useEffect(() => {
    const coordinator = playbackRef.current;
    return () => {
      void coordinator.unload();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (playbackState === "playing") {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, CONTROLS_HIDE_MS);
    } else {
      setControlsVisible(true);
    }
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [playbackState]);

  const revealControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (playbackState === "playing") {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, CONTROLS_HIDE_MS);
    }
  };

  const onStagePress = () => {
    if (controlsVisible && playbackState === "playing") {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setControlsVisible(false);
      return;
    }
    revealControls();
  };

  if (!uri) {
    return (
      <View style={[styles.placeholder, { width: windowWidth, height: Math.min(180, maxHeight) }]}>
        <Text style={styles.placeholderText}>No match video attached</Text>
      </View>
    );
  }

  const caption = captionText?.trim() || null;

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      <View style={[styles.stage, { height: videoHeight }]}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width: windowWidth, height: videoHeight, backgroundColor: "#000" }}
          useNativeControls={false}
          isMuted
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onReadyForDisplay={(event) => {
            const size = event.naturalSize;
            if (!size || !(size.width > 0) || !(size.height > 0)) return;
            // expo-av may report orientation separately; prefer displayed frame ratio.
            const oriented =
              size.orientation === "portrait" && size.width > size.height
                ? size.height / size.width
                : size.width / size.height;
            if (Number.isFinite(oriented) && oriented > 0) {
              setAspectRatio(oriented);
            }
          }}
          onPlaybackStatusUpdate={(status) => {
            if (!status || typeof status !== "object") return;
            if ("isLoaded" in status && status.isLoaded) {
              playbackRef.current.applyVideoStatus(status);
              if (status.positionMillis > 0) setHasStarted(true);
            }
          }}
        />

        {/* Tap stage to reveal controls during playback (platform media convention). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show video controls"
          onPress={onStagePress}
          style={StyleSheet.absoluteFillObject}
        />

        {caption ? (
          <View pointerEvents="none" style={styles.captionWrap}>
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        ) : null}

        {controlsVisible ? (
          <View style={styles.controlsOverlay}>
            <View pointerEvents="none" style={styles.scrim} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playbackState === "playing" ? "Pause video" : "Play video"}
              onPress={() => {
                revealControls();
                void (playbackState === "playing"
                  ? onPause()
                  : onPlay());
              }}
              style={({ pressed }) => [styles.primaryControl, pressed ? styles.pressed : null]}
            >
              <Text style={styles.primaryControlText}>
                {playbackState === "playing" ? "❚❚" : "▶"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay video"
              onPress={() => {
                revealControls();
                void onReplay();
              }}
              style={({ pressed }) => [styles.replayControl, pressed ? styles.pressed : null]}
            >
              <Text style={styles.replayIcon}>↻</Text>
              <Text style={styles.replayLabel}>Replay</Text>
            </Pressable>
            {!hasStarted ? <Text style={styles.startHint}>Match video · Coach narration plays separately</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#000",
  },
  stage: {
    backgroundColor: "#000",
    justifyContent: "center",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: UI.line,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.panel,
    borderBottomWidth: 1,
    borderBottomColor: UI.line,
  },
  placeholderText: {
    color: UI.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  captionWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    alignItems: "center",
  },
  captionText: {
    maxWidth: "100%",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 4,
    backgroundColor: UI.captionBg,
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
    overflow: "hidden",
  },
  controlsOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.24)",
  },
  primaryControl: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    backgroundColor: "rgba(10, 10, 10, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
  },
  pressed: {
    opacity: 0.76,
  },
  primaryControlText: {
    color: UI.text,
    fontSize: 27,
    fontWeight: "700",
    marginLeft: 3,
  },
  replayControl: {
    position: "absolute",
    right: 16,
    bottom: 14,
    alignItems: "center",
    gap: 1,
    padding: 6,
  },
  replayIcon: {
    color: UI.text,
    fontSize: 20,
    fontWeight: "500",
  },
  replayLabel: {
    color: UI.text,
    fontSize: 9,
    fontWeight: "700",
  },
  startHint: {
    position: "absolute",
    left: 18,
    bottom: 18,
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 11,
    fontWeight: "600",
  },
});
