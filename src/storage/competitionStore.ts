import AsyncStorage from "@react-native-async-storage/async-storage";

import { logParentCompPayload } from "../dev/parentCompPayloadTrace";
import { peekCoachMatchBreakdownArtifactSet } from "./coachMatchBreakdownArtifactStore";

import type {
  KidCompetitionEntry,
  KidCompetitionResult,
  KidCompetitionVideoRef,
} from "../types/coachKid";
import { logCompOverlayMaterialize, logCompSave } from "../dev/competitionMutationDevLog";
import {
  emitCompetitionChange,
  getKidCompetitionEntries,
  getKidCompetitionEntriesForKid,
} from "./kidCompetitionStore";

const DETAIL_STORAGE_KEY = "competitions" as const;
const SHARED_COMP_LOCAL_ID_PREFIX = "shared-comp-";

/** Extended detail for competition match rows (`DETAIL_STORAGE_KEY`). Top-level list fields use kidCompetitionStore. */
export type CompetitionDetailMatchSnapshot = {
  id: string;
  matchResult: "win" | "loss" | null;
  outcome: "Submission" | "Points" | "Ref Decision" | "DQ" | "Injury" | null;
  /** Free-form (e.g. seconds as number or mm:ss); only surfaced in UI when outcome is Submission */
  submissionTime: string | null;
  /**
   * When `outcome === "Submission"`, optional stable key (see `SUBMISSION_TYPE_CHIPS`).
   * Omitted on legacy JSON — readers treat as unknown.
   */
  submissionType?: string | null;
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
export type CompetitionDetailResolutionStrategy =
  | "direct_entry_id"
  | "canonical_shared_shell_id"
  | "exact_shared_competition_match"
  | "miss"
  | "ambiguous";

export type CompetitionDetailForEntryResolution = {
  detail: CompetitionDetailPayload | null;
  resolvedEntryId: string | null;
  resolutionStrategy: CompetitionDetailResolutionStrategy;
};

export function competitionDetailKeyForSharedCompetitionId(sharedCompetitionId: string): string {
  return `${SHARED_COMP_LOCAL_ID_PREFIX}${sharedCompetitionId.trim()}`;
}

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
  const availableKeys = Object.keys(all);
  const found = all[entryId];
  if (!found || !Array.isArray(found.matches)) {
    const reason = !found ? "entry_not_in_detail_store" : "matches_not_array";
    console.log("[COMP_DETAIL_ID_TRACE]", {
      stage: "detail_read_miss",
      requestedEntryId: entryId,
      "availableKeys.length": availableKeys.length,
      availableKeys,
      reason,
    });
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "competition_detail_store_read_miss",
      entryId,
      reason,
    });
    return null;
  }
  console.log("[COMP_DETAIL_ID_TRACE]", {
    stage: "detail_read_hit",
    requestedEntryId: entryId,
    "availableKeys.length": availableKeys.length,
    exactMatch: true,
  });
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "competition_detail_store_read_hit",
    entryId,
    matchCount: found.matches.length,
    matchIds: found.matches.map((m) => m.id),
    slotKeys: found.matches.map((m) => {
      const slotMatch = /-slot-(\d+)$/.exec(m.id.trim());
      return slotMatch ? `slot-${slotMatch[1]}` : null;
    }),
    coachNoteCount: found.matches.filter((m) => (m.coachNote ?? "").trim()).length,
  });
  return found;
}

function hasValidMatches(value: CompetitionDetailPayload | undefined): value is CompetitionDetailPayload {
  return Boolean(value && Array.isArray(value.matches));
}

function logCompetitionDetailSelectorAuthority(input: {
  entryId: string;
  sharedCompetitionId: string | null;
  resolvedEntryId: string | null;
  resolutionStrategy: CompetitionDetailResolutionStrategy;
}): void {
  console.log("[COMP_DETAIL_SELECTOR_AUTHORITY]", input);
}

function logCompetitionDetailCanonicalization(input: {
  legacyEntryId: string | null;
  canonicalKey: string | null;
  migrationPerformed: boolean;
  fallbackUsed: boolean;
  matchCount: number;
}): void {
  console.log("[COMP_DETAIL_CANONICALIZATION_TRACE]", input);
}

function deriveSharedCompetitionIdFromMatchId(matchId: string): string | null {
  const match = /^match-lineage-(.+)-slot-\d+$/.exec(matchId.trim());
  return match?.[1]?.trim() || null;
}

async function logCompetitionDetailInventory(all: StoreShape): Promise<void> {
  try {
    const shells = await getKidCompetitionEntries();
    const shellById = new Map(shells.map((shell) => [shell.id, shell] as const));
    const sharedIdToDetailOwners = new Map<string, string[]>();
    let zeroDerivedCount = 0;
    let oneDerivedCount = 0;
    let multipleDerivedCount = 0;

    for (const [detailEntryId, detail] of Object.entries(all)) {
      const matches = Array.isArray(detail?.matches) ? detail.matches : [];
      const firstFiveMatchIds = matches.slice(0, 5).map((match) => match.id);
      const firstFiveLineageKeys = firstFiveMatchIds.filter((matchId) =>
        Boolean(deriveSharedCompetitionIdFromMatchId(matchId)),
      );
      const derivedSharedCompetitionIds = [
        ...new Set(
          matches
            .map((match) => deriveSharedCompetitionIdFromMatchId(match.id))
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (derivedSharedCompetitionIds.length === 0) zeroDerivedCount += 1;
      else if (derivedSharedCompetitionIds.length === 1) oneDerivedCount += 1;
      else multipleDerivedCount += 1;

      for (const sharedCompetitionId of derivedSharedCompetitionIds) {
        const owners = sharedIdToDetailOwners.get(sharedCompetitionId) ?? [];
        owners.push(detailEntryId);
        sharedIdToDetailOwners.set(sharedCompetitionId, owners);
      }

      console.log("[COMP_DETAIL_INVENTORY_TRACE]", {
        stage: "detail_blob_inventory",
        detailEntryId,
        kidId: shellById.get(detailEntryId)?.kidId ?? null,
        matchCount: matches.length,
        coachBreakdownCount: matches.filter((match) => (match.coachNote ?? "").trim()).length,
        firstFiveMatchIds,
        firstFiveLineageKeys,
        derivedSharedCompetitionIds,
        derivationMethod:
          derivedSharedCompetitionIds.length > 0 ? "match_lineage_key" : "none",
      });
    }

    const duplicateSharedCompetitionClaims = [...sharedIdToDetailOwners.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([sharedCompetitionId, detailEntryIds]) => ({
        sharedCompetitionId,
        detailEntryIds,
      }));

    console.log("[COMP_DETAIL_INVENTORY_TRACE]", {
      stage: "inventorySummary",
      totalBlobCount: Object.keys(all).length,
      zeroDerivedSharedCompetitionIdCount: zeroDerivedCount,
      oneDerivedSharedCompetitionIdCount: oneDerivedCount,
      multipleDerivedSharedCompetitionIdCount: multipleDerivedCount,
      duplicateSharedCompetitionClaims,
    });
  } catch (error) {
    console.log("[COMP_DETAIL_INVENTORY_TRACE]", {
      stage: "inventorySummary",
      totalBlobCount: Object.keys(all).length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getCompetitionDetailForEntry(
  entry: KidCompetitionEntry,
): Promise<CompetitionDetailForEntryResolution> {
  const entryId = entry.id.trim();
  const sharedCompetitionId = entry.sharedCompetitionId?.trim() || null;
  const all = safeParseStore(await AsyncStorage.getItem(DETAIL_STORAGE_KEY));
  await logCompetitionDetailInventory(all);

  if (sharedCompetitionId) {
    const canonicalSharedShellId = competitionDetailKeyForSharedCompetitionId(sharedCompetitionId);
    if (hasValidMatches(all[canonicalSharedShellId])) {
      logCompetitionDetailCanonicalization({
        legacyEntryId: entryId || null,
        canonicalKey: canonicalSharedShellId,
        migrationPerformed: false,
        fallbackUsed: false,
        matchCount: all[canonicalSharedShellId].matches.length,
      });
      logCompetitionDetailSelectorAuthority({
        entryId,
        sharedCompetitionId,
        resolvedEntryId: canonicalSharedShellId,
        resolutionStrategy: "canonical_shared_shell_id",
      });
      return {
        detail: all[canonicalSharedShellId],
        resolvedEntryId: canonicalSharedShellId,
        resolutionStrategy: "canonical_shared_shell_id",
      };
    }
  }

  if (entryId && hasValidMatches(all[entryId])) {
    logCompetitionDetailCanonicalization({
      legacyEntryId: entryId,
      canonicalKey: sharedCompetitionId
        ? competitionDetailKeyForSharedCompetitionId(sharedCompetitionId)
        : null,
      migrationPerformed: false,
      fallbackUsed: Boolean(sharedCompetitionId),
      matchCount: all[entryId].matches.length,
    });
    logCompetitionDetailSelectorAuthority({
      entryId,
      sharedCompetitionId,
      resolvedEntryId: entryId,
      resolutionStrategy: "direct_entry_id",
    });
    return {
      detail: all[entryId],
      resolvedEntryId: entryId,
      resolutionStrategy: "direct_entry_id",
    };
  }

  if (sharedCompetitionId) {
    const shellRows = await getKidCompetitionEntriesForKid(entry.kidId);
    const exactRows = shellRows.filter(
      (row) =>
        row.id !== entryId &&
        row.kidId === entry.kidId &&
        (row.sharedCompetitionId ?? "").trim() === sharedCompetitionId,
    );
    if (exactRows.length === 1) {
      const resolvedEntryId = exactRows[0].id;
      if (!hasValidMatches(all[resolvedEntryId])) {
        logCompetitionDetailCanonicalization({
          legacyEntryId: resolvedEntryId,
          canonicalKey: competitionDetailKeyForSharedCompetitionId(sharedCompetitionId),
          migrationPerformed: false,
          fallbackUsed: false,
          matchCount: 0,
        });
        logCompetitionDetailSelectorAuthority({
          entryId,
          sharedCompetitionId,
          resolvedEntryId: null,
          resolutionStrategy: "miss",
        });
        return {
          detail: null,
          resolvedEntryId: null,
          resolutionStrategy: "miss",
        };
      }
      logCompetitionDetailCanonicalization({
        legacyEntryId: resolvedEntryId,
        canonicalKey: competitionDetailKeyForSharedCompetitionId(sharedCompetitionId),
        migrationPerformed: false,
        fallbackUsed: true,
        matchCount: all[resolvedEntryId].matches.length,
      });
      logCompetitionDetailSelectorAuthority({
        entryId,
        sharedCompetitionId,
        resolvedEntryId,
        resolutionStrategy: "exact_shared_competition_match",
      });
      return {
        detail: all[resolvedEntryId],
        resolvedEntryId,
        resolutionStrategy: "exact_shared_competition_match",
      };
    }
    if (exactRows.length > 1) {
      logCompetitionDetailCanonicalization({
        legacyEntryId: null,
        canonicalKey: competitionDetailKeyForSharedCompetitionId(sharedCompetitionId),
        migrationPerformed: false,
        fallbackUsed: false,
        matchCount: 0,
      });
      logCompetitionDetailSelectorAuthority({
        entryId,
        sharedCompetitionId,
        resolvedEntryId: null,
        resolutionStrategy: "ambiguous",
      });
      return {
        detail: null,
        resolvedEntryId: null,
        resolutionStrategy: "ambiguous",
      };
    }
  }

  logCompetitionDetailCanonicalization({
    legacyEntryId: entryId || null,
    canonicalKey: sharedCompetitionId
      ? competitionDetailKeyForSharedCompetitionId(sharedCompetitionId)
      : null,
    migrationPerformed: false,
    fallbackUsed: false,
    matchCount: 0,
  });
  logCompetitionDetailSelectorAuthority({
    entryId,
    sharedCompetitionId,
    resolvedEntryId: null,
    resolutionStrategy: "miss",
  });
  return {
    detail: null,
    resolvedEntryId: null,
    resolutionStrategy: "miss",
  };
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
      const { detail } = await getCompetitionDetailForEntry(entry);
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
  if (!k) {
    console.log("[COMP_SYNC_TRACE] getKidCompetitionEntriesWithMatchDetailForKid", {
      requestedKidId: "",
      rowsReturned: 0,
      reason: "emptyKidId",
    });
    return [];
  }
  const entries = await getKidCompetitionEntriesForKid(k);
  const merged = await mergeCompetitionMatchDetailIntoEntries(entries);
  console.log("[COMP_SYNC_TRACE] getKidCompetitionEntriesWithMatchDetailForKid", {
    requestedKidId: k,
    rowsReturned: merged.length,
  });
  for (const row of merged) {
    const athleteId = (row.sharedAthleteId ?? "").trim();
    const artifactSet = athleteId ? peekCoachMatchBreakdownArtifactSet(athleteId) : null;
    logParentCompPayload(
      "canonical_slice_hydrated_with_match_detail",
      {
        ...row,
        matchCount: row.matches.length,
        matchCoachNoteCount: row.matches.filter((m) => (m.coachNote ?? "").trim().length > 0)
          .length,
      } as unknown as Record<string, unknown>,
      artifactSet ? { [athleteId]: artifactSet } : undefined,
    );
  }
  return merged;
}

/** Competitions whose `sharedAthleteId` matches the parent Summary / `athleteStore` id (unlink-safe). */
export async function getKidCompetitionEntriesWithMatchDetailForSharedAthlete(
  sharedAthleteId: string,
): Promise<KidCompetitionEntryWithMatchDetail[]> {
  const aid = typeof sharedAthleteId === "string" ? sharedAthleteId.trim() : "";
  if (!aid) return [];
  const all = await getKidCompetitionEntries();
  const entries = all.filter((e) => (e.sharedAthleteId ?? "").trim() === aid);
  const merged = await mergeCompetitionMatchDetailIntoEntries(entries);
  const artifactSet = peekCoachMatchBreakdownArtifactSet(aid);
  const coachMatchBreakdownArtifactsForTrace = artifactSet ? { [aid]: artifactSet } : undefined;
  for (const row of merged) {
    logParentCompPayload(
      "canonical_slice_hydrated_with_match_detail",
      {
        ...row,
        matchCount: row.matches.length,
        matchCoachNoteCount: row.matches.filter((m) => (m.coachNote ?? "").trim().length > 0)
          .length,
      } as unknown as Record<string, unknown>,
      coachMatchBreakdownArtifactsForTrace,
    );
  }
  return merged;
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
  const existingKeysBefore = Object.keys(all);
  console.log("[COMP_DETAIL_ID_TRACE]", {
    stage: "detail_write_begin",
    entryId,
    "existingKeysBefore.length": existingKeysBefore.length,
    existingKeysBefore: existingKeysBefore.slice(0, 20),
  });
  all[entryId] = detail;
  await AsyncStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(all));
  const keysAfterWrite = Object.keys(all);
  const matches = Array.isArray(detail.matches) ? detail.matches : [];
  const coachBreakdownCount = matches.filter((m) => (m.coachNote ?? "").trim()).length;
  console.log("[COMP_DETAIL_ID_TRACE]", {
    stage: "detail_write_complete",
    entryId,
    "keysAfterWrite.length": keysAfterWrite.length,
    keysAfterWrite,
    matchCount: matches.length,
    coachBreakdownCount,
  });
  logCompSave("LOCAL", {
    competitionId: entryId,
    operationKind: "local",
    localStoreAffected: DETAIL_STORAGE_KEY,
    surface: "competitionStore.setCompetitionDetailForEntryId",
    overlayCount: detail.matches?.length ?? 0,
    canonicalPayloadIds: detail.matches?.map((m) => m.id) ?? null,
  });
  logCompOverlayMaterialize({
    competitionId: entryId,
    operationKind: "local",
    localStoreAffected: DETAIL_STORAGE_KEY,
    overlayCount: detail.matches?.length ?? 0,
    canonicalPayloadIds: detail.matches?.map((m) => m.id) ?? null,
    lineageKey: detail.matches?.[0]?.id ?? null,
    phaseDetail: "match_detail_persisted",
  });
  emitCompetitionChange("setCompetitionDetailForEntryId");
}

export async function setCompetitionDetailForEntry(
  entry: KidCompetitionEntry,
  detail: CompetitionDetailPayload,
): Promise<void> {
  const sharedCompetitionId = entry.sharedCompetitionId?.trim() || "";
  const detailKey = sharedCompetitionId
    ? competitionDetailKeyForSharedCompetitionId(sharedCompetitionId)
    : entry.id;
  await setCompetitionDetailForEntryId(detailKey, detail);
  logCompetitionDetailCanonicalization({
    legacyEntryId: sharedCompetitionId ? entry.id : null,
    canonicalKey: sharedCompetitionId ? detailKey : null,
    migrationPerformed: false,
    fallbackUsed: false,
    matchCount: Array.isArray(detail.matches) ? detail.matches.length : 0,
  });
}

export async function copyCompetitionDetailToCanonicalKeyForEntry(
  entry: KidCompetitionEntry,
): Promise<void> {
  const legacyEntryId = entry.id.trim();
  const sharedCompetitionId = entry.sharedCompetitionId?.trim() || "";
  if (!legacyEntryId || !sharedCompetitionId) return;

  const canonicalKey = competitionDetailKeyForSharedCompetitionId(sharedCompetitionId);
  const all = safeParseStore(await AsyncStorage.getItem(DETAIL_STORAGE_KEY));
  const canonicalDetail = all[canonicalKey];
  const legacyDetail = all[legacyEntryId];
  const canCopy = !hasValidMatches(canonicalDetail) && hasValidMatches(legacyDetail);

  if (canCopy) {
    all[canonicalKey] = legacyDetail;
    await AsyncStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(all));
    emitCompetitionChange("copyCompetitionDetailToCanonicalKeyForEntry");
  }

  logCompetitionDetailCanonicalization({
    legacyEntryId,
    canonicalKey,
    migrationPerformed: canCopy,
    fallbackUsed: false,
    matchCount: canCopy
      ? legacyDetail.matches.length
      : hasValidMatches(canonicalDetail)
        ? canonicalDetail.matches.length
        : hasValidMatches(legacyDetail)
          ? legacyDetail.matches.length
          : 0,
  });
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
