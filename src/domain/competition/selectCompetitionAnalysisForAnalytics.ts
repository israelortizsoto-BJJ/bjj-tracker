import { competitionAnalyticsEligibilityEnabled } from "../../config/competitionAnalyticsFlags";
import type { MatchSignalsCompetitionRow } from "../../lib/signals/competitionMatchBucketAggregate";
import type { CoachAnalysisReadinessRecord } from "./coachAnalysisReadinessTypes";
import type { CompetitionAnalysisRow } from "./competitionAnalysisProjectionTypes";

export type CompetitionAnalyticsSelectionSource =
  | "projection_ready"
  | "projection_empty_ready"
  | "last_confirmed"
  | "legacy";

export type ProjectedCompetitionAnalysisForAnalytics = {
  entries: readonly CompetitionAnalysisRow[];
  artifactStoreUpdatedAt: string | null;
};

export type SelectCompetitionAnalysisForAnalyticsInput = {
  readinessRecord: CoachAnalysisReadinessRecord | null;
  projectedCompetitionAnalysis: ProjectedCompetitionAnalysisForAnalytics;
  legacyCompetitionEntries: readonly MatchSignalsCompetitionRow[];
};

export type CompetitionAnalyticsSelection = {
  source: CompetitionAnalyticsSelectionSource;
  entries: readonly MatchSignalsCompetitionRow[];
};

type SelectCompetitionAnalysisForAnalyticsOptions = {
  eligibilityEnabled?: boolean;
};

function projectionRowsAsLegacyAnalyticsInput(
  rows: readonly CompetitionAnalysisRow[],
): MatchSignalsCompetitionRow[] {
  return rows.map((row) => ({
    id: row.entryId,
    sharedCompetitionId: row.sharedCompetitionId ?? undefined,
    eventDate: row.eventDate,
    result: row.result ?? undefined,
    createdAt: row.createdAt,
    coachNotes: row.competitionCoachNotes ?? undefined,
    matches: row.matches.map((match) => ({
      id: match.matchId,
      matchResult: match.matchResult,
      outcome: match.outcome,
      submissionTime: match.submissionTime,
      ...(match.submissionType !== undefined
        ? { submissionType: match.submissionType }
        : {}),
      coachNote: match.resolvedCoachAnalysis ?? undefined,
    })),
  }));
}

function timestampsMatch(
  readinessUpdatedAt: string | undefined,
  artifactStoreUpdatedAt: string | null,
): boolean {
  const readinessTimestamp = readinessUpdatedAt?.trim() ?? "";
  const storeTimestamp = artifactStoreUpdatedAt?.trim() ?? "";
  return Boolean(readinessTimestamp) && readinessTimestamp === storeTimestamp;
}

function projectionSelection(
  source: Exclude<CompetitionAnalyticsSelectionSource, "legacy">,
  projectedCompetitionAnalysis: ProjectedCompetitionAnalysisForAnalytics,
): CompetitionAnalyticsSelection {
  return {
    source,
    entries: projectionRowsAsLegacyAnalyticsInput(
      projectedCompetitionAnalysis.entries,
    ),
  };
}

function legacySelection(
  legacyCompetitionEntries: readonly MatchSignalsCompetitionRow[],
): CompetitionAnalyticsSelection {
  return {
    source: "legacy",
    entries: legacyCompetitionEntries,
  };
}

export function selectCompetitionAnalysisForAnalytics(
  input: SelectCompetitionAnalysisForAnalyticsInput,
  options: SelectCompetitionAnalysisForAnalyticsOptions = {},
): CompetitionAnalyticsSelection {
  const enabled =
    options.eligibilityEnabled ?? competitionAnalyticsEligibilityEnabled;
  if (!enabled) {
    return legacySelection(input.legacyCompetitionEntries);
  }

  const readiness = input.readinessRecord;
  if (!readiness) {
    return legacySelection(input.legacyCompetitionEntries);
  }

  if (readiness.state === "READY") {
    return timestampsMatch(
      readiness.artifactSetUpdatedAt,
      input.projectedCompetitionAnalysis.artifactStoreUpdatedAt,
    )
      ? projectionSelection(
          "projection_ready",
          input.projectedCompetitionAnalysis,
        )
      : legacySelection(input.legacyCompetitionEntries);
  }

  if (readiness.state === "EMPTY_READY") {
    return projectionSelection(
      "projection_empty_ready",
      input.projectedCompetitionAnalysis,
    );
  }

  if (readiness.lastConfirmedState === "EMPTY_READY") {
    return projectionSelection(
      "last_confirmed",
      input.projectedCompetitionAnalysis,
    );
  }

  if (
    readiness.lastConfirmedState === "READY" &&
    timestampsMatch(
      readiness.lastConfirmedArtifactSetUpdatedAt,
      input.projectedCompetitionAnalysis.artifactStoreUpdatedAt,
    )
  ) {
    return projectionSelection(
      "last_confirmed",
      input.projectedCompetitionAnalysis,
    );
  }

  return legacySelection(input.legacyCompetitionEntries);
}
