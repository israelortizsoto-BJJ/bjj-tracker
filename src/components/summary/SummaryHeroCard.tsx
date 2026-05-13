import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SignalOutput } from "@/src/lib/signals/computeSignals";
import type { IdentityScoreResult } from "@/src/lib/identity/computeIdentityScore";
import type {
  IdentitySuggestion,
  IdentitySuggestionSource,
} from "@/src/lib/identity/deriveIdentitySuggestions";
import type { IdentityValidationResult } from "@/src/lib/identity/validateIdentitySignals";
import type { ResolvedSyncedWeeklyDoc } from "@/src/coach/resolveWeeklyDoc";
import {
  buildSummaryViewModel,
  extractSignalSnapshot,
} from "@/src/lib/summary/buildSummaryViewModel";
import { selectFocusSystem } from "@/src/lib/summary/selectFocusSystem";

import SummaryV2Card from "./SummaryV2Card";

export type SummaryHeroIdentitySignals = {
  hasData: true;
  isIdentityBased: true;
  confidenceScore: number;
  phase: "cold" | "developing" | "experienced";
  identityFocus?: string;
  blendedFocus?: string;
  focusMode?: "identity" | "blended" | "signals";
  trend?: "improving" | "stable" | "developing" | "none";
  trendFeedback?: string | null;
  postSessionFeedback?: string | null;
};

export type SummaryHeroSignalsExtended =
  | (SignalOutput & {
      blendedFocus?: string;
      focusMode?: "identity" | "blended" | "signals";
      trend?: "improving" | "stable" | "developing" | "none";
      trendFeedback?: string | null;
      postSessionFeedback?: string | null;
    })
  | SummaryHeroIdentitySignals;

export type SummaryHeroSignals = SummaryHeroSignalsExtended;

const TREND_LABEL: Record<
  "improving" | "stable" | "developing" | "none",
  string | null
> = {
  improving: "Improving",
  stable: "Stable",
  developing: "Developing",
  none: null,
};

const PHASE_LABEL: Record<IdentityScoreResult["phase"], string> = {
  cold: "Starting",
  developing: "Building",
  experienced: "Refining",
};

const FOCUS_MODE_LABEL: Record<
  NonNullable<SummaryHeroIdentitySignals["focusMode"]>,
  string
> = {
  identity: "Starting point",
  blended: "Evolving focus",
  signals: "Performance-driven",
};

function isIdentitySignals(s: SummaryHeroSignals): s is SummaryHeroIdentitySignals {
  return "isIdentityBased" in s && s.isIdentityBased === true;
}

export type SummaryHeroSuggestionProfile = {
  declaredSkills?: string[] | null;
  isCompetitor?: boolean | null;
  experienceLevel?: string | null;
};

function isSuggestionAlreadyApplied(
  s: IdentitySuggestion,
  profile: SummaryHeroSuggestionProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (s.type === "skill" && typeof s.suggestedValue === "string") {
    return (profile.declaredSkills ?? []).includes(s.suggestedValue);
  }
  if (s.type === "competitor") {
    return profile.isCompetitor === true;
  }
  if (s.type === "experience" && typeof s.suggestedValue === "string") {
    return (
      (profile.experienceLevel ?? "").trim().toLowerCase() === s.suggestedValue.toLowerCase()
    );
  }
  return false;
}

function suggestionRowKey(s: IdentitySuggestion): string {
  return `${s.type}-${s.suggestedValue}`;
}

/** Matches SummaryScreen getSuggestionKey for dismiss / resurfacing state. */
function suggestionResurfaceKey(s: IdentitySuggestion): string {
  return `${s.type}-${String(s.suggestedValue ?? "none")}`;
}

function getResurfacedMessage(s: IdentitySuggestion): string {
  if (s.type === "skill") {
    return "Still seeing this pattern in your training. Want to update your focus?";
  }

  if (s.type === "competitor") {
    return "You're continuing to compete. Consider updating your profile.";
  }

  if (s.type === "experience") {
    return "Your activity keeps increasing. This may be worth updating.";
  }

  return s.message;
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 0.8) return "Strong signal";
  if (confidence >= 0.6) return "Clear pattern";
  return "Emerging pattern";
}

const SOURCE_PROVENANCE_LABEL: Record<IdentitySuggestionSource, string> = {
  coach: "Coach insight",
  signals: "Training pattern",
  activity: "Activity level",
};

type SummaryHeroProps = {
  signals: SummaryHeroSignals;
  lastAction?: string | null;
  coachWeekly?: {
    headline: string;
    body?: string;
    systemKey?: string | null;
  } | null;
  /** TEMP: dual VM audit — parent passes resolved doc + athlete id in __DEV__ only. */
  devDualVmAudit?: {
    athleteId: string;
    resolvedWeeklyDoc: ResolvedSyncedWeeklyDoc | null;
  } | null;
  /** When `hasData` is false (activity signals), replaces the default empty-state insight line. */
  emptyInsightCopy?: string | null;
  /** Optional override; prefers `signals.postSessionFeedback` from `deriveSummaryInsights` when present. */
  postSessionFeedback?: string | null;
  identityReason?: string | null;
  signalReason?: string | null;
  nextAction?: string | null;
  identityValidation?: IdentityValidationResult | null;
  identitySuggestions?: IdentitySuggestion[] | null;
  resurfacedSuggestionKeys?: Set<string>;
  onApplySuggestion?: (suggestion: IdentitySuggestion) => void;
  onDismissSuggestion?: (suggestion: IdentitySuggestion) => void;
  suggestionProfile?: SummaryHeroSuggestionProfile | null;
};

export default function SummaryHeroCard({
  signals,
  lastAction,
  coachWeekly,
  devDualVmAudit,
  emptyInsightCopy,
  postSessionFeedback,
  identityReason,
  signalReason,
  nextAction,
  identityValidation,
  identitySuggestions,
  resurfacedSuggestionKeys,
  onApplySuggestion,
  onDismissSuggestion,
  suggestionProfile,
}: SummaryHeroProps) {
  const mergedPostFeedback =
    (signals.postSessionFeedback ?? postSessionFeedback)?.trim() || null;

  const identityBased = isIdentitySignals(signals);
  const hasData = identityBased ? true : signals.hasData;
  const alignment = identityBased ? signals.confidenceScore : signals.alignment;
  const confidence = identityBased ? signals.confidenceScore : signals.confidence;
  const topSystem = identityBased ? null : signals.patterns.topSystem;
  const topTechnique = identityBased ? null : signals.patterns.topTechnique;

  const focus = topSystem || topTechnique;
  let focusText: string | null | undefined = focus;
  if (identityBased && signals.identityFocus) {
    focusText = signals.identityFocus;
  }
  if (signals.blendedFocus?.trim()) {
    focusText = signals.blendedFocus.trim();
  }
  const identityFocusForVm = identityBased ? signals.identityFocus : focusText;
  const resolvedWeeklyDoc = devDualVmAudit?.resolvedWeeklyDoc ?? null;
  const snapForSelect = extractSignalSnapshot(signals);
  const coachSystemKeyForVm = coachWeekly?.systemKey?.trim() || null;
  const selectedSystemKey = selectFocusSystem({
    coachSystem: coachSystemKeyForVm,
    signalSystem: snapForSelect.topSystem,
    identityFocus: identityFocusForVm,
  });
  const isAllFocus = focus?.toLowerCase() === "all";
  const identityLabel = focus ? (isAllFocus ? "Well-Rounded" : topSystem || "Technique") : null;
  const focusLabel = isAllFocus ? "multiple positions" : focus;
  const headline = hasData ? "A mirror of the athlete" : "No athlete data yet";
  const identity = focus
    ? `${identityLabel} Competitor`
    : hasData
      ? "Game profile forming"
      : "Identity will build here";
  const defaultEmptyInsight = "Log sessions or competitions to start seeing patterns";
  const blendedFocusLine = signals.blendedFocus?.trim() || null;
  const insight = blendedFocusLine
    ? blendedFocusLine
    : focus
      ? `You win when you control ${focusLabel}`
      : identityBased
        ? focusText ??
          "You're building your identity. Start logging to validate your game."
        : hasData
          ? "Training patterns have not emerged yet"
          : emptyInsightCopy?.trim() || defaultEmptyInsight;

  const subtext = identityBased
    ? "Profile-based confidence until your training and competition signals kick in."
    : hasData
      ? "Built from your training and competition."
      : "This view stays quiet until real activity exists.";

  if (__DEV__) {
    console.log("[SUMMARY DUAL VM AUDIT] SummaryHeroCard.pre-buildSummaryViewModel", {
      athleteId: devDualVmAudit?.athleteId ?? null,
      weeklyHeadline:
        resolvedWeeklyDoc?.headline?.slice(0, 120) ??
        coachWeekly?.headline?.slice(0, 120) ??
        null,
      weeklySystemKey: resolvedWeeklyDoc?.systemKey ?? coachWeekly?.systemKey ?? null,
      coachWeekly: coachWeekly ?? null,
      resolvedWeeklyDoc,
      selectedSystemKey,
    });
  }

  const viewModel = buildSummaryViewModel({
    signals,
    identityScore: confidence,
    phase: identityBased ? signals.phase : hasData ? "experienced" : "cold",
    identityFocus: identityFocusForVm,
    coachWeekly: coachWeekly ?? null,
    lastAction: lastAction ?? null,
    devFinalHeroVmTrace: __DEV__
      ? { athleteId: devDualVmAudit?.athleteId ?? null }
      : undefined,
  });

  const weeklyCoachActive = Boolean(
    coachWeekly?.headline?.trim() || coachWeekly?.systemKey?.trim(),
  );

  const legacyHero = (
    <View style={[styles.container, !hasData ? styles.emptyContainer : null]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Identity</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={[styles.headline, !hasData ? styles.mutedHeadline : null]}>
            {headline}
          </Text>
          <Text style={[styles.identity, !hasData ? styles.emptyIdentity : null]}>
            {identity}
          </Text>
          <Text style={styles.subtext}>
            {subtext}
          </Text>
          {identityBased ? (
            <Text style={styles.stageLine}>
              Stage: {PHASE_LABEL[signals.phase]}
            </Text>
          ) : null}
          <Text style={styles.insight}>
            {insight}
          </Text>
          {signals.trendFeedback ? (
            <Text style={styles.trendFeedbackText}>{signals.trendFeedback}</Text>
          ) : null}
          {signals.trend && TREND_LABEL[signals.trend] ? (
            <Text style={styles.trendLabel}>{TREND_LABEL[signals.trend]}</Text>
          ) : null}
          {!identityBased && hasData && mergedPostFeedback ? (
            <Text style={styles.postSessionFeedback}>{mergedPostFeedback}</Text>
          ) : null}
          {identityReason ? (
            <Text style={styles.explanationText}>{identityReason}</Text>
          ) : null}
          {signalReason ? (
            <Text style={styles.explanationText}>{signalReason}</Text>
          ) : null}
          {nextAction ? (
            <Text style={styles.nextActionText}>{nextAction}</Text>
          ) : null}
          {identityValidation?.notes?.length ? (
            <View style={styles.validationBox}>
              {identityValidation.notes.map((n, i) => (
                <Text key={i} style={styles.validationText}>
                  {n}
                </Text>
              ))}
            </View>
          ) : null}
          {identitySuggestions?.length ? (
            <View style={styles.suggestionBox}>
              {identitySuggestions.map((s) => {
                const applied = isSuggestionAlreadyApplied(s, suggestionProfile);
                const suggestionKey = suggestionResurfaceKey(s);
                const isResurfaced = resurfacedSuggestionKeys?.has(suggestionKey);
                return (
                  <View key={suggestionRowKey(s)} style={styles.suggestionRow}>
                    <Text style={styles.suggestionText}>
                      {isResurfaced ? getResurfacedMessage(s) : s.message}
                    </Text>
                    {isResurfaced && s.context ? (
                      <Text style={styles.resurfacedContext}>
                        Still relevant · {s.context}
                      </Text>
                    ) : s.context ? (
                      <Text style={styles.suggestionContext}>
                        <Text style={styles.suggestionProvenancePrefix}>
                          {SOURCE_PROVENANCE_LABEL[s.source]} ·{" "}
                        </Text>
                        {s.context}
                      </Text>
                    ) : null}
                    <Text style={styles.suggestionMeta}>
                      {getConfidenceLabel(s.confidence)}
                    </Text>

                    {!applied && (onApplySuggestion || onDismissSuggestion) ? (
                      <View style={styles.suggestionActions}>
                        {onApplySuggestion ? (
                          <Pressable
                            style={styles.applyButton}
                            onPress={() => onApplySuggestion(s)}
                          >
                            <Text style={styles.applyButtonText}>Apply</Text>
                          </Pressable>
                        ) : null}
                        {onDismissSuggestion ? (
                          <Pressable
                            accessibilityRole="button"
                            hitSlop={6}
                            onPress={() => onDismissSuggestion(s)}
                          >
                            <Text style={styles.dismissLink}>Skip</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
          {signals.focusMode ? (
            <Text style={styles.focusModeText}>
              {FOCUS_MODE_LABEL[signals.focusMode]}
            </Text>
          ) : null}
          <Text style={styles.explanation}>
            Confidence reflects alignment between your training behavior, competition
            results, and coaching input.
          </Text>
        </View>
        <View style={styles.right}>
          <View style={[styles.alignmentContainer, !hasData ? styles.emptyAlignment : null]}>
            <Text style={[styles.alignmentValue, !hasData ? styles.emptyAlignmentValue : null]}>
              {hasData ? `${alignment}%` : "—"}
            </Text>
            <Text style={styles.alignmentLabel}>{hasData ? "Aligned" : "No data"}</Text>
          </View>
          <Text style={styles.confidence}>
            {hasData ? `Confidence: ${confidence}%` : "Confidence builds with activity"}
          </Text>
        </View>
      </View>
    </View>
  );

  void legacyHero;

  return <SummaryV2Card viewModel={viewModel} weeklyCoachActive={weeklyCoachActive} />;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#171b20",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#26303a",
  },
  emptyContainer: {
    borderColor: "#20252b",
  },
  headerRow: {
    marginBottom: 10,
  },
  sectionLabel: {
    color: "#c7cbd1",
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: {
    flex: 1,
    paddingRight: 16,
  },
  right: {
    width: 108,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 5,
  },
  mutedHeadline: {
    color: "#c7cbd1",
  },
  identity: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 29,
    marginBottom: 7,
  },
  emptyIdentity: {
    color: "#d1d5db",
    fontSize: 22,
  },
  subtext: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 10,
  },
  stageLine: {
    color: "#8fa3ad",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  insight: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  trendFeedbackText: {
    marginTop: 8,
    color: "#8fa3ad",
    fontSize: 13,
    lineHeight: 18,
  },
  trendLabel: {
    marginTop: 4,
    color: "#6b7c86",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  postSessionFeedback: {
    marginTop: 10,
    fontSize: 13,
    color: "#c7f36b",
    lineHeight: 18,
  },
  explanationText: {
    marginTop: 8,
    fontSize: 13,
    color: "#8fa3ad",
    lineHeight: 18,
  },
  nextActionText: {
    marginTop: 10,
    fontSize: 13,
    color: "#c7f36b",
    lineHeight: 18,
  },
  validationBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#11181f",
  },
  validationText: {
    color: "#8fa3ad",
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#0f1720",
  },
  suggestionRow: {
    marginBottom: 10,
  },
  suggestionText: {
    color: "#c7f36b",
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionContext: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7c86",
    fontStyle: "italic",
  },
  resurfacedContext: {
    marginTop: 2,
    fontSize: 11,
    color: "#8fa3ad",
  },
  suggestionProvenancePrefix: {
    fontStyle: "normal",
  },
  suggestionMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7c86",
  },
  suggestionActions: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  applyButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#c7f36b",
  },
  dismissLink: {
    color: "#6b7c86",
    fontSize: 12,
    fontWeight: "600",
  },
  applyButtonText: {
    color: "#0b0f14",
    fontSize: 12,
    fontWeight: "600",
  },
  focusModeText: {
    color: "#8fa3ad",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
  },
  explanation: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 20,
  },
  alignmentContainer: {
    backgroundColor: "#020617",
    width: 96,
    height: 96,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#c7f36b",
  },
  emptyAlignment: {
    borderColor: "#28313c",
  },
  alignmentValue: {
    color: "#c7f36b",
    fontSize: 23,
    fontWeight: "800",
  },
  emptyAlignmentValue: {
    color: "#9ca3af",
  },
  alignmentLabel: {
    color: "#9ca3af",
    fontSize: 12,
  },
  confidence: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },
});
