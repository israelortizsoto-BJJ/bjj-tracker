import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, router, type Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
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
  formatIncidentCaptureStageReadout,
  generateIncidentCorrelationId,
  isRecentIncompleteCapture,
  loadIncidentCaptureDebugRecord,
  type IncidentCaptureDebugRecord,
} from "../../../src/incident-capture";
import {
  dumpCompetitionAuditorTrail,
  type DumpCompetitionAuditorTrailResult,
} from "../../../src/competition-state-auditor/dumpCompetitionAuditorTrail";

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

const INCIDENT_EXPORT_DEBUG_STORAGE_KEY = "mm:v1:incidentExportDebug";
const INCIDENT_EXPORT_CRASH_ALERT_WINDOW_MS = 5 * 60 * 1000;

type IncidentExportStage =
  | "pre_capture"
  | "capture_call_boundary"
  | "post_capture"
  | "pre_stringify"
  | "post_stringify"
  | "pre_clipboard"
  | "post_clipboard"
  | "pre_filesystem"
  | "post_filesystem"
  | "filesystem_skipped_no_cache"
  | "pre_share"
  | "post_share"
  | "export_complete";

type IncidentExportDebugRecord = {
  stage: IncidentExportStage;
  at: string;
  correlationId: string;
  jsonBytes?: number;
};

async function loadIncidentExportDebugRecord(): Promise<IncidentExportDebugRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(INCIDENT_EXPORT_DEBUG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IncidentExportDebugRecord>;
    if (typeof parsed.stage !== "string" || typeof parsed.at !== "string") return null;
    return {
      stage: parsed.stage as IncidentExportStage,
      at: parsed.at,
      correlationId: typeof parsed.correlationId === "string" ? parsed.correlationId : "",
      ...(typeof parsed.jsonBytes === "number" ? { jsonBytes: parsed.jsonBytes } : {}),
    };
  } catch {
    return null;
  }
}

async function persistIncidentExportStage(
  stage: IncidentExportStage,
  options: { correlationId: string; jsonBytes?: number },
): Promise<IncidentExportDebugRecord> {
  const record: IncidentExportDebugRecord = {
    stage,
    at: new Date().toISOString(),
    correlationId: options.correlationId,
    ...(options.jsonBytes !== undefined ? { jsonBytes: options.jsonBytes } : {}),
  };
  await AsyncStorage.setItem(INCIDENT_EXPORT_DEBUG_STORAGE_KEY, JSON.stringify(record));
  return record;
}

function formatIncidentExportStageReadout(record: IncidentExportDebugRecord | null): string {
  if (!record) return "none";
  const bytes =
    record.jsonBytes !== undefined ? `, ${record.jsonBytes.toLocaleString()} bytes` : "";
  return `${record.stage} (${record.at}${bytes})`;
}

function isRecentIncompleteExport(record: IncidentExportDebugRecord): boolean {
  if (record.stage === "export_complete") return false;
  const atMs = Date.parse(record.at);
  if (Number.isNaN(atMs)) return false;
  return Date.now() - atMs < INCIDENT_EXPORT_CRASH_ALERT_WINDOW_MS;
}

function formatCompetitionAuditorClipboardReport(
  result: DumpCompetitionAuditorTrailResult,
): string {
  const snapshotJson = (snapshot: unknown): string =>
    snapshot ? JSON.stringify(snapshot, null, 2) : "(missing)";

  return [
    "=== Competition State Auditor Phase A ===",
    result.readout,
    "--- S1 parent_canonical ---",
    snapshotJson(result.snapshots.s1),
    "--- S2 parent_publish ---",
    snapshotJson(result.snapshots.s2),
    "--- S3 worker_persist ---",
    snapshotJson(result.snapshots.s3),
  ].join("\n\n");
}

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
  const [isDumpingCompetitionAuditor, setIsDumpingCompetitionAuditor] = useState(false);
  const [lastExportStage, setLastExportStage] = useState<IncidentExportDebugRecord | null>(null);
  const [lastCaptureStage, setLastCaptureStage] = useState<IncidentCaptureDebugRecord | null>(null);
  // INV8 — temporary; remove after INV8 closes. Not a DevFlagKey; not persisted.
  const [inv8SuppressArtifactHydrationBump, setInv8SuppressArtifactHydrationBump] =
    useState(
      () =>
        typeof __DEV__ !== "undefined" &&
        __DEV__ &&
        (globalThis as { __INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__?: boolean })
          .__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__ === true,
    );
  const postCrashAlertShownRef = useRef(false);
  const postCaptureCrashAlertShownRef = useRef(false);

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

      const exportDebug = await loadIncidentExportDebugRecord();
      setLastExportStage(exportDebug);
      if (
        exportDebug &&
        isRecentIncompleteExport(exportDebug) &&
        !postCrashAlertShownRef.current
      ) {
        postCrashAlertShownRef.current = true;
        const bytesLine =
          exportDebug.jsonBytes !== undefined
            ? `\nJSON size: ${exportDebug.jsonBytes.toLocaleString()} bytes`
            : "";
        Alert.alert(
          "Export may have crashed",
          `Last completed stage: ${exportDebug.stage}\nAt: ${exportDebug.at}\nCorrelation ID: ${exportDebug.correlationId}${bytesLine}`,
        );
      }

      const captureDebug = await loadIncidentCaptureDebugRecord();
      setLastCaptureStage(captureDebug);
      if (
        captureDebug &&
        isRecentIncompleteCapture(captureDebug) &&
        !postCaptureCrashAlertShownRef.current
      ) {
        postCaptureCrashAlertShownRef.current = true;
        Alert.alert(
          "Capture may have crashed",
          `Last completed stage: ${captureDebug.stage}\nCorrelation ID: ${captureDebug.correlationId}`,
        );
      }

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

    const correlationId = incidentCorrelationId.trim();

    setIsExportingIncidentBundle(true);
    try {
      await persistIncidentExportStage("pre_capture", { correlationId });
      setLastExportStage(
        await persistIncidentExportStage("capture_call_boundary", { correlationId }),
      );
      const bundle = await captureIncidentBundle({
        deviceRole: role,
        incidentCorrelationId: correlationId,
      });
      setLastCaptureStage(await loadIncidentCaptureDebugRecord());
      setLastExportStage(await persistIncidentExportStage("post_capture", { correlationId }));

      await persistIncidentExportStage("pre_stringify", { correlationId });
      const { json, filename } = exportIncidentBundleJson(bundle);
      const jsonBytes = json.length;
      setLastExportStage(
        await persistIncidentExportStage("post_stringify", { correlationId, jsonBytes }),
      );

      await persistIncidentExportStage("pre_clipboard", { correlationId, jsonBytes });
      await Clipboard.setStringAsync(json);
      setLastExportStage(
        await persistIncidentExportStage("post_clipboard", { correlationId, jsonBytes }),
      );

      if (FileSystem.cacheDirectory) {
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        await persistIncidentExportStage("pre_filesystem", { correlationId, jsonBytes });
        await FileSystem.writeAsStringAsync(fileUri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        setLastExportStage(
          await persistIncidentExportStage("post_filesystem", { correlationId, jsonBytes }),
        );
        try {
          await persistIncidentExportStage("pre_share", { correlationId, jsonBytes });
          await Share.share({ url: fileUri, title: filename });
          setLastExportStage(
            await persistIncidentExportStage("post_share", { correlationId, jsonBytes }),
          );
        } catch {
          // Clipboard is the primary delivery path.
        }
      } else {
        setLastExportStage(
          await persistIncidentExportStage("filesystem_skipped_no_cache", {
            correlationId,
            jsonBytes,
          }),
        );
      }

      setLastExportStage(
        await persistIncidentExportStage("export_complete", { correlationId, jsonBytes }),
      );

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

  async function dumpCompetitionAuditorTrailToClipboard() {
    setIsDumpingCompetitionAuditor(true);
    try {
      const result = await dumpCompetitionAuditorTrail({ expectedCount: 5 });
      const report = formatCompetitionAuditorClipboardReport(result);
      await Clipboard.setStringAsync(report);
      Alert.alert("Competition Auditor copied to clipboard");
    } catch (error) {
      Alert.alert(
        "Dump failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setIsDumpingCompetitionAuditor(false);
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

        {__DEV__ ? (
          <View style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 12, letterSpacing: 0.6, opacity: 0.7 }}>
              INV8 Experiment (Temporary)
            </Text>
            <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.65 }}>
              Remove after INV8 closes.
            </Text>
            <View style={{ paddingVertical: 6 }}>
              <FlagRow
                label="Suppress artifact hydration bump"
                value={inv8SuppressArtifactHydrationBump}
                onChange={(next) => {
                  // INV8 harness validation — temporary; remove after harness is certified.
                  const g = globalThis as {
                    __INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__?: boolean;
                  };
                  console.log("[INV8_HARNESS]", {
                    stage: "toggle_onChange",
                    next,
                    beforeAssign: g.__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__,
                  });
                  g.__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__ = next;
                  console.log("[INV8_HARNESS]", {
                    stage: "toggle_afterAssign",
                    assigned: next,
                    readback: g.__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__,
                    readbackEqualsTrue:
                      g.__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__ === true,
                    globalSameAsGlobalThis:
                      typeof global !== "undefined" && global === globalThis,
                  });
                  setInv8SuppressArtifactHydrationBump(next);
                }}
              />
            </View>
          </View>
        ) : null}

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

        {__DEV__ ? (
          <View style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 12, letterSpacing: 0.6, opacity: 0.7 }}>
              VERIFIED COMPLETION
            </Text>
            <DevNavButton
              title="Verified Completion Prerequisites"
              subtitle="DEV-only local prerequisite inspection"
              path={"/dev/verified-completion-replay-prerequisites" as Href}
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
          <Text style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
            Last export stage: {formatIncidentExportStageReadout(lastExportStage)}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
            Last capture stage: {formatIncidentCaptureStageReadout(lastCaptureStage)}
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

        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 12, letterSpacing: 0.6, opacity: 0.7 }}>
            COMPETITION STATE AUDITOR
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            Phase A boundary report for the active athlete. Copies formatted summary
            plus S1/S2/S3 JSON to clipboard.
          </Text>
          <DevActionButton
            title={
              isDumpingCompetitionAuditor
                ? "Dumping…"
                : "Dump Competition Auditor Trail"
            }
            subtitle="Parent canonical → publish → worker persist (read-only)"
            onPress={dumpCompetitionAuditorTrailToClipboard}
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
