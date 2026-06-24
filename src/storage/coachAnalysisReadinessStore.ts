import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  CoachAnalysisConfirmedReadinessState,
  CoachAnalysisReadinessHydrationSource,
  CoachAnalysisReadinessRecord,
  CoachAnalysisTerminalReadinessResolution,
} from "../domain/competition/coachAnalysisReadinessTypes";
import { StorageKeys } from "./storageKeys";

type ReadinessByAthleteId = Record<string, CoachAnalysisReadinessRecord>;

let mutationQueue: Promise<void> = Promise.resolve();

export type CoachAnalysisReadinessStoreWriteOutcome =
  | {
      status: "written";
      record: CoachAnalysisReadinessRecord;
    }
  | {
      status: "ignored_superseded_generation";
      sharedAthleteId: string;
      incomingGeneration: number;
      existingGeneration: number;
    }
  | {
      status: "ignored_missing_generation";
      sharedAthleteId: string;
      incomingGeneration: number;
    }
  | {
      status: "ignored_already_resolved";
      sharedAthleteId: string;
      generation: number;
      existingState: Exclude<
        CoachAnalysisReadinessRecord["state"],
        "PENDING"
      >;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHydrationSource(
  value: unknown,
): value is CoachAnalysisReadinessHydrationSource {
  return (
    value === "coach_writer_sessions" || value === "parent_session_refresh"
  );
}

function isConfirmedState(
  value: unknown,
): value is CoachAnalysisConfirmedReadinessState {
  return value === "READY" || value === "EMPTY_READY";
}

function normalizeRecord(
  value: unknown,
): CoachAnalysisReadinessRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    !isNonEmptyString(record.sharedAthleteId) ||
    (record.state !== "READY" &&
      record.state !== "EMPTY_READY" &&
      record.state !== "FAILED" &&
      record.state !== "PENDING") ||
    typeof record.generation !== "number" ||
    !Number.isSafeInteger(record.generation) ||
    record.generation < 0 ||
    !isNonEmptyString(record.startedAt) ||
    !isHydrationSource(record.hydrationSource)
  ) {
    return null;
  }
  if (
    record.resolvedAt !== undefined &&
    !isNonEmptyString(record.resolvedAt)
  ) {
    return null;
  }
  if (
    record.artifactSetUpdatedAt !== undefined &&
    !isNonEmptyString(record.artifactSetUpdatedAt)
  ) {
    return null;
  }
  if (
    record.lastConfirmedState !== undefined &&
    !isConfirmedState(record.lastConfirmedState)
  ) {
    return null;
  }
  if (
    record.lastConfirmedAt !== undefined &&
    !isNonEmptyString(record.lastConfirmedAt)
  ) {
    return null;
  }
  if (
    record.lastConfirmedArtifactSetUpdatedAt !== undefined &&
    !isNonEmptyString(record.lastConfirmedArtifactSetUpdatedAt)
  ) {
    return null;
  }
  return {
    sharedAthleteId: record.sharedAthleteId.trim(),
    state: record.state,
    generation: record.generation,
    startedAt: record.startedAt.trim(),
    ...(typeof record.resolvedAt === "string"
      ? { resolvedAt: record.resolvedAt.trim() }
      : {}),
    hydrationSource: record.hydrationSource,
    ...(typeof record.artifactSetUpdatedAt === "string"
      ? { artifactSetUpdatedAt: record.artifactSetUpdatedAt.trim() }
      : {}),
    ...(isConfirmedState(record.lastConfirmedState)
      ? { lastConfirmedState: record.lastConfirmedState }
      : {}),
    ...(typeof record.lastConfirmedAt === "string"
      ? { lastConfirmedAt: record.lastConfirmedAt.trim() }
      : {}),
    ...(typeof record.lastConfirmedArtifactSetUpdatedAt === "string"
      ? {
          lastConfirmedArtifactSetUpdatedAt:
            record.lastConfirmedArtifactSetUpdatedAt.trim(),
        }
      : {}),
  };
}

function normalizeMap(raw: unknown): ReadinessByAthleteId {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ReadinessByAthleteId = {};
  for (const [key, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    const athleteId = key.trim();
    const record = normalizeRecord(value);
    if (!athleteId || !record || record.sharedAthleteId !== athleteId) continue;
    out[athleteId] = record;
  }
  return out;
}

async function readMap(): Promise<ReadinessByAthleteId> {
  const raw = await AsyncStorage.getItem(
    StorageKeys.coachAnalysisReadinessByAthleteId,
  );
  if (!raw) return {};
  try {
    return normalizeMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

async function writeMap(map: ReadinessByAthleteId): Promise<void> {
  await AsyncStorage.setItem(
    StorageKeys.coachAnalysisReadinessByAthleteId,
    JSON.stringify(map),
  );
}

function enqueueMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(mutation, mutation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function confirmedFieldsFrom(
  existing: CoachAnalysisReadinessRecord | null,
): Pick<
  CoachAnalysisReadinessRecord,
  | "lastConfirmedState"
  | "lastConfirmedAt"
  | "lastConfirmedArtifactSetUpdatedAt"
> {
  if (!existing) return {};
  if (existing.state === "READY" || existing.state === "EMPTY_READY") {
    return {
      lastConfirmedState: existing.state,
      ...(existing.resolvedAt
        ? { lastConfirmedAt: existing.resolvedAt }
        : {}),
      ...(existing.artifactSetUpdatedAt
        ? {
            lastConfirmedArtifactSetUpdatedAt:
              existing.artifactSetUpdatedAt,
          }
        : {}),
    };
  }
  return {
    ...(existing.lastConfirmedState
      ? { lastConfirmedState: existing.lastConfirmedState }
      : {}),
    ...(existing.lastConfirmedAt
      ? { lastConfirmedAt: existing.lastConfirmedAt }
      : {}),
    ...(existing.lastConfirmedArtifactSetUpdatedAt
      ? {
          lastConfirmedArtifactSetUpdatedAt:
            existing.lastConfirmedArtifactSetUpdatedAt,
        }
      : {}),
  };
}

export async function getCoachAnalysisReadiness(
  sharedAthleteId: string,
): Promise<CoachAnalysisReadinessRecord | null> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return null;
  const map = await readMap();
  return map[athleteId] ?? null;
}

export async function getAllCoachAnalysisReadiness(): Promise<
  ReadinessByAthleteId
> {
  return readMap();
}

export async function beginNextCoachAnalysisReadinessGeneration(input: {
  sharedAthleteId: string;
  startedAt: string;
  hydrationSource: CoachAnalysisReadinessHydrationSource;
}): Promise<CoachAnalysisReadinessStoreWriteOutcome> {
  return enqueueMutation(async () => {
    const athleteId = input.sharedAthleteId.trim();
    const map = await readMap();
    const existing = map[athleteId] ?? null;
    const generation = (existing?.generation ?? 0) + 1;
    const record: CoachAnalysisReadinessRecord = {
      sharedAthleteId: athleteId,
      state: "PENDING",
      generation,
      startedAt: input.startedAt,
      hydrationSource: input.hydrationSource,
      ...confirmedFieldsFrom(existing),
    };
    map[athleteId] = record;
    await writeMap(map);
    return { status: "written", record };
  });
}

export async function resolveCoachAnalysisReadinessGeneration(input: {
  sharedAthleteId: string;
  generation: number;
  resolvedAt: string;
  resolution: CoachAnalysisTerminalReadinessResolution;
}): Promise<CoachAnalysisReadinessStoreWriteOutcome> {
  return enqueueMutation(async () => {
    const athleteId = input.sharedAthleteId.trim();
    const map = await readMap();
    const existing = map[athleteId] ?? null;
    if (!existing) {
      return {
        status: "ignored_missing_generation",
        sharedAthleteId: athleteId,
        incomingGeneration: input.generation,
      };
    }
    if (input.generation !== existing.generation) {
      return {
        status: "ignored_superseded_generation",
        sharedAthleteId: athleteId,
        incomingGeneration: input.generation,
        existingGeneration: existing.generation,
      };
    }
    if (existing.state !== "PENDING") {
      return {
        status: "ignored_already_resolved",
        sharedAthleteId: athleteId,
        generation: input.generation,
        existingState: existing.state,
      };
    }

    const confirmedState: CoachAnalysisConfirmedReadinessState | null =
      input.resolution.state === "READY" ||
      input.resolution.state === "EMPTY_READY"
        ? input.resolution.state
        : null;
    const record: CoachAnalysisReadinessRecord = {
      sharedAthleteId: athleteId,
      state: input.resolution.state,
      generation: existing.generation,
      startedAt: existing.startedAt,
      resolvedAt: input.resolvedAt,
      hydrationSource: existing.hydrationSource,
      ...(input.resolution.artifactSetUpdatedAt
        ? { artifactSetUpdatedAt: input.resolution.artifactSetUpdatedAt }
        : {}),
      ...(confirmedState
        ? {
            lastConfirmedState: confirmedState,
            lastConfirmedAt: input.resolvedAt,
            ...(input.resolution.artifactSetUpdatedAt
              ? {
                  lastConfirmedArtifactSetUpdatedAt:
                    input.resolution.artifactSetUpdatedAt,
                }
              : {}),
          }
        : confirmedFieldsFrom(existing)),
    };
    map[athleteId] = record;
    await writeMap(map);
    return { status: "written", record };
  });
}
