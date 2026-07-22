import { createServer } from "node:http";
import { executeProof, RESPONSE_LIMIT, validContainerRequest } from "./core.mjs";

let activeProofId;

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

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return send(response, 200, { status: "ok", executor: "container-standard-1" });
  }
  if (request.method !== "POST" || request.url !== "/hash") {
    return send(response, 404, { error: "not_found" });
  }

  let input;
  try {
    input = await readJson(request);
  } catch {
    return send(response, 400, { error: "invalid_request" });
  }
  const admissionId = request.headers["x-proof-admission-id"];
  if (!validContainerRequest(input) || admissionId !== input.proofId) {
    return send(response, 400, { error: "invalid_request" });
  }
  if (activeProofId !== undefined) {
    return send(response, 409, { terminal: false, error: "container_busy", activeProofId });
  }

  activeProofId = input.proofId;
  try {
    const result = await executeProof(input);
    return send(response, result.terminal ? 200 : 503, result);
  } catch (error) {
    return send(response, 503, {
      terminal: false,
      retryable: true,
      failureCode: "container_execution_failed",
      message: error instanceof Error ? error.message : "unknown_error",
    });
  } finally {
    activeProofId = undefined;
  }
}).listen(8080, "0.0.0.0");
