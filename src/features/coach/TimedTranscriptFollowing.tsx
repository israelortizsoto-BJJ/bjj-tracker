import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { readTimedTranscript } from "../../media/readTimedTranscript";
import { resolveActiveTimedTranscriptSegment } from "../../media/resolveActiveTimedTranscriptSegment";
import type { TimedTranscript, TimedTranscriptSegment } from "../../types/timedTranscript";

const UI = {
  border: "rgba(255, 255, 255, 0.09)",
  textPrimary: "#c4c7cb",
  textSecondary: "#868b92",
  bg: "#0e1012",
  activeText: "#ffffff",
  activeMark: "#d8f34a",
} as const;

const MAX_HEIGHT = 220;

type TimedTranscriptFollowingProps = {
  /** Coach recording audio URI (same key as TimedTranscript persist/read). */
  audioUri: string | null | undefined;
  /**
   * Session playhead time while coach_audio is the active Film Room participant.
   * Null disables active following (e.g. video is leader, or no active participant).
   */
  currentTimeMs: number | null;
  /**
   * Notifies when the active segment identity changes (including clear → null).
   * Used by Film Room closed-caption overlay — does not own playback.
   */
  onActiveSegmentChange?: (segment: TimedTranscriptSegment | null) => void;
};

/**
 * Production Film Room TimedTranscript Following surface.
 *
 * Loads certified TimedTranscript evidence via readTimedTranscript.
 * Highlights the segment covering currentTimeMs (Session playhead when coach_audio leads).
 * Does not seek, write playhead, or own playback clocks.
 */
export function TimedTranscriptFollowing({
  audioUri,
  currentTimeMs,
  onActiveSegmentChange,
}: TimedTranscriptFollowingProps) {
  const [transcript, setTranscript] = useState<TimedTranscript | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "missing" | "ready">("idle");
  const scrollRef = useRef<ScrollView>(null);
  const rowOffsetsRef = useRef<Record<string, number>>({});
  const lastScrolledIdRef = useRef<string | null>(null);
  const lastNotifiedIdRef = useRef<string | null | undefined>(undefined);
  const onActiveSegmentChangeRef = useRef(onActiveSegmentChange);
  onActiveSegmentChangeRef.current = onActiveSegmentChange;

  useEffect(() => {
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

  const activeSegment =
    status === "ready" && transcript && currentTimeMs != null
      ? resolveActiveTimedTranscriptSegment(transcript.segments, currentTimeMs)
      : null;

  useEffect(() => {
    const nextId = activeSegment?.id ?? null;
    if (nextId === lastNotifiedIdRef.current) return;
    lastNotifiedIdRef.current = nextId;
    onActiveSegmentChangeRef.current?.(activeSegment);
  }, [activeSegment]);

  useEffect(() => {
    if (!activeSegment) {
      lastScrolledIdRef.current = null;
      return;
    }
    if (activeSegment.id === lastScrolledIdRef.current) return;
    const offset = rowOffsetsRef.current[activeSegment.id];
    if (typeof offset !== "number") return;
    lastScrolledIdRef.current = activeSegment.id;
    scrollRef.current?.scrollTo({ y: Math.max(0, offset - 8), animated: true });
  }, [activeSegment]);

  const uri = audioUri?.trim();
  if (!uri || status === "idle" || status === "missing") {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>TRANSCRIPT</Text>
      <Text style={styles.title}>Follow the breakdown</Text>
      {status === "loading" ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : null}
      {status === "ready" && transcript ? (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {transcript.segments.map((segment, index) => {
            const active = activeSegment?.id === segment.id;
            return (
              <View
                key={segment.id}
                onLayout={(event) => {
                  rowOffsetsRef.current[segment.id] = event.nativeEvent.layout.y;
                }}
                style={[
                  styles.segment,
                  index === 0 ? styles.firstSegment : null,
                  active ? styles.activeSegment : null,
                ]}
              >
                <View style={[styles.activeMark, active ? styles.activeMarkVisible : null]} />
                <Text style={[styles.segmentText, active ? styles.activeText : null]}>
                  {segment.text}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    maxHeight: MAX_HEIGHT,
    gap: 7,
  },
  eyebrow: {
    color: UI.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.25,
  },
  title: {
    marginBottom: 6,
    color: "#f7f7f8",
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.35,
  },
  loading: {
    color: UI.textSecondary,
    fontSize: 12,
  },
  scroll: {
    maxHeight: MAX_HEIGHT - 46,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bg,
  },
  segment: {
    position: "relative",
    minHeight: 46,
    justifyContent: "center",
    paddingVertical: 11,
    paddingLeft: 16,
    paddingRight: 12,
    borderTopWidth: 1,
    borderTopColor: UI.border,
  },
  firstSegment: {
    borderTopWidth: 0,
  },
  activeSegment: {
    backgroundColor: "rgba(255, 255, 255, 0.045)",
  },
  activeMark: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 2,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  activeMarkVisible: {
    backgroundColor: UI.activeMark,
  },
  segmentText: {
    color: UI.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  activeText: {
    color: UI.activeText,
    fontWeight: "700",
  },
});
