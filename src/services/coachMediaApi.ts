import * as FileSystem from "expo-file-system/legacy";

import { getCoachSyncApiBaseUrl, logSyncBaseUrlTrace } from "../config/coachSync";
import { CoachWeeklySyncApiError } from "./coachWeeklySyncApi";

export type CoachMediaUploadResult = {
  mediaId: string;
  mimeType: string;
  durationMs?: number;
};

export type CoachMediaResolveResult = {
  mediaId: string;
  url: string;
  expiresAt: string;
  mimeType?: string;
  durationMs?: number;
};

function resolveBase(apiBaseUrlOverride?: string | null): string {
  const fromLink = apiBaseUrlOverride?.trim().replace(/\/+$/, "") ?? "";
  if (fromLink) return fromLink;
  const fromEnv = getCoachSyncApiBaseUrl();
  if (fromEnv) return fromEnv;
  throw new CoachWeeklySyncApiError("Coach sync is not configured on this build.", 0);
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function parseJsonOrText(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Best-effort binary upload of coach commentary audio to the worker R2 lane.
 * Returns domain mediaId only — never persist the resolve URL into artifacts.
 */
export async function coachSyncUploadCoachMedia(
  linkToken: string,
  writerSecret: string,
  localUri: string,
  options?: {
    mimeType?: string | null;
    durationMs?: number | null;
    apiBaseUrlOverride?: string | null;
  },
): Promise<CoachMediaUploadResult> {
  const base = resolveBase(options?.apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const path = `/v1/sessions/${enc}/media`;
  const url = joinUrl(base, path);
  const mimeType = (options?.mimeType?.trim() || "audio/mp4").toLowerCase();
  logSyncBaseUrlTrace({ baseUrl: base, endpoint: path });

  const uploadResult = await FileSystem.uploadAsync(url, localUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${writerSecret}`,
      "Content-Type": mimeType,
      Accept: "application/json",
      ...(options?.durationMs !== undefined &&
      options.durationMs !== null &&
      Number.isFinite(options.durationMs)
        ? { "X-MatMind-Duration-Ms": String(Math.floor(options.durationMs)) }
        : {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = uploadResult.body ? (JSON.parse(uploadResult.body) as unknown) : null;
  } catch {
    payload = uploadResult.body;
  }

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    const msg =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${uploadResult.status}`;
    throw new CoachWeeklySyncApiError(msg, uploadResult.status);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { mediaId?: unknown }).mediaId !== "string"
  ) {
    throw new CoachWeeklySyncApiError("Unexpected media upload response.", uploadResult.status);
  }

  const mediaId = (payload as { mediaId: string }).mediaId.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/i.test(mediaId)) {
    throw new CoachWeeklySyncApiError("Invalid mediaId from upload response.", uploadResult.status);
  }

  const responseMime =
    typeof (payload as { mimeType?: unknown }).mimeType === "string"
      ? (payload as { mimeType: string }).mimeType.trim()
      : mimeType;
  const durationMs =
    typeof (payload as { durationMs?: unknown }).durationMs === "number" &&
    Number.isFinite((payload as { durationMs: number }).durationMs)
      ? (payload as { durationMs: number }).durationMs
      : options?.durationMs ?? undefined;

  return {
    mediaId,
    mimeType: responseMime || mimeType,
    ...(durationMs !== undefined && durationMs !== null ? { durationMs } : {}),
  };
}

/**
 * Resolve a mediaId to a short-lived playable URL. Callers must treat the URL as
 * ephemeral infrastructure — never write it into the Match Breakdown artifact.
 */

function logPlaybackForensics(payload: Record<string, unknown>): void {
  console.log("[PLAYBACK_FORENSICS]", payload);
  try {
    const g = globalThis as typeof globalThis & {
      __PLAYBACK_FORENSICS_LOG__?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(g.__PLAYBACK_FORENSICS_LOG__)) g.__PLAYBACK_FORENSICS_LOG__ = [];
    g.__PLAYBACK_FORENSICS_LOG__.push({ ...payload, ts: new Date().toISOString() });
  } catch {
    // ignore
  }
}

export async function coachSyncResolveCoachMedia(
  linkToken: string,
  mediaId: string,
  apiBaseUrlOverride?: string | null,
): Promise<CoachMediaResolveResult> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const id = mediaId.trim().toLowerCase();
  const path = `/v1/sessions/${enc}/media/${encodeURIComponent(id)}`;
  const url = joinUrl(base, path);
  logSyncBaseUrlTrace({ baseUrl: base, endpoint: path });

  const fetchStartedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    // Instrumentation only — rethrow unchanged.
    logPlaybackForensics( {
      stage: "PLAYBACK_RESOLVE_ERROR",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  logPlaybackForensics( {
    stage: "PLAYBACK_RESOLVE_HTTP",
    status: res.status,
    ok: res.ok,
    elapsedMs: Date.now() - fetchStartedAt,
  });
  const payload = await parseJsonOrText(res);
  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${res.status}`;
    logPlaybackForensics( {
      stage: "PLAYBACK_RESOLVE_ERROR",
      error: msg,
    });
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { mediaId?: unknown }).mediaId !== "string" ||
    typeof (payload as { url?: unknown }).url !== "string" ||
    typeof (payload as { expiresAt?: unknown }).expiresAt !== "string"
  ) {
    logPlaybackForensics( {
      stage: "PLAYBACK_RESOLVE_ERROR",
      error: "Unexpected media resolve response.",
    });
    throw new CoachWeeklySyncApiError("Unexpected media resolve response.", res.status);
  }

  const resolvedUrl = (payload as { url: string }).url.trim();
  let urlHost: string | null = null;
  try {
    urlHost = new URL(resolvedUrl).host;
  } catch {
    urlHost = null;
  }
  const contentType =
    typeof (payload as { mimeType?: unknown }).mimeType === "string"
      ? (payload as { mimeType: string }).mimeType.trim()
      : null;
  logPlaybackForensics( {
    stage: "PLAYBACK_RESOLVE_SUCCESS",
    mediaId: (payload as { mediaId: string }).mediaId.trim().toLowerCase(),
    expiresAt: (payload as { expiresAt: string }).expiresAt.trim(),
    hasUrl: Boolean(resolvedUrl),
    urlHost,
    contentType,
  });

  return {
    mediaId: (payload as { mediaId: string }).mediaId.trim().toLowerCase(),
    url: resolvedUrl,
    expiresAt: (payload as { expiresAt: string }).expiresAt.trim(),
    ...(typeof (payload as { mimeType?: unknown }).mimeType === "string"
      ? { mimeType: (payload as { mimeType: string }).mimeType.trim() }
      : {}),
    ...(typeof (payload as { durationMs?: unknown }).durationMs === "number"
      ? { durationMs: (payload as { durationMs: number }).durationMs }
      : {}),
  };
}
