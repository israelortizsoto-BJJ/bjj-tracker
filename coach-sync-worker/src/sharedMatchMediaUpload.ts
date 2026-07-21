const MAX_INTENT_BODY_BYTES = 16 * 1024;
const MAX_IDEMPOTENCY_KEY_CHARS = 160;
const MAX_DOMAIN_ID_CHARS = 200;
const MAX_DECLARED_VIDEO_BYTES = 20 * 1024 * 1024 * 1024;
const UPLOAD_SESSION_LIFETIME_MS = 6 * 24 * 60 * 60 * 1000;

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export type SharedMatchMediaUploadStatus = "upload_pending";

export type SharedMatchMediaAsset = Readonly<{
  schemaVersion: 1;
  matchMediaAssetId: string;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  creatorAuthority: "parent";
  status: SharedMatchMediaUploadStatus;
  storageObjectKey: string;
  declaredMimeType: string;
  declaredByteCount: number;
  declaredSha256?: string;
  createdAt: string;
}>;

export type SharedMatchMediaUploadSession = Readonly<{
  schemaVersion: 1;
  uploadSessionId: string;
  matchMediaAssetId: string;
  provider: "r2_multipart";
  providerUploadId: string;
  status: SharedMatchMediaUploadStatus;
  createdAt: string;
  expiresAt: string;
}>;

type StoredUploadIntent = Readonly<{
  schemaVersion: 1;
  requestFingerprint: string;
  asset: SharedMatchMediaAsset;
  uploadSession: SharedMatchMediaUploadSession;
}>;

export type MatchMediaParentSession = Readonly<{
  parentWriterSecret?: string;
  athletes: ReadonlyArray<{ id: string }>;
  competitions: ReadonlyArray<{
    id: string;
    sharedAthleteId: string;
  }>;
  competitionTopologyByAthleteId: Readonly<
    Record<
      string,
      {
        competitions: ReadonlyArray<{
          sharedCompetitionId: string;
          matches: ReadonlyArray<{ matchLineageKey: string }>;
        }>;
      }
    >
  >;
}>;

export type UploadIntentMetadataStore = {
  get(key: string): Promise<string | null>;
  putIfAbsent(key: string, value: string): Promise<boolean>;
};

export type UploadIntentMultipart = {
  readonly uploadId: string;
  abort(): Promise<void>;
};

export type UploadIntentBucket = {
  createMultipartUpload(
    key: string,
    options: {
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
    },
  ): Promise<UploadIntentMultipart>;
};

export type SharedMatchMediaUploadDependencies = {
  enabled: boolean;
  metadataStore: UploadIntentMetadataStore;
  bucket: UploadIntentBucket;
  readParentSession(token: string): Promise<MatchMediaParentSession | null>;
  now(): Date;
  randomUuid(): string;
};

type CreateUploadIntentBody = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  declaredMimeType: string;
  declaredByteCount: number;
  declaredSha256?: string;
};

function response(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status });
}

function uploadError(message: string, status: number): Response {
  return response({ error: message }, status);
}

function bearerSecret(request: Request): string {
  const auth = request.headers.get("Authorization")?.trim() ?? "";
  return /^Bearer\s+(.+)$/.exec(auth)?.[1]?.trim() ?? "";
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  const leftBytes = new TextEncoder().encode(leftHash);
  const rightBytes = new TextEncoder().encode(rightHash);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (left: BufferSource, right: BufferSource) => boolean;
  };
  if (subtle.timingSafeEqual) {
    return subtle.timingSafeEqual(leftBytes, rightBytes);
  }
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_INTENT_BODY_BYTES) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function boundedId(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_DOMAIN_ID_CHARS ? trimmed : "";
}

function parseIntentBody(raw: unknown): CreateUploadIntentBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const sharedAthleteId = boundedId(value.sharedAthleteId);
  const sharedCompetitionId = boundedId(value.sharedCompetitionId);
  const matchLineageKey = boundedId(value.matchLineageKey);
  const declaredMimeType =
    typeof value.declaredMimeType === "string"
      ? value.declaredMimeType.trim().toLowerCase()
      : "";
  const declaredByteCount = value.declaredByteCount;
  const declaredSha256 =
    typeof value.declaredSha256 === "string"
      ? value.declaredSha256.trim().toLowerCase()
      : undefined;
  if (
    !sharedAthleteId ||
    !sharedCompetitionId ||
    !matchLineageKey ||
    !VIDEO_MIME_TYPES.has(declaredMimeType) ||
    typeof declaredByteCount !== "number" ||
    !Number.isSafeInteger(declaredByteCount) ||
    declaredByteCount <= 0 ||
    declaredByteCount > MAX_DECLARED_VIDEO_BYTES ||
    (declaredSha256 !== undefined && !/^[a-f0-9]{64}$/.test(declaredSha256))
  ) {
    return null;
  }
  return {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    declaredMimeType,
    declaredByteCount,
    ...(declaredSha256 ? { declaredSha256 } : {}),
  };
}

function sessionContainsMatch(
  session: MatchMediaParentSession,
  body: CreateUploadIntentBody,
): boolean {
  if (!session.athletes.some((athlete) => athlete.id === body.sharedAthleteId)) return false;
  if (
    !session.competitions.some(
      (competition) =>
        competition.id === body.sharedCompetitionId &&
        competition.sharedAthleteId === body.sharedAthleteId,
    )
  ) {
    return false;
  }
  const topology = session.competitionTopologyByAthleteId[body.sharedAthleteId];
  const competition = topology?.competitions.find(
    (candidate) => candidate.sharedCompetitionId === body.sharedCompetitionId,
  );
  return Boolean(
    competition?.matches.some((match) => match.matchLineageKey === body.matchLineageKey),
  );
}

function publicIntent(record: StoredUploadIntent, idempotentReplay: boolean): Record<string, unknown> {
  return {
    asset: {
      matchMediaAssetId: record.asset.matchMediaAssetId,
      sharedAthleteId: record.asset.sharedAthleteId,
      sharedCompetitionId: record.asset.sharedCompetitionId,
      matchLineageKey: record.asset.matchLineageKey,
      status: record.asset.status,
      declaredMimeType: record.asset.declaredMimeType,
      declaredByteCount: record.asset.declaredByteCount,
      ...(record.asset.declaredSha256
        ? { declaredSha256: record.asset.declaredSha256 }
        : {}),
      createdAt: record.asset.createdAt,
    },
    uploadSession: {
      uploadSessionId: record.uploadSession.uploadSessionId,
      protocol: record.uploadSession.provider,
      status: record.uploadSession.status,
      expiresAt: record.uploadSession.expiresAt,
    },
    idempotentReplay,
  };
}

function parseStoredIntent(raw: string | null): StoredUploadIntent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredUploadIntent;
    if (
      parsed?.schemaVersion !== 1 ||
      parsed.asset?.schemaVersion !== 1 ||
      parsed.uploadSession?.schemaVersion !== 1 ||
      !parsed.requestFingerprint ||
      !parsed.asset.matchMediaAssetId ||
      !parsed.uploadSession.uploadSessionId
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function handleCreateSharedMatchMediaUploadIntent(
  request: Request,
  token: string,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<Response> {
  if (!dependencies.enabled) return uploadError("Not found", 404);

  const secret = bearerSecret(request);
  if (!secret) return uploadError("Unauthorized", 401);
  const session = await dependencies.readParentSession(token);
  if (
    !session?.parentWriterSecret ||
    !(await secureEqual(secret, session.parentWriterSecret))
  ) {
    return uploadError("Unauthorized", 401);
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_CHARS) {
    return uploadError("Valid Idempotency-Key required", 400);
  }

  let rawBody: unknown;
  try {
    rawBody = await readBoundedJson(request);
  } catch {
    return uploadError("Invalid upload intent", 400);
  }
  const body = parseIntentBody(rawBody);
  if (!body) return uploadError("Invalid upload intent", 400);
  if (!sessionContainsMatch(session, body)) return uploadError("Match not found", 404);

  const idempotencyHash = await sha256Hex(`${token}:match-media-upload:${idempotencyKey}`);
  const recordKey = `match-media/upload-intents/${token}/${idempotencyHash}.json`;
  const requestFingerprint = await sha256Hex(JSON.stringify(body));
  const existing = parseStoredIntent(await dependencies.metadataStore.get(recordKey));
  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) {
      return uploadError("Idempotency conflict", 409);
    }
    return response(publicIntent(existing, true), 200);
  }

  const now = dependencies.now();
  const createdAt = now.toISOString();
  const matchMediaAssetId = `mma_${dependencies.randomUuid()}`;
  const uploadSessionId = `mmus_${idempotencyHash.slice(0, 32)}`;
  const storageObjectKey = `match-media/assets/${matchMediaAssetId}/original`;
  const multipart = await dependencies.bucket.createMultipartUpload(storageObjectKey, {
    httpMetadata: { contentType: body.declaredMimeType },
    customMetadata: {
      matchMediaAssetId,
      uploadSessionId,
      status: "upload_pending",
    },
  });

  const record: StoredUploadIntent = Object.freeze({
    schemaVersion: 1,
    requestFingerprint,
    asset: Object.freeze({
      schemaVersion: 1,
      matchMediaAssetId,
      sharedAthleteId: body.sharedAthleteId,
      sharedCompetitionId: body.sharedCompetitionId,
      matchLineageKey: body.matchLineageKey,
      creatorAuthority: "parent",
      status: "upload_pending",
      storageObjectKey,
      declaredMimeType: body.declaredMimeType,
      declaredByteCount: body.declaredByteCount,
      ...(body.declaredSha256 ? { declaredSha256: body.declaredSha256 } : {}),
      createdAt,
    }),
    uploadSession: Object.freeze({
      schemaVersion: 1,
      uploadSessionId,
      matchMediaAssetId,
      provider: "r2_multipart",
      providerUploadId: multipart.uploadId,
      status: "upload_pending",
      createdAt,
      expiresAt: new Date(now.getTime() + UPLOAD_SESSION_LIFETIME_MS).toISOString(),
    }),
  });

  let stored = false;
  try {
    stored = await dependencies.metadataStore.putIfAbsent(recordKey, JSON.stringify(record));
  } catch (error) {
    await multipart.abort();
    throw error;
  }

  if (!stored) {
    await multipart.abort();
    const winner = parseStoredIntent(await dependencies.metadataStore.get(recordKey));
    if (!winner) throw new Error("Upload intent race did not produce readable metadata");
    if (winner.requestFingerprint !== requestFingerprint) {
      return uploadError("Idempotency conflict", 409);
    }
    return response(publicIntent(winner, true), 200);
  }

  return response(publicIntent(record, false), 201);
}
