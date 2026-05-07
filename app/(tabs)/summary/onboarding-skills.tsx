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

const SKILLS_OPTIONS = [
  "Closed Guard",
  "Open Guard",
  "Half Guard",
  "Guard Pass",
  "Pressure Passing",
  "Armbar",
  "Triangle",
  "Rear Naked Choke",
  "Mount Escape",
  "Side Control Escape",
] as const;

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
      <Text style={styles.subtitle}>
        Pick what you're comfortable with ({selectedOrder.length}/{MAX_SKILLS} max).
      </Text>

      <View style={styles.chipWrap}>
        {SKILLS_OPTIONS.map((skill) => {
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
  subtitle: {
    color: "#9ca3af",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
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
  saveBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#c7f36b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
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
