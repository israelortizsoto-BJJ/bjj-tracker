import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

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

  const handleBackToTemplates = () => {
    router.push("/profile/coaches/templates");
  };

  const handleBackToCreatePack = () => {
    router.push("/profile/coaches/create-pack");
  };

  return (
    <>
      <Stack.Screen options={{ title: "Template Selected" }} />
      <ScrollView style={{ flex: 1, backgroundColor: UI.screenBg }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Selected Template
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          This is a quick confirmation step before you customize and assign this
          program pack in future flows.
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
          <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
            You&apos;ve chosen this template as the starting point for a future
            customization and assignment flow. In a later iteration, this screen
            will hand off into authoring tools where you can tune modules,
            scheduling, and coach-facing copy before publishing.
          </Text>
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
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
      </ScrollView>
    </>
  );
}

