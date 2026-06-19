import type { AuthoritySnapshot } from "./authoritySnapshotContract";
import type { HydrationSnapshot } from "./hydrationSnapshotContract";
import type { WorkerSessionSnapshot } from "./workerSessionSnapshotContract";

/** Frozen Incident Bundle V1 contract version. */
export const INCIDENT_BUNDLE_CONTRACT_VERSION = "1" as const;

export type IncidentBundleExportSource = "developer_tools";

export type IncidentBundlePlatform = "ios" | "android";

export type IncidentBundleDeviceRole = "parent" | "coach";

export type IncidentBundleArtifactsV1 = {
  authority: AuthoritySnapshot;
  workerSession: WorkerSessionSnapshot;
  hydration: HydrationSnapshot;
};

/** Production-safe Incident Bundle V1 export shape (Tier 0 envelope + Tier 1 artifacts). */
export type IncidentBundleV1 = {
  bundleVersion: typeof INCIDENT_BUNDLE_CONTRACT_VERSION;
  capturedAt: string;
  deviceRole: IncidentBundleDeviceRole;
  platform: IncidentBundlePlatform;
  buildNumber: string;
  appVariant: "dev" | "prod";
  syncConfigured: boolean;
  writerLinkCount: number;
  incidentCorrelationId: string;
  exportSource: IncidentBundleExportSource;
  artifacts: IncidentBundleArtifactsV1;
};

export type IncidentBundleEnvelopeV1 = Omit<IncidentBundleV1, "artifacts">;
