import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SyncedWeeklyMessagePayload } from "../types/coachWeeklySync";
import { StorageKeys } from "./storageKeys";

type CacheMap = Record<string, { weekly: SyncedWeeklyMessagePayload | null; fetchedAt: string }>;

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
): Promise<{ weekly: SyncedWeeklyMessagePayload | null; fetchedAt: string } | null> {
  const map = await readMap();
  return map[linkToken] ?? null;
}

export async function setCachedWeeklyForLinkToken(
  linkToken: string,
  weekly: SyncedWeeklyMessagePayload | null,
  fetchedAtIso: string,
): Promise<void> {
  const map = await readMap();
  map[linkToken] = { weekly, fetchedAt: fetchedAtIso };
  await writeMap(map);
}

export async function clearCachedWeeklyForLinkToken(linkToken: string): Promise<void> {
  const map = await readMap();
  delete map[linkToken];
  await writeMap(map);
}
