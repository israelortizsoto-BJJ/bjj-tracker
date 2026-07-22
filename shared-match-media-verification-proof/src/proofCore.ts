export const MIME_PREFIX_LIMIT = 4096;
export const HARNESS_VERSION = "verification-container-runtime-proof-v1";

export type ProofFailureCode =
  | "disabled"
  | "unauthorized"
  | "invalid_request"
  | "missing_object"
  | "object_version_mismatch"
  | "object_size_mismatch"
  | "stream_failed"
  | "byte_count_mismatch"
  | "digest_mismatch"
  | "unsupported_mime"
  | "admission_busy"
  | "admission_release_failed"
  | "container_execution_failed";

export class ProofFailure extends Error {
  readonly code: ProofFailureCode;
  readonly retryable: boolean;

  constructor(
    code: ProofFailureCode,
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = "ProofFailure";
    this.code = code;
    this.retryable = retryable;
  }
}

export type ProofRequest = {
  objectKey: string;
  objectVersion: string;
  expectedBytes: number;
  expectedSha256: string;
  expectedMime: "video/mp4";
  harnessVersion: string;
  forceRetryAfterBytes?: number;
};

export function isProofRequest(value: unknown): value is ProofRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  return (
    validBenchmarkObjectKey(request.objectKey) &&
    typeof request.objectVersion === "string" &&
    request.objectVersion.length > 0 &&
    typeof request.expectedBytes === "number" &&
    Number.isSafeInteger(request.expectedBytes) &&
    request.expectedBytes === benchmarkExpectedBytes(request.objectKey) &&
    typeof request.expectedSha256 === "string" &&
    /^[a-f0-9]{64}$/.test(request.expectedSha256) &&
    request.expectedMime === "video/mp4" &&
    request.harnessVersion === HARNESS_VERSION &&
    (request.forceRetryAfterBytes === undefined ||
      (typeof request.forceRetryAfterBytes === "number" &&
        Number.isSafeInteger(request.forceRetryAfterBytes) &&
        request.forceRetryAfterBytes > 0 &&
        request.forceRetryAfterBytes < request.expectedBytes))
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function proofIdentity(request: ProofRequest): Promise<string> {
  const material = [
    request.objectKey,
    request.objectVersion,
    request.expectedSha256,
    request.harnessVersion,
    request.forceRetryAfterBytes ?? 0,
  ].join("\n");
  return `proof-${await sha256Hex(material)}`;
}

export function bytesToHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

export function detectBoundedMime(prefix: Uint8Array): "video/mp4" | "unknown" {
  if (prefix.byteLength < 12) return "unknown";
  const box = String.fromCharCode(prefix[4], prefix[5], prefix[6], prefix[7]);
  if (box !== "ftyp") return "unknown";
  const brand = String.fromCharCode(prefix[8], prefix[9], prefix[10], prefix[11]);
  return ["isom", "iso2", "mp41", "mp42", "qt  "].includes(brand)
    ? "video/mp4"
    : "unknown";
}

export type StreamTap = {
  stream: TransformStream<Uint8Array, Uint8Array>;
  bytesRead: () => number;
  prefix: () => Uint8Array;
};

export function createStreamTap(
  prefixLimit = MIME_PREFIX_LIMIT,
  failAfterBytes?: number,
): StreamTap {
  let count = 0;
  const prefix = new Uint8Array(prefixLimit);
  let prefixLength = 0;
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      count += chunk.byteLength;
      const remaining = prefixLimit - prefixLength;
      if (remaining > 0) {
        const take = Math.min(remaining, chunk.byteLength);
        prefix.set(chunk.subarray(0, take), prefixLength);
        prefixLength += take;
      }
      if (failAfterBytes !== undefined && count >= failAfterBytes) {
        throw new ProofFailure("stream_failed", "forced retryable stream failure", true);
      }
      controller.enqueue(chunk);
    },
  });
  return {
    stream,
    bytesRead: () => count,
    prefix: () => prefix.slice(0, prefixLength),
  };
}

export function redactObjectIdentity(objectKey: string): Promise<string> {
  return sha256Hex(`object-key\n${objectKey}`);
}

export function validBenchmarkObjectKey(value: unknown): value is string {
  return typeof value === "string" && /^benchmarks\/(1|5|10|20)gib-v1\.mp4$/.test(value);
}

export function benchmarkExpectedBytes(objectKey: string): number | undefined {
  const match = /^benchmarks\/(1|5|10|20)gib-v1\.mp4$/.exec(objectKey);
  return match ? Number(match[1]) * 1024 * 1024 * 1024 : undefined;
}

export function validMultipartUploadId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{16,512}$/.test(value);
}
