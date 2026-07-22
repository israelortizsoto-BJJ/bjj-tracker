export type AdmissionDecision =
  | { outcome: "admitted"; proofId: string; idempotent: boolean }
  | { outcome: "busy"; activeProofId: string };

export type ContainerTerminalStatus =
  | "passed"
  | "rejected"
  | "cancelled"
  | "timed_out"
  | "failed";

export type ContainerTerminalEvidence = {
  terminal: true;
  executor: "container-standard-1";
  evidenceId: string;
  proofId: string;
  status: ContainerTerminalStatus;
  objectVersion: string;
  streamedBytes: number;
  expectedBytes: number;
  expectedSha256: string;
  computedSha256: string;
  detectedMime: string;
  wallClockMs: number;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  peakRssBytes: number;
  hashAttempt: number;
  bytesReread: number;
  harnessVersion: string;
  failureCode?: string;
};

export type ReleaseDecision =
  | { outcome: "released"; proofId: string; evidenceId: string }
  | { outcome: "no_active_admission" }
  | { outcome: "wrong_identity"; activeProofId: string }
  | { outcome: "terminal_evidence_required" };

export function decideAdmission(
  activeProofId: string | undefined,
  requestedProofId: string,
): AdmissionDecision {
  if (!activeProofId) {
    return { outcome: "admitted", proofId: requestedProofId, idempotent: false };
  }
  if (activeProofId === requestedProofId) {
    return { outcome: "admitted", proofId: requestedProofId, idempotent: true };
  }
  return { outcome: "busy", activeProofId };
}

export function admissionPermitsContainer(
  decision: AdmissionDecision,
  proofId: string,
): boolean {
  return decision.outcome === "admitted" && decision.proofId === proofId;
}

export function isContainerTerminalEvidence(
  value: unknown,
  expectedProofId?: string,
): value is ContainerTerminalEvidence {
  if (!value || typeof value !== "object") return false;
  const evidence = value as Record<string, unknown>;
  return evidence.terminal === true &&
    evidence.executor === "container-standard-1" &&
    typeof evidence.evidenceId === "string" && /^container-evidence-[a-f0-9]{64}$/.test(evidence.evidenceId) &&
    typeof evidence.proofId === "string" && /^proof-[a-f0-9]{64}$/.test(evidence.proofId) &&
    (expectedProofId === undefined || evidence.proofId === expectedProofId) &&
    ["passed", "rejected", "cancelled", "timed_out", "failed"].includes(String(evidence.status)) &&
    typeof evidence.objectVersion === "string" && evidence.objectVersion.length > 0 &&
    typeof evidence.streamedBytes === "number" && Number.isSafeInteger(evidence.streamedBytes) && evidence.streamedBytes >= 0 &&
    typeof evidence.expectedBytes === "number" && Number.isSafeInteger(evidence.expectedBytes) && evidence.expectedBytes > 0 &&
    typeof evidence.expectedSha256 === "string" && /^[a-f0-9]{64}$/.test(evidence.expectedSha256) &&
    typeof evidence.computedSha256 === "string" && /^(?:[a-f0-9]{64})?$/.test(evidence.computedSha256) &&
    typeof evidence.detectedMime === "string" &&
    typeof evidence.wallClockMs === "number" && Number.isSafeInteger(evidence.wallClockMs) && evidence.wallClockMs >= 0 &&
    typeof evidence.cpuUserMicros === "number" && Number.isSafeInteger(evidence.cpuUserMicros) && evidence.cpuUserMicros >= 0 &&
    typeof evidence.cpuSystemMicros === "number" && Number.isSafeInteger(evidence.cpuSystemMicros) && evidence.cpuSystemMicros >= 0 &&
    typeof evidence.peakRssBytes === "number" && Number.isSafeInteger(evidence.peakRssBytes) && evidence.peakRssBytes >= 0 &&
    typeof evidence.hashAttempt === "number" && Number.isInteger(evidence.hashAttempt) && evidence.hashAttempt >= 1 &&
    typeof evidence.bytesReread === "number" && Number.isSafeInteger(evidence.bytesReread) && evidence.bytesReread >= 0 &&
    typeof evidence.harnessVersion === "string" && evidence.harnessVersion.length > 0 &&
    (evidence.failureCode === undefined || typeof evidence.failureCode === "string");
}

export function decideRelease(
  activeProofId: string | undefined,
  requestedProofId: string,
  evidence: unknown,
): ReleaseDecision {
  if (!activeProofId) return { outcome: "no_active_admission" };
  if (activeProofId !== requestedProofId) {
    return { outcome: "wrong_identity", activeProofId };
  }
  if (!isContainerTerminalEvidence(evidence, requestedProofId)) {
    return { outcome: "terminal_evidence_required" };
  }
  return { outcome: "released", proofId: requestedProofId, evidenceId: evidence.evidenceId };
}
