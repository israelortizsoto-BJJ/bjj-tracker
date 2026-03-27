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
    router.push("/this-week/templates");
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
      <Stack.Screen options={{ title: "Choose Weekly Focus" }} />
      <ScrollView style={{ flex: 1, backgroundColor: UI.screenBg }} contentContainerStyle={{ padding: 16 }}>
        <Pressable
          onPress={() => router.replace("/this-week/kids")}
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
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Kids roster</Text>
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Coach Share · Coach Pilot
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          This is the coach-side pilot area for internal testing. For now, the only active path is{" "}
          <Text style={{ fontWeight: "700", color: UI.textPrimary }}>Use Template</Text>.
          The other options are future authoring paths and aren&apos;t wired yet.
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
            <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>Use Template (Pilot)</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
              Active internal test path. Pick a template and proceed through preview/selection.
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
            <Text style={{ fontSize: 16, color: UI.textPrimary }}>Customize Existing Template (Coming soon)</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
              Future path. Not yet wired for the pilot.
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
            <Text style={{ fontSize: 16, color: UI.textPrimary }}>Start From Scratch (Coming soon)</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
              Future path. Not yet wired for the pilot.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

