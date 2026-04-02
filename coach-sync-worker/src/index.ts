/**
 * Minimal KV-backed API: one session per invite token; coach writes invite-level and optional per-athlete weekly docs; parent reads and adds athletes.
 *
 * Deploy: set KV id in wrangler.toml, then `npx wrangler deploy` from this folder.
 */

export interface Env {
  SESSIONS: KVNamespace;
}

type WeeklyDoc = {
  weekStartYMD: string;
  headline: string;
  body: string;
  classLine?: string;
  programLine?: string;
  familyResourceUrl?: string;
  familyResourceLabel?: string;
  familyCoachRecapNote?: string;
  updatedAt: string;
};

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
  createdAt: string;
  athletes: SharedAthlete[];
  competitions: SharedCompetition[];
  parentWriterSecret?: string;
};

const TOKEN_RE = /^[a-f0-9]{48,128}$/i;
const SESSION_SCHEMA_VERSION = 3 as const;
const MAX_ATHLETES_PER_SESSION = 24;
const MAX_COMPETITIONS_PER_SESSION = 400;
const RESULT_SET = new Set<CompetitionResult>(["gold", "silver", "bronze", "participated", "dnf", "other"]);
const EVENT_STATUS_SET = new Set<CompetitionEventStatus>(["upcoming", "completed", "cancelled", "unknown"]);
const FORMAT_SET = new Set<CompetitionFormat>(["gi", "nogi", "both"]);

function json(data: unknown, status = 200, cors = true): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
  if (cors) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function error(message: string, status: number, cors = true): Response {
  return json({ error: message }, status, cors);
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

function parseWeeklyDoc(raw: unknown): WeeklyDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const weekStartYMD = typeof o.weekStartYMD === "string" ? o.weekStartYMD.trim() : "";
  const headline = typeof o.headline === "string" ? o.headline.trim() : "";
  const bodyText = typeof o.body === "string" ? o.body.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartYMD) || !headline || headline.length > 200 || !updatedAt) {
    return null;
  }
  if (bodyText.length > 8000) return null;
  const classLine =
    typeof o.classLine === "string" && o.classLine.trim() ? o.classLine.trim().slice(0, 500) : undefined;
  const programLine =
    typeof o.programLine === "string" && o.programLine.trim()
      ? o.programLine.trim().slice(0, 500)
      : undefined;
  const familyResourceUrlRaw =
    typeof o.familyResourceUrl === "string" ? o.familyResourceUrl.trim().slice(0, 500) : "";
  let familyResourceUrl: string | undefined;
  if (familyResourceUrlRaw) {
    const withScheme =
      familyResourceUrlRaw.startsWith("http://") || familyResourceUrlRaw.startsWith("https://")
        ? familyResourceUrlRaw
        : `https://${familyResourceUrlRaw}`;
    try {
      const u = new URL(withScheme);
      if (u.protocol === "http:" || u.protocol === "https:") {
        familyResourceUrl = u.toString().slice(0, 500);
      }
    } catch {
      const head = withScheme.slice(0, 24).toLowerCase();
      if (
        !head.startsWith("javascript:") &&
        !head.startsWith("data:") &&
        /^https?:\/\//i.test(withScheme) &&
        !/\s/.test(withScheme)
      ) {
        familyResourceUrl = withScheme.slice(0, 500);
      }
    }
  }
  const familyResourceLabel =
    typeof o.familyResourceLabel === "string" && o.familyResourceLabel.trim()
      ? o.familyResourceLabel.trim().slice(0, 120)
      : undefined;
  const familyCoachRecapRaw = typeof o.familyCoachRecapNote === "string" ? o.familyCoachRecapNote.trim() : "";
  const familyCoachRecapNote = familyCoachRecapRaw
    ? familyCoachRecapRaw.slice(0, 2000)
    : undefined;
  return {
    weekStartYMD,
    headline,
    body: bodyText,
    ...(classLine ? { classLine } : {}),
    ...(programLine ? { programLine } : {}),
    ...(familyResourceUrl ? { familyResourceUrl, ...(familyResourceLabel ? { familyResourceLabel } : {}) } : {}),
    ...(familyCoachRecapNote ? { familyCoachRecapNote } : {}),
    updatedAt,
  };
}

function parseWeeklyByAthleteId(raw: unknown): Record<string, WeeklyDoc> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, WeeklyDoc> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = k.trim();
    if (!id || id.length > 64) continue;
    const doc = parseWeeklyDoc(v);
    if (doc) out[id] = doc;
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
    r.weekly && typeof r.weekly === "object" ? (r.weekly as WeeklyDoc) : null;

  const schemaVersion = typeof r.schemaVersion === "number" ? r.schemaVersion : 1;
  const athletes = schemaVersion >= 2 ? parseSharedAthletes(r.athletes) : [];
  const competitions = schemaVersion >= 2 ? parseSharedCompetitions(r.competitions) : [];
  const parentWriterSecret =
    typeof r.parentWriterSecret === "string" && r.parentWriterSecret.trim()
      ? r.parentWriterSecret.trim()
      : undefined;

  const weeklyByAthleteId = parseWeeklyByAthleteId(r.weeklyByAthleteId);

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    writerSecret,
    coachId,
    coachDisplayName,
    academyName,
    weekly,
    weeklyByAthleteId,
    createdAt,
    athletes,
    competitions,
    parentWriterSecret,
  };
}

async function readSession(kv: KVNamespace, token: string): Promise<SessionRecord | null> {
  const raw = await kv.get(`s:${token}`, "json");
  return normalizeSessionRecord(raw);
}

async function writeSession(kv: KVNamespace, token: string, rec: SessionRecord): Promise<void> {
  const toStore: SessionRecord = {
    ...rec,
    schemaVersion: SESSION_SCHEMA_VERSION,
    weeklyByAthleteId: weeklyByAthleteIdForStorageAndApi(rec),
    athletes: rec.athletes.slice(0, MAX_ATHLETES_PER_SESSION),
    competitions: rec.competitions.slice(0, MAX_COMPETITIONS_PER_SESSION),
  };
  await kv.put(`s:${token}`, JSON.stringify(toStore));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
          createdAt: now,
          athletes: [],
          competitions: [],
        };
        await writeSession(env.SESSIONS, linkToken, rec);

        return json({ linkToken, writerSecret, coachId }, 201);
      }

      const sessionGet = path.match(/^\/v1\/sessions\/([^/]+)$/);
      if (sessionGet && request.method === "GET") {
        const token = decodeURIComponent(sessionGet[1] ?? "").trim().toLowerCase();
        if (!TOKEN_RE.test(token)) {
          return error("Invalid token", 400);
        }
        const rec = await readSession(env.SESSIONS, token);
        if (!rec) {
          return error("Not found", 404);
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
        return json(
          {
            schemaVersion: rec.schemaVersion,
            coach: {
              id: rec.coachId,
              displayName: rec.coachDisplayName,
              ...(rec.academyName ? { academyName: rec.academyName } : {}),
            },
            weekly: rec.weekly,
            weeklyByAthleteId: weeklyByAthleteIdForStorageAndApi(rec),
            athletes: rec.athletes,
            competitions: rec.competitions,
          },
          200,
        );
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

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.parentWriterSecret !== secret) {
          return error("Unauthorized", 401);
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
          return error("Not found", 404);
        }

        const { [athleteId]: _removedWeekly, ...restWeeklyByAthlete } = rec.weeklyByAthleteId;
        const next: SessionRecord = {
          ...rec,
          athletes: rec.athletes.filter((a) => a.id !== athleteId),
          competitions: rec.competitions.filter((c) => c.sharedAthleteId !== athleteId),
          weeklyByAthleteId: restWeeklyByAthlete,
        };
        await writeSession(env.SESSIONS, token, next);
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
        const sharedAthleteIdRaw =
          typeof b.sharedAthleteId === "string" ? b.sharedAthleteId.trim() : "";
        const weekStartYMD = typeof b.weekStartYMD === "string" ? b.weekStartYMD.trim() : "";
        const headline = typeof b.headline === "string" ? b.headline.trim() : "";
        const bodyText = typeof b.body === "string" ? b.body.trim() : "";
        const classLine =
          typeof b.classLine === "string" && b.classLine.trim() ? b.classLine.trim().slice(0, 500) : undefined;
        const programLine =
          typeof b.programLine === "string" && b.programLine.trim()
            ? b.programLine.trim().slice(0, 500)
            : undefined;
        const familyResourceUrlRaw =
          typeof b.familyResourceUrl === "string" ? b.familyResourceUrl.trim().slice(0, 500) : "";
        let familyResourceUrl: string | undefined;
        if (familyResourceUrlRaw) {
          const withScheme =
            familyResourceUrlRaw.startsWith("http://") || familyResourceUrlRaw.startsWith("https://")
              ? familyResourceUrlRaw
              : `https://${familyResourceUrlRaw}`;
          try {
            const u = new URL(withScheme);
            if (u.protocol === "http:" || u.protocol === "https:") {
              familyResourceUrl = u.toString().slice(0, 500);
            }
          } catch {
            const head = withScheme.slice(0, 24).toLowerCase();
            if (
              !head.startsWith("javascript:") &&
              !head.startsWith("data:") &&
              /^https?:\/\//i.test(withScheme) &&
              !/\s/.test(withScheme)
            ) {
              familyResourceUrl = withScheme.slice(0, 500);
            }
          }
        }
        const familyResourceLabel =
          typeof b.familyResourceLabel === "string" && b.familyResourceLabel.trim()
            ? b.familyResourceLabel.trim().slice(0, 120)
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

        const rec = await readSession(env.SESSIONS, token);
        if (!rec || rec.writerSecret !== secret) {
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
        const weekly: WeeklyDoc = {
          weekStartYMD,
          headline,
          body: bodyText,
          ...(classLine ? { classLine } : {}),
          ...(programLine ? { programLine } : {}),
          ...(familyResourceUrl ? { familyResourceUrl, ...(familyResourceLabel ? { familyResourceLabel } : {}) } : {}),
          ...(familyCoachRecapNote ? { familyCoachRecapNote } : {}),
          updatedAt: now,
        };

        // Targeted debug to diagnose "clear doesn't propagate" for Card 2.
        // Logs only when coach sent empty or omitted the recap field.
        if (
          !hasFamilyCoachRecapKey ||
          (typeof b.familyCoachRecapNote === "string" && !b.familyCoachRecapNote.trim())
        ) {
          const prevRecapRaw = sharedAthleteIdRaw
            ? rec.weeklyByAthleteId[sharedAthleteIdRaw]?.familyCoachRecapNote
            : rec.weekly?.familyCoachRecapNote;
          const chosenHasKey = Object.prototype.hasOwnProperty.call(weekly, "familyCoachRecapNote");
          console.log("[coach-sync-weekly-put familyCoachRecapNote]", {
            hasFamilyCoachRecapKey,
            incomingRecapLen:
              typeof b.familyCoachRecapNote === "string" ? b.familyCoachRecapNote.length : null,
            prevRecapLen: typeof prevRecapRaw === "string" ? prevRecapRaw.length : null,
            storedRecapLen: familyCoachRecapNote ? familyCoachRecapNote.length : 0,
            storedHasKey: chosenHasKey,
            weekStartYMD,
            sharedAthleteId: sharedAthleteIdRaw || null,
          });
        }

        const next: SessionRecord = sharedAthleteIdRaw
          ? {
              ...rec,
              weeklyByAthleteId: { ...rec.weeklyByAthleteId, [sharedAthleteIdRaw]: weekly },
            }
          : { ...rec, weekly };
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
        return json({ competition }, 201);
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
        return json({ ok: true }, 200);
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
        const exists = rec.competitions.some((c) => c.id === competitionId);
        if (!exists) return error("Not found", 404);

        const next: SessionRecord = {
          ...rec,
          competitions: rec.competitions.filter((c) => c.id !== competitionId),
        };
        await writeSession(env.SESSIONS, token, next);
        return json({ ok: true }, 200);
      }

      return error("Not found", 404);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server error";
      return error(msg, 500);
    }
  },
};
