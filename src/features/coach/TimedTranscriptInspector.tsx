import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { readTimedTranscript } from "../../media/readTimedTranscript";
import type { TimedTranscript } from "../../types/timedTranscript";

const UI = {
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  bg: "#f9fafb",
} as const;

type TimedTranscriptInspectorProps = {
  /** Selected coach recording audio URI (same key as TimedTranscript persist/read). */
  audioUri: string | null | undefined;
};

/**
 * Developer-facing TimedTranscript inspector (Evidence Activation first consumer).
 *
 * Read-only: loads persisted segments via readTimedTranscript and lists them.
 * Not transcript-following, not playback sync, not a production Film Room surface.
 * Renders only in __DEV__.
 */
export function TimedTranscriptInspector({ audioUri }: TimedTranscriptInspectorProps) {
  const [transcript, setTranscript] = useState<TimedTranscript | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "missing" | "ready">("idle");

  useEffect(() => {
    if (!__DEV__) return;
    const uri = audioUri?.trim();
    if (!uri) {
      setTranscript(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    void readTimedTranscript(uri).then((next) => {
      if (cancelled) return;
      setTranscript(next);
      setStatus(next ? "ready" : "missing");
    });

    return () => {
      cancelled = true;
    };
  }, [audioUri]);

  if (!__DEV__) return null;

  const uri = audioUri?.trim();
  if (!uri) return null;

  return (
    <View
      style={{
        marginTop: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: UI.border,
        backgroundColor: UI.bg,
        padding: 10,
        gap: 6,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          letterSpacing: 0.5,
          fontWeight: "700",
          color: UI.textSecondary,
        }}
      >
        TimedTranscript Inspector (dev)
      </Text>
      {status === "loading" ? (
        <Text style={{ fontSize: 11, color: UI.textSecondary }}>Loading…</Text>
      ) : null}
      {status === "missing" ? (
        <Text style={{ fontSize: 11, color: UI.textSecondary }}>
          No TimedTranscript for this recording.
        </Text>
      ) : null}
      {status === "ready" && transcript
        ? transcript.segments.map((segment, index) => (
            <View
              key={segment.id}
              style={{
                paddingVertical: 4,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: UI.border,
                gap: 2,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: UI.textPrimary }}>
                [{index}] {segment.startMs}–{segment.endMs} ms
              </Text>
              <Text style={{ fontSize: 12, color: UI.textPrimary }}>{segment.text}</Text>
            </View>
          ))
        : null}
    </View>
  );
}
