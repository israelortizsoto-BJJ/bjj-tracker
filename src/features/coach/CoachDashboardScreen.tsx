import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { CompetitionPlacementTrend } from "../../lib/signals/computeSignals";
import {
  trainingSkillBucketDisplayLabel,
  trainingSkillBucketTopicPhrase,
  type TrainingSkillBucket,
} from "../../ai-coach/competitionTrainingSkillFocus";
import { summarizeTeamBucketMomentum } from "../../lib/signals/competitionBucketHistory";
import type {
  CoachInsightRow,
  CoachTeamFocusAthleteRow,
} from "./useCoachInsights";
import { useCoachInsights } from "./useCoachInsights";
import type { SyncedWeeklyParentFeedback } from "../../types/coachWeeklySync";
import OperatingHeader from "../../components/operating/OperatingHeader";

const UI = {
  screenBg: "#0b0f12",
  bgCard: "#171b20",
  bgCardElevated: "#1a2026",
  border: "#26303a",
  borderSubtle: "rgba(236, 241, 245, 0.1)",
  fieldBg: "#20252b",
  fieldBgQuiet: "#15191e",
  textPrimary: "#ffffff",
  textSecondary: "#9ca3af",
  textFaint: "#777f89",
  accent: "#c7f36b",
  accentSoft: "rgba(199, 243, 107, 0.08)",
  danger: "#fca5a5",
};

type AttentionLevel = CoachInsightRow["insight"]["attentionLevel"];

function sortByExecutionAsc(a: CoachInsightRow, b: CoachInsightRow): number {
  return a.insight.executionScore - b.insight.executionScore;
}

function initialsForName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "A";
}

function executionLabel(score: number): string {
  if (score <= 0.4) return "Low";
  if (score <= 0.75) return "Medium";
  return "High";
}

function outcomeLabel(outcome: CoachInsightRow["insight"]["derivedOutcome"]): string {
  if (outcome === "learning") return "Learning";
  if (outcome === "developing") return "Developing";
  if (outcome === "applying") return "Applying";
  return "Unclear";
}

function appliedInSparringLabel(
  appliedInSparring: CoachInsightRow["insight"]["appliedInSparring"],
): string {
  if (appliedInSparring == null) return "No Data";
  if (appliedInSparring === "yes") return "Yes";
  if (appliedInSparring === "not_yet") return "Not Yet";
  if (appliedInSparring === "sometimes") return "Sometimes";
  if (appliedInSparring === "no_data") return "No Data";
  return "No Data";
}

function formatParentFeedbackTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function parentFeedbackAckLabel(
  parentFeedback: SyncedWeeklyParentFeedback | null | undefined,
): string {
  if (parentFeedback?.acknowledgedAt) {
    const time = formatParentFeedbackTime(parentFeedback.acknowledgedAt);
    return time ? `✓ Acknowledged at ${time}` : "✓ Acknowledged";
  }
  if (parentFeedback?.viewedAt) {
    const time = formatParentFeedbackTime(parentFeedback.viewedAt);
    return time ? `✓ Viewed at ${time}` : "✓ Viewed";
  }
  return "• Not viewed yet";
}

function attentionLabel(level: AttentionLevel): string {
  return level.toUpperCase();
}

function topTrainingSkillBuckets(rows: CoachTeamFocusAthleteRow[], take: number) {
  const tallies = new Map<TrainingSkillBucket, number>();
  for (const r of rows) {
    const b = r.focusBucket;
    if (!b) continue;
    tallies.set(b, (tallies.get(b) ?? 0) + 1);
  }
  return [...tallies.entries()]
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count || a.bucket.localeCompare(b.bucket))
    .slice(0, take);
}

/** Static drill ideas keyed by the same `TrainingSkillBucket` system as team focus. */
const CLASS_FOCUS_DRILL_IDEAS: Record<TrainingSkillBucket, readonly [string, string]> = {
  guard_retention: ["Positional sparring", "Guard recovery drills"],
  defense: ["Escape chains", "Submission defense rounds"],
  sweeps: ["Sweep timing reps", "Partner sweep chains"],
  submissions: ["Submission chains", "Finish-pressure rounds"],
  positioning: ["Positional control rounds", "Scoring / advantage scenarios"],
};

function classFocusSentenceFromTopBuckets(
  top: { bucket: TrainingSkillBucket; count: number }[],
): string | null {
  if (top.length === 0) return null;
  const topics = top.map((t) => trainingSkillBucketTopicPhrase(t.bucket));
  const focus =
    topics.length === 1
      ? topics[0]
      : `${topics[0]} and ${topics[1]}`;
  return `Today's class can focus on ${focus}.`;
}

function drillIdeasForClassFocus(
  top: { bucket: TrainingSkillBucket; count: number }[],
): string[] {
  if (top.length === 0) return [];
  if (top.length === 1) {
    return [...CLASS_FOCUS_DRILL_IDEAS[top[0].bucket].slice(0, 2)];
  }
  const a = CLASS_FOCUS_DRILL_IDEAS[top[0].bucket];
  const b = CLASS_FOCUS_DRILL_IDEAS[top[1].bucket];
  return [a[0], b[0], a[1]].slice(0, 3);
}

function formatClassPlanForClipboard(sentence: string, bullets: string[]): string {
  if (bullets.length === 0) return sentence;
  return [sentence, "", ...bullets.map((line) => `• ${line}`)].join("\n");
}

function dominantPlacementTrendWithCount(rows: CoachTeamFocusAthleteRow[]): {
  trend: CompetitionPlacementTrend;
  count: number;
} | null {
  const tallies = new Map<CompetitionPlacementTrend, number>();
  for (const r of rows) {
    const t = r.placementTrend;
    if (!t) continue;
    tallies.set(t, (tallies.get(t) ?? 0) + 1);
  }
  const ranked = [...tallies.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const first = ranked[0];
  if (!first || first[1] < 2) return null;
  return { trend: first[0], count: first[1] };
}

function formatPlacementTrendLabel(t: CompetitionPlacementTrend): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Group({
  title,
  level,
  rows,
}: {
  title: string;
  level: AttentionLevel;
  rows: CoachInsightRow[];
}) {
  if (rows.length === 0) return null;

  return (
    <View style={[styles.group, groupStyleForLevel(level)]}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={[styles.badge, badgeStyleForLevel(level)]}>
          {attentionLabel(level)}
        </Text>
      </View>

      <View style={styles.cardStack}>
        {rows.map((row) => (
          <AthleteCard key={row.athlete.id} row={row} />
        ))}
      </View>
    </View>
  );
}

function AthleteCard({ row }: { row: CoachInsightRow }) {
  const { athlete, insight, parentFeedback } = row;
  const level = insight.attentionLevel;
  const showParentFeedbackAck = Boolean(athlete.sharedAthleteId?.trim());

  return (
    <Pressable
      onPress={() => router.push(`/coach/kid/${athlete.id}`)}
      style={({ pressed }) => [
        styles.athleteCard,
        pressed ? styles.athleteCardPressed : null,
      ]}
    >
      <View style={styles.athleteMain}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsForName(athlete.name)}</Text>
        </View>

        <View style={styles.athleteContent}>
          <Text style={styles.athleteName}>{athlete.name}</Text>
          <Text
            style={styles.focusLine}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            Focus: {insight.currentFocus ?? "None"}
          </Text>
          <View style={styles.metrics}>
            <Text style={styles.metricLine}>
              Execution: {executionLabel(insight.executionScore)} (
              {insight.sessionsThisWeek} sessions)
            </Text>
            <Text style={styles.metricLine}>
              Applied in Sparring: {appliedInSparringLabel(insight.appliedInSparring)}
            </Text>
            <Text style={styles.metricLine}>
              Outcome: {outcomeLabel(insight.derivedOutcome)}
            </Text>
            {showParentFeedbackAck ? (
              <Text style={styles.metricLine}>
                {parentFeedbackAckLabel(parentFeedback)}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.badge, styles.cardBadge, badgeStyleForLevel(level)]}>
          {attentionLabel(level)}
        </Text>
      </View>

      <Text
        style={styles.reason}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {insight.reason}
      </Text>
    </Pressable>
  );
}

function groupStyleForLevel(level: AttentionLevel) {
  if (level === "high") return styles.groupHigh;
  if (level === "low") return styles.groupLow;
  return styles.groupMedium;
}

function badgeStyleForLevel(level: AttentionLevel) {
  if (level === "high") return styles.badgeHigh;
  if (level === "low") return styles.badgeLow;
  return styles.badgeMedium;
}

export default function CoachDashboardScreen() {
  const { loading, insights, teamFocus } = useCoachInsights();
  const [drillBucket, setDrillBucket] = useState<TrainingSkillBucket | null>(null);
  const [classPlanCopied, setClassPlanCopied] = useState(false);
  const classPlanCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bucketTopLines = useMemo(
    () => topTrainingSkillBuckets(teamFocus.athleteRows, 3),
    [teamFocus.athleteRows],
  );

  const topTwoFocusBuckets = useMemo(
    () => topTrainingSkillBuckets(teamFocus.athleteRows, 2),
    [teamFocus.athleteRows],
  );

  const classFocusSentence = useMemo(
    () => classFocusSentenceFromTopBuckets(topTwoFocusBuckets),
    [topTwoFocusBuckets],
  );

  const classFocusDrillBullets = useMemo(
    () => drillIdeasForClassFocus(topTwoFocusBuckets),
    [topTwoFocusBuckets],
  );

  const classPlanClipboardText = useMemo(
    () =>
      classFocusSentence
        ? formatClassPlanForClipboard(classFocusSentence, classFocusDrillBullets)
        : "",
    [classFocusSentence, classFocusDrillBullets],
  );

  const onUseForClass = useCallback(async () => {
    const text = classPlanClipboardText.trim();
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setClassPlanCopied(true);
    if (classPlanCopiedTimer.current) clearTimeout(classPlanCopiedTimer.current);
    classPlanCopiedTimer.current = setTimeout(() => {
      setClassPlanCopied(false);
      classPlanCopiedTimer.current = null;
    }, 2200);
  }, [classPlanClipboardText]);

  const trendHighlight = useMemo(
    () => dominantPlacementTrendWithCount(teamFocus.athleteRows),
    [teamFocus.athleteRows],
  );

  const teamBucketMomentum = useMemo(
    () =>
      summarizeTeamBucketMomentum(
        teamFocus.athleteRows.map((r) => ({
          focusBucket: r.focusBucket,
          bucketOutcomeTrends: r.bucketOutcomeTrends,
        })),
      ),
    [teamFocus.athleteRows],
  );

  const drillAthletes = useMemo(() => {
    if (!drillBucket) return [];
    return teamFocus.athleteRows.filter((r) => r.focusBucket === drillBucket);
  }, [teamFocus.athleteRows, drillBucket]);

  const high = insights
    .filter(({ insight }) => insight.attentionLevel === "high")
    .sort(sortByExecutionAsc);
  const medium = insights
    .filter(({ insight }) => insight.attentionLevel === "medium")
    .sort(sortByExecutionAsc);
  const low = insights
    .filter(({ insight }) => insight.attentionLevel === "low")
    .sort(sortByExecutionAsc);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OperatingHeader
          mode="team"
          eyebrow="Team / Operations"
          title="Coach Dashboard"
          subtitle="Where coaching decisions are made."
          teamLabel="Team operations"
          teamMeta={`${insights.length} active athletes`}
          actions={[
            {
              label: "Athlete roster and parent links",
              icon: "+",
              onPress: () => router.push("/coach/kids"),
            },
            {
              label: "Team dashboard",
              statusColor: UI.accent,
            },
            {
              label: "Device profile and settings",
              icon: "⚙",
              accessibilityLabel: "Device profile and settings",
              onPress: () => router.push("/profile"),
            },
          ]}
        />

        <View style={styles.snapshot}>
          <Text style={styles.snapshotTitle}>Coach Snapshot</Text>
          <View style={styles.snapshotRows}>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotValue}>{insights.length}</Text>
              <Text style={styles.snapshotText}>athletes active</Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotValue}>{high.length}</Text>
              <Text style={styles.snapshotText}>need attention</Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotValue}>{low.length}</Text>
              <Text style={styles.snapshotText}>on track</Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotValue}>{medium.length}</Text>
              <Text style={styles.snapshotText}>monitor</Text>
            </View>
          </View>
        </View>

        <View style={styles.snapshot}>
          <Text style={styles.snapshotTitle}>Team Focus Snapshot</Text>
          {!loading && bucketTopLines.length === 0 ? (
            <Text style={styles.teamFocusHint}>
              High-confidence gaps from logged competition notes will aggregate here across athletes.
            </Text>
          ) : null}
          {!loading && bucketTopLines.length > 0 ? (
            <View style={styles.teamFocusBuckets}>
              {bucketTopLines.map(({ bucket, count }) => (
                <Pressable
                  key={bucket}
                  accessibilityRole="button"
                  accessibilityLabel={`${trainingSkillBucketDisplayLabel(bucket)}, ${count} athletes`}
                  onPress={() => setDrillBucket(bucket)}
                  style={({ pressed }) => [
                    styles.teamFocusBucketRow,
                    pressed ? styles.teamFocusBucketRowPressed : null,
                  ]}
                >
                  <Text style={styles.teamFocusBucketLabel}>
                    {trainingSkillBucketDisplayLabel(bucket)}{" "}
                    <Text style={styles.teamFocusBucketCount}>
                      ({count} {count === 1 ? "athlete" : "athletes"})
                    </Text>
                  </Text>
                  <Text style={styles.teamFocusChevron}>›</Text>
                </Pressable>
              ))}
              {trendHighlight ? (
                <Text style={styles.teamFocusTrend}>
                  Most common trend: {formatPlacementTrendLabel(trendHighlight.trend)}{" "}
                  ({trendHighlight.count}{" "}
                  {trendHighlight.count === 1 ? "athlete" : "athletes"})
                </Text>
              ) : null}

              {teamBucketMomentum.mostImproved ? (
                <Text style={styles.teamFocusMomentum}>
                  Most improved area:{" "}
                  {trainingSkillBucketDisplayLabel(teamBucketMomentum.mostImproved.bucket)}{" "}
                  ({teamBucketMomentum.mostImproved.count}{" "}
                  {teamBucketMomentum.mostImproved.count === 1 ? "athlete" : "athletes"})
                </Text>
              ) : null}
              {teamBucketMomentum.needsAttention ? (
                <Text style={styles.teamFocusMomentum}>
                  Needs attention:{" "}
                  {trainingSkillBucketDisplayLabel(teamBucketMomentum.needsAttention.bucket)}{" "}
                  ({teamBucketMomentum.needsAttention.count}{" "}
                  {teamBucketMomentum.needsAttention.count === 1 ? "athlete" : "athletes"})
                </Text>
              ) : null}

              {classFocusSentence ? (
                <View style={styles.classFocusBlock}>
                  <Text style={styles.classFocusSectionTitle}>Suggested class focus</Text>
                  <Text style={styles.classFocusSentence}>{classFocusSentence}</Text>
                  {classFocusDrillBullets.map((line) => (
                    <Text key={line} style={styles.classFocusBullet}>
                      • {line}
                    </Text>
                  ))}
                  <Pressable
                    onPress={onUseForClass}
                    accessibilityRole="button"
                    accessibilityLabel="Copy class focus and drills to clipboard"
                    style={({ pressed }) => [
                      styles.classFocusCopyButton,
                      pressed ? styles.classFocusCopyButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.classFocusCopyButtonText}>Use this for class</Text>
                  </Pressable>
                  {classPlanCopied ? (
                    <Text style={styles.classFocusCopiedHint}>Copied to clipboard</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {loading ? <Text style={styles.loadingText}>Loading athletes…</Text> : null}

        <Group title="Needs Attention" level="high" rows={high} />
        <Group title="Monitor" level="medium" rows={medium} />
        <Group title="On Track" level="low" rows={low} />
      </ScrollView>

      <Modal
        visible={Boolean(drillBucket)}
        transparent
        animationType="fade"
        onRequestClose={() => setDrillBucket(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close roster focus list"
            style={styles.modalBackdrop}
            onPress={() => setDrillBucket(null)}
          />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {drillBucket
                ? `${trainingSkillBucketDisplayLabel(drillBucket)} · ${drillAthletes.length} athletes`
                : ""}
            </Text>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {drillAthletes.map((row) => (
                <Pressable
                  key={row.athlete.id}
                  onPress={() => {
                    const id = row.athlete.id.trim();
                    setDrillBucket(null);
                    if (id) router.push(`/coach/kid/${id}`);
                  }}
                  style={({ pressed }) => [
                    styles.modalRow,
                    pressed ? styles.modalRowPressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open athlete ${row.athlete.name}`}
                >
                  <Text style={styles.modalRowName}>{row.athlete.name.trim() || "Athlete"}</Text>
                  {row.usedCoachFocusOverride ? (
                    <Text style={styles.modalRowMeta}>Coach focus</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setDrillBucket(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.modalDismiss}
            >
              <Text style={styles.modalDismissText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: UI.screenBg,
  },
  screen: {
    flex: 1,
    backgroundColor: UI.screenBg,
  },
  content: {
    gap: 22,
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  title: {
    color: UI.textPrimary,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 35,
  },
  subtitle: {
    color: UI.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  rosterButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: UI.accent,
    borderRadius: 10,
    marginTop: 8,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rosterButtonPressed: {
    opacity: 0.82,
  },
  rosterButtonText: {
    color: "#10140b",
    fontSize: 15,
    fontWeight: "900",
  },
  snapshot: {
    backgroundColor: UI.bgCardElevated,
    borderColor: UI.borderSubtle,
    borderRadius: 8,
    borderWidth: 1,
    padding: 17,
  },
  snapshotTitle: {
    color: UI.textPrimary,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0.1,
    marginBottom: 16,
  },
  snapshotRows: {
    gap: 10,
  },
  snapshotRow: {
    alignItems: "center",
    backgroundColor: UI.fieldBgQuiet,
    borderColor: UI.borderSubtle,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  snapshotValue: {
    color: UI.accent,
    fontSize: 20,
    fontWeight: "900",
    minWidth: 28,
    textAlign: "right",
  },
  snapshotText: {
    color: UI.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  teamFocusHint: {
    color: UI.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.86,
  },
  teamFocusBuckets: {
    gap: 10,
    marginTop: 2,
  },
  teamFocusBucketRow: {
    alignItems: "center",
    backgroundColor: UI.fieldBgQuiet,
    borderColor: UI.borderSubtle,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  teamFocusBucketRowPressed: {
    opacity: 0.76,
  },
  teamFocusBucketLabel: {
    color: UI.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    paddingRight: 8,
  },
  teamFocusBucketCount: {
    color: UI.textSecondary,
    fontWeight: "700",
  },
  teamFocusChevron: {
    color: UI.textSecondary,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
    opacity: 0.82,
    paddingBottom: 1,
  },
  teamFocusTrend: {
    color: UI.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 6,
    opacity: 0.9,
  },
  teamFocusMomentum: {
    color: UI.accent,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 4,
    opacity: 0.9,
  },
  classFocusBlock: {
    backgroundColor: UI.accentSoft,
    borderColor: "rgba(199, 243, 107, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    borderTopColor: "rgba(199, 243, 107, 0.22)",
    borderTopWidth: 1,
    gap: 8,
    marginTop: 14,
    padding: 14,
  },
  classFocusSectionTitle: {
    color: UI.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  classFocusSentence: {
    color: UI.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
  },
  classFocusBullet: {
    color: UI.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    opacity: 0.92,
    paddingLeft: 4,
  },
  classFocusCopyButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: UI.accent,
    borderColor: UI.accent,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  classFocusCopyButtonPressed: {
    opacity: 0.78,
  },
  classFocusCopyButtonText: {
    color: "#10140b",
    fontSize: 14,
    fontWeight: "900",
  },
  classFocusCopiedHint: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.85,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalSheet: {
    alignSelf: "stretch",
    backgroundColor: UI.bgCardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.borderSubtle,
    maxHeight: "72%",
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  modalTitle: {
    color: UI.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  modalList: {
    flexGrow: 0,
    maxHeight: 360,
  },
  modalRow: {
    backgroundColor: UI.fieldBgQuiet,
    borderColor: UI.borderSubtle,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalRowPressed: {
    opacity: 0.8,
  },
  modalRowName: {
    color: UI.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  modalRowMeta: {
    color: UI.accent,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    opacity: 0.92,
  },
  modalDismiss: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    minHeight: 44,
    paddingVertical: 6,
  },
  modalDismissText: {
    color: UI.accent,
    fontSize: 15,
    fontWeight: "900",
  },
  loadingText: {
    color: UI.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  group: {
    backgroundColor: UI.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    padding: 17,
  },
  groupHigh: {
    borderColor: "rgba(252, 165, 165, 0.42)",
    backgroundColor: "#1b1d20",
  },
  groupMedium: {
    borderColor: UI.borderSubtle,
  },
  groupLow: {
    borderColor: "rgba(199, 243, 107, 0.26)",
  },
  groupHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 13,
  },
  groupTitle: {
    color: UI.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.1,
  },
  cardStack: {
    gap: 8,
  },
  athleteCard: {
    backgroundColor: UI.fieldBgQuiet,
    borderColor: UI.borderSubtle,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 68,
    padding: 13,
  },
  athleteCardPressed: {
    opacity: 0.76,
  },
  athleteMain: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: UI.bgCardElevated,
    borderColor: UI.borderSubtle,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    marginTop: 1,
    width: 38,
  },
  avatarText: {
    color: UI.textPrimary,
    fontSize: 13,
    fontWeight: "900",
  },
  athleteContent: {
    flex: 1,
    minWidth: 0,
  },
  athleteName: {
    color: UI.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20,
    marginBottom: 5,
  },
  focusLine: {
    color: UI.textSecondary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
  metrics: {
    gap: 3,
    marginTop: 8,
  },
  metricLine: {
    color: UI.textFaint,
    fontSize: 13,
    lineHeight: 18,
  },
  reason: {
    color: UI.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    opacity: 0.84,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardBadge: {
    marginTop: 2,
  },
  badgeHigh: {
    borderColor: "rgba(251, 191, 36, 0.32)",
    color: "#f3c77a",
  },
  badgeMedium: {
    borderColor: "rgba(251, 191, 36, 0.2)",
    color: "#c8b895",
    opacity: 0.78,
  },
  badgeLow: {
    borderColor: "rgba(199, 243, 107, 0.28)",
    color: UI.accent,
    opacity: 0.82,
  },
});
