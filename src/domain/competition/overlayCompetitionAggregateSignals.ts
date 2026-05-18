import type {
  CompetitionEntry,
  SignalOutput,
} from "../../lib/signals/computeSignals";
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

/** True when local competitions include at least one completed win/loss match row. */
export function hasFullLocalMatchLineage(
  competitions: readonly CompetitionEntry[],
): boolean {
  for (const competition of competitions) {
    const matches = Array.isArray(competition.matches) ? competition.matches : [];
    for (const match of matches) {
      const result = normalizeMatchResult(match.matchResult);
      if (result === "win" || result === "loss") return true;
    }
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
  return {
    ...signals,
    competition: {
      ...signals.competition,
      ...metrics,
      record: { wins: metrics.wins, losses: metrics.losses },
    },
  };
}
