import {
  DurableObject,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import {
  Container,
  ContainerProxy,
  getContainer,
  type OutboundHandler,
} from "@cloudflare/containers";
import {
  decideAdmission,
  decideRelease,
  admissionPermitsContainer,
  isContainerTerminalEvidence,
  type AdmissionDecision,
  type ContainerTerminalEvidence,
  type ReleaseDecision,
} from "./admissionCore";
import {
  ProofFailure,
  benchmarkExpectedBytes,
  isProofRequest,
  proofIdentity,
  redactObjectIdentity,
  validBenchmarkObjectKey,
  validMultipartUploadId,
  type ProofRequest,
} from "./proofCore";
import { createOrGetDeterministicWorkflow } from "./triggerCore";

type AdmissionRecord = {
  activeProofId: string;
  state: "admitted";
};

type ContainerProofRequest = ProofRequest & {
  proofId: string;
  attempt: number;
  retryBytes: number;
};

const ADMISSION_SINGLETON = "global-verification-runtime";
const CONTAINER_SINGLETON = "global-verification-executor";
const CONTAINER_RESPONSE_LIMIT = 64 * 1024;

function validProofId(value: string): boolean {
  return /^proof-[a-f0-9]{64}$/.test(value);
}

export class VerificationProofAdmission extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS proof_admission (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          active_proof_id TEXT NOT NULL,
          state TEXT NOT NULL CHECK (state = 'admitted')
        )
      `);
    });
  }

  acquire(proofId: string): AdmissionDecision {
    if (!validProofId(proofId)) throw new Error("invalid proof identity");
    const active = this.current();
    const decision = decideAdmission(active?.activeProofId, proofId);
    if (decision.outcome === "admitted" && !decision.idempotent) {
      this.ctx.storage.sql.exec(
        "INSERT INTO proof_admission (singleton, active_proof_id, state) VALUES (1, ?, 'admitted')",
        proofId,
      );
    }
    return decision;
  }

  owns(proofId: string): boolean {
    return this.current()?.activeProofId === proofId;
  }

  release(proofId: string, evidence: unknown): ReleaseDecision {
    const active = this.current();
    const decision = decideRelease(active?.activeProofId, proofId, evidence);
    if (decision.outcome === "released") {
      this.ctx.storage.sql.exec(
        "DELETE FROM proof_admission WHERE singleton = 1 AND active_proof_id = ?",
        proofId,
      );
    }
    return decision;
  }

  status(): AdmissionRecord | undefined {
    return this.current();
  }

  private current(): AdmissionRecord | undefined {
    const row = this.ctx.storage.sql.exec<{ active_proof_id: string }>(
      "SELECT active_proof_id FROM proof_admission WHERE singleton = 1",
    ).toArray()[0];
    return row ? { activeProofId: row.active_proof_id, state: "admitted" } : undefined;
  }
}

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
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  return crypto.subtle.timingSafeEqual(expectedHash, suppliedHash);
}

function r2Failure(code: string, status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-proof-failure-code": code,
    },
  });
}

const proofR2BindingOutbound: OutboundHandler<Env> = async (request, env) => {
  let logContext: Record<string, string | number | undefined> = {};
  const logStage = (
    marker: string,
    fields: Record<string, string | number | undefined> = {},
  ): void => {
    try {
      console.log(JSON.stringify({
        marker,
        timestamp: new Date().toISOString(),
        ...logContext,
        ...fields,
      }));
    } catch {
      // Diagnostic logging must never alter proof execution.
    }
  };
  const exceptionFields = (error: unknown): { exceptionName: string; exceptionMessage: string } => ({
    exceptionName: error instanceof Error ? error.name : "UnknownError",
    exceptionMessage: (error instanceof Error ? error.message : "unknown_error").slice(0, 256),
  });

  logStage("R2_STAGE_00_HANDLER_ENTER");
  if (request.method !== "GET") {
    logStage("R2_STAGE_FAIL_VALIDATION", { failureCode: "method_not_allowed" });
    return r2Failure("method_not_allowed", 405);
  }
  const url = new URL(request.url);
  const objectKey = decodeURIComponent(url.pathname.slice(1));
  const expectedVersion = request.headers.get("x-proof-object-version");
  const expectedBytes = Number(request.headers.get("x-proof-expected-bytes"));
  logContext = {
    objectKey: validBenchmarkObjectKey(objectKey) ? objectKey : "invalid_benchmark_object",
    expectedVersion: expectedVersion && expectedVersion.length <= 256 ? expectedVersion : "invalid_version",
    expectedBytes,
  };
  if (
    !validBenchmarkObjectKey(objectKey) ||
    !expectedVersion || expectedVersion.length > 256 ||
    expectedBytes !== benchmarkExpectedBytes(objectKey)
  ) {
    logStage("R2_STAGE_FAIL_VALIDATION", { failureCode: "invalid_request" });
    return r2Failure("invalid_request", 400);
  }

  let operation: "head" | "get" = "head";
  try {
    logStage("R2_STAGE_01_HEAD_BEGIN");
    const head = await env.PROOF_MEDIA.head(objectKey);
    if (!head) {
      logStage("R2_STAGE_FAIL_HEAD_MISSING", { failureCode: "missing_object" });
      return r2Failure("missing_object", 404);
    }
    logStage("R2_STAGE_02_HEAD_SUCCESS", {
      observedVersion: head.version,
      observedBytes: head.size,
    });
    if (head.version !== expectedVersion) {
      logStage("R2_STAGE_FAIL_VALIDATION", {
        observedVersion: head.version,
        observedBytes: head.size,
        failureCode: "object_version_mismatch",
      });
      return r2Failure("object_version_mismatch", 409);
    }
    if (head.size !== expectedBytes) {
      logStage("R2_STAGE_FAIL_VALIDATION", {
        observedVersion: head.version,
        observedBytes: head.size,
        failureCode: "object_size_mismatch",
      });
      return r2Failure("object_size_mismatch", 422);
    }
    logStage("R2_STAGE_03_VALIDATION_SUCCESS", {
      observedVersion: head.version,
      observedBytes: head.size,
    });

    operation = "get";
    logStage("R2_STAGE_04_GET_BEGIN");
    const object = await env.PROOF_MEDIA.get(objectKey);
    if (!object) {
      logStage("R2_STAGE_FAIL_GET_MISSING", { failureCode: "missing_object" });
      return r2Failure("missing_object", 404);
    }
    logStage("R2_STAGE_05_GET_SUCCESS", {
      observedVersion: object.version,
      observedBytes: object.size,
    });
    if (object.version !== expectedVersion) {
      logStage("R2_STAGE_FAIL_VALIDATION", {
        observedVersion: object.version,
        observedBytes: object.size,
        failureCode: "object_version_mismatch",
      });
      return r2Failure("object_version_mismatch", 409);
    }
    const streamedResponse = new Response(object.body, {
      headers: {
        "cache-control": "no-store",
        "content-length": String(object.size),
        "content-type": "video/mp4",
        "x-proof-object-version": object.version,
      },
    });
    logStage("R2_STAGE_06_STREAM_RESPONSE_RETURNED", {
      observedVersion: object.version,
      observedBytes: object.size,
      contentType: "video/mp4",
    });
    return streamedResponse;
  } catch (error) {
    logStage(operation === "head" ? "R2_STAGE_FAIL_HEAD_EXCEPTION" : "R2_STAGE_FAIL_GET_EXCEPTION", {
      failureCode: "storage_unavailable",
      ...exceptionFields(error),
    });
    return r2Failure("storage_unavailable", 503);
  }
};

export class VerificationProofContainer extends Container<Env> {
  static outboundByHost = {
    "proof.r2": proofR2BindingOutbound,
  };

  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "1m";
  enableInternet = false;
  pingEndpoint = "localhost/health";

  override async fetch(request: Request): Promise<Response> {
    const proofId = request.headers.get("x-proof-admission-id") ?? "";
    if (!validProofId(proofId)) return json({ error: "invalid_admission_identity" }, 400);
    const admission = this.env.PROOF_ADMISSION.getByName(ADMISSION_SINGLETON);
    if (!(await admission.owns(proofId))) {
      return json({ error: "proof_not_admitted", retryable: false }, 409);
    }
    return this.containerFetch(request);
  }
}

export { ContainerProxy };

async function readBoundedContainerResponse(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > CONTAINER_RESPONSE_LIMIT) {
    throw new Error("container response exceeded evidence limit");
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > CONTAINER_RESPONSE_LIMIT) {
    throw new Error("container response exceeded evidence limit");
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function invokeContainer(
  env: Env,
  request: ProofRequest,
  proofId: string,
  attempt: number,
): Promise<ContainerTerminalEvidence> {
  const payload: ContainerProofRequest = {
    ...request,
    proofId,
    attempt,
    retryBytes: request.forceRetryAfterBytes ?? 0,
    forceRetryAfterBytes: attempt === 1 ? request.forceRetryAfterBytes : undefined,
  };
  const container = getContainer(env.PROOF_CONTAINER, CONTAINER_SINGLETON);
  const response = await container.fetch(new Request("http://container/hash", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-proof-admission-id": proofId,
    },
    body: JSON.stringify(payload),
  }));
  const body = await readBoundedContainerResponse(response);
  if (isContainerTerminalEvidence(body, proofId)) return body;
  throw new Error(`container returned nonterminal response ${response.status}`);
}

async function acquireAdmission(
  admission: DurableObjectStub<VerificationProofAdmission>,
  proofId: string,
): Promise<AdmissionDecision> {
  const result = await admission.acquire(proofId);
  return result.outcome === "admitted"
    ? { outcome: "admitted", proofId: result.proofId, idempotent: result.idempotent }
    : { outcome: "busy", activeProofId: result.activeProofId };
}

async function releaseAdmission(
  admission: DurableObjectStub<VerificationProofAdmission>,
  proofId: string,
  evidence: ContainerTerminalEvidence,
): Promise<ReleaseDecision> {
  const result = await admission.release(proofId, evidence);
  switch (result.outcome) {
    case "released":
      return { outcome: "released", proofId: result.proofId, evidenceId: result.evidenceId };
    case "wrong_identity":
      return { outcome: "wrong_identity", activeProofId: result.activeProofId };
    case "no_active_admission":
      return { outcome: "no_active_admission" };
    case "terminal_evidence_required":
      return { outcome: "terminal_evidence_required" };
  }
}

export class VerificationProofWorkflow extends WorkflowEntrypoint<Env, ProofRequest> {
  async run(event: Readonly<WorkflowEvent<ProofRequest>>, step: WorkflowStep): Promise<ContainerTerminalEvidence> {
    const request = event.payload;
    const proofId = await proofIdentity(request);
    const admission = this.env.PROOF_ADMISSION.getByName(ADMISSION_SINGLETON);

    const acquired = await step.do(
      "acquire-global-verification-admission",
      { retries: { limit: 2, delay: "2 seconds", backoff: "constant" }, timeout: "1 minute" },
      () => acquireAdmission(admission, proofId),
    );
    if (acquired.outcome === "busy") {
      console.log(JSON.stringify({ event: "verification-proof-admission-busy", proofId }));
      throw new ProofFailure("admission_busy", "another verification runtime owns admission", false);
    }
    if (!admissionPermitsContainer(acquired, proofId)) {
      throw new ProofFailure("admission_busy", "admission identity mismatch", false);
    }

    let evidence: ContainerTerminalEvidence;
    try {
      evidence = await step.do(
        "invoke-container-verifier",
        { retries: { limit: 2, delay: "5 seconds", backoff: "constant" }, timeout: "30 minutes" },
        (context) => invokeContainer(this.env, request, proofId, context.attempt),
      );
    } catch (error) {
      console.error(JSON.stringify({
        event: "verification-proof-container-nonterminal-failure",
        proofId,
        message: error instanceof Error ? error.message : "unknown_error",
      }));
      throw error;
    }

    const released = await step.do(
      "release-global-verification-admission",
      { retries: { limit: 2, delay: "2 seconds", backoff: "constant" }, timeout: "1 minute" },
      () => releaseAdmission(admission, proofId, evidence),
    );
    if (released.outcome !== "released") {
      throw new ProofFailure("admission_release_failed", "terminal evidence did not release admission", false);
    }
    if (evidence.status !== "passed") {
      throw new ProofFailure(
        "container_execution_failed",
        evidence.failureCode ?? "container verification rejected the object",
        false,
      );
    }
    console.log(JSON.stringify({ event: "verification-proof-complete", ...evidence }));
    return evidence;
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
        input.expectedBytes !== benchmarkExpectedBytes(input.objectKey) ||
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
      const result = await createOrGetDeterministicWorkflow(env.VERIFICATION_PROOF, id, body);
      return json(result, result.duplicate ? 200 : 202);
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
