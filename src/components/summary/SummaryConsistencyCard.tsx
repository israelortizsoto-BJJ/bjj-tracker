import { StyleSheet, Text, View } from "react-native";

type SummaryConsistencyProps = {
  weeklySessionCount: number;
  streak: number;
};

export default function SummaryConsistencyCard(props: SummaryConsistencyProps) {
  const { weeklySessionCount, streak } = props;
  const WEEKLY_GOAL = 3;
  const progressLabel = `${weeklySessionCount}/${WEEKLY_GOAL}`;
  const streakLabel = `${streak} week${streak === 1 ? "" : "s"} streak`;
  const goalStatus =
    weeklySessionCount >= WEEKLY_GOAL
      ? "Goal met"
      : `${WEEKLY_GOAL - weeklySessionCount} session${
          WEEKLY_GOAL - weeklySessionCount === 1 ? "" : "s"
        } to goal`;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Consistency</Text>
        <View style={styles.goalTag}>
          <Text style={styles.goalTagText}>Goal 3+</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.metricBox, styles.primaryMetricBox]}>
          <Text style={styles.itemValue}>{progressLabel}</Text>
          <Text style={styles.itemLabel}>Weekly Goal</Text>
          <Text style={styles.itemSubtext}>{goalStatus}</Text>
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.secondaryValue}>{streakLabel}</Text>
          <Text style={styles.itemLabel}>Streak</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#171b20",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#26303a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  goalTag: {
    backgroundColor: "#20252b",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#28313c",
  },
  goalTagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  metricBox: {
    width: "48%",
    backgroundColor: "#20252b",
    borderRadius: 6,
    padding: 14,
    minHeight: 92,
    borderWidth: 1,
    borderColor: "#28313c",
    justifyContent: "center",
  },
  primaryMetricBox: {
    borderColor: "#28313c",
  },
  itemLabel: {
    color: "#c7cbd1",
    fontSize: 12,
    marginBottom: 8,
    fontWeight: "700",
  },
  itemValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  itemSubtext: {
    color: "#c7f36b",
    fontSize: 13,
  },
  secondaryValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
});
