import { Stack, router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { loadDevFlags, saveDevFlags } from "../../../src/config/devFlagsStore";
import {
  DEFAULT_DEV_FLAGS,
  type DevFlagKey,
  type DevFlags,
} from "../../../src/config/flags";
import { isDev } from "../../../src/config/runtime";

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

function DevNavButton({
  title,
  subtitle,
  path,
}: {
  title: string;
  subtitle?: string;
  path: Href;
}) {
  return (
    <Pressable
      onPress={() => router.push(path)}
      style={{
        marginTop: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
      }}
    >
      <Text style={{ fontSize: 16 }}>{title}</Text>
      {subtitle ? (
        <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.65 }}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
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

        {flags.enableHiddenTabs ? (
          <View style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 12, letterSpacing: 0.6, opacity: 0.7 }}>
              DEV SHORTCUTS
            </Text>

            <DevNavButton
              title="Open Health (hidden)"
              subtitle="Hidden route: /health"
              path="/health"
            />
            <DevNavButton
              title="Open Gear (hidden)"
              subtitle="Hidden route: /gear"
              path="/gear"
            />
            <DevNavButton
              title="Open Fundamentals (hidden)"
              subtitle="Hidden route: /Fundamentals"
              path="/Fundamentals"
            />
            <DevNavButton
              title="Open Welcome (dev)"
              subtitle="Useful for testing onboarding flow"
              path="/welcome"
            />
          </View>
        ) : null}

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