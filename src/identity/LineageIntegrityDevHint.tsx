import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import {
  getLineageIntegrityDevSnapshot,
  resetLineageIntegrityDedupeDev,
} from "./lineageIntegrityDetection";

/**
 * Non-blocking DEV hint — does not interrupt navigation or open repair flows.
 */
export function LineageIntegrityDevHint(): ReactNode {
  const [snap, setSnap] = useState(getLineageIntegrityDevSnapshot());

  useEffect(() => {
    if (!__DEV__) return;
    const id = setInterval(() => {
      setSnap(getLineageIntegrityDevSnapshot());
    }, 2000);
    return () => clearInterval(id);
  }, []);

  if (!__DEV__ || snap.warningCount === 0) return null;

  const codeSummary = snap.codes.length > 0 ? snap.codes.join(", ") : "lineage";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        resetLineageIntegrityDedupeDev();
        console.log("[LINEAGE_INTEGRITY] dev hint pressed — dedupe cleared; re-run navigation to rescan", {
          lastRoute: snap.route,
          warningCount: snap.warningCount,
          codes: snap.codes,
        });
      }}
      style={styles.hint}
    >
      <Text style={styles.hintText} numberOfLines={2}>
        DEV lineage: {snap.warningCount} warning{snap.warningCount === 1 ? "" : "s"} ({codeSummary})
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: {
    backgroundColor: "#3d2a14",
    borderColor: "#d4ad4f",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hintText: {
    color: "#f5d78e",
    fontSize: 12,
    fontWeight: "600",
  },
});
