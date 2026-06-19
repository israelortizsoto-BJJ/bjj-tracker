import type { IncidentBundleV1 } from "./incidentBundleContract";

export type ExportIncidentBundleJsonResult = {
  json: string;
  filename: string;
};

/** Serializes a validated bundle to pretty JSON and a stable export filename. */
export function exportIncidentBundleJson(bundle: IncidentBundleV1): ExportIncidentBundleJsonResult {
  const filename = `incident-bundle-${bundle.deviceRole}-${bundle.incidentCorrelationId}.json`;
  return {
    json: JSON.stringify(bundle, null, 2),
    filename,
  };
}
