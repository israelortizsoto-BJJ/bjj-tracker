import { View, Text, StyleSheet } from "react-native";
import Icon from "src/components/Icon";

export default function CompetitionPerformanceCard() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="competition" size={20} />
        <Text style={styles.title}>Competition Performance</Text>
      </View>

      <Text style={styles.record}>6-2</Text>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>75%</Text>
        <Text style={styles.stat}>32%</Text>
        <Text style={styles.stat}>0:42</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  title: {
    color: "#93C5FD",
    fontSize: 16,
    fontWeight: "600",
  },
  record: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  stat: {
    color: "#FFFFFF",
    fontSize: 16,
  },
});
