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
        <Text style={styles.meta}>7-14 days</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.itemValue}>{weeklySessionCount}</Text>
          <Text style={styles.itemLabel}>Sessions</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Focus 1</Text>
          {focusPrimary ? (
            <Text style={styles.itemValue}>{formatLabel(focusPrimary.label)}</Text>
          ) : (
            <Text style={styles.itemValue}>Start logging</Text>
          )}
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Focus 2</Text>
          <Text style={styles.itemValue}>
            {focusSecondary ? formatLabel(focusSecondary.label) : "Start logging"}
          </Text>
        </View>
      </View>

      <View style={styles.systemBanner}>
        <Text style={styles.systemBannerText}>
          Updated after Session Builder Save → local Training Data → processing.
        </Text>
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
  systemBanner: {
    backgroundColor: "#252f18",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#465623",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
  },
  systemBannerText: {
    color: "#d8ff75",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
});
