import { Tabs } from "expo-router";
import { useEffect, useRef } from "react";

/** Tab bar item hidden (`href: null`) and native tab stack header suppressed (OperatingHeader or nested Stack owns chrome). */
const HIDDEN = { href: null, headerShown: false } as const;

/**
 * Tab bar: only the first four screens are visible.
 *
 * Expo Router merges `Tabs.Screen` with file routes. Any direct child of this layout
 * that is not matched by a `Tabs.Screen` `name` is appended as an extra tab
 * (`useSortedScreens` / `getSortedChildren`). So every *tab-level* route must be
 * listed. Nested stack routes (e.g. `this-week/join`, `learn/fundamentals`) live
 * inside their segment layouts and must not appear here.
 *
 * Hoisted to this tab navigator (no `training/` or `profile/` `_layout.tsx`):
 * `training/[id]`, `profile/dev-settings`.
 */
export default function TabLayout() {
  const mountRef = useRef(0);
  useEffect(() => {
    mountRef.current += 1;
    console.log("[MOUNT_TRACE:TABS_LAYOUT]", mountRef.current);
  }, []);

  return (
      <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="summary" options={{ title: "Summary", headerShown: false }} />
      <Tabs.Screen name="this-week" options={{ title: "This Week", headerShown: false }} />
      <Tabs.Screen name="coach" options={{ title: "Coach", headerShown: false }} />
      <Tabs.Screen name="training" options={{ title: "Training", headerShown: false }} />
      <Tabs.Screen name="compete" options={{ title: "Compete", headerShown: false }} />
      <Tabs.Screen name="learn" options={{ title: "Learn", headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", headerShown: false }} />
      <Tabs.Screen name="welcome" options={HIDDEN} />
      <Tabs.Screen name="Fundamentals" options={HIDDEN} />
      <Tabs.Screen name="gear" options={HIDDEN} />
      <Tabs.Screen name="health" options={HIDDEN} />
      <Tabs.Screen name="training/[id]" options={HIDDEN} />
      <Tabs.Screen name="profile/dev-settings" options={HIDDEN} />
    </Tabs>
  );
}
