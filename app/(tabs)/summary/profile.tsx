import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useActiveAthlete } from "@/src/hooks/useActiveAthlete";
import { updateAthlete } from "@/src/storage/athleteStore";

const BELT_OPTIONS = ["white", "blue", "purple", "brown", "black"];

const EXPERIENCE_OPTIONS = [
  { label: "Beginner", value: "beginner" },
  { label: "Developing", value: "developing" },
  { label: "Experienced", value: "experienced" },
];

export default function AthleteProfileScreen() {
  const router = useRouter();
  const { athlete, athleteId, hydrationReady } = useActiveAthlete();

  const [beltRank, setBeltRank] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [isCompetitor, setIsCompetitor] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!athlete) return;

    setBeltRank(athlete.beltRank ?? "");
    setExperienceLevel(athlete.experienceLevel ?? "");
    setIsCompetitor(!!athlete.isCompetitor);
  }, [athlete?.id]);

  if (!hydrationReady || !athleteId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#c7f36b" />
      </View>
    );
  }

  const handleSave = async () => {
    if (!athleteId) return;

    setSaving(true);

    await updateAthlete(athleteId, {
      beltRank,
      experienceLevel,
      isCompetitor,
    });

    setSaving(false);
    router.replace("/summary");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Athlete Profile</Text>

      <Text style={styles.label}>Belt</Text>
      <View style={styles.row}>
        {BELT_OPTIONS.map((belt) => (
          <Pressable
            key={belt}
            onPress={() => setBeltRank(belt)}
            style={[styles.chip, beltRank === belt && styles.selected]}
          >
            <Text style={styles.chipText}>{belt}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Experience</Text>
      <View style={styles.row}>
        {EXPERIENCE_OPTIONS.map((exp) => (
          <Pressable
            key={exp.value}
            onPress={() => setExperienceLevel(exp.value)}
            style={[styles.chip, experienceLevel === exp.value && styles.selected]}
          >
            <Text style={styles.chipText}>{exp.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Competitor</Text>
        <Switch value={isCompetitor} onValueChange={setIsCompetitor} />
      </View>

      <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
        <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#0b0f12" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, color: "#fff", marginBottom: 20 },
  label: { color: "#aaa", marginTop: 20, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  selected: {
    borderColor: "#c7f36b",
    backgroundColor: "#1a2a1a",
  },
  chipText: { color: "#fff" },
  switchRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  saveBtn: {
    marginTop: 30,
    backgroundColor: "#c7f36b",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: { color: "#000", fontWeight: "600" },
});
