import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  persistMediaFromCameraRoll,
  requestMediaLibraryPermission,
} from "../../../../../../src/media/persistCameraRollMedia";
import {
  createKidCompetitionEntry,
  deleteKidCompetitionEntry,
  getKidCompetitionEntryById,
  updateKidCompetitionEntry,
} from "../../../../../../src/storage/kidCompetitionStore";
import { todayYMD } from "../../../../../../src/storage/coachKidStore";
import type {
  KidCompetitionEventStatus,
  KidCompetitionFormat,
  KidCompetitionOutcomeKind,
  KidCompetitionResult,
  KidCompetitionVideoRef,
} from "../../../../../../src/types/coachKid";

const MAX_COMPETITION_VIDEOS = 3;

type VideoSlotTuple = [
  KidCompetitionVideoRef | null,
  KidCompetitionVideoRef | null,
  KidCompetitionVideoRef | null,
];

const EMPTY_VIDEO_SLOTS: VideoSlotTuple = [null, null, null];

function videoSlotsFromEntry(entry: {
  competitionVideos?: KidCompetitionVideoRef[];
  videoUri?: string;
  videoAssetId?: string;
}): VideoSlotTuple {
  const list =
    entry.competitionVideos && entry.competitionVideos.length > 0
      ? entry.competitionVideos
      : entry.videoUri?.trim()
        ? [
            {
              uri: entry.videoUri.trim(),
              ...(entry.videoAssetId?.trim()
                ? { assetId: entry.videoAssetId.trim() }
                : {}),
            },
          ]
        : [];
  const capped = list.slice(0, MAX_COMPETITION_VIDEOS);
  return [
    capped[0] ?? null,
    capped[1] ?? null,
    capped[2] ?? null,
  ];
}

function compactVideoSlots(slots: VideoSlotTuple): KidCompetitionVideoRef[] {
  const out: KidCompetitionVideoRef[] = [];
  for (let i = 0; i < MAX_COMPETITION_VIDEOS; i++) {
    const s = slots[i];
    if (s) out.push(s);
  }
  return out;
}

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

const EVENT_STATUSES: KidCompetitionEventStatus[] = [
  "upcoming",
  "completed",
  "cancelled",
  "unknown",
];

const OUTCOME_KINDS: KidCompetitionOutcomeKind[] = [
  "points",
  "submission",
  "decision",
  "disqualification",
  "medical",
  "other",
  "unknown",
];

const FORMATS: KidCompetitionFormat[] = ["gi", "nogi", "both"];

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

function eventStatusLabel(s: KidCompetitionEventStatus): string {
  switch (s) {
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "unknown":
      return "Unknown";
  }
}

function outcomeKindLabel(k: KidCompetitionOutcomeKind): string {
  switch (k) {
    case "points":
      return "Points";
    case "submission":
      return "Submission";
    case "decision":
      return "Decision";
    case "disqualification":
      return "DQ";
    case "medical":
      return "Medical";
    case "other":
      return "Other";
    case "unknown":
      return "Unknown";
  }
}

function formatChipLabel(f: KidCompetitionFormat): string {
  switch (f) {
    case "gi":
      return "Gi";
    case "nogi":
      return "No-Gi";
    case "both":
      return "Both";
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
  const [eventStatusDraft, setEventStatusDraft] = useState<
    KidCompetitionEventStatus | undefined
  >(undefined);
  const [promoterDraft, setPromoterDraft] = useState("");
  const [outcomeKindDraft, setOutcomeKindDraft] = useState<
    KidCompetitionOutcomeKind | undefined
  >(undefined);
  const [formatDraft, setFormatDraft] = useState<KidCompetitionFormat | undefined>(
    undefined,
  );
  const [notesDraft, setNotesDraft] = useState("");
  const [videoSlots, setVideoSlots] = useState<VideoSlotTuple>(EMPTY_VIDEO_SLOTS);
  const [videoSlotKeys, setVideoSlotKeys] = useState<[number, number, number]>([0, 0, 0]);
  const [saving, setSaving] = useState(false);
  const videoSlotRefs = useRef<(Video | null)[]>([null, null, null]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);

  /** Single nudge after focus — avoid keyboard frame + content-size loops (dictation overscrolls). */
  const onNotesFocusScroll = useCallback(() => {
    requestAnimationFrame(() => {
      (keyboardAwareRef.current as { update?: () => void } | null)?.update?.();
    });
  }, []);

  const loadExisting = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    try {
      const found = await getKidCompetitionEntryById(entryId);
      if (!found || found.kidId !== kidId) {
        Alert.alert("Not found", "This competition entry is missing or belongs to another kid.");
        router.replace(`/this-week/kid/${kidId}`);
        return;
      }
      setNameDraft(found.tournamentName);
      setDateDraft(found.eventDate);
      setResultDraft(found.result ?? "participated");
      setEventStatusDraft(found.eventStatus);
      setPromoterDraft(found.organizationOrPromoter ?? "");
      setFormatDraft(found.format);
      setOutcomeKindDraft(found.outcomeKind);
      setNotesDraft(found.coachNotes ?? "");
      setVideoSlots(videoSlotsFromEntry(found));
      setVideoSlotKeys([0, 0, 0]);
    } finally {
      setLoading(false);
    }
  }, [entryId, kidId]);

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      router.replace("/this-week/kids");
    }
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      if (isNew) {
        setNameDraft("");
        setDateDraft(todayYMD());
        setResultDraft("participated");
        setEventStatusDraft(undefined);
        setPromoterDraft("");
        setFormatDraft(undefined);
        setOutcomeKindDraft(undefined);
        setNotesDraft("");
        setVideoSlots(EMPTY_VIDEO_SLOTS);
        setVideoSlotKeys([0, 0, 0]);
        setLoading(false);
        return;
      }
      void loadExisting();
    }, [isNew, loadExisting]),
  );

  const canSave = useMemo(() => {
    return nameDraft.trim().length > 0 && isValidYMD(dateDraft);
  }, [nameDraft, dateDraft]);

  const saveDisabledHint = useMemo(() => {
    if (canSave) return null;
    const missingName = nameDraft.trim().length === 0;
    const badDate = !isValidYMD(dateDraft);
    if (missingName && badDate) {
      return "Add a tournament name and a valid event date (YYYY-MM-DD) to enable Save.";
    }
    if (missingName) return "Add a tournament name to enable Save.";
    return "Use a valid event date (YYYY-MM-DD) to enable Save.";
  }, [canSave, nameDraft, dateDraft]);

  async function ensureMediaPermissions() {
    const ok = await requestMediaLibraryPermission();
    if (!ok) {
      Alert.alert("Permission needed", "Allow Photos access to attach a video.");
      return false;
    }
    return true;
  }

  async function pickVideoForSlot(slotIndex: number) {
    if (!(await ensureMediaPermissions())) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        const persisted = await persistMediaFromCameraRoll(asset.uri, "video");
        const ref: KidCompetitionVideoRef = asset.assetId
          ? { uri: persisted, assetId: asset.assetId }
          : { uri: persisted };
        setVideoSlots((prev) => {
          const next: VideoSlotTuple = [prev[0], prev[1], prev[2]];
          next[slotIndex] = ref;
          return next;
        });
        setVideoSlotKeys((prev) => {
          const next: [number, number, number] = [prev[0], prev[1], prev[2]];
          next[slotIndex] += 1;
          return next;
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Could not attach video", msg || "Try another clip or check storage space.");
    }
  }

  function clearVideoSlot(slotIndex: number) {
    setVideoSlots((prev) => {
      const next: VideoSlotTuple = [prev[0], prev[1], prev[2]];
      next[slotIndex] = null;
      return next;
    });
    setVideoSlotKeys((prev) => {
      const next: [number, number, number] = [prev[0], prev[1], prev[2]];
      next[slotIndex] += 1;
      return next;
    });
  }

  async function onSave() {
    if (!canSave || !kidId) return;
    const name = nameDraft.trim();
    const eventDate = dateDraft.trim();
    if (!isValidYMD(eventDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      return;
    }

    const competitionVideos = compactVideoSlots(videoSlots);

    setSaving(true);
    try {
      if (isNew) {
        await createKidCompetitionEntry({
          kidId,
          tournamentName: name,
          eventDate,
          result: resultDraft,
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim()
            ? promoterDraft.trim()
            : undefined,
          format: formatDraft,
          outcomeKind: outcomeKindDraft,
          coachNotes: notesDraft.trim() ? notesDraft.trim() : undefined,
          ...(competitionVideos.length > 0 ? { competitionVideos } : {}),
        });
      } else {
        await updateKidCompetitionEntry(entryId, {
          tournamentName: name,
          eventDate,
          result: resultDraft,
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim()
            ? promoterDraft.trim()
            : undefined,
          format: formatDraft,
          outcomeKind: outcomeKindDraft,
          coachNotes: notesDraft.trim() ? notesDraft.trim() : undefined,
          competitionVideos,
        });
      }
      router.replace(`/this-week/kid/${kidId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        "Could not save",
        msg ||
          "Competition data could not be saved. If this keeps happening, try shorter notes or remove the video(s) and save again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (isNew) {
      router.replace(`/this-week/kid/${kidId}`);
      return;
    }
    Alert.alert("Delete competition?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteKidCompetitionEntry(entryId);
          router.replace(`/this-week/kid/${kidId}`);
        },
      },
    ]);
  }

  async function replayVideoSlot(slotIndex: number) {
    try {
      const r = videoSlotRefs.current[slotIndex];
      if (!r) return;
      await r.setPositionAsync(0);
      await r.playAsync();
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
          extraHeight={headerHeight}
          extraScrollHeight={Math.max(32, insets.bottom + 16)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={{ flex: 1, backgroundColor: UI.screenBg }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: Math.max(24, insets.bottom + 20),
          }}
        >
        <Pressable
          onPress={() => router.replace(`/this-week/kid/${kidId}`)}
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
              ORGANIZATION / PROMOTER (OPTIONAL)
            </Text>
            <TextInput
              value={promoterDraft}
              onChangeText={setPromoterDraft}
              placeholder="e.g. IBJJF, local academy…"
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
              FORMAT (OPTIONAL)
            </Text>
            <Text style={{ marginTop: 4, fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}>
              Tap again to clear.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {FORMATS.map((f) => {
                const active = formatDraft === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() =>
                      setFormatDraft((prev) => (prev === f ? undefined : f))
                    }
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
                      {formatChipLabel(f)}
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
              EVENT STATUS (OPTIONAL)
            </Text>
            <Text style={{ marginTop: 4, fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}>
              Tap again to clear. Omit if you are not tracking status here.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {EVENT_STATUSES.map((s) => {
                const active = eventStatusDraft === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() =>
                      setEventStatusDraft((prev) => (prev === s ? undefined : s))
                    }
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
                      {eventStatusLabel(s)}
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
              HOW IT ENDED (OPTIONAL)
            </Text>
            <Text style={{ marginTop: 4, fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}>
              Match outcome type. Tap again to clear.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {OUTCOME_KINDS.map((k) => {
                const active = outcomeKindDraft === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() =>
                      setOutcomeKindDraft((prev) => (prev === k ? undefined : k))
                    }
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
                      {outcomeKindLabel(k)}
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
              onFocus={onNotesFocusScroll}
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
              VIDEOS (OPTIONAL, MAX {MAX_COMPETITION_VIDEOS})
            </Text>
            <Text style={{ marginTop: 4, fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}>
              Three slots; empty middle slots are dropped when you save.
            </Text>

            {([0, 1, 2] as const).map((slotIndex) => {
              const clip = videoSlots[slotIndex];
              const slotLabel = `Clip ${slotIndex + 1}`;
              return (
                <View
                  key={slotIndex}
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: UI.border,
                    backgroundColor: UI.bgCard,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "800", color: UI.textSecondary }}>
                    {slotLabel}
                  </Text>
                  {clip ? (
                    <>
                      <Video
                        key={videoSlotKeys[slotIndex]}
                        ref={(r) => {
                          videoSlotRefs.current[slotIndex] = r;
                        }}
                        source={{ uri: clip.uri }}
                        style={{ width: "100%", height: 140, borderRadius: 10 }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                        onPlaybackStatusUpdate={(status) => {
                          if (!status || typeof status !== "object") return;
                          // @ts-ignore expo-av playback status
                          if (status.didJustFinish) {
                            setVideoSlotKeys((prev) => {
                              const next: [number, number, number] = [prev[0], prev[1], prev[2]];
                              next[slotIndex] += 1;
                              return next;
                            });
                          }
                        }}
                      />
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Pressable
                          onPress={() => void replayVideoSlot(slotIndex)}
                          style={({ pressed }) => ({
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: UI.border,
                            backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                          })}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textPrimary }}>
                            Replay
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void pickVideoForSlot(slotIndex)}
                          style={({ pressed }) => ({
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: UI.border,
                            backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                          })}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textPrimary }}>
                            Replace
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => clearVideoSlot(slotIndex)}
                          style={({ pressed }) => ({
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: UI.border,
                            backgroundColor: pressed ? "#fef2f2" : UI.bgCard,
                          })}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "800", color: UI.danger }}>
                            Remove
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Pressable
                      onPress={() => void pickVideoForSlot(slotIndex)}
                      style={({ pressed }) => ({
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: UI.border,
                        backgroundColor: pressed ? "#edf2ff" : "#f9fafb",
                        alignSelf: "flex-start",
                      })}
                    >
                      <Text style={{ fontSize: 13, color: UI.textPrimary, fontWeight: "800" }}>
                        🎥 Add from library
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            <Pressable
              disabled={!canSave || saving || loading}
              onPress={() => void onSave()}
              style={({ pressed }) => ({
                marginTop: 24,
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

            {saveDisabledHint && !loading && !saving ? (
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: UI.textSecondary,
                  lineHeight: 17,
                  textAlign: "center",
                }}
              >
                {saveDisabledHint}
              </Text>
            ) : null}

            {!isNew ? (
              <Pressable
                disabled={loading}
                onPress={onDelete}
                style={({ pressed }) => ({
                  marginTop: 12,
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
          </>
        )}

          <Text style={{ marginTop: 16, fontSize: 12, color: UI.textSecondary, opacity: 0.9 }}>
            Internal pilot (coach-side)
          </Text>
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
