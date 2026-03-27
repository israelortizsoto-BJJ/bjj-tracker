import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import {
  COACH_PILOT_PREVIEW_MAX_ITEMS,
  getCoachPilotPreviewItems,
  setCoachPilotPreviewItems,
} from "../../../src/storage/coachShareStore";
import { TEMPLATE_CONTENT } from "./template-preview";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

export default function TemplateSelectedScreen() {
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();

  const effectiveTemplateId =
    templateId && TEMPLATE_CONTENT[templateId]
      ? templateId
      : "guard-pull-defense-knee-middle";

  const template = TEMPLATE_CONTENT[effectiveTemplateId];
  const [referenceUrl, setReferenceUrl] = useState("");

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const existing = await getCoachPilotPreviewItems();
      const existingItem = existing.find(
        (item) => item.type === "template" && item.templateId === effectiveTemplateId,
      );

      if (!isMounted) return;
      if (existingItem?.youtubeUrl) {
        setReferenceUrl(existingItem.youtubeUrl);
      } else {
        setReferenceUrl("");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [effectiveTemplateId]);

  const handleConfirmPilotPreview = async () => {
    const nowIso = new Date().toISOString();
    const existing = await getCoachPilotPreviewItems();
    const trimmedUrl = referenceUrl.trim();
    const existingIndex = existing.findIndex(
      (item) => item.type === "template" && item.templateId === effectiveTemplateId,
    );

    if (existingIndex !== -1) {
      const updated = [...existing];
      const current = updated[existingIndex];

      updated[existingIndex] = {
        ...current,
        youtubeUrl: trimmedUrl ? trimmedUrl : current.youtubeUrl,
      };

      await setCoachPilotPreviewItems(updated);

      router.replace("/this-week");
      return;
    }

    if (existing.length >= COACH_PILOT_PREVIEW_MAX_ITEMS) {
      Alert.alert(
        "Preview list is full",
        `You can only keep up to ${COACH_PILOT_PREVIEW_MAX_ITEMS} preview items for the week. Remove one before adding another.`,
      );
      return;
    }

    const updated = [
      ...existing,
      {
        id: `template-${effectiveTemplateId}`,
        type: "template" as const,
        templateId: effectiveTemplateId,
        title: template.title,
        metadata: template.metadata,
        createdAt: nowIso,
        youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
      },
    ];

    await setCoachPilotPreviewItems(updated);

    router.replace("/this-week");
  };

  const handleBackToTemplates = () => {
    router.push("/this-week/templates");
  };

  const handleBackToCreatePack = () => {
    router.push("/this-week/create-pack");
  };

  return (
    <>
      <Stack.Screen options={{ title: "Weekly Focus Selected" }} />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 16 }}
      >
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Selected Weekly Focus
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Confirm this selected weekly focus for your internal coach pilot preview.
          Optionally, add a reference video URL.
        </Text>

        <View
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4, color: UI.textPrimary }}>
            {template.title}
          </Text>
          <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
            {template.description}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13, color: UI.textSecondary }}>
            {template.metadata}
          </Text>
        </View>

        <View
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              marginBottom: 6,
              color: UI.textPrimary,
            }}
          >
            Reference Video URL (optional)
          </Text>
          <TextInput
            value={referenceUrl}
            onChangeText={setReferenceUrl}
            placeholder="Paste a YouTube link (e.g. https://youtu.be/...)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: "#fff",
              fontSize: 14,
              color: UI.textPrimary,
            }}
          />
          <Text
            style={{
              marginTop: 6,
              fontSize: 12,
              color: UI.textSecondary,
            }}
          >
            Optional. Saved only to your internal coach pilot preview. If left empty, no
            reference link will be attached.
          </Text>
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
          <Pressable
            onPress={() => void handleConfirmPilotPreview()}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ fontSize: 15, color: UI.textPrimary, fontWeight: "700" }}>
              Save Pilot Preview
            </Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
              Saves locally. Not assigned/published to families yet.
            </Text>
          </Pressable>

          <Pressable
            onPress={handleBackToTemplates}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ fontSize: 15, color: UI.textPrimary }}>Back to Templates</Text>
          </Pressable>

          <Pressable
            onPress={handleBackToCreatePack}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ fontSize: 15, color: UI.textPrimary }}>Back to Create Program Pack</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
}

