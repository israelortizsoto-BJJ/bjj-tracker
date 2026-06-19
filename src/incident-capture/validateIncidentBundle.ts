import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "./authoritySnapshotContract";
import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "./hydrationSnapshotContract";
import {
  INCIDENT_BUNDLE_CONTRACT_VERSION,
  type IncidentBundleArtifactsV1,
  type IncidentBundleV1,
} from "./incidentBundleContract";
import { WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION } from "./workerSessionSnapshotContract";

const ARTIFACT_KEYS = ["authority", "workerSession", "hydration"] as const;

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`validateIncidentBundle: ${field} is required`);
  }
}

function assertArtifactKeys(artifacts: IncidentBundleArtifactsV1): void {
  const keys = Object.keys(artifacts).sort();
  const expected = [...ARTIFACT_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(
      `validateIncidentBundle: artifacts must contain exactly authority, workerSession, hydration`,
    );
  }
}

/** Fail-closed structural validator for Incident Bundle V1 exports. */
export function validateIncidentBundle(bundle: IncidentBundleV1): void {
  if (bundle.bundleVersion !== INCIDENT_BUNDLE_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid bundleVersion");
  }

  if (bundle.deviceRole !== "parent" && bundle.deviceRole !== "coach") {
    throw new Error("validateIncidentBundle: deviceRole required");
  }

  assertNonEmptyString(bundle.capturedAt, "capturedAt");

  if (bundle.platform !== "ios" && bundle.platform !== "android") {
    throw new Error("validateIncidentBundle: invalid platform");
  }

  assertNonEmptyString(bundle.buildNumber, "buildNumber");

  if (bundle.appVariant !== "dev" && bundle.appVariant !== "prod") {
    throw new Error("validateIncidentBundle: invalid appVariant");
  }

  if (typeof bundle.syncConfigured !== "boolean") {
    throw new Error("validateIncidentBundle: syncConfigured required");
  }

  if (typeof bundle.writerLinkCount !== "number") {
    throw new Error("validateIncidentBundle: writerLinkCount required");
  }

  assertNonEmptyString(bundle.incidentCorrelationId, "incidentCorrelationId");

  if (bundle.exportSource !== "developer_tools") {
    throw new Error("validateIncidentBundle: invalid exportSource");
  }

  assertArtifactKeys(bundle.artifacts);

  const { authority, workerSession, hydration } = bundle.artifacts;

  if (authority.contractVersion !== AUTHORITY_SNAPSHOT_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid authority.contractVersion");
  }
  if (workerSession.contractVersion !== WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid workerSession.contractVersion");
  }
  if (hydration.contractVersion !== HYDRATION_SNAPSHOT_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid hydration.contractVersion");
  }

  for (const artifact of [authority, workerSession, hydration]) {
    if (artifact.capturedAt !== bundle.capturedAt) {
      throw new Error("validateIncidentBundle: artifact capturedAt must match bundle capturedAt");
    }
    if (artifact.deviceRole !== bundle.deviceRole) {
      throw new Error("validateIncidentBundle: artifact deviceRole must match bundle deviceRole");
    }
  }
}
