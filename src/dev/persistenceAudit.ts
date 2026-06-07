import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "../storage/storageKeys";

export const PERSISTENCE_AUDIT_CURRENT_KEYS = [
  StorageKeys.storageVersion,
  StorageKeys.sessions,
  StorageKeys.profile,
  StorageKeys.deviceRole,
  StorageKeys.parentAthletes,
  StorageKeys.parentActiveAthleteId,
  StorageKeys.lastAthleteId,
  StorageKeys.coachKidsById,
  StorageKeys.kidWeeklyFocusEntries,
  StorageKeys.coachWeeklySyncCacheByToken,
  StorageKeys.coachTrainingProofByAthleteId,
  StorageKeys.coachCompetitionAggregatesByAthleteId,
  StorageKeys.coachCompetitionTopologyByAthleteId,
] as const;

export const PERSISTENCE_AUDIT_LEGACY_KEYS = [
  "bjj.sessions.v1",
  "bjj_sessions_v1",
  "bjj_profile_v1",
] as const;

export const PERSISTENCE_AUDIT_HIGH_RISK_KEYS = [
  ...PERSISTENCE_AUDIT_CURRENT_KEYS,
  ...PERSISTENCE_AUDIT_LEGACY_KEYS,
] as const;

type ParsedSummary = {
  kind: "null" | "array" | "object" | "string" | "number" | "boolean" | "unknown";
  entityCount: number | null;
  keys?: string[];
};

function timestamp(): string {
  return new Date().toISOString();
}

function byteSize(raw: string | null): number {
  if (raw == null) return 0;
  let size = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code <= 0x7f) size += 1;
    else if (code <= 0x7ff) size += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      size += 4;
      i += 1;
    } else {
      size += 3;
    }
  }
  return size;
}

function summarizeParsedValue(raw: string | null): ParsedSummary {
  if (raw == null) return { kind: "null", entityCount: 0 };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { kind: "array", entityCount: parsed.length };
    }
    if (parsed && typeof parsed === "object") {
      const keys = Object.keys(parsed as Record<string, unknown>);
      return {
        kind: "object",
        entityCount: keys.length,
        keys: keys.slice(0, 20),
      };
    }
    if (typeof parsed === "string") return { kind: "string", entityCount: 1 };
    if (typeof parsed === "number") return { kind: "number", entityCount: 1 };
    if (typeof parsed === "boolean") return { kind: "boolean", entityCount: 1 };
    return { kind: "unknown", entityCount: null };
  } catch {
    return { kind: "string", entityCount: raw.trim() ? 1 : 0 };
  }
}

function summarizeRaw(raw: string | null) {
  return {
    exists: raw != null,
    byteSize: byteSize(raw),
    parsed: summarizeParsedValue(raw),
  };
}

export function logKeyRead(input: {
  key: string;
  raw: string | null;
  source?: string;
  readKind?: "diskRead" | "memoryRead";
  extra?: Record<string, unknown>;
}): void {
  if (!__DEV__) return;
  console.log("[PERSISTENCE_AUDIT_KEY_READ]", {
    key: input.key,
    source: input.source ?? null,
    readKind: input.readKind ?? "diskRead",
    ...summarizeRaw(input.raw),
    ...(input.extra ?? {}),
    timestamp: timestamp(),
  });
}

export function logKeyWrite(input: {
  key: string;
  raw: string | null;
  source?: string;
  extra?: Record<string, unknown>;
}): void {
  if (!__DEV__) return;
  console.log("[PERSISTENCE_AUDIT_KEY_WRITE]", {
    key: input.key,
    source: input.source ?? null,
    ...summarizeRaw(input.raw),
    ...(input.extra ?? {}),
    timestamp: timestamp(),
  });
}

export function logMigrationReplay(input: {
  fromKey: string;
  toKey: string;
  raw: string | null;
}): void {
  if (!__DEV__) return;
  const summary = summarizeRaw(input.raw);
  console.log("[MIGRATION_COPY_FORWARD]", {
    fromKey: input.fromKey,
    toKey: input.toKey,
    copiedBytes: summary.byteSize,
    parsedEntityCount: summary.parsed.entityCount,
    timestamp: timestamp(),
  });
}

export function logAuthorityBootstrap(input: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log("[AUTHORITY_BOOTSTRAP_AUDIT]", {
    ...input,
    timestamp: timestamp(),
  });
}

export function logCacheProvenance(input: {
  key: string;
  source: string;
  raw?: string | null;
  athleteIds?: string[];
  sharedAthleteIds?: string[];
  updatedAt?: string | null;
  fetchedAt?: string | null;
  readKind?: "diskRead" | "memoryRead";
  entityCounts?: Record<string, number | null>;
  extra?: Record<string, unknown>;
}): void {
  if (!__DEV__) return;
  const rawSummary = input.raw === undefined ? null : summarizeRaw(input.raw);
  console.log("[CACHE_PROVENANCE_AUDIT]", {
    key: input.key,
    athleteIds: input.athleteIds ?? [],
    sharedAthleteIds: input.sharedAthleteIds ?? [],
    updatedAt: input.updatedAt ?? null,
    fetchedAt: input.fetchedAt ?? null,
    source: input.source,
    byteSize: rawSummary?.byteSize ?? null,
    entityCounts: input.entityCounts ?? {
      parsedEntityCount: rawSummary?.parsed.entityCount ?? null,
    },
    readKind: input.readKind ?? null,
    ...(input.extra ?? {}),
    timestamp: timestamp(),
  });
}

export async function logAsyncStorageInventory(stage: string): Promise<void> {
  if (!__DEV__) return;
  const keys = [...PERSISTENCE_AUDIT_HIGH_RISK_KEYS];
  const pairs = await AsyncStorage.multiGet(keys);
  const byKey = Object.fromEntries(pairs);
  const existingKeys = keys.filter((key) => byKey[key] != null);
  const missingKeys = keys.filter((key) => byKey[key] == null);
  const byteSizes = Object.fromEntries(
    keys.map((key) => [key, byteSize(byKey[key] ?? null)]),
  );
  const legacyKeyPresence = Object.fromEntries(
    PERSISTENCE_AUDIT_LEGACY_KEYS.map((key) => [key, byKey[key] != null]),
  );
  console.log("[PERSISTENCE_AUDIT_BOOT]", {
    stage,
    existingKeys,
    missingKeys,
    byteSizes,
    storageVersion: byKey[StorageKeys.storageVersion] ?? null,
    legacyKeyPresence,
    timestamp: timestamp(),
  });
}
