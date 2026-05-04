import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { CoachInsightRow } from "./useCoachInsights";
import { useCoachInsights } from "./useCoachInsights";

const UI = {
  screenBg: "#0b0f12",
  bgCard: "#171b20",
  border: "#26303a",
  fieldBg: "#20252b",
  textPrimary: "#ffffff",
  textSecondary: "#9ca3af",
  accent: "#c7f36b",
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

function attentionLabel(level: AttentionLevel): string {
  return level.toUpperCase();
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
  const { athlete, insight } = row;
  const level = insight.attentionLevel;

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
  const { loading, insights } = useCoachInsights();

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

        {loading ? <Text style={styles.loadingText}>Loading athletes…</Text> : null}

        <Group title="Needs Attention" level="high" rows={high} />
        <Group title="Monitor" level="medium" rows={medium} />
        <Group title="On Track" level="low" rows={low} />
      </ScrollView>
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
    gap: 24,
    padding: 16,
    paddingBottom: 36,
  },
  snapshot: {
    backgroundColor: UI.bgCard,
    borderColor: UI.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  snapshotTitle: {
    color: UI.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  snapshotRows: {
    gap: 9,
  },
  snapshotRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  snapshotValue: {
    color: UI.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    minWidth: 22,
    textAlign: "right",
  },
  snapshotText: {
    color: UI.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.86,
  },
  loadingText: {
    color: UI.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  group: {
    backgroundColor: UI.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  groupHigh: {
    borderColor: "rgba(252, 165, 165, 0.38)",
  },
  groupMedium: {
    borderColor: UI.border,
  },
  groupLow: {
    borderColor: "rgba(199, 243, 107, 0.38)",
  },
  groupHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 13,
  },
  groupTitle: {
    color: UI.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  cardStack: {
    gap: 12,
  },
  athleteCard: {
    backgroundColor: UI.fieldBg,
    borderColor: UI.border,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 72,
    padding: 16,
  },
  athleteCardPressed: {
    opacity: 0.76,
  },
  athleteMain: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#111820",
    borderColor: UI.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    marginTop: 1,
    width: 40,
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
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 21,
    marginBottom: 7,
  },
  focusLine: {
    color: UI.textSecondary,
    fontSize: 13,
    lineHeight: 17,
  },
  metrics: {
    gap: 4,
    marginTop: 8,
  },
  metricLine: {
    color: UI.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.88,
  },
  reason: {
    color: UI.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
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
    borderColor: "rgba(252, 165, 165, 0.45)",
    color: UI.danger,
  },
  badgeMedium: {
    borderColor: UI.border,
    color: UI.textSecondary,
    opacity: 0.72,
  },
  badgeLow: {
    borderColor: "rgba(199, 243, 107, 0.34)",
    color: UI.accent,
    opacity: 0.86,
  },
});
