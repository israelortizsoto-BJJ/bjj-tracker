import { useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  inspectOneParentVerifiedCompletionReplayPrerequisites,
  type ParentVerifiedCompletionReplayPrerequisiteResult,
} from "../domain/competition/inspectParentVerifiedCompletionReplayPrerequisites";

/** DEV-only local prerequisite read. It cannot invoke replay, publication, or any Worker route. */
export function VerifiedCompletionReplayPrerequisiteInspectorDevScreen(): ReactNode {
  const [sharedAthleteId, setSharedAthleteId] = useState("");
  const [sharedCompetitionId, setSharedCompetitionId] = useState("");
  const [matchLineageKey, setMatchLineageKey] = useState("");
  const [uploadSessionId, setUploadSessionId] = useState("");
  const [matchMediaAssetId, setMatchMediaAssetId] = useState("");
  const [objectVersion, setObjectVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParentVerifiedCompletionReplayPrerequisiteResult | null>(null);
  const inFlightRef = useRef(false);
  if (!__DEV__) return null;

  const canInspect = Boolean(
    sharedAthleteId.trim() && sharedCompetitionId.trim() && matchLineageKey.trim() &&
    uploadSessionId.trim() && matchMediaAssetId.trim() && objectVersion.trim() && !busy,
  );
  const onInspect = async () => {
    if (!canInspect || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setResult(null);
    try {
      setResult(await inspectOneParentVerifiedCompletionReplayPrerequisites({
        sharedAthleteId, sharedCompetitionId, matchLineageKey, uploadSessionId, matchMediaAssetId, objectVersion,
      }));
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };
  const fields: [string, string, (value: string) => void][] = [
    ["Shared athlete ID", sharedAthleteId, setSharedAthleteId],
    ["Shared competition ID", sharedCompetitionId, setSharedCompetitionId],
    ["Canonical match lineage key", matchLineageKey, setMatchLineageKey],
    ["Upload session ID", uploadSessionId, setUploadSessionId],
    ["Match media asset ID", matchMediaAssetId, setMatchMediaAssetId],
    ["Immutable object version", objectVersion, setObjectVersion],
  ];
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Verified completion prerequisites (DEV)</Text>
    <Text style={styles.subtitle}>Reads local upload/link state only. It never sends completion, replay, publication, or session requests.</Text>
    {fields.map(([label, value, onChange]) => <View key={label}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} />
    </View>)}
    <Pressable accessibilityRole="button" disabled={!canInspect} onPress={() => void onInspect()} style={[styles.button, !canInspect && styles.disabled]}>
      <Text style={styles.buttonText}>{busy ? "Inspecting…" : "Inspect local prerequisites"}</Text>
    </Pressable>
    {result ? <View style={styles.result}><Text style={styles.resultText}>{JSON.stringify(result, null, 2)}</Text></View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#111", flexGrow: 1, padding: 16, paddingBottom: 40 },
  title: { color: "#f5d78e", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#aaa", fontSize: 13, lineHeight: 18, marginBottom: 16 },
  label: { color: "#ccc", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#1e1e1e", borderColor: "#444", borderRadius: 8, borderWidth: 1, color: "#fff", paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: "#3d2a14", borderColor: "#d4ad4f", borderRadius: 8, borderWidth: 1, marginTop: 24, paddingVertical: 14 },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#f5d78e", fontSize: 15, fontWeight: "700", textAlign: "center" },
  result: { backgroundColor: "#1a1a1a", borderColor: "#333", borderRadius: 8, borderWidth: 1, marginTop: 20, padding: 12 },
  resultText: { color: "#bbb", fontFamily: "Menlo", fontSize: 11 },
});
