import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "./storageKeys";
import type { Session } from "../types";

function safeParseSessions(raw: string | null): Session[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

/** Remove one session by id (same persistence as training editor). */
export async function deleteSessionById(sessionId: string): Promise<boolean> {
  const sessions = safeParseSessions(await AsyncStorage.getItem(StorageKeys.sessions));
  const next = sessions.filter((s) => s.id !== sessionId);
  if (next.length === sessions.length) return false;
  await AsyncStorage.setItem(StorageKeys.sessions, JSON.stringify(next));
  return true;
}
