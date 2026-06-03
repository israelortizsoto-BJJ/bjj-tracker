import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  SyncedCoachMatchBreakdownArtifact,
  SyncedCoachMatchBreakdownArtifactSet,
} from "../types/coachWeeklySync";
import { StorageKeys } from "./storageKeys";

type ArtifactSetByAthleteId = Record<string, SyncedCoachMatchBreakdownArtifactSet>;

let artifactMemory: ArtifactSetByAthleteId | null = null;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidArtifact(value: unknown): value is SyncedCoachMatchBreakdownArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const artifact = value as Record<string, unknown>;
  return (
    isNonEmptyString(artifact.sharedAthleteId) &&
    isNonEmptyString(artifact.sharedCompetitionId) &&
    isNonEmptyString(artifact.matchLineageKey) &&
    isNonEmptyString(artifact.updatedAt) &&
    (artifact.coachNote === undefined || typeof artifact.coachNote === "string")
  );
}

export function isValidSyncedCoachMatchBreakdownArtifactSet(
  value: unknown,
): value is SyncedCoachMatchBreakdownArtifactSet {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const set = value as Record<string, unknown>;
  if (
    set.schemaVersion !== 1 ||
    !isNonEmptyString(set.sharedAthleteId) ||
    !isNonEmptyString(set.updatedAt) ||
    !Array.isArray(set.artifacts)
  ) {
    return false;
  }

  const identityKeys = new Set<string>();
  for (const artifact of set.artifacts) {
    if (!isValidArtifact(artifact)) return false;
    if (artifact.sharedAthleteId.trim() !== set.sharedAthleteId.trim()) return false;
    const identityKey = JSON.stringify([
      artifact.sharedAthleteId.trim(),
      artifact.sharedCompetitionId.trim(),
      artifact.matchLineageKey.trim(),
    ]);
    if (identityKeys.has(identityKey)) return false;
    identityKeys.add(identityKey);
  }
  return true;
}

function normalizeMap(raw: unknown): ArtifactSetByAthleteId {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ArtifactSetByAthleteId = {};
  for (const [athleteId, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = athleteId.trim();
    if (!id || !isValidSyncedCoachMatchBreakdownArtifactSet(value)) continue;
    if (value.sharedAthleteId.trim() !== id) continue;
    out[id] = value;
  }
  return out;
}

function safeParseStore(raw: string | null): ArtifactSetByAthleteId {
  if (!raw) return {};
  try {
    return normalizeMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

async function readStore(): Promise<ArtifactSetByAthleteId> {
  const map = safeParseStore(
    await AsyncStorage.getItem(StorageKeys.coachMatchBreakdownArtifactsByAthleteId),
  );
  artifactMemory = map;
  return map;
}

async function writeStore(map: ArtifactSetByAthleteId): Promise<void> {
  artifactMemory = map;
  await AsyncStorage.setItem(
    StorageKeys.coachMatchBreakdownArtifactsByAthleteId,
    JSON.stringify(map),
  );
}

export function peekCoachMatchBreakdownArtifactSet(
  sharedAthleteId: string,
): SyncedCoachMatchBreakdownArtifactSet | null {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId || !artifactMemory) return null;
  return artifactMemory[athleteId] ?? null;
}

export async function getCoachMatchBreakdownArtifactSet(
  sharedAthleteId: string,
): Promise<SyncedCoachMatchBreakdownArtifactSet | null> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return null;
  const map = await readStore();
  return map[athleteId] ?? null;
}

export async function writeCoachMatchBreakdownArtifactSet(
  artifactSet: SyncedCoachMatchBreakdownArtifactSet,
): Promise<void> {
  const athleteId = artifactSet.sharedAthleteId.trim();
  if (!athleteId || !isValidSyncedCoachMatchBreakdownArtifactSet(artifactSet)) {
    console.log("[COACH_OVERLAY_SYNC_TRACE]", {
      stage: "parent_overlay_hydrate_skip_invalid",
      sharedAthleteId: athleteId || null,
    });
    return;
  }

  const map = await readStore();
  const existing = map[athleteId] ?? null;
  if (existing && artifactSet.updatedAt.localeCompare(existing.updatedAt) < 0) {
    console.log("[COACH_OVERLAY_SYNC_TRACE]", {
      stage: "parent_overlay_hydrate_skip_stale",
      sharedAthleteId: athleteId,
      incomingUpdatedAt: artifactSet.updatedAt,
      existingUpdatedAt: existing.updatedAt,
      artifactCount: artifactSet.artifacts.length,
    });
    return;
  }

  map[athleteId] = artifactSet;
  await writeStore(map);
  const artifactsByCompetitionId = new Map<string, number>();
  for (const artifact of artifactSet.artifacts) {
    const compId = artifact.sharedCompetitionId.trim();
    if (!compId) continue;
    artifactsByCompetitionId.set(compId, (artifactsByCompetitionId.get(compId) ?? 0) + 1);
  }
  for (const [competitionId, coachMatchBreakdownArtifactsForComp] of artifactsByCompetitionId) {
    console.log(
      "[PARENT_COMP_PAYLOAD]",
      JSON.stringify(
        {
          stage: "artifact_store_hydrate_write",
          competitionId,
          sharedAthleteId: athleteId,
          overlayCount: 0,
          coachMatchBreakdownArtifactsForComp,
          overlayKeys: [],
          keys: ["coachMatchBreakdownArtifacts"],
        },
        null,
        2,
      ),
    );
  }
  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "parent_overlay_hydrate_write",
    sharedAthleteId: athleteId,
    artifactCount: artifactSet.artifacts.length,
    lineageIds: artifactSet.artifacts.map((artifact) => artifact.matchLineageKey),
    updatedAt: artifactSet.updatedAt,
  });
}

export async function removeCoachMatchBreakdownArtifactSet(sharedAthleteId: string): Promise<void> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return;
  const map = await readStore();
  if (!(athleteId in map)) return;
  delete map[athleteId];
  await writeStore(map);
  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "parent_overlay_hydrate_remove",
    sharedAthleteId: athleteId,
  });
}

export async function pruneCoachMatchBreakdownArtifactSets(
  allowedAthleteIds: ReadonlySet<string>,
): Promise<void> {
  const allowed = new Set([...allowedAthleteIds].map((id) => id.trim()).filter(Boolean));
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
  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "parent_overlay_hydrate_prune",
    removedAthleteIds: removed,
    allowedCount: allowed.size,
  });
}
