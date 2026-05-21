import { useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  repairCanonicalAthleteLineage,
  type RepairCanonicalAthleteLineageResult,
} from "./repairCanonicalAthleteLineage";

/**
 * DEV-only manual lineage repair — explicit ids pasted by operator; no auto-detect.
 */
export function LineageRepairDevScreen(): ReactNode {
  const [canonicalId, setCanonicalId] = useState("");
  const [staleId, setStaleId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [repairReason, setRepairReason] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepairCanonicalAthleteLineageResult | null>(null);

  if (!__DEV__) return null;

  const canRun =
    canonicalId.trim().length > 0 &&
    staleId.trim().length > 0 &&
    displayName.trim().length > 0 &&
    repairReason.trim().length > 0 &&
    !busy;

  const onRun = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const out = await repairCanonicalAthleteLineage({
        canonicalSharedAthleteId: canonicalId,
        staleSharedAthleteId: staleId,
        athleteDisplayName: displayName,
        repairReason,
        repairSource: "dev_ui",
        dryRun,
      });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Canonical lineage repair (DEV)</Text>
      <Text style={styles.subtitle}>
        Manual operator repair for one confirmed historical split. Paste ids explicitly — no
        auto-detect or one-click heal.
      </Text>

      <Text style={styles.label}>Canonical shared athlete id</Text>
      <TextInput
        style={styles.input}
        value={canonicalId}
        onChangeText={setCanonicalId}
        placeholder="shared_ath_…"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Stale shared athlete id</Text>
      <TextInput
        style={styles.input}
        value={staleId}
        onChangeText={setStaleId}
        placeholder="shared_ath_…"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Athlete display name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Exact name for audit"
      />

      <Text style={styles.label}>Repair reason / source note</Text>
      <TextInput
        style={styles.input}
        value={repairReason}
        onChangeText={setRepairReason}
        placeholder="e.g. build-33.5 manual split recovery"
        autoCapitalize="none"
      />

      <View style={styles.row}>
        <Text style={styles.label}>Dry run (no writes)</Text>
        <Switch value={dryRun} onValueChange={setDryRun} />
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canRun}
        onPress={() => void onRun()}
        style={[styles.button, !canRun && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{dryRun ? "Preview repair" : "Apply repair"}</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>
            {result.dryRun ? "Dry-run preview" : "Repair applied"}
          </Text>
          <Text style={styles.resultMono}>
            Stores: {result.preview.affectedStores.join(", ") || "(none)"}
          </Text>
          <Text style={styles.resultMono}>
            Mutations: {result.mutations.length}
          </Text>
          <Text style={styles.resultMono}>
            Post-scan warnings: {result.postValidationWarnings.length}
          </Text>
          {result.postValidationWarnings.length > 0 ? (
            <Text style={styles.resultMono}>
              Codes:{" "}
              {[...new Set(result.postValidationWarnings.map((w) => w.code))].join(", ")}
            </Text>
          ) : null}
          <Text style={styles.hint}>
            Check Metro for [LINEAGE_REPAIR_PREVIEW] and [LINEAGE_REPAIR_MUTATION] logs.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111",
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    color: "#f5d78e",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  label: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#1e1e1e",
    borderColor: "#444",
    borderRadius: 8,
    borderWidth: 1,
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  button: {
    backgroundColor: "#3d2a14",
    borderColor: "#d4ad4f",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 24,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#f5d78e",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  error: {
    color: "#f88",
    fontSize: 13,
    marginTop: 16,
  },
  resultBox: {
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 20,
    padding: 12,
  },
  resultTitle: {
    color: "#9cf",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  resultMono: {
    color: "#bbb",
    fontFamily: "Menlo",
    fontSize: 11,
    marginBottom: 4,
  },
  hint: {
    color: "#888",
    fontSize: 11,
    marginTop: 8,
  },
});
