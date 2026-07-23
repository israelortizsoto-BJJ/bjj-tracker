/**
 * Flag-gated Production Verification orchestration for coach-sync-worker.
 *
 * admit → complete-object inspect → append evidence → terminal CAS.
 * Enabled only when SHARED_MATCH_MEDIA_VERIFICATION_ENABLED === "1".
 */

import {
  PRODUCTION_VERIFICATION_CONTRACT_VERSION,
  admitVerification,
  appendAttemptEvidence,
  createConditionalObjectVerificationRecordStore,
  evaluateObjectIntegrity,
  getVerificationRecordByHash,
  isTerminalVerificationState,
  transitionVerificationTerminal,
  type ProductionVerificationRecord,
  type VerificationAdmissionDependencies,
  type VerificationReasonCode,
  VerificationDomainError,
} from "../../../shared-match-media-production-verification/src/index.ts";
import {
  PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
  assertProductionMediaStorageBucketBinding,
  rejectProofMediaStorageBucketBinding,
} from "../../../shared-match-media-production-verification/src/storageBucketBinding.ts";
import { createR2ConditionalObjectStore } from "./r2ConditionalObjectStore.ts";
import {
  inspectCompleteR2Object,
  type InspectableR2Bucket,
  type ObjectInspectionFailure,
} from "./r2ObjectInspector.ts";

export const VERIFIER_RUNTIME_VERSION = "coach-sync-production-verification-v1";
export const FIRST_SLICE_SCAN_POLICY_IDENTITY = "first-slice-scan-not-required-v1";

function errorCode(error: unknown, fallback: string): string {
  if (error instanceof VerificationDomainError) return error.code;
  return fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type ProductionVerificationCompletionInput = {
  readonly matchMediaAssetId: string;
  readonly objectVersion: string;
  readonly storageObjectKey: string;
  readonly declaredByteCount: number;
  /** Absent when legacy upload session omitted MIME; never fabricated. */
  readonly declaredMimeType?: string;
  readonly expectedWholeObjectSha256?: string;
  readonly uploadSessionId: string;
  readonly athleteId: string;
  readonly competitionId: string;
  readonly matchLineageKey: string;
  readonly matchId?: string;
};

export type ProductionVerificationOperationalOutcome =
  | {
      readonly outcome: "disabled";
      readonly verificationAttempted: false;
    }
  | {
      readonly outcome: "verified" | "rejected" | "failed" | "idempotent_terminal" | "verifying";
      readonly verificationAttempted: true;
      readonly record: ProductionVerificationRecord;
      readonly admissionOutcome: "created" | "idempotent" | "re_admitted";
    }
  | {
      readonly outcome: "trigger_error";
      readonly verificationAttempted: true;
      readonly code: string;
      readonly message: string;
    };

export type RunProductionVerificationDependencies = {
  readonly enabled: boolean;
  readonly mediaBucket: InspectableR2Bucket & {
    get(key: string): Promise<{ text(): Promise<string>; etag: string } | null>;
    put(
      key: string,
      value: string,
      options: {
        onlyIf:
          | { etagDoesNotMatch: "*" }
          | { etagMatches: string };
        httpMetadata: { contentType: string };
        customMetadata: Record<string, string>;
      },
    ): Promise<{ etag: string } | null>;
  };
  readonly now: () => Date;
  readonly randomId: () => string;
  /** Test seam — defaults to MEDIA production binding. */
  readonly storageBucketBinding?: string;
};

function admissionDeps(
  dependencies: RunProductionVerificationDependencies,
): VerificationAdmissionDependencies {
  return {
    store: createConditionalObjectVerificationRecordStore(
      createR2ConditionalObjectStore(dependencies.mediaBucket),
    ),
    now: dependencies.now,
    randomId: dependencies.randomId,
  };
}

function inspectionFailureToTerminal(
  failure: ObjectInspectionFailure,
): {
  targetState: "failed";
  terminalReasonCode: VerificationReasonCode;
} {
  return {
    targetState: "failed",
    terminalReasonCode: failure.code,
  };
}

/**
 * Execute Production Verification after authoritative upload_complete.
 * When disabled, performs no verification writes and no object reads.
 */
export async function runProductionVerification(
  input: ProductionVerificationCompletionInput,
  dependencies: RunProductionVerificationDependencies,
): Promise<ProductionVerificationOperationalOutcome> {
  if (!dependencies.enabled) {
    return { outcome: "disabled", verificationAttempted: false };
  }

  const storageBucketBinding =
    dependencies.storageBucketBinding ?? PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING;

  try {
    rejectProofMediaStorageBucketBinding(storageBucketBinding);
    assertProductionMediaStorageBucketBinding(storageBucketBinding);
  } catch (error) {
    return {
      outcome: "trigger_error",
      verificationAttempted: true,
      code: "INVALID_STORAGE_BUCKET_BINDING",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const deps = admissionDeps(dependencies);

  let admission;
  try {
    admission = await admitVerification(
      {
        contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
        storageBucketBinding,
        matchMediaAssetId: input.matchMediaAssetId,
        objectVersion: input.objectVersion,
        storageObjectKey: input.storageObjectKey,
        declaredByteCount: input.declaredByteCount,
        ...(input.declaredMimeType !== undefined
          ? { declaredMimeType: input.declaredMimeType }
          : {}),
        ...(input.expectedWholeObjectSha256
          ? { expectedWholeObjectSha256: input.expectedWholeObjectSha256 }
          : {}),
        uploadSessionId: input.uploadSessionId,
        athleteId: input.athleteId,
        competitionId: input.competitionId,
        matchLineageKey: input.matchLineageKey,
        ...(input.matchId ? { matchId: input.matchId } : {}),
      },
      deps,
    );
  } catch (error) {
    return {
      outcome: "trigger_error",
      verificationAttempted: true,
      code: errorCode(error, "ADMISSION_FAILED"),
      message: errorMessage(error),
    };
  }

  if (isTerminalVerificationState(admission.record.state)) {
    return {
      outcome: "idempotent_terminal",
      verificationAttempted: true,
      record: admission.record,
      admissionOutcome: admission.outcome,
    };
  }

  if (admission.record.state !== "verifying") {
    return {
      outcome: "trigger_error",
      verificationAttempted: true,
      code: "ILLEGAL_STATE",
      message: `Unexpected verification state ${admission.record.state}`,
    };
  }

  const inspection = await inspectCompleteR2Object(
    dependencies.mediaBucket,
    input.storageObjectKey,
    input.objectVersion,
  );

  if ("code" in inspection) {
    try {
      await appendAttemptEvidence(
        {
          admissionKeyHash: admission.record.admissionKeyHash,
          event: {
            kind: "object_inspection_failed",
            detail: {
              code: inspection.code,
              message: inspection.message,
              retryable: inspection.retryable,
            },
          },
        },
        deps,
      );
      const terminal = inspectionFailureToTerminal(inspection);
      const failed = await transitionVerificationTerminal(
        {
          admissionKeyHash: admission.record.admissionKeyHash,
          targetState: terminal.targetState,
          terminalReasonCode: terminal.terminalReasonCode,
          scanHookStatus: "scan_not_required",
          verifierRuntimeVersion: VERIFIER_RUNTIME_VERSION,
          eventDetail: {
            scanPolicyIdentity: FIRST_SLICE_SCAN_POLICY_IDENTITY,
          },
        },
        deps,
      );
      return {
        outcome: "failed",
        verificationAttempted: true,
        record: failed,
        admissionOutcome: admission.outcome,
      };
    } catch (error) {
      if (error instanceof VerificationDomainError && error.code === "TERMINAL_IMMUTABLE") {
        const current = await getVerificationRecordByHash(
          admission.record.admissionKeyHash,
          deps.store,
        );
        if (current && isTerminalVerificationState(current.state)) {
          return {
            outcome: "idempotent_terminal",
            verificationAttempted: true,
            record: current,
            admissionOutcome: admission.outcome,
          };
        }
      }
      return {
        outcome: "trigger_error",
        verificationAttempted: true,
        code: errorCode(error, "TERMINAL_FAILED"),
        message: errorMessage(error),
      };
    }
  }

  const integrity = evaluateObjectIntegrity({
    ...(input.declaredMimeType !== undefined
      ? { declaredMimeType: input.declaredMimeType }
      : {}),
    declaredByteCount: input.declaredByteCount,
    expectedWholeObjectSha256: input.expectedWholeObjectSha256,
    observedByteCount: inspection.observedByteCount,
    calculatedSha256: inspection.calculatedSha256,
    mimePrefix: inspection.mimePrefix,
    r2ContentType: inspection.r2ContentType,
  });

  try {
    await appendAttemptEvidence(
      {
        admissionKeyHash: admission.record.admissionKeyHash,
        event: {
          kind: "object_inspection",
          detail: {
            observedByteCount: inspection.observedByteCount,
            calculatedSha256: inspection.calculatedSha256,
            r2ContentType: inspection.r2ContentType,
            integrityOutcome: integrity.outcome,
            ...(integrity.outcome === "reject"
              ? { terminalReasonCode: integrity.terminalReasonCode }
              : {
                  observedMimeType: integrity.observedMimeType,
                  shaComparison: integrity.shaComparison,
                }),
          },
        },
      },
      deps,
    );

    if (integrity.outcome === "reject") {
      const rejected = await transitionVerificationTerminal(
        {
          admissionKeyHash: admission.record.admissionKeyHash,
          targetState: "rejected",
          terminalReasonCode: integrity.terminalReasonCode,
          observedByteCount: inspection.observedByteCount,
          observedMimeType: integrity.observedMimeType ?? undefined,
          calculatedSha256: inspection.calculatedSha256,
          scanHookStatus: "scan_not_required",
          verifierRuntimeVersion: VERIFIER_RUNTIME_VERSION,
          eventDetail: {
            scanPolicyIdentity: FIRST_SLICE_SCAN_POLICY_IDENTITY,
          },
        },
        deps,
      );
      return {
        outcome: "rejected",
        verificationAttempted: true,
        record: rejected,
        admissionOutcome: admission.outcome,
      };
    }

    const verified = await transitionVerificationTerminal(
      {
        admissionKeyHash: admission.record.admissionKeyHash,
        targetState: "verified",
        observedByteCount: inspection.observedByteCount,
        observedMimeType: integrity.observedMimeType,
        calculatedSha256: inspection.calculatedSha256,
        scanHookStatus: "scan_not_required",
        verifierRuntimeVersion: VERIFIER_RUNTIME_VERSION,
        eventDetail: {
          scanPolicyIdentity: FIRST_SLICE_SCAN_POLICY_IDENTITY,
          shaComparison: integrity.shaComparison,
        },
      },
      deps,
    );
    return {
      outcome: "verified",
      verificationAttempted: true,
      record: verified,
      admissionOutcome: admission.outcome,
    };
  } catch (error) {
    if (error instanceof VerificationDomainError && error.code === "TERMINAL_IMMUTABLE") {
      const current = await getVerificationRecordByHash(
        admission.record.admissionKeyHash,
        deps.store,
      );
      if (current && isTerminalVerificationState(current.state)) {
        return {
          outcome: "idempotent_terminal",
          verificationAttempted: true,
          record: current,
          admissionOutcome: admission.outcome,
        };
      }
    }
    return {
      outcome: "trigger_error",
      verificationAttempted: true,
      code: errorCode(error, "TERMINAL_FAILED"),
      message: errorMessage(error),
    };
  }
}

export function isVerificationFeatureEnabled(value: string | undefined): boolean {
  return value === "1";
}
