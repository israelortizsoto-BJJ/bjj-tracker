import AsyncStorage from "@react-native-async-storage/async-storage";

import { bestEffortDeletePersistedMedia } from "../media/persistCameraRollMedia";
import { StorageKeys } from "./storageKeys";
import type {
  KidCompetitionEntry,
  KidCompetitionEventStatus,
  KidCompetitionFormat,
  KidCompetitionOutcomeKind,
  KidCompetitionResult,
  KidId,
} from "../types/coachKid";
import type { SyncedSharedCompetition } from "../types/coachWeeklySync";

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

const EVENT_STATUS_SET = new Set<KidCompetitionEventStatus>([
  "upcoming",
  "completed",
  "cancelled",
  "unknown",
]);

const OUTCOME_KIND_SET = new Set<KidCompetitionOutcomeKind>([
  "points",
  "submission",
  "decision",
  "disqualification",
  "medical",
  "other",
  "unknown",
]);

const FORMAT_SET = new Set<KidCompetitionFormat>(["gi", "nogi", "both"]);

function normalizeFormat(raw: unknown): KidCompetitionFormat | undefined {
  if (typeof raw !== "string") return undefined;
  return FORMAT_SET.has(raw as KidCompetitionFormat)
    ? (raw as KidCompetitionFormat)
    : undefined;
}

function normalizeEventStatus(
  raw: unknown,
): KidCompetitionEventStatus | undefined {
  if (typeof raw !== "string") return undefined;
  return EVENT_STATUS_SET.has(raw as KidCompetitionEventStatus)
    ? (raw as KidCompetitionEventStatus)
    : undefined;
}

function normalizeOutcomeKind(
  raw: unknown,
): KidCompetitionOutcomeKind | undefined {
  if (typeof raw !== "string") return undefined;
  return OUTCOME_KIND_SET.has(raw as KidCompetitionOutcomeKind)
    ? (raw as KidCompetitionOutcomeKind)
    : undefined;
}

function normalizeOrganizationOrPromoter(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t ? t : undefined;
}

/** Local rows mirrored from the worker use `id` `shared-comp-<workerCompetitionId>`. */
const SHARED_COMP_LOCAL_ID_PREFIX = "shared-comp-";

function trimSharedIdField(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t ? t : undefined;
}

/**
 * Ensures linkage fields are trimmed strings; recovers worker competition id from `shared-comp-`
 * row ids when the field was dropped by legacy writes or partial JSON.
 */
function normalizeSharedLinkageFields(
  raw: KidCompetitionEntry,
): Partial<Pick<KidCompetitionEntry, "sharedAthleteId" | "sharedCompetitionId">> {
  let sharedCompetitionId = trimSharedIdField(raw.sharedCompetitionId);
  if (!sharedCompetitionId && raw.id.startsWith(SHARED_COMP_LOCAL_ID_PREFIX)) {
    const suffix = raw.id.slice(SHARED_COMP_LOCAL_ID_PREFIX.length).trim();
    if (suffix) sharedCompetitionId = suffix;
  }
  const sharedAthleteId = trimSharedIdField(raw.sharedAthleteId);
  return {
    ...(sharedCompetitionId ? { sharedCompetitionId } : {}),
    ...(sharedAthleteId ? { sharedAthleteId } : {}),
  };
}

/** Worker competition id for parent sync DELETE/PUT/POST; field first, then `shared-comp-` row id. */
export function getWorkerCompetitionIdForEntry(entry: KidCompetitionEntry): string {
  const fromField = trimSharedIdField(entry.sharedCompetitionId);
  if (fromField) return fromField;
  if (entry.id.startsWith(SHARED_COMP_LOCAL_ID_PREFIX)) {
    return entry.id.slice(SHARED_COMP_LOCAL_ID_PREFIX.length).trim();
  }
  return "";
}

/** Strips unknown enum strings so legacy JSON and bad values never break the read path. */
function normalizeKidCompetitionEntry(
  raw: KidCompetitionEntry,
): KidCompetitionEntry {
  const { sharedAthleteId: _omitAthlete, sharedCompetitionId: _omitComp, ...rest } =
    raw;
  const linkage = normalizeSharedLinkageFields(raw);
  return {
    ...rest,
    ...linkage,
    eventStatus: normalizeEventStatus(raw.eventStatus),
    format: normalizeFormat(raw.format),
    organizationOrPromoter: normalizeOrganizationOrPromoter(
      raw.organizationOrPromoter,
    ),
    outcomeKind: normalizeOutcomeKind(raw.outcomeKind),
  };
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
  if (!parsed || !Array.isArray(parsed)) return [];
  return parsed
    .filter((e): e is KidCompetitionEntry => Boolean(e && typeof e === "object"))
    .map((e) => normalizeKidCompetitionEntry(e as KidCompetitionEntry));
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

/**
 * Merge shared worker competitions into one kid's local list.
 * Dedupe key is strictly `sharedCompetitionId` (no name/date heuristics).
 * Keeps local-only rows untouched and prunes only stale shared rows for this athlete.
 */
export async function upsertSharedCompetitionsForKid(
  kidId: KidId,
  sharedAthleteId: string,
  remote: SyncedSharedCompetition[],
): Promise<KidCompetitionEntry[]> {
  const all = await getRaw();
  const nowIso = new Date().toISOString();
  const targetKid = all.filter((e) => e.kidId === kidId);
  const rest = all.filter((e) => e.kidId !== kidId);

  const remoteById = new Map(remote.map((r) => [r.id, r] as const));
  const remoteIdSet = new Set(remote.map((r) => r.id));
  const devLogTag = "[bjj-coach-comp-reconcile]";

  if (__DEV__) {
    const summarize = (r: KidCompetitionEntry) => ({
      id: r.id,
      sharedCompetitionId: r.sharedCompetitionId ?? null,
      sharedAthleteId: r.sharedAthleteId ?? null,
      tournamentName: r.tournamentName,
    });
    console.log(devLogTag, "before reconcile", {
      kidId,
      sharedAthleteId,
      remoteCompetitionCount: remote.length,
      remoteCompetitionIds: remote.map((r) => r.id),
      localRowsForKid: targetKid.map(summarize),
    });
    for (const row of targetKid) {
      if (!row.sharedCompetitionId) continue;
      const rowAthlete = row.sharedAthleteId ?? "";
      const skippedOtherAthlete = Boolean(rowAthlete) && rowAthlete !== sharedAthleteId;
      if (skippedOtherAthlete) {
        console.log(devLogTag, "local shared row skipped (other athlete)", summarize(row));
        continue;
      }
      const athleteMissing = !rowAthlete;
      const absentFromRemote = !remoteIdSet.has(row.sharedCompetitionId);
      console.log(devLogTag, "local shared row (reconcile scope)", {
        ...summarize(row),
        athleteMissingOnLocalRow: athleteMissing,
        absentFromRemote,
      });
    }
  }

  const keptTarget: KidCompetitionEntry[] = [];

  // Keep local-only rows; remove stale shared rows for this athlete only.
  for (const row of targetKid) {
    if (!row.sharedCompetitionId) {
      keptTarget.push(row);
      continue;
    }
    const rowAthlete = row.sharedAthleteId ?? "";
    // Explicit tag for another shared athlete: leave untouched (no fuzzy match).
    if (rowAthlete && rowAthlete !== sharedAthleteId) {
      keptTarget.push(row);
      continue;
    }
    if (remoteById.has(row.sharedCompetitionId)) {
      keptTarget.push(row);
      continue;
    }
    // Absent from remote: drop this shared row. Reconcile uses exact `sharedCompetitionId` ↔ worker
    // competition id only (no fuzzy match). Local-only coach rows have no `sharedCompetitionId`.
  }

  const bySharedId = new Map(
    keptTarget
      .filter((r) => Boolean(r.sharedCompetitionId))
      .map((r) => [r.sharedCompetitionId as string, r] as const),
  );

  for (const r of remote) {
    const existing = bySharedId.get(r.id);
    const nextRow: KidCompetitionEntry = {
      ...(existing ?? {}),
      id: existing?.id ?? `shared-comp-${r.id}`,
      kidId,
      sharedAthleteId,
      sharedCompetitionId: r.id,
      tournamentName: r.tournamentName,
      eventDate: r.eventDate,
      result: r.result,
      eventStatus: r.eventStatus,
      format: r.format,
      organizationOrPromoter: r.organizationOrPromoter,
      createdAt: existing?.createdAt ?? r.createdAt,
      updatedAt: nowIso,
    };
    if (existing) {
      const idx = keptTarget.findIndex((x) => x.id === existing.id);
      if (idx >= 0) keptTarget[idx] = nextRow;
      else keptTarget.push(nextRow);
    } else {
      keptTarget.push(nextRow);
    }
    bySharedId.set(r.id, nextRow);
  }

  if (__DEV__) {
    const summarize = (r: KidCompetitionEntry) => ({
      id: r.id,
      sharedCompetitionId: r.sharedCompetitionId ?? null,
      sharedAthleteId: r.sharedAthleteId ?? null,
      tournamentName: r.tournamentName,
    });
    const inScopeBefore = targetKid.filter((row) => {
      if (!row.sharedCompetitionId) return false;
      const rowAthlete = row.sharedAthleteId ?? "";
      return !rowAthlete || rowAthlete === sharedAthleteId;
    });
    const sharedIdsBefore = new Set(
      inScopeBefore.map((r) => r.sharedCompetitionId as string),
    );
    const inScopeAfterKept = keptTarget.filter((row) => {
      if (!row.sharedCompetitionId) return false;
      const rowAthlete = row.sharedAthleteId ?? "";
      return !rowAthlete || rowAthlete === sharedAthleteId;
    });
    const sharedIdsAfterKept = new Set(
      inScopeAfterKept.map((r) => r.sharedCompetitionId as string),
    );
    console.log(devLogTag, "after reconcile (pre-cap)", {
      kidId,
      keptTargetRowsForKid: keptTarget.map(summarize),
    });
    for (const sid of sharedIdsBefore) {
      const absentFromRemote = !remoteIdSet.has(sid);
      console.log(devLogTag, "delete-propagation", {
        sharedCompetitionId: sid,
        absentFromRemote,
        stillPresentLocallyBeforeReconcile: true,
        stillPresentLocallyAfterReconcilePreCap: sharedIdsAfterKept.has(sid),
      });
    }
  }

  const nextAll = capCompetitionsByKid([...rest, ...keptTarget]);
  await setRaw(nextAll);
  const returnedForKid = nextAll
    .filter((e) => e.kidId === kidId)
    .slice()
    .sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  if (__DEV__) {
    const summarize = (r: KidCompetitionEntry) => ({
      id: r.id,
      sharedCompetitionId: r.sharedCompetitionId ?? null,
      sharedAthleteId: r.sharedAthleteId ?? null,
      tournamentName: r.tournamentName,
    });
    const inScopeReturned = returnedForKid.filter((row) => {
      if (!row.sharedCompetitionId) return false;
      const rowAthlete = row.sharedAthleteId ?? "";
      return !rowAthlete || rowAthlete === sharedAthleteId;
    });
    const sharedIdsAfterCap = new Set(
      inScopeReturned.map((r) => r.sharedCompetitionId as string),
    );
    console.log(devLogTag, "after reconcile (post-cap, returned for kid)", {
      kidId,
      rowCount: returnedForKid.length,
      rows: returnedForKid.map(summarize),
    });
    for (const sid of remoteIdSet) {
      if (!sharedIdsAfterCap.has(sid)) {
        console.log(devLogTag, "remote id missing from post-cap local (unexpected)", {
          sharedCompetitionId: sid,
        });
      }
    }
    const inScopeBeforeIds = new Set(
      targetKid
        .filter((row) => {
          if (!row.sharedCompetitionId) return false;
          const rowAthlete = row.sharedAthleteId ?? "";
          return !rowAthlete || rowAthlete === sharedAthleteId;
        })
        .map((r) => r.sharedCompetitionId as string),
    );
    for (const sid of inScopeBeforeIds) {
      const absentFromRemote = !remoteIdSet.has(sid);
      if (!absentFromRemote) continue;
      console.log(devLogTag, "delete-propagation (post-cap)", {
        sharedCompetitionId: sid,
        absentFromRemote: true,
        stillPresentLocallyAfterReconcile: sharedIdsAfterCap.has(sid),
      });
    }
  }

  return returnedForKid;
}

export async function getKidCompetitionEntryById(
  id: string,
): Promise<KidCompetitionEntry | null> {
  const all = await getRaw();
  return all.find((e) => e.id === id) ?? null;
}

export type KidCompetitionCreateInput = {
  kidId: KidId;
  sharedAthleteId?: string;
  sharedCompetitionId?: string;
  tournamentName: string;
  eventDate: string;
  result?: KidCompetitionResult;
  eventStatus?: KidCompetitionEventStatus;
  format?: KidCompetitionFormat;
  organizationOrPromoter?: string;
  outcomeKind?: KidCompetitionOutcomeKind;
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

  const org = input.organizationOrPromoter?.trim()
    ? input.organizationOrPromoter.trim()
    : undefined;

  const created: KidCompetitionEntry = {
    id,
    kidId: input.kidId,
    ...(input.sharedAthleteId ? { sharedAthleteId: input.sharedAthleteId } : {}),
    ...(input.sharedCompetitionId ? { sharedCompetitionId: input.sharedCompetitionId } : {}),
    tournamentName: input.tournamentName.trim(),
    eventDate: input.eventDate,
    ...(input.result ? { result: input.result } : {}),
    ...(input.eventStatus ? { eventStatus: input.eventStatus } : {}),
    ...(input.format ? { format: input.format } : {}),
    ...(org ? { organizationOrPromoter: org } : {}),
    ...(input.outcomeKind ? { outcomeKind: input.outcomeKind } : {}),
    coachNotes: input.coachNotes?.trim() ? input.coachNotes.trim() : undefined,
    videoUri: input.videoUri,
    videoAssetId: input.videoAssetId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (__DEV__ && input.sharedCompetitionId) {
    console.log("[bjj-sync-debug] createKidCompetitionEntry persisted linkage", {
      id,
      kidId: input.kidId,
      sharedAthleteId: input.sharedAthleteId ?? null,
      sharedCompetitionId: input.sharedCompetitionId,
      tournamentName: created.tournamentName,
    });
  }

  all.unshift(created);
  const capped = capCompetitionsByKid(all);
  await setRaw(capped);
  return capped.find((e) => e.id === id) ?? created;
}

export type KidCompetitionUpdateInput = Partial<{
  sharedAthleteId: string | undefined;
  sharedCompetitionId: string | undefined;
  tournamentName: string;
  eventDate: string;
  result: KidCompetitionResult | undefined;
  eventStatus: KidCompetitionEventStatus | undefined;
  format: KidCompetitionFormat | undefined;
  organizationOrPromoter: string | undefined;
  outcomeKind: KidCompetitionOutcomeKind | undefined;
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

  let nextEventStatus = existing.eventStatus;
  if (Object.prototype.hasOwnProperty.call(patch, "eventStatus")) {
    nextEventStatus = patch.eventStatus;
  }

  let nextFormat = existing.format;
  if (Object.prototype.hasOwnProperty.call(patch, "format")) {
    nextFormat = patch.format;
  }

  let nextOrganizationOrPromoter = existing.organizationOrPromoter;
  if (Object.prototype.hasOwnProperty.call(patch, "organizationOrPromoter")) {
    nextOrganizationOrPromoter = patch.organizationOrPromoter?.trim()
      ? patch.organizationOrPromoter.trim()
      : undefined;
  }

  let nextOutcomeKind = existing.outcomeKind;
  if (Object.prototype.hasOwnProperty.call(patch, "outcomeKind")) {
    nextOutcomeKind = patch.outcomeKind;
  }

  let nextSharedAthleteId = existing.sharedAthleteId;
  if (Object.prototype.hasOwnProperty.call(patch, "sharedAthleteId")) {
    if (typeof patch.sharedAthleteId === "string") {
      const t = patch.sharedAthleteId.trim();
      nextSharedAthleteId = t ? t : undefined;
    }
    // undefined / null / non-string: do not strip linkage from accidental patches.
  }

  let nextSharedCompetitionId = existing.sharedCompetitionId;
  if (Object.prototype.hasOwnProperty.call(patch, "sharedCompetitionId")) {
    if (typeof patch.sharedCompetitionId === "string") {
      const t = patch.sharedCompetitionId.trim();
      nextSharedCompetitionId = t ? t : undefined;
    }
  }

  const updated: KidCompetitionEntry = {
    ...existing,
    updatedAt: nowIso,
    sharedAthleteId: nextSharedAthleteId,
    sharedCompetitionId: nextSharedCompetitionId,
    tournamentName:
      typeof patch.tournamentName !== "undefined"
        ? patch.tournamentName.trim()
        : existing.tournamentName,
    eventDate:
      typeof patch.eventDate !== "undefined" ? patch.eventDate : existing.eventDate,
    result: Object.prototype.hasOwnProperty.call(patch, "result")
      ? patch.result
      : existing.result,
    eventStatus: nextEventStatus,
    format: nextFormat,
    organizationOrPromoter: nextOrganizationOrPromoter,
    outcomeKind: nextOutcomeKind,
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
