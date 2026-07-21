import assert from "node:assert/strict";
import test from "node:test";
import {
  HARNESS_VERSION,
  createStreamTap,
  detectBoundedMime,
  isProofRequest,
  proofIdentity,
  validBenchmarkObjectKey,
  validMultipartUploadId,
} from "./proofCore.ts";

const request = {
  objectKey: "benchmarks/1gib-v1.mp4",
  objectVersion: "version-1",
  expectedBytes: 1024,
  expectedSha256: "a".repeat(64),
  expectedMime: "video/mp4" as const,
  harnessVersion: HARNESS_VERSION,
};

test("deterministic proof identity binds key, version, digest, and harness", async () => {
  assert.equal(await proofIdentity(request), await proofIdentity({ ...request }));
  assert.notEqual(await proofIdentity(request), await proofIdentity({ ...request, objectVersion: "version-2" }));
});

test("proof request rejects non-benchmark keys and malformed digests", () => {
  assert.equal(isProofRequest(request), true);
  assert.equal(isProofRequest({ ...request, objectKey: "production/object.mp4" }), false);
  assert.equal(isProofRequest({ ...request, expectedSha256: "nope" }), false);
});

test("stream tap counts every byte and bounds the prefix", async () => {
  const tap = createStreamTap(8);
  const output = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]));
        controller.enqueue(new Uint8Array([6, 7, 8, 9, 10]));
        controller.close();
      },
    }).pipeThrough(tap.stream),
  );
  assert.deepEqual(new Uint8Array(await output.arrayBuffer()), new Uint8Array([1,2,3,4,5,6,7,8,9,10]));
  assert.equal(tap.bytesRead(), 10);
  assert.deepEqual(tap.prefix(), new Uint8Array([1,2,3,4,5,6,7,8]));
});

test("bounded MIME detection accepts the deterministic MP4 prefix", () => {
  const prefix = new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109]);
  assert.equal(detectBoundedMime(prefix), "video/mp4");
  prefix[4] = 0;
  assert.equal(detectBoundedMime(prefix), "unknown");
});

test("seeding validators admit only proof object and upload identities", () => {
  assert.equal(validBenchmarkObjectKey("benchmarks/20gib-v1.mp4"), true);
  assert.equal(validBenchmarkObjectKey("matmind-coach-media/video.mp4"), false);
  assert.equal(validMultipartUploadId("abcdefghijklmnop"), true);
  assert.equal(validMultipartUploadId("short"), false);
});
