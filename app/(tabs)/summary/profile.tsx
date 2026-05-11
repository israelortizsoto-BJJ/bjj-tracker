import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useActiveAthlete } from "@/src/hooks/useActiveAthlete";
import {
  ATHLETE_BELT_RANK_OPTIONS,
  ATHLETE_EXPERIENCE_LEVEL_OPTIONS,
  canonicalBeltRankFromStored,
  canonicalExperienceLevelFromStored,
  isKnownAthleteBeltRank,
  isKnownAthleteExperienceLevel,
} from "@/src/lib/athlete/athleteBeltExperience";
import { updateAthlete } from "@/src/storage/athleteStore";

export default function AthleteProfileScreen() {
  const router = useRouter();
  const { athlete, athleteId, hydrationReady } = useActiveAthlete();

  const [beltRank, setBeltRank] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [isCompetitor, setIsCompetitor] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!athlete) return;

    setBeltRank(canonicalBeltRankFromStored(athlete.beltRank));
    setExperienceLevel(canonicalExperienceLevelFromStored(athlete.experienceLevel));
    setIsCompetitor(!!athlete.isCompetitor);
  }, [athlete]);

  const canSave = useMemo(
    () =>
      isKnownAthleteBeltRank(beltRank) &&
      isKnownAthleteExperienceLevel(experienceLevel),
    [beltRank, experienceLevel],
  );

  const legacyBeltNeedsUpdate = Boolean(
    athlete?.beltRank?.trim() && !canonicalBeltRankFromStored(athlete.beltRank),
  );
  const legacyExperienceNeedsUpdate = Boolean(
    athlete?.experienceLevel?.trim() &&
      !canonicalExperienceLevelFromStored(athlete.experienceLevel),
  );

  if (!hydrationReady || !athleteId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#c7f36b" />
      </View>
    );
  }

  const handleSave = async () => {
    if (!athleteId || !canSave) return;

    setSaving(true);

    await updateAthlete(athleteId, {
      beltRank: beltRank.trim(),
      experienceLevel: experienceLevel.trim().toLowerCase(),
      isCompetitor,
    });

    setSaving(false);
    router.replace("/summary");
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Athlete Profile</Text>

      {legacyBeltNeedsUpdate || legacyExperienceNeedsUpdate ? (
        <Text style={styles.hint}>
          Select values below to match the new lists. Anything that no longer matches will be updated when you save.
        </Text>
      ) : null}

      <Text style={styles.label}>Belt rank</Text>
      <View style={styles.row}>
        {ATHLETE_BELT_RANK_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setBeltRank(opt.value)}
            style={[styles.chip, beltRank === opt.value && styles.selected]}
          >
            <Text style={styles.chipText}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Experience level</Text>
      <View style={styles.row}>
        {ATHLETE_EXPERIENCE_LEVEL_OPTIONS.map((exp) => (
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

      <Pressable
        onPress={handleSave}
        disabled={saving || !canSave}
        style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
      >
        <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0b0f12" },
  container: { padding: 20, paddingBottom: 40, backgroundColor: "#0b0f12" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, color: "#fff", marginBottom: 20 },
  hint: {
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
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
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveText: { color: "#000", fontWeight: "600" },
});
