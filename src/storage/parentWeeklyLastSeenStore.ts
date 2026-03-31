import AsyncStorage from "@react-native-async-storage/async-storage";

import { isDev } from "../config/runtime";
import { normalizeInviteLinkToken } from "../coachShare/inviteLinkToken";
import { StorageKeys } from "./storageKeys";

/** Maps normalized linkToken → last seen `weekly.updatedAt` (ISO string). Dev lane only — callers must gate with `isDev()`. */
type LastSeenMap = Record<string, string>;

function safeParseOrDefault<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readMap(): Promise<LastSeenMap> {
  const raw = await AsyncStorage.getItem(StorageKeys.parentWeeklyLastSeenByToken);
  return safeParseOrDefault<LastSeenMap>(raw, {});
}

async function writeMap(map: LastSeenMap): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.parentWeeklyLastSeenByToken, JSON.stringify(map));
}

export async function getLastSeenUpdatedAt(linkToken: string): Promise<string | null> {
  const norm = normalizeInviteLinkToken(linkToken);
  if (!norm) return null;
  const map = await readMap();
  return map[norm] ?? null;
}

export async function setLastSeenUpdatedAt(linkToken: string, updatedAtIso: string): Promise<void> {
  if (!isDev()) return;
  const norm = normalizeInviteLinkToken(linkToken);
  if (!norm) return;
  const map = await readMap();
  map[norm] = updatedAtIso;
  await writeMap(map);
}
