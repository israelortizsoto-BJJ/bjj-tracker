import {
  defaultResolveSharedMatchMediaApiBaseUrl,
  defaultSharedMatchMediaUploadHttp,
  SharedMatchMediaUploadClientError,
  type SharedMatchMediaUploadHttp,
} from "./sharedMatchMediaUploadApi.ts";

export type CoachMatchMediaResolveResult = {
  matchMediaAssetId: string;
  revision: number;
  url: string;
  expiresAt: string;
  mimeType: string;
  byteLength: number;
  acceptRanges: boolean;
};

export type CoachMatchMediaResolutionDependencies = {
  http: SharedMatchMediaUploadHttp;
  resolveApiBaseUrl(apiBaseUrlOverride?: string | null): string;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function requiredId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new SharedMatchMediaUploadClientError(`Missing ${name}.`);
  return trimmed;
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  return `HTTP ${status}`;
}

/**
 * Resolve an attached Match-media asset to a short-lived playable URL.
 *
 * The returned URL is response-only / memory-only:
 * - never write to device-local key/value storage
 * - never project into sync artifacts
 * - never prefetch or keep a durable client copy
 * Callers must treat `url` as ephemeral infrastructure.
 */
export async function coachSyncResolveMatchMediaAttachment(input: {
  linkToken: string;
  coachWriterSecret: string;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  matchMediaAssetId: string;
  expectedRevision?: number;
  apiBaseUrlOverride?: string | null;
  dependencies?: Partial<CoachMatchMediaResolutionDependencies>;
}): Promise<CoachMatchMediaResolveResult> {
  const linkToken = requiredId(input.linkToken, "link token");
  const coachWriterSecret = requiredId(
    input.coachWriterSecret,
    "Coach writer secret",
  );
  const sharedAthleteId = requiredId(input.sharedAthleteId, "shared athlete ID");
  const sharedCompetitionId = requiredId(
    input.sharedCompetitionId,
    "shared competition ID",
  );
  const matchLineageKey = requiredId(input.matchLineageKey, "match lineage key");
  const matchMediaAssetId = requiredId(
    input.matchMediaAssetId,
    "match media asset ID",
  );
  if (
    input.expectedRevision !== undefined &&
    (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0)
  ) {
    throw new SharedMatchMediaUploadClientError("Invalid expectedRevision.");
  }

  const http = input.dependencies?.http ?? defaultSharedMatchMediaUploadHttp;
  const resolveApiBaseUrl =
    input.dependencies?.resolveApiBaseUrl ??
    defaultResolveSharedMatchMediaApiBaseUrl;
  const url = joinUrl(
    resolveApiBaseUrl(input.apiBaseUrlOverride),
    `/v1/sessions/${encodeURIComponent(linkToken)}/match-media/attachments/resolve`,
  );

  const body: Record<string, unknown> = {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    matchMediaAssetId,
  };
  if (input.expectedRevision !== undefined) {
    body.expectedRevision = input.expectedRevision;
  }

  const response = await http({
    method: "POST",
    url,
    headers: {
      Authorization: `Bearer ${coachWriterSecret}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = response.json;
  if (response.status < 200 || response.status >= 300) {
    throw new SharedMatchMediaUploadClientError(
      errorMessage(payload, response.status),
      response.status,
    );
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { matchMediaAssetId?: unknown }).matchMediaAssetId !==
      "string" ||
    typeof (payload as { revision?: unknown }).revision !== "number" ||
    typeof (payload as { url?: unknown }).url !== "string" ||
    typeof (payload as { expiresAt?: unknown }).expiresAt !== "string" ||
    typeof (payload as { mimeType?: unknown }).mimeType !== "string" ||
    typeof (payload as { byteLength?: unknown }).byteLength !== "number" ||
    typeof (payload as { acceptRanges?: unknown }).acceptRanges !== "boolean"
  ) {
    throw new SharedMatchMediaUploadClientError(
      "Unexpected match media resolve response.",
      response.status,
    );
  }

  // Return in-memory only — no device-local persistence, sync projection, or durable client copy.
  return {
    matchMediaAssetId: (
      payload as { matchMediaAssetId: string }
    ).matchMediaAssetId.trim(),
    revision: (payload as { revision: number }).revision,
    url: (payload as { url: string }).url.trim(),
    expiresAt: (payload as { expiresAt: string }).expiresAt.trim(),
    mimeType: (payload as { mimeType: string }).mimeType.trim(),
    byteLength: (payload as { byteLength: number }).byteLength,
    acceptRanges: (payload as { acceptRanges: boolean }).acceptRanges,
  };
}
