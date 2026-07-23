/** Certified transport-safe multipart part size (bytes). */
export const SHARED_MATCH_MEDIA_TRANSPORT_PART_BYTES = 99_000_000;

export type SharedMatchMediaUploadAssociations = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
};

export type SharedMatchMediaUploadCompleteResult = {
  matchMediaAssetId: string;
  objectVersion: string;
  uploadSessionId: string;
  status: "upload_complete";
  completedByteCount: number;
  completedAt: string;
  idempotentReplay: boolean;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  declaredMimeType: string;
  declaredByteCount: number;
  /** Device-local source only — never a cross-device media reference. */
  localSourceUri: string;
};

export type SharedMatchMediaUploadHttpResponse = {
  status: number;
  json: unknown;
};

export type SharedMatchMediaUploadHttp = (
  input: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: Uint8Array | string | null;
  },
) => Promise<SharedMatchMediaUploadHttpResponse>;

export type SharedMatchMediaLocalFile = {
  byteCount: number;
  mimeType: string;
  readPart(offset: number, length: number): Promise<Uint8Array>;
};

export type SharedMatchMediaUploadDependencies = {
  http: SharedMatchMediaUploadHttp;
  openLocalFile(localUri: string): Promise<SharedMatchMediaLocalFile>;
  sha256Hex(bytes: Uint8Array): Promise<string>;
  resolveApiBaseUrl(apiBaseUrlOverride?: string | null): string;
  transportPartBytes?: number;
};

export class SharedMatchMediaUploadClientError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "SharedMatchMediaUploadClientError";
    this.status = status;
  }
}

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
};

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 of the exact uploaded part bytes as lowercase hex.
 * Hermes-safe: never evaluates a bare `crypto` identifier (throws on RN).
 * Uses guarded Web Crypto when present; otherwise expo-crypto.digest on TypedArray bytes.
 */
export async function defaultSha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const subtle = globalThis.crypto?.subtle;
  if (subtle && typeof subtle.digest === "function") {
    const digest = await subtle.digest("SHA-256", copy);
    return bytesToHex(digest);
  }
  const { digest, CryptoDigestAlgorithm } = await import("expo-crypto");
  const digestBuffer = await digest(CryptoDigestAlgorithm.SHA256, copy);
  return bytesToHex(digestBuffer);
}

export async function defaultOpenLocalFile(localUri: string): Promise<SharedMatchMediaLocalFile> {
  const { File } = await import("expo-file-system");
  const normalized = localUri.startsWith("file://") ? localUri : `file://${localUri}`;
  const file = new File(normalized);
  if (!file.exists) {
    throw new SharedMatchMediaUploadClientError("Local match video is missing.");
  }
  const byteCount = file.size;
  if (!Number.isSafeInteger(byteCount) || byteCount <= 0) {
    throw new SharedMatchMediaUploadClientError("Local match video has invalid size.");
  }
  const ext = normalized.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "";
  const mimeType = VIDEO_MIME_BY_EXT[ext] ?? (file.type?.trim().toLowerCase() || "video/mp4");
  if (!["video/mp4", "video/quicktime", "video/webm"].includes(mimeType)) {
    throw new SharedMatchMediaUploadClientError(`Unsupported match video type: ${mimeType}`);
  }
  return {
    byteCount,
    mimeType,
    async readPart(offset: number, length: number): Promise<Uint8Array> {
      const handle = file.open();
      try {
        handle.offset = offset;
        const chunk = handle.readBytes(length);
        if (chunk.byteLength !== length) {
          throw new SharedMatchMediaUploadClientError(
            `Failed to read local video part at offset ${offset}.`,
          );
        }
        return chunk;
      } finally {
        handle.close();
      }
    },
  };
}

export async function defaultSharedMatchMediaUploadHttp(input: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Uint8Array | string | null;
}): Promise<SharedMatchMediaUploadHttpResponse> {
  const res = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body:
      input.body === undefined || input.body === null
        ? undefined
        : typeof input.body === "string"
          ? input.body
          : input.body.buffer.slice(
              input.body.byteOffset,
              input.body.byteOffset + input.body.byteLength,
            ) as ArrayBuffer,
  });
  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = text;
    }
  }
  return { status: res.status, json };
}

export function defaultResolveSharedMatchMediaApiBaseUrl(
  apiBaseUrlOverride?: string | null,
): string {
  const fromLink = apiBaseUrlOverride?.trim().replace(/\/+$/, "") ?? "";
  if (fromLink) return fromLink;
  // Lazy import keeps Node unit tests free of Expo Constants resolution.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getCoachSyncApiBaseUrl } = require("../config/coachSync") as {
    getCoachSyncApiBaseUrl: () => string | null;
  };
  const fromEnv = getCoachSyncApiBaseUrl();
  if (fromEnv) return fromEnv;
  throw new SharedMatchMediaUploadClientError("Coach sync is not configured on this build.");
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  return `HTTP ${status}`;
}

function requireOk(
  response: SharedMatchMediaUploadHttpResponse,
  allowed: number[],
): Record<string, unknown> {
  if (!allowed.includes(response.status)) {
    throw new SharedMatchMediaUploadClientError(
      errorMessage(response.json, response.status),
      response.status,
    );
  }
  if (!response.json || typeof response.json !== "object" || Array.isArray(response.json)) {
    throw new SharedMatchMediaUploadClientError(
      "Unexpected Shared Match Media upload response.",
      response.status,
    );
  }
  return response.json as Record<string, unknown>;
}

function authHeaders(parentWriterSecret: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${parentWriterSecret}`,
    Accept: "application/json",
    ...(extra ?? {}),
  };
}

export function buildSharedMatchMediaPartPlan(
  declaredByteCount: number,
  transportPartBytes = SHARED_MATCH_MEDIA_TRANSPORT_PART_BYTES,
): Array<{ partNumber: number; offset: number; byteCount: number }> {
  if (!Number.isSafeInteger(declaredByteCount) || declaredByteCount <= 0) {
    throw new SharedMatchMediaUploadClientError("Invalid declared video byte count.");
  }
  if (!Number.isSafeInteger(transportPartBytes) || transportPartBytes <= 0) {
    throw new SharedMatchMediaUploadClientError("Invalid transport part size.");
  }
  if (declaredByteCount <= transportPartBytes) {
    return [{ partNumber: 1, offset: 0, byteCount: declaredByteCount }];
  }
  const parts: Array<{ partNumber: number; offset: number; byteCount: number }> = [];
  let offset = 0;
  let partNumber = 1;
  while (offset < declaredByteCount) {
    const remaining = declaredByteCount - offset;
    const byteCount = Math.min(transportPartBytes, remaining);
    parts.push({ partNumber, offset, byteCount });
    offset += byteCount;
    partNumber += 1;
  }
  return parts;
}

/**
 * Parent Shared Match Media upload client.
 * Reaches upload_complete only. Does not verify, publish, resolve, or play.
 */
export async function uploadParentSharedMatchMediaVideo(input: {
  linkToken: string;
  parentWriterSecret: string;
  localUri: string;
  associations: SharedMatchMediaUploadAssociations;
  idempotencyKey?: string;
  apiBaseUrlOverride?: string | null;
  dependencies?: Partial<SharedMatchMediaUploadDependencies>;
}): Promise<SharedMatchMediaUploadCompleteResult> {
  const http = input.dependencies?.http ?? defaultSharedMatchMediaUploadHttp;
  const openLocalFile = input.dependencies?.openLocalFile ?? defaultOpenLocalFile;
  const sha256Hex = input.dependencies?.sha256Hex ?? defaultSha256Hex;
  const resolveApiBaseUrl =
    input.dependencies?.resolveApiBaseUrl ?? defaultResolveSharedMatchMediaApiBaseUrl;
  const transportPartBytes =
    input.dependencies?.transportPartBytes ?? SHARED_MATCH_MEDIA_TRANSPORT_PART_BYTES;

  const sharedAthleteId = input.associations.sharedAthleteId.trim();
  const sharedCompetitionId = input.associations.sharedCompetitionId.trim();
  const matchLineageKey = input.associations.matchLineageKey.trim();
  if (!sharedAthleteId || !sharedCompetitionId || !matchLineageKey) {
    throw new SharedMatchMediaUploadClientError(
      "Shared Match Media upload requires athlete, competition, and match associations.",
    );
  }
  const localUri = input.localUri.trim();
  if (!localUri || /^https?:\/\//i.test(localUri)) {
    throw new SharedMatchMediaUploadClientError(
      "Shared Match Media upload requires a device-local video URI.",
    );
  }

  const file = await openLocalFile(localUri);
  const base = resolveApiBaseUrl(input.apiBaseUrlOverride);
  const enc = encodeURIComponent(input.linkToken);
  const intentPath = `/v1/sessions/${enc}/match-media/uploads`;
  const intentUrl = joinUrl(base, intentPath);

  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    [
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      String(file.byteCount),
      file.mimeType,
    ].join(":");

  const intentResponse = await http({
    method: "POST",
    url: intentUrl,
    headers: authHeaders(input.parentWriterSecret, {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 160),
    }),
    body: JSON.stringify({
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      declaredMimeType: file.mimeType,
      declaredByteCount: file.byteCount,
    }),
  });
  const intentBody = requireOk(intentResponse, [200, 201]);
  const asset = intentBody.asset as Record<string, unknown> | undefined;
  const uploadSession = intentBody.uploadSession as Record<string, unknown> | undefined;
  const matchMediaAssetId =
    typeof asset?.matchMediaAssetId === "string" ? asset.matchMediaAssetId.trim() : "";
  const uploadSessionId =
    typeof uploadSession?.uploadSessionId === "string"
      ? uploadSession.uploadSessionId.trim()
      : "";
  if (!matchMediaAssetId || !uploadSessionId) {
    throw new SharedMatchMediaUploadClientError(
      "Upload intent missing asset or session identity.",
      intentResponse.status,
    );
  }

  const partPlan = buildSharedMatchMediaPartPlan(file.byteCount, transportPartBytes);
  for (const part of partPlan) {
    const partBytes = await file.readPart(part.offset, part.byteCount);
    const sha256 = await sha256Hex(partBytes);
    const partPath =
      `/v1/sessions/${enc}/match-media/uploads/${encodeURIComponent(uploadSessionId)}` +
      `/parts/${part.partNumber}?assetId=${encodeURIComponent(matchMediaAssetId)}`;
    const partUrl = joinUrl(base, partPath);
    const partResponse = await http({
      method: "PUT",
      url: partUrl,
      headers: authHeaders(input.parentWriterSecret, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(part.byteCount),
        "X-MatMind-Part-Bytes": String(part.byteCount),
        "X-MatMind-Part-SHA256": sha256,
      }),
      body: partBytes,
    });
    requireOk(partResponse, [200, 201]);
  }

  const completePath =
    `/v1/sessions/${enc}/match-media/uploads/${encodeURIComponent(uploadSessionId)}` +
    `/complete?assetId=${encodeURIComponent(matchMediaAssetId)}`;
  const completeUrl = joinUrl(base, completePath);
  const completeResponse = await http({
    method: "POST",
    url: completeUrl,
    headers: authHeaders(input.parentWriterSecret),
  });
  const completeBody = requireOk(completeResponse, [200, 201]);
  const completedSession = completeBody.uploadSession as Record<string, unknown> | undefined;
  const completedAsset = completeBody.asset as Record<string, unknown> | undefined;
  const status =
    typeof completedSession?.status === "string" ? completedSession.status.trim() : "";
  const objectVersion =
    typeof completedSession?.objectVersion === "string"
      ? completedSession.objectVersion.trim()
      : "";
  const completedByteCount =
    typeof completedSession?.completedByteCount === "number"
      ? completedSession.completedByteCount
      : NaN;
  const completedAt =
    typeof completedSession?.completedAt === "string"
      ? completedSession.completedAt.trim()
      : "";
  const completedAssetId =
    typeof completedAsset?.matchMediaAssetId === "string"
      ? completedAsset.matchMediaAssetId.trim()
      : "";

  if (
    status !== "upload_complete" ||
    !objectVersion ||
    !completedAssetId ||
    completedAssetId !== matchMediaAssetId ||
    !Number.isSafeInteger(completedByteCount) ||
    completedByteCount !== file.byteCount ||
    !completedAt
  ) {
    throw new SharedMatchMediaUploadClientError(
      "Upload completion did not return immutable asset identity and object version.",
      completeResponse.status,
    );
  }

  return {
    matchMediaAssetId,
    objectVersion,
    uploadSessionId,
    status: "upload_complete",
    completedByteCount,
    completedAt,
    idempotentReplay: completeBody.idempotentReplay === true || intentBody.idempotentReplay === true,
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    declaredMimeType: file.mimeType,
    declaredByteCount: file.byteCount,
    localSourceUri: localUri,
  };
}
