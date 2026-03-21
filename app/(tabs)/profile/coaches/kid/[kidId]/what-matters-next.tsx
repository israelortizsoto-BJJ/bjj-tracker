import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";

import {
  getKidStandingGuidance,
  saveKidStandingGuidance,
} from "../../../../../../src/storage/kidStandingGuidanceStore";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
};

const CARD_RADIUS = 16;

export default function WhatMattersNextScreen() {
  const params = useLocalSearchParams<{ kidId?: string }>();
  const kidId = params.kidId ? String(params.kidId) : "";

  const [ready, setReady] = useState(false);
  const [headlineDraft, setHeadlineDraft] = useState("");
  const [detailDraft, setDetailDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!kidId) return;
    setReady(false);
    try {
      const row = await getKidStandingGuidance(kidId);
      setHeadlineDraft(row?.headline ?? "");
      setDetailDraft(row?.detail ?? "");
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
      router.replace("/profile/coaches/kids");
    }
  }, [kidId]);

  const onSave = useCallback(async () => {
    if (!kidId) {
      Alert.alert("Missing kid id", "Please go back and select a kid.");
      return;
    }
    setSaving(true);
    try {
      await saveKidStandingGuidance(kidId, {
        headline: headlineDraft,
        detail: detailDraft,
      });
      router.replace(`/profile/coaches/kid/${kidId}`);
    } finally {
      setSaving(false);
    }
  }, [kidId, headlineDraft, detailDraft]);

  return (
    <>
      <Stack.Screen options={{ title: "What matters next" }} />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Pressable
          onPress={() => router.replace(`/profile/coaches/kid/${kidId}`)}
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
          What matters next
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          A steady message for this athlete that stays until you change it.
        </Text>

        <View style={{ height: 20 }} />

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
            <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary }}>
              What matters most right now
            </Text>
            <TextInput
              value={headlineDraft}
              onChangeText={setHeadlineDraft}
              placeholder="What matters most right now for this kid?"
              placeholderTextColor={UI.textSecondary}
              multiline
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                padding: 12,
                minHeight: 88,
                color: UI.textPrimary,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary }}>
              Add a little context (optional)
            </Text>
            <TextInput
              value={detailDraft}
              onChangeText={setDetailDraft}
              placeholder="Add a little context if helpful."
              placeholderTextColor={UI.textSecondary}
              multiline
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                padding: 12,
                minHeight: 88,
                color: UI.textPrimary,
                textAlignVertical: "top",
              }}
            />
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
            <Text style={{ fontSize: 14, color: "#ffffff", fontWeight: "800" }}>Save direction</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
}
