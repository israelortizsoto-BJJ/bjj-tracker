import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Alert, Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import {
  logTranscribeRuntime,
  transcribeCoachAudio,
  transcribeRuntimeErrorFields,
  uriScheme,
} from "./coachVoiceTranscription";

const UI = {
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
} as const;

export type CoachVoiceRecordingState = "idle" | "recording" | "processing" | "done";

export type CoachVoiceRecordingControls = {
  recordingState: CoachVoiceRecordingState;
  startRecording: () => void;
  stopRecording: () => void;
};

type CoachVoiceNoteFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  disabled?: boolean;
  disabledHint?: string;
  onFocus?: TextInputProps["onFocus"];
  onContentSizeChange?: TextInputProps["onContentSizeChange"];
  scrollEnabled?: boolean;
  minHeight?: number;
  /** When omitted, the field grows without a max height cap. */
  maxHeight?: number;
  /** Extra status line when idle/done (e.g. video playing). */
  idleStatusHint?: string;
  /**
   * When true, Record is disabled while recording and Stop is expected from an
   * external chrome (e.g. match media overlay). Field still shows recording status.
   */
  externalStopControl?: boolean;
  recordingControlsRef?: MutableRefObject<CoachVoiceRecordingControls | null>;
  onRecordingStateChange?: (state: CoachVoiceRecordingState) => void;
};

/**
 * Certified coach voice note field: Record → Whisper transcript → editable text.
 * Reuses the single transcription corridor in coachVoiceTranscription.ts.
 */
export function CoachVoiceNoteField({
  label,
  value,
  onChangeText,
  placeholder,
  disabled = false,
  disabledHint,
  onFocus,
  onContentSizeChange,
  scrollEnabled = true,
  minHeight = 120,
  maxHeight,
  idleStatusHint,
  externalStopControl = false,
  recordingControlsRef,
  onRecordingStateChange,
}: CoachVoiceNoteFieldProps) {
  const [recordingState, setRecordingState] = useState<CoachVoiceRecordingState>("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);

  const updateRecordingState = useCallback(
    (next: CoachVoiceRecordingState) => {
      setRecordingState(next);
      onRecordingStateChange?.(next);
    },
    [onRecordingStateChange],
  );

  useEffect(() => {
    return () => {
      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      if (!activeRecording) return;
      void activeRecording.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled) return;
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
      updateRecordingState("recording");
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
  }, [disabled, recordingState, updateRecordingState]);

  const stopRecording = useCallback(async () => {
    if (recordingState !== "recording") return;
    updateRecordingState("processing");
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

      const text = await transcribeCoachAudio(uri);
      onChangeText(text);
      updateRecordingState("done");
    } catch (error) {
      logTranscribeRuntime("pipeline_failed", {
        stage: "stopRecording",
        ...transcribeRuntimeErrorFields(error),
      });
      console.error("Transcription failed", error);
      const errorMessage = transcribeRuntimeErrorFields(error).errorMessage.trim();
      onChangeText(
        `Could not transcribe.\n${errorMessage.length > 0 ? errorMessage : "Unknown transcription error"}`,
      );
      updateRecordingState("done");
    } finally {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    }
  }, [onChangeText, recordingState, updateRecordingState]);

  useEffect(() => {
    if (!recordingControlsRef) return;
    recordingControlsRef.current = {
      recordingState,
      startRecording: () => {
        void startRecording();
      },
      stopRecording: () => {
        void stopRecording();
      },
    };
    return () => {
      recordingControlsRef.current = null;
    };
  }, [recordingControlsRef, recordingState, startRecording, stopRecording]);

  const controlsDisabled = disabled || recordingState === "processing";
  const showInlineStop = recordingState === "recording" && !externalStopControl;
  const recordDisabled =
    controlsDisabled || (externalStopControl && recordingState === "recording");

  const statusText =
    recordingState === "processing"
      ? "Transcription in progress"
      : recordingState === "recording"
        ? "Recording in progress"
        : idleStatusHint;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            letterSpacing: 0.6,
            fontWeight: "700",
            color: UI.textSecondary,
          }}
        >
          {label}
        </Text>
        {showInlineStop ? (
          <Pressable
            onPress={() => void stopRecording()}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#dc2626",
              backgroundColor: pressed ? "#b91c1c" : "#dc2626",
            })}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#ffffff" }}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void startRecording()}
            disabled={recordDisabled}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.accent,
              backgroundColor: pressed ? "#1e40af" : UI.accent,
              opacity: recordDisabled ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#ffffff" }}>
              {recordingState === "done" ? "Re-record" : "Record"}
            </Text>
          </Pressable>
        )}
      </View>
      {disabled && disabledHint ? (
        <Text style={{ marginTop: 6, fontSize: 11, fontWeight: "700", color: UI.textSecondary }}>
          {disabledHint}
        </Text>
      ) : null}
      {recordingState === "processing" ? (
        <Text style={{ marginTop: 6, fontSize: 11, fontWeight: "700", color: UI.textSecondary }}>
          Transcribing...
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onContentSizeChange={onContentSizeChange}
        placeholder={placeholder}
        placeholderTextColor={UI.textSecondary}
        editable={!disabled && (recordingState === "idle" || recordingState === "done")}
        autoFocus={false}
        multiline
        scrollEnabled={scrollEnabled}
        style={{
          marginTop: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: UI.border,
          backgroundColor: UI.bgCard,
          padding: 12,
          minHeight,
          ...(typeof maxHeight === "number" ? { maxHeight } : null),
          color: UI.textPrimary,
          textAlignVertical: "top",
        }}
      />
      {statusText ? (
        <Text
          style={{
            marginTop: 6,
            fontSize: 11,
            color: UI.textSecondary,
            opacity: 0.9,
          }}
        >
          {statusText}
        </Text>
      ) : null}
    </View>
  );
}
