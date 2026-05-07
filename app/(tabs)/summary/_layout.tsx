import { Stack } from "expo-router";

export default function SummaryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="add-athlete" options={{ title: "Add Athlete" }} />
      <Stack.Screen name="profile" options={{ title: "Athlete Profile" }} />
      <Stack.Screen name="onboarding" options={{ title: "Athlete setup" }} />
      <Stack.Screen name="onboarding-skills" options={{ title: "Your skills" }} />
    </Stack>
  );
}
