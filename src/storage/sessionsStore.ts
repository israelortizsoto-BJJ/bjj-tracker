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

export async function getSessions(): Promise<Session[]> {
  return safeParseSessions(await AsyncStorage.getItem(StorageKeys.sessions));
}

export async function setSessions(next: Session[]): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.sessions, JSON.stringify(next));
}

export async function deleteSessionsForKid(kidId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(StorageKeys.sessions);
  if (!raw) return;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  if (!Array.isArray(parsed)) return;

  const sessions = parsed as Session[];
  const next = sessions.filter((s) => String(s.kidId ?? "").trim() !== kidId);
  await setSessions(next);
}

/** Remove one session by id (same persistence as training editor). */
export async function deleteSessionById(sessionId: string): Promise<boolean> {
  const sessions = await getSessions();
  const next = sessions.filter((s) => s.id !== sessionId);
  if (next.length === sessions.length) return false;
  await setSessions(next);
  return true;
}
