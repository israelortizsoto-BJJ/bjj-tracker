import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getKidCurrentStateAssessment,
  saveKidCurrentStateAssessment,
} from "../../../../../src/storage/kidCurrentStateAssessmentStore";
import { CoachVoiceNoteField } from "../../../../../src/features/coach/CoachVoiceNoteField";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
  rowMutedBg: "#f9fafb",
};

const CARD_RADIUS = 16;

export default function KidCurrentStateScreen() {
  const params = useLocalSearchParams<{ kidId?: string }>();
  const kidId = params.kidId ? String(params.kidId) : "";

  const [ready, setReady] = useState(false);
  const [narrativeDraft, setNarrativeDraft] = useState("");
  const [confidenceDraft, setConfidenceDraft] = useState("");
  const [executionDraft, setExecutionDraft] = useState("");
  const [consistencyDraft, setConsistencyDraft] = useState("");
  const [pressureDraft, setPressureDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);

  const bumpScrollToFocusedInput = useCallback(() => {
    const run = () => {
      (keyboardAwareRef.current as { update?: () => void } | null)?.update?.();
    };
    requestAnimationFrame(run);
    setTimeout(run, 120);
    setTimeout(run, 340);
  }, []);

  const load = useCallback(async () => {
    if (!kidId) return;
    setReady(false);
    try {
      const row = await getKidCurrentStateAssessment(kidId);
      setNarrativeDraft(row?.narrative ?? "");
      setConfidenceDraft(row?.confidence ?? "");
      setExecutionDraft(row?.execution ?? "");
      setConsistencyDraft(row?.consistency ?? "");
      setPressureDraft(row?.pressureResponse ?? "");
    } finally {
      setReady(true);
    }
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      router.replace("/coach/kids");
    }
  }, [kidId]);

  useEffect(() => {
    if (Platform.OS === "ios") {
      const sub = Keyboard.addListener("keyboardWillChangeFrame", bumpScrollToFocusedInput);
      return () => sub.remove();
    }
    const sub = Keyboard.addListener("keyboardDidShow", bumpScrollToFocusedInput);
    return () => sub.remove();
  }, [bumpScrollToFocusedInput]);

  const onSave = useCallback(async () => {
    if (!kidId) {
      Alert.alert("Missing kid id", "Please go back and select a kid.");
      return;
    }
    const narrative = narrativeDraft.trim();
    const hasMetadata =
      Boolean(confidenceDraft.trim()) ||
      Boolean(executionDraft.trim()) ||
      Boolean(consistencyDraft.trim()) ||
      Boolean(pressureDraft.trim());
    if (!narrative && hasMetadata) {
      Alert.alert(
        "Add the assessment",
        "Supporting fields need a coach assessment narrative to attach to.",
      );
      return;
    }
    setSaving(true);
    try {
      await saveKidCurrentStateAssessment(kidId, {
        narrative: narrativeDraft,
        confidence: confidenceDraft,
        execution: executionDraft,
        consistency: consistencyDraft,
        pressureResponse: pressureDraft,
      });
      router.replace(`/coach/kid/${kidId}`);
    } finally {
      setSaving(false);
    }
  }, [
    kidId,
    narrativeDraft,
    confidenceDraft,
    executionDraft,
    consistencyDraft,
    pressureDraft,
  ]);

  return (
    <>
      <Stack.Screen options={{ title: "Current State" }} />
      <KeyboardAwareScrollView
        ref={keyboardAwareRef}
        enableOnAndroid
        enableAutomaticScroll
        enableResetScrollToCoords={false}
        keyboardOpeningTime={120}
        viewIsInsideTabBar
        extraHeight={headerHeight + 16}
        extraScrollHeight={insets.bottom + 56}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}
      >
        <Pressable
          onPress={() => router.replace(`/coach/kid/${kidId}`)}
          style={({ pressed }) => ({
            marginBottom: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
            alignSelf: "flex-start",
          })}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "800", color: UI.textPrimary, marginBottom: 8 }}>
          Current state
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Start with your read of the athlete today. This coach-authored narrative is the source
          of truth; the fields below are optional support.
        </Text>

        <View style={{ height: 14 }} />

        <View
          style={{
            padding: 16,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 14,
          }}
        >
          <View style={{ gap: 6 }}>
            <CoachVoiceNoteField
              label="What you saw"
              value={narrativeDraft}
              onChangeText={setNarrativeDraft}
              onFocus={bumpScrollToFocusedInput}
              onContentSizeChange={bumpScrollToFocusedInput}
              placeholder="What is true about this athlete right now?"
              scrollEnabled
              minHeight={156}
              maxHeight={260}
              disabled={!ready || saving}
            />
          </View>

          <View
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.rowMutedBg,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary }}>
              Optional metadata
            </Text>
            <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
              Use these only if they help you label the narrative. Future intelligence should
              derive structure from the assessment over time.
            </Text>

            {[
              {
                label: "Confidence",
                value: confidenceDraft,
                onChangeText: setConfidenceDraft,
                placeholder: "Example: improving, hesitant, steady",
              },
              {
                label: "Execution",
                value: executionDraft,
                onChangeText: setExecutionDraft,
                placeholder: "Example: technically sound, inconsistent live",
              },
              {
                label: "Consistency",
                value: consistencyDraft,
                onChangeText: setConsistencyDraft,
                placeholder: "Example: building rhythm, needs repetition",
              },
              {
                label: "Pressure response",
                value: pressureDraft,
                onChangeText: setPressureDraft,
                placeholder: "Example: rushes under pace, recovers well",
              },
            ].map((field) => (
              <View key={field.label} style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary }}>
                  {field.label}
                </Text>
                <TextInput
                  value={field.value}
                  onChangeText={field.onChangeText}
                  onFocus={bumpScrollToFocusedInput}
                  placeholder={field.placeholder}
                  placeholderTextColor={UI.textSecondary}
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: UI.border,
                    backgroundColor: UI.bgCard,
                    padding: 12,
                    color: UI.textPrimary,
                  }}
                />
              </View>
            ))}
          </View>

          <Pressable
            disabled={saving || !ready}
            onPress={() => void onSave()}
            style={({ pressed }) => ({
              marginTop: 4,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.accent,
              backgroundColor: pressed ? UI.accent : UI.accent,
              opacity: saving || !ready ? 0.6 : 1,
              alignSelf: "flex-start",
            })}
          >
            <Text style={{ fontSize: 14, color: "#ffffff", fontWeight: "800" }}>
              {saving ? "Saving..." : "Save Assessment"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
}
