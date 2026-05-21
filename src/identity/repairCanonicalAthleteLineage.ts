import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getActiveAthleteId,
  getAthletes,
  notifyActiveAthleteChanged,
  setActiveAthleteId,
  type ParentAthlete,
} from "../storage/athleteStore";
import { getKidsById, setKidsById } from "../storage/coachKidStore";
import { emitCompetitionChange } from "../storage/kidCompetitionStore";
import { getKidCompetitionEntries } from "../storage/kidCompetitionStore";
import { getSessions, setSessions } from "../storage/sessionsStore";
import { StorageKeys } from "../storage/storageKeys";
import type { KidCompetitionEntry } from "../types/coachKid";
import type { CoachWeeklySyncSessionResponse } from "../types/coachWeeklySync";
import type { Session } from "../types";
import {
  pruneParentAthletesList,
  remapWeeklySyncSessionAthleteIds,
} from "./repairInviteTokenOwnershipMigration";
import {
  normalizeAthleteNameForLineage,
  resetLineageIntegrityDedupeDev,
  runLineageIntegrityScan,
  type LineageIntegrityScanInput,
  type LineageIntegrityWarning,
  type WriterSessionAthletesSlice,
} from "./lineageIntegrityDetection";

export type CanonicalLineageRepairSource = "dev_ui" | "dev_console" | (string & {});

export type RepairCanonicalAthleteLineageParams = {
  /** Target canonical shared athlete id (survivor lineage). */
  canonicalSharedAthleteId: string;
  /** Historical split id to relink away from. */
  staleSharedAthleteId: string;
  /** Operator-confirmed display name (no implicit name matching). */
  athleteDisplayName: string;
  /** Operator reason / ticket reference (required audit trail). */
  repairReason: string;
  /** Where the repair was invoked (dev UI, console, etc.). */
  repairSource: CanonicalLineageRepairSource;
  /** When true: preview + post-scan only; zero writes. */
  dryRun?: boolean;
};

export type LineageRepairStoreCounts = {
  parentActiveAthleteId: number;
  parentAthletes: number;
  coachKidsById: number;
  sessions: number;
  kidCompetitionEntries: number;
  coachWeeklySyncCacheTokens: number;
  coachWeeklySyncCacheWeeklyKeys: number;
  coachWeeklySyncCacheAthletes: number;
  coachWeeklySyncCacheCompetitions: number;
  coachTrainingProofByAthleteId: number;
  coachCompetitionAggregatesByAthleteId: number;
};

export type LineageRepairPreviewSnapshot = {
  canonicalSharedAthleteId: string;
  staleSharedAthleteId: string;
  athleteDisplayName: string;
  repairReason: string;
  repairSource: CanonicalLineageRepairSource;
  normalizedAthleteName: string;
  affectedStores: string[];
  rowCounts: LineageRepairStoreCounts;
  athleteNamesBySharedId: Record<string, string[]>;
};

export type LineageRepairMutationLog = {
  store: string;
  recordId: string;
  field: string;
  oldSharedAthleteId: string;
  newSharedAthleteId: string;
};

export type RepairCanonicalAthleteLineageResult = {
  dryRun: boolean;
  preview: LineageRepairPreviewSnapshot;
  mutations: LineageRepairMutationLog[];
  postValidationWarnings: LineageIntegrityWarning[];
};

type WeeklyCacheMap = Record<
  string,
  {
    weeklyByAthleteId?: Record<string, unknown>;
    athletes?: unknown;
    session?: unknown;
    fetchedAt?: string;
    weekly?: unknown;
    tokenNorm?: string;
  }
>;

function assertDevRepairAllowed(): void {
  if (!__DEV__) {
    throw new Error("repairCanonicalAthleteLineage is DEV-only and must never run in production");
  }
}

function trimRequired(value: string, label: string): string {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) throw new Error(`${label} is required`);
  return t;
}

function logMutation(
  mutations: LineageRepairMutationLog[],
  entry: LineageRepairMutationLog,
): void {
  mutations.push(entry);
  console.log("[LINEAGE_REPAIR_MUTATION]", entry);
}

async function readWeeklyCacheMap(): Promise<WeeklyCacheMap> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachWeeklySyncCacheByToken);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as WeeklyCacheMap)
      : {};
  } catch {
    return {};
  }
}

async function readProofMap(): Promise<Record<string, unknown>> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachTrainingProofByAthleteId);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function readAggregateMap(): Promise<Record<string, unknown>> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachCompetitionAggregatesByAthleteId);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function collectAthleteNames(
  canonical: string,
  stale: string,
  parentAthletes: ParentAthlete[],
  kidsById: Awaited<ReturnType<typeof getKidsById>>,
): Record<string, string[]> {
  const names: Record<string, Set<string>> = {
    [canonical]: new Set(),
    [stale]: new Set(),
  };

  for (const a of parentAthletes) {
    const id = a.id.trim();
    if (id === canonical || id === stale) names[id]?.add(a.name.trim());
  }
  for (const k of Object.values(kidsById)) {
    const sid = (k?.sharedAthleteId ?? "").trim();
    if (sid === canonical || sid === stale) names[sid]?.add((k?.name ?? "").trim());
  }

  return Object.fromEntries(
    Object.entries(names).map(([id, set]) => [id, [...set].filter(Boolean).sort()]),
  );
}

async function buildPreviewCounts(
  canonical: string,
  stale: string,
): Promise<LineageRepairStoreCounts> {
  const [
    oai,
    parentAthletes,
    kidsById,
    sessions,
    competitions,
    weeklyMap,
    proofMap,
    aggregateMap,
  ] = await Promise.all([
    getActiveAthleteId(),
    getAthletes(),
    getKidsById(),
    getSessions(),
    getKidCompetitionEntries(),
    readWeeklyCacheMap(),
    readProofMap(),
    readAggregateMap(),
  ]);

  let weeklyKeys = 0;
  let weeklyAthletes = 0;
  let weeklyCompetitions = 0;
  let weeklyTokens = 0;

  for (const entry of Object.values(weeklyMap)) {
    let tokenTouched = false;
    const weeklyBy = entry.weeklyByAthleteId ?? {};
    if (stale in weeklyBy) {
      weeklyKeys += 1;
      tokenTouched = true;
    }
    const athletes = Array.isArray(entry.athletes) ? entry.athletes : [];
    for (const a of athletes) {
      const id =
        a && typeof a === "object" && typeof (a as { id?: unknown }).id === "string"
          ? (a as { id: string }).id.trim()
          : "";
      if (id === stale) {
        weeklyAthletes += 1;
        tokenTouched = true;
      }
    }
    const session = entry.session;
    if (session && typeof session === "object" && !Array.isArray(session)) {
      const comps = (session as { competitions?: unknown }).competitions;
      if (Array.isArray(comps)) {
        for (const c of comps) {
          const sid =
            c &&
            typeof c === "object" &&
            typeof (c as { sharedAthleteId?: unknown }).sharedAthleteId === "string"
              ? (c as { sharedAthleteId: string }).sharedAthleteId.trim()
              : "";
          if (sid === stale) {
            weeklyCompetitions += 1;
            tokenTouched = true;
          }
        }
      }
    }
    if (tokenTouched) weeklyTokens += 1;
  }

  return {
    parentActiveAthleteId: (oai ?? "").trim() === stale ? 1 : 0,
    parentAthletes: parentAthletes.filter((a) => a.id.trim() === stale).length,
    coachKidsById: Object.values(kidsById).filter(
      (k) => (k?.sharedAthleteId ?? "").trim() === stale,
    ).length,
    sessions: sessions.filter((s) => (s.sharedAthleteId ?? "").trim() === stale).length,
    kidCompetitionEntries: competitions.filter(
      (e) => (e.sharedAthleteId ?? "").trim() === stale,
    ).length,
    coachWeeklySyncCacheTokens: weeklyTokens,
    coachWeeklySyncCacheWeeklyKeys: weeklyKeys,
    coachWeeklySyncCacheAthletes: weeklyAthletes,
    coachWeeklySyncCacheCompetitions: weeklyCompetitions,
    coachTrainingProofByAthleteId: stale in proofMap ? 1 : 0,
    coachCompetitionAggregatesByAthleteId: stale in aggregateMap ? 1 : 0,
  };
}

function affectedStoreNames(counts: LineageRepairStoreCounts): string[] {
  const stores: string[] = [];
  if (counts.parentActiveAthleteId > 0) stores.push("parentActiveAthleteId");
  if (counts.parentAthletes > 0) stores.push("parentAthletes");
  if (counts.coachKidsById > 0) stores.push("coachKidsById");
  if (counts.sessions > 0) stores.push("sessions");
  if (counts.kidCompetitionEntries > 0) stores.push("kidCompetitionEntries");
  if (
    counts.coachWeeklySyncCacheTokens > 0 ||
    counts.coachWeeklySyncCacheWeeklyKeys > 0 ||
    counts.coachWeeklySyncCacheAthletes > 0 ||
    counts.coachWeeklySyncCacheCompetitions > 0
  ) {
    stores.push("coachWeeklySyncCacheByToken");
  }
  if (counts.coachTrainingProofByAthleteId > 0) stores.push("coachTrainingProofByAthleteId");
  if (counts.coachCompetitionAggregatesByAthleteId > 0) {
    stores.push("coachCompetitionAggregatesByAthleteId");
  }
  return stores;
}

async function buildPostRepairScanInput(
  activeOperatingAthleteId: string | null,
): Promise<LineageIntegrityScanInput> {
  const [parentAthletes, kidsById, weeklyMap] = await Promise.all([
    getAthletes(),
    getKidsById(),
    readWeeklyCacheMap(),
  ]);

  const linkedIds = new Set<string>();
  for (const k of Object.values(kidsById)) {
    const sid = (k?.sharedAthleteId ?? "").trim();
    if (sid) linkedIds.add(sid);
  }

  const operatingAthleteRoster = parentAthletes.filter((a) => {
    const id = a.id.trim();
    if (linkedIds.has(id)) return true;
    return a.operatingScope === "local_only";
  });

  const writerSessions: WriterSessionAthletesSlice[] = [];
  for (const entry of Object.values(weeklyMap)) {
    const tokenNorm =
      typeof entry.tokenNorm === "string" && entry.tokenNorm.trim()
        ? entry.tokenNorm.trim()
        : "";
    const session = entry.session;
    if (!tokenNorm || !session || typeof session !== "object" || Array.isArray(session)) {
      continue;
    }
    const athletes = (session as CoachWeeklySyncSessionResponse).athletes;
    if (!Array.isArray(athletes)) continue;
    writerSessions.push({ linkTokenNorm: tokenNorm, athletes });
  }

  return {
    route: "repairCanonicalAthleteLineage.postValidate",
    activeOperatingAthleteId,
    parentAthletes,
    operatingAthleteRoster,
    kidsById,
    writerSessions,
  };
}

/**
 * DEV-only manual canonical lineage repair for one confirmed historical split.
 * Never invoked automatically — operator must pass explicit ids and reason.
 */
export async function repairCanonicalAthleteLineage(
  params: RepairCanonicalAthleteLineageParams,
): Promise<RepairCanonicalAthleteLineageResult> {
  assertDevRepairAllowed();

  const canonical = trimRequired(params.canonicalSharedAthleteId, "canonicalSharedAthleteId");
  const stale = trimRequired(params.staleSharedAthleteId, "staleSharedAthleteId");
  const athleteDisplayName = trimRequired(params.athleteDisplayName, "athleteDisplayName");
  const repairReason = trimRequired(params.repairReason, "repairReason");
  const repairSource = trimRequired(params.repairSource, "repairSource");
  const dryRun = params.dryRun === true;

  if (canonical === stale) {
    throw new Error("canonicalSharedAthleteId and staleSharedAthleteId must differ");
  }

  const [parentAthletes, kidsById, rowCounts] = await Promise.all([
    getAthletes(),
    getKidsById(),
    buildPreviewCounts(canonical, stale),
  ]);

  const preview: LineageRepairPreviewSnapshot = {
    canonicalSharedAthleteId: canonical,
    staleSharedAthleteId: stale,
    athleteDisplayName,
    repairReason,
    repairSource,
    normalizedAthleteName: normalizeAthleteNameForLineage(athleteDisplayName),
    affectedStores: affectedStoreNames(rowCounts),
    rowCounts,
    athleteNamesBySharedId: collectAthleteNames(canonical, stale, parentAthletes, kidsById),
  };

  console.log("[LINEAGE_REPAIR_PREVIEW]", preview);

  const mutations: LineageRepairMutationLog[] = [];

  if (dryRun) {
    resetLineageIntegrityDedupeDev();
    const postValidationWarnings = runLineageIntegrityScan(
      await buildPostRepairScanInput(await getActiveAthleteId()),
    );
    return { dryRun: true, preview, mutations, postValidationWarnings };
  }

  const staleToCanonical = new Map<string, string>([[stale, canonical]]);

  const oai = await getActiveAthleteId();
  if ((oai ?? "").trim() === stale) {
    await setActiveAthleteId(canonical);
    logMutation(mutations, {
      store: "parentActiveAthleteId",
      recordId: "(active)",
      field: "value",
      oldSharedAthleteId: stale,
      newSharedAthleteId: canonical,
    });
  }

  const hasCanonicalRow = parentAthletes.some((a) => a.id.trim() === canonical);
  const hasStaleRow = parentAthletes.some((a) => a.id.trim() === stale);

  let nextParentAthletes = [...parentAthletes];

  if (hasStaleRow && !hasCanonicalRow) {
    nextParentAthletes = nextParentAthletes.map((a) => {
      if (a.id.trim() !== stale) return a;
      logMutation(mutations, {
        store: "parentAthletes",
        recordId: a.id,
        field: "id",
        oldSharedAthleteId: stale,
        newSharedAthleteId: canonical,
      });
      return { ...a, id: canonical, name: athleteDisplayName || a.name };
    });
  } else if (hasStaleRow && hasCanonicalRow) {
    const pruned = pruneParentAthletesList(nextParentAthletes, {
      staleSharedAthleteIds: new Set([stale]),
      lineageTargets: [{ canonicalId: canonical, canonicalName: athleteDisplayName }],
    });
    for (const removed of nextParentAthletes) {
      if (removed.id.trim() === stale) {
        logMutation(mutations, {
          store: "parentAthletes",
          recordId: removed.id,
          field: "row",
          oldSharedAthleteId: stale,
          newSharedAthleteId: canonical,
        });
      }
    }
    nextParentAthletes = pruned.athletes;
  } else if (!hasCanonicalRow) {
    nextParentAthletes = [
      ...nextParentAthletes,
      { id: canonical, name: athleteDisplayName },
    ];
    logMutation(mutations, {
      store: "parentAthletes",
      recordId: canonical,
      field: "row",
      oldSharedAthleteId: stale,
      newSharedAthleteId: canonical,
    });
  }

  if (JSON.stringify(nextParentAthletes) !== JSON.stringify(parentAthletes)) {
    await AsyncStorage.setItem(
      StorageKeys.parentAthletes,
      JSON.stringify(nextParentAthletes),
    );
  }

  const kids = await getKidsById();
  let kidsChanged = false;
  const nextKids = { ...kids };
  for (const [kidId, kid] of Object.entries(nextKids)) {
    if (!kid) continue;
    const sid = (kid.sharedAthleteId ?? "").trim();
    if (sid !== stale) continue;
    nextKids[kidId] = { ...kid, sharedAthleteId: canonical };
    kidsChanged = true;
    logMutation(mutations, {
      store: "coachKidsById",
      recordId: kidId,
      field: "sharedAthleteId",
      oldSharedAthleteId: stale,
      newSharedAthleteId: canonical,
    });
  }
  if (kidsChanged) await setKidsById(nextKids);

  const sessions = await getSessions();
  let sessionsChanged = false;
  const nextSessions = sessions.map((s: Session) => {
    if ((s.sharedAthleteId ?? "").trim() !== stale) return s;
    sessionsChanged = true;
    logMutation(mutations, {
      store: "sessions",
      recordId: s.id,
      field: "sharedAthleteId",
      oldSharedAthleteId: stale,
      newSharedAthleteId: canonical,
    });
    return { ...s, sharedAthleteId: canonical };
  });
  if (sessionsChanged) await setSessions(nextSessions);

  const compEntries = await getKidCompetitionEntries();
  let compChanged = false;
  const nextCompEntries = compEntries.map((e: KidCompetitionEntry) => {
    if ((e.sharedAthleteId ?? "").trim() !== stale) return e;
    compChanged = true;
    logMutation(mutations, {
      store: "kidCompetitionEntries",
      recordId: e.id,
      field: "sharedAthleteId",
      oldSharedAthleteId: stale,
      newSharedAthleteId: canonical,
    });
    return { ...e, sharedAthleteId: canonical };
  });
  if (compChanged) {
    await AsyncStorage.setItem(
      StorageKeys.kidCompetitionEntries,
      JSON.stringify(nextCompEntries),
    );
    emitCompetitionChange();
  }

  const weeklyMap = await readWeeklyCacheMap();
  let weeklyMapChanged = false;
  const nextWeeklyMap: WeeklyCacheMap = { ...weeklyMap };

  for (const [linkToken, entry] of Object.entries(nextWeeklyMap)) {
    if (!entry || typeof entry !== "object") continue;

    let entryTouched = false;
    const sessionRaw = entry.session;
    let nextEntry = { ...entry };

    if (sessionRaw && typeof sessionRaw === "object" && !Array.isArray(sessionRaw)) {
      const remapped = remapWeeklySyncSessionAthleteIds(
        sessionRaw as CoachWeeklySyncSessionResponse,
        staleToCanonical,
        new Set([stale]),
      );
      if (remapped.session) {
        nextEntry.session = remapped.session;
        entryTouched = true;
        logMutation(mutations, {
          store: "coachWeeklySyncCacheByToken",
          recordId: linkToken,
          field: "session",
          oldSharedAthleteId: stale,
          newSharedAthleteId: canonical,
        });
      }
    }

    const weeklyBy = { ...(nextEntry.weeklyByAthleteId ?? {}) };
    if (stale in weeklyBy) {
      const doc = weeklyBy[stale];
      delete weeklyBy[stale];
      if (doc != null && weeklyBy[canonical] == null) weeklyBy[canonical] = doc;
      nextEntry.weeklyByAthleteId = weeklyBy;
      entryTouched = true;
      logMutation(mutations, {
        store: "coachWeeklySyncCacheByToken",
        recordId: linkToken,
        field: "weeklyByAthleteId",
        oldSharedAthleteId: stale,
        newSharedAthleteId: canonical,
      });
    }

    const athletes = Array.isArray(nextEntry.athletes) ? [...nextEntry.athletes] : [];
    let athletesChanged = false;
    const nextAthletes = athletes.map((a) => {
      if (!a || typeof a !== "object") return a;
      const id =
        typeof (a as { id?: unknown }).id === "string"
          ? (a as { id: string }).id.trim()
          : "";
      if (id !== stale) return a;
      athletesChanged = true;
      logMutation(mutations, {
        store: "coachWeeklySyncCacheByToken",
        recordId: linkToken,
        field: "athletes[].id",
        oldSharedAthleteId: stale,
        newSharedAthleteId: canonical,
      });
      return { ...a, id: canonical };
    });
    if (athletesChanged) {
      nextEntry.athletes = nextAthletes;
      entryTouched = true;
    }

    if (entryTouched) {
      nextWeeklyMap[linkToken] = nextEntry;
      weeklyMapChanged = true;
    }
  }

  if (weeklyMapChanged) {
    await AsyncStorage.setItem(
      StorageKeys.coachWeeklySyncCacheByToken,
      JSON.stringify(nextWeeklyMap),
    );
  }

  const proofMap = await readProofMap();
  if (stale in proofMap) {
    const nextProof = { ...proofMap };
    const staleArtifact = nextProof[stale];
    if (staleArtifact && typeof staleArtifact === "object" && !Array.isArray(staleArtifact)) {
      if (!(canonical in nextProof)) {
        nextProof[canonical] = {
          ...(staleArtifact as Record<string, unknown>),
          sharedAthleteId: canonical,
        };
      }
    }
    delete nextProof[stale];
    await AsyncStorage.setItem(
      StorageKeys.coachTrainingProofByAthleteId,
      JSON.stringify(nextProof),
    );
    logMutation(mutations, {
      store: "coachTrainingProofByAthleteId",
      recordId: stale,
      field: "mapKey",
      oldSharedAthleteId: stale,
      newSharedAthleteId: canonical,
    });
  }

  const aggregateMap = await readAggregateMap();
  if (stale in aggregateMap) {
    const nextAgg = { ...aggregateMap };
    const staleArtifact = nextAgg[stale];
    if (staleArtifact && typeof staleArtifact === "object" && !Array.isArray(staleArtifact)) {
      if (!(canonical in nextAgg)) {
        nextAgg[canonical] = {
          ...(staleArtifact as Record<string, unknown>),
          sharedAthleteId: canonical,
        };
      }
    }
    delete nextAgg[stale];
    await AsyncStorage.setItem(
      StorageKeys.coachCompetitionAggregatesByAthleteId,
      JSON.stringify(nextAgg),
    );
    logMutation(mutations, {
      store: "coachCompetitionAggregatesByAthleteId",
      recordId: stale,
      field: "mapKey",
      oldSharedAthleteId: stale,
      newSharedAthleteId: canonical,
    });
  }

  resetLineageIntegrityDedupeDev();
  notifyActiveAthleteChanged();

  const postValidationWarnings = runLineageIntegrityScan(
    await buildPostRepairScanInput(await getActiveAthleteId()),
  );

  console.log("[LINEAGE_REPAIR_COMPLETE]", {
    dryRun: false,
    repairReason,
    repairSource,
    mutationCount: mutations.length,
    postValidationWarningCount: postValidationWarnings.length,
    postValidationCodes: [...new Set(postValidationWarnings.map((w) => w.code))],
  });

  return { dryRun: false, preview, mutations, postValidationWarnings };
}
