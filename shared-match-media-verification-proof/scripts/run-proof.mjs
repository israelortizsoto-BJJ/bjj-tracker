import { readFile } from "node:fs/promises";

const manifestPath = process.argv[2];
const baseUrl = process.argv[3];
const secretPath = process.argv[4];
const forceRetryAfterBytes = process.argv[5] ? Number(process.argv[5]) : undefined;
if (!manifestPath || !baseUrl || !secretPath) {
  throw new Error("usage: node scripts/run-proof.mjs <manifest> <worker-url> <secret-file> [force-retry-after-bytes]");
}
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const secret = (await readFile(secretPath, "utf8")).trim();
const authorization = `Bearer ${secret}`;
const payload = {
  objectKey: manifest.objectKey,
  objectVersion: manifest.objectVersion,
  expectedBytes: manifest.expectedBytes,
  expectedSha256: manifest.expectedSha256,
  expectedMime: manifest.expectedMime,
  harnessVersion: manifest.harnessVersion,
  ...(forceRetryAfterBytes ? { forceRetryAfterBytes } : {}),
};
const triggerStartedAt = Date.now();
const trigger = await fetch(`${baseUrl}/trigger`, {
  method: "POST",
  headers: { authorization, "content-type": "application/json" },
  body: JSON.stringify(payload),
});
if (!trigger.ok) throw new Error(`trigger failed: ${trigger.status} ${await trigger.text()}`);
const triggerResult = await trigger.json();
process.stderr.write(JSON.stringify({ event: "trigger", ...triggerResult }) + "\n");

while (true) {
  const response = await fetch(`${baseUrl}/status/${triggerResult.id}`, {
    headers: { authorization },
  });
  if (!response.ok) throw new Error(`status failed: ${response.status} ${await response.text()}`);
  const status = await response.json();
  process.stderr.write(JSON.stringify({ event: "status", status: status.status, elapsedMs: Date.now() - triggerStartedAt }) + "\n");
  if (["complete", "errored", "terminated"].includes(status.status)) {
    process.stdout.write(JSON.stringify({
      trigger: triggerResult,
      observedElapsedMs: Date.now() - triggerStartedAt,
      workflow: status,
    }) + "\n");
    if (status.status !== "complete") process.exitCode = 1;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
