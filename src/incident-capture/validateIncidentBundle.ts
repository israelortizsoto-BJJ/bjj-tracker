import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "./authoritySnapshotContract";
import { COMPETITION_SNAPSHOT_CONTRACT_VERSION } from "./competitionSnapshotContract";
import { HYDRATION_SNAPSHOT_CONTRACT_VERSION } from "./hydrationSnapshotContract";
import {
  INCIDENT_BUNDLE_CONTRACT_VERSION,
  INCIDENT_BUNDLE_V2_CONTRACT_VERSION,
  type IncidentBundle,
  type IncidentBundleArtifactsV1,
  type IncidentBundleArtifactsCoachV2,
} from "./incidentBundleContract";
import { TOPOLOGY_SNAPSHOT_CONTRACT_VERSION } from "./topologySnapshotContract";
import { WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION } from "./workerSessionSnapshotContract";

const ARTIFACT_KEYS_V1 = ["authority", "workerSession", "hydration", "competition"] as const;
const ARTIFACT_KEYS_V2 = ["authority", "workerSession", "hydration", "competition", "topology"] as const;
const COMPETITION_ROW_KEYS = [
  "sharedCompetitionId",
  "entryId",
  "entryMatchCount",
  "entryMatchIds",
  "localArtifactSetPresent",
  "localArtifactCount",
  "localArtifactLineageKeys",
  "annotationAcceptedCount",
  "annotationAcceptedLineageKeys",
  "annotationRejectedCount",
  "annotationRejectReasons",
  "mergeMatchedCount",
  "mergeMatchedLineageKeys",
  "projectedCoachNoteCount",
  "firstFailureLayer",
] as const;
const COMPETITION_FAILURE_LAYERS = new Set([
  "local_artifact_missing",
  "annotation_rejected",
  "merge_exact_id_mismatch",
  "render_projection_missing",
  "none_detected",
]);
const HYDRATION_READINESS_STATES = new Set([
  "PENDING",
  "READY",
  "EMPTY_READY",
  "FAILED",
]);
const HYDRATION_READINESS_SOURCES = new Set([
  "coach_reconcile",
  "parent_session_refresh",
  "persisted_replay",
]);
const HYDRATION_CONFIRMED_STATES = new Set(["READY", "EMPTY_READY"]);

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`validateIncidentBundle: ${field} is required`);
  }
}

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`validateIncidentBundle: ${field} must be a string array`);
  }
}

function assertNullableString(value: unknown, field: string): void {
  if (value !== null && typeof value !== "string") {
    throw new Error(`validateIncidentBundle: ${field} must be a string or null`);
  }
}

function validateHydrationAnalysisReadiness(
  hydration: IncidentBundleArtifactsV1["hydration"],
): void {
  if (!Array.isArray(hydration.analysisReadiness)) {
    throw new Error(
      "validateIncidentBundle: hydration.analysisReadiness required",
    );
  }
  for (const row of hydration.analysisReadiness) {
    assertNonEmptyString(
      row.sharedAthleteId,
      "hydration.analysisReadiness.sharedAthleteId",
    );
    if (!HYDRATION_READINESS_STATES.has(row.state)) {
      throw new Error(
        "validateIncidentBundle: invalid hydration.analysisReadiness.state",
      );
    }
    if (
      !Number.isInteger(row.generation) ||
      row.generation < 0
    ) {
      throw new Error(
        "validateIncidentBundle: invalid hydration.analysisReadiness.generation",
      );
    }
    assertNonEmptyString(
      row.startedAt,
      "hydration.analysisReadiness.startedAt",
    );
    assertNullableString(
      row.resolvedAt,
      "hydration.analysisReadiness.resolvedAt",
    );
    if (
      row.state === "PENDING" &&
      row.resolvedAt !== null
    ) {
      throw new Error(
        "validateIncidentBundle: PENDING hydration readiness must not be resolved",
      );
    }
    if (
      row.state !== "PENDING" &&
      (typeof row.resolvedAt !== "string" ||
        row.resolvedAt.trim().length === 0)
    ) {
      throw new Error(
        "validateIncidentBundle: terminal hydration readiness requires resolvedAt",
      );
    }
    if (!HYDRATION_READINESS_SOURCES.has(row.hydrationSource)) {
      throw new Error(
        "validateIncidentBundle: invalid hydration.analysisReadiness.hydrationSource",
      );
    }
    assertNullableString(
      row.artifactSetUpdatedAt,
      "hydration.analysisReadiness.artifactSetUpdatedAt",
    );
    assertNullableString(
      row.currentArtifactStoreUpdatedAt,
      "hydration.analysisReadiness.currentArtifactStoreUpdatedAt",
    );
    if (
      row.lastConfirmedState !== null &&
      !HYDRATION_CONFIRMED_STATES.has(row.lastConfirmedState)
    ) {
      throw new Error(
        "validateIncidentBundle: invalid hydration.analysisReadiness.lastConfirmedState",
      );
    }
    assertNullableString(
      row.lastConfirmedAt,
      "hydration.analysisReadiness.lastConfirmedAt",
    );
    assertNullableString(
      row.lastConfirmedArtifactSetUpdatedAt,
      "hydration.analysisReadiness.lastConfirmedArtifactSetUpdatedAt",
    );
  }
}

function assertExactCompetitionRowKeys(row: Record<string, unknown>): void {
  const keys = Object.keys(row).sort();
  const expected = [...COMPETITION_ROW_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error("validateIncidentBundle: invalid competition row keys");
  }
}

function assertArtifactKeysV1(artifacts: IncidentBundleArtifactsV1): void {
  const keys = Object.keys(artifacts).sort();
  const expected = [...ARTIFACT_KEYS_V1].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(
      `validateIncidentBundle: artifacts must contain exactly authority, workerSession, hydration, competition`,
    );
  }
}

function assertArtifactKeysV2(artifacts: IncidentBundleArtifactsCoachV2): void {
  const keys = Object.keys(artifacts).sort();
  const expected = [...ARTIFACT_KEYS_V2].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(
      `validateIncidentBundle: artifacts must contain exactly authority, workerSession, hydration, competition, topology`,
    );
  }
}

function validateSharedEnvelope(bundle: IncidentBundle): void {
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
}

function validateCoreArtifacts(
  bundle: IncidentBundle,
  artifacts: IncidentBundleArtifactsV1,
): void {
  const { authority, workerSession, hydration, competition } = artifacts;

  if (authority.contractVersion !== AUTHORITY_SNAPSHOT_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid authority.contractVersion");
  }
  if (workerSession.contractVersion !== WORKER_SESSION_SNAPSHOT_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid workerSession.contractVersion");
  }
  if (hydration.contractVersion !== HYDRATION_SNAPSHOT_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid hydration.contractVersion");
  }
  if (competition.contractVersion !== COMPETITION_SNAPSHOT_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid competition.contractVersion");
  }
  validateHydrationAnalysisReadiness(hydration);

  for (const artifact of [authority, workerSession, hydration, competition]) {
    if (artifact.capturedAt !== bundle.capturedAt) {
      throw new Error("validateIncidentBundle: artifact capturedAt must match bundle capturedAt");
    }
    if (artifact.deviceRole !== bundle.deviceRole) {
      throw new Error("validateIncidentBundle: artifact deviceRole must match bundle deviceRole");
    }
  }

  assertNonEmptyString(competition.sharedAthleteId, "competition.sharedAthleteId");
  if (typeof competition.visibleCompetitionCount !== "number") {
    throw new Error("validateIncidentBundle: competition.visibleCompetitionCount required");
  }
  if (!Array.isArray(competition.competitions)) {
    throw new Error("validateIncidentBundle: competition.competitions required");
  }
  if (competition.visibleCompetitionCount !== competition.competitions.length) {
    throw new Error("validateIncidentBundle: competition.visibleCompetitionCount mismatch");
  }
  for (const row of competition.competitions) {
    assertExactCompetitionRowKeys(row as unknown as Record<string, unknown>);
    assertNonEmptyString(row.sharedCompetitionId, "competition.sharedCompetitionId");
    assertNonEmptyString(row.entryId, "competition.entryId");
    if (
      typeof row.entryMatchCount !== "number" ||
      typeof row.localArtifactSetPresent !== "boolean" ||
      typeof row.localArtifactCount !== "number" ||
      typeof row.annotationAcceptedCount !== "number" ||
      typeof row.annotationRejectedCount !== "number" ||
      typeof row.mergeMatchedCount !== "number" ||
      typeof row.projectedCoachNoteCount !== "number"
    ) {
      throw new Error("validateIncidentBundle: invalid competition numeric fields");
    }
    assertStringArray(row.entryMatchIds, "competition.entryMatchIds");
    assertStringArray(row.localArtifactLineageKeys, "competition.localArtifactLineageKeys");
    assertStringArray(row.annotationAcceptedLineageKeys, "competition.annotationAcceptedLineageKeys");
    assertStringArray(row.annotationRejectReasons, "competition.annotationRejectReasons");
    assertStringArray(row.mergeMatchedLineageKeys, "competition.mergeMatchedLineageKeys");
    if (!COMPETITION_FAILURE_LAYERS.has(row.firstFailureLayer)) {
      throw new Error("validateIncidentBundle: invalid competition.firstFailureLayer");
    }
  }
}

function validateV1Bundle(bundle: IncidentBundle): void {
  if (bundle.bundleVersion !== INCIDENT_BUNDLE_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid bundleVersion");
  }
  if (bundle.deviceRole === "parent" && "topology" in bundle.artifacts) {
    throw new Error("validateIncidentBundle: parent bundle must not include topology");
  }
  assertArtifactKeysV1(bundle.artifacts);
  validateCoreArtifacts(bundle, bundle.artifacts);
}

function validateV2Bundle(bundle: IncidentBundle): void {
  if (bundle.bundleVersion !== INCIDENT_BUNDLE_V2_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid bundleVersion");
  }
  if (bundle.deviceRole !== "coach") {
    throw new Error("validateIncidentBundle: bundleVersion 2 requires coach deviceRole");
  }
  assertArtifactKeysV2(bundle.artifacts);
  validateCoreArtifacts(bundle, bundle.artifacts);

  const { topology } = bundle.artifacts;
  if (topology.contractVersion !== TOPOLOGY_SNAPSHOT_CONTRACT_VERSION) {
    throw new Error("validateIncidentBundle: invalid topology.contractVersion");
  }
  if (topology.capturedAt !== bundle.capturedAt) {
    throw new Error("validateIncidentBundle: artifact capturedAt must match bundle capturedAt");
  }
  if (topology.deviceRole !== "coach") {
    throw new Error("validateIncidentBundle: topology.deviceRole must be coach");
  }
}

/** Fail-closed structural validator for Incident Bundle V1/V2 exports. */
export function validateIncidentBundle(bundle: IncidentBundle): void {
  validateSharedEnvelope(bundle);

  if (bundle.bundleVersion === INCIDENT_BUNDLE_CONTRACT_VERSION) {
    validateV1Bundle(bundle);
    return;
  }

  if (bundle.bundleVersion === INCIDENT_BUNDLE_V2_CONTRACT_VERSION) {
    validateV2Bundle(bundle);
    return;
  }

  throw new Error("validateIncidentBundle: invalid bundleVersion");
}
