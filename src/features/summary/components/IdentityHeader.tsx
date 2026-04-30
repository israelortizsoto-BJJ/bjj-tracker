import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { resolveSystemLabel, resolveTechniqueLabel } from "../../../domain/metricLabels";
import type {
  Focus14dMetric,
  GiNoGi14dMetric,
  TopSystemMetric,
  TopTechniqueMetric,
} from "../../../domain/metrics";
import { getTopTechniquePairs } from "../../../domain/metrics";
import type { Session } from "../../../types";

type SummaryMetrics = {
  sessionsThisWeek: number;
  topSystem: TopSystemMetric | null;
  topTechnique: TopTechniqueMetric | null;
  currentFocus: Focus14dMetric | null;
  giNoGi: GiNoGi14dMetric | null;
};

type Props = {
  identityName: string;
  mode: "parent" | "coach" | "competitor" | "hobbyist";
  confidence: number;
  metrics: SummaryMetrics;
  weekSessions?: Session[];
};

const EMPTY_GUIDANCE: Record<
  Props["mode"],
  Record<"topSystem" | "topTechnique" | "currentFocus" | "giNoGi", string>
> = {
  parent: {
    topSystem: "Tag your athlete's sessions by position when you log them—a weekly standout will surface here.",
    topTechnique: "Attach techniques from class so this card can highlight what they drilled most.",
    currentFocus:
      "As practices roll in, the positional lane you revisit over 14 days will become your focus line.",
    giNoGi: "Log GI or no-Gi gear on sessions—then see how mats time splits over the last two weeks.",
  },
  coach: {
    topSystem: "Pick a system emphasis when scheduling class—your room's busiest lane appears here weekly.",
    topTechnique: "Ensure technicians name techniques—this picks up repetition across the mats.",
    currentFocus:
      "When crew sessions cite systems steadily, rolling 14-day focus aligns with curriculum.",
    giNoGi: "Have athletes mark gear accurately so split training between GI and no-Gi is visible.",
  },
  competitor: {
    topSystem: "Treat every session entry with positional intent—weekly leaderboards start with volume.",
    topTechnique: "Pick techniques off the fundamentals list when saving reps so standout drills stay legible.",
    currentFocus:
      "Chaining logged rounds by system exposes what you're sharpening two weeks ahead of comps.",
    giNoGi: "Split prep between GI/no-Gi graphs once training tags reflect what you wore.",
  },
  hobbyist: {
    topSystem: "Start logging mats by system—even two sessions clarify which lane dominates your week.",
    topTechnique: "Saving techniques—even lightly—reveals repetition before you consciously track it.",
    currentFocus:
      "Light consistent logging sketches the mount/ guard/ pass mix you're actually living in.",
    giNoGi: "Toggle gear on rolls so GI vs no-Gi balance mirrors how you truly train.",
  },
};

export default function IdentityHeader({ identityName, mode, confidence, metrics, weekSessions = [] }: Props) {
  const topChainLabel = useMemo(() => {
    const topPairs = getTopTechniquePairs(weekSessions);
    if (!topPairs.length) return "";
    const [firstId, secondId] = topPairs[0].pair;
    const firstLabel = resolveTechniqueLabel(firstId);
    const secondLabel = resolveTechniqueLabel(secondId);
    if (!firstLabel || !secondLabel) return "";
    return `${firstLabel} + ${secondLabel}`;
  }, [weekSessions]);

  const cards = useMemo(() => {
    const g = EMPTY_GUIDANCE[mode];

    const topSystemResolved = metrics.topSystem
      ? resolveSystemLabel(metrics.topSystem.systemId)
      : "";
    const topTechResolved = metrics.topTechnique
      ? resolveTechniqueLabel(metrics.topTechnique.techniqueId)
      : "";
    const focusResolved = metrics.currentFocus ? resolveSystemLabel(metrics.currentFocus.systemId) : "";

    return [
      {
        label: "Sessions This Week",
        value: String(metrics.sessionsThisWeek ?? 0),
        isGuidance: false,
        color: "#34D399",
      },
      {
        label: "Top System",
        value: topSystemResolved || g.topSystem,
        isGuidance: !metrics.topSystem,
        color: "#60A5FA",
      },
      {
        label: "Top Technique",
        value: topTechResolved || g.topTechnique,
        isGuidance: !metrics.topTechnique,
        color: "#FACC15",
      },
      {
        label: "Current Focus (14d)",
        value: focusResolved || g.currentFocus,
        isGuidance: !metrics.currentFocus,
        color: "#34D399",
      },
      {
        label: "Gi vs No-Gi (14d)",
        value: metrics.giNoGi
          ? `${metrics.giNoGi.primary} (${metrics.giNoGi.gi}/${metrics.giNoGi.nogi})`
          : g.giNoGi,
        isGuidance: !metrics.giNoGi,
        color: "#60A5FA",
      },
      { label: "Confidence", value: `${confidence}%`, isGuidance: false, color: "#FACC15" },
    ];
  }, [confidence, metrics, mode]);

  return (
    <View style={styles.card}>
      <View style={styles.hero}>
        <View style={styles.heroAccent} />
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.heroEyebrow}>Identity snapshot</Text>
            <Text style={styles.identityName}>{identityName || "Build your mats identity"}</Text>
            <Text style={styles.heroSupporting}>
              Tune Identity Builder above—modes, labels, and this snapshot stay aligned while you iterate.
            </Text>
          </View>
          <View style={styles.modeColumn}>
            <Text style={styles.modeColumnLabel}>Mode</Text>
            <View style={styles.modePill}>
              <Text style={styles.modeText}>{mode}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.confidenceHint}>
        Confidence: {confidence}%{" "}
        {confidence === 0 ? "(no sessions counted this week)" : confidence <= 35 ? "(early footprint)" : "(consistent signal density)"}
      </Text>

      <Text style={styles.metricsHeading}>{`This week's signals`}</Text>

      {topChainLabel ? (
        <View style={[styles.tile, styles.topChainTile]}>
          <Text style={[styles.dot, { color: "#22D3EE" }]}>●</Text>
          <Text style={styles.tileLabel}>Top Chain</Text>
          <Text style={[styles.tileValue, styles.tileValueStrong, styles.topChainValue]} numberOfLines={2}>
            {topChainLabel}
          </Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {cards.map((item) => (
          <View key={item.label} style={styles.tile}>
            <Text style={[styles.dot, { color: item.color }]}>●</Text>
            <Text style={styles.tileLabel}>{item.label}</Text>
            <Text style={[styles.tileValue, item.isGuidance ? styles.tileGuidance : styles.tileValueStrong]} numberOfLines={5}>
              {item.value || "—"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#12161C",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 22,
    padding: 14,
    gap: 14,
    marginBottom: 24,
  },
  hero: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0E131A",
    borderWidth: 1,
    borderColor: "#1F2A3A",
    paddingVertical: 22,
    paddingHorizontal: 18,
    gap: 16,
    marginBottom: 4,
  },
  heroAccent: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(96,165,250,0.06)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
    height: 72,
    zIndex: 0,
    pointerEvents: "none",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 14,
    zIndex: 1,
  },
  titleWrap: {
    flex: 1,
    gap: 10,
    paddingBottom: 2,
  },
  heroEyebrow: {
    color: "#22D3EE",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.25,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  identityName: {
    color: "#F9FAFB",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroSupporting: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    marginTop: 4,
  },
  modeColumn: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 8,
    minWidth: 96,
    paddingLeft: 4,
    paddingTop: 28,
  },
  modeColumnLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  modePill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#111927",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modeText: {
    color: "#E5E7EB",
    fontWeight: "800",
    textTransform: "capitalize",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  confidenceHint: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: -2,
    paddingHorizontal: 2,
  },
  metricsHeading: {
    color: "#CBD5F5",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tile: {
    width: "48%",
    minHeight: 108,
    backgroundColor: "#0F141B",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 6,
  },
  topChainTile: {
    width: "100%",
    minHeight: 88,
  },
  dot: {
    fontSize: 11,
    marginBottom: -1,
  },
  tileLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  tileValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  tileValueStrong: {
    color: "#F3F4F6",
    fontWeight: "800",
  },
  topChainValue: {
    fontSize: 18,
    lineHeight: 24,
  },
  tileGuidance: {
    color: "#9CA3AF",
    fontWeight: "600",
    lineHeight: 18,
    fontSize: 12,
  },
});
