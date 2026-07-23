/**
 * Complete-object R2 inspector for Production Verification.
 *
 * Streams the entire object once to calculate SHA-256 and independently count
 * bytes, while capturing a bounded prefix for MIME detection.
 */

import { MIME_PREFIX_LIMIT } from "../../../shared-match-media-production-verification/src/mimePolicy.ts";

export type InspectableR2Object = {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly size: number;
  readonly version?: string;
  readonly httpMetadata?: { contentType?: string };
};

export type InspectableR2Bucket = {
  get(key: string): Promise<InspectableR2Object | null>;
  head(key: string): Promise<{
    size: number;
    version?: string;
    httpMetadata?: { contentType?: string };
  } | null>;
};

export type ObjectInspectionResult = {
  readonly observedByteCount: number;
  readonly calculatedSha256: string;
  readonly mimePrefix: Uint8Array;
  readonly objectVersion: string | null;
  readonly r2ContentType: string | null;
  readonly headSize: number | null;
};

export type ObjectInspectionFailure = {
  readonly code:
    | "OBJECT_NOT_FOUND_AFTER_COMPLETION"
    | "OBJECT_VERSION_MISMATCH"
    | "STORAGE_READ_TRANSIENT";
  readonly message: string;
  readonly retryable: boolean;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

type StreamMaterial = {
  observedByteCount: number;
  mimePrefix: Uint8Array;
  bodyForDigest: Uint8Array;
};

async function collectStream(body: ReadableStream<Uint8Array>): Promise<StreamMaterial> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let observedByteCount = 0;
  const prefix = new Uint8Array(MIME_PREFIX_LIMIT);
  let prefixLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    chunks.push(value);
    observedByteCount += value.byteLength;
    const remaining = MIME_PREFIX_LIMIT - prefixLength;
    if (remaining > 0) {
      const take = Math.min(remaining, value.byteLength);
      prefix.set(value.subarray(0, take), prefixLength);
      prefixLength += take;
    }
  }

  const bodyForDigest = new Uint8Array(observedByteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bodyForDigest.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    observedByteCount,
    mimePrefix: prefix.slice(0, prefixLength),
    bodyForDigest,
  };
}

/**
 * Single full-object stream inspection for SHA-256, byte count, and MIME prefix.
 */
export async function inspectCompleteR2Object(
  bucket: InspectableR2Bucket,
  key: string,
  expectedObjectVersion: string,
): Promise<ObjectInspectionResult | ObjectInspectionFailure> {
  let head: Awaited<ReturnType<InspectableR2Bucket["head"]>>;
  try {
    head = await bucket.head(key);
  } catch (error) {
    return {
      code: "STORAGE_READ_TRANSIENT",
      message: error instanceof Error ? error.message : "head failed",
      retryable: true,
    };
  }

  if (!head) {
    return {
      code: "OBJECT_NOT_FOUND_AFTER_COMPLETION",
      message: "Object missing after upload_complete.",
      retryable: false,
    };
  }

  if (head.version && head.version !== expectedObjectVersion) {
    return {
      code: "OBJECT_VERSION_MISMATCH",
      message: "R2 object version does not match authoritative completion version.",
      retryable: false,
    };
  }

  let object: InspectableR2Object | null;
  try {
    object = await bucket.get(key);
  } catch (error) {
    return {
      code: "STORAGE_READ_TRANSIENT",
      message: error instanceof Error ? error.message : "get failed",
      retryable: true,
    };
  }

  if (!object || !object.body) {
    return {
      code: "OBJECT_NOT_FOUND_AFTER_COMPLETION",
      message: "Object body unavailable after upload_complete.",
      retryable: false,
    };
  }

  if (object.version && object.version !== expectedObjectVersion) {
    return {
      code: "OBJECT_VERSION_MISMATCH",
      message: "R2 object version does not match authoritative completion version.",
      retryable: false,
    };
  }

  let material: StreamMaterial;
  try {
    material = await collectStream(object.body);
  } catch (error) {
    return {
      code: "STORAGE_READ_TRANSIENT",
      message: error instanceof Error ? error.message : "stream failed",
      retryable: true,
    };
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    material.bodyForDigest.buffer.slice(
      material.bodyForDigest.byteOffset,
      material.bodyForDigest.byteOffset + material.bodyForDigest.byteLength,
    ) as ArrayBuffer,
  );

  return {
    observedByteCount: material.observedByteCount,
    calculatedSha256: bytesToHex(new Uint8Array(digest)),
    mimePrefix: material.mimePrefix,
    objectVersion: object.version ?? head.version ?? null,
    r2ContentType: object.httpMetadata?.contentType ?? head.httpMetadata?.contentType ?? null,
    headSize: head.size,
  };
}
