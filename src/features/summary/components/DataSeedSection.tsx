import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Mode = "parent" | "coach" | "competitor" | "hobbyist";

export type DataSeedSignals = {
  sessionsThisWeek: number;
  hasTopSystem: boolean;
  hasTopTechnique: boolean;
  hasCurrentFocus: boolean;
  hasGiNoGi: boolean;
  /** When wired to stores; omit or false → treat as absent for competition cues. */
  hasCompetitionLogs?: boolean;
};

type Props = {
  mode: Mode;
  signals: DataSeedSignals;
};

type Row = { type: "action" | "message"; label: string };

function compsLogged(s: DataSeedSignals): boolean {
  return s.hasCompetitionLogs === true;
}

function buildContextMessages(mode: Mode, s: DataSeedSignals): string[] {
  const wc = s.sessionsThisWeek;
  const hasComps = compsLogged(s);

  const out: string[] = [];

  if (wc === 0 && mode === "hobbyist") {
    out.push("Log your first session so summaries can spotlight systems and repetitions.");
  }

  if (wc === 0 && mode === "competitor") {
    out.push("Log mats time first—prep metrics need training volume before comps stack cleanly.");
  }

  if (!hasComps && mode === "competitor" && wc >= 1) {
    out.push("Add your last competition snapshot so pacing and adrenaline stay honest.");
  }

  if (wc === 0 && mode === "parent") {
    out.push("Bring in one supervised session so parental guidance echoes what actually happened.");
  }

  if (wc === 0 && mode === "coach") {
    out.push("Log a team session—even light notes—so dashboards reflect your room's pulse.");
  }

  if (!s.hasGiNoGi && wc >= 1 && mode !== "parent") {
    out.push(
      "Tag GI or no-Gi gear on rolls—split signals stay sharper than guessing both every week.",
    );
  }

  if (!s.hasTopTechnique && wc >= 2) {
    out.push("Name the technique you chased most so repetition surfaces without spreadsheets.");
  }

  if (!s.hasCurrentFocus && wc >= 2) {
    out.push(
      "Current focus emerges after positional tags accumulate for consecutive training weeks.",
    );
  }

  return out;
}

function getModeActions(mode: Mode): Row[] {
  if (mode === "competitor") {
    return [
      { type: "action", label: "Add Competitions" },
      { type: "action", label: "Add Techniques" },
      { type: "action", label: "Add Wins/Losses" },
    ];
  }

  if (mode === "hobbyist") {
    return [{ type: "message", label: "Keep logging sessions to unlock clearer focus trends." }];
  }

  if (mode === "parent") {
    return [
      { type: "action", label: "Add Athlete Notes" },
      { type: "action", label: "Set Weekly Check-in" },
    ];
  }

  return [
    { type: "action", label: "Add Class Themes" },
    { type: "action", label: "Add Team Focus" },
  ];
}

function mergeContextWithActions(mode: Mode, contextualLines: string[], base: Row[]): Row[] {
  const contextualRows: Row[] = contextualLines.map((label): Row => ({ type: "message", label }));

  const out: Row[] = [...contextualRows];
  const lowerCtx = contextualLines.join(" ").toLowerCase();

  for (const row of base) {
    if (row.type === "message") {
      const bl = row.label.toLowerCase();
      const echoesSessionHint =
        (bl.includes("keep logging") || bl.includes("logging sessions")) &&
        lowerCtx.includes("log") &&
        lowerCtx.includes("session");
      if (echoesSessionHint) continue;
    }
    out.push(row);
  }

  return out.length ? out : base;
}

export default function DataSeedSection({ mode, signals }: Props) {
  const { rows, contextualCount } = useMemo(() => {
    const lines = buildContextMessages(mode, signals);
    const base = getModeActions(mode);
    const merged = mergeContextWithActions(mode, lines, base);
    return { rows: merged, contextualCount: lines.length };
  }, [mode, signals]);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Data Seed</Text>
      <Text style={styles.sectionSubtitle}>
        Starter actions and context for gaps in today&apos;s metrics.
      </Text>
      <View style={styles.content}>
        {rows.map((item, idx) =>
          item.type === "message" ? (
            <Text
              key={`${item.label}-${idx}`}
              style={[styles.message, idx < contextualCount && styles.guidanceAccent]}
            >
              {item.label}
            </Text>
          ) : (
            <Pressable key={`${item.label}-${idx}`} style={styles.action}>
              <Text style={styles.actionText}>{item.label}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#12161C",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 19,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  content: {
    gap: 8,
    marginTop: 2,
  },
  action: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "#0F141B",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  actionText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
  },
  guidanceAccent: {
    borderLeftWidth: 3,
    borderLeftColor: "#38BDF8",
    paddingLeft: 11,
    borderColor: "#1F2937",
    backgroundColor: "#0F141B",
  },
  message: {
    color: "#D1D5DB",
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: "#0F141B",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
});
