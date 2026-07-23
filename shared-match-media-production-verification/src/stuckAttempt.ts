import type { RetryClassification, VerificationReasonCode } from "./reasonCodes.ts";
import type { ProductionVerificationRecord } from "./verificationTypes.ts";
import { ACTIVE_VERIFICATION_STATE } from "./verificationTypes.ts";

/** Package-owned default: verifying is stuck after 60 minutes without durable activity. */
export const DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS = 60 * 60 * 1000;

const STUCK_REASON_CODE = "STUCK_ATTEMPT_REQUIRES_RECONCILIATION" as const satisfies VerificationReasonCode;
const STUCK_RETRY_CLASSIFICATION = "operator_required" as const satisfies RetryClassification;

export type StuckVerifyingClassification = {
  readonly isStuck: boolean;
  readonly activeAttemptId: string | null;
  /** Authoritative durable-activity clock (`ProductionVerificationRecord.updatedAt`). */
  readonly lastDurableActivityAt: string | null;
  readonly elapsedMs: number | null;
  readonly thresholdMs: number;
  /** Boundary rule: stuck when elapsedMs >= thresholdMs. */
  readonly boundaryRule: "elapsed_gte_threshold";
  readonly reasonCode: typeof STUCK_REASON_CODE | null;
  readonly retryClassification: typeof STUCK_RETRY_CLASSIFICATION | null;
};

function notStuck(
  thresholdMs: number,
  partial: {
    activeAttemptId: string | null;
    lastDurableActivityAt: string | null;
    elapsedMs: number | null;
  },
): StuckVerifyingClassification {
  return {
    isStuck: false,
    activeAttemptId: partial.activeAttemptId,
    lastDurableActivityAt: partial.lastDurableActivityAt,
    elapsedMs: partial.elapsedMs,
    thresholdMs,
    boundaryRule: "elapsed_gte_threshold",
    reasonCode: null,
    retryClassification: null,
  };
}

/**
 * Deterministic, side-effect-free stuck classification for an active verifying attempt.
 *
 * Inactivity is measured from `record.updatedAt` (durable-activity clock).
 * `verifyingStartedAt` remains the immutable attempt-start timestamp and is not used here.
 * Classification never fails, terminalizes, re-admits, replaces, retries, or mutates the record.
 */
export function classifyStuckVerifying(
  record: ProductionVerificationRecord,
  now: Date,
  thresholdMs: number = DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS,
): StuckVerifyingClassification {
  if (typeof thresholdMs !== "number" || thresholdMs < 0 || !Number.isFinite(thresholdMs)) {
    throw new Error("stuck thresholdMs must be an explicit finite non-negative number.");
  }

  if (record.state !== ACTIVE_VERIFICATION_STATE) {
    return notStuck(thresholdMs, {
      activeAttemptId: null,
      lastDurableActivityAt: null,
      elapsedMs: null,
    });
  }

  const lastDurableActivityAt = record.updatedAt;
  const activityMs = Date.parse(lastDurableActivityAt);
  if (!Number.isFinite(activityMs)) {
    throw new Error("updatedAt must be a valid ISO-8601 timestamp.");
  }

  const elapsedMs = now.getTime() - activityMs;
  if (elapsedMs < thresholdMs) {
    return notStuck(thresholdMs, {
      activeAttemptId: record.activeAttemptId,
      lastDurableActivityAt,
      elapsedMs,
    });
  }

  return {
    isStuck: true,
    activeAttemptId: record.activeAttemptId,
    lastDurableActivityAt,
    elapsedMs,
    thresholdMs,
    boundaryRule: "elapsed_gte_threshold",
    reasonCode: STUCK_REASON_CODE,
    retryClassification: STUCK_RETRY_CLASSIFICATION,
  };
}
