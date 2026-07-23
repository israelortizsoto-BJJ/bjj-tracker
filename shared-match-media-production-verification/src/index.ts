/**
 * Production Verification domain barrel.
 *
 * Package modules remain free of R2/env bindings. Runtime composition lives in
 * coach-sync-worker behind its verification feature flag (default off).
 * Proof isolation (PROOF_MEDIA) must never enter the production admission path.
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

export {
  PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
  PROOF_MEDIA_STORAGE_BUCKET_BINDING,
  assertProductionMediaStorageBucketBinding,
  isProductionMediaStorageBucketBinding,
  rejectProofMediaStorageBucketBinding,
  type ProductionMediaStorageBucketBinding,
} from "./storageBucketBinding.ts";

export {
  FIRST_SLICE_DECLARED_MIME_ALLOWLIST,
  ISO_BMFF_ACCEPTED_BRANDS,
  MIME_PREFIX_LIMIT,
  detectContainerSignature,
  evaluateMimePolicy,
  mimeRejectReasonCode,
  normalizeDeclaredMimeType,
  type DetectedContainer,
  type FirstSliceDeclaredMime,
  type MimePolicyResult,
  type NormalizedDeclaredMime,
} from "./mimePolicy.ts";

export {
  evaluateObjectIntegrity,
  type ObjectIntegrityInput,
  type ObjectIntegrityResult,
} from "./objectIntegrityPolicy.ts";

export {
  deriveVerifiedMediaPublicationEligibility,
  type ExpectedAdmissionIdentity,
  type PublicationEligibilityAbsent,
  type PublicationEligibilityIdentityMismatch,
  type PublicationEligibilityPresent,
  type VerifiedMediaPublicationEligibility,
} from "./publicationEligibility.ts";
