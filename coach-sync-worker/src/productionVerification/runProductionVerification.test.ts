import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
  PROOF_MEDIA_STORAGE_BUCKET_BINDING,
  deriveVerifiedMediaPublicationEligibility,
  recordStoreKey,
} from "../../../shared-match-media-production-verification/src/index.ts";
import { createSyntheticConditionalObjectStore } from "../../../shared-match-media-production-verification/src/syntheticConditionalObjectStore.ts";
import { installDigestStreamPolyfillForTests } from "./digestStreamPolyfill.ts";
import { createR2ConditionalObjectStore } from "./r2ConditionalObjectStore.ts";
import { inspectCompleteR2Object } from "./r2ObjectInspector.ts";
import {
  isVerificationFeatureEnabled,
  runProductionVerification,
  type ProductionVerificationCompletionInput,
  type RunProductionVerificationDependencies,
} from "./runProductionVerification.ts";

installDigestStreamPolyfillForTests();

function ftypBytes(brand = "isom", size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  new DataView(bytes.buffer).setUint32(0, 32);
  bytes.set(new TextEncoder().encode("ftyp"), 4);
  bytes.set(new TextEncoder().encode(brand.padEnd(4, " ").slice(0, 4)), 8);
  return bytes;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type FakeObject = {
  body: Uint8Array;
  etag: string;
  version: string;
  contentType?: string;
};

function createFakeMediaBucket(options?: {
  headError?: Error;
  getError?: Error;
  streamError?: Error;
  chunkSize?: number;
}) {
  const objects = new Map<string, FakeObject>();
  let etagCounter = 0;
  let getCount = 0;
  let headCount = 0;
  let putCount = 0;
  let mediaObjectGetCount = 0;
  let mediaObjectHeadCount = 0;

  function isMediaObjectKey(key: string): boolean {
    return key.startsWith("match-media/");
  }

  return {
    stats: () => ({
      getCount,
      headCount,
      putCount,
      mediaObjectGetCount,
      mediaObjectHeadCount,
      keys: [...objects.keys()],
    }),
    putBytes(key: string, body: Uint8Array, options?: { version?: string; contentType?: string }) {
      etagCounter += 1;
      objects.set(key, {
        body,
        etag: `"obj-${etagCounter}"`,
        version: options?.version ?? `ver-${etagCounter}`,
        contentType: options?.contentType,
      });
    },
    snapshotObject(key: string) {
      const entry = objects.get(key);
      return entry
        ? {
            version: entry.version,
            etag: entry.etag,
            byteLength: entry.body.byteLength,
            contentType: entry.contentType,
          }
        : null;
    },
    mediaBucket: {
      get: async (key: string) => {
        getCount += 1;
        if (isMediaObjectKey(key)) mediaObjectGetCount += 1;
        if (options?.getError && isMediaObjectKey(key)) throw options.getError;
        const entry = objects.get(key);
        if (!entry) return null;
        const chunkSize = options?.chunkSize;
        return {
          text: async () => new TextDecoder().decode(entry.body),
          etag: entry.etag,
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              if (options?.streamError && isMediaObjectKey(key)) {
                controller.error(options.streamError);
                return;
              }
              if (chunkSize && chunkSize > 0) {
                for (let offset = 0; offset < entry.body.byteLength; offset += chunkSize) {
                  controller.enqueue(entry.body.subarray(offset, offset + chunkSize));
                }
              } else {
                controller.enqueue(entry.body);
              }
              controller.close();
            },
          }),
          size: entry.body.byteLength,
          version: entry.version,
          httpMetadata: entry.contentType
            ? { contentType: entry.contentType }
            : undefined,
        };
      },
      put: async (
        key: string,
        value: string,
        putOptions: {
          onlyIf: { etagDoesNotMatch: "*" } | { etagMatches: string };
          httpMetadata: { contentType: string };
          customMetadata: Record<string, string>;
        },
      ) => {
        putCount += 1;
        const existing = objects.get(key);
        if ("etagDoesNotMatch" in putOptions.onlyIf) {
          if (existing) return null;
        } else if (!existing || existing.etag !== putOptions.onlyIf.etagMatches) {
          return null;
        }
        etagCounter += 1;
        const etag = `"meta-${etagCounter}"`;
        objects.set(key, {
          body: new TextEncoder().encode(value),
          etag,
          version: `meta-ver-${etagCounter}`,
          contentType: putOptions.httpMetadata.contentType,
        });
        return { etag };
      },
      head: async (key: string) => {
        headCount += 1;
        if (isMediaObjectKey(key)) mediaObjectHeadCount += 1;
        if (options?.headError && isMediaObjectKey(key)) throw options.headError;
        const entry = objects.get(key);
        if (!entry) return null;
        return {
          size: entry.body.byteLength,
          version: entry.version,
          httpMetadata: entry.contentType
            ? { contentType: entry.contentType }
            : undefined,
        };
      },
    },
  };
}

function baseInput(objectKey: string, bytes: Uint8Array, version: string) {
  return {
    matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
    objectVersion: version,
    storageObjectKey: objectKey,
    declaredByteCount: bytes.byteLength,
    declaredMimeType: "video/mp4",
    expectedWholeObjectSha256: sha256Hex(bytes),
    uploadSessionId: "mmus_test",
    athleteId: "athlete_1",
    competitionId: "competition_1",
    matchLineageKey: "lineage_1",
    matchId: "match_1",
  };
}

function withMatchingCanary(
  input: ProductionVerificationCompletionInput,
  deps: Omit<RunProductionVerificationDependencies, "canaryAssetId" | "canaryObjectVersion">,
): RunProductionVerificationDependencies {
  return {
    ...deps,
    canaryAssetId: input.matchMediaAssetId,
    canaryObjectVersion: input.objectVersion,
  };
}

describe("production verification worker adapters", () => {
  it("feature flag enables only on exact string 1", () => {
    assert.equal(isVerificationFeatureEnabled("1"), true);
    assert.equal(isVerificationFeatureEnabled("0"), false);
    assert.equal(isVerificationFeatureEnabled(undefined), false);
    assert.equal(isVerificationFeatureEnabled("true"), false);
  });

  it("disabled path performs no verification write or object read", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes();
    const key = "match-media/assets/mma_x/original";
    fake.putBytes(key, bytes, { version: "v1" });
    const before = fake.stats();
    const result = await runProductionVerification(baseInput(key, bytes, "v1"), {
      enabled: false,
      mediaBucket: fake.mediaBucket,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "disabled-id",
    });
    assert.equal(result.outcome, "disabled");
    assert.equal(result.verificationAttempted, false);
    const after = fake.stats();
    assert.equal(after.getCount, before.getCount);
    assert.equal(after.headCount, before.headCount);
    assert.equal(after.putCount, before.putCount);
  });

  it("PROOF_MEDIA cannot be admitted through the production path", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes();
    const key = "match-media/assets/mma_x/original";
    fake.putBytes(key, bytes, { version: "v1" });
    const input = baseInput(key, bytes, "v1");
    const result = await runProductionVerification(
      input,
      withMatchingCanary(input, {
        enabled: true,
        mediaBucket: fake.mediaBucket,
        now: () => new Date(),
        randomId: () => "proof-reject",
        storageBucketBinding: PROOF_MEDIA_STORAGE_BUCKET_BINDING,
      }),
    );
    assert.equal(result.outcome, "trigger_error");
    if (result.outcome === "trigger_error") {
      assert.equal(result.code, "INVALID_STORAGE_BUCKET_BINDING");
    }
    assert.equal(
      fake.stats().keys.some((k) => k.startsWith("production-verification/")),
      false,
    );
  });

  it("verifies a complete object and records calculated SHA", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("mp41", 96);
    const key = "match-media/assets/mma_11111111-2222-4333-8444-555555555555/original";
    fake.putBytes(key, bytes, { version: "object-v1", contentType: "text/plain" });
    const input = baseInput(key, bytes, "object-v1");
    const deps = withMatchingCanary(input, {
      enabled: true,
      mediaBucket: fake.mediaBucket,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "run-1",
    });
    const result = await runProductionVerification(input, deps);
    assert.equal(result.outcome, "verified");
    if (result.outcome === "verified") {
      assert.equal(result.record.state, "verified");
      assert.equal(result.record.storageBucketBinding, PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING);
      assert.equal(result.record.calculatedSha256, sha256Hex(bytes));
      assert.equal(result.record.observedMimeType, "video/mp4");
      assert.equal(result.record.scanHookStatus, "scan_not_required");
      const eligibility = await deriveVerifiedMediaPublicationEligibility(
        {
          contractVersion: result.record.contractVersion,
          storageBucketBinding: result.record.storageBucketBinding,
          matchMediaAssetId: result.record.matchMediaAssetId,
          objectVersion: result.record.objectVersion,
          storageObjectKey: result.record.storageObjectKey,
        },
        result.record,
      );
      assert.equal(eligibility.publicationEligible, true);
    }
  });

  it("succeeds when expected SHA is absent", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("qt  ", 80);
    const key = "match-media/assets/mma_no_sha/original";
    fake.putBytes(key, bytes, { version: "v-no-sha" });
    const input = baseInput(key, bytes, "v-no-sha");
    const { expectedWholeObjectSha256: _omit, ...withoutSha } = input;
    const result = await runProductionVerification(
      withoutSha,
      withMatchingCanary(withoutSha, {
        enabled: true,
        mediaBucket: fake.mediaBucket,
        now: () => new Date(),
        randomId: () => "no-sha",
      }),
    );
    assert.equal(result.outcome, "verified");
    if (result.outcome === "verified") {
      assert.equal(result.record.calculatedSha256, sha256Hex(bytes));
      assert.equal(result.record.expectedWholeObjectSha256, undefined);
    }
  });

  it("rejects byte-count and SHA mismatches", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("iso2", 64);
    const key = "match-media/assets/mma_mismatch/original";
    fake.putBytes(key, bytes, { version: "v-mismatch" });

    const byteInput = {
      ...baseInput(key, bytes, "v-mismatch"),
      declaredByteCount: bytes.byteLength + 1,
    };
    const byteReject = await runProductionVerification(
      byteInput,
      withMatchingCanary(byteInput, {
        enabled: true,
        mediaBucket: fake.mediaBucket,
        now: () => new Date(),
        randomId: () => "byte-mismatch",
      }),
    );
    assert.equal(byteReject.outcome, "rejected");
    if (byteReject.outcome === "rejected") {
      assert.equal(byteReject.record.terminalReasonCode, "BYTE_COUNT_MISMATCH");
    }

    const fake2 = createFakeMediaBucket();
    fake2.putBytes(key, bytes, { version: "v-sha" });
    const shaInput = {
      ...baseInput(key, bytes, "v-sha"),
      expectedWholeObjectSha256: "a".repeat(64),
    };
    const shaReject = await runProductionVerification(
      shaInput,
      withMatchingCanary(shaInput, {
        enabled: true,
        mediaBucket: fake2.mediaBucket,
        now: () => new Date(),
        randomId: () => "sha-mismatch",
      }),
    );
    assert.equal(shaReject.outcome, "rejected");
    if (shaReject.outcome === "rejected") {
      assert.equal(shaReject.record.terminalReasonCode, "SHA256_MISMATCH");
    }
  });

  it("duplicate completion triggering remains idempotent and terminal immutable", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("mp42", 72);
    const key = "match-media/assets/mma_idem/original";
    fake.putBytes(key, bytes, { version: "v-idem" });
    const input = baseInput(key, bytes, "v-idem");
    const deps = withMatchingCanary(input, {
      enabled: true,
      mediaBucket: fake.mediaBucket,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "idem",
    });
    const first = await runProductionVerification(input, deps);
    const second = await runProductionVerification(input, deps);
    assert.equal(first.outcome, "verified");
    assert.equal(second.outcome, "idempotent_terminal");
    if (first.outcome === "verified" && second.outcome === "idempotent_terminal") {
      assert.equal(second.record.verificationRecordId, first.record.verificationRecordId);
      assert.equal(second.record.state, "verified");
      assert.equal(
        second.record.attemptEvidence.filter((a) => a.state === "verifying").length,
        0,
      );
    }
  });

  it("concurrent execution does not leave multiple active attempts", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("isom", 64);
    const key = "match-media/assets/mma_race/original";
    fake.putBytes(key, bytes, { version: "v-race" });
    let id = 0;
    const input = baseInput(key, bytes, "v-race");
    const deps = withMatchingCanary(input, {
      enabled: true,
      mediaBucket: fake.mediaBucket,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => `race-${id++}`,
    });
    const [a, b] = await Promise.all([
      runProductionVerification(input, deps),
      runProductionVerification(input, deps),
    ]);
    for (const result of [a, b]) {
      assert.notEqual(result.outcome, "trigger_error");
      if (
        result.outcome === "disabled" ||
        result.outcome === "bypassed" ||
        result.outcome === "trigger_error"
      ) {
        continue;
      }
      if (result.outcome === "verifying") {
        assert.equal(result.admissionOutcome, "idempotent");
        continue;
      }
      assert.equal(
        result.record.attemptEvidence.filter((attempt) => attempt.state === "verifying").length,
        0,
      );
      assert.ok(
        result.record.state === "verified" ||
          result.record.state === "rejected" ||
          result.record.state === "failed",
      );
    }
    const executors = [a, b].filter(
      (result) =>
        result.verificationAttempted &&
        "admissionOutcome" in result &&
        (result.admissionOutcome === "created" || result.admissionOutcome === "re_admitted"),
    );
    assert.equal(executors.length, 1);
    assert.equal(fake.stats().mediaObjectGetCount, 1);
    assert.equal(fake.stats().mediaObjectHeadCount, 1);
  });

  it("R2 content-type alone cannot pass verification", async () => {
    const fake = createFakeMediaBucket();
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const key = "match-media/assets/mma_r2only/original";
    fake.putBytes(key, bytes, { version: "v-r2", contentType: "video/mp4" });
    const input = {
      ...baseInput(key, bytes, "v-r2"),
      expectedWholeObjectSha256: sha256Hex(bytes),
    };
    const result = await runProductionVerification(
      input,
      withMatchingCanary(input, {
        enabled: true,
        mediaBucket: fake.mediaBucket,
        now: () => new Date(),
        randomId: () => "r2-only",
      }),
    );
    assert.equal(result.outcome, "rejected");
    if (result.outcome === "rejected") {
      assert.equal(result.record.terminalReasonCode, "UNSUPPORTED_MEDIA_FORMAT");
    }
  });

  it("inspectCompleteR2Object streams full object once", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("isom", 200);
    const key = "obj";
    fake.putBytes(key, bytes, { version: "v1" });
    const result = await inspectCompleteR2Object(fake.mediaBucket, key, "v1");
    assert.equal("code" in result, false);
    if (!("code" in result)) {
      assert.equal(result.observedByteCount, 200);
      assert.equal(result.calculatedSha256, sha256Hex(bytes));
      assert.equal(result.mimePrefix.byteLength > 0, true);
    }
    assert.equal(fake.stats().getCount, 1);
  });

  it("r2 conditional store preserves CAS create/swap semantics", async () => {
    const backend = createSyntheticConditionalObjectStore();
    const store = createR2ConditionalObjectStore({
      get: (key) =>
        backend.get(key).then((v) => (v ? { text: async () => v.body, etag: v.etag } : null)),
      put: (key, value, options) => backend.put(key, value, { onlyIf: options.onlyIf }),
    });
    const key = recordStoreKey("a".repeat(64));
    const first = await store.put(key, '{"ok":1}', { onlyIf: { etagDoesNotMatch: "*" } });
    assert.ok(first);
    const dup = await store.put(key, '{"ok":2}', { onlyIf: { etagDoesNotMatch: "*" } });
    assert.equal(dup, null);
    const swapped = await store.put(key, '{"ok":3}', { onlyIf: { etagMatches: first!.etag } });
    assert.ok(swapped);
    const stale = await store.put(key, '{"ok":4}', { onlyIf: { etagMatches: first!.etag } });
    assert.equal(stale, null);
  });
});

describe("declared MIME provenance into verification", () => {
  it("rejects missing or empty declared MIME as MIME_NOT_ALLOWED", async () => {
    const cases: Array<{ label: string; declaredMimeType?: string; omit?: boolean }> = [
      { label: "omitted", omit: true },
      { label: "empty", declaredMimeType: "" },
      { label: "whitespace", declaredMimeType: "   " },
    ];
    for (const testCase of cases) {
      const fake = createFakeMediaBucket();
      const bytes = ftypBytes("isom", 96);
      const key = `match-media/assets/mma_mime_${testCase.label}/original`;
      fake.putBytes(key, bytes, { version: "v-mime", contentType: "video/mp4" });
      const base = baseInput(key, bytes, "v-mime");
      const input = testCase.omit
        ? (({ declaredMimeType: _omit, ...rest }) => rest)(base)
        : { ...base, declaredMimeType: testCase.declaredMimeType };
      const result = await runProductionVerification(
        input,
        withMatchingCanary(input, {
          enabled: true,
          mediaBucket: fake.mediaBucket,
          now: () => new Date(),
          randomId: () => `mime-${testCase.label}`,
        }),
      );
      assert.equal(result.outcome, "rejected");
      if (result.outcome === "rejected") {
        assert.equal(result.record.terminalReasonCode, "MIME_NOT_ALLOWED");
        assert.equal(result.record.state, "rejected");
      }
    }
  });

  it("does not let R2 content-type or ISO-BMFF bytes replace absent declaration", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("mp41", 128);
    const key = "match-media/assets/mma_no_decl/original";
    fake.putBytes(key, bytes, { version: "v-nodecl", contentType: "video/mp4" });
    const { declaredMimeType: _omit, ...withoutMime } = baseInput(key, bytes, "v-nodecl");
    const result = await runProductionVerification(
      withoutMime,
      withMatchingCanary(withoutMime, {
        enabled: true,
        mediaBucket: fake.mediaBucket,
        now: () => new Date(),
        randomId: () => "no-decl",
      }),
    );
    assert.equal(result.outcome, "rejected");
    if (result.outcome === "rejected") {
      assert.equal(result.record.terminalReasonCode, "MIME_NOT_ALLOWED");
      assert.equal(result.record.observedMimeType, undefined);
      const eligibility = await deriveVerifiedMediaPublicationEligibility(
        {
          contractVersion: result.record.contractVersion,
          storageBucketBinding: result.record.storageBucketBinding,
          matchMediaAssetId: result.record.matchMediaAssetId,
          objectVersion: result.record.objectVersion,
          storageObjectKey: result.record.storageObjectKey,
        },
        result.record,
      );
      assert.equal(eligibility.publicationEligible, false);
    }
  });

  it("preserves present video/mp4 and video/quicktime declarations through verification", async () => {
    for (const mime of ["video/mp4", "video/quicktime"] as const) {
      const fake = createFakeMediaBucket();
      const bytes = ftypBytes(mime === "video/mp4" ? "isom" : "qt  ", 80);
      const key = `match-media/assets/mma_${mime.replace("/", "_")}/original`;
      fake.putBytes(key, bytes, { version: `v-${mime}` });
      const input = { ...baseInput(key, bytes, `v-${mime}`), declaredMimeType: mime };
      const result = await runProductionVerification(
        input,
        withMatchingCanary(input, {
          enabled: true,
          mediaBucket: fake.mediaBucket,
          now: () => new Date(),
          randomId: () => mime,
        }),
      );
      assert.equal(result.outcome, "verified");
      if (result.outcome === "verified") {
        assert.equal(result.record.declaredMimeType, mime);
      }
    }
  });
});

describe("worker composition operational failure gaps", () => {
  async function assertOperationalFailure(args: {
    fake: ReturnType<typeof createFakeMediaBucket>;
    mediaKey: string;
    objectVersion: string;
    bytes: Uint8Array;
    expectedCode:
      | "OBJECT_NOT_FOUND_AFTER_COMPLETION"
      | "OBJECT_VERSION_MISMATCH"
      | "STORAGE_READ_TRANSIENT";
    objectSnapshotBefore: ReturnType<
      ReturnType<typeof createFakeMediaBucket>["snapshotObject"]
    >;
  }) {
    const input = baseInput(args.mediaKey, args.bytes, args.objectVersion);
    const result = await runProductionVerification(
      input,
      withMatchingCanary(input, {
        enabled: true,
        mediaBucket: args.fake.mediaBucket,
        now: () => new Date("2026-07-23T12:00:00.000Z"),
        randomId: () => `fail-${args.expectedCode}-${args.mediaKey}`,
      }),
    );

    assert.equal(result.outcome, "failed");
    assert.notEqual(result.outcome, "rejected");
    if (result.outcome !== "failed") return;

    assert.equal(result.record.state, "failed");
    assert.equal(result.record.terminalReasonCode, args.expectedCode);
    assert.ok(
      ![
        "MIME_NOT_ALLOWED",
        "UNSUPPORTED_MEDIA_FORMAT",
        "MIME_SIGNATURE_MISMATCH",
        "BYTE_COUNT_MISMATCH",
        "SHA256_MISMATCH",
      ].includes(result.record.terminalReasonCode ?? ""),
    );

    const events = result.record.attemptEvidence.flatMap((attempt) => attempt.events);
    const inspectionFailedIndex = events.findIndex(
      (event) => event.kind === "object_inspection_failed",
    );
    const terminalIndex = events.findIndex((event) => event.kind === "attempt_terminal");
    assert.equal(result.record.attemptEvidence.length, 1);
    assert.equal(result.record.attemptEvidence[0]?.state, "failed");
    assert.ok(inspectionFailedIndex >= 0, `missing inspection failure evidence: ${events.map((e) => e.kind)}`);
    assert.ok(terminalIndex >= 0);
    assert.ok(inspectionFailedIndex < terminalIndex);
    assert.equal(events[inspectionFailedIndex]?.detail?.code, args.expectedCode);

    assert.deepEqual(
      args.fake.snapshotObject(args.mediaKey),
      args.objectSnapshotBefore,
    );

    const eligibility = await deriveVerifiedMediaPublicationEligibility(
      {
        contractVersion: result.record.contractVersion,
        storageBucketBinding: result.record.storageBucketBinding,
        matchMediaAssetId: result.record.matchMediaAssetId,
        objectVersion: result.record.objectVersion,
        storageObjectKey: result.record.storageObjectKey,
      },
      result.record,
    );
    assert.equal(eligibility.publicationEligible, false);
  }

  it("fails missing R2 object as OBJECT_NOT_FOUND_AFTER_COMPLETION", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("isom", 64);
    const key = "match-media/assets/mma_missing_obj/original";
    // Authoritative completion claims this object/version; bucket has neither.
    await assertOperationalFailure({
      fake,
      mediaKey: key,
      objectVersion: "v-missing",
      bytes,
      expectedCode: "OBJECT_NOT_FOUND_AFTER_COMPLETION",
      objectSnapshotBefore: null,
    });
  });

  it("fails authoritative R2 object-version mismatch as OBJECT_VERSION_MISMATCH", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("isom", 64);
    const key = "match-media/assets/mma_version_mismatch/original";
    fake.putBytes(key, bytes, { version: "r2-version-actual" });
    const before = fake.snapshotObject(key);
    await assertOperationalFailure({
      fake,
      mediaKey: key,
      objectVersion: "r2-version-expected-from-completion",
      bytes,
      expectedCode: "OBJECT_VERSION_MISMATCH",
      objectSnapshotBefore: before,
    });
  });

  it("fails transient R2 head/get/stream errors as STORAGE_READ_TRANSIENT", async () => {
    const cases = [
      { label: "head", fake: createFakeMediaBucket({ headError: new Error("head timeout") }) },
      { label: "get", fake: createFakeMediaBucket({ getError: new Error("get reset") }) },
      { label: "stream", fake: createFakeMediaBucket({ streamError: new Error("stream reset") }) },
    ] as const;

    for (const testCase of cases) {
      const bytes = ftypBytes("isom", 64);
      const key = `match-media/assets/mma_transient_${testCase.label}/original`;
      testCase.fake.putBytes(key, bytes, { version: "v-transient" });
      const before = testCase.fake.snapshotObject(key);
      await assertOperationalFailure({
        fake: testCase.fake,
        mediaKey: key,
        objectVersion: "v-transient",
        bytes,
        expectedCode: "STORAGE_READ_TRANSIENT",
        objectSnapshotBefore: before,
      });
    }
  });
});
