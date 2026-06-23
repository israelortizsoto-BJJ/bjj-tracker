import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AthleteAuthoritySnapshot } from "../../identity/types";
import type { CoachWriterSessionRefreshResult } from "../../storage/coachKidStore";
import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../authoritySnapshotContract";
import { COMPETITION_SNAPSHOT_CONTRACT_VERSION } from "../competitionSnapshotContract";
import {
  captureIncidentBundle,
  type CaptureIncidentBundleDeps,
} from "../captureIncidentBundle";
import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "../hydrationSnapshotContract";
import { TOPOLOGY_SNAPSHOT_CONTRACT_VERSION } from "../topologySnapshotContract";
import { WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION } from "../workerSessionSnapshotContract";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const CORRELATION_ID = "corr-coach-flow-001";

let reconcileCallCount = 0;

function refreshResult(): CoachWriterSessionRefreshResult {
  return {
    successfulSnapshots: [],
    writerLinks: [],
    inviteSessionAthletesByToken: {},
    hydrationOutcome: {
      reconcileAttempted: true,
      reconcileCompleted: true,
      stageRosterCompleted: true,
      stageShellsCompleted: true,
      stageAggregateCompleted: true,
      stageTopologyCompleted: true,
      stageTrainingProofCompleted: true,
      stageBreakdownCompleted: true,
      stageBreakdownPruneCompleted: true,
    },
  };
}

function coachSubstrate(): AthleteAuthoritySnapshot {
  return {
    sorted: [{ id: "ath_1", name: "Alice" }],
    operatingAthleteRoster: [{ id: "ath_1", name: "Alice" }],
    resolvedId: "ath_1",
    loadedKids: {},
    authorityBootstrapState: "ready",
    coachOperatingAthleteChoices: [],
    parentActiveAthleteId: "ath_1",
    coachSessionRefreshDegraded: false,
    linkedSharedAthleteIds: ["ath_1"],
    writerSessionRefresh: refreshResult(),
    reconcileAttempted: true,
  };
}

function competitionArtifact(deviceRole: "parent" | "coach") {
  return {
    contractVersion: COMPETITION_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: CAPTURED_AT,
    deviceRole,
    sharedAthleteId: "ath_1",
    visibleCompetitionCount: 0,
    competitions: [],
  };
}

function coachDeps(
  overrides: Partial<CaptureIncidentBundleDeps> = {},
): CaptureIncidentBundleDeps {
  const substrate = coachSubstrate();
  let hydrationWriterRefresh: CoachWriterSessionRefreshResult | undefined;

  return {
    captureAuthoritySnapshot: async () => {
      throw new Error("captureAuthoritySnapshot must not run on coach export");
    },
    captureCompetitionSnapshot: async (opts) => {
      assert.equal(opts.deviceRole, "coach");
      assert.equal(opts.sharedAthleteId, "ath_1");
      assert.equal(opts.sourceTrigger, "export");
      assert.equal(opts.capturedAt, CAPTURED_AT);
      return competitionArtifact("coach");
    },
    buildAthleteAuthoritySnapshot: async (opts) => {
      reconcileCallCount += 1;
      assert.equal(opts.parentRole, "coach");
      assert.equal(opts.skipCoachWriterSessionRefresh, false);
      assert.equal(opts.observability?.sourceTrigger, "export");
      return substrate;
    },
    projectAuthoritySnapshot: (snap, ctx) => {
      assert.equal(snap, substrate);
      assert.equal(ctx.deviceRole, "coach");
      assert.equal(ctx.capturedAt, CAPTURED_AT);
      assert.equal(ctx.sourceTrigger, "export");
      return {
        contractVersion: AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "coach",
        resolvedOperatingAthleteId: "ath_1",
        parentActiveAthleteId: "ath_1",
        authorityBootstrapState: "ready",
        coachSessionRefreshDegraded: false,
        operatingAthleteRosterCount: 1,
        linkedSharedAthleteIds: ["ath_1"],
        sourceTrigger: "export",
      };
    },
    captureHydrationSnapshot: async (opts) => {
      assert.equal(opts.deviceRole, "coach");
      assert.equal(opts.captureMode, "shared_authority_reconcile");
      assert.equal(opts.writerSessionRefresh, substrate.writerSessionRefresh);
      assert.equal(opts.reconcileAttempted, true);
      assert.equal(opts.coachSessionRefreshDegraded, false);
      hydrationWriterRefresh = opts.writerSessionRefresh;
      return {
        contractVersion: HYDRATION_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "coach",
        syncConfigured: true,
        captureMode: "shared_authority_reconcile",
        hydrationVersion: 3,
        reconcileAttempted: true,
        reconcileCompleted: true,
      };
    },
    captureWorkerSessionSnapshot: async (opts) => {
      assert.equal(opts.deviceRole, "coach");
      assert.equal(opts.capturedAt, CAPTURED_AT);
      return {
        contractVersion: WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "coach",
        syncConfigured: true,
        captureMode: "get_only",
        activeLinkCount: 1,
        sessionsFetchedOkCount: 1,
        allSessionsFetched: true,
        links: [],
        slice: "coach",
      };
    },
    captureTopologySnapshot: async (opts) => {
      assert.equal(opts.authority.resolvedOperatingAthleteId, "ath_1");
      assert.equal(opts.capturedAt, CAPTURED_AT);
      assert.equal(opts.sourceTrigger, "export");
      return {
        contractVersion: TOPOLOGY_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "coach",
        syncConfigured: true,
        captureMode: "coach_substrate_probe",
        sourceTrigger: "export",
        athleteDomain: {
          sharedAthleteId: "ath_1",
          memoryLoaded: true,
          peekOutcome: "hit",
          peekArtifactUpdatedAt: "2026-06-19T11:00:00.000Z",
          diskPresent: true,
          diskArtifactUpdatedAt: "2026-06-19T11:00:00.000Z",
          peekCompetitionCount: 1,
          peekMatchCount: 2,
          diskCompetitionCount: 1,
          diskMatchCount: 2,
          competitions: [],
        },
      };
    },
    resolveDeviceContext: async () => ({
      deviceRole: "coach",
      platform: "ios",
      buildNumber: "4",
      appVariant: "dev",
      syncConfigured: true,
      writerLinkCount: 1,
    }),
    validateBundle: (bundle) => {
      assert.equal(bundle.deviceRole, "coach");
      assert.equal(hydrationWriterRefresh, substrate.writerSessionRefresh);
    },
    resolvePlatform: () => "ios",
    readProductionContextDeps: async () => ({
      getCoachLinks: async () => [],
      isSyncConfigured: () => true,
      getAppVariant: () => "dev" as const,
      readBuildNumber: () => "4",
    }),
    persistCaptureStage: async () => {},
    ...overrides,
  };
}

describe("captureIncidentBundle coach", () => {
  it("uses substrate authority path and forwards writerSessionRefresh once (Rule B)", async () => {
    reconcileCallCount = 0;

    const bundle = await captureIncidentBundle(
      {
        deviceRole: "coach",
        incidentCorrelationId: CORRELATION_ID,
        capturedAt: CAPTURED_AT,
        platform: "ios",
      },
      coachDeps(),
    );

    assert.equal(reconcileCallCount, 1);
    assert.equal(bundle.bundleVersion, "2");
    assert.equal(bundle.deviceRole, "coach");
    assert.equal(bundle.artifacts.hydration.captureMode, "shared_authority_reconcile");
    assert.equal(bundle.artifacts.workerSession.slice, "coach");
    assert.equal(bundle.artifacts.authority.sourceTrigger, "export");
    assert.equal(bundle.artifacts.competition.sharedAthleteId, "ath_1");
    assert.equal(bundle.artifacts.topology.captureMode, "coach_substrate_probe");
    assert.equal(bundle.writerLinkCount, 1);
  });

  it("propagates hydration Rule B failure when writerSessionRefresh is missing", async () => {
    reconcileCallCount = 0;

    await assert.rejects(
      () =>
        captureIncidentBundle(
          {
            deviceRole: "coach",
            incidentCorrelationId: CORRELATION_ID,
            capturedAt: CAPTURED_AT,
            platform: "ios",
          },
          coachDeps({
            captureHydrationSnapshot: async () => {
              throw new Error(
                "captureHydrationSnapshot: writerSessionRefresh is required for shared_authority_reconcile",
              );
            },
          }),
        ),
      /writerSessionRefresh is required/,
    );
    assert.equal(reconcileCallCount, 1);
  });
});
