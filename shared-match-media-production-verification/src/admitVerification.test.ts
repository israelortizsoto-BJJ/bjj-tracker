import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FORBIDDEN_REPLACE_ATTEMPT_HISTORY,
  admitVerification,
  appendAttemptEvidence,
  assertAppendOnlyEvidencePrefix,
  getVerificationRecord,
  transitionVerificationTerminal,
  type TerminalTransitionInput,
  type VerificationAdmissionDependencies,
} from "./admitVerification.ts";
import { createConditionalObjectVerificationRecordStore } from "./conditionalObjectVerificationRecordStore.ts";
import type { ConditionalObjectStore } from "./conditionalObjectStore.ts";
import { createSyntheticConditionalObjectStore } from "./syntheticConditionalObjectStore.ts";
import { classifyStuckVerifying } from "./stuckAttempt.ts";
import type { ImmutableAdmissionFields } from "./admissionIdentity.ts";
import { VerificationDomainError } from "./verificationTypes.ts";
import type { VerificationRecordStore } from "./verificationRecordStore.ts";

/**
 * Test-only CAS probe: counts compareAndSwap attempts/successes without altering
 * store semantics. Used to prove rejected terminal mutations never write.
 */
function createCasProbe(store: VerificationRecordStore): {
  store: VerificationRecordStore;
  snapshot: () => { attempts: number; successes: number };
} {
  let attempts = 0;
  let successes = 0;
  return {
    store: {
      get: (key) => store.get(key),
      putIfAbsent: (key, value) => store.putIfAbsent(key, value),
      getVersioned: (key) => store.getVersioned(key),
      compareAndSwap: async (key, version, value) => {
        attempts += 1;
        const ok = await store.compareAndSwap(key, version, value);
        if (ok) successes += 1;
        return ok;
      },
    },
    snapshot: () => ({ attempts, successes }),
  };
}

const fields: ImmutableAdmissionFields = {
  contractVersion: "shared-match-media-production-verification-design-v1",
  storageBucketBinding: "MEDIA",
  matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
  objectVersion: "object-version-1",
  storageObjectKey: "match-media/assets/mma_11111111-2222-4333-8444-555555555555/original",
};

/**
 * Test-only race barrier over a shared ConditionalObjectStore.
 *
 * Forces ≥`minRacers` adapters to observe the key as absent and independently
 * reach etagDoesNotMatch:"*" put before any conditional create is applied.
 * The barrier coordinates the missing-key race only; each create still races
 * through the backend's onlyIf check-and-set (no put mutex / admission queue).
 */
function createMissingKeyCreateRaceBackend(
  backend: ConditionalObjectStore,
  minRacers: number,
): {
  objects: ConditionalObjectStore;
  stats: () => {
    absentObservers: number;
    conditionalCreateAttempts: number;
    conditionalCreateSuccesses: number;
    conditionalCreateRejections: number;
  };
} {
  let absentObservers = 0;
  let releaseAbsentObservers!: () => void;
  const absentObserversReady = new Promise<void>((resolve) => {
    releaseAbsentObservers = resolve;
  });

  let createArrivals = 0;
  let releaseCreateArrivals!: () => void;
  const createArrivalsReady = new Promise<void>((resolve) => {
    releaseCreateArrivals = resolve;
  });

  let conditionalCreateAttempts = 0;
  let conditionalCreateSuccesses = 0;
  let conditionalCreateRejections = 0;

  const objects: ConditionalObjectStore = {
    get: async (key) => {
      const result = await backend.get(key);
      if (result === null) {
        absentObservers += 1;
        if (absentObservers === minRacers) {
          releaseAbsentObservers();
        }
        await absentObserversReady;
      }
      return result;
    },
    put: async (key, value, options) => {
      const isConditionalCreate = "etagDoesNotMatch" in options.onlyIf;
      if (!isConditionalCreate) {
        return backend.put(key, value, options);
      }

      conditionalCreateAttempts += 1;
      createArrivals += 1;
      if (createArrivals === minRacers) {
        releaseCreateArrivals();
      }
      await createArrivalsReady;

      const result = await backend.put(key, value, options);
      if (result) {
        conditionalCreateSuccesses += 1;
      } else {
        conditionalCreateRejections += 1;
      }
      return result;
    },
  };

  return {
    objects,
    stats: () => ({
      absentObservers,
      conditionalCreateAttempts,
      conditionalCreateSuccesses,
      conditionalCreateRejections,
    }),
  };
}

/**
 * Test-only race barrier over a shared ConditionalObjectStore for CAS updates.
 *
 * Forces ≥`minRacers` adapters to observe the same non-absent version and
 * independently reach etagMatches CAS before any conditional swap is applied.
 * Coordinates the stale-proposal race only; each swap still races through the
 * backend's onlyIf check-and-set (no put mutex / admission queue).
 */
function createSameEtagCasRaceBackend(
  backend: ConditionalObjectStore,
  minRacers: number,
): {
  objects: ConditionalObjectStore;
  stats: () => {
    versionedObservers: number;
    casAttempts: number;
    casSuccesses: number;
    casRejections: number;
  };
} {
  let versionedObservers = 0;
  let releaseVersionedObservers!: () => void;
  const versionedObserversReady = new Promise<void>((resolve) => {
    releaseVersionedObservers = resolve;
  });

  let casArrivals = 0;
  let releaseCasArrivals!: () => void;
  const casArrivalsReady = new Promise<void>((resolve) => {
    releaseCasArrivals = resolve;
  });

  let casAttempts = 0;
  let casSuccesses = 0;
  let casRejections = 0;

  const objects: ConditionalObjectStore = {
    get: async (key) => {
      const result = await backend.get(key);
      if (result !== null) {
        versionedObservers += 1;
        if (versionedObservers === minRacers) {
          releaseVersionedObservers();
        }
        await versionedObserversReady;
      }
      return result;
    },
    put: async (key, value, options) => {
      const isCas = "etagMatches" in options.onlyIf;
      if (!isCas) {
        return backend.put(key, value, options);
      }

      casAttempts += 1;
      casArrivals += 1;
      if (casArrivals === minRacers) {
        releaseCasArrivals();
      }
      await casArrivalsReady;

      const result = await backend.put(key, value, options);
      if (result) {
        casSuccesses += 1;
      } else {
        casRejections += 1;
      }
      return result;
    },
  };

  return {
    objects,
    stats: () => ({
      versionedObservers,
      casAttempts,
      casSuccesses,
      casRejections,
    }),
  };
}

function harness(options: { maxAutomaticAttempts?: number } = {}): {
  backend: ReturnType<typeof createSyntheticConditionalObjectStore>;
  store: VerificationRecordStore;
  clock: { ms: number };
  deps: VerificationAdmissionDependencies;
  makeDeps: (
    overrides?: Partial<VerificationAdmissionDependencies>,
  ) => VerificationAdmissionDependencies;
} {
  const backend = createSyntheticConditionalObjectStore();
  const store = createConditionalObjectVerificationRecordStore(backend);
  const clock = { ms: Date.parse("2026-07-23T12:00:00.000Z") };
  let seq = 0;
  const makeDeps = (
    overrides: Partial<VerificationAdmissionDependencies> = {},
  ): VerificationAdmissionDependencies => ({
    store,
    now: () => new Date(clock.ms),
    randomId: () => {
      seq += 1;
      return `id-${seq.toString().padStart(4, "0")}`;
    },
    maxAutomaticAttempts: options.maxAutomaticAttempts,
    ...overrides,
  });
  return { backend, store, clock, deps: makeDeps(), makeDeps };
}

async function failRetryable(
  deps: VerificationAdmissionDependencies,
  admissionKeyHash: string,
): Promise<void> {
  await transitionVerificationTerminal(
    {
      admissionKeyHash,
      targetState: "failed",
      terminalReasonCode: "STORAGE_READ_TRANSIENT",
      retryClassification: "retryable",
    },
    deps,
  );
}

async function failNonRetryable(
  deps: VerificationAdmissionDependencies,
  admissionKeyHash: string,
): Promise<void> {
  await transitionVerificationTerminal(
    {
      admissionKeyHash,
      targetState: "failed",
      terminalReasonCode: "OBJECT_NOT_FOUND_AFTER_COMPLETION",
      retryClassification: "non_retryable",
    },
    deps,
  );
}

describe("idempotent admission via R2-shaped ETag adapter", () => {
  it("first admission produces one durable record and one active attempt", async () => {
    const { backend, deps } = harness();
    const result = await admitVerification(fields, deps);
    assert.equal(result.outcome, "created");
    assert.equal(result.record.state, "verifying");
    assert.equal(result.record.attemptEvidence.length, 1);
    assert.equal(result.record.attemptEvidence[0]?.events[0]?.kind, "attempt_started");
    assert.equal(backend._inspect().size, 1);
  });

  it("identical repeated admission converges without duplicate record or start evidence", async () => {
    const { backend, deps } = harness();
    const first = await admitVerification(fields, deps);
    const second = await admitVerification(fields, deps);
    assert.equal(second.outcome, "idempotent");
    assert.equal(second.record.admissionKeyHash, first.record.admissionKeyHash);
    assert.equal(second.record.verificationRecordId, first.record.verificationRecordId);
    assert.equal(second.record.activeAttemptId, first.record.activeAttemptId);
    assert.equal(second.record.attemptEvidence[0]?.events.length, 1);
    assert.equal(backend._inspect().size, 1);
  });
});

describe("durable CAS across separate store instances", () => {
  it("simultaneous identical admissions through separate adapters converge on one record", async () => {
    const backend = createSyntheticConditionalObjectStore();
    // Barrier forces ≥2 adapters past absent observe + putIfAbsent arrival together.
    // Convergence must still come from onlyIf, not from this coordination.
    const racing = createMissingKeyCreateRaceBackend(backend, 2);
    const sharedClock = { ms: Date.parse("2026-07-23T12:00:00.000Z") };
    let seq = 0;

    // Separate VerificationRecordStore instances share one conditional-object backend.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => {
        const store = createConditionalObjectVerificationRecordStore(racing.objects);
        const deps: VerificationAdmissionDependencies = {
          store,
          now: () => new Date(sharedClock.ms),
          randomId: () => {
            seq += 1;
            return `concurrent-${seq}`;
          },
        };
        return admitVerification(fields, deps);
      }),
    );

    const stats = racing.stats();
    assert.ok(stats.absentObservers >= 2);
    assert.ok(stats.conditionalCreateAttempts >= 2);
    assert.equal(stats.conditionalCreateSuccesses, 1);
    assert.ok(stats.conditionalCreateRejections >= 1);
    assert.equal(
      stats.conditionalCreateSuccesses + stats.conditionalCreateRejections,
      stats.conditionalCreateAttempts,
    );

    const created = results.filter((result) => result.outcome === "created");
    const idempotent = results.filter((result) => result.outcome === "idempotent");
    assert.equal(created.length, 1);
    assert.equal(idempotent.length, 7);

    const hashes = new Set(results.map((result) => result.record.admissionKeyHash));
    const recordIds = new Set(results.map((result) => result.record.verificationRecordId));
    const activeIds = new Set(results.map((result) => result.record.activeAttemptId));
    assert.equal(hashes.size, 1);
    assert.equal(recordIds.size, 1);
    assert.equal(activeIds.size, 1);

    const observer = createConditionalObjectVerificationRecordStore(backend);
    const loaded = await getVerificationRecord(fields, observer);
    assert.ok(loaded);
    assert.equal(loaded.attemptEvidence.length, 1);
    assert.equal(
      loaded.attemptEvidence[0]?.events.filter((event) => event.kind === "attempt_started")
        .length,
      1,
    );
    assert.equal(backend._inspect().size, 1);
  });

  it("rejects stale ETag versions at the conditional-object boundary", async () => {
    const backend = createSyntheticConditionalObjectStore();
    const storeA = createConditionalObjectVerificationRecordStore(backend);
    const storeB = createConditionalObjectVerificationRecordStore(backend);

    const created = await storeA.putIfAbsent("k", JSON.stringify({ n: 1 }));
    assert.equal(created, true);
    const versioned = await storeA.getVersioned("k");
    assert.ok(versioned);

    const firstSwap = await storeA.compareAndSwap(
      "k",
      versioned.version,
      JSON.stringify({ n: 2 }),
    );
    assert.equal(firstSwap, true);

    // storeB still holds the stale etag from before storeA's successful swap.
    const staleRejected = await storeB.compareAndSwap(
      "k",
      versioned.version,
      JSON.stringify({ n: 3 }),
    );
    assert.equal(staleRejected, false);

    const current = await storeB.getVersioned("k");
    assert.ok(current);
    assert.notEqual(current.version, versioned.version);
    assert.deepEqual(JSON.parse(current.value), { n: 2 });

    const absentRejected = await storeA.putIfAbsent("k", JSON.stringify({ n: 9 }));
    assert.equal(absentRejected, false);
  });

  it("re-instantiating the adapter against shared persistence observes the existing record", async () => {
    const backend = createSyntheticConditionalObjectStore();
    const firstStore = createConditionalObjectVerificationRecordStore(backend);
    const firstDeps: VerificationAdmissionDependencies = {
      store: firstStore,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "reinst-1",
    };
    const created = await admitVerification(fields, firstDeps);
    assert.equal(created.outcome, "created");

    const secondStore = createConditionalObjectVerificationRecordStore(backend);
    const loaded = await getVerificationRecord(fields, secondStore);
    assert.ok(loaded);
    assert.equal(loaded.verificationRecordId, created.record.verificationRecordId);
    assert.equal(loaded.admissionKeyHash, created.record.admissionKeyHash);
    assert.equal(loaded.attemptEvidence.length, 1);

    const secondDeps: VerificationAdmissionDependencies = {
      store: secondStore,
      now: () => new Date("2026-07-23T12:00:01.000Z"),
      randomId: () => "reinst-2",
    };
    const replay = await admitVerification(fields, secondDeps);
    assert.equal(replay.outcome, "idempotent");
    assert.equal(replay.record.verificationRecordId, created.record.verificationRecordId);
    assert.equal(backend._inspect().size, 1);
  });
});

describe("append-only attempt evidence", () => {
  it("later evidence is appended and earlier evidence remains intact", async () => {
    const { deps } = harness();
    const admitted = await admitVerification(fields, deps);
    const firstEvent = structuredClone(admitted.record.attemptEvidence[0]!.events[0]!);

    const after = await appendAttemptEvidence(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        event: { kind: "synthetic_progress", detail: { note: "local-only" } },
      },
      deps,
    );

    assert.equal(after.attemptEvidence[0]!.events.length, 2);
    assert.deepEqual(after.attemptEvidence[0]!.events[0], firstEvent);
    assert.equal(after.attemptEvidence[0]!.events[1]?.kind, "synthetic_progress");
    assert.equal(FORBIDDEN_REPLACE_ATTEMPT_HISTORY, undefined);
  });

  it("valid later evidence preserves the complete earlier prefix and succeeds", async () => {
    const { deps } = harness();
    const admitted = await admitVerification(fields, deps);
    const priorEvents = structuredClone(admitted.record.attemptEvidence[0]!.events);

    const after = await appendAttemptEvidence(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        event: { kind: "prefix_preserving_progress", detail: { seq: 2 } },
      },
      deps,
    );

    const afterEvents = after.attemptEvidence[0]!.events;
    assert.equal(afterEvents.length, priorEvents.length + 1);
    assert.deepEqual(afterEvents.slice(0, priorEvents.length), priorEvents);
    assert.equal(afterEvents[priorEvents.length]?.kind, "prefix_preserving_progress");
    assert.doesNotThrow(() =>
      assertAppendOnlyEvidencePrefix(admitted.record, after),
    );
  });

  it("same-version evidence removal is rejected", async () => {
    const { deps } = harness();
    const admitted = await admitVerification(fields, deps);
    const prior = await appendAttemptEvidence(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        event: { kind: "keep_me", detail: { seq: 2 } },
      },
      deps,
    );
    const proposed = {
      ...prior,
      attemptEvidence: [
        {
          ...prior.attemptEvidence[0]!,
          events: prior.attemptEvidence[0]!.events.slice(0, 1),
        },
      ],
    };

    assert.throws(
      () => assertAppendOnlyEvidencePrefix(prior, proposed),
      (error: unknown) =>
        error instanceof VerificationDomainError &&
        error.code === "APPEND_ONLY_VIOLATION",
    );
  });

  it("same-version evidence replacement is rejected", async () => {
    const { deps } = harness();
    const admitted = await admitVerification(fields, deps);
    const prior = await appendAttemptEvidence(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        event: { kind: "original_evidence", detail: { seq: 2 } },
      },
      deps,
    );
    const proposed = {
      ...prior,
      attemptEvidence: [
        {
          ...prior.attemptEvidence[0]!,
          events: [
            prior.attemptEvidence[0]!.events[0]!,
            {
              ...prior.attemptEvidence[0]!.events[1]!,
              kind: "replaced_evidence",
              detail: { seq: 2, altered: true },
            },
          ],
        },
      ],
    };

    assert.throws(
      () => assertAppendOnlyEvidencePrefix(prior, proposed),
      (error: unknown) =>
        error instanceof VerificationDomainError &&
        error.code === "APPEND_ONLY_VIOLATION",
    );
  });

  it("same-version evidence reordering is rejected", async () => {
    const { deps } = harness();
    const admitted = await admitVerification(fields, deps);
    const prior = await appendAttemptEvidence(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        event: { kind: "second_evidence", detail: { seq: 2 } },
      },
      deps,
    );
    const events = prior.attemptEvidence[0]!.events;
    const proposed = {
      ...prior,
      attemptEvidence: [
        {
          ...prior.attemptEvidence[0]!,
          events: [events[1]!, events[0]!],
        },
      ],
    };

    assert.throws(
      () => assertAppendOnlyEvidencePrefix(prior, proposed),
      (error: unknown) =>
        error instanceof VerificationDomainError &&
        error.code === "APPEND_ONLY_VIOLATION",
    );
  });

  it("forced CAS conflict during one appendAttemptEvidence rereads and appends exactly once", async () => {
    const { store, makeDeps } = harness();
    let casCalls = 0;
    const conflictStore: VerificationRecordStore = {
      get: (key) => store.get(key),
      putIfAbsent: (key, value) => store.putIfAbsent(key, value),
      getVersioned: (key) => store.getVersioned(key),
      compareAndSwap: async (key, version, value) => {
        casCalls += 1;
        if (casCalls === 1) {
          return false;
        }
        return store.compareAndSwap(key, version, value);
      },
    };
    const deps = makeDeps({ store: conflictStore });
    const admitted = await admitVerification(fields, deps);
    const priorEvents = structuredClone(admitted.record.attemptEvidence[0]!.events);

    const after = await appendAttemptEvidence(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        event: {
          eventId: "once-only-event",
          kind: "conflict_retry_progress",
          detail: { seq: 2 },
        },
      },
      deps,
    );

    assert.ok(casCalls >= 2);
    const events = after.attemptEvidence[0]!.events;
    assert.equal(events.length, priorEvents.length + 1);
    assert.deepEqual(events.slice(0, priorEvents.length), priorEvents);
    assert.equal(
      events.filter((event) => event.eventId === "once-only-event").length,
      1,
    );
    assert.equal(
      events.filter((event) => event.kind === "conflict_retry_progress").length,
      1,
    );
  });

  it("terminal evidence cannot be rewritten through ordinary admission", async () => {
    const { deps } = harness();
    const admitted = await admitVerification(fields, deps);
    const terminal = await transitionVerificationTerminal(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        targetState: "verified",
      },
      deps,
    );
    const terminalEvents = structuredClone(terminal.attemptEvidence[0]!.events);

    const replay = await admitVerification(fields, deps);
    assert.equal(replay.outcome, "idempotent");
    assert.equal(replay.record.state, "verified");
    assert.deepEqual(replay.record.attemptEvidence[0]!.events, terminalEvents);
  });

  it("stale adapter CAS cannot erase newer append-only evidence", async () => {
    const backend = createSyntheticConditionalObjectStore();
    const storeA = createConditionalObjectVerificationRecordStore(backend);
    const storeB = createConditionalObjectVerificationRecordStore(backend);
    const depsA: VerificationAdmissionDependencies = {
      store: storeA,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "stale-a",
    };
    const admitted = await admitVerification(fields, depsA);
    const key = `production-verification/records/${admitted.record.admissionKeyHash}.json`;
    const staleVersioned = await storeB.getVersioned(key);
    assert.ok(staleVersioned);

    await appendAttemptEvidence(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        event: { kind: "newer_evidence", detail: { seq: 2 } },
      },
      depsA,
    );

    const staleBody = JSON.parse(staleVersioned.value) as {
      attemptEvidence: Array<{ events: unknown[] }>;
    };
    assert.equal(staleBody.attemptEvidence[0]!.events.length, 1);
    // Stale writer proposes a body that would erase the newer evidence entry.
    const erased = await storeB.compareAndSwap(
      key,
      staleVersioned.version,
      JSON.stringify({
        ...staleBody,
        attemptEvidence: [
          {
            ...staleBody.attemptEvidence[0],
            events: [],
          },
        ],
      }),
    );
    assert.equal(erased, false);

    const current = await getVerificationRecord(fields, storeA);
    assert.ok(current);
    assert.equal(current.attemptEvidence[0]!.events.length, 2);
    assert.equal(current.attemptEvidence[0]!.events[1]?.kind, "newer_evidence");
  });
});

describe("terminal-state protection", () => {
  for (const target of [
    { targetState: "verified" as const, terminalReasonCode: undefined },
    {
      targetState: "rejected" as const,
      terminalReasonCode: "BYTE_COUNT_MISMATCH" as const,
    },
    {
      targetState: "failed" as const,
      terminalReasonCode: "OBJECT_NOT_FOUND_AFTER_COMPLETION" as const,
    },
  ]) {
    it(`${target.targetState} cannot be silently reopened or overwritten by admission`, async () => {
      const { deps } = harness();
      const admitted = await admitVerification(fields, deps);
      await transitionVerificationTerminal(
        {
          admissionKeyHash: admitted.record.admissionKeyHash,
          targetState: target.targetState,
          terminalReasonCode: target.terminalReasonCode,
        },
        deps,
      );

      const replay = await admitVerification(fields, deps);
      assert.equal(replay.outcome, "idempotent");
      assert.equal(replay.record.state, target.targetState);
      assert.equal(replay.record.activeAttemptId, null);
      assert.equal(replay.record.attemptEvidence.length, 1);

      await assert.rejects(
        () =>
          transitionVerificationTerminal(
            {
              admissionKeyHash: admitted.record.admissionKeyHash,
              targetState: "verified",
            },
            deps,
          ),
        (error: unknown) =>
          error instanceof VerificationDomainError && error.code === "TERMINAL_IMMUTABLE",
      );
    });
  }

  for (const target of [
    {
      targetState: "verified" as const,
      terminalReasonCode: undefined,
      alteredTerminalizations: [
        {
          targetState: "rejected" as const,
          terminalReasonCode: "SHA256_MISMATCH" as const,
        },
        {
          targetState: "failed" as const,
          terminalReasonCode: "OBJECT_VERSION_MISMATCH" as const,
        },
        {
          targetState: "verified" as const,
          observedByteCount: 9999,
          observedMimeType: "application/altered",
          calculatedSha256: "deadbeefalteredsha256",
          eventDetail: { note: "altered-verified-payload" },
        },
      ] satisfies ReadonlyArray<
        Omit<TerminalTransitionInput, "admissionKeyHash">
      >,
    },
    {
      targetState: "rejected" as const,
      terminalReasonCode: "BYTE_COUNT_MISMATCH" as const,
      alteredTerminalizations: [
        { targetState: "verified" as const },
        {
          targetState: "failed" as const,
          terminalReasonCode: "OBJECT_NOT_FOUND_AFTER_COMPLETION" as const,
        },
        {
          targetState: "rejected" as const,
          terminalReasonCode: "SHA256_MISMATCH" as const,
        },
        {
          targetState: "rejected" as const,
          terminalReasonCode: "BYTE_COUNT_MISMATCH" as const,
          observedByteCount: 9999,
          observedMimeType: "application/altered",
          calculatedSha256: "deadbeefalteredsha256",
          eventDetail: { note: "altered-rejected-payload" },
        },
      ] satisfies ReadonlyArray<
        Omit<TerminalTransitionInput, "admissionKeyHash">
      >,
    },
    {
      targetState: "failed" as const,
      terminalReasonCode: "OBJECT_NOT_FOUND_AFTER_COMPLETION" as const,
      alteredTerminalizations: [
        { targetState: "verified" as const },
        {
          targetState: "rejected" as const,
          terminalReasonCode: "MIME_NOT_ALLOWED" as const,
        },
        {
          targetState: "failed" as const,
          terminalReasonCode: "OBJECT_VERSION_MISMATCH" as const,
        },
        {
          targetState: "failed" as const,
          terminalReasonCode: "OBJECT_NOT_FOUND_AFTER_COMPLETION" as const,
          observedByteCount: 9999,
          observedMimeType: "application/altered",
          calculatedSha256: "deadbeefalteredsha256",
          eventDetail: { note: "altered-failed-payload" },
        },
      ] satisfies ReadonlyArray<
        Omit<TerminalTransitionInput, "admissionKeyHash">
      >,
    },
  ]) {
    it(`${target.targetState}: append and altered re-terminalization stay TERMINAL_IMMUTABLE without CAS writes`, async () => {
      const { store, makeDeps } = harness();
      const probe = createCasProbe(store);
      const deps = makeDeps({ store: probe.store });

      const admitted = await admitVerification(fields, deps);
      await transitionVerificationTerminal(
        {
          admissionKeyHash: admitted.record.admissionKeyHash,
          targetState: target.targetState,
          terminalReasonCode: target.terminalReasonCode,
          observedByteCount: 1024,
          observedMimeType: "video/mp4",
          calculatedSha256: "original-terminal-sha256",
          eventDetail: { note: "original-terminal" },
        },
        deps,
      );

      const authoritative = await getVerificationRecord(fields, probe.store);
      assert.ok(authoritative);
      assert.equal(authoritative.state, target.targetState);
      const beforeRecord = structuredClone(authoritative);
      const casBefore = probe.snapshot();

      await assert.rejects(
        () =>
          appendAttemptEvidence(
            {
              admissionKeyHash: admitted.record.admissionKeyHash,
              event: {
                kind: "post_terminal_evidence",
                detail: { note: "must-not-persist" },
              },
            },
            deps,
          ),
        (error: unknown) =>
          error instanceof VerificationDomainError &&
          error.code === "TERMINAL_IMMUTABLE",
      );

      const afterAppend = await getVerificationRecord(fields, probe.store);
      assert.ok(afterAppend);
      assert.deepEqual(afterAppend, beforeRecord);
      assert.deepEqual(probe.snapshot(), casBefore);

      for (const altered of target.alteredTerminalizations) {
        await assert.rejects(
          () =>
            transitionVerificationTerminal(
              {
                admissionKeyHash: admitted.record.admissionKeyHash,
                ...altered,
              },
              deps,
            ),
          (error: unknown) =>
            error instanceof VerificationDomainError &&
            error.code === "TERMINAL_IMMUTABLE",
        );

        const afterAltered = await getVerificationRecord(fields, probe.store);
        assert.ok(afterAltered);
        assert.deepEqual(afterAltered, beforeRecord);
        assert.deepEqual(probe.snapshot(), casBefore);
      }
    });
  }

  it("retryable failed may re-admit a new attempt when budget is explicitly supplied", async () => {
    // Certified language (Contract §5 / §6):
    // - "failed --> verifying: retryable re-admit new attempt"
    // - "failed(retryable) → verifying" with CAS + new attemptEvidence entry
    // - "Retryable `failed` exists | May create a new attempt via CAS transition back to `verifying`"
    const { clock, makeDeps } = harness({ maxAutomaticAttempts: 3 });
    const deps = makeDeps();
    const admitted = await admitVerification(fields, deps);
    await transitionVerificationTerminal(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        targetState: "failed",
        terminalReasonCode: "STORAGE_READ_TRANSIENT",
        retryClassification: "retryable",
      },
      deps,
    );

    clock.ms += 1_000;
    const reAdmitted = await admitVerification(fields, deps);
    assert.equal(reAdmitted.outcome, "re_admitted");
    assert.equal(reAdmitted.record.state, "verifying");
    assert.equal(reAdmitted.record.attemptNumber, 2);
    assert.equal(reAdmitted.record.attemptEvidence.length, 2);
    assert.equal(reAdmitted.record.attemptEvidence[0]?.state, "failed");
    assert.equal(reAdmitted.record.attemptEvidence[1]?.state, "verifying");
  });

  it("retryable failed does not invent a retry budget when maxAutomaticAttempts is omitted", async () => {
    const { deps } = harness();
    const admitted = await admitVerification(fields, deps);
    await transitionVerificationTerminal(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        targetState: "failed",
        terminalReasonCode: "STORAGE_READ_TRANSIENT",
        retryClassification: "retryable",
      },
      deps,
    );
    const replay = await admitVerification(fields, deps);
    assert.equal(replay.outcome, "idempotent");
    assert.equal(replay.record.state, "failed");
    assert.equal(replay.record.attemptEvidence.length, 1);
  });

  it("stale writers cannot overwrite terminal outcomes", async () => {
    const backend = createSyntheticConditionalObjectStore();
    const storeA = createConditionalObjectVerificationRecordStore(backend);
    const storeB = createConditionalObjectVerificationRecordStore(backend);
    const depsA: VerificationAdmissionDependencies = {
      store: storeA,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "term-a",
    };
    const admitted = await admitVerification(fields, depsA);
    const key = `production-verification/records/${admitted.record.admissionKeyHash}.json`;
    const staleVersioned = await storeB.getVersioned(key);
    assert.ok(staleVersioned);

    await transitionVerificationTerminal(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        targetState: "rejected",
        terminalReasonCode: "SHA256_MISMATCH",
      },
      depsA,
    );

    const staleOverwrite = await storeB.compareAndSwap(
      key,
      staleVersioned.version,
      JSON.stringify({
        ...JSON.parse(staleVersioned.value),
        state: "verifying",
        terminalAt: null,
        terminalReasonCode: null,
      }),
    );
    assert.equal(staleOverwrite, false);

    const current = await getVerificationRecord(fields, storeA);
    assert.ok(current);
    assert.equal(current.state, "rejected");
    assert.equal(current.terminalReasonCode, "SHA256_MISMATCH");
    assert.equal(current.activeAttemptId, null);
  });
});

describe("retryable failed re-admission", () => {
  for (const invalidBudget of [
    { label: "0", value: 0 },
    { label: "negative", value: -1 },
    { label: "fractional", value: 1.5 },
    { label: "NaN", value: Number.NaN },
    { label: "non-integer", value: Number.POSITIVE_INFINITY },
    { label: "non-number", value: "3" as unknown as number },
  ]) {
    it(`invalid supplied maxAutomaticAttempts (${invalidBudget.label}) throws INVALID_ADMISSION_INPUT`, async () => {
      const { store, makeDeps } = harness();
      const setup = makeDeps();
      const admitted = await admitVerification(fields, setup);
      await failRetryable(setup, admitted.record.admissionKeyHash);
      const before = structuredClone(
        (await getVerificationRecord(fields, store))!,
      );
      const probe = createCasProbe(store);
      const casBefore = probe.snapshot();

      await assert.rejects(
        () =>
          admitVerification(
            fields,
            makeDeps({
              store: probe.store,
              maxAutomaticAttempts: invalidBudget.value,
            }),
          ),
        (error: unknown) =>
          error instanceof VerificationDomainError &&
          error.code === "INVALID_ADMISSION_INPUT",
      );

      const after = await getVerificationRecord(fields, store);
      assert.ok(after);
      assert.deepEqual(after, before);
      assert.deepEqual(probe.snapshot(), casBefore);
    });
  }

  it("attemptNumber === maxAutomaticAttempts is idempotent with no write", async () => {
    const { store, makeDeps } = harness();
    const setup = makeDeps();
    const admitted = await admitVerification(fields, setup);
    await failRetryable(setup, admitted.record.admissionKeyHash);
    const before = structuredClone((await getVerificationRecord(fields, store))!);
    assert.equal(before.attemptNumber, 1);

    const probe = createCasProbe(store);
    const casBefore = probe.snapshot();
    const replay = await admitVerification(
      fields,
      makeDeps({ store: probe.store, maxAutomaticAttempts: 1 }),
    );

    assert.equal(replay.outcome, "idempotent");
    assert.equal(replay.record.state, "failed");
    assert.deepEqual(replay.record, before);
    const after = await getVerificationRecord(fields, store);
    assert.ok(after);
    assert.deepEqual(after, before);
    assert.deepEqual(probe.snapshot(), casBefore);
  });

  it("attemptNumber > maxAutomaticAttempts is idempotent with no write", async () => {
    const { store, clock, makeDeps } = harness({ maxAutomaticAttempts: 3 });
    const setup = makeDeps();
    const admitted = await admitVerification(fields, setup);
    await failRetryable(setup, admitted.record.admissionKeyHash);
    clock.ms += 1_000;
    const reAdmitted = await admitVerification(fields, setup);
    assert.equal(reAdmitted.outcome, "re_admitted");
    assert.equal(reAdmitted.record.attemptNumber, 2);
    await failRetryable(setup, admitted.record.admissionKeyHash);

    const before = structuredClone((await getVerificationRecord(fields, store))!);
    assert.equal(before.attemptNumber, 2);
    assert.ok(before.attemptNumber > 1);

    const probe = createCasProbe(store);
    const casBefore = probe.snapshot();
    const replay = await admitVerification(
      fields,
      makeDeps({ store: probe.store, maxAutomaticAttempts: 1 }),
    );

    assert.equal(replay.outcome, "idempotent");
    assert.equal(replay.record.state, "failed");
    assert.deepEqual(replay.record, before);
    const after = await getVerificationRecord(fields, store);
    assert.ok(after);
    assert.deepEqual(after, before);
    assert.deepEqual(probe.snapshot(), casBefore);
  });

  it("non-retryable failed remains idempotent with a valid retry budget", async () => {
    const { store, makeDeps } = harness();
    const setup = makeDeps();
    const admitted = await admitVerification(fields, setup);
    await failNonRetryable(setup, admitted.record.admissionKeyHash);
    const before = structuredClone((await getVerificationRecord(fields, store))!);

    const probe = createCasProbe(store);
    const casBefore = probe.snapshot();
    const replay = await admitVerification(
      fields,
      makeDeps({ store: probe.store, maxAutomaticAttempts: 5 }),
    );

    assert.equal(replay.outcome, "idempotent");
    assert.equal(replay.record.state, "failed");
    assert.equal(replay.record.retryClassification, "non_retryable");
    assert.deepEqual(replay.record, before);
    const after = await getVerificationRecord(fields, store);
    assert.ok(after);
    assert.deepEqual(after, before);
    assert.deepEqual(probe.snapshot(), casBefore);
  });

  it("non-retryable failed with invalid budget stays idempotent (retry class before budget)", async () => {
    // Characterization: canReAdmitFailed checks retryClassification before
    // validating maxAutomaticAttempts, so non-retryable + invalid budget does
    // not throw INVALID_ADMISSION_INPUT.
    const { store, makeDeps } = harness();
    const setup = makeDeps();
    const admitted = await admitVerification(fields, setup);
    await failNonRetryable(setup, admitted.record.admissionKeyHash);
    const before = structuredClone((await getVerificationRecord(fields, store))!);

    const probe = createCasProbe(store);
    const casBefore = probe.snapshot();
    const replay = await admitVerification(
      fields,
      makeDeps({
        store: probe.store,
        maxAutomaticAttempts: 0,
      }),
    );

    assert.equal(replay.outcome, "idempotent");
    assert.equal(replay.record.state, "failed");
    assert.equal(replay.record.retryClassification, "non_retryable");
    assert.deepEqual(replay.record, before);
    const after = await getVerificationRecord(fields, store);
    assert.ok(after);
    assert.deepEqual(after, before);
    assert.deepEqual(probe.snapshot(), casBefore);
  });

  it("successful re-admission preserves deep prior attempts/events as exact prefix", async () => {
    const { clock, makeDeps } = harness({ maxAutomaticAttempts: 5 });
    const deps = makeDeps();
    const created = await admitVerification(fields, deps);
    assert.equal(created.outcome, "created");

    clock.ms += 100;
    await appendAttemptEvidence(
      {
        admissionKeyHash: created.record.admissionKeyHash,
        event: { kind: "deep_progress_a", detail: { seq: 1 } },
      },
      deps,
    );
    clock.ms += 100;
    await appendAttemptEvidence(
      {
        admissionKeyHash: created.record.admissionKeyHash,
        event: { kind: "deep_progress_b", detail: { seq: 2, nested: true } },
      },
      deps,
    );
    await failRetryable(deps, created.record.admissionKeyHash);

    clock.ms += 1_000;
    const second = await admitVerification(fields, deps);
    assert.equal(second.outcome, "re_admitted");
    clock.ms += 100;
    await appendAttemptEvidence(
      {
        admissionKeyHash: created.record.admissionKeyHash,
        event: {
          kind: "deep_progress_c",
          detail: { seq: 3, nested: true, note: "prior-depth" },
        },
      },
      deps,
    );
    await failRetryable(deps, created.record.admissionKeyHash);

    const prior = structuredClone((await getVerificationRecord(fields, deps.store))!);
    assert.equal(prior.state, "failed");
    assert.equal(prior.attemptNumber, 2);
    assert.equal(prior.attemptEvidence.length, 2);
    assert.ok(prior.attemptEvidence[0]!.events.length >= 3);
    assert.ok(prior.attemptEvidence[1]!.events.length >= 2);
    const priorAttemptIds = prior.attemptEvidence.map((attempt) => attempt.attemptId);

    clock.ms += 1_000;
    const reAdmitted = await admitVerification(fields, deps);
    assert.equal(reAdmitted.outcome, "re_admitted");
    assert.equal(reAdmitted.record.state, "verifying");
    assert.equal(reAdmitted.record.attemptNumber, prior.attemptNumber + 1);
    assert.equal(reAdmitted.record.attemptEvidence.length, prior.attemptEvidence.length + 1);
    assert.deepEqual(
      reAdmitted.record.attemptEvidence.slice(0, prior.attemptEvidence.length),
      prior.attemptEvidence,
    );

    const newAttempt =
      reAdmitted.record.attemptEvidence[reAdmitted.record.attemptEvidence.length - 1]!;
    assert.equal(newAttempt.attemptNumber, prior.attemptNumber + 1);
    assert.ok(!priorAttemptIds.includes(newAttempt.attemptId));
    assert.equal(reAdmitted.record.activeAttemptId, newAttempt.attemptId);
    assert.equal(
      reAdmitted.record.attemptEvidence.filter((attempt) => attempt.state === "verifying")
        .length,
      1,
    );
    assert.equal(newAttempt.state, "verifying");
    assert.equal(newAttempt.events.length, 1);
    assert.equal(newAttempt.events[0]?.kind, "attempt_started");
    assert.equal(newAttempt.events[0]?.eventId, `${newAttempt.attemptId}:start`);
    assert.deepEqual(newAttempt.events[0]?.detail, { source: "admission" });

    const startEvents = reAdmitted.record.attemptEvidence.flatMap((attempt) =>
      attempt.events.filter((event) => event.kind === "attempt_started"),
    );
    assert.equal(
      startEvents.filter((event) => event.eventId === `${newAttempt.attemptId}:start`)
        .length,
      1,
    );
  });

  it("concurrent adapters racing re-admission against the same ETag converge once", async () => {
    const backend = createSyntheticConditionalObjectStore();
    const setupStore = createConditionalObjectVerificationRecordStore(backend);
    const setupClock = { ms: Date.parse("2026-07-23T12:00:00.000Z") };
    let setupSeq = 0;
    const setupDeps: VerificationAdmissionDependencies = {
      store: setupStore,
      now: () => new Date(setupClock.ms),
      randomId: () => {
        setupSeq += 1;
        return `setup-${setupSeq}`;
      },
      maxAutomaticAttempts: 5,
    };
    const admitted = await admitVerification(fields, setupDeps);
    await failRetryable(setupDeps, admitted.record.admissionKeyHash);
    const before = structuredClone((await getVerificationRecord(fields, setupStore))!);
    assert.equal(before.state, "failed");
    assert.equal(before.retryClassification, "retryable");
    assert.equal(before.attemptEvidence.length, 1);

    // Barrier forces ≥2 adapters past same-version observe + CAS arrival together.
    // Convergence must still come from onlyIf, not from this coordination.
    const racing = createSameEtagCasRaceBackend(backend, 2);
    const sharedClock = { ms: setupClock.ms + 1_000 };
    let seq = 0;

    const results = await Promise.all(
      Array.from({ length: 2 }, () => {
        const store = createConditionalObjectVerificationRecordStore(racing.objects);
        const deps: VerificationAdmissionDependencies = {
          store,
          now: () => new Date(sharedClock.ms),
          randomId: () => {
            seq += 1;
            return `race-${seq}`;
          },
          maxAutomaticAttempts: 5,
        };
        return admitVerification(fields, deps);
      }),
    );

    const stats = racing.stats();
    assert.ok(stats.versionedObservers >= 2);
    assert.ok(stats.casAttempts >= 2);
    assert.ok(stats.casSuccesses >= 1);
    assert.ok(stats.casRejections >= 1);
    assert.equal(stats.casSuccesses + stats.casRejections, stats.casAttempts);

    const reAdmitted = results.filter((result) => result.outcome === "re_admitted");
    const idempotent = results.filter((result) => result.outcome === "idempotent");
    assert.equal(reAdmitted.length, 1);
    assert.equal(idempotent.length, 1);
    assert.equal(idempotent[0]!.record.state, "verifying");
    assert.equal(
      idempotent[0]!.record.activeAttemptId,
      reAdmitted[0]!.record.activeAttemptId,
    );

    const observer = createConditionalObjectVerificationRecordStore(backend);
    const loaded = await getVerificationRecord(fields, observer);
    assert.ok(loaded);
    assert.equal(loaded.state, "verifying");
    assert.equal(loaded.attemptEvidence.length, before.attemptEvidence.length + 1);
    assert.deepEqual(
      loaded.attemptEvidence.slice(0, before.attemptEvidence.length),
      before.attemptEvidence,
    );
    assert.equal(
      loaded.attemptEvidence.filter((attempt) => attempt.state === "verifying").length,
      1,
    );
    assert.equal(loaded.activeAttemptId, loaded.attemptEvidence.at(-1)?.attemptId);

    const newStartEvents = loaded.attemptEvidence
      .flatMap((attempt) => attempt.events)
      .filter(
        (event) =>
          event.kind === "attempt_started" &&
          event.detail?.source === "admission" &&
          !before.attemptEvidence.some((attempt) =>
            attempt.events.some((prior) => prior.eventId === event.eventId),
          ),
      );
    assert.equal(newStartEvents.length, 1);
    assert.equal(newStartEvents[0]?.eventId, `${loaded.activeAttemptId}:start`);
    assert.equal(backend._inspect().size, 1);
  });
});

describe("stuck evaluation against durable record is side-effect-free", () => {
  it("does not mutate store contents", async () => {
    const { backend, deps, clock } = harness();
    const admitted = await admitVerification(fields, deps);
    const beforeRaw = [...backend._inspect().entries()].map(([key, value]) => [
      key,
      value.body,
      value.etag,
    ]);
    const beforeEvents = admitted.record.attemptEvidence[0]!.events.length;

    const classification = classifyStuckVerifying(
      admitted.record,
      new Date(clock.ms + 1_000),
      500,
    );
    assert.equal(classification.isStuck, true);

    const afterRaw = [...backend._inspect().entries()].map(([key, value]) => [
      key,
      value.body,
      value.etag,
    ]);
    assert.deepEqual(afterRaw, beforeRaw);

    const after = await getVerificationRecord(fields, deps.store);
    assert.ok(after);
    assert.equal(after.attemptEvidence[0]!.events.length, beforeEvents);
    assert.equal(after.updatedAt, admitted.record.updatedAt);
  });
});

describe("non-mutation boundary for foreign stores", () => {
  it("admission does not write upload, match, publication, projection, playback, or transcript keys", async () => {
    const { backend, deps } = harness();
    await admitVerification(fields, deps);
    const keys = [...backend._inspect().keys()];
    assert.equal(keys.length, 1);
    assert.match(keys[0]!, /^production-verification\/records\/[a-f0-9]{64}\.json$/);
    assert.equal(keys.some((key) => key.includes("upload")), false);
    assert.equal(keys.some((key) => key.includes("match-lineage")), false);
    assert.equal(keys.some((key) => key.includes("publication")), false);
    assert.equal(keys.some((key) => key.includes("projection")), false);
    assert.equal(keys.some((key) => key.includes("playback")), false);
    assert.equal(keys.some((key) => key.includes("transcript")), false);
  });
});
