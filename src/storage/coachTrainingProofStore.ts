import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SyncedTrainingProofArtifact } from "../types/coachWeeklySync";
import { StorageKeys } from "./storageKeys";

type ProofByAthleteId = Record<string, SyncedTrainingProofArtifact>;

/** In-process mirror of the last disk read/write for synchronous coach Summary overlay reads. */
let proofMemory: ProofByAthleteId | null = null;

function syncProofMemory(map: ProofByAthleteId): void {
  proofMemory = map;
}

/** Read-only sync peek (memory only; returns null until store has been read or written). */
export function peekCoachTrainingProof(
  sharedAthleteId: string,
): SyncedTrainingProofArtifact | null {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId || !proofMemory) return null;
  const artifact = proofMemory[athleteId] ?? null;
  if (!artifact || artifact.sharedAthleteId.trim() !== athleteId) return null;
  return artifact;
}

function safeParseStore(raw: string | null): ProofByAthleteId {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return normalizeProofMap(parsed);
  } catch {
    return {};
  }
}

function isValidRankedItem(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.key === "string" &&
    typeof o.label === "string" &&
    typeof o.count === "number" &&
    Number.isFinite(o.count)
  );
}

export function isValidSyncedTrainingProofArtifact(
  v: unknown,
): v is SyncedTrainingProofArtifact {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.sharedAthleteId === "string" &&
    typeof o.updatedAt === "string" &&
    typeof o.currentWeekSessionCount === "number" &&
    typeof o.weeklyGoalMet === "boolean" &&
    (o.lastTrainingDateYMD === null ||
      (typeof o.lastTrainingDateYMD === "string" && o.lastTrainingDateYMD.length > 0)) &&
    (o.dominantSystemKey === null || typeof o.dominantSystemKey === "string") &&
    Array.isArray(o.topSystems) &&
    o.topSystems.every(isValidRankedItem) &&
    Array.isArray(o.topTechniques) &&
    o.topTechniques.every(isValidRankedItem)
  );
}

function normalizeProofMap(raw: unknown): ProofByAthleteId {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ProofByAthleteId = {};
  for (const [athleteId, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = athleteId.trim();
    if (!id || !isValidSyncedTrainingProofArtifact(value)) continue;
    if (value.sharedAthleteId.trim() !== id) continue;
    out[id] = value;
  }
  return out;
}

async function readStore(): Promise<ProofByAthleteId> {
  const map = safeParseStore(
    await AsyncStorage.getItem(StorageKeys.coachTrainingProofByAthleteId),
  );
  syncProofMemory(map);
  return map;
}

async function writeStore(map: ProofByAthleteId): Promise<void> {
  syncProofMemory(map);
  await AsyncStorage.setItem(StorageKeys.coachTrainingProofByAthleteId, JSON.stringify(map));
}

/** Read-only coach projection: bounded training proof for `sharedAthleteId`. */
export async function getCoachTrainingProof(
  sharedAthleteId: string,
): Promise<SyncedTrainingProofArtifact | null> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return null;
  const map = await readStore();
  return map[athleteId] ?? null;
}

/** Overwrite-only: replaces any prior artifact for this athlete id. */
export async function writeCoachTrainingProof(
  artifact: SyncedTrainingProofArtifact,
): Promise<void> {
  const athleteId = artifact.sharedAthleteId.trim();
  if (!athleteId || !isValidSyncedTrainingProofArtifact(artifact)) {
    if (__DEV__) {
      console.log("[TRAINING_PROOF_HYDRATE] hydrate_skip_invalid", {
        sharedAthleteId: athleteId || null,
      });
    }
    return;
  }
  if (artifact.sharedAthleteId.trim() !== athleteId) {
    if (__DEV__) {
      console.log("[TRAINING_PROOF_HYDRATE] hydrate_skip_invalid", {
        sharedAthleteId: athleteId,
        reason: "sharedAthleteIdKeyMismatch",
      });
    }
    return;
  }

  const map = await readStore();
  const existing = map[athleteId] ?? null;
  const existingCount = existing?.currentWeekSessionCount ?? null;
  const existingUpdatedAt = existing?.updatedAt ?? null;
  const incomingCount = artifact.currentWeekSessionCount;
  const incomingUpdatedAt = artifact.updatedAt;

  let overwriteReason: string;
  if (!existing) {
    overwriteReason = "no_existing";
  } else if (incomingUpdatedAt.localeCompare(existingUpdatedAt) > 0) {
    overwriteReason = "incoming_newer";
  } else if (incomingUpdatedAt.localeCompare(existingUpdatedAt) < 0) {
    overwriteReason = "incoming_older_unconditional_replace";
  } else {
    overwriteReason = "same_updatedAt_replace";
  }

  map[athleteId] = artifact;
  await writeStore(map);

  if (__DEV__) {
    console.log("[TRAINING_PROOF_COACH_RECEIVE]", {
      athleteId,
      incomingCount,
      incomingUpdatedAt,
      existingCount,
      existingUpdatedAt,
      overwriteApplied: true,
      overwriteReason,
    });
    console.log("[TRAINING_PROOF_HYDRATE] hydrate_write", {
      sharedAthleteId: athleteId,
      updatedAt: artifact.updatedAt,
    });
  }
}

export async function removeCoachTrainingProof(sharedAthleteId: string): Promise<void> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return;

  const map = await readStore();
  if (!(athleteId in map)) return;
  delete map[athleteId];
  await writeStore(map);

  if (__DEV__) {
    console.log("[TRAINING_PROOF_HYDRATE] hydrate_prune", {
      sharedAthleteId: athleteId,
      reason: "remove",
    });
  }
}

/**
 * Drop artifacts whose `sharedAthleteId` is not in `allowedAthleteIds`.
 * Overwrite-only store hygiene after roster/session reconcile.
 */
export async function pruneCoachTrainingProof(
  allowedAthleteIds: ReadonlySet<string>,
): Promise<void> {
  const allowed = new Set(
    [...allowedAthleteIds].map((id) => id.trim()).filter(Boolean),
  );
  const map = await readStore();
  const removed: string[] = [];
  for (const id of Object.keys(map)) {
    if (!allowed.has(id)) {
      delete map[id];
      removed.push(id);
    }
  }
  if (removed.length === 0) return;
  await writeStore(map);
  if (__DEV__) {
    console.log("[TRAINING_PROOF_HYDRATE] hydrate_prune", {
      removedAthleteIds: removed,
      allowedCount: allowed.size,
    });
  }
}
