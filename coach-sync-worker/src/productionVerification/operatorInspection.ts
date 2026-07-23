/**
 * Read-only operator inspection for Production Verification records.
 *
 * Protected by SHARED_MATCH_MEDIA_VERIFICATION_OPERATOR_SECRET (Cloudflare secret
 * binding only — never committed). Performs zero writes and cannot retry,
 * reconcile, publish, or invoke verification.
 *
 * HTTP contract: authenticated POST with the five-field inspection identity in
 * the JSON body only. The request URL and query string must never carry any
 * portion of that identity.
 */

import {
  deriveAdmissionIdentity,
  deriveVerifiedMediaPublicationEligibility,
  getVerificationRecordByHash,
  type ImmutableAdmissionFields,
  type ProductionVerificationRecord,
  type VerificationRecordStore,
  type VerifiedMediaPublicationEligibility,
} from "../../../shared-match-media-production-verification/src/index.ts";
import { emitProductionVerificationMarker } from "./observability.ts";

/** Bounded JSON body for the five-field admission identity only. */
export const OPERATOR_INSPECTION_MAX_BODY_BYTES = 8_192;

export const OPERATOR_INSPECTION_IDENTITY_FIELDS = [
  "contractVersion",
  "storageBucketBinding",
  "matchMediaAssetId",
  "objectVersion",
  "storageObjectKey",
] as const;

export type OperatorInspectionAuthResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly resultClass: "unauthorized" | "secret_unconfigured";
    };

export type OperatorInspectionSuccess = {
  readonly resultClass: "ok";
  readonly recordPresent: boolean;
  readonly identityMatch: boolean | null;
  readonly state: ProductionVerificationRecord["state"] | null;
  readonly activeAttemptId: string | null;
  readonly orderedEvidence: ReadonlyArray<{
    readonly attemptId: string;
    readonly attemptNumber: number;
    readonly state: string;
    readonly eventKinds: ReadonlyArray<string>;
  }>;
  readonly terminalReasonCode: string | null;
  readonly retryClassification: string | null;
  readonly observedByteCount: number | null;
  readonly observedMimeType: string | null;
  readonly calculatedSha256: string | null;
  readonly verifierRuntimeVersion: string | null;
  readonly publicationEligible: boolean;
  readonly observationalStuck: boolean;
  readonly observationalReasonCode: string | null;
  readonly observationalRetryClassification: string | null;
  readonly durableVerificationState: string | null;
  readonly presence: VerifiedMediaPublicationEligibility["presence"] | null;
};

export type OperatorInspectionFailure = {
  readonly resultClass:
    | "unauthorized"
    | "secret_unconfigured"
    | "invalid_identity"
    | "invalid_body"
    | "method_not_allowed"
    | "read_error";
  readonly message: string;
};

export type OperatorInspectionResult =
  | OperatorInspectionSuccess
  | OperatorInspectionFailure;

function encodeUtf8(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value) as Uint8Array<ArrayBuffer>;
}

function constantTimeEqualBytes(
  left: Uint8Array<ArrayBuffer>,
  right: Uint8Array<ArrayBuffer>,
): boolean {
  if (left.byteLength !== right.byteLength) return false;
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: BufferSource, b: BufferSource) => boolean;
  };
  if (typeof subtle.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(left, right);
  }
  const cryptoWithTiming = crypto as Crypto & {
    timingSafeEqual?: (a: BufferSource, b: BufferSource) => boolean;
  };
  if (typeof cryptoWithTiming.timingSafeEqual === "function") {
    return cryptoWithTiming.timingSafeEqual(left, right);
  }
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

/**
 * Timing-safe UTF-8 equality via unconditional SHA-256 digests.
 * Both inputs are always hashed; only the fixed-length digests are compared
 * with crypto.subtle.timingSafeEqual. Original strings and their lengths are
 * never compared directly.
 */
export async function timingSafeEqualUtf8(
  left: string,
  right: string,
): Promise<boolean> {
  const leftBytes = encodeUtf8(left);
  const rightBytes = encodeUtf8(right);
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", leftBytes),
    crypto.subtle.digest("SHA-256", rightBytes),
  ]);
  return constantTimeEqualBytes(
    new Uint8Array(leftDigest) as Uint8Array<ArrayBuffer>,
    new Uint8Array(rightDigest) as Uint8Array<ArrayBuffer>,
  );
}

export function extractBearerToken(authorizationHeader: string | null): string {
  const auth = authorizationHeader?.trim() ?? "";
  return /^Bearer\s+(.+)$/.exec(auth)?.[1]?.trim() ?? "";
}

/**
 * Fail-closed operator auth. Wrong, absent, or malformed credentials never
 * reveal whether a verification record exists.
 */
export async function authorizeOperatorInspection(args: {
  readonly authorizationHeader: string | null;
  readonly operatorSecret: string | undefined;
}): Promise<OperatorInspectionAuthResult> {
  const configured = args.operatorSecret;
  if (typeof configured !== "string" || configured.length === 0) {
    return { ok: false, resultClass: "secret_unconfigured" };
  }
  const presented = extractBearerToken(args.authorizationHeader);
  if (!presented) {
    return { ok: false, resultClass: "unauthorized" };
  }
  const matches = await timingSafeEqualUtf8(presented, configured);
  if (!matches) {
    return { ok: false, resultClass: "unauthorized" };
  }
  return { ok: true };
}

function invalidBodyResponse(message = "Invalid request body"): {
  status: number;
  body: Record<string, unknown>;
} {
  return {
    status: 400,
    body: { error: message, resultClass: "invalid_body" },
  };
}

/**
 * Parse and type-check the five-field inspection identity from a JSON value.
 * Does not perform admission-key derivation; callers pass the result through
 * the existing identity validation path.
 */
export function parseOperatorInspectionIdentityBody(
  value: unknown,
):
  | { readonly ok: true; readonly expectedAdmission: ImmutableAdmissionFields }
  | { readonly ok: false; readonly message: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Request body must be a JSON object" };
  }
  const record = value as Record<string, unknown>;
  const expectedAdmission = {} as {
    -readonly [K in keyof ImmutableAdmissionFields]: string;
  };
  for (const field of OPERATOR_INSPECTION_IDENTITY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      return { ok: false, message: `Missing identity field: ${field}` };
    }
    const fieldValue = record[field];
    if (typeof fieldValue !== "string") {
      return { ok: false, message: `Identity field ${field} must be a string` };
    }
    expectedAdmission[field] = fieldValue;
  }
  return { ok: true, expectedAdmission };
}

function sanitizeEvidence(record: ProductionVerificationRecord) {
  return record.attemptEvidence.map((attempt) => ({
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    state: attempt.state,
    eventKinds: attempt.events.map((event) => event.kind),
  }));
}

export async function inspectProductionVerificationRecordReadOnly(args: {
  readonly expectedAdmission: ImmutableAdmissionFields;
  readonly store: VerificationRecordStore;
  readonly now?: () => Date;
}): Promise<
  | OperatorInspectionSuccess
  | {
      readonly resultClass: "invalid_identity" | "read_error";
      readonly message: string;
    }
> {
  let identity;
  try {
    identity = await deriveAdmissionIdentity(args.expectedAdmission);
  } catch (error) {
    return {
      resultClass: "invalid_identity",
      message: error instanceof Error ? error.message : "invalid admission identity",
    };
  }

  let record: ProductionVerificationRecord | null;
  try {
    record = await getVerificationRecordByHash(identity.admissionKeyHash, args.store);
  } catch (error) {
    return {
      resultClass: "read_error",
      message: error instanceof Error ? error.message : "record read failed",
    };
  }

  const eligibility = await deriveVerifiedMediaPublicationEligibility(
    identity.fields,
    record,
    { now: args.now?.() ?? new Date() },
  );

  if (!record) {
    return {
      resultClass: "ok",
      recordPresent: false,
      identityMatch: null,
      state: null,
      activeAttemptId: null,
      orderedEvidence: [],
      terminalReasonCode: null,
      retryClassification: null,
      observedByteCount: null,
      observedMimeType: null,
      calculatedSha256: null,
      verifierRuntimeVersion: null,
      publicationEligible: false,
      observationalStuck: false,
      observationalReasonCode: null,
      observationalRetryClassification: null,
      durableVerificationState: null,
      presence: eligibility.presence,
    };
  }

  const identityMatch = eligibility.presence === "present";

  return {
    resultClass: "ok",
    recordPresent: true,
    identityMatch,
    state: record.state,
    activeAttemptId: record.activeAttemptId,
    orderedEvidence: sanitizeEvidence(record),
    terminalReasonCode: record.terminalReasonCode,
    retryClassification: record.retryClassification,
    observedByteCount: record.observedByteCount ?? null,
    observedMimeType: record.observedMimeType ?? null,
    calculatedSha256: record.calculatedSha256 ?? null,
    verifierRuntimeVersion: record.verifierRuntimeVersion ?? null,
    publicationEligible: eligibility.publicationEligible,
    observationalStuck: eligibility.observationalStuck,
    observationalReasonCode: eligibility.observationalReasonCode,
    observationalRetryClassification: eligibility.observationalRetryClassification,
    durableVerificationState: eligibility.durableVerificationState,
    presence: eligibility.presence,
  };
}

/**
 * HTTP-facing operator inspection after auth + body parse: fail closed, then
 * read-only sanitized projection. Never executes verification.
 */
export async function handleOperatorProductionVerificationInspection(args: {
  readonly authorizationHeader: string | null;
  readonly operatorSecret: string | undefined;
  readonly expectedAdmission: ImmutableAdmissionFields;
  readonly store: VerificationRecordStore;
  readonly now?: () => Date;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const auth = await authorizeOperatorInspection({
    authorizationHeader: args.authorizationHeader,
    operatorSecret: args.operatorSecret,
  });
  if (!auth.ok) {
    emitProductionVerificationMarker("production_verification_operator_inspection", {
      resultClass: auth.resultClass,
    });
    // Wrong/absent/malformed auth must not reveal record existence.
    return {
      status: 401,
      body: { error: "Unauthorized" },
    };
  }

  const result = await inspectProductionVerificationRecordReadOnly({
    expectedAdmission: args.expectedAdmission,
    store: args.store,
    now: args.now,
  });

  emitProductionVerificationMarker("production_verification_operator_inspection", {
    resultClass: result.resultClass,
    recordPresent: result.resultClass === "ok" ? result.recordPresent : false,
  });

  if (result.resultClass !== "ok") {
    const status = result.resultClass === "invalid_identity" ? 400 : 500;
    return { status, body: { error: result.message, resultClass: result.resultClass } };
  }

  const success: OperatorInspectionSuccess = result;
  return {
    status: 200,
    body: {
      resultClass: success.resultClass,
      recordPresent: success.recordPresent,
      identityMatch: success.identityMatch,
      state: success.state,
      activeAttemptId: success.activeAttemptId,
      orderedEvidence: success.orderedEvidence,
      terminalReasonCode: success.terminalReasonCode,
      retryClassification: success.retryClassification,
      observedByteCount: success.observedByteCount,
      observedMimeType: success.observedMimeType,
      calculatedSha256: success.calculatedSha256,
      verifierRuntimeVersion: success.verifierRuntimeVersion,
      publicationEligible: success.publicationEligible,
      observationalStuck: success.observationalStuck,
      observationalReasonCode: success.observationalReasonCode,
      observationalRetryClassification: success.observationalRetryClassification,
      durableVerificationState: success.durableVerificationState,
      presence: success.presence,
    },
  };
}

/**
 * Full HTTP contract for operator inspection:
 * method gate → auth → bounded JSON body → read-only projection.
 * Does not log the request body, full identity, or complete storage key.
 */
export async function handleOperatorInspectionHttpRequest(args: {
  readonly method: string;
  readonly authorizationHeader: string | null;
  readonly operatorSecret: string | undefined;
  readonly contentLengthHeader: string | null;
  readonly readBodyText: () => Promise<string>;
  readonly store: VerificationRecordStore;
  readonly now?: () => Date;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (args.method !== "POST") {
    emitProductionVerificationMarker("production_verification_operator_inspection", {
      resultClass: "method_not_allowed",
    });
    return {
      status: 405,
      body: { error: "Method Not Allowed", resultClass: "method_not_allowed" },
    };
  }

  const auth = await authorizeOperatorInspection({
    authorizationHeader: args.authorizationHeader,
    operatorSecret: args.operatorSecret,
  });
  if (!auth.ok) {
    emitProductionVerificationMarker("production_verification_operator_inspection", {
      resultClass: auth.resultClass,
    });
    return {
      status: 401,
      body: { error: "Unauthorized" },
    };
  }

  const contentLengthHeader = args.contentLengthHeader?.trim() ?? "";
  if (contentLengthHeader.length > 0) {
    const declared = Number(contentLengthHeader);
    if (
      !Number.isFinite(declared) ||
      !Number.isInteger(declared) ||
      declared < 0 ||
      declared > OPERATOR_INSPECTION_MAX_BODY_BYTES
    ) {
      emitProductionVerificationMarker("production_verification_operator_inspection", {
        resultClass: "invalid_body",
      });
      return invalidBodyResponse("Request body too large or invalid Content-Length");
    }
  }

  let bodyText: string;
  try {
    bodyText = await args.readBodyText();
  } catch {
    emitProductionVerificationMarker("production_verification_operator_inspection", {
      resultClass: "invalid_body",
    });
    return invalidBodyResponse();
  }

  const bodyBytes = encodeUtf8(bodyText);
  if (bodyBytes.byteLength > OPERATOR_INSPECTION_MAX_BODY_BYTES) {
    emitProductionVerificationMarker("production_verification_operator_inspection", {
      resultClass: "invalid_body",
    });
    return invalidBodyResponse("Request body too large");
  }

  if (bodyBytes.byteLength === 0) {
    emitProductionVerificationMarker("production_verification_operator_inspection", {
      resultClass: "invalid_body",
    });
    return invalidBodyResponse("Missing request body");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText) as unknown;
  } catch {
    emitProductionVerificationMarker("production_verification_operator_inspection", {
      resultClass: "invalid_body",
    });
    return invalidBodyResponse("Malformed JSON body");
  }

  const identity = parseOperatorInspectionIdentityBody(parsed);
  if (!identity.ok) {
    emitProductionVerificationMarker("production_verification_operator_inspection", {
      resultClass: "invalid_body",
    });
    return invalidBodyResponse(identity.message);
  }

  // Auth already succeeded; reuse the shared projection path (re-auth is idempotent).
  return handleOperatorProductionVerificationInspection({
    authorizationHeader: args.authorizationHeader,
    operatorSecret: args.operatorSecret,
    expectedAdmission: identity.expectedAdmission,
    store: args.store,
    now: args.now,
  });
}
