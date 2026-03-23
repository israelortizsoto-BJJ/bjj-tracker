import { getCoachSyncApiBaseUrl } from "../config/coachSync";
import type {
  CoachWeeklySyncCreateSessionBody,
  CoachWeeklySyncCreateSessionResponse,
  CoachWeeklySyncPublishBody,
  CoachWeeklySyncSessionResponse,
} from "../types/coachWeeklySync";

export class CoachWeeklySyncApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CoachWeeklySyncApiError";
    this.status = status;
  }
}

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

export async function coachSyncCreateSession(
  body: CoachWeeklySyncCreateSessionBody,
): Promise<CoachWeeklySyncCreateSessionResponse> {
  const base = resolveBase();
  const res = await fetch(joinUrl(base, "/v1/sessions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parseJsonOrText(res);
  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { linkToken?: unknown }).linkToken !== "string" ||
    typeof (payload as { writerSecret?: unknown }).writerSecret !== "string" ||
    typeof (payload as { coachId?: unknown }).coachId !== "string"
  ) {
    throw new CoachWeeklySyncApiError("Unexpected response from sync service.", res.status);
  }
  return payload as CoachWeeklySyncCreateSessionResponse;
}

export async function coachSyncFetchSession(
  linkToken: string,
  apiBaseUrlOverride?: string | null,
): Promise<CoachWeeklySyncSessionResponse> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const res = await fetch(joinUrl(base, `/v1/sessions/${enc}`), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const payload = await parseJsonOrText(res);
  if (res.status === 404) {
    throw new CoachWeeklySyncApiError("That invite code was not found. Check for typos.", 404);
  }
  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { coach?: unknown }).coach !== "object" ||
    !("weekly" in (payload as object))
  ) {
    throw new CoachWeeklySyncApiError("Unexpected response from sync service.", res.status);
  }
  return payload as CoachWeeklySyncSessionResponse;
}

export async function coachSyncPublishWeekly(
  linkToken: string,
  writerSecret: string,
  body: CoachWeeklySyncPublishBody,
  apiBaseUrlOverride?: string | null,
): Promise<void> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const res = await fetch(joinUrl(base, `/v1/sessions/${enc}/weekly`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${writerSecret}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await parseJsonOrText(res);
  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
}
