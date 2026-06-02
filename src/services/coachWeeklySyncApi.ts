import { getCoachSyncApiBaseUrl } from "../config/coachSync";
import { logAthleteLineageTrace } from "../identity/athleteLineageTrace";
import {
  IdentityDuplicateRiskBlockedError,
  resolveCanonicalBindBeforeSessionAthletePost,
  type CanonicalBindDecision,
  type CanonicalBindFlowSource,
} from "../identity/canonicalBindResolution";
import { logIdentityMintTrace } from "../identity/identityMintTrace";
import type { ParentAthlete } from "../storage/athleteStore";
import type { KidsById } from "../types/coachKid";
import { isPublishableSystemKey } from "../lib/taxonomy/publishableSystemKey";
import {
  athleteIdSetFromSynced,
  logHydrationPipelineWatchAthletes,
  namesByIdFromSyncedAthletes,
} from "../identity/hydrationPipelineTrace";
import type {
  CoachWeeklySyncCreateAthleteBody,
  CoachWeeklySyncCreateAthleteResponse,
  CoachWeeklySyncCreateCompetitionBody,
  CoachWeeklySyncCreateCompetitionResponse,
  CoachWeeklySyncCreateSessionBody,
  CoachWeeklySyncCreateSessionResponse,
  CoachWeeklySyncPublishBody,
  CoachWeeklySyncWeeklyPutBody,
  CoachWeeklySyncPutCompetitionAggregateBody,
  CoachWeeklySyncPutCompetitionTopologyBody,
  CoachWeeklySyncPutTrainingProofBody,
  CoachWeeklySyncRedeemParentWriterResponse,
  CoachWeeklySyncSessionResponse,
  CoachWeeklySyncUpdateCompetitionBody,
  SyncedCompetitionAggregateArtifact,
  SyncedCompetitionTopologyArtifact,
  SyncedTrainingProofArtifact,
  SyncedSharedAthlete,
  SyncedSharedCompetition,
  SyncedWeeklyMessagePayload,
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

/** Basic shape guard for weekly docs inside `weeklyByAthleteId` (and consistent with `weekly`). */
function isSyncedWeeklyMessagePayloadShape(v: unknown): v is SyncedWeeklyMessagePayload {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.weekStartYMD === "string" &&
    typeof o.headline === "string" &&
    typeof o.body === "string" &&
    typeof o.updatedAt === "string"
  );
}

/**
 * Parses `weeklyByAthleteId` from session GET JSON.
 * Non-object → `{}`. Invalid values are dropped (resolver will fall back to `weekly`).
 */
function isSyncedCompetitionAggregateArtifact(v: unknown): v is SyncedCompetitionAggregateArtifact {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.sharedAthleteId === "string" &&
    typeof o.updatedAt === "string" &&
    typeof o.totalCompetitions === "number" &&
    typeof o.totalMatches === "number" &&
    typeof o.wins === "number" &&
    typeof o.losses === "number"
  );
}

function parseCompetitionAggregateByAthleteIdField(
  raw: unknown,
): Record<string, SyncedCompetitionAggregateArtifact> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SyncedCompetitionAggregateArtifact> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || !isSyncedCompetitionAggregateArtifact(value)) continue;
    if (value.sharedAthleteId.trim() !== id) continue;
    out[id] = value;
  }
  return out;
}

function isSyncedCompetitionTopologyArtifact(
  v: unknown,
): v is SyncedCompetitionTopologyArtifact {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (
    o.schemaVersion !== 1 ||
    typeof o.sharedAthleteId !== "string" ||
    typeof o.updatedAt !== "string" ||
    !Array.isArray(o.competitions)
  ) {
    return false;
  }
  return o.competitions.every((competition) => {
    if (!competition || typeof competition !== "object" || Array.isArray(competition)) {
      return false;
    }
    const c = competition as Record<string, unknown>;
    return (
      typeof c.sharedCompetitionId === "string" &&
      typeof c.sharedAthleteId === "string" &&
      typeof c.competitionLineageKey === "string" &&
      typeof c.updatedAt === "string" &&
      Array.isArray(c.matches) &&
      c.matches.every((match) => {
        if (!match || typeof match !== "object" || Array.isArray(match)) return false;
        const m = match as Record<string, unknown>;
        return (
          typeof m.matchLineageKey === "string" &&
          typeof m.ordinal === "number" &&
          Number.isFinite(m.ordinal) &&
          (m.result === "win" || m.result === "loss" || m.result === null) &&
          (m.durationSeconds === null ||
            (typeof m.durationSeconds === "number" && Number.isFinite(m.durationSeconds)))
        );
      })
    );
  });
}

function parseCompetitionTopologyByAthleteIdField(
  raw: unknown,
): Record<string, SyncedCompetitionTopologyArtifact> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SyncedCompetitionTopologyArtifact> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || !isSyncedCompetitionTopologyArtifact(value)) {
      if (__DEV__) {
        console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_invalid", {
          sharedAthleteId: id || null,
          reason: !id ? "missing_map_key" : "invalid_artifact",
        });
      }
      continue;
    }
    if (value.sharedAthleteId.trim() !== id) {
      if (__DEV__) {
        console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_invalid", {
          sharedAthleteId: id,
          reason: "sharedAthleteIdKeyMismatch",
        });
      }
      continue;
    }
    out[id] = value;
  }
  return out;
}

function isSyncedTrainingProofRankedItem(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.key === "string" &&
    typeof o.label === "string" &&
    typeof o.count === "number" &&
    Number.isFinite(o.count)
  );
}

function isSyncedTrainingProofArtifact(v: unknown): v is SyncedTrainingProofArtifact {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.sharedAthleteId === "string" &&
    typeof o.updatedAt === "string" &&
    typeof o.currentWeekSessionCount === "number" &&
    typeof o.weeklyGoalMet === "boolean" &&
    (o.lastTrainingDateYMD === null || typeof o.lastTrainingDateYMD === "string") &&
    (o.dominantSystemKey === null || typeof o.dominantSystemKey === "string") &&
    Array.isArray(o.topSystems) &&
    o.topSystems.every(isSyncedTrainingProofRankedItem) &&
    Array.isArray(o.topTechniques) &&
    o.topTechniques.every(isSyncedTrainingProofRankedItem)
  );
}

function parseTrainingProofByAthleteIdField(
  raw: unknown,
): Record<string, SyncedTrainingProofArtifact> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SyncedTrainingProofArtifact> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || !isSyncedTrainingProofArtifact(value)) continue;
    if (value.sharedAthleteId.trim() !== id) continue;
    out[id] = value;
  }
  return out;
}

function parseWeeklyByAthleteIdField(raw: unknown): Record<string, SyncedWeeklyMessagePayload | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, SyncedWeeklyMessagePayload | null> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    if (v === null) {
      out[key] = null;
      continue;
    }
    if (isSyncedWeeklyMessagePayloadShape(v)) {
      out[key] = v;
    }
  }
  return out;
}

export async function coachSyncFetchSession(
  linkToken: string,
  apiBaseUrlOverride?: string | null,
): Promise<CoachWeeklySyncSessionResponse> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const url = joinUrl(base, `/v1/sessions/${enc}`);
  const method = "GET";
  const body = undefined;
  console.log("[API CALL]", {
    url,
    method,
    body,
  });
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    console.error("[API FETCH FAILED]", err);
    throw err;
  }
  console.log("[API RESPONSE STATUS]", res.status);
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
  const weeklyByAthleteId = parseWeeklyByAthleteIdField(p.weeklyByAthleteId);
  const competitionAggregateByAthleteId = parseCompetitionAggregateByAthleteIdField(
    p.competitionAggregateByAthleteId,
  );
  const competitionTopologyByAthleteId = parseCompetitionTopologyByAthleteIdField(
    p.competitionTopologyByAthleteId,
  );
  const trainingProofByAthleteId = parseTrainingProofByAthleteIdField(p.trainingProofByAthleteId);
  if (__DEV__) {
    const inviteSk =
      p.weekly && typeof p.weekly === "object" && !Array.isArray(p.weekly)
        ? (p.weekly as { systemKey?: unknown }).systemKey
        : undefined;
    const rawWeeklyBy = p.weeklyByAthleteId;
    const inviteWeeklyObj =
      p.weekly && typeof p.weekly === "object" && !Array.isArray(p.weekly)
        ? (p.weekly as Record<string, unknown>)
        : null;
    const rawKeysSk =
      rawWeeklyBy && typeof rawWeeklyBy === "object" && !Array.isArray(rawWeeklyBy)
        ? Object.fromEntries(
            Object.entries(rawWeeklyBy as Record<string, unknown>).map(([id, node]) => {
              const o = node && typeof node === "object" && !Array.isArray(node) ? node : null;
              return [
                id,
                o && Object.prototype.hasOwnProperty.call(o, "systemKey")
                  ? (o as { systemKey?: unknown }).systemKey
                  : undefined,
              ];
            }),
          )
        : {};
    console.log("[SYSTEMKEY TRACE CLIENT]", {
      traceStage: "7_GET_response_payload_client_parsed",
      headline:
        typeof inviteWeeklyObj?.headline === "string"
          ? inviteWeeklyObj.headline.slice(0, 120)
          : null,
      systemKey: typeof inviteSk === "string" ? inviteSk : null,
      athleteId: null,
      weekStartYMD:
        typeof inviteWeeklyObj?.weekStartYMD === "string" ? inviteWeeklyObj.weekStartYMD : null,
      inviteWeeklyRawSystemKey: inviteWeeklyObj &&
        Object.prototype.hasOwnProperty.call(inviteWeeklyObj, "systemKey")
        ? inviteWeeklyObj.systemKey
        : undefined,
      weeklyByAthleteRawSystemKeys: rawKeysSk,
      weeklyByAthleteParsedSystemKeys: Object.fromEntries(
        Object.entries(weeklyByAthleteId).map(([id, doc]) => [
          id,
          doc && typeof doc === "object" ? (doc.systemKey ?? null) : null,
        ]),
      ),
      parseWeeklyByAthleteDroppedAnyDocs:
        rawWeeklyBy && typeof rawWeeklyBy === "object"
          ? Object.keys(rawWeeklyBy as object).length !==
            Object.keys(weeklyByAthleteId).length
          : false,
      source: "coachSyncFetchSession_after_parseWeeklyByAthleteIdField",
    });
    console.log("[bjj-weekly-session-get systemKey]", {
      inviteSystemKey: typeof inviteSk === "string" ? inviteSk : null,
      weeklyByAthleteIdSystemKeys: Object.fromEntries(
        Object.entries(weeklyByAthleteId).map(([id, doc]) => [
          id,
          doc && typeof doc === "object" ? (doc.systemKey ?? null) : null,
        ]),
      ),
    });
    logHydrationPipelineWatchAthletes({
      stage: "1_network_response_receipt",
      sourceSubsystem: "coachWeeklySyncApi.coachSyncFetchSession",
      dataOrigin: "remote",
      inviteTokenHint: linkToken,
      presentAthleteIds: athleteIdSetFromSynced(athletes),
      namesById: namesByIdFromSyncedAthletes(athletes),
      allAthleteIdsInStage: athletes.map((a) => a.id),
      stageMeta: {
        athleteCount: athletes.length,
        weeklyByAthleteKeyCount: Object.keys(weeklyByAthleteId).length,
        httpStatus: res.status,
      },
    });
    for (const a of athletes) {
      logAthleteLineageTrace({
        operation: "hydrate",
        source: "weekly_sync",
        athleteName: a.name,
        sharedAthleteId: a.id,
        token: linkToken.trim().toLowerCase(),
        route: "coachSyncFetchSession",
        extra: {
          createdAt: a.createdAt,
          weeklyKeyPresent: Object.prototype.hasOwnProperty.call(weeklyByAthleteId, a.id),
        },
      });
    }
  }
  return {
    ...(typeof p.schemaVersion === "number" ? { schemaVersion: p.schemaVersion } : {}),
    coach: p.coach as CoachWeeklySyncSessionResponse["coach"],
    weekly: (p.weekly ?? null) as CoachWeeklySyncSessionResponse["weekly"],
    weeklyByAthleteId,
    athletes,
    competitions,
    competitionAggregateByAthleteId,
    competitionTopologyByAthleteId,
    trainingProofByAthleteId,
  };
}

export async function coachSyncPutTrainingProof(
  linkToken: string,
  parentWriterSecret: string,
  body: CoachWeeklySyncPutTrainingProofBody,
  apiBaseUrlOverride?: string | null,
): Promise<void> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const path = `/v1/sessions/${enc}/training-proof`;
  const url = joinUrl(base, path);
  const res = await fetch(url, {
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
    console.log("[TRAINING_PROOF_TRACE] put_http_failed", {
      operation: "PUT",
      url,
      path,
      apiBaseUrl: base,
      httpStatus: res.status,
      error: msg,
      sharedAthleteId: body.sharedAthleteId,
      linkTokenTail: linkToken.length > 8 ? linkToken.slice(-8) : linkToken,
    });
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
  console.log("[TRAINING_PROOF_TRACE] put_http_ok", {
    operation: "PUT",
    url,
    httpStatus: res.status,
    sharedAthleteId: body.sharedAthleteId,
    linkTokenTail: linkToken.length > 8 ? linkToken.slice(-8) : linkToken,
  });
}

export async function coachSyncPutCompetitionAggregate(
  linkToken: string,
  parentWriterSecret: string,
  body: CoachWeeklySyncPutCompetitionAggregateBody,
  apiBaseUrlOverride?: string | null,
): Promise<void> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const path = `/v1/sessions/${enc}/competition-aggregate`;
  const url = joinUrl(base, path);
  const res = await fetch(url, {
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
    console.log("[COMP_AGG_TRACE] put_http_failed", {
      operation: "PUT",
      url,
      path,
      apiBaseUrl: base,
      httpStatus: res.status,
      error: msg,
      sharedAthleteId: body.sharedAthleteId,
      linkTokenTail: linkToken.length > 8 ? linkToken.slice(-8) : linkToken,
    });
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
  console.log("[COMP_AGG_TRACE] put_http_ok", {
    operation: "PUT",
    url,
    httpStatus: res.status,
    sharedAthleteId: body.sharedAthleteId,
    linkTokenTail: linkToken.length > 8 ? linkToken.slice(-8) : linkToken,
  });
}

export async function coachSyncPutCompetitionTopology(
  linkToken: string,
  parentWriterSecret: string,
  body: CoachWeeklySyncPutCompetitionTopologyBody,
  apiBaseUrlOverride?: string | null,
): Promise<void> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const path = `/v1/sessions/${enc}/competition-topology`;
  const url = joinUrl(base, path);
  const res = await fetch(url, {
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
    console.log("[COMP_TOPOLOGY_TRACE] put_http_failed", {
      operation: "PUT",
      url,
      path,
      apiBaseUrl: base,
      httpStatus: res.status,
      error: msg,
      sharedAthleteId: body.sharedAthleteId,
      linkTokenTail: linkToken.length > 8 ? linkToken.slice(-8) : linkToken,
    });
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
  console.log("[COMP_TOPOLOGY_TRACE] put_http_ok", {
    operation: "PUT",
    url,
    httpStatus: res.status,
    sharedAthleteId: body.sharedAthleteId,
    linkTokenTail: linkToken.length > 8 ? linkToken.slice(-8) : linkToken,
  });
}

export async function coachSyncRedeemParentWriter(
  linkToken: string,
  apiBaseUrlOverride?: string | null,
): Promise<CoachWeeklySyncRedeemParentWriterResponse> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const url = joinUrl(base, `/v1/sessions/${enc}/parent-redeem`);
  const method = "POST";
  const body = "{}";
  console.log("[API CALL]", {
    url,
    method,
    body,
  });
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body,
    });
  } catch (err) {
    console.error("[API FETCH FAILED]", err);
    throw err;
  }
  console.log("[API RESPONSE STATUS]", res.status);
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

export type CoachSyncBindOrCreateSessionAthleteInput = {
  linkToken: string;
  parentWriterSecret: string;
  athleteName: string;
  apiBaseUrlOverride?: string | null;
  sessionAthletes: readonly SyncedSharedAthlete[];
  parentAthletes: readonly ParentAthlete[];
  kidsById: KidsById;
  inviteTokenNorm: string;
  flowSource: CanonicalBindFlowSource;
  linkedKidId?: string | null;
  parentAthleteId?: string | null;
};

export type CoachSyncBindOrCreateSessionAthleteResult = CoachWeeklySyncCreateAthleteResponse & {
  bindDecision: CanonicalBindDecision;
};

/**
 * Bind-first session athlete attach (Build 33.3). Resolves local canonical lineage before POST;
 * passes `bindSharedAthleteId` when re-attaching an existing `shared_ath_*` to the invite roster.
 */
export async function coachSyncBindOrCreateSessionAthlete(
  input: CoachSyncBindOrCreateSessionAthleteInput,
): Promise<CoachSyncBindOrCreateSessionAthleteResult> {
  const athleteName = input.athleteName.trim();
  const inviteToken = input.inviteTokenNorm.trim() || input.linkToken.trim().toLowerCase();
  const resolution = resolveCanonicalBindBeforeSessionAthletePost({
    athleteName,
    inviteTokenNorm: inviteToken,
    sessionAthletes: input.sessionAthletes,
    parentAthletes: input.parentAthletes,
    kidsById: input.kidsById,
    flowSource: input.flowSource,
    linkedKidId: input.linkedKidId,
    parentAthleteId: input.parentAthleteId,
  });

  if (__DEV__ && resolution.softNameDuplicateSharedIds.length > 0) {
    logIdentityMintTrace("duplicate_risk", {
      sourceFlow: input.flowSource,
      callerFunction: "coachSyncBindOrCreateSessionAthlete",
      athleteName,
      existingSharedId: resolution.softNameDuplicateSharedIds.join(","),
      newlyMintedSharedId: resolution.canonicalSharedAthleteId,
      inviteToken,
      extra: {
        reason: "soft_name_duplicate_warning",
        bindSource: resolution.bindSource,
        decision: resolution.decision,
        nameOnly: !resolution.canonicalSharedAthleteId,
      },
    });
  }

  if (resolution.decision === "bind_existing_session" && resolution.sessionAthlete) {
    const athlete = resolution.sessionAthlete;
    logIdentityMintTrace("bind_existing", {
      sourceFlow: input.flowSource,
      callerFunction: "coachSyncBindOrCreateSessionAthlete",
      athleteName,
      existingSharedId: athlete.id,
      newlyMintedSharedId: null,
      inviteToken,
      linkedKidId: input.linkedKidId ?? null,
      localAthleteId: input.parentAthleteId ?? null,
      idKind: "shared_ath",
      extra: {
        bindSource: resolution.bindSource,
        skippedPost: true,
      },
    });
    logAthleteLineageTrace({
      operation: "attach",
      source: "weekly_sync",
      athleteName: athlete.name,
      sharedAthleteId: athlete.id,
      token: inviteToken,
      route: "coachSyncBindOrCreateSessionAthlete",
      extra: { bindDecision: resolution.decision, bindSource: resolution.bindSource },
    });
    return { athlete, bindDecision: resolution.decision };
  }

  const postBody: CoachWeeklySyncCreateAthleteBody = { name: athleteName };
  if (
    resolution.decision === "bind_existing_canonical" &&
    resolution.canonicalSharedAthleteId
  ) {
    postBody.bindSharedAthleteId = resolution.canonicalSharedAthleteId;
  }

  if (
    __DEV__ &&
    resolution.canonicalSharedAthleteId &&
    !postBody.bindSharedAthleteId &&
    resolution.decision !== "mint_new"
  ) {
    logIdentityMintTrace("duplicate_risk_blocked", {
      sourceFlow: input.flowSource,
      callerFunction: "coachSyncBindOrCreateSessionAthlete",
      athleteName,
      existingSharedId: resolution.canonicalSharedAthleteId,
      newlyMintedSharedId: null,
      inviteToken,
      extra: { bindSource: resolution.bindSource, reason: "canonical_without_bind_post_body" },
    });
    throw new IdentityDuplicateRiskBlockedError(
      "This athlete already has coach history on this phone. Linking was blocked to avoid creating a duplicate identity. (DEV)",
      {
        canonicalSharedAthleteId: resolution.canonicalSharedAthleteId,
        flowSource: input.flowSource,
      },
    );
  }

  const priorSessionAthleteIds = input.sessionAthletes
    .map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
    .filter(Boolean);

  const created = await coachSyncCreateSessionAthlete(
    input.linkToken,
    input.parentWriterSecret,
    postBody,
    input.apiBaseUrlOverride,
    priorSessionAthleteIds,
    {
      expectedCanonicalSharedAthleteId: resolution.canonicalSharedAthleteId,
      bindSource: resolution.bindSource,
      flowSource: input.flowSource,
      bindDecision: resolution.decision,
    },
  );

  const returnedId = created.athlete.id.trim();
  if (
    resolution.canonicalSharedAthleteId &&
    returnedId !== resolution.canonicalSharedAthleteId
  ) {
    if (__DEV__) {
      logIdentityMintTrace("duplicate_risk_blocked", {
        sourceFlow: input.flowSource,
        callerFunction: "coachSyncBindOrCreateSessionAthlete",
        athleteName,
        existingSharedId: resolution.canonicalSharedAthleteId,
        newlyMintedSharedId: returnedId,
        inviteToken,
        extra: {
          bindSource: resolution.bindSource,
          reason: "server_returned_different_shared_ath",
        },
      });
      throw new IdentityDuplicateRiskBlockedError(
        "Coach session returned a new athlete id instead of reusing your existing lineage. (DEV)",
        {
          canonicalSharedAthleteId: resolution.canonicalSharedAthleteId,
          flowSource: input.flowSource,
        },
      );
    }
    logIdentityMintTrace("duplicate_risk", {
      sourceFlow: input.flowSource,
      callerFunction: "coachSyncBindOrCreateSessionAthlete",
      athleteName,
      existingSharedId: resolution.canonicalSharedAthleteId,
      newlyMintedSharedId: returnedId,
      inviteToken,
      extra: { bindSource: resolution.bindSource, reason: "server_returned_different_shared_ath" },
    });
  }

  if (resolution.decision === "bind_existing_canonical" || returnedId === resolution.canonicalSharedAthleteId) {
    logIdentityMintTrace("bind_existing", {
      sourceFlow: input.flowSource,
      callerFunction: "coachSyncBindOrCreateSessionAthlete",
      athleteName,
      existingSharedId: resolution.canonicalSharedAthleteId ?? returnedId,
      newlyMintedSharedId: null,
      inviteToken,
      linkedKidId: input.linkedKidId ?? null,
      localAthleteId: input.parentAthleteId ?? null,
      idKind: "shared_ath",
      extra: { bindSource: resolution.bindSource, bindSharedAthleteId: postBody.bindSharedAthleteId ?? null },
    });
  }

  return { ...created, bindDecision: resolution.decision };
}

type CoachSyncCreateSessionAthleteTrace = {
  expectedCanonicalSharedAthleteId?: string | null;
  bindSource?: string | null;
  flowSource?: CanonicalBindFlowSource;
  bindDecision?: CanonicalBindDecision;
};

export async function coachSyncCreateSessionAthlete(
  linkToken: string,
  parentWriterSecret: string,
  body: CoachWeeklySyncCreateAthleteBody,
  apiBaseUrlOverride?: string | null,
  /** When set, client can prove POST /athletes reused an existing roster id (containment QA). */
  priorSessionAthleteIds?: readonly string[],
  trace?: CoachSyncCreateSessionAthleteTrace,
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
  const created = payload as CoachWeeklySyncCreateAthleteResponse;
  const returnedId = created.athlete.id.trim();
  const priorIds = priorSessionAthleteIds?.map((id) => id.trim()).filter(Boolean);
  const expectedCanonical = (trace?.expectedCanonicalSharedAthleteId ?? "").trim();
  const boundCanonical =
    Boolean(expectedCanonical) && returnedId === expectedCanonical;
  const reused =
    boundCanonical ||
    Boolean(body.bindSharedAthleteId?.trim() && returnedId === body.bindSharedAthleteId.trim()) ||
    (priorIds != null && priorIds.length > 0 && priorIds.includes(returnedId));
  const normalizedName = created.athlete.name.trim().toLowerCase();
  const mintedNew =
    !reused && !body.bindSharedAthleteId?.trim() && trace?.bindDecision === "mint_new";
  if (__DEV__) {
    console.log("[ATHLETE DEDUPE]", {
      operation: "post_athletes_client",
      athleteName: created.athlete.name,
      normalizedName,
      sharedAthleteId: returnedId,
      existingSharedAthleteId: reused ? returnedId : expectedCanonical || null,
      reused,
      preventedDuplicate: reused,
      newIdMinted: !reused,
      priorRosterKnown: priorIds != null,
      bindSharedAthleteId: body.bindSharedAthleteId?.trim() || null,
      bindSource: trace?.bindSource ?? null,
      bindDecision: trace?.bindDecision ?? null,
      token: linkToken.trim().toLowerCase(),
    });
    logIdentityMintTrace(reused ? "bind_existing" : "mint", {
      sourceFlow: trace?.flowSource ?? "parent_post_session_athletes",
      callerFunction: "coachSyncCreateSessionAthlete",
      athleteName: created.athlete.name,
      existingSharedId: reused
        ? expectedCanonical || returnedId
        : expectedCanonical || (priorIds?.[0] ?? null),
      newlyMintedSharedId: reused ? null : returnedId,
      inviteToken: linkToken.trim().toLowerCase(),
      idKind: "shared_ath",
      extra: {
        reused,
        priorRosterKnown: priorIds != null,
        normalizedName,
        bindSharedAthleteId: body.bindSharedAthleteId?.trim() || null,
        bindSource: trace?.bindSource ?? null,
        bindDecision: trace?.bindDecision ?? null,
        mintedNew,
      },
    });
    if (
      expectedCanonical &&
      returnedId !== expectedCanonical &&
      body.bindSharedAthleteId?.trim()
    ) {
      logIdentityMintTrace("duplicate_risk", {
        sourceFlow: trace?.flowSource ?? "parent_post_session_athletes",
        callerFunction: "coachSyncCreateSessionAthlete",
        athleteName: created.athlete.name,
        existingSharedId: expectedCanonical,
        newlyMintedSharedId: returnedId,
        inviteToken: linkToken.trim().toLowerCase(),
        extra: { reason: "bind_post_returned_unexpected_id", bindSource: trace?.bindSource },
      });
    }
    if (!reused && priorIds != null && priorIds.length > 0 && !expectedCanonical) {
      logIdentityMintTrace("duplicate_risk", {
        sourceFlow: trace?.flowSource ?? "parent_post_session_athletes",
        callerFunction: "coachSyncCreateSessionAthlete",
        athleteName: created.athlete.name,
        existingSharedId: priorIds.join(","),
        newlyMintedSharedId: returnedId,
        inviteToken: linkToken.trim().toLowerCase(),
        extra: { reason: "new_id_despite_prior_roster_snapshot", priorCount: priorIds.length },
      });
    }
  }
  logAthleteLineageTrace({
    operation: reused ? "attach" : "create",
    source: "weekly_sync",
    athleteName: created.athlete.name,
    sharedAthleteId: returnedId,
    token: linkToken.trim().toLowerCase(),
    route: "coachSyncCreateSessionAthlete",
    extra: {
      createdAt: created.athlete.createdAt,
      reused,
      preventedDuplicate: reused,
      bindSharedAthleteId: body.bindSharedAthleteId?.trim() || null,
      bindSource: trace?.bindSource ?? null,
    },
  });
  return created;
}

export async function coachSyncDeleteSessionAthlete(
  linkToken: string,
  athleteId: string,
  parentWriterSecret: string,
  apiBaseUrlOverride?: string | null,
): Promise<void> {
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const athleteEnc = encodeURIComponent(athleteId);
  const res = await fetch(joinUrl(base, `/v1/sessions/${enc}/athletes/${athleteEnc}`), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${parentWriterSecret}`,
    },
  });
  const payload = await parseJsonOrText(res);
  if (res.status === 404) {
    return;
  }
  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new CoachWeeklySyncApiError(msg, res.status);
  }
}

export async function coachSyncPublishWeekly(
  linkToken: string,
  writerSecret: string,
  body: CoachWeeklySyncWeeklyPutBody,
  apiBaseUrlOverride?: string | null,
): Promise<void> {
  const tokenTail = linkToken.trim().slice(-6);
  const sharedAthleteId =
    typeof body.sharedAthleteId === "string" ? body.sharedAthleteId.trim() || null : null;
  console.log("[PUBLISH \u2192 API CALL]", {
    tokenTail,
    sharedAthleteId,
  });
  let res: Response;
  try {
    const base = resolveBase(apiBaseUrlOverride);
    const enc = encodeURIComponent(linkToken);
    const url = joinUrl(base, `/v1/sessions/${enc}/weekly`);
    console.log("[API CALL]", {
      url,
      method: "PUT",
      body,
    });
    const wireJson = JSON.stringify(body);
    res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${writerSecret}`,
      },
      body: wireJson,
    });
    if (__DEV__) {
      const coachBody = "weekStartYMD" in body ? body : null;
      console.log("[SYSTEMKEY TRACE CLIENT]", {
        traceStage: "2_publish_request_body_wire_JSON",
        headline:
          coachBody && typeof coachBody.headline === "string"
            ? coachBody.headline.slice(0, 120)
            : null,
        systemKey: coachBody?.systemKey ?? null,
        athleteId: body.sharedAthleteId?.trim() || null,
        weekStartYMD: coachBody?.weekStartYMD ?? null,
        keyExistsOnObject: coachBody
          ? Object.prototype.hasOwnProperty.call(coachBody, "systemKey")
          : false,
        wireJsonIncludesSystemKeyKey: wireJson.includes('"systemKey"'),
        keyValidAfterClientNormalize: coachBody
          ? isPublishableSystemKey(coachBody.systemKey)
          : null,
        clientPublishNormalizerRemovedKey: null,
        workerParserRemoved: null,
        source: "coachSyncPublishWeekly_before_fetch",
        parentFeedbackOverlay: "parentFeedback" in body,
      });
      if (coachBody) {
        console.log("[bjj-weekly-publish-api body systemKey]", {
          systemKey: coachBody.systemKey ?? null,
          hasSystemKeyKey: Object.prototype.hasOwnProperty.call(coachBody, "systemKey"),
          sharedAthleteId: body.sharedAthleteId?.trim() || null,
        });
      }
    }
  } catch (error) {
    console.error("[PUBLISH \u2192 API ERROR]", error);
    throw error;
  }
  console.log("[API RESPONSE STATUS]", res.status);
  console.log("[PUBLISH \u2192 API SUCCESS]", res.status);
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
  const t0 = Date.now();
  const tokenTail = linkToken.trim().length > 8 ? linkToken.trim().slice(-8) : linkToken.trim();
  console.log("[COMP_SYNC_TRACE] coachSyncCreateSessionCompetition", {
    stage: "enter",
    t0,
    tokenTail,
    apiBaseUrlOverride: apiBaseUrlOverride?.trim() || null,
    hasParentWriterSecret: Boolean(parentWriterSecret?.trim()),
    requestBody: body,
  });
  const base = resolveBase(apiBaseUrlOverride);
  const enc = encodeURIComponent(linkToken);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${parentWriterSecret}`,
  };
  const serialized = JSON.stringify(body);
  const url = joinUrl(base, `/v1/sessions/${enc}/competitions`);
  console.log("[COMP_SYNC_TRACE] coachSyncCreateSessionCompetition", {
    stage: "post_request_wire",
    elapsedMs: Date.now() - t0,
    method: "POST",
    path: `/v1/sessions/${enc}/competitions`,
    url,
    serializedRequestBody: serialized,
  });
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: serialized,
    });
  } catch (err) {
    console.log("[COMP_SYNC_TRACE] coachSyncCreateSessionCompetition", {
      stage: "post_fetch_threw_before_response",
      elapsedMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  const payload = await parseJsonOrText(res);
  const competitionNode =
    payload && typeof payload === "object" && "competition" in (payload as object)
      ? (payload as { competition?: unknown }).competition
      : undefined;
  const remoteCompetitionId =
    competitionNode &&
    typeof competitionNode === "object" &&
    competitionNode !== null &&
    typeof (competitionNode as { id?: unknown }).id === "string"
      ? (competitionNode as { id: string }).id
      : null;
  console.log("[COMP_SYNC_TRACE] coachSyncCreateSessionCompetition", {
    stage: "post_response_parsed",
    elapsedMs: Date.now() - t0,
    httpStatus: res.status,
    ok: res.ok,
    responsePayload: payload,
    remoteCompetitionId,
  });
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
    const err = new CoachWeeklySyncApiError(coachSyncFailureMessage(res, payload), res.status);
    console.log("[COMP_SYNC_TRACE] coachSyncCreateSessionCompetition", {
      stage: "post_http_error_rethrow",
      elapsedMs: Date.now() - t0,
      status: err.status,
      message: err.message,
    });
    throw err;
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { competition?: unknown }).competition !== "object"
  ) {
    const err = new CoachWeeklySyncApiError("Unexpected response from sync service.", res.status);
    console.log("[COMP_SYNC_TRACE] coachSyncCreateSessionCompetition", {
      stage: "post_unexpected_shape_rethrow",
      elapsedMs: Date.now() - t0,
      message: err.message,
    });
    throw err;
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
