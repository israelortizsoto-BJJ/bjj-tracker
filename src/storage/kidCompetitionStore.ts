import AsyncStorage from "@react-native-async-storage/async-storage";

import { bestEffortDeletePersistedMedia } from "../media/persistCameraRollMedia";
import { StorageKeys } from "./storageKeys";
import type {
  KidCompetitionEntry,
  KidCompetitionResult,
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

function newEntryId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const MAX_COMPETITION_ENTRIES_PER_KID = 60;

function capCompetitionsByKid(all: KidCompetitionEntry[]): KidCompetitionEntry[] {
  const byKid = new Map<KidId, KidCompetitionEntry[]>();
  for (const entry of all) {
    const arr = byKid.get(entry.kidId) ?? [];
    arr.push(entry);
    byKid.set(entry.kidId, arr);
  }

  const capped: KidCompetitionEntry[] = [];
  for (const [, entries] of byKid.entries()) {
    const sorted = entries
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    capped.push(...sorted.slice(0, MAX_COMPETITION_ENTRIES_PER_KID));
  }

  capped.sort(
    (a, b) =>
      b.eventDate.localeCompare(a.eventDate) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.kidId.localeCompare(b.kidId),
  );

  return capped;
}

async function getRaw(): Promise<KidCompetitionEntry[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.kidCompetitionEntries);
  const parsed = safeParseOrDefault<KidCompetitionEntry[] | null>(raw, null);
  return parsed && Array.isArray(parsed) ? parsed : [];
}

async function setRaw(entries: KidCompetitionEntry[]): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.kidCompetitionEntries,
    JSON.stringify(entries),
  );
}

export async function getKidCompetitionEntriesForKid(
  kidId: KidId,
): Promise<KidCompetitionEntry[]> {
  const all = await getRaw();
  return all
    .filter((e) => e.kidId === kidId)
    .slice()
    .sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

export async function getKidCompetitionEntryById(
  id: string,
): Promise<KidCompetitionEntry | null> {
  const all = await getRaw();
  return all.find((e) => e.id === id) ?? null;
}

export type KidCompetitionCreateInput = {
  kidId: KidId;
  tournamentName: string;
  eventDate: string;
  result: KidCompetitionResult;
  coachNotes?: string;
  videoUri?: string;
  videoAssetId?: string;
};

export async function createKidCompetitionEntry(
  input: KidCompetitionCreateInput,
): Promise<KidCompetitionEntry> {
  const all = await getRaw();
  const nowIso = new Date().toISOString();
  const id = newEntryId();

  const created: KidCompetitionEntry = {
    id,
    kidId: input.kidId,
    tournamentName: input.tournamentName.trim(),
    eventDate: input.eventDate,
    result: input.result,
    coachNotes: input.coachNotes?.trim() ? input.coachNotes.trim() : undefined,
    videoUri: input.videoUri,
    videoAssetId: input.videoAssetId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  all.unshift(created);
  const capped = capCompetitionsByKid(all);
  await setRaw(capped);
  return capped.find((e) => e.id === id) ?? created;
}

export type KidCompetitionUpdateInput = Partial<{
  tournamentName: string;
  eventDate: string;
  result: KidCompetitionResult;
  coachNotes: string | undefined;
  videoUri: string | undefined;
  videoAssetId: string | undefined;
}>;

export async function updateKidCompetitionEntry(
  entryId: string,
  patch: KidCompetitionUpdateInput,
): Promise<KidCompetitionEntry | null> {
  const all = await getRaw();
  const idx = all.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;

  const existing = all[idx];
  const nowIso = new Date().toISOString();

  let nextVideoUri = existing.videoUri;
  if (Object.prototype.hasOwnProperty.call(patch, "videoUri")) {
    const v = patch.videoUri;
    if (existing.videoUri && v !== existing.videoUri) {
      await bestEffortDeletePersistedMedia(existing.videoUri);
    }
    nextVideoUri = v;
  }

  let nextVideoAssetId = existing.videoAssetId;
  if (Object.prototype.hasOwnProperty.call(patch, "videoAssetId")) {
    nextVideoAssetId = patch.videoAssetId;
  }

  let nextCoachNotes = existing.coachNotes;
  if (Object.prototype.hasOwnProperty.call(patch, "coachNotes")) {
    nextCoachNotes = patch.coachNotes?.trim() ? patch.coachNotes.trim() : undefined;
  }

  const updated: KidCompetitionEntry = {
    ...existing,
    updatedAt: nowIso,
    tournamentName:
      typeof patch.tournamentName !== "undefined"
        ? patch.tournamentName.trim()
        : existing.tournamentName,
    eventDate:
      typeof patch.eventDate !== "undefined" ? patch.eventDate : existing.eventDate,
    result:
      typeof patch.result !== "undefined" ? patch.result : existing.result,
    coachNotes: nextCoachNotes,
    videoUri: nextVideoUri,
    videoAssetId: nextVideoAssetId,
  };

  all[idx] = updated;
  const capped = capCompetitionsByKid(all);
  await setRaw(capped);
  return capped.find((e) => e.id === entryId) ?? updated;
}

export async function deleteKidCompetitionEntry(entryId: string): Promise<boolean> {
  const all = await getRaw();
  const found = all.find((e) => e.id === entryId);
  if (!found) return false;

  await bestEffortDeletePersistedMedia(found.videoUri);

  const next = all.filter((e) => e.id !== entryId);
  await setRaw(capCompetitionsByKid(next));
  return true;
}

/** Pilot roster hard-delete: remove all competition rows for a kid and persisted video files. */
export async function deleteAllKidCompetitionEntriesForKid(kidId: KidId): Promise<void> {
  const all = await getRaw();
  const removed = all.filter((e) => e.kidId === kidId);
  for (const e of removed) {
    await bestEffortDeletePersistedMedia(e.videoUri);
  }
  const next = all.filter((e) => e.kidId !== kidId);
  await setRaw(capCompetitionsByKid(next));
}

/** Dev / clear — wipe all competition rows (does not scan media/ for orphans). */
export async function clearAllKidCompetitionEntries(): Promise<void> {
  await setRaw([]);
}
