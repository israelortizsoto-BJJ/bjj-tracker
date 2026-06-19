import { Stack, router, type Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  captureIncidentBundle,
  exportIncidentBundleJson,
  generateIncidentCorrelationId,
} from "../../../src/incident-capture";

import { loadDevFlags, saveDevFlags } from "../../../src/config/devFlagsStore";
import {
  DEFAULT_DEV_FLAGS,
  type DevFlagKey,
  type DevFlags,
} from "../../../src/config/flags";
import {
  getAppVariant,
  isDev,
  showInternalProfileControls,
} from "../../../src/config/runtime";
import {
  clearCoachShareDemo,
  seedCoachShareDemo,
} from "../../../src/dev/seedCoachShare";
import {
  clearCoachKidsDemo,
  seedCoachKidsDemo,
} from "../../../src/dev/seedCoachKids";
import { useDeviceRole } from "../../../src/deviceRole/DeviceRoleProvider";
import type { DeviceRole } from "../../../src/storage/deviceRoleStore";

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

function DevActionButton({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void | Promise<void>;
}) {
  return (
    <Pressable
      onPress={onPress}
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
  const canShowDevSettings = showInternalProfileControls();
  const { role, setRole: setDeviceRole } = useDeviceRole();
  const [ready, setReady] = useState(false);
  const [flags, setFlags] = useState<DevFlags>(DEFAULT_DEV_FLAGS);
  const [incidentCorrelationId, setIncidentCorrelationId] = useState("");
  const [isExportingIncidentBundle, setIsExportingIncidentBundle] = useState(false);

  console.log("[DEV SETTINGS DEBUG]", {
    isDev: isDev(),
    showInternalProfileControls: showInternalProfileControls(),
    appVariant: getAppVariant?.(),
  });

  useEffect(() => {
    (async () => {
      if (!canShowDevSettings) {
        setReady(true);
        return;
      }
      const loaded = await loadDevFlags();
      setFlags(loaded);
      setIncidentCorrelationId(generateIncidentCorrelationId());
      setReady(true);
    })();
  }, [canShowDevSettings]);

  async function exportIncidentBundle() {
    if (!role) {
      Alert.alert("Export failed", "Select a device role before exporting.");
      return;
    }
    if (incidentCorrelationId.trim().length < 8) {
      Alert.alert("Export failed", "Enter a correlation ID (at least 8 characters).");
      return;
    }

    setIsExportingIncidentBundle(true);
    try {
      const bundle = await captureIncidentBundle({
        deviceRole: role,
        incidentCorrelationId: incidentCorrelationId.trim(),
      });
      const { json, filename } = exportIncidentBundleJson(bundle);
      await Clipboard.setStringAsync(json);

      if (FileSystem.cacheDirectory) {
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        try {
          await Share.share({ url: fileUri, title: filename });
        } catch {
          // Clipboard is the primary delivery path.
        }
      }

      Alert.alert(
        "Incident bundle exported",
        `Correlation ID: ${bundle.incidentCorrelationId}\n\nBundle JSON copied to clipboard.`,
      );
    } catch (error) {
      Alert.alert(
        "Export failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setIsExportingIncidentBundle(false);
    }
  }

  if (!canShowDevSettings) {
    return (
      <>
        <Stack.Screen options={{ title: "Developer Settings" }} />
        <View style={{ padding: 16 }}>
          <Text>
            DEBUG:
            {"\n"}isDev: {String(isDev())}
            {"\n"}showInternal: {String(showInternalProfileControls())}
          </Text>
          <View style={{ marginTop: 20 }}>
            <Text>FORCED ROLE CONTROLS (DEBUG)</Text>
            <Button
              title="Switch to Coach"
              onPress={() => setDeviceRole("coach")}
            />
            <Button
              title="Switch to Parent"
              onPress={() => setDeviceRole("parent")}
            />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700" }}>Dev Settings</Text>
          <Text style={{ marginTop: 12, fontSize: 16, opacity: 0.7 }}>
            Dev settings are not available
          </Text>
        </View>
      </>
    );
  }

  async function switchRole(next: DeviceRole) {
    await setDeviceRole(next);
  }

  async function setFlag(key: DevFlagKey, next: boolean) {
    const updated: DevFlags = { ...flags, [key]: next };
    setFlags(updated);
    await saveDevFlags(updated);
  }

  async function reset() {
    setFlags(DEFAULT_DEV_FLAGS);
    await saveDevFlags(DEFAULT_DEV_FLAGS);
  }
   async function seedCoachShare() {
    try {
      await seedCoachShareDemo();
      Alert.alert("Coach Share seeded", "Demo data was written successfully.");
    } catch (error) {
      Alert.alert("Seed failed", error instanceof Error ? error.message : "Unknown error");
    }
  }
    async function clearCoachShare() {
    try {
      await clearCoachShareDemo();
      Alert.alert("Coach Share cleared", "Demo data was removed successfully.");
    } catch (error) {
      Alert.alert(
        "Clear failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  async function seedCoachKids() {
    try {
      await seedCoachKidsDemo();
      Alert.alert("Kids seeded", "Demo kid roster and weekly focus were added.");
    } catch (error) {
      Alert.alert("Seed failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function clearCoachKids() {
    try {
      await clearCoachKidsDemo();
      Alert.alert("Kids cleared", "Demo kid data was removed successfully.");
    } catch (error) {
      Alert.alert(
        "Clear failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
  return (
    <>
      <Stack.Screen options={{ title: "Developer Settings" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text>
          DEBUG:
          {"\n"}isDev: {String(isDev())}
          {"\n"}showInternal: {String(showInternalProfileControls())}
        </Text>
        <View style={{ marginTop: 20 }}>
          <Text>FORCED ROLE CONTROLS (DEBUG)</Text>
          <Button
            title="Switch to Coach"
            onPress={() => setDeviceRole("coach")}
          />
          <Button
            title="Switch to Parent"
            onPress={() => setDeviceRole("parent")}
          />
        </View>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Dev Settings</Text>
        <Text style={{ marginTop: 8, fontSize: 14, opacity: 0.7 }}>
          Current role: {role ?? "not selected"}
        </Text>

        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 12, letterSpacing: 0.6, opacity: 0.7 }}>
            ROLE SWITCHER
          </Text>
          <DevActionButton
            title="Switch to Coach"
            subtitle="Use coach-facing navigation and tools"
            onPress={() => switchRole("coach")}
          />
          <DevActionButton
            title="Switch to Parent"
            subtitle="Use parent-facing This Week experience"
            onPress={() => switchRole("parent")}
          />
        </View>

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
      subtitle="Hidden route: /gear → /learn/gear"
      path="/gear"
    />
    <DevNavButton
      title="Open Fundamentals (hidden)"
      subtitle="Hidden route: /Fundamentals → /learn/fundamentals"
      path="/Fundamentals"
    />
    <DevNavButton
      title="Open Welcome (dev)"
      subtitle="Useful for testing onboarding flow"
      path="/welcome?force=1"
    />
  </View>
) : null}

<View style={{ marginTop: 18 }}>
  <Text style={{ fontSize: 12, letterSpacing: 0.6, opacity: 0.7 }}>
    DEV DATA
  </Text>

  <DevActionButton
    title="Seed Coach Share demo"
    subtitle="Adds 1 coach, 1 pack, 1 enrollment, and 1 assignment"
    onPress={seedCoachShare}
  />
    <DevActionButton
    title="Clear Coach Share demo"
    subtitle="Removes seeded coach, pack, enrollment, and assignment data"
    onPress={clearCoachShare}
  />

  <DevActionButton
    title="Seed Kids demo"
    subtitle="Adds kid roster, weekly focus, and sample competitions (pilot-only)"
    onPress={seedCoachKids}
  />

  <DevActionButton
    title="Clear Kids demo"
    subtitle="Removes seeded kids, weekly focus, and competition entries"
    onPress={clearCoachKids}
  />
</View>

        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 12, letterSpacing: 0.6, opacity: 0.7 }}>
            INCIDENT CAPTURE
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            For cross-device incidents, export both devices within 5 minutes using
            the same correlation ID.
          </Text>
          <Text style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
            Device role: {role ?? "not selected"}
          </Text>
          <Text style={{ marginTop: 12, fontSize: 14 }}>Correlation ID</Text>
          <TextInput
            value={incidentCorrelationId}
            onChangeText={setIncidentCorrelationId}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
            }}
          />
          <DevActionButton
            title="New correlation ID"
            subtitle="Generate a fresh UUID for a new incident"
            onPress={() => setIncidentCorrelationId(generateIncidentCorrelationId())}
          />
          <DevActionButton
            title={isExportingIncidentBundle ? "Exporting…" : "Export Incident Bundle"}
            subtitle="Copies JSON to clipboard; share sheet when available"
            onPress={exportIncidentBundle}
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
