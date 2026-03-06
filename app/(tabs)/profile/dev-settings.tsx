import { useEffect, useState } from "react";
import { View, Text, Switch, Pressable, ScrollView } from "react-native";
import { Stack } from "expo-router";

import { isDev } from "../../../src/config/runtime";
import {
  DEFAULT_DEV_FLAGS,
  type DevFlagKey,
  type DevFlags,
} from "../../../src/config/flags";
import { loadDevFlags, saveDevFlags } from "../../../src/config/devFlagsStore";

function FlagRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
      }}
    >
      <Text style={{ fontSize: 16 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export default function DevSettingsScreen() {
  const [ready, setReady] = useState(false);
  const [flags, setFlags] = useState<DevFlags>(DEFAULT_DEV_FLAGS);

  useEffect(() => {
    (async () => {
      if (!isDev()) return;
      const loaded = await loadDevFlags();
      setFlags(loaded);
      setReady(true);
    })();
  }, []);

  if (!isDev()) return null;

  async function setFlag(key: DevFlagKey, next: boolean) {
    const updated: DevFlags = { ...flags, [key]: next };
    setFlags(updated);
    await saveDevFlags(updated);
  }

  async function reset() {
    setFlags(DEFAULT_DEV_FLAGS);
    await saveDevFlags(DEFAULT_DEV_FLAGS);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Developer Settings" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 14, opacity: 0.7, marginBottom: 12 }}>
          Dev-only toggles. These do not appear in TestFlight builds.
        </Text>

        <View style={{ paddingVertical: 6 }}>
          <FlagRow
            label="Enable hidden tabs"
            value={flags.enableHiddenTabs}
            onChange={(v) => setFlag("enableHiddenTabs", v)}
          />
          <FlagRow
            label="Enable Coach Share scaffolding"
            value={flags.enableCoachShareScaffold}
            onChange={(v) => setFlag("enableCoachShareScaffold", v)}
          />
          <FlagRow
            label="Enable debug tools"
            value={flags.enableDebugTools}
            onChange={(v) => setFlag("enableDebugTools", v)}
          />
        </View>

        <Pressable
          onPress={reset}
          style={{
            marginTop: 18,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16 }}>Reset to defaults</Text>
        </Pressable>

        {!ready ? (
          <Text style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
            Loading…
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}
