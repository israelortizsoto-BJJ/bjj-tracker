import { competitionAnalyticsEligibilityEnabled } from "../../config/competitionAnalyticsFlags";
import type { MatchSignalsCompetitionRow } from "../../lib/signals/competitionMatchBucketAggregate";
import type { KidCompetitionEntryWithMatchDetail } from "../../storage/competitionStore";
import { getCoachAnalysisReadiness } from "../../storage/coachAnalysisReadinessStore";
import { getCoachMatchBreakdownArtifactSet } from "../../storage/coachMatchBreakdownArtifactStore";
import type { DeviceRole } from "../../storage/deviceRoleStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../../types/coachWeeklySync";
import { assembleCompetitionMatchSignalsInput } from "./assembleCompetitionMatchSignalsInput";
import { projectSharedCompetitionAnalysis } from "./projectSharedCompetitionAnalysis";
import type {
  CompetitionAnalyticsSelection,
  CompetitionAnalyticsSelectionSource,
} from "./selectCompetitionAnalysisForAnalytics";
import type { CoachAnalysisReadinessRecord } from "./coachAnalysisReadinessTypes";

/** DEV search tag — Summary Pilot V1 eligibility selection trace. */
export const SUMMARY_PILOT_ANALYTICS_SELECTION_TRACE =
  "SUMMARY_PILOT_ANALYTICS_SELECTION_TRACE" as const;

export type SummaryPilotAnalyticsSelectionTracePayload = {
  athleteId: string;
  source: CompetitionAnalyticsSelectionSource;
  readinessState: CoachAnalysisReadinessRecord["state"] | null;
  artifactTimestamp: string | null;
  readinessTimestamp: string | null;
  eligibilityEnabled: boolean;
};

let lastSummaryPilotAnalyticsSelectionTrace: {
  athleteId: string;
  source: CompetitionAnalyticsSelectionSource;
} | null = null;

function readinessTimestampForTrace(
  readinessRecord: CoachAnalysisReadinessRecord | null,
): string | null {
  if (!readinessRecord) return null;
  const current = readinessRecord.artifactSetUpdatedAt?.trim();
  if (current) return current;
  const confirmed = readinessRecord.lastConfirmedArtifactSetUpdatedAt?.trim();
  return confirmed || null;
}

function isSummaryPilotDevTraceEnabled(): boolean {
  const dev = (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__;
  return dev === true;
}

function maybeLogSummaryPilotAnalyticsSelection(
  payload: SummaryPilotAnalyticsSelectionTracePayload,
): void {
  if (!isSummaryPilotDevTraceEnabled()) return;
  const prev = lastSummaryPilotAnalyticsSelectionTrace;
  if (prev?.athleteId === payload.athleteId && prev?.source === payload.source) {
    return;
  }
  lastSummaryPilotAnalyticsSelectionTrace = {
    athleteId: payload.athleteId,
    source: payload.source,
  };
  console.log(SUMMARY_PILOT_ANALYTICS_SELECTION_TRACE, payload);
}

/** Test/dev helper — clears dedupe state for selection trace logs. */
export function resetSummaryPilotAnalyticsSelectionTraceForDev(): void {
  lastSummaryPilotAnalyticsSelectionTrace = null;
}

function traceAndReturn(
  selection: CompetitionAnalyticsSelection,
  input: {
    athleteId: string;
    eligibilityEnabled: boolean;
    readinessRecord: CoachAnalysisReadinessRecord | null;
    artifactSet: SyncedCoachMatchBreakdownArtifactSet | null;
  },
): CompetitionAnalyticsSelection {
  maybeLogSummaryPilotAnalyticsSelection({
    athleteId: input.athleteId,
    source: selection.source,
    readinessState: input.readinessRecord?.state ?? null,
    artifactTimestamp: input.artifactSet?.updatedAt?.trim() || null,
    readinessTimestamp: readinessTimestampForTrace(input.readinessRecord),
    eligibilityEnabled: input.eligibilityEnabled,
  });
  return selection;
}

export type ResolveCompetitionAnalyticsSelectionInput = {
  deviceRole: DeviceRole | null;
  sharedAthleteId: string;
  legacyCompetitions: readonly KidCompetitionEntryWithMatchDetail[];
};

export type ResolveCompetitionAnalyticsSelectionDeps = {
  getReadiness?: typeof getCoachAnalysisReadiness;
  getArtifactSet?: (
    sharedAthleteId: string,
  ) => Promise<SyncedCoachMatchBreakdownArtifactSet | null>;
};

export type ResolveCompetitionAnalyticsSelectionOptions = {
  eligibilityEnabled?: boolean;
  deps?: ResolveCompetitionAnalyticsSelectionDeps;
};

function legacySelection(
  legacyCompetitions: readonly MatchSignalsCompetitionRow[],
): CompetitionAnalyticsSelection {
  return {
    source: "legacy",
    entries: legacyCompetitions,
  };
}

/**
 * Parent Summary pilot: loads readiness + artifact substrate, projects shared analysis,
 * and selects analytics input. Coach and other roles pass through legacy competitions.
 */
export async function resolveCompetitionAnalyticsSelection(
  input: ResolveCompetitionAnalyticsSelectionInput,
  options: ResolveCompetitionAnalyticsSelectionOptions = {},
): Promise<CompetitionAnalyticsSelection> {
  const legacyCompetitions = input.legacyCompetitions;
  const eligibilityEnabled =
    options.eligibilityEnabled ?? competitionAnalyticsEligibilityEnabled;
  const athleteIdForTrace = input.sharedAthleteId.trim();

  if (input.deviceRole !== "parent") {
    return traceAndReturn(legacySelection(legacyCompetitions), {
      athleteId: athleteIdForTrace,
      eligibilityEnabled,
      readinessRecord: null,
      artifactSet: null,
    });
  }

  const sharedAthleteId = athleteIdForTrace;
  if (!sharedAthleteId) {
    return traceAndReturn(legacySelection(legacyCompetitions), {
      athleteId: "",
      eligibilityEnabled,
      readinessRecord: null,
      artifactSet: null,
    });
  }

  const getReadiness = options.deps?.getReadiness ?? getCoachAnalysisReadiness;
  const getArtifactSet = options.deps?.getArtifactSet ?? getCoachMatchBreakdownArtifactSet;

  const [readinessRecord, artifactSet] = await Promise.all([
    getReadiness(sharedAthleteId),
    getArtifactSet(sharedAthleteId),
  ]);

  const projectedEntries = projectSharedCompetitionAnalysis({
    deviceRole: "parent",
    sharedAthleteId,
    competitions: legacyCompetitions.map((entry) => ({ entry })),
    artifactSet,
  });

  return traceAndReturn(
    assembleCompetitionMatchSignalsInput(
      {
        readinessRecord,
        projectedCompetitionAnalysis: {
          entries: projectedEntries,
          artifactStoreUpdatedAt: artifactSet?.updatedAt ?? null,
        },
        legacyCompetitionEntries: legacyCompetitions,
      },
      { eligibilityEnabled },
    ),
    {
      athleteId: sharedAthleteId,
      eligibilityEnabled,
      readinessRecord,
      artifactSet,
    },
  );
}
