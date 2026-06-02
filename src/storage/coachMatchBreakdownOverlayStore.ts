import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  CoachMatchBreakdownOverlay,
  CoachMatchBreakdownOverlayIdentity,
  CoachMatchBreakdownOverlayPatch,
} from "../types/coachMatchBreakdownOverlay";
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

export async function writeCoachMatchBreakdownOverlay(input: {
  identity: CoachMatchBreakdownOverlayIdentity;
  patch: CoachMatchBreakdownOverlayPatch;
  updatedAt: string;
}): Promise<CoachMatchBreakdownOverlay | null> {
  const key = overlayCompositeKey(input.identity);
  const updatedAt = trimmed(input.updatedAt);
  if (!key || !updatedAt) {
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
