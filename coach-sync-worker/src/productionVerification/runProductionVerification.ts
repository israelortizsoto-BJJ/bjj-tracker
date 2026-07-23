/**
 * Flag-gated Production Verification orchestration for coach-sync-worker.
 *
 * canary gate → admit → (executor only) inspect → append evidence → terminal CAS.
 * Enabled only when SHARED_MATCH_MEDIA_VERIFICATION_ENABLED === "1" and the
 * server-controlled canary identity exactly matches the completed asset version.
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
import { evaluateProductionVerificationCanaryGate } from "./canaryGate.ts";
import { emitProductionVerificationMarker } from "./observability.ts";
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
      readonly outcome: "bypassed";
      readonly verificationAttempted: false;
      readonly bypassReason: string;
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
  /**
   * Server-controlled canary asset id. Defaults to empty (bypass).
   * Never accepted from the completion request.
   */
  readonly canaryAssetId?: string;
  /**
   * Server-controlled canary object version. Defaults to empty (bypass).
   * Never accepted from the completion request.
   */
  readonly canaryObjectVersion?: string;
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

function acquiresExecutionOwnership(
  admissionOutcome: "created" | "idempotent" | "re_admitted",
): boolean {
  return admissionOutcome === "created" || admissionOutcome === "re_admitted";
}

/**
 * Execute Production Verification after authoritative upload_complete.
 * When disabled or canary-bypassed, performs no verification writes and no object reads.
 */
export async function runProductionVerification(
  input: ProductionVerificationCompletionInput,
  dependencies: RunProductionVerificationDependencies,
): Promise<ProductionVerificationOperationalOutcome> {
  const canaryDecision = evaluateProductionVerificationCanaryGate({
    enabled: dependencies.enabled,
    canaryAssetId: dependencies.canaryAssetId ?? "",
    canaryObjectVersion: dependencies.canaryObjectVersion ?? "",
    matchMediaAssetId: input.matchMediaAssetId,
    providerVersion: input.objectVersion,
  });

  emitProductionVerificationMarker(
    "production_verification_canary_gate",
    {
      outcome: canaryDecision.outcome,
      reason: canaryDecision.allow ? "allow" : canaryDecision.reason,
      enabled: dependencies.enabled,
    },
    dependencies.now,
  );

  if (!canaryDecision.allow) {
    if (canaryDecision.reason === "flag_disabled") {
      return { outcome: "disabled", verificationAttempted: false };
    }
    return {
      outcome: "bypassed",
      verificationAttempted: false,
      bypassReason: canaryDecision.reason,
    };
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

  emitProductionVerificationMarker(
    "production_verification_admission",
    {
      outcome: admission.outcome,
      state: admission.record.state,
    },
    dependencies.now,
  );

  if (isTerminalVerificationState(admission.record.state)) {
    emitProductionVerificationMarker(
      "production_verification_execution_acquisition",
      {
        acquired: false,
        admissionOutcome: admission.outcome,
        reason: "terminal_replay",
      },
      dependencies.now,
    );
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

  if (!acquiresExecutionOwnership(admission.outcome)) {
    emitProductionVerificationMarker(
      "production_verification_execution_acquisition",
      {
        acquired: false,
        admissionOutcome: admission.outcome,
        reason: "idempotent_active",
      },
      dependencies.now,
    );
    return {
      outcome: "verifying",
      verificationAttempted: true,
      record: admission.record,
      admissionOutcome: admission.outcome,
    };
  }

  emitProductionVerificationMarker(
    "production_verification_execution_acquisition",
    {
      acquired: true,
      admissionOutcome: admission.outcome,
    },
    dependencies.now,
  );

  emitProductionVerificationMarker(
    "production_verification_inspection_start",
    {
      admissionOutcome: admission.outcome,
    },
    dependencies.now,
  );

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
      emitProductionVerificationMarker(
        "production_verification_terminal",
        {
          outcome: "failed",
          reason: failed.terminalReasonCode,
        },
        dependencies.now,
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
          emitProductionVerificationMarker(
            "production_verification_terminal",
            {
              outcome: "idempotent_terminal",
              reason: current.terminalReasonCode,
            },
            dependencies.now,
          );
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
      emitProductionVerificationMarker(
        "production_verification_terminal",
        {
          outcome: "rejected",
          reason: rejected.terminalReasonCode,
        },
        dependencies.now,
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
    emitProductionVerificationMarker(
      "production_verification_terminal",
      {
        outcome: "verified",
        reason: null,
      },
      dependencies.now,
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
        emitProductionVerificationMarker(
          "production_verification_terminal",
          {
            outcome: "idempotent_terminal",
            reason: current.terminalReasonCode,
          },
          dependencies.now,
        );
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
