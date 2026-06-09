import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { MatchMediaAttachments } from "../../components/MatchMediaAttachments";
import {
  type CompetitionDetailMatchSnapshot,
  getCompetitionDetailByEntryId,
} from "../../storage/competitionStore";
import type { KidCompetitionEntry } from "../../types/coachKid";
import { normalizeStoredSubmissionType, SUBMISSION_TYPE_CHIPS } from "./submissionTypes";

/** UI tokens mirror the coach competition editor. */
const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
} as const;

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
  /** Canonical key from `SUBMISSION_TYPE_CHIPS` when outcome is Submission */
  submissionType: string | null;
  coachNote?: string;
  imageUri: string | null;
  videoUri: string | null;
  imageAssetId: string | null;
  videoAssetId: string | null;
};

export function createEmptyMatch(idSuffix: string): LocalMatch {
  const id = `match-${idSuffix}`;
  if (__DEV__) {
    console.log("[LINEAGE_TRACE] create_empty_match", {
      id,
      idSuffix,
    });
  }
  return {
    id,
    matchResult: null,
    outcome: null,
    submissionTime: null,
    submissionType: null,
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
  const st = normalizeStoredSubmissionType(m.submissionType);
  const coachNote =
    typeof m.coachNote === "string" && m.coachNote.trim().length > 0 ? m.coachNote.trim() : undefined;
  return {
    id: m.id,
    matchResult: m.matchResult,
    outcome: m.outcome,
    submissionTime,
    ...(st ? { submissionType: st } : {}),
    coachNote,
    imageUri: m.imageUri,
    videoUri: m.videoUri,
    imageAssetId: m.imageAssetId,
    videoAssetId: m.videoAssetId,
  };
}

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
  const submissionType = normalizeStoredSubmissionType((m as { submissionType?: unknown }).submissionType);
  return {
    id: m.id,
    matchResult: m.matchResult,
    outcome: m.outcome,
    submissionTime,
    submissionType,
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
    if (__DEV__) {
      console.log("[LINEAGE_TRACE] derive_initial_matches_detail", {
        entryId: entry.id,
        sharedAthleteId: entry.sharedAthleteId ?? null,
        sharedCompetitionId: entry.sharedCompetitionId ?? null,
        detailMatchIds: detail.matches.map((m) => m.id),
      });
    }
    return detail.matches.map((m) => localMatchFromSnapshot(m));
  }
  const u = typeof entry.videoUri === "string" ? entry.videoUri.trim() : "";
  const aid =
    typeof entry.videoAssetId === "string" && entry.videoAssetId.trim()
      ? entry.videoAssetId.trim()
      : null;
  if (u) {
    const id = `match-legacy-${idSuffix}`;
    if (__DEV__) {
      console.log("[LINEAGE_TRACE] derive_initial_matches_legacy_fallback", {
        entryId: entry.id,
        sharedAthleteId: entry.sharedAthleteId ?? null,
        sharedCompetitionId: entry.sharedCompetitionId ?? null,
        generatedMatchIds: [id],
      });
    }
    return [
      {
        id,
        matchResult: null,
        outcome: null,
        submissionTime: null,
        submissionType: null,
        coachNote: "",
        imageUri: null,
        videoUri: u,
        videoAssetId: aid,
        imageAssetId: null,
      },
    ];
  }
  if (__DEV__) {
    console.log("[LINEAGE_TRACE] derive_initial_matches_empty_fallback", {
      entryId: entry.id,
      sharedAthleteId: entry.sharedAthleteId ?? null,
      sharedCompetitionId: entry.sharedCompetitionId ?? null,
      generatedIdSuffix: `init-${idSuffix}`,
    });
  }
  return [createEmptyMatch(`init-${idSuffix}`)];
}

const TRANSCRIBE_RUNTIME_LOG_TAG = "[TRANSCRIBE_RUNTIME_TRACE]";
const TRANSCRIBE_UPLOAD_FILENAME = "recording.m4a";
const TRANSCRIBE_UPLOAD_MIME_TYPE = "audio/mp4";

function uriScheme(uri: string): string {
  const idx = uri.indexOf("://");
  return idx >= 0 ? uri.slice(0, idx + 3) : "no-scheme";
}

function transcribeRuntimeErrorFields(error: unknown): {
  errorMessage: string;
  errorName: string;
  errorCode?: unknown;
  errorStack?: string;
} {
  if (error instanceof Error) {
    const codedError = error as Error & { code?: unknown };
    return {
      errorMessage: error.message,
      errorName: error.name,
      ...(typeof codedError.code !== "undefined" ? { errorCode: codedError.code } : {}),
      ...(typeof error.stack === "string" ? { errorStack: error.stack } : {}),
    };
  }
  return { errorMessage: String(error), errorName: "unknown" };
}

function logTranscribeRuntime(stage: string, payload: Record<string, unknown> = {}): void {
  console.log(TRANSCRIBE_RUNTIME_LOG_TAG, { stage, ...payload });
}

async function describeAudioFileForUpload(uri: string): Promise<Record<string, unknown>> {
  const base = {
    uri,
    filename: TRANSCRIBE_UPLOAD_FILENAME,
    mimeType: TRANSCRIBE_UPLOAD_MIME_TYPE,
    uriScheme: uriScheme(uri),
  };
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return {
      ...base,
      fileExists: info.exists,
      fileSize: info.exists ? info.size : null,
    };
  } catch (error) {
    return {
      ...base,
      fileExists: null,
      fileSize: null,
      fileInfoError: transcribeRuntimeErrorFields(error).errorMessage,
    };
  }
}

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
  onSubmissionTypeChange,
  onCoachNoteChange,
  onCoachNoteFocus,
  onCoachNoteLayout,
  onImageChange,
  onVideoChange,
  canonicalReadOnly = false,
}: {
  index: number;
  match: LocalMatch;
  onToggleMatchResult: (v: (typeof MATCH_RESULT_OPTIONS)[number]["value"]) => void;
  onToggleOutcome: (label: (typeof HOW_ENDED_OPTIONS)[number]) => void;
  onSubmissionTimeChange: (text: string) => void;
  onSubmissionTypeChange: (key: string | null) => void;
  onCoachNoteChange: (text: string) => void;
  onCoachNoteFocus?: () => void;
  onCoachNoteLayout?: (y: number) => void;
  onImageChange: (uri: string | null, assetId: string | null) => void;
  onVideoChange: (uri: string | null, assetId: string | null) => void;
  canonicalReadOnly?: boolean;
}) {
  type RecordingState = "idle" | "recording" | "processing" | "done";
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  /** Compact multi-column chip grid (long labels wrap); avoids a single tall column of pills. */
  const submissionChipLayout = useMemo(() => {
    const outerPad = 48;
    const gap = 6;
    const minChip = 84;
    const usable = Math.max(260, windowWidth - outerPad);
    let cols = Math.floor((usable + gap) / (minChip + gap));
    cols = Math.max(2, Math.min(4, cols));
    const chipWidth = (usable - gap * (cols - 1)) / cols;
    return { chipWidth, gap };
  }, [windowWidth]);

  useEffect(() => {
    if (match.videoUri) return;
    setIsPlaying(false);
  }, [match.videoUri]);

  useEffect(() => {
    return () => {
      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      if (!activeRecording) return;
      void activeRecording.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const transcribeAudio = useCallback(async (uri: string): Promise<string> => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    logTranscribeRuntime("api_key_check", { hasApiKey: Boolean(apiKey) });
    if (!apiKey) {
      logTranscribeRuntime("missing_api_key", { stage: "transcribeAudio" });
      throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
    }

    const filename = TRANSCRIBE_UPLOAD_FILENAME;
    const mimeType = TRANSCRIBE_UPLOAD_MIME_TYPE;
    const fileMeta = await describeAudioFileForUpload(uri);
    logTranscribeRuntime("uri_metadata", { stage: "pre_upload", ...fileMeta });
    const normalizedUri = uri.startsWith("file://") ? uri : `file://${uri}`;
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const fileSize = fileInfo.exists ? fileInfo.size : null;
    console.log(
      "[TRANSCRIBE_RUNTIME_TRACE]",
      JSON.stringify({
        stage: "upload_payload",
        uri,
        normalizedUri,
        exists: fileInfo.exists,
        size: fileSize,
        modificationTime: fileInfo.exists ? fileInfo.modificationTime : null,
      }),
    );
    if (!fileInfo.exists || typeof fileSize !== "number" || fileSize <= 0) {
      console.log(
        "[TRANSCRIBE_RUNTIME_TRACE]",
        JSON.stringify({
          stage: "invalid_audio_file",
          uri,
          normalizedUri,
          exists: fileInfo.exists,
          size: fileSize,
        }),
      );
      throw new Error("Invalid audio file for transcription");
    }

    const formData = new FormData();
    formData.append("file", {
      uri: normalizedUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
    console.log(
      "[TRANSCRIBE_RUNTIME_TRACE]",
      JSON.stringify({
        stage: "formdata_append_complete",
        mimeType,
        filename,
      }),
    );
    formData.append("model", "whisper-1");

    logTranscribeRuntime("fetch_start", {
      stage: "openai_request",
      url: "https://api.openai.com/v1/audio/transcriptions",
      model: "whisper-1",
    });

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });
    } catch (error) {
      const fetchError = error as { name?: unknown; message?: unknown; code?: unknown; stack?: unknown };
      console.log(
        "[TRANSCRIBE_RUNTIME_TRACE]",
        JSON.stringify({
          stage: "upload_fetch_failure",
          name: fetchError?.name,
          message: fetchError?.message,
          code: fetchError?.code,
          stack:
            typeof fetchError?.stack === "string"
              ? fetchError.stack.slice(0, 1200)
              : null,
        }),
      );
      logTranscribeRuntime("fetch_threw", {
        stage: "openai_request",
        ...transcribeRuntimeErrorFields(error),
      });
      throw error;
    }

    logTranscribeRuntime("fetch_response", {
      stage: "openai_request",
      status: res.status,
      ok: res.ok,
      statusText: res.statusText,
    });

    let rawBody = "";
    try {
      rawBody = await res.text();
    } catch (error) {
      logTranscribeRuntime("response_body_read_failed", {
        stage: "parse_response",
        status: res.status,
        ...transcribeRuntimeErrorFields(error),
      });
      throw error;
    }

    let json: { text?: string; error?: { message?: string; type?: string; code?: string } };
    try {
      json = JSON.parse(rawBody) as {
        text?: string;
        error?: { message?: string; type?: string; code?: string };
      };
    } catch (error) {
      logTranscribeRuntime("response_json_parse_failed", {
        stage: "parse_response",
        status: res.status,
        rawBodyPreview: rawBody.slice(0, 500),
        ...transcribeRuntimeErrorFields(error),
      });
      throw error;
    }

    logTranscribeRuntime("response_body", {
      stage: "parse_response",
      status: res.status,
      body: json,
    });

    if (!res.ok) {
      const message = json?.error?.message ?? "Transcription request failed";
      logTranscribeRuntime("openai_error", {
        stage: "openai_request",
        status: res.status,
        error: json?.error ?? null,
        errorMessage: message,
      });
      throw new Error(message);
    }

    const text = typeof json.text === "string" ? json.text.trim() : "";
    if (!text) {
      logTranscribeRuntime("empty_transcription_text", {
        stage: "parse_response",
        status: res.status,
        body: json,
      });
      throw new Error("No transcription text returned");
    }

    logTranscribeRuntime("transcription_success", {
      stage: "transcribeAudio",
      textLength: text.length,
    });
    return text;
  }, []);

  const startRecording = useCallback(async () => {
    if (recordingState === "recording" || recordingState === "processing") return;
    try {
      logTranscribeRuntime("permission_request", { stage: "startRecording" });
      const { status } = await Audio.requestPermissionsAsync();
      logTranscribeRuntime("permission_result", {
        stage: "startRecording",
        status,
        granted: status === "granted",
      });
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

      logTranscribeRuntime("recording_started", { stage: "startRecording" });
      setIsPlaying(false);
      setRecordingState("recording");
    } catch (error) {
      logTranscribeRuntime("recording_start_failed", {
        stage: "startRecording",
        ...transcribeRuntimeErrorFields(error),
      });
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
    logTranscribeRuntime("recording_stop_requested", { stage: "stopRecording" });

    const recording = recordingRef.current;
    recordingRef.current = null;

    try {
      if (!recording) {
        logTranscribeRuntime("no_active_recording", { stage: "stopRecording" });
        throw new Error("No active recording");
      }

      await recording.stopAndUnloadAsync();
      logTranscribeRuntime("recording_stopped", { stage: "stopRecording" });

      await new Promise((resolve) => setTimeout(resolve, 500));
      logTranscribeRuntime("recording_file_finalization_delay_complete", {
        stage: "stopRecording",
        delayMs: 500,
      });

      const uri = recording.getURI();
      logTranscribeRuntime("uri_capture", {
        stage: "stopRecording",
        hasUri: Boolean(uri),
        uri: uri ?? null,
        uriScheme: uri ? uriScheme(uri) : null,
      });
      if (!uri) {
        logTranscribeRuntime("missing_recording_uri", { stage: "stopRecording" });
        throw new Error("Missing recording URI");
      }

      const text = await transcribeAudio(uri);
      onCoachNoteChange(text);
      setRecordingState("done");
    } catch (error) {
      logTranscribeRuntime("pipeline_failed", {
        stage: "stopRecording",
        ...transcribeRuntimeErrorFields(error),
      });
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
        <View
          pointerEvents={controlsDisabled || canonicalReadOnly ? "none" : "auto"}
          style={controlsDisabled || canonicalReadOnly ? { opacity: 0.6 } : undefined}
        >
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
        onLayout={(event: LayoutChangeEvent) => onCoachNoteLayout?.(event.nativeEvent.layout.y)}
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
            Coach Match Breakdown
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
        pointerEvents={controlsDisabled || canonicalReadOnly ? "none" : "auto"}
        style={[{ marginTop: 4, gap: 6 }, controlsDisabled || canonicalReadOnly ? { opacity: 0.55 } : null]}
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
        pointerEvents={controlsDisabled || canonicalReadOnly ? "none" : "auto"}
        style={[{ marginTop: 6, gap: 4 }, controlsDisabled || canonicalReadOnly ? { opacity: 0.55 } : null]}
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
                        editable={!canonicalReadOnly}
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
                      <Text
                        style={{
                          marginTop: 12,
                          fontSize: 12,
                          letterSpacing: 0.6,
                          fontWeight: "600",
                          color: UI.textSecondary,
                        }}
                      >
                        Submission type
                      </Text>
                      <View
                        style={{
                          marginTop: 6,
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: submissionChipLayout.gap,
                        }}
                      >
                        {SUBMISSION_TYPE_CHIPS.map(({ key, label }) => {
                          const active = match.submissionType === key;
                          return (
                            <Pressable
                              key={key}
                              onPress={() => onSubmissionTypeChange(active ? null : key)}
                              style={({ pressed }) => ({
                                ...chipPressable(active)({ pressed }),
                                width: submissionChipLayout.chipWidth,
                                minHeight: 40,
                                paddingVertical: 8,
                                paddingHorizontal: 8,
                                alignItems: "center",
                                justifyContent: "center",
                              })}
                            >
                              <Text
                                numberOfLines={2}
                                style={{
                                  fontSize: 11,
                                  fontWeight: active ? "800" : "600",
                                  color: UI.textPrimary,
                                  textAlign: "center",
                                  width: "100%",
                                }}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
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
