import AsyncStorage from "@react-native-async-storage/async-storage";

import { normalizeInviteLinkToken } from "../coachShare/inviteLinkToken";
import { logParentCompPayload } from "../dev/parentCompPayloadTrace";
import {
  logCacheProvenance,
  logKeyRead,
  logKeyWrite,
} from "../dev/persistenceAudit";
import { logAthleteLineageTrace } from "../identity/athleteLineageTrace";
import {
  athleteIdSetFromSynced,
  logHydrationPipelineWatchAthletes,
  logHydrationPipelineWeeklyInvariantFilter,
  namesByIdFromSyncedAthletes,
} from "../identity/hydrationPipelineTrace";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedCoachMatchBreakdownArtifactSet,
  SyncedSharedAthlete,
  SyncedSharedCompetition,
  SyncedWeeklyMessagePayload,
} from "../types/coachWeeklySync";
import {
  type CoachMatchBreakdownArtifactWriteOutcome,
  isValidSyncedCoachMatchBreakdownArtifactSet,
  writeCoachMatchBreakdownArtifactSet,
} from "./coachMatchBreakdownArtifactStore";
import { bumpCoachSyncHydrationVersion } from "./coachSyncHydrationStore";
import { enforceWeeklyAthleteInvariant } from "./invariants/weeklyAthleteInvariant";
import { StorageKeys } from "./storageKeys";

/** Same validation as `resolveWeeklyDoc` / invite-level `weekly` (not exported from there). */
function isValidWeeklyDoc(v: unknown): v is SyncedWeeklyMessagePayload {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.weekStartYMD === "string" &&
    typeof o.headline === "string" &&
    typeof o.body === "string" &&
    typeof o.updatedAt === "string"
  );
}

/** Normalized shape returned from reads; `weeklyByAthleteId` is always an object. */
export type CoachWeeklySyncCacheEntry = {
  weekly: SyncedWeeklyMessagePayload | null;
  fetchedAt: string;
  weeklyByAthleteId: Record<string, SyncedWeeklyMessagePayload | null>;
  /** Session GET roster; older cache entries may omit. */
  athletes: SyncedSharedAthlete[];
  /** Normalized invite token for logs and dedupe; derived on read if missing. */
  tokenNorm: string;
  /** Full GET /v1/sessions/:token response when present (newer cache entries). */
  session: CoachWeeklySyncSessionResponse | null;
};

/** Persisted shape; older entries may omit `weeklyByAthleteId` / `athletes` / `session`. */
type StoredCoachWeeklySyncCacheEntry = {
  weekly: SyncedWeeklyMessagePayload | null;
  fetchedAt: string;
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null>;
  athletes?: unknown;
  tokenNorm?: string;
  session?: unknown;
};

type CacheMap = Record<string, StoredCoachWeeklySyncCacheEntry>;

export type CoachWeeklySyncCacheWriteOutcome = {
  status: "written";
  artifactWriteOutcomes: CoachMatchBreakdownArtifactWriteOutcome[];
};

function normalizeCoachMatchBreakdownArtifactEvidence(
  raw: unknown,
): CoachWeeklySyncSessionResponse["coachMatchBreakdownArtifactEvidence"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const evidence = raw as Record<string, unknown>;
  if (
    evidence.fieldClassification !== "valid" &&
    evidence.fieldClassification !== "omitted" &&
    evidence.fieldClassification !== "malformed"
  ) {
    return undefined;
  }
  if (
    !evidence.athleteEntryClassificationById ||
    typeof evidence.athleteEntryClassificationById !== "object" ||
    Array.isArray(evidence.athleteEntryClassificationById)
  ) {
    return undefined;
  }
  const athleteEntryClassificationById: Record<
    string,
    "populated" | "empty" | "malformed"
  > = {};
  for (const [key, value] of Object.entries(
    evidence.athleteEntryClassificationById as Record<string, unknown>,
  )) {
    const athleteId = key.trim();
    if (
      !athleteId ||
      (value !== "populated" && value !== "empty" && value !== "malformed")
    ) {
      continue;
    }
    athleteEntryClassificationById[athleteId] = value;
  }
  return {
    fieldClassification: evidence.fieldClassification,
    athleteEntryClassificationById,
  };
}

function normalizeWeeklyByAthleteId(
  raw: unknown,
): Record<string, SyncedWeeklyMessagePayload | null> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SyncedWeeklyMessagePayload | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null) {
      out[key] = null;
    } else if (isValidWeeklyDoc(value)) {
      out[key] = value;
    }
  }
  return out;
}

function normalizeAthletes(raw: unknown): SyncedSharedAthlete[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is SyncedSharedAthlete =>
      Boolean(a) &&
      typeof a === "object" &&
      typeof (a as { id?: unknown }).id === "string" &&
      typeof (a as { name?: unknown }).name === "string" &&
      typeof (a as { createdAt?: unknown }).createdAt === "string",
  );
}

function normalizeCompetitions(raw: unknown): SyncedSharedCompetition[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is SyncedSharedCompetition =>
      Boolean(c) &&
      typeof c === "object" &&
      typeof (c as { id?: unknown }).id === "string" &&
      typeof (c as { sharedAthleteId?: unknown }).sharedAthleteId === "string" &&
      typeof (c as { tournamentName?: unknown }).tournamentName === "string" &&
      typeof (c as { eventDate?: unknown }).eventDate === "string" &&
      typeof (c as { createdAt?: unknown }).createdAt === "string" &&
      typeof (c as { updatedAt?: unknown }).updatedAt === "string",
  );
}

function normalizeCoachMatchBreakdownArtifacts(
  raw: unknown,
): Record<string, SyncedCoachMatchBreakdownArtifactSet> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "parent_cache_normalize",
      sharedAthleteId: null,
      sharedCompetitionId: null,
      matchLineageKey: null,
      overlayCount: 0,
      artifacts: [],
      artifactSetCount: 0,
      rawFieldType: Array.isArray(raw) ? "array" : typeof raw,
    });
    return {};
  }
  const out: Record<string, SyncedCoachMatchBreakdownArtifactSet> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || !isValidSyncedCoachMatchBreakdownArtifactSet(value)) continue;
    if (value.sharedAthleteId.trim() !== id) continue;
    out[id] = value;
  }
  const artifacts = Object.values(out).flatMap((artifactSet) => artifactSet.artifacts);
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "parent_cache_normalize",
    sharedAthleteId: artifacts[0]?.sharedAthleteId ?? null,
    sharedCompetitionId: artifacts[0]?.sharedCompetitionId ?? null,
    matchLineageKey: artifacts[0]?.matchLineageKey ?? null,
    overlayCount: artifacts.length,
    artifacts: artifacts.map((artifact) => ({
      sharedAthleteId: artifact.sharedAthleteId,
      sharedCompetitionId: artifact.sharedCompetitionId,
      matchLineageKey: artifact.matchLineageKey,
      hasCoachNote: Boolean(artifact.coachNote?.trim()),
    })),
    artifactSetCount: Object.keys(out).length,
    rawFieldType: Array.isArray(raw) ? "array" : typeof raw,
  });
  return out;
}

/** Rehydrates a persisted session blob; returns null if shape is not usable. */
function normalizeStoredSession(
  raw: unknown,
  linkTokenForNorm: string,
): CoachWeeklySyncSessionResponse | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (
    typeof p.coach !== "object" ||
    p.coach === null ||
    Array.isArray(p.coach) ||
    typeof (p.coach as { id?: unknown }).id !== "string" ||
    typeof (p.coach as { displayName?: unknown }).displayName !== "string"
  ) {
    return null;
  }
  const coach = p.coach as CoachWeeklySyncSessionResponse["coach"];
  const weeklyRaw = "weekly" in p ? p.weekly : null;
  const weekly = weeklyRaw === null ? null : isValidWeeklyDoc(weeklyRaw) ? weeklyRaw : null;
  const weeklyByAthleteId = normalizeWeeklyByAthleteId(p.weeklyByAthleteId);
  const athletes = normalizeAthletes(p.athletes);
  const rawCompetitions = p.competitions;
  if (Array.isArray(rawCompetitions)) {
    for (const raw of rawCompetitions) {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        logParentCompPayload(
          "cache_rehydrate_pre_normalize",
          raw as Record<string, unknown>,
        );
      }
    }
  }
  const competitions = normalizeCompetitions(p.competitions);
  const coachMatchBreakdownArtifacts = normalizeCoachMatchBreakdownArtifacts(
    p.coachMatchBreakdownArtifacts,
  );
  const coachMatchBreakdownArtifactEvidence =
    normalizeCoachMatchBreakdownArtifactEvidence(
      p.coachMatchBreakdownArtifactEvidence,
    );
  for (const comp of competitions) {
    logParentCompPayload(
      "cache_rehydrate_after_normalize",
      comp as unknown as Record<string, unknown>,
      coachMatchBreakdownArtifacts,
    );
  }
  if (Array.isArray(rawCompetitions) && rawCompetitions.length !== competitions.length) {
    console.log(
      "[PARENT_COMP_PAYLOAD]",
      JSON.stringify(
        {
          stage: "cache_rehydrate_normalize_strip_summary",
          rawCompetitionCount: rawCompetitions.length,
          normalizedCompetitionCount: competitions.length,
          strippedCount: rawCompetitions.length - competitions.length,
        },
        null,
        2,
      ),
    );
  }
  return {
    ...(typeof p.schemaVersion === "number" ? { schemaVersion: p.schemaVersion } : {}),
    coach,
    weekly,
    weeklyByAthleteId,
    athletes,
    competitions,
    coachMatchBreakdownArtifacts,
    ...(coachMatchBreakdownArtifactEvidence
      ? { coachMatchBreakdownArtifactEvidence }
      : {}),
  };
}

function normalizeReadEntry(
  entry: unknown,
  linkToken: string,
): CoachWeeklySyncCacheEntry | null {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const e = entry as Record<string, unknown>;
  const fetchedAt = e.fetchedAt;
  if (typeof fetchedAt !== "string") {
    return null;
  }
  const rawWeekly = "weekly" in e ? e.weekly : null;
  const weekly = isValidWeeklyDoc(rawWeekly) ? rawWeekly : null;
  const storedTokenNorm =
    typeof e.tokenNorm === "string" && e.tokenNorm.trim().length > 0 ? e.tokenNorm.trim() : "";
  const tokenNorm = storedTokenNorm || normalizeInviteLinkToken(linkToken);
  const session = normalizeStoredSession(e.session, linkToken);
  const weeklyByAthleteId = normalizeWeeklyByAthleteId(e.weeklyByAthleteId);
  if (__DEV__) {
    console.log("[AUTHORITY_CHAIN_TRACE]", {
      stage: "2_cache_hydrate_normalized",
      inviteHeadline: weekly?.headline?.slice(0, 120) ?? null,
      inviteSystemKey: weekly?.systemKey ?? null,
      weeklyByAthleteKeys: Object.keys(weeklyByAthleteId),
      weeklyByAthleteHeadlines: Object.fromEntries(
        Object.entries(weeklyByAthleteId).map(([id, doc]) => [
          id,
          doc?.headline?.slice(0, 120) ?? null,
        ]),
      ),
    });
    console.log("[SYSTEMKEY TRACE CLIENT]", {
      traceStage: "8_client_cache_hydrate",
      headline: weekly?.headline?.slice(0, 120) ?? null,
      systemKey: weekly?.systemKey ?? null,
      athleteId: null,
      weekStartYMD: weekly?.weekStartYMD ?? null,
      inviteWeeklyKeyExists: weekly != null && Object.prototype.hasOwnProperty.call(weekly, "systemKey"),
      weeklyByAthleteSystemKeys: Object.fromEntries(
        Object.entries(weeklyByAthleteId).map(([id, doc]) => [
          id,
          {
            headline: doc?.headline?.slice(0, 120) ?? null,
            systemKey: doc?.systemKey ?? null,
            weekStartYMD: doc?.weekStartYMD ?? null,
          },
        ]),
      ),
      cacheDroppedDocDueToInvalidShape: false,
      source: "coachWeeklySyncCacheStore_normalizeReadEntry",
    });
    console.log("[bjj-weekly-cache-hydrate systemKey]", {
      inviteSystemKey: weekly?.systemKey ?? null,
      weeklyByAthleteIdSystemKeys: Object.fromEntries(
        Object.entries(weeklyByAthleteId).map(([id, doc]) => [id, doc?.systemKey ?? null]),
      ),
    });
    const cacheAthletes = normalizeAthletes("athletes" in e ? e.athletes : []);
    logHydrationPipelineWatchAthletes({
      stage: "5_hydration_restore",
      sourceSubsystem: "coachWeeklySyncCacheStore.normalizeReadEntry",
      dataOrigin: "cache",
      inviteTokenHint: tokenNorm,
      presentAthleteIds: athleteIdSetFromSynced(cacheAthletes),
      namesById: namesByIdFromSyncedAthletes(cacheAthletes),
      allAthleteIdsInStage: cacheAthletes.map((a) => a.id),
      stageMeta: { fetchedAt, linkTokenTail: linkToken.slice(-6) },
    });
    for (const a of cacheAthletes) {
      logAthleteLineageTrace({
        operation: "restore",
        source: "weekly_cache",
        athleteName: a.name,
        sharedAthleteId: a.id,
        token: tokenNorm,
        route: "coachWeeklySyncCacheStore.normalizeReadEntry",
        extra: {
          weeklyKeyPresent: Object.prototype.hasOwnProperty.call(weeklyByAthleteId, a.id),
        },
      });
    }
  }
  return {
    weekly,
    fetchedAt,
    weeklyByAthleteId,
    athletes: normalizeAthletes("athletes" in e ? e.athletes : []),
    tokenNorm,
    session,
  };
}

function safeParseOrDefault<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readMap(): Promise<CacheMap> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachWeeklySyncCacheByToken);
  logKeyRead({
    key: StorageKeys.coachWeeklySyncCacheByToken,
    raw,
    source: "coachWeeklySyncCacheStore.readMap",
  });
  logCacheProvenance({
    key: StorageKeys.coachWeeklySyncCacheByToken,
    raw,
    source: "coachWeeklySyncCacheStore.readMap",
    readKind: "diskRead",
  });
  return safeParseOrDefault<CacheMap>(raw, {});
}

async function writeMap(map: CacheMap): Promise<void> {
  const raw = JSON.stringify(map);
  logKeyWrite({
    key: StorageKeys.coachWeeklySyncCacheByToken,
    raw,
    source: "coachWeeklySyncCacheStore.writeMap",
    extra: { tokenCount: Object.keys(map).length },
  });
  await AsyncStorage.setItem(StorageKeys.coachWeeklySyncCacheByToken, raw);
}

export function cacheEntryHasUsableWeeklyDoc(
  entry: CoachWeeklySyncCacheEntry | null,
): boolean {
  if (!entry) return false;
  if (entry.weekly) return true;
  return Object.values(entry.weeklyByAthleteId).some((v) => v != null);
}

export async function getCachedWeeklyForLinkToken(
  linkToken: string,
): Promise<CoachWeeklySyncCacheEntry | null> {
  const map = await readMap();
  const raw = map[linkToken as keyof CacheMap];
  if (raw === undefined) return null;
  const entry = normalizeReadEntry(raw, linkToken);
  logCacheProvenance({
    key: StorageKeys.coachWeeklySyncCacheByToken,
    source: "coachWeeklySyncCacheStore.getCachedWeeklyForLinkToken",
    readKind: "diskRead",
    athleteIds: entry?.athletes.map((a) => a.id.trim()).filter(Boolean) ?? [],
    sharedAthleteIds: entry?.athletes.map((a) => a.id.trim()).filter(Boolean) ?? [],
    fetchedAt: entry?.fetchedAt ?? null,
    entityCounts: {
      athleteCount: entry?.athletes.length ?? 0,
      competitionCount: entry?.session?.competitions?.length ?? 0,
      weeklyByAthleteCount: Object.keys(entry?.weeklyByAthleteId ?? {}).length,
    },
    extra: {
      tokenNorm: entry?.tokenNorm ?? normalizeInviteLinkToken(linkToken),
      hasFullSession: Boolean(entry?.session),
    },
  });
  return entry;
}

export async function setCachedWeeklyForLinkToken(
  linkToken: string,
  weekly: SyncedWeeklyMessagePayload | null,
  fetchedAtIso: string,
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null>,
  athletes?: SyncedSharedAthlete[] | null,
  /** When set, replaces cached full session; when `undefined`, previous session (if any) is kept. */
  cachedFullSession?: CoachWeeklySyncSessionResponse,
  /** Normalized token for logs/dedupe; defaults from `linkToken` when session is written. */
  cachedTokenNorm?: string,
): Promise<CoachWeeklySyncCacheWriteOutcome> {
  const map = await readMap();
  const artifactWriteOutcomes: CoachMatchBreakdownArtifactWriteOutcome[] = [];
  const prevRaw = map[linkToken];
  const prev = prevRaw ? normalizeReadEntry(prevRaw, linkToken) : null;
  const nextSession =
    cachedFullSession !== undefined ? cachedFullSession : prev?.session ?? null;
  const nextTokenNorm =
    cachedTokenNorm !== undefined && cachedTokenNorm.trim().length > 0
      ? cachedTokenNorm.trim()
      : cachedFullSession !== undefined
        ? normalizeInviteLinkToken(linkToken)
        : prev?.tokenNorm && prev.tokenNorm.length > 0
          ? prev.tokenNorm
          : normalizeInviteLinkToken(linkToken);
  const beforeInvariantAthletes = Array.isArray(athletes) ? athletes.map((a) => a.id) : [];
  const beforeInvariantWeeklyKeys =
    weeklyByAthleteId && typeof weeklyByAthleteId === "object"
      ? Object.keys(weeklyByAthleteId)
      : [];
  const {
    weeklyByAthleteId: normalizedWeeklyByAthleteId,
    athletes: normalizedAthletes,
  } = enforceWeeklyAthleteInvariant({
    weeklyByAthleteId,
    athletes,
    session: nextSession,
  });
  if (__DEV__) {
    logHydrationPipelineWeeklyInvariantFilter({
      sourceSubsystem: "coachWeeklySyncCacheStore.setCachedWeeklyForLinkToken",
      dataOrigin: cachedFullSession !== undefined ? "remote" : "cache",
      inviteTokenHint: nextTokenNorm,
      beforeAthleteIds: beforeInvariantAthletes,
      afterAthleteIds: normalizedAthletes.map((a) => a.id),
      beforeWeeklyKeys: beforeInvariantWeeklyKeys,
      afterWeeklyKeys: Object.keys(normalizedWeeklyByAthleteId),
      namesById: namesByIdFromSyncedAthletes(normalizedAthletes),
    });
  }
  const athleteIds = new Set(normalizedAthletes.map((a) => a.id));
  const missing = Object.keys(normalizedWeeklyByAthleteId).filter((id) => !athleteIds.has(id));

  if (__DEV__ && missing.length > 0) {
    console.error("[CACHE INVARIANT VIOLATION]", {
      missing,
      weeklyKeys: Object.keys(normalizedWeeklyByAthleteId),
      athleteIds: Array.from(athleteIds),
    });
  }

  map[linkToken] = {
    weekly: isValidWeeklyDoc(weekly) ? weekly : null,
    fetchedAt: fetchedAtIso,
    weeklyByAthleteId: normalizedWeeklyByAthleteId,
    athletes: normalizedAthletes,
    tokenNorm: nextTokenNorm,
    session: nextSession ?? undefined,
  };
  if (cachedFullSession !== undefined) {
    const artifactSets = Object.values(cachedFullSession.coachMatchBreakdownArtifacts ?? {});
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: "artifact_cache_session_hydrate_begin",
      artifactSetCount: artifactSets.length,
      artifactCount: artifactSets.reduce((sum, artifactSet) => sum + artifactSet.artifacts.length, 0),
      sharedAthleteIds: artifactSets.map((artifactSet) => artifactSet.sharedAthleteId),
      perAthlete: artifactSets.map((artifactSet) => ({
        sharedAthleteId: artifactSet.sharedAthleteId,
        updatedAt: artifactSet.updatedAt,
        artifactCount: artifactSet.artifacts.length,
        lineageKeys: artifactSet.artifacts.map((a) => a.matchLineageKey.trim()),
        competitionIds: [
          ...new Set(artifactSet.artifacts.map((a) => a.sharedCompetitionId.trim()).filter(Boolean)),
        ],
      })),
    });
    for (const artifactSet of artifactSets) {
      artifactWriteOutcomes.push(
        await writeCoachMatchBreakdownArtifactSet(artifactSet),
      );
    }
    if (artifactSets.length > 0) {
      console.log("[COACH_OVERLAY_SYNC_TRACE]", {
        stage: "parent_overlay_cache_hydrated_from_session",
        artifactSetCount: artifactSets.length,
        artifactCount: artifactSets.reduce((sum, artifactSet) => sum + artifactSet.artifacts.length, 0),
        sharedAthleteIds: artifactSets.map((artifactSet) => artifactSet.sharedAthleteId),
      });
      bumpCoachSyncHydrationVersion({
        reason: "coach_match_breakdown_artifacts_hydrated",
      });
    }
  }
  if (__DEV__) {
    console.log("[bjj-weekly-cache-write systemKey]", {
      inviteSystemKey: map[linkToken].weekly?.systemKey ?? null,
      weeklyByAthleteIdSystemKeys: Object.fromEntries(
        Object.entries(normalizedWeeklyByAthleteId).map(([id, doc]) => [
          id,
          doc?.systemKey ?? null,
        ]),
      ),
    });
    logHydrationPipelineWatchAthletes({
      stage: "3_session_cache_write",
      sourceSubsystem: "coachWeeklySyncCacheStore.setCachedWeeklyForLinkToken",
      dataOrigin: cachedFullSession !== undefined ? "remote" : "cache",
      inviteTokenHint: nextTokenNorm,
      presentAthleteIds: athleteIdSetFromSynced(normalizedAthletes),
      namesById: namesByIdFromSyncedAthletes(normalizedAthletes),
      allAthleteIdsInStage: normalizedAthletes.map((a) => a.id),
      stageMeta: { fetchedAtIso, wroteFullSession: cachedFullSession !== undefined },
    });
    for (const a of normalizedAthletes) {
      logAthleteLineageTrace({
        operation: "persist",
        source: "weekly_cache",
        athleteName: a.name,
        sharedAthleteId: a.id,
        token: nextTokenNorm,
        route: "coachWeeklySyncCacheStore.setCachedWeeklyForLinkToken",
        extra: {
          weeklyKeyPresent: Object.prototype.hasOwnProperty.call(
            normalizedWeeklyByAthleteId,
            a.id,
          ),
        },
      });
    }
  }
  await writeMap(map);
  return {
    status: "written",
    artifactWriteOutcomes,
  };
}

export async function clearCachedWeeklyForLinkToken(linkToken: string): Promise<void> {
  const map = await readMap();
  delete map[linkToken];
  await writeMap(map);
}
