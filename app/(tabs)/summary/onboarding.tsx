import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useActiveAthlete } from "@/src/hooks/useActiveAthlete";
import { getActiveAthleteId, setActiveAthleteId, updateAthlete } from "@/src/storage/athleteStore";

const BELT_OPTIONS = [
  { label: "White", value: "white" },
  { label: "Blue", value: "blue" },
  { label: "Purple", value: "purple" },
  { label: "Brown", value: "brown" },
  { label: "Black", value: "black" },
  { label: "Kids", value: "kids" },
];

const EXPERIENCE_OPTIONS = [
  { label: "Beginner", value: "beginner" },
  { label: "Developing", value: "developing" },
  { label: "Experienced", value: "experienced" },
];

function normalizeExperienceKey(experienceLevel: string): string {
  return experienceLevel.trim().toLowerCase();
}

function normalizeBeltKey(beltRank: string): string {
  return beltRank
    .trim()
    .toLowerCase()
    .replace(/\s+belt\s*$/i, "")
    .trim();
}

function canonicalBeltFromStored(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const k = normalizeBeltKey(raw);
  const hit = BELT_OPTIONS.find((o) => o.value === k || normalizeBeltKey(o.label) === k);
  return hit?.value ?? "";
}

function canonicalExperienceFromStored(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const k = normalizeExperienceKey(raw);
  const hit = EXPERIENCE_OPTIONS.find((o) => o.value === k);
  return hit?.value ?? "";
}

function isCanonicalBelt(v: string): boolean {
  return BELT_OPTIONS.some((o) => o.value === v);
}

function isCanonicalExperience(v: string): boolean {
  return EXPERIENCE_OPTIONS.some((o) => o.value === v);
}

function beltSkipsSkillScreen(beltRank: string): boolean {
  const k = normalizeBeltKey(beltRank);
  if (!k) return false;
  const head = k.split(/\s+/)[0] ?? "";
  return head === "purple" || head === "brown" || head === "black";
}

function experienceSkipsSkillScreen(expNorm: string): boolean {
  return expNorm === "experienced" || expNorm === "advanced";
}

function shouldShowSkillsStep(beltRank: string, experienceLevel: string): boolean {
  const expNorm = normalizeExperienceKey(experienceLevel);
  if (beltSkipsSkillScreen(beltRank) || experienceSkipsSkillScreen(expNorm)) return false;
  return expNorm === "developing";
}

export default function AthleteOnboardingScreen() {
  const { hydrationReady, athleteId, athlete } = useActiveAthlete();
  const [beltRank, setBeltRank] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [isCompetitor, setIsCompetitor] = useState(false);
  const [busy, setBusy] = useState(false);

  const hydratedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrationReady || !athlete) return;
    if (hydratedForIdRef.current === athlete.id) return;
    hydratedForIdRef.current = athlete.id;
    setBeltRank(canonicalBeltFromStored(athlete.beltRank));
    setExperienceLevel(canonicalExperienceFromStored(athlete.experienceLevel));
    setIsCompetitor(athlete.isCompetitor ?? false);
  }, [hydrationReady, athlete]);

  useEffect(() => {
    if (!hydrationReady) return;
    if (athleteId.trim() && !athlete) {
      router.replace("/summary");
    }
  }, [hydrationReady, athleteId, athlete]);

  const canSubmit =
    hydrationReady &&
    Boolean(athleteId.trim()) &&
    isCanonicalBelt(beltRank) &&
    isCanonicalExperience(experienceLevel);

  const onSubmit = useCallback(async () => {
    if (!canSubmit || busy) return;
    const id = athleteId.trim();
    if (!id) return;
    setBusy(true);
    try {
      const trimmedBelt = beltRank.trim();
      const trimmedExp = experienceLevel.trim();
      const expNormForDebug = normalizeExperienceKey(trimmedExp);
      const skipSkills = experienceSkipsSkillScreen(expNormForDebug);
      const shouldGoToSkills = shouldShowSkillsStep(trimmedBelt, trimmedExp);

      console.log("[ONBOARDING DEBUG] raw experienceLevel:", experienceLevel);
      console.log("[ONBOARDING DEBUG] raw beltRank:", beltRank);
      console.log("[ONBOARDING DEBUG] skipSkills:", skipSkills);
      console.log("[ONBOARDING DEBUG] shouldGoToSkills:", shouldGoToSkills);

      const basePatch = {
        beltRank: trimmedBelt,
        experienceLevel: trimmedExp,
        isCompetitor,
      };

      if (shouldGoToSkills) {
        console.log("[ONBOARDING DEBUG] navigating to skills");
        await updateAthlete(id, basePatch);
        if (id) {
          const current = ((await getActiveAthleteId()) ?? "").trim();
          if (current !== id) await setActiveAthleteId(id);
        }
        router.replace("/summary/onboarding-skills");
        return;
      }

      await updateAthlete(id, {
        ...basePatch,
        onboardingVersion: "v2",
      });
      if (id) {
        const current = ((await getActiveAthleteId()) ?? "").trim();
        if (current !== id) await setActiveAthleteId(id);
      }
      router.replace("/summary");
    } finally {
      setBusy(false);
    }
  }, [beltRank, busy, canSubmit, experienceLevel, isCompetitor, athleteId]);

  if (!hydrationReady || !athleteId.trim()) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#c7f36b" />
      </View>
    );
  }

  if (!athlete) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#c7f36b" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.label}>Belt rank</Text>
        <View style={styles.optionRow}>
          {BELT_OPTIONS.map((opt) => {
            const selected = beltRank === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={busy}
                onPress={() => setBeltRank(opt.value)}
                style={({ pressed }) => [
                  styles.optionChip,
                  selected ? styles.optionChipSelected : null,
                  pressed && !busy ? styles.optionChipPressed : null,
                ]}
              >
                <Text style={[styles.optionChipText, selected ? styles.optionChipTextSelected : null]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, styles.labelSpaced]}>Experience level</Text>
        <View style={styles.optionRow}>
          {EXPERIENCE_OPTIONS.map((opt) => {
            const selected = experienceLevel === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={busy}
                onPress={() => setExperienceLevel(opt.value)}
                style={({ pressed }) => [
                  styles.optionChip,
                  selected ? styles.optionChipSelected : null,
                  pressed && !busy ? styles.optionChipPressed : null,
                ]}
              >
                <Text style={[styles.optionChipText, selected ? styles.optionChipTextSelected : null]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.row, styles.labelSpaced]}>
          <Text style={styles.labelInline}>Competitor</Text>
          <Switch
            value={isCompetitor}
            onValueChange={setIsCompetitor}
            disabled={busy}
            trackColor={{ false: "#374151", true: "#4d7c0f" }}
            thumbColor={isCompetitor ? "#c7f36b" : "#9ca3af"}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit || busy}
          onPress={() => void onSubmit()}
          style={({ pressed }) => [
            styles.saveBtn,
            !canSubmit || busy ? styles.saveBtnDisabled : null,
            pressed && canSubmit && !busy ? styles.saveBtnPressed : null,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={styles.saveBtnText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  inner: {
    flex: 1,
    padding: 20,
    paddingTop: 8,
  },
  centered: {
    flex: 1,
    backgroundColor: "#0b0f12",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 20,
  },
  labelInline: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  optionChipSelected: {
    borderColor: "#c7f36b",
    backgroundColor: "#1a2214",
  },
  optionChipPressed: {
    opacity: 0.88,
  },
  optionChipText: {
    color: "#f9fafb",
    fontSize: 15,
    fontWeight: "600",
  },
  optionChipTextSelected: {
    color: "#c7f36b",
  },
  saveBtn: {
    marginTop: 28,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#c7f36b",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnPressed: {
    opacity: 0.88,
  },
  saveBtnText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
});
