import { StyleSheet, Text, View } from "react-native";

type Technique = {
  key: string;
  label: string;
  count: number;
};

type SummaryWeekProps = {
  weeklySessionCount: number;
  topTechniques: Technique[];
};

export default function SummaryWeekCard(props: SummaryWeekProps) {
  const { weeklySessionCount, topTechniques } = props;
  const focusPrimary = topTechniques[0] || null;
  const focusSecondary = topTechniques[1] || null;
  const hasSessions = weeklySessionCount > 0;
  const isRich = weeklySessionCount >= 3;

  const formatLabel = (value: string) => {
    return value
      .split(".")
      .slice(-1)[0]
      .replace(/_/g, " ");
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>This Week</Text>
        <Text style={styles.meta}>
          {hasSessions ? `${weeklySessionCount} active` : "No activity"}
        </Text>
      </View>

      {!hasSessions ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No training yet</Text>
          <Text style={styles.emptyText}>Saved sessions will appear here.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemValue}>{weeklySessionCount}</Text>
            <Text style={styles.itemLabel}>Sessions this week</Text>
            <Text style={styles.itemSubtext}>
              {isRich ? "Goal pace is active" : "Early signal"}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Focus 1</Text>
            {focusPrimary ? (
              <>
                <Text style={styles.itemValue}>{formatLabel(focusPrimary.label)}</Text>
                <Text style={styles.itemSubtext}>{focusPrimary.count} logged</Text>
              </>
            ) : (
              <Text style={styles.itemSubtext}>No focus logged yet</Text>
            )}
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Focus 2</Text>
            {focusSecondary ? (
              <>
                <Text style={styles.itemValue}>{formatLabel(focusSecondary.label)}</Text>
                <Text style={styles.itemSubtext}>{focusSecondary.count} logged</Text>
              </>
            ) : (
              <Text style={styles.itemSubtext}>
                {isRich ? "No secondary focus yet" : "Needs more sessions"}
              </Text>
            )}
          </View>
        </View>
      )}

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
  meta: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridItem: {
    width: "48%",
    backgroundColor: "#20252b",
    borderRadius: 6,
    padding: 14,
    minHeight: 88,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#28313c",
    justifyContent: "center",
  },
  emptyState: {
    backgroundColor: "#20252b",
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: "#28313c",
  },
  emptyTitle: {
    color: "#d1d5db",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 18,
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
    color: "#9ca3af",
    fontSize: 14,
  },
});
