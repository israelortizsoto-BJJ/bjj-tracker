import { createHash } from "node:crypto";
import { resourceUsage } from "node:process";

export const MIME_PREFIX_LIMIT = 4096;
export const RESPONSE_LIMIT = 64 * 1024;
export const HARNESS_VERSION = "verification-container-runtime-proof-v1";

const BENCHMARK_BYTES = new Map([
  ["benchmarks/1gib-v1.mp4", 1 * 1024 * 1024 * 1024],
  ["benchmarks/5gib-v1.mp4", 5 * 1024 * 1024 * 1024],
  ["benchmarks/10gib-v1.mp4", 10 * 1024 * 1024 * 1024],
  ["benchmarks/20gib-v1.mp4", 20 * 1024 * 1024 * 1024],
]);

export function validContainerRequest(value) {
  if (!value || typeof value !== "object") return false;
  return /^proof-[a-f0-9]{64}$/.test(value.proofId) &&
    BENCHMARK_BYTES.get(value.objectKey) === value.expectedBytes &&
    typeof value.objectVersion === "string" && value.objectVersion.length > 0 && value.objectVersion.length <= 256 &&
    /^[a-f0-9]{64}$/.test(value.expectedSha256) &&
    value.expectedMime === "video/mp4" &&
    value.harnessVersion === HARNESS_VERSION &&
    Number.isInteger(value.attempt) && value.attempt >= 1 &&
    Number.isSafeInteger(value.retryBytes) && value.retryBytes >= 0 &&
    (value.forceRetryAfterBytes === undefined ||
      (Number.isSafeInteger(value.forceRetryAfterBytes) &&
        value.forceRetryAfterBytes > 0 && value.forceRetryAfterBytes < value.expectedBytes));
}

export function detectMime(prefix) {
  if (prefix.byteLength < 12) return "unknown";
  if (String.fromCharCode(...prefix.subarray(4, 8)) !== "ftyp") return "unknown";
  const brand = String.fromCharCode(...prefix.subarray(8, 12));
  return ["isom", "iso2", "mp41", "mp42", "qt  "].includes(brand) ? "video/mp4" : "unknown";
}

export async function streamAndDigest(body, failAfterBytes) {
  if (!body) throw new Error("missing response body");
  const hash = createHash("sha256");
  const prefix = Buffer.alloc(MIME_PREFIX_LIMIT);
  let prefixLength = 0;
  let bytes = 0;
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      hash.update(value);
      if (prefixLength < MIME_PREFIX_LIMIT) {
        const take = Math.min(MIME_PREFIX_LIMIT - prefixLength, value.byteLength);
        prefix.set(value.subarray(0, take), prefixLength);
        prefixLength += take;
      }
      if (failAfterBytes !== undefined && bytes >= failAfterBytes) {
        await reader.cancel("forced retry control");
        return { terminal: false, failureCode: "forced_retry", streamedBytes: bytes };
      }
    }
  } finally {
    reader.releaseLock();
  }
  return {
    terminal: true,
    streamedBytes: bytes,
    computedSha256: hash.digest("hex"),
    detectedMime: detectMime(prefix.subarray(0, prefixLength)),
  };
}

function evidenceId(evidence) {
  return `container-evidence-${createHash("sha256").update(JSON.stringify(evidence)).digest("hex")}`;
}

function terminalEvidence(request, measurements, outcome) {
  const evidence = {
    terminal: true,
    executor: "container-standard-1",
    proofId: request.proofId,
    status: outcome.status,
    objectVersion: request.objectVersion,
    streamedBytes: measurements.streamedBytes,
    expectedBytes: request.expectedBytes,
    expectedSha256: request.expectedSha256,
    computedSha256: measurements.computedSha256 ?? "",
    detectedMime: measurements.detectedMime ?? "unknown",
    wallClockMs: measurements.wallClockMs,
    cpuUserMicros: measurements.cpuUserMicros,
    cpuSystemMicros: measurements.cpuSystemMicros,
    peakRssBytes: measurements.peakRssBytes,
    hashAttempt: request.attempt,
    bytesReread: request.retryBytes,
    harnessVersion: request.harnessVersion,
    ...(outcome.failureCode ? { failureCode: outcome.failureCode } : {}),
  };
  return { ...evidence, evidenceId: evidenceId(evidence) };
}

function resourceDelta(start) {
  const end = resourceUsage();
  return {
    cpuUserMicros: Math.max(0, end.userCPUTime - start.userCPUTime),
    cpuSystemMicros: Math.max(0, end.systemCPUTime - start.systemCPUTime),
    peakRssBytes: Math.max(0, end.maxRSS * 1024),
  };
}

export async function executeProof(request, fetchImpl = fetch) {
  const startedAt = performance.now();
  const usage = resourceUsage();
  const response = await fetchImpl(`http://proof.r2/${encodeURI(request.objectKey)}`, {
    headers: {
      "x-proof-object-version": request.objectVersion,
      "x-proof-expected-bytes": String(request.expectedBytes),
    },
  });

  if (!response.ok) {
    const code = response.headers.get("x-proof-failure-code") ?? "storage_unavailable";
    if (response.status >= 500) {
      return { terminal: false, failureCode: code, retryable: true };
    }
    const measurements = {
      streamedBytes: 0,
      wallClockMs: Math.round(performance.now() - startedAt),
      ...resourceDelta(usage),
    };
    return terminalEvidence(request, measurements, { status: "rejected", failureCode: code });
  }

  const streamed = await streamAndDigest(response.body, request.forceRetryAfterBytes);
  if (!streamed.terminal) return { ...streamed, retryable: true };
  const measurements = {
    ...streamed,
    wallClockMs: Math.round(performance.now() - startedAt),
    ...resourceDelta(usage),
  };
  const failureCode = streamed.streamedBytes !== request.expectedBytes ? "byte_count_mismatch" :
    streamed.computedSha256 !== request.expectedSha256 ? "digest_mismatch" :
      streamed.detectedMime !== request.expectedMime ? "unsupported_mime" : undefined;
  return terminalEvidence(
    request,
    measurements,
    failureCode ? { status: "rejected", failureCode } : { status: "passed" },
  );
}
