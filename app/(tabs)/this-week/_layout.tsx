import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useDeviceRole } from "../../../src/deviceRole/DeviceRoleProvider";
import { isParentAllowedCoachSegments } from "../../../src/deviceRole/coachRouteGate";

export default function CoachesStackLayout() {
  const segments = useSegments();
  const router = useRouter();
  const { role, loading } = useDeviceRole();

  useEffect(() => {
    if (loading) return;
    if (role !== "parent") return;
    if (isParentAllowedCoachSegments(segments)) return;
    router.replace("/this-week");
  }, [loading, role, router, segments]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
      }}
    />
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f2f8" },
});
