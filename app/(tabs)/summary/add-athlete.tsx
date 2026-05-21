import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { addAthlete, setActiveAthleteId } from "@/src/storage/athleteStore";

export default function AddAthleteScreen() {
  const { coachLinkId } = useLocalSearchParams<{ coachLinkId?: string }>();
  const preferredCoachLinkId =
    typeof coachLinkId === "string" && coachLinkId.trim() ? coachLinkId.trim() : undefined;

  const [name, setName] = useState("");
  const [household, setHousehold] = useState("");
  const [busy, setBusy] = useState(false);

  const canSave = name.trim().length > 0;

  const onSave = useCallback(async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      const athlete = await addAthlete({
        name: name.trim(),
        household: household.trim() || undefined,
        preferredCoachLinkId,
      });
      await setActiveAthleteId(athlete.id);
      router.replace("/summary/onboarding");
    } finally {
      setBusy(false);
    }
  }, [canSave, busy, name, household, preferredCoachLinkId]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Required"
          placeholderTextColor="#6b7280"
          autoCapitalize="words"
          autoCorrect
          style={styles.input}
          editable={!busy}
        />

        <Text style={[styles.label, styles.labelSpaced]}>Household (optional)</Text>
        <TextInput
          value={household}
          onChangeText={setHousehold}
          placeholder="e.g. Family name or unit"
          placeholderTextColor="#6b7280"
          autoCapitalize="words"
          style={styles.input}
          editable={!busy}
        />

        <Pressable
          accessibilityRole="button"
          disabled={!canSave || busy}
          onPress={() => void onSave()}
          style={({ pressed }) => [
            styles.saveBtn,
            !canSave || busy ? styles.saveBtnDisabled : null,
            pressed && canSave && !busy ? styles.saveBtnPressed : null,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
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
  label: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 20,
  },
  input: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 12,
    color: "#f9fafb",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
