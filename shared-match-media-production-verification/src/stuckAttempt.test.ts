import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  admitVerification,
  appendAttemptEvidence,
  getVerificationRecord,
  type VerificationAdmissionDependencies,
} from "./admitVerification.ts";
import type { ImmutableAdmissionFields } from "./admissionIdentity.ts";
import { createConditionalObjectVerificationRecordStore } from "./conditionalObjectVerificationRecordStore.ts";
import { createSyntheticConditionalObjectStore } from "./syntheticConditionalObjectStore.ts";
import * as stuckModule from "./stuckAttempt.ts";
import {
  DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS,
  classifyStuckVerifying,
} from "./stuckAttempt.ts";
import type { ProductionVerificationRecord } from "./verificationTypes.ts";

const HOUR_MS = 60 * 60 * 1000;
const T0 = "2026-07-23T00:00:00.000Z";

function baseRecord(
  overrides: Partial<ProductionVerificationRecord> = {},
): ProductionVerificationRecord {
  return {
    schemaVersion: 1,
    verificationRecordId: "pvr_test",
    contractVersion: "shared-match-media-production-verification-design-v1",
    matchMediaAssetId: "mma_1",
    objectVersion: "v1",
    storageBucketBinding: "MEDIA",
    storageObjectKey: "key",
    admissionKey: "k",
    admissionKeyHash: "a".repeat(64),
    state: "verifying",
    attemptNumber: 1,
    activeAttemptId: "pva_1",
    admittedAt: T0,
    verifyingStartedAt: T0,
    terminalAt: null,
    terminalReasonCode: null,
    retryClassification: null,
    nextRetryEligibleAt: null,
    evidenceReferences: [],
    attemptEvidence: [
      {
        attemptId: "pva_1",
        attemptNumber: 1,
        state: "verifying",
        verifyingStartedAt: T0,
        events: [],
      },
    ],
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function evidenceHarness(): {
  clock: { ms: number };
  deps: VerificationAdmissionDependencies;
  fields: ImmutableAdmissionFields;
} {
  const backend = createSyntheticConditionalObjectStore();
  const store = createConditionalObjectVerificationRecordStore(backend);
  const clock = { ms: Date.parse(T0) };
  let seq = 0;
  const deps: VerificationAdmissionDependencies = {
    store,
    now: () => new Date(clock.ms),
    randomId: () => {
      seq += 1;
      return `id-${seq.toString().padStart(4, "0")}`;
    },
  };
  const fields: ImmutableAdmissionFields = {
    contractVersion: "shared-match-media-production-verification-design-v1",
    storageBucketBinding: "MEDIA",
    matchMediaAssetId: "mma_stuck_11111111-2222-4333-8444-555555555555",
    objectVersion: "object-version-1",
    storageObjectKey:
      "match-media/assets/mma_stuck_11111111-2222-4333-8444-555555555555/original",
  };
  return { clock, deps, fields };
}

describe("stuck verifying classification (updatedAt inactivity clock)", () => {
  it("exports the package-owned 60-minute default inactivity threshold", () => {
    assert.equal(DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS, HOUR_MS);
    assert.equal(
      stuckModule.DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS,
      60 * 60 * 1000,
    );
    assert.equal("DESIGN_PLACEHOLDER_STUCK_VERIFYING_THRESHOLD_MS" in stuckModule, false);
  });

  it("uses the exported default threshold when override is omitted", () => {
    const result = classifyStuckVerifying(
      baseRecord(),
      new Date("2026-07-23T01:00:00.000Z"),
    );
    assert.equal(result.thresholdMs, DEFAULT_STUCK_VERIFYING_INACTIVITY_THRESHOLD_MS);
    assert.equal(result.isStuck, true);
  });

  it("rejects an invalid explicit threshold override", () => {
    assert.throws(
      () => classifyStuckVerifying(baseRecord(), new Date(T0), Number.NaN),
      /explicit finite non-negative number/,
    );
    assert.throws(
      () => classifyStuckVerifying(baseRecord(), new Date(T0), -1),
      /explicit finite non-negative number/,
    );
  });

  it("classifies a newly verifying record as not stuck before 60 minutes of inactivity", () => {
    const result = classifyStuckVerifying(
      baseRecord(),
      new Date("2026-07-23T00:30:00.000Z"),
    );
    assert.equal(result.isStuck, false);
    assert.equal(result.elapsedMs, 30 * 60 * 1000);
    assert.equal(result.reasonCode, null);
    assert.equal(result.retryClassification, null);
    assert.equal(result.lastDurableActivityAt, T0);
  });

  it("is not stuck immediately before the 60-minute boundary", () => {
    const result = classifyStuckVerifying(
      baseRecord(),
      new Date("2026-07-23T00:59:59.999Z"),
    );
    assert.equal(result.isStuck, false);
    assert.equal(result.elapsedMs, HOUR_MS - 1);
    assert.equal(result.reasonCode, null);
  });

  it("is stuck exactly at 60 minutes (elapsed >= threshold)", () => {
    const result = classifyStuckVerifying(
      baseRecord(),
      new Date("2026-07-23T01:00:00.000Z"),
    );
    assert.equal(result.isStuck, true);
    assert.equal(result.elapsedMs, HOUR_MS);
    assert.equal(result.boundaryRule, "elapsed_gte_threshold");
    assert.equal(result.reasonCode, "STUCK_ATTEMPT_REQUIRES_RECONCILIATION");
    assert.equal(result.retryClassification, "operator_required");
    assert.equal(result.lastDurableActivityAt, T0);
  });

  it("remains stuck after 60 minutes", () => {
    const result = classifyStuckVerifying(
      baseRecord(),
      new Date("2026-07-23T01:00:00.001Z"),
    );
    assert.equal(result.isStuck, true);
    assert.equal(result.reasonCode, "STUCK_ATTEMPT_REQUIRES_RECONCILIATION");
    assert.equal(result.retryClassification, "operator_required");
  });

  it("uses updatedAt, not verifyingStartedAt, as the inactivity clock", () => {
    const verifyingStartedAt = "2026-07-23T00:00:00.000Z";
    const updatedAt = "2026-07-23T00:50:00.000Z";
    const record = baseRecord({ verifyingStartedAt, updatedAt });

    const recentlyActive = classifyStuckVerifying(
      record,
      new Date("2026-07-23T01:10:00.000Z"),
    );
    // 70m since verifyingStartedAt, but only 20m since updatedAt
    assert.equal(recentlyActive.isStuck, false);
    assert.equal(recentlyActive.elapsedMs, 20 * 60 * 1000);
    assert.equal(recentlyActive.lastDurableActivityAt, updatedAt);
    assert.equal(record.verifyingStartedAt, verifyingStartedAt);

    const laterStuck = classifyStuckVerifying(
      record,
      new Date("2026-07-23T01:50:00.000Z"),
    );
    assert.equal(laterStuck.isStuck, true);
    assert.equal(laterStuck.elapsedMs, HOUR_MS);
    assert.equal(laterStuck.lastDurableActivityAt, updatedAt);
    assert.equal(laterStuck.reasonCode, "STUCK_ATTEMPT_REQUIRES_RECONCILIATION");
    assert.equal(laterStuck.retryClassification, "operator_required");
  });

  it("appendAttemptEvidence advances updatedAt with the same nowIso and resets inactivity", async () => {
    const { clock, deps, fields } = evidenceHarness();
    const admitted = await admitVerification(fields, deps);
    const verifyingStartedAt = admitted.record.verifyingStartedAt;
    assert.equal(verifyingStartedAt, T0);

    // Nearly stuck relative to admission, then append durable evidence.
    clock.ms = Date.parse("2026-07-23T00:59:00.000Z");
    const afterAppend = await appendAttemptEvidence(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        event: { kind: "synthetic_progress", detail: { note: "heartbeat-proxy" } },
      },
      deps,
    );

    const appended = afterAppend.attemptEvidence[0]!.events.at(-1)!;
    assert.equal(appended.at, afterAppend.updatedAt);
    assert.equal(afterAppend.updatedAt, "2026-07-23T00:59:00.000Z");
    assert.equal(afterAppend.verifyingStartedAt, verifyingStartedAt);
    assert.notEqual(afterAppend.updatedAt, afterAppend.verifyingStartedAt);

    // Explicit event.at ?? now: caller-supplied at also stamps updatedAt.
    clock.ms = Date.parse("2026-07-23T01:05:00.000Z");
    const explicitAt = "2026-07-23T01:02:00.000Z";
    const withExplicitAt = await appendAttemptEvidence(
      {
        admissionKeyHash: afterAppend.admissionKeyHash,
        event: {
          at: explicitAt,
          kind: "synthetic_progress",
          detail: { note: "explicit-at" },
        },
      },
      deps,
    );
    const explicitEvent = withExplicitAt.attemptEvidence[0]!.events.at(-1)!;
    assert.equal(explicitEvent.at, explicitAt);
    assert.equal(withExplicitAt.updatedAt, explicitAt);
    assert.equal(withExplicitAt.verifyingStartedAt, verifyingStartedAt);

    // Unchanged verifyingStartedAt must not classify a recently active record as stuck.
    const soonAfterEvidence = classifyStuckVerifying(
      withExplicitAt,
      new Date("2026-07-23T01:30:00.000Z"),
    );
    assert.equal(soonAfterEvidence.isStuck, false);
    assert.equal(soonAfterEvidence.lastDurableActivityAt, explicitAt);
    assert.equal(soonAfterEvidence.elapsedMs, 28 * 60 * 1000);

    // Once advanced updatedAt itself is 60 minutes old, classify as stuck.
    const stuckLater = classifyStuckVerifying(
      withExplicitAt,
      new Date("2026-07-23T02:02:00.000Z"),
    );
    assert.equal(stuckLater.isStuck, true);
    assert.equal(stuckLater.lastDurableActivityAt, explicitAt);
    assert.equal(stuckLater.reasonCode, "STUCK_ATTEMPT_REQUIRES_RECONCILIATION");
    assert.equal(stuckLater.retryClassification, "operator_required");
  });

  it("repeated evaluation does not mutate state and appends no evidence", async () => {
    const { clock, deps, fields } = evidenceHarness();
    const admitted = await admitVerification(fields, deps);
    const before = structuredClone(admitted.record);
    const beforeStore = await getVerificationRecord(fields, deps.store);

    clock.ms = Date.parse("2026-07-23T02:00:00.000Z");
    const first = classifyStuckVerifying(admitted.record, new Date(clock.ms));
    const second = classifyStuckVerifying(admitted.record, new Date(clock.ms));
    assert.equal(first.isStuck, true);
    assert.deepEqual(first, second);
    assert.deepEqual(admitted.record, before);

    const afterStore = await getVerificationRecord(fields, deps.store);
    assert.deepEqual(afterStore, beforeStore);
    assert.equal(afterStore!.attemptEvidence[0]!.events.length, before.attemptEvidence[0]!.events.length);
    assert.equal(afterStore!.updatedAt, before.updatedAt);
    assert.equal(afterStore!.state, "verifying");
  });

  it("terminal attempts are not classified as stuck", () => {
    for (const state of ["verified", "rejected", "failed"] as const) {
      const record = baseRecord({
        state,
        activeAttemptId: null,
        terminalAt: "2026-07-23T00:00:00.500Z",
        attemptEvidence: [
          {
            attemptId: "pva_1",
            attemptNumber: 1,
            state,
            verifyingStartedAt: T0,
            terminalAt: "2026-07-23T00:00:00.500Z",
            events: [],
          },
        ],
      });
      const result = classifyStuckVerifying(
        record,
        new Date("2026-07-23T02:00:00.000Z"),
      );
      assert.equal(result.isStuck, false);
      assert.equal(result.activeAttemptId, null);
      assert.equal(result.reasonCode, null);
      assert.equal(result.retryClassification, null);
      assert.equal(result.lastDurableActivityAt, null);
    }
  });
});
