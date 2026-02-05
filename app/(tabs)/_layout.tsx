import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="healthy" options={{ title: "Healthy" }} />
      <Tabs.Screen name="gear" options={{ title: "Gear" }} />
      <Tabs.Screen name="jj101" options={{ title: "JJ 101" }} />
      <Tabs.Screen name="training" options={{ title: "Training" }} />
    </Tabs>
  );
}
