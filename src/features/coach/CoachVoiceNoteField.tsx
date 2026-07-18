import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Alert, Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { persistCoachVoiceAudio } from "../../media/persistCoachVoiceAudio";
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
  /**
   * Durable local audio URI for coach-device replay (Phase 1 companion artifact).
   * When present, shows a simple Play / Pause control. Missing audio never blocks transcript.
   */
  playbackUri?: string | null;
  /**
   * Fired after a recording is copied into durable local storage (before or with transcript).
   * Match Breakdown attaches this as voiceNoteRefs; other surfaces may omit.
   */
  onAudioPersisted?: (localUri: string) => void;
};

/**
 * Certified coach voice note field: Record → Whisper transcript → editable text.
 * Reuses the single transcription corridor in coachVoiceTranscription.ts.
 * Phase 1: also preserves companion audio locally for coach-device replay.
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
  playbackUri = null,
  onAudioPersisted,
}: CoachVoiceNoteFieldProps) {
  const [recordingState, setRecordingState] = useState<CoachVoiceRecordingState>("idle");
  const [playbackState, setPlaybackState] = useState<"idle" | "playing" | "paused">("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const updateRecordingState = useCallback(
    (next: CoachVoiceRecordingState) => {
      setRecordingState(next);
      onRecordingStateChange?.(next);
    },
    [onRecordingStateChange],
  );

  const unloadPlayback = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlaybackState("idle");
    if (!sound) return;
    try {
      await sound.stopAsync();
    } catch {
      // ignore
    }
    try {
      await sound.unloadAsync();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      if (activeRecording) {
        void activeRecording.stopAndUnloadAsync().catch(() => {});
      }
      void unloadPlayback();
    };
  }, [unloadPlayback]);

  useEffect(() => {
    void unloadPlayback();
  }, [playbackUri, unloadPlayback]);

  const startRecording = useCallback(async () => {
    if (disabled) return;
    if (recordingState === "recording" || recordingState === "processing") return;
    try {
      await unloadPlayback();
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
  }, [disabled, recordingState, unloadPlayback, updateRecordingState]);

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

      let durableUri = uri;
      try {
        durableUri = await persistCoachVoiceAudio(uri);
        logTranscribeRuntime("audio_persisted_locally", {
          stage: "stopRecording",
          sourceUriScheme: uriScheme(uri),
          durableUriScheme: uriScheme(durableUri),
          durableUri,
        });
        onAudioPersisted?.(durableUri);
      } catch (persistError) {
        logTranscribeRuntime("audio_persist_failed", {
          stage: "stopRecording",
          ...transcribeRuntimeErrorFields(persistError),
        });
        // Transcript remains canonical; missing audio must never block transcription.
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
  }, [onAudioPersisted, onChangeText, recordingState, updateRecordingState]);

  const togglePlayback = useCallback(async () => {
    const uri = playbackUri?.trim();
    if (!uri || disabled || recordingState === "recording" || recordingState === "processing") {
      return;
    }

    try {
      if (playbackState === "playing" && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaybackState("paused");
        return;
      }

      if (playbackState === "paused" && soundRef.current) {
        await soundRef.current.playAsync();
        setPlaybackState("playing");
        return;
      }

      await unloadPlayback();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setPlaybackState("idle");
            void sound.unloadAsync().catch(() => {});
            if (soundRef.current === sound) soundRef.current = null;
          }
        },
      );
      soundRef.current = sound;
      setPlaybackState("playing");
    } catch (error) {
      console.error("Coach commentary playback failed", error);
      setPlaybackState("idle");
      Alert.alert("Playback failed", "Could not play the saved commentary audio.");
    }
  }, [disabled, playbackState, playbackUri, recordingState, unloadPlayback]);

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
  const showPlayback = Boolean(playbackUri?.trim()) && recordingState !== "recording";
  const playbackDisabled =
    disabled || recordingState === "processing" || recordingState === "recording";

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {showPlayback ? (
            <Pressable
              onPress={() => void togglePlayback()}
              disabled={playbackDisabled}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? "#f3f4f6" : UI.bgCard,
                opacity: playbackDisabled ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 11, fontWeight: "800", color: UI.textPrimary }}>
                {playbackState === "playing" ? "Pause" : playbackState === "paused" ? "Resume" : "▶ Play"}
              </Text>
            </Pressable>
          ) : null}
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
                {recordingState === "done" || showPlayback ? "Re-record" : "Record"}
              </Text>
            </Pressable>
          )}
        </View>
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
