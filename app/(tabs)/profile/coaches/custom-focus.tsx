import { Stack, router } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useState } from "react";

import {
  COACH_PILOT_PREVIEW_MAX_ITEMS,
  getCoachPilotPreviewItems,
  setCoachPilotPreviewItems,
} from "../../../../src/storage/coachShareStore";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  bgCardActive: "#edf2ff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

const CARD_RADIUS = 16;

export default function CustomFocusScreen() {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedNote = note.trim();
    const trimmedYoutubeUrl = youtubeUrl.trim();

    if (!trimmedTitle) {
      Alert.alert("Title required", "Add a short title for this custom focus item.");
      return;
    }

    setSaving(true);
    try {
      const existing = await getCoachPilotPreviewItems();

      if (existing.length >= COACH_PILOT_PREVIEW_MAX_ITEMS) {
        Alert.alert(
          "Preview list is full",
          `You can only keep up to ${COACH_PILOT_PREVIEW_MAX_ITEMS} preview items for the week. Remove one before adding another.`,
        );
        return;
      }

      const nowIso = new Date().toISOString();
      const updated = [
        ...existing,
        {
          id: `custom-${Date.now()}`,
          type: "custom" as const,
          title: trimmedTitle,
          note: trimmedNote ? trimmedNote : undefined,
          createdAt: nowIso,
          youtubeUrl: trimmedYoutubeUrl ? trimmedYoutubeUrl : undefined,
        },
      ];

      await setCoachPilotPreviewItems(updated);

      router.replace("/profile/coaches");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Custom Focus (Pilot)" }} />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text style={{ fontSize: 22, fontWeight: "700", color: UI.textPrimary, marginBottom: 6 }}>
          Custom Focus
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
          Internal coach-side pilot preview. This saves a focus item into your local preview list
          only. It does not assign or publish anything to families.
        </Text>

        <View
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: UI.textSecondary,
              letterSpacing: 0.6,
              fontWeight: "600",
            }}
          >
            TITLE (REQUIRED)
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Grip fighting + stance"
            placeholderTextColor="#9ca3af"
            style={{
              marginTop: 6,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              color: UI.textPrimary,
              backgroundColor: UI.bgCard,
            }}
          />

          <Text style={{ marginTop: 14, fontSize: 12, color: UI.textSecondary, letterSpacing: 0.6, fontWeight: "600" }}>
            NOTE (OPTIONAL)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional short note for this week’s emphasis"
            placeholderTextColor="#9ca3af"
            multiline
            style={{
              marginTop: 6,
              minHeight: 96,
              maxHeight: 200,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              color: UI.textPrimary,
              backgroundColor: UI.bgCard,
              textAlignVertical: "top",
            }}
          />

          <Text
            style={{
              marginTop: 14,
              fontSize: 12,
              color: UI.textSecondary,
              letterSpacing: 0.6,
              fontWeight: "600",
            }}
          >
            REFERENCE VIDEO URL (OPTIONAL)
          </Text>
          <TextInput
            value={youtubeUrl}
            onChangeText={setYoutubeUrl}
            placeholder="e.g. https://youtube.com/watch?v=..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{
              marginTop: 6,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              color: UI.textPrimary,
              backgroundColor: UI.bgCard,
            }}
          />

          <View
            style={{
              marginTop: 16,
              flexDirection: "column",
              gap: 10,
            }}
          >
            <Pressable
              onPress={() => router.replace("/profile/coaches")}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                alignSelf: "stretch",
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 15, color: UI.textPrimary }}>Cancel</Text>
            </Pressable>

            <Pressable
              disabled={saving}
              onPress={() => void handleSave()}
              style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                alignSelf: "stretch",
                alignItems: "flex-start",
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: UI.textPrimary }}>
                Save to Preview List
              </Text>
              <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
                Saves locally. Not assigned/published to families.
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
}

