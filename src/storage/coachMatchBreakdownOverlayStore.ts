import AsyncStorage from "@react-native-async-storage/async-storage";

import { logCompOverlayMaterialize, logCompPublishGuard } from "../dev/competitionMutationDevLog";
import type {
  CoachMatchBreakdownOverlay,
  CoachMatchBreakdownOverlayIdentity,
  CoachMatchBreakdownOverlayPatch,
} from "../types/coachMatchBreakdownOverlay";
import { logMatchBreakdownAuthorityTrace } from "../dev/matchBreakdownAuthorityTrace";
import { StorageKeys } from "./storageKeys";

type OverlayByCompositeKey = Record<string, CoachMatchBreakdownOverlay>;

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function overlayCompositeKey(identity: CoachMatchBreakdownOverlayIdentity): string | null {
  const sharedAthleteId = trimmed(identity.sharedAthleteId);
  const sharedCompetitionId = trimmed(identity.sharedCompetitionId);
  const matchLineageKey = trimmed(identity.matchLineageKey);
  if (!sharedAthleteId || !sharedCompetitionId || !matchLineageKey) return null;
  return JSON.stringify([sharedAthleteId, sharedCompetitionId, matchLineageKey]);
}

function normalizeOverlay(value: unknown): CoachMatchBreakdownOverlay | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const sharedAthleteId = trimmed(row.sharedAthleteId);
  const sharedCompetitionId = trimmed(row.sharedCompetitionId);
  const matchLineageKey = trimmed(row.matchLineageKey);
  const updatedAt = trimmed(row.updatedAt);
  if (!sharedAthleteId || !sharedCompetitionId || !matchLineageKey || !updatedAt) return null;
  return {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    ...(trimmed(row.coachNote) ? { coachNote: trimmed(row.coachNote) } : {}),
    ...(trimmed(row.dictatedReflection)
      ? { dictatedReflection: trimmed(row.dictatedReflection) }
      : {}),
    ...(trimmed(row.analysis) ? { analysis: trimmed(row.analysis) } : {}),
    updatedAt,
  };
}

function safeParseStore(raw: string | null): OverlayByCompositeKey {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: OverlayByCompositeKey = {};
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      const overlay = normalizeOverlay(value);
      if (!overlay) continue;
      const key = overlayCompositeKey(overlay);
      if (key) out[key] = overlay;
    }
    return out;
  } catch {
    return {};
  }
}

async function readStore(): Promise<OverlayByCompositeKey> {
  return safeParseStore(
    await AsyncStorage.getItem(StorageKeys.coachMatchBreakdownOverlayByLineage),
  );
}

async function writeStore(map: OverlayByCompositeKey): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.coachMatchBreakdownOverlayByLineage,
    JSON.stringify(map),
  );
}

export async function readCoachMatchBreakdownOverlay(
  identity: CoachMatchBreakdownOverlayIdentity,
): Promise<CoachMatchBreakdownOverlay | null> {
  const key = overlayCompositeKey(identity);
  if (!key) {
    if (__DEV__) {
      console.log("[COMP_OVERLAY_TRACE] overlay_missing_lineage");
    }
    return null;
  }
  const overlay = (await readStore())[key] ?? null;
  if (__DEV__ && overlay) {
    console.log("[COMP_OVERLAY_TRACE] overlay_read_ok", {
      sharedAthleteId: overlay.sharedAthleteId,
      sharedCompetitionId: overlay.sharedCompetitionId,
      matchLineageKey: overlay.matchLineageKey,
    });
  }
  return overlay;
}

export async function listCoachMatchBreakdownOverlaysForAthlete(
  sharedAthleteId: string,
  traceId?: string | null,
): Promise<CoachMatchBreakdownOverlay[]> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return [];
  const map = await readStore();
  const matching = Object.values(map).filter(
    (overlay) => overlay.sharedAthleteId.trim() === athleteId,
  );
  const storedAthleteIds = [
    ...new Set(
      Object.values(map)
        .map((overlay) => overlay.sharedAthleteId.trim())
        .filter(Boolean),
    ),
  ];
  console.log("[OVERLAY_FORENSIC]", {
    stage: "overlay_list_for_publish",
    traceId: traceId?.trim() || null,
    timestamp: new Date().toISOString(),
    sourceFile: "coachMatchBreakdownOverlayStore.ts",
    sharedAthleteId: athleteId,
    requestedSharedAthleteId: athleteId,
    matchingOverlayCount: matching.length,
    storedAthleteIds,
  });
  return matching;
}

export async function deleteCoachMatchBreakdownOverlaysForCompetition(input: {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKeys?: readonly string[] | null;
}): Promise<{
  removedOverlayCount: number;
  removedMatchLineageKeys: string[];
}> {
  const sharedAthleteId = trimmed(input.sharedAthleteId);
  const sharedCompetitionId = trimmed(input.sharedCompetitionId);
  const lineageFilter =
    input.matchLineageKeys && input.matchLineageKeys.length > 0
      ? new Set(input.matchLineageKeys.map((key) => trimmed(key)).filter(Boolean))
      : null;

  if (!sharedAthleteId || !sharedCompetitionId) {
    if (__DEV__) {
      console.log("[OVERLAY_RETIREMENT_PRUNE]", {
        sharedAthleteId: sharedAthleteId || null,
        sharedCompetitionId: sharedCompetitionId || null,
        removedOverlayCount: 0,
        removedMatchLineageKeys: [],
        skipped: true,
        reason: !sharedAthleteId ? "missing_sharedAthleteId" : "missing_sharedCompetitionId",
      });
    }
    return { removedOverlayCount: 0, removedMatchLineageKeys: [] };
  }

  const map = await readStore();
  const removedMatchLineageKeys: string[] = [];
  for (const [key, overlay] of Object.entries(map)) {
    if (overlay.sharedAthleteId.trim() !== sharedAthleteId) continue;
    if (overlay.sharedCompetitionId.trim() !== sharedCompetitionId) continue;
    const matchLineageKey = overlay.matchLineageKey.trim();
    if (lineageFilter && !lineageFilter.has(matchLineageKey)) continue;
    delete map[key];
    removedMatchLineageKeys.push(matchLineageKey);
  }

  if (removedMatchLineageKeys.length > 0) {
    await writeStore(map);
  }

  if (__DEV__) {
    console.log("[OVERLAY_RETIREMENT_PRUNE]", {
      sharedAthleteId,
      sharedCompetitionId,
      removedOverlayCount: removedMatchLineageKeys.length,
      removedMatchLineageKeys,
    });
  }

  return {
    removedOverlayCount: removedMatchLineageKeys.length,
    removedMatchLineageKeys,
  };
}

export async function writeCoachMatchBreakdownOverlay(input: {
  identity: CoachMatchBreakdownOverlayIdentity;
  patch: CoachMatchBreakdownOverlayPatch;
  updatedAt: string;
  traceId?: string | null;
}): Promise<CoachMatchBreakdownOverlay | null> {
  const key = overlayCompositeKey(input.identity);
  const updatedAt = trimmed(input.updatedAt);
  if (!key || !updatedAt) {
    logMatchBreakdownAuthorityTrace("OVERLAY_STORE_WRITE_REJECTED", {
      traceId: input.traceId ?? null,
      sharedAthleteId: trimmed(input.identity.sharedAthleteId) || null,
      sharedCompetitionId: trimmed(input.identity.sharedCompetitionId) || null,
      matchLineageKey: trimmed(input.identity.matchLineageKey) || null,
      writeAccepted: false,
      reason: !key ? "missing_lineage" : "missing_updated_at",
      updatedAt: updatedAt || null,
    });
    logCompPublishGuard({
      sharedAthleteId: trimmed(input.identity.sharedAthleteId) || null,
      canonicalPayloadIds: trimmed(input.identity.sharedCompetitionId)
        ? [trimmed(input.identity.sharedCompetitionId)]
        : null,
      lineageKey: trimmed(input.identity.matchLineageKey) || null,
      operationKind: "local",
      surface: "coachMatchBreakdownOverlayStore.writeCoachMatchBreakdownOverlay",
      phaseDetail: !key ? "missing_lineage" : "missing_updated_at",
    });
    if (__DEV__) {
      console.log("[COMP_OVERLAY_TRACE] overlay_upsert_rejected", {
        reason: !key ? "missing_lineage" : "missing_updated_at",
      });
    }
    return null;
  }

  const sharedAthleteId = trimmed(input.identity.sharedAthleteId);
  const sharedCompetitionId = trimmed(input.identity.sharedCompetitionId);
  const matchLineageKey = trimmed(input.identity.matchLineageKey);
  const map = await readStore();
  const existing = map[key] ?? null;
  if (existing && updatedAt.localeCompare(existing.updatedAt) < 0) {
    logMatchBreakdownAuthorityTrace("OVERLAY_STORE_WRITE_REJECTED", {
      traceId: input.traceId ?? null,
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      writeAccepted: false,
      reason: "stale_overlay",
      updatedAt,
      existingUpdatedAt: existing.updatedAt,
    });
    logCompPublishGuard({
      sharedAthleteId,
      canonicalPayloadIds: [sharedCompetitionId],
      lineageKey: matchLineageKey,
      operationKind: "local",
      surface: "coachMatchBreakdownOverlayStore.writeCoachMatchBreakdownOverlay",
      phaseDetail: "stale_overlay",
    });
    if (__DEV__) {
      console.log("[COMP_OVERLAY_TRACE] overlay_upsert_rejected", {
        reason: "stale_overlay",
        sharedAthleteId,
        sharedCompetitionId,
        matchLineageKey,
        existingUpdatedAt: existing.updatedAt,
        incomingUpdatedAt: updatedAt,
      });
    }
    return existing;
  }
  const overlay: CoachMatchBreakdownOverlay = {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    ...(existing?.coachNote ? { coachNote: existing.coachNote } : {}),
    ...(existing?.dictatedReflection
      ? { dictatedReflection: existing.dictatedReflection }
      : {}),
    ...(existing?.analysis ? { analysis: existing.analysis } : {}),
    updatedAt,
  };

  for (const field of ["coachNote", "dictatedReflection", "analysis"] as const) {
    if (!Object.prototype.hasOwnProperty.call(input.patch, field)) continue;
    const value = trimmed(input.patch[field]);
    if (value) overlay[field] = value;
    else delete overlay[field];
  }

  map[key] = overlay;
  await writeStore(map);
  const storeOverlayCountForAthlete = Object.values(map).filter(
    (row) => row.sharedAthleteId.trim() === sharedAthleteId,
  ).length;
  const coachNote = overlay.coachNote?.trim() ?? "";
  logMatchBreakdownAuthorityTrace("OVERLAY_STORE_WRITE_COMPLETE", {
    traceId: input.traceId ?? null,
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    writeAccepted: true,
    reason: null,
    updatedAt,
    coachNoteLength: coachNote.length,
  });
  console.log("[OVERLAY_FORENSIC]", {
    stage: "overlay_write_complete",
    traceId: input.traceId?.trim() || null,
    timestamp: new Date().toISOString(),
    sourceFile: "coachMatchBreakdownOverlayStore.ts",
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    coachNotePresent: Boolean(coachNote),
    coachNoteLength: coachNote.length,
    storeOverlayCountForAthlete,
    compositeKey: key,
  });
  logCompOverlayMaterialize({
    sharedAthleteId,
    canonicalPayloadIds: [sharedCompetitionId],
    lineageKey: matchLineageKey,
    operationKind: "local",
    localStoreAffected: StorageKeys.coachMatchBreakdownOverlayByLineage,
    surface: "coachMatchBreakdownOverlayStore.writeCoachMatchBreakdownOverlay",
    phaseDetail: "overlay_persisted",
  });
  if (__DEV__) {
    console.log("[COMP_OVERLAY_TRACE] overlay_upsert_ok", {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      updatedAt,
    });
  }
  return overlay;
}
