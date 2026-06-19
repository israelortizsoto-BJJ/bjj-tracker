import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { AthleteAuthoritySnapshot } from "../../identity/types";
import type { CoachWriterSessionRefreshResult } from "../../storage/coachKidStore";
import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../authoritySnapshotContract";
import {
  captureIncidentBundle,
  type CaptureIncidentBundleDeps,
} from "../captureIncidentBundle";
import type { IncidentCaptureStage } from "../incidentCaptureDebug";
import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "../hydrationSnapshotContract";
import { TOPOLOGY_SNAPSHOT_CONTRACT_VERSION } from "../topologySnapshotContract";
import { WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION } from "../workerSessionSnapshotContract";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const CORRELATION_ID = "corr-stage-order-001";

const PARENT_EXPECTED_STAGES: IncidentCaptureStage[] = [
  "pre_authority",
  "post_authority",
  "pre_hydration",
  "post_hydration",
  "pre_worker",
  "post_worker",
  "pre_bundle_assembly",
  "post_bundle_assembly",
  "pre_validation",
  "post_validation",
  "capture_complete",
];

const COACH_EXPECTED_STAGES: IncidentCaptureStage[] = [
  "pre_authority",
  "post_authority",
  "pre_hydration",
  "post_hydration",
  "pre_worker",
  "post_worker",
  "pre_topology",
  "post_topology",
  "pre_bundle_assembly",
  "post_bundle_assembly",
  "pre_validation",
  "post_validation",
  "capture_complete",
];

function stageRecorder(): {
  stages: IncidentCaptureStage[];
  persistCaptureStage: CaptureIncidentBundleDeps["persistCaptureStage"];
} {
  const stages: IncidentCaptureStage[] = [];
  return {
    stages,
    persistCaptureStage: async (stage) => {
      stages.push(stage);
    },
  };
}

function authorityArtifact(deviceRole: "parent" | "coach") {
  return {
    contractVersion: AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: CAPTURED_AT,
    deviceRole,
    resolvedOperatingAthleteId: "ath_1",
    parentActiveAthleteId: "ath_1",
    authorityBootstrapState: "ready" as const,
    coachSessionRefreshDegraded: false,
    operatingAthleteRosterCount: 1,
    linkedSharedAthleteIds: ["ath_1"],
    sourceTrigger: "export",
  };
}

function hydrationArtifact(deviceRole: "parent" | "coach") {
  return {
    contractVersion: HYDRATION_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: CAPTURED_AT,
    deviceRole,
    syncConfigured: true,
    captureMode: deviceRole === "parent" ? ("read_only_state" as const) : ("shared_authority_reconcile" as const),
    hydrationVersion: deviceRole === "parent" ? 2 : 3,
    reconcileAttempted: deviceRole === "coach",
  };
}

function workerArtifact(deviceRole: "parent" | "coach") {
  return {
    contractVersion: WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: CAPTURED_AT,
    deviceRole,
    syncConfigured: true,
    captureMode: "get_only" as const,
    activeLinkCount: 1,
    sessionsFetchedOkCount: 1,
    allSessionsFetched: true,
    links: [],
    slice: deviceRole,
  };
}

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

function parentDeps(
  recorder: ReturnType<typeof stageRecorder>,
  overrides: Partial<CaptureIncidentBundleDeps> = {},
): CaptureIncidentBundleDeps {
  return {
    captureAuthoritySnapshot: async () => authorityArtifact("parent"),
    buildAthleteAuthoritySnapshot: async () => {
      throw new Error("buildAthleteAuthoritySnapshot should not run on parent export");
    },
    projectAuthoritySnapshot: () => {
      throw new Error("projectAuthoritySnapshot should not run on parent export");
    },
    captureHydrationSnapshot: async () => hydrationArtifact("parent"),
    captureWorkerSessionSnapshot: async () => workerArtifact("parent"),
    captureTopologySnapshot: async () => {
      throw new Error("captureTopologySnapshot should not run on parent export");
    },
    resolveDeviceContext: async () => ({
      deviceRole: "parent",
      platform: "ios",
      buildNumber: "4",
      appVariant: "dev",
      syncConfigured: true,
      writerLinkCount: 1,
    }),
    validateBundle: () => {},
    resolvePlatform: () => "ios",
    readProductionContextDeps: async () => ({
      getCoachLinks: async () => [],
      isSyncConfigured: () => true,
      getAppVariant: () => "dev" as const,
      readBuildNumber: () => "4",
    }),
    persistCaptureStage: recorder.persistCaptureStage,
    ...overrides,
  };
}

function coachDeps(
  recorder: ReturnType<typeof stageRecorder>,
  overrides: Partial<CaptureIncidentBundleDeps> = {},
): CaptureIncidentBundleDeps {
  const substrate = coachSubstrate();
  return {
    captureAuthoritySnapshot: async () => {
      throw new Error("captureAuthoritySnapshot must not run on coach export");
    },
    buildAthleteAuthoritySnapshot: async () => substrate,
    projectAuthoritySnapshot: () => authorityArtifact("coach"),
    captureHydrationSnapshot: async () => hydrationArtifact("coach"),
    captureWorkerSessionSnapshot: async () => workerArtifact("coach"),
    captureTopologySnapshot: async () => ({
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
    }),
    resolveDeviceContext: async () => ({
      deviceRole: "coach",
      platform: "ios",
      buildNumber: "4",
      appVariant: "dev",
      syncConfigured: true,
      writerLinkCount: 1,
    }),
    validateBundle: () => {},
    resolvePlatform: () => "ios",
    readProductionContextDeps: async () => ({
      getCoachLinks: async () => [],
      isSyncConfigured: () => true,
      getAppVariant: () => "dev" as const,
      readBuildNumber: () => "4",
    }),
    persistCaptureStage: recorder.persistCaptureStage,
    ...overrides,
  };
}

describe("captureIncidentBundle capture stages", () => {
  afterEach(() => {
    // no shared mutable state beyond per-test recorders
  });

  it("parent path emits authority, hydration, worker, assembly, validation stages in order", async () => {
    const recorder = stageRecorder();
    await captureIncidentBundle(
      {
        deviceRole: "parent",
        incidentCorrelationId: CORRELATION_ID,
        capturedAt: CAPTURED_AT,
        platform: "ios",
      },
      parentDeps(recorder),
    );

    assert.deepEqual(recorder.stages, PARENT_EXPECTED_STAGES);
  });

  it("parent path never emits topology stages", async () => {
    const recorder = stageRecorder();
    await captureIncidentBundle(
      {
        deviceRole: "parent",
        incidentCorrelationId: CORRELATION_ID,
        capturedAt: CAPTURED_AT,
        platform: "ios",
      },
      parentDeps(recorder),
    );

    assert.equal(
      recorder.stages.some((stage) => stage.includes("topology")),
      false,
    );
  });

  it("coach path emits authority, hydration, worker, topology, assembly, validation stages in order", async () => {
    const recorder = stageRecorder();
    await captureIncidentBundle(
      {
        deviceRole: "coach",
        incidentCorrelationId: CORRELATION_ID,
        capturedAt: CAPTURED_AT,
        platform: "ios",
      },
      coachDeps(recorder),
    );

    assert.deepEqual(recorder.stages, COACH_EXPECTED_STAGES);
  });

  it("coach path includes topology stages between worker and assembly", async () => {
    const recorder = stageRecorder();
    await captureIncidentBundle(
      {
        deviceRole: "coach",
        incidentCorrelationId: CORRELATION_ID,
        capturedAt: CAPTURED_AT,
        platform: "ios",
      },
      coachDeps(recorder),
    );

    const workerIdx = recorder.stages.indexOf("post_worker");
    const topologyPreIdx = recorder.stages.indexOf("pre_topology");
    const topologyPostIdx = recorder.stages.indexOf("post_topology");
    const assemblyPreIdx = recorder.stages.indexOf("pre_bundle_assembly");

    assert.ok(workerIdx >= 0);
    assert.ok(topologyPreIdx > workerIdx);
    assert.ok(topologyPostIdx > topologyPreIdx);
    assert.ok(assemblyPreIdx > topologyPostIdx);
  });

  it("stops at last completed stage when authority capture fails on parent", async () => {
    const recorder = stageRecorder();
    await assert.rejects(
      () =>
        captureIncidentBundle(
          {
            deviceRole: "parent",
            incidentCorrelationId: CORRELATION_ID,
            capturedAt: CAPTURED_AT,
            platform: "ios",
          },
          parentDeps(recorder, {
            captureAuthoritySnapshot: async () => {
              throw new Error("authority failed");
            },
          }),
        ),
      /authority failed/,
    );

    assert.deepEqual(recorder.stages, ["pre_authority"]);
  });
});
