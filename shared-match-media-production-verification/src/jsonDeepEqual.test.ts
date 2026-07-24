import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { jsonDeepEqual } from "./jsonDeepEqual.ts";
import type {
  AttemptEvidenceEvent,
  ProductionVerificationRecord,
  VerificationAttemptEvidence,
} from "./verificationTypes.ts";

describe("jsonDeepEqual", () => {
  it("treats equal objects with different key insertion order as equal", () => {
    const a = { attemptId: "pva_1", attemptNumber: 1, state: "verifying" };
    const b = { state: "verifying", attemptNumber: 1, attemptId: "pva_1" };
    assert.equal(jsonDeepEqual(a, b), true);
  });

  it("rejects unequal scalar values", () => {
    assert.equal(jsonDeepEqual("verified", "failed"), false);
    assert.equal(jsonDeepEqual(1, 2), false);
    assert.equal(jsonDeepEqual(true, false), false);
    assert.equal(jsonDeepEqual(null, "null"), false);
  });

  it("compares nested objects deeply", () => {
    const left = {
      attempt: {
        events: [{ kind: "attempt_started", detail: { source: "admission" } }],
      },
    };
    const right = {
      attempt: {
        events: [{ detail: { source: "admission" }, kind: "attempt_started" }],
      },
    };
    assert.equal(jsonDeepEqual(left, right), true);
    assert.equal(
      jsonDeepEqual(left, {
        attempt: {
          events: [{ kind: "attempt_started", detail: { source: "other" } }],
        },
      }),
      false,
    );
  });

  it("preserves exact array ordering", () => {
    assert.equal(jsonDeepEqual(["a", "b"], ["a", "b"]), true);
    assert.equal(jsonDeepEqual(["a", "b"], ["b", "a"]), false);
    assert.equal(
      jsonDeepEqual(
        [{ eventId: "1" }, { eventId: "2" }],
        [{ eventId: "2" }, { eventId: "1" }],
      ),
      false,
    );
  });

  it("distinguishes missing versus present fields", () => {
    assert.equal(jsonDeepEqual({ a: 1 }, { a: 1, b: null }), false);
    assert.equal(jsonDeepEqual({ a: 1, b: null }, { a: 1, b: null }), true);
    assert.equal(jsonDeepEqual({ detail: undefined }, {}), false);
    assert.equal(jsonDeepEqual({ detail: null }, { detail: null }), true);
  });

  it("matches admission attempt-evidence and record structures", () => {
    const eventA: AttemptEvidenceEvent = {
      eventId: "pva_1:start",
      at: "2026-07-23T00:00:00.000Z",
      kind: "attempt_started",
      detail: { source: "admission" },
    };
    const eventB: AttemptEvidenceEvent = {
      kind: "attempt_started",
      detail: { source: "admission" },
      at: "2026-07-23T00:00:00.000Z",
      eventId: "pva_1:start",
    };
    assert.equal(jsonDeepEqual(eventA, eventB), true);

    const attemptA: VerificationAttemptEvidence = {
      attemptId: "pva_1",
      attemptNumber: 1,
      state: "verifying",
      verifyingStartedAt: "2026-07-23T00:00:00.000Z",
      events: [eventA],
    };
    const attemptB: VerificationAttemptEvidence = {
      events: [eventB],
      verifyingStartedAt: "2026-07-23T00:00:00.000Z",
      state: "verifying",
      attemptNumber: 1,
      attemptId: "pva_1",
    };
    assert.equal(jsonDeepEqual(attemptA, attemptB), true);

    const recordBase: ProductionVerificationRecord = {
      schemaVersion: 1,
      verificationRecordId: "pvr_1",
      contractVersion: "shared-match-media-production-verification-design-v1",
      matchMediaAssetId: "mma_1",
      objectVersion: "ov_1",
      storageBucketBinding: "MEDIA",
      storageObjectKey: "match-media/assets/mma_1/original",
      admissionKey: "key",
      admissionKeyHash: "hash",
      state: "verifying",
      attemptNumber: 1,
      activeAttemptId: "pva_1",
      admittedAt: "2026-07-23T00:00:00.000Z",
      verifyingStartedAt: "2026-07-23T00:00:00.000Z",
      terminalAt: null,
      terminalReasonCode: null,
      retryClassification: null,
      nextRetryEligibleAt: null,
      evidenceReferences: [],
      attemptEvidence: [attemptA],
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z",
    };
    const recordReordered: ProductionVerificationRecord = {
      ...recordBase,
      attemptEvidence: [attemptB],
      updatedAt: recordBase.updatedAt,
      createdAt: recordBase.createdAt,
    };
    assert.equal(jsonDeepEqual(recordBase, recordReordered), true);

    const withDeclared: ProductionVerificationRecord = {
      ...recordBase,
      declaredByteCount: 12,
    };
    assert.equal(jsonDeepEqual(recordBase, withDeclared), false);
  });
});
