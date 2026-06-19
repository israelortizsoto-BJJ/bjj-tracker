import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../authoritySnapshotContract";
import {
  captureIncidentBundle,
  type CaptureIncidentBundleDeps,
} from "../captureIncidentBundle";
import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "../hydrationSnapshotContract";
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
