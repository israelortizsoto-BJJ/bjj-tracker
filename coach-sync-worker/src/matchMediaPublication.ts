/**
 * Flag-gated Parent MatchMediaAttachment publication for coach-sync-worker.
 *
 * Enabled only when SHARED_MATCH_MEDIA_PUBLICATION_ENABLED === "1".
 * Resolves objectVersion from the sealed Production Verification record after
 * an R2 HEAD of the deterministic asset key — never from client authority.
 */

import {
  PRODUCTION_VERIFICATION_CONTRACT_VERSION,
  createConditionalObjectVerificationRecordStore,
  deriveVerifiedMediaPublicationEligibility,
  getVerificationRecord,
  type ProductionVerificationRecord,
} from "../../shared-match-media-production-verification/src/index.ts";
import { PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING } from "../../shared-match-media-production-verification/src/storageBucketBinding.ts";
import {
  attachmentRecordKey,
  createConditionalObjectAttachmentRecordStore,
  mutateMatchMediaAttachment,
  type MatchMediaAttachment,
  type PublicationMutationResult,
} from "../../shared-match-media-publication/src/index.ts";
import type { MatchMediaParentSession } from "./sharedMatchMediaUpload.ts";
import { createR2ConditionalObjectStore } from "./productionVerification/r2ConditionalObjectStore.ts";

const MAX_PUBLICATION_BODY_BYTES = 16 * 1024;
const MAX_IDEMPOTENCY_KEY_CHARS = 160;
const MAX_DOMAIN_ID_CHARS = 200;

export type PublicationMediaBucket = {
  get(key: string): Promise<{ text(): Promise<string>; etag: string } | null>;
  put(
    key: string,
    value: string,
    options: {
      onlyIf:
        | { etagDoesNotMatch: "*" }
        | { etagMatches: string };
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
    },
  ): Promise<{ etag: string } | null>;
  head(key: string): Promise<{ version?: string } | null>;
};

export type MatchMediaPublicationDependencies = {
  readonly enabled: boolean;
  readonly mediaBucket: PublicationMediaBucket;
  readonly readParentSession: (
    token: string,
  ) => Promise<MatchMediaParentSession | null>;
  readonly now: () => Date;
};

type PublishAttachmentBody = {
  readonly sharedAthleteId: string;
  readonly sharedCompetitionId: string;
  readonly matchLineageKey: string;
  readonly matchMediaAssetId: string;
  readonly expectedRevision: number;
  /** Assertion-only. Must match sealed verification objectVersion when present. */
  readonly objectVersionAssertion?: string;
};

function response(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status });
}

function publicationError(
  message: string,
  status: number,
  extras: Record<string, unknown> = {},
): Response {
  return response({ error: message, ...extras }, status);
}

function opaqueNotFound(): Response {
  return publicationError("Not found", 404);
}

export function isPublicationFeatureEnabled(value: string | undefined): boolean {
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
      if (total > MAX_PUBLICATION_BODY_BYTES) {
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

function parsePublishBody(raw: unknown): PublishAttachmentBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const sharedAthleteId = boundedId(value.sharedAthleteId);
  const sharedCompetitionId = boundedId(value.sharedCompetitionId);
  const matchLineageKey = boundedId(value.matchLineageKey);
  const matchMediaAssetId = boundedId(value.matchMediaAssetId);
  const expectedRevision = value.expectedRevision;
  const objectVersionAssertion =
    value.objectVersion === undefined
      ? undefined
      : typeof value.objectVersion === "string"
        ? value.objectVersion.trim()
        : "";
  if (
    !sharedAthleteId ||
    !sharedCompetitionId ||
    !matchLineageKey ||
    !matchMediaAssetId ||
    typeof expectedRevision !== "number" ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    objectVersionAssertion === ""
  ) {
    return null;
  }
  return {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    matchMediaAssetId,
    expectedRevision,
    ...(objectVersionAssertion !== undefined
      ? { objectVersionAssertion }
      : {}),
  };
}

function sessionContainsMatch(
  session: MatchMediaParentSession,
  body: Pick<
    PublishAttachmentBody,
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

async function authorizeParent(
  request: Request,
  token: string,
  dependencies: MatchMediaPublicationDependencies,
): Promise<MatchMediaParentSession | Response> {
  if (!dependencies.enabled) return opaqueNotFound();
  const secret = bearerSecret(request);
  if (!secret) return publicationError("Unauthorized", 401);
  const session = await dependencies.readParentSession(token);
  if (
    !session?.parentWriterSecret ||
    !(await secureEqual(secret, session.parentWriterSecret))
  ) {
    return publicationError("Unauthorized", 401);
  }
  return session;
}

function publicAttachment(record: MatchMediaAttachment): Record<string, unknown> {
  if (record.state === "attached") {
    return {
      schemaVersion: record.schemaVersion,
      sharedAthleteId: record.sharedAthleteId,
      sharedCompetitionId: record.sharedCompetitionId,
      matchLineageKey: record.matchLineageKey,
      revision: record.revision,
      state: record.state,
      matchMediaAssetId: record.matchMediaAssetId,
      objectVersion: record.objectVersion,
      publishedAt: record.publishedAt,
      updatedAt: record.updatedAt,
    };
  }
  return {
    schemaVersion: record.schemaVersion,
    sharedAthleteId: record.sharedAthleteId,
    sharedCompetitionId: record.sharedCompetitionId,
    matchLineageKey: record.matchLineageKey,
    revision: record.revision,
    state: record.state,
    tombstonedAt: record.tombstonedAt,
    updatedAt: record.updatedAt,
  };
}

function mapMutationResult(result: PublicationMutationResult): Response {
  switch (result.outcome) {
    case "attached":
      return response(
        {
          attachment: publicAttachment(result.record),
          outcome: result.outcome,
          reasonCode: result.reasonCode,
          idempotentReplay: false,
        },
        201,
      );
    case "replaced":
      return response(
        {
          attachment: publicAttachment(result.record),
          outcome: result.outcome,
          reasonCode: result.reasonCode,
          idempotentReplay: false,
        },
        200,
      );
    case "idempotent":
      return response(
        {
          attachment: publicAttachment(result.record),
          outcome: result.outcome,
          reasonCode: result.reasonCode,
          idempotentReplay: true,
        },
        200,
      );
    case "conflict":
      return publicationError("Revision conflict", 409, {
        reasonCode: result.reasonCode,
        currentRevision: result.currentRevision,
        current: result.current ? publicAttachment(result.current) : null,
      });
    case "denied":
      return mapDenied(result.reasonCode, result.current);
    case "tombstoned":
      return response(
        {
          attachment: publicAttachment(result.record),
          outcome: result.outcome,
          reasonCode: result.reasonCode,
          idempotentReplay: false,
        },
        200,
      );
    default: {
      const _exhaustive: never = result;
      return publicationError("Publication failed", 500, {
        reasonCode: "INVALID_INPUT",
        detail: String(_exhaustive),
      });
    }
  }
}

function mapDenied(
  reasonCode: Extract<PublicationMutationResult, { outcome: "denied" }>["reasonCode"],
  current: MatchMediaAttachment | null,
): Response {
  const payload = {
    reasonCode,
    current: current ? publicAttachment(current) : null,
  };
  switch (reasonCode) {
    case "PARENT_AUTHORITY_REQUIRED":
    case "ATHLETE_LINEAGE_MISMATCH":
    case "COMPETITION_LINEAGE_MISMATCH":
    case "MATCH_LINEAGE_MISMATCH":
      return publicationError("Forbidden", 403, payload);
    case "MEDIA_NOT_VERIFIED":
    case "MEDIA_ASSET_MISMATCH":
    case "OBJECT_VERSION_MISMATCH":
    case "INVALID_STATE_TRANSITION":
      return publicationError("Publication denied", 422, payload);
    case "INVALID_INPUT":
      return publicationError("Invalid publication request", 400, payload);
    case "PERSISTED_RECORD_INVALID":
      return publicationError("Publication store invalid", 500, payload);
    default: {
      const _exhaustive: never = reasonCode;
      return publicationError("Publication denied", 422, {
        reasonCode: String(_exhaustive),
        current: payload.current,
      });
    }
  }
}

function recordLineageMatches(
  record: ProductionVerificationRecord,
  body: PublishAttachmentBody,
): boolean {
  return (
    (record.athleteId?.trim() ?? "") === body.sharedAthleteId &&
    (record.competitionId?.trim() ?? "") === body.sharedCompetitionId &&
    (record.matchLineageKey?.trim() ?? "") === body.matchLineageKey
  );
}

/**
 * Parent-authorized attach/replace publication.
 *
 * Provenance path:
 *   HEAD(match-media/assets/{asset}/original).version
 *   → verification record admission lookup
 *   → sealed record.objectVersion (must equal HEAD)
 *   → optional client objectVersion assertion must equal sealed version
 *   → CAS attach via shared-match-media-publication
 */
export async function handlePublishMatchMediaAttachment(
  request: Request,
  token: string,
  dependencies: MatchMediaPublicationDependencies,
): Promise<Response> {
  const authorized = await authorizeParent(request, token, dependencies);
  if (authorized instanceof Response) return authorized;
  const session = authorized;

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_CHARS) {
    return publicationError("Valid Idempotency-Key required", 400);
  }

  let rawBody: unknown;
  try {
    rawBody = await readBoundedJson(request);
  } catch {
    return publicationError("Invalid publication request", 400);
  }
  const body = parsePublishBody(rawBody);
  if (!body) return publicationError("Invalid publication request", 400);
  if (!sessionContainsMatch(session, body)) {
    return publicationError("Match not found", 404);
  }

  const storageObjectKey = matchMediaAssetStorageObjectKey(body.matchMediaAssetId);
  const head = await dependencies.mediaBucket.head(storageObjectKey);
  const headVersion = head?.version?.trim() ?? "";
  if (!head || !headVersion) {
    return publicationError("Publication denied", 422, {
      reasonCode: "MEDIA_NOT_VERIFIED",
      current: null,
    });
  }

  const verificationStore = createConditionalObjectVerificationRecordStore(
    createR2ConditionalObjectStore(dependencies.mediaBucket),
  );
  const record = await getVerificationRecord(
    {
      contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
      storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
      matchMediaAssetId: body.matchMediaAssetId,
      objectVersion: headVersion,
      storageObjectKey,
    },
    verificationStore,
  );

  const eligibility = await deriveVerifiedMediaPublicationEligibility(
    {
      contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
      storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
      matchMediaAssetId: body.matchMediaAssetId,
      objectVersion: headVersion,
      storageObjectKey,
    },
    record,
  );

  if (
    !record ||
    eligibility.presence !== "present" ||
    !eligibility.publicationEligible ||
    record.state !== "verified"
  ) {
    return publicationError("Publication denied", 422, {
      reasonCode: "MEDIA_NOT_VERIFIED",
      current: null,
    });
  }

  // Sealed verification providerVersion is publication authority.
  const sealedObjectVersion = record.objectVersion.trim();
  if (!sealedObjectVersion || sealedObjectVersion !== headVersion) {
    return publicationError("Publication denied", 422, {
      reasonCode: "OBJECT_VERSION_MISMATCH",
      current: null,
    });
  }
  if (
    body.objectVersionAssertion !== undefined &&
    body.objectVersionAssertion !== sealedObjectVersion
  ) {
    return publicationError("Publication denied", 422, {
      reasonCode: "OBJECT_VERSION_MISMATCH",
      current: null,
    });
  }
  if (record.matchMediaAssetId.trim() !== body.matchMediaAssetId) {
    return publicationError("Publication denied", 422, {
      reasonCode: "MEDIA_ASSET_MISMATCH",
      current: null,
    });
  }
  if (!recordLineageMatches(record, body)) {
    const athleteOk =
      (record.athleteId?.trim() ?? "") === body.sharedAthleteId;
    const competitionOk =
      (record.competitionId?.trim() ?? "") === body.sharedCompetitionId;
    const reasonCode = !athleteOk
      ? "ATHLETE_LINEAGE_MISMATCH"
      : !competitionOk
        ? "COMPETITION_LINEAGE_MISMATCH"
        : "MATCH_LINEAGE_MISMATCH";
    return publicationError("Forbidden", 403, {
      reasonCode,
      current: null,
    });
  }

  const attachmentStore = createConditionalObjectAttachmentRecordStore(
    createR2ConditionalObjectStore(dependencies.mediaBucket, {
      recordType: "match-media-attachment-v1",
    }),
  );

  const result = await mutateMatchMediaAttachment(
    {
      type: "attach",
      target: {
        sharedAthleteId: body.sharedAthleteId,
        sharedCompetitionId: body.sharedCompetitionId,
        matchLineageKey: body.matchLineageKey,
      },
      authority: {
        authority: "parent",
        sharedAthleteId: body.sharedAthleteId,
        sharedCompetitionId: body.sharedCompetitionId,
        matchLineageKey: body.matchLineageKey,
      },
      expectedRevision: body.expectedRevision,
      media: {
        matchMediaAssetId: record.matchMediaAssetId.trim(),
        objectVersion: sealedObjectVersion,
      },
      verification: {
        publicationEligible: eligibility.publicationEligible,
        verificationState: "verified",
        sharedAthleteId: body.sharedAthleteId,
        sharedCompetitionId: body.sharedCompetitionId,
        matchLineageKey: body.matchLineageKey,
        matchMediaAssetId: record.matchMediaAssetId.trim(),
        objectVersion: sealedObjectVersion,
      },
    },
    {
      store: attachmentStore,
      now: dependencies.now,
    },
  );

  return mapMutationResult(result);
}

export { attachmentRecordKey };
