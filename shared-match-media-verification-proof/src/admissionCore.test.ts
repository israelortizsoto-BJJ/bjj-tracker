import assert from "node:assert/strict";
import test from "node:test";
import {
  admissionPermitsContainer,
  decideAdmission,
  decideRelease,
  isContainerTerminalEvidence,
  type ContainerTerminalEvidence,
} from "./admissionCore.ts";

const proofA = `proof-${"a".repeat(64)}`;
const proofB = `proof-${"b".repeat(64)}`;
const terminalEvidence: ContainerTerminalEvidence = {
  terminal: true,
  executor: "container-standard-1",
  evidenceId: `container-evidence-${"c".repeat(64)}`,
  proofId: proofA,
  status: "passed",
  objectVersion: "version-a",
  streamedBytes: 1024,
  expectedBytes: 1024,
  expectedSha256: "d".repeat(64),
  computedSha256: "d".repeat(64),
  detectedMime: "video/mp4",
  wallClockMs: 10,
  cpuUserMicros: 5,
  cpuSystemMicros: 2,
  peakRssBytes: 1024,
  hashAttempt: 1,
  bytesReread: 0,
  harnessVersion: "verification-container-runtime-proof-v1",
};

test("admitted Workflow retries admission idempotently after a lost response", () => {
  const retry = decideAdmission(proofA, proofA);
  assert.deepEqual(retry, { outcome: "admitted", proofId: proofA, idempotent: true });
  assert.equal(admissionPermitsContainer(retry, proofA), true);
});

test("competing Workflow cannot enter Container execution", () => {
  const competing = decideAdmission(proofA, proofB);
  assert.deepEqual(competing, { outcome: "busy", activeProofId: proofA });
  assert.equal(admissionPermitsContainer(competing, proofB), false);
});

test("failure after admission remains fail closed without terminal evidence", () => {
  assert.deepEqual(decideRelease(proofA, proofA, undefined), { outcome: "terminal_evidence_required" });
  assert.deepEqual(decideRelease(proofA, proofA, { terminal: false }), { outcome: "terminal_evidence_required" });
});

test("release from the wrong proof identity is rejected", () => {
  assert.deepEqual(decideRelease(proofA, proofB, { ...terminalEvidence, proofId: proofB }), {
    outcome: "wrong_identity",
    activeProofId: proofA,
  });
});

test("authoritative terminal Container evidence permits identity-checked release", () => {
  assert.equal(isContainerTerminalEvidence(terminalEvidence, proofA), true);
  assert.deepEqual(decideRelease(proofA, proofA, terminalEvidence), {
    outcome: "released",
    proofId: proofA,
    evidenceId: terminalEvidence.evidenceId,
  });
});

test("Workflow-shaped or malformed evidence cannot release admission", () => {
  assert.deepEqual(decideRelease(proofA, proofA, { status: "complete", proofId: proofA }), {
    outcome: "terminal_evidence_required",
  });
  assert.deepEqual(decideRelease(proofA, proofA, { ...terminalEvidence, executor: "workflow" }), {
    outcome: "terminal_evidence_required",
  });
});
