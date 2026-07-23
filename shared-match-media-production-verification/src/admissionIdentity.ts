/**
 * Canonical admission identity for Production Verification Contract v1.
 *
 * Certified tuple (exact field order):
 *   (contractVersion, storageBucketBinding, matchMediaAssetId, objectVersion, storageObjectKey)
 *
 * Serialization (contract §6 — exact certified language):
 *   "1. UTF-8 encode each component trimmed, with no surrounding whitespace variance.
 *    2. Join with the literal separator '\\u001f' (unit separator) in the order above.
 *    3. Store both the canonical serialized string and its SHA-256 hex digest as
 *       admissionKey / admissionKeyHash.
 *    4. Equality is on the canonical serialized string; hash is an index aid only."
 *
 * trim() is therefore contract-mandated normalization, not an unapproved invention.
 * Mutable lifecycle fields must never participate.
 */

export const ADMISSION_FIELD_SEPARATOR = "\u001f";

export const PRODUCTION_VERIFICATION_CONTRACT_VERSION = "shared-match-media-production-verification-design-v1";

export type ImmutableAdmissionFields = {
  readonly contractVersion: string;
  readonly storageBucketBinding: string;
  readonly matchMediaAssetId: string;
  readonly objectVersion: string;
  readonly storageObjectKey: string;
};

export type AdmissionIdentity = {
  readonly admissionKey: string;
  readonly admissionKeyHash: string;
  readonly fields: ImmutableAdmissionFields;
};

const ADMISSION_FIELD_ORDER = [
  "contractVersion",
  "storageBucketBinding",
  "matchMediaAssetId",
  "objectVersion",
  "storageObjectKey",
] as const;

function requireNonEmptyTrimmed(name: string, value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`Admission field ${name} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Admission field ${name} must be non-empty after trim.`);
  }
  // Reject unit separator inside a field so the five-field join stays unambiguous
  // across field boundaries (contract §6 + mission canonical-serialization floor).
  if (trimmed.includes(ADMISSION_FIELD_SEPARATOR)) {
    throw new Error(
      `Admission field ${name} must not contain the unit separator U+001F.`,
    );
  }
  return trimmed;
}

/**
 * Named canonical serialization: deterministic, order-explicit, UTF-8, no locale.
 * Independent of ordinary object property insertion order.
 */
export function serializeCanonicalAdmissionKey(
  fields: ImmutableAdmissionFields,
): string {
  const normalized: ImmutableAdmissionFields = {
    contractVersion: requireNonEmptyTrimmed("contractVersion", fields.contractVersion),
    storageBucketBinding: requireNonEmptyTrimmed(
      "storageBucketBinding",
      fields.storageBucketBinding,
    ),
    matchMediaAssetId: requireNonEmptyTrimmed("matchMediaAssetId", fields.matchMediaAssetId),
    objectVersion: requireNonEmptyTrimmed("objectVersion", fields.objectVersion),
    storageObjectKey: requireNonEmptyTrimmed("storageObjectKey", fields.storageObjectKey),
  };

  return ADMISSION_FIELD_ORDER.map((name) => normalized[name]).join(
    ADMISSION_FIELD_SEPARATOR,
  );
}

export async function sha256HexUtf8(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function deriveAdmissionIdentity(
  fields: ImmutableAdmissionFields,
): Promise<AdmissionIdentity> {
  const admissionKey = serializeCanonicalAdmissionKey(fields);
  const admissionKeyHash = await sha256HexUtf8(admissionKey);
  const [contractVersion, storageBucketBinding, matchMediaAssetId, objectVersion, storageObjectKey] =
    admissionKey.split(ADMISSION_FIELD_SEPARATOR);
  return {
    admissionKey,
    admissionKeyHash,
    fields: {
      contractVersion,
      storageBucketBinding,
      matchMediaAssetId,
      objectVersion,
      storageObjectKey,
    },
  };
}

export function parseAdmissionKey(admissionKey: string): ImmutableAdmissionFields {
  const parts = admissionKey.split(ADMISSION_FIELD_SEPARATOR);
  if (parts.length !== 5) {
    throw new Error("admissionKey must contain exactly five unit-separated fields.");
  }
  const [contractVersion, storageBucketBinding, matchMediaAssetId, objectVersion, storageObjectKey] =
    parts;
  return {
    contractVersion,
    storageBucketBinding,
    matchMediaAssetId,
    objectVersion,
    storageObjectKey,
  };
}
