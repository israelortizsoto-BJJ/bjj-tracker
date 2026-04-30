import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type AthleteOption = {
  key: string;
  label: string;
};

type Props = {
  athletes: AthleteOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

export default function AthleteSwitcher({ athletes, selectedKey, onSelect }: Props) {
  return (
    <View>
      <Text style={styles.sectionLabel}>ATHLETE</Text>
      <View style={styles.row}>
      {athletes.map((a) => {
        const selected = a.key === selectedKey;
        return (
          <Pressable
            key={a.key}
            onPress={() => onSelect(a.key)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
              {a.label}
            </Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  chipSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#FACC15",
  },
  chipText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  chipTextSelected: {
    color: "#fff",
  },
});
