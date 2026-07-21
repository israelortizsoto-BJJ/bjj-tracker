import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import {
  ProofFailure,
  bytesToHex,
  createStreamTap,
  detectBoundedMime,
  isProofRequest,
  proofIdentity,
  redactObjectIdentity,
  validBenchmarkObjectKey,
  validMultipartUploadId,
  type ProofRequest,
} from "./proofCore";

type ProofEvidence = {
  proofId: string;
  objectIdentityHash: string;
  objectVersion: string;
  expectedBytes: number;
  streamedBytes: number;
  expectedSha256: string;
  computedSha256: string;
  detectedMime: string;
  wallClockMs: number;
  hashAttempt: number;
  bytesReread: number;
  result: "passed";
  harnessVersion: string;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function authorized(request: Request, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(secret);
  const suppliedBytes = encoder.encode(supplied);
  if (expectedBytes.byteLength !== suppliedBytes.byteLength) return false;
  return crypto.subtle.timingSafeEqual(expectedBytes, suppliedBytes);
}

export class VerificationProofWorkflow extends WorkflowEntrypoint<Env, ProofRequest> {
  async run(event: Readonly<WorkflowEvent<ProofRequest>>, step: WorkflowStep): Promise<ProofEvidence> {
    const request = event.payload;
    const proofId = await proofIdentity(request);
    return step.do(
      "stream-r2-and-compute-sha256",
      {
        retries: { limit: 2, delay: "2 seconds", backoff: "constant" },
        timeout: "30 minutes",
      },
      async (context) => {
        const startedAt = Date.now();
        const head = await this.env.PROOF_MEDIA.head(request.objectKey);
        if (!head) throw new ProofFailure("missing_object", "benchmark object is missing", false);
        if (head.version !== request.objectVersion) {
          throw new ProofFailure("object_version_mismatch", "benchmark object version changed", false);
        }
        if (head.size !== request.expectedBytes) {
          throw new ProofFailure("object_size_mismatch", "provider size differs from manifest", false);
        }

        const object = await this.env.PROOF_MEDIA.get(request.objectKey);
        if (!object) throw new ProofFailure("missing_object", "benchmark object disappeared", true);
        if (object.version !== request.objectVersion) {
          throw new ProofFailure("object_version_mismatch", "stream version differs from manifest", false);
        }

        const forcedFailure = context.attempt === 1 ? request.forceRetryAfterBytes : undefined;
        const tap = createStreamTap(undefined, forcedFailure);
        const digestStream = new crypto.DigestStream("SHA-256");
        try {
          await object.body.pipeThrough(tap.stream).pipeTo(digestStream);
        } catch (error) {
          console.error(JSON.stringify({
            event: "verification-proof-hash-attempt-failed",
            proofId,
            attempt: context.attempt,
            bytesRead: tap.bytesRead(),
            retryable: error instanceof ProofFailure ? error.retryable : true,
          }));
          throw error;
        }

        const computedSha256 = bytesToHex(new Uint8Array(await digestStream.digest));
        const streamedBytes = tap.bytesRead();
        const digestBytes = Number(digestStream.bytesWritten);
        if (streamedBytes !== request.expectedBytes || digestBytes !== request.expectedBytes) {
          throw new ProofFailure("byte_count_mismatch", "streamed byte count differs from manifest", false);
        }
        const detectedMime = detectBoundedMime(tap.prefix());
        if (detectedMime !== request.expectedMime) {
          throw new ProofFailure("unsupported_mime", "bounded prefix did not identify expected MIME", false);
        }
        if (computedSha256 !== request.expectedSha256) {
          throw new ProofFailure("digest_mismatch", "computed digest differs from independent control", false);
        }

        const evidence: ProofEvidence = {
          proofId,
          objectIdentityHash: await redactObjectIdentity(request.objectKey),
          objectVersion: object.version,
          expectedBytes: request.expectedBytes,
          streamedBytes,
          expectedSha256: request.expectedSha256,
          computedSha256,
          detectedMime,
          wallClockMs: Date.now() - startedAt,
          hashAttempt: context.attempt,
          bytesReread: forcedFailure === undefined && context.attempt > 1
            ? request.forceRetryAfterBytes ?? request.expectedBytes
            : 0,
          result: "passed",
          harnessVersion: request.harnessVersion,
        };
        console.log(JSON.stringify({ event: "verification-proof-complete", ...evidence }));
        return evidence;
      },
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ service: "verification-runtime-proof", enabled: String(env.PROOF_ENABLED) === "1" });
    }
    if (String(env.PROOF_ENABLED) !== "1") return json({ error: "not_found" }, 404);
    if (!(await authorized(request, env.PROOF_TRIGGER_SECRET))) {
      return json({ error: "unauthorized" }, 401);
    }

    if (request.method === "POST" && url.pathname === "/seed/start") {
      const body: unknown = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "invalid_request" }, 400);
      const input = body as Record<string, unknown>;
      if (
        !validBenchmarkObjectKey(input.objectKey) ||
        typeof input.expectedBytes !== "number" ||
        !Number.isSafeInteger(input.expectedBytes) ||
        ![1, 5, 10, 20].some((gib) => input.expectedBytes === gib * 1024 * 1024 * 1024) ||
        typeof input.expectedSha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(input.expectedSha256)
      ) return json({ error: "invalid_request" }, 400);
      const upload = await env.PROOF_MEDIA.createMultipartUpload(input.objectKey, {
        httpMetadata: { contentType: "video/mp4" },
        customMetadata: {
          harnessVersion: env.PROOF_HARNESS_VERSION,
          expectedBytes: String(input.expectedBytes),
          expectedSha256: input.expectedSha256,
        },
      });
      return json({ uploadId: upload.uploadId, accepted: true }, 201);
    }

    if (request.method === "PUT" && url.pathname === "/seed/part") {
      const objectKey = request.headers.get("x-proof-object-key");
      const uploadId = request.headers.get("x-proof-upload-id");
      const partNumber = Number(request.headers.get("x-proof-part-number"));
      const contentLength = Number(request.headers.get("content-length"));
      if (
        !validBenchmarkObjectKey(objectKey) ||
        !validMultipartUploadId(uploadId) ||
        !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 ||
        !Number.isSafeInteger(contentLength) || contentLength < 5 * 1024 * 1024 ||
        contentLength > 128 * 1024 * 1024 ||
        !request.body
      ) return json({ error: "invalid_request" }, 400);
      const multipart = env.PROOF_MEDIA.resumeMultipartUpload(objectKey, uploadId);
      const part = await multipart.uploadPart(partNumber, request.body);
      return json({ partNumber: part.partNumber, etag: part.etag });
    }

    if (request.method === "POST" && url.pathname === "/seed/complete") {
      const body: unknown = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "invalid_request" }, 400);
      const input = body as Record<string, unknown>;
      if (
        !validBenchmarkObjectKey(input.objectKey) ||
        !validMultipartUploadId(input.uploadId) ||
        !Array.isArray(input.parts) || input.parts.length === 0 || input.parts.length > 10000 ||
        !input.parts.every((part) => part && typeof part === "object" &&
          Number.isInteger((part as Record<string, unknown>).partNumber) &&
          typeof (part as Record<string, unknown>).etag === "string")
      ) return json({ error: "invalid_request" }, 400);
      const multipart = env.PROOF_MEDIA.resumeMultipartUpload(input.objectKey, input.uploadId);
      const completed = await multipart.complete(input.parts as R2UploadedPart[]);
      return json({
        objectVersion: completed.version,
        size: completed.size,
        etag: completed.etag,
        objectIdentityHash: await redactObjectIdentity(input.objectKey),
      });
    }

    if (request.method === "POST" && url.pathname === "/trigger") {
      const body: unknown = await request.json().catch(() => null);
      if (!isProofRequest(body)) return json({ error: "invalid_request" }, 400);
      const id = await proofIdentity(body);
      try {
        const instance = await env.VERIFICATION_PROOF.create({
          id,
          params: body,
          retention: { successRetention: "3 days", errorRetention: "3 days" },
        });
        return json({ id: instance.id, duplicate: false, status: "accepted" }, 202);
      } catch {
        const instance = await env.VERIFICATION_PROOF.get(id);
        const status = await instance.status();
        return json({ id, duplicate: true, status: status.status }, 200);
      }
    }

    const statusMatch = url.pathname.match(/^\/status\/(proof-[a-f0-9]{64})$/);
    if (request.method === "GET" && statusMatch) {
      const instance = await env.VERIFICATION_PROOF.get(statusMatch[1]);
      const status = await instance.status();
      return json({ id: statusMatch[1], ...status });
    }
    return json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
