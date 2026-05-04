import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useDeviceRole } from "../../../src/deviceRole/DeviceRoleProvider";
import { isParentAllowedCoachSegments } from "../../../src/deviceRole/coachRouteGate";

export default function CoachesStackLayout() {
  const mountRef = useRef(0);
  useEffect(() => {
    mountRef.current += 1;
    console.log("[MOUNT_TRACE:THIS_WEEK_STACK_LAYOUT]", mountRef.current);
  }, []);

  const segments = useSegments();
  const router = useRouter();
  const { role, loading } = useDeviceRole();

  useEffect(() => {
    if (loading) return;
    if (role !== "parent") return;
    if (isParentAllowedCoachSegments(segments)) return;
    router.replace("/this-week");
  }, [loading, role, router, segments]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
        }}
      />

      {loading && (
        <View style={styles.bootOverlay}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bootOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    zIndex: 999,
  },
});
