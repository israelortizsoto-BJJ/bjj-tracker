import { toDateKey } from "../../_domain/dateKey";
import {
  competitionDetailKeyForSharedCompetitionId,
  type KidCompetitionEntryWithMatchDetail,
} from "../../storage/competitionStore";
import type { SyncedCompetitionAggregateArtifact } from "../../types/coachWeeklySync";

type MatchRow = KidCompetitionEntryWithMatchDetail["matches"][number];

function normalizeMatchResult(value: unknown): "win" | "loss" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "win") return "win";
  if (normalized === "loss") return "loss";
  return null;
}

function normalizeMatchOutcome(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isSubmissionOutcome(value: unknown): boolean {
  return normalizeMatchOutcome(value) === "submission";
}

function isPointsStyleOutcome(value: unknown): boolean {
  const outcome = normalizeMatchOutcome(value);
  return outcome === "points" || outcome === "ref decision";
}

function parseMatchTimeSeconds(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value);
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;

  const parts = text.split(":");
  if (parts.length === 1) {
    const seconds = Number(parts[0]);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
  }
  if (parts.length !== 2) return null;

  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
  return Math.round(minutes * 60 + seconds);
}

function resolveWinStyle(input: {
  submissionWins: number;
  pointsStyleWins: number;
}): SyncedCompetitionAggregateArtifact["dominantWinStyle"] {
  const { submissionWins, pointsStyleWins } = input;
  const categorizedWins = submissionWins + pointsStyleWins;
  if (categorizedWins === 0) return null;
  if (submissionWins > pointsStyleWins) return "submission-heavy";
  if (pointsStyleWins > submissionWins) return "points-heavy";
  return "mixed";
}

function pickLatestCompetition(
  competitions: readonly KidCompetitionEntryWithMatchDetail[],
): KidCompetitionEntryWithMatchDetail | null {
  let best: KidCompetitionEntryWithMatchDetail | null = null;
  let bestDate = "";

  for (const competition of competitions) {
    const date = toDateKey(competition.eventDate);
    if (!date) continue;

    if (!best || date > bestDate) {
      best = competition;
      bestDate = date;
      continue;
    }

    if (date === bestDate) {
      const prevCreated = (best.createdAt ?? "").trim();
      const nextCreated = (competition.createdAt ?? "").trim();
      if (nextCreated > prevCreated) {
        best = competition;
      }
    }
  }

  return best;
}

function collectMatches(competitions: readonly KidCompetitionEntryWithMatchDetail[]): MatchRow[] {
  return competitions.flatMap((competition) =>
    Array.isArray(competition.matches) ? [...competition.matches] : [],
  );
}

/**
 * Parent-only: bounded match intelligence from local competition shells + detail payloads.
 * No raw match rows cross the sync wire.
 */
export function buildCompetitionAggregateArtifact(
  sharedAthleteId: string,
  competitions: readonly KidCompetitionEntryWithMatchDetail[],
): SyncedCompetitionAggregateArtifact {
  const athleteId = sharedAthleteId.trim();
  if (__DEV__) {
    for (const competition of competitions) {
      const rawShellMatches = (competition as { matches?: unknown }).matches;
      const shellMatchCount = Array.isArray(rawShellMatches) ? rawShellMatches.length : 0;
      const sharedCompetitionId = competition.sharedCompetitionId ?? null;
      const isShellEntry =
        Boolean(sharedCompetitionId) &&
        competition.id === competitionDetailKeyForSharedCompetitionId(sharedCompetitionId ?? "");
      console.log("[TOPOLOGY_BUILD_SOURCE_TRACE]", {
        stage: "aggregate_builder_input",
        entryId: competition.id,
        sharedCompetitionId,
        shellMatchCount,
        canonicalDetailMatchCount: competition.matches.length,
        mergedMatchCount: competition.matches.length,
        sourceStrategy: "aggregate_merged_canonical_detail_input",
        firstFiveMatchIds: competition.matches.slice(0, 5).map((match) => match.id),
      });
      console.log("[SHELL_AUTHORITY_TRACE]", {
        entryId: competition.id,
        sharedCompetitionId,
        isShellEntry,
        matchCount: competition.matches.length,
        sourceCaller: "buildCompetitionAggregateArtifact",
        resolutionPath: "aggregate_builder_input",
        selectedAsCanonical: isShellEntry,
        rejectedReason: isShellEntry
          ? null
          : "non_shell_entry_aggregate_input",
      });
    }
  }
  const matches = collectMatches(competitions);
  const normalizedMatches = matches.map((match) => ({
    ...match,
    matchResult: normalizeMatchResult(match.matchResult),
  }));
  const validMatches = normalizedMatches.filter(
    (match) => match.matchResult === "win" || match.matchResult === "loss",
  );
  const wins = validMatches.filter((match) => match.matchResult === "win").length;
  const losses = validMatches.filter((match) => match.matchResult === "loss").length;
  const completedMatchCount = validMatches.length;

  const winningMatches = validMatches.filter((match) => match.matchResult === "win");
  const submissionWins = winningMatches.filter((match) =>
    isSubmissionOutcome(match.outcome),
  ).length;
  const pointsStyleWins = winningMatches.filter((match) =>
    isPointsStyleOutcome(match.outcome),
  ).length;

  const submissionWinTimes = winningMatches
    .filter((match) => isSubmissionOutcome(match.outcome))
    .map((match) => parseMatchTimeSeconds(match.submissionTime))
    .filter((seconds): seconds is number => seconds !== null);

  const timedMatchSeconds = validMatches
    .map((match) => parseMatchTimeSeconds(match.submissionTime))
    .filter((seconds): seconds is number => seconds !== null);

  const latest = pickLatestCompetition(competitions);
  const latestName =
    typeof latest?.tournamentName === "string" ? latest.tournamentName.trim() : "";
  const latestDate = latest ? toDateKey(latest.eventDate) : null;
  const updatedAt = new Date().toISOString();
  const artifact: SyncedCompetitionAggregateArtifact = {
    sharedAthleteId: athleteId,
    updatedAt,
    totalCompetitions: competitions.length,
    totalMatches: matches.length,
    wins,
    losses,
    winRate:
      completedMatchCount === 0 ? null : Math.round((wins / completedMatchCount) * 100),
    submissionRate: wins === 0 ? null : Math.round((submissionWins / wins) * 100),
    fastestSubmissionSeconds:
      submissionWinTimes.length === 0 ? null : Math.min(...submissionWinTimes),
    averageMatchSeconds:
      timedMatchSeconds.length === 0
        ? null
        : Math.round(
            timedMatchSeconds.reduce((sum, seconds) => sum + seconds, 0) /
              timedMatchSeconds.length,
          ),
    dominantWinStyle: resolveWinStyle({ submissionWins, pointsStyleWins }),
    ...(latestName ? { latestCompetitionName: latestName } : {}),
    ...(latestDate ? { latestCompetitionDate: latestDate } : {}),
  };

  if (__DEV__) {
    console.log("[COMP_AGGREGATE_TRACE]", {
      stage: "parent_aggregate_build",
      sharedAthleteId: athleteId,
      competitionCount: competitions.length,
      matchCount: matches.length,
      winCount: wins,
      lossCount: losses,
      submissionCount: submissionWins,
      fastestSubmission: artifact.fastestSubmissionSeconds,
      updatedAt,
    });
  }

  return artifact;
}
