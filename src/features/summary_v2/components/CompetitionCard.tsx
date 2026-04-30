import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  recordLabel: string;
  statWinRate: string;
  statSubmissionRate: string;
  statFastestSub: string;
};

export default function CompetitionCard({
  recordLabel,
  statWinRate,
  statSubmissionRate,
  statFastestSub,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionHeader}>Competition Performance</Text>
      <View style={styles.headerDivider} />

      <Text style={styles.record}>{recordLabel}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{statWinRate}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{statSubmissionRate}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{statFastestSub}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginTop: 12,
    marginBottom: 32,
  },
  sectionHeader: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "none",
    marginBottom: 10,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#334155",
    marginBottom: 14,
  },
  record: {
    color: "#F8FAFC",
    fontSize: 40,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "700",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    minHeight: 32,
    backgroundColor: "#475569",
  },
});
