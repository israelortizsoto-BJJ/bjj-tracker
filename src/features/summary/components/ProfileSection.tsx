import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

type ProfileValues = {
  belt: string;
  promotionDate: string;
  stripes: string;
  weight: string;
  academy: string;
  professor: string;
};

type Props = {
  values: ProfileValues;
  onChange: (field: keyof ProfileValues, value: string) => void;
};

type FieldConfig = {
  key: keyof ProfileValues;
  label: string;
  placeholder: string;
};

const FIELDS: FieldConfig[] = [
  { key: "belt", label: "Belt", placeholder: "Blue" },
  { key: "promotionDate", label: "Promotion Date", placeholder: "YYYY-MM-DD" },
  { key: "stripes", label: "Stripes", placeholder: "2" },
  { key: "weight", label: "Weight", placeholder: "175 lb" },
  { key: "academy", label: "Academy", placeholder: "Team Name" },
  { key: "professor", label: "Professor", placeholder: "Coach Name" },
];

export default function ProfileSection({ values, onChange }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Profile</Text>
      <Text style={styles.sectionSubtitle}>Saved with your Summary profile locally on this phone.</Text>
      <View style={styles.fields}>
        {FIELDS.map((field) => (
          <View key={field.key} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              value={values[field.key]}
              onChangeText={(next) => onChange(field.key, next)}
              placeholder={field.placeholder}
              placeholderTextColor="#6B7280"
              style={styles.input}
            />
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
    gap: 6,
  },
  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 19,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 8,
  },
  fields: {
    gap: 10,
  },
  field: {
    gap: 6,
  },
  label: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#0F141B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    color: "#F9FAFB",
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
