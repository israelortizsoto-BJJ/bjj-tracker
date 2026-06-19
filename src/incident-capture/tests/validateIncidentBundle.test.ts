import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../authoritySnapshotContract";
import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "../hydrationSnapshotContract";
import type { IncidentBundleV1 } from "../incidentBundleContract";
import { validateIncidentBundle } from "../validateIncidentBundle";
import { WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION } from "../workerSessionSnapshotContract";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const CORRELATION_ID = "corr-validate-001";

function validBundle(deviceRole: "parent" | "coach" = "parent"): IncidentBundleV1 {
  return {
    bundleVersion: "1",
    capturedAt: CAPTURED_AT,
    deviceRole,
    platform: "ios",
    buildNumber: "4",
    appVariant: "dev",
    syncConfigured: true,
    writerLinkCount: 1,
    incidentCorrelationId: CORRELATION_ID,
    exportSource: "developer_tools",
    artifacts: {
      authority: {
        contractVersion: AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole,
        resolvedOperatingAthleteId: "ath_1",
        parentActiveAthleteId: "ath_1",
        authorityBootstrapState: "ready",
        coachSessionRefreshDegraded: false,
        operatingAthleteRosterCount: 1,
        linkedSharedAthleteIds: ["ath_1"],
      },
      workerSession: {
        contractVersion: WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole,
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
        deviceRole,
        syncConfigured: true,
        captureMode: "read_only_state",
        hydrationVersion: 1,
      },
    },
  };
}

describe("validateIncidentBundle", () => {
  it("accepts a structurally valid parent bundle", () => {
    assert.doesNotThrow(() => validateIncidentBundle(validBundle("parent")));
  });

  it("accepts a structurally valid coach bundle", () => {
    const bundle = validBundle("coach");
    bundle.artifacts.hydration.captureMode = "shared_authority_reconcile";
    assert.doesNotThrow(() => validateIncidentBundle(bundle));
  });

  it("rejects missing incidentCorrelationId", () => {
    const bundle = validBundle();
    bundle.incidentCorrelationId = "   ";
    assert.throws(
      () => validateIncidentBundle(bundle),
      /incidentCorrelationId is required/,
    );
  });

  it("rejects extra artifact keys", () => {
    const bundle = validBundle();
    (bundle.artifacts as IncidentBundleV1["artifacts"] & { replay?: unknown }).replay = {};
    assert.throws(
      () => validateIncidentBundle(bundle),
      /artifacts must contain exactly/,
    );
  });

  it("rejects mismatched artifact capturedAt", () => {
    const bundle = validBundle();
    bundle.artifacts.authority.capturedAt = "2026-06-19T13:00:00.000Z";
    assert.throws(
      () => validateIncidentBundle(bundle),
      /artifact capturedAt must match bundle capturedAt/,
    );
  });

  it("rejects invalid authority contractVersion", () => {
    const bundle = validBundle();
    (bundle.artifacts.authority.contractVersion as string) = "2";
    assert.throws(
      () => validateIncidentBundle(bundle),
      /invalid authority.contractVersion/,
    );
  });
});
