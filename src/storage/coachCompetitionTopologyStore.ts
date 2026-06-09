import AsyncStorage from "@react-native-async-storage/async-storage";

import { logCompetitionTopologyTrace } from "../dev/competitionTopologyTrace";
import {
  logCacheProvenance,
  logKeyRead,
  logKeyWrite,
} from "../dev/persistenceAudit";
import type {
  SyncedCompetitionMatchTopology,
  SyncedCompetitionTopologyArtifact,
} from "../types/coachWeeklySync";
import { emitCompetitionChange } from "./kidCompetitionStore";
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

function logCoachTopologyMatchTrace(
  stage: string,
  artifact: SyncedCompetitionTopologyArtifact,
  extra?: Record<string, unknown>,
): void {
  for (const competition of artifact.competitions) {
    console.log("[COACH_TOPOLOGY_MATCH_TRACE]", {
      stage,
      sharedCompetitionId: competition.sharedCompetitionId,
      updatedAt: artifact.updatedAt,
      matchCount: competition.matches.length,
      firstFiveMatchIds: competition.matches
        .slice(0, 5)
        .map((match) => match.matchLineageKey),
      firstFiveMatchResults: competition.matches.slice(0, 5).map((match) => match.result),
      ...extra,
    });
  }
}

function topologyMatchCountForCompetition(
  artifact: SyncedCompetitionTopologyArtifact | null,
  sharedCompetitionId: string,
): number | null {
  if (!artifact) return null;
  const competition = artifact.competitions.find(
    (candidate) => candidate.sharedCompetitionId === sharedCompetitionId,
  );
  return competition ? competition.matches.length : null;
}

function logCoachTopologyAcceptanceTrace(input: {
  artifact: SyncedCompetitionTopologyArtifact;
  existing: SyncedCompetitionTopologyArtifact | null;
  overwriteAccepted: boolean;
  rejectionReason: string | null;
  equalitySkipped: boolean;
  cacheWritePerformed: boolean;
  invalidateTriggered: boolean;
}): void {
  for (const competition of input.artifact.competitions) {
    console.log("[COACH_TOPOLOGY_ACCEPTANCE_TRACE]", {
      sharedCompetitionId: competition.sharedCompetitionId,
      incomingUpdatedAt: input.artifact.updatedAt,
      existingUpdatedAt: input.existing?.updatedAt ?? null,
      incomingMatchCount: competition.matches.length,
      existingMatchCount: topologyMatchCountForCompetition(
        input.existing,
        competition.sharedCompetitionId,
      ),
      overwriteAccepted: input.overwriteAccepted,
      rejectionReason: input.rejectionReason,
      equalitySkipped: input.equalitySkipped,
      cacheWritePerformed: input.cacheWritePerformed,
      invalidateTriggered: input.invalidateTriggered,
    });
  }
}

function logCoachTopologyAcceptanceCacheTrace(input: {
  stage: string;
  sharedAthleteId: string | null;
  artifact: SyncedCompetitionTopologyArtifact | null;
  rejectionReason: string | null;
}): void {
  if (!input.artifact) {
    console.log("[COACH_TOPOLOGY_ACCEPTANCE_TRACE]", {
      sharedCompetitionId: null,
      incomingUpdatedAt: null,
      existingUpdatedAt: null,
      incomingMatchCount: null,
      existingMatchCount: null,
      overwriteAccepted: false,
      rejectionReason: input.rejectionReason,
      equalitySkipped: false,
      cacheWritePerformed: false,
      invalidateTriggered: false,
      stage: input.stage,
      sharedAthleteId: input.sharedAthleteId,
    });
    return;
  }

  for (const competition of input.artifact.competitions) {
    console.log("[COACH_TOPOLOGY_ACCEPTANCE_TRACE]", {
      sharedCompetitionId: competition.sharedCompetitionId,
      incomingUpdatedAt: null,
      existingUpdatedAt: input.artifact.updatedAt,
      incomingMatchCount: null,
      existingMatchCount: competition.matches.length,
      overwriteAccepted: false,
      rejectionReason: input.rejectionReason,
      equalitySkipped: false,
      cacheWritePerformed: false,
      invalidateTriggered: false,
      stage: input.stage,
      sharedAthleteId: input.sharedAthleteId,
    });
  }
}

async function readStore(): Promise<TopologyByAthleteId> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachCompetitionTopologyByAthleteId);
  logKeyRead({
    key: StorageKeys.coachCompetitionTopologyByAthleteId,
    raw,
    source: "coachCompetitionTopologyStore.readStore",
  });
  const map = safeParseStore(raw);
  const artifacts = Object.values(map);
  const updatedAts = artifacts.map((artifact) => artifact.updatedAt).sort();
  logCacheProvenance({
    key: StorageKeys.coachCompetitionTopologyByAthleteId,
    raw,
    source: "coachCompetitionTopologyStore.readStore",
    readKind: "diskRead",
    athleteIds: Object.keys(map),
    sharedAthleteIds: Object.keys(map),
    updatedAt: updatedAts[updatedAts.length - 1] ?? null,
    entityCounts: {
      artifactCount: artifacts.length,
      competitionCount: artifacts.reduce(
        (sum, artifact) => sum + artifact.competitions.length,
        0,
      ),
      matchCount: artifacts.reduce(
        (sum, artifact) =>
          sum +
          artifact.competitions.reduce(
            (inner, competition) => inner + competition.matches.length,
            0,
          ),
        0,
      ),
    },
  });
  topologyMemory = map;
  return map;
}

async function writeStore(map: TopologyByAthleteId): Promise<void> {
  topologyMemory = map;
  const raw = JSON.stringify(map);
  logKeyWrite({
    key: StorageKeys.coachCompetitionTopologyByAthleteId,
    raw,
    source: "coachCompetitionTopologyStore.writeStore",
    extra: { artifactCount: Object.keys(map).length },
  });
  await AsyncStorage.setItem(
    StorageKeys.coachCompetitionTopologyByAthleteId,
    raw,
  );
}

/** Read-only sync peek for render-only projection. Null until hydration has read or written cache. */
export function peekCoachCompetitionTopology(
  sharedAthleteId: string,
): SyncedCompetitionTopologyArtifact | null {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) {
    if (__DEV__) {
      logCoachTopologyAcceptanceCacheTrace({
        stage: "cache_peek_skipped_empty_athlete",
        sharedAthleteId: null,
        artifact: null,
        rejectionReason: "empty_shared_athlete_id",
      });
    }
    return null;
  }
  if (!topologyMemory) {
    if (__DEV__) {
      logCoachTopologyAcceptanceCacheTrace({
        stage: "cache_peek_memory_not_loaded",
        sharedAthleteId: athleteId,
        artifact: null,
        rejectionReason: "memory_not_loaded",
      });
    }
    return null;
  }
  const artifact = topologyMemory[athleteId] ?? null;
  logCacheProvenance({
    key: StorageKeys.coachCompetitionTopologyByAthleteId,
    source: "coachCompetitionTopologyStore.peekCoachCompetitionTopology",
    readKind: "memoryRead",
    athleteIds: athleteId ? [athleteId] : [],
    sharedAthleteIds: athleteId ? [athleteId] : [],
    updatedAt: artifact?.updatedAt ?? null,
    entityCounts: { memoryEntryCount: Object.keys(topologyMemory).length },
    extra: { hit: Boolean(artifact) },
  });
  if (__DEV__) {
    logCoachTopologyAcceptanceCacheTrace({
      stage: artifact ? "cache_peek_hit" : "cache_peek_miss",
      sharedAthleteId: athleteId,
      artifact,
      rejectionReason: artifact ? null : "no_artifact_for_shared_athlete",
    });
  }
  return artifact;
}

/** Read-only canonical topology cache for one shared athlete. */
export async function getCoachCompetitionTopology(
  sharedAthleteId: string,
): Promise<SyncedCompetitionTopologyArtifact | null> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) {
    if (__DEV__) {
      logCoachTopologyAcceptanceCacheTrace({
        stage: "cache_read_skipped_empty_athlete",
        sharedAthleteId: null,
        artifact: null,
        rejectionReason: "empty_shared_athlete_id",
      });
    }
    return null;
  }
  const map = await readStore();
  const artifact = map[athleteId] ?? null;
  if (__DEV__) {
    logCoachTopologyAcceptanceCacheTrace({
      stage: artifact ? "cache_read_hit" : "cache_read_miss",
      sharedAthleteId: athleteId,
      artifact,
      rejectionReason: artifact ? null : "no_artifact_for_shared_athlete",
    });
  }
  return artifact;
}

/** Newest-wins full overwrite. This cache never creates or merges topology rows locally. */
export async function writeCoachCompetitionTopology(
  artifact: SyncedCompetitionTopologyArtifact,
  competitionTopologyTraceId?: string,
): Promise<CoachCompetitionTopologyWriteResult> {
  if (!isValidSyncedCompetitionTopologyArtifact(artifact)) {
    if (__DEV__) {
      console.log("[COACH_TOPOLOGY_ACCEPTANCE_TRACE]", {
        sharedCompetitionId: null,
        incomingUpdatedAt: null,
        existingUpdatedAt: null,
        incomingMatchCount: null,
        existingMatchCount: null,
        overwriteAccepted: false,
        rejectionReason: "invalid_topology_artifact",
        equalitySkipped: false,
        cacheWritePerformed: false,
        invalidateTriggered: false,
      });
      console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_invalid");
      logCompetitionTopologyTrace("[COMP_TOPOLOGY_HYDRATE]", "hydrate_invalid", {
        traceId: competitionTopologyTraceId ?? null,
      });
    }
    return "hydrate_invalid";
  }

  const athleteId = artifact.sharedAthleteId.trim();
  const map = await readStore();
  const existing = map[athleteId] ?? null;
  const totalMatchCount = artifact.competitions.reduce(
    (sum, competition) => sum + competition.matches.length,
    0,
  );
  logCompetitionTopologyTrace("[COMP_TOPOLOGY_HYDRATE]", "cache_write_received", {
    traceId: competitionTopologyTraceId ?? null,
    sharedAthleteId: athleteId,
    competitionCount: artifact.competitions.length,
    totalMatchCount,
    lineageKeyCount: totalMatchCount,
    incomingUpdatedAt: artifact.updatedAt,
    existingUpdatedAt: existing?.updatedAt ?? null,
  });
  if (__DEV__) {
    logCoachTopologyAcceptanceTrace({
      artifact,
      existing,
      overwriteAccepted: false,
      rejectionReason: null,
      equalitySkipped: false,
      cacheWritePerformed: false,
      invalidateTriggered: false,
    });
  }
  const updatedAtComparison = existing
    ? artifact.updatedAt.localeCompare(existing.updatedAt)
    : 1;
  const payloadEqual = existing ? JSON.stringify(artifact) === JSON.stringify(existing) : false;
  if (existing && updatedAtComparison === 0) {
    console.log("[TOPOLOGY_EQUALITY_ARBITRATION]", {
      sharedAthleteId: athleteId,
      incomingUpdatedAt: artifact.updatedAt,
      existingUpdatedAt: existing.updatedAt,
      payloadEqual,
      incomingCompetitionIds: artifact.competitions.map(
        (competition) => competition.sharedCompetitionId,
      ),
      incomingMatchCounts: artifact.competitions.map((competition) => ({
        sharedCompetitionId: competition.sharedCompetitionId,
        matchCount: competition.matches.length,
      })),
      overwriteDecision: payloadEqual ? "skip_idempotent_replay" : "overwrite_equal_timestamp",
    });
    if (payloadEqual) {
      if (__DEV__) {
        logCoachTopologyAcceptanceTrace({
          artifact,
          existing,
          overwriteAccepted: true,
          rejectionReason: "equal_timestamp_idempotent_replay",
          equalitySkipped: true,
          cacheWritePerformed: false,
          invalidateTriggered: false,
        });
        logCoachTopologyMatchTrace("coach_topology_store_write", artifact, {
          incomingUpdatedAt: artifact.updatedAt,
          existingUpdatedAt: existing.updatedAt,
          accepted: true,
          overwriteReason: "equal_timestamp_idempotent_replay",
        });
        console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_skipped_stale", {
          sharedAthleteId: athleteId,
          existingUpdatedAt: existing.updatedAt,
          incomingUpdatedAt: artifact.updatedAt,
          reason: "equal_timestamp_idempotent_replay",
          traceId: competitionTopologyTraceId ?? null,
        });
      }
      return "hydrate_skipped_stale";
    }
  }
  if (existing && updatedAtComparison < 0) {
    if (__DEV__) {
      logCoachTopologyAcceptanceTrace({
        artifact,
        existing,
        overwriteAccepted: false,
        rejectionReason: "incoming_older_updatedAt_rejected",
        equalitySkipped: false,
        cacheWritePerformed: false,
        invalidateTriggered: false,
      });
      logCoachTopologyMatchTrace("coach_topology_store_write", artifact, {
        incomingUpdatedAt: artifact.updatedAt,
        existingUpdatedAt: existing.updatedAt,
        accepted: false,
        overwriteReason: "incoming_older_rejected",
      });
      console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_skipped_stale", {
        sharedAthleteId: athleteId,
        existingUpdatedAt: existing.updatedAt,
        incomingUpdatedAt: artifact.updatedAt,
        traceId: competitionTopologyTraceId ?? null,
      });
    }
    return "hydrate_skipped_stale";
  }

  map[athleteId] = artifact;
  await writeStore(map);
  if (__DEV__) {
    logCoachTopologyAcceptanceTrace({
      artifact,
      existing,
      overwriteAccepted: true,
      rejectionReason: null,
      equalitySkipped: false,
      cacheWritePerformed: true,
      invalidateTriggered: false,
    });
    logCoachTopologyMatchTrace("coach_topology_store_write", artifact, {
      incomingUpdatedAt: artifact.updatedAt,
      existingUpdatedAt: existing?.updatedAt ?? null,
      accepted: true,
      overwriteReason: existing ? "newer_overwrite" : "first_write",
    });
    console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_store_overwrite", {
      sharedAthleteId: athleteId,
      updatedAt: artifact.updatedAt,
      competitionCount: artifact.competitions.length,
      totalMatchCount,
      lineageKeyCount: totalMatchCount,
      traceId: competitionTopologyTraceId ?? null,
    });
    console.log("[COACH_COMPETE_DETAIL_TRACE]", {
      stage: "canonical_detail_hydrate",
      sharedAthleteId: athleteId,
      updatedAt: artifact.updatedAt,
      competitionCount: artifact.competitions.length,
      projectedMatchCounts: artifact.competitions.map((competition) => ({
        sharedCompetitionId: competition.sharedCompetitionId,
        matchCount: competition.matches.length,
        matchLineageKeys: competition.matches.map((match) => match.matchLineageKey),
      })),
      invalidation: "competition_store_emit",
    });
  }
  emitCompetitionChange("writeCoachCompetitionTopology");
  if (__DEV__) {
    logCoachTopologyAcceptanceTrace({
      artifact,
      existing,
      overwriteAccepted: true,
      rejectionReason: null,
      equalitySkipped: false,
      cacheWritePerformed: true,
      invalidateTriggered: true,
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
