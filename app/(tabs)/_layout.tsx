import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
  <Tabs.Screen name="profile" options={{ title: "Profile" }} />
  <Tabs.Screen name="training" options={{ title: "Training" }} />

  {/* Hide session editor route from the tab bar */}
  <Tabs.Screen name="training/[id]" options={{ href: null }} />

  {/* Hide future tabs until MVP */}
  <Tabs.Screen name="health" options={{ href: null }} />
  <Tabs.Screen name="gear" options={{ href: null }} />
  <Tabs.Screen name="Fundamentals" options={{ href: null }} />
  <Tabs.Screen name="welcome" options={{ href: null }} />
  <Tabs.Screen name="jj101" options={{ href: null }} />
</Tabs>
  );
}
