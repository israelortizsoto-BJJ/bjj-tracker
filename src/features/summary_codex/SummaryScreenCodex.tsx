import { View, Text, ScrollView, StyleSheet } from "react-native";

import Icon from "src/components/Icon";
import type { IconName } from "src/components/Icon";

function getIconName(label: string): IconName | null {
  switch (label) {
    case "Training Sessions":
      return "training-sessions";
    case "Top System":
      return "top-system";
    case "Top Technique":
      return "top-technique";
    case "14-Day Focus":
      return "14-day-focus";
    case "Gi vs No-Gi":
      return "gi-vs-nogi";
    default:
      return null;
  }
}

export default function SummaryScreenCodex() {
  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <Text style={styles.title}>Summary</Text>

      {/* HERO */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Pressure Passing Competitor</Text>
        <Text style={styles.heroScore}>72</Text>
      </View>

      {/* SYSTEM DASHBOARD */}
      <Text style={styles.section}>System Dashboard</Text>

      <View style={styles.grid}>
        {[
          ["48", "Training Sessions"],
          ["Half Guard", "Top System"],
          ["Armbar", "Top Technique"],
          ["Passing", "14-Day Focus"],
          ["62% Gi", "Gi vs No-Gi"],
        ].map(([value, label], i) => {
          const resolvedIcon = getIconName(label);
          return (
          <View key={i} style={styles.tile}>
            
            {/* ICON SLOT (strict label → icon mapping) */}
            {resolvedIcon ? (
              <View style={styles.iconSlot}>
                <Icon name={resolvedIcon} size={20} />
              </View>
            ) : (
              <View style={styles.iconBox} />
            )}

            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
          );
        })}
      </View>

      {/* COMPETITION */}
      <Text style={styles.section}>Competition</Text>

      <View style={styles.comp}>
        <Text style={styles.record}>6–2</Text>
        <View style={styles.compRow}>
          <Text style={styles.compStat}>75%</Text>
          <Text style={styles.compStat}>32%</Text>
          <Text style={styles.compStat}>0:42</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 16,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },

  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },

  heroTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },

  heroScore: {
    color: "#22c55e",
    fontSize: 24,
    marginTop: 8,
  },

  section: {
    color: "#94a3b8",
    fontSize: 16,
    marginBottom: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  tile: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  iconSlot: {
    marginBottom: 12,
  },

  iconBox: {
    width: 28,
    height: 28,
    backgroundColor: "#1e293b",
    borderRadius: 6,
    marginBottom: 12,
  },

  value: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  label: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 6,
  },

  comp: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 20,
  },

  record: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },

  compRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  compStat: {
    color: "#94a3b8",
    fontSize: 14,
  },
});
