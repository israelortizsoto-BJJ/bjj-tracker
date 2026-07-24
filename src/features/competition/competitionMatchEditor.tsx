import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import {
  MatchMediaAttachments,
  type MatchMediaSharedPlaybackController,
  type MatchMediaSharedPlaybackScope,
} from "../../components/MatchMediaAttachments";
import {
  CoachVoiceNoteField,
  type CoachVoiceRecordingControls,
  type CoachVoiceRecordingState,
  type VoiceNoteAlignmentSnapshot,
} from "../coach/CoachVoiceNoteField";
import { TimedTranscriptFollowing } from "../coach/TimedTranscriptFollowing";
import { createFilmRoomSessionCoordinator } from "../../playback/FilmRoomSessionCoordinator";
import type { PlaybackCoordinator } from "../../playback/PlaybackCoordinator";
import {
  type CompetitionDetailMatchSnapshot,
  getCompetitionDetailByEntryId,
} from "../../storage/competitionStore";
import type { KidCompetitionEntry } from "../../types/coachKid";
import type { VoiceNoteRef } from "../../types/coachMatchBreakdownOverlay";
import { normalizeVoiceNoteRefs } from "../../types/coachMatchBreakdownOverlay";
import { getCoachMatchMediaAttachment } from "../../storage/coachMatchMediaAttachmentStore";
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
  /** Phase 1 companion audio refs (coach-local). Transcript remains canonical. */
  voiceNoteRefs?: VoiceNoteRef[];
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
    voiceNoteRefs: undefined,
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
  const voiceNoteRefs = normalizeVoiceNoteRefs(m.voiceNoteRefs);
  return {
    id: m.id,
    matchResult: m.matchResult,
    outcome: m.outcome,
    submissionTime,
    ...(st ? { submissionType: st } : {}),
    coachNote,
    ...(voiceNoteRefs ? { voiceNoteRefs } : {}),
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
  const voiceNoteRefs = normalizeVoiceNoteRefs((m as { voiceNoteRefs?: unknown }).voiceNoteRefs);
  const submissionType = normalizeStoredSubmissionType((m as { submissionType?: unknown }).submissionType);
  return {
    id: m.id,
    matchResult: m.matchResult,
    outcome: m.outcome,
    submissionTime,
    submissionType,
    coachNote,
    ...(voiceNoteRefs ? { voiceNoteRefs } : {}),
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
  onVoiceNotePersisted,
  onImageChange,
  onVideoChange,
  sharedPlaybackScope,
  canonicalReadOnly = false,
  matchBreakdownDisabled = false,
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
  onVoiceNotePersisted?: (localUri: string, alignment?: VoiceNoteAlignmentSnapshot) => void;
  onImageChange: (uri: string | null, assetId: string | null) => void;
  onVideoChange: (uri: string | null, assetId: string | null) => void;
  sharedPlaybackScope?: Omit<MatchMediaSharedPlaybackScope, "matchLineageKey"> | null;
  canonicalReadOnly?: boolean;
  /** INV-CIL-4: block Coach Match Breakdown authoring until ParentResultsRecorded. */
  matchBreakdownDisabled?: boolean;
}) {
  type RecordingState = CoachVoiceRecordingState;
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCoordinator, setPlaybackCoordinator] = useState<PlaybackCoordinator | null>(
    null,
  );
  const [coachAudioCoordinator, setCoachAudioCoordinator] = useState<PlaybackCoordinator | null>(
    null,
  );
  /** Session playhead time while coach_audio is active; null otherwise (Following gate). */
  const [transcriptFollowTimeMs, setTranscriptFollowTimeMs] = useState<number | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const recordingControlsRef = useRef<CoachVoiceRecordingControls | null>(null);
  const sharedPlaybackControllerRef = useRef<MatchMediaSharedPlaybackController | null>(null);
  const alignmentAttemptRef = useRef<{
    alignment: VoiceNoteAlignmentSnapshot;
    sharedAthleteId: string;
    sharedCompetitionId: string;
    matchLineageKey: string;
  } | null>(null);
  const prepareVoiceNoteAlignment = useCallback(async (): Promise<VoiceNoteAlignmentSnapshot | null> => {
    alignmentAttemptRef.current = null;
    const controller = sharedPlaybackControllerRef.current;
    if (!controller?.getActiveBinding()) return null;
    const confirmed = await controller.requestConfirmedBoundVideoPause();
    const alignment = {
      commentaryStartVideoMs: confirmed.positionMillis,
      matchMediaAssetId: confirmed.binding.matchMediaAssetId,
      attachmentRevision: confirmed.binding.attachmentRevision,
    };
    alignmentAttemptRef.current = {
      alignment,
      sharedAthleteId: confirmed.binding.sharedAthleteId,
      sharedCompetitionId: confirmed.binding.sharedCompetitionId,
      matchLineageKey: confirmed.binding.matchLineageKey,
    };
    return alignment;
  }, []);
  const persistVoiceNote = useCallback(async (
    localUri: string,
    alignment: VoiceNoteAlignmentSnapshot | null,
  ) => {
    let validAlignment: VoiceNoteAlignmentSnapshot | undefined;
    const attempt = alignment && alignmentAttemptRef.current?.alignment === alignment
      ? alignmentAttemptRef.current
      : null;
    if (
      attempt &&
      sharedPlaybackScope &&
      attempt.sharedAthleteId === sharedPlaybackScope.sharedAthleteId &&
      attempt.sharedCompetitionId === sharedPlaybackScope.sharedCompetitionId &&
      attempt.matchLineageKey === match.id
    ) {
      try {
        const current = await getCoachMatchMediaAttachment({
          sharedAthleteId: attempt.sharedAthleteId,
          sharedCompetitionId: attempt.sharedCompetitionId,
          matchLineageKey: attempt.matchLineageKey,
        });
        if (
          current?.state === "attached" &&
          current.matchMediaAssetId === attempt.alignment.matchMediaAssetId &&
          current.revision === attempt.alignment.attachmentRevision
        ) validAlignment = attempt.alignment;
      } catch {
        // Preserve the durable audio as unaligned when the read boundary is unavailable.
      }
    }
    alignmentAttemptRef.current = null;
    onVoiceNotePersisted?.(localUri, validAlignment);
  }, [match.id, onVoiceNotePersisted, sharedPlaybackScope]);
  // One Film Room session per MatchBlock — membership + exclusivity arbitration.
  const sessionRef = useRef(
    createFilmRoomSessionCoordinator({
      sessionId: match.id,
    }),
  );
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

  // Session lifetime owned by MatchBlock.
  useEffect(() => {
    const session = sessionRef.current;
    return () => {
      session.destroy();
    };
  }, []);

  // Session playhead observation (EX-3 read path).
  // Session has no subscribe API — poll getPlayhead for existing chrome only.
  // Field subscribe remains field-local (MatchMedia / CoachVoiceNoteField).
  // Transcript Following also consumes getPlayhead, gated to coach_audio leader
  // so video playhead never drives coach-audio TimedTranscript segments.
  useEffect(() => {
    const session = sessionRef.current;
    const syncFromSessionPlayhead = () => {
      const playhead = session.getPlayhead();
      setIsPlaying(playhead.playbackState === "playing");
      const active = session.getActiveParticipant();
      if (coachAudioCoordinator && active === coachAudioCoordinator) {
        setTranscriptFollowTimeMs(playhead.currentTimeMs);
      } else {
        setTranscriptFollowTimeMs(null);
      }
    };
    syncFromSessionPlayhead();
    const id = setInterval(syncFromSessionPlayhead, 250);
    return () => {
      clearInterval(id);
    };
  }, [coachAudioCoordinator]);

  // Register field coordinators when surfaces expose them (session installs play-intent hooks).
  useEffect(() => {
    if (!playbackCoordinator) return;
    const session = sessionRef.current;
    session.register(playbackCoordinator, "video");
    return () => {
      session.unregister(playbackCoordinator, "video");
    };
  }, [playbackCoordinator]);

  useEffect(() => {
    if (!coachAudioCoordinator) return;
    const session = sessionRef.current;
    session.register(coachAudioCoordinator, "coach_audio");
    return () => {
      session.unregister(coachAudioCoordinator, "coach_audio");
    };
  }, [coachAudioCoordinator]);

  const controlsDisabled = recordingState === "processing";
  const showRecordingOverlay = recordingState === "recording";
  // Preserve legacy hint gates: no video → paused; recording → paused (optimistic).
  const videoPlayingHint =
    Boolean(match.videoUri) && recordingState !== "recording" && isPlaying;

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
            onPlaybackCoordinator={setPlaybackCoordinator}
            sharedPlaybackScope={
              sharedPlaybackScope
                ? { ...sharedPlaybackScope, matchLineageKey: match.id }
                : null
            }
            onSharedPlaybackController={(controller) => {
              sharedPlaybackControllerRef.current = controller;
            }}
            onImageChange={onImageChange}
            onVideoChange={onVideoChange}
            shouldPausePlayback={recordingState === "recording"}
            // EX-3 write path: session owns seek intent via requestSeek.
            // Field Replay stays field-local (Invariant 21 / MatchMedia → replay()).
            // After replay, video is the active leader at t=0 — session seek re-asserts
            // authority at that time (first certified product consumer of requestSeek).
            onReplay={() => {
              void sessionRef.current.requestSeek(0);
            }}
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
                onPress={() => recordingControlsRef.current?.stopRecording()}
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
        style={{
          marginTop: 10,
          opacity: matchBreakdownDisabled ? 0.55 : 1,
        }}
        pointerEvents={matchBreakdownDisabled ? "none" : "auto"}
      >
        <CoachVoiceNoteField
          label="Coach Match Breakdown"
          value={match.coachNote ?? ""}
          onChangeText={onCoachNoteChange}
          onFocus={onCoachNoteFocus}
          placeholder="What went well, what to improve..."
          disabled={matchBreakdownDisabled}
          disabledHint="Waiting for parent-recorded results"
          scrollEnabled
          minHeight={120}
          maxHeight={120}
          idleStatusHint={videoPlayingHint ? "Video playing" : "Video paused"}
          externalStopControl
          recordingControlsRef={recordingControlsRef}
          playbackUri={match.voiceNoteRefs?.[0]?.localUri ?? null}
          beforeStartRecording={prepareVoiceNoteAlignment}
          onAudioPersisted={persistVoiceNote}
          onRecordingStateChange={setRecordingState}
          onPlaybackCoordinator={setCoachAudioCoordinator}
        />
        <TimedTranscriptFollowing
          audioUri={match.voiceNoteRefs?.[0]?.localUri ?? null}
          currentTimeMs={transcriptFollowTimeMs}
        />
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
