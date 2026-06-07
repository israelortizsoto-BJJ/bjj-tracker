import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getAppVariant, isDev } from "../src/config/runtime";
import { DeviceRoleProvider } from "../src/deviceRole/DeviceRoleProvider";
import { logAsyncStorageInventory } from "../src/dev/persistenceAudit";
import { ensureStorageUpToDate } from "../src/storage/migrations";

export default function RootLayout() {
  const mountRef = useRef(0);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    console.log("[ENV CHECK]", {
      appVariant: getAppVariant(),
      isDev: isDev(),
      __DEV__,
      env: process.env.APP_VARIANT,
    });
  }, []);

  useEffect(() => {
    mountRef.current += 1;
    console.log("[MOUNT_TRACE:ROOT_LAYOUT]", mountRef.current);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await logAsyncStorageInventory("startup_pre_migration");
        await ensureStorageUpToDate();
        await logAsyncStorageInventory("startup_post_migration");
      } catch (e) {
        console.warn("Storage migration failed:", e);
      } finally {
        if (alive) setStorageReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!storageReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DeviceRoleProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
          </Stack>
        </DeviceRoleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
