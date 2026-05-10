import { StyleSheet, Text, View } from "react-native";

import type { SummaryViewModel } from "@/src/lib/summary/buildSummaryViewModel";

export type SummaryV2CardProps = {
  viewModel: SummaryViewModel;
};

function Section({
  label,
  value,
}: {
  label: "Focus" | "Action" | "Progress" | "Why";
  value: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

export default function SummaryV2Card({ viewModel }: SummaryV2CardProps) {
  return (
    <View style={styles.card}>
      <Section label="Focus" value={viewModel.focus} />
      <View style={styles.divider} />
      <Section label="Action" value={viewModel.action} />
      <View style={styles.divider} />
      <Section label="Progress" value={viewModel.progress} />
      <View style={styles.divider} />
      <Section label="Why" value={viewModel.why} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#171b20",
    borderColor: "#26303a",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
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
  body: {
    color: "#e5e7eb",
    fontSize: 16,
    lineHeight: 22,
  },
  divider: {
    backgroundColor: "#26303a",
    height: 1,
    marginVertical: 14,
  },
});
