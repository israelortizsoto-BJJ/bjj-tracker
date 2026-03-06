import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      {/* Visible tabs */}
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />

      {/* Dev-only routes (hidden from tab bar) */}
      <Tabs.Screen name="profile/dev-settings" options={{ href: null }} />
      <Tabs.Screen name="profile/coaches/index" options={{ href: null }} />
      <Tabs.Screen name="profile/coaches/join" options={{ href: null }} />
      <Tabs.Screen name="profile/coaches/manage" options={{ href: null }} />
      <Tabs.Screen name="training" options={{ title: "Training" }} />

      {/* Hidden routes (keep accessible via navigation, but hide from tab bar) */}
      <Tabs.Screen name="training/[id]" options={{ href: null }} />
      <Tabs.Screen name="health" options={{ href: null }} />
      <Tabs.Screen name="gear" options={{ href: null }} />
      <Tabs.Screen name="Fundamentals" options={{ href: null }} />
      <Tabs.Screen name="welcome" options={{ href: null }} />
    </Tabs>
  );
}