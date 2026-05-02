import { StyleSheet, Text, View } from "react-native";

type Technique = {
  key: string;
  label: string;
  count: number;
};

type SummaryPatternsProps = {
  topSystem: string | null;
  topTechnique: string | null;
  topTechniques: Technique[];
};

export default function SummaryPatternsCard(props: SummaryPatternsProps) {
  const { topSystem, topTechnique, topTechniques } = props;
  const primaryTechnique = topTechniques[0] || null;
  const topTechniqueLabel = topTechnique || primaryTechnique?.label || null;
  const focus14Day = primaryTechnique?.label || null;

  const formatLabel = (value?: string) => {
    if (!value) return "None";

    return value
      .split(".")
      .slice(-1)[0]
      .replace(/_/g, " ");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Patterns</Text>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Top System</Text>
          {topSystem ? (
            <Text style={styles.itemValue}>{formatLabel(topSystem)}</Text>
          ) : (
            <Text style={styles.itemValue}>Start logging</Text>
          )}
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Top Technique</Text>
          {topTechniqueLabel ? (
            <Text style={styles.itemValue}>{formatLabel(topTechniqueLabel)}</Text>
          ) : (
            <Text style={styles.itemValue}>Start logging</Text>
          )}
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>14-Day Focus</Text>
          <Text style={styles.itemValue}>
            {focus14Day ? formatLabel(focus14Day) : "No trend yet"}
          </Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.itemLabel}>Gi vs No-Gi</Text>
          <Text style={styles.itemValue}>—</Text>
        </View>
      </View>

      <Text style={styles.note}>Derived from your training logs</Text>
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
  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12,
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
    fontSize: 20,
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
