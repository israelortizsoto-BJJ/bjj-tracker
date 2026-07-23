/**
 * Derived, fail-closed Coach-publication eligibility view.
 *
 * ProductionVerificationRecord remains the sole durable authority. This module
 * never persists a second eligibility record. Stuck verifying stays durable
 * `verifying` and surfaces operator_required only on the observational view.
 */

import {
  deriveAdmissionIdentity,
  type ImmutableAdmissionFields,
} from "./admissionIdentity.ts";
import type { RetryClassification, VerificationReasonCode } from "./reasonCodes.ts";
import {
  classifyStuckVerifying,
  DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS,
} from "./stuckAttempt.ts";
import type {
  ProductionVerificationRecord,
  VerificationLifecycleState,
} from "./verificationTypes.ts";

export type ExpectedAdmissionIdentity = ImmutableAdmissionFields;

export type PublicationEligibilityAbsent = {
  readonly schemaVersion: 1;
  readonly presence: "absent";
  readonly publicationEligible: false;
  readonly durableVerificationState: null;
  readonly expectedAdmission: ExpectedAdmissionIdentity;
  readonly admissionKey: string;
  readonly admissionKeyHash: string;
  readonly observationalStuck: false;
  readonly observationalReasonCode: null;
  readonly observationalRetryClassification: null;
};

export type PublicationEligibilityIdentityMismatch = {
  readonly schemaVersion: 1;
  readonly presence: "identity_mismatch";
  readonly publicationEligible: false;
  readonly durableVerificationState: VerificationLifecycleState;
  readonly expectedAdmission: ExpectedAdmissionIdentity;
  readonly recordAdmission: ImmutableAdmissionFields;
  readonly expectedAdmissionKey: string;
  readonly expectedAdmissionKeyHash: string;
  readonly recordAdmissionKey: string;
  readonly recordAdmissionKeyHash: string;
  readonly observationalStuck: false;
  readonly observationalReasonCode: null;
  readonly observationalRetryClassification: null;
};

export type PublicationEligibilityPresent = {
  readonly schemaVersion: 1;
  readonly presence: "present";
  readonly publicationEligible: boolean;
  readonly durableVerificationState: VerificationLifecycleState;
  readonly expectedAdmission: ExpectedAdmissionIdentity;
  readonly admissionKey: string;
  readonly admissionKeyHash: string;
  readonly matchMediaAssetId: string;
  readonly objectVersion: string;
  readonly storageBucketBinding: string;
  readonly storageObjectKey: string;
  readonly sharedAthleteId: string;
  readonly sharedCompetitionId: string;
  readonly matchLineageKey: string;
  readonly matchId: string | null;
  readonly terminalReasonCode: VerificationReasonCode | null;
  readonly retryClassification: RetryClassification | null;
  readonly calculatedSha256: string | null;
  readonly observationalStuck: boolean;
  readonly observationalReasonCode: "STUCK_ATTEMPT_REQUIRES_RECONCILIATION" | null;
  readonly observationalRetryClassification: "operator_required" | null;
};

export type VerifiedMediaPublicationEligibility =
  | PublicationEligibilityAbsent
  | PublicationEligibilityIdentityMismatch
  | PublicationEligibilityPresent;

function recordAdmissionFields(
  record: ProductionVerificationRecord,
): ImmutableAdmissionFields {
  return {
    contractVersion: record.contractVersion,
    storageBucketBinding: record.storageBucketBinding,
    matchMediaAssetId: record.matchMediaAssetId,
    objectVersion: record.objectVersion,
    storageObjectKey: record.storageObjectKey,
  };
}

function hasCompleteRequiredProvenance(record: ProductionVerificationRecord): boolean {
  return (
    typeof record.athleteId === "string" &&
    record.athleteId.trim().length > 0 &&
    typeof record.competitionId === "string" &&
    record.competitionId.trim().length > 0 &&
    typeof record.matchLineageKey === "string" &&
    record.matchLineageKey.trim().length > 0
  );
}

/**
 * Derive publication eligibility from expected admission identity + optional record.
 *
 * Async solely because admission-key hashing uses SubtleCrypto (same as
 * deriveAdmissionIdentity). No durable writes.
 */
export async function deriveVerifiedMediaPublicationEligibility(
  expectedAdmission: ExpectedAdmissionIdentity,
  record: ProductionVerificationRecord | null,
  options?: {
    readonly now?: Date;
    readonly stuckThresholdMs?: number;
  },
): Promise<VerifiedMediaPublicationEligibility> {
  const expected = await deriveAdmissionIdentity(expectedAdmission);

  if (record === null) {
    return {
      schemaVersion: 1,
      presence: "absent",
      publicationEligible: false,
      durableVerificationState: null,
      expectedAdmission: expected.fields,
      admissionKey: expected.admissionKey,
      admissionKeyHash: expected.admissionKeyHash,
      observationalStuck: false,
      observationalReasonCode: null,
      observationalRetryClassification: null,
    };
  }

  const recordFields = recordAdmissionFields(record);
  const identitiesMatch =
    record.admissionKey === expected.admissionKey &&
    record.admissionKeyHash === expected.admissionKeyHash &&
    record.contractVersion === expected.fields.contractVersion &&
    record.storageBucketBinding === expected.fields.storageBucketBinding &&
    record.matchMediaAssetId === expected.fields.matchMediaAssetId &&
    record.objectVersion === expected.fields.objectVersion &&
    record.storageObjectKey === expected.fields.storageObjectKey;

  if (!identitiesMatch) {
    return {
      schemaVersion: 1,
      presence: "identity_mismatch",
      publicationEligible: false,
      durableVerificationState: record.state,
      expectedAdmission: expected.fields,
      recordAdmission: recordFields,
      expectedAdmissionKey: expected.admissionKey,
      expectedAdmissionKeyHash: expected.admissionKeyHash,
      recordAdmissionKey: record.admissionKey,
      recordAdmissionKeyHash: record.admissionKeyHash,
      observationalStuck: false,
      observationalReasonCode: null,
      observationalRetryClassification: null,
    };
  }

  const now = options?.now ?? new Date();
  const stuckThresholdMs =
    options?.stuckThresholdMs ?? DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS;
  const stuck = classifyStuckVerifying(record, now, stuckThresholdMs);

  const publicationEligible =
    record.state === "verified" && hasCompleteRequiredProvenance(record);

  return {
    schemaVersion: 1,
    presence: "present",
    publicationEligible,
    durableVerificationState: record.state,
    expectedAdmission: expected.fields,
    admissionKey: record.admissionKey,
    admissionKeyHash: record.admissionKeyHash,
    matchMediaAssetId: record.matchMediaAssetId,
    objectVersion: record.objectVersion,
    storageBucketBinding: record.storageBucketBinding,
    storageObjectKey: record.storageObjectKey,
    sharedAthleteId: record.athleteId?.trim() ?? "",
    sharedCompetitionId: record.competitionId?.trim() ?? "",
    matchLineageKey: record.matchLineageKey?.trim() ?? "",
    matchId: record.matchId?.trim() ? record.matchId.trim() : null,
    terminalReasonCode: record.terminalReasonCode,
    retryClassification: record.retryClassification,
    calculatedSha256: record.calculatedSha256 ?? null,
    observationalStuck: stuck.isStuck,
    observationalReasonCode: stuck.isStuck
      ? "STUCK_ATTEMPT_REQUIRES_RECONCILIATION"
      : null,
    observationalRetryClassification: stuck.isStuck ? "operator_required" : null,
  };
}
