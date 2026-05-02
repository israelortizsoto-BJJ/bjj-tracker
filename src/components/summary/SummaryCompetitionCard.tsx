import { StyleSheet, Text, View } from "react-native";

type SummaryCompetitionProps = {
  totalMatches: number;
  winRate: number;
};

export default function SummaryCompetitionCard(props: SummaryCompetitionProps) {
  const { totalMatches, winRate } = props;
  const hasData = totalMatches > 0;
  const winRateValue = hasData ? `${winRate}%` : "—";

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Competition Snapshot</Text>
        <View style={styles.highlightBadge}>
          <Text style={styles.highlightBadgeText}>{totalMatches}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Record</Text>
          <Text style={styles.itemValue}>—</Text>
          {!hasData ? (
            <Text style={styles.itemSubtext}>Start competing to unlock insights</Text>
          ) : null}
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Win Rate</Text>
          <Text style={styles.itemValue}>{winRateValue}</Text>
          {!hasData ? (
            <Text style={styles.itemSubtext}>Start competing to unlock insights</Text>
          ) : null}
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Sub Rate</Text>
          <Text style={styles.itemValue}>—</Text>
          <Text style={styles.itemSubtext}>Not tracked yet</Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Avg Match Time</Text>
          <Text style={styles.itemValue}>—</Text>
          <Text style={styles.itemSubtext}>Not tracked yet</Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Fastest Sub</Text>
          <Text style={styles.itemValue}>—</Text>
          <Text style={styles.itemSubtext}>Not tracked yet</Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Win Style</Text>
          <Text style={styles.itemValue}>—</Text>
          <Text style={styles.itemSubtext}>Not tracked yet</Text>
        </View>
      </View>

      <Text style={styles.note}>Derived from your competition results</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#171b20",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3c3425",
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
  highlightBadge: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#d4ad4f",
    alignItems: "center",
    justifyContent: "center",
  },
  highlightBadgeText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
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
  note: {
    color: "#d8ff75",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    backgroundColor: "#252f18",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#465623",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
  },
});
