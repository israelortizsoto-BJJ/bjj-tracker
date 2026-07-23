/**
 * First-slice deterministic MIME policy for Production Verification.
 *
 * Authoritative signals:
 *   1. Declared MIME from Upload completion provenance (trim + lowercase).
 *   2. Bounded ISO-BMFF signature over the stream prefix (MIME_PREFIX_LIMIT).
 *
 * R2 httpMetadata.contentType is observational evidence only and never decides
 * allow/deny or independently produces a verified result.
 */

import type { VerificationReasonCode } from "./reasonCodes.ts";

export const MIME_PREFIX_LIMIT = 4096;

export const FIRST_SLICE_DECLARED_MIME_ALLOWLIST = [
  "video/mp4",
  "video/quicktime",
] as const;

export type FirstSliceDeclaredMime =
  (typeof FIRST_SLICE_DECLARED_MIME_ALLOWLIST)[number];

/** ISO-BMFF major brands accepted by the repository-supported detector. */
export const ISO_BMFF_ACCEPTED_BRANDS = [
  "isom",
  "iso2",
  "mp41",
  "mp42",
  "qt  ",
] as const;

export type IsoBmffBrand = (typeof ISO_BMFF_ACCEPTED_BRANDS)[number];

/**
 * Declared MIME after trim + lowercase, or a classification of why it failed.
 * Empty / syntactically invalid → not_allowed; well-formed unsupported → unsupported.
 */
export type NormalizedDeclaredMime =
  | { readonly kind: "allowed"; readonly value: FirstSliceDeclaredMime }
  | { readonly kind: "unsupported"; readonly value: string }
  | { readonly kind: "not_allowed"; readonly raw: string };

export type DetectedContainer =
  | {
      readonly kind: "iso_bmff";
      readonly brand: IsoBmffBrand;
      readonly observedMimeType: "video/mp4";
    }
  | { readonly kind: "inconclusive" }
  | {
      readonly kind: "recognized_foreign_family";
      readonly family: string;
    };

export type MimePolicyPass = {
  readonly outcome: "pass";
  readonly declaredMimeType: FirstSliceDeclaredMime;
  readonly observedMimeType: "video/mp4";
  readonly detectedBrand: IsoBmffBrand;
  /** Present only as observational evidence; never decisive. */
  readonly r2ContentType: string | null;
  readonly r2ContentTypeDisagreesWithDetection: boolean;
};

export type MimePolicyReject = {
  readonly outcome: "reject";
  readonly terminalReasonCode:
    | "MIME_NOT_ALLOWED"
    | "UNSUPPORTED_MEDIA_FORMAT"
    | "MIME_SIGNATURE_MISMATCH";
  readonly declaredMimeType: string | null;
  readonly observedMimeType: string | null;
  readonly r2ContentType: string | null;
};

export type MimePolicyResult = MimePolicyPass | MimePolicyReject;

const ALLOWED_SET = new Set<string>(FIRST_SLICE_DECLARED_MIME_ALLOWLIST);
const BRAND_SET = new Set<string>(ISO_BMFF_ACCEPTED_BRANDS);

/** Well-formed MIME token: type/subtype with restricted token charset (RFC 6838-ish). */
const WELL_FORMED_MIME_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

export function normalizeDeclaredMimeType(value: unknown): NormalizedDeclaredMime {
  if (typeof value !== "string") {
    return { kind: "not_allowed", raw: "" };
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return { kind: "not_allowed", raw: "" };
  }
  if (!WELL_FORMED_MIME_RE.test(normalized)) {
    return { kind: "not_allowed", raw: normalized };
  }
  if (ALLOWED_SET.has(normalized)) {
    return { kind: "allowed", value: normalized as FirstSliceDeclaredMime };
  }
  return { kind: "unsupported", value: normalized };
}

/**
 * Detect only the repository-supported ISO-BMFF `ftyp` signature.
 * Does not claim WebM or other container families.
 */
export function detectContainerSignature(prefix: Uint8Array): DetectedContainer {
  if (prefix.byteLength < 12) {
    return { kind: "inconclusive" };
  }
  const box = String.fromCharCode(prefix[4]!, prefix[5]!, prefix[6]!, prefix[7]!);
  if (box !== "ftyp") {
    return { kind: "inconclusive" };
  }
  const brand = String.fromCharCode(prefix[8]!, prefix[9]!, prefix[10]!, prefix[11]!);
  if (BRAND_SET.has(brand)) {
    return {
      kind: "iso_bmff",
      brand: brand as IsoBmffBrand,
      observedMimeType: "video/mp4",
    };
  }
  return { kind: "inconclusive" };
}

/**
 * Frozen reason-code precedence for the MIME gate:
 *   1. missing / empty / syntactically invalid declared → MIME_NOT_ALLOWED
 *   2. well-formed unsupported (incl. video/webm) → UNSUPPORTED_MEDIA_FORMAT
 *   3. allowed + inconclusive detection → UNSUPPORTED_MEDIA_FORMAT
 *   4. allowed + conflicting recognized foreign family → MIME_SIGNATURE_MISMATCH
 *   5. allowed MP4/QuickTime + recognized ISO-BMFF → pass
 *
 * R2 content-type never overrides detection and never alone yields pass.
 */
export function evaluateMimePolicy(
  declaredMimeType: unknown,
  detected: DetectedContainer,
  options?: { readonly r2ContentType?: string | null },
): MimePolicyResult {
  const r2ContentType =
    typeof options?.r2ContentType === "string" && options.r2ContentType.trim()
      ? options.r2ContentType.trim().toLowerCase()
      : null;

  const declared = normalizeDeclaredMimeType(declaredMimeType);

  if (declared.kind === "not_allowed") {
    return {
      outcome: "reject",
      terminalReasonCode: "MIME_NOT_ALLOWED",
      declaredMimeType: declared.raw || null,
      observedMimeType: null,
      r2ContentType,
    };
  }

  if (declared.kind === "unsupported") {
    return {
      outcome: "reject",
      terminalReasonCode: "UNSUPPORTED_MEDIA_FORMAT",
      declaredMimeType: declared.value,
      observedMimeType: null,
      r2ContentType,
    };
  }

  if (detected.kind === "recognized_foreign_family") {
    return {
      outcome: "reject",
      terminalReasonCode: "MIME_SIGNATURE_MISMATCH",
      declaredMimeType: declared.value,
      observedMimeType: null,
      r2ContentType,
    };
  }

  if (detected.kind === "inconclusive") {
    return {
      outcome: "reject",
      terminalReasonCode: "UNSUPPORTED_MEDIA_FORMAT",
      declaredMimeType: declared.value,
      observedMimeType: null,
      r2ContentType,
    };
  }

  const disagrees = r2ContentType !== null && r2ContentType !== detected.observedMimeType;

  return {
    outcome: "pass",
    declaredMimeType: declared.value,
    observedMimeType: detected.observedMimeType,
    detectedBrand: detected.brand,
    r2ContentType,
    r2ContentTypeDisagreesWithDetection: disagrees,
  };
}

export function mimeRejectReasonCode(
  result: MimePolicyReject,
): Extract<
  VerificationReasonCode,
  "MIME_NOT_ALLOWED" | "UNSUPPORTED_MEDIA_FORMAT" | "MIME_SIGNATURE_MISMATCH"
> {
  return result.terminalReasonCode;
}
