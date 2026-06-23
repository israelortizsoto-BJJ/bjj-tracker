import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../authoritySnapshotContract";
import { COMPETITION_SNAPSHOT_CONTRACT_VERSION } from "../competitionSnapshotContract";
import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "../hydrationSnapshotContract";
import type { IncidentBundleV1, IncidentBundleV2 } from "../incidentBundleContract";
import { validateIncidentBundle } from "../validateIncidentBundle";
import { TOPOLOGY_SNAPSHOT_CONTRACT_VERSION } from "../topologySnapshotContract";
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
      competition: {
        contractVersion: COMPETITION_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole,
        sharedAthleteId: "ath_1",
        visibleCompetitionCount: 0,
        competitions: [],
      },
    },
  };
}

function validCoachV2Bundle(): IncidentBundleV2 {
  return {
    bundleVersion: "2",
    capturedAt: CAPTURED_AT,
    deviceRole: "coach",
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
        deviceRole: "coach",
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
        deviceRole: "coach",
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
        deviceRole: "coach",
        syncConfigured: true,
        captureMode: "shared_authority_reconcile",
        hydrationVersion: 1,
      },
      competition: {
        contractVersion: COMPETITION_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "coach",
        sharedAthleteId: "ath_1",
        visibleCompetitionCount: 0,
        competitions: [],
      },
      topology: {
        contractVersion: TOPOLOGY_SNAPSHOT_CONTRACT_VERSION,
        capturedAt: CAPTURED_AT,
        deviceRole: "coach",
        syncConfigured: true,
        captureMode: "coach_substrate_probe",
        athleteDomain: {
          sharedAthleteId: "ath_1",
          memoryLoaded: true,
          peekOutcome: "hit",
          peekArtifactUpdatedAt: "2026-06-19T11:00:00.000Z",
          diskPresent: true,
          diskArtifactUpdatedAt: "2026-06-19T11:00:00.000Z",
          peekCompetitionCount: 0,
          peekMatchCount: 0,
          diskCompetitionCount: 0,
          diskMatchCount: 0,
          competitions: [],
        },
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

  it("accepts a structurally valid coach V2 bundle with topology", () => {
    assert.doesNotThrow(() => validateIncidentBundle(validCoachV2Bundle()));
  });

  it("rejects parent bundle containing topology", () => {
    const bundle = validBundle("parent");
    (bundle.artifacts as IncidentBundleV1["artifacts"] & { topology?: unknown }).topology = {};
    assert.throws(
      () => validateIncidentBundle(bundle),
      /parent bundle must not include topology/,
    );
  });

  it("rejects coach V2 bundle missing topology artifact key", () => {
    const bundle = validCoachV2Bundle();
    bundle.artifacts = {
      authority: bundle.artifacts.authority,
      workerSession: bundle.artifacts.workerSession,
      hydration: bundle.artifacts.hydration,
      competition: bundle.artifacts.competition,
    } as IncidentBundleV2["artifacts"];
    assert.throws(
      () => validateIncidentBundle(bundle),
      /artifacts must contain exactly authority, workerSession, hydration, competition, topology/,
    );
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
