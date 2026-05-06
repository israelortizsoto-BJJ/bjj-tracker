import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  KidCompetitionEntry,
  KidCompetitionResult,
  KidCompetitionVideoRef,
} from "../types/coachKid";
import { emitCompetitionChange, getKidCompetitionEntriesForKid } from "./kidCompetitionStore";

const DETAIL_STORAGE_KEY = "competitions" as const;

/** Extended detail for competition match rows (`DETAIL_STORAGE_KEY`). Top-level list fields use kidCompetitionStore. */
export type CompetitionDetailMatchSnapshot = {
  id: string;
  matchResult: "win" | "loss" | null;
  outcome: "Submission" | "Points" | "Ref Decision" | "DQ" | "Injury" | null;
  /** Free-form (e.g. seconds as number or mm:ss); only surfaced in UI when outcome is Submission */
  submissionTime: string | null;
  coachNote?: string;
  imageUri: string | null;
  videoUri: string | null;
  imageAssetId: string | null;
  videoAssetId: string | null;
};

export type CompetitionDetailPayload = {
  matches: CompetitionDetailMatchSnapshot[];
};

type StoreShape = Record<string, CompetitionDetailPayload>;

function safeParseStore(raw: string | null): StoreShape {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== "object" || p === null || Array.isArray(p)) return {};
    return p as StoreShape;
  } catch {
    return {};
  }
}

export type CompetitionMediaPresence = {
  hasVideo: boolean;
  hasImage: boolean;
};

/**
 * Aggregated flags for This Week competition cards: true if any stored match row has media.
 */
export async function getCompetitionMediaPresenceForEntryIds(
  entryIds: string[],
): Promise<Record<string, CompetitionMediaPresence>> {
  if (entryIds.length === 0) return {};
  const all = safeParseStore(await AsyncStorage.getItem(DETAIL_STORAGE_KEY));
  const out: Record<string, CompetitionMediaPresence> = {};
  for (const id of entryIds) {
    if (!id) continue;
    const found = all[id];
    const matches = found?.matches;
    if (!Array.isArray(matches)) {
      out[id] = { hasVideo: false, hasImage: false };
      continue;
    }
    let hasVideo = false;
    let hasImage = false;
    for (const m of matches) {
      if (!m || typeof m !== "object") continue;
      const vu = typeof m.videoUri === "string" ? m.videoUri.trim() : "";
      const iu = typeof m.imageUri === "string" ? m.imageUri.trim() : "";
      if (vu) hasVideo = true;
      if (iu) hasImage = true;
      if (hasVideo && hasImage) break;
    }
    out[id] = { hasVideo, hasImage };
  }
  return out;
}

export async function getCompetitionDetailByEntryId(
  entryId: string,
): Promise<CompetitionDetailPayload | null> {
  if (!entryId) return null;
  const all = safeParseStore(await AsyncStorage.getItem(DETAIL_STORAGE_KEY));
  const found = all[entryId];
  if (!found || !Array.isArray(found.matches)) return null;
  return found;
}

/** Kid competition row + per-match rows from `DETAIL_STORAGE_KEY` (single merge path for UI + summary). */
export type KidCompetitionEntryWithMatchDetail = KidCompetitionEntry & {
  matches: CompetitionDetailMatchSnapshot[];
};

export async function mergeCompetitionMatchDetailIntoEntries(
  entries: readonly KidCompetitionEntry[],
): Promise<KidCompetitionEntryWithMatchDetail[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const detail = await getCompetitionDetailByEntryId(entry.id);
      return {
        ...entry,
        matches: Array.isArray(detail?.matches) ? [...detail.matches] : [],
      };
    }),
  );
}

export async function getKidCompetitionEntriesWithMatchDetailForKid(
  kidId: string,
): Promise<KidCompetitionEntryWithMatchDetail[]> {
  const k = typeof kidId === "string" ? kidId.trim() : "";
  if (!k) return [];
  const entries = await getKidCompetitionEntriesForKid(k);
  return mergeCompetitionMatchDetailIntoEntries(entries);
}

/** Latest competition for weekly coaching / drafts (derived from detail merge, no extra storage). */
export type LastCompetitionWeeklyContext = {
  lastCompetitionDate: string;
  lastCompetitionName: string;
  lastCompetitionResult?: KidCompetitionResult;
  /** Compact W/L from stored match rows when present. */
  lastCompetitionMatchSummary?: string;
};

/**
 * Picks the most recent competition by `eventDate` (then `createdAt`), preferring an event on or before `todayYmd`
 * when one exists; otherwise the newest row (e.g. only upcoming events on file).
 */
export function pickLastCompetitionWeeklyContext(
  entries: readonly KidCompetitionEntryWithMatchDetail[],
  todayYmd: string,
): LastCompetitionWeeklyContext | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => {
    const c = b.eventDate.localeCompare(a.eventDate);
    if (c !== 0) return c;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const pick = sorted.find((e) => e.eventDate <= todayYmd) ?? sorted[0] ?? null;
  if (!pick) return null;

  let lastCompetitionMatchSummary: string | undefined;
  const { matches } = pick;
  if (Array.isArray(matches) && matches.length > 0) {
    let wins = 0;
    let losses = 0;
    for (const m of matches) {
      if (m.matchResult === "win") wins += 1;
      else if (m.matchResult === "loss") losses += 1;
    }
    if (wins > 0 || losses > 0) {
      lastCompetitionMatchSummary = `${wins}W · ${losses}L`;
    }
  }

  const name = typeof pick.tournamentName === "string" ? pick.tournamentName.trim() : "";
  return {
    lastCompetitionDate: pick.eventDate,
    lastCompetitionName: name || "Competition",
    ...(typeof pick.result !== "undefined" ? { lastCompetitionResult: pick.result } : {}),
    ...(lastCompetitionMatchSummary ? { lastCompetitionMatchSummary } : {}),
  };
}

export async function getLastCompetitionWeeklyContextForKid(
  kidId: string,
  todayYmd: string,
): Promise<LastCompetitionWeeklyContext | null> {
  const rows = await getKidCompetitionEntriesWithMatchDetailForKid(kidId);
  return pickLastCompetitionWeeklyContext(rows, todayYmd);
}

export async function setCompetitionDetailForEntryId(
  entryId: string,
  detail: CompetitionDetailPayload,
): Promise<void> {
  if (!entryId) return;
  const all = safeParseStore(await AsyncStorage.getItem(DETAIL_STORAGE_KEY));
  all[entryId] = detail;
  await AsyncStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(all));
  emitCompetitionChange();
}

export async function removeCompetitionDetailForEntryId(entryId: string): Promise<void> {
  if (!entryId) return;
  const all = safeParseStore(await AsyncStorage.getItem(DETAIL_STORAGE_KEY));
  if (!all[entryId]) return;
  delete all[entryId];
  await AsyncStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(all));
}

/** Up to 3 video refs in match order, for `KidCompetitionEntry.competitionVideos`. */
export function competitionVideoRefsFromMatches(
  matches: CompetitionDetailMatchSnapshot[],
): KidCompetitionVideoRef[] {
  const out: KidCompetitionVideoRef[] = [];
  for (const m of matches) {
    const u = typeof m.videoUri === "string" ? m.videoUri.trim() : "";
    if (!u) continue;
    const aid = typeof m.videoAssetId === "string" && m.videoAssetId.trim() ? m.videoAssetId.trim() : undefined;
    out.push(aid ? { uri: u, assetId: aid } : { uri: u });
    if (out.length >= 3) break;
  }
  return out;
}
