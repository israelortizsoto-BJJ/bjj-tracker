import { StyleSheet, Text, View } from "react-native";

import type { SummaryViewModel } from "@/src/lib/summary/buildSummaryViewModel";

export type SummaryV2CardProps = {
  viewModel: SummaryViewModel;
  /** Weekly coach mission present — subtle semantic lift for focus / progress lane. */
  weeklyCoachActive?: boolean;
};

function Section({
  label,
  value,
  emphasized,
  labelAccent,
}: {
  label: "Focus" | "Action" | "Progress" | "Why" | "Coach direction";
  value: string;
  emphasized?: boolean;
  labelAccent?: "focus" | "progress" | "default";
}) {
  const labelStyle =
    labelAccent === "focus"
      ? [styles.label, styles.labelFocus]
      : labelAccent === "progress"
        ? [styles.label, styles.labelProgress]
        : [styles.label, emphasized ? styles.labelFocus : null];
  return (
    <View style={styles.section}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={[styles.body, emphasized ? styles.bodyFocus : null]}>{value}</Text>
    </View>
  );
}

export default function SummaryV2Card({ viewModel, weeklyCoachActive }: SummaryV2CardProps) {
  const actionLabel: "Action" | "Coach direction" = weeklyCoachActive ? "Coach direction" : "Action";
  return (
    <View style={[styles.card, weeklyCoachActive ? styles.cardCoachActive : null]}>
      <Section
        label="Focus"
        value={viewModel.focus}
        emphasized
        labelAccent="focus"
      />
      <View style={styles.divider} />
      <Section label={actionLabel} value={viewModel.action} />
      <View style={styles.divider} />
      <Section label="Progress" value={viewModel.progress} labelAccent="progress" />
      <View style={styles.divider} />
      <Section label="Why" value={viewModel.why} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#171b20",
    borderColor: "rgba(236, 241, 245, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  cardCoachActive: {
    borderColor: "rgba(214, 255, 63, 0.34)",
    backgroundColor: "#171b20",
  },
  section: {
    gap: 6,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  labelFocus: {
    color: "#d6ff3f",
  },
  labelProgress: {
    color: "#94a3b8",
  },
  body: {
    color: "#e5e7eb",
    fontSize: 16,
    lineHeight: 22,
  },
  bodyFocus: {
    color: "#f9fafb",
    fontWeight: "700",
  },
  divider: {
    backgroundColor: "#26303a",
    height: 1,
    marginVertical: 14,
  },
});
