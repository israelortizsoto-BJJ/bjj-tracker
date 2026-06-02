import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import {
  Stack,
  router,
  useLocalSearchParams,
  useNavigation,
  usePathname,
  useSegments,
} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Swipeable } from "react-native-gesture-handler";
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
import {
  competitionVideoRefsFromMatches,
  getCompetitionDetailByEntryId,
  setCompetitionDetailForEntryId,
} from "../../../../../../src/storage/competitionStore";
import { getKidsById, todayYMD } from "../../../../../../src/storage/coachKidStore";
import type {
  KidCompetitionEventStatus,
  KidCompetitionFormat,
  KidCompetitionResult,
} from "../../../../../../src/types/coachKid";
import { getPlacementLabel } from "../../../../../../src/features/competition/placementLabel";
import { medalTierFromKidResult } from "../../../../../../src/types/coachKid";
import {
  createEmptyMatch,
  deriveInitialMatches,
  HOW_ENDED_OPTIONS,
  MatchBlock,
  MATCH_RESULT_OPTIONS,
  normalizeSubmissionTimeInput,
  snapshotFromLocal,
  type LocalMatch,
} from "@/src/features/competition/competitionMatchEditor";
import { logCompSaveRouteState } from "@/src/features/competition/compSaveExitTelemetry";
import { exitToCompeteAfterCompetitionSave } from "@/src/features/competition/syncTabAndExit";

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

const FORMATS: KidCompetitionFormat[] = ["gi", "nogi", "both"];

function resultLabel(r: KidCompetitionResult): string {
  if (r === "dnf") return "DNF";
  if (r === "other") return "Other";
  return getPlacementLabel(r);
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
  const navigation = useNavigation();
  const pathname = usePathname();
  const segments = useSegments();
  const params = useLocalSearchParams<{
    kidId?: string;
    entryId?: string;
    openNonce?: string;
  }>();
  const kidId = params.kidId ? String(params.kidId) : "";
  const entryId = params.entryId ? String(params.entryId) : "";
  const openNonce = params.openNonce ? String(params.openNonce) : "";
  const isNew = !entryId;
  const reactId = useId();
  const lastProcessedOpenNonceRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [nameDraft, setNameDraft] = useState("");
  const [dateDraft, setDateDraft] = useState(todayYMD());
  const [resultDraft, setResultDraft] = useState<KidCompetitionResult>("participated");
  const [eventStatusDraft, setEventStatusDraft] = useState<
    KidCompetitionEventStatus | undefined
  >(undefined);
  const [promoterDraft, setPromoterDraft] = useState("");
  const [formatDraft, setFormatDraft] = useState<KidCompetitionFormat | undefined>(
    undefined,
  );
  const [notesDraft, setNotesDraft] = useState("");
  const [medalImageDraft, setMedalImageDraft] = useState<string | undefined>();
  const [matches, setMatches] = useState<LocalMatch[]>([]);
  const [saving, setSaving] = useState(false);
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
        exitToCompeteAfterCompetitionSave({
          navigation,
          actorRole: "coach",
          athleteId: kidId,
          competitionId: null,
        });
        return;
      }
      setNameDraft(found.tournamentName);
      setDateDraft(found.eventDate);
      setResultDraft(found.result ?? "participated");
      setEventStatusDraft(found.status ?? found.eventStatus);
      setPromoterDraft(found.organizationOrPromoter ?? "");
      setFormatDraft(found.format);
      setNotesDraft(found.coachNotes ?? "");
      setMedalImageDraft(found.medalImageUri);
      const detail = await getCompetitionDetailByEntryId(found.id);
      setMatches(deriveInitialMatches(found, detail, reactId));
    } finally {
      setLoading(false);
    }
  }, [entryId, kidId, reactId, navigation]);

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      exitToCompeteAfterCompetitionSave({
        navigation,
        actorRole: "coach",
        athleteId: "",
        competitionId: null,
      });
    }
  }, [kidId, navigation]);

  useLayoutEffect(() => {
    if (!isNew || !openNonce) return;
    if (lastProcessedOpenNonceRef.current === openNonce) return;
    lastProcessedOpenNonceRef.current = openNonce;
    setNameDraft("");
    setDateDraft(todayYMD());
    setResultDraft("participated");
    setEventStatusDraft(undefined);
    setPromoterDraft("");
    setFormatDraft(undefined);
    setNotesDraft("");
    setMedalImageDraft(undefined);
    setMatches([createEmptyMatch(`new-${Date.now()}`)]);
    setLoading(false);
  }, [isNew, openNonce]);

  useEffect(() => {
    return () => {
      console.log("[COMP_EDITOR_UNMOUNT]", {
        ts: Date.now(),
        pathname: String(pathname ?? ""),
        kidId,
      });
    };
  }, [pathname, kidId]);

  useFocusEffect(
    useCallback(() => {
      logCompSaveRouteState({
        pathname: String(pathname ?? ""),
        segments,
        canGoBack: router.canGoBack(),
        role: "coach",
        kidId,
      });
      if (isNew) {
        if (!openNonce) {
          setNameDraft("");
          setDateDraft(todayYMD());
          setResultDraft("participated");
          setEventStatusDraft(undefined);
          setPromoterDraft("");
          setFormatDraft(undefined);
          setNotesDraft("");
          setMedalImageDraft(undefined);
          setMatches([createEmptyMatch(`new-${Date.now()}`)]);
        }
        setLoading(false);
        return;
      }
      void loadExisting();
    }, [isNew, loadExisting, openNonce, pathname, segments, kidId]),
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

  const setMatchOutcome = useCallback((matchIndex: number, label: (typeof HOW_ENDED_OPTIONS)[number]) => {
    setMatches((prev) =>
      prev.map((m, i) => {
        if (i !== matchIndex) return m;
        const nextOutcome = m.outcome === label ? null : label;
        const keepSubmissionFields = nextOutcome === "Submission";
        return {
          ...m,
          outcome: nextOutcome,
          ...(!keepSubmissionFields ? { submissionTime: null, submissionType: null } : {}),
        };
      }),
    );
  }, []);

  const setMatchResult = useCallback((matchIndex: number, v: (typeof MATCH_RESULT_OPTIONS)[number]["value"]) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === matchIndex ? { ...m, matchResult: m.matchResult === v ? null : v } : m)),
    );
  }, []);

  const setMatchSubmissionTime = useCallback((matchIndex: number, text: string) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === matchIndex ? { ...m, submissionTime: normalizeSubmissionTimeInput(text) } : m)),
    );
  }, []);

  const setMatchSubmissionType = useCallback((matchIndex: number, key: string | null) => {
    setMatches((prev) => prev.map((m, i) => (i === matchIndex ? { ...m, submissionType: key } : m)));
  }, []);

  const setMatchCoachNote = useCallback((matchIndex: number, text: string) => {
    setMatches((prev) => prev.map((m, i) => (i === matchIndex ? { ...m, coachNote: text } : m)));
  }, []);

  const updateMatchMedia = useCallback(
    (matchIndex: number, patch: Partial<Pick<LocalMatch, "imageUri" | "videoUri" | "imageAssetId" | "videoAssetId">>) => {
      setMatches((prev) => prev.map((m, i) => (i === matchIndex ? { ...m, ...patch } : m)));
    },
    [],
  );

  const addMatch = useCallback(() => {
    setMatches((prev) => [...prev, createEmptyMatch(`${Date.now()}`)]);
  }, []);

  const pickMedalImage = useCallback(() => {
    const runLibrary = async () => {
      const ok = await requestMediaLibraryPermission();
      if (!ok) {
        Alert.alert("Permission needed", "Allow Photos access to attach a medal photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
        base64: false,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (uri) {
        const persisted = await persistMediaFromCameraRoll(uri, "image");
        setMedalImageDraft(persisted);
      }
    };
    const runCamera = async () => {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        Alert.alert("Permission needed", "Allow Camera to take a medal photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (uri) {
        const persisted = await persistMediaFromCameraRoll(uri, "image");
        setMedalImageDraft(persisted);
      }
    };
    Alert.alert("Medal photo", "Choose a source", [
      { text: "Cancel", style: "cancel" },
      { text: "Take photo", onPress: () => void runCamera() },
      { text: "Photo library", onPress: () => void runLibrary() },
    ]);
  }, []);

  const handleDeleteMatch = useCallback(
    (matchId: string) => {
      if (matches.length === 1) {
        Alert.alert("Clear match?", "This will reset this match.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear",
            style: "destructive",
            onPress: () =>
              setMatches((prev) =>
                prev.map((m) =>
                  m.id === matchId
                    ? {
                        ...m,
                        videoUri: null,
                        imageUri: null,
                        imageAssetId: null,
                        videoAssetId: null,
                        matchResult: null,
                        outcome: null,
                        submissionTime: null,
                        submissionType: null,
                        coachNote: "",
                      }
                    : m,
                ),
              ),
          },
        ]);
        return;
      }
      Alert.alert("Delete match?", "This will delete this match and its media.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => setMatches((prev) => (prev.length <= 1 ? prev : prev.filter((m) => m.id !== matchId))),
        },
      ]);
    },
    [matches.length],
  );

  const renderDeleteAction = useCallback(
    (matchId: string) => (
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={() => handleDeleteMatch(matchId)}
          style={{
            height: "100%",
            width: 80,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#dc2626",
          }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "bold" }}>Delete</Text>
        </Pressable>
      </View>
    ),
    [handleDeleteMatch],
  );

  async function onSave() {
    if (!canSave || !kidId) return;
    const name = nameDraft.trim();
    const eventDate = dateDraft.trim();
    if (!isValidYMD(eventDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      return;
    }

    const snapshots = matches.map((m) => snapshotFromLocal(m));
    const competitionVideos = competitionVideoRefsFromMatches(snapshots);

    console.log("[COMP_SAVE_BEGIN]", {
      ts: Date.now(),
      pathname: String(pathname ?? ""),
      kidId,
    });

    setSaving(true);
    try {
      const kidsByIdForShared = await getKidsById();
      const resolvedSharedAthleteId =
        (kidsByIdForShared[kidId]?.sharedAthleteId ?? "").trim() || undefined;

      let savedCompetitionId = entryId;
      if (isNew) {
        const created = await createKidCompetitionEntry({
          kidId,
          ...(resolvedSharedAthleteId ? { sharedAthleteId: resolvedSharedAthleteId } : {}),
          tournamentName: name,
          eventDate,
          result: resultDraft,
          medal: medalTierFromKidResult(resultDraft),
          medalImageUri: medalImageDraft,
          status: eventStatusDraft,
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim()
            ? promoterDraft.trim()
            : undefined,
          format: formatDraft,
          coachNotes: notesDraft.trim() ? notesDraft.trim() : undefined,
          ...(competitionVideos.length > 0 ? { competitionVideos } : {}),
        });
        await setCompetitionDetailForEntryId(created.id, { matches: snapshots });
        savedCompetitionId = created.id;
      } else {
        await updateKidCompetitionEntry(entryId, {
          ...(resolvedSharedAthleteId ? { sharedAthleteId: resolvedSharedAthleteId } : {}),
          tournamentName: name,
          eventDate,
          result: resultDraft,
          medal: medalTierFromKidResult(resultDraft),
          medalImageUri: medalImageDraft,
          status: eventStatusDraft,
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim()
            ? promoterDraft.trim()
            : undefined,
          format: formatDraft,
          coachNotes: notesDraft.trim() ? notesDraft.trim() : undefined,
          competitionVideos,
        });
        await setCompetitionDetailForEntryId(entryId, { matches: snapshots });
      }
      console.log("[COMPETITION_SAVE]", {
        competitionId: savedCompetitionId,
        sharedAthleteId: resolvedSharedAthleteId ?? null,
        actorRole: "coach",
      });
      console.log("[COMP_SAVE_COMPLETE]", {
        ts: Date.now(),
        pathname: String(pathname ?? ""),
        kidId,
        competitionId: savedCompetitionId,
      });
      exitToCompeteAfterCompetitionSave({
        navigation,
        actorRole: "coach",
        athleteId: kidId,
        competitionId: savedCompetitionId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        "Could not save",
        msg ||
          "Competition data could not be saved. If this keeps happening, try shorter notes or remove the video(s) and save again.",
      );
    } finally {
      console.log("[COMP_EDITOR_FINALLY]", {
        ts: Date.now(),
        pathname: String(pathname ?? ""),
        kidId,
      });
      setSaving(false);
    }
  }

  function onDelete() {
    if (isNew) {
      exitToCompeteAfterCompetitionSave({
        navigation,
        actorRole: "coach",
        athleteId: kidId,
        competitionId: null,
      });
      return;
    }
    Alert.alert("Delete competition?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteKidCompetitionEntry(entryId);
          exitToCompeteAfterCompetitionSave({
            navigation,
            actorRole: "coach",
            athleteId: kidId,
            competitionId: entryId,
          });
        },
      },
    ]);
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
          onPress={() => {
            exitToCompeteAfterCompetitionSave({
              navigation,
              actorRole: "coach",
              athleteId: kidId,
              competitionId: isNew ? null : entryId,
            });
          }}
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
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Compete</Text>
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
              MEDAL PHOTO (OPTIONAL)
            </Text>
            <Pressable
              onPress={pickMedalImage}
              style={({ pressed }) => ({
                marginTop: 8,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? "#eef2ff" : UI.bgCard,
              })}
            >
              <Text style={{ fontSize: 14, color: UI.textPrimary }}>
                {medalImageDraft ? "Replace medal photo" : "Add medal photo (camera or library)"}
              </Text>
            </Pressable>

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
                marginTop: 20,
                fontSize: 12,
                letterSpacing: 0.6,
                fontWeight: "700",
                color: UI.textSecondary,
              }}
            >
              MATCHES
            </Text>
            {matches.map((m, i) => (
              <View
                key={m.id}
                style={{
                  alignSelf: "stretch",
                  marginTop: i === 0 ? 10 : 12,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <Swipeable
                  renderRightActions={() => renderDeleteAction(m.id)}
                  friction={1.1}
                  rightThreshold={24}
                  overshootRight
                  dragOffsetFromRightEdge={10}
                >
                  <MatchBlock
                    index={i}
                    match={m}
                    onToggleMatchResult={(v) => setMatchResult(i, v)}
                    onToggleOutcome={(label) => setMatchOutcome(i, label)}
                    onSubmissionTimeChange={(text) => setMatchSubmissionTime(i, text)}
                    onSubmissionTypeChange={(key) => setMatchSubmissionType(i, key)}
                    onCoachNoteChange={(text) => setMatchCoachNote(i, text)}
                    onCoachNoteFocus={onNotesFocusScroll}
                    onImageChange={(uri, assetId) => updateMatchMedia(i, { imageUri: uri, imageAssetId: assetId })}
                    onVideoChange={(uri, assetId) => updateMatchMedia(i, { videoUri: uri, videoAssetId: assetId })}
                  />
                </Swipeable>
              </View>
            ))}

            <Pressable
              onPress={addMatch}
              style={({ pressed }) => ({
                marginTop: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.accent,
                backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 15, color: UI.accent, fontWeight: "800" }}>+ Add Match</Text>
            </Pressable>

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
