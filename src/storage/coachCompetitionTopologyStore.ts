import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  SyncedCompetitionMatchTopology,
  SyncedCompetitionTopologyArtifact,
} from "../types/coachWeeklySync";
import { StorageKeys } from "./storageKeys";

type TopologyByAthleteId = Record<string, SyncedCompetitionTopologyArtifact>;

/** In-process mirror for synchronous render-only projection reads. */
let topologyMemory: TopologyByAthleteId | null = null;

export type CoachCompetitionTopologyWriteResult =
  | "hydrate_store_overwrite"
  | "hydrate_skipped_stale"
  | "hydrate_invalid";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableFiniteNumber(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidParentMediaRefs(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((ref) => {
    if (!ref || typeof ref !== "object" || Array.isArray(ref)) return false;
    const mediaRef = ref as Record<string, unknown>;
    return (
      (mediaRef.kind === "image" || mediaRef.kind === "video") &&
      (mediaRef.assetId === undefined ||
        mediaRef.assetId === null ||
        typeof mediaRef.assetId === "string") &&
      (mediaRef.uri === undefined || mediaRef.uri === null || typeof mediaRef.uri === "string")
    );
  });
}

function isValidMatchTopology(value: unknown): value is SyncedCompetitionMatchTopology {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const match = value as Record<string, unknown>;
  return (
    isNonEmptyString(match.matchLineageKey) &&
    typeof match.ordinal === "number" &&
    Number.isInteger(match.ordinal) &&
    match.ordinal > 0 &&
    (match.result === "win" || match.result === "loss" || match.result === null) &&
    (match.finishType === "submission" ||
      match.finishType === "points" ||
      match.finishType === "ref_decision" ||
      match.finishType === "dq" ||
      match.finishType === "injury" ||
      match.finishType === "unknown" ||
      match.finishType === null) &&
    isNullableFiniteNumber(match.durationSeconds) &&
    (match.submissionType === undefined ||
      match.submissionType === null ||
      typeof match.submissionType === "string") &&
    (match.pointsFor === undefined || isNullableFiniteNumber(match.pointsFor)) &&
    (match.pointsAgainst === undefined || isNullableFiniteNumber(match.pointsAgainst)) &&
    isValidParentMediaRefs(match.parentMediaRefs)
  );
}

export function isValidSyncedCompetitionTopologyArtifact(
  value: unknown,
): value is SyncedCompetitionTopologyArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const artifact = value as Record<string, unknown>;
  if (
    artifact.schemaVersion !== 1 ||
    !isNonEmptyString(artifact.sharedAthleteId) ||
    !isNonEmptyString(artifact.updatedAt) ||
    !Array.isArray(artifact.competitions)
  ) {
    return false;
  }

  const competitionKeys = new Set<string>();
  for (const value of artifact.competitions) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const competition = value as Record<string, unknown>;
    if (
      !isNonEmptyString(competition.sharedCompetitionId) ||
      competition.sharedAthleteId !== artifact.sharedAthleteId ||
      !isNonEmptyString(competition.competitionLineageKey) ||
      !isNonEmptyString(competition.updatedAt) ||
      !Array.isArray(competition.matches)
    ) {
      return false;
    }
    if (competitionKeys.has(competition.sharedCompetitionId)) return false;
    competitionKeys.add(competition.sharedCompetitionId);

    const matchKeys = new Set<string>();
    for (const match of competition.matches) {
      if (!isValidMatchTopology(match)) return false;
      if (matchKeys.has(match.matchLineageKey)) return false;
      matchKeys.add(match.matchLineageKey);
    }
  }

  return true;
}

function normalizeTopologyMap(raw: unknown): TopologyByAthleteId {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TopologyByAthleteId = {};
  for (const [athleteId, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = athleteId.trim();
    if (!id || !isValidSyncedCompetitionTopologyArtifact(value)) continue;
    if (value.sharedAthleteId.trim() !== id) continue;
    out[id] = value;
  }
  return out;
}

function safeParseStore(raw: string | null): TopologyByAthleteId {
  if (!raw) return {};
  try {
    return normalizeTopologyMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

async function readStore(): Promise<TopologyByAthleteId> {
  const map = safeParseStore(
    await AsyncStorage.getItem(StorageKeys.coachCompetitionTopologyByAthleteId),
  );
  topologyMemory = map;
  return map;
}

async function writeStore(map: TopologyByAthleteId): Promise<void> {
  topologyMemory = map;
  await AsyncStorage.setItem(
    StorageKeys.coachCompetitionTopologyByAthleteId,
    JSON.stringify(map),
  );
}

/** Read-only sync peek for render-only projection. Null until hydration has read or written cache. */
export function peekCoachCompetitionTopology(
  sharedAthleteId: string,
): SyncedCompetitionTopologyArtifact | null {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId || !topologyMemory) return null;
  return topologyMemory[athleteId] ?? null;
}

/** Read-only canonical topology cache for one shared athlete. */
export async function getCoachCompetitionTopology(
  sharedAthleteId: string,
): Promise<SyncedCompetitionTopologyArtifact | null> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return null;
  const map = await readStore();
  return map[athleteId] ?? null;
}

/** Newest-wins full overwrite. This cache never creates or merges topology rows locally. */
export async function writeCoachCompetitionTopology(
  artifact: SyncedCompetitionTopologyArtifact,
): Promise<CoachCompetitionTopologyWriteResult> {
  if (!isValidSyncedCompetitionTopologyArtifact(artifact)) {
    if (__DEV__) {
      console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_invalid");
    }
    return "hydrate_invalid";
  }

  const athleteId = artifact.sharedAthleteId.trim();
  const map = await readStore();
  const existing = map[athleteId] ?? null;
  if (existing && artifact.updatedAt.localeCompare(existing.updatedAt) <= 0) {
    if (__DEV__) {
      console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_skipped_stale", {
        sharedAthleteId: athleteId,
        existingUpdatedAt: existing.updatedAt,
        incomingUpdatedAt: artifact.updatedAt,
      });
    }
    return "hydrate_skipped_stale";
  }

  map[athleteId] = artifact;
  await writeStore(map);
  if (__DEV__) {
    console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_store_overwrite", {
      sharedAthleteId: athleteId,
      updatedAt: artifact.updatedAt,
      competitionCount: artifact.competitions.length,
    });
  }
  return "hydrate_store_overwrite";
}

/** Drop cached artifacts outside the authoritative linked-athlete roster. */
export async function pruneCoachCompetitionTopology(
  allowedAthleteIds: ReadonlySet<string>,
): Promise<void> {
  const allowed = new Set(
    [...allowedAthleteIds].map((id) => id.trim()).filter(Boolean),
  );
  const map = await readStore();
  let changed = false;
  for (const id of Object.keys(map)) {
    if (!allowed.has(id)) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) {
    await writeStore(map);
  }
}

export async function removeCoachCompetitionTopology(
  sharedAthleteId: string,
): Promise<void> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return;

  const map = await readStore();
  if (!(athleteId in map)) return;
  delete map[athleteId];
  await writeStore(map);
}
