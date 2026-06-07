import type {
  CompetitionEntry,
  SignalOutput,
} from "../../lib/signals/computeSignals";
import { peekCoachCompetitionTopology } from "../../storage/coachCompetitionTopologyStore";
import type {
  SyncedCompetitionAggregateArtifact,
  SyncedCompetitionTopologyArtifact,
} from "../../types/coachWeeklySync";
import { formatSecondsAsMmSs } from "./matchDurationFormat";

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
    fastestSubmission: formatSecondsAsMmSs(artifact.fastestSubmissionSeconds),
    averageMatchTime: formatSecondsAsMmSs(artifact.averageMatchSeconds),
    winStyle: artifact.dominantWinStyle,
  };
}

function resolveWinStyle(input: {
  submissionWins: number;
  pointsStyleWins: number;
}): CompetitionAggregateMetricsOverlay["winStyle"] {
  const categorizedWins = input.submissionWins + input.pointsStyleWins;
  if (categorizedWins === 0) return null;
  if (input.submissionWins > input.pointsStyleWins) return "submission-heavy";
  if (input.pointsStyleWins > input.submissionWins) return "points-heavy";
  return "mixed";
}

export function deriveCompetitionAggregateMetricsFromTopology(
  topology: SyncedCompetitionTopologyArtifact,
): CompetitionAggregateMetricsOverlay | null {
  const matches = topology.competitions.flatMap((competition) => competition.matches);
  if (matches.length === 0) return null;

  const completed = matches.filter(
    (match) => match.result === "win" || match.result === "loss",
  );
  const wins = completed.filter((match) => match.result === "win").length;
  const losses = completed.filter((match) => match.result === "loss").length;
  const winningMatches = completed.filter((match) => match.result === "win");
  const submissionWins = winningMatches.filter(
    (match) => match.finishType === "submission",
  ).length;
  const pointsStyleWins = winningMatches.filter(
    (match) => match.finishType === "points" || match.finishType === "ref_decision",
  ).length;
  const submissionWinTimes = winningMatches
    .filter((match) => match.finishType === "submission")
    .map((match) => match.durationSeconds)
    .filter((seconds): seconds is number => typeof seconds === "number" && Number.isFinite(seconds));
  const timedMatchSeconds = completed
    .map((match) => match.durationSeconds)
    .filter((seconds): seconds is number => typeof seconds === "number" && Number.isFinite(seconds));

  return {
    totalMatches: matches.length,
    wins,
    losses,
    winRate: completed.length === 0 ? null : Math.round((wins / completed.length) * 100),
    submissionRate: wins === 0 ? null : Math.round((submissionWins / wins) * 100),
    fastestSubmission:
      submissionWinTimes.length === 0
        ? null
        : formatSecondsAsMmSs(Math.min(...submissionWinTimes)),
    averageMatchTime:
      timedMatchSeconds.length === 0
        ? null
        : formatSecondsAsMmSs(
            timedMatchSeconds.reduce((sum, seconds) => sum + seconds, 0) /
              timedMatchSeconds.length,
          ),
    winStyle: resolveWinStyle({ submissionWins, pointsStyleWins }),
  };
}

export function overlayCompetitionTopologyMetricsSignals(
  signals: SignalOutput,
  topology: SyncedCompetitionTopologyArtifact,
): SignalOutput {
  const metrics = deriveCompetitionAggregateMetricsFromTopology(topology);
  if (!metrics) return signals;
  return {
    ...signals,
    competition: {
      ...signals.competition,
      ...metrics,
      competitionCount: topology.competitions.length,
      record: { wins: metrics.wins, losses: metrics.losses },
    },
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
