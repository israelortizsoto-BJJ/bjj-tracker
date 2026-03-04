import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
  <Tabs.Screen name="profile" options={{ title: "Profile" }} />
  <Tabs.Screen name="training" options={{ title: "Training" }} />

  {/* Hide session editor route from the tab bar */}
  <Tabs.Screen name="training/[id]" options={{ href: null }} />

  {/* Hide future tabs until MVP */}
  <Tabs.Screen name="health" options={{ href: null, title: "Health" }} />
  <Tabs.Screen name="gear" options={{ href: null, title: "Gear" }} />
  <Tabs.Screen name="fundamentals" options={{ href: null, title: "Fundamentals" }} />
  <Tabs.Screen name="welcome" options={{ href: null, title: "Welcome" }} />
</Tabs>
  );
}
