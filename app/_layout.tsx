import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ensureStorageUpToDate } from "../src/storage/migrations";

export default function RootLayout() {
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await ensureStorageUpToDate();
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
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
