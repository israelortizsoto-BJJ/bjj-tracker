/**
 * Memory-bounded complete-object R2 inspector for Production Verification.
 *
 * Consumes one ReadableStream through a manual chunk loop while maintaining:
 *   - an independent byte counter
 *   - only the bounded MIME prefix (MIME_PREFIX_LIMIT)
 *   - crypto.DigestStream("SHA-256")
 *
 * Never uses Body.arrayBuffer, a complete chunk accumulator, or ReadableStream.tee.
 * Reader and digest failures map to operational STORAGE_READ_TRANSIENT.
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

type DigestStreamLike = WritableStream<ArrayBuffer | ArrayBufferView> & {
  readonly digest: Promise<ArrayBuffer>;
};

type CryptoWithDigestStream = Crypto & {
  DigestStream: new (algorithm: string) => DigestStreamLike;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requireDigestStream(): new (algorithm: string) => DigestStreamLike {
  const digestStream = (crypto as CryptoWithDigestStream).DigestStream;
  if (typeof digestStream !== "function") {
    throw new Error("crypto.DigestStream is unavailable in this runtime");
  }
  return digestStream;
}

/**
 * Single-pass stream inspection: byte count + MIME prefix + SHA-256 via DigestStream.
 */
async function consumeBodyBounded(
  body: ReadableStream<Uint8Array>,
): Promise<{ observedByteCount: number; mimePrefix: Uint8Array; calculatedSha256: string }> {
  const DigestStreamCtor = requireDigestStream();
  const digestStream = new DigestStreamCtor("SHA-256");
  const writer = digestStream.getWriter();
  const digestPromise = digestStream.digest;

  const prefix = new Uint8Array(MIME_PREFIX_LIMIT);
  let prefixLength = 0;
  let observedByteCount = 0;
  const reader = body.getReader();

  try {
    while (true) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (error) {
        try {
          await writer.abort(error);
        } catch {
          // Prefer the reader failure as the operational signal.
        }
        await digestPromise.catch(() => undefined);
        throw error;
      }

      const { done, value } = readResult;
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      observedByteCount += value.byteLength;

      const remaining = MIME_PREFIX_LIMIT - prefixLength;
      if (remaining > 0) {
        const take = Math.min(remaining, value.byteLength);
        prefix.set(value.subarray(0, take), prefixLength);
        prefixLength += take;
      }

      try {
        await writer.write(value);
      } catch (error) {
        try {
          await reader.cancel(error);
        } catch {
          // Prefer the digest/write failure as the operational signal.
        }
        await digestPromise.catch(() => undefined);
        throw error;
      }
    }

    try {
      await writer.close();
    } catch (error) {
      await digestPromise.catch(() => undefined);
      throw error;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader may already be released after cancel.
    }
  }

  let digest: ArrayBuffer;
  try {
    digest = await digestPromise;
  } catch (error) {
    throw error;
  }

  return {
    observedByteCount,
    mimePrefix: prefix.slice(0, prefixLength),
    calculatedSha256: bytesToHex(new Uint8Array(digest)),
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

  let material: {
    observedByteCount: number;
    mimePrefix: Uint8Array;
    calculatedSha256: string;
  };
  try {
    material = await consumeBodyBounded(object.body);
  } catch (error) {
    return {
      code: "STORAGE_READ_TRANSIENT",
      message: error instanceof Error ? error.message : "stream or digest failed",
      retryable: true,
    };
  }

  return {
    observedByteCount: material.observedByteCount,
    calculatedSha256: material.calculatedSha256,
    mimePrefix: material.mimePrefix,
    objectVersion: object.version ?? head.version ?? null,
    r2ContentType: object.httpMetadata?.contentType ?? head.httpMetadata?.contentType ?? null,
    headSize: head.size,
  };
}
