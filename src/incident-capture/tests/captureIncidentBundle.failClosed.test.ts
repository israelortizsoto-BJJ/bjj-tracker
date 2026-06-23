import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../authoritySnapshotContract";
import { COMPETITION_SNAPSHOT_CONTRACT_VERSION } from "../competitionSnapshotContract";
import {
  captureIncidentBundle,
  type CaptureIncidentBundleDeps,
} from "../captureIncidentBundle";
import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "../hydrationSnapshotContract";
import { TOPOLOGY_SNAPSHOT_CONTRACT_VERSION } from "../topologySnapshotContract";
import { validateIncidentBundle } from "../validateIncidentBundle";
import { WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION } from "../workerSessionSnapshotContract";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const CORRELATION_ID = "corr-fail-closed-001";

function baseDeps(
  overrides: Partial<CaptureIncidentBundleDeps> = {},
): CaptureIncidentBundleDeps {
  return {
    captureAuthoritySnapshot: async () => ({
      contractVersion: AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
      capturedAt: CAPTURED_AT,
      deviceRole: "parent",
      resolvedOperatingAthleteId: "ath_1",
      parentActiveAthleteId: "ath_1",
      authorityBootstrapState: "ready",
      coachSessionRefreshDegraded: false,
      operatingAthleteRosterCount: 1,
      linkedSharedAthleteIds: ["ath_1"],
    }),
    captureCompetitionSnapshot: async () => ({
      contractVersion: COMPETITION_SNAPSHOT_CONTRACT_VERSION,
      capturedAt: CAPTURED_AT,
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      visibleCompetitionCount: 0,
      competitions: [],
    }),
    buildAthleteAuthoritySnapshot: async () => {
      throw new Error("not used in parent fail-closed tests");
    },
    projectAuthoritySnapshot: () => {
      throw new Error("not used in parent fail-closed tests");
    },
    captureHydrationSnapshot: async () => ({
      contractVersion: HYDRATION_SNAPSHOT_CONTRACT_VERSION,
      capturedAt: CAPTURED_AT,
      deviceRole: "parent",
      syncConfigured: true,
      captureMode: "read_only_state",
      hydrationVersion: 1,
    }),
    captureWorkerSessionSnapshot: async () => ({
      contractVersion: WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
      capturedAt: CAPTURED_AT,
      deviceRole: "parent",
      syncConfigured: true,
      captureMode: "get_only",
      activeLinkCount: 0,
      sessionsFetchedOkCount: 0,
      allSessionsFetched: false,
      links: [],
    }),
    captureTopologySnapshot: async () => ({
      contractVersion: TOPOLOGY_SNAPSHOT_CONTRACT_VERSION,
      capturedAt: CAPTURED_AT,
      deviceRole: "coach",
      syncConfigured: true,
      captureMode: "coach_substrate_probe",
      athleteDomain: {
        sharedAthleteId: "ath_1",
        memoryLoaded: false,
        peekOutcome: "memory_not_loaded",
        peekArtifactUpdatedAt: null,
        diskPresent: false,
        diskArtifactUpdatedAt: null,
        peekCompetitionCount: 0,
        peekMatchCount: 0,
        diskCompetitionCount: 0,
        diskMatchCount: 0,
        competitions: [],
      },
    }),
    resolveDeviceContext: async () => ({
      deviceRole: "parent",
      platform: "ios",
      buildNumber: "4",
      appVariant: "dev",
      syncConfigured: true,
      writerLinkCount: 0,
    }),
    validateBundle: validateIncidentBundle,
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

describe("captureIncidentBundle fail-closed", () => {
  it("aborts when authority capture fails", async () => {
    await assert.rejects(
      () =>
        captureIncidentBundle(
          {
            deviceRole: "parent",
            incidentCorrelationId: CORRELATION_ID,
            capturedAt: CAPTURED_AT,
            platform: "ios",
          },
          baseDeps({
            captureAuthoritySnapshot: async () => {
              throw new Error("authority capture failed");
            },
          }),
        ),
      /authority capture failed/,
    );
  });

  it("aborts when hydration capture fails", async () => {
    await assert.rejects(
      () =>
        captureIncidentBundle(
          {
            deviceRole: "parent",
            incidentCorrelationId: CORRELATION_ID,
            capturedAt: CAPTURED_AT,
            platform: "ios",
          },
          baseDeps({
            captureHydrationSnapshot: async () => {
              throw new Error("hydration capture failed");
            },
          }),
        ),
      /hydration capture failed/,
    );
  });

  it("aborts when worker session capture fails", async () => {
    await assert.rejects(
      () =>
        captureIncidentBundle(
          {
            deviceRole: "parent",
            incidentCorrelationId: CORRELATION_ID,
            capturedAt: CAPTURED_AT,
            platform: "ios",
          },
          baseDeps({
            captureWorkerSessionSnapshot: async () => {
              throw new Error("worker capture failed");
            },
          }),
        ),
      /worker capture failed/,
    );
  });

  it("aborts when topology capture fails on coach export", async () => {
    await assert.rejects(
      () =>
        captureIncidentBundle(
          {
            deviceRole: "coach",
            incidentCorrelationId: CORRELATION_ID,
            capturedAt: CAPTURED_AT,
            platform: "ios",
          },
          baseDeps({
            buildAthleteAuthoritySnapshot: async () => ({
              sorted: [{ id: "ath_1", name: "Alice" }],
              operatingAthleteRoster: [{ id: "ath_1", name: "Alice" }],
              resolvedId: "ath_1",
              loadedKids: {},
              authorityBootstrapState: "ready",
              coachOperatingAthleteChoices: [],
              parentActiveAthleteId: "ath_1",
              coachSessionRefreshDegraded: false,
              linkedSharedAthleteIds: ["ath_1"],
              writerSessionRefresh: {
                successfulSnapshots: [],
                writerLinks: [],
                inviteSessionAthletesByToken: {},
                hydrationOutcome: { reconcileAttempted: true, reconcileCompleted: true },
              },
              reconcileAttempted: true,
            }),
            projectAuthoritySnapshot: () => ({
              contractVersion: AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
              capturedAt: CAPTURED_AT,
              deviceRole: "coach",
              resolvedOperatingAthleteId: "ath_1",
              parentActiveAthleteId: "ath_1",
              authorityBootstrapState: "ready",
              coachSessionRefreshDegraded: false,
              operatingAthleteRosterCount: 1,
              linkedSharedAthleteIds: ["ath_1"],
            }),
            captureHydrationSnapshot: async () => ({
              contractVersion: HYDRATION_SNAPSHOT_CONTRACT_VERSION,
              capturedAt: CAPTURED_AT,
              deviceRole: "coach",
              syncConfigured: true,
              captureMode: "shared_authority_reconcile",
              hydrationVersion: 1,
            }),
            captureWorkerSessionSnapshot: async () => ({
              contractVersion: WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
              capturedAt: CAPTURED_AT,
              deviceRole: "coach",
              syncConfigured: true,
              captureMode: "get_only",
              activeLinkCount: 1,
              sessionsFetchedOkCount: 1,
              allSessionsFetched: true,
              links: [],
            }),
            captureCompetitionSnapshot: async () => ({
              contractVersion: COMPETITION_SNAPSHOT_CONTRACT_VERSION,
              capturedAt: CAPTURED_AT,
              deviceRole: "coach",
              sharedAthleteId: "ath_1",
              visibleCompetitionCount: 0,
              competitions: [],
            }),
            captureTopologySnapshot: async () => {
              throw new Error("topology capture failed");
            },
          }),
        ),
      /topology capture failed/,
    );
  });

  it("rejects trivial correlation ids before capture begins", async () => {
    let authorityCalled = false;
    await assert.rejects(
      () =>
        captureIncidentBundle(
          {
            deviceRole: "parent",
            incidentCorrelationId: "short",
            capturedAt: CAPTURED_AT,
            platform: "ios",
          },
          baseDeps({
            captureAuthoritySnapshot: async () => {
              authorityCalled = true;
              throw new Error("should not run");
            },
          }),
        ),
      /incidentCorrelationId is required/,
    );
    assert.equal(authorityCalled, false);
  });
});
