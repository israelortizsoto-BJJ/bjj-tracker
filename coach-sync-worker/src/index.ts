/**
 * Minimal KV-backed API: one session per invite token; coach writes invite-level and optional per-athlete weekly docs; parent reads and adds athletes.
 *
 * Deploy: set KV id in wrangler.toml, then `npx wrangler deploy` from this folder.
 */

import {
  buildWorkerPersistSnapshot,
  MATMIND_AUDIT_SNAPSHOT_HEADER,
  MATMIND_TRANSITION_HEADER,
  readTransitionIdFromRequest,
  serializeWorkerPersistSnapshot,
  type WorkerPersistLane,
} from "./competitionStateAuditor";
import {
  handleAbortSharedMatchMediaUpload,
  handleCompleteSharedMatchMediaUpload,
  handleCreateSharedMatchMediaUploadIntent,
  handleInspectSharedMatchMediaUpload,
  handleUploadSharedMatchMediaPart,
  type SharedMatchMediaUploadDependencies,
} from "./sharedMatchMediaUpload";
import {
  handlePublishMatchMediaAttachment,
  isPublicationFeatureEnabled,
  type MatchMediaPublicationDependencies,
} from "./matchMediaPublication";
import { createConditionalObjectVerificationRecordStore } from "../../shared-match-media-production-verification/src/index";
import { handleOperatorInspectionHttpRequest } from "./productionVerification/operatorInspection";
import { createR2ConditionalObjectStore } from "./productionVerification/r2ConditionalObjectStore";
import {
  isVerificationFeatureEnabled,
  runProductionVerification,
} from "./productionVerification/runProductionVerification";
import { uploadMultipartPartWithSha256 } from "./uploadMultipartPartWithSha256";

export interface Env {
  SESSIONS: KVNamespace;
  /** Coach commentary audio objects. Metadata (mediaId) syncs via Match Breakdown artifacts. */
  MEDIA: R2Bucket;
  /** Independent server kill switch. Upload Foundation is inert unless exactly "1". */
  SHARED_MATCH_MEDIA_UPLOAD_ENABLED?: string;
  /** Independent server kill switch. Production Verification is inert unless exactly "1". */
  SHARED_MATCH_MEDIA_VERIFICATION_ENABLED?: string;
  /** Server-controlled canary asset id. Empty default bypasses verification. */
  SHARED_MATCH_MEDIA_VERIFICATION_CANARY_ASSET_ID?: string;
  /** Server-controlled canary object version. Empty default bypasses verification. */
  SHARED_MATCH_MEDIA_VERIFICATION_CANARY_OBJECT_VERSION?: string;
  /**
   * Independent server kill switch. Publication is inert unless exactly "1".
   * Upload/Verification enablement must never open this flag.
   */
  SHARED_MATCH_MEDIA_PUBLICATION_ENABLED?: string;
  /**
   * Cloudflare secret binding for read-only operator inspection.
   * Must never be committed or placed in wrangler [vars].
   */
  SHARED_MATCH_MEDIA_VERIFICATION_OPERATOR_SECRET?: string;
}

type WeeklyParentFeedback = {
  viewedAt?: string;
  acknowledgedAt?: string;
};

type WeeklyDoc = {
  weekStartYMD: string;
  headline: string;
  body: string;
  /** Level-1 taxonomy id from coach publish (e.g. `l1.top_passing`). */
  systemKey?: string;
  classLine?: string;
  programLine?: string;
  missionResourceUrl?: string | null;
  missionResourceLabel?: string | null;
  familyResourceUrl?: string | null;
  familyResourceLabel?: string | null;
  familyCoachRecapNote?: string;
  coachOutcome?: CoachOutcome;
  parentFeedback?: WeeklyParentFeedback;
  updatedAt: string;
};

type CoachOutcome = "not_yet" | "close" | "hit";

type SharedAthlete = {
  id: string;
  name: string;
  createdAt: string;
};

type CompetitionResult = "gold" | "silver" | "bronze" | "participated" | "dnf" | "other";
type CompetitionEventStatus = "upcoming" | "completed" | "cancelled" | "unknown";
type CompetitionFormat = "gi" | "nogi" | "both";

type SharedCompetition = {
  id: string;
  sharedAthleteId: string;
  tournamentName: string;
  eventDate: string;
  result?: CompetitionResult;
  eventStatus?: CompetitionEventStatus;
  format?: CompetitionFormat;
  organizationOrPromoter?: string;
  createdAt: string;
  updatedAt: string;
};

type CompetitionAggregateArtifact = {
  sharedAthleteId: string;
  updatedAt: string;
  totalCompetitions: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  submissionRate: number | null;
  fastestSubmissionSeconds: number | null;
  averageMatchSeconds: number | null;
  dominantWinStyle: "submission-heavy" | "points-heavy" | "mixed" | null;
  latestCompetitionName?: string;
  latestCompetitionDate?: string;
};

type CompetitionTopologyFinishType =
  | "submission"
  | "points"
  | "ref_decision"
  | "dq"
  | "injury"
  | "unknown"
  | null;

type CompetitionParentMediaRef = {
  kind: "image" | "video";
  assetId?: string | null;
  uri?: string | null;
};

type CompetitionMatchTopology = {
  matchLineageKey: string;
  ordinal: number;
  result: "win" | "loss" | null;
  finishType: CompetitionTopologyFinishType;
  durationSeconds: number | null;
  submissionType?: string | null;
  pointsFor?: number | null;
  pointsAgainst?: number | null;
  parentMediaRefs?: CompetitionParentMediaRef[];
};

type CompetitionTopology = {
  sharedCompetitionId: string;
  sharedAthleteId: string;
  competitionLineageKey: string;
  updatedAt: string;
  matches: CompetitionMatchTopology[];
};

type CompetitionTopologyArtifact = {
  schemaVersion: 1;
  sharedAthleteId: string;
  updatedAt: string;
  competitions: CompetitionTopology[];
};

function logCoachTopologyMatchTrace(
  stage: string,
  artifact: CompetitionTopologyArtifact,
  extra?: Record<string, unknown>,
) {
  for (const competition of artifact.competitions) {
    console.log("[COACH_TOPOLOGY_MATCH_TRACE]", {
      stage,
      sharedCompetitionId: competition.sharedCompetitionId,
      updatedAt: artifact.updatedAt,
      matchCount: competition.matches.length,
      firstFiveMatchIds: competition.matches
        .slice(0, 5)
        .map((match) => match.matchLineageKey),
      firstFiveMatchResults: competition.matches.slice(0, 5).map((match) => match.result),
      ...extra,
    });
  }
}

type TrainingProofRankedItem = {
  key: string;
  label: string;
  count: number;
};

type TrainingProofArtifact = {
  sharedAthleteId: string;
  updatedAt: string;
  currentWeekSessionCount: number;
  lastTrainingDateYMD: string | null;
  dominantSystemKey: string | null;
  topSystems: TrainingProofRankedItem[];
  topTechniques: TrainingProofRankedItem[];
  weeklyGoalMet: boolean;
};

type CoachMatchBreakdownArtifact = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  coachNote?: string;
  /** Remote companion audio id (R2). Never a URL or localUri. */
  mediaId?: string;
  durationMs?: number;
  mimeType?: string;
  updatedAt: string;
};

type CoachMatchBreakdownArtifactSet = {
  schemaVersion: 1;
  sharedAthleteId: string;
  updatedAt: string;
  artifacts: CoachMatchBreakdownArtifact[];
};

/** Stored shape; legacy rows omit schemaVersion / athletes / parentWriterSecret / weeklyByAthleteId until migrated. */
type SessionRecord = {
  schemaVersion: number;
  writerSecret: string;
  coachId: string;
  coachDisplayName: string;
  academyName?: string;
  /** Invite-level weekly doc (legacy); unchanged when publishing with `sharedAthleteId`. */
  weekly: WeeklyDoc | null;
  /** Per shared-athlete weekly docs; keys must match `athletes[].id`. */
  weeklyByAthleteId: Record<string, WeeklyDoc>;
  /** Per-athlete bounded competition match intelligence; parent writer only. */
  competitionAggregateByAthleteId: Record<string, CompetitionAggregateArtifact>;
  /** Per-athlete canonical competition structural rows; parent writer only. */
  competitionTopologyByAthleteId: Record<string, CompetitionTopologyArtifact>;
  /** Per-athlete bounded training proof; parent writer only. */
  trainingProofByAthleteId: Record<string, TrainingProofArtifact>;
  /** Per-athlete coach-owned match breakdown overlays. Parent consumes read-only. */
  coachMatchBreakdownArtifacts: Record<string, CoachMatchBreakdownArtifactSet>;
  createdAt: string;
  athletes: SharedAthlete[];
  competitions: SharedCompetition[];
  parentWriterSecret?: string;
};

/** TEMP: grep worker tail for this id to confirm deployed bundle matches this file. */
const WORKER_AUDIT_BUILD_ID = "coach-sync-worker:weekly-corruption-trace-2026-05-15";
const COACH_OVERLAY_GET_PAYLOAD_BUILD_ID =
  "coach-sync-worker:coach-overlay-get-payload-repair-2026-06-03";
const WORKER_RUNTIME_VERSION = "coach-overlay-get-runtime-2026-06-03-v2";

console.log("[WORKER_RUNTIME_VERSION]", WORKER_RUNTIME_VERSION);

const WEEKLY_CORRUPTION_TRACE = "[WEEKLY CORRUPTION TRACE]";

function roughByteSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function rosterArtifactCountsByAthlete(rec: SessionRecord) {
  return Object.fromEntries(
    rec.athletes.map((athlete) => {
      const id = athlete.id;
      return [
        id,
        {
          topology: rec.competitionTopologyByAthleteId[id] ? 1 : 0,
          proof: rec.trainingProofByAthleteId[id] ? 1 : 0,
          aggregate: rec.competitionAggregateByAthleteId[id] ? 1 : 0,
          weekly: rec.weeklyByAthleteId[id] ? 1 : 0,
          competitions: rec.competitions.filter((competition) => competition.sharedAthleteId === id).length,
          coachMatchBreakdownArtifacts:
            rec.coachMatchBreakdownArtifacts[id]?.artifacts.length ?? 0,
        },
      ];
    }),
  );
}

/** Field-level probe for before/after diffs across KV → parse → GET assembly. */
type WeeklyFieldProbe = {
  weekStartYMD: string | null;
  headline: string | null;
  headlineLen: number;
  bodyLen: number;
  bodyPreview: string | null;
  systemKey: string | null;
  missionResourceUrl: string | null;
  familyResourceUrl: string | null;
  updatedAt: string | null;
  hasMissionResourceUrlKey: boolean;
  hasMissionAliasKey: boolean;
  hasFamilyResourceUrlKey: boolean;
  hasStudyAliasKey: boolean;
  hasSystemKeyKey: boolean;
  rawType: string;
};

function probeWeeklyRaw(raw: unknown): WeeklyFieldProbe {
  if (raw === null) {
    return {
      weekStartYMD: null,
      headline: null,
      headlineLen: 0,
      bodyLen: 0,
      bodyPreview: null,
      systemKey: null,
      missionResourceUrl: null,
      familyResourceUrl: null,
      updatedAt: null,
      hasMissionResourceUrlKey: false,
      hasMissionAliasKey: false,
      hasFamilyResourceUrlKey: false,
      hasStudyAliasKey: false,
      hasSystemKeyKey: false,
      rawType: "null",
    };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      weekStartYMD: null,
      headline: null,
      headlineLen: 0,
      bodyLen: 0,
      bodyPreview: null,
      systemKey: null,
      missionResourceUrl: null,
      familyResourceUrl: null,
      updatedAt: null,
      hasMissionResourceUrlKey: false,
      hasMissionAliasKey: false,
      hasFamilyResourceUrlKey: false,
      hasStudyAliasKey: false,
      hasSystemKeyKey: false,
      rawType: raw == null ? "nullish" : Array.isArray(raw) ? "array" : typeof raw,
    };
  }
  const o = raw as Record<string, unknown>;
  const headline = typeof o.headline === "string" ? o.headline : null;
  const body = typeof o.body === "string" ? o.body : null;
  const missionVal = o.missionResourceUrl ?? o.mission;
  const familyVal = o.familyResourceUrl ?? o.study;
  return {
    weekStartYMD: typeof o.weekStartYMD === "string" ? o.weekStartYMD : null,
    headline,
    headlineLen: headline?.length ?? 0,
    bodyLen: body?.length ?? 0,
    bodyPreview: body ? body.slice(0, 80) : null,
    systemKey: typeof o.systemKey === "string" ? o.systemKey : null,
    missionResourceUrl: typeof missionVal === "string" ? missionVal : missionVal === null ? null : null,
    familyResourceUrl: typeof familyVal === "string" ? familyVal : familyVal === null ? null : null,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
    hasMissionResourceUrlKey: Object.prototype.hasOwnProperty.call(o, "missionResourceUrl"),
    hasMissionAliasKey: Object.prototype.hasOwnProperty.call(o, "mission"),
    hasFamilyResourceUrlKey: Object.prototype.hasOwnProperty.call(o, "familyResourceUrl"),
    hasStudyAliasKey: Object.prototype.hasOwnProperty.call(o, "study"),
    hasSystemKeyKey: Object.prototype.hasOwnProperty.call(o, "systemKey"),
    rawType: "object",
  };
}

function probeWeeklyDoc(doc: WeeklyDoc | null | undefined): WeeklyFieldProbe {
  if (!doc) return probeWeeklyRaw(null);
  return probeWeeklyRaw(doc);
}

function probeWeeklyByMap(raw: unknown): Record<string, WeeklyFieldProbe> {
  const out: Record<string, WeeklyFieldProbe> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = probeWeeklyRaw(v);
  }
  return out;
}

/** Returns field names where a non-empty before value became empty/null after. */
function diffWeeklyFieldLoss(
  before: WeeklyFieldProbe | null | undefined,
  after: WeeklyFieldProbe | null | undefined,
): string[] {
  if (!before) return [];
  const afterProbe = after ?? probeWeeklyRaw(null);
  const lost: string[] = [];
  const checks: Array<{ field: string; beforeVal: string | null; afterVal: string | null }> = [
    { field: "headline", beforeVal: before.headline, afterVal: afterProbe.headline },
    { field: "weekStartYMD", beforeVal: before.weekStartYMD, afterVal: afterProbe.weekStartYMD },
    { field: "updatedAt", beforeVal: before.updatedAt, afterVal: afterProbe.updatedAt },
    { field: "systemKey", beforeVal: before.systemKey, afterVal: afterProbe.systemKey },
    { field: "missionResourceUrl", beforeVal: before.missionResourceUrl, afterVal: afterProbe.missionResourceUrl },
    { field: "familyResourceUrl", beforeVal: before.familyResourceUrl, afterVal: afterProbe.familyResourceUrl },
  ];
  for (const { field, beforeVal, afterVal } of checks) {
    const had = beforeVal != null && beforeVal !== "";
    const nowGone = afterVal == null || afterVal === "";
    if (had && nowGone) lost.push(field);
  }
  if (before.bodyLen > 0 && afterProbe.bodyLen === 0) lost.push("body");
  return lost;
}

function logWeeklyCorruptionTrace(
  traceStage: string,
  extra: Record<string, unknown> = {},
): void {
  console.log(WEEKLY_CORRUPTION_TRACE, { traceStage, mark: WORKER_AUDIT_BUILD_ID, ...extra });
}

/** Mirrors parseWeeklyDoc guards; null means the doc would be accepted. */
function explainWeeklyDocParseRejection(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return "not_object";
  const o = raw as Record<string, unknown>;
  const weekStartYMD = typeof o.weekStartYMD === "string" ? o.weekStartYMD.trim() : "";
  const headline = typeof o.headline === "string" ? o.headline.trim() : "";
  const bodyText = typeof o.body === "string" ? o.body.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartYMD)) return "invalid_weekStartYMD";
  if (!headline) return "empty_headline";
  if (headline.length > 200) return "headline_too_long";
  if (!updatedAt) return "missing_updatedAt";
  if (bodyText.length > 8000) return "body_too_long";
  return null;
}

const TOKEN_RE = /^[a-f0-9]{48,128}$/i;
const SESSION_SCHEMA_VERSION = 5 as const;
const MAX_ATHLETES_PER_SESSION = 24;
const MAX_COMPETITIONS_PER_SESSION = 400;
const MAX_TOPOLOGY_COMPETITIONS_PER_ARTIFACT = 400;
const MAX_TOPOLOGY_MATCHES_PER_COMPETITION = 64;
const MAX_TOPOLOGY_MATCHES_PER_ARTIFACT = 2048;
const MAX_TOPOLOGY_MEDIA_REFS_PER_MATCH = 2;
const MAX_TOPOLOGY_PAYLOAD_CHARS = 256_000;
const MAX_TOPOLOGY_ID_CHARS = 200;
const MAX_TOPOLOGY_URI_CHARS = 2_000;
const MAX_COACH_BREAKDOWN_ARTIFACTS_PER_ATHLETE = 2048;
const MAX_COACH_MEDIA_BYTES = 15 * 1024 * 1024;
const MEDIA_ID_RE = /^[a-f0-9]{32}$/i;
const MEDIA_CONTENT_TTL_SECONDS = 15 * 60;
const MEDIA_DURATION_HEADER = "X-MatMind-Duration-Ms";
const ALLOWED_COACH_MEDIA_MIME = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "application/octet-stream",
]);
const OVERLAY_FORENSIC_TRACE_HEADER = "X-Overlay-Forensic-Trace-Id";
const MATCH_BREAKDOWN_AUTHORITY_TRACE_PREFIX =
  "[MATCH_BREAKDOWN_AUTHORITY_TRACE]";

function inviteTokenSuffixForAuthorityTrace(token: string): string | null {
  const normalized = token.trim();
  if (!normalized) return null;
  return normalized.slice(-6);
}

function logMatchBreakdownAuthorityTrace(
  stage: string,
  fields: Record<string, unknown>,
): void {
  console.log(
    MATCH_BREAKDOWN_AUTHORITY_TRACE_PREFIX,
    JSON.stringify({
      stage,
      timestamp: new Date().toISOString(),
      traceId: fields.traceId ?? null,
      sharedAthleteId: fields.sharedAthleteId ?? null,
      sharedCompetitionId: fields.sharedCompetitionId ?? null,
      matchLineageKey: fields.matchLineageKey ?? null,
      generation: fields.generation ?? null,
      inviteTokenSuffix: fields.inviteTokenSuffix ?? null,
      ...fields,
    }),
  );
}

function coachMatchBreakdownArtifactCountForAthlete(
  artifactsByAthleteId: Record<string, CoachMatchBreakdownArtifactSet>,
  sharedAthleteId: string,
): number {
  return artifactsByAthleteId[sharedAthleteId]?.artifacts.length ?? 0;
}
const MAX_COACH_BREAKDOWN_TEXT_CHARS = 8_000;
const MAX_COACH_BREAKDOWN_PAYLOAD_CHARS = 256_000;
const RESULT_SET = new Set<CompetitionResult>(["gold", "silver", "bronze", "participated", "dnf", "other"]);
const EVENT_STATUS_SET = new Set<CompetitionEventStatus>(["upcoming", "completed", "cancelled", "unknown"]);
const FORMAT_SET = new Set<CompetitionFormat>(["gi", "nogi", "both"]);
const COACH_OUTCOME_SET = new Set<CoachOutcome>(["not_yet", "close", "hit"]);
const MAX_SYSTEM_KEY_LEN = 160;

/** Accepts taxonomy ids like `l1.top_passing` / `l1.guard_bottom.l2.closed_guard`. */
function parseOptionalSystemKey(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t || t.length > MAX_SYSTEM_KEY_LEN) return undefined;
  if (!/^[a-z0-9_.]+$/.test(t)) return undefined;
  return t;
}

/** TEMP audit: raw KV JSON node for weeklyByAthleteId before parseWeeklyDoc. */
function summarizeRawWeeklyByAthleteSystemKey(rawWeeklyBy: unknown): Record<
  string,
  { hasSystemKeyProp: boolean; raw: unknown; typeofRaw: string }
> {
  const out: Record<string, { hasSystemKeyProp: boolean; raw: unknown; typeofRaw: string }> = {};
  if (!rawWeeklyBy || typeof rawWeeklyBy !== "object" || Array.isArray(rawWeeklyBy)) return out;
  for (const [athleteId, v] of Object.entries(rawWeeklyBy as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const hasSystemKeyProp = Object.prototype.hasOwnProperty.call(o, "systemKey");
    const raw = hasSystemKeyProp ? o.systemKey : undefined;
    out[athleteId] = { hasSystemKeyProp, raw: raw ?? null, typeofRaw: typeof raw };
  }
  return out;
}

function json(data: unknown, status = 200, cors = true, auditSnapshot?: string): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
  if (auditSnapshot) {
    headers[MATMIND_AUDIT_SNAPSHOT_HEADER] = auditSnapshot;
  }
  if (cors) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] =
      `Content-Type, Authorization, ${MATMIND_TRANSITION_HEADER}, ${MEDIA_DURATION_HEADER}`;
    headers["Access-Control-Expose-Headers"] = MATMIND_AUDIT_SNAPSHOT_HEADER;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function competitionPersistResponse(
  payload: unknown,
  status: number,
  input: {
    before: SessionRecord;
    after: SessionRecord;
    sharedAthleteId: string;
    persistLane: WorkerPersistLane;
    request: Request;
    linkTokenTail: string;
  },
): Response {
  const transitionId = readTransitionIdFromRequest(input.request) ?? `worker-${randomHex(8)}`;
  const auditSnapshot = serializeWorkerPersistSnapshot(
    buildWorkerPersistSnapshot({
      before: input.before,
      after: input.after,
      sharedAthleteId: input.sharedAthleteId,
      persistLane: input.persistLane,
      transitionId,
      linkTokenTail: input.linkTokenTail,
    }),
  );
  return json(payload, status, true, auditSnapshot);
}

function error(message: string, status: number, cors = true): Response {
  return json({ error: message }, status, cors);
}

type WeeklyMaterialSnapshot = {
  headline: string;
  body: string;
  weekStartYMD: string;
  systemKey?: string;
};

function trimWeeklyMaterialField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Returns material field names that differ between stored weekly and coach PUT snapshot. */
function weeklyMaterialFieldsChanged(
  existing: Partial<WeeklyDoc> | WeeklyDoc | null | undefined,
  incoming: WeeklyMaterialSnapshot,
  opts?: { systemKeyInPut?: boolean },
): string[] {
  if (!existing) return [];
  const changed: string[] = [];
  if (trimWeeklyMaterialField(existing.headline) !== trimWeeklyMaterialField(incoming.headline)) {
    changed.push("headline");
  }
  if (trimWeeklyMaterialField(existing.body) !== trimWeeklyMaterialField(incoming.body)) {
    changed.push("body");
  }
  if (
    trimWeeklyMaterialField(existing.weekStartYMD) !== trimWeeklyMaterialField(incoming.weekStartYMD)
  ) {
    changed.push("weekStartYMD");
  }
  if (opts?.systemKeyInPut) {
    const existingSk = trimWeeklyMaterialField(existing.systemKey);
    const incomingSk = trimWeeklyMaterialField(incoming.systemKey);
    if (existingSk !== incomingSk) changed.push("systemKey");
  }
  return changed;
}

/** Prevents `{ ...existing, ...next }` from overwriting with `undefined` (which would drop stored link fields on merge). */
function omitUndefinedShallow<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/** Coach weekly PUT must not inherit parent overlay from shallow `{ ...existing, ...incoming }` merge. */
function existingWeeklySansParentFeedback(
  existing: Partial<WeeklyDoc> | WeeklyDoc | null | undefined,
): Partial<WeeklyDoc> {
  if (!existing || typeof existing !== "object") return {};
  const { parentFeedback: _drop, ...rest } = existing;
  return rest;
}

function normalizeAthleteNameForDedupe(name: string): string {
  return name.trim().toLowerCase();
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function parseSharedAthletes(raw: unknown): SharedAthlete[] {
  if (!Array.isArray(raw)) return [];
  const out: SharedAthlete[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
    const createdAt = typeof o.createdAt === "string" ? o.createdAt.trim() : "";
    if (!id || id.length > 64 || !name || !createdAt) continue;
    out.push({ id, name, createdAt });
  }
  return out;
}

function parseSharedCompetitions(raw: unknown): SharedCompetition[] {
  if (!Array.isArray(raw)) return [];
  const out: SharedCompetition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const sharedAthleteId = typeof o.sharedAthleteId === "string" ? o.sharedAthleteId.trim() : "";
    const tournamentName = typeof o.tournamentName === "string" ? o.tournamentName.trim().slice(0, 160) : "";
    const eventDate = typeof o.eventDate === "string" ? o.eventDate.trim() : "";
    const createdAt = typeof o.createdAt === "string" ? o.createdAt.trim() : "";
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
    if (!id || !sharedAthleteId || !tournamentName || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !createdAt || !updatedAt) {
      continue;
    }
    const resultRaw = typeof o.result === "string" ? o.result : undefined;
    const eventStatusRaw = typeof o.eventStatus === "string" ? o.eventStatus : undefined;
    const formatRaw = typeof o.format === "string" ? o.format : undefined;
    const organizationRaw = typeof o.organizationOrPromoter === "string" ? o.organizationOrPromoter.trim().slice(0, 160) : "";
    const result = resultRaw && RESULT_SET.has(resultRaw as CompetitionResult) ? (resultRaw as CompetitionResult) : undefined;
    const eventStatus =
      eventStatusRaw && EVENT_STATUS_SET.has(eventStatusRaw as CompetitionEventStatus)
        ? (eventStatusRaw as CompetitionEventStatus)
        : undefined;
    const format = formatRaw && FORMAT_SET.has(formatRaw as CompetitionFormat) ? (formatRaw as CompetitionFormat) : undefined;
    out.push({
      id,
      sharedAthleteId,
      tournamentName,
      eventDate,
      ...(result ? { result } : {}),
      ...(eventStatus ? { eventStatus } : {}),
      ...(format ? { format } : {}),
      ...(organizationRaw ? { organizationOrPromoter: organizationRaw } : {}),
      createdAt,
      updatedAt,
    });
  }
  return out;
}

/** Trims only; rejects obvious non-URLs. No scheme injection, `URL` parsing, or slicing. */
function parseOptionalPublishedUrl(urlRaw: string): string | undefined {
  const t = urlRaw.trim();
  if (!t) return undefined;
  if (/\s/.test(t)) return undefined;
  if (/^javascript:/i.test(t) || /^data:/i.test(t)) return undefined;
  return t;
}

/** Canonical + alias keys; never cross-map (e.g. study → mission). */
function readMissionUrlFromWeeklyPutBody(
  b: Record<string, unknown>,
): { raw: string; hasInBody: boolean } {
  if ("missionResourceUrl" in b) {
    return {
      raw: typeof b.missionResourceUrl === "string" ? b.missionResourceUrl.trim() : "",
      hasInBody: true,
    };
  }
  if ("mission" in b) {
    return { raw: typeof b.mission === "string" ? b.mission.trim() : "", hasInBody: true };
  }
  return { raw: "", hasInBody: false };
}

function readFamilyUrlFromWeeklyPutBody(
  b: Record<string, unknown>,
): { raw: string; hasInBody: boolean } {
  if ("familyResourceUrl" in b) {
    return {
      raw: typeof b.familyResourceUrl === "string" ? b.familyResourceUrl.trim() : "",
      hasInBody: true,
    };
  }
  if ("study" in b) {
    return { raw: typeof b.study === "string" ? b.study.trim() : "", hasInBody: true };
  }
  return { raw: "", hasInBody: false };
}

/** Same key precedence as PUT (`familyResourceUrl` then `study`). */
function parseWeeklyParentFeedback(raw: unknown): WeeklyParentFeedback | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const viewedAt =
    typeof o.viewedAt === "string" && o.viewedAt.trim() ? o.viewedAt.trim() : undefined;
  const acknowledgedAt =
    typeof o.acknowledgedAt === "string" && o.acknowledgedAt.trim()
      ? o.acknowledgedAt.trim()
      : undefined;
  if (!viewedAt && !acknowledgedAt) return null;
  return {
    ...(viewedAt ? { viewedAt } : {}),
    ...(acknowledgedAt ? { acknowledgedAt } : {}),
  };
}

function readFamilyFromStoredWeeklyDoc(o: Record<string, unknown>): { raw: string; hasKey: boolean } {
  if ("familyResourceUrl" in o) {
    const v = o.familyResourceUrl;
    if (v === null) return { raw: "", hasKey: true };
    return { raw: typeof v === "string" ? v.trim() : "", hasKey: true };
  }
  if ("study" in o) {
    const v = o.study;
    if (v === null) return { raw: "", hasKey: true };
    return { raw: typeof v === "string" ? v.trim() : "", hasKey: true };
  }
  return { raw: "", hasKey: false };
}

function parseWeeklyDoc(raw: unknown, traceContext?: { athleteId?: string; source?: string }): WeeklyDoc | null {
  const inputProbe = probeWeeklyRaw(raw);
  const rejection = explainWeeklyDocParseRejection(raw);
  if (rejection) {
    logWeeklyCorruptionTrace("parseWeeklyDoc_REJECTED", {
      athleteId: traceContext?.athleteId ?? null,
      source: traceContext?.source ?? "parseWeeklyDoc",
      rejection,
      inputProbe,
    });
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const weekStartYMD = typeof o.weekStartYMD === "string" ? o.weekStartYMD.trim() : "";
  const headline = typeof o.headline === "string" ? o.headline.trim() : "";
  const bodyText = typeof o.body === "string" ? o.body.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (bodyText.length > 8000) return null;
  const classLine =
    typeof o.classLine === "string" && o.classLine.trim() ? o.classLine.trim().slice(0, 500) : undefined;
  const programLine =
    typeof o.programLine === "string" && o.programLine.trim()
      ? o.programLine.trim().slice(0, 500)
      : undefined;
  const familyRead = readFamilyFromStoredWeeklyDoc(o);
  const familyResourceUrl = parseOptionalPublishedUrl(familyRead.raw);
  const familyResourceLabel =
    typeof o.familyResourceLabel === "string" && o.familyResourceLabel.trim()
      ? o.familyResourceLabel.trim().slice(0, 120)
      : undefined;
  const familyCoachRecapRaw = typeof o.familyCoachRecapNote === "string" ? o.familyCoachRecapNote.trim() : "";
  const familyCoachRecapNote = familyCoachRecapRaw
    ? familyCoachRecapRaw.slice(0, 2000)
    : undefined;
  const coachOutcome =
    typeof o.coachOutcome === "string" && COACH_OUTCOME_SET.has(o.coachOutcome as CoachOutcome)
      ? (o.coachOutcome as CoachOutcome)
      : undefined;
  const systemKey = parseOptionalSystemKey(o.systemKey);
  if (Object.prototype.hasOwnProperty.call(o, "systemKey") || o.systemKey != null) {
    let dropReason: string | null = null;
    if (!Object.prototype.hasOwnProperty.call(o, "systemKey")) dropReason = "no_prop";
    else if (typeof o.systemKey !== "string") dropReason = `non_string:${typeof o.systemKey}`;
    else {
      const t = (o.systemKey as string).trim();
      if (!t) dropReason = "empty_trim";
      else if (t.length > MAX_SYSTEM_KEY_LEN) dropReason = "too_long";
      else if (!/^[a-z0-9_.]+$/.test(t)) dropReason = "pattern";
    }
    console.log("[SYSTEMKEY TRACE WORKER]", {
      traceStage: "parseWeeklyDoc_pipeline",
      headline: headline.slice(0, 120),
      weekStartYMD,
      rawSystemKey: o.systemKey,
      parsedSystemKey: systemKey ?? null,
      workerParserDroppedKey:
        (Object.prototype.hasOwnProperty.call(o, "systemKey") || o.systemKey != null) &&
        !systemKey,
      dropReason: systemKey ? null : dropReason,
      source: "parseWeeklyDoc",
    });
  }
  const parentFeedback = parseWeeklyParentFeedback(o.parentFeedback);
  const weekly: WeeklyDoc = {
    weekStartYMD,
    headline,
    body: bodyText,
    ...(systemKey ? { systemKey } : {}),
    ...(classLine ? { classLine } : {}),
    ...(programLine ? { programLine } : {}),
    ...(familyCoachRecapNote ? { familyCoachRecapNote } : {}),
    ...(coachOutcome ? { coachOutcome } : {}),
    ...(parentFeedback ? { parentFeedback } : {}),
    updatedAt,
  };
  const missionRaw =
    typeof o.missionResourceUrl === "string"
      ? o.missionResourceUrl
      : typeof o.mission === "string"
        ? o.mission
        : null;

  if ("missionResourceUrl" in o || "mission" in o) {
    const parsed = typeof missionRaw === "string" ? parseOptionalPublishedUrl(missionRaw) : null;

    weekly.missionResourceUrl = parsed ?? null;
    weekly.missionResourceLabel =
      typeof o.missionResourceLabel === "string" ? o.missionResourceLabel : null;
  }
  if (familyRead.hasKey) {
    weekly.familyResourceUrl = familyResourceUrl ?? null;
    weekly.familyResourceLabel =
      familyResourceUrl !== undefined ? (familyResourceLabel ?? null) : null;
  }
  const outputProbe = probeWeeklyDoc(weekly);
  const fieldsLostInParse = diffWeeklyFieldLoss(inputProbe, outputProbe);
  if (fieldsLostInParse.length > 0) {
    logWeeklyCorruptionTrace("parseWeeklyDoc_FIELD_DIFF", {
      athleteId: traceContext?.athleteId ?? null,
      source: traceContext?.source ?? "parseWeeklyDoc",
      fieldsLostInParse,
      inputProbe,
      outputProbe,
    });
  } else {
    logWeeklyCorruptionTrace("parseWeeklyDoc_OK", {
      athleteId: traceContext?.athleteId ?? null,
      source: traceContext?.source ?? "parseWeeklyDoc",
      inputProbe,
      outputProbe,
    });
  }
  return weekly;
}

function parseWeeklyByAthleteId(raw: unknown): Record<string, WeeklyDoc> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const rawProbes = probeWeeklyByMap(raw);
  logWeeklyCorruptionTrace("parseWeeklyByAthleteId_INPUT", {
    athleteIds: Object.keys(rawProbes),
    probes: rawProbes,
    rawJsonSnippet: JSON.stringify(raw).slice(0, 4000),
  });
  const out: Record<string, WeeklyDoc> = {};
  const dropped: Array<{ athleteId: string; rejection: string }> = [];
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = k.trim();
    if (!id || id.length > 64) continue;
    const entry = v as Record<string, unknown>;
    console.log("[PRE PARSE RAW WEEKLY]", {
      athleteId: id,
      hasMissionResourceUrl: typeof entry.missionResourceUrl === "string",
      hasMissionAlias: typeof entry.mission === "string",
      missionResourceUrl: entry.missionResourceUrl ?? null,
      missionAlias: entry.mission ?? null,
      familyResourceUrl: entry.familyResourceUrl ?? null,
      studyAlias: entry.study ?? null,
      hasSystemKeyProp: Object.prototype.hasOwnProperty.call(entry, "systemKey"),
      systemKeyRaw: Object.prototype.hasOwnProperty.call(entry, "systemKey") ? entry.systemKey : undefined,
      systemKeyRawType: Object.prototype.hasOwnProperty.call(entry, "systemKey")
        ? typeof entry.systemKey
        : "absent",
    });
    const rejection = explainWeeklyDocParseRejection(v);
    const doc = parseWeeklyDoc(v, { athleteId: id, source: "parseWeeklyByAthleteId" });
    if (doc) {
      out[id] = doc;
    } else if (rejection) {
      dropped.push({ athleteId: id, rejection });
    }
  }
  const outProbes = Object.fromEntries(Object.entries(out).map(([id, doc]) => [id, probeWeeklyDoc(doc)]));
  const stageDiffs: Record<string, { fieldsLost: string[]; rawKeys: string[] }> = {};
  const rawMap = raw as Record<string, unknown>;
  for (const [id, before] of Object.entries(rawProbes)) {
    const after = outProbes[id];
    const fieldsLost = diffWeeklyFieldLoss(before, after);
    if (fieldsLost.length > 0 || !after) {
      const rawEntry = rawMap[id];
      stageDiffs[id] = {
        fieldsLost: after ? fieldsLost : [...fieldsLost, "__entire_entry_dropped__"],
        rawKeys:
          rawEntry && typeof rawEntry === "object" && !Array.isArray(rawEntry)
            ? Object.keys(rawEntry as Record<string, unknown>)
            : [],
      };
    }
  }
  logWeeklyCorruptionTrace("parseWeeklyByAthleteId_OUTPUT", {
    athleteIds: Object.keys(out),
    dropped,
    outProbes,
    stageDiffs,
  });
  return out;
}

const WIN_STYLE_SET = new Set(["submission-heavy", "points-heavy", "mixed"]);

function parseOptionalPercent(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 0 || n > 100) return null;
  return n;
}

function parseOptionalNonNegativeInt(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 0) return null;
  return n;
}

function parseCompetitionAggregateArtifact(raw: unknown): CompetitionAggregateArtifact | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sharedAthleteId = typeof o.sharedAthleteId === "string" ? o.sharedAthleteId.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!sharedAthleteId || !updatedAt) return null;

  const totalCompetitions =
    typeof o.totalCompetitions === "number" && Number.isFinite(o.totalCompetitions)
      ? Math.max(0, Math.round(o.totalCompetitions))
      : null;
  const totalMatches =
    typeof o.totalMatches === "number" && Number.isFinite(o.totalMatches)
      ? Math.max(0, Math.round(o.totalMatches))
      : null;
  const wins =
    typeof o.wins === "number" && Number.isFinite(o.wins) ? Math.max(0, Math.round(o.wins)) : null;
  const losses =
    typeof o.losses === "number" && Number.isFinite(o.losses)
      ? Math.max(0, Math.round(o.losses))
      : null;
  if (
    totalCompetitions === null ||
    totalMatches === null ||
    wins === null ||
    losses === null
  ) {
    return null;
  }

  const dominantRaw =
    typeof o.dominantWinStyle === "string" ? o.dominantWinStyle.trim() : null;
  const dominantWinStyle =
    dominantRaw && WIN_STYLE_SET.has(dominantRaw)
      ? (dominantRaw as CompetitionAggregateArtifact["dominantWinStyle"])
      : null;

  const latestCompetitionName =
    typeof o.latestCompetitionName === "string" && o.latestCompetitionName.trim()
      ? o.latestCompetitionName.trim().slice(0, 160)
      : undefined;
  const latestCompetitionDate =
    typeof o.latestCompetitionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.latestCompetitionDate.trim())
      ? o.latestCompetitionDate.trim()
      : undefined;

  return {
    sharedAthleteId,
    updatedAt,
    totalCompetitions,
    totalMatches,
    wins,
    losses,
    winRate: parseOptionalPercent(o.winRate),
    submissionRate: parseOptionalPercent(o.submissionRate),
    fastestSubmissionSeconds: parseOptionalNonNegativeInt(o.fastestSubmissionSeconds),
    averageMatchSeconds: parseOptionalNonNegativeInt(o.averageMatchSeconds),
    dominantWinStyle,
    ...(latestCompetitionName ? { latestCompetitionName } : {}),
    ...(latestCompetitionDate ? { latestCompetitionDate } : {}),
  };
}

function parseCompetitionAggregateByAthleteId(
  raw: unknown,
): Record<string, CompetitionAggregateArtifact> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CompetitionAggregateArtifact> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = k.trim();
    if (!id || id.length > 64) continue;
    const artifact = parseCompetitionAggregateArtifact(v);
    if (!artifact || artifact.sharedAthleteId !== id) continue;
    out[id] = artifact;
  }
  return out;
}

const TOPOLOGY_FINISH_TYPES = new Set([
  "submission",
  "points",
  "ref_decision",
  "dq",
  "injury",
  "unknown",
]);

function parseTopologyId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!id || id.length > MAX_TOPOLOGY_ID_CHARS) return null;
  return id;
}

function parseNullableNonNegativeInt(raw: unknown): number | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return undefined;
  return Math.round(raw);
}

function parseTopologyMediaRefs(raw: unknown): CompetitionParentMediaRef[] | undefined | null {
  if (typeof raw === "undefined") return undefined;
  if (!Array.isArray(raw) || raw.length > MAX_TOPOLOGY_MEDIA_REFS_PER_MATCH) return null;
  const refs: CompetitionParentMediaRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const o = item as Record<string, unknown>;
    if (o.kind !== "image" && o.kind !== "video") return null;
    const assetId =
      o.assetId === null
        ? null
        : typeof o.assetId === "string" && o.assetId.trim().length <= MAX_TOPOLOGY_ID_CHARS
          ? o.assetId.trim()
          : undefined;
    const uri =
      o.uri === null
        ? null
        : typeof o.uri === "string" && o.uri.trim().length <= MAX_TOPOLOGY_URI_CHARS
          ? o.uri.trim()
          : undefined;
    if (typeof o.assetId !== "undefined" && o.assetId !== null && typeof assetId === "undefined") {
      return null;
    }
    if (typeof o.uri !== "undefined" && o.uri !== null && typeof uri === "undefined") {
      return null;
    }
    if (!assetId && !uri) return null;
    refs.push({
      kind: o.kind,
      ...(typeof assetId !== "undefined" ? { assetId } : {}),
      ...(typeof uri !== "undefined" ? { uri } : {}),
    });
  }
  return refs;
}

function parseCompetitionMatchTopology(raw: unknown): CompetitionMatchTopology | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const matchLineageKey = parseTopologyId(o.matchLineageKey);
  const ordinal =
    typeof o.ordinal === "number" && Number.isFinite(o.ordinal) && o.ordinal >= 1
      ? Math.round(o.ordinal)
      : null;
  const result = o.result === "win" || o.result === "loss" || o.result === null ? o.result : null;
  if (o.result !== "win" && o.result !== "loss" && o.result !== null) return null;
  const finishType =
    o.finishType === null ||
    (typeof o.finishType === "string" && TOPOLOGY_FINISH_TYPES.has(o.finishType))
      ? (o.finishType as CompetitionTopologyFinishType)
      : undefined;
  const durationSeconds = parseNullableNonNegativeInt(o.durationSeconds);
  const pointsFor =
    typeof o.pointsFor === "undefined" ? undefined : parseNullableNonNegativeInt(o.pointsFor);
  const pointsAgainst =
    typeof o.pointsAgainst === "undefined"
      ? undefined
      : parseNullableNonNegativeInt(o.pointsAgainst);
  const submissionType =
    typeof o.submissionType === "undefined"
      ? undefined
      : o.submissionType === null
        ? null
        : typeof o.submissionType === "string" && o.submissionType.trim().length <= 120
          ? o.submissionType.trim()
          : undefined;
  const parentMediaRefs = parseTopologyMediaRefs(o.parentMediaRefs);
  if (
    !matchLineageKey ||
    ordinal === null ||
    typeof finishType === "undefined" ||
    typeof durationSeconds === "undefined" ||
    (typeof o.pointsFor !== "undefined" && typeof pointsFor === "undefined") ||
    (typeof o.pointsAgainst !== "undefined" && typeof pointsAgainst === "undefined") ||
    (typeof o.submissionType !== "undefined" && typeof submissionType === "undefined") ||
    parentMediaRefs === null
  ) {
    return null;
  }
  return {
    matchLineageKey,
    ordinal,
    result,
    finishType,
    durationSeconds,
    ...(typeof submissionType !== "undefined" ? { submissionType } : {}),
    ...(typeof pointsFor !== "undefined" ? { pointsFor } : {}),
    ...(typeof pointsAgainst !== "undefined" ? { pointsAgainst } : {}),
    ...(typeof parentMediaRefs !== "undefined" ? { parentMediaRefs } : {}),
  };
}

function parseCompetitionTopologyArtifact(raw: unknown): CompetitionTopologyArtifact | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (JSON.stringify(raw).length > MAX_TOPOLOGY_PAYLOAD_CHARS) return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1 || !Array.isArray(o.competitions)) return null;
  if (o.competitions.length > MAX_TOPOLOGY_COMPETITIONS_PER_ARTIFACT) return null;
  const sharedAthleteId = parseTopologyId(o.sharedAthleteId);
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!sharedAthleteId || !updatedAt) return null;

  let totalMatches = 0;
  const seenCompetitionIds = new Set<string>();
  const competitions: CompetitionTopology[] = [];
  for (const item of o.competitions) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const c = item as Record<string, unknown>;
    const sharedCompetitionId = parseTopologyId(c.sharedCompetitionId);
    const competitionSharedAthleteId = parseTopologyId(c.sharedAthleteId);
    const competitionLineageKey = parseTopologyId(c.competitionLineageKey);
    const competitionUpdatedAt = typeof c.updatedAt === "string" ? c.updatedAt.trim() : "";
    if (
      !sharedCompetitionId ||
      competitionSharedAthleteId !== sharedAthleteId ||
      !competitionLineageKey ||
      !competitionUpdatedAt ||
      !Array.isArray(c.matches) ||
      c.matches.length > MAX_TOPOLOGY_MATCHES_PER_COMPETITION ||
      seenCompetitionIds.has(sharedCompetitionId)
    ) {
      return null;
    }
    seenCompetitionIds.add(sharedCompetitionId);
    totalMatches += c.matches.length;
    if (totalMatches > MAX_TOPOLOGY_MATCHES_PER_ARTIFACT) return null;
    const seenMatchIds = new Set<string>();
    const matches: CompetitionMatchTopology[] = [];
    for (const matchRaw of c.matches) {
      const match = parseCompetitionMatchTopology(matchRaw);
      if (!match || seenMatchIds.has(match.matchLineageKey)) return null;
      seenMatchIds.add(match.matchLineageKey);
      matches.push(match);
    }
    competitions.push({
      sharedCompetitionId,
      sharedAthleteId,
      competitionLineageKey,
      updatedAt: competitionUpdatedAt,
      matches,
    });
  }
  return {
    schemaVersion: 1,
    sharedAthleteId,
    updatedAt,
    competitions,
  };
}

function parseCompetitionTopologyByAthleteId(
  raw: unknown,
): Record<string, CompetitionTopologyArtifact> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CompetitionTopologyArtifact> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const athleteId = key.trim();
    const artifact = parseCompetitionTopologyArtifact(value);
    if (!athleteId || !artifact || artifact.sharedAthleteId !== athleteId) continue;
    out[athleteId] = artifact;
  }
  return out;
}

function parseTrainingProofRankedItem(raw: unknown): TrainingProofRankedItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === "string" ? o.key.trim().slice(0, 120) : "";
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 120) : "";
  const count =
    typeof o.count === "number" && Number.isFinite(o.count)
      ? Math.max(0, Math.round(o.count))
      : null;
  if (!key || !label || count === null) return null;
  return { key, label, count };
}

function parseTrainingProofRankedList(raw: unknown, maxItems: number): TrainingProofRankedItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TrainingProofRankedItem[] = [];
  for (const item of raw) {
    const parsed = parseTrainingProofRankedItem(item);
    if (!parsed) continue;
    out.push(parsed);
    if (out.length >= maxItems) break;
  }
  return out;
}

function parseTrainingProofArtifact(raw: unknown): TrainingProofArtifact | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sharedAthleteId = typeof o.sharedAthleteId === "string" ? o.sharedAthleteId.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!sharedAthleteId || !updatedAt) return null;

  const currentWeekSessionCount =
    typeof o.currentWeekSessionCount === "number" && Number.isFinite(o.currentWeekSessionCount)
      ? Math.max(0, Math.round(o.currentWeekSessionCount))
      : null;
  if (currentWeekSessionCount === null) return null;

  const lastTrainingRaw =
    o.lastTrainingDateYMD === null
      ? null
      : typeof o.lastTrainingDateYMD === "string"
        ? o.lastTrainingDateYMD.trim()
        : null;
  const lastTrainingDateYMD =
    lastTrainingRaw === null
      ? null
      : /^\d{4}-\d{2}-\d{2}$/.test(lastTrainingRaw)
        ? lastTrainingRaw
        : null;

  const dominantRaw =
    o.dominantSystemKey === null
      ? null
      : typeof o.dominantSystemKey === "string"
        ? o.dominantSystemKey.trim().slice(0, 120)
        : null;
  const dominantSystemKey = dominantRaw && dominantRaw.length > 0 ? dominantRaw : null;

  const weeklyGoalMet = typeof o.weeklyGoalMet === "boolean" ? o.weeklyGoalMet : null;
  if (weeklyGoalMet === null) return null;

  return {
    sharedAthleteId,
    updatedAt,
    currentWeekSessionCount,
    lastTrainingDateYMD,
    dominantSystemKey,
    topSystems: parseTrainingProofRankedList(o.topSystems, 3),
    topTechniques: parseTrainingProofRankedList(o.topTechniques, 3),
    weeklyGoalMet,
  };
}

function parseTrainingProofByAthleteId(
  raw: unknown,
): Record<string, TrainingProofArtifact> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, TrainingProofArtifact> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = k.trim();
    if (!id || id.length > 64) continue;
    const artifact = parseTrainingProofArtifact(v);
    if (!artifact || artifact.sharedAthleteId !== id) continue;
    out[id] = artifact;
  }
  return out;
}

function parseCoachMatchBreakdownArtifact(raw: unknown): CoachMatchBreakdownArtifact | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sharedAthleteId = parseTopologyId(o.sharedAthleteId);
  const sharedCompetitionId = parseTopologyId(o.sharedCompetitionId);
  const matchLineageKey = parseTopologyId(o.matchLineageKey);
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  const coachNoteRaw = typeof o.coachNote === "string" ? o.coachNote.trim() : "";
  if (!sharedAthleteId || !sharedCompetitionId || !matchLineageKey || !updatedAt) return null;
  if (coachNoteRaw.length > MAX_COACH_BREAKDOWN_TEXT_CHARS) return null;
  // Domain metadata only — reject any attempt to sync URLs or local paths.
  if (typeof o.localUri === "string" || typeof o.url === "string" || typeof o.audioUrl === "string") {
    return null;
  }
  if ("voiceNoteRefs" in o) return null;
  const mediaIdRaw = typeof o.mediaId === "string" ? o.mediaId.trim() : "";
  const mediaId = mediaIdRaw && MEDIA_ID_RE.test(mediaIdRaw) ? mediaIdRaw.toLowerCase() : "";
  if (mediaIdRaw && !mediaId) return null;
  const mimeTypeRaw = typeof o.mimeType === "string" ? o.mimeType.trim().toLowerCase() : "";
  const mimeType =
    mimeTypeRaw && mimeTypeRaw.length <= 80 && ALLOWED_COACH_MEDIA_MIME.has(mimeTypeRaw)
      ? mimeTypeRaw
      : "";
  if (mimeTypeRaw && !mimeType) return null;
  const durationMs =
    typeof o.durationMs === "number" && Number.isFinite(o.durationMs) && o.durationMs >= 0
      ? Math.min(Math.floor(o.durationMs), 24 * 60 * 60 * 1000)
      : undefined;
  return {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    ...(coachNoteRaw ? { coachNote: coachNoteRaw } : {}),
    ...(mediaId ? { mediaId } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(mimeType ? { mimeType } : {}),
    updatedAt,
  };
}

function mediaObjectKey(token: string, mediaId: string): string {
  return `sessions/${token}/media/${mediaId}`;
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

async function signMediaContentAccess(
  writerSecret: string,
  token: string,
  mediaId: string,
  expUnix: number,
): Promise<string> {
  return hmacHex(writerSecret, `media-content:${token}:${mediaId}:${expUnix}`);
}

async function verifyMediaContentAccess(
  writerSecret: string,
  token: string,
  mediaId: string,
  expUnix: number,
  sig: string,
): Promise<boolean> {
  if (!sig || !MEDIA_ID_RE.test(mediaId)) return false;
  if (!Number.isFinite(expUnix) || expUnix <= Math.floor(Date.now() / 1000)) return false;
  const expected = await signMediaContentAccess(writerSecret, token, mediaId, expUnix);
  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Inclusive byte range resolved against an object size. */
type ResolvedMediaByteRange = {
  offset: number;
  end: number;
  length: number;
};

type ParsedMediaBytesRange =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "bounded"; offset: number; end: number | null }
  | { kind: "suffix"; suffix: number };

/**
 * Parse a single HTTP Range bytes unit. Multipart or malformed → invalid.
 * Open-ended `bytes=start-` uses end=null until resolved against object size.
 */
function parseMediaBytesRangeHeader(header: string | null): ParsedMediaBytesRange {
  if (header === null) return { kind: "none" };
  const raw = header.trim();
  if (!raw) return { kind: "none" };
  // Reject multipart ("bytes=0-1,2-3") and non-bytes units.
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

function resolveMediaBytesRange(
  parsed: Exclude<ParsedMediaBytesRange, { kind: "none" }>,
  size: number,
): ResolvedMediaByteRange | null {
  if (parsed.kind === "invalid") return null;
  if (size <= 0) return null;
  if (parsed.kind === "suffix") {
    const length = Math.min(parsed.suffix, size);
    const offset = size - length;
    return { offset, end: size - 1, length };
  }
  if (parsed.offset >= size) return null;
  const end = parsed.end === null ? size - 1 : Math.min(parsed.end, size - 1);
  if (end < parsed.offset) return null;
  return { offset: parsed.offset, end, length: end - parsed.offset + 1 };
}

function applyMediaContentCommonHeaders(headers: Headers, object: R2Object): void {
  object.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=60");
  headers.set("Access-Control-Allow-Origin", "*");
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }
}

function mediaContentFullResponse(object: R2ObjectBody): Response {
  const headers = new Headers();
  applyMediaContentCommonHeaders(headers, object);
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}

function mediaContentPartialResponse(
  object: R2ObjectBody,
  range: ResolvedMediaByteRange,
): Response {
  const headers = new Headers();
  applyMediaContentCommonHeaders(headers, object);
  headers.set("Content-Length", String(range.length));
  headers.set("Content-Range", `bytes ${range.offset}-${range.end}/${object.size}`);
  return new Response(object.body, { status: 206, headers });
}

function mediaContentRangeNotSatisfiableResponse(size: number): Response {
  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes */${size}`);
  headers.set("Cache-Control", "private, max-age=60");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(null, { status: 416, headers });
}

function parseDurationMsHeader(request: Request): number | undefined {
  const raw = request.headers.get(MEDIA_DURATION_HEADER)?.trim() ?? "";
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(Math.floor(n), 24 * 60 * 60 * 1000);
}

function parseCoachMatchBreakdownArtifactSet(
  raw: unknown,
): CoachMatchBreakdownArtifactSet | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (JSON.stringify(raw).length > MAX_COACH_BREAKDOWN_PAYLOAD_CHARS) return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1 || !Array.isArray(o.artifacts)) return null;
  const sharedAthleteId = parseTopologyId(o.sharedAthleteId);
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!sharedAthleteId || !updatedAt) return null;
  if (o.artifacts.length > MAX_COACH_BREAKDOWN_ARTIFACTS_PER_ATHLETE) return null;

  const identityKeys = new Set<string>();
  const artifacts: CoachMatchBreakdownArtifact[] = [];
  for (const rawArtifact of o.artifacts) {
    const artifact = parseCoachMatchBreakdownArtifact(rawArtifact);
    if (!artifact || artifact.sharedAthleteId !== sharedAthleteId) return null;
    const identityKey = JSON.stringify([
      artifact.sharedAthleteId,
      artifact.sharedCompetitionId,
      artifact.matchLineageKey,
    ]);
    if (identityKeys.has(identityKey)) return null;
    identityKeys.add(identityKey);
    artifacts.push(artifact);
  }

  return {
    schemaVersion: 1,
    sharedAthleteId,
    updatedAt,
    artifacts,
  };
}

function parseCoachMatchBreakdownArtifacts(
  raw: unknown,
): Record<string, CoachMatchBreakdownArtifactSet> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CoachMatchBreakdownArtifactSet> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || id.length > MAX_TOPOLOGY_ID_CHARS) continue;
    const artifactSet = parseCoachMatchBreakdownArtifactSet(value);
    if (!artifactSet || artifactSet.sharedAthleteId !== id) continue;
    out[id] = artifactSet;
  }
  return out;
}

/** Entries keyed only by athletes still on the session; bounded for KV size. */
function weeklyByAthleteIdForStorageAndApi(rec: SessionRecord): Record<string, WeeklyDoc> {
  const athleteIds = new Set(rec.athletes.map((a) => a.id));
  const out: Record<string, WeeklyDoc> = {};
  for (const [k, v] of Object.entries(rec.weeklyByAthleteId)) {
    if (!athleteIds.has(k)) continue;
    out[k] = v;
    if (Object.keys(out).length >= MAX_ATHLETES_PER_SESSION) break;
  }
  return out;
}

function coachMatchBreakdownArtifactsForStorageAndApi(
  rec: SessionRecord,
): Record<string, CoachMatchBreakdownArtifactSet> {
  const athleteIds = new Set(rec.athletes.map((a) => a.id));
  const out: Record<string, CoachMatchBreakdownArtifactSet> = {};
  for (const [k, v] of Object.entries(rec.coachMatchBreakdownArtifacts)) {
    if (!athleteIds.has(k)) continue;
    out[k] = v;
    if (Object.keys(out).length >= MAX_ATHLETES_PER_SESSION) break;
  }
  return out;
}

function coachMatchBreakdownArtifactList(
  artifactsByAthleteId: Record<string, CoachMatchBreakdownArtifactSet>,
): CoachMatchBreakdownArtifact[] {
  return Object.values(artifactsByAthleteId).flatMap((artifactSet) => artifactSet.artifacts);
}

/** Normalize legacy v1 KV rows into in-memory shape (persisted on next write). */
function normalizeSessionRecord(raw: unknown): SessionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const writerSecret = typeof r.writerSecret === "string" ? r.writerSecret.trim() : "";
  const coachId = typeof r.coachId === "string" ? r.coachId.trim() : "";
  const coachDisplayName =
    typeof r.coachDisplayName === "string" ? r.coachDisplayName.trim().slice(0, 120) : "";
  const createdAt = typeof r.createdAt === "string" ? r.createdAt.trim() : "";
  if (!writerSecret || !coachId || !coachDisplayName || !createdAt) return null;

  const academyRaw = typeof r.academyName === "string" ? r.academyName.trim().slice(0, 160) : "";
  const academyName = academyRaw.length > 0 ? academyRaw : undefined;

  const weekly =
    r.weekly && typeof r.weekly === "object"
      ? parseWeeklyDoc(r.weekly, { source: "normalizeSessionRecord_invite_weekly" })
      : null;

  const schemaVersion = typeof r.schemaVersion === "number" ? r.schemaVersion : 1;
  const athletes = schemaVersion >= 2 ? parseSharedAthletes(r.athletes) : [];
  const competitions = schemaVersion >= 2 ? parseSharedCompetitions(r.competitions) : [];
  const parentWriterSecret =
    typeof r.parentWriterSecret === "string" && r.parentWriterSecret.trim()
      ? r.parentWriterSecret.trim()
      : undefined;

  const weeklyByAthleteId = parseWeeklyByAthleteId(r.weeklyByAthleteId);
  const competitionAggregateByAthleteId = parseCompetitionAggregateByAthleteId(
    r.competitionAggregateByAthleteId,
  );
  const competitionTopologyByAthleteId = parseCompetitionTopologyByAthleteId(
    r.competitionTopologyByAthleteId,
  );
  const trainingProofByAthleteId = parseTrainingProofByAthleteId(r.trainingProofByAthleteId);
  const coachMatchBreakdownArtifacts = parseCoachMatchBreakdownArtifacts(
    r.coachMatchBreakdownArtifacts,
  );

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    writerSecret,
    coachId,
    coachDisplayName,
    academyName,
    weekly,
    weeklyByAthleteId,
    competitionAggregateByAthleteId,
    competitionTopologyByAthleteId,
    trainingProofByAthleteId,
    coachMatchBreakdownArtifacts,
    createdAt,
    athletes,
    competitions,
    parentWriterSecret,
  };
}

async function readSession(kv: KVNamespace, token: string): Promise<SessionRecord | null> {
  const raw = await kv.get(`s:${token}`, "json");
  const rawRoot = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const rawWeeklyBy = rawRoot?.weeklyByAthleteId;
  const rawWeeklyJsonSnippet = JSON.stringify(rawWeeklyBy ?? null)?.slice(0, 4000);
  logWeeklyCorruptionTrace("kv_get_raw_after_json", {
    tokenSuffix: token.slice(-8),
    rawWeeklyByAthleteProbes: probeWeeklyByMap(rawWeeklyBy),
    rawInviteWeeklyProbe: rawRoot?.weekly ? probeWeeklyRaw(rawRoot.weekly) : null,
    rawWeeklyByJsonSnippet: rawWeeklyJsonSnippet,
    rawSessionJsonBytes: raw ? JSON.stringify(raw).length : 0,
  });
  console.log("[SYSTEMKEY TRACE WORKER]", {
    traceStage: "6_KV_read_payload_after_json",
    rawWeeklyByAthleteSystemKey: summarizeRawWeeklyByAthleteSystemKey(rawWeeklyBy),
    source: "readSession_kv_get_json",
  });
  console.log("[AUDIT KV_READ_AFTER_GET]", {
    mark: WORKER_AUDIT_BUILD_ID,
    tokenSuffix: token.slice(-8),
    rawIsNull: raw == null,
    rawWeeklyByAthleteSystemKey: summarizeRawWeeklyByAthleteSystemKey(rawWeeklyBy),
    rawWeeklyByAthleteJsonSnippet: rawWeeklyJsonSnippet,
  });
  const normalized = normalizeSessionRecord(raw);
  const normalizedWeeklyByProbes = normalized
    ? Object.fromEntries(
        Object.entries(normalized.weeklyByAthleteId).map(([id, doc]) => [id, probeWeeklyDoc(doc)]),
      )
    : null;
  const kvToNormalizeDiffs: Record<string, string[]> = {};
  if (rawWeeklyBy && normalizedWeeklyByProbes) {
    const rawProbes = probeWeeklyByMap(rawWeeklyBy);
    for (const [id, before] of Object.entries(rawProbes)) {
      const after = normalizedWeeklyByProbes[id];
      const lost = diffWeeklyFieldLoss(before, after);
      const rejection = explainWeeklyDocParseRejection(
        (rawWeeklyBy as Record<string, unknown>)[id],
      );
      if (lost.length > 0 || !after) {
        kvToNormalizeDiffs[id] = lost.length > 0 ? lost : rejection ? [`parse_rejected:${rejection}`] : ["entry_dropped"];
      }
    }
  }
  logWeeklyCorruptionTrace("kv_get_after_normalize", {
    tokenSuffix: token.slice(-8),
    normalizedOk: Boolean(normalized),
    normalizedWeeklyByProbes,
    kvToNormalizeDiffs,
  });
  console.log("[AUDIT KV_READ_AFTER_NORMALIZE]", {
    mark: WORKER_AUDIT_BUILD_ID,
    tokenSuffix: token.slice(-8),
    normalizedOk: Boolean(normalized),
    normalizedWeeklyByAthleteSystemKey: normalized
      ? Object.fromEntries(
          Object.entries(normalized.weeklyByAthleteId).map(([aid, doc]) => [
            aid,
            {
              hasOwnSystemKey: Object.prototype.hasOwnProperty.call(doc, "systemKey"),
              systemKey: doc.systemKey ?? null,
            },
          ]),
        )
      : null,
  });
  if (normalized) {
    console.log("[REMOTE_ROSTER_STORAGE_AUDIT]", {
      currentPersistedAthleteIds: normalized.athletes.map((athlete) => athlete.id),
      afterDeleteAthleteIds: null,
      artifactsStillRetainedAfterDelete: null,
      storageStage: "readSession_after_normalize",
      tokenSuffix: token.slice(-8),
      topologyCounts: Object.keys(normalized.competitionTopologyByAthleteId ?? {}).length,
      aggregateCounts: Object.keys(normalized.competitionAggregateByAthleteId ?? {}).length,
      proofCounts: Object.keys(normalized.trainingProofByAthleteId ?? {}).length,
      perAthleteArtifactCounts: rosterArtifactCountsByAthlete(normalized),
      timestamp: new Date().toISOString(),
    });
  }
  return normalized;
}

async function writeSession(kv: KVNamespace, token: string, rec: SessionRecord): Promise<void> {
  const toStore: SessionRecord = {
    ...rec,
    schemaVersion: SESSION_SCHEMA_VERSION,
    weeklyByAthleteId: weeklyByAthleteIdForStorageAndApi(rec),
    coachMatchBreakdownArtifacts: coachMatchBreakdownArtifactsForStorageAndApi(rec),
    athletes: rec.athletes.slice(0, MAX_ATHLETES_PER_SESSION),
    competitions: rec.competitions.slice(0, MAX_COMPETITIONS_PER_SESSION),
  };
  const putJson = JSON.stringify(toStore);
  console.log("[SYSTEMKEY TRACE WORKER]", {
    traceStage: "5_KV_serialized_payload_put",
    headline: null,
    systemKey: null,
    athleteId: null,
    weekStartYMD: null,
    weeklyByAthleteSystemKeys: Object.fromEntries(
      Object.entries(toStore.weeklyByAthleteId).map(([aid, doc]) => [
        aid,
        {
          hasKey: Object.prototype.hasOwnProperty.call(doc, "systemKey"),
          systemKey: doc.systemKey ?? null,
          headline: doc.headline?.slice(0, 120) ?? null,
          weekStartYMD: doc.weekStartYMD,
        },
      ]),
    ),
    inviteWeeklySystemKey:
      toStore.weekly && Object.prototype.hasOwnProperty.call(toStore.weekly, "systemKey")
        ? toStore.weekly.systemKey ?? null
        : null,
    source: "writeSession_kv_put",
  });
  console.log("[AUDIT KV_PUT_BEFORE]", {
    mark: WORKER_AUDIT_BUILD_ID,
    tokenSuffix: token.slice(-8),
    putJsonBytes: putJson.length,
    weeklyByAthleteSystemKey: Object.fromEntries(
      Object.entries(toStore.weeklyByAthleteId).map(([aid, doc]) => [
        aid,
        {
          hasOwnSystemKey: Object.prototype.hasOwnProperty.call(doc, "systemKey"),
          systemKey: doc.systemKey ?? null,
        },
      ]),
    ),
    inviteWeeklySystemKey:
      toStore.weekly && Object.prototype.hasOwnProperty.call(toStore.weekly, "systemKey")
        ? toStore.weekly.systemKey ?? null
        : "(no key)",
    weeklyByAthleteJsonSnippet: JSON.stringify(toStore.weeklyByAthleteId).slice(0, 4000),
  });
  console.log("[REMOTE_ROSTER_STORAGE_AUDIT]", {
    currentPersistedAthleteIds: toStore.athletes.map((athlete) => athlete.id),
    afterDeleteAthleteIds: null,
    artifactsStillRetainedAfterDelete: null,
    storageStage: "writeSession_before_put",
    tokenSuffix: token.slice(-8),
    topologyCounts: Object.keys(toStore.competitionTopologyByAthleteId ?? {}).length,
    aggregateCounts: Object.keys(toStore.competitionAggregateByAthleteId ?? {}).length,
    proofCounts: Object.keys(toStore.trainingProofByAthleteId ?? {}).length,
    perAthleteArtifactCounts: rosterArtifactCountsByAthlete(toStore),
    timestamp: new Date().toISOString(),
  });
  const coachOverlayPutList = coachMatchBreakdownArtifactList(
    toStore.coachMatchBreakdownArtifacts,
  );
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "worker_put_session_serialized",
    buildId: COACH_OVERLAY_GET_PAYLOAD_BUILD_ID,
    sharedAthleteId: coachOverlayPutList[0]?.sharedAthleteId ?? null,
    sharedCompetitionId: coachOverlayPutList[0]?.sharedCompetitionId ?? null,
    matchLineageKey: coachOverlayPutList[0]?.matchLineageKey ?? null,
    overlayCount: coachOverlayPutList.length,
    artifactSetCount: Object.keys(toStore.coachMatchBreakdownArtifacts).length,
    hasStorageField: Object.prototype.hasOwnProperty.call(
      toStore,
      "coachMatchBreakdownArtifacts",
    ),
    tokenSuffix: token.slice(-8),
  });
  logWeeklyCorruptionTrace("kv_put_raw_before_write", {
    tokenSuffix: token.slice(-8),
    putJsonBytes: putJson.length,
    weeklyByAthleteProbes: probeWeeklyByMap(toStore.weeklyByAthleteId),
    inviteWeeklyProbe: toStore.weekly ? probeWeeklyDoc(toStore.weekly) : null,
    putWeeklyByJsonSnippet: JSON.stringify(toStore.weeklyByAthleteId).slice(0, 4000),
  });
  await kv.put(`s:${token}`, putJson);
  const readBack = await kv.get(`s:${token}`, "json");
  const readBackRoot =
    readBack && typeof readBack === "object" && !Array.isArray(readBack)
      ? (readBack as Record<string, unknown>)
      : null;
  const readBackWeeklyBy = readBackRoot?.weeklyByAthleteId;
  const readBackCoachMatchBreakdownArtifacts = parseCoachMatchBreakdownArtifacts(
    readBackRoot?.coachMatchBreakdownArtifacts,
  );
  const coachOverlayReadBackList = coachMatchBreakdownArtifactList(
    readBackCoachMatchBreakdownArtifacts,
  );
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "worker_put_session_readback",
    buildId: COACH_OVERLAY_GET_PAYLOAD_BUILD_ID,
    sharedAthleteId: coachOverlayReadBackList[0]?.sharedAthleteId ?? null,
    sharedCompetitionId: coachOverlayReadBackList[0]?.sharedCompetitionId ?? null,
    matchLineageKey: coachOverlayReadBackList[0]?.matchLineageKey ?? null,
    overlayCount: coachOverlayReadBackList.length,
    artifactSetCount: Object.keys(readBackCoachMatchBreakdownArtifacts).length,
    hasStorageField: Boolean(
      readBackRoot &&
        Object.prototype.hasOwnProperty.call(readBackRoot, "coachMatchBreakdownArtifacts"),
    ),
    tokenSuffix: token.slice(-8),
  });
  const putProbes = probeWeeklyByMap(toStore.weeklyByAthleteId);
  const readBackProbes = probeWeeklyByMap(readBackWeeklyBy);
  const putToReadBackDiffs: Record<string, string[]> = {};
  for (const [id, before] of Object.entries(putProbes)) {
    const after = readBackProbes[id];
    const lost = diffWeeklyFieldLoss(before, after);
    if (lost.length > 0 || !after) {
      putToReadBackDiffs[id] = lost.length > 0 ? lost : ["missing_after_kv_roundtrip"];
    }
  }
  logWeeklyCorruptionTrace("kv_put_readback_after_write", {
    tokenSuffix: token.slice(-8),
    readBackWeeklyByProbes: readBackProbes,
    putToReadBackDiffs,
    readBackWeeklyByJsonSnippet: JSON.stringify(readBackWeeklyBy ?? null).slice(0, 4000),
  });
  const kvArtifactCount = Object.values(toStore.coachMatchBreakdownArtifacts).reduce(
    (sum, artifactSet) => sum + artifactSet.artifacts.length,
    0,
  );
  logMatchBreakdownAuthorityTrace("WORKER_SESSION_WRITE", {
    traceId: null,
    sharedAthleteId: null,
    inviteTokenSuffix: inviteTokenSuffixForAuthorityTrace(token),
    kvArtifactCount,
    aggregateCount: Object.keys(toStore.competitionAggregateByAthleteId ?? {}).length,
    topologyCount: Object.keys(toStore.competitionTopologyByAthleteId ?? {}).length,
  });
  logMatchBreakdownAuthorityTrace("WORKER_SESSION_SELF_GET", {
    traceId: null,
    sharedAthleteId: null,
    inviteTokenSuffix: inviteTokenSuffixForAuthorityTrace(token),
    artifactCountReturned: Object.values(readBackCoachMatchBreakdownArtifacts).reduce(
      (sum, artifactSet) => sum + artifactSet.artifacts.length,
      0,
    ),
    aggregateCount: Object.keys(
      parseCompetitionAggregateByAthleteId(readBackRoot?.competitionAggregateByAthleteId),
    ).length,
    topologyCount: Object.keys(
      parseCompetitionTopologyByAthleteId(readBackRoot?.competitionTopologyByAthleteId),
    ).length,
  });
}

function createMatchMediaPublicationDependencies(
  env: Env,
): MatchMediaPublicationDependencies {
  return {
    enabled: isPublicationFeatureEnabled(env.SHARED_MATCH_MEDIA_PUBLICATION_ENABLED),
    mediaBucket: env.MEDIA,
    readParentSession: (sessionToken) => readSession(env.SESSIONS, sessionToken),
    now: () => new Date(),
  };
}

function createSharedMatchMediaUploadDependencies(
  env: Env,
): SharedMatchMediaUploadDependencies {
  const verificationEnabled = isVerificationFeatureEnabled(
    env.SHARED_MATCH_MEDIA_VERIFICATION_ENABLED,
  );
  return {
    enabled: env.SHARED_MATCH_MEDIA_UPLOAD_ENABLED === "1",
    metadataStore: {
      get: async (key) => {
        const object = await env.MEDIA.get(key);
        return object ? object.text() : null;
      },
      putIfAbsent: async (key, value) => {
        const object = await env.MEDIA.put(key, value, {
          onlyIf: { etagDoesNotMatch: "*" },
          httpMetadata: { contentType: "application/json" },
          customMetadata: { recordType: "match-media-upload-session-v1" },
        });
        return object !== null;
      },
      getVersioned: async (key) => {
        const object = await env.MEDIA.get(key);
        return object ? { value: await object.text(), version: object.etag } : null;
      },
      compareAndSwap: async (key, version, value) => {
        const object = await env.MEDIA.put(key, value, {
          onlyIf: { etagMatches: version },
          httpMetadata: { contentType: "application/json" },
          customMetadata: { recordType: "match-media-upload-session-v1" },
        });
        return object !== null;
      },
    },
    bucket: {
      createMultipartUpload: (key, options) =>
        env.MEDIA.createMultipartUpload(key, options),
      resumeMultipartUpload: (key, uploadId) => {
        const multipart = env.MEDIA.resumeMultipartUpload(key, uploadId);
        // { sha256 } support is established by existing runtime certification or
        // observed behavior; it is not currently represented in the published
        // R2MultipartOptions/Workers type contract.
        return {
          uploadId: multipart.uploadId,
          abort: () => multipart.abort(),
          uploadPart: (partNumber, value, options) =>
            uploadMultipartPartWithSha256(multipart, partNumber, value, options),
          complete: (parts) => multipart.complete([...parts]),
        };
      },
      head: (key) => env.MEDIA.head(key),
    },
    readParentSession: (sessionToken) => readSession(env.SESSIONS, sessionToken),
    now: () => new Date(),
    randomUuid: () => crypto.randomUUID(),
    ...(verificationEnabled
      ? {
          runProductionVerificationAfterUploadComplete: async (input) => {
            const result = await runProductionVerification(input, {
              enabled: true,
              canaryAssetId: env.SHARED_MATCH_MEDIA_VERIFICATION_CANARY_ASSET_ID ?? "",
              canaryObjectVersion:
                env.SHARED_MATCH_MEDIA_VERIFICATION_CANARY_OBJECT_VERSION ?? "",
              mediaBucket: env.MEDIA,
              now: () => new Date(),
              randomId: () => crypto.randomUUID(),
            });
            if (result.outcome === "disabled" || result.outcome === "bypassed") {
              return {
                outcome: result.outcome,
                verificationAttempted: false,
                ...(result.outcome === "bypassed"
                  ? { code: result.bypassReason }
                  : {}),
              };
            }
            if (result.outcome === "trigger_error") {
              return {
                outcome: result.outcome,
                verificationAttempted: true,
                code: result.code,
                message: result.message,
              };
            }
            return {
              outcome: result.outcome,
              verificationAttempted: true,
              verificationState: result.record.state,
              admissionOutcome: result.admissionOutcome,
              ...(result.record.terminalReasonCode
                ? { code: result.record.terminalReasonCode }
                : {}),
            };
          },
        }
      : {}),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        `Content-Type, Content-Length, Authorization, Idempotency-Key, X-MatMind-Part-Bytes, X-MatMind-Part-SHA256, ${MATMIND_TRANSITION_HEADER}, ${MEDIA_DURATION_HEADER}`,
      "Access-Control-Expose-Headers": MATMIND_AUDIT_SNAPSHOT_HEADER,
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "POST" && path === "/v1/sessions") {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON", 400);
        }
        const coachDisplayName =
          typeof body === "object" && body && typeof (body as { coachDisplayName?: unknown }).coachDisplayName === "string"
            ? (body as { coachDisplayName: string }).coachDisplayName.trim()
            : "";
        if (!coachDisplayName || coachDisplayName.length > 120) {
          return error("coachDisplayName required (max 120 chars)", 400);
        }
        const academyRaw =
          typeof body === "object" && body && typeof (body as { academyName?: unknown }).academyName === "string"
            ? (body as { academyName: string }).academyName.trim()
            : "";
        const academyName = academyRaw.length > 0 ? academyRaw.slice(0, 160) : undefined;

        const linkToken = randomHex(24);
        const writerSecret = randomHex(32);
        const coachId = `coach_${randomHex(8)}`;
        const now = new Date().toISOString();

        const rec: SessionRecord = {
          schemaVersion: SESSION_SCHEMA_VERSION,
          writerSecret,
          coachId,
          coachDisplayName,
          academyName,
          weekly: null,
          weeklyByAthleteId: {},
          competitionAggregateByAthleteId: {},
          competitionTopologyByAthleteId: {},
          trainingProofByAthleteId: {},
          coachMatchBreakdownArtifacts: {},
          createdAt: now,
          athletes: [],
          competitions: [],
        };
        await writeSession(env.SESSIONS, linkToken, rec);

        return json({ linkToken, writerSecret, coachId }, 201);
      }

      const sessionGet = path.match(/^\/v1\/sessions\/([^/]+)$/);
      if (sessionGet && request.method === "GET") {
        console.log("[WORKER_RUNTIME_TRACE]", {
          stage: "get_route_enter",
          url: request.url,
          method: request.method,
          runtimeVersion: WORKER_RUNTIME_VERSION,
        });
        const token = decodeURIComponent(sessionGet[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const overlayForensicTraceId =
          request.headers.get(OVERLAY_FORENSIC_TRACE_HEADER)?.trim().slice(0, 160) || null;
        const rec = await readSession(env.SESSIONS, token);
        if (!rec) {
          return json({ ok: true, alreadyRetired: true }, 200);
        }

        // Debug clear propagation: see if the stored weekly doc actually drops the recap key.
        if (rec.weekly) {
          const recapRaw = rec.weekly.familyCoachRecapNote;
          const hasRecapKey = Object.prototype.hasOwnProperty.call(rec.weekly, "familyCoachRecapNote");
          const recapLen = typeof recapRaw === "string" ? recapRaw.length : null;
          if (!hasRecapKey || recapLen === 0) {
            console.log("[coach-sync-weekly-get familyCoachRecapNote]", {
              hasRecapKey,
              recapLen,
              weekStartYMD: rec.weekly.weekStartYMD,
            });
          }
        }
        const apiWeekly = weeklyByAthleteIdForStorageAndApi(rec);
        const normalizedProbes = Object.fromEntries(
          Object.entries(rec.weeklyByAthleteId ?? {}).map(([k, v]) => [k, probeWeeklyDoc(v)]),
        );
        const apiProbes = Object.fromEntries(
          Object.entries(apiWeekly ?? {}).map(([k, v]) => [k, probeWeeklyDoc(v)]),
        );
        const getAssemblyDiffs: Record<string, string[]> = {};
        for (const [id, before] of Object.entries(normalizedProbes)) {
          const after = apiProbes[id];
          const lost = diffWeeklyFieldLoss(before, after);
          if (lost.length > 0 || !after) {
            getAssemblyDiffs[id] = lost.length > 0 ? lost : ["filtered_by_weeklyByAthleteIdForStorageAndApi"];
          }
        }
        const apiCoachMatchBreakdownArtifacts = coachMatchBreakdownArtifactsForStorageAndApi(rec);
        const apiCoachMatchBreakdownArtifactList = coachMatchBreakdownArtifactList(
          apiCoachMatchBreakdownArtifacts,
        );
        for (const [athleteId, artifactSet] of Object.entries(apiCoachMatchBreakdownArtifacts)) {
          console.log("[OVERLAY_FORENSIC]", {
            stage: "worker_get_artifact_set",
            traceId: overlayForensicTraceId,
            timestamp: new Date().toISOString(),
            sourceFile: "coach-sync-worker/src/index.ts",
            tokenSuffix: token.slice(-8),
            sharedAthleteId: athleteId,
            sharedCompetitionId: artifactSet.artifacts[0]?.sharedCompetitionId ?? null,
            matchLineageKey: artifactSet.artifacts[0]?.matchLineageKey ?? null,
            artifactCount: artifactSet.artifacts.length,
          });
        }
        const aggregateArtifacts = Object.values(rec.competitionAggregateByAthleteId ?? {});
        console.log("[COMP_AGGREGATE_TRACE]", {
          stage: "worker_get_payload",
          aggregateCount: aggregateArtifacts.length,
          aggregates: aggregateArtifacts.map((artifact) => ({
            sharedAthleteId: artifact.sharedAthleteId,
            updatedAt: artifact.updatedAt,
            totalCompetitions: artifact.totalCompetitions,
            totalMatches: artifact.totalMatches,
            wins: artifact.wins,
            losses: artifact.losses,
            submissionRate: artifact.submissionRate,
            fastestSubmission: artifact.fastestSubmissionSeconds,
          })),
          tokenSuffix: token.slice(-8),
        });
        for (const artifact of Object.values(rec.competitionTopologyByAthleteId ?? {})) {
          logCoachTopologyMatchTrace("worker_get_topology", artifact, {
            accepted: true,
            overwriteReason: "get_payload_serialized",
            tokenSuffix: token.slice(-8),
          });
        }
        const getPayload = {
          schemaVersion: rec.schemaVersion,
          coach: {
            id: rec.coachId,
            displayName: rec.coachDisplayName,
            ...(rec.academyName ? { academyName: rec.academyName } : {}),
          },
          weekly: rec.weekly,
          weeklyByAthleteId: apiWeekly,
          athletes: rec.athletes,
          competitions: rec.competitions,
          competitionAggregateByAthleteId: rec.competitionAggregateByAthleteId,
          competitionTopologyByAthleteId: rec.competitionTopologyByAthleteId,
          trainingProofByAthleteId: rec.trainingProofByAthleteId,
          coachMatchBreakdownArtifacts: apiCoachMatchBreakdownArtifacts,
        };
        console.log("[REMOTE_ROSTER_FORENSIC]", {
          sharedAthleteIdsReturned: rec.athletes.map((athlete) => athlete.id),
          athleteCount: rec.athletes.length,
          deletedRetiredArchivedByAthlete: Object.fromEntries(
            rec.athletes.map((athlete) => [
              athlete.id,
              { deleted: false, retired: false, archived: false },
            ]),
          ),
          topologyProofAggregateCountsPerAthlete: rosterArtifactCountsByAthlete(rec),
          requestType: "GET /v1/sessions/:token",
          tokenSuffix: token.slice(-8),
          timestamp: new Date().toISOString(),
        });
        console.log("[WORKER_ROSTER_RESPONSE]", {
          sharedAthleteIds: rec.athletes.map((athlete) => athlete.id),
          athleteCount: rec.athletes.length,
          inviteIds: [token.slice(-8)],
          topologyCounts: Object.keys(rec.competitionTopologyByAthleteId ?? {}).length,
          aggregateCounts: Object.keys(rec.competitionAggregateByAthleteId ?? {}).length,
          proofCounts: Object.keys(rec.trainingProofByAthleteId ?? {}).length,
          payloadGeneratedAt: new Date().toISOString(),
          requestType: "GET /v1/sessions/:token",
          payloadByteSize: roughByteSize(getPayload),
          timestamp: new Date().toISOString(),
        });
        console.log("[COACH_OVERLAY_SYNC_TRACE]", {
          stage: "worker_get_payload_assembled",
          athleteCount: rec.athletes.length,
          competitionCount: rec.competitions.length,
          topologyArtifactCount: Object.keys(rec.competitionTopologyByAthleteId ?? {}).length,
          aggregateArtifactCount: Object.keys(rec.competitionAggregateByAthleteId ?? {}).length,
          trainingProofArtifactCount: Object.keys(rec.trainingProofByAthleteId ?? {}).length,
          coachMatchBreakdownArtifactCount: Object.values(apiCoachMatchBreakdownArtifacts).reduce(
            (sum, artifactSet) => sum + artifactSet.artifacts.length,
            0,
          ),
          coachMatchBreakdownArtifactByAthleteCount: Object.keys(apiCoachMatchBreakdownArtifacts).length,
          hasCoachMatchBreakdownArtifactField: true,
        });
        console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
          stage: "worker_get_payload",
          buildId: COACH_OVERLAY_GET_PAYLOAD_BUILD_ID,
          sharedAthleteId: apiCoachMatchBreakdownArtifactList[0]?.sharedAthleteId ?? null,
          sharedCompetitionId: apiCoachMatchBreakdownArtifactList[0]?.sharedCompetitionId ?? null,
          matchLineageKey: apiCoachMatchBreakdownArtifactList[0]?.matchLineageKey ?? null,
          overlayCount: apiCoachMatchBreakdownArtifactList.length,
          artifacts: apiCoachMatchBreakdownArtifactList.map((artifact) => ({
            sharedAthleteId: artifact.sharedAthleteId,
            sharedCompetitionId: artifact.sharedCompetitionId,
            matchLineageKey: artifact.matchLineageKey,
            hasCoachNote: Boolean(artifact.coachNote?.trim()),
          })),
          artifactSetCount: Object.keys(apiCoachMatchBreakdownArtifacts).length,
          hasPayloadField: Object.prototype.hasOwnProperty.call(
            getPayload,
            "coachMatchBreakdownArtifacts",
          ),
          tokenSuffix: token.slice(-8),
        });
        const cf = (request as Request & { cf?: { colo?: string } }).cf;
        console.log("[SYSTEMKEY TRACE WORKER]", {
          traceStage: "7_GET_response_payload_worker",
          weeklyByAthleteSystemKeys: Object.fromEntries(
            Object.entries(apiWeekly).map(([aid, doc]) => [
              aid,
              {
                headline: doc.headline?.slice(0, 120) ?? null,
                systemKey: doc.systemKey ?? null,
                weekStartYMD: doc.weekStartYMD,
                hasOwnSystemKey: Object.prototype.hasOwnProperty.call(doc, "systemKey"),
              },
            ]),
          ),
          inviteWeeklySystemKey: rec.weekly?.systemKey ?? null,
          source: "session_GET_before_json_return",
        });
        const responseProbes = probeWeeklyByMap(getPayload.weeklyByAthleteId);
        const normalizeToResponseDiffs: Record<string, string[]> = {};
        for (const [id, before] of Object.entries(normalizedProbes)) {
          const after = responseProbes[id];
          const lost = diffWeeklyFieldLoss(before, after);
          if (lost.length > 0 || !after) {
            normalizeToResponseDiffs[id] = lost.length > 0 ? lost : ["missing_in_getPayload"];
          }
        }
        logWeeklyCorruptionTrace("get_response_assembly_diff", {
          tokenSuffix: token.slice(-8),
          cfColo: cf?.colo ?? null,
          cfRay: request.headers.get("CF-Ray") ?? request.headers.get("cf-ray") ?? null,
          normalizedProbes,
          apiProbes,
          responseProbes,
          getAssemblyDiffs,
          normalizeToResponseDiffs,
          serializedWeeklyBySnippet: JSON.stringify(getPayload.weeklyByAthleteId).slice(0, 4000),
        });
        console.log("[AUDIT GET_BEFORE_JSON_RETURN]", {
          mark: WORKER_AUDIT_BUILD_ID,
          tokenSuffix: token.slice(-8),
          cfColo: cf?.colo ?? null,
          cfRay: request.headers.get("CF-Ray") ?? request.headers.get("cf-ray") ?? null,
          weeklyByAthleteSystemKey: Object.fromEntries(
            Object.entries(apiWeekly).map(([aid, doc]) => [
              aid,
              {
                hasOwnSystemKey: Object.prototype.hasOwnProperty.call(doc, "systemKey"),
                systemKey: doc.systemKey ?? null,
              },
            ]),
          ),
          inviteWeeklyHasSystemKey: rec.weekly
            ? Object.prototype.hasOwnProperty.call(rec.weekly, "systemKey")
            : false,
          inviteWeeklySystemKey: rec.weekly?.systemKey ?? null,
          serializedWeeklyBySnippet: JSON.stringify(getPayload.weeklyByAthleteId).slice(0, 4000),
        });
        console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
          stage: "worker_get_payload_before_json",
          buildId: COACH_OVERLAY_GET_PAYLOAD_BUILD_ID,
          sharedAthleteId: apiCoachMatchBreakdownArtifactList[0]?.sharedAthleteId ?? null,
          sharedCompetitionId: apiCoachMatchBreakdownArtifactList[0]?.sharedCompetitionId ?? null,
          matchLineageKey: apiCoachMatchBreakdownArtifactList[0]?.matchLineageKey ?? null,
          overlayCount: apiCoachMatchBreakdownArtifactList.length,
          artifactSetCount: Object.keys(getPayload.coachMatchBreakdownArtifacts).length,
          hasPayloadField: Object.prototype.hasOwnProperty.call(
            getPayload,
            "coachMatchBreakdownArtifacts",
          ),
          serializedFieldBytes: JSON.stringify(getPayload.coachMatchBreakdownArtifacts).length,
          tokenSuffix: token.slice(-8),
        });
        return json(getPayload, 200);
      }

      const parentRedeem = path.match(/^\/v1\/sessions\/([^/]+)\/parent-redeem$/);
      if (parentRedeem && request.method === "POST") {
        const token = decodeURIComponent(parentRedeem[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const rec = await readSession(env.SESSIONS, token);
        if (!rec) {
          return error("Not found", 404);
        }

        let next = rec;
        if (!rec.parentWriterSecret) {
          const parentWriterSecret = randomHex(32);
          next = { ...rec, parentWriterSecret };
          await writeSession(env.SESSIONS, token, next);
        }

        return json({ parentWriterSecret: next.parentWriterSecret! }, 200);
      }

      const athletesPost = path.match(/^\/v1\/sessions\/([^/]+)\/athletes$/);
      if (athletesPost && request.method === "POST") {
        const token = decodeURIComponent(athletesPost[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) {
          return error("Unauthorized", 401);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON", 400);
        }
        const b = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
        const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
        if (!name) {
          return error("name required (max 120 chars)", 400);
        }
        const bindSharedAthleteIdRaw =
          typeof b.bindSharedAthleteId === "string" ? b.bindSharedAthleteId.trim() : "";

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) {
          return error("Unauthorized", 401);
        }

        if (bindSharedAthleteIdRaw) {
          if (
            bindSharedAthleteIdRaw.length > 64 ||
            !bindSharedAthleteIdRaw.startsWith("shared_ath_")
          ) {
            return error("bindSharedAthleteId invalid", 400);
          }
          const onRoster = rec.athletes.find((a) => a.id === bindSharedAthleteIdRaw);
          if (onRoster) {
            console.log("[ATHLETE DEDUPE]", {
              operation: "post_athletes",
              athleteName: name,
              normalizedName: normalizeAthleteNameForDedupe(name),
              existingSharedAthleteId: onRoster.id,
              sharedAthleteId: onRoster.id,
              reused: true,
              preventedDuplicate: true,
              newIdMinted: false,
              bindSharedAthleteId: bindSharedAthleteIdRaw,
              sessionAthleteCount: rec.athletes.length,
              token,
            });
            console.log("[IDENTITY_BIND_EXISTING]", {
              sourceFlow: "worker_post_session_athletes_bind_existing_id",
              callerFunction: "POST /v1/sessions/:token/athletes",
              athleteName: name,
              existingSharedId: onRoster.id,
              newlyMintedSharedId: null,
              inviteToken: token,
              extra: { bindSharedAthleteId: bindSharedAthleteIdRaw, alreadyOnRoster: true },
            });
            return json({ athlete: onRoster }, 201);
          }
          if (rec.athletes.length >= MAX_ATHLETES_PER_SESSION) {
            return error("Athlete limit reached for this invite", 400);
          }
          const nowBind = new Date().toISOString();
          const rebound: SharedAthlete = {
            id: bindSharedAthleteIdRaw,
            name,
            createdAt: nowBind,
          };
          const nextBind: SessionRecord = {
            ...rec,
            athletes: [...rec.athletes, rebound],
          };
          await writeSession(env.SESSIONS, token, nextBind);
          console.log("[ATHLETE DEDUPE]", {
            operation: "post_athletes",
            athleteName: name,
            normalizedName: normalizeAthleteNameForDedupe(name),
            existingSharedAthleteId: bindSharedAthleteIdRaw,
            sharedAthleteId: rebound.id,
            reused: true,
            preventedDuplicate: true,
            newIdMinted: false,
            bindSharedAthleteId: bindSharedAthleteIdRaw,
            sessionAthleteCount: rec.athletes.length + 1,
            token,
          });
          console.log("[IDENTITY_BIND_EXISTING]", {
            sourceFlow: "worker_post_session_athletes_rebind_canonical",
            callerFunction: "POST /v1/sessions/:token/athletes",
            athleteName: name,
            existingSharedId: bindSharedAthleteIdRaw,
            newlyMintedSharedId: null,
            inviteToken: token,
            extra: { reboundToRoster: true },
          });
          return json({ athlete: rebound }, 201);
        }

        const normalizedName = normalizeAthleteNameForDedupe(name);
        const existingAthlete = rec.athletes.find(
          (a) => normalizeAthleteNameForDedupe(a.name) === normalizedName,
        );
        if (existingAthlete) {
          console.log("[ATHLETE DEDUPE]", {
            operation: "post_athletes",
            athleteName: name,
            normalizedName,
            existingSharedAthleteId: existingAthlete.id,
            sharedAthleteId: existingAthlete.id,
            reused: true,
            preventedDuplicate: true,
            newIdMinted: false,
            sessionAthleteCount: rec.athletes.length,
            token,
          });
          console.log("[IDENTITY_BIND_EXISTING]", {
            sourceFlow: "worker_post_session_athletes_dedupe",
            callerFunction: "POST /v1/sessions/:token/athletes",
            athleteName: name,
            existingSharedId: existingAthlete.id,
            newlyMintedSharedId: null,
            inviteToken: token,
            extra: { normalizedName, preventedDuplicate: true },
          });
          return json({ athlete: existingAthlete }, 201);
        }

        if (rec.athletes.length >= MAX_ATHLETES_PER_SESSION) {
          return error("Athlete limit reached for this invite", 400);
        }

        const now = new Date().toISOString();
        const athlete: SharedAthlete = {
          id: `shared_ath_${randomHex(16)}`,
          name,
          createdAt: now,
        };
        const next: SessionRecord = { ...rec, athletes: [...rec.athletes, athlete] };
        await writeSession(env.SESSIONS, token, next);

        console.log("[ATHLETE DEDUPE]", {
          operation: "post_athletes",
          athleteName: name,
          normalizedName,
          existingSharedAthleteId: null,
          sharedAthleteId: athlete.id,
          reused: false,
          preventedDuplicate: false,
          newIdMinted: true,
          sessionAthleteCount: rec.athletes.length + 1,
          token,
        });
        console.log("[IDENTITY_MINT]", {
          sourceFlow: "worker_post_session_athletes",
          callerFunction: "POST /v1/sessions/:token/athletes",
          athleteName: name,
          existingSharedId: null,
          newlyMintedSharedId: athlete.id,
          inviteToken: token,
          extra: { normalizedName, sessionAthleteCountAfter: rec.athletes.length + 1 },
        });

        return json({ athlete }, 201);
      }

      const athletesDelete = path.match(/^\/v1\/sessions\/([^/]+)\/athletes\/([^/]+)$/);
      if (athletesDelete && request.method === "DELETE") {
        const token = decodeURIComponent(athletesDelete[1] ?? "").trim().toLowerCase();
        const athleteId = decodeURIComponent(athletesDelete[2] ?? "").trim();
        if (!TOKEN_RE.test(token) || !athleteId) {
          return error("Invalid token", 400);
        }
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) {
          return error("Unauthorized", 401);
        }

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) {
          return error("Unauthorized", 401);
        }
        const hadAthlete = rec.athletes.some((a) => a.id === athleteId);
        if (!hadAthlete) {
          console.log("[CANONICAL_RETIREMENT_WORKER]", {
            beforeAthleteIds: rec.athletes.map((athlete) => athlete.id),
            afterAthleteIds: rec.athletes.map((athlete) => athlete.id),
            removedArtifactCounts: {
              roster: 0,
              weekly: 0,
              trainingProof: 0,
              competitionAggregates: 0,
              competitionTopology: 0,
              coachOverlays: 0,
              competitions: 0,
            },
            retainedArtifactCounts: {
              weekly: Object.keys(rec.weeklyByAthleteId ?? {}).length,
              trainingProof: Object.keys(rec.trainingProofByAthleteId ?? {}).length,
              competitionAggregates: Object.keys(rec.competitionAggregateByAthleteId ?? {}).length,
              competitionTopology: Object.keys(rec.competitionTopologyByAthleteId ?? {}).length,
              coachOverlays: Object.keys(rec.coachMatchBreakdownArtifacts ?? {}).length,
              competitions: rec.competitions.length,
            },
            persisted: false,
            idempotentNoop: true,
            failure: null,
            deletedAthleteId: athleteId,
            tokenSuffix: token.slice(-8),
            timestamp: new Date().toISOString(),
          });
          return error("Not found", 404);
        }

        const removedCompetitionCount = rec.competitions.filter(
          (competition) => competition.sharedAthleteId === athleteId,
        ).length;
        const removedCoachOverlayCount =
          rec.coachMatchBreakdownArtifacts[athleteId]?.artifacts.length ?? 0;
        const { [athleteId]: _removedWeekly, ...restWeeklyByAthlete } = rec.weeklyByAthleteId;
        const { [athleteId]: _removedAggregate, ...restCompetitionAggregateByAthlete } =
          rec.competitionAggregateByAthleteId;
        const { [athleteId]: _removedTopology, ...restCompetitionTopologyByAthlete } =
          rec.competitionTopologyByAthleteId;
        const { [athleteId]: _removedProof, ...restTrainingProofByAthlete } =
          rec.trainingProofByAthleteId;
        const { [athleteId]: _removedCoachMatchBreakdowns, ...restCoachMatchBreakdownArtifacts } =
          rec.coachMatchBreakdownArtifacts;
        const next: SessionRecord = {
          ...rec,
          athletes: rec.athletes.filter((a) => a.id !== athleteId),
          competitions: rec.competitions.filter((c) => c.sharedAthleteId !== athleteId),
          weeklyByAthleteId: restWeeklyByAthlete,
          competitionAggregateByAthleteId: restCompetitionAggregateByAthlete,
          competitionTopologyByAthleteId: restCompetitionTopologyByAthlete,
          trainingProofByAthleteId: restTrainingProofByAthlete,
          coachMatchBreakdownArtifacts: restCoachMatchBreakdownArtifacts,
        };
        console.log("[REMOTE_ROSTER_STORAGE_AUDIT]", {
          currentPersistedAthleteIds: rec.athletes.map((athlete) => athlete.id),
          afterDeleteAthleteIds: next.athletes.map((athlete) => athlete.id),
          artifactsStillRetainedAfterDelete: {
            weekly: Boolean(restWeeklyByAthlete[athleteId]),
            topology: Boolean(restCompetitionTopologyByAthlete[athleteId]),
            aggregate: Boolean(restCompetitionAggregateByAthlete[athleteId]),
            proof: Boolean(restTrainingProofByAthlete[athleteId]),
            coachMatchBreakdowns: Boolean(restCoachMatchBreakdownArtifacts[athleteId]),
            competitions: next.competitions.some(
              (competition) => competition.sharedAthleteId === athleteId,
            ),
          },
          storageStage: "DELETE_athlete_before_writeSession",
          tokenSuffix: token.slice(-8),
          deletedAthleteId: athleteId,
          topologyCounts: Object.keys(next.competitionTopologyByAthleteId ?? {}).length,
          aggregateCounts: Object.keys(next.competitionAggregateByAthleteId ?? {}).length,
          proofCounts: Object.keys(next.trainingProofByAthleteId ?? {}).length,
          timestamp: new Date().toISOString(),
        });
        console.log("[REMOTE_ROSTER_FORENSIC]", {
          sharedAthleteIdsReturned: next.athletes.map((athlete) => athlete.id),
          athleteCount: next.athletes.length,
          deletedRetiredArchivedByAthlete: Object.fromEntries(
            next.athletes.map((athlete) => [
              athlete.id,
              { deleted: false, retired: false, archived: false },
            ]),
          ),
          topologyProofAggregateCountsPerAthlete: rosterArtifactCountsByAthlete(next),
          requestType: "DELETE /v1/sessions/:token/athletes/:athleteId",
          tokenSuffix: token.slice(-8),
          deletedAthleteId: athleteId,
          timestamp: new Date().toISOString(),
        });
        console.log("[WORKER_ROSTER_RESPONSE]", {
          sharedAthleteIds: next.athletes.map((athlete) => athlete.id),
          athleteCount: next.athletes.length,
          inviteIds: [token.slice(-8)],
          topologyCounts: Object.keys(next.competitionTopologyByAthleteId ?? {}).length,
          aggregateCounts: Object.keys(next.competitionAggregateByAthleteId ?? {}).length,
          proofCounts: Object.keys(next.trainingProofByAthleteId ?? {}).length,
          payloadGeneratedAt: new Date().toISOString(),
          requestType: "DELETE /v1/sessions/:token/athletes/:athleteId",
          deletedAthleteId: athleteId,
          removedTopology: Boolean(_removedTopology),
          removedAggregate: Boolean(_removedAggregate),
          removedProof: Boolean(_removedProof),
          removedCoachMatchBreakdowns: Boolean(_removedCoachMatchBreakdowns),
          timestamp: new Date().toISOString(),
        });
        try {
          await writeSession(env.SESSIONS, token, next);
          console.log("[CANONICAL_RETIREMENT_WORKER]", {
            beforeAthleteIds: rec.athletes.map((athlete) => athlete.id),
            afterAthleteIds: next.athletes.map((athlete) => athlete.id),
            removedArtifactCounts: {
              roster: 1,
              weekly: _removedWeekly ? 1 : 0,
              trainingProof: _removedProof ? 1 : 0,
              competitionAggregates: _removedAggregate ? 1 : 0,
              competitionTopology: _removedTopology ? 1 : 0,
              coachOverlays: removedCoachOverlayCount,
              competitions: removedCompetitionCount,
            },
            retainedArtifactCounts: {
              weekly: Object.keys(next.weeklyByAthleteId ?? {}).length,
              trainingProof: Object.keys(next.trainingProofByAthleteId ?? {}).length,
              competitionAggregates: Object.keys(next.competitionAggregateByAthleteId ?? {}).length,
              competitionTopology: Object.keys(next.competitionTopologyByAthleteId ?? {}).length,
              coachOverlays: Object.keys(next.coachMatchBreakdownArtifacts ?? {}).length,
              competitions: next.competitions.length,
            },
            persisted: true,
            idempotentNoop: false,
            failure: null,
            deletedAthleteId: athleteId,
            tokenSuffix: token.slice(-8),
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.log("[CANONICAL_RETIREMENT_WORKER]", {
            beforeAthleteIds: rec.athletes.map((athlete) => athlete.id),
            afterAthleteIds: next.athletes.map((athlete) => athlete.id),
            removedArtifactCounts: {
              roster: 1,
              weekly: _removedWeekly ? 1 : 0,
              trainingProof: _removedProof ? 1 : 0,
              competitionAggregates: _removedAggregate ? 1 : 0,
              competitionTopology: _removedTopology ? 1 : 0,
              coachOverlays: removedCoachOverlayCount,
              competitions: removedCompetitionCount,
            },
            retainedArtifactCounts: null,
            persisted: false,
            idempotentNoop: false,
            failure: err instanceof Error ? err.message : String(err),
            deletedAthleteId: athleteId,
            tokenSuffix: token.slice(-8),
            timestamp: new Date().toISOString(),
          });
          throw err;
        }
        return json({ ok: true }, 200);
      }

      const weeklyPut = path.match(/^\/v1\/sessions\/([^/]+)\/weekly$/);
      if (weeklyPut && request.method === "PUT") {
        const token = decodeURIComponent(weeklyPut[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) {
          return error("Unauthorized", 401);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON", 400);
        }
        const b = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
        const skIncomingPresent = Object.prototype.hasOwnProperty.call(b, "systemKey");
        const skParsedFromBody = parseOptionalSystemKey(b.systemKey);
        console.log("[SYSTEMKEY TRACE WORKER]", {
          traceStage: "3_worker_request_body_parse",
          headline: typeof b.headline === "string" ? b.headline.trim().slice(0, 120) : null,
          systemKeyRaw: skIncomingPresent ? b.systemKey : undefined,
          systemKeyParsed: skParsedFromBody ?? null,
          athleteId:
            typeof b.sharedAthleteId === "string" ? b.sharedAthleteId.trim() || null : null,
          weekStartYMD: typeof b.weekStartYMD === "string" ? b.weekStartYMD.trim() : null,
          keyExistsOnObject: skIncomingPresent,
          workerParserRemovedKey:
            skIncomingPresent &&
            typeof b.systemKey === "string" &&
            b.systemKey.trim().length > 0 &&
            !skParsedFromBody,
          source: "weekly_PUT_after_request_json",
        });
        const sharedAthleteIdRaw =
          typeof b.sharedAthleteId === "string" ? b.sharedAthleteId.trim() : "";

        const recEarly = await readSession(env.SESSIONS, token);
        if (!recEarly) {
          return error("Unauthorized", 401);
        }
        const isCoachWriterEarly = recEarly.writerSecret === secret;
        const isParentWriterEarly = Boolean(
          recEarly.parentWriterSecret && recEarly.parentWriterSecret === secret,
        );
        if (!isCoachWriterEarly && !isParentWriterEarly) {
          return error("Unauthorized", 401);
        }

        if (isParentWriterEarly && !isCoachWriterEarly) {
          const hasParentFeedbackKey = Object.prototype.hasOwnProperty.call(b, "parentFeedback");
          if (!hasParentFeedbackKey) {
            return error("parentFeedback required for parent weekly overlay", 400);
          }
          const parentFeedback = parseWeeklyParentFeedback(b.parentFeedback);
          if (!parentFeedback) {
            return error("parentFeedback invalid", 400);
          }
          const now = new Date().toISOString();
          if (sharedAthleteIdRaw) {
            if (sharedAthleteIdRaw.length > 64) {
              return error("sharedAthleteId invalid", 400);
            }
            if (!recEarly.athletes.some((a) => a.id === sharedAthleteIdRaw)) {
              return error("sharedAthleteId is not linked to this session", 400);
            }
            const existing = recEarly.weeklyByAthleteId[sharedAthleteIdRaw];
            if (!existing) {
              return error("No weekly doc for this athlete", 404);
            }
            const merged: WeeklyDoc = {
              ...existing,
              parentFeedback: {
                ...(existing.parentFeedback ?? {}),
                ...parentFeedback,
              },
              updatedAt: now,
            };
            const next: SessionRecord = {
              ...recEarly,
              weeklyByAthleteId: {
                ...(recEarly.weeklyByAthleteId || {}),
                [sharedAthleteIdRaw]: merged,
              },
            };
            await writeSession(env.SESSIONS, token, next);
            return json({ ok: true }, 200);
          }
          if (!recEarly.weekly) {
            return error("No invite weekly doc", 404);
          }
          const mergedInvite: WeeklyDoc = {
            ...recEarly.weekly,
            parentFeedback: {
              ...(recEarly.weekly.parentFeedback ?? {}),
              ...parentFeedback,
            },
            updatedAt: now,
          };
          const nextInvite: SessionRecord = { ...recEarly, weekly: mergedInvite };
          await writeSession(env.SESSIONS, token, nextInvite);
          return json({ ok: true }, 200);
        }

        const weekStartYMD = typeof b.weekStartYMD === "string" ? b.weekStartYMD.trim() : "";
        const headline = typeof b.headline === "string" ? b.headline.trim() : "";
        const bodyText = typeof b.body === "string" ? b.body.trim() : "";
        const classLine =
          typeof b.classLine === "string" && b.classLine.trim() ? b.classLine.trim().slice(0, 500) : undefined;
        const programLine =
          typeof b.programLine === "string" && b.programLine.trim()
            ? b.programLine.trim().slice(0, 500)
            : undefined;
        const missionIn = readMissionUrlFromWeeklyPutBody(b);
        const missionResourceUrl = parseOptionalPublishedUrl(missionIn.raw);
        const hasMissionResourceLabelKey = Object.prototype.hasOwnProperty.call(b, "missionResourceLabel");
        const missionResourceLabel =
          hasMissionResourceLabelKey &&
          typeof b.missionResourceLabel === "string" &&
          b.missionResourceLabel.trim()
            ? b.missionResourceLabel.trim().slice(0, 120)
            : undefined;
        const familyIn = readFamilyUrlFromWeeklyPutBody(b);
        const familyResourceUrl = parseOptionalPublishedUrl(familyIn.raw);
        const hasFamilyResourceLabelKey = Object.prototype.hasOwnProperty.call(b, "familyResourceLabel");
        const familyResourceLabel =
          hasFamilyResourceLabelKey &&
          typeof b.familyResourceLabel === "string" &&
          b.familyResourceLabel.trim()
            ? b.familyResourceLabel.trim().slice(0, 120)
            : undefined;
        const hasCoachOutcomeKey = Object.prototype.hasOwnProperty.call(b, "coachOutcome");
        const coachOutcome =
          typeof b.coachOutcome === "string" && COACH_OUTCOME_SET.has(b.coachOutcome as CoachOutcome)
            ? (b.coachOutcome as CoachOutcome)
            : undefined;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartYMD)) {
          return error("weekStartYMD must be YYYY-MM-DD", 400);
        }
        if (!headline || headline.length > 200) {
          return error("headline required (max 200 chars)", 400);
        }
        if (bodyText.length > 8000) {
          return error("body too long (max 8000 chars)", 400);
        }
        if (
          hasCoachOutcomeKey &&
          b.coachOutcome != null &&
          b.coachOutcome !== "" &&
          !coachOutcome
        ) {
          return error("coachOutcome invalid", 400);
        }

        const rec = recEarly;
        if (!isCoachWriterEarly) {
          return error("Unauthorized", 401);
        }

        if (sharedAthleteIdRaw) {
          if (sharedAthleteIdRaw.length > 64) {
            return error("sharedAthleteId invalid", 400);
          }
          if (!rec.athletes.some((a) => a.id === sharedAthleteIdRaw)) {
            return error("sharedAthleteId is not linked to this session", 400);
          }
        }

        const hasFamilyCoachRecapKey = Object.prototype.hasOwnProperty.call(
          b,
          "familyCoachRecapNote",
        );
        let familyCoachRecapNote: string | undefined;
        if (hasFamilyCoachRecapKey) {
          familyCoachRecapNote =
            typeof b.familyCoachRecapNote === "string" && b.familyCoachRecapNote.trim()
              ? b.familyCoachRecapNote.trim().slice(0, 2000)
              : undefined;
        } else {
          // If the coach omits this field entirely, treat it as "cleared" for the week.
          // This aligns with our publish behavior: weekly PUT is a full snapshot for that week.
          familyCoachRecapNote = undefined;
        }

        const now = new Date().toISOString();
        const weeklyFromPut: WeeklyDoc = {
          weekStartYMD,
          headline,
          body: bodyText,
          ...(classLine ? { classLine } : {}),
          ...(programLine ? { programLine } : {}),
          ...(familyCoachRecapNote ? { familyCoachRecapNote } : {}),
          ...(coachOutcome ? { coachOutcome } : {}),
          updatedAt: now,
        };
        if (missionIn.hasInBody) {
          if (missionResourceUrl !== undefined) {
            weeklyFromPut.missionResourceUrl = missionResourceUrl;
            if (hasMissionResourceLabelKey) {
              weeklyFromPut.missionResourceLabel = missionResourceLabel ?? null;
            }
          } else {
            console.log("[WORKER WARNING] missionResourceUrl rejected but existing value preserved", {
              weekStartYMD,
              sharedAthleteId: sharedAthleteIdRaw || null,
            });
          }
        }
        if (familyIn.hasInBody) {
          if (familyResourceUrl !== undefined) {
            weeklyFromPut.familyResourceUrl = familyResourceUrl;
            if (hasFamilyResourceLabelKey) {
              weeklyFromPut.familyResourceLabel = familyResourceLabel ?? null;
            }
          } else {
            console.log("[WORKER WARNING] familyResourceUrl rejected but existing value preserved", {
              weekStartYMD,
              sharedAthleteId: sharedAthleteIdRaw || null,
            });
          }
        }

        const existingWeeklyForMerge: Partial<WeeklyDoc> | null =
          sharedAthleteIdRaw
            ? (rec.weeklyByAthleteId[sharedAthleteIdRaw] ?? null)
            : (rec.weekly ?? null);

        const hasSystemKeyKey = Object.prototype.hasOwnProperty.call(b, "systemKey");
        const projectedMergedSystemKey = hasSystemKeyKey
          ? parseOptionalSystemKey(b.systemKey)
          : existingWeeklyForMerge?.systemKey;
        const ackResetChangedFieldsPreMerge = weeklyMaterialFieldsChanged(
          existingWeeklyForMerge,
          {
            headline: weeklyFromPut.headline,
            body: weeklyFromPut.body,
            weekStartYMD: weeklyFromPut.weekStartYMD,
            systemKey: projectedMergedSystemKey,
          },
          { systemKeyInPut: hasSystemKeyKey },
        );
        console.log("[WEEKLY_ACK_COMPARE]", {
          existingHeadline: existingWeeklyForMerge?.headline,
          incomingHeadline: weeklyFromPut.headline,
          mergedHeadline: weeklyFromPut.headline,

          existingBody: existingWeeklyForMerge?.body,
          incomingBody: weeklyFromPut.body,

          existingSystemKey: existingWeeklyForMerge?.systemKey,
          incomingSystemKey: hasSystemKeyKey ? parseOptionalSystemKey(b.systemKey) : undefined,

          existingUpdatedAt: existingWeeklyForMerge?.updatedAt,
          incomingUpdatedAt: weeklyFromPut.updatedAt,

          hasParentFeedback: Boolean(existingWeeklyForMerge?.parentFeedback),

          existingParentFeedback: existingWeeklyForMerge?.parentFeedback,

          changedFields: ackResetChangedFieldsPreMerge,
        });

        const mergedWeekly: WeeklyDoc = {
          ...existingWeeklySansParentFeedback(existingWeeklyForMerge),
          ...omitUndefinedShallow(weeklyFromPut as Record<string, unknown>),
          // Required WeeklyDoc fields must remain definite after Partial spreads.
          weekStartYMD: weeklyFromPut.weekStartYMD,
          headline: weeklyFromPut.headline,
          body: weeklyFromPut.body,
          updatedAt: now,
        };
        if (hasFamilyCoachRecapKey) {
          if (familyCoachRecapNote) {
            mergedWeekly.familyCoachRecapNote = familyCoachRecapNote;
          } else {
            delete mergedWeekly.familyCoachRecapNote;
          }
        } else {
          delete mergedWeekly.familyCoachRecapNote;
        }
        if (coachOutcome) {
          mergedWeekly.coachOutcome = coachOutcome;
        } else {
          delete mergedWeekly.coachOutcome;
        }

        if (hasSystemKeyKey) {
          const sk = parseOptionalSystemKey(b.systemKey);
          if (sk) {
            mergedWeekly.systemKey = sk;
          } else {
            delete mergedWeekly.systemKey;
          }
          console.log("[coach-sync-weekly-put systemKey]", {
            weekStartYMD,
            sharedAthleteId: sharedAthleteIdRaw || null,
            incomingPresent: hasSystemKeyKey,
            storedSystemKey: mergedWeekly.systemKey ?? null,
          });
        }

        console.log("[SYSTEMKEY TRACE WORKER]", {
          traceStage: "4_worker_merged_weekly_pre_kv_write",
          headline: mergedWeekly.headline?.slice(0, 120) ?? null,
          systemKey: mergedWeekly.systemKey ?? null,
          athleteId: sharedAthleteIdRaw || null,
          weekStartYMD: mergedWeekly.weekStartYMD,
          keyExistsOnObject: Object.prototype.hasOwnProperty.call(mergedWeekly, "systemKey"),
          incomingPutHadSystemKeyKey: hasSystemKeyKey,
          putOmittedSystemKeyKeyKeepsPriorKvMerge:
            !hasSystemKeyKey &&
            Object.prototype.hasOwnProperty.call(mergedWeekly, "systemKey"),
          mergedUsedParseOptionalSystemKey: hasSystemKeyKey
            ? parseOptionalSystemKey(b.systemKey) ?? null
            : null,
          source: "weekly_PUT_mergedWeekly",
        });

        const ackResetChangedFields = weeklyMaterialFieldsChanged(
          existingWeeklyForMerge,
          {
            headline: weeklyFromPut.headline,
            body: weeklyFromPut.body,
            weekStartYMD: weeklyFromPut.weekStartYMD,
            systemKey: mergedWeekly.systemKey,
          },
          { systemKeyInPut: hasSystemKeyKey },
        );
        const hadParentFeedbackOnExisting = Boolean(existingWeeklyForMerge?.parentFeedback);
        delete mergedWeekly.parentFeedback;
        console.log("[WEEKLY_ACK_RESET]", {
          sharedAthleteId: sharedAthleteIdRaw || null,
          changedFields: ackResetChangedFields,
          hadParentFeedbackOnExisting,
          resolvedParentFeedback: mergedWeekly.parentFeedback ?? null,
          resolvedHasParentFeedbackKey: Object.prototype.hasOwnProperty.call(
            mergedWeekly,
            "parentFeedback",
          ),
        });

        console.log("[WORKER FINAL WRITE]", mergedWeekly);
        logWeeklyCorruptionTrace("put_merged_weekly_pre_kv", {
          tokenSuffix: token.slice(-8),
          sharedAthleteId: sharedAthleteIdRaw || null,
          mergedProbe: probeWeeklyDoc(mergedWeekly),
          existingProbe: existingWeeklyForMerge ? probeWeeklyRaw(existingWeeklyForMerge) : null,
          putBodyProbe: probeWeeklyRaw(weeklyFromPut),
          mergeFieldLossFromExisting: existingWeeklyForMerge
            ? diffWeeklyFieldLoss(probeWeeklyRaw(existingWeeklyForMerge), probeWeeklyDoc(mergedWeekly))
            : [],
        });

        // Targeted debug to diagnose "clear doesn't propagate" for Card 2.
        // Logs only when coach sent empty or omitted the recap field.
        if (
          !hasFamilyCoachRecapKey ||
          (typeof b.familyCoachRecapNote === "string" && !b.familyCoachRecapNote.trim())
        ) {
          const prevRecapRaw = sharedAthleteIdRaw
            ? rec.weeklyByAthleteId[sharedAthleteIdRaw]?.familyCoachRecapNote
            : rec.weekly?.familyCoachRecapNote;
          const storedHasKey = Object.prototype.hasOwnProperty.call(mergedWeekly, "familyCoachRecapNote");
          const finalRecap = mergedWeekly.familyCoachRecapNote;
          console.log("[coach-sync-weekly-put familyCoachRecapNote]", {
            hasFamilyCoachRecapKey,
            incomingRecapLen:
              typeof b.familyCoachRecapNote === "string" ? b.familyCoachRecapNote.length : null,
            prevRecapLen: typeof prevRecapRaw === "string" ? prevRecapRaw.length : null,
            storedRecapLen: typeof finalRecap === "string" ? finalRecap.length : 0,
            storedHasKey,
            weekStartYMD,
            sharedAthleteId: sharedAthleteIdRaw || null,
          });
        }

        const next: SessionRecord = sharedAthleteIdRaw
          ? {
              ...rec,
              weeklyByAthleteId: {
                ...(rec.weeklyByAthleteId || {}),
                [sharedAthleteIdRaw]: mergedWeekly,
              },
            }
          : { ...rec, weekly: mergedWeekly };
        await writeSession(env.SESSIONS, token, next);

        return json({ ok: true }, 200);
      }

      const competitionsPost = path.match(/^\/v1\/sessions\/([^/]+)\/competitions$/);
      if (competitionsPost && request.method === "POST") {
        const token = decodeURIComponent(competitionsPost[1] ?? "").trim().toLowerCase();
        const dbgFail = (msg: string, status: number): Response => {
          console.log("[coach-sync-debug] competitions POST", { tokenEnd: token.slice(-8), msg, status });
          return error(msg, status);
        };
        if (!TOKEN_RE.test(token)) {
          return dbgFail("Invalid token", 400);
        }
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) return dbgFail("Unauthorized", 401);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return dbgFail("Invalid JSON", 400);
        }
        const b = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
        const sharedAthleteId = typeof b.sharedAthleteId === "string" ? b.sharedAthleteId.trim() : "";
        const tournamentName = typeof b.tournamentName === "string" ? b.tournamentName.trim().slice(0, 160) : "";
        const eventDate = typeof b.eventDate === "string" ? b.eventDate.trim() : "";
        const resultRaw = typeof b.result === "string" ? b.result.trim() : undefined;
        const eventStatusRaw = typeof b.eventStatus === "string" ? b.eventStatus.trim() : undefined;
        const formatRaw = typeof b.format === "string" ? b.format.trim() : undefined;
        const organizationRaw =
          typeof b.organizationOrPromoter === "string" ? b.organizationOrPromoter.trim().slice(0, 160) : "";

        if (!sharedAthleteId || !tournamentName || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
          return dbgFail("sharedAthleteId, tournamentName, and eventDate (YYYY-MM-DD) are required", 400);
        }
        const result = resultRaw && RESULT_SET.has(resultRaw as CompetitionResult) ? (resultRaw as CompetitionResult) : undefined;
        const eventStatus =
          eventStatusRaw && EVENT_STATUS_SET.has(eventStatusRaw as CompetitionEventStatus)
            ? (eventStatusRaw as CompetitionEventStatus)
            : undefined;
        const format = formatRaw && FORMAT_SET.has(formatRaw as CompetitionFormat) ? (formatRaw as CompetitionFormat) : undefined;
        if (resultRaw && !result) return dbgFail("Invalid result", 400);
        if (eventStatusRaw && !eventStatus) return dbgFail("Invalid eventStatus", 400);
        if (formatRaw && !format) return dbgFail("Invalid format", 400);

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) return dbgFail("Unauthorized", 401);
        if (!rec.athletes.some((a) => a.id === sharedAthleteId)) {
          return dbgFail("sharedAthleteId is not linked to this session", 400);
        }
        if (rec.competitions.length >= MAX_COMPETITIONS_PER_SESSION) {
          return dbgFail("Competition limit reached for this invite", 400);
        }

        const now = new Date().toISOString();
        const competition: SharedCompetition = {
          id: `shared_comp_${randomHex(16)}`,
          sharedAthleteId,
          tournamentName,
          eventDate,
          ...(result ? { result } : {}),
          ...(eventStatus ? { eventStatus } : {}),
          ...(format ? { format } : {}),
          ...(organizationRaw ? { organizationOrPromoter: organizationRaw } : {}),
          createdAt: now,
          updatedAt: now,
        };
        const next: SessionRecord = {
          ...rec,
          competitions: [...rec.competitions, competition],
        };
        await writeSession(env.SESSIONS, token, next);
        return competitionPersistResponse({ competition }, 201, {
          before: rec,
          after: next,
          sharedAthleteId,
          persistLane: "shell_post",
          request,
          linkTokenTail: token.slice(-8),
        });
      }

      const competitionsPut = path.match(/^\/v1\/sessions\/([^/]+)\/competitions\/([^/]+)$/);
      if (competitionsPut && request.method === "PUT") {
        const token = decodeURIComponent(competitionsPut[1] ?? "").trim().toLowerCase();
        const competitionId = decodeURIComponent(competitionsPut[2] ?? "").trim();
        if (!TOKEN_RE.test(token) || !competitionId) return error("Invalid token", 400);
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) return error("Unauthorized", 401);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON", 400);
        }
        const b = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
        const hasTournamentName = Object.prototype.hasOwnProperty.call(b, "tournamentName");
        const hasEventDate = Object.prototype.hasOwnProperty.call(b, "eventDate");
        const hasResult = Object.prototype.hasOwnProperty.call(b, "result");
        const hasEventStatus = Object.prototype.hasOwnProperty.call(b, "eventStatus");
        const hasFormat = Object.prototype.hasOwnProperty.call(b, "format");
        const hasOrganization = Object.prototype.hasOwnProperty.call(b, "organizationOrPromoter");

        const tournamentName = hasTournamentName && typeof b.tournamentName === "string" ? b.tournamentName.trim().slice(0, 160) : undefined;
        const eventDate = hasEventDate && typeof b.eventDate === "string" ? b.eventDate.trim() : undefined;
        if (hasTournamentName && !tournamentName) return error("tournamentName cannot be empty", 400);
        if (hasEventDate && (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate))) {
          return error("eventDate must be YYYY-MM-DD", 400);
        }

        const resultRaw = hasResult ? b.result : undefined;
        const eventStatusRaw = hasEventStatus ? b.eventStatus : undefined;
        const formatRaw = hasFormat ? b.format : undefined;
        const result =
          typeof resultRaw === "string" && RESULT_SET.has(resultRaw as CompetitionResult)
            ? (resultRaw as CompetitionResult)
            : undefined;
        const eventStatus =
          typeof eventStatusRaw === "string" && EVENT_STATUS_SET.has(eventStatusRaw as CompetitionEventStatus)
            ? (eventStatusRaw as CompetitionEventStatus)
            : undefined;
        const format =
          typeof formatRaw === "string" && FORMAT_SET.has(formatRaw as CompetitionFormat)
            ? (formatRaw as CompetitionFormat)
            : undefined;
        if (hasResult && resultRaw !== undefined && resultRaw !== null && !result) return error("Invalid result", 400);
        if (hasEventStatus && eventStatusRaw !== undefined && eventStatusRaw !== null && !eventStatus) return error("Invalid eventStatus", 400);
        if (hasFormat && formatRaw !== undefined && formatRaw !== null && !format) return error("Invalid format", 400);
        const organization =
          hasOrganization && typeof b.organizationOrPromoter === "string"
            ? b.organizationOrPromoter.trim().slice(0, 160)
            : undefined;

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) return error("Unauthorized", 401);
        const idx = rec.competitions.findIndex((c) => c.id === competitionId);
        if (idx === -1) return error("Not found", 404);

        const current = rec.competitions[idx]!;
        const nextComp: SharedCompetition = {
          ...current,
          ...(hasTournamentName ? { tournamentName } : {}),
          ...(hasEventDate ? { eventDate } : {}),
          ...(hasResult ? { result: result ?? undefined } : {}),
          ...(hasEventStatus ? { eventStatus: eventStatus ?? undefined } : {}),
          ...(hasFormat ? { format: format ?? undefined } : {}),
          ...(hasOrganization ? { organizationOrPromoter: organization || undefined } : {}),
          updatedAt: new Date().toISOString(),
        };
        const nextComps = rec.competitions.slice();
        nextComps[idx] = nextComp;
        const next: SessionRecord = { ...rec, competitions: nextComps };
        await writeSession(env.SESSIONS, token, next);
        return competitionPersistResponse({ ok: true }, 200, {
          before: rec,
          after: next,
          sharedAthleteId: current.sharedAthleteId,
          persistLane: "shell_put",
          request,
          linkTokenTail: token.slice(-8),
        });
      }

      const competitionsDelete = path.match(/^\/v1\/sessions\/([^/]+)\/competitions\/([^/]+)$/);
      if (competitionsDelete && request.method === "DELETE") {
        const token = decodeURIComponent(competitionsDelete[1] ?? "").trim().toLowerCase();
        const competitionId = decodeURIComponent(competitionsDelete[2] ?? "").trim();
        if (!TOKEN_RE.test(token) || !competitionId) return error("Invalid token", 400);
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) return error("Unauthorized", 401);

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) return error("Unauthorized", 401);
        const deleted = rec.competitions.find((c) => c.id === competitionId);
        if (!deleted) return error("Not found", 404);

        const next: SessionRecord = {
          ...rec,
          competitions: rec.competitions.filter((c) => c.id !== competitionId),
        };
        await writeSession(env.SESSIONS, token, next);
        return competitionPersistResponse({ ok: true }, 200, {
          before: rec,
          after: next,
          sharedAthleteId: deleted.sharedAthleteId,
          persistLane: "shell_delete",
          request,
          linkTokenTail: token.slice(-8),
        });
      }

      const coachMatchBreakdownsPut = path.match(
        /^\/v1\/sessions\/([^/]+)\/coach-match-breakdowns$/,
      );
      if (coachMatchBreakdownsPut && request.method === "PUT") {
        console.log("[WORKER_RUNTIME_TRACE]", {
          stage: "put_route_enter",
          url: request.url,
          method: request.method,
          runtimeVersion: WORKER_RUNTIME_VERSION,
        });
        const token = decodeURIComponent(coachMatchBreakdownsPut[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const overlayForensicTraceId =
          request.headers.get(OVERLAY_FORENSIC_TRACE_HEADER)?.trim().slice(0, 160) || null;
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) return error("Unauthorized", 401);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON", 400);
        }

        const artifactSet = parseCoachMatchBreakdownArtifactSet(body);
        if (!artifactSet) {
          console.log("[COACH_OVERLAY_SYNC_TRACE]", {
            stage: "worker_coach_overlay_reject_invalid_payload",
            tokenSuffix: token.slice(-8),
          });
          return error("Invalid coach match breakdown artifact set", 400);
        }
        console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
          stage: "worker_put_received",
          sharedAthleteId: artifactSet.sharedAthleteId,
          sharedCompetitionId: artifactSet.artifacts[0]?.sharedCompetitionId ?? null,
          matchLineageKey: artifactSet.artifacts[0]?.matchLineageKey ?? null,
          overlayCount: artifactSet.artifacts.length,
          artifacts: artifactSet.artifacts.map((artifact) => ({
            sharedAthleteId: artifact.sharedAthleteId,
            sharedCompetitionId: artifact.sharedCompetitionId,
            matchLineageKey: artifact.matchLineageKey,
            hasCoachNote: Boolean(artifact.coachNote?.trim()),
          })),
          tokenSuffix: token.slice(-8),
        });

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.writerSecret !== secret) {
          return error("Unauthorized", 401);
        }
        if (!rec.athletes.some((a) => a.id.trim() === artifactSet.sharedAthleteId)) {
          console.log("[COACH_OVERLAY_SYNC_TRACE]", {
            stage: "worker_coach_overlay_reject_athlete_scope",
            tokenSuffix: token.slice(-8),
            sharedAthleteId: artifactSet.sharedAthleteId,
          });
          return error("sharedAthleteId is not linked to this session", 400);
        }

        const existing = rec.coachMatchBreakdownArtifacts[artifactSet.sharedAthleteId];
        const existingKvArtifactCount =
          existing?.artifacts.length ?? 0;
        logMatchBreakdownAuthorityTrace("WORKER_PUT_RECEIVED", {
          traceId: overlayForensicTraceId,
          sharedAthleteId: artifactSet.sharedAthleteId,
          sharedCompetitionId: artifactSet.artifacts[0]?.sharedCompetitionId ?? null,
          matchLineageKey: artifactSet.artifacts[0]?.matchLineageKey ?? null,
          inviteTokenSuffix: inviteTokenSuffixForAuthorityTrace(token),
          artifactCount: artifactSet.artifacts.length,
          updatedAt: artifactSet.updatedAt,
          existingKvArtifactCount,
          newKvArtifactCount: artifactSet.artifacts.length,
        });
        if (existing && artifactSet.updatedAt.localeCompare(existing.updatedAt) < 0) {
          console.log("[COACH_OVERLAY_SYNC_TRACE]", {
            stage: "worker_coach_overlay_reject_stale",
            tokenSuffix: token.slice(-8),
            sharedAthleteId: artifactSet.sharedAthleteId,
            incomingUpdatedAt: artifactSet.updatedAt,
            existingUpdatedAt: existing.updatedAt,
            artifactCount: artifactSet.artifacts.length,
          });
          return error("Coach match breakdown artifact set is stale", 409);
        }
        if (
          existing &&
          artifactSet.updatedAt === existing.updatedAt &&
          JSON.stringify(artifactSet) !== JSON.stringify(existing)
        ) {
          console.log("[COACH_OVERLAY_SYNC_TRACE]", {
            stage: "worker_coach_overlay_reject_equal_timestamp_conflict",
            tokenSuffix: token.slice(-8),
            sharedAthleteId: artifactSet.sharedAthleteId,
            updatedAt: artifactSet.updatedAt,
          });
          return error("Coach match breakdown artifact timestamp conflict", 409);
        }

        const next: SessionRecord = {
          ...rec,
          coachMatchBreakdownArtifacts: {
            ...(rec.coachMatchBreakdownArtifacts || {}),
            [artifactSet.sharedAthleteId]: artifactSet,
          },
        };
        console.log("[COACH_OVERLAY_SYNC_TRACE]", {
          stage: "worker_coach_overlay_store_ok",
          tokenSuffix: token.slice(-8),
          sharedAthleteId: artifactSet.sharedAthleteId,
          artifactCount: artifactSet.artifacts.length,
          sharedCompetitionIds: [
            ...new Set(artifactSet.artifacts.map((artifact) => artifact.sharedCompetitionId)),
          ],
          lineageIds: artifactSet.artifacts.map((artifact) => artifact.matchLineageKey),
          updatedAt: artifactSet.updatedAt,
          writeMode: existing ? "newer_or_equal_overwrite" : "first_write",
        });
        console.log("[OVERLAY_FORENSIC]", {
          stage: "worker_store_artifact_set",
          traceId: overlayForensicTraceId,
          timestamp: new Date().toISOString(),
          sourceFile: "coach-sync-worker/src/index.ts",
          tokenSuffix: token.slice(-8),
          sharedAthleteId: artifactSet.sharedAthleteId,
          sharedCompetitionId: artifactSet.artifacts[0]?.sharedCompetitionId ?? null,
          matchLineageKey: artifactSet.artifacts[0]?.matchLineageKey ?? null,
          artifactCount: artifactSet.artifacts.length,
          updatedAt: artifactSet.updatedAt,
        });
        await writeSession(env.SESSIONS, token, next);
        const selfGetRec = await readSession(env.SESSIONS, token);
        const selfGetArtifactCount = selfGetRec
          ? coachMatchBreakdownArtifactCountForAthlete(
              selfGetRec.coachMatchBreakdownArtifacts,
              artifactSet.sharedAthleteId,
            )
          : 0;
        logMatchBreakdownAuthorityTrace("WORKER_SESSION_SELF_GET", {
          traceId: overlayForensicTraceId,
          sharedAthleteId: artifactSet.sharedAthleteId,
          inviteTokenSuffix: inviteTokenSuffixForAuthorityTrace(token),
          artifactCountReturned: selfGetArtifactCount,
          aggregateCount: Object.keys(selfGetRec?.competitionAggregateByAthleteId ?? {}).length,
          topologyCount: Object.keys(selfGetRec?.competitionTopologyByAthleteId ?? {}).length,
        });
        console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
          stage: "worker_put_persisted",
          sharedAthleteId: artifactSet.sharedAthleteId,
          sharedCompetitionId: artifactSet.artifacts[0]?.sharedCompetitionId ?? null,
          matchLineageKey: artifactSet.artifacts[0]?.matchLineageKey ?? null,
          overlayCount: artifactSet.artifacts.length,
          artifacts: artifactSet.artifacts.map((artifact) => ({
            sharedAthleteId: artifact.sharedAthleteId,
            sharedCompetitionId: artifact.sharedCompetitionId,
            matchLineageKey: artifact.matchLineageKey,
            hasCoachNote: Boolean(artifact.coachNote?.trim()),
          })),
          tokenSuffix: token.slice(-8),
        });
        return json({ ok: true }, 200);
      }

      const competitionTopologyPut = path.match(
        /^\/v1\/sessions\/([^/]+)\/competition-topology$/,
      );
      if (competitionTopologyPut && request.method === "PUT") {
        const competitionTopologyTraceId =
          request.headers.get("X-Competition-Topology-Trace-Id")?.trim().slice(0, 160) || null;
        const token = decodeURIComponent(competitionTopologyPut[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) return error("Unauthorized", 401);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON", 400);
        }

        const artifact = parseCompetitionTopologyArtifact(body);
        if (!artifact) {
          console.log("[COMP_TOPOLOGY_TRACE] worker_reject_invalid_payload", {
            ...(competitionTopologyTraceId ? { traceId: competitionTopologyTraceId } : {}),
            tokenSuffix: token.slice(-8),
          });
          return error("Invalid competition topology artifact", 400);
        }
        if (competitionTopologyTraceId) {
          console.log("[COMP_TOPOLOGY_TRACE] worker_request_received", {
            ...(competitionTopologyTraceId ? { traceId: competitionTopologyTraceId } : {}),
            tokenSuffix: token.slice(-8),
            sharedAthleteId: artifact.sharedAthleteId,
            competitionCount: artifact.competitions.length,
            totalMatches: artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0),
            totalMatchCount: artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0),
            lineageKeyCount: artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0),
            updatedAt: artifact.updatedAt,
            incomingUpdatedAt: artifact.updatedAt,
            existingUpdatedAt: null,
            timestamp: new Date().toISOString(),
          });
        }

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) {
          return error("Unauthorized", 401);
        }
        if (!rec.athletes.some((a) => a.id.trim() === artifact.sharedAthleteId)) {
          console.log("[COMP_TOPOLOGY_TRACE] worker_reject_athlete_scope", {
            tokenSuffix: token.slice(-8),
            sharedAthleteId: artifact.sharedAthleteId,
            ...(competitionTopologyTraceId ? { traceId: competitionTopologyTraceId } : {}),
          });
          return error("sharedAthleteId is not linked to this session", 400);
        }

        const existing = rec.competitionTopologyByAthleteId[artifact.sharedAthleteId];
        if (existing && artifact.updatedAt.localeCompare(existing.updatedAt) < 0) {
          const totalMatchCount = artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0);
          logCoachTopologyMatchTrace("worker_put_topology", artifact, {
            incomingUpdatedAt: artifact.updatedAt,
            existingUpdatedAt: existing.updatedAt,
            accepted: false,
            overwriteReason: "incoming_older_rejected",
          });
          console.log("[COMP_TOPOLOGY_TRACE] worker_reject_stale", {
            tokenSuffix: token.slice(-8),
            sharedAthleteId: artifact.sharedAthleteId,
            incomingUpdatedAt: artifact.updatedAt,
            existingUpdatedAt: existing.updatedAt,
            totalMatchCount,
            ...(competitionTopologyTraceId ? { traceId: competitionTopologyTraceId } : {}),
          });
          return error("Competition topology artifact is stale", 409);
        }
        if (
          existing &&
          artifact.updatedAt === existing.updatedAt &&
          JSON.stringify(artifact) !== JSON.stringify(existing)
        ) {
          const totalMatchCount = artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0);
          logCoachTopologyMatchTrace("worker_put_topology", artifact, {
            incomingUpdatedAt: artifact.updatedAt,
            existingUpdatedAt: existing.updatedAt,
            accepted: false,
            overwriteReason: "equal_timestamp_conflict_rejected",
          });
          console.log("[COMP_TOPOLOGY_TRACE] worker_reject_equal_timestamp_conflict", {
            tokenSuffix: token.slice(-8),
            sharedAthleteId: artifact.sharedAthleteId,
            updatedAt: artifact.updatedAt,
            incomingUpdatedAt: artifact.updatedAt,
            existingUpdatedAt: existing.updatedAt,
            totalMatchCount,
            ...(competitionTopologyTraceId ? { traceId: competitionTopologyTraceId } : {}),
          });
          return error("Competition topology timestamp conflict", 409);
        }
        if (existing && JSON.stringify(artifact) === JSON.stringify(existing)) {
          const totalMatchCount = artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0);
          logCoachTopologyMatchTrace("worker_put_topology", artifact, {
            incomingUpdatedAt: artifact.updatedAt,
            existingUpdatedAt: existing.updatedAt,
            accepted: true,
            overwriteReason: "idempotent_replay",
          });
          console.log("[COMP_TOPOLOGY_TRACE] worker_store_ok", {
            tokenSuffix: token.slice(-8),
            sharedAthleteId: artifact.sharedAthleteId,
            competitionCount: artifact.competitions.length,
            totalMatches: artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0),
            totalMatchCount,
            updatedAt: artifact.updatedAt,
            incomingUpdatedAt: artifact.updatedAt,
            existingUpdatedAt: existing.updatedAt,
            writeMode: "idempotent_replay",
            traceId: competitionTopologyTraceId,
          });
          return json({ ok: true }, 200);
        }

        const next: SessionRecord = {
          ...rec,
          competitionTopologyByAthleteId: {
            ...(rec.competitionTopologyByAthleteId || {}),
            [artifact.sharedAthleteId]: artifact,
          },
        };
        const totalMatchCount = artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0);
        console.log("[COMP_TOPOLOGY_TRACE] worker_store_ok", {
          tokenSuffix: token.slice(-8),
          sharedAthleteId: artifact.sharedAthleteId,
          competitionCount: artifact.competitions.length,
          totalMatches: artifact.competitions.reduce((sum, c) => sum + c.matches.length, 0),
          totalMatchCount,
          updatedAt: artifact.updatedAt,
          incomingUpdatedAt: artifact.updatedAt,
          existingUpdatedAt: existing?.updatedAt ?? null,
          writeMode: existing ? "newer_overwrite" : "first_write",
          ...(competitionTopologyTraceId ? { traceId: competitionTopologyTraceId } : {}),
        });
        logCoachTopologyMatchTrace("worker_put_topology", artifact, {
          incomingUpdatedAt: artifact.updatedAt,
          existingUpdatedAt: existing?.updatedAt ?? null,
          accepted: true,
          overwriteReason: existing ? "newer_overwrite" : "first_write",
        });
        await writeSession(env.SESSIONS, token, next);
        return competitionPersistResponse({ ok: true }, 200, {
          before: rec,
          after: next,
          sharedAthleteId: artifact.sharedAthleteId,
          persistLane: "topology_put",
          request,
          linkTokenTail: token.slice(-8),
        });
      }

      if (path.endsWith("/competition-topology") && request.method === "PUT") {
        console.log("[COMP_TOPOLOGY_TRACE] worker_route_miss", {
          path,
          method: request.method,
        });
      }

      const competitionAggregatePut = path.match(
        /^\/v1\/sessions\/([^/]+)\/competition-aggregate$/,
      );
      if (competitionAggregatePut && request.method === "PUT") {
        const token = decodeURIComponent(competitionAggregatePut[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) return error("Unauthorized", 401);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON", 400);
        }

        const artifact = parseCompetitionAggregateArtifact(body);
        if (!artifact) {
          return error("Invalid competition aggregate artifact", 400);
        }

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) {
          return error("Unauthorized", 401);
        }
        if (!rec.athletes.some((a) => a.id.trim() === artifact.sharedAthleteId)) {
          return error("sharedAthleteId is not linked to this session", 400);
        }

        const next: SessionRecord = {
          ...rec,
          competitionAggregateByAthleteId: {
            ...(rec.competitionAggregateByAthleteId || {}),
            [artifact.sharedAthleteId]: artifact,
          },
        };
        console.log("[COMP_AGGREGATE_TRACE]", {
          stage: "worker_put_competition_aggregate",
          tokenSuffix: token.slice(-8),
          sharedAthleteId: artifact.sharedAthleteId,
          updatedAt: artifact.updatedAt,
          totalCompetitions: artifact.totalCompetitions,
          totalMatches: artifact.totalMatches,
          wins: artifact.wins,
          losses: artifact.losses,
          submissionRate: artifact.submissionRate,
          fastestSubmission: artifact.fastestSubmissionSeconds,
        });
        console.log("[COMP_AGG_TRACE] worker_put_competition_aggregate", {
          tokenSuffix: token.slice(-8),
          kvKey: `s:${token}`,
          sharedAthleteId: artifact.sharedAthleteId,
          totalMatches: artifact.totalMatches,
        });
        await writeSession(env.SESSIONS, token, next);
        return competitionPersistResponse({ ok: true }, 200, {
          before: rec,
          after: next,
          sharedAthleteId: artifact.sharedAthleteId,
          persistLane: "aggregate_put",
          request,
          linkTokenTail: token.slice(-8),
        });
      }

      if (path.endsWith("/competition-aggregate") && request.method === "PUT") {
        console.log("[COMP_AGG_TRACE] worker_route_miss_competition_aggregate", {
          path,
          method: request.method,
        });
      }

      const trainingProofPut = path.match(/^\/v1\/sessions\/([^/]+)\/training-proof$/);
      if (trainingProofPut && request.method === "PUT") {
        const token = decodeURIComponent(trainingProofPut[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) return error("Unauthorized", 401);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON", 400);
        }

        const artifact = parseTrainingProofArtifact(body);
        if (!artifact) {
          return error("Invalid training proof artifact", 400);
        }

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) {
          return error("Unauthorized", 401);
        }
        if (!rec.athletes.some((a) => a.id.trim() === artifact.sharedAthleteId)) {
          return error("sharedAthleteId is not linked to this session", 400);
        }

        const next: SessionRecord = {
          ...rec,
          trainingProofByAthleteId: {
            ...(rec.trainingProofByAthleteId || {}),
            [artifact.sharedAthleteId]: artifact,
          },
        };
        console.log("[TRAINING_PROOF_TRACE] worker_put_training_proof", {
          tokenSuffix: token.slice(-8),
          kvKey: `s:${token}`,
          sharedAthleteId: artifact.sharedAthleteId,
          currentWeekSessionCount: artifact.currentWeekSessionCount,
        });
        await writeSession(env.SESSIONS, token, next);
        return json({ ok: true }, 200);
      }

      if (path.endsWith("/training-proof") && request.method === "PUT") {
        console.log("[TRAINING_PROOF_TRACE] worker_route_miss_training_proof", {
          path,
          method: request.method,
        });
      }

      const sharedMatchMediaPublication = path.match(
        /^\/v1\/sessions\/([^/]+)\/match-media\/attachments$/,
      );
      if (sharedMatchMediaPublication && request.method === "PUT") {
        const token = decodeURIComponent(sharedMatchMediaPublication[1] ?? "")
          .trim()
          .toLowerCase();
        if (!TOKEN_RE.test(token)) return error("Invalid token", 400);
        return handlePublishMatchMediaAttachment(
          request,
          token,
          createMatchMediaPublicationDependencies(env),
        );
      }

      const sharedMatchMediaUploadIntent = path.match(
        /^\/v1\/sessions\/([^/]+)\/match-media\/uploads$/,
      );
      if (sharedMatchMediaUploadIntent && request.method === "POST") {
        const token = decodeURIComponent(sharedMatchMediaUploadIntent[1] ?? "")
          .trim()
          .toLowerCase();
        if (!TOKEN_RE.test(token)) return error("Invalid token", 400);
        const dependencies = createSharedMatchMediaUploadDependencies(env);
        return handleCreateSharedMatchMediaUploadIntent(request, token, dependencies);
      }

      const sharedMatchMediaUploadSession = path.match(
        /^\/v1\/sessions\/([^/]+)\/match-media\/uploads\/([^/]+)$/,
      );
      const sharedMatchMediaUploadPart = path.match(
        /^\/v1\/sessions\/([^/]+)\/match-media\/uploads\/([^/]+)\/parts\/([^/]+)$/,
      );
      const sharedMatchMediaUploadCompletion = path.match(
        /^\/v1\/sessions\/([^/]+)\/match-media\/uploads\/([^/]+)\/complete$/,
      );
      if (
        (sharedMatchMediaUploadSession && ["GET", "DELETE"].includes(request.method)) ||
        (sharedMatchMediaUploadPart && request.method === "PUT") ||
        (sharedMatchMediaUploadCompletion && request.method === "POST")
      ) {
        const route =
          sharedMatchMediaUploadPart ??
          sharedMatchMediaUploadCompletion ??
          sharedMatchMediaUploadSession!;
        const token = decodeURIComponent(route[1] ?? "").trim().toLowerCase();
        const uploadSessionId = decodeURIComponent(route[2] ?? "").trim();
        const assetId = url.searchParams.get("assetId")?.trim() ?? "";
        if (!TOKEN_RE.test(token)) return error("Invalid token", 400);
        const dependencies = createSharedMatchMediaUploadDependencies(env);
        if (sharedMatchMediaUploadPart) {
          const partNumber = Number(route[3]);
          return handleUploadSharedMatchMediaPart(
            request,
            token,
            uploadSessionId,
            assetId,
            partNumber,
            dependencies,
          );
        }
        if (request.method === "GET") {
          return handleInspectSharedMatchMediaUpload(
              request,
              token,
              uploadSessionId,
              assetId,
              dependencies,
            );
        }
        if (sharedMatchMediaUploadCompletion) {
          return handleCompleteSharedMatchMediaUpload(
            request,
            token,
            uploadSessionId,
            assetId,
            dependencies,
          );
        }
        return handleAbortSharedMatchMediaUpload(
              request,
              token,
              uploadSessionId,
              assetId,
              dependencies,
            );
      }

      // Operator inspection: authenticated POST only. Five-field identity is
      // accepted exclusively in the JSON body — never in the URL or query string.
      if (path === "/internal/v1/shared-match-media/production-verification") {
        const store = createConditionalObjectVerificationRecordStore(
          createR2ConditionalObjectStore(env.MEDIA),
        );
        const result = await handleOperatorInspectionHttpRequest({
          method: request.method,
          authorizationHeader: request.headers.get("Authorization"),
          operatorSecret: env.SHARED_MATCH_MEDIA_VERIFICATION_OPERATOR_SECRET,
          contentLengthHeader: request.headers.get("Content-Length"),
          readBodyText: () => request.text(),
          store,
          now: () => new Date(),
        });
        return json(result.body, result.status);
      }

      const mediaUpload = path.match(/^\/v1\/sessions\/([^/]+)\/media$/);
      if (mediaUpload && request.method === "POST") {
        const token = decodeURIComponent(mediaUpload[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) return error("Invalid token", 400);
        const auth = request.headers.get("Authorization") ?? "";
        const m = /^Bearer\s+(.+)$/.exec(auth.trim());
        const secret = m?.[1]?.trim() ?? "";
        if (!secret) return error("Unauthorized", 401);

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.writerSecret !== secret) return error("Unauthorized", 401);

        const contentTypeRaw = (request.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase() || "";
        const mimeType = ALLOWED_COACH_MEDIA_MIME.has(contentTypeRaw)
          ? contentTypeRaw
          : "";
        if (!mimeType) return error("Unsupported media Content-Type", 415);

        const contentLengthHeader = request.headers.get("Content-Length");
        if (contentLengthHeader) {
          const declared = Number(contentLengthHeader);
          if (Number.isFinite(declared) && declared > MAX_COACH_MEDIA_BYTES) {
            return error("Media payload too large", 413);
          }
        }

        const body = await request.arrayBuffer();
        if (!body.byteLength) return error("Empty media body", 400);
        if (body.byteLength > MAX_COACH_MEDIA_BYTES) return error("Media payload too large", 413);

        const mediaId = randomHex(16);
        const durationMs = parseDurationMsHeader(request);
        const key = mediaObjectKey(token, mediaId);
        await env.MEDIA.put(key, body, {
          httpMetadata: { contentType: mimeType },
          customMetadata: {
            sessionTokenTail: token.slice(-8),
            ...(durationMs !== undefined ? { durationMs: String(durationMs) } : {}),
          },
        });

        console.log("[COACH_MEDIA_TRACE]", {
          stage: "worker_media_upload_ok",
          tokenSuffix: token.slice(-8),
          mediaId,
          mimeType,
          byteLength: body.byteLength,
          durationMs: durationMs ?? null,
        });

        return json(
          {
            mediaId,
            mimeType,
            ...(durationMs !== undefined ? { durationMs } : {}),
          },
          201,
        );
      }

      const mediaResolve = path.match(/^\/v1\/sessions\/([^/]+)\/media\/([^/]+)$/);
      if (mediaResolve && request.method === "GET") {
        const token = decodeURIComponent(mediaResolve[1] ?? "").trim().toLowerCase();
        const mediaId = decodeURIComponent(mediaResolve[2] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token) || !MEDIA_ID_RE.test(mediaId)) {
          return error("Invalid media request", 400);
        }
        const rec = await readSession(env.SESSIONS, token);
        if (!rec) return error("Not found", 404);

        const key = mediaObjectKey(token, mediaId);
        const head = await env.MEDIA.head(key);
        if (!head) return error("Not found", 404);

        const expUnix = Math.floor(Date.now() / 1000) + MEDIA_CONTENT_TTL_SECONDS;
        const sig = await signMediaContentAccess(rec.writerSecret, token, mediaId, expUnix);
        const url = new URL(request.url);
        url.pathname = `/v1/sessions/${encodeURIComponent(token)}/media/${encodeURIComponent(mediaId)}/content`;
        url.search = "";
        url.searchParams.set("exp", String(expUnix));
        url.searchParams.set("sig", sig);

        const mimeType = head.httpMetadata?.contentType?.trim() || undefined;
        const durationRaw = head.customMetadata?.durationMs;
        const durationMs =
          typeof durationRaw === "string" && Number.isFinite(Number(durationRaw))
            ? Math.floor(Number(durationRaw))
            : undefined;

        return json({
          mediaId,
          url: url.toString(),
          expiresAt: new Date(expUnix * 1000).toISOString(),
          ...(mimeType ? { mimeType } : {}),
          ...(durationMs !== undefined ? { durationMs } : {}),
        });
      }

      const mediaContent = path.match(/^\/v1\/sessions\/([^/]+)\/media\/([^/]+)\/content$/);
      if (mediaContent && request.method === "GET") {
        const token = decodeURIComponent(mediaContent[1] ?? "").trim().toLowerCase();
        const mediaId = decodeURIComponent(mediaContent[2] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token) || !MEDIA_ID_RE.test(mediaId)) {
          return error("Invalid media request", 400);
        }
        const url = new URL(request.url);
        const expUnix = Number(url.searchParams.get("exp") ?? "");
        const sig = (url.searchParams.get("sig") ?? "").trim().toLowerCase();
        const rec = await readSession(env.SESSIONS, token);
        if (!rec) return error("Not found", 404);
        const ok = await verifyMediaContentAccess(rec.writerSecret, token, mediaId, expUnix, sig);
        if (!ok) return error("Unauthorized", 401);

        // Auth complete. Ownership is enforced by mediaObjectKey(token, mediaId).
        const key = mediaObjectKey(token, mediaId);
        const parsedRange = parseMediaBytesRangeHeader(request.headers.get("Range"));

        if (parsedRange.kind === "none") {
          const object = await env.MEDIA.get(key);
          if (!object) return error("Not found", 404);
          return mediaContentFullResponse(object);
        }

        const head = await env.MEDIA.head(key);
        if (!head) return error("Not found", 404);
        const resolved = resolveMediaBytesRange(parsedRange, head.size);
        if (!resolved) return mediaContentRangeNotSatisfiableResponse(head.size);

        const object = await env.MEDIA.get(key, {
          range: { offset: resolved.offset, length: resolved.length },
        });
        if (!object) return error("Not found", 404);
        return mediaContentPartialResponse(object, resolved);
      }

      return error("Not found", 404);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server error";
      return error(msg, 500);
    }
  },
};
