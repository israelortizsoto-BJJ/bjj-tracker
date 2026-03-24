import { getCoachSyncApiBaseUrl } from "../config/coachSync";
import type {
  CoachWeeklySyncCreateAthleteBody,
  CoachWeeklySyncCreateAthleteResponse,
  CoachWeeklySyncCreateCompetitionBody,
  CoachWeeklySyncCreateCompetitionResponse,
  CoachWeeklySyncCreateSessionBody,
  CoachWeeklySyncCreateSessionResponse,
  CoachWeeklySyncPublishBody,
  CoachWeeklySyncRedeemParentWriterResponse,
  CoachWeeklySyncSessionResponse,
  CoachWeeklySyncUpdateCompetitionBody,
  SyncedSharedCompetition,
  SyncedSharedAthlete,
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

/** Best-effort message for failed coach-sync HTTP responses (JSON, plain text, or empty). */
function coachSyncFailureMessage(res: Response, payload: unknown): string {
  if (typeof payload === "object" && payload && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  if (typeof payload === "string") {
    const t = payload.trim();
    if (t.length > 0) return t.length <= 280 ? t : `${t.slice(0, 280)}…`;
  }
  return `HTTP ${res.status}`;
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
  const p = payload as Record<string, unknown>;
  let athletes: SyncedSharedAthlete[] = [];
  if (Array.isArray(p.athletes)) {
    athletes = p.athletes.filter(
      (a): a is SyncedSharedAthlete =>
        Boolean(a) &&
        typeof a === "object" &&
        typeof (a as { id?: unknown }).id === "string" &&
        typeof (a as { name?: unknown }).name === "string" &&
        typeof (a as { createdAt?: unknown }).createdAt === "string",
    );
  }
  let competitions: SyncedSharedCompetition[] = [];
  if (Array.isArray(p.competitions)) {
    competitions = p.competitions.filter(
      (c): c is SyncedSharedCompetition =>
        Boolean(c) &&
        typeof c === "object" &&
        typeof (c as { id?: unknown }).id === "string" &&
        typeof (c as { sharedAthleteId?: unknown }).sharedAthleteId === "string" &&
        typeof (c as { tournamentName?: unknown }).tournamentName === "string" &&
        typeof (c as { eventDate?: unknown }).eventDate === "string" &&
        typeof (c as { createdAt?: unknown }).createdAt === "string" &&
        typeof (c as { updatedAt?: unknown }).updatedAt === "string",
    );
  }
  return {
    ...(typeof p.schemaVersion === "number" ? { schemaVersion: p.schemaVersion } : {}),
    coach: p.coach as CoachWeeklySyncSessionResponse["coach"],
    weekly: (p.weekly ?? null) as CoachWeeklySyncSessionResponse["weekly"],
    athletes,
    competitions,
  };
}

export async function coachSyncRedeemParentWriter(
  linkToken: string,
  apiBaseUrlOverride?: string | null,
): Promise<CoachWeeklySyncRedeemParentWriterResponse> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const res = await fetch(joinUrl(base, `/v1/sessions/${enc}/parent-redeem`), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
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
    typeof (payload as { parentWriterSecret?: unknown }).parentWriterSecret !== "string"
  ) {
    throw new CoachWeeklySyncApiError("Unexpected response from sync service.", res.status);
  }
  return payload as CoachWeeklySyncRedeemParentWriterResponse;
}

export async function coachSyncCreateSessionAthlete(
  linkToken: string,
  parentWriterSecret: string,
  body: CoachWeeklySyncCreateAthleteBody,
  apiBaseUrlOverride?: string | null,
): Promise<CoachWeeklySyncCreateAthleteResponse> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const res = await fetch(joinUrl(base, `/v1/sessions/${enc}/athletes`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${parentWriterSecret}`,
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
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { athlete?: unknown }).athlete !== "object" ||
    !(payload as { athlete: { id?: unknown } }).athlete ||
    typeof (payload as { athlete: { id?: unknown } }).athlete.id !== "string"
  ) {
    throw new CoachWeeklySyncApiError("Unexpected response from sync service.", res.status);
  }
  return payload as CoachWeeklySyncCreateAthleteResponse;
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

export async function coachSyncCreateSessionCompetition(
  linkToken: string,
  parentWriterSecret: string,
  body: CoachWeeklySyncCreateCompetitionBody,
  apiBaseUrlOverride?: string | null,
): Promise<CoachWeeklySyncCreateCompetitionResponse> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${parentWriterSecret}`,
  };
  const serialized = JSON.stringify(body);
  const url = joinUrl(base, `/v1/sessions/${enc}/competitions`);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: serialized,
  });
  const payload = await parseJsonOrText(res);
  if (__DEV__) {
    console.log("[bjj-sync-debug] parent create competition", {
      url,
      linkToken,
      hasParentWriterSecret: Boolean(parentWriterSecret?.trim()),
      sharedAthleteId: body.sharedAthleteId,
      httpStatus: res.status,
      errorPayload: !res.ok ? payload : undefined,
    });
  }
  if (!res.ok) {
    throw new CoachWeeklySyncApiError(coachSyncFailureMessage(res, payload), res.status);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { competition?: unknown }).competition !== "object"
  ) {
    throw new CoachWeeklySyncApiError("Unexpected response from sync service.", res.status);
  }
  return payload as CoachWeeklySyncCreateCompetitionResponse;
}

export async function coachSyncUpdateSessionCompetition(
  linkToken: string,
  competitionId: string,
  parentWriterSecret: string,
  body: CoachWeeklySyncUpdateCompetitionBody,
  apiBaseUrlOverride?: string | null,
): Promise<void> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const compEnc = encodeURIComponent(competitionId);
  const res = await fetch(joinUrl(base, `/v1/sessions/${enc}/competitions/${compEnc}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${parentWriterSecret}`,
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

export async function coachSyncDeleteSessionCompetition(
  linkToken: string,
  competitionId: string,
  parentWriterSecret: string,
  apiBaseUrlOverride?: string | null,
): Promise<void> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const compEnc = encodeURIComponent(competitionId);
  const url = joinUrl(base, `/v1/sessions/${enc}/competitions/${compEnc}`);
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${parentWriterSecret}`,
    },
  });
  const payload = await parseJsonOrText(res);
  if (__DEV__) {
    console.log("[bjj-sync-debug] parent delete competition", {
      url,
      linkToken,
      competitionId,
      linkTokenTail: linkToken.length > 8 ? linkToken.slice(-8) : linkToken,
      hasParentWriterSecret: Boolean(parentWriterSecret?.trim()),
      httpStatus: res.status,
      errorPayload: !res.ok ? payload : undefined,
    });
  }
  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
}
