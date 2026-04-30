import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type IdentityInputs = {
  experience: string;
  competition: string;
  role: string;
  intent: string;
};

type Props = {
  values: IdentityInputs;
  onChange: (field: keyof IdentityInputs, value: string) => void;
};

type OptionRow = {
  key: keyof IdentityInputs;
  label: string;
  options: readonly { value: string; label: string }[];
};

const GROUPS: OptionRow[] = [
  {
    key: "experience",
    label: "Experience",
    options: [
      { value: "new_to_bjj", label: "New to BJJ" },
      { value: "trained_before", label: "Trained before" },
      { value: "1_2_years", label: "1–2 years" },
      { value: "3_plus_years", label: "3+ years" },
    ],
  },
  {
    key: "competition",
    label: "Competition",
    options: [
      { value: "never_competed", label: "Never competed" },
      { value: "competed_before", label: "Competed before" },
      { value: "active_competitor", label: "Active competitor" },
    ],
  },
  {
    key: "role",
    label: "Role",
    options: [
      { value: "athlete", label: "Athlete" },
      { value: "parent", label: "Parent" },
      { value: "coach", label: "Coach" },
    ],
  },
  {
    key: "intent",
    label: "Intent",
    options: [
      { value: "learn_basics", label: "Learn basics" },
      { value: "stay_consistent", label: "Stay consistent" },
      { value: "improve_skill", label: "Improve skill" },
      { value: "compete_to_win", label: "Compete to win" },
    ],
  },
];

export default function IdentityBuilderSection({ values, onChange }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Identity Builder</Text>
      <Text style={styles.sectionSubtitle}>Choose one option per group.</Text>
      <View style={styles.groupStack}>
        {GROUPS.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={styles.label}>{group.label}</Text>
            <View style={styles.tileRow}>
              {group.options.map((option) => {
                const selected = values[group.key] === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => onChange(group.key, option.value)}
                    style={[styles.tile, selected && styles.tileSelected]}
                  >
                    <Text style={[styles.tileText, selected && styles.tileTextSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#12161C",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 19,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  groupStack: {
    gap: 12,
    marginTop: 4,
  },
  group: {
    gap: 8,
  },
  label: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tileRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tile: {
    backgroundColor: "#0F141B",
    borderColor: "#1F2937",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tileSelected: {
    borderColor: "#60A5FA",
    backgroundColor: "#172033",
  },
  tileText: {
    color: "#D1D5DB",
    fontWeight: "700",
    fontSize: 13,
  },
  tileTextSelected: {
    color: "#DBEAFE",
  },
});
