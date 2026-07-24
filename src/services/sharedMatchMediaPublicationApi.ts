import {
  defaultResolveSharedMatchMediaApiBaseUrl,
  defaultSharedMatchMediaUploadHttp,
  SharedMatchMediaUploadClientError,
  type SharedMatchMediaUploadHttp,
} from "./sharedMatchMediaUploadApi.ts";

export type ParentMatchMediaPublicationResult =
  | { outcome: "attached" | "replaced" | "idempotent"; revision: number }
  | { outcome: "conflict"; currentRevision: number | null };

export type ParentMatchMediaPublicationDependencies = {
  http: SharedMatchMediaUploadHttp;
  resolveApiBaseUrl(apiBaseUrlOverride?: string | null): string;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  return `HTTP ${status}`;
}

function requiredId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new SharedMatchMediaUploadClientError(`Missing ${name}.`);
  return trimmed;
}

/**
 * Parent request for the existing publication boundary. The Worker remains the
 * authority for Parent access, Match ownership, verification, and CAS state.
 */
export async function publishParentMatchMediaAttachment(input: {
  linkToken: string;
  parentWriterSecret: string;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  matchMediaAssetId: string;
  objectVersion: string;
  expectedRevision: 0;
  apiBaseUrlOverride?: string | null;
  dependencies?: Partial<ParentMatchMediaPublicationDependencies>;
}): Promise<ParentMatchMediaPublicationResult> {
  const linkToken = requiredId(input.linkToken, "link token");
  const parentWriterSecret = requiredId(input.parentWriterSecret, "Parent writer secret");
  const sharedAthleteId = requiredId(input.sharedAthleteId, "shared athlete ID");
  const sharedCompetitionId = requiredId(input.sharedCompetitionId, "shared competition ID");
  const matchLineageKey = requiredId(input.matchLineageKey, "match lineage key");
  const matchMediaAssetId = requiredId(input.matchMediaAssetId, "match media asset ID");
  const objectVersion = requiredId(input.objectVersion, "object version");
  const http = input.dependencies?.http ?? defaultSharedMatchMediaUploadHttp;
  const resolveApiBaseUrl =
    input.dependencies?.resolveApiBaseUrl ?? defaultResolveSharedMatchMediaApiBaseUrl;
  const url = joinUrl(
    resolveApiBaseUrl(input.apiBaseUrlOverride),
    `/v1/sessions/${encodeURIComponent(linkToken)}/match-media/attachments`,
  );
  const idempotencyKey = [
    "match-media-publication-v1",
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    matchMediaAssetId,
    objectVersion,
    "r0",
  ].join(":");
  const response = await http({
    method: "PUT",
    url,
    headers: {
      Authorization: `Bearer ${parentWriterSecret}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 160),
    },
    body: JSON.stringify({
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      matchMediaAssetId,
      objectVersion,
      expectedRevision: 0,
    }),
  });
  const body = response.json;
  if (response.status === 409) {
    const currentRevision =
      body && typeof body === "object" && typeof (body as { currentRevision?: unknown }).currentRevision === "number"
        ? (body as { currentRevision: number }).currentRevision
        : null;
    return { outcome: "conflict", currentRevision };
  }
  if (![200, 201].includes(response.status) || !body || typeof body !== "object") {
    throw new SharedMatchMediaUploadClientError(errorMessage(body, response.status), response.status);
  }
  const outcome = (body as { outcome?: unknown }).outcome;
  const attachment = (body as { attachment?: { revision?: unknown } }).attachment;
  if (
    (outcome !== "attached" && outcome !== "replaced" && outcome !== "idempotent") ||
    !attachment ||
    !Number.isSafeInteger(attachment.revision)
  ) {
    throw new SharedMatchMediaUploadClientError("Unexpected Match Media publication response.", response.status);
  }
  return { outcome, revision: attachment.revision as number };
}
