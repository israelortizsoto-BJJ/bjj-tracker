import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SyncedWeeklyMessagePayload } from "../types/coachWeeklySync";
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
};

/** Persisted shape; older entries may omit `weeklyByAthleteId`. */
type StoredCoachWeeklySyncCacheEntry = {
  weekly: SyncedWeeklyMessagePayload | null;
  fetchedAt: string;
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null>;
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

function normalizeReadEntry(entry: unknown): CoachWeeklySyncCacheEntry | null {
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
  return {
    weekly,
    fetchedAt,
    weeklyByAthleteId: normalizeWeeklyByAthleteId(e.weeklyByAthleteId),
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

export async function getCachedWeeklyForLinkToken(
  linkToken: string,
): Promise<CoachWeeklySyncCacheEntry | null> {
  const map = await readMap();
  const raw = map[linkToken as keyof CacheMap];
  if (raw === undefined) return null;
  return normalizeReadEntry(raw);
}

export async function setCachedWeeklyForLinkToken(
  linkToken: string,
  weekly: SyncedWeeklyMessagePayload | null,
  fetchedAtIso: string,
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null>,
): Promise<void> {
  const map = await readMap();
  map[linkToken] = {
    weekly: isValidWeeklyDoc(weekly) ? weekly : null,
    fetchedAt: fetchedAtIso,
    weeklyByAthleteId: normalizeWeeklyByAthleteId(weeklyByAthleteId),
  };
  await writeMap(map);
}

export async function clearCachedWeeklyForLinkToken(linkToken: string): Promise<void> {
  const map = await readMap();
  delete map[linkToken];
  await writeMap(map);
}
