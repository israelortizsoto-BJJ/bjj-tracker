/** HTTP header for overlay publish correlation. Ephemeral — never persisted to KV or AsyncStorage. */
export const OVERLAY_FORENSIC_TRACE_HEADER = "X-Overlay-Forensic-Trace-Id";

/** Ephemeral correlation id for [OVERLAY_FORENSIC] pipeline tracing. */
export function createOverlayForensicTraceId(sharedAthleteId: string): string {
  const athleteTail = sharedAthleteId.trim().slice(-6) || "unknown";
  return `${athleteTail}-${Date.now()}`;
}
