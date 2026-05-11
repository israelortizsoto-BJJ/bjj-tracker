import AsyncStorage from "@react-native-async-storage/async-storage";

import { normalizeInviteLinkToken } from "../coachShare/inviteLinkToken";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedSharedAthlete,
  SyncedSharedCompetition,
  SyncedWeeklyMessagePayload,
} from "../types/coachWeeklySync";
import { enforceWeeklyAthleteInvariant } from "./invariants/weeklyAthleteInvariant";
import { StorageKeys } from "./storageKeys";

/** Same validation as `resolveWeeklyDoc` / invite-level `weekly` (not exported from there). */
function isValidWeeklyDoc(v: unknown): v is SyncedWeeklyMessagePayload {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.weekStartYMD === "string" &&
    typeof o.headline === "string" &&
    typeof o.body === "string" &&
    typeof o.updatedAt === "string"
  );
}

/** Normalized shape returned from reads; `weeklyByAthleteId` is always an object. */
export type CoachWeeklySyncCacheEntry = {
  weekly: SyncedWeeklyMessagePayload | null;
  fetchedAt: string;
  weeklyByAthleteId: Record<string, SyncedWeeklyMessagePayload | null>;
  /** Session GET roster; older cache entries may omit. */
  athletes: SyncedSharedAthlete[];
  /** Normalized invite token for logs and dedupe; derived on read if missing. */
  tokenNorm: string;
  /** Full GET /v1/sessions/:token response when present (newer cache entries). */
  session: CoachWeeklySyncSessionResponse | null;
};

/** Persisted shape; older entries may omit `weeklyByAthleteId` / `athletes` / `session`. */
type StoredCoachWeeklySyncCacheEntry = {
  weekly: SyncedWeeklyMessagePayload | null;
  fetchedAt: string;
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null>;
  athletes?: unknown;
  tokenNorm?: string;
  session?: unknown;
};

type CacheMap = Record<string, StoredCoachWeeklySyncCacheEntry>;

function normalizeWeeklyByAthleteId(
  raw: unknown,
): Record<string, SyncedWeeklyMessagePayload | null> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SyncedWeeklyMessagePayload | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null) {
      out[key] = null;
    } else if (isValidWeeklyDoc(value)) {
      out[key] = value;
    }
  }
  return out;
}

function normalizeAthletes(raw: unknown): SyncedSharedAthlete[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is SyncedSharedAthlete =>
      Boolean(a) &&
      typeof a === "object" &&
      typeof (a as { id?: unknown }).id === "string" &&
      typeof (a as { name?: unknown }).name === "string" &&
      typeof (a as { createdAt?: unknown }).createdAt === "string",
  );
}

function normalizeCompetitions(raw: unknown): SyncedSharedCompetition[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
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

/** Rehydrates a persisted session blob; returns null if shape is not usable. */
function normalizeStoredSession(
  raw: unknown,
  linkTokenForNorm: string,
): CoachWeeklySyncSessionResponse | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (
    typeof p.coach !== "object" ||
    p.coach === null ||
    Array.isArray(p.coach) ||
    typeof (p.coach as { id?: unknown }).id !== "string" ||
    typeof (p.coach as { displayName?: unknown }).displayName !== "string"
  ) {
    return null;
  }
  const coach = p.coach as CoachWeeklySyncSessionResponse["coach"];
  const weeklyRaw = "weekly" in p ? p.weekly : null;
  const weekly = weeklyRaw === null ? null : isValidWeeklyDoc(weeklyRaw) ? weeklyRaw : null;
  const weeklyByAthleteId = normalizeWeeklyByAthleteId(p.weeklyByAthleteId);
  const athletes = normalizeAthletes(p.athletes);
  const competitions = normalizeCompetitions(p.competitions);
  return {
    ...(typeof p.schemaVersion === "number" ? { schemaVersion: p.schemaVersion } : {}),
    coach,
    weekly,
    weeklyByAthleteId,
    athletes,
    competitions,
  };
}

function normalizeReadEntry(
  entry: unknown,
  linkToken: string,
): CoachWeeklySyncCacheEntry | null {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const e = entry as Record<string, unknown>;
  const fetchedAt = e.fetchedAt;
  if (typeof fetchedAt !== "string") {
    return null;
  }
  const rawWeekly = "weekly" in e ? e.weekly : null;
  const weekly = isValidWeeklyDoc(rawWeekly) ? rawWeekly : null;
  const storedTokenNorm =
    typeof e.tokenNorm === "string" && e.tokenNorm.trim().length > 0 ? e.tokenNorm.trim() : "";
  const tokenNorm = storedTokenNorm || normalizeInviteLinkToken(linkToken);
  const session = normalizeStoredSession(e.session, linkToken);
  const weeklyByAthleteId = normalizeWeeklyByAthleteId(e.weeklyByAthleteId);
  if (__DEV__) {
    console.log("[SYSTEMKEY TRACE CLIENT]", {
      traceStage: "8_client_cache_hydrate",
      headline: weekly?.headline?.slice(0, 120) ?? null,
      systemKey: weekly?.systemKey ?? null,
      athleteId: null,
      weekStartYMD: weekly?.weekStartYMD ?? null,
      inviteWeeklyKeyExists: weekly != null && Object.prototype.hasOwnProperty.call(weekly, "systemKey"),
      weeklyByAthleteSystemKeys: Object.fromEntries(
        Object.entries(weeklyByAthleteId).map(([id, doc]) => [
          id,
          {
            headline: doc?.headline?.slice(0, 120) ?? null,
            systemKey: doc?.systemKey ?? null,
            weekStartYMD: doc?.weekStartYMD ?? null,
          },
        ]),
      ),
      cacheDroppedDocDueToInvalidShape: false,
      source: "coachWeeklySyncCacheStore_normalizeReadEntry",
    });
    console.log("[bjj-weekly-cache-hydrate systemKey]", {
      inviteSystemKey: weekly?.systemKey ?? null,
      weeklyByAthleteIdSystemKeys: Object.fromEntries(
        Object.entries(weeklyByAthleteId).map(([id, doc]) => [id, doc?.systemKey ?? null]),
      ),
    });
  }
  return {
    weekly,
    fetchedAt,
    weeklyByAthleteId,
    athletes: normalizeAthletes("athletes" in e ? e.athletes : []),
    tokenNorm,
    session,
  };
}

function safeParseOrDefault<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readMap(): Promise<CacheMap> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachWeeklySyncCacheByToken);
  return safeParseOrDefault<CacheMap>(raw, {});
}

async function writeMap(map: CacheMap): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.coachWeeklySyncCacheByToken, JSON.stringify(map));
}

export function cacheEntryHasUsableWeeklyDoc(
  entry: CoachWeeklySyncCacheEntry | null,
): boolean {
  if (!entry) return false;
  if (entry.weekly) return true;
  return Object.values(entry.weeklyByAthleteId).some((v) => v != null);
}

export async function getCachedWeeklyForLinkToken(
  linkToken: string,
): Promise<CoachWeeklySyncCacheEntry | null> {
  const map = await readMap();
  const raw = map[linkToken as keyof CacheMap];
  if (raw === undefined) return null;
  return normalizeReadEntry(raw, linkToken);
}

export async function setCachedWeeklyForLinkToken(
  linkToken: string,
  weekly: SyncedWeeklyMessagePayload | null,
  fetchedAtIso: string,
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null>,
  athletes?: SyncedSharedAthlete[] | null,
  /** When set, replaces cached full session; when `undefined`, previous session (if any) is kept. */
  cachedFullSession?: CoachWeeklySyncSessionResponse,
  /** Normalized token for logs/dedupe; defaults from `linkToken` when session is written. */
  cachedTokenNorm?: string,
): Promise<void> {
  const map = await readMap();
  const prevRaw = map[linkToken];
  const prev = prevRaw ? normalizeReadEntry(prevRaw, linkToken) : null;
  const nextSession =
    cachedFullSession !== undefined ? cachedFullSession : prev?.session ?? null;
  const nextTokenNorm =
    cachedTokenNorm !== undefined && cachedTokenNorm.trim().length > 0
      ? cachedTokenNorm.trim()
      : cachedFullSession !== undefined
        ? normalizeInviteLinkToken(linkToken)
        : prev?.tokenNorm && prev.tokenNorm.length > 0
          ? prev.tokenNorm
          : normalizeInviteLinkToken(linkToken);
  const {
    weeklyByAthleteId: normalizedWeeklyByAthleteId,
    athletes: normalizedAthletes,
  } = enforceWeeklyAthleteInvariant({
    weeklyByAthleteId,
    athletes,
    session: nextSession,
  });
  const athleteIds = new Set(normalizedAthletes.map((a) => a.id));
  const missing = Object.keys(normalizedWeeklyByAthleteId).filter((id) => !athleteIds.has(id));

  if (__DEV__ && missing.length > 0) {
    console.error("[CACHE INVARIANT VIOLATION]", {
      missing,
      weeklyKeys: Object.keys(normalizedWeeklyByAthleteId),
      athleteIds: Array.from(athleteIds),
    });
  }

  map[linkToken] = {
    weekly: isValidWeeklyDoc(weekly) ? weekly : null,
    fetchedAt: fetchedAtIso,
    weeklyByAthleteId: normalizedWeeklyByAthleteId,
    athletes: normalizedAthletes,
    tokenNorm: nextTokenNorm,
    session: nextSession ?? undefined,
  };
  if (__DEV__) {
    console.log("[bjj-weekly-cache-write systemKey]", {
      inviteSystemKey: map[linkToken].weekly?.systemKey ?? null,
      weeklyByAthleteIdSystemKeys: Object.fromEntries(
        Object.entries(normalizedWeeklyByAthleteId).map(([id, doc]) => [
          id,
          doc?.systemKey ?? null,
        ]),
      ),
    });
  }
  await writeMap(map);
}

export async function clearCachedWeeklyForLinkToken(linkToken: string): Promise<void> {
  const map = await readMap();
  delete map[linkToken];
  await writeMap(map);
}
