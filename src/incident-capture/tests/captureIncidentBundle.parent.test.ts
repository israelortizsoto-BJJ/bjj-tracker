import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AthleteAuthoritySnapshot } from "../../identity/types";
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
const CORRELATION_ID = "corr-parent-flow-001";

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
    captureMode: "read_only_state" as const,
    hydrationVersion: 2,
    reconcileAttempted: false,
    analysisReadiness: [
      {
        sharedAthleteId: "ath_1",
        state: "READY" as const,
        generation: 2,
        startedAt: CAPTURED_AT,
        resolvedAt: CAPTURED_AT,
        hydrationSource: "parent_session_refresh" as const,
        artifactSetUpdatedAt: CAPTURED_AT,
        currentArtifactStoreUpdatedAt: CAPTURED_AT,
        lastConfirmedState: "READY" as const,
        lastConfirmedAt: CAPTURED_AT,
        lastConfirmedArtifactSetUpdatedAt: CAPTURED_AT,
      },
    ],
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

function baseDeps(
  overrides: Partial<CaptureIncidentBundleDeps> = {},
): CaptureIncidentBundleDeps {
  return {
    captureAuthoritySnapshot: async (opts) => {
      assert.equal(opts.deviceRole, "parent");
      assert.equal(opts.sourceTrigger, "export");
      assert.equal(opts.skipCoachWriterSessionRefresh, true);
      assert.equal(opts.capturedAt, CAPTURED_AT);
      return authorityArtifact("parent");
    },
    captureCompetitionSnapshot: async (opts) => {
      assert.equal(opts.deviceRole, "parent");
      assert.equal(opts.sharedAthleteId, "ath_1");
      assert.equal(opts.sourceTrigger, "export");
      assert.equal(opts.capturedAt, CAPTURED_AT);
      return competitionArtifact("parent");
    },
    buildAthleteAuthoritySnapshot: async () => {
      throw new Error("buildAthleteAuthoritySnapshot should not run on parent export");
    },
    projectAuthoritySnapshot: () => {
      throw new Error("projectAuthoritySnapshot should not run on parent export");
    },
    captureHydrationSnapshot: async (opts) => {
      assert.equal(opts.deviceRole, "parent");
      assert.equal(opts.captureMode, "read_only_state");
      assert.equal(opts.sourceTrigger, "export");
      assert.equal(opts.capturedAt, CAPTURED_AT);
      assert.equal(opts.writerSessionRefresh, undefined);
      return hydrationArtifact("parent");
    },
    captureWorkerSessionSnapshot: async (opts) => {
      assert.equal(opts.deviceRole, "parent");
      assert.equal(opts.capturedAt, CAPTURED_AT);
      return workerArtifact("parent");
    },
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
    validateBundle: (bundle) => {
      assert.equal(bundle.capturedAt, CAPTURED_AT);
      assert.equal(bundle.deviceRole, "parent");
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

describe("captureIncidentBundle parent", () => {
  it("orchestrates parent read-only capture with shared capturedAt", async () => {
    const bundle = await captureIncidentBundle(
      {
        deviceRole: "parent",
        incidentCorrelationId: CORRELATION_ID,
        capturedAt: CAPTURED_AT,
        platform: "ios",
      },
      baseDeps(),
    );

    assert.equal(bundle.deviceRole, "parent");
    assert.equal(bundle.capturedAt, CAPTURED_AT);
    assert.equal(bundle.incidentCorrelationId, CORRELATION_ID);
    assert.equal(bundle.artifacts.authority.sourceTrigger, "export");
    assert.equal(bundle.artifacts.hydration.captureMode, "read_only_state");
    assert.equal(bundle.artifacts.hydration.reconcileAttempted, false);
    assert.equal(bundle.artifacts.hydration.analysisReadiness.length, 1);
    assert.equal(bundle.artifacts.workerSession.slice, "parent");
    assert.equal(bundle.artifacts.competition.sharedAthleteId, "ath_1");
    assert.equal(bundle.bundleVersion, "1");
    assert.equal("topology" in bundle.artifacts, false);
  });
});
