import { StyleSheet, Text, View } from "react-native";

type SummaryHeroProps = {
  alignment: number;
  confidence: number;
  hasData: boolean;
  topSystem: string | null;
  topTechnique: string | null;
};

export default function SummaryHeroCard({
  alignment,
  confidence,
  hasData,
  topSystem,
  topTechnique,
}: SummaryHeroProps) {
  const focus = topSystem || topTechnique;
  const isAllFocus = focus?.toLowerCase() === "all";
  const identityLabel = focus ? (isAllFocus ? "Well-Rounded" : topSystem || "Technique") : null;
  const focusLabel = isAllFocus ? "multiple positions" : focus;
  const headline = hasData ? "A mirror of the athlete" : "No athlete data yet";
  const identity = focus
    ? `${identityLabel} Competitor`
    : hasData
      ? "Game profile forming"
      : "Identity will build here";
  const insight = focus
    ? `You win when you control ${focusLabel}`
    : hasData
      ? "Training patterns have not emerged yet"
      : "Log sessions or competitions to start seeing patterns";

  return (
    <View style={[styles.container, !hasData ? styles.emptyContainer : null]}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Identity</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={[styles.headline, !hasData ? styles.mutedHeadline : null]}>
            {headline}
          </Text>
          <Text style={[styles.identity, !hasData ? styles.emptyIdentity : null]}>
            {identity}
          </Text>
          <Text style={styles.subtext}>
            {hasData
              ? "Built from your training and competition."
              : "This view stays quiet until real activity exists."}
          </Text>
          <Text style={styles.insight}>
            {insight}
          </Text>
          <Text style={styles.explanation}>
            Confidence reflects alignment between your training behavior, competition
            results, and coaching input.
          </Text>
        </View>
        <View style={styles.right}>
          <View style={[styles.alignmentContainer, !hasData ? styles.emptyAlignment : null]}>
            <Text style={[styles.alignmentValue, !hasData ? styles.emptyAlignmentValue : null]}>
              {hasData ? `${alignment}%` : "—"}
            </Text>
            <Text style={styles.alignmentLabel}>{hasData ? "Aligned" : "No data"}</Text>
          </View>
          <Text style={styles.confidence}>
            {hasData ? `Confidence: ${confidence}%` : "Confidence builds with activity"}
          </Text>
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
  emptyContainer: {
    borderColor: "#20252b",
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
  mutedHeadline: {
    color: "#c7cbd1",
  },
  identity: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 29,
    marginBottom: 7,
  },
  emptyIdentity: {
    color: "#d1d5db",
    fontSize: 22,
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
  emptyAlignment: {
    borderColor: "#28313c",
  },
  alignmentValue: {
    color: "#c7f36b",
    fontSize: 23,
    fontWeight: "800",
  },
  emptyAlignmentValue: {
    color: "#9ca3af",
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
