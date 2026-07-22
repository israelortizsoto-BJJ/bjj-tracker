import assert from "node:assert/strict";
import test from "node:test";
import { HARNESS_VERSION, detectMime, executeProof, streamAndDigest, validContainerRequest } from "./core.mjs";

const prefix = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
const request = {
  proofId: `proof-${"a".repeat(64)}`,
  objectKey: "benchmarks/1gib-v1.mp4",
  objectVersion: "version-1",
  expectedBytes: 1024 * 1024 * 1024,
  expectedSha256: "b".repeat(64),
  expectedMime: "video/mp4",
  harnessVersion: HARNESS_VERSION,
  attempt: 1,
  retryBytes: 0,
};

test("container accepts only the isolated benchmark contract", () => {
  assert.equal(validContainerRequest(request), true);
  assert.equal(validContainerRequest({ ...request, objectKey: "production/video.mp4" }), false);
  assert.equal(validContainerRequest({ ...request, harnessVersion: "production" }), false);
});

test("native streaming digest counts bytes and captures bounded MIME evidence", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(prefix);
      controller.enqueue(Buffer.from("payload"));
      controller.close();
    },
  });
  const result = await streamAndDigest(body);
  assert.equal(result.terminal, true);
  assert.equal(result.streamedBytes, prefix.byteLength + 7);
  assert.equal(result.computedSha256.length, 64);
  assert.equal(result.detectedMime, "video/mp4");
});

test("forced retry emits no terminal executor evidence", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(Buffer.alloc(32));
    },
  });
  assert.deepEqual(await streamAndDigest(body, 16), {
    terminal: false,
    failureCode: "forced_retry",
    streamedBytes: 32,
  });
});

test("immutable storage rejection is authoritative terminal Container evidence", async () => {
  const result = await executeProof(request, async () => new Response(null, {
    status: 409,
    headers: { "x-proof-failure-code": "object_version_mismatch" },
  }));
  assert.equal(result.terminal, true);
  assert.equal(result.executor, "container-standard-1");
  assert.equal(result.status, "rejected");
  assert.equal(result.failureCode, "object_version_mismatch");
  assert.match(result.evidenceId, /^container-evidence-[a-f0-9]{64}$/);
});

test("storage outage remains nonterminal and cannot authorize release", async () => {
  const result = await executeProof(request, async () => new Response(null, {
    status: 503,
    headers: { "x-proof-failure-code": "storage_unavailable" },
  }));
  assert.deepEqual(result, { terminal: false, failureCode: "storage_unavailable", retryable: true });
});

test("MIME detector rejects a non-ISO-BMFF prefix", () => {
  assert.equal(detectMime(Buffer.alloc(12)), "unknown");
});
