import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const ICON_INSIGHT = require("../../../../assets/icons/insight.png");

type Props = {
  recordLabel: string;
  statWinRate: string;
  statSubmissionRate: string;
  statFastestSub: string;
  latestSummary: string;
  latestDateLine: string;
  insightText: string;
};

export default function CompetitionCard({
  recordLabel,
  statWinRate,
  statSubmissionRate,
  statFastestSub,
  latestSummary,
  latestDateLine,
  insightText,
}: Props) {
  const showLatest = Boolean(latestSummary.trim() || latestDateLine.trim());

  return (
    <View style={styles.shell}>
      <View style={styles.card}>
      <Text style={styles.sectionHeader}>COMPETITION SNAPSHOT</Text>
      {showLatest ? (
        <View style={styles.latestBlock}>
          {latestSummary.trim() ? (
            <Text style={styles.latestSummary} numberOfLines={2}>
              {latestSummary}
            </Text>
          ) : null}
          {latestDateLine.trim() ? (
            <Text style={styles.latestDate}>{latestDateLine}</Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.record}>{recordLabel || "—"}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{statWinRate || "—"}</Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{statSubmissionRate || "—"}</Text>
          <Text style={styles.statLabel}>Sub Rate</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{statFastestSub || "—"}</Text>
          <Text style={styles.statLabel}>Fastest Sub</Text>
        </View>
      </View>

      <View style={styles.insightWrap}>
        <View style={styles.insightHeader}>
          <Image source={ICON_INSIGHT} style={styles.insightIcon} resizeMode="contain" />
          <Text style={styles.insightLabel}>INSIGHT</Text>
        </View>
        <Text style={styles.insightText}>{insightText}</Text>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.26)",
  },
  sectionHeader: {
    color: "#93C5FD",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  latestBlock: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  latestSummary: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 4,
  },
  latestDate: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  record: {
    color: "#F8FAFC",
    fontSize: 46,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 52,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: "#E2E8F0",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 3,
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
    minHeight: 40,
    backgroundColor: "rgba(148, 163, 184, 0.35)",
  },
  insightWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    backgroundColor: "rgba(2, 132, 199, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  insightIcon: {
    width: 14,
    height: 14,
    tintColor: "#7DD3FC",
    marginRight: 6,
  },
  insightLabel: {
    color: "#7DD3FC",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  insightText: {
    color: "#DBEAFE",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
});
