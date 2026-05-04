import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getKidWeeklyFocusEntryById,
  patchKidWeeklyFocusCoachFields,
} from "../../../../../src/storage/coachKidStore";
import type { CoachOutcome } from "../../../../../src/types/coachKid";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

function outcomeLabel(o: CoachOutcome) {
  switch (o) {
    case "not_yet":
      return "Learning";
    case "developing":
      return "Developing";
    case "on_track":
      return "Applying";
  }
}

export default function KidProgressReflectionEditScreen() {
  const params = useLocalSearchParams<{ kidId?: string; entryId?: string }>();
  const kidId = params.kidId ? String(params.kidId) : "";
  const entryId = params.entryId ? String(params.entryId) : "";

  const [loading, setLoading] = useState(true);
  const [focusTitle, setFocusTitle] = useState("—");
  const [outcomeDraft, setOutcomeDraft] = useState<CoachOutcome>("not_yet");
  const [notesDraft, setNotesDraft] = useState("");
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

  useEffect(() => {
    if (Platform.OS === "ios") {
      const sub = Keyboard.addListener("keyboardWillChangeFrame", bumpScrollToFocusedInput);
      return () => sub.remove();
    }
    const sub = Keyboard.addListener("keyboardDidShow", bumpScrollToFocusedInput);
    return () => sub.remove();
  }, [bumpScrollToFocusedInput]);

  const load = useCallback(async () => {
    if (!kidId || !entryId) return;
    setLoading(true);
    try {
      const entry = await getKidWeeklyFocusEntryById(entryId);
      if (!entry || entry.kidId !== kidId) {
        Alert.alert("Not found", "This progress entry is missing or belongs to another kid.");
        router.replace(`/coach/kid/${kidId}`);
        return;
      }
      setFocusTitle(entry.title);
      setOutcomeDraft(entry.coachOutcome ?? "not_yet");
      setNotesDraft(entry.coachNotes ?? "");
    } finally {
      setLoading(false);
    }
  }, [kidId, entryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onSave = useCallback(async () => {
    if (!kidId || !entryId) return;
    setSaving(true);
    try {
      const trimmed = notesDraft.trim();
      await patchKidWeeklyFocusCoachFields(entryId, {
        coachOutcome: outcomeDraft,
        coachNotes: trimmed ? trimmed : "",
      });
      router.replace(`/coach/kid/${kidId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Could not save", msg || "Something went wrong saving progress.");
    } finally {
      setSaving(false);
    }
  }, [kidId, entryId, outcomeDraft, notesDraft]);

  return (
    <>
      <Stack.Screen options={{ title: "Edit Progress (Pilot)" }} />
      <View style={{ flex: 1, backgroundColor: UI.screenBg }}>
        <KeyboardAwareScrollView
          ref={keyboardAwareRef}
          enableOnAndroid
          enableAutomaticScroll
          enableResetScrollToCoords={false}
          keyboardOpeningTime={120}
          viewIsInsideTabBar
          extraHeight={headerHeight + 24}
          extraScrollHeight={Math.max(280, insets.bottom + 140)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={{ flex: 1, backgroundColor: UI.screenBg }}
          contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
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
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Kid</Text>
        </Pressable>

        {loading ? (
          <Text style={{ fontSize: 14, color: UI.textSecondary }}>Loading…</Text>
        ) : (
          <>
            <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
              WEEKLY FOCUS CONTEXT
            </Text>
            <Text style={{ marginTop: 6, fontSize: 16, fontWeight: "800", color: UI.textPrimary }}>
              {focusTitle}
            </Text>

            <Text
              style={{
                marginTop: 20,
                fontSize: 12,
                letterSpacing: 0.6,
                fontWeight: "700",
                color: UI.textSecondary,
              }}
            >
              OUTCOME
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {(["not_yet", "developing", "on_track"] as CoachOutcome[]).map((o) => {
                const active = outcomeDraft === o;
                return (
                  <Pressable
                    key={o}
                    onPress={() => setOutcomeDraft(o)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? "#1d4ed8" : UI.border,
                      backgroundColor: active ? "#edf2ff" : UI.bgCard,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        fontSize: 12,
                        color: UI.textPrimary,
                        fontWeight: active ? "800" : "700",
                      }}
                    >
                      {outcomeLabel(o)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={{
                marginTop: 16,
                fontSize: 12,
                letterSpacing: 0.6,
                fontWeight: "700",
                color: UI.textSecondary,
              }}
            >
              NOTES
            </Text>
            <TextInput
              value={notesDraft}
              scrollEnabled={false}
              onChangeText={setNotesDraft}
              onFocus={bumpScrollToFocusedInput}
              onContentSizeChange={bumpScrollToFocusedInput}
              placeholder="Weekly progress notes"
              placeholderTextColor={UI.textSecondary}
              multiline
              style={{
                marginTop: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                padding: 12,
                minHeight: 120,
                color: UI.textPrimary,
                textAlignVertical: "top",
              }}
            />

            <Pressable
              disabled={saving}
              onPress={() => void onSave()}
              style={({ pressed }) => ({
                marginTop: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1d4ed8",
                backgroundColor: pressed ? "#1d4ed8" : "#1d4ed8",
                opacity: saving ? 0.6 : 1,
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 16, color: "#fff", fontWeight: "800" }}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </>
        )}

        <Text style={{ marginTop: 16, fontSize: 12, color: UI.textSecondary, opacity: 0.9 }}>
          Internal pilot (coach-side)
        </Text>
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
