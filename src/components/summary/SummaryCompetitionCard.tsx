import { StyleSheet, Text, View } from "react-native";

import {
  resolveCompetitionTrendCopy,
  type CompetitionPlacementTrend,
} from "../../lib/signals/computeSignals";

type SummaryCompetitionProps = {
  competitionCount: number;
  lastCompetitionDate: string | null;
  lastCompetitionResult: string | null;
  lastCompetitionName: string | null;
  lastCompetitionMatchCount: number;
  lastCompetitionWins: number;
  lastCompetitionLosses: number;
  podiumCountLast30Days: number;
  podiumCountLast90Days: number;
  record: { wins: number; losses: number };
  submissionRate: number | null;
  fastestSubmission: string | null;
  averageMatchTime: string | null;
  winStyle: "submission-heavy" | "points-heavy" | "mixed" | null;
  totalMatches: number;
  winRate: number | null;
  placementTrend: CompetitionPlacementTrend | null;
  /** When match/practice logs surface a clear repeated theme. */
  skillFocusHint?: string;
  /** ≥3 inferred bucket datapoints + stable placement trajectory (signals-derived). */
  bucketFocusEvidenceLine?: string | null;
};

export default function SummaryCompetitionCard(props: SummaryCompetitionProps) {
  const {
    averageMatchTime,
    competitionCount,
    fastestSubmission,
    lastCompetitionDate,
    lastCompetitionResult,
    lastCompetitionName,
    lastCompetitionMatchCount,
    lastCompetitionWins,
    lastCompetitionLosses,
    podiumCountLast30Days,
    podiumCountLast90Days,
    record,
    submissionRate,
    totalMatches,
    winRate,
    winStyle,
    placementTrend,
    skillFocusHint,
    bucketFocusEvidenceLine,
  } = props;
  const trendSubtitle = resolveCompetitionTrendCopy(placementTrend).snapshotLine;
  const hasData = competitionCount > 0 || totalMatches > 0;
  const hasMatchData = totalMatches > 0;
  const matchLabel =
    totalMatches === 1 ? "1 recorded match" : `${totalMatches} recorded matches`;
  const recordValue = hasMatchData ? `${record.wins}–${record.losses}` : "—";

  const formatLastDate = (dateKey: string | null) => {
    if (!dateKey) return null;

    const date = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) return `Last: ${dateKey}`;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.max(
      0,
      Math.floor((todayStart.getTime() - date.getTime()) / 86400000),
    );

    if (diffDays === 0) return "Last: today";
    if (diffDays === 1) return "Last: yesterday";
    return `Last: ${diffDays} days ago`;
  };

  const lastDateLabel = formatLastDate(lastCompetitionDate);
  const formatEventDateHeading = (dateKey: string | null) => {
    if (!dateKey) return null;
    const date = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateKey;
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const lastEventDateHeading = formatEventDateHeading(lastCompetitionDate);
  const hasLastEventHero = Boolean(
    lastCompetitionResult && lastCompetitionDate && lastCompetitionName,
  );
  const lastEventMatchLine =
    lastCompetitionMatchCount > 0
      ? `${lastCompetitionMatchCount} match${lastCompetitionMatchCount === 1 ? "" : "es"} · ${lastCompetitionWins}–${lastCompetitionLosses}`
      : null;
  const podiumLine =
    podiumCountLast30Days > 0 || podiumCountLast90Days > 0
      ? `Podiums: ${podiumCountLast30Days} last 30 days · ${podiumCountLast90Days} last 90 days`
      : null;
  const formatRate = (value: number | null) => (value === null ? "—" : `${value}%`);
  const formatWinStyle = (value: SummaryCompetitionProps["winStyle"]) => {
    switch (value) {
      case "submission-heavy":
        return "Submission-heavy";
      case "points-heavy":
        return "Points-heavy";
      case "mixed":
        return "Mixed";
      default:
        return "—";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Competition Snapshot</Text>
        {hasData ? (
          <View style={styles.highlightBadge}>
            <Text style={styles.highlightBadgeText}>{competitionCount}</Text>
          </View>
        ) : null}
      </View>

      {!hasData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No competitions yet</Text>
          <Text style={styles.emptyText}>Save a competition to build proof.</Text>
        </View>
      ) : (
        <>
          {hasLastEventHero ? (
            <View style={styles.lastEventBlock}>
              <Text style={styles.lastEventResult}>{lastCompetitionResult}</Text>
              <Text style={styles.lastEventTitle} numberOfLines={2}>
                {lastCompetitionName}
              </Text>
              <Text style={styles.lastEventWhen}>
                {[lastEventDateHeading, lastEventMatchLine].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ) : lastCompetitionResult && lastCompetitionDate ? (
            <View style={styles.lastEventBlock}>
              <Text style={styles.lastEventResult}>{lastCompetitionResult}</Text>
              <Text style={styles.lastEventWhen}>
                {[formatEventDateHeading(lastCompetitionDate), lastDateLabel?.replace(/^Last: /, "")]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          ) : null}

          {hasData && trendSubtitle ? (
            <Text style={styles.trendLine}>{trendSubtitle}</Text>
          ) : null}

          {hasData && skillFocusHint ? (
            <Text style={styles.focusHintLine}>Focus area: {skillFocusHint}</Text>
          ) : null}

          {hasData && bucketFocusEvidenceLine ? (
            <Text style={styles.bucketEvidenceLine}>{bucketFocusEvidenceLine}</Text>
          ) : null}

          <View style={styles.primaryGrid}>
            <View style={styles.primaryMetric}>
              <Text style={styles.primaryLabel}>Record</Text>
              <Text style={styles.primaryValue}>{recordValue}</Text>
              <Text style={styles.primarySubtext}>
                {hasMatchData ? matchLabel : "No match results"}
              </Text>
            </View>

            <View style={styles.primaryMetric}>
              <Text style={styles.primaryLabel}>Win Rate</Text>
              <Text style={styles.primaryValue}>{formatRate(winRate)}</Text>
              <Text style={styles.primarySubtext}>
                {winRate === null ? "No result data" : "Win percentage"}
              </Text>
            </View>
          </View>

          <View style={styles.secondaryGrid}>
            <View style={styles.secondaryMetric}>
              <Text style={styles.itemLabel}>Sub Rate</Text>
              <Text style={styles.itemValue}>{formatRate(submissionRate)}</Text>
              <Text style={styles.itemSubtext}>
                {submissionRate === null ? "No sub wins" : "Submission wins"}
              </Text>
            </View>

            <View style={styles.secondaryMetric}>
              <Text style={styles.itemLabel}>Fastest Sub</Text>
              <Text style={styles.itemValue}>{fastestSubmission ?? "—"}</Text>
              <Text style={styles.itemSubtext}>
                {fastestSubmission ? "Fastest finish" : "No time"}
              </Text>
            </View>

            <View style={styles.secondaryMetric}>
              <Text style={styles.itemLabel}>Avg Time</Text>
              <Text style={styles.itemValue}>{averageMatchTime ?? "—"}</Text>
              <Text style={styles.itemSubtext}>
                {averageMatchTime ? "Match pace" : "No time"}
              </Text>
            </View>

            <View style={styles.secondaryMetric}>
              <Text style={styles.itemLabel}>Win Style</Text>
              <Text style={styles.itemValueSmall}>{formatWinStyle(winStyle)}</Text>
              <Text style={styles.itemSubtext}>
                {winStyle ? "Winning method" : "No method"}
              </Text>
            </View>
          </View>
        </>
      )}

      {hasData ? (
        <Text style={styles.note}>
          {competitionCount === 1 ? "1 competition" : `${competitionCount} competitions`}
          {" • "}
          {matchLabel}
          {lastDateLabel ? ` • ${lastDateLabel}` : ""}
          {lastCompetitionResult ? ` • Last result: ${lastCompetitionResult}` : ""}
          {podiumLine ? `\n${podiumLine}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#171b20",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#252a31",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  highlightBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#d4ad4f",
    alignItems: "center",
    justifyContent: "center",
  },
  highlightBadgeText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  primaryMetric: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 16,
    minHeight: 112,
    borderWidth: 1,
    borderColor: "#2b3542",
    justifyContent: "center",
  },
  primaryLabel: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 10,
    fontWeight: "800",
  },
  primaryValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 6,
  },
  primarySubtext: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 17,
  },
  secondaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  secondaryMetric: {
    width: "48%",
    backgroundColor: "#20252b",
    borderRadius: 8,
    padding: 15,
    minHeight: 96,
    marginBottom: 14,
    justifyContent: "center",
  },
  emptyState: {
    backgroundColor: "#20252b",
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: "#28313c",
  },
  emptyTitle: {
    color: "#d1d5db",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 18,
  },
  itemLabel: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 8,
    fontWeight: "700",
  },
  itemValue: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 4,
  },
  itemValueSmall: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  itemSubtext: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 17,
  },
  note: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  lastEventBlock: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2b3542",
  },
  lastEventResult: {
    color: "#d4ad4f",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 6,
  },
  lastEventTitle: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 22,
  },
  lastEventWhen: {
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 18,
  },
  trendLine: {
    color: "#7c8490",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: 0.15,
  },
  focusHintLine: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: 0.12,
  },
  bucketEvidenceLine: {
    color: "#93c5a8",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: 0.12,
  },
});
