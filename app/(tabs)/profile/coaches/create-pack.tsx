import { Stack } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

export default function CreateProgramPackScreen() {
  const handleUseTemplate = () => {
    Alert.alert(
      "Use Template",
      "Template-based program pack authoring will be added here.",
    );
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          Coach Share · Authoring
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
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
            }}
          >
            <Text style={{ fontSize: 16 }}>Use Template</Text>
            <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
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
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 16 }}>Customize Existing Template</Text>
            <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
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
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 16 }}>Start From Scratch</Text>
            <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
              Begin with an empty pack and build everything yourself.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

