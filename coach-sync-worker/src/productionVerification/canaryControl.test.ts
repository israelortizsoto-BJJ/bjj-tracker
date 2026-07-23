/**
 * Focused Production Verification Canary Control correction tests.
 * Engineering tag: production-verification-canary-control-correction-v1
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MIME_PREFIX_LIMIT,
  PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
  PRODUCTION_VERIFICATION_CONTRACT_VERSION,
  createConditionalObjectVerificationRecordStore,
  deriveVerifiedMediaPublicationEligibility,
} from "../../../shared-match-media-production-verification/src/index.ts";
import {
  evaluateProductionVerificationCanaryGate,
  isSchemaValidCanaryIdentityField,
} from "./canaryGate.ts";
import { installDigestStreamPolyfillForTests } from "./digestStreamPolyfill.ts";
import {
  authorizeOperatorInspection,
  handleOperatorInspectionHttpRequest,
  handleOperatorProductionVerificationInspection,
  inspectProductionVerificationRecordReadOnly,
  OPERATOR_INSPECTION_IDENTITY_FIELDS,
  OPERATOR_INSPECTION_MAX_BODY_BYTES,
  parseOperatorInspectionIdentityBody,
  timingSafeEqualUtf8,
} from "./operatorInspection.ts";
import {
  restoreObservabilitySink,
  setObservabilitySink,
  type SanitizedObservabilityEvent,
} from "./observability.ts";
import { createR2ConditionalObjectStore } from "./r2ConditionalObjectStore.ts";
import { inspectCompleteR2Object } from "./r2ObjectInspector.ts";
import {
  runProductionVerification,
  type ProductionVerificationCompletionInput,
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

function createFakeMediaBucket(options?: {
  streamError?: Error;
  digestAbort?: boolean;
  chunkSize?: number;
}) {
  const objects = new Map<
    string,
    { body: Uint8Array; etag: string; version: string; contentType?: string }
  >();
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
    putBytes(key: string, body: Uint8Array, putOptions?: { version?: string; contentType?: string }) {
      etagCounter += 1;
      objects.set(key, {
        body,
        etag: `"obj-${etagCounter}"`,
        version: putOptions?.version ?? `ver-${etagCounter}`,
        contentType: putOptions?.contentType,
      });
    },
    mediaBucket: {
      get: async (key: string) => {
        getCount += 1;
        if (isMediaObjectKey(key)) mediaObjectGetCount += 1;
        const entry = objects.get(key);
        if (!entry) return null;
        return {
          text: async () => new TextDecoder().decode(entry.body),
          etag: entry.etag,
          body: new ReadableStream<Uint8Array>({
            async start(controller) {
              if (options?.streamError && isMediaObjectKey(key)) {
                controller.error(options.streamError);
                return;
              }
              const chunkSize = options?.chunkSize ?? entry.body.byteLength;
              for (let offset = 0; offset < entry.body.byteLength; offset += chunkSize) {
                controller.enqueue(entry.body.subarray(offset, offset + chunkSize));
              }
              controller.close();
            },
          }),
          size: entry.body.byteLength,
          version: entry.version,
          httpMetadata: entry.contentType ? { contentType: entry.contentType } : undefined,
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
        const entry = objects.get(key);
        if (!entry) return null;
        return {
          size: entry.body.byteLength,
          version: entry.version,
          httpMetadata: entry.contentType ? { contentType: entry.contentType } : undefined,
        };
      },
    },
  };
}

function baseInput(objectKey: string, bytes: Uint8Array, version: string): ProductionVerificationCompletionInput {
  return {
    matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
    objectVersion: version,
    storageObjectKey: objectKey,
    declaredByteCount: bytes.byteLength,
    declaredMimeType: "video/mp4",
    expectedWholeObjectSha256: sha256Hex(bytes),
    uploadSessionId: "mmus_canary",
    athleteId: "athlete_1",
    competitionId: "competition_1",
    matchLineageKey: "lineage_1",
    matchId: "match_1",
  };
}

function operatorAdmission(input: ProductionVerificationCompletionInput) {
  return {
    contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
    storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
    matchMediaAssetId: input.matchMediaAssetId,
    objectVersion: input.objectVersion,
    storageObjectKey: input.storageObjectKey,
  };
}

describe("canary gate unit decisions", () => {
  it("rejects malformed identity fields", () => {
    assert.equal(isSchemaValidCanaryIdentityField(""), false);
    assert.equal(isSchemaValidCanaryIdentityField("  x"), false);
    assert.equal(isSchemaValidCanaryIdentityField(`x\u001fy`), false);
    assert.equal(isSchemaValidCanaryIdentityField("valid-id"), true);
  });

  it("bypasses flag-off, missing, partial, malformed, and mismatched identities", () => {
    const base = {
      matchMediaAssetId: "mma_a",
      providerVersion: "ver_a",
      canaryAssetId: "mma_a",
      canaryObjectVersion: "ver_a",
    };
    assert.equal(
      evaluateProductionVerificationCanaryGate({ ...base, enabled: false }).allow,
      false,
    );
    assert.equal(
      evaluateProductionVerificationCanaryGate({
        ...base,
        enabled: true,
        canaryAssetId: "",
        canaryObjectVersion: "",
      }).allow,
      false,
    );
    assert.equal(
      evaluateProductionVerificationCanaryGate({
        ...base,
        enabled: true,
        canaryAssetId: "mma_a",
        canaryObjectVersion: "",
      }).allow,
      false,
    );
    assert.equal(
      evaluateProductionVerificationCanaryGate({
        ...base,
        enabled: true,
        canaryAssetId: "  mma_a",
        canaryObjectVersion: "ver_a",
      }).allow,
      false,
    );
    assert.equal(
      evaluateProductionVerificationCanaryGate({
        ...base,
        enabled: true,
        canaryAssetId: "mma_other",
        canaryObjectVersion: "ver_a",
      }).allow,
      false,
    );
    assert.equal(
      evaluateProductionVerificationCanaryGate({ ...base, enabled: true }).allow,
      true,
    );
  });
});

describe("canary control orchestration", () => {
  it("flag-off bypass performs no record write or media inspection", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes();
    const key = "match-media/assets/mma_off/original";
    fake.putBytes(key, bytes, { version: "v1" });
    const before = fake.stats();
    const result = await runProductionVerification(baseInput(key, bytes, "v1"), {
      enabled: false,
      canaryAssetId: "mma_11111111-2222-4333-8444-555555555555",
      canaryObjectVersion: "v1",
      mediaBucket: fake.mediaBucket,
      now: () => new Date(),
      randomId: () => "off",
    });
    assert.equal(result.outcome, "disabled");
    assert.equal(result.verificationAttempted, false);
    assert.deepEqual(fake.stats(), before);
  });

  it("missing, malformed, partial, and mismatched canary identities bypass", async () => {
    const cases = [
      { canaryAssetId: "", canaryObjectVersion: "", label: "missing" },
      { canaryAssetId: "mma_x", canaryObjectVersion: "", label: "partial" },
      { canaryAssetId: " mma_x", canaryObjectVersion: "v1", label: "malformed" },
      {
        canaryAssetId: "mma_other",
        canaryObjectVersion: "v1",
        label: "mismatched-asset",
      },
      {
        canaryAssetId: "mma_11111111-2222-4333-8444-555555555555",
        canaryObjectVersion: "other-v",
        label: "mismatched-version",
      },
    ] as const;

    for (const testCase of cases) {
      const fake = createFakeMediaBucket();
      const bytes = ftypBytes("isom", 80);
      const key = `match-media/assets/mma_${testCase.label}/original`;
      fake.putBytes(key, bytes, { version: "v1" });
      const before = fake.stats();
      const result = await runProductionVerification(baseInput(key, bytes, "v1"), {
        enabled: true,
        canaryAssetId: testCase.canaryAssetId,
        canaryObjectVersion: testCase.canaryObjectVersion,
        mediaBucket: fake.mediaBucket,
        now: () => new Date(),
        randomId: () => testCase.label,
      });
      assert.equal(result.outcome, "bypassed", testCase.label);
      assert.equal(result.verificationAttempted, false, testCase.label);
      assert.equal(fake.stats().putCount, before.putCount, testCase.label);
      assert.equal(fake.stats().mediaObjectGetCount, 0, testCase.label);
      assert.equal(fake.stats().mediaObjectHeadCount, 0, testCase.label);
    }
  });

  it("exact immutable pair reaches admission and request values cannot override server canary", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("mp41", 96);
    const key = "match-media/assets/mma_canary/original";
    fake.putBytes(key, bytes, { version: "canary-v1" });
    const input = baseInput(key, bytes, "canary-v1");

    const markers: SanitizedObservabilityEvent[] = [];
    setObservabilitySink((event) => markers.push(event));
    try {
      const allowed = await runProductionVerification(input, {
        enabled: true,
        canaryAssetId: input.matchMediaAssetId,
        canaryObjectVersion: input.objectVersion,
        mediaBucket: fake.mediaBucket,
        now: () => new Date("2026-07-23T12:00:00.000Z"),
        randomId: () => "canary-allow",
      });
      assert.equal(allowed.outcome, "verified");

      const overrideAttempt = await runProductionVerification(
        { ...input, matchMediaAssetId: "mma_attacker", objectVersion: "attacker-v" },
        {
          enabled: true,
          // Server config remains the sealed canary pair — request cannot retarget it.
          canaryAssetId: input.matchMediaAssetId,
          canaryObjectVersion: input.objectVersion,
          mediaBucket: fake.mediaBucket,
          now: () => new Date("2026-07-23T12:00:00.000Z"),
          randomId: () => "canary-override",
        },
      );
      assert.equal(overrideAttempt.outcome, "bypassed");
      assert.equal(overrideAttempt.verificationAttempted, false);
    } finally {
      restoreObservabilitySink();
    }

    assert.ok(markers.some((m) => m.marker === "production_verification_canary_gate"));
    assert.ok(markers.some((m) => m.marker === "production_verification_admission"));
    assert.ok(
      markers.some(
        (m) => m.marker === "production_verification_execution_acquisition" && m.acquired === true,
      ),
    );
    assert.ok(markers.some((m) => m.marker === "production_verification_inspection_start"));
    assert.ok(markers.some((m) => m.marker === "production_verification_terminal"));
  });

  it("idempotent active and terminal outcomes perform zero inspection reads", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("isom", 64);
    const key = "match-media/assets/mma_idem_exec/original";
    fake.putBytes(key, bytes, { version: "v-exec" });
    const input = baseInput(key, bytes, "v-exec");
    const deps = {
      enabled: true,
      canaryAssetId: input.matchMediaAssetId,
      canaryObjectVersion: input.objectVersion,
      mediaBucket: fake.mediaBucket,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "exec",
    };

    const first = await runProductionVerification(input, deps);
    assert.equal(first.outcome, "verified");
    const afterFirst = fake.stats();
    assert.equal(afterFirst.mediaObjectGetCount, 1);
    assert.equal(afterFirst.mediaObjectHeadCount, 1);

    const second = await runProductionVerification(input, deps);
    assert.equal(second.outcome, "idempotent_terminal");
    const afterSecond = fake.stats();
    assert.equal(afterSecond.mediaObjectGetCount, afterFirst.mediaObjectGetCount);
    assert.equal(afterSecond.mediaObjectHeadCount, afterFirst.mediaObjectHeadCount);
  });

  it("concurrent completions produce one executor and one R2 inspection", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("isom", 72);
    const key = "match-media/assets/mma_race_canary/original";
    fake.putBytes(key, bytes, { version: "v-race-c" });
    const input = baseInput(key, bytes, "v-race-c");
    let id = 0;
    const deps = {
      enabled: true,
      canaryAssetId: input.matchMediaAssetId,
      canaryObjectVersion: input.objectVersion,
      mediaBucket: fake.mediaBucket,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => `race-c-${id++}`,
    };
    const results = await Promise.all([
      runProductionVerification(input, deps),
      runProductionVerification(input, deps),
      runProductionVerification(input, deps),
    ]);
    const executors = results.filter(
      (result) =>
        result.verificationAttempted &&
        "admissionOutcome" in result &&
        (result.admissionOutcome === "created" || result.admissionOutcome === "re_admitted"),
    );
    assert.equal(executors.length, 1);
    assert.equal(fake.stats().mediaObjectGetCount, 1);
    assert.equal(fake.stats().mediaObjectHeadCount, 1);
  });
});

describe("memory-bounded DigestStream inspection", () => {
  it("hashes multi-chunk bodies and never exceeds MIME prefix limit", async () => {
    const fake = createFakeMediaBucket({ chunkSize: 17 });
    const bytes = ftypBytes("isom", MIME_PREFIX_LIMIT + 250);
    const key = "match-media/assets/mma_chunks/original";
    fake.putBytes(key, bytes, { version: "v-chunks" });
    const result = await inspectCompleteR2Object(fake.mediaBucket, key, "v-chunks");
    assert.equal("code" in result, false);
    if (!("code" in result)) {
      assert.equal(result.observedByteCount, bytes.byteLength);
      assert.equal(result.calculatedSha256, sha256Hex(bytes));
      assert.ok(result.mimePrefix.byteLength <= MIME_PREFIX_LIMIT);
      assert.equal(result.mimePrefix.byteLength, MIME_PREFIX_LIMIT);
    }
  });

  it("maps reader failures to operational STORAGE_READ_TRANSIENT", async () => {
    const fake = createFakeMediaBucket({ streamError: new Error("boom") });
    const bytes = ftypBytes();
    const key = "match-media/assets/mma_stream_fail/original";
    fake.putBytes(key, bytes, { version: "v-fail" });
    const result = await inspectCompleteR2Object(fake.mediaBucket, key, "v-fail");
    assert.equal("code" in result, true);
    if ("code" in result) {
      assert.equal(result.code, "STORAGE_READ_TRANSIENT");
      assert.equal(result.retryable, true);
    }
  });

  it("source contains no complete-object accumulator, arrayBuffer, or tee", () => {
    const inspectorPath = fileURLToPath(new URL("./r2ObjectInspector.ts", import.meta.url));
    const source = readFileSync(inspectorPath, "utf8");
    assert.doesNotMatch(source, /(?<![\w.])arrayBuffer\s*\(/);
    assert.doesNotMatch(source, /\.tee\s*\(/);
    assert.doesNotMatch(source, /bodyForDigest/);
    assert.doesNotMatch(source, /chunks\.push/);
    assert.match(source, /DigestStream/);
    assert.doesNotMatch(source, /new Uint8Array\(\s*observedByteCount\s*\)/);
  });
});

describe("operator inspection security", () => {
  it("hashes both secrets unconditionally and compares only fixed-length digests", async () => {
    const operatorPath = fileURLToPath(new URL("./operatorInspection.ts", import.meta.url));
    const source = readFileSync(operatorPath, "utf8");
    assert.match(source, /crypto\.subtle\.digest\("SHA-256"/);
    assert.match(source, /timingSafeEqual/);
    assert.doesNotMatch(
      source,
      /leftBytes\.byteLength\s*===\s*rightBytes\.byteLength/,
    );
    assert.doesNotMatch(
      source,
      /if\s*\(\s*leftBytes\.byteLength\s*===\s*rightBytes\.byteLength\s*\)/,
    );

    let digestCalls = 0;
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    const subtle = crypto.subtle as SubtleCrypto & {
      digest: typeof crypto.subtle.digest;
    };
    subtle.digest = async (algorithm, data) => {
      digestCalls += 1;
      return originalDigest(algorithm, data);
    };
    try {
      assert.equal(await timingSafeEqualUtf8("secret", "secret"), true);
      assert.equal(digestCalls, 2, "equal secrets must both be hashed");
      digestCalls = 0;
      assert.equal(await timingSafeEqualUtf8("secret", "wrong!"), false);
      assert.equal(digestCalls, 2, "same-length unequal secrets must both be hashed");
      digestCalls = 0;
      assert.equal(await timingSafeEqualUtf8("short", "longer-value"), false);
      assert.equal(digestCalls, 2, "different-length secrets must both be hashed");
    } finally {
      subtle.digest = originalDigest;
    }

    assert.equal(
      (
        await authorizeOperatorInspection({
          authorizationHeader: "Bearer correct-secret",
          operatorSecret: "correct-secret",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await authorizeOperatorInspection({
          authorizationHeader: "Bearer wrong-secret!",
          operatorSecret: "correct-secret",
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await authorizeOperatorInspection({
          authorizationHeader: "Bearer short",
          operatorSecret: "much-longer-secret",
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await authorizeOperatorInspection({
          authorizationHeader: null,
          operatorSecret: "correct-secret",
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await authorizeOperatorInspection({
          authorizationHeader: "Basic correct-secret",
          operatorSecret: "correct-secret",
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await authorizeOperatorInspection({
          authorizationHeader: "Bearer anything",
          operatorSecret: "",
        })
      ).ok,
      false,
    );
  });

  it("GET cannot inspect; authenticated POST succeeds; URL carries no identity", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("mp42", 88);
    const key = "match-media/assets/mma_op_post/original";
    fake.putBytes(key, bytes, { version: "v-op" });
    const input = baseInput(key, bytes, "v-op");
    const verified = await runProductionVerification(input, {
      enabled: true,
      canaryAssetId: input.matchMediaAssetId,
      canaryObjectVersion: input.objectVersion,
      mediaBucket: fake.mediaBucket,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "op-post",
    });
    assert.equal(verified.outcome, "verified");

    const store = createConditionalObjectVerificationRecordStore(
      createR2ConditionalObjectStore(fake.mediaBucket),
    );
    const expectedAdmission = operatorAdmission(input);
    const bodyText = JSON.stringify(expectedAdmission);

    const getDenied = await handleOperatorInspectionHttpRequest({
      method: "GET",
      authorizationHeader: "Bearer operator-secret",
      operatorSecret: "operator-secret",
      contentLengthHeader: null,
      readBodyText: async () => {
        throw new Error("GET must not read a body");
      },
      store,
    });
    assert.equal(getDenied.status, 405);
    assert.equal(getDenied.body.resultClass, "method_not_allowed");
    assert.equal("recordPresent" in getDenied.body, false);

    const putsBefore = fake.stats().putCount;
    const mediaGetsBefore = fake.stats().mediaObjectGetCount;
    const allowed = await handleOperatorInspectionHttpRequest({
      method: "POST",
      authorizationHeader: "Bearer operator-secret",
      operatorSecret: "operator-secret",
      contentLengthHeader: String(new TextEncoder().encode(bodyText).byteLength),
      readBodyText: async () => bodyText,
      store,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.resultClass, "ok");
    assert.equal(allowed.body.recordPresent, true);
    assert.equal(allowed.body.identityMatch, true);
    assert.equal(allowed.body.state, "verified");
    assert.equal(allowed.body.publicationEligible, true);
    assert.ok(Array.isArray(allowed.body.orderedEvidence));
    assert.equal(fake.stats().putCount, putsBefore);
    assert.equal(fake.stats().mediaObjectGetCount, mediaGetsBefore);

    const indexPath = fileURLToPath(new URL("../index.ts", import.meta.url));
    const indexSource = readFileSync(indexPath, "utf8");
    const routeStart = indexSource.indexOf(
      'path === "/internal/v1/shared-match-media/production-verification"',
    );
    assert.ok(routeStart >= 0);
    const routeSlice = indexSource.slice(routeStart, routeStart + 900);
    for (const field of OPERATOR_INSPECTION_IDENTITY_FIELDS) {
      assert.doesNotMatch(
        routeSlice,
        new RegExp(`searchParams\\.get\\("${field}"\\)`),
      );
    }
    assert.match(routeSlice, /handleOperatorInspectionHttpRequest/);
    assert.match(routeSlice, /readBodyText:\s*\(\)\s*=>\s*request\.text\(\)/);
    assert.doesNotMatch(routeSlice, /request\.method\s*===\s*"GET"/);
  });

  it("malformed or incomplete bodies fail closed without record disclosure", async () => {
    const fake = createFakeMediaBucket();
    const store = createConditionalObjectVerificationRecordStore(
      createR2ConditionalObjectStore(fake.mediaBucket),
    );
    const complete = {
      contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
      storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
      matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
      objectVersion: "v1",
      storageObjectKey: "match-media/assets/mma_body/original",
    };

    assert.equal(parseOperatorInspectionIdentityBody(null).ok, false);
    assert.equal(parseOperatorInspectionIdentityBody([]).ok, false);
    assert.equal(parseOperatorInspectionIdentityBody("x").ok, false);
    assert.equal(
      parseOperatorInspectionIdentityBody({
        ...complete,
        matchMediaAssetId: 12,
      }).ok,
      false,
    );
    const { matchMediaAssetId: _omit, ...incomplete } = complete;
    assert.equal(parseOperatorInspectionIdentityBody(incomplete).ok, false);
    assert.equal(parseOperatorInspectionIdentityBody(complete).ok, true);

    const cases: Array<{
      label: string;
      contentLengthHeader: string | null;
      body: string;
    }> = [
      { label: "missing", contentLengthHeader: "0", body: "" },
      { label: "malformed", contentLengthHeader: null, body: "{not-json" },
      {
        label: "incomplete",
        contentLengthHeader: null,
        body: JSON.stringify(incomplete),
      },
      {
        label: "wrong-type",
        contentLengthHeader: null,
        body: JSON.stringify({ ...complete, objectVersion: false }),
      },
      {
        label: "oversized",
        contentLengthHeader: String(OPERATOR_INSPECTION_MAX_BODY_BYTES + 1),
        body: "x",
      },
    ];

    for (const testCase of cases) {
      const result = await handleOperatorInspectionHttpRequest({
        method: "POST",
        authorizationHeader: "Bearer operator-secret",
        operatorSecret: "operator-secret",
        contentLengthHeader: testCase.contentLengthHeader,
        readBodyText: async () => testCase.body,
        store,
      });
      assert.equal(result.status, 400, testCase.label);
      assert.equal(result.body.resultClass, "invalid_body", testCase.label);
      assert.equal("recordPresent" in result.body, false, testCase.label);
    }
  });

  it("unauthorized requests do not reveal record existence; endpoint is read-only", async () => {
    const fake = createFakeMediaBucket();
    const bytes = ftypBytes("mp42", 88);
    const key = "match-media/assets/mma_op_auth/original";
    fake.putBytes(key, bytes, { version: "v-op-auth" });
    const input = baseInput(key, bytes, "v-op-auth");
    const verified = await runProductionVerification(input, {
      enabled: true,
      canaryAssetId: input.matchMediaAssetId,
      canaryObjectVersion: input.objectVersion,
      mediaBucket: fake.mediaBucket,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
      randomId: () => "op-auth",
    });
    assert.equal(verified.outcome, "verified");

    const store = createConditionalObjectVerificationRecordStore(
      createR2ConditionalObjectStore(fake.mediaBucket),
    );
    const expectedAdmission = operatorAdmission(input);
    const bodyText = JSON.stringify(expectedAdmission);
    const putsBefore = fake.stats().putCount;
    const mediaGetsBefore = fake.stats().mediaObjectGetCount;

    const markers: SanitizedObservabilityEvent[] = [];
    setObservabilitySink((event) => {
      markers.push(event);
    });
    try {
      const denied = await handleOperatorInspectionHttpRequest({
        method: "POST",
        authorizationHeader: "Bearer nope",
        operatorSecret: "operator-secret",
        contentLengthHeader: String(new TextEncoder().encode(bodyText).byteLength),
        readBodyText: async () => {
          throw new Error("unauthorized requests must not read the body");
        },
        store,
      });
      assert.equal(denied.status, 401);
      assert.deepEqual(denied.body, { error: "Unauthorized" });
      assert.equal("recordPresent" in denied.body, false);

      const malformedAuth = await handleOperatorInspectionHttpRequest({
        method: "POST",
        authorizationHeader: "Token operator-secret",
        operatorSecret: "operator-secret",
        contentLengthHeader: null,
        readBodyText: async () => bodyText,
        store,
      });
      assert.equal(malformedAuth.status, 401);
      assert.equal("recordPresent" in malformedAuth.body, false);

      const missingAuth = await handleOperatorProductionVerificationInspection({
        authorizationHeader: null,
        operatorSecret: "operator-secret",
        expectedAdmission,
        store,
      });
      assert.equal(missingAuth.status, 401);
      assert.equal("recordPresent" in missingAuth.body, false);

      const allowed = await handleOperatorInspectionHttpRequest({
        method: "POST",
        authorizationHeader: "Bearer operator-secret",
        operatorSecret: "operator-secret",
        contentLengthHeader: String(new TextEncoder().encode(bodyText).byteLength),
        readBodyText: async () => bodyText,
        store,
        now: () => new Date("2026-07-23T12:00:00.000Z"),
      });
      assert.equal(allowed.status, 200);
      assert.equal(allowed.body.recordPresent, true);
      assert.equal(fake.stats().putCount, putsBefore);
      assert.equal(fake.stats().mediaObjectGetCount, mediaGetsBefore);

      for (const event of markers) {
        const serialized = JSON.stringify(event);
        assert.doesNotMatch(serialized, /operator-secret/);
        assert.doesNotMatch(serialized, /nope/);
        for (const field of OPERATOR_INSPECTION_IDENTITY_FIELDS) {
          assert.equal(field in event, false);
        }
        assert.equal("storageObjectKey" in event, false);
        assert.equal("admissionKey" in event, false);
        assert.equal("admissionKeyHash" in event, false);
      }
      assert.ok(markers.some((event) => event.resultClass === "unauthorized"));
    } finally {
      restoreObservabilitySink();
    }

    const projection = await inspectProductionVerificationRecordReadOnly({
      expectedAdmission,
      store,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
    });
    assert.equal(projection.resultClass, "ok");
    if (projection.resultClass === "ok") {
      const eligibility = await deriveVerifiedMediaPublicationEligibility(
        expectedAdmission,
        verified.outcome === "verified" ? verified.record : null,
      );
      assert.equal(projection.publicationEligible, eligibility.publicationEligible);
      assert.equal(projection.observationalStuck, eligibility.observationalStuck);
    }

    const operatorPath = fileURLToPath(new URL("./operatorInspection.ts", import.meta.url));
    const operatorSource = readFileSync(operatorPath, "utf8");
    assert.doesNotMatch(operatorSource, /runProductionVerification\s*\(/);
    assert.doesNotMatch(operatorSource, /\.put\s*\(/);
    assert.match(operatorSource, /read-only/i);
  });
});
