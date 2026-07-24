import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  persistMediaFromCameraRoll,
  requestMediaLibraryPermission,
} from "../media/persistCameraRollMedia";
import { createAudioAdapter } from "../playback/AudioAdapter";
import {
  createPlaybackCoordinator,
  type PlaybackCoordinator,
} from "../playback/PlaybackCoordinator";
import { createVideoAdapter } from "../playback/VideoAdapter";
import { sharedMatchMediaEditorBindingClientEnabled } from "../config/sharedMatchMediaUploadFlags";
import { coachSyncResolveMatchMediaAttachment } from "../services/coachMatchMediaResolutionApi";
import { resolveCoachMatchMediaSessionTarget } from "../services/resolveCoachMatchMediaSessionTarget";
import { getCoachMatchMediaAttachment } from "../storage/coachMatchMediaAttachmentStore";
import { resolveCoachMatchMediaPlaybackOnce } from "../features/filmRoom/coachMatchMediaPlaybackResolve";
import {
  createMatchMediaBindingLifecycle,
  type MatchMediaBindingCandidate,
} from "./matchMediaBindingLifecycle";

const UI = {
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
  danger: "#dc2626",
} as const;

export type BoundMatchMediaPlaybackSource = {
  playableUri: string;
  matchMediaAssetId: string;
  attachmentRevision: number;
  matchLineageKey: string;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  playerGenerationToken: string;
};

export type MatchMediaSharedPlaybackScope = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  hydrationVersion: number;
};

export type MatchMediaSharedPlaybackController = {
  requestConfirmedBoundVideoPause(): Promise<{ positionMillis: number; binding: BoundMatchMediaPlaybackSource }>;
  getActiveBinding(): BoundMatchMediaPlaybackSource | null;
};

export type MatchMediaCallbacks = {
  imageUri: string | null;
  videoUri: string | null;
  shouldPausePlayback?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onReplay?: () => void;
  /** First consumer migration: expose coordinator authority for subscribe/getSnapshot. */
  onPlaybackCoordinator?: (coordinator: PlaybackCoordinator) => void;
  sharedPlaybackScope?: MatchMediaSharedPlaybackScope | null;
  onSharedPlaybackController?: (controller: MatchMediaSharedPlaybackController | null) => void;
  onImageChange: (uri: string | null, assetId: string | null) => void;
  onVideoChange: (uri: string | null, assetId: string | null) => void;
};

function looksLikeHttpVideoUrl(raw: string): boolean {
  const t = raw.trim();
  return /^https?:\/\//i.test(t);
}

/**
 * Camera-roll image + video attachments (training session pattern): pick, preview, replay, remove.
 * No YouTube. Uses persisted document URIs via persistMediaFromCameraRoll.
 */
export function MatchMediaAttachments({
  imageUri,
  videoUri,
  shouldPausePlayback,
  onPlay,
  onPause,
  onReplay,
  onPlaybackCoordinator,
  sharedPlaybackScope = null,
  onSharedPlaybackController,
  onImageChange,
  onVideoChange,
}: MatchMediaCallbacks) {
  const videoRef = useRef<Video>(null);
  // Video-only binding for this slice. Audio stays unbound (no-op) so play/pause/replay
  // do not fan out to commentary engines (CoachVoiceNoteField / MatchCard own their own).
  const playbackRef = useRef(
    createPlaybackCoordinator({
      video: createVideoAdapter(() => videoRef.current),
      audio: createAudioAdapter(() => null),
    }),
  );
  const [videoLinkDraft, setVideoLinkDraft] = useState("");
  const [sharedCandidate, setSharedCandidate] = useState<MatchMediaBindingCandidate | null>(null);
  const [activeBinding, setActiveBinding] = useState<BoundMatchMediaPlaybackSource | null>(null);
  const resolveGenerationRef = useRef(0);
  const playerGenerationRef = useRef(0);
  const lifecycleRef = useRef<ReturnType<typeof createMatchMediaBindingLifecycle> | null>(null);
  if (!lifecycleRef.current) {
    lifecycleRef.current = createMatchMediaBindingLifecycle({
      now: () => Date.now(),
      setTimer: (callback, delay) => setTimeout(callback, delay),
      clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
      cancelConfirmedVideoPause: (reason) => playbackRef.current.cancelConfirmedVideoPause(reason),
      requestConfirmedVideoPause: () => playbackRef.current.requestConfirmedVideoPause(),
      unload: () => playbackRef.current.unload(),
      onChange: (state) => {
        setSharedCandidate(state.candidate);
        setActiveBinding(state.active);
      },
    });
  }
  const invalidateSharedBinding = useCallback((reason = "Shared editor media binding invalidated.") => {
    resolveGenerationRef.current += 1;
    lifecycleRef.current?.invalidate(reason, true);
  }, []);

  const scopeKey = sharedPlaybackScope
    ? [sharedPlaybackScope.sharedAthleteId, sharedPlaybackScope.sharedCompetitionId, sharedPlaybackScope.matchLineageKey, String(sharedPlaybackScope.hydrationVersion)].join("\\0")
    : null;

  useEffect(() => {
    if (!sharedMatchMediaEditorBindingClientEnabled) return;
    invalidateSharedBinding("Shared editor media scope changed.");
    if (!sharedPlaybackScope || !scopeKey) return;
    const generation = ++resolveGenerationRef.current;
    const scope = { ...sharedPlaybackScope };
    void resolveCoachMatchMediaPlaybackOnce(
      {
        sharedAthleteId: scope.sharedAthleteId,
        sharedCompetitionId: scope.sharedCompetitionId,
        matchLineageKey: scope.matchLineageKey,
      },
      { getAttachment: getCoachMatchMediaAttachment, resolveSessionTarget: resolveCoachMatchMediaSessionTarget, resolveAttachment: coachSyncResolveMatchMediaAttachment, now: () => Date.now() },
    ).then((result) => {
      if (generation !== resolveGenerationRef.current || result.status !== "ready") return;
      const candidate: MatchMediaBindingCandidate = {
        playableUri: result.url, matchMediaAssetId: result.matchMediaAssetId, attachmentRevision: result.revision,
        matchLineageKey: scope.matchLineageKey, sharedAthleteId: scope.sharedAthleteId,
        sharedCompetitionId: scope.sharedCompetitionId, playerGenerationToken: `editor-shared-${++playerGenerationRef.current}`,
        expiresAt: result.expiresAt,
      };
      lifecycleRef.current?.accept(candidate);
    });
    return invalidateSharedBinding;
  }, [invalidateSharedBinding, scopeKey]);

  useEffect(() => {
    if (!onSharedPlaybackController) return;
    onSharedPlaybackController({
      getActiveBinding: () => lifecycleRef.current?.getActive() ?? null,
      requestConfirmedBoundVideoPause: () => lifecycleRef.current!.requestConfirmedBoundPause(),
    });
    return () => onSharedPlaybackController(null);
  }, [onSharedPlaybackController]);

  useEffect(() => {
    onPlaybackCoordinator?.(playbackRef.current);
  }, [onPlaybackCoordinator]);

  useEffect(() => {
    if (videoUri && looksLikeHttpVideoUrl(videoUri)) {
      setVideoLinkDraft(videoUri.trim());
    } else {
      setVideoLinkDraft("");
    }
  }, [videoUri]);

  const effectiveVideoUri = sharedCandidate?.playableUri ?? videoUri;
  const videoGenerationKey = sharedCandidate?.playerGenerationToken ?? `legacy:${videoUri ?? "none"}`;
  const renderedSharedGenerationToken = sharedCandidate?.playerGenerationToken ?? null;

  // Legacy source changes must not retire an active shared source.
  useEffect(() => {
    if (lifecycleRef.current?.hasCandidate()) return;
    void playbackRef.current.unload();
  }, [videoUri]);

  useEffect(() => {
    return () => {
      void playbackRef.current.unload();
    };
  }, []);

  useEffect(() => {
    return () => {
      lifecycleRef.current?.dispose();
    };
  }, []);

  async function ensureMediaPermissions() {
    const ok = await requestMediaLibraryPermission();
    if (!ok) {
      Alert.alert("Permission needed", "Allow Photos access to attach media.");
      return false;
    }
    return true;
  }

  async function pickImageFromLibrary() {
    if (!(await ensureMediaPermissions())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const persisted = await persistMediaFromCameraRoll(asset.uri, "image");
      onImageChange(persisted, asset.assetId ?? null);
    }
  }

  async function pickImageFromCamera() {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      Alert.alert("Permission needed", "Allow Camera to take a photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const persisted = await persistMediaFromCameraRoll(asset.uri, "image");
      onImageChange(persisted, asset.assetId ?? null);
    }
  }

  function offerImageSource() {
    Alert.alert("Add image", "Choose a source", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Take photo",
        onPress: () => {
          void pickImageFromCamera();
        },
      },
      {
        text: "Photo library",
        onPress: () => {
          void pickImageFromLibrary();
        },
      },
    ]);
  }

  async function clearVideoMedia() {
    if (!lifecycleRef.current?.hasCandidate()) await playbackRef.current.unload();
    onVideoChange(null, null);
  }

  function commitVideoLink() {
    const raw = videoLinkDraft.trim();
    if (!raw) {
      if (videoUri && looksLikeHttpVideoUrl(videoUri)) {
        void clearVideoMedia();
      }
      return;
    }
    if (!looksLikeHttpVideoUrl(raw)) {
      Alert.alert(
        "Check the link",
        "Enter a URL starting with http:// or https://, or pick a video from your library.",
      );
      return;
    }
    onVideoChange(raw, null);
  }

  async function pickVideo() {
    if (!(await ensureMediaPermissions())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const persisted = await persistMediaFromCameraRoll(asset.uri, "video");
      if (!lifecycleRef.current?.hasCandidate()) await playbackRef.current.unload();
      onVideoChange(persisted, asset.assetId ?? null);
    }
  }

  async function replayVideo() {
    try {
      if (!videoRef.current) return;
      await playbackRef.current.replay();
      onReplay?.();
    } catch {
      // ignore
    }
  }

  async function playVideo() {
    try {
      if (!videoRef.current) return;
      await playbackRef.current.play();
      onPlay?.();
    } catch {
      // ignore
    }
  }

  async function pauseVideo() {
    try {
      if (!videoRef.current) return;
      await playbackRef.current.pause();
      onPause?.();
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!shouldPausePlayback) return;
    void pauseVideo();
  }, [shouldPausePlayback]);

  return (
    <View>
      <View style={styles.attachmentButtonsRow}>
        <TouchableOpacity style={styles.attachmentButton} onPress={offerImageSource}>
          <Text style={styles.attachmentButtonText}>📷 Add Image</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.attachmentButton} onPress={pickVideo}>
          <Text style={styles.attachmentButtonText}>🎥 Add Video</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.linkSectionTitle}>Video link (optional)</Text>
      <Text style={styles.linkHint}>
        Use a direct http(s) link, or pick a clip above. Saving applies the link when you leave this field.
      </Text>
      <TextInput
        value={videoLinkDraft}
        onChangeText={setVideoLinkDraft}
        onBlur={commitVideoLink}
        onSubmitEditing={commitVideoLink}
        placeholder="https://…"
        placeholderTextColor={UI.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.linkInput}
      />

      {imageUri ? (
        <View style={styles.attachmentPreview}>
          <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="cover" />
          <TouchableOpacity style={styles.removeBtn} onPress={() => onImageChange(null, null)}>
            <Text style={styles.removeBtnText}>Remove Image</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {effectiveVideoUri ? (
        <View style={styles.attachmentPreview}>
          <Text style={styles.sectionTitle}>Video Preview</Text>
          <Video
            key={videoGenerationKey}
            ref={videoRef}
            source={{ uri: effectiveVideoUri }}
            style={styles.previewImg}
            useNativeControls={false}
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
            onPlaybackStatusUpdate={(status) => {
              if (!status || typeof status !== "object") return;
              // Coordinator owns video status truth; preserve existing finish → onPause UI.
              if ("isLoaded" in status && status.isLoaded) {
                playbackRef.current.applyVideoStatus(status);
                lifecycleRef.current?.markLoaded(videoGenerationKey);
              }
              // @ts-ignore didJustFinish on playback status
              if (status.didJustFinish) {
                onPause?.();
              }
            }}
            onError={() => {
              if (renderedSharedGenerationToken) {
                lifecycleRef.current?.handleNativeError(renderedSharedGenerationToken);
              }
            }}
          />
          <View style={styles.attachmentButtonsRow}>
            <TouchableOpacity style={styles.attachmentButton} onPress={playVideo}>
              <Text style={styles.attachmentButtonText}>▶ Play</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachmentButton} onPress={pauseVideo}>
              <Text style={styles.attachmentButtonText}>⏸ Pause</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.attachmentButtonsRow}>
            <TouchableOpacity style={styles.attachmentButton} onPress={replayVideo}>
              <Text style={styles.attachmentButtonText}>↻ Replay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={() => {
                void clearVideoMedia();
              }}
            >
              <Text style={styles.attachmentDangerText}>Remove Video</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  linkSectionTitle: {
    color: UI.textSecondary,
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  linkHint: {
    color: UI.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 6,
    opacity: 0.92,
  },
  linkInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: UI.textPrimary,
    fontSize: 14,
  },
  sectionTitle: {
    color: UI.textPrimary,
    marginTop: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  attachmentButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  attachmentButton: {
    flexGrow: 1,
    flexBasis: "48%",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentButtonText: {
    color: UI.textPrimary,
    fontWeight: "800",
    fontSize: 13,
  },
  attachmentDangerText: {
    color: UI.danger,
    fontWeight: "800",
    fontSize: 13,
  },
  attachmentPreview: {
    marginTop: 10,
    gap: 8,
  },
  previewImg: { width: "100%", height: 220, borderRadius: 12 },
  removeBtn: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  removeBtnText: {
    color: UI.danger,
    fontWeight: "800",
  },
});
