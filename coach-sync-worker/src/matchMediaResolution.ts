/**
 * Flag-gated Coach Match-media resolution boundary.
 *
 * Enabled only when SHARED_MATCH_MEDIA_RESOLUTION_ENABLED === "1".
 * Authority: live Coach session + topology + canonical attached attachment
 * + matching asset identity + exact R2 object-version equality.
 * Resolved URLs are response-only / memory-only — never durable state.
 */

import {
  attachmentRecordKey,
  decodeMatchMediaAttachmentRecord,
  type MatchMediaAttachment,
} from "../../shared-match-media-publication/src/index.ts";

const MAX_RESOLUTION_BODY_BYTES = 16 * 1024;
const MAX_DOMAIN_ID_CHARS = 200;
const MATCH_MEDIA_CONTENT_TTL_SECONDS = 15 * 60;
/** Distinct from commentary `media-content:` prefix. */
const MATCH_MEDIA_CONTENT_HMAC_PREFIX = "match-media-content";

export type MatchMediaCoachSession = Readonly<{
  writerSecret: string;
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

export type ResolutionMediaBucket = {
  get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<ResolutionR2Object | null>;
  head(key: string): Promise<ResolutionR2Head | null>;
};

export type ResolutionR2Head = {
  readonly size: number;
  readonly version?: string;
  readonly httpMetadata?: { contentType?: string };
};

export type ResolutionR2Object = {
  readonly body: ReadableStream | null;
  readonly size: number;
  readonly httpEtag: string;
  readonly etag?: string;
  readonly httpMetadata?: { contentType?: string };
  text(): Promise<string>;
  writeHttpMetadata(headers: Headers): void;
};

export type MatchMediaResolutionDependencies = {
  readonly enabled: boolean;
  readonly mediaBucket: ResolutionMediaBucket;
  readonly readCoachSession: (
    token: string,
  ) => Promise<MatchMediaCoachSession | null>;
  readonly now: () => Date;
  /** Origin used when minting absolute content URLs (request URL origin). */
  readonly requestOrigin: string;
};

type ResolveBody = {
  readonly sharedAthleteId: string;
  readonly sharedCompetitionId: string;
  readonly matchLineageKey: string;
  readonly matchMediaAssetId: string;
  readonly expectedRevision?: number;
};

function response(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status });
}

function resolutionError(
  message: string,
  status: number,
): Response {
  return response({ error: message }, status);
}

/** Opaque denial — no resource-existence leakage. */
function opaqueNotFound(): Response {
  return resolutionError("Not found", 404);
}

export function isResolutionFeatureEnabled(value: string | undefined): boolean {
  return value === "1";
}

export function matchMediaAssetStorageObjectKey(matchMediaAssetId: string): string {
  return `match-media/assets/${matchMediaAssetId}/original`;
}

function bearerSecret(request: Request): string {
  const auth = request.headers.get("Authorization")?.trim() ?? "";
  return /^Bearer\s+(.+)$/.exec(auth)?.[1]?.trim() ?? "";
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    sha256Hex(left),
    sha256Hex(right),
  ]);
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

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signMatchMediaContentAccess(
  writerSecret: string,
  token: string,
  matchMediaAssetId: string,
  expUnix: number,
): Promise<string> {
  return hmacHex(
    writerSecret,
    `${MATCH_MEDIA_CONTENT_HMAC_PREFIX}:${token}:${matchMediaAssetId}:${expUnix}`,
  );
}

export async function verifyMatchMediaContentAccess(
  writerSecret: string,
  token: string,
  matchMediaAssetId: string,
  expUnix: number,
  sig: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!sig || !matchMediaAssetId) return false;
  if (!Number.isFinite(expUnix) || expUnix <= Math.floor(nowMs / 1000)) {
    return false;
  }
  const expected = await signMatchMediaContentAccess(
    writerSecret,
    token,
    matchMediaAssetId,
    expUnix,
  );
  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Exported for collision tests — must never equal commentary `media-content:`. */
export function matchMediaContentHmacPrefix(): string {
  return MATCH_MEDIA_CONTENT_HMAC_PREFIX;
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
      if (total > MAX_RESOLUTION_BODY_BYTES) {
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

function parseResolveBody(raw: unknown): ResolveBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const sharedAthleteId = boundedId(value.sharedAthleteId);
  const sharedCompetitionId = boundedId(value.sharedCompetitionId);
  const matchLineageKey = boundedId(value.matchLineageKey);
  const matchMediaAssetId = boundedId(value.matchMediaAssetId);
  if (
    !sharedAthleteId ||
    !sharedCompetitionId ||
    !matchLineageKey ||
    !matchMediaAssetId
  ) {
    return null;
  }
  if (!("expectedRevision" in value) || value.expectedRevision === undefined) {
    return {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      matchMediaAssetId,
    };
  }
  const expectedRevision = value.expectedRevision;
  if (
    typeof expectedRevision !== "number" ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0
  ) {
    return null;
  }
  return {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    matchMediaAssetId,
    expectedRevision,
  };
}

function sessionContainsMatch(
  session: MatchMediaCoachSession,
  body: Pick<
    ResolveBody,
    "sharedAthleteId" | "sharedCompetitionId" | "matchLineageKey"
  >,
): boolean {
  if (!session.athletes.some((athlete) => athlete.id === body.sharedAthleteId)) {
    return false;
  }
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
    competition?.matches.some(
      (match) => match.matchLineageKey === body.matchLineageKey,
    ),
  );
}

async function authorizeCoach(
  request: Request,
  token: string,
  dependencies: MatchMediaResolutionDependencies,
): Promise<MatchMediaCoachSession | Response> {
  if (!dependencies.enabled) return opaqueNotFound();
  const secret = bearerSecret(request);
  if (!secret) return resolutionError("Unauthorized", 401);
  const session = await dependencies.readCoachSession(token);
  if (!session?.writerSecret) return opaqueNotFound();
  if (!(await secureEqual(secret, session.writerSecret))) {
    return resolutionError("Unauthorized", 401);
  }
  return session;
}

function recordIdentityMatches(
  record: MatchMediaAttachment,
  body: ResolveBody,
): boolean {
  return (
    record.sharedAthleteId === body.sharedAthleteId &&
    record.sharedCompetitionId === body.sharedCompetitionId &&
    record.matchLineageKey === body.matchLineageKey
  );
}

type ParsedBytesRange =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "bounded"; offset: number; end: number | null }
  | { kind: "suffix"; suffix: number };

type ResolvedByteRange = {
  offset: number;
  end: number;
  length: number;
};

function parseBytesRangeHeader(header: string | null): ParsedBytesRange {
  if (header === null) return { kind: "none" };
  const raw = header.trim();
  if (!raw) return { kind: "none" };
  const m = /^bytes=(\d*)-(\d*)$/i.exec(raw);
  if (!m) return { kind: "invalid" };
  const startRaw = m[1] ?? "";
  const endRaw = m[2] ?? "";
  if (startRaw === "" && endRaw === "") return { kind: "invalid" };
  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) return { kind: "invalid" };
    return { kind: "suffix", suffix };
  }
  const offset = Number(startRaw);
  if (!Number.isInteger(offset) || offset < 0) return { kind: "invalid" };
  if (endRaw === "") return { kind: "bounded", offset, end: null };
  const end = Number(endRaw);
  if (!Number.isInteger(end) || end < 0 || end < offset) return { kind: "invalid" };
  return { kind: "bounded", offset, end };
}

function resolveBytesRange(
  parsed: Exclude<ParsedBytesRange, { kind: "none" }>,
  size: number,
): ResolvedByteRange | null {
  if (parsed.kind === "invalid") return null;
  if (size <= 0) return null;
  if (parsed.kind === "suffix") {
    const length = Math.min(parsed.suffix, size);
    const offset = size - length;
    return { offset, end: size - 1, length };
  }
  if (parsed.offset >= size) return null;
  const end =
    parsed.end === null ? size - 1 : Math.min(parsed.end, size - 1);
  const length = end - parsed.offset + 1;
  if (length <= 0) return null;
  return { offset: parsed.offset, end, length };
}

function applyContentCommonHeaders(
  headers: Headers,
  object: ResolutionR2Object,
): void {
  object.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=60");
  headers.set("Access-Control-Allow-Origin", "*");
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }
}

function contentFullResponse(object: ResolutionR2Object): Response {
  const headers = new Headers();
  applyContentCommonHeaders(headers, object);
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}

function contentPartialResponse(
  object: ResolutionR2Object,
  range: ResolvedByteRange,
): Response {
  const headers = new Headers();
  applyContentCommonHeaders(headers, object);
  headers.set("Content-Length", String(range.length));
  headers.set(
    "Content-Range",
    `bytes ${range.offset}-${range.end}/${object.size}`,
  );
  return new Response(object.body, { status: 206, headers });
}

function contentRangeNotSatisfiableResponse(size: number): Response {
  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes */${size}`);
  headers.set("Cache-Control", "private, max-age=60");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(null, { status: 416, headers });
}

/**
 * Coach-authorized Match-media resolve.
 * Mints a fresh 15-minute signed content URL. Creates no durable resolution state.
 */
export async function handleResolveMatchMediaAttachment(
  request: Request,
  token: string,
  dependencies: MatchMediaResolutionDependencies,
): Promise<Response> {
  const authorized = await authorizeCoach(request, token, dependencies);
  if (authorized instanceof Response) return authorized;
  const session = authorized;

  let rawBody: unknown;
  try {
    rawBody = await readBoundedJson(request);
  } catch {
    return resolutionError("Invalid resolution request", 400);
  }
  const body = parseResolveBody(rawBody);
  if (!body) return resolutionError("Invalid resolution request", 400);
  if (!sessionContainsMatch(session, body)) {
    return opaqueNotFound();
  }

  const attachmentKey = attachmentRecordKey({
    sharedAthleteId: body.sharedAthleteId,
    sharedCompetitionId: body.sharedCompetitionId,
    matchLineageKey: body.matchLineageKey,
  });
  const attachmentObject = await dependencies.mediaBucket.get(attachmentKey);
  if (!attachmentObject) return opaqueNotFound();

  let attachmentRaw: string;
  try {
    attachmentRaw = await attachmentObject.text();
  } catch {
    return opaqueNotFound();
  }
  const record = decodeMatchMediaAttachmentRecord(attachmentRaw);
  if (!record || !recordIdentityMatches(record, body)) {
    return opaqueNotFound();
  }
  if (record.state !== "attached") {
    return opaqueNotFound();
  }
  if (record.matchMediaAssetId !== body.matchMediaAssetId) {
    return opaqueNotFound();
  }
  // Revision: equal → allow; stale expectedRevision with same attached asset →
  // allow and return current revision. Tombstone / superseded asset denied above.

  const storageObjectKey = matchMediaAssetStorageObjectKey(body.matchMediaAssetId);
  const head = await dependencies.mediaBucket.head(storageObjectKey);
  const headVersion = head?.version?.trim() ?? "";
  if (!head || !headVersion) {
    return opaqueNotFound();
  }
  if (headVersion !== record.objectVersion) {
    return opaqueNotFound();
  }

  const expUnix =
    Math.floor(dependencies.now().getTime() / 1000) +
    MATCH_MEDIA_CONTENT_TTL_SECONDS;
  const sig = await signMatchMediaContentAccess(
    session.writerSecret,
    token,
    body.matchMediaAssetId,
    expUnix,
  );
  const url = new URL(dependencies.requestOrigin);
  url.pathname = `/v1/sessions/${encodeURIComponent(token)}/match-media/assets/${encodeURIComponent(body.matchMediaAssetId)}/content`;
  url.search = "";
  url.searchParams.set("exp", String(expUnix));
  url.searchParams.set("sig", sig);

  const mimeType =
    head.httpMetadata?.contentType?.trim() || "application/octet-stream";

  // Never log url, sig, or object key.
  return response(
    {
      matchMediaAssetId: body.matchMediaAssetId,
      revision: record.revision,
      url: url.toString(),
      expiresAt: new Date(expUnix * 1000).toISOString(),
      mimeType,
      byteLength: head.size,
      acceptRanges: true,
    },
    200,
  );
}

/**
 * Capability-token content delivery for a previously resolved Match-media asset.
 */
export async function handleMatchMediaAssetContent(
  request: Request,
  token: string,
  matchMediaAssetId: string,
  dependencies: MatchMediaResolutionDependencies,
): Promise<Response> {
  if (!dependencies.enabled) return opaqueNotFound();
  const assetId = boundedId(matchMediaAssetId);
  if (!assetId) return resolutionError("Invalid media request", 400);

  const session = await dependencies.readCoachSession(token);
  if (!session?.writerSecret) return opaqueNotFound();

  const requestUrl = new URL(request.url);
  const expUnix = Number(requestUrl.searchParams.get("exp") ?? "");
  const sig = (requestUrl.searchParams.get("sig") ?? "").trim().toLowerCase();
  const ok = await verifyMatchMediaContentAccess(
    session.writerSecret,
    token,
    assetId,
    expUnix,
    sig,
    dependencies.now().getTime(),
  );
  if (!ok) return resolutionError("Unauthorized", 401);

  const storageObjectKey = matchMediaAssetStorageObjectKey(assetId);
  const parsedRange = parseBytesRangeHeader(request.headers.get("Range"));

  if (parsedRange.kind === "none") {
    const object = await dependencies.mediaBucket.get(storageObjectKey);
    if (!object) return opaqueNotFound();
    return contentFullResponse(object);
  }

  const head = await dependencies.mediaBucket.head(storageObjectKey);
  if (!head) return opaqueNotFound();
  const resolved = resolveBytesRange(parsedRange, head.size);
  if (!resolved) return contentRangeNotSatisfiableResponse(head.size);

  const object = await dependencies.mediaBucket.get(storageObjectKey, {
    range: { offset: resolved.offset, length: resolved.length },
  });
  if (!object) return opaqueNotFound();
  return contentPartialResponse(object, resolved);
}

export { MATCH_MEDIA_CONTENT_TTL_SECONDS, attachmentRecordKey };
