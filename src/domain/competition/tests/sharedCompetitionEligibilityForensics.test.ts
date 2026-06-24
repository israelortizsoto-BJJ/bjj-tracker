import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../../../incident-capture/authoritySnapshotContract";
import { COMPETITION_SNAPSHOT_CONTRACT_VERSION } from "../../../incident-capture/competitionSnapshotContract";
import {
  HYDRATION_SNAPSHOT_CONTRACT_VERSION,
  type HydrationAnalysisReadinessEvidence,
} from "../../../incident-capture/hydrationSnapshotContract";
import type { IncidentBundleV1 } from "../../../incident-capture/incidentBundleContract";
import { validateIncidentBundle } from "../../../incident-capture/validateIncidentBundle";
import { WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION } from "../../../incident-capture/workerSessionSnapshotContract";
import type { CoachAnalysisReadinessRecord } from "../coachAnalysisReadinessTypes";
import type { CompetitionAnalysisRow } from "../competitionAnalysisProjectionTypes";
import {
  selectCompetitionAnalysisForAnalytics,
  type CompetitionAnalyticsSelectionSource,
} from "../selectCompetitionAnalysisForAnalytics";

const CAPTURED_AT = "2026-06-24T18:00:00.000Z";
const ARTIFACT_UPDATED_AT = "2026-06-24T17:59:00.000Z";

const legacyEntries = [
  {
    id: "entry_legacy",
    matches: [{ id: "match_1", coachNote: "Legacy analysis" }],
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
        resolvedCoachAnalysis: "Projected analysis",
        analysisSource: "coach_artifact",
      },
    ],
  },
];

type ForensicDecision = {
  source: CompetitionAnalyticsSelectionSource;
  reason:
    | "current_timestamp_match"
    | "current_timestamp_mismatch"
    | "authoritative_empty"
    | "confirmed_authority"
    | "no_confirmed_authority";
};

function readinessEvidence(
  input: Partial<HydrationAnalysisReadinessEvidence> & {
    state: HydrationAnalysisReadinessEvidence["state"];
  },
): HydrationAnalysisReadinessEvidence {
  return {
    sharedAthleteId: "ath_1",
    generation: 8,
    startedAt: "2026-06-24T17:58:00.000Z",
    resolvedAt:
      input.state === "PENDING" ? null : "2026-06-24T17:59:30.000Z",
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

function incidentBundle(
  readiness: HydrationAnalysisReadinessEvidence,
): IncidentBundleV1 {
  return {
    bundleVersion: "1",
    capturedAt: CAPTURED_AT,
    deviceRole: "parent",
    platform: "ios",
    buildNumber: "82",
    appVariant: "prod",
    syncConfigured: true,
    writerLinkCount: 1,
    incidentCorrelationId: `eligibility-${readiness.state.toLowerCase()}`,
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
              readiness.currentArtifactStoreUpdatedAt !== null,
            localArtifactCount:
              readiness.currentArtifactStoreUpdatedAt !== null ? 1 : 0,
            localArtifactLineageKeys:
              readiness.currentArtifactStoreUpdatedAt !== null
                ? ["match_1"]
                : [],
            annotationAcceptedCount:
              readiness.currentArtifactStoreUpdatedAt !== null ? 1 : 0,
            annotationAcceptedLineageKeys:
              readiness.currentArtifactStoreUpdatedAt !== null
                ? ["match_1"]
                : [],
            annotationRejectedCount: 0,
            annotationRejectReasons: [],
            mergeMatchedCount:
              readiness.currentArtifactStoreUpdatedAt !== null ? 1 : 0,
            mergeMatchedLineageKeys:
              readiness.currentArtifactStoreUpdatedAt !== null
                ? ["match_1"]
                : [],
            projectedCoachNoteCount: 1,
            firstFailureLayer:
              readiness.currentArtifactStoreUpdatedAt !== null
                ? "none_detected"
                : "local_artifact_missing",
          },
        ],
      },
    },
  };
}

function readinessRecordFromEvidence(
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

function reasonFor(
  evidence: HydrationAnalysisReadinessEvidence,
  source: CompetitionAnalyticsSelectionSource,
): ForensicDecision["reason"] {
  if (source === "projection_ready") return "current_timestamp_match";
  if (source === "projection_empty_ready") return "authoritative_empty";
  if (source === "last_confirmed") return "confirmed_authority";
  if (
    evidence.state === "READY" &&
    evidence.artifactSetUpdatedAt !==
      evidence.currentArtifactStoreUpdatedAt
  ) {
    return "current_timestamp_mismatch";
  }
  return "no_confirmed_authority";
}

function reconstructDecision(bundle: IncidentBundleV1): ForensicDecision {
  validateIncidentBundle(bundle);
  const evidence = bundle.artifacts.hydration.analysisReadiness[0];
  assert.ok(evidence);

  const selection = selectCompetitionAnalysisForAnalytics(
    {
      readinessRecord: readinessRecordFromEvidence(evidence),
      projectedCompetitionAnalysis: {
        entries: projectedEntries,
        artifactStoreUpdatedAt: evidence.currentArtifactStoreUpdatedAt,
      },
      legacyCompetitionEntries: legacyEntries,
    },
    { eligibilityEnabled: true },
  );

  return {
    source: selection.source,
    reason: reasonFor(evidence, selection.source),
  };
}

describe("Shared Competition eligibility forensics", () => {
  it("reconstructs every eligibility outcome from Incident Bundle evidence", () => {
    const scenarios = [
      {
        name: "READY matching timestamp",
        readiness: readinessEvidence({
          state: "READY",
          artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
          currentArtifactStoreUpdatedAt: ARTIFACT_UPDATED_AT,
        }),
        expected: {
          source: "projection_ready",
          reason: "current_timestamp_match",
        },
      },
      {
        name: "READY mismatched timestamp",
        readiness: readinessEvidence({
          state: "READY",
          artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
          currentArtifactStoreUpdatedAt:
            "2026-06-24T17:57:00.000Z",
        }),
        expected: {
          source: "legacy",
          reason: "current_timestamp_mismatch",
        },
      },
      {
        name: "EMPTY_READY",
        readiness: readinessEvidence({ state: "EMPTY_READY" }),
        expected: {
          source: "projection_empty_ready",
          reason: "authoritative_empty",
        },
      },
      {
        name: "FAILED with confirmation",
        readiness: readinessEvidence({
          state: "FAILED",
          currentArtifactStoreUpdatedAt: ARTIFACT_UPDATED_AT,
          lastConfirmedState: "READY",
          lastConfirmedAt: "2026-06-24T17:57:30.000Z",
          lastConfirmedArtifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
        }),
        expected: {
          source: "last_confirmed",
          reason: "confirmed_authority",
        },
      },
      {
        name: "PENDING with confirmation",
        readiness: readinessEvidence({
          state: "PENDING",
          lastConfirmedState: "EMPTY_READY",
          lastConfirmedAt: "2026-06-24T17:57:30.000Z",
        }),
        expected: {
          source: "last_confirmed",
          reason: "confirmed_authority",
        },
      },
      {
        name: "PENDING without confirmation",
        readiness: readinessEvidence({ state: "PENDING" }),
        expected: {
          source: "legacy",
          reason: "no_confirmed_authority",
        },
      },
    ] as const;

    for (const scenario of scenarios) {
      assert.deepEqual(
        reconstructDecision(incidentBundle(scenario.readiness)),
        scenario.expected,
        scenario.name,
      );
    }
  });
});
