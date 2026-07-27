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
  | "upload_complete"
  | "upload_aborted";

export type SharedMatchMediaAsset = Readonly<{
  schemaVersion: 1;
  matchMediaAssetId: string;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  creatorAuthority: "parent";
  status: "upload_pending";
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
  /**
   * Authoritative MIME from upload intent when present.
   * Legacy sessions may omit this; never fabricate a default.
   */
  declaredMimeType?: string;
  declaredSha256?: string;
  storageObjectKey: string;
  providerUploadId: string;
  status: SharedMatchMediaUploadStatus;
  createdAt: string;
  expiresAt: string;
  standardPartByteCount?: number;
  acknowledgedParts: Readonly<Record<string, AcknowledgedUploadPart>>;
  partReservations: Readonly<Record<string, UploadPartReservation>>;
  providerAbortConfirmed?: boolean;
  completedObject?: Readonly<{
    providerVersion: string;
    providerEtag: string;
    byteCount: number;
    completedAt: string;
  }>;
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
  complete(
    parts: ReadonlyArray<{ partNumber: number; etag: string }>,
  ): Promise<{ version: string; etag: string; size: number; uploaded: Date }>;
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
  head(key: string): Promise<
    { version: string; etag: string; size: number; uploaded: Date } | null
  >;
};

export type ProductionVerificationHandOffResult = Readonly<{
  outcome: string;
  verificationAttempted: boolean;
  code?: string;
  message?: string;
  verificationState?: string;
  admissionOutcome?: string;
}>;

export type SharedMatchMediaUploadDependencies = {
  enabled: boolean;
  /**
   * Narrow, default-empty server admission scope for a separately authorized
   * experiment. The intent route fails closed unless all three values are
   * present, schema-valid, and exactly match the Parent-authorized topology.
   */
  experimentScope?: Readonly<{
    sharedAthleteId?: string;
    sharedCompetitionId?: string;
    matchLineageKey?: string;
  }>;
  metadataStore: UploadIntentMetadataStore;
  bucket: UploadIntentBucket;
  readParentSession(token: string): Promise<MatchMediaParentSession | null>;
  now(): Date;
  randomUuid(): string;
  /**
   * Optional post-upload_complete Production Verification hand-off.
   * Composed only when SHARED_MATCH_MEDIA_VERIFICATION_ENABLED === "1".
   */
  runProductionVerificationAfterUploadComplete?: (
    input: Readonly<{
      matchMediaAssetId: string;
      objectVersion: string;
      storageObjectKey: string;
      declaredByteCount: number;
      declaredMimeType?: string;
      expectedWholeObjectSha256?: string;
      uploadSessionId: string;
      athleteId: string;
      competitionId: string;
      matchLineageKey: string;
    }>,
  ) => Promise<ProductionVerificationHandOffResult>;
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

function exactConfiguredScopeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value !== value.trim()) return null;
  if (!value || value.length > MAX_DOMAIN_ID_CHARS || value.includes("\u001f")) return null;
  return value;
}

/**
 * Fail-closed containment for the one approved experiment. This is deliberately
 * evaluated only after Parent authorization and topology validation, but before
 * intent metadata or an R2 multipart upload can be created.
 */
function matchesConfiguredExperimentScope(
  body: CreateUploadIntentBody,
  scope: SharedMatchMediaUploadDependencies["experimentScope"],
): boolean {
  const sharedAthleteId = exactConfiguredScopeId(scope?.sharedAthleteId);
  const sharedCompetitionId = exactConfiguredScopeId(scope?.sharedCompetitionId);
  const matchLineageKey = exactConfiguredScopeId(scope?.matchLineageKey);
  return Boolean(
    sharedAthleteId &&
      sharedCompetitionId &&
      matchLineageKey &&
      body.sharedAthleteId === sharedAthleteId &&
      body.sharedCompetitionId === sharedCompetitionId &&
      body.matchLineageKey === matchLineageKey,
  );
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
    declaredMimeType: record.asset.declaredMimeType,
    ...(record.asset.declaredSha256
      ? { declaredSha256: record.asset.declaredSha256 }
      : {}),
    storageObjectKey: record.asset.storageObjectKey,
    providerUploadId: record.uploadSession.providerUploadId,
    status: "upload_pending",
    createdAt: record.uploadSession.createdAt,
    expiresAt: record.uploadSession.expiresAt,
    acknowledgedParts: {},
    partReservations: {},
  };
}

/**
 * Parse durable upload-session JSON.
 * Explicit stored MIME remains authoritative; missing/empty legacy MIME stays absent.
 * Does not reconstruct MIME from R2, bytes, filename, or a compatibility default.
 */
export function parseStoredSessionState(raw: string | null): StoredUploadSessionState | null {
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
      !["upload_pending", "uploading", "upload_complete", "upload_aborted"].includes(parsed.status) ||
      !parsed.acknowledgedParts ||
      !parsed.partReservations
    ) {
      return null;
    }
    const declaredMimeType =
      typeof parsed.declaredMimeType === "string" && parsed.declaredMimeType.trim()
        ? parsed.declaredMimeType.trim().toLowerCase()
        : undefined;
    const declaredSha256 =
      typeof parsed.declaredSha256 === "string" &&
      /^[a-f0-9]{64}$/.test(parsed.declaredSha256.trim().toLowerCase())
        ? parsed.declaredSha256.trim().toLowerCase()
        : undefined;
    const {
      declaredMimeType: _dropMime,
      declaredSha256: _dropSha,
      ...base
    } = parsed;
    return {
      ...base,
      ...(declaredMimeType !== undefined ? { declaredMimeType } : {}),
      ...(declaredSha256 !== undefined ? { declaredSha256 } : {}),
    };
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
      ...(state.completedObject
        ? {
            completedByteCount: state.completedObject.byteCount,
            completedAt: state.completedObject.completedAt,
          }
        : {}),
      allowedNextActions:
        state.status === "upload_aborted" || state.status === "upload_complete"
          ? []
          : ["upload_part", "complete", "abort"],
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
  if (!matchesConfiguredExperimentScope(body, dependencies.experimentScope)) {
    return opaqueNotFound();
  }

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
  if (
    found.state.status !== "upload_complete" &&
    dependencies.now().getTime() >= Date.parse(found.state.expiresAt)
  ) {
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
  if (found.state.status === "upload_complete") return uploadError("Upload complete", 409);
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
  if (state.status === "upload_complete") return uploadError("Upload complete", 409);
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

function reconciledParts(
  state: StoredUploadSessionState,
): ReadonlyArray<{ partNumber: number; etag: string }> | null {
  if (
    state.status !== "uploading" ||
    !state.standardPartByteCount ||
    Object.keys(state.partReservations).length > 0
  ) {
    return null;
  }
  const parts = Object.values(state.acknowledgedParts).sort(
    (left, right) => left.partNumber - right.partNumber,
  );
  const expectedCount = Math.ceil(state.declaredByteCount / state.standardPartByteCount);
  if (parts.length !== expectedCount) return null;
  let total = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const expectedNumber = index + 1;
    const expectedBytes =
      expectedNumber === expectedCount
        ? state.declaredByteCount - state.standardPartByteCount * (expectedCount - 1)
        : state.standardPartByteCount;
    if (part.partNumber !== expectedNumber || part.byteCount !== expectedBytes) return null;
    total += part.byteCount;
  }
  if (total !== state.declaredByteCount) return null;
  return parts.map((part) => ({ partNumber: part.partNumber, etag: part.providerEtag }));
}

function completionResponse(
  state: StoredUploadSessionState,
  idempotentReplay: boolean,
  productionVerification?: ProductionVerificationHandOffResult,
): Response {
  return response(
    {
      asset: { matchMediaAssetId: state.matchMediaAssetId },
      uploadSession: {
        uploadSessionId: state.uploadSessionId,
        status: "upload_complete",
        completedByteCount: state.completedObject?.byteCount,
        completedAt: state.completedObject?.completedAt,
        // Domain-facing immutable object identity from storage completion.
        // Does not expose provider/storage internals (keys, etags, providerUploadId).
        ...(state.completedObject?.providerVersion
          ? { objectVersion: state.completedObject.providerVersion }
          : {}),
      },
      idempotentReplay,
      ...(productionVerification
        ? { productionVerification }
        : {}),
    },
    idempotentReplay ? 200 : 201,
  );
}

async function maybeRunProductionVerification(
  state: StoredUploadSessionState,
  dependencies: SharedMatchMediaUploadDependencies,
): Promise<ProductionVerificationHandOffResult | undefined> {
  if (!dependencies.runProductionVerificationAfterUploadComplete) {
    return undefined;
  }
  if (!state.completedObject) {
    return {
      outcome: "trigger_error",
      verificationAttempted: true,
      code: "INVALID_COMPLETION_PROVENANCE",
      message: "upload_complete missing completedObject",
    };
  }
  try {
    return await dependencies.runProductionVerificationAfterUploadComplete({
      matchMediaAssetId: state.matchMediaAssetId,
      objectVersion: state.completedObject.providerVersion,
      storageObjectKey: state.storageObjectKey,
      declaredByteCount: state.declaredByteCount,
      ...(state.declaredMimeType !== undefined
        ? { declaredMimeType: state.declaredMimeType }
        : {}),
      ...(state.declaredSha256
        ? { expectedWholeObjectSha256: state.declaredSha256 }
        : {}),
      uploadSessionId: state.uploadSessionId,
      athleteId: state.sharedAthleteId,
      competitionId: state.sharedCompetitionId,
      matchLineageKey: state.matchLineageKey,
    });
  } catch (error) {
    return {
      outcome: "trigger_error",
      verificationAttempted: true,
      code: "VERIFICATION_TRIGGER_THREW",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function handleCompleteSharedMatchMediaUpload(
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
  let state = found.state;
  if (state.status === "upload_complete" && state.completedObject) {
    const productionVerification = await maybeRunProductionVerification(state, dependencies);
    return completionResponse(state, true, productionVerification);
  }
  if (dependencies.now().getTime() >= Date.parse(state.expiresAt)) {
    return uploadError("Upload session expired", 410);
  }
  if (state.status === "upload_aborted") return uploadError("Upload aborted", 409);
  const parts = reconciledParts(state);
  if (!parts) return uploadError("Upload parts incomplete", 409);

  let object: { version: string; etag: string; size: number; uploaded: Date } | null = null;
  try {
    object = await dependencies.bucket
      .resumeMultipartUpload(state.storageObjectKey, state.providerUploadId)
      .complete(parts);
  } catch {
    // Completion may have succeeded before session metadata was finalized.
    object = await dependencies.bucket.head(state.storageObjectKey);
    if (!object) return uploadError("Upload completion unavailable", 503);
  }
  if (object.size !== state.declaredByteCount) {
    return uploadError("Completed object size mismatch", 502);
  }

  const stateKey = uploadSessionStateKey(token, uploadSessionId);
  for (let attempt = 0; attempt < MAX_METADATA_CAS_ATTEMPTS; attempt += 1) {
    const current = await dependencies.metadataStore.getVersioned(stateKey);
    state = parseStoredSessionState(current?.value ?? null) ?? state;
    if (!current) return uploadError("Upload completion unavailable", 503);
    if (state.status === "upload_complete" && state.completedObject) {
      const productionVerification = await maybeRunProductionVerification(state, dependencies);
      return completionResponse(state, true, productionVerification);
    }
    if (state.status === "upload_aborted") return uploadError("Upload aborted", 409);
    const completedAt = object.uploaded.toISOString();
    const completed: StoredUploadSessionState = {
      ...state,
      status: "upload_complete",
      partReservations: {},
      completedObject: {
        providerVersion: object.version,
        providerEtag: object.etag,
        byteCount: object.size,
        completedAt,
      },
    };
    if (
      await dependencies.metadataStore.compareAndSwap(
        stateKey,
        current.version,
        JSON.stringify(completed),
      )
    ) {
      const productionVerification = await maybeRunProductionVerification(
        completed,
        dependencies,
      );
      return completionResponse(completed, false, productionVerification);
    }
  }
  return uploadError("Upload completion unavailable", 503);
}
