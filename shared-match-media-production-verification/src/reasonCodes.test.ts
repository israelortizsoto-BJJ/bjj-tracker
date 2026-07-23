import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALL_REASON_CODES,
  RETRY_CLASSIFICATIONS,
  TERMINAL_REJECTION_REASON_CODES,
  isRetryClassification,
  isVerificationReasonCode,
  parseRetryClassification,
  parseVerificationReasonCode,
} from "./reasonCodes.ts";

describe("stable reason-code and retry-classification types", () => {
  it("preserves certified retry-classification serialized values", () => {
    assert.deepEqual([...RETRY_CLASSIFICATIONS], [
      "retryable",
      "non_retryable",
      "exhausted",
      "operator_required",
      "not_applicable",
    ]);
  });

  it("preserves certified terminal-rejection reason codes", () => {
    assert.ok(TERMINAL_REJECTION_REASON_CODES.includes("BYTE_COUNT_MISMATCH"));
    assert.ok(TERMINAL_REJECTION_REASON_CODES.includes("SHA256_MISMATCH"));
    assert.ok(TERMINAL_REJECTION_REASON_CODES.includes("MIME_NOT_ALLOWED"));
    assert.ok(ALL_REASON_CODES.includes("STUCK_ATTEMPT_REQUIRES_RECONCILIATION"));
    assert.ok(ALL_REASON_CODES.includes("RETRY_BUDGET_EXHAUSTED"));
  });

  it("rejects unsupported persisted values safely", () => {
    assert.equal(isRetryClassification("maybe"), false);
    assert.equal(isVerificationReasonCode("MALWARE_MAYBE"), false);
    assert.throws(() => parseRetryClassification("maybe"), /Unsupported retryClassification/);
    assert.throws(
      () => parseVerificationReasonCode("INVENTED_SCAN_POLICY"),
      /Unsupported terminalReasonCode/,
    );
  });

  it("does not invent production-scanning policy decision codes beyond the contract set", () => {
    const codes: readonly string[] = ALL_REASON_CODES;
    assert.equal(codes.includes("AUTO_APPROVE_SCAN"), false);
    assert.equal(codes.includes("PRIVACY_APPROVED"), false);
    const retries: readonly string[] = RETRY_CLASSIFICATIONS;
    assert.equal(retries.includes("auto_approve"), false);
  });
});
