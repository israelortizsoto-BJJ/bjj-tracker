import { Stack, router, useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatchMediaAttachments } from "../../src/components/MatchMediaAttachments";
import {
  competitionVideoRefsFromMatches,
  type CompetitionDetailMatchSnapshot,
  getCompetitionDetailByEntryId,
  setCompetitionDetailForEntryId,
} from "../../src/storage/competitionStore";
import { getKidCompetitionEntryById, updateKidCompetitionEntry } from "../../src/storage/kidCompetitionStore";
import type { KidCompetitionEntry } from "../../src/types/coachKid";

// UI tokens mirror the coach competition editor; static layout + local state only.
const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
} as const;

// Local label lists — same surface as add/edit (kid competition), without shared types.
const FORMAT_OPTIONS = [
  { value: "gi" as const, label: "Gi" },
  { value: "nogi" as const, label: "No-Gi" },
  { value: "both" as const, label: "Both" },
];

const EVENT_STATUS_OPTIONS = [
  { value: "upcoming" as const, label: "Upcoming" },
  { value: "completed" as const, label: "Completed" },
  { value: "cancelled" as const, label: "Cancelled" },
  { value: "unknown" as const, label: "Unknown" },
];

const RESULT_OPTIONS = [
  { value: "gold" as const, label: "Gold" },
  { value: "silver" as const, label: "Silver" },
  { value: "bronze" as const, label: "Bronze" },
  { value: "participated" as const, label: "Participated" },
  { value: "dnf" as const, label: "DNF" },
  { value: "other" as const, label: "Other" },
];

export const HOW_ENDED_OPTIONS = [
  "Submission",
  "Points",
  "Ref Decision",
  "DQ",
  "Injury",
] as const;

export const MATCH_RESULT_OPTIONS = [
  { value: "win" as const, label: "Win" },
  { value: "loss" as const, label: "Loss" },
] as const;

export type LocalMatch = {
  id: string;
  matchResult: (typeof MATCH_RESULT_OPTIONS)[number]["value"] | null;
  outcome: (typeof HOW_ENDED_OPTIONS)[number] | null;
  submissionTime: string | null;
  coachNote?: string;
  imageUri: string | null;
  videoUri: string | null;
  imageAssetId: string | null;
  videoAssetId: string | null;
};

export function createEmptyMatch(idSuffix: string): LocalMatch {
  return {
    id: `match-${idSuffix}`,
    matchResult: null,
    outcome: null,
    submissionTime: null,
    coachNote: "",
    imageUri: null,
    videoUri: null,
    imageAssetId: null,
    videoAssetId: null,
  };
}

export function snapshotFromLocal(m: LocalMatch): CompetitionDetailMatchSnapshot {
  const submissionTime =
    typeof m.submissionTime === "string" && m.submissionTime.trim().length > 0
      ? m.submissionTime.trim()
      : null;
  const coachNote =
    typeof m.coachNote === "string" && m.coachNote.trim().length > 0
      ? m.coachNote.trim()
      : undefined;
  return {
    id: m.id,
    matchResult: m.matchResult,
    outcome: m.outcome,
    submissionTime,
    coachNote,
    imageUri: m.imageUri,
    videoUri: m.videoUri,
    imageAssetId: m.imageAssetId,
    videoAssetId: m.videoAssetId,
  };
}

/** Interpret digits as mm:ss (last two digits are seconds); persists as displayed string. */
function submissionTimeDigitsToMmSs(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length === 0) return null;
  if (d.length <= 2) {
    return `0:${d.padStart(2, "0")}`;
  }
  const ss = d.slice(-2);
  const mmRaw = d.slice(0, -2);
  const mmNum = parseInt(mmRaw, 10);
  const mm = Number.isFinite(mmNum) ? String(mmNum) : "0";
  return `${mm}:${ss}`;
}

export function normalizeSubmissionTimeInput(raw: string): string | null {
  return submissionTimeDigitsToMmSs(raw);
}

export function localMatchFromSnapshot(m: CompetitionDetailMatchSnapshot): LocalMatch {
  const raw = (m as { submissionTime?: unknown }).submissionTime;
  let submissionTime: string | null = null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    submissionTime = normalizeSubmissionTimeInput(raw.trim());
  }
  const rawCoachNote = (m as { coachNote?: unknown }).coachNote;
  const coachNote = typeof rawCoachNote === "string" ? rawCoachNote : "";
  return {
    id: m.id,
    matchResult: m.matchResult,
    outcome: m.outcome,
    submissionTime,
    coachNote,
    imageUri: m.imageUri,
    videoUri: m.videoUri,
    imageAssetId: m.imageAssetId,
    videoAssetId: m.videoAssetId,
  };
}

/** Per-match detail in competitionStore, or a single match hydrated from `KidCompetitionEntry` video fields. */
export function deriveInitialMatches(
  entry: KidCompetitionEntry,
  detail: Awaited<ReturnType<typeof getCompetitionDetailByEntryId>>,
  idSuffix: string,
): LocalMatch[] {
  if (detail && detail.matches.length > 0) {
    return detail.matches.map((m) => localMatchFromSnapshot(m));
  }
  const u = typeof entry.videoUri === "string" ? entry.videoUri.trim() : "";
  const aid = typeof entry.videoAssetId === "string" && entry.videoAssetId.trim() ? entry.videoAssetId.trim() : null;
  if (u) {
    return [
      {
        id: `match-legacy-${idSuffix}`,
        matchResult: null,
        outcome: null,
        submissionTime: null,
        coachNote: "",
        imageUri: null,
        videoUri: u,
        videoAssetId: aid,
        imageAssetId: null,
      },
    ];
  }
  return [createEmptyMatch(`init-${idSuffix}`)];
}

const SectionLabel = ({ children }: { children: string }) => (
  <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
    {children}
  </Text>
);

const chipPressable = (active: boolean) =>
  ({ pressed }: { pressed: boolean }) => ({
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: active ? UI.accent : UI.border,
    backgroundColor: active ? "#edf2ff" : UI.bgCard,
    opacity: pressed ? 0.9 : 1,
  });

export function MatchBlock({
  index,
  match,
  onToggleMatchResult,
  onToggleOutcome,
  onSubmissionTimeChange,
  onCoachNoteChange,
  onCoachNoteFocus,
  onCoachNoteLayout,
  onImageChange,
  onVideoChange,
}: {
  index: number;
  match: LocalMatch;
  onToggleMatchResult: (v: (typeof MATCH_RESULT_OPTIONS)[number]["value"]) => void;
  onToggleOutcome: (label: (typeof HOW_ENDED_OPTIONS)[number]) => void;
  onSubmissionTimeChange: (text: string) => void;
  onCoachNoteChange: (text: string) => void;
  onCoachNoteFocus?: () => void;
  onCoachNoteLayout?: (y: number) => void;
  onImageChange: (uri: string | null, assetId: string | null) => void;
  onVideoChange: (uri: string | null, assetId: string | null) => void;
}) {
  type RecordingState = "idle" | "recording" | "processing" | "done";
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    if (match.videoUri) return;
    setIsPlaying(false);
  }, [match.videoUri]);

  useEffect(() => {
    console.log("[RECORDING STATE]", recordingState);
  }, [recordingState]);

  useEffect(() => {
    console.log("[NOTE SET]", (match.coachNote ?? "").length);
  }, [match.coachNote]);

  useEffect(() => {
    return () => {
      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      if (!activeRecording) return;
      void activeRecording.stopAndUnloadAsync().catch(() => {
        // No-op cleanup on unmount.
      });
    };
  }, []);

  const transcribeAudio = useCallback(async (uri: string): Promise<string> => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
    }

    const formData = new FormData();
    formData.append("file", {
      uri,
      name: "audio.m4a",
      type: "audio/m4a",
    } as unknown as Blob);
    formData.append("model", "whisper-1");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const json = (await res.json()) as { text?: string; error?: { message?: string } };
    if (!res.ok) {
      const message = json?.error?.message ?? "Transcription request failed";
      throw new Error(message);
    }
    const text = typeof json.text === "string" ? json.text.trim() : "";
    if (!text) {
      throw new Error("No transcription text returned");
    }
    return text;
  }, []);

  const startRecording = useCallback(async () => {
    if (recordingState === "recording" || recordingState === "processing") return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Microphone access needed", "Allow microphone access to record a coach note.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;

      // Force media UI back to non-playing to avoid overlap with recording.
      setIsPlaying(false);
      setRecordingState("recording");
    } catch (error) {
      console.error("Recording start failed", error);
      Alert.alert("Recording failed", "Could not start recording. Try again.");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    }
  }, [recordingState]);

  const stopRecording = useCallback(async () => {
    if (recordingState !== "recording") return;
    setRecordingState("processing");

    const recording = recordingRef.current;
    recordingRef.current = null;

    try {
      if (!recording) {
        throw new Error("No active recording");
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log("AUDIO URI:", uri);
      if (!uri) {
        throw new Error("Missing recording URI");
      }

      const text = await transcribeAudio(uri);
      onCoachNoteChange(text);
      setRecordingState("done");
    } catch (error) {
      console.error("Transcription failed", error);
      onCoachNoteChange("Could not transcribe. Try again.");
      setRecordingState("done");
    } finally {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    }
  }, [onCoachNoteChange, recordingState, transcribeAudio]);

  const controlsDisabled = recordingState === "processing";
  const showRecordingOverlay = recordingState === "recording";

  return (
    <View
      style={{
        padding: 10,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: UI.border,
        backgroundColor: UI.bgCard,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "800", color: UI.textSecondary }}>Match {index + 1}</Text>

      <View style={{ position: "relative" }}>
        <View pointerEvents={controlsDisabled ? "none" : "auto"} style={controlsDisabled ? { opacity: 0.6 } : undefined}>
          <MatchMediaAttachments
            imageUri={match.imageUri}
            videoUri={match.videoUri}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onReplay={() => setIsPlaying(true)}
            onImageChange={onImageChange}
            onVideoChange={onVideoChange}
            shouldPausePlayback={recordingState === "recording"}
          />
        </View>
        {showRecordingOverlay ? (
          <View
            pointerEvents="box-none"
            style={{
              ...StyleSheet.absoluteFillObject,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(17, 24, 39, 0.5)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <View
              style={{
                alignItems: "center",
                gap: 10,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: "rgba(17, 24, 39, 0.7)",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#ffffff" }}>Recording...</Text>
              <Pressable
                onPress={stopRecording}
                style={({ pressed }) => ({
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#dc2626",
                  backgroundColor: pressed ? "#b91c1c" : "#dc2626",
                })}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#ffffff" }}>Stop</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View
        onLayout={(event) => onCoachNoteLayout?.(event.nativeEvent.layout.y)}
        style={{ marginTop: 10 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 0.6,
              fontWeight: "700",
              color: UI.textSecondary,
            }}
          >
            Coach note (optional)
          </Text>
          <Pressable
            onPress={startRecording}
            disabled={controlsDisabled || recordingState === "recording"}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.accent,
              backgroundColor: pressed ? "#1e40af" : UI.accent,
              opacity: controlsDisabled || recordingState === "recording" ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#ffffff" }}>
              {recordingState === "done" ? "Re-record" : "Record"}
            </Text>
          </Pressable>
        </View>
        {recordingState === "processing" ? (
          <Text style={{ marginTop: 6, fontSize: 11, fontWeight: "700", color: UI.textSecondary }}>
            Transcribing...
          </Text>
        ) : null}
        <TextInput
          value={match.coachNote ?? ""}
          onChangeText={onCoachNoteChange}
          onFocus={onCoachNoteFocus}
          placeholder="What went well, what to improve..."
          placeholderTextColor={UI.textSecondary}
          editable={recordingState === "idle" || recordingState === "done"}
          autoFocus={false}
          multiline={true}
          scrollEnabled={true}
          style={{
            marginTop: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            padding: 12,
            minHeight: 120,
            maxHeight: 120,
            color: UI.textPrimary,
            textAlignVertical: "top",
          }}
        />
        <Text
          style={{
            marginTop: 6,
            fontSize: 11,
            color: UI.textSecondary,
            opacity: 0.9,
          }}
        >
          {recordingState === "processing"
            ? "Transcription in progress"
            : recordingState === "recording"
              ? "Recording in progress"
              : isPlaying
                ? "Video playing"
                : "Video paused"}
        </Text>
      </View>

      <View
        pointerEvents={controlsDisabled ? "none" : "auto"}
        style={[
          { marginTop: 4, gap: 6 },
          controlsDisabled ? { opacity: 0.55 } : null,
        ]}
      >
        <Text
          style={{
            fontSize: 12,
            letterSpacing: 0.6,
            fontWeight: "700",
            color: UI.textSecondary,
          }}
        >
          Match Result
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {MATCH_RESULT_OPTIONS.map(({ value, label }) => {
            const active = match.matchResult === value;
            return (
              <Pressable key={value} onPress={() => onToggleMatchResult(value)} style={chipPressable(active)}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: active ? "800" : "600",
                    color: UI.textPrimary,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        pointerEvents={controlsDisabled ? "none" : "auto"}
        style={[
          { marginTop: 6, gap: 4 },
          controlsDisabled ? { opacity: 0.55 } : null,
        ]}
      >
        <Text
          style={{
            fontSize: 12,
            letterSpacing: 0.6,
            fontWeight: "700",
            color: UI.textSecondary,
          }}
        >
          How did it end?
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-start", marginTop: 2 }}>
          {HOW_ENDED_OPTIONS.map((label) => {
            const active = match.outcome === label;
            if (label === "Submission") {
              const showSubmissionTime = active;
              return (
                <View
                  key={label}
                  style={{
                    alignItems: "flex-start",
                    gap: showSubmissionTime ? 2 : 8,
                    flexBasis: showSubmissionTime ? "100%" : undefined,
                    width: showSubmissionTime ? "100%" : undefined,
                    maxWidth: showSubmissionTime ? "100%" : undefined,
                  }}
                >
                  <Pressable
                    onPress={() => onToggleOutcome(label)}
                    style={({ pressed }) => {
                      const base = chipPressable(active)({ pressed });
                      const sizing = { flexShrink: 0 };
                      if (active) {
                        return {
                          ...base,
                          borderWidth: 2,
                          ...sizing,
                        };
                      }
                      return { ...base, ...sizing };
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12,
                        fontWeight: active ? "800" : "600",
                        color: UI.textPrimary,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                  {showSubmissionTime ? (
                    <View style={{ width: "100%" }}>
                      <Text
                        style={{
                          fontSize: 12,
                          letterSpacing: 0.6,
                          fontWeight: "600",
                          color: UI.textSecondary,
                        }}
                      >
                        Submission Time
                      </Text>
                      <TextInput
                        value={match.submissionTime ?? ""}
                        onChangeText={onSubmissionTimeChange}
                        placeholder="e.g. 0:30"
                        placeholderTextColor={UI.textSecondary}
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel="Submission Time"
                        accessibilityHint="Enter digits only; time formats as minutes and seconds."
                        style={{
                          marginTop: 4,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: "#eceef2",
                          backgroundColor: UI.bgCard,
                          alignSelf: "stretch",
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          color: UI.textPrimary,
                          fontSize: 13,
                          fontVariant: ["tabular-nums"],
                        }}
                      />
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 10,
                          color: UI.textSecondary,
                          opacity: 0.42,
                        }}
                      >
                        Time of finish
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            }
            return (
              <Pressable
                key={label}
                onPress={() => onToggleOutcome(label)}
                style={({ pressed }) => ({
                  ...chipPressable(active)({ pressed }),
                  flexShrink: 0,
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: active ? "800" : "600",
                    color: UI.textPrimary,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

    </View>
  );
}

export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idText = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const reactId = useId();

  const [loadReady, setLoadReady] = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [promoter, setPromoter] = useState("");
  const [dateDraft, setDateDraft] = useState("2026-01-15");
  const [format, setFormat] = useState<(typeof FORMAT_OPTIONS)[number]["value"] | undefined>(undefined);
  const [eventStatus, setEventStatus] = useState<
    (typeof EVENT_STATUS_OPTIONS)[number]["value"] | undefined
  >(undefined);
  const [result, setResult] = useState<(typeof RESULT_OPTIONS)[number]["value"]>("participated");

  const [matches, setMatches] = useState<LocalMatch[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);
  const positionsRef = useRef<Record<number, number>>({});
  const matchTopRef = useRef<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!idText?.trim()) {
        setLoadReady(true);
        return;
      }
      setLoadReady(false);
      const found = await getKidCompetitionEntryById(idText);
      if (cancelled) return;
      if (!found) {
        Alert.alert("Not found", "This competition could not be found.");
        router.back();
        return;
      }
      setTournamentName(found.tournamentName);
      setPromoter(found.organizationOrPromoter ?? "");
      setDateDraft(found.eventDate);
      setFormat(found.format);
      setEventStatus(found.status ?? found.eventStatus);
      setResult(found.result ?? "participated");
      const detail = await getCompetitionDetailByEntryId(idText);
      if (cancelled) return;
      setMatches(deriveInitialMatches(found, detail, reactId));
      setLoadReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [idText, reactId]);

  const toggleFormat = useCallback((v: (typeof FORMAT_OPTIONS)[number]["value"]) => {
    setFormat((prev) => (prev === v ? undefined : v));
  }, []);

  const toggleEventStatus = useCallback((v: (typeof EVENT_STATUS_OPTIONS)[number]["value"]) => {
    setEventStatus((prev) => (prev === v ? undefined : v));
  }, []);

  const setMatchOutcome = useCallback((matchIndex: number, label: (typeof HOW_ENDED_OPTIONS)[number]) => {
    setMatches((prev) => {
      const next = prev.map((m, i) => {
        if (i !== matchIndex) return m;
        return {
          ...m,
          outcome: m.outcome === label ? null : label,
        };
      });
      return next;
    });
  }, []);

  const setMatchResult = useCallback(
    (matchIndex: number, v: (typeof MATCH_RESULT_OPTIONS)[number]["value"]) => {
      setMatches((prev) => {
        const next = prev.map((m, i) => {
          if (i !== matchIndex) return m;
          return {
            ...m,
            matchResult: m.matchResult === v ? null : v,
          };
        });
        return next;
      });
    },
    [],
  );

  const setMatchSubmissionTime = useCallback((matchIndex: number, text: string) => {
    setMatches((prev) =>
      prev.map((m, i) => {
        if (i !== matchIndex) return m;
        const next = normalizeSubmissionTimeInput(text);
        return { ...m, submissionTime: next };
      }),
    );
  }, []);

  const setMatchCoachNote = useCallback((matchIndex: number, text: string) => {
    setMatches((prev) =>
      prev.map((m, i) => {
        if (i !== matchIndex) return m;
        return { ...m, coachNote: text };
      }),
    );
  }, []);

  const updateMatchMedia = useCallback(
    (
      matchIndex: number,
      patch: Partial<Pick<LocalMatch, "imageUri" | "videoUri" | "imageAssetId" | "videoAssetId">>,
    ) => {
      setMatches((prev) => prev.map((m, i) => (i === matchIndex ? { ...m, ...patch } : m)));
    },
    [],
  );

  const addMatch = useCallback(() => {
    setMatches((prev) => [...prev, createEmptyMatch(`${Date.now()}`)]);
  }, []);

  const registerCoachNotePosition = useCallback((index: number, y: number) => {
    positionsRef.current[index] = y;
  }, []);

  const registerMatchTopPosition = useCallback((index: number, y: number) => {
    matchTopRef.current[index] = y;
  }, []);

  useEffect(() => {
    const maxIndex = matches.length - 1;
    Object.keys(positionsRef.current).forEach((key) => {
      const index = Number(key);
      if (index > maxIndex) delete positionsRef.current[index];
    });
    Object.keys(matchTopRef.current).forEach((key) => {
      const index = Number(key);
      if (index > maxIndex) delete matchTopRef.current[index];
    });
  }, [matches.length]);

  const scrollToCoachNote = useCallback((matchIndex: number) => {
    const tryScroll = (hasRetried: boolean) => {
      const measuredY = positionsRef.current[matchIndex];
      if (typeof measuredY !== "number") {
        if (!hasRetried) {
          setTimeout(() => {
            tryScroll(true);
          }, 50);
        }
        return;
      }
      scrollRef.current?.scrollTo({ y: Math.max(0, measuredY - 20), animated: true });
    };
    tryScroll(false);
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
          onPress: () =>
            setMatches((prev) => {
              if (prev.length <= 1) return prev;
              return prev.filter((m) => m.id !== matchId);
            }),
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

  const onSaveCompetition = useCallback(() => {
    if (!idText?.trim()) {
      Alert.alert("Cannot save", "Missing competition id.");
      return;
    }
    (async () => {
      const existing = await getKidCompetitionEntryById(idText);
      if (!existing) {
        Alert.alert("Not found", "This competition could not be found.");
        return;
      }
      try {
        const snapshots = matches.map((m) => snapshotFromLocal(m));
        const videoRefs = competitionVideoRefsFromMatches(snapshots);
        await updateKidCompetitionEntry(idText, {
          tournamentName: tournamentName.trim() ? tournamentName.trim() : existing.tournamentName,
          organizationOrPromoter: promoter.trim() ? promoter.trim() : undefined,
          eventDate: dateDraft.trim() || existing.eventDate,
          format,
          status: eventStatus,
          eventStatus,
          result,
          competitionVideos: videoRefs,
        });
        await setCompetitionDetailForEntryId(idText, { matches: snapshots });
        Alert.alert("Competition saved", undefined, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } catch {
        Alert.alert("Save failed", "Could not save. Try again.");
      }
    })();
  }, [idText, tournamentName, promoter, dateDraft, format, eventStatus, result, matches]);

  if (!loadReady) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Competition",
            headerBackTitle: "Back",
          }}
        />
        <View
          style={{
            flex: 1,
            backgroundColor: UI.screenBg,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <ActivityIndicator size="large" color={UI.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Competition",
          headerBackTitle: "Back",
        }}
      />
      <View style={{ flex: 1, backgroundColor: UI.screenBg }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: UI.screenBg }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 24,
          }}
        >
          <SectionLabel>TOURNAMENT NAME</SectionLabel>
          <TextInput
            value={tournamentName}
            onChangeText={setTournamentName}
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
            value={promoter}
            onChangeText={setPromoter}
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
            {FORMAT_OPTIONS.map(({ value, label }) => {
              const active = format === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => toggleFormat(value)}
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
                    {label}
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
            placeholder="2026-01-15"
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
            Tap again to clear.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {EVENT_STATUS_OPTIONS.map(({ value, label }) => {
              const active = eventStatus === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => toggleEventStatus(value)}
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
                    {label}
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
            {RESULT_OPTIONS.map(({ value, label }) => {
              const active = result === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setResult(value)}
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
                    {label}
                  </Text>
                </Pressable>
              );
            })}
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
          {matches.map((m, i) => (
            <View
              key={m.id}
              onLayout={(event: LayoutChangeEvent) =>
                registerMatchTopPosition(i, event.nativeEvent.layout.y)
              }
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
                  onCoachNoteChange={(text) => setMatchCoachNote(i, text)}
                  onCoachNoteFocus={() => scrollToCoachNote(i)}
                  onCoachNoteLayout={(relativeY) =>
                    registerCoachNotePosition(i, (matchTopRef.current[i] ?? 0) + relativeY)
                  }
                  onImageChange={(uri, assetId) =>
                    updateMatchMedia(i, { imageUri: uri, imageAssetId: assetId })
                  }
                  onVideoChange={(uri, assetId) =>
                    updateMatchMedia(i, { videoUri: uri, videoAssetId: assetId })
                  }
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
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: UI.border,
            backgroundColor: UI.screenBg,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(12, insets.bottom + 8),
          }}
        >
          <Pressable
            onPress={onSaveCompetition}
            style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.92 : 1 }]}
          >
            <Text style={styles.primaryBtnText}>Save Competition</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: UI.accent,
    borderWidth: 1,
    borderColor: UI.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
});
