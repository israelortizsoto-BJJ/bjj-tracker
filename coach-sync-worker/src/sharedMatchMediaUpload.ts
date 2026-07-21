const MAX_INTENT_BODY_BYTES = 16 * 1024;
const MAX_IDEMPOTENCY_KEY_CHARS = 160;
const MAX_DOMAIN_ID_CHARS = 200;
const MAX_DECLARED_VIDEO_BYTES = 20 * 1024 * 1024 * 1024;
const UPLOAD_SESSION_LIFETIME_MS = 6 * 24 * 60 * 60 * 1000;
const MIN_MULTIPART_PART_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_PART_BYTES = 100 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 10_000;
const MAX_METADATA_CAS_ATTEMPTS = 8;

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export type SharedMatchMediaUploadStatus =
  | "upload_pending"
  | "uploading"
  | "upload_aborted";

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

type AcknowledgedUploadPart = Readonly<{
  partNumber: number;
  byteCount: number;
  sha256: string;
  providerEtag: string;
  acknowledgedAt: string;
}>;

type UploadPartReservation = Readonly<{
  partNumber: number;
  byteCount: number;
  sha256: string;
  reservedAt: string;
}>;

type StoredUploadSessionState = Readonly<{
  schemaVersion: 1;
  uploadSessionId: string;
  matchMediaAssetId: string;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  declaredByteCount: number;
  storageObjectKey: string;
  providerUploadId: string;
  status: SharedMatchMediaUploadStatus;
  createdAt: string;
  expiresAt: string;
  standardPartByteCount?: number;
  acknowledgedParts: Readonly<Record<string, AcknowledgedUploadPart>>;
  partReservations: Readonly<Record<string, UploadPartReservation>>;
  providerAbortConfirmed?: boolean;
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
  getVersioned(key: string): Promise<{ value: string; version: string } | null>;
  compareAndSwap(key: string, version: string, value: string): Promise<boolean>;
};

export type UploadIntentMultipart = {
  readonly uploadId: string;
  abort(): Promise<void>;
};

export type UploadPartsMultipart = UploadIntentMultipart & {
  uploadPart(
    partNumber: number,
    value: ReadableStream,
    options: { sha256: string },
  ): Promise<{ partNumber: number; etag: string }>;
};

export type UploadIntentBucket = {
  createMultipartUpload(
    key: string,
    options: {
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
    },
  ): Promise<UploadIntentMultipart>;
  resumeMultipartUpload(key: string, uploadId: string): UploadPartsMultipart;
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

function opaqueNotFound(): Response {
  return uploadError("Not found", 404);
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

async function authorizeParent(
  request: Request,
  token: string,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<MatchMediaParentSession | Response> {
  if (!dependencies.enabled) return opaqueNotFound();
  const secret = bearerSecret(request);
  if (!secret) return uploadError("Unauthorized", 401);
  const session = await dependencies.readParentSession(token);
  if (
    !session?.parentWriterSecret ||
    !(await secureEqual(secret, session.parentWriterSecret))
  ) {
    return uploadError("Unauthorized", 401);
  }
  return session;
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

function uploadSessionStateKey(token: string, uploadSessionId: string): string {
  return `match-media/upload-sessions/${token}/${uploadSessionId}.json`;
}

function stateFromIntent(record: StoredUploadIntent): StoredUploadSessionState {
  return {
    schemaVersion: 1,
    uploadSessionId: record.uploadSession.uploadSessionId,
    matchMediaAssetId: record.asset.matchMediaAssetId,
    sharedAthleteId: record.asset.sharedAthleteId,
    sharedCompetitionId: record.asset.sharedCompetitionId,
    matchLineageKey: record.asset.matchLineageKey,
    declaredByteCount: record.asset.declaredByteCount,
    storageObjectKey: record.asset.storageObjectKey,
    providerUploadId: record.uploadSession.providerUploadId,
    status: "upload_pending",
    createdAt: record.uploadSession.createdAt,
    expiresAt: record.uploadSession.expiresAt,
    acknowledgedParts: {},
    partReservations: {},
  };
}

function parseStoredSessionState(raw: string | null): StoredUploadSessionState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredUploadSessionState;
    if (
      parsed?.schemaVersion !== 1 ||
      !parsed.uploadSessionId ||
      !parsed.matchMediaAssetId ||
      !Number.isSafeInteger(parsed.declaredByteCount) ||
      parsed.declaredByteCount <= 0 ||
      !parsed.storageObjectKey ||
      !parsed.providerUploadId ||
      !["upload_pending", "uploading", "upload_aborted"].includes(parsed.status) ||
      !parsed.acknowledgedParts ||
      !parsed.partReservations
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function ensureSessionState(
  token: string,
  record: StoredUploadIntent,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<void> {
  await dependencies.metadataStore.putIfAbsent(
    uploadSessionStateKey(token, record.uploadSession.uploadSessionId),
    JSON.stringify(stateFromIntent(record)),
  );
}

function stateMatchesAuthority(
  session: MatchMediaParentSession,
  state: StoredUploadSessionState,
  assetId: string,
): boolean {
  return (
    state.matchMediaAssetId === assetId &&
    sessionContainsMatch(session, {
      sharedAthleteId: state.sharedAthleteId,
      sharedCompetitionId: state.sharedCompetitionId,
      matchLineageKey: state.matchLineageKey,
      declaredMimeType: "video/mp4",
      declaredByteCount: 1,
    })
  );
}

function publicSessionState(state: StoredUploadSessionState): Record<string, unknown> {
  const parts = Object.values(state.acknowledgedParts)
    .sort((left, right) => left.partNumber - right.partNumber)
    .map(({ partNumber, byteCount }) => ({ partNumber, byteCount }));
  return {
    asset: { matchMediaAssetId: state.matchMediaAssetId },
    uploadSession: {
      uploadSessionId: state.uploadSessionId,
      status: state.status,
      expiresAt: state.expiresAt,
      acknowledgedParts: parts,
      uploadedByteCount: parts.reduce((sum, part) => sum + part.byteCount, 0),
      allowedNextActions:
        state.status === "upload_aborted" ? [] : ["upload_part", "abort"],
    },
  };
}

async function readAuthorizedState(
  request: Request,
  token: string,
  uploadSessionId: string,
  assetId: string,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<
  | { state: StoredUploadSessionState; version: string }
  | Response
> {
  const authorized = await authorizeParent(request, token, dependencies);
  if (authorized instanceof Response) return authorized;
  if (!/^mmus_[a-f0-9]{32}$/i.test(uploadSessionId) || !assetId) return opaqueNotFound();
  const stored = await dependencies.metadataStore.getVersioned(
    uploadSessionStateKey(token, uploadSessionId),
  );
  const state = parseStoredSessionState(stored?.value ?? null);
  if (!stored || !state || !stateMatchesAuthority(authorized, state, assetId)) {
    return opaqueNotFound();
  }
  return { state, version: stored.version };
}

export async function handleCreateSharedMatchMediaUploadIntent(
  request: Request,
  token: string,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<Response> {
  const authorized = await authorizeParent(request, token, dependencies);
  if (authorized instanceof Response) return authorized;
  const session = authorized;

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
    await ensureSessionState(token, existing, dependencies);
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
    await ensureSessionState(token, winner, dependencies);
    return response(publicIntent(winner, true), 200);
  }

  await ensureSessionState(token, record, dependencies);
  return response(publicIntent(record, false), 201);
}

export async function handleInspectSharedMatchMediaUpload(
  request: Request,
  token: string,
  uploadSessionId: string,
  assetId: string,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<Response> {
  const found = await readAuthorizedState(
    request,
    token,
    uploadSessionId,
    assetId,
    dependencies,
  );
  if (found instanceof Response) return found;
  if (dependencies.now().getTime() >= Date.parse(found.state.expiresAt)) {
    return uploadError("Upload session expired", 410);
  }
  return response(publicSessionState(found.state), 200);
}

function positiveIntegerHeader(request: Request, name: string): number | null {
  const raw = request.headers.get(name)?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function validPartShape(
  state: StoredUploadSessionState,
  partNumber: number,
  byteCount: number,
): { valid: boolean; standardPartByteCount?: number } {
  if (
    partNumber < 1 ||
    partNumber > MAX_MULTIPART_PARTS ||
    byteCount < 1 ||
    byteCount > MAX_MULTIPART_PART_BYTES
  ) {
    return { valid: false };
  }
  const standard = state.standardPartByteCount ?? byteCount;
  if (
    !state.standardPartByteCount &&
    byteCount < MIN_MULTIPART_PART_BYTES &&
    !(partNumber === 1 && byteCount === state.declaredByteCount)
  ) {
    return { valid: false };
  }
  const expectedPartCount = Math.ceil(state.declaredByteCount / standard);
  if (expectedPartCount < 1 || expectedPartCount > MAX_MULTIPART_PARTS || partNumber > expectedPartCount) {
    return { valid: false };
  }
  const expectedByteCount =
    partNumber === expectedPartCount
      ? state.declaredByteCount - standard * (expectedPartCount - 1)
      : standard;
  if (byteCount !== expectedByteCount) return { valid: false };
  return { valid: true, standardPartByteCount: state.standardPartByteCount ?? byteCount };
}

export async function handleUploadSharedMatchMediaPart(
  request: Request,
  token: string,
  uploadSessionId: string,
  assetId: string,
  partNumber: number,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<Response> {
  const found = await readAuthorizedState(
    request,
    token,
    uploadSessionId,
    assetId,
    dependencies,
  );
  if (found instanceof Response) return found;
  if (dependencies.now().getTime() >= Date.parse(found.state.expiresAt)) {
    return uploadError("Upload session expired", 410);
  }
  if (found.state.status === "upload_aborted") return uploadError("Upload aborted", 409);
  if (!request.body) return uploadError("Part body required", 400);

  const byteCount = positiveIntegerHeader(request, "X-MatMind-Part-Bytes");
  const contentLength = positiveIntegerHeader(request, "Content-Length");
  const sha256 = request.headers.get("X-MatMind-Part-SHA256")?.trim().toLowerCase() ?? "";
  if (!byteCount || contentLength !== byteCount || !/^[a-f0-9]{64}$/.test(sha256)) {
    return uploadError("Invalid part metadata", 400);
  }

  let state = found.state;
  let version = found.version;
  const shape = validPartShape(state, partNumber, byteCount);
  if (!shape.valid) return uploadError("Invalid part", 400);
  const partKey = String(partNumber);
  const acknowledged = state.acknowledgedParts[partKey];
  if (acknowledged) {
    if (acknowledged.byteCount !== byteCount || acknowledged.sha256 !== sha256) {
      return uploadError("Part conflict", 409);
    }
    return response({ part: { partNumber, byteCount }, idempotentReplay: true }, 200);
  }
  const reservation = state.partReservations[partKey];
  if (reservation) {
    if (reservation.byteCount !== byteCount || reservation.sha256 !== sha256) {
      return uploadError("Part conflict", 409);
    }
  }

  const stateKey = uploadSessionStateKey(token, uploadSessionId);
  if (!reservation) {
    const reservedAt = dependencies.now().toISOString();
    const reserved: StoredUploadSessionState = {
      ...state,
      standardPartByteCount: shape.standardPartByteCount,
      partReservations: {
        ...state.partReservations,
        [partKey]: { partNumber, byteCount, sha256, reservedAt },
      },
    };
    if (!(await dependencies.metadataStore.compareAndSwap(stateKey, version, JSON.stringify(reserved)))) {
      return uploadError("Part upload in progress", 425);
    }
  }

  let uploaded: { partNumber: number; etag: string };
  try {
    uploaded = await dependencies.bucket
      .resumeMultipartUpload(state.storageObjectKey, state.providerUploadId)
      .uploadPart(partNumber, request.body, { sha256 });
  } catch {
    return uploadError("Part upload unavailable", 503);
  }

  for (let attempt = 0; attempt < MAX_METADATA_CAS_ATTEMPTS; attempt += 1) {
    const current = await dependencies.metadataStore.getVersioned(stateKey);
    state = parseStoredSessionState(current?.value ?? null) ?? state;
    if (!current || state.status === "upload_aborted") return uploadError("Upload aborted", 409);
    const existingPart = state.acknowledgedParts[partKey];
    if (existingPart) {
      if (existingPart.byteCount === byteCount && existingPart.sha256 === sha256) {
        return response({ part: { partNumber, byteCount }, idempotentReplay: true }, 200);
      }
      return uploadError("Part conflict", 409);
    }
    const nextReservations = { ...state.partReservations };
    delete nextReservations[partKey];
    const next: StoredUploadSessionState = {
      ...state,
      status: "uploading",
      acknowledgedParts: {
        ...state.acknowledgedParts,
        [partKey]: {
          partNumber,
          byteCount,
          sha256,
          providerEtag: uploaded.etag,
          acknowledgedAt: dependencies.now().toISOString(),
        },
      },
      partReservations: nextReservations,
    };
    if (
      await dependencies.metadataStore.compareAndSwap(
        stateKey,
        current.version,
        JSON.stringify(next),
      )
    ) {
      return response({ part: { partNumber, byteCount }, idempotentReplay: false }, 201);
    }
  }
  return uploadError("Part acknowledgement unavailable", 503);
}

export async function handleAbortSharedMatchMediaUpload(
  request: Request,
  token: string,
  uploadSessionId: string,
  assetId: string,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<Response> {
  const found = await readAuthorizedState(
    request,
    token,
    uploadSessionId,
    assetId,
    dependencies,
  );
  if (found instanceof Response) return found;
  const stateKey = uploadSessionStateKey(token, uploadSessionId);
  let state = found.state;
  let version = found.version;
  if (state.status !== "upload_aborted") {
    const aborted: StoredUploadSessionState = {
      ...state,
      status: "upload_aborted",
      partReservations: {},
      providerAbortConfirmed: false,
    };
    if (!(await dependencies.metadataStore.compareAndSwap(stateKey, version, JSON.stringify(aborted)))) {
      const current = await dependencies.metadataStore.getVersioned(stateKey);
      state = parseStoredSessionState(current?.value ?? null) ?? state;
      if (!current || state.status !== "upload_aborted") {
        return uploadError("Abort unavailable", 503);
      }
      version = current.version;
    } else {
      state = aborted;
      const current = await dependencies.metadataStore.getVersioned(stateKey);
      if (current) version = current.version;
    }
  }
  if (!state.providerAbortConfirmed) {
    try {
      await dependencies.bucket
        .resumeMultipartUpload(state.storageObjectKey, state.providerUploadId)
        .abort();
    } catch {
      return uploadError("Abort unavailable", 503);
    }
    const confirmed: StoredUploadSessionState = { ...state, providerAbortConfirmed: true };
    await dependencies.metadataStore.compareAndSwap(stateKey, version, JSON.stringify(confirmed));
    state = confirmed;
  }
  return response(publicSessionState(state), 200);
}
