import { createServer } from "node:http";
import { executeProof, RESPONSE_LIMIT, validContainerRequest } from "./core.mjs";

let activeProofId;

function logServerStage(marker, proofId, fields = {}) {
  try {
    console.log(JSON.stringify({
      marker,
      timestamp: new Date().toISOString(),
      ...(proofId ? { proofId } : {}),
      ...fields,
    }));
  } catch {
    // Diagnostic logging must never alter proof execution.
  }
}

function boundedException(error) {
  return {
    exceptionName: error instanceof Error ? error.name : "UnknownError",
    exceptionMessage: (error instanceof Error ? error.message : "unknown_error").slice(0, 256),
  };
}

function send(response, status, body) {
  const encoded = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json",
    "content-length": String(encoded.byteLength),
  });
  response.end(encoded);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.byteLength;
    if (size > RESPONSE_LIMIT) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

logServerStage("SERVER_BOOT");

createServer(async (request, response) => {
  const admissionHeader = typeof request.headers["x-proof-admission-id"] === "string"
    ? request.headers["x-proof-admission-id"]
    : "";
  const headerProofId = /^proof-[a-f0-9]{64}$/.test(admissionHeader) ? admissionHeader : undefined;
  logServerStage("REQUEST_RECEIVED", headerProofId);
  if (request.method === "GET" && request.url === "/health") {
    logServerStage("REQUEST_COMPLETE", headerProofId, { httpStatus: 200 });
    return send(response, 200, { status: "ok", executor: "container-standard-1" });
  }
  if (request.method !== "POST" || request.url !== "/hash") {
    logServerStage("REQUEST_COMPLETE", headerProofId, { httpStatus: 404 });
    return send(response, 404, { error: "not_found" });
  }
  logServerStage("REQUEST_HASH_ROUTE", headerProofId);

  let input;
  try {
    input = await readJson(request);
  } catch (error) {
    logServerStage("REQUEST_EXCEPTION", headerProofId, {
      failureCode: "invalid_request",
      ...boundedException(error),
    });
    logServerStage("REQUEST_COMPLETE", headerProofId, { httpStatus: 400 });
    return send(response, 400, { error: "invalid_request" });
  }
  const admissionId = request.headers["x-proof-admission-id"];
  if (!validContainerRequest(input) || admissionId !== input.proofId) {
    logServerStage("REQUEST_COMPLETE", headerProofId, { httpStatus: 400 });
    return send(response, 400, { error: "invalid_request" });
  }
  if (activeProofId !== undefined) {
    logServerStage("REQUEST_COMPLETE", headerProofId, { httpStatus: 409 });
    return send(response, 409, { terminal: false, error: "container_busy", activeProofId });
  }

  activeProofId = input.proofId;
  try {
    const result = await executeProof(input);
    const status = result.terminal ? 200 : 503;
    logServerStage("REQUEST_COMPLETE", input.proofId, { httpStatus: status });
    return send(response, status, result);
  } catch (error) {
    logServerStage("REQUEST_EXCEPTION", input.proofId, {
      failureCode: "container_execution_failed",
      ...boundedException(error),
    });
    logServerStage("REQUEST_COMPLETE", input.proofId, { httpStatus: 503 });
    return send(response, 503, {
      terminal: false,
      retryable: true,
      failureCode: "container_execution_failed",
      message: error instanceof Error ? error.message : "unknown_error",
    });
  } finally {
    activeProofId = undefined;
  }
}).listen(8080, "0.0.0.0", () => {
  logServerStage("SERVER_LISTEN");
});
