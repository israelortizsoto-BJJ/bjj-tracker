import { useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { sharedMatchMediaVerifiedCompletionReplayClientEnabled } from "../config/sharedMatchMediaUploadFlags";
import {
  releaseSynchronousReplayAttempt,
  replayOneParentVerifiedMatchMediaCompletion,
  tryAcquireSynchronousReplayAttempt,
  type ParentVerifiedCompletionReplayResult,
} from "../domain/competition/replayParentVerifiedMatchMediaCompletion";

/** DEV-only operator control for one explicitly identified upload_complete row. */
export function VerifiedCompletionReplayDevScreen(): ReactNode {
  const [sharedAthleteId, setSharedAthleteId] = useState("");
  const [sharedCompetitionId, setSharedCompetitionId] = useState("");
  const [matchLineageKey, setMatchLineageKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParentVerifiedCompletionReplayResult | null>(null);
  const inFlightRef = useRef(false);

  if (!__DEV__) return null;
  const canRun = Boolean(sharedMatchMediaVerifiedCompletionReplayClientEnabled && sharedAthleteId.trim() && sharedCompetitionId.trim() && matchLineageKey.trim() && !busy);
  const onRun = async () => {
    if (!canRun || !tryAcquireSynchronousReplayAttempt(inFlightRef)) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await replayOneParentVerifiedMatchMediaCompletion({
          sharedAthleteId,
          sharedCompetitionId,
          matchLineageKey,
        }),
      );
    } finally {
      releaseSynchronousReplayAttempt(inFlightRef);
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Verified completion replay (DEV)</Text>
      <Text style={styles.subtitle}>
        Replays exactly one persisted upload_complete record. It does not search records or retry automatically.
      </Text>
      {!sharedMatchMediaVerifiedCompletionReplayClientEnabled ? <Text style={styles.blocked}>Replay is unavailable until the DEV replay gate is exactly &quot;1&quot;.</Text> : null}
      <Text style={styles.label}>Shared athlete ID</Text>
      <TextInput style={styles.input} value={sharedAthleteId} onChangeText={setSharedAthleteId} autoCapitalize="none" autoCorrect={false} />
      <Text style={styles.label}>Shared competition ID</Text>
      <TextInput style={styles.input} value={sharedCompetitionId} onChangeText={setSharedCompetitionId} autoCapitalize="none" autoCorrect={false} />
      <Text style={styles.label}>Canonical match lineage key</Text>
      <TextInput style={styles.input} value={matchLineageKey} onChangeText={setMatchLineageKey} autoCapitalize="none" autoCorrect={false} />
      <Pressable accessibilityRole="button" disabled={!canRun} onPress={() => void onRun()} style={[styles.button, !canRun && styles.disabled]}>
        <Text style={styles.buttonText}>{busy ? "Replaying…" : "Replay one completion"}</Text>
      </Pressable>
      {result ? <View style={styles.result}><Text style={styles.resultText}>{JSON.stringify(result, null, 2)}</Text></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#111", flexGrow: 1, padding: 16, paddingBottom: 40 },
  title: { color: "#f5d78e", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#aaa", fontSize: 13, lineHeight: 18, marginBottom: 16 },
  blocked: { color: "#f88", fontSize: 13, lineHeight: 18, marginBottom: 8 },
  label: { color: "#ccc", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#1e1e1e", borderColor: "#444", borderRadius: 8, borderWidth: 1, color: "#fff", paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: "#3d2a14", borderColor: "#d4ad4f", borderRadius: 8, borderWidth: 1, marginTop: 24, paddingVertical: 14 },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#f5d78e", fontSize: 15, fontWeight: "700", textAlign: "center" },
  result: { backgroundColor: "#1a1a1a", borderColor: "#333", borderRadius: 8, borderWidth: 1, marginTop: 20, padding: 12 },
  resultText: { color: "#bbb", fontFamily: "Menlo", fontSize: 11 },
});
