/**
 * Stable reason-code and retry-classification types from
 * SharedMatchMedia-ProductionVerificationService-Contract-v1 §7.
 *
 * These are record/contract types only. This skeleton does not schedule or
 * execute retries, scan objects, or encode a privacy/product policy decision.
 */

export const RETRY_CLASSIFICATIONS = [
  "retryable",
  "non_retryable",
  "exhausted",
  "operator_required",
  "not_applicable",
] as const;

export type RetryClassification = (typeof RETRY_CLASSIFICATIONS)[number];

export const TERMINAL_REJECTION_REASON_CODES = [
  "BYTE_COUNT_MISMATCH",
  "SHA256_MISMATCH",
  "MIME_NOT_ALLOWED",
  "MIME_SIGNATURE_MISMATCH",
  "MALWARE_DETECTED",
  "CONTENT_POLICY_REJECTED",
  "OBJECT_IDENTITY_MISMATCH",
  "UNSUPPORTED_MEDIA_FORMAT",
] as const;

export const RETRYABLE_FAILURE_REASON_CODES = [
  "STORAGE_READ_TRANSIENT",
  "CONTAINER_START_TRANSIENT",
  "CONTAINER_EXECUTION_TRANSIENT",
  "VERIFIER_TIMEOUT",
  "RATE_LIMITED",
  "SCAN_PROVIDER_TRANSIENT",
  "EVIDENCE_WRITE_TRANSIENT",
] as const;

export const NON_RETRYABLE_FAILURE_REASON_CODES = [
  "OBJECT_NOT_FOUND_AFTER_COMPLETION",
  "OBJECT_VERSION_MISMATCH",
  "INVALID_COMPLETION_PROVENANCE",
  "INVALID_VERIFICATION_INPUT",
  "CONTRACT_VERSION_UNSUPPORTED",
  "REQUIRED_SCAN_POLICY_UNAVAILABLE",
] as const;

export const OPERATOR_OR_EXHAUSTED_REASON_CODES = [
  "RETRY_BUDGET_EXHAUSTED",
  "STUCK_ATTEMPT_REQUIRES_RECONCILIATION",
  "POLICY_DECISION_REQUIRED",
] as const;

/**
 * Certified reason-code set only (contract §7). Verified success uses
 * retryClassification `not_applicable` and no invented success reason code.
 */
export const ALL_REASON_CODES = [
  ...TERMINAL_REJECTION_REASON_CODES,
  ...RETRYABLE_FAILURE_REASON_CODES,
  ...NON_RETRYABLE_FAILURE_REASON_CODES,
  ...OPERATOR_OR_EXHAUSTED_REASON_CODES,
] as const;

export type TerminalRejectionReasonCode =
  (typeof TERMINAL_REJECTION_REASON_CODES)[number];
export type RetryableFailureReasonCode =
  (typeof RETRYABLE_FAILURE_REASON_CODES)[number];
export type NonRetryableFailureReasonCode =
  (typeof NON_RETRYABLE_FAILURE_REASON_CODES)[number];
export type OperatorOrExhaustedReasonCode =
  (typeof OPERATOR_OR_EXHAUSTED_REASON_CODES)[number];
export type VerificationReasonCode = (typeof ALL_REASON_CODES)[number];

const RETRY_SET = new Set<string>(RETRY_CLASSIFICATIONS);
const REASON_SET = new Set<string>(ALL_REASON_CODES);

export function isRetryClassification(value: unknown): value is RetryClassification {
  return typeof value === "string" && RETRY_SET.has(value);
}

export function isVerificationReasonCode(
  value: unknown,
): value is VerificationReasonCode {
  return typeof value === "string" && REASON_SET.has(value);
}

export function parseRetryClassification(value: unknown): RetryClassification {
  if (!isRetryClassification(value)) {
    throw new Error(`Unsupported retryClassification: ${String(value)}`);
  }
  return value;
}

export function parseVerificationReasonCode(value: unknown): VerificationReasonCode {
  if (!isVerificationReasonCode(value)) {
    throw new Error(`Unsupported terminalReasonCode: ${String(value)}`);
  }
  return value;
}

export function defaultRetryClassificationForReason(
  reason: VerificationReasonCode,
): RetryClassification {
  if ((TERMINAL_REJECTION_REASON_CODES as readonly string[]).includes(reason)) {
    return "non_retryable";
  }
  if ((RETRYABLE_FAILURE_REASON_CODES as readonly string[]).includes(reason)) {
    return "retryable";
  }
  if (reason === "RETRY_BUDGET_EXHAUSTED") {
    return "exhausted";
  }
  if (
    reason === "STUCK_ATTEMPT_REQUIRES_RECONCILIATION" ||
    reason === "POLICY_DECISION_REQUIRED"
  ) {
    return "operator_required";
  }
  if ((NON_RETRYABLE_FAILURE_REASON_CODES as readonly string[]).includes(reason)) {
    return "non_retryable";
  }
  return "non_retryable";
}
