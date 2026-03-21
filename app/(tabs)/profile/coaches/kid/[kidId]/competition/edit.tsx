import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  persistMediaFromCameraRoll,
  requestMediaLibraryPermission,
} from "../../../../../../../src/media/persistCameraRollMedia";
import {
  createKidCompetitionEntry,
  deleteKidCompetitionEntry,
  getKidCompetitionEntryById,
  updateKidCompetitionEntry,
} from "../../../../../../../src/storage/kidCompetitionStore";
import { todayYMD } from "../../../../../../../src/storage/coachKidStore";
import type { KidCompetitionResult } from "../../../../../../../src/types/coachKid";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
  danger: "#dc2626",
};

const RESULTS: KidCompetitionResult[] = [
  "gold",
  "silver",
  "bronze",
  "participated",
  "dnf",
  "other",
];

function resultLabel(r: KidCompetitionResult): string {
  switch (r) {
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "bronze":
      return "Bronze";
    case "participated":
      return "Participated";
    case "dnf":
      return "DNF";
    case "other":
      return "Other";
  }
}

function isValidYMD(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  const t = new Date(`${s.trim()}T12:00:00`);
  return !Number.isNaN(t.getTime());
}

export default function KidCompetitionEditScreen() {
  const params = useLocalSearchParams<{ kidId?: string; entryId?: string }>();
  const kidId = params.kidId ? String(params.kidId) : "";
  const entryId = params.entryId ? String(params.entryId) : "";
  const isNew = !entryId;

  const [loading, setLoading] = useState(!isNew);
  const [nameDraft, setNameDraft] = useState("");
  const [dateDraft, setDateDraft] = useState(todayYMD());
  const [resultDraft, setResultDraft] = useState<KidCompetitionResult>("participated");
  const [notesDraft, setNotesDraft] = useState("");
  const [videoUri, setVideoUri] = useState<string | undefined>(undefined);
  const [videoAssetId, setVideoAssetId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<Video>(null);
  const [videoKey, setVideoKey] = useState(0);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);

  const bumpScrollToFocusedNotes = useCallback(() => {
    requestAnimationFrame(() => {
      // `update` exists on the HOC instance but is missing from library typings
      (keyboardAwareRef.current as { update?: () => void } | null)?.update?.();
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = Keyboard.addListener("keyboardWillChangeFrame", bumpScrollToFocusedNotes);
    return () => sub.remove();
  }, [bumpScrollToFocusedNotes]);

  const loadExisting = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    try {
      const found = await getKidCompetitionEntryById(entryId);
      if (!found || found.kidId !== kidId) {
        Alert.alert("Not found", "This competition entry is missing or belongs to another kid.");
        router.replace(`/profile/coaches/kid/${kidId}`);
        return;
      }
      setNameDraft(found.tournamentName);
      setDateDraft(found.eventDate);
      setResultDraft(found.result);
      setNotesDraft(found.coachNotes ?? "");
      setVideoUri(found.videoUri);
      setVideoAssetId(found.videoAssetId);
    } finally {
      setLoading(false);
    }
  }, [entryId, kidId]);

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      router.replace("/profile/coaches/kids");
    }
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      if (isNew) {
        setNameDraft("");
        setDateDraft(todayYMD());
        setResultDraft("participated");
        setNotesDraft("");
        setVideoUri(undefined);
        setVideoAssetId(undefined);
        setLoading(false);
        return;
      }
      void loadExisting();
    }, [isNew, loadExisting]),
  );

  const canSave = useMemo(() => {
    return nameDraft.trim().length > 0 && isValidYMD(dateDraft);
  }, [nameDraft, dateDraft]);

  async function ensureMediaPermissions() {
    const ok = await requestMediaLibraryPermission();
    if (!ok) {
      Alert.alert("Permission needed", "Allow Photos access to attach a video.");
      return false;
    }
    return true;
  }

  async function pickVideo() {
    if (!(await ensureMediaPermissions())) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        const persisted = await persistMediaFromCameraRoll(asset.uri, "video");
        setVideoUri(persisted);
        setVideoAssetId(asset.assetId ?? undefined);
        setVideoKey((k) => k + 1);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Could not attach video", msg || "Try another clip or check storage space.");
    }
  }

  async function onSave() {
    if (!canSave || !kidId) return;
    const name = nameDraft.trim();
    const eventDate = dateDraft.trim();
    if (!isValidYMD(eventDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await createKidCompetitionEntry({
          kidId,
          tournamentName: name,
          eventDate,
          result: resultDraft,
          coachNotes: notesDraft.trim() ? notesDraft.trim() : undefined,
          videoUri,
          videoAssetId,
        });
      } else {
        await updateKidCompetitionEntry(entryId, {
          tournamentName: name,
          eventDate,
          result: resultDraft,
          coachNotes: notesDraft.trim() ? notesDraft.trim() : undefined,
          videoUri,
          videoAssetId,
        });
      }
      router.replace(`/profile/coaches/kid/${kidId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        "Could not save",
        msg ||
          "Competition data could not be saved. If this keeps happening, try shorter notes or remove the video and save again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (isNew) {
      router.replace(`/profile/coaches/kid/${kidId}`);
      return;
    }
    Alert.alert("Delete competition?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteKidCompetitionEntry(entryId);
          router.replace(`/profile/coaches/kid/${kidId}`);
        },
      },
    ]);
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
    <>
      <Stack.Screen
        options={{ title: isNew ? "Add Competition" : "Edit Competition" }}
      />
      <View style={{ flex: 1, backgroundColor: UI.screenBg }}>
        <KeyboardAwareScrollView
          ref={keyboardAwareRef}
          enableOnAndroid
          enableAutomaticScroll
          enableResetScrollToCoords={false}
          keyboardOpeningTime={120}
          viewIsInsideTabBar
          extraHeight={headerHeight + 24}
          extraScrollHeight={Math.max(220, insets.bottom + 120)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={{ flex: 1, backgroundColor: UI.screenBg }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 24,
          }}
        >
        <Pressable
          onPress={() => router.replace(`/profile/coaches/kid/${kidId}`)}
          style={({ pressed }) => ({
            marginBottom: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
            alignSelf: "flex-start",
          })}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Kid</Text>
        </Pressable>

        {loading ? (
          <Text style={{ fontSize: 14, color: UI.textSecondary }}>Loading…</Text>
        ) : (
          <>
            <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
              TOURNAMENT NAME
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="e.g. Spring Open 2026"
              placeholderTextColor={UI.textSecondary}
              style={{
                marginTop: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                padding: 12,
                color: UI.textPrimary,
              }}
            />

            <Text
              style={{
                marginTop: 16,
                fontSize: 12,
                letterSpacing: 0.6,
                fontWeight: "700",
                color: UI.textSecondary,
              }}
            >
              EVENT DATE (YYYY-MM-DD)
            </Text>
            <TextInput
              value={dateDraft}
              onChangeText={setDateDraft}
              placeholder={todayYMD()}
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                marginTop: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                padding: 12,
                color: UI.textPrimary,
              }}
            />

            <Text
              style={{
                marginTop: 16,
                fontSize: 12,
                letterSpacing: 0.6,
                fontWeight: "700",
                color: UI.textSecondary,
              }}
            >
              RESULT
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {RESULTS.map((r) => {
                const active = resultDraft === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setResultDraft(r)}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? UI.accent : UI.border,
                      backgroundColor: active ? "#edf2ff" : UI.bgCard,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: active ? "800" : "600",
                        color: UI.textPrimary,
                      }}
                    >
                      {resultLabel(r)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={{
                marginTop: 16,
                fontSize: 12,
                letterSpacing: 0.6,
                fontWeight: "700",
                color: UI.textSecondary,
              }}
            >
              COACH NOTES (OPTIONAL)
            </Text>
            <TextInput
              value={notesDraft}
              scrollEnabled={false}
              onChangeText={setNotesDraft}
              onFocus={bumpScrollToFocusedNotes}
              onContentSizeChange={bumpScrollToFocusedNotes}
              placeholder="Reflections, what to work on next…"
              placeholderTextColor={UI.textSecondary}
              multiline
              style={{
                marginTop: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                padding: 12,
                minHeight: 100,
                color: UI.textPrimary,
                textAlignVertical: "top",
              }}
            />

            <Text
              style={{
                marginTop: 16,
                fontSize: 12,
                letterSpacing: 0.6,
                fontWeight: "700",
                color: UI.textSecondary,
              }}
            >
              VIDEO (OPTIONAL)
            </Text>
            <Pressable
              onPress={() => void pickVideo()}
              style={({ pressed }) => ({
                marginTop: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                alignSelf: "flex-start",
              })}
            >
              <Text style={{ fontSize: 14, color: UI.textPrimary, fontWeight: "800" }}>
                🎥 Choose from library
              </Text>
            </Pressable>

            {videoUri ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Video
                  key={videoKey}
                  ref={videoRef}
                  source={{ uri: videoUri }}
                  style={{ width: "100%", height: 220, borderRadius: 12 }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                  onPlaybackStatusUpdate={(status) => {
                    if (!status || typeof status !== "object") return;
                    // @ts-ignore expo-av playback status
                    if (status.didJustFinish) setVideoKey((k) => k + 1);
                  }}
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <Pressable
                    onPress={() => void replayVideo()}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.border,
                      backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: UI.textPrimary }}>
                      ↻ Replay
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setVideoUri(undefined);
                      setVideoAssetId(undefined);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.border,
                      backgroundColor: pressed ? "#fef2f2" : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: UI.danger }}>
                      Remove video
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
        )}

          <Text style={{ marginTop: 16, fontSize: 12, color: UI.textSecondary, opacity: 0.9 }}>
            Internal pilot (coach-side)
          </Text>
        </KeyboardAwareScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={headerHeight}
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: UI.screenBg,
              borderTopWidth: 1,
              borderTopColor: UI.border,
              gap: 12,
            }}
          >
            <Pressable
              disabled={!canSave || saving || loading}
              onPress={() => void onSave()}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.accent,
                backgroundColor: pressed ? UI.accent : UI.accent,
                opacity: !canSave || saving || loading ? 0.5 : 1,
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 16, color: "#fff", fontWeight: "800" }}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </Pressable>

            {!isNew ? (
              <Pressable
                disabled={loading}
                onPress={onDelete}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: pressed ? "#fef2f2" : UI.bgCard,
                  alignItems: "center",
                  opacity: loading ? 0.5 : 1,
                })}
              >
                <Text style={{ fontSize: 16, color: UI.danger, fontWeight: "800" }}>
                  Delete
                </Text>
              </Pressable>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
