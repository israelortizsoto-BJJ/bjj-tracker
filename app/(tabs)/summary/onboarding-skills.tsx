import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useActiveAthlete } from "@/src/hooks/useActiveAthlete";
import { updateAthlete } from "@/src/storage/athleteStore";

const MAX_SKILLS = 10;

/** Display strings stored as `declaredSkills` (matches Summary `formatSkill` expectations). */
const POSITION_AND_MOVEMENT_OPTIONS = [
  "Closed Guard",
  "Open Guard",
  "Half Guard",
  "Mount",
  "Side Control",
  "Back Control",
  "Guard Pass",
  "Pressure Passing",
  "Takedowns",
] as const;

const SUBMISSION_AND_ESCAPES_OPTIONS = [
  "Armbar",
  "Triangle",
  "Kimura",
  "Guillotine",
  "Rear Naked Choke",
  "Straight Ankle Lock",
  "Mount Escape",
  "Side Control Escape",
  "Back Escape",
] as const;

const SKILLS_OPTIONS = [...POSITION_AND_MOVEMENT_OPTIONS, ...SUBMISSION_AND_ESCAPES_OPTIONS] as const;

const SKILL_SET = new Set<string>(SKILLS_OPTIONS);

export default function OnboardingSkillsScreen() {
  const { hydrationReady, athleteId, athlete } = useActiveAthlete();
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const hydratedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrationReady || !athlete) return;
    if (hydratedForIdRef.current === athlete.id) return;
    hydratedForIdRef.current = athlete.id;
    const fromStore = athlete.declaredSkills ?? [];
    const next = fromStore.filter((s) => SKILL_SET.has(s)).slice(0, MAX_SKILLS);
    setSelectedOrder(next);
  }, [hydrationReady, athlete]);

  useEffect(() => {
    if (!hydrationReady) return;
    if (!athleteId.trim()) {
      router.replace("/summary");
    }
  }, [hydrationReady, athleteId]);

  const toggleSkill = useCallback((skill: string) => {
    setSelectedOrder((prev) => {
      const idx = prev.indexOf(skill);
      if (idx >= 0) {
        return prev.filter((s) => s !== skill);
      }
      if (prev.length >= MAX_SKILLS) return prev;
      return [...prev, skill];
    });
  }, []);

  const onSubmit = useCallback(async () => {
    const id = typeof athleteId === "string" ? athleteId.trim() : "";
    if (!id || busy) return;
    setBusy(true);
    try {
      await updateAthlete(id, {
        declaredSkills: selectedOrder,
        onboardingVersion: "v2",
      });
      router.replace("/summary");
    } finally {
      setBusy(false);
    }
  }, [athleteId, busy, selectedOrder]);

  const onSkip = useCallback(async () => {
    const id = typeof athleteId === "string" ? athleteId.trim() : "";
    if (!id || busy) return;
    setBusy(true);
    try {
      await updateAthlete(id, { onboardingVersion: "v2" });
      router.replace("/summary");
    } finally {
      setBusy(false);
    }
  }, [athleteId, busy]);

  if (!hydrationReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#c7f36b" />
      </View>
    );
  }

  const idTrim = athleteId.trim();
  if (!idTrim) {
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>What techniques does this athlete already know?</Text>
      <Text style={styles.subtitle}>Quick tap — optional. You can change this anytime in profile.</Text>

      <Text style={styles.groupLabel}>Positions & movement</Text>
      <View style={styles.chipWrap}>
        {POSITION_AND_MOVEMENT_OPTIONS.map((skill) => {
          const on = selectedOrder.includes(skill);
          const frozenOut = selectedOrder.length >= MAX_SKILLS && !on;
          return (
            <Pressable
              key={skill}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: frozenOut || busy }}
              disabled={frozenOut || busy}
              onPress={() => toggleSkill(skill)}
              style={({ pressed }) => [
                styles.chip,
                on ? styles.chipOn : null,
                frozenOut ? styles.chipDisabled : null,
                pressed && !frozenOut && !busy ? styles.chipPressed : null,
              ]}
            >
              <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{skill}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>Submissions & escapes</Text>
      <View style={styles.chipWrap}>
        {SUBMISSION_AND_ESCAPES_OPTIONS.map((skill) => {
          const on = selectedOrder.includes(skill);
          const frozenOut = selectedOrder.length >= MAX_SKILLS && !on;
          return (
            <Pressable
              key={skill}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: frozenOut || busy }}
              disabled={frozenOut || busy}
              onPress={() => toggleSkill(skill)}
              style={({ pressed }) => [
                styles.chip,
                on ? styles.chipOn : null,
                frozenOut ? styles.chipDisabled : null,
                pressed && !frozenOut && !busy ? styles.chipPressed : null,
              ]}
            >
              <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{skill}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerActions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void onSkip()}
          style={({ pressed }) => [styles.skipBtn, pressed && !busy ? styles.skipBtnPressed : null]}
        >
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void onSubmit()}
          style={({ pressed }) => [
            styles.saveBtn,
            busy ? styles.saveBtnDisabled : null,
            pressed && !busy ? styles.saveBtnPressed : null,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={styles.saveBtnText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  inner: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 28,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: "#0b0f12",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#f3f4f6",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    marginBottom: 10,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  groupLabel: {
    color: "#b6cf68",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  groupLabelSpaced: {
    marginTop: 6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chipOn: {
    backgroundColor: "#1a2e05",
    borderColor: "#4d7c0f",
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipText: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextOn: {
    color: "#c7f36b",
  },
  footerActions: {
    marginTop: "auto",
    gap: 12,
  },
  skipBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  skipBtnPressed: {
    opacity: 0.85,
    backgroundColor: "#111827",
  },
  skipBtnText: {
    color: "#9ca3af",
    fontSize: 15,
    fontWeight: "700",
  },
  saveBtn: {
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
