import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "./storageKeys";
import type {
  KidCurrentStateAssessment,
  KidCurrentStateAssessmentByKidId,
  KidId,
} from "../types/coachKid";

function safeParseOrDefault<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function getMap(): Promise<KidCurrentStateAssessmentByKidId> {
  const raw = await AsyncStorage.getItem(
    StorageKeys.kidCurrentStateAssessmentByKidId,
  );
  const parsed = safeParseOrDefault<KidCurrentStateAssessmentByKidId | null>(
    raw,
    null,
  );
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : {};
}

async function setMap(map: KidCurrentStateAssessmentByKidId): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.kidCurrentStateAssessmentByKidId,
    JSON.stringify(map),
  );
}

export async function getKidCurrentStateAssessment(
  kidId: KidId,
): Promise<KidCurrentStateAssessment | null> {
  const map = await getMap();
  return map[kidId] ?? null;
}

/**
 * Persist the coach's current-state narrative. Supporting fields are optional metadata;
 * if the narrative is empty after trim, remove the record for this kid.
 */
export async function saveKidCurrentStateAssessment(
  kidId: KidId,
  input: {
    narrative: string;
    confidence: string;
    execution: string;
    consistency: string;
    pressureResponse: string;
  },
): Promise<void> {
  const narrative = input.narrative.trim();
  const confidence = input.confidence.trim();
  const execution = input.execution.trim();
  const consistency = input.consistency.trim();
  const pressureResponse = input.pressureResponse.trim();
  const map = await getMap();

  if (!narrative) {
    if (!map[kidId]) return;
    const { [kidId]: _removed, ...rest } = map;
    await setMap(rest);
    return;
  }

  const nowIso = new Date().toISOString();
  const next: KidCurrentStateAssessmentByKidId = {
    ...map,
    [kidId]: {
      narrative,
      ...(confidence ? { confidence } : {}),
      ...(execution ? { execution } : {}),
      ...(consistency ? { consistency } : {}),
      ...(pressureResponse ? { pressureResponse } : {}),
      updatedAt: nowIso,
    },
  };
  await setMap(next);
}

export async function deleteKidCurrentStateAssessmentForKid(
  kidId: KidId,
): Promise<void> {
  const map = await getMap();
  if (!map[kidId]) return;
  const { [kidId]: _removed, ...rest } = map;
  await setMap(rest);
}
