import {
  INCIDENT_BUNDLE_CONTRACT_VERSION,
  type IncidentBundleEnvelopeV1,
  type IncidentBundleExportSource,
} from "./incidentBundleContract";
import type { IncidentBundleDeviceContext } from "./resolveIncidentBundleDeviceContext";

export type AssembleIncidentBundleEnvelopeInput = IncidentBundleDeviceContext & {
  capturedAt: string;
  incidentCorrelationId: string;
  exportSource?: IncidentBundleExportSource;
};

/** Assembles Tier 0 envelope fields (no artifacts). */
export function assembleIncidentBundleEnvelope(
  input: AssembleIncidentBundleEnvelopeInput,
): IncidentBundleEnvelopeV1 {
  return {
    bundleVersion: INCIDENT_BUNDLE_CONTRACT_VERSION,
    capturedAt: input.capturedAt,
    deviceRole: input.deviceRole,
    platform: input.platform,
    buildNumber: input.buildNumber,
    appVariant: input.appVariant,
    syncConfigured: input.syncConfigured,
    writerLinkCount: input.writerLinkCount,
    incidentCorrelationId: input.incidentCorrelationId,
    exportSource: input.exportSource ?? "developer_tools",
  };
}
