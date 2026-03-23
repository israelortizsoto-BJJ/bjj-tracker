import AsyncStorage from "@react-native-async-storage/async-storage";

import { deleteAllKidCompetitionEntriesForKid } from "./kidCompetitionStore";
import { deleteKidStandingGuidanceForKid } from "./kidStandingGuidanceStore";
import { StorageKeys } from "./storageKeys";
import type {
  CoachOutcome,
  KidId,
  KidWeeklyFocusEntry,
  KidWeeklyFocusEntryCustom,
  KidWeeklyFocusEntryTemplate,
  KidsById,
} from "../types/coachKid";
import type { Session } from "../types";

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

export async function getFamilyCompetitionSelectedKidId(): Promise<KidId | null> {
  const raw = await AsyncStorage.getItem(StorageKeys.familyCompetitionSelectedKidId);
  const t = raw?.trim();
  return t ? t : null;
}

export async function setFamilyCompetitionSelectedKidId(kidId: KidId): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.familyCompetitionSelectedKidId, kidId);
}

export async function clearFamilyCompetitionSelectedKidId(): Promise<void> {
  await AsyncStorage.removeItem(StorageKeys.familyCompetitionSelectedKidId);
}

export async function getKidsById(): Promise<KidsById> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachKidsById);
  return safeParseOrDefault<KidsById>(raw, {});
}

export async function setKidsById(kidsById: KidsById): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.coachKidsById, JSON.stringify(kidsById));
}

/** Remove all weekly focus log rows for one kid (pilot roster hard-delete). */
export async function deleteKidWeeklyFocusEntriesForKid(kidId: KidId): Promise<void> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const next = all.filter((e) => e.kidId !== kidId);
  const capped = capEntriesByKid(next);
  await setKidWeeklyFocusEntriesRaw(capped);
}

/** Remove one weekly focus / check-in log row (pilot). */
export async function deleteKidWeeklyFocusEntryById(
  entryId: string,
  expectedKidId: KidId,
): Promise<boolean> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const found = all.find((e) => e.id === entryId);
  if (!found || found.kidId !== expectedKidId) return false;

  const next = all.filter((e) => e.id !== entryId);
  const capped = capEntriesByKid(next);
  await setKidWeeklyFocusEntriesRaw(capped);
  return true;
}

/**
 * Pilot hard-delete guardrail:
 * remove training sessions linked to a deleted kid so `bjj.sessions.v2` has no orphan kid-linked sessions.
 */
async function deleteKidTrainingSessionsForKid(kidId: KidId): Promise<void> {
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
  await AsyncStorage.setItem(StorageKeys.sessions, JSON.stringify(next));
}

/**
 * Hard-delete a kid from the pilot roster and all local weekly focus + competition data.
 * Order: competitions (with media) → weekly focus → roster (avoids orphan kidIds in history).
 */
export async function deleteKidPilot(kidId: KidId): Promise<boolean> {
  const kids = await getKidsById();
  if (!kids[kidId]) return false;

  const familyCompPick = await getFamilyCompetitionSelectedKidId();
  if (familyCompPick === kidId) {
    await clearFamilyCompetitionSelectedKidId();
  }

  await deleteAllKidCompetitionEntriesForKid(kidId);
  await deleteKidTrainingSessionsForKid(kidId);
  await deleteKidWeeklyFocusEntriesForKid(kidId);
  await deleteKidStandingGuidanceForKid(kidId);

  const { [kidId]: _removed, ...rest } = kids;
  await setKidsById(rest);
  return true;
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

export async function getKidWeeklyFocusEntryById(
  entryId: string,
): Promise<KidWeeklyFocusEntry | null> {
  const all = await getKidWeeklyFocusEntriesRaw();
  return all.find((e) => e.id === entryId) ?? null;
}

export type KidWeeklyFocusFocusUpdate =
  | {
      focusType: "template";
      templateId: string;
      title: string;
      metadata?: string;
      youtubeUrl?: string;
    }
  | {
      focusType: "custom";
      title: string;
      note?: string;
      youtubeUrl?: string;
    };

/**
 * In-place update of the focus fields on an existing log row (same id / week / timestamps for createdAt).
 */
export async function updateKidWeeklyFocusFocusById(
  entryId: string,
  expectedKidId: KidId,
  focus: KidWeeklyFocusFocusUpdate,
): Promise<KidWeeklyFocusEntry | null> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const idx = all.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;
  const existing = all[idx];
  if (existing.kidId !== expectedKidId) return null;

  const nowIso = new Date().toISOString();
  const base = {
    id: existing.id,
    kidId: existing.kidId,
    weekStartYMD: existing.weekStartYMD,
    createdAt: existing.createdAt,
    updatedAt: nowIso,
    coachOutcome: existing.coachOutcome,
    coachNotes: existing.coachNotes,
  };

  const updated: KidWeeklyFocusEntry =
    focus.focusType === "template"
      ? {
          ...base,
          focusType: "template",
          templateId: focus.templateId,
          title: focus.title,
          metadata: focus.metadata,
          youtubeUrl: focus.youtubeUrl,
        }
      : {
          ...base,
          focusType: "custom",
          title: focus.title,
          note: focus.note,
          youtubeUrl: focus.youtubeUrl,
        };

  all[idx] = updated;
  const capped = capEntriesByKid(all);
  await setKidWeeklyFocusEntriesRaw(capped);
  return capped.find((e) => e.id === entryId) ?? updated;
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

  let nextCoachOutcome = existing.coachOutcome;
  if (Object.prototype.hasOwnProperty.call(patch, "coachOutcome")) {
    nextCoachOutcome = patch.coachOutcome;
  }

  let nextCoachNotes = existing.coachNotes;
  if (Object.prototype.hasOwnProperty.call(patch, "coachNotes")) {
    const raw = patch.coachNotes;
    nextCoachNotes = raw?.trim() ? raw.trim() : undefined;
  }

  const updated: KidWeeklyFocusEntry = {
    ...existing,
    updatedAt: nowIso,
    coachOutcome: nextCoachOutcome,
    coachNotes: nextCoachNotes,
  };

  all[idx] = updated;
  const capped = capEntriesByKid(all);
  await setKidWeeklyFocusEntriesRaw(capped);
  return capped.find((e) => e.id === entryId) ?? updated;
}
