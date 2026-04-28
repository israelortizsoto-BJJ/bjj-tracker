import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  persistMediaFromCameraRoll,
  requestMediaLibraryPermission,
} from "../media/persistCameraRollMedia";

const UI = {
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
  danger: "#dc2626",
} as const;

export type MatchMediaCallbacks = {
  imageUri: string | null;
  videoUri: string | null;
  onImageChange: (uri: string | null, assetId: string | null) => void;
  onVideoChange: (uri: string | null, assetId: string | null) => void;
};

/**
 * Camera-roll image + video attachments (training session pattern): pick, preview, replay, remove.
 * No YouTube. Uses persisted document URIs via persistMediaFromCameraRoll.
 */
export function MatchMediaAttachments({ imageUri, videoUri, onImageChange, onVideoChange }: MatchMediaCallbacks) {
  const videoRef = useRef<Video>(null);
  const [videoKey, setVideoKey] = useState(0);

  async function ensureMediaPermissions() {
    const ok = await requestMediaLibraryPermission();
    if (!ok) {
      Alert.alert("Permission needed", "Allow Photos access to attach media.");
      return false;
    }
    return true;
  }

  async function pickImage() {
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

  async function pickVideo() {
    if (!(await ensureMediaPermissions())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const persisted = await persistMediaFromCameraRoll(asset.uri, "video");
      onVideoChange(persisted, asset.assetId ?? null);
    }
  }

  async function replayVideo() {
    try {
      if (!videoRef.current) return;
      await videoRef.current.setPositionAsync(0);
      await videoRef.current.playAsync();
    } catch {
      // ignore
    }
  }

  return (
    <View>
      <View style={styles.attachmentButtonsRow}>
        <TouchableOpacity style={styles.attachmentButton} onPress={pickImage}>
          <Text style={styles.attachmentButtonText}>📷 Add Image</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.attachmentButton} onPress={pickVideo}>
          <Text style={styles.attachmentButtonText}>🎥 Add Video</Text>
        </TouchableOpacity>
      </View>

      {imageUri ? (
        <View style={styles.attachmentPreview}>
          <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="cover" />
          <TouchableOpacity style={styles.removeBtn} onPress={() => onImageChange(null, null)}>
            <Text style={styles.removeBtnText}>Remove Image</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {videoUri ? (
        <View style={styles.attachmentPreview}>
          <Text style={styles.sectionTitle}>Video Preview</Text>
          <Video
            key={videoKey}
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.previewImg}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
            onPlaybackStatusUpdate={(status) => {
              if (!status || typeof status !== "object") return;
              // @ts-ignore didJustFinish on playback status
              if (status.didJustFinish) setVideoKey((k) => k + 1);
            }}
          />
          <View style={styles.attachmentButtonsRow}>
            <TouchableOpacity style={styles.attachmentButton} onPress={replayVideo}>
              <Text style={styles.attachmentButtonText}>↻ Replay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={() => onVideoChange(null, null)}
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
