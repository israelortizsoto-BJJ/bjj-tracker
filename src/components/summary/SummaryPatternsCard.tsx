import { StyleSheet, Text, View } from "react-native";

type Technique = {
  key: string;
  label: string;
  count: number;
};

type SummaryPatternsProps = {
  gear: {
    giCount: number;
    nogiCount: number;
    giPercentage: number | null;
    nogiPercentage: number | null;
    total: number;
    hasLowData: boolean;
  };
  topSystem: string | null;
  topTechnique: string | null;
  topTechniques: Technique[];
};

export default function SummaryPatternsCard(props: SummaryPatternsProps) {
  const { gear, topSystem, topTechnique, topTechniques } = props;
  const primaryTechnique = topTechniques[0] || null;
  const topTechniqueLabel = topTechnique || primaryTechnique?.label || null;
  const focus14Day = primaryTechnique?.label || null;
  const techniqueLogCount = topTechniques.reduce((total, technique) => {
    return total + technique.count;
  }, 0);
  const hasPattern = Boolean(topSystem || topTechniqueLabel || focus14Day || gear.total > 0);
  const isRich = techniqueLogCount >= 3;

  const formatLabel = (value?: string) => {
    if (!value) return "No pattern yet";

    const formatted = value
      .split(".")
      .slice(-1)[0]
      .replace(/_/g, " ");

    return formatted.toLowerCase() === "all" ? "All Positions" : formatted;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Patterns</Text>

      {!hasPattern ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No pattern yet</Text>
          <Text style={styles.emptyText}>Technique and system signals appear after saved logs.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Primary System</Text>
            {topSystem ? (
              <>
                <Text style={styles.itemValue}>{formatLabel(topSystem)}</Text>
                <Text style={styles.itemSubtext}>Most repeated system</Text>
              </>
            ) : (
              <Text style={styles.itemSubtext}>No system pattern yet</Text>
            )}
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Top Technique</Text>
            {topTechniqueLabel ? (
              <>
                <Text style={styles.itemValue}>{formatLabel(topTechniqueLabel)}</Text>
                <Text style={styles.itemSubtext}>
                  {primaryTechnique ? `${primaryTechnique.count} logged` : "Technique signal"}
                </Text>
              </>
            ) : (
              <Text style={styles.itemSubtext}>No technique pattern yet</Text>
            )}
          </View>

          <View style={[styles.gridItem, styles.focusGridItem]}>
            <Text style={styles.itemLabel}>14-Day Focus</Text>
            {focus14Day ? (
              <>
                <Text
                  style={styles.focusValue}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {formatLabel(focus14Day)}
                </Text>
                <Text style={styles.itemSubtext}>
                  {isRich ? "Clear repeat signal" : "Early focus signal"}
                </Text>
              </>
            ) : (
              <Text style={styles.itemSubtext}>No trend yet</Text>
            )}
          </View>

          <View style={styles.gridItem}>
            <Text style={styles.itemLabel}>Gi vs No-Gi</Text>
            {gear.total === 0 ? (
              <Text style={styles.itemSubtext}>No gear data yet</Text>
            ) : gear.hasLowData ? (
              <>
                <Text style={styles.itemValue}>Gi ({gear.giCount})</Text>
                <Text style={styles.itemValue}>No-Gi ({gear.nogiCount})</Text>
                <Text style={styles.itemSubtext}>More sessions needed for percentages</Text>
              </>
            ) : (
              <>
                <Text style={styles.gearValue}>Gi {gear.giPercentage}%</Text>
                <Text style={styles.gearValue}>No-Gi {gear.nogiPercentage}%</Text>
                <Text style={styles.itemSubtext}>
                  {gear.giCount} Gi • {gear.nogiCount} No-Gi
                </Text>
              </>
            )}
          </View>
        </View>
      )}

      {hasPattern ? (
        <Text style={styles.note}>
          Based on {gear.total} session
          {gear.total === 1 ? "" : "s"}.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#171b20",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(236, 241, 245, 0.12)",
  },
  title: {
    color: "#f9fafb",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridItem: {
    width: "48%",
    backgroundColor: "#181b1f",
    borderRadius: 6,
    padding: 16,
    minHeight: 104,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(236, 241, 245, 0.1)",
    justifyContent: "center",
  },
  focusGridItem: {
    minHeight: 116,
    borderColor: "rgba(236, 241, 245, 0.16)",
    padding: 18,
  },
  emptyState: {
    backgroundColor: "#181b1f",
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(236, 241, 245, 0.1)",
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
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  focusValue: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "800",
    marginBottom: 6,
  },
  gearValue: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 8,
  },
  itemSubtext: {
    color: "#9ca3af",
    fontSize: 14,
  },
  note: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 0,
  },
});
