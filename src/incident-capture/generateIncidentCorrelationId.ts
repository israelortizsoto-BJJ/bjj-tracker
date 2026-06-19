/** Generates a correlation ID for paired parent/coach incident exports. */
export function generateIncidentCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `incident-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
