/**
 * Dormant domain barrel for the Production Verification skeleton.
 *
 * Importing this module from application runtime composition roots is forbidden
 * until a separately authorized wiring mission exists. Tests may import freely.
 */

export {
  ADMISSION_FIELD_SEPARATOR,
  PRODUCTION_VERIFICATION_CONTRACT_VERSION,
  deriveAdmissionIdentity,
  parseAdmissionKey,
  serializeCanonicalAdmissionKey,
  sha256HexUtf8,
  type AdmissionIdentity,
  type ImmutableAdmissionFields,
} from "./admissionIdentity.ts";

export {
  ALL_REASON_CODES,
  RETRY_CLASSIFICATIONS,
  defaultRetryClassificationForReason,
  isRetryClassification,
  isVerificationReasonCode,
  parseRetryClassification,
  parseVerificationReasonCode,
  type RetryClassification,
  type VerificationReasonCode,
} from "./reasonCodes.ts";

export {
  createUnimplementedPrivacyScanHook,
  SCAN_HOOK_STATUSES,
  type PrivacyScanHook,
  type ScanHookStatus,
} from "./privacyScanHook.ts";

export {
  DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS,
  classifyStuckVerifying,
  type StuckVerifyingClassification,
} from "./stuckAttempt.ts";

export {
  ACTIVE_VERIFICATION_STATE,
  TERMINAL_VERIFICATION_STATES,
  VERIFICATION_LIFECYCLE_STATES,
  VerificationDomainError,
  isTerminalVerificationState,
  type AdmitVerificationInput,
  type ProductionVerificationRecord,
  type VerificationLifecycleState,
} from "./verificationTypes.ts";

export {
  recordStoreKey,
  type VerificationRecordStore,
} from "./verificationRecordStore.ts";

export type {
  ConditionalObjectStore,
  ConditionalPutOnlyIf,
} from "./conditionalObjectStore.ts";

export { createConditionalObjectVerificationRecordStore } from "./conditionalObjectVerificationRecordStore.ts";

export { createSyntheticConditionalObjectStore } from "./syntheticConditionalObjectStore.ts";

export {
  MAX_ADMISSION_CAS_ATTEMPTS,
  admitVerification,
  appendAttemptEvidence,
  getVerificationRecord,
  getVerificationRecordByHash,
  transitionVerificationTerminal,
  type AdmitVerificationResult,
  type VerificationAdmissionDependencies,
} from "./admitVerification.ts";
