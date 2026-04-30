import { StyleSheet, Text, View } from "react-native";

type SeedAction = {
  title: string;
  detail: string;
  accent: "yellow" | "green" | "blue";
};

type DataSeedCardProps = {
  actions: SeedAction[];
};

const accentColors = {
  yellow: "#FACC15",
  green: "#34D399",
  blue: "#60A5FA",
};

export default function DataSeedCard({ actions }: DataSeedCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.kicker}>Optional Boost</Text>
        <Text style={styles.title}>Seed Your System</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.copy}>Jumpstart your metrics now, or skip and let your logs reveal the pattern.</Text>

        <View style={styles.actions}>
          {actions.map((action) => (
            <View key={action.title} style={styles.action}>
              <View style={[styles.actionIcon, { borderColor: accentColors[action.accent] }]}>
                <View style={[styles.actionIconCore, { backgroundColor: accentColors[action.accent] }]} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDetail}>{action.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  kicker: {
    color: "#FACC15",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  title: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 2,
  },
  card: {
    backgroundColor: "#12161C",
    borderColor: "#1F2937",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  copy: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    marginBottom: 14,
  },
  actions: {
    gap: 10,
  },
  action: {
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderColor: "#374151",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 2,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  actionIconCore: {
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900",
  },
  actionDetail: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 3,
  },
});
