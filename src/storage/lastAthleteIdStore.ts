import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "./storageKeys";

/** Last parent-selected athlete roster id (`Kid.id`) — local device only. */
export async function getLastAthleteKidId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(StorageKeys.lastAthleteId);
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

export async function setLastAthleteKidId(kidId: string): Promise<void> {
  try {
    const trimmed = typeof kidId === "string" ? kidId.trim() : "";
    if (!trimmed) return;
    await AsyncStorage.setItem(StorageKeys.lastAthleteId, trimmed);
  } catch {
    /* ignore */
  }
}

export async function clearLastAthleteKidIdIfMatches(kidId: string): Promise<void> {
  const want = typeof kidId === "string" ? kidId.trim() : "";
  if (!want) return;
  try {
    const cur = await getLastAthleteKidId();
    if (cur === want) {
      await AsyncStorage.removeItem(StorageKeys.lastAthleteId);
    }
  } catch {
    /* ignore */
  }
}
