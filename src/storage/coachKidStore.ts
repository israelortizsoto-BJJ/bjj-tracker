import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "./storageKeys";
import type {
  CoachOutcome,
  KidId,
  KidWeeklyFocusEntry,
  KidWeeklyFocusEntryCustom,
  KidWeeklyFocusEntryTemplate,
  KidsById,
} from "../types/coachKid";

type KidWeeklyFocusAppendInput =
  | (KidWeeklyFocusEntryTemplate & {
      kidId: KidId;
      weekStartYMD: string;
      coachOutcome?: KidWeeklyFocusEntry["coachOutcome"];
      coachNotes?: string;
    })
  | (KidWeeklyFocusEntryCustom & {
      kidId: KidId;
      weekStartYMD: string;
      coachOutcome?: KidWeeklyFocusEntry["coachOutcome"];
      coachNotes?: string;
    });

function safeParseOrDefault<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toYMDLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Monday week boundary in local time (matches the app’s training-week logic).
 */
export function startOfWeekMondayYMD(dateYMD: string): string {
  const [y, m, d] = dateYMD.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 Sun - 6 Sat
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  return toYMDLocal(date);
}

const MAX_WEEKLY_FOCUS_ENTRIES_PER_KID = 60;

function newEntryId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Keep the newest N entries per kid by createdAt (append-only safe). */
function capEntriesByKid(all: KidWeeklyFocusEntry[]): KidWeeklyFocusEntry[] {
  const byKid = new Map<KidId, KidWeeklyFocusEntry[]>();
  for (const entry of all) {
    const arr = byKid.get(entry.kidId) ?? [];
    arr.push(entry);
    byKid.set(entry.kidId, arr);
  }

  const capped: KidWeeklyFocusEntry[] = [];
  for (const [, entries] of byKid.entries()) {
    const sorted = entries
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    capped.push(...sorted.slice(0, MAX_WEEKLY_FOCUS_ENTRIES_PER_KID));
  }

  capped.sort(
    (a, b) =>
      b.weekStartYMD.localeCompare(a.weekStartYMD) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.kidId.localeCompare(b.kidId),
  );

  return capped;
}

async function getKidWeeklyFocusEntriesRaw(): Promise<KidWeeklyFocusEntry[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.kidWeeklyFocusEntries);
  const parsed = safeParseOrDefault<KidWeeklyFocusEntry[] | null>(raw, null);
  return parsed && Array.isArray(parsed) ? parsed : [];
}

async function setKidWeeklyFocusEntriesRaw(
  entries: KidWeeklyFocusEntry[],
): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.kidWeeklyFocusEntries,
    JSON.stringify(entries),
  );
}

export async function getKidsById(): Promise<KidsById> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachKidsById);
  return safeParseOrDefault<KidsById>(raw, {});
}

export async function setKidsById(kidsById: KidsById): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.coachKidsById, JSON.stringify(kidsById));
}

export async function getKidWeeklyFocusEntriesForKid(
  kidId: KidId,
): Promise<KidWeeklyFocusEntry[]> {
  const all = await getKidWeeklyFocusEntriesRaw();
  return all
    .filter((e) => e.kidId === kidId)
    .slice()
    .sort(
      (a, b) =>
        b.weekStartYMD.localeCompare(a.weekStartYMD) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

/**
 * Most recent focus log for this kid in the given Monday-week (by createdAt).
 */
export async function getLatestKidWeeklyFocusForWeek(
  kidId: KidId,
  weekStartYMD: string,
): Promise<KidWeeklyFocusEntry | null> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const matches = all.filter(
    (e) => e.kidId === kidId && e.weekStartYMD === weekStartYMD,
  );
  if (!matches.length) return null;
  return matches.reduce((best, e) =>
    e.createdAt > best.createdAt ? e : best,
  );
}

/**
 * Append a new weekly focus log (never overwrites an existing row).
 */
export async function appendKidWeeklyFocus(
  input: KidWeeklyFocusAppendInput,
): Promise<KidWeeklyFocusEntry> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const nowIso = new Date().toISOString();
  const id = newEntryId();

  const created: KidWeeklyFocusEntry =
    input.focusType === "template"
      ? {
          id,
          kidId: input.kidId,
          weekStartYMD: input.weekStartYMD,
          createdAt: nowIso,
          updatedAt: nowIso,
          focusType: "template",
          templateId: input.templateId,
          title: input.title,
          metadata: input.metadata,
          youtubeUrl: input.youtubeUrl,
          coachOutcome: input.coachOutcome,
          coachNotes: input.coachNotes,
        }
      : {
          id,
          kidId: input.kidId,
          weekStartYMD: input.weekStartYMD,
          createdAt: nowIso,
          updatedAt: nowIso,
          focusType: "custom",
          title: input.title,
          note: input.note,
          youtubeUrl: input.youtubeUrl,
          coachOutcome: input.coachOutcome,
          coachNotes: input.coachNotes,
        };

  all.unshift(created);
  const capped = capEntriesByKid(all);
  await setKidWeeklyFocusEntriesRaw(capped);
  return capped.find((e) => e.id === id) ?? created;
}

export async function patchKidWeeklyFocusCoachFields(
  entryId: string,
  patch: { coachOutcome?: CoachOutcome; coachNotes?: string },
): Promise<KidWeeklyFocusEntry | null> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const idx = all.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;

  const existing = all[idx];
  const nowIso = new Date().toISOString();
  const updated: KidWeeklyFocusEntry = {
    ...existing,
    updatedAt: nowIso,
    coachOutcome:
      typeof patch.coachOutcome !== "undefined"
        ? patch.coachOutcome
        : existing.coachOutcome,
    coachNotes:
      typeof patch.coachNotes !== "undefined"
        ? patch.coachNotes
        : existing.coachNotes,
  };

  all[idx] = updated;
  const capped = capEntriesByKid(all);
  await setKidWeeklyFocusEntriesRaw(capped);
  return capped.find((e) => e.id === entryId) ?? updated;
}
