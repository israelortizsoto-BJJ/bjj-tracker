/**
 * First-slice object integrity gates: MIME, observed byte count, whole-object SHA-256.
 *
 * - Full-object stream supplies observedByteCount + calculatedSha256.
 * - SHA compare runs only when expectedWholeObjectSha256 is present.
 * - Absent expected SHA must not alone reject.
 * - ETags / multipart part hashes are never accepted as whole-object SHA.
 * - R2 content-type is observational only (delegated to mimePolicy).
 */

import {
  detectContainerSignature,
  evaluateMimePolicy,
  type MimePolicyResult,
} from "./mimePolicy.ts";
import type { VerificationReasonCode } from "./reasonCodes.ts";

export type ObjectIntegrityInput = {
  readonly declaredMimeType?: string;
  readonly declaredByteCount?: number;
  readonly expectedWholeObjectSha256?: string;
  readonly observedByteCount: number;
  readonly calculatedSha256: string;
  readonly mimePrefix: Uint8Array;
  /** Observational only — never independently produces verified. */
  readonly r2ContentType?: string | null;
};

export type ObjectIntegrityPass = {
  readonly outcome: "pass";
  readonly observedByteCount: number;
  readonly calculatedSha256: string;
  readonly observedMimeType: "video/mp4";
  readonly declaredMimeType: string;
  readonly expectedWholeObjectSha256: string | null;
  readonly shaComparison: "matched" | "skipped_absent_expected";
  readonly mime: Extract<MimePolicyResult, { outcome: "pass" }>;
};

export type ObjectIntegrityReject = {
  readonly outcome: "reject";
  readonly terminalReasonCode: Extract<
    VerificationReasonCode,
    | "BYTE_COUNT_MISMATCH"
    | "SHA256_MISMATCH"
    | "MIME_NOT_ALLOWED"
    | "MIME_SIGNATURE_MISMATCH"
    | "UNSUPPORTED_MEDIA_FORMAT"
  >;
  readonly observedByteCount: number;
  readonly calculatedSha256: string;
  readonly observedMimeType: string | null;
  readonly declaredMimeType: string | null;
  readonly expectedWholeObjectSha256: string | null;
  readonly mime: MimePolicyResult;
};

export type ObjectIntegrityResult = ObjectIntegrityPass | ObjectIntegrityReject;

function normalizeSha256Hex(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

/**
 * Evaluate first-slice integrity after a complete-object stream inspection.
 *
 * Gate order:
 *   1. MIME policy (declared + detected; R2 content-type non-decisive)
 *   2. Byte-count equality vs authoritative declared/completed count
 *   3. SHA-256 equality only when a controlling expected digest exists
 */
export function evaluateObjectIntegrity(
  input: ObjectIntegrityInput,
): ObjectIntegrityResult {
  const detected = detectContainerSignature(input.mimePrefix);
  const mime = evaluateMimePolicy(input.declaredMimeType, detected, {
    r2ContentType: input.r2ContentType,
  });

  const calculatedSha256 = input.calculatedSha256.trim().toLowerCase();
  const expectedWholeObjectSha256 = normalizeSha256Hex(input.expectedWholeObjectSha256);

  if (mime.outcome === "reject") {
    return {
      outcome: "reject",
      terminalReasonCode: mime.terminalReasonCode,
      observedByteCount: input.observedByteCount,
      calculatedSha256,
      observedMimeType: mime.observedMimeType,
      declaredMimeType: mime.declaredMimeType,
      expectedWholeObjectSha256,
      mime,
    };
  }

  if (
    typeof input.declaredByteCount !== "number" ||
    !Number.isSafeInteger(input.declaredByteCount) ||
    input.declaredByteCount < 0 ||
    input.observedByteCount !== input.declaredByteCount
  ) {
    return {
      outcome: "reject",
      terminalReasonCode: "BYTE_COUNT_MISMATCH",
      observedByteCount: input.observedByteCount,
      calculatedSha256,
      observedMimeType: mime.observedMimeType,
      declaredMimeType: mime.declaredMimeType,
      expectedWholeObjectSha256,
      mime,
    };
  }

  if (expectedWholeObjectSha256 !== null && expectedWholeObjectSha256 !== calculatedSha256) {
    return {
      outcome: "reject",
      terminalReasonCode: "SHA256_MISMATCH",
      observedByteCount: input.observedByteCount,
      calculatedSha256,
      observedMimeType: mime.observedMimeType,
      declaredMimeType: mime.declaredMimeType,
      expectedWholeObjectSha256,
      mime,
    };
  }

  return {
    outcome: "pass",
    observedByteCount: input.observedByteCount,
    calculatedSha256,
    observedMimeType: mime.observedMimeType,
    declaredMimeType: mime.declaredMimeType,
    expectedWholeObjectSha256,
    shaComparison:
      expectedWholeObjectSha256 === null ? "skipped_absent_expected" : "matched",
    mime,
  };
}
