import { isDeepStrictEqual } from "node:util";

import {
  deriveAdmissionIdentity,
  type ImmutableAdmissionFields,
} from "./admissionIdentity.ts";
import {
  defaultRetryClassificationForReason,
  isRetryClassification,
  isVerificationReasonCode,
  type RetryClassification,
  type VerificationReasonCode,
} from "./reasonCodes.ts";
import { recordStoreKey, type VerificationRecordStore } from "./verificationRecordStore.ts";
import {
  ACTIVE_VERIFICATION_STATE,
  VerificationDomainError,
  cloneRecord,
  isTerminalVerificationState,
  type AdmitVerificationInput,
  type AttemptEvidenceEvent,
  type ProductionVerificationRecord,
  type TerminalVerificationState,
  type VerificationAttemptEvidence,
  type VerificationLifecycleState,
} from "./verificationTypes.ts";

export const MAX_ADMISSION_CAS_ATTEMPTS = 8;

export type AdmitVerificationResult =
  | {
      readonly outcome: "created";
      readonly record: ProductionVerificationRecord;
    }
  | {
      readonly outcome: "idempotent";
      readonly record: ProductionVerificationRecord;
    }
  | {
      readonly outcome: "re_admitted";
      readonly record: ProductionVerificationRecord;
    };

export type TerminalTransitionInput = {
  readonly admissionKeyHash: string;
  readonly targetState: TerminalVerificationState;
  /** Required for rejected/failed; omit for verified (contract success class, no invented code). */
  readonly terminalReasonCode?: VerificationReasonCode;
  readonly retryClassification?: RetryClassification;
  readonly observedByteCount?: number;
  readonly observedMimeType?: string;
  readonly calculatedSha256?: string;
  readonly eventDetail?: Readonly<Record<string, string | number | boolean | null>>;
};

export type AppendEvidenceInput = {
  readonly admissionKeyHash: string;
  readonly event: Omit<AttemptEvidenceEvent, "eventId" | "at"> & {
    readonly eventId?: string;
    readonly at?: string;
  };
};

export type VerificationAdmissionDependencies = {
  readonly store: VerificationRecordStore;
  readonly now: () => Date;
  readonly randomId: () => string;
  /**
   * Retry budget for failed(retryable) → verifying re-admission.
   * Contract §15 leaves the exact budget as an open policy decision; there is
   * no default here. When omitted, retryable failed records are observed
   * idempotently without creating a new attempt.
   */
  readonly maxAutomaticAttempts?: number;
};

function serializeRecord(record: ProductionVerificationRecord): string {
  return JSON.stringify(record);
}

function parseRecord(raw: string): ProductionVerificationRecord {
  const parsed = JSON.parse(raw) as ProductionVerificationRecord;
  if (parsed?.schemaVersion !== 1 || typeof parsed.admissionKeyHash !== "string") {
    throw new VerificationDomainError(
      "INVALID_ADMISSION_INPUT",
      "Persisted verification record failed schema validation.",
    );
  }
  if (!Array.isArray(parsed.attemptEvidence)) {
    throw new VerificationDomainError(
      "INVALID_ADMISSION_INPUT",
      "Persisted verification record missing attemptEvidence.",
    );
  }
  return parsed;
}

function countActiveAttempts(record: ProductionVerificationRecord): number {
  return record.attemptEvidence.filter((attempt) => attempt.state === ACTIVE_VERIFICATION_STATE)
    .length;
}

function assertOneActiveAttemptInvariant(record: ProductionVerificationRecord): void {
  const active = countActiveAttempts(record);
  if (record.state === ACTIVE_VERIFICATION_STATE) {
    if (active !== 1 || !record.activeAttemptId) {
      throw new VerificationDomainError(
        "ACTIVE_ATTEMPT_EXISTS",
        "verifying record must have exactly one active attempt.",
      );
    }
  } else if (active !== 0 || record.activeAttemptId !== null) {
    throw new VerificationDomainError(
      "ILLEGAL_TRANSITION",
      "terminal record must not retain an active attempt.",
    );
  }
}

function assertDeepEqualExactPrefix<T>(
  prior: ReadonlyArray<T>,
  proposed: ReadonlyArray<T>,
  message: string,
): void {
  if (proposed.length < prior.length) {
    throw new VerificationDomainError("APPEND_ONLY_VIOLATION", message);
  }
  for (let index = 0; index < prior.length; index += 1) {
    if (!isDeepStrictEqual(prior[index], proposed[index])) {
      throw new VerificationDomainError("APPEND_ONLY_VIOLATION", message);
    }
  }
}

/**
 * Pre-persist append-only evidence invariant for CAS mutations.
 *
 * Prior `attemptEvidence` must remain an exact prefix of the proposed sequence:
 * existing attempts cannot be removed, replaced, or reordered. When an existing
 * attempt’s events length is unchanged, the attempt entry must be deep-equal.
 * When events grow, attempt identity must stay stable and the prior `events`
 * sequence must be a deep-equal exact prefix of the proposed `events`.
 * Length alone is not enough.
 *
 * Exported so focused tests can prove same-version domain rejection without
 * relying on stale ETag rejection at the store boundary.
 */
export function assertAppendOnlyEvidencePrefix(
  prior: ProductionVerificationRecord,
  proposed: ProductionVerificationRecord,
): void {
  const priorAttempts = prior.attemptEvidence;
  const proposedAttempts = proposed.attemptEvidence;

  if (proposedAttempts.length < priorAttempts.length) {
    throw new VerificationDomainError(
      "APPEND_ONLY_VIOLATION",
      "attemptEvidence must preserve the prior attempt sequence as an exact prefix.",
    );
  }

  for (let index = 0; index < priorAttempts.length; index += 1) {
    const priorAttempt = priorAttempts[index]!;
    const proposedAttempt = proposedAttempts[index]!;

    assertDeepEqualExactPrefix(
      priorAttempt.events,
      proposedAttempt.events,
      "attempt events must preserve the prior evidence sequence as an exact deep-equal prefix.",
    );

    if (priorAttempt.events.length === proposedAttempt.events.length) {
      if (!isDeepStrictEqual(priorAttempt, proposedAttempt)) {
        throw new VerificationDomainError(
          "APPEND_ONLY_VIOLATION",
          "attemptEvidence must not remove, replace, reorder, or alter existing attempts.",
        );
      }
      continue;
    }

    if (
      priorAttempt.attemptId !== proposedAttempt.attemptId ||
      priorAttempt.attemptNumber !== proposedAttempt.attemptNumber
    ) {
      throw new VerificationDomainError(
        "APPEND_ONLY_VIOLATION",
        "attemptEvidence must not remove, replace, or reorder existing attempts.",
      );
    }
  }
}

function buildStartEvent(nowIso: string, eventId: string): AttemptEvidenceEvent {
  return {
    eventId,
    at: nowIso,
    kind: "attempt_started",
    detail: { source: "admission" },
  };
}

function createInitialRecord(
  identity: Awaited<ReturnType<typeof deriveAdmissionIdentity>>,
  input: AdmitVerificationInput,
  nowIso: string,
  verificationRecordId: string,
  attemptId: string,
): ProductionVerificationRecord {
  const attempt: VerificationAttemptEvidence = {
    attemptId,
    attemptNumber: 1,
    state: ACTIVE_VERIFICATION_STATE,
    verifyingStartedAt: nowIso,
    events: [buildStartEvent(nowIso, `${attemptId}:start`)],
  };

  const record: ProductionVerificationRecord = {
    schemaVersion: 1,
    verificationRecordId,
    contractVersion: identity.fields.contractVersion,
    matchMediaAssetId: identity.fields.matchMediaAssetId,
    objectVersion: identity.fields.objectVersion,
    storageBucketBinding: identity.fields.storageBucketBinding,
    storageObjectKey: identity.fields.storageObjectKey,
    admissionKey: identity.admissionKey,
    admissionKeyHash: identity.admissionKeyHash,
    state: ACTIVE_VERIFICATION_STATE,
    attemptNumber: 1,
    activeAttemptId: attemptId,
    admittedAt: nowIso,
    verifyingStartedAt: nowIso,
    terminalAt: null,
    terminalReasonCode: null,
    retryClassification: null,
    nextRetryEligibleAt: null,
    evidenceReferences: [],
    attemptEvidence: [attempt],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Omit undefined optional provenance so JSON round-trips are byte-stable.
  if (input.declaredByteCount !== undefined) {
    (record as { declaredByteCount?: number }).declaredByteCount =
      input.declaredByteCount;
  }
  if (input.declaredMimeType !== undefined) {
    (record as { declaredMimeType?: string }).declaredMimeType = input.declaredMimeType;
  }
  if (input.expectedWholeObjectSha256 !== undefined) {
    (record as { expectedWholeObjectSha256?: string }).expectedWholeObjectSha256 =
      input.expectedWholeObjectSha256;
  }
  if (input.uploadSessionId !== undefined) {
    (record as { uploadSessionId?: string }).uploadSessionId = input.uploadSessionId;
  }
  if (input.athleteId !== undefined) {
    (record as { athleteId?: string }).athleteId = input.athleteId;
  }
  if (input.competitionId !== undefined) {
    (record as { competitionId?: string }).competitionId = input.competitionId;
  }
  if (input.matchId !== undefined) {
    (record as { matchId?: string }).matchId = input.matchId;
  }
  if (input.matchLineageKey !== undefined) {
    (record as { matchLineageKey?: string }).matchLineageKey = input.matchLineageKey;
  }

  return record;
}

async function loadVersioned(
  store: VerificationRecordStore,
  admissionKeyHash: string,
): Promise<{ record: ProductionVerificationRecord; version: string } | null> {
  const versioned = await store.getVersioned(recordStoreKey(admissionKeyHash));
  if (!versioned) return null;
  return { record: parseRecord(versioned.value), version: versioned.version };
}

async function casWrite(
  store: VerificationRecordStore,
  admissionKeyHash: string,
  version: string,
  prior: ProductionVerificationRecord,
  record: ProductionVerificationRecord,
): Promise<boolean> {
  assertAppendOnlyEvidencePrefix(prior, record);
  assertOneActiveAttemptInvariant(record);
  return store.compareAndSwap(
    recordStoreKey(admissionKeyHash),
    version,
    serializeRecord(record),
  );
}

/**
 * Certified authorization for a new attempt after retryable failed:
 * - Contract §5 state diagram: `failed --> verifying: retryable re-admit new attempt`
 * - Contract §5 transition table: `failed(retryable) → verifying` with
 *   preconditions "Prior terminal `failed` with retryable classification;
 *   retry budget remaining; eligibility time reached" and concurrency
 *   "CAS on record + single active attempt" producing a "New attemptEvidence entry"
 * - Contract §6 duplicate/terminal table:
 *   "Retryable `failed` exists | May create a new attempt via CAS transition
 *   back to `verifying`"
 *
 * Exact budget remains policy-owned (§15); callers must supply maxAutomaticAttempts.
 */
function canReAdmitFailed(
  record: ProductionVerificationRecord,
  maxAutomaticAttempts: number | undefined,
): boolean {
  if (
    record.state !== "failed" ||
    record.retryClassification !== "retryable" ||
    maxAutomaticAttempts === undefined
  ) {
    return false;
  }
  if (
    typeof maxAutomaticAttempts !== "number" ||
    !Number.isInteger(maxAutomaticAttempts) ||
    maxAutomaticAttempts < 1
  ) {
    throw new VerificationDomainError(
      "INVALID_ADMISSION_INPUT",
      "maxAutomaticAttempts must be a positive integer when supplied.",
    );
  }
  return record.attemptNumber < maxAutomaticAttempts;
}

/**
 * Atomic admission against the authoritative store boundary.
 *
 * Does not read production objects, inspect media bytes, mutate upload/Match
 * records, or consult a feature flag (flag evaluation is a future runtime
 * concern; this skeleton remains unwired and disabled by non-composition).
 */
export async function admitVerification(
  input: AdmitVerificationInput,
  dependencies: VerificationAdmissionDependencies,
): Promise<AdmitVerificationResult> {
  const identity = await deriveAdmissionIdentity(input);
  const key = recordStoreKey(identity.admissionKeyHash);

  for (let attempt = 0; attempt < MAX_ADMISSION_CAS_ATTEMPTS; attempt += 1) {
    const existing = await loadVersioned(dependencies.store, identity.admissionKeyHash);
    const nowIso = dependencies.now().toISOString();

    if (!existing) {
      const verificationRecordId =
        input.verificationRecordId ?? `pvr_${dependencies.randomId()}`;
      const attemptId = input.attemptId ?? `pva_${dependencies.randomId()}`;
      const created = createInitialRecord(
        identity,
        input,
        nowIso,
        verificationRecordId,
        attemptId,
      );
      assertOneActiveAttemptInvariant(created);
      const inserted = await dependencies.store.putIfAbsent(key, serializeRecord(created));
      if (inserted) {
        return { outcome: "created", record: cloneRecord(created) };
      }
      continue;
    }

    const { record, version } = existing;

    if (record.state === ACTIVE_VERIFICATION_STATE) {
      // Idempotent observe — no duplicate start evidence, no second active attempt.
      return { outcome: "idempotent", record: cloneRecord(record) };
    }

    if (record.state === "verified" || record.state === "rejected") {
      return { outcome: "idempotent", record: cloneRecord(record) };
    }

    if (record.state === "failed") {
      if (!canReAdmitFailed(record, dependencies.maxAutomaticAttempts)) {
        return { outcome: "idempotent", record: cloneRecord(record) };
      }

      const attemptId = input.attemptId ?? `pva_${dependencies.randomId()}`;
      const nextAttemptNumber = record.attemptNumber + 1;
      const nextAttempt: VerificationAttemptEvidence = {
        attemptId,
        attemptNumber: nextAttemptNumber,
        state: ACTIVE_VERIFICATION_STATE,
        verifyingStartedAt: nowIso,
        events: [buildStartEvent(nowIso, `${attemptId}:start`)],
      };

      const next: ProductionVerificationRecord = {
        ...record,
        state: ACTIVE_VERIFICATION_STATE,
        attemptNumber: nextAttemptNumber,
        activeAttemptId: attemptId,
        verifyingStartedAt: nowIso,
        terminalAt: null,
        terminalReasonCode: null,
        retryClassification: null,
        nextRetryEligibleAt: null,
        attemptEvidence: [...record.attemptEvidence, nextAttempt],
        updatedAt: nowIso,
      };

      const swapped = await casWrite(
        dependencies.store,
        identity.admissionKeyHash,
        version,
        record,
        next,
      );
      if (swapped) {
        return { outcome: "re_admitted", record: cloneRecord(next) };
      }
      continue;
    }

    throw new VerificationDomainError(
      "ILLEGAL_TRANSITION",
      `Unsupported verification state during admission: ${String(record.state)}`,
    );
  }

  throw new VerificationDomainError(
    "CAS_CONFLICT",
    "Admission CAS exhausted without convergence.",
  );
}

export async function getVerificationRecord(
  admissionFields: ImmutableAdmissionFields,
  store: VerificationRecordStore,
): Promise<ProductionVerificationRecord | null> {
  const identity = await deriveAdmissionIdentity(admissionFields);
  const raw = await store.get(recordStoreKey(identity.admissionKeyHash));
  return raw ? cloneRecord(parseRecord(raw)) : null;
}

export async function getVerificationRecordByHash(
  admissionKeyHash: string,
  store: VerificationRecordStore,
): Promise<ProductionVerificationRecord | null> {
  const raw = await store.get(recordStoreKey(admissionKeyHash));
  return raw ? cloneRecord(parseRecord(raw)) : null;
}

/**
 * CAS terminal transition verifying → verified | rejected | failed.
 * Skeleton surface for lifecycle protection tests — not a verification worker.
 */
export async function transitionVerificationTerminal(
  input: TerminalTransitionInput,
  dependencies: VerificationAdmissionDependencies,
): Promise<ProductionVerificationRecord> {
  let terminalReasonCode: VerificationReasonCode | null = null;
  let retryClassification: RetryClassification;

  if (input.targetState === "verified") {
    if (input.terminalReasonCode !== undefined) {
      throw new VerificationDomainError(
        "UNSUPPORTED_REASON_CODE",
        "verified transitions use success-class evidence without an invented reason code.",
      );
    }
    retryClassification = input.retryClassification ?? "not_applicable";
  } else {
    if (!isVerificationReasonCode(input.terminalReasonCode)) {
      throw new VerificationDomainError(
        "UNSUPPORTED_REASON_CODE",
        `Unsupported terminalReasonCode: ${String(input.terminalReasonCode)}`,
      );
    }
    terminalReasonCode = input.terminalReasonCode;
    retryClassification =
      input.retryClassification ??
      defaultRetryClassificationForReason(terminalReasonCode);
  }

  if (!isRetryClassification(retryClassification)) {
    throw new VerificationDomainError(
      "UNSUPPORTED_RETRY_CLASSIFICATION",
      `Unsupported retryClassification: ${String(retryClassification)}`,
    );
  }

  for (let attempt = 0; attempt < MAX_ADMISSION_CAS_ATTEMPTS; attempt += 1) {
    const existing = await loadVersioned(dependencies.store, input.admissionKeyHash);
    if (!existing) {
      throw new VerificationDomainError("RECORD_NOT_FOUND", "Verification record not found.");
    }
    const { record, version } = existing;

    if (isTerminalVerificationState(record.state)) {
      throw new VerificationDomainError(
        "TERMINAL_IMMUTABLE",
        `Terminal state ${record.state} cannot be reopened or overwritten.`,
      );
    }
    if (record.state !== ACTIVE_VERIFICATION_STATE || !record.activeAttemptId) {
      throw new VerificationDomainError(
        "ILLEGAL_TRANSITION",
        "Terminal transition requires an active verifying attempt.",
      );
    }

    const nowIso = dependencies.now().toISOString();
    const activeAttemptId = record.activeAttemptId;
    const attemptEvidence = record.attemptEvidence.map((entry) => {
      if (entry.attemptId !== activeAttemptId) return entry;
      if (entry.state !== ACTIVE_VERIFICATION_STATE) {
        throw new VerificationDomainError(
          "ILLEGAL_TRANSITION",
          "Active attempt reference does not match append-only attempt state.",
        );
      }
      return {
        ...entry,
        state: input.targetState as VerificationLifecycleState,
        terminalAt: nowIso,
        terminalReasonCode: terminalReasonCode ?? undefined,
        retryClassification,
        events: [
          ...entry.events,
          {
            eventId: `${activeAttemptId}:terminal:${input.targetState}`,
            at: nowIso,
            kind: "attempt_terminal",
            detail: {
              targetState: input.targetState,
              ...(terminalReasonCode ? { terminalReasonCode } : {}),
              ...(input.eventDetail ?? {}),
            },
          },
        ],
      };
    });

    const next: ProductionVerificationRecord = {
      ...record,
      state: input.targetState,
      activeAttemptId: null,
      verifyingStartedAt: record.verifyingStartedAt,
      terminalAt: nowIso,
      terminalReasonCode,
      retryClassification,
      observedByteCount: input.observedByteCount ?? record.observedByteCount,
      observedMimeType: input.observedMimeType ?? record.observedMimeType,
      calculatedSha256: input.calculatedSha256 ?? record.calculatedSha256,
      attemptEvidence,
      updatedAt: nowIso,
    };

    const swapped = await casWrite(
      dependencies.store,
      input.admissionKeyHash,
      version,
      record,
      next,
    );
    if (swapped) return cloneRecord(next);
  }

  throw new VerificationDomainError(
    "CAS_CONFLICT",
    "Terminal transition CAS exhausted without convergence.",
  );
}

/**
 * Append-only evidence on the active attempt. Refuses history replacement.
 */
export async function appendAttemptEvidence(
  input: AppendEvidenceInput,
  dependencies: VerificationAdmissionDependencies,
): Promise<ProductionVerificationRecord> {
  for (let attempt = 0; attempt < MAX_ADMISSION_CAS_ATTEMPTS; attempt += 1) {
    const existing = await loadVersioned(dependencies.store, input.admissionKeyHash);
    if (!existing) {
      throw new VerificationDomainError("RECORD_NOT_FOUND", "Verification record not found.");
    }
    const { record, version } = existing;

    if (isTerminalVerificationState(record.state) || !record.activeAttemptId) {
      throw new VerificationDomainError(
        "TERMINAL_IMMUTABLE",
        "Cannot append attempt evidence after terminal attempt without a new admission.",
      );
    }

    const nowIso = input.event.at ?? dependencies.now().toISOString();
    const eventId = input.event.eventId ?? `pve_${dependencies.randomId()}`;
    const activeAttemptId = record.activeAttemptId;

    const attemptEvidence = record.attemptEvidence.map((entry) => {
      if (entry.attemptId !== activeAttemptId) return entry;
      return {
        ...entry,
        events: [
          ...entry.events,
          {
            eventId,
            at: nowIso,
            kind: input.event.kind,
            detail: input.event.detail,
          },
        ],
      };
    });

    const next: ProductionVerificationRecord = {
      ...record,
      attemptEvidence,
      updatedAt: nowIso,
    };

    const swapped = await casWrite(
      dependencies.store,
      input.admissionKeyHash,
      version,
      record,
      next,
    );
    if (swapped) return cloneRecord(next);
  }

  throw new VerificationDomainError(
    "CAS_CONFLICT",
    "Append-evidence CAS exhausted without convergence.",
  );
}

/**
 * Intentionally absent: no API to replace attemptEvidence wholesale.
 * Tests assert this export surface does not exist.
 */
export const FORBIDDEN_REPLACE_ATTEMPT_HISTORY = undefined;
