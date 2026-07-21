import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { once } from "node:events";

const sizeGiB = Number(process.argv[2]);
const outputPath = process.argv[3];
if (![1, 5, 10, 20].includes(sizeGiB) || !outputPath) {
  throw new Error("usage: node scripts/generate-benchmark.mjs <1|5|10|20> <output-path>");
}

const totalBytes = sizeGiB * 1024 * 1024 * 1024;
const chunkBytes = 8 * 1024 * 1024;
const prefix = Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,2,0,105,115,111,109,105,115,111,50]);
const zeroChunk = Buffer.alloc(chunkBytes);
const hash = createHash("sha256");
const output = createWriteStream(outputPath, { flags: "wx" });
let written = 0;

async function write(chunk) {
  hash.update(chunk);
  written += chunk.byteLength;
  if (!output.write(chunk)) await once(output, "drain");
}

await write(prefix);
while (written < totalBytes) {
  const remaining = totalBytes - written;
  await write(remaining >= chunkBytes ? zeroChunk : zeroChunk.subarray(0, remaining));
}
output.end();
await once(output, "close");
process.stdout.write(JSON.stringify({
  harnessVersion: "verification-runtime-proof-v1",
  sizeGiB,
  expectedBytes: totalBytes,
  expectedSha256: hash.digest("hex"),
  expectedMime: "video/mp4",
  file: outputPath,
}) + "\n");
