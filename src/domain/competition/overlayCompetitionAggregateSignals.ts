import type {
  CompetitionEntry,
  SignalOutput,
} from "../../lib/signals/computeSignals";
import { peekCoachCompetitionTopology } from "../../storage/coachCompetitionTopologyStore";
import type { SyncedCompetitionAggregateArtifact } from "../../types/coachWeeklySync";

export type CompetitionAggregateMetricsOverlay = Pick<
  SignalOutput["competition"],
  | "totalMatches"
  | "wins"
  | "losses"
  | "winRate"
  | "submissionRate"
  | "fastestSubmission"
  | "averageMatchTime"
  | "winStyle"
>;

function normalizeMatchResult(value: unknown): "win" | "loss" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "win") return "win";
  if (normalized === "loss") return "loss";
  return null;
}

function formatMatchTime(totalSeconds: number | null): string | null {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return null;
  }
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * @deprecated Coach-local match rows are compatibility data, never aggregate authority.
 * Retained as a call-site compatibility shim until the Summary hook cleanup phase.
 */
export function hasFullLocalMatchLineage(
  competitions: readonly CompetitionEntry[],
): boolean {
  let legacyMatchCount = 0;
  for (const competition of competitions) {
    const matches = Array.isArray(competition.matches) ? competition.matches : [];
    for (const match of matches) {
      const result = normalizeMatchResult(match.matchResult);
      if (result === "win" || result === "loss") legacyMatchCount += 1;
    }
  }
  if (__DEV__ && legacyMatchCount > 0) {
    console.log("[COMP_SUMMARY_TRACE] summary_suppression_retired", {
      ignoredLocalCompletedMatchCount: legacyMatchCount,
    });
  }
  return false;
}

/** Parent-published aggregate is scoped to the athlete and carries bounded match metrics. */
export function hasBoundedAggregateVisibility(
  artifact: SyncedCompetitionAggregateArtifact,
  expectedSharedAthleteId: string,
): boolean {
  const athleteId = expectedSharedAthleteId.trim();
  if (!athleteId) return false;
  if (artifact.sharedAthleteId.trim() !== athleteId) return false;
  return artifact.totalMatches > 0 || artifact.wins + artifact.losses > 0;
}

function buildMetricsOverlay(
  artifact: SyncedCompetitionAggregateArtifact,
): CompetitionAggregateMetricsOverlay {
  return {
    totalMatches: artifact.totalMatches,
    wins: artifact.wins,
    losses: artifact.losses,
    winRate: artifact.winRate,
    submissionRate: artifact.submissionRate,
    fastestSubmission: formatMatchTime(artifact.fastestSubmissionSeconds),
    averageMatchTime: formatMatchTime(artifact.averageMatchSeconds),
    winStyle: artifact.dominantWinStyle,
  };
}

/**
 * Coach Summary only: shallow bounded metrics overlay from a hydrated parent aggregate.
 * Does not touch timelines, placement history, trends, buckets, or raw matches.
 */
export function overlayCompetitionAggregateSignals(
  signals: SignalOutput,
  artifact: SyncedCompetitionAggregateArtifact,
): SignalOutput {
  const metrics = buildMetricsOverlay(artifact);
  const topology = peekCoachCompetitionTopology(artifact.sharedAthleteId);
  const topologyCompetitionCount = topology?.competitions.length ?? null;
  const topologyMatchCount =
    topology?.competitions.reduce(
      (sum, competition) => sum + competition.matches.length,
      0,
    ) ?? null;
  if (__DEV__) {
    if (topology) {
      console.log("[COMP_SUMMARY_TRACE] summary_topology_used", {
        sharedAthleteId: artifact.sharedAthleteId,
        competitionCount: topologyCompetitionCount,
        matchCount: topologyMatchCount,
      });
    } else {
      console.log("[COMP_SUMMARY_TRACE] summary_missing_topology", {
        sharedAthleteId: artifact.sharedAthleteId,
      });
      console.log("[COMP_SUMMARY_TRACE] summary_fallback_used", {
        sharedAthleteId: artifact.sharedAthleteId,
        fallback: "bounded_aggregate_with_legacy_shell_structure",
      });
    }
    console.log("[COMP_SUMMARY_TRACE] summary_aggregate_projection_ok", {
      sharedAthleteId: artifact.sharedAthleteId,
      aggregateMatchCount: metrics.totalMatches,
      topologyMatchCount,
    });
  }
  return {
    ...signals,
    competition: {
      ...signals.competition,
      ...metrics,
      ...(topologyCompetitionCount === null
        ? {}
        : { competitionCount: topologyCompetitionCount }),
      record: { wins: metrics.wins, losses: metrics.losses },
    },
  };
}
