import { StyleSheet, Text, View } from "react-native";

type SummaryHeroProps = {
  alignment: number;
  confidence: number;
  topSystem: string | null;
  topTechnique: string | null;
};

export default function SummaryHeroCard({
  alignment,
  confidence,
  topSystem,
  topTechnique,
}: SummaryHeroProps) {
  const identityLabel = topSystem || "Your Game";
  const focus = topSystem || topTechnique || null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Identity</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.headline}>A mirror of the athlete</Text>
          <Text style={styles.identity}>{identityLabel} Competitor</Text>
          <Text style={styles.subtext}>Built from your training and competition.</Text>
          <Text style={styles.insight}>
            {focus
              ? `You win when you control ${focus}`
              : "Build your game through consistent training"}
          </Text>
          <Text style={styles.explanation}>
            Confidence reflects alignment between your training behavior, competition
            results, and coaching input.
          </Text>
        </View>
        <View style={styles.right}>
          <View style={styles.alignmentContainer}>
            <Text style={styles.alignmentValue}>{alignment}%</Text>
            <Text style={styles.alignmentLabel}>Aligned</Text>
          </View>
          <Text style={styles.confidence}>Confidence: {confidence}%</Text>
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
    marginBottom: 10,
  },
  sectionLabel: {
    color: "#c7cbd1",
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: {
    flex: 1,
    paddingRight: 16,
  },
  right: {
    width: 108,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 5,
  },
  identity: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 29,
    marginBottom: 7,
  },
  subtext: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 10,
  },
  insight: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 12,
  },
  explanation: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 20,
  },
  alignmentContainer: {
    backgroundColor: "#020617",
    width: 96,
    height: 96,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#c7f36b",
  },
  alignmentValue: {
    color: "#c7f36b",
    fontSize: 23,
    fontWeight: "800",
  },
  alignmentLabel: {
    color: "#9ca3af",
    fontSize: 12,
  },
  confidence: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },
});
