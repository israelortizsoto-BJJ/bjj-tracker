import { Tabs } from "expo-router";
import { useEffect, useMemo, useRef } from "react";

import { useDeviceRole } from "../../src/deviceRole/DeviceRoleProvider";

/** Tab bar item hidden (`href: null`) and native tab stack header suppressed (OperatingHeader or nested Stack owns chrome). */
const HIDDEN = { href: null, headerShown: false } as const;

const TAB_SCREEN_BASE = { headerShown: false } as const;

/**
 * Tab bar: `href: null` hides routes that stay linkable (learn, profile, hoisted stacks).
 * **This Week** vs **Coach** use role from `DeviceRoleProvider`: hidden until role hydrates,
 * then exactly one of the two is visible (parent vs coach operational lane).
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
  const { role, loading } = useDeviceRole();
  const mountRef = useRef(0);
  useEffect(() => {
    mountRef.current += 1;
    console.log("[MOUNT_TRACE:TABS_LAYOUT]", mountRef.current);
  }, []);

  const thisWeekTabOptions = useMemo(() => {
    if (loading) return HIDDEN;
    if (role === "coach") return HIDDEN;
    return { title: "This Week", ...TAB_SCREEN_BASE };
  }, [loading, role]);

  const coachTabOptions = useMemo(() => {
    if (loading) return HIDDEN;
    if (role !== "coach") return HIDDEN;
    return { title: "Coach", ...TAB_SCREEN_BASE };
  }, [loading, role]);

  return (
      <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="summary" options={{ title: "Summary", ...TAB_SCREEN_BASE }} />
      <Tabs.Screen name="this-week" options={thisWeekTabOptions} />
      <Tabs.Screen name="coach" options={coachTabOptions} />
      <Tabs.Screen name="training" options={{ title: "Training", ...TAB_SCREEN_BASE }} />
      <Tabs.Screen name="compete" options={{ title: "Compete", ...TAB_SCREEN_BASE }} />
      <Tabs.Screen name="learn" options={HIDDEN} />
      <Tabs.Screen name="profile" options={HIDDEN} />
      <Tabs.Screen name="welcome" options={HIDDEN} />
      <Tabs.Screen name="Fundamentals" options={HIDDEN} />
      <Tabs.Screen name="gear" options={HIDDEN} />
      <Tabs.Screen name="health" options={HIDDEN} />
      <Tabs.Screen name="training/[id]" options={HIDDEN} />
      <Tabs.Screen name="profile/dev-settings" options={HIDDEN} />
    </Tabs>
  );
}
