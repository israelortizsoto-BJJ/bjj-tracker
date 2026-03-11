import { Stack, router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

const TEMPLATE_CONTENT: Record<
  string,
  { title: string; description: string; metadata: string }
> = {
  "guard-pull-defense-knee-middle": {
    title: "Guard Pull Defense — Knee in the Middle",
    description:
      "Learn to deny a clean guard pull by winning inside position, inserting the knee line early, and stabilizing posture before the bottom player settles underneath.",
    metadata: "Modules: 3 · Focus: Gi / Top Player · Level: Fundamentals",
  },
  "triangle-defense-posture-escape": {
    title: "Triangle Defense — Posture and Escape",
    description:
      "Build a calm triangle escape sequence by restoring posture, creating angle awareness, protecting the trapped shoulder line, and working toward a safe finish to the escape.",
    metadata: "Modules: 3 · Focus: Gi / Defense · Level: Fundamentals",
  },
  "half-guard-passing-heavy-chest-table-hands": {
    title: "Half Guard Passing — Heavy Chest and Table Hands",
    description:
      "Practice staying heavy on top while passing half guard, using chest pressure, table hands, and patient balance to prevent the bottom player from recovering guard.",
    metadata:
      "Modules: 3 · Focus: Top Pressure / Passing · Level: Fundamentals",
  },
};

export default function TemplatePreviewScreen() {
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();

  const template =
    (templateId ? TEMPLATE_CONTENT[templateId] : undefined) ??
    TEMPLATE_CONTENT["guard-pull-defense-knee-middle"];

  const handleBackToTemplates = () => {
    router.push("/profile/coaches/templates");
  };

  const handleContinueWithTemplate = () => {
    Alert.alert(
      "Continue with This Template",
      "This will be wired into Coach Share authoring flows in a later step.",
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Preview Template" }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Pressable
          onPress={handleBackToTemplates}
          style={{
            marginBottom: 10,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14 }}>Back to Templates</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          {template.title}
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.8, lineHeight: 20 }}>
          {template.description}
        </Text>
        <Text style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
          {template.metadata}
        </Text>

        <View
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
          }}
        >
          <Text style={{ fontSize: 14, opacity: 0.8, lineHeight: 20 }}>
            This is a quick preview step before you customize and publish the
            program pack. You will be able to adjust details and wiring to Coach
            Share authoring flows in a later iteration.
          </Text>
        </View>

        <Pressable
          onPress={handleContinueWithTemplate}
          style={{
            marginTop: 18,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "500" }}>
            Continue with This Template
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

