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
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  persistMediaFromCameraRoll,
  requestMediaLibraryPermission,
} from "../../../../../../src/media/persistCameraRollMedia";
import { logCompDelete, logCompSave } from "@/src/dev/competitionMutationDevLog";
import {
  createCompetition,
  deleteCompetition,
  updateCompetition,
} from "@/src/domain/competition/CompetitionSync";
import {
  hydrateCompetitionResultDraft,
  newCompetitionResultDraft,
  toggleCompetitionResultDraft,
} from "@/src/domain/competition/competitionResultDraft";
import { scheduleUploadParentSelectedSharedMatchMedia } from "@/src/domain/competition/uploadParentSharedMatchMedia";
import {
  competitionVideoRefsFromMatches,
  getCompetitionDetailForEntry,
} from "../../../../../../src/storage/competitionStore";
import {
  getKidCompetitionEntryById,
  getWorkerCompetitionIdForEntry,
  parentAthleteIdFromUnlinkedCompetitionKidId,
} from "../../../../../../src/storage/kidCompetitionStore";
import { getKidsById, todayYMD } from "../../../../../../src/storage/coachKidStore";
import type {
  KidCompetitionEventStatus,
  KidCompetitionFormat,
  KidCompetitionResult,
} from "../../../../../../src/types/coachKid";
import { getPlacementLabel } from "../../../../../../src/features/competition/placementLabel";
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
import {
  logCompetitionLaunchContextValidation,
  validateCompetitionLaunchContext,
} from "@/src/features/competition/competitionNavigationContract";
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

function safeDecodeRouteParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function KidCompetitionEditScreen() {
  const navigation = useNavigation();
  const pathname = usePathname();
  const segments = useSegments();
  const params = useLocalSearchParams<{
    kidId?: string;
    entryId?: string;
    /** Present on "Add competition" from Compete so each visit gets a clean form. */
    openNonce?: string;
    launchSurface?: string | string[];
    returnClass?: string | string[];
    returnScopeId?: string | string[];
  }>();
  const kidId = params.kidId ? safeDecodeRouteParam(String(params.kidId)) : "";
  const entryId = params.entryId ? String(params.entryId) : "";
  const openNonce = params.openNonce ? String(params.openNonce) : "";
  const isNew = !entryId;
  const launchContextValidation = useMemo(
    () =>
      validateCompetitionLaunchContext(
        {
          launchSurface: params.launchSurface,
          returnClass: params.returnClass,
          returnScopeId: params.returnScopeId,
        },
        kidId,
      ),
    [
      kidId,
      params.launchSurface,
      params.returnClass,
      params.returnScopeId,
    ],
  );
  const launchContext = launchContextValidation.launchContext;
  const reactId = useId();
  const unlinkedParentAthleteId = useMemo(
    () => parentAthleteIdFromUnlinkedCompetitionKidId(kidId),
    [kidId],
  );
  const lastProcessedOpenNonceRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [nameDraft, setNameDraft] = useState("");
  const [dateDraft, setDateDraft] = useState(todayYMD());
  const [resultDraft, setResultDraft] = useState<KidCompetitionResult | undefined>(
    newCompetitionResultDraft(),
  );
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
  // Trace-only: retains one Parent media-attempt correlation across selection and post-save retry.
  const parentMatchMediaTraceIdsRef = useRef<Record<string, string>>({});
  const [sharedCompetitionId, setSharedCompetitionId] = useState<string | null>(null);
  const [sharedAthleteId, setSharedAthleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);

  const exitEditor = useCallback(
    (args: Parameters<typeof exitToCompeteAfterCompetitionSave>[0]) => {
      const forwardedArgs = { ...args, launchContext };
      exitToCompeteAfterCompetitionSave(forwardedArgs);
    },
    [launchContext],
  );

  useEffect(() => {
    logCompetitionLaunchContextValidation("parent_kid", launchContextValidation);
  }, [launchContextValidation]);

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
        exitEditor({
          navigation,
          actorRole: "parent",
          athleteId: kidId,
          competitionId: null,
        });
        return;
      }
      setNameDraft(found.tournamentName);
      setDateDraft(found.eventDate);
      setResultDraft(hydrateCompetitionResultDraft(found.result));
      setEventStatusDraft(found.status ?? found.eventStatus);
      setPromoterDraft(found.organizationOrPromoter ?? "");
      setFormatDraft(found.format);
      setNotesDraft(found.coachNotes ?? "");
      setMedalImageDraft(found.medalImageUri);
      setSharedCompetitionId(getWorkerCompetitionIdForEntry(found) || null);
      setSharedAthleteId(found.sharedAthleteId?.trim() || null);
      const { detail } = await getCompetitionDetailForEntry(found);
      setMatches(deriveInitialMatches(found, detail, reactId));
    } finally {
      setLoading(false);
    }
  }, [entryId, kidId, reactId, navigation, exitEditor]);

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      exitEditor({
        navigation,
        actorRole: "parent",
        athleteId: "",
        competitionId: null,
      });
    }
  }, [kidId, navigation, exitEditor]);

  useLayoutEffect(() => {
    if (!isNew || !openNonce) return;
    if (lastProcessedOpenNonceRef.current === openNonce) return;
    lastProcessedOpenNonceRef.current = openNonce;
    setNameDraft("");
    setDateDraft(todayYMD());
    setResultDraft(newCompetitionResultDraft());
    setEventStatusDraft(undefined);
    setPromoterDraft("");
    setFormatDraft(undefined);
    setNotesDraft("");
    setMedalImageDraft(undefined);
    setMatches([createEmptyMatch(`new-${Date.now()}`)]);
    setLoading(false);
  }, [isNew, openNonce]);

  useFocusEffect(
    useCallback(() => {
      logCompSaveRouteState({
        pathname: String(pathname ?? ""),
        segments,
        canGoBack: router.canGoBack(),
        role: "parent",
        kidId,
      });
      if (isNew) {
        if (!openNonce) {
          setNameDraft("");
          setDateDraft(todayYMD());
          setResultDraft(newCompetitionResultDraft());
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
    }, [isNew, kidId, loadExisting, navigation, openNonce, pathname, segments]),
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
      setMatches((prev) => {
        const next = prev.map((m, i) => (i === matchIndex ? { ...m, ...patch } : m));
        const match = next[matchIndex];
        const videoUri = patch.videoUri;
        if (typeof videoUri === "string" && videoUri.trim() && match) {
          // Parent-selected local video enters Shared Match Media upload client.
          // device-local URI remains for local preview; never treated as cross-device media.
          const traceId = `parent-match-media-${Date.now().toString(36)}-${matchIndex}`;
          parentMatchMediaTraceIdsRef.current[match.id] = traceId;
          scheduleUploadParentSelectedSharedMatchMedia(
            {
              localUri: videoUri,
              sharedAthleteId: sharedAthleteId || unlinkedParentAthleteId || null,
              sharedCompetitionId,
              matchLineageKey: match.id,
              traceId,
              traceTrigger: "selection",
            },
            {
              onFailure: (message) => {
                Alert.alert("Match video upload failed", message);
              },
            },
          );
        }
        return next;
      });
    },
    [sharedAthleteId, sharedCompetitionId, unlinkedParentAthleteId],
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

    logCompSave("BEGIN", {
      competitionId: isNew ? null : entryId,
      athleteId: kidId,
      operationKind: "optimistic",
      surface: "parentKidCompetitionEdit",
      overlayCount: snapshots.length,
    });

    setSaving(true);
    try {
      const kidsByIdForShared = await getKidsById();
      const sharedFromRoster =
        (kidsByIdForShared[kidId]?.sharedAthleteId ?? "").trim() || undefined;
      const resolvedSharedAthleteId =
        (unlinkedParentAthleteId ?? "").trim() || sharedFromRoster || undefined;

      let savedCompetitionId = entryId;
      if (isNew) {
        const created = await createCompetition({
          surface: "kid",
          kidId,
          resolvedSharedAthleteId,
          tournamentName: name,
          eventDate,
          resultDraft,
          eventStatusDraft,
          formatDraft,
          promoterDraft,
          medalImageDraft,
          coachNotes: notesDraft,
          competitionVideos,
          matchSnapshots: snapshots,
        });
        if (!created.ok) {
          logCompSave("ERROR", {
            athleteId: kidId,
            sharedAthleteId: resolvedSharedAthleteId ?? null,
            operationKind: "server",
            surface: "parentKidCompetitionEdit",
            phaseDetail: created.blocked.kind,
          });
          if (created.blocked.kind === "resolve_miss_new") {
            Alert.alert(
              "Could not sync",
              "This athlete is linked here, but this phone could not open the coach invite that lists them for writing. Open Coach link & sharing, confirm the channel shows “Linked — competition sync ready”, then tap Athletes on this invite to relink or add them on that code.",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Coach link settings",
                  onPress: () => router.push("/this-week/manage"),
                },
              ],
            );
            return;
          }
          const msg =
            created.blocked.kind === "sync_api"
              ? created.blocked.message
              : "Try again shortly.";
          Alert.alert("Could not sync", msg || "Try again shortly.");
          return;
        }
        savedCompetitionId = created.savedCompetitionId;
      } else {
        const updated = await updateCompetition({
          surface: "kid",
          kidId,
          entryId,
          resolvedSharedAthleteId,
          tournamentName: name,
          eventDate,
          resultDraft,
          eventStatusDraft,
          formatDraft,
          promoterDraft,
          medalImageDraft,
          coachNotes: notesDraft,
          competitionVideos,
          matchSnapshots: snapshots,
        });
        if (!updated.ok) {
          logCompSave("ERROR", {
            competitionId: entryId,
            athleteId: kidId,
            sharedAthleteId: resolvedSharedAthleteId ?? null,
            operationKind: "server",
            surface: "parentKidCompetitionEdit",
            phaseDetail: updated.blocked.kind,
          });
          if (updated.blocked.kind === "resolve_miss_edit") {
            Alert.alert(
              "Could not sync",
              "This entry is synced, but this phone could not match it to a writable invite (wrong channel, stale link, or setup not finished). Open Coach link & sharing → Athletes on this invite for the code that ends with the same suffix as your coach shared, then relink this child if needed.",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Coach link settings",
                  onPress: () => router.push("/this-week/manage"),
                },
              ],
            );
            return;
          }
          const msg =
            updated.blocked.kind === "sync_api"
              ? updated.blocked.message
              : "Try again shortly.";
          Alert.alert("Could not sync", msg || "Try again shortly.");
          return;
        }
        savedCompetitionId = updated.savedCompetitionId;
      }
      logCompSave("COMPLETE", {
        competitionId: savedCompetitionId,
        athleteId: kidId,
        sharedAthleteId: resolvedSharedAthleteId ?? null,
        operationKind: "optimistic",
        surface: "parentKidCompetitionEdit",
      });

      // After associations are durable, retry Parent-selected local videos through the upload client.
      const savedEntry = savedCompetitionId
        ? await getKidCompetitionEntryById(savedCompetitionId)
        : null;
      const postSaveSharedCompetitionId = savedEntry
        ? getWorkerCompetitionIdForEntry(savedEntry) || sharedCompetitionId
        : sharedCompetitionId;
      const postSaveSharedAthleteId =
        resolvedSharedAthleteId ||
        savedEntry?.sharedAthleteId?.trim() ||
        sharedAthleteId ||
        null;
      if (postSaveSharedAthleteId && postSaveSharedCompetitionId) {
        for (const match of matches) {
          const localUri = typeof match.videoUri === "string" ? match.videoUri.trim() : "";
          if (!localUri || /^https?:\/\//i.test(localUri)) continue;
          scheduleUploadParentSelectedSharedMatchMedia(
            {
              localUri,
              sharedAthleteId: postSaveSharedAthleteId,
              sharedCompetitionId: postSaveSharedCompetitionId,
              matchLineageKey: match.id,
              traceId:
                parentMatchMediaTraceIdsRef.current[match.id] ??
                `parent-match-media-post-save-${Date.now().toString(36)}`,
              traceTrigger: "post_save",
            },
            {
              onFailure: (message) => {
                Alert.alert("Match video upload failed", message);
              },
            },
          );
        }
      }

      exitEditor({
        navigation,
        actorRole: "parent",
        athleteId: kidId,
        competitionId: savedCompetitionId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logCompSave("ERROR", {
        competitionId: entryId,
        athleteId: kidId,
        operationKind: "optimistic",
        surface: "parentKidCompetitionEdit",
        error: msg,
      });
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
      exitEditor({
        navigation,
        actorRole: "parent",
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
          logCompDelete("BEGIN", {
            competitionId: entryId,
            athleteId: kidId,
            operationKind: "optimistic",
            surface: "parentKidCompetitionEdit.onDelete",
          });
          const outcome = await deleteCompetition({ entryId, kidId });
          if (!outcome.ok) {
            Alert.alert(outcome.alertTitle, outcome.alertMessage);
            return;
          }
          exitEditor({
            navigation,
            actorRole: "parent",
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
            exitEditor({
              navigation,
              actorRole: "parent",
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
              RESULT (OPTIONAL)
            </Text>
            <Text
              style={{ marginTop: 4, fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}
            >
              Tap again to clear.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {RESULTS.map((r) => {
                const active = resultDraft === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() =>
                      setResultDraft((prev) => toggleCompetitionResultDraft(prev, r))
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
