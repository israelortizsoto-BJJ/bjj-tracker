import { Stack } from "expo-router";
import { View, Text } from "react-native";

export default function CoachesScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Coaches & Programs" }} />
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, marginBottom: 8 }}>Coach Share (Scaffold)</Text>
        <Text style={{ fontSize: 14, opacity: 0.7 }}>
          Placeholder screen. Dev-only for now. Next: packs, enrollments, and assignments.
        </Text>
      </View>
    </>
  );
}
