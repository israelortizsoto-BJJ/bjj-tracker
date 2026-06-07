import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import {
  logCacheProvenance,
  logKeyRead,
  logKeyWrite,
} from "../dev/persistenceAudit";
import type { SyncedCompetitionAggregateArtifact } from "../types/coachWeeklySync";
import { StorageKeys } from "./storageKeys";

type AggregateByAthleteId = Record<string, SyncedCompetitionAggregateArtifact>;

/** In-process mirror of the last disk read/write for synchronous coach Summary overlay reads. */
let aggregatesMemory: AggregateByAthleteId | null = null;
const listeners = new Set<() => void>();
let aggregateVersion = 0;

function syncAggregatesMemory(map: AggregateByAthleteId): void {
  aggregatesMemory = map;
}

function emitCoachCompetitionAggregateChange(context: {
  reason: string;
  sharedAthleteId?: string | null;
  updatedAt?: string | null;
}): void {
  aggregateVersion += 1;
  if (__DEV__) {
    console.log("[COACH_SUMMARY_AGGREGATE_TRACE]", {
      stage: "subscriber_notification",
      reason: context.reason,
      sharedAthleteId: context.sharedAthleteId ?? null,
      updatedAt: context.updatedAt ?? null,
      aggregateVersion,
      listenerCount: listeners.size,
    });
  }
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  }
}

export function getCoachCompetitionAggregateVersion(): number {
  return aggregateVersion;
}

export function subscribeCoachCompetitionAggregate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCoachCompetitionAggregateVersion(): number {
  return useSyncExternalStore(
    subscribeCoachCompetitionAggregate,
    getCoachCompetitionAggregateVersion,
    getCoachCompetitionAggregateVersion,
  );
}

/** Read-only sync peek (memory only; returns null until store has been read or written). */
export function peekCoachCompetitionAggregate(
  sharedAthleteId: string,
): SyncedCompetitionAggregateArtifact | null {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId || !aggregatesMemory) return null;
  const artifact = aggregatesMemory[athleteId] ?? null;
  logCacheProvenance({
    key: StorageKeys.coachCompetitionAggregatesByAthleteId,
    source: "coachCompetitionAggregateStore.peekCoachCompetitionAggregate",
    readKind: "memoryRead",
    athleteIds: athleteId ? [athleteId] : [],
    sharedAthleteIds: athleteId ? [athleteId] : [],
    updatedAt: artifact?.updatedAt ?? null,
    entityCounts: { memoryEntryCount: Object.keys(aggregatesMemory).length },
    extra: { hit: Boolean(artifact) },
  });
  if (!artifact || artifact.sharedAthleteId.trim() !== athleteId) return null;
  return artifact;
}

function safeParseStore(raw: string | null): AggregateByAthleteId {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return normalizeAggregateMap(parsed);
  } catch {
    return {};
  }
}

export function isValidSyncedCompetitionAggregateArtifact(
  v: unknown,
): v is SyncedCompetitionAggregateArtifact {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.sharedAthleteId === "string" &&
    typeof o.updatedAt === "string" &&
    typeof o.totalCompetitions === "number" &&
    typeof o.totalMatches === "number" &&
    typeof o.wins === "number" &&
    typeof o.losses === "number"
  );
}

function normalizeAggregateMap(raw: unknown): AggregateByAthleteId {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AggregateByAthleteId = {};
  for (const [athleteId, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = athleteId.trim();
    if (!id || !isValidSyncedCompetitionAggregateArtifact(value)) continue;
    if (value.sharedAthleteId.trim() !== id) continue;
    out[id] = value;
  }
  return out;
}

function summarizeAggregate(artifact: SyncedCompetitionAggregateArtifact | null) {
  if (!artifact) return null;
  return {
    sharedAthleteId: artifact.sharedAthleteId,
    updatedAt: artifact.updatedAt,
    totalCompetitions: artifact.totalCompetitions,
    totalMatches: artifact.totalMatches,
    wins: artifact.wins,
    losses: artifact.losses,
    submissionRate: artifact.submissionRate,
    fastestSubmission: artifact.fastestSubmissionSeconds,
  };
}

async function readStore(): Promise<AggregateByAthleteId> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachCompetitionAggregatesByAthleteId);
  logKeyRead({
    key: StorageKeys.coachCompetitionAggregatesByAthleteId,
    raw,
    source: "coachCompetitionAggregateStore.readStore",
  });
  const map = safeParseStore(raw);
  const artifacts = Object.values(map);
  const updatedAts = artifacts.map((artifact) => artifact.updatedAt).sort();
  logCacheProvenance({
    key: StorageKeys.coachCompetitionAggregatesByAthleteId,
    raw,
    source: "coachCompetitionAggregateStore.readStore",
    readKind: "diskRead",
    athleteIds: Object.keys(map),
    sharedAthleteIds: Object.keys(map),
    updatedAt: updatedAts[updatedAts.length - 1] ?? null,
    entityCounts: { artifactCount: artifacts.length },
  });
  syncAggregatesMemory(map);
  return map;
}

async function writeStore(map: AggregateByAthleteId): Promise<void> {
  syncAggregatesMemory(map);
  const raw = JSON.stringify(map);
  logKeyWrite({
    key: StorageKeys.coachCompetitionAggregatesByAthleteId,
    raw,
    source: "coachCompetitionAggregateStore.writeStore",
    extra: { artifactCount: Object.keys(map).length },
  });
  await AsyncStorage.setItem(
    StorageKeys.coachCompetitionAggregatesByAthleteId,
    raw,
  );
}

/** Read-only coach projection: newest bounded aggregate for `sharedAthleteId`. */
export async function getCoachCompetitionAggregate(
  sharedAthleteId: string,
): Promise<SyncedCompetitionAggregateArtifact | null> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return null;
  const map = await readStore();
  return map[athleteId] ?? null;
}

/** Overwrite-only: replaces any prior artifact for this athlete id. */
export async function writeCoachCompetitionAggregate(
  artifact: SyncedCompetitionAggregateArtifact,
): Promise<void> {
  const athleteId = artifact.sharedAthleteId.trim();
  if (!athleteId || !isValidSyncedCompetitionAggregateArtifact(artifact)) {
    if (__DEV__) {
      console.log("[COMP_AGG_TRACE] hydrate_skip_invalid", {
        sharedAthleteId: athleteId || null,
      });
    }
    return;
  }
  if (artifact.sharedAthleteId.trim() !== athleteId) {
    if (__DEV__) {
      console.log("[COMP_AGG_TRACE] hydrate_skip_invalid", {
        sharedAthleteId: athleteId,
        reason: "sharedAthleteIdKeyMismatch",
      });
    }
    return;
  }

  const map = await readStore();
  const existing = map[athleteId] ?? null;
  const comparison = existing
    ? artifact.updatedAt.localeCompare(existing.updatedAt)
    : 1;
  const accepted = !existing || comparison >= 0;

  if (__DEV__) {
    console.log("[COMP_AGGREGATE_TRACE]", {
      stage: "coach_aggregate_store_write_decision",
      sharedAthleteId: athleteId,
      existing: summarizeAggregate(existing),
      incoming: summarizeAggregate(artifact),
      accepted,
      overwriteReason: !existing
        ? "no_existing_artifact"
        : comparison > 0
          ? "incoming_newer"
          : comparison === 0
            ? "same_timestamp_refresh"
            : "incoming_older_rejected",
      updatedAtComparison: comparison,
    });
  }

  if (!accepted) {
    return;
  }

  map[athleteId] = artifact;
  await writeStore(map);

  if (__DEV__) {
    console.log("[COMP_AGG_TRACE] hydrate_write", {
      sharedAthleteId: athleteId,
      updatedAt: artifact.updatedAt,
    });
    console.log("[COACH_SUMMARY_AGGREGATE_TRACE]", {
      stage: "aggregate_store_write",
      sharedAthleteId: athleteId,
      existing: summarizeAggregate(existing),
      incoming: summarizeAggregate(artifact),
      overwriteReason: !existing
        ? "no_existing_artifact"
        : comparison > 0
          ? "incoming_newer"
          : "same_timestamp_refresh",
    });
  }
  emitCoachCompetitionAggregateChange({
    reason: "writeCoachCompetitionAggregate",
    sharedAthleteId: athleteId,
    updatedAt: artifact.updatedAt,
  });
}

export async function removeCoachCompetitionAggregate(
  sharedAthleteId: string,
): Promise<void> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return;

  const map = await readStore();
  if (!(athleteId in map)) return;
  delete map[athleteId];
  await writeStore(map);

  if (__DEV__) {
    console.log("[COMP_AGG_TRACE] hydrate_prune", {
      sharedAthleteId: athleteId,
      reason: "remove",
    });
  }
  emitCoachCompetitionAggregateChange({
    reason: "removeCoachCompetitionAggregate",
    sharedAthleteId: athleteId,
  });
}

/**
 * Drop artifacts whose `sharedAthleteId` is not in `allowedAthleteIds`.
 * Overwrite-only store hygiene after roster/session reconcile.
 */
export async function pruneCoachCompetitionAggregates(
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
    console.log("[COMP_AGG_TRACE] hydrate_prune", {
      removedAthleteIds: removed,
      allowedCount: allowed.size,
    });
  }
  emitCoachCompetitionAggregateChange({
    reason: "pruneCoachCompetitionAggregates",
    sharedAthleteId: removed.join(",") || null,
  });
}
