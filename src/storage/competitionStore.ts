import AsyncStorage from "@react-native-async-storage/async-storage";

import { emitCompetitionChange } from "./kidCompetitionStore";
import type { KidCompetitionVideoRef } from "../types/coachKid";

const STORAGE_KEY = "competitions" as const;

/** Extended detail for `app/competition/[id].tsx` (per-match rows). Top-level list fields use kidCompetitionStore. */
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
  const all = safeParseStore(await AsyncStorage.getItem(STORAGE_KEY));
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
  const all = safeParseStore(await AsyncStorage.getItem(STORAGE_KEY));
  const found = all[entryId];
  if (!found || !Array.isArray(found.matches)) return null;
  return found;
}

export async function setCompetitionDetailForEntryId(
  entryId: string,
  detail: CompetitionDetailPayload,
): Promise<void> {
  if (!entryId) return;
  const all = safeParseStore(await AsyncStorage.getItem(STORAGE_KEY));
  all[entryId] = detail;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  emitCompetitionChange();
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
