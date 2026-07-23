/**
 * Bounded structured observability for Production Verification canary control.
 *
 * Logs are telemetry only. Durable ProductionVerificationRecord remains
 * authoritative. Never log secrets, media content, complete storage keys, or
 * media bytes.
 */

export type ObservabilityMarker =
  | "production_verification_canary_gate"
  | "production_verification_admission"
  | "production_verification_execution_acquisition"
  | "production_verification_inspection_start"
  | "production_verification_terminal"
  | "production_verification_operator_inspection";

export type SanitizedObservabilityEvent = {
  readonly marker: ObservabilityMarker;
  readonly timestamp: string;
  readonly [key: string]: string | number | boolean | null;
};

export type ObservabilitySink = (event: SanitizedObservabilityEvent) => void;

const defaultSink: ObservabilitySink = (event) => {
  try {
    console.log(JSON.stringify(event));
  } catch {
    // Telemetry must never alter control flow.
  }
};

let activeSink: ObservabilitySink = defaultSink;

/** Test seam — restore with restoreObservabilitySink(). */
export function setObservabilitySink(sink: ObservabilitySink): void {
  activeSink = sink;
}

export function restoreObservabilitySink(): void {
  activeSink = defaultSink;
}

export function emitProductionVerificationMarker(
  marker: ObservabilityMarker,
  fields: Readonly<Record<string, string | number | boolean | null>>,
  now: () => Date = () => new Date(),
): void {
  activeSink({
    marker,
    timestamp: now().toISOString(),
    ...fields,
  });
}
