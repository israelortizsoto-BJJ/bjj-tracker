import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
} from "../../../incident-capture/authoritySnapshotContract";
import {
  COMPETITION_SNAPSHOT_CONTRACT_VERSION,
} from "../../../incident-capture/competitionSnapshotContract";
import {
  HYDRATION_SNAPSHOT_CONTRACT_VERSION,
  type HydrationAnalysisReadinessEvidence,
} from "../../../incident-capture/hydrationSnapshotContract";
import type { IncidentBundleV1 } from "../../../incident-capture/incidentBundleContract";
import { validateIncidentBundle } from "../../../incident-capture/validateIncidentBundle";
import {
  WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
} from "../../../incident-capture/workerSessionSnapshotContract";
import {
  aggregateCompetitionMatchSignals,
  type MatchSignalsCompetitionRow,
} from "../../../lib/signals/competitionMatchBucketAggregate";
import type { CoachAnalysisReadinessRecord } from "../coachAnalysisReadinessTypes";
import type { CompetitionAnalysisRow } from "../competitionAnalysisProjectionTypes";
import {
  selectCompetitionAnalysisForAnalytics,
  type CompetitionAnalyticsSelectionSource,
} from "../selectCompetitionAnalysisForAnalytics";

const CAPTURED_AT = "2026-06-24T15:00:00.000Z";
const ARTIFACT_UPDATED_AT = "2026-06-24T14:59:00.000Z";

const legacyEntries: MatchSignalsCompetitionRow[] = [
  {
    id: "entry_legacy",
    eventDate: "2026-06-24",
    result: "silver",
    createdAt: CAPTURED_AT,
    matches: [
      {
        id: "match_1",
        matchResult: "loss",
        outcome: "Points",
        coachNote: "Needs takedown timing",
      },
    ],
  },
];

const projectedEntries: CompetitionAnalysisRow[] = [
  {
    entryId: "entry_legacy",
    sharedCompetitionId: "shared_comp_1",
    eventDate: "2026-06-24",
    result: "silver",
    createdAt: CAPTURED_AT,
    competitionCoachNotes: null,
    matches: [
      {
        matchId: "match_1",
        matchResult: "loss",
        outcome: "Points",
        submissionTime: null,
        resolvedCoachAnalysis: "Needs guard retention",
        analysisSource: "coach_artifact",
      },
    ],
  },
];

type ValidationScenario = {
  name: string;
  readiness: HydrationAnalysisReadinessEvidence;
  artifactStoreUpdatedAt: string | null;
  expectedSource: CompetitionAnalyticsSelectionSource;
  expectedReason: string;
};

type DriftReportRow = {
  scenario: string;
  selection: "Projection Selected" | "Legacy Selected";
  source: CompetitionAnalyticsSelectionSource;
  reason: string;
  lossBuckets: Record<string, number>;
};

function incidentBundle(
  readiness: HydrationAnalysisReadinessEvidence,
): IncidentBundleV1 {
  return {
    bundleVersion: "1",
    capturedAt: CAPTURED_AT,
    deviceRole: "parent",
    platform: "ios",
    buildNumber: "81",
    appVariant: "prod",
    syncConfigured: true,
    writerLinkCount: 1,
    incidentCorrelationId: `corr-${readiness.state.toLowerCase()}-001`,
    exportSource: "developer_tools",
    artifacts: {
      authority: {
        contractVersion: AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "parent",
        resolvedOperatingAthleteId: readiness.sharedAthleteId,
        parentActiveAthleteId: readiness.sharedAthleteId,
        authorityBootstrapState: "ready",
        coachSessionRefreshDegraded: false,
        operatingAthleteRosterCount: 1,
        linkedSharedAthleteIds: [readiness.sharedAthleteId],
      },
      workerSession: {
        contractVersion: WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "parent",
        syncConfigured: true,
        captureMode: "get_only",
        activeLinkCount: 1,
        sessionsFetchedOkCount: 1,
        allSessionsFetched: true,
        links: [],
      },
      hydration: {
        contractVersion: HYDRATION_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "parent",
        syncConfigured: true,
        captureMode: "read_only_state",
        hydrationVersion: readiness.generation,
        analysisReadiness: [readiness],
      },
      competition: {
        contractVersion: COMPETITION_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "parent",
        sharedAthleteId: readiness.sharedAthleteId,
        visibleCompetitionCount: 1,
        competitions: [
          {
            sharedCompetitionId: "shared_comp_1",
            entryId: "entry_legacy",
            entryMatchCount: 1,
            entryMatchIds: ["match_1"],
            localArtifactSetPresent:
              readiness.artifactSetUpdatedAt !== null,
            localArtifactCount:
              readiness.artifactSetUpdatedAt !== null ? 1 : 0,
            localArtifactLineageKeys:
              readiness.artifactSetUpdatedAt !== null ? ["match_1"] : [],
            annotationAcceptedCount:
              readiness.artifactSetUpdatedAt !== null ? 1 : 0,
            annotationAcceptedLineageKeys:
              readiness.artifactSetUpdatedAt !== null ? ["match_1"] : [],
            annotationRejectedCount: 0,
            annotationRejectReasons: [],
            mergeMatchedCount:
              readiness.artifactSetUpdatedAt !== null ? 1 : 0,
            mergeMatchedLineageKeys:
              readiness.artifactSetUpdatedAt !== null ? ["match_1"] : [],
            projectedCoachNoteCount: 1,
            firstFailureLayer:
              readiness.artifactSetUpdatedAt !== null
                ? "none_detected"
                : "local_artifact_missing",
          },
        ],
      },
    },
  };
}

function readinessRecordFromIncident(
  evidence: HydrationAnalysisReadinessEvidence,
): CoachAnalysisReadinessRecord {
  return {
    sharedAthleteId: evidence.sharedAthleteId,
    state: evidence.state,
    generation: evidence.generation,
    startedAt: evidence.startedAt,
    ...(evidence.resolvedAt ? { resolvedAt: evidence.resolvedAt } : {}),
    hydrationSource:
      evidence.hydrationSource === "parent_session_refresh"
        ? "parent_session_refresh"
        : "coach_writer_sessions",
    ...(evidence.artifactSetUpdatedAt
      ? { artifactSetUpdatedAt: evidence.artifactSetUpdatedAt }
      : {}),
    ...(evidence.lastConfirmedState
      ? { lastConfirmedState: evidence.lastConfirmedState }
      : {}),
    ...(evidence.lastConfirmedAt
      ? { lastConfirmedAt: evidence.lastConfirmedAt }
      : {}),
    ...(evidence.lastConfirmedArtifactSetUpdatedAt
      ? {
          lastConfirmedArtifactSetUpdatedAt:
            evidence.lastConfirmedArtifactSetUpdatedAt,
        }
      : {}),
  };
}

function readinessEvidence(
  input: Partial<HydrationAnalysisReadinessEvidence> & {
    state: HydrationAnalysisReadinessEvidence["state"];
  },
): HydrationAnalysisReadinessEvidence {
  return {
    sharedAthleteId: "ath_1",
    generation: 4,
    startedAt: "2026-06-24T14:58:00.000Z",
    resolvedAt:
      input.state === "PENDING" ? null : "2026-06-24T14:59:30.000Z",
    hydrationSource: "parent_session_refresh",
    artifactSetUpdatedAt: null,
    currentArtifactStoreUpdatedAt: null,
    lastConfirmedState: null,
    lastConfirmedAt: null,
    lastConfirmedArtifactSetUpdatedAt: null,
    ...input,
    state: input.state,
  };
}

function sortedCounts(values: ReadonlyMap<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...values.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function runScenario(scenario: ValidationScenario): DriftReportRow {
  const bundle = incidentBundle(scenario.readiness);
  validateIncidentBundle(bundle);
  const exportedEvidence =
    bundle.artifacts.hydration.analysisReadiness[0];
  assert.ok(exportedEvidence);

  const selected = selectCompetitionAnalysisForAnalytics(
    {
      readinessRecord: readinessRecordFromIncident(exportedEvidence),
      projectedCompetitionAnalysis: {
        entries: projectedEntries,
        artifactStoreUpdatedAt:
          exportedEvidence.currentArtifactStoreUpdatedAt,
      },
      legacyCompetitionEntries: legacyEntries,
    },
    { eligibilityEnabled: true },
  );
  const analytics = aggregateCompetitionMatchSignals(selected.entries);

  return {
    scenario: scenario.name,
    selection:
      selected.source === "legacy"
        ? "Legacy Selected"
        : "Projection Selected",
    source: selected.source,
    reason: scenario.expectedReason,
    lossBuckets: sortedCounts(analytics.lossBuckets),
  };
}

const scenarios: ValidationScenario[] = [
  {
    name: "READY",
    readiness: readinessEvidence({
      state: "READY",
      artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
      currentArtifactStoreUpdatedAt: ARTIFACT_UPDATED_AT,
      lastConfirmedState: "READY",
      lastConfirmedAt: "2026-06-24T14:59:30.000Z",
      lastConfirmedArtifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
    }),
    artifactStoreUpdatedAt: ARTIFACT_UPDATED_AT,
    expectedSource: "projection_ready",
    expectedReason: "current readiness and artifact timestamps match",
  },
  {
    name: "READY timestamp mismatch",
    readiness: readinessEvidence({
      state: "READY",
      artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
      currentArtifactStoreUpdatedAt:
        "2026-06-24T14:57:00.000Z",
      lastConfirmedState: "READY",
      lastConfirmedAt: "2026-06-24T14:59:30.000Z",
      lastConfirmedArtifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
    }),
    artifactStoreUpdatedAt: "2026-06-24T14:57:00.000Z",
    expectedSource: "legacy",
    expectedReason: "current readiness and artifact timestamps mismatch",
  },
  {
    name: "EMPTY_READY",
    readiness: readinessEvidence({
      state: "EMPTY_READY",
      lastConfirmedState: "EMPTY_READY",
      lastConfirmedAt: "2026-06-24T14:59:30.000Z",
    }),
    artifactStoreUpdatedAt: null,
    expectedSource: "projection_empty_ready",
    expectedReason: "authoritative empty readiness",
  },
  {
    name: "FAILED with last confirmed READY",
    readiness: readinessEvidence({
      state: "FAILED",
      currentArtifactStoreUpdatedAt: ARTIFACT_UPDATED_AT,
      lastConfirmedState: "READY",
      lastConfirmedAt: "2026-06-24T14:57:30.000Z",
      lastConfirmedArtifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
    }),
    artifactStoreUpdatedAt: ARTIFACT_UPDATED_AT,
    expectedSource: "last_confirmed",
    expectedReason: "readiness failed; preserved confirmed authority matches",
  },
  {
    name: "FAILED without confirmation",
    readiness: readinessEvidence({ state: "FAILED" }),
    artifactStoreUpdatedAt: null,
    expectedSource: "legacy",
    expectedReason: "readiness failed without confirmed authority",
  },
  {
    name: "PENDING with last confirmed EMPTY_READY",
    readiness: readinessEvidence({
      state: "PENDING",
      lastConfirmedState: "EMPTY_READY",
      lastConfirmedAt: "2026-06-24T14:57:30.000Z",
    }),
    artifactStoreUpdatedAt: null,
    expectedSource: "last_confirmed",
    expectedReason: "hydration pending; preserved confirmed empty authority",
  },
  {
    name: "PENDING without confirmation",
    readiness: readinessEvidence({ state: "PENDING" }),
    artifactStoreUpdatedAt: null,
    expectedSource: "legacy",
    expectedReason: "hydration pending without confirmed authority",
  },
];

describe("Shared Competition Analysis readiness validation", () => {
  it("deterministically resolves every frozen readiness scenario", () => {
    const report = scenarios.map(runScenario);

    assert.deepEqual(
      report.map(({ scenario, selection, source, reason }) => ({
        scenario,
        selection,
        source,
        reason,
      })),
      scenarios.map((scenario) => ({
        scenario: scenario.name,
        selection:
          scenario.expectedSource === "legacy"
            ? "Legacy Selected"
            : "Projection Selected",
        source: scenario.expectedSource,
        reason: scenario.expectedReason,
      })),
    );
  });

  it("produces analytics from whichever input the eligibility gate selects", () => {
    const report = scenarios.map(runScenario);

    for (const row of report) {
      assert.deepEqual(
        row.lossBuckets,
        row.source === "legacy"
          ? { positioning: 1 }
          : { guard_retention: 1 },
      );
    }
  });

  it("connects validated Incident Bundle readiness evidence to the selector", () => {
    const scenario = scenarios[0]!;
    const bundle = incidentBundle(scenario.readiness);
    validateIncidentBundle(bundle);

    const exported =
      bundle.artifacts.hydration.analysisReadiness[0]!;
    const record = readinessRecordFromIncident(exported);

    assert.equal(record.state, "READY");
    assert.equal(record.generation, exported.generation);
    assert.equal(
      record.artifactSetUpdatedAt,
      exported.artifactSetUpdatedAt,
    );
    assert.equal(
      record.lastConfirmedArtifactSetUpdatedAt,
      exported.lastConfirmedArtifactSetUpdatedAt,
    );
    assert.equal(runScenario(scenario).source, "projection_ready");
  });

  it("proves the bundle includes the current artifact timestamp needed by eligibility", () => {
    const bundle = incidentBundle(scenarios[0]!.readiness);
    const readinessEvidence =
      bundle.artifacts.hydration.analysisReadiness[0]!;

    assert.equal(
      readinessEvidence.currentArtifactStoreUpdatedAt,
      readinessEvidence.artifactSetUpdatedAt,
    );
  });
});
