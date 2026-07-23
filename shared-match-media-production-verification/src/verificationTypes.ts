import type { ImmutableAdmissionFields } from "./admissionIdentity.ts";
import type {
  RetryClassification,
  VerificationReasonCode,
} from "./reasonCodes.ts";
import type { ScanHookStatus } from "./privacyScanHook.ts";

/**
 * Production Verification durable lifecycle states after upload_complete.
 * upload_complete itself remains Upload-owned and is not stored here as authority.
 */
export const VERIFICATION_LIFECYCLE_STATES = [
  "verifying",
  "verified",
  "rejected",
  "failed",
] as const;

export type VerificationLifecycleState =
  (typeof VERIFICATION_LIFECYCLE_STATES)[number];

export const TERMINAL_VERIFICATION_STATES = [
  "verified",
  "rejected",
  "failed",
] as const;

export type TerminalVerificationState =
  (typeof TERMINAL_VERIFICATION_STATES)[number];

export const ACTIVE_VERIFICATION_STATE = "verifying" as const;

export function isTerminalVerificationState(
  state: VerificationLifecycleState,
): state is TerminalVerificationState {
  return state !== "verifying";
}

export type AttemptEvidenceEvent = {
  readonly eventId: string;
  readonly at: string;
  readonly kind: string;
  readonly detail?: Readonly<Record<string, string | number | boolean | null>>;
};

export type VerificationAttemptEvidence = {
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly state: VerificationLifecycleState;
  readonly verifyingStartedAt: string;
  readonly terminalAt?: string;
  readonly terminalReasonCode?: VerificationReasonCode;
  readonly retryClassification?: RetryClassification;
  readonly events: ReadonlyArray<AttemptEvidenceEvent>;
};

/**
 * Durable verification record — single authority for Production Verification
 * admission state within this skeleton (contract §4).
 */
export type ProductionVerificationRecord = {
  readonly schemaVersion: 1;
  readonly verificationRecordId: string;
  readonly contractVersion: string;
  readonly matchMediaAssetId: string;
  readonly objectVersion: string;
  readonly storageBucketBinding: string;
  readonly storageObjectKey: string;
  readonly admissionKey: string;
  readonly admissionKeyHash: string;
  readonly state: VerificationLifecycleState;
  readonly attemptNumber: number;
  readonly activeAttemptId: string | null;
  readonly admittedAt: string;
  readonly verifyingStartedAt: string | null;
  readonly terminalAt: string | null;
  readonly terminalReasonCode: VerificationReasonCode | null;
  readonly retryClassification: RetryClassification | null;
  readonly nextRetryEligibleAt: string | null;
  readonly declaredByteCount?: number;
  readonly declaredMimeType?: string;
  readonly expectedWholeObjectSha256?: string;
  readonly uploadSessionId?: string;
  readonly athleteId?: string;
  readonly competitionId?: string;
  readonly matchId?: string;
  readonly matchLineageKey?: string;
  readonly observedByteCount?: number;
  readonly observedMimeType?: string;
  readonly calculatedSha256?: string;
  readonly scanHookStatus?: ScanHookStatus;
  readonly verifierRuntimeVersion?: string;
  readonly evidenceReferences: ReadonlyArray<string>;
  readonly attemptEvidence: ReadonlyArray<VerificationAttemptEvidence>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AdmissionProvenance = {
  readonly declaredByteCount?: number;
  readonly declaredMimeType?: string;
  readonly expectedWholeObjectSha256?: string;
  readonly uploadSessionId?: string;
  readonly athleteId?: string;
  readonly competitionId?: string;
  readonly matchId?: string;
  readonly matchLineageKey?: string;
};

export type AdmitVerificationInput = ImmutableAdmissionFields &
  AdmissionProvenance & {
    readonly verificationRecordId?: string;
    readonly attemptId?: string;
  };

export type VerificationDomainErrorCode =
  | "RECORD_NOT_FOUND"
  | "CAS_CONFLICT"
  | "ILLEGAL_TRANSITION"
  | "TERMINAL_IMMUTABLE"
  | "ACTIVE_ATTEMPT_EXISTS"
  | "APPEND_ONLY_VIOLATION"
  | "UNSUPPORTED_REASON_CODE"
  | "UNSUPPORTED_RETRY_CLASSIFICATION"
  | "INVALID_ADMISSION_INPUT";

export class VerificationDomainError extends Error {
  readonly code: VerificationDomainErrorCode;

  constructor(code: VerificationDomainErrorCode, message: string) {
    super(message);
    this.name = "VerificationDomainError";
    this.code = code;
  }
}

export function cloneRecord(
  record: ProductionVerificationRecord,
): ProductionVerificationRecord {
  return structuredClone(record);
}
