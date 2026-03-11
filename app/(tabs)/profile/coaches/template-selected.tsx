import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { TEMPLATE_CONTENT } from "./template-preview";

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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          Selected Template
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
          This is a quick confirmation step before you customize and assign this
          program pack in future flows.
        </Text>

        <View
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
            {template.title}
          </Text>
          <Text style={{ fontSize: 14, opacity: 0.85, lineHeight: 20 }}>
            {template.description}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
            {template.metadata}
          </Text>
        </View>

        <View
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
          }}
        >
          <Text style={{ fontSize: 14, opacity: 0.8, lineHeight: 20 }}>
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
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ fontSize: 15 }}>Back to Templates</Text>
          </Pressable>

          <Pressable
            onPress={handleBackToCreatePack}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ fontSize: 15 }}>Back to Create Program Pack</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

