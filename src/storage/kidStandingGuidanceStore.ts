import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "./storageKeys";
import type {
  KidId,
  KidStandingGuidance,
  KidStandingGuidanceByKidId,
} from "../types/coachKid";

function safeParseOrDefault<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function getMap(): Promise<KidStandingGuidanceByKidId> {
  const raw = await AsyncStorage.getItem(StorageKeys.kidStandingGuidanceByKidId);
  const parsed = safeParseOrDefault<KidStandingGuidanceByKidId | null>(raw, null);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

async function setMap(map: KidStandingGuidanceByKidId): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.kidStandingGuidanceByKidId,
    JSON.stringify(map),
  );
}

export async function getKidStandingGuidance(
  kidId: KidId,
): Promise<KidStandingGuidance | null> {
  const map = await getMap();
  const row = map[kidId];
  return row ?? null;
}

/**
 * Persist guidance for a kid. Trims fields; if both headline and detail are empty after trim,
 * removes the record for this kid.
 */
export async function saveKidStandingGuidance(
  kidId: KidId,
  input: { headline: string; detail: string },
): Promise<void> {
  const headline = input.headline.trim();
  const detail = input.detail.trim();
  const map = await getMap();

  if (!headline && !detail) {
    if (!map[kidId]) return;
    const { [kidId]: _removed, ...rest } = map;
    await setMap(rest);
    return;
  }

  const nowIso = new Date().toISOString();
  const next: KidStandingGuidanceByKidId = {
    ...map,
    [kidId]: {
      headline,
      ...(detail ? { detail } : {}),
      updatedAt: nowIso,
    },
  };
  await setMap(next);
}

export async function deleteKidStandingGuidanceForKid(kidId: KidId): Promise<void> {
  const map = await getMap();
  if (!map[kidId]) return;
  const { [kidId]: _removed, ...rest } = map;
  await setMap(rest);
}
