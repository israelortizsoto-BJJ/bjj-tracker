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
import { bestEffortDeletePersistedCoachVoice } from "../../../../../../src/media/persistCoachVoiceAudio";
import {
  createKidCompetitionEntry,
  deleteKidCompetitionEntry,
  getKidCompetitionEntryById,
  updateKidCompetitionEntry,
} from "../../../../../../src/storage/kidCompetitionStore";
import {
  competitionVideoRefsFromMatches,
  getCompetitionDetailForEntry,
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
  competitionResultPersistFields,
  hydrateCompetitionResultDraft,
  newCompetitionResultDraft,
  toggleCompetitionResultDraft,
} from "../../../../../../src/domain/competition/competitionResultDraft";
import {
  createEmptyMatch,
  deriveInitialMatches,
  HOW_ENDED_OPTIONS,
  localMatchFromSnapshot,
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
import { logSaveLifecycleTrace } from "@/src/features/competition/saveLifecycleTrace";
import { deleteCompetition } from "@/src/domain/competition/CompetitionSync";
import { schedulePublishCoachMatchBreakdownArtifacts } from "@/src/domain/competition/publishCoachMatchBreakdownArtifacts";
import { projectCompetitionEditorView } from "@/src/domain/competition/projectCompetitionEditorView";
import { readMatchBreakdownOverlay } from "@/src/domain/competition/readMatchBreakdownOverlay";
import {
  logCompDelete,
  logCompPublishGuard,
  logCompSave,
} from "@/src/dev/competitionMutationDevLog";
import { logMatchBreakdownBoundaryProbe } from "@/src/dev/matchBreakdownBoundaryProbe";
import { logMatchBreakdownAuthorityTrace } from "@/src/dev/matchBreakdownAuthorityTrace";
import { createOverlayForensicTraceId } from "@/src/dev/overlayForensicTrace";
import { upsertMatchBreakdownOverlay } from "@/src/domain/competition/upsertMatchBreakdownOverlay";
import { parentResultsRecorded } from "@/src/domain/competition/parentResultsRecorded";
import { getCoachCompetitionTopology } from "@/src/storage/coachCompetitionTopologyStore";
import type {
  CoachMatchBreakdownOverlay,
  VoiceNoteRef,
} from "@/src/types/coachMatchBreakdownOverlay";

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
    launchSurface?: string | string[];
    returnClass?: string | string[];
    returnScopeId?: string | string[];
  }>();
  const kidId = params.kidId ? String(params.kidId) : "";
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
  const [canonicalReadOnly, setCanonicalReadOnly] = useState(false);
  const [overlayScope, setOverlayScope] = useState<{
    sharedAthleteId: string;
    sharedCompetitionId: string;
  } | null>(null);
  const [linkedCompetition, setLinkedCompetition] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(saving);
  const loadingRef = useRef(loading);
  savingRef.current = saving;
  loadingRef.current = loading;
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
    logCompetitionLaunchContextValidation("coach_kid", launchContextValidation);
  }, [launchContextValidation]);

  /** Single nudge after focus — avoid keyboard frame + content-size loops (dictation overscrolls). */
  const onNotesFocusScroll = useCallback(() => {
    requestAnimationFrame(() => {
      (keyboardAwareRef.current as { update?: () => void } | null)?.update?.();
    });
  }, []);

  const loadExisting = useCallback(async () => {
    if (!entryId) return;
    console.log("[POST_SAVE_TRACE] loadExisting_begin", {
      kidId,
      entryId,
      saving: savingRef.current,
      pathname: String(pathname ?? ""),
      timestamp: Date.now(),
    });
    setLoading(true);
    try {
      const found = await getKidCompetitionEntryById(entryId);
      if (!found || found.kidId !== kidId) {
        Alert.alert("Not found", "This competition entry is missing or belongs to another kid.");
        exitEditor({
          navigation,
          actorRole: "coach",
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
      const { detail } = await getCompetitionDetailForEntry(found);
      const fallbackMatches = deriveInitialMatches(found, detail, reactId);
      const sharedAthleteId = found.sharedAthleteId?.trim() ?? "";
      const sharedCompetitionId = found.sharedCompetitionId?.trim() ?? "";
      const isLinkedCompetition = Boolean(sharedAthleteId || sharedCompetitionId);
      setLinkedCompetition(isLinkedCompetition);
      const topologyArtifact = sharedAthleteId
        ? await getCoachCompetitionTopology(sharedAthleteId)
        : null;
      const topology = topologyArtifact?.competitions.find(
        (competition) => competition.sharedCompetitionId === sharedCompetitionId,
      );
      if (!sharedAthleteId || !sharedCompetitionId || !topology) {
        setCanonicalReadOnly(isLinkedCompetition);
        setOverlayScope(null);
        setMatches(fallbackMatches);
        console.log("[POST_SAVE_TRACE] loadExisting_hydrated", {
          source: "fallback_matches",
          canonicalReadOnly: isLinkedCompetition,
          overlayScope: null,
          matchCount: fallbackMatches.length,
          firstCoachNote: fallbackMatches[0]?.coachNote?.slice(0, 40) ?? null,
        });
        if (__DEV__) {
          console.log("[COMP_EDITOR_TRACE] editor_missing_topology", {
            sharedAthleteId: sharedAthleteId || null,
            sharedCompetitionId: sharedCompetitionId || null,
          });
          console.log("[COMP_EDITOR_TRACE] editor_fallback_used", {
            entryId: found.id,
            fallbackMatchCount: fallbackMatches.length,
          });
        }
        return;
      }

      const canonicalMatchLineageKeys = new Set(
        topology.matches.map((match) => match.matchLineageKey),
      );
      const overlays = (
        await Promise.all(
          topology.matches.map((match) =>
            readMatchBreakdownOverlay(
              {
                sharedAthleteId,
                sharedCompetitionId,
                matchLineageKey: match.matchLineageKey,
              },
              { canonicalMatchLineageKeys },
            ),
          ),
        )
      ).filter((overlay): overlay is CoachMatchBreakdownOverlay => Boolean(overlay));
      const projected = projectCompetitionEditorView({
        shell: found,
        topologyArtifact,
        overlayAnnotations: overlays,
        fallbackMatches: fallbackMatches.map((match) => snapshotFromLocal(match)),
      });
      setCanonicalReadOnly(projected.source === "canonical_topology");
      setOverlayScope({ sharedAthleteId, sharedCompetitionId });
      const nextMatches = projected.matches.map((match) => localMatchFromSnapshot(match));
      setMatches(nextMatches);
      console.log("[POST_SAVE_TRACE] loadExisting_hydrated", {
        source: projected.source,
        canonicalReadOnly: projected.source === "canonical_topology",
        overlayScope: { sharedAthleteId, sharedCompetitionId },
        overlayCount: overlays.length,
        matchCount: nextMatches.length,
        firstCoachNote: nextMatches[0]?.coachNote?.slice(0, 40) ?? null,
      });
    } finally {
      setLoading(false);
      console.log("[POST_SAVE_TRACE] loadExisting_end", {
        kidId,
        entryId,
        saving: savingRef.current,
        timestamp: Date.now(),
      });
    }
  }, [entryId, kidId, reactId, navigation, pathname, exitEditor]);

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      exitEditor({
        navigation,
        actorRole: "coach",
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
    setCanonicalReadOnly(false);
    setOverlayScope(null);
    setLinkedCompetition(false);
    setLoading(false);
  }, [isNew, openNonce]);

  useEffect(() => {
    return () => {
      logSaveLifecycleTrace("edit_screen_unmount", {
        competitionId: entryId || null,
        sharedCompetitionId: overlayScope?.sharedCompetitionId ?? null,
        saving: savingRef.current,
        kidId,
        pathname: String(pathname ?? ""),
      });
      console.log("[COMP_EDITOR_UNMOUNT]", {
        ts: Date.now(),
        pathname: String(pathname ?? ""),
        kidId,
      });
      console.log("[SAVE_PRESS_TRACE] unmount", {
        saving: savingRef.current,
        loading: loadingRef.current,
        pathname: String(pathname ?? ""),
        kidId,
        entryId: entryId || null,
        timestamp: Date.now(),
      });
      if (savingRef.current) {
        console.log("[SAVE_PRESS_TRACE] unmount_while_saving", {
          saving: savingRef.current,
          loading: loadingRef.current,
          pathname: String(pathname ?? ""),
          kidId,
          entryId: entryId || null,
          timestamp: Date.now(),
        });
      }
    };
  }, [pathname, kidId, entryId]);

  useFocusEffect(
    useCallback(() => {
      console.log("[SAVE_PRESS_TRACE] edit_screen_focus", {
        saving: savingRef.current,
        loading: loadingRef.current,
        canonicalReadOnly,
        overlayScope: !!overlayScope,
        kidId,
        entryId: entryId || null,
        timestamp: Date.now(),
      });
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
          setResultDraft(newCompetitionResultDraft());
          setEventStatusDraft(undefined);
          setPromoterDraft("");
          setFormatDraft(undefined);
          setNotesDraft("");
          setMedalImageDraft(undefined);
          setMatches([createEmptyMatch(`new-${Date.now()}`)]);
          setCanonicalReadOnly(false);
          setOverlayScope(null);
          setLinkedCompetition(false);
        }
        setLoading(false);
        return () => {
          logSaveLifecycleTrace("edit_screen_blur", {
            competitionId: entryId || null,
            sharedCompetitionId: overlayScope?.sharedCompetitionId ?? null,
            saving: savingRef.current,
            isNew,
            kidId,
          });
          console.log("[SAVE_PRESS_TRACE] edit_screen_blur", {
            saving: savingRef.current,
            loading: loadingRef.current,
            canonicalReadOnly,
            overlayScope: !!overlayScope,
            kidId,
            entryId: entryId || null,
            isNew,
            timestamp: Date.now(),
          });
        };
      }
      console.log("[POST_SAVE_TRACE] focus_effect_loadExisting_scheduled", {
        kidId,
        entryId: entryId || null,
        saving: savingRef.current,
        timestamp: Date.now(),
      });
      void loadExisting();
      return () => {
        logSaveLifecycleTrace("edit_screen_blur", {
          competitionId: entryId || null,
          sharedCompetitionId: overlayScope?.sharedCompetitionId ?? null,
          saving: savingRef.current,
          isNew,
          kidId,
        });
        console.log("[POST_SAVE_TRACE] focus_effect_cleanup_blur", {
          kidId,
          entryId: entryId || null,
          saving: savingRef.current,
          timestamp: Date.now(),
        });
        console.log("[SAVE_PRESS_TRACE] edit_screen_blur", {
          saving: savingRef.current,
          loading: loadingRef.current,
          canonicalReadOnly,
          overlayScope: !!overlayScope,
          kidId,
          entryId: entryId || null,
          isNew,
          timestamp: Date.now(),
        });
      };
    }, [isNew, loadExisting, openNonce, pathname, segments, kidId, entryId]),
  );

  const canSave = useMemo(() => {
    return nameDraft.trim().length > 0 && isValidYMD(dateDraft);
  }, [nameDraft, dateDraft]);

  /** INV-CIL-4: Coach Match Breakdown authoring/publish requires ParentResultsRecorded. */
  const parentResultsOk = useMemo(
    () =>
      parentResultsRecorded({
        eventDate: dateDraft,
        eventStatus: eventStatusDraft,
        result: resultDraft,
        matches,
      }),
    [dateDraft, eventStatusDraft, resultDraft, matches],
  );

  const matchBreakdownAuthoringBlocked =
    Boolean(canonicalReadOnly && overlayScope) && !parentResultsOk;

  const savePressDisabled =
    (!canonicalReadOnly && !canSave) ||
    saving ||
    loading ||
    matchBreakdownAuthoringBlocked;

  console.log("[SAVE_PRESS_TRACE] render_state", {
    saving,
    loading,
    disabled: savePressDisabled,
    canonicalReadOnly,
    overlayScope: !!overlayScope,
    canSave,
    parentResultsOk,
    matchBreakdownAuthoringBlocked,
    timestamp: Date.now(),
  });

  const saveDisabledHint = useMemo(() => {
    if (matchBreakdownAuthoringBlocked) {
      return "Parent must record a competition result or match outcomes before Match Breakdown can be saved.";
    }
    if (canSave) return null;
    const missingName = nameDraft.trim().length === 0;
    const badDate = !isValidYMD(dateDraft);
    if (missingName && badDate) {
      return "Add a tournament name and a valid event date (YYYY-MM-DD) to enable Save.";
    }
    if (missingName) return "Add a tournament name to enable Save.";
    return "Use a valid event date (YYYY-MM-DD) to enable Save.";
  }, [matchBreakdownAuthoringBlocked, canSave, nameDraft, dateDraft]);

  const setMatchOutcome = useCallback((matchIndex: number, label: (typeof HOW_ENDED_OPTIONS)[number]) => {
    if (canonicalReadOnly) {
      if (__DEV__) console.log("[COMP_EDITOR_TRACE] editor_canonical_edit_blocked", { field: "finish_type" });
      return;
    }
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
  }, [canonicalReadOnly]);

  const setMatchResult = useCallback((matchIndex: number, v: (typeof MATCH_RESULT_OPTIONS)[number]["value"]) => {
    if (canonicalReadOnly) {
      if (__DEV__) console.log("[COMP_EDITOR_TRACE] editor_canonical_edit_blocked", { field: "match_result" });
      return;
    }
    setMatches((prev) =>
      prev.map((m, i) => (i === matchIndex ? { ...m, matchResult: m.matchResult === v ? null : v } : m)),
    );
  }, [canonicalReadOnly]);

  const setMatchSubmissionTime = useCallback((matchIndex: number, text: string) => {
    if (canonicalReadOnly) {
      if (__DEV__) console.log("[COMP_EDITOR_TRACE] editor_canonical_edit_blocked", { field: "duration" });
      return;
    }
    setMatches((prev) =>
      prev.map((m, i) => (i === matchIndex ? { ...m, submissionTime: normalizeSubmissionTimeInput(text) } : m)),
    );
  }, [canonicalReadOnly]);

  const setMatchSubmissionType = useCallback((matchIndex: number, key: string | null) => {
    if (canonicalReadOnly) {
      if (__DEV__) console.log("[COMP_EDITOR_TRACE] editor_canonical_edit_blocked", { field: "submission_type" });
      return;
    }
    setMatches((prev) => prev.map((m, i) => (i === matchIndex ? { ...m, submissionType: key } : m)));
  }, [canonicalReadOnly]);

  const setMatchCoachNote = useCallback((matchIndex: number, text: string) => {
    setMatches((prev) => prev.map((m, i) => (i === matchIndex ? { ...m, coachNote: text } : m)));
  }, []);

  const setMatchVoiceNotePersisted = useCallback((matchIndex: number, localUri: string) => {
    const uri = localUri.trim();
    if (!uri) return;
    setMatches((prev) =>
      prev.map((m, i) => {
        if (i !== matchIndex) return m;
        const previousUri = m.voiceNoteRefs?.[0]?.localUri;
        if (previousUri && previousUri !== uri) {
          void bestEffortDeletePersistedCoachVoice(previousUri);
        }
        const nextRef: VoiceNoteRef = {
          id: `voice-${Date.now().toString(16)}`,
          localUri: uri,
          createdAt: new Date().toISOString(),
          mimeType: "audio/mp4",
        };
        return { ...m, voiceNoteRefs: [nextRef] };
      }),
    );
  }, []);

  const updateMatchMedia = useCallback(
    (matchIndex: number, patch: Partial<Pick<LocalMatch, "imageUri" | "videoUri" | "imageAssetId" | "videoAssetId">>) => {
      if (canonicalReadOnly) {
        if (__DEV__) console.log("[COMP_EDITOR_TRACE] editor_canonical_edit_blocked", { field: "match_media" });
        return;
      }
      setMatches((prev) => prev.map((m, i) => (i === matchIndex ? { ...m, ...patch } : m)));
    },
    [canonicalReadOnly],
  );

  const addMatch = useCallback(() => {
    if (canonicalReadOnly) {
      if (__DEV__) console.log("[COMP_EDITOR_TRACE] editor_canonical_edit_blocked", { field: "match_create" });
      return;
    }
    setMatches((prev) => [...prev, createEmptyMatch(`${Date.now()}`)]);
  }, [canonicalReadOnly]);

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
      if (canonicalReadOnly) {
        if (__DEV__) console.log("[COMP_EDITOR_TRACE] editor_canonical_edit_blocked", { field: "match_delete" });
        return;
      }
      if (matches.length === 1) {
        Alert.alert("Clear match?", "This will reset this match.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear",
            style: "destructive",
            onPress: () =>
              setMatches((prev) =>
                prev.map((m) => {
                  if (m.id !== matchId) return m;
                  for (const ref of m.voiceNoteRefs ?? []) {
                    void bestEffortDeletePersistedCoachVoice(ref.localUri);
                  }
                  return {
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
                    voiceNoteRefs: undefined,
                  };
                }),
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
          onPress: () =>
            setMatches((prev) => {
              if (prev.length <= 1) return prev;
              const target = prev.find((m) => m.id === matchId);
              for (const ref of target?.voiceNoteRefs ?? []) {
                void bestEffortDeletePersistedCoachVoice(ref.localUri);
              }
              return prev.filter((m) => m.id !== matchId);
            }),
        },
      ]);
    },
    [canonicalReadOnly, matches.length],
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
    logSaveLifecycleTrace("save_handler_enter", {
      competitionId: entryId || null,
      sharedCompetitionId: overlayScope?.sharedCompetitionId ?? null,
      saving: savingRef.current,
      kidId,
    });
    console.log("[SAVE_PRESS_TRACE] handler_enter", {
      athleteId: kidId,
      competitionId: entryId || null,
      matchId: matches[0]?.id ?? null,
      timestamp: Date.now(),
    });
    if ((!canonicalReadOnly && !canSave) || !kidId) {
      if (!kidId) {
        console.log("[SAVE_PRESS_TRACE] early_return_missing_ids");
      } else {
        console.log("[SAVE_PRESS_TRACE] early_return_disabled_state", {
          canSave,
          canonicalReadOnly,
        });
      }
      return;
    }
    if (canonicalReadOnly && !overlayScope) {
      logCompPublishGuard({
        competitionId: entryId,
        athleteId: kidId,
        operationKind: "canonical",
        surface: "coachCompetitionEdit.canonical_overlay_only",
        phaseDetail: "missing_topology_blocks_legacy_canonical_write",
      });
      Alert.alert(
        "Still syncing",
        "Canonical match details are not available yet. Refresh and reopen this competition before saving coach notes.",
      );
      console.log("[SAVE_PRESS_TRACE] early_return_stale_guard", {
        canonicalReadOnly,
        overlayScope: overlayScope ?? null,
      });
      return;
    }
    if (canonicalReadOnly && overlayScope) {
      if (
        !parentResultsRecorded({
          eventDate: dateDraft,
          eventStatus: eventStatusDraft,
          result: resultDraft,
          matches,
        })
      ) {
        logCompPublishGuard({
          competitionId: entryId,
          athleteId: kidId,
          operationKind: "canonical",
          surface: "coachCompetitionEdit.canonical_overlay_only",
          phaseDetail: "parent_results_recorded_required_for_match_breakdown",
        });
        Alert.alert(
          "Results required",
          "Parent must record a competition result or match outcomes before Match Breakdown can be saved.",
        );
        console.log("[SAVE_PRESS_TRACE] early_return_parent_results_gate", {
          eventDate: dateDraft,
          eventStatus: eventStatusDraft ?? null,
          hasResult: typeof resultDraft !== "undefined",
          matchCount: matches.length,
        });
        return;
      }
      logCompSave("BEGIN", {
        competitionId: entryId,
        athleteId: kidId,
        sharedAthleteId: overlayScope.sharedAthleteId,
        canonicalPayloadIds: [overlayScope.sharedCompetitionId],
        overlayCount: matches.length,
        operationKind: "canonical",
        surface: "coachCompetitionEdit.canonical_overlay_only",
        lineageKey: matches[0]?.id ?? null,
      });
      console.log("[SAVE_PRESS_TRACE] setSaving", {
        value: true,
        path: "overlay",
        timestamp: Date.now(),
      });
      setSaving(true);
      try {
        logSaveLifecycleTrace("mutation_begin", {
          competitionId: entryId || null,
          sharedCompetitionId: overlayScope.sharedCompetitionId,
          saving: true,
          path: "overlay",
        });
        console.log("[SAVE_PRESS_TRACE] mutation_begin", {
          path: "overlay",
          overlayCount: matches.length,
        });
        const overlayForensicTraceId = createOverlayForensicTraceId(overlayScope.sharedAthleteId);
        logMatchBreakdownAuthorityTrace("COACH_SAVE_START", {
          traceId: overlayForensicTraceId,
          sharedAthleteId: overlayScope.sharedAthleteId,
          sharedCompetitionId: overlayScope.sharedCompetitionId,
          matchLineageKey: matches[0]?.id ?? null,
          competitionId: entryId || null,
          overlayCountBeforeSave: matches.length,
          matchCount: matches.length,
          coachNoteLengths: matches.map((m) => (m.coachNote ?? "").trim().length),
        });
        const intendedCoachNoteLengths = matches.map((m) => (m.coachNote ?? "").trim().length);
        const persistedCoachNoteLengths: number[] = [];
        const persistedUpdatedAts: string[] = [];
        const writeRejectReasons: string[] = [];
        for (const [sequenceIndex, match] of matches.entries()) {
          console.log("[OVERLAY_SERIAL_SAVE]", {
            matchId: match.id,
            ordinal: sequenceIndex + 1,
            sequenceIndex,
          });
          const upsertResult = await upsertMatchBreakdownOverlay({
            identity: {
              ...overlayScope,
              matchLineageKey: match.id,
            },
            patch: {
              coachNote: match.coachNote?.trim() || null,
              voiceNoteRefs: match.voiceNoteRefs?.length ? match.voiceNoteRefs : null,
            },
            traceId: overlayForensicTraceId,
          });
          if (!upsertResult) {
            writeRejectReasons.push(`${match.id}:overlay_upsert_rejected`);
            persistedCoachNoteLengths.push(0);
            persistedUpdatedAts.push("");
          } else {
            persistedCoachNoteLengths.push((upsertResult.coachNote ?? "").trim().length);
            persistedUpdatedAts.push(upsertResult.updatedAt);
          }
        }
        const targetMatch =
          matches.find((m) => (m.coachNote ?? "").trim().length > 0) ?? matches[0];
        let b1Outcome: "pass" | "fail" = "pass";
        for (let i = 0; i < matches.length; i += 1) {
          if (intendedCoachNoteLengths[i] > 0 && persistedCoachNoteLengths[i] === 0) {
            b1Outcome = "fail";
            break;
          }
        }
        logMatchBreakdownBoundaryProbe({
          probeId: "B1",
          outcome: b1Outcome,
          deviceRole: "coach",
          traceId: overlayForensicTraceId,
          sharedAthleteId: overlayScope.sharedAthleteId,
          sharedCompetitionId: overlayScope.sharedCompetitionId,
          matchLineageKey: targetMatch?.id ?? null,
          matchLineageKeys: matches.map((m) => m.id),
          intendedCoachNoteLengths,
          persistedCoachNoteLengths,
          persistedUpdatedAts,
          writeRejectReasons,
        });
        logSaveLifecycleTrace("mutation_complete", {
          competitionId: entryId || null,
          sharedCompetitionId: overlayScope.sharedCompetitionId,
          saving: true,
          path: "overlay",
        });
        console.log("[SAVE_PRESS_TRACE] mutation_complete", {
          path: "overlay",
          overlayCount: matches.length,
        });
        console.log("[POST_SAVE_TRACE] mutation_complete_overlay", {
          kidId,
          entryId,
          overlayScope,
          draftCoachNotes: matches.map((m) => m.coachNote?.trim() || null),
          timestamp: Date.now(),
        });
        console.log("[COACH_OVERLAY_SYNC_TRACE]", {
          stage: "coach_local_overlay_saved",
          sharedAthleteId: overlayScope.sharedAthleteId,
          sharedCompetitionId: overlayScope.sharedCompetitionId,
          artifactCount: matches.filter((m) => (m.coachNote ?? "").trim().length > 0).length,
          lineageIds: matches.map((m) => m.id),
          publishPayloadCount: matches.filter((m) => (m.coachNote ?? "").trim().length > 0).length,
          publishLane: "coach_match_breakdown_artifacts",
          note: "Local coach overlay store write completed; bounded remote artifact publish scheduled.",
        });
        schedulePublishCoachMatchBreakdownArtifacts({
          sharedAthleteId: overlayScope.sharedAthleteId,
          kidId,
          traceId: overlayForensicTraceId,
        });
        if (__DEV__) {
          console.log("[COMP_EDITOR_TRACE] editor_overlay_saved", {
            ...overlayScope,
            overlayCount: matches.length,
          });
        }
        logCompSave("COMPLETE", {
          competitionId: entryId,
          athleteId: kidId,
          sharedAthleteId: overlayScope.sharedAthleteId,
          canonicalPayloadIds: [overlayScope.sharedCompetitionId],
          overlayCount: matches.length,
          operationKind: "canonical",
          surface: "coachCompetitionEdit.canonical_overlay_only",
        });
        console.log("[POST_SAVE_TRACE] pre_exit_to_compete", {
          kidId,
          entryId,
          canonicalReadOnly,
          overlayScope,
          pathname: String(pathname ?? ""),
          canGoBack: router.canGoBack(),
        });
        exitEditor({
          navigation,
          actorRole: "coach",
          athleteId: kidId,
          competitionId: entryId,
          sharedCompetitionId: overlayScope.sharedCompetitionId,
          saving: savingRef.current,
        });
        console.log("[POST_SAVE_TRACE] post_exit_to_compete_sync_return", {
          kidId,
          entryId,
          pathname: String(pathname ?? ""),
          timestamp: Date.now(),
        });
      } catch (e) {
        console.log("[SAVE_PRESS_TRACE] mutation_error", e);
        const msg = e instanceof Error ? e.message : String(e);
        logCompSave("ERROR", {
          competitionId: entryId,
          athleteId: kidId,
          sharedAthleteId: overlayScope.sharedAthleteId,
          operationKind: "canonical",
          surface: "coachCompetitionEdit.canonical_overlay_only",
          error: msg,
        });
        Alert.alert("Could not save", msg || "Coach notes could not be saved.");
      } finally {
        console.log("[SAVE_PRESS_TRACE] finally", {
          path: "overlay",
          savingBeforeClear: savingRef.current,
          loading: loadingRef.current,
          timestamp: Date.now(),
        });
        console.log("[COMP_EDITOR_FINALLY]", {
          ts: Date.now(),
          pathname: String(pathname ?? ""),
          kidId,
        });
        logSaveLifecycleTrace("setSaving_false", {
          competitionId: entryId || null,
          sharedCompetitionId: overlayScope.sharedCompetitionId,
          saving: savingRef.current,
          path: "overlay",
        });
        console.log("[SAVE_PRESS_TRACE] setSaving", {
          value: false,
          path: "overlay",
          timestamp: Date.now(),
        });
        setSaving(false);
      }
      return;
    }
    const name = nameDraft.trim();
    const eventDate = dateDraft.trim();
    if (!isValidYMD(eventDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      console.log("[SAVE_PRESS_TRACE] early_return_invalid_payload", { eventDate });
      return;
    }

    const snapshots = matches.map((m) => snapshotFromLocal(m));
    const competitionVideos = competitionVideoRefsFromMatches(snapshots);

    logCompSave("BEGIN", {
      competitionId: isNew ? null : entryId,
      athleteId: kidId,
      operationKind: "optimistic",
      surface: "coachCompetitionEdit.local_shell",
      overlayCount: snapshots.length,
    });

    console.log("[SAVE_PRESS_TRACE] setSaving", {
      value: true,
      path: "local_shell",
      timestamp: Date.now(),
    });
    setSaving(true);
    try {
      logSaveLifecycleTrace("mutation_begin", {
        competitionId: isNew ? null : entryId,
        sharedCompetitionId: overlayScope?.sharedCompetitionId ?? null,
        saving: true,
        path: "local_shell",
      });
      const kidsByIdForShared = await getKidsById();
      const resolvedSharedAthleteId =
        (kidsByIdForShared[kidId]?.sharedAthleteId ?? "").trim() || undefined;
      if (linkedCompetition || (isNew && resolvedSharedAthleteId)) {
        logCompPublishGuard({
          competitionId: isNew ? null : entryId,
          athleteId: kidId,
          sharedAthleteId: resolvedSharedAthleteId ?? null,
          operationKind: "canonical",
          surface: "coachCompetitionEdit.local_shell",
          phaseDetail: "linked_competition_blocks_legacy_canonical_write",
        });
        Alert.alert(
          "Coach review only",
          "Linked competition facts are managed by the parent. Refresh and reopen the competition to add coach notes.",
        );
        console.log("[SAVE_PRESS_TRACE] early_return_coach_role_blocked", {
          linkedCompetition,
          isNew,
          resolvedSharedAthleteId: resolvedSharedAthleteId ?? null,
        });
        return;
      }

      let savedCompetitionId = entryId;
      console.log("[SAVE_PRESS_TRACE] mutation_begin", {
        path: "local_shell",
        isNew,
      });
      if (isNew) {
        const created = await createKidCompetitionEntry({
          kidId,
          tournamentName: name,
          eventDate,
          ...competitionResultPersistFields(resultDraft),
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
      logSaveLifecycleTrace("mutation_complete", {
        competitionId: savedCompetitionId,
        sharedCompetitionId: overlayScope?.sharedCompetitionId ?? null,
        saving: true,
        path: "local_shell",
      });
      console.log("[SAVE_PRESS_TRACE] mutation_complete", {
        path: "local_shell",
        competitionId: savedCompetitionId,
      });
      console.log("[COMPETITION_SAVE]", {
        competitionId: savedCompetitionId,
        sharedAthleteId: resolvedSharedAthleteId ?? null,
        actorRole: "coach",
      });
      logCompSave("COMPLETE", {
        competitionId: savedCompetitionId,
        athleteId: kidId,
        sharedAthleteId: resolvedSharedAthleteId ?? null,
        operationKind: "local",
        surface: "coachCompetitionEdit.local_shell",
        overlayCount: snapshots.length,
        localStoreAffected: "kidCompetitionStore+competitionDetailStore",
      });
      exitEditor({
        navigation,
        actorRole: "coach",
        athleteId: kidId,
        competitionId: savedCompetitionId,
        sharedCompetitionId: overlayScope?.sharedCompetitionId ?? null,
        saving: savingRef.current,
      });
    } catch (e) {
      console.log("[SAVE_PRESS_TRACE] mutation_error", e);
      const msg = e instanceof Error ? e.message : String(e);
      logCompSave("ERROR", {
        competitionId: entryId,
        athleteId: kidId,
        operationKind: "local",
        surface: "coachCompetitionEdit.local_shell",
        error: msg,
      });
      Alert.alert(
        "Could not save",
        msg ||
          "Competition data could not be saved. If this keeps happening, try shorter notes or remove the video(s) and save again.",
      );
    } finally {
      console.log("[SAVE_PRESS_TRACE] finally", {
        path: "local_shell",
        savingBeforeClear: savingRef.current,
        loading: loadingRef.current,
        timestamp: Date.now(),
      });
      console.log("[COMP_EDITOR_FINALLY]", {
        ts: Date.now(),
        pathname: String(pathname ?? ""),
        kidId,
      });
      logSaveLifecycleTrace("setSaving_false", {
        competitionId: entryId || null,
        sharedCompetitionId: overlayScope?.sharedCompetitionId ?? null,
        saving: savingRef.current,
        path: "local_shell",
      });
      console.log("[SAVE_PRESS_TRACE] setSaving", {
        value: false,
        path: "local_shell",
        timestamp: Date.now(),
      });
      setSaving(false);
    }
  }

  function onDelete() {
    if (isNew) {
      exitEditor({
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
          if (linkedCompetition) {
            const outcome = await deleteCompetition({ entryId, kidId });
            if (!outcome.ok) {
              Alert.alert(outcome.alertTitle, outcome.alertMessage);
              return;
            }
            exitEditor({
              navigation,
              actorRole: "coach",
              athleteId: kidId,
              competitionId: entryId,
            });
            return;
          }
          logCompDelete("BEGIN", {
            competitionId: entryId,
            athleteId: kidId,
            operationKind: "optimistic",
            surface: "coachCompetitionEdit.onDelete",
            phaseDetail: "local_only_no_remote_delete",
            localStoreAffected: "kidCompetitionStore",
          });
          await deleteKidCompetitionEntry(entryId);
          logCompDelete("COMPLETE", {
            competitionId: entryId,
            athleteId: kidId,
            operationKind: "local",
            surface: "coachCompetitionEdit.onDelete",
            phaseDetail: "local_only_no_remote_delete",
          });
          exitEditor({
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
            exitEditor({
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
            {canonicalReadOnly ? (
              <Text style={{ marginBottom: 12, fontSize: 13, color: UI.textSecondary, lineHeight: 18 }}>
                Canonical competition facts are parent-owned. Add coach notes to the matches below.
              </Text>
            ) : null}
            <View
              pointerEvents={canonicalReadOnly ? "none" : "auto"}
              style={canonicalReadOnly ? { opacity: 0.6 } : undefined}
            >
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
            </View>

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
            {matches.map((m, i) => {
              const matchBlock = (
                <MatchBlock
                    index={i}
                    match={m}
                    canonicalReadOnly={canonicalReadOnly}
                    matchBreakdownDisabled={matchBreakdownAuthoringBlocked}
                    onToggleMatchResult={(v) => setMatchResult(i, v)}
                    onToggleOutcome={(label) => setMatchOutcome(i, label)}
                    onSubmissionTimeChange={(text) => setMatchSubmissionTime(i, text)}
                    onSubmissionTypeChange={(key) => setMatchSubmissionType(i, key)}
                    onCoachNoteChange={(text) => setMatchCoachNote(i, text)}
                    onCoachNoteFocus={onNotesFocusScroll}
                    onVoiceNotePersisted={(localUri) => setMatchVoiceNotePersisted(i, localUri)}
                    onImageChange={(uri, assetId) => updateMatchMedia(i, { imageUri: uri, imageAssetId: assetId })}
                    onVideoChange={(uri, assetId) => updateMatchMedia(i, { videoUri: uri, videoAssetId: assetId })}
                  />
              );
              return (
                <View
                  key={m.id}
                  style={{
                    alignSelf: "stretch",
                    marginTop: i === 0 ? 10 : 12,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {canonicalReadOnly ? (
                    matchBlock
                  ) : (
                    <Swipeable
                      renderRightActions={() => renderDeleteAction(m.id)}
                      friction={1.1}
                      rightThreshold={24}
                      overshootRight
                      dragOffsetFromRightEdge={10}
                    >
                      {matchBlock}
                    </Swipeable>
                  )}
                </View>
              );
            })}

            {!canonicalReadOnly ? <Pressable
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
            </Pressable> : null}

            {(() => {
              console.log("[SAVE_PRESS_TRACE] pre_pressable_render", {
                saving,
                loading,
                disabled: savePressDisabled,
                canonicalReadOnly,
                overlayScope: !!overlayScope,
                canSave,
                timestamp: Date.now(),
              });
              return null;
            })()}

            <Pressable
              disabled={savePressDisabled}
              onPress={() => {
                console.log("[SAVE_PRESS_TRACE] pressable_onPress", {
                  athleteId: kidId,
                  competitionId: entryId || null,
                  matchId: matches[0]?.id ?? null,
                  timestamp: Date.now(),
                  disabled: savePressDisabled,
                  saving,
                  loading,
                  canonicalReadOnly,
                  canSave,
                });
                void onSave();
              }}
              style={({ pressed }) => ({
                marginTop: 24,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.accent,
                backgroundColor: pressed ? UI.accent : UI.accent,
                opacity: savePressDisabled ? 0.5 : 1,
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

            {!isNew && !canonicalReadOnly ? (
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
