import AsyncStorage from "@react-native-async-storage/async-storage";

import { logMatchBreakdownAuthorityTrace } from "../dev/matchBreakdownAuthorityTrace";
import type {
  SyncedCoachMatchBreakdownArtifact,
  SyncedCoachMatchBreakdownArtifactSet,
} from "../types/coachWeeklySync";
import { StorageKeys } from "./storageKeys";

type ArtifactSetByAthleteId = Record<string, SyncedCoachMatchBreakdownArtifactSet>;

export type CoachMatchBreakdownArtifactWriteOutcome =
  | {
      status: "written";
      sharedAthleteId: string;
      incomingUpdatedAt: string;
      previousUpdatedAt: string | null;
      artifactCount: number;
    }
  | {
      status: "rejected_stale";
      sharedAthleteId: string;
      incomingUpdatedAt: string;
      existingUpdatedAt: string;
      artifactCount: number;
    }
  | {
      status: "rejected_invalid";
      sharedAthleteId: string | null;
      reason: "empty_sharedAthleteId" | "invalid_artifact_set_shape";
      artifactCount: number;
    };

let artifactMemory: ArtifactSetByAthleteId | null = null;

function slotKeyFromLineageKey(matchLineageKey: string): string | null {
  const trimmed = matchLineageKey.trim();
  const slotMatch = /-slot-(\d+)$/.exec(trimmed);
  return slotMatch ? `slot-${slotMatch[1]}` : null;
}

function artifactSetTraceSummary(
  artifactSet: SyncedCoachMatchBreakdownArtifactSet | null,
  traceAthleteId?: string,
) {
  if (!artifactSet) {
    return {
      traceAthleteId: traceAthleteId ?? null,
      artifactCount: 0,
      updatedAt: null as string | null,
      lineageKeys: [] as string[],
      slotKeys: [] as (string | null)[],
      matchIds: [] as string[],
      competitionIds: [] as string[],
    };
  }
  return {
    traceAthleteId: traceAthleteId ?? artifactSet.sharedAthleteId.trim(),
    artifactSetAthleteId: artifactSet.sharedAthleteId.trim(),
    artifactCount: artifactSet.artifacts.length,
    updatedAt: artifactSet.updatedAt,
    lineageKeys: artifactSet.artifacts.map((a) => a.matchLineageKey.trim()),
    slotKeys: artifactSet.artifacts.map((a) => slotKeyFromLineageKey(a.matchLineageKey)),
    matchIds: artifactSet.artifacts.map((a) => a.matchLineageKey.trim()),
    competitionIds: [
      ...new Set(artifactSet.artifacts.map((a) => a.sharedCompetitionId.trim()).filter(Boolean)),
    ],
  };
}

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
  const raw = await AsyncStorage.getItem(StorageKeys.coachMatchBreakdownArtifactsByAthleteId);
  const map = safeParseStore(raw);
  const athleteIds = Object.keys(map);
  const totalArtifacts = athleteIds.reduce((sum, id) => sum + (map[id]?.artifacts.length ?? 0), 0);
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "artifact_store_hydrate_read",
    memoryWasLoaded: artifactMemory !== null,
    rawBytes: raw?.length ?? 0,
    athleteCount: athleteIds.length,
    artifactCount: totalArtifacts,
    sharedAthleteIds: athleteIds,
    perAthlete: athleteIds.map((id) => artifactSetTraceSummary(map[id] ?? null, id)),
  });
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
  if (!athleteId) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_store_peek_skip",
      reason: "empty_sharedAthleteId",
      sharedAthleteId: null,
    });
    return null;
  }
  if (!artifactMemory) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_store_peek_miss",
      sharedAthleteId: athleteId,
      reason: "memory_not_loaded",
      ...artifactSetTraceSummary(null, athleteId),
    });
    return null;
  }
  const found = artifactMemory[athleteId] ?? null;
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: found ? "artifact_store_peek_hit" : "artifact_store_peek_miss",
    sharedAthleteId: athleteId,
    reason: found ? null : "athlete_not_in_memory_map",
    ...artifactSetTraceSummary(found, athleteId),
  });
  return found;
}

export async function getCoachMatchBreakdownArtifactSet(
  sharedAthleteId: string,
): Promise<SyncedCoachMatchBreakdownArtifactSet | null> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_store_get_skip",
      reason: "empty_sharedAthleteId",
      sharedAthleteId: null,
    });
    return null;
  }
  const map = await readStore();
  const found = map[athleteId] ?? null;
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: found ? "artifact_store_get_hit" : "artifact_store_get_miss",
    sharedAthleteId: athleteId,
    reason: found ? null : "athlete_not_in_disk_map",
    ...artifactSetTraceSummary(found, athleteId),
  });
  return found;
}

export async function writeCoachMatchBreakdownArtifactSet(
  artifactSet: SyncedCoachMatchBreakdownArtifactSet,
): Promise<CoachMatchBreakdownArtifactWriteOutcome> {
  const athleteId = artifactSet.sharedAthleteId.trim();
  if (!athleteId || !isValidSyncedCoachMatchBreakdownArtifactSet(artifactSet)) {
    const reason = !athleteId ? "empty_sharedAthleteId" : "invalid_artifact_set_shape";
    logMatchBreakdownAuthorityTrace("ARTIFACT_STORE_WRITE", {
      traceId: null,
      sharedAthleteId: athleteId || null,
      writeOutcome: "rejected_invalid",
      rejectedStale: false,
      storedUpdatedAt: null,
      reason,
      artifactCount: Array.isArray(artifactSet.artifacts) ? artifactSet.artifacts.length : 0,
    });
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_store_write_skip",
      reason,
      sharedAthleteId: athleteId || null,
      ...artifactSetTraceSummary(isValidSyncedCoachMatchBreakdownArtifactSet(artifactSet) ? artifactSet : null),
    });
    console.log("[COACH_OVERLAY_SYNC_TRACE]", {
      stage: "parent_overlay_hydrate_skip_invalid",
      sharedAthleteId: athleteId || null,
    });
    return {
      status: "rejected_invalid",
      sharedAthleteId: athleteId || null,
      reason,
      artifactCount: Array.isArray(artifactSet.artifacts) ? artifactSet.artifacts.length : 0,
    };
  }

  const map = await readStore();
  const existing = map[athleteId] ?? null;
  if (existing && artifactSet.updatedAt.localeCompare(existing.updatedAt) < 0) {
    logMatchBreakdownAuthorityTrace("ARTIFACT_STORE_WRITE", {
      traceId: null,
      sharedAthleteId: athleteId,
      writeOutcome: "rejected_stale",
      rejectedStale: true,
      storedUpdatedAt: existing.updatedAt,
      incomingUpdatedAt: artifactSet.updatedAt,
      artifactCount: artifactSet.artifacts.length,
    });
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_store_write_skip",
      reason: "incoming_stale_vs_existing",
      sharedAthleteId: athleteId,
      incomingUpdatedAt: artifactSet.updatedAt,
      existingUpdatedAt: existing.updatedAt,
      incoming: artifactSetTraceSummary(artifactSet),
      existing: artifactSetTraceSummary(existing),
    });
    console.log("[COACH_OVERLAY_SYNC_TRACE]", {
      stage: "parent_overlay_hydrate_skip_stale",
      sharedAthleteId: athleteId,
      incomingUpdatedAt: artifactSet.updatedAt,
      existingUpdatedAt: existing.updatedAt,
      artifactCount: artifactSet.artifacts.length,
    });
    return {
      status: "rejected_stale",
      sharedAthleteId: athleteId,
      incomingUpdatedAt: artifactSet.updatedAt,
      existingUpdatedAt: existing.updatedAt,
      artifactCount: artifactSet.artifacts.length,
    };
  }

  map[athleteId] = artifactSet;
  await writeStore(map);
  logMatchBreakdownAuthorityTrace("ARTIFACT_STORE_WRITE", {
    traceId: null,
    sharedAthleteId: athleteId,
    writeOutcome: "written",
    rejectedStale: false,
    storedUpdatedAt: artifactSet.updatedAt,
    previousUpdatedAt: existing?.updatedAt ?? null,
    artifactCount: artifactSet.artifacts.length,
  });
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "parent_artifact_store_write",
    sharedAthleteId: athleteId,
    sharedCompetitionId: artifactSet.artifacts[0]?.sharedCompetitionId ?? null,
    matchLineageKey: artifactSet.artifacts[0]?.matchLineageKey ?? null,
    overlayCount: artifactSet.artifacts.length,
    artifacts: artifactSet.artifacts.map((artifact) => ({
      sharedAthleteId: artifact.sharedAthleteId,
      sharedCompetitionId: artifact.sharedCompetitionId,
      matchLineageKey: artifact.matchLineageKey,
      hasCoachNote: Boolean(artifact.coachNote?.trim()),
    })),
    updatedAt: artifactSet.updatedAt,
  });
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
  return {
    status: "written",
    sharedAthleteId: athleteId,
    incomingUpdatedAt: artifactSet.updatedAt,
    previousUpdatedAt: existing?.updatedAt ?? null,
    artifactCount: artifactSet.artifacts.length,
  };
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
