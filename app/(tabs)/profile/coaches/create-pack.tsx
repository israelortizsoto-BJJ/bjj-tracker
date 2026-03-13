import { Stack, router } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

export default function CreateProgramPackScreen() {
  const handleUseTemplate = () => {
    router.push("/profile/coaches/templates");
  };

  const handleCustomizeExisting = () => {
    Alert.alert(
      "Customize Existing Template",
      "Template customization flows will be wired up here.",
    );
  };

  const handleStartFromScratch = () => {
    Alert.alert(
      "Start From Scratch",
      "A fresh pack authoring canvas will be added here.",
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Create Program Pack" }} />
      <ScrollView style={{ flex: 1, backgroundColor: UI.screenBg }} contentContainerStyle={{ padding: 16 }}>
        <Pressable
          onPress={() => router.push("/profile/coaches")}
          style={{
            marginBottom: 10,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Coach Share</Text>
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Coach Share · Authoring
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Choose how you want to start a new program pack. These options are
          dev-only scaffolds for future authoring tools.
        </Text>

        <View style={{ marginTop: 16, gap: 12 }}>
          <Pressable
            onPress={handleUseTemplate}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
            }}
          >
            <Text style={{ fontSize: 16, color: UI.textPrimary }}>Use Template</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
              Start quickly from a pre-built program pack template.
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCustomizeExisting}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 16, color: UI.textPrimary }}>Customize Existing Template</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
              Pick an existing template and adjust modules, notes, and details.
            </Text>
          </Pressable>

          <Pressable
            onPress={handleStartFromScratch}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 16, color: UI.textPrimary }}>Start From Scratch</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
              Begin with an empty pack and build everything yourself.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

