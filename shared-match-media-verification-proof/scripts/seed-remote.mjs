import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  benchmarkPartBytes,
  createBenchmarkProvisioningPlan,
} from "./benchmark-provisioning-core.mjs";

const sizeGiB = Number(process.argv[2]);
const baseUrl = process.argv[3];
const secretPath = process.argv[4];
if (![1, 5, 10, 20].includes(sizeGiB) || !baseUrl || !secretPath) {
  throw new Error("usage: node scripts/seed-remote.mjs <1|5|10|20> <worker-url> <secret-file>");
}

const secret = (await readFile(secretPath, "utf8")).trim();
const objectKey = `benchmarks/${sizeGiB}gib-v1.mp4`;
const plan = createBenchmarkProvisioningPlan(sizeGiB);
const expectedBytes = plan.totalBytes;
const prefix = Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,2,0,105,115,111,109,105,115,111,50]);
const zeroPart = Buffer.alloc(plan.standardPartBytes);
const hash = createHash("sha256");
let hashedBytes = 0;

for (let partNumber = 1; partNumber <= plan.partCount; partNumber += 1) {
  const chunk = Buffer.from(zeroPart.subarray(0, benchmarkPartBytes(plan, partNumber)));
  if (partNumber === 1) prefix.copy(chunk, 0);
  hash.update(chunk);
  hashedBytes += chunk.byteLength;
}
if (hashedBytes !== expectedBytes) throw new Error("benchmark hash plan byte count mismatch");
const expectedSha256 = hash.digest("hex");
const authorization = `Bearer ${secret}`;
const startResponse = await fetch(`${baseUrl}/seed/start`, {
  method: "POST",
  headers: { authorization, "content-type": "application/json" },
  body: JSON.stringify({ objectKey, expectedBytes, expectedSha256 }),
});
if (!startResponse.ok) throw new Error(`seed start failed: ${startResponse.status} ${await startResponse.text()}`);
const { uploadId } = await startResponse.json();
const parts = [];
let uploadedBytes = 0;
let partNumber = 1;
const uploadStartedAt = Date.now();
while (partNumber <= plan.partCount) {
  const chunk = Buffer.from(zeroPart.subarray(0, benchmarkPartBytes(plan, partNumber)));
  if (partNumber === 1) prefix.copy(chunk, 0);
  const response = await fetch(`${baseUrl}/seed/part`, {
    method: "PUT",
    headers: {
      authorization,
      "content-type": "application/octet-stream",
      "content-length": String(chunk.byteLength),
      "x-proof-object-key": objectKey,
      "x-proof-upload-id": uploadId,
      "x-proof-part-number": String(partNumber),
    },
    body: chunk,
  });
  if (!response.ok) throw new Error(`part ${partNumber} failed: ${response.status} ${await response.text()}`);
  const part = await response.json();
  parts.push(part);
  uploadedBytes += chunk.byteLength;
  process.stderr.write(JSON.stringify({ sizeGiB, partNumber, uploadedBytes, expectedBytes }) + "\n");
  partNumber += 1;
}
if (uploadedBytes !== expectedBytes || parts.length !== plan.partCount) {
  throw new Error("benchmark upload plan byte count mismatch");
}
const completeResponse = await fetch(`${baseUrl}/seed/complete`, {
  method: "POST",
  headers: { authorization, "content-type": "application/json" },
  body: JSON.stringify({ objectKey, uploadId, parts }),
});
if (!completeResponse.ok) throw new Error(`seed complete failed: ${completeResponse.status} ${await completeResponse.text()}`);
const completed = await completeResponse.json();
process.stdout.write(JSON.stringify({
  harnessVersion: "verification-container-runtime-proof-v1",
  sizeGiB,
  objectKey,
  expectedBytes,
  expectedSha256,
  expectedMime: "video/mp4",
  uploadWallClockMs: Date.now() - uploadStartedAt,
  standardPartBytes: plan.standardPartBytes,
  partCount: plan.partCount,
  finalPartBytes: plan.finalPartBytes,
  provisioningStrategyVersion: plan.provisioningStrategyVersion,
  ...completed,
}) + "\n");
