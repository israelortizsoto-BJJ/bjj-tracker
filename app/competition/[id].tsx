import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { useDeviceRole } from "../../src/deviceRole/DeviceRoleProvider";
import { appendCompetitionLaunchContext } from "../../src/features/competition/competitionNavigationContract";
import { getKidCompetitionEntryById } from "../../src/storage/kidCompetitionStore";

/**
 * Deep link / Compete tab: `/competition/[id]` resolves the kid entry and opens the existing
 * pilot edit screen (parent `this-week` path or coach path) with `entryId` set.
 */
export default function CompetitionEntryDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idText = Array.isArray(id) ? id[0] : id;
  const { role, loading: roleLoading } = useDeviceRole();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (roleLoading) return;
    let cancelled = false;
    (async () => {
      if (!idText?.trim()) {
        setFailed(true);
        router.back();
        return;
      }
      const found = await getKidCompetitionEntryById(idText);
      if (cancelled) return;
      if (!found) {
        setFailed(true);
        Alert.alert("Not found", "This competition could not be found.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }
      const q = `?entryId=${encodeURIComponent(idText)}`;
      const editorHref =
        role === "coach"
          ? `/coach/kid/${found.kidId}/competition/edit${q}`
          : `/this-week/kid/${found.kidId}/competition/edit${q}`;
      const href: Href =
        appendCompetitionLaunchContext(editorHref, {
          launchSurface: "deep_link",
          returnClass: "compete",
        }) as Href;
      router.replace(href);
    })();
    return () => {
      cancelled = true;
    };
  }, [idText, role, roleLoading]);

  if (failed) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ title: "Competition", headerShown: true, headerBackTitle: "Back" }} />
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3f4f6" }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    </>
  );
}
