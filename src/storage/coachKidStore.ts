import AsyncStorage from "@react-native-async-storage/async-storage";

import { dedupeActiveCoachWriterLinks } from "../coachShare/coachLinkBinding";
import { normalizeInviteLinkToken } from "../coachShare/inviteLinkToken";
import { isCoachSyncConfigured } from "../config/coachSync";
import {
  logAthleteLineageTrace,
  logAthleteLineageTraceFromKidsById,
} from "../identity/athleteLineageTrace";
import { logIdentityMintTrace } from "../identity/identityMintTrace";
import { buildCanonicalSharedAthletePrimaryRowMap } from "../identity/canonicalSharedAthleteOwner";
import {
  athleteIdSetFromSynced,
  logHydrationPipelineCanonicalReconcile,
  logHydrationPipelineWatchAthletes,
  namesByIdFromSyncedAthletes,
} from "../identity/hydrationPipelineTrace";
import { logCompSave } from "../dev/competitionMutationDevLog";
import {
  createCompetitionTopologyTraceId,
  logCompetitionTopologyTrace,
} from "../dev/competitionTopologyTrace";
import {
  logCacheProvenance,
  logKeyRead,
  logKeyWrite,
} from "../dev/persistenceAudit";
import { normalizePublishableSystemKey } from "../lib/taxonomy/publishableSystemKey";
import {
  CoachWeeklySyncApiError,
  coachSyncDeleteSessionAthlete,
  coachSyncFetchSession,
} from "../services/coachWeeklySyncApi";
import type { CoachLink } from "../types/coachShare";
import {
  deleteAllKidCompetitionEntriesForKid,
  stripWorkerSyncLinkageForKid,
  upsertSharedCompetitionsForKid,
} from "./kidCompetitionStore";
import { getCoachLinks } from "./coachShareStore";
import {
  isValidSyncedCompetitionAggregateArtifact,
  pruneCoachCompetitionAggregates,
  removeCoachCompetitionAggregate,
  writeCoachCompetitionAggregate,
} from "./coachCompetitionAggregateStore";
import {
  isValidSyncedCompetitionTopologyArtifact,
  pruneCoachCompetitionTopology,
  removeCoachCompetitionTopology,
  writeCoachCompetitionTopology,
} from "./coachCompetitionTopologyStore";
import {
  isValidSyncedTrainingProofArtifact,
  peekCoachTrainingProof,
  pruneCoachTrainingProof,
  removeCoachTrainingProof,
  writeCoachTrainingProof,
} from "./coachTrainingProofStore";
import {
  pruneCoachMatchBreakdownArtifactSets,
  removeCoachMatchBreakdownArtifactSet,
} from "./coachMatchBreakdownArtifactStore";
import { reconcileCoachMatchBreakdownArtifacts } from "../domain/competition/reconcileCoachMatchBreakdownArtifacts";
import { bumpCoachSyncHydrationVersion } from "./coachSyncHydrationStore";
import { setCachedWeeklyForLinkToken } from "./coachWeeklySyncCacheStore";
import { deleteKidStandingGuidanceForKid } from "./kidStandingGuidanceStore";
import { clearLastAthleteKidIdIfMatches } from "./lastAthleteIdStore";
import { deleteSessionsForKid } from "./sessionsStore";
import { StorageKeys } from "./storageKeys";
import {
  isKidCoachArchived,
  type CoachOutcome,
  type Kid,
  type KidId,
  type KidWeeklyFocusEntry,
  type KidWeeklyFocusEntryCustom,
  type KidWeeklyFocusEntryTemplate,
  type KidsById,
} from "../types/coachKid";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedCompetitionAggregateArtifact,
  SyncedCompetitionTopologyArtifact,
  SyncedSharedAthlete,
  SyncedSharedCompetition,
  SyncedTrainingProofArtifact,
  SyncedWeeklyMessagePayload,
} from "../types/coachWeeklySync";
import {
  applySharedAthleteToKidRow,
  findUniqueLocalOnlyKidForRemoteAthlete,
} from "./coachKidRosterMergePure";

export {
  applySharedAthleteToKidRow,
  normalizeKidRosterName,
} from "./coachKidRosterMergePure";

type KidWeeklyFocusAppendInput =
  | (KidWeeklyFocusEntryTemplate & {
      kidId: KidId;
      weekStartYMD: string;
      systemKey?: string;
      coachOutcome?: KidWeeklyFocusEntry["coachOutcome"];
      sparringApplication?: KidWeeklyFocusEntry["sparringApplication"];
      coachNotes?: string;
      missionResourceUrl?: string;
      missionResourceLabel?: string;
      familyResourceUrl?: string;
      familyResourceLabel?: string;
      familyCoachRecapNote?: string;
    })
  | (KidWeeklyFocusEntryCustom & {
      kidId: KidId;
      weekStartYMD: string;
      systemKey?: string;
      coachOutcome?: KidWeeklyFocusEntry["coachOutcome"];
      sparringApplication?: KidWeeklyFocusEntry["sparringApplication"];
      coachNotes?: string;
      missionResourceUrl?: string;
      missionResourceLabel?: string;
      familyResourceUrl?: string;
      familyResourceLabel?: string;
      familyCoachRecapNote?: string;
    });

function safeParseOrDefault<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toYMDLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Monday week boundary in local time (matches the app’s training-week logic).
 */
export function startOfWeekMondayYMD(dateYMD: string): string {
  const [y, m, d] = dateYMD.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 Sun - 6 Sat
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  return toYMDLocal(date);
}

const MAX_WEEKLY_FOCUS_ENTRIES_PER_KID = 60;

function newEntryId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Keep the newest N entries per kid by createdAt (append-only safe). */
function capEntriesByKid(all: KidWeeklyFocusEntry[]): KidWeeklyFocusEntry[] {
  const byKid = new Map<KidId, KidWeeklyFocusEntry[]>();
  for (const entry of all) {
    const arr = byKid.get(entry.kidId) ?? [];
    arr.push(entry);
    byKid.set(entry.kidId, arr);
  }

  const capped: KidWeeklyFocusEntry[] = [];
  for (const [, entries] of byKid.entries()) {
    const sorted = entries
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    capped.push(...sorted.slice(0, MAX_WEEKLY_FOCUS_ENTRIES_PER_KID));
  }

  capped.sort(
    (a, b) =>
      b.weekStartYMD.localeCompare(a.weekStartYMD) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.kidId.localeCompare(b.kidId),
  );

  return capped;
}

async function getKidWeeklyFocusEntriesRaw(): Promise<KidWeeklyFocusEntry[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.kidWeeklyFocusEntries);
  logKeyRead({
    key: StorageKeys.kidWeeklyFocusEntries,
    raw,
    source: "coachKidStore.getKidWeeklyFocusEntriesRaw",
  });
  logCacheProvenance({
    key: StorageKeys.kidWeeklyFocusEntries,
    raw,
    source: "coachKidStore.getKidWeeklyFocusEntriesRaw",
    readKind: "diskRead",
  });
  const parsed = safeParseOrDefault<KidWeeklyFocusEntry[] | null>(raw, null);
  return parsed && Array.isArray(parsed) ? parsed : [];
}

async function setKidWeeklyFocusEntriesRaw(
  entries: KidWeeklyFocusEntry[],
): Promise<void> {
  logKeyWrite({
    key: StorageKeys.kidWeeklyFocusEntries,
    raw: JSON.stringify(entries),
    source: "coachKidStore.setKidWeeklyFocusEntriesRaw",
    extra: { entryCount: entries.length },
  });
  await AsyncStorage.setItem(
    StorageKeys.kidWeeklyFocusEntries,
    JSON.stringify(entries),
  );
}

export async function getFamilyCompetitionSelectedKidId(): Promise<KidId | null> {
  const raw = await AsyncStorage.getItem(StorageKeys.familyCompetitionSelectedKidId);
  const t = raw?.trim();
  return t ? t : null;
}

export async function setFamilyCompetitionSelectedKidId(kidId: KidId): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.familyCompetitionSelectedKidId, kidId);
}

export async function clearFamilyCompetitionSelectedKidId(): Promise<void> {
  await AsyncStorage.removeItem(StorageKeys.familyCompetitionSelectedKidId);
}

export async function getKidsById(): Promise<KidsById> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachKidsById);
  logKeyRead({
    key: StorageKeys.coachKidsById,
    raw,
    source: "coachKidStore.getKidsById",
  });
  const kids = safeParseOrDefault<KidsById>(raw, {});
  logCacheProvenance({
    key: StorageKeys.coachKidsById,
    raw,
    source: "coachKidStore.getKidsById",
    readKind: "diskRead",
    athleteIds: Object.keys(kids),
    sharedAthleteIds: Object.values(kids)
      .map((kid) => (kid?.sharedAthleteId ?? "").trim())
      .filter(Boolean),
    entityCounts: { kidCount: Object.keys(kids).length },
  });
  logAthleteLineageTraceFromKidsById({
    operation: "restore",
    source: "hydration_pipeline",
    kidsById: kids,
    route: "coachKidStore.getKidsById",
  });
  return kids;
}

export async function setKidsById(kidsById: KidsById): Promise<void> {
  logAthleteLineageTraceFromKidsById({
    operation: "persist",
    source: "athlete_store",
    kidsById,
    route: "coachKidStore.setKidsById",
  });
  const raw = JSON.stringify(kidsById);
  logKeyWrite({
    key: StorageKeys.coachKidsById,
    raw,
    source: "coachKidStore.setKidsById",
    extra: { kidCount: Object.keys(kidsById).length },
  });
  await AsyncStorage.setItem(StorageKeys.coachKidsById, raw);
}

/** Drop sync-session athlete id only; keeps name and other pilot data. */
export async function clearKidSharedAthleteLink(kidId: KidId): Promise<Kid | null> {
  const kids = await getKidsById();
  const existing = kids[kidId];
  if (!existing) return null;
  const sid = existing.sharedAthleteId?.trim();
  if (!sid) return existing;

    await removeCoachCompetitionAggregate(sid);
    await removeCoachCompetitionTopology(sid);
    await removeCoachTrainingProof(sid);
    await removeCoachMatchBreakdownArtifactSet(sid);

  const nowIso = new Date().toISOString();
  const { sharedAthleteId: _omit, sharedFromInviteTokenNorm: _tok, ...rest } = existing;
  const nextKid: Kid = { ...rest, updatedAt: nowIso };
  await setKidsById({ ...kids, [kidId]: nextKid });
  return nextKid;
}

/** After parent creates a session athlete, bind it to an existing roster row (relink / no duplicate kid). */
export async function attachSharedAthleteToKid(
  kidId: KidId,
  athlete: SyncedSharedAthlete,
  sharedFromInviteTokenNorm?: string,
): Promise<Kid | null> {
  const kids = await getKidsById();
  const existing = kids[kidId];
  if (!existing) return null;

  const tokenNormRaw = sharedFromInviteTokenNorm?.trim();
  const tokenNorm = tokenNormRaw ? normalizeInviteLinkToken(tokenNormRaw) : "";
  const sharedAthleteId = (typeof athlete.id === "string" ? athlete.id : "").trim();

  const next = applySharedAthleteToKidRow(existing, athlete, sharedFromInviteTokenNorm);
  logIdentityMintTrace(
    existing.sharedAthleteId?.trim() && existing.sharedAthleteId.trim() !== sharedAthleteId
      ? "relink"
      : "bind_existing",
    {
      sourceFlow: "parent_relink_existing_kid",
      callerFunction: "coachKidStore.attachSharedAthleteToKid",
      athleteName: athlete.name,
      existingSharedId: existing.sharedAthleteId ?? null,
      newlyMintedSharedId: sharedAthleteId,
      inviteToken: tokenNorm || null,
      linkedKidId: kidId,
      idKind: "shared_ath",
    },
  );
  logAthleteLineageTrace({
    operation: "attach",
    source: "parent_attach_flow",
    athleteName: athlete.name,
    sharedAthleteId,
    previousSharedAthleteId: existing.sharedAthleteId ?? null,
    linkedKidId: kidId,
    token: tokenNorm || null,
    route: "coachKidStore.attachSharedAthleteToKid",
  });
  await setKidsById({ ...kids, [kidId]: next });
  return next;
}

/**
 * Parent-managed bind: create a `Kid` projection for the remote session athlete id (no token-level id rewrite).
 */
export async function createParentManagedKidWithSharedAthlete(input: {
  localKidId: KidId;
  athlete: SyncedSharedAthlete;
  inviteTokenRaw: string;
  createdAtIso?: string;
}): Promise<Kid> {
  const kids = await getKidsById();
  const nowIso = input.createdAtIso ?? new Date().toISOString();
  const tokenNorm = normalizeInviteLinkToken(input.inviteTokenRaw);
  const sharedAthleteId = (typeof input.athlete.id === "string" ? input.athlete.id : "").trim();

  const createdKid: Kid = {
    id: input.localKidId,
    name: input.athlete.name,
    sharedAthleteId,
    sharedFromInviteTokenNorm: tokenNorm,
    isParentManagedChildProfile: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  logIdentityMintTrace("bind_existing", {
    sourceFlow: "parent_bind_new_kid_projection",
    callerFunction: "coachKidStore.createParentManagedKidWithSharedAthlete",
    athleteName: input.athlete.name,
    existingSharedId: null,
    newlyMintedSharedId: sharedAthleteId,
    inviteToken: tokenNorm || null,
    linkedKidId: input.localKidId,
    localAthleteId: input.localKidId,
    idKind: "shared_ath",
    extra: { kidRowMinted: input.localKidId },
  });
  logAthleteLineageTrace({
    operation: "create",
    source: "parent_attach_flow",
    athleteName: input.athlete.name,
    sharedAthleteId,
    linkedKidId: input.localKidId,
    localAthleteId: input.localKidId,
    token: tokenNorm || null,
    route: "coachKidStore.createParentManagedKidWithSharedAthlete",
  });
  await setKidsById({ ...kids, [input.localKidId]: createdKid });
  return createdKid;
}

/**
 * After removing an invite from this device (or coach archives it): clear local athlete/token
 * binding and worker competition linkage for kids tied to that invite. Always matches on
 * normalized token; optionally also clears athletes listed on a successfully fetched session
 * when their stored token is missing or matches the same invite (avoids cross-invite clears).
 */
export async function clearLocalCoachSharingBindingsForInviteToken(
  inviteLinkTokenRaw: string,
  options?: { sessionAthleteIds?: Set<string> | null },
): Promise<void> {
  const norm = normalizeInviteLinkToken(inviteLinkTokenRaw);
  if (!norm) return;

  const kids = await getKidsById();
  const sessionSet = options?.sessionAthleteIds ?? null;

  for (const kid of Object.values(kids)) {
    const kidToken = normalizeInviteLinkToken(kid.sharedFromInviteTokenNorm);
    const sid = kid.sharedAthleteId?.trim() ?? "";

    const matchByToken = kidToken === norm;
    const matchBySession =
      Boolean(sessionSet && sid && sessionSet.has(sid)) && (!kidToken || kidToken === norm);

    if (!matchByToken && !matchBySession) continue;

    if (sid) {
      await clearKidSharedAthleteLink(kid.id);
      await stripWorkerSyncLinkageForKid(kid.id);
      continue;
    }

    if (matchByToken && kid.sharedFromInviteTokenNorm?.trim()) {
      const fresh = await getKidsById();
      const ex = fresh[kid.id];
      if (!ex) continue;
      const nowIso = new Date().toISOString();
      const { sharedFromInviteTokenNorm: _omitTok, ...rest } = ex;
      await setKidsById({ ...fresh, [kid.id]: { ...rest, updatedAt: nowIso } });
    }
  }
}

/**
 * Parent removes one athlete from the linked coach’s sync session (server + local unlink).
 * Idempotent when the athlete is already gone on the server (404).
 */
export async function unlinkParentAthleteFromCoachSession(opts: {
  kidId: KidId;
  linkToken: string;
  parentWriterSecret: string;
  apiBaseUrl?: string | null;
}): Promise<void> {
  const { kidId, linkToken, parentWriterSecret, apiBaseUrl } = opts;
  const kids = await getKidsById();
  const kid = kids[kidId];
  const sharedAthleteId = kid?.sharedAthleteId?.trim();
  if (!kid || !sharedAthleteId) {
    throw new CoachWeeklySyncApiError("This athlete is not linked for coach sharing.", 0);
  }

  if (__DEV__) {
    console.log("[REMOTE_DELETE_PROPAGATION]", {
      sharedAthleteId,
      localDeletionSuccess: false,
      workerDeleteRequestFired: true,
      endpointUrl: null,
      responseCode: null,
      responsePayload: null,
      retryFailureState: null,
      source: "coachKidStore.unlinkParentAthleteFromCoachSession.before_worker_delete",
      timestamp: new Date().toISOString(),
    });
    console.log("[PARENT_ATHLETE_DELETE_AUDIT]", {
      athleteId: kidId,
      sharedAthleteId,
      linkedInviteIds: [normalizeInviteLinkToken(linkToken)].filter(Boolean),
      deletedLocally: false,
      publishedDeletionEvent: true,
      retiredInviteIds: [],
      removedSharedAthleteId: false,
      removedWriterLinks: false,
      workerDeleteEndpointCalled: true,
      source: "coachKidStore.unlinkParentAthleteFromCoachSession.before_worker_delete",
      timestamp: new Date().toISOString(),
    });
  }

  await coachSyncDeleteSessionAthlete(
    linkToken,
    sharedAthleteId,
    parentWriterSecret,
    apiBaseUrl,
  );

  await clearKidSharedAthleteLink(kidId);
  await stripWorkerSyncLinkageForKid(kidId);
  if (__DEV__) {
    console.log("[REMOTE_DELETE_PROPAGATION]", {
      sharedAthleteId,
      localDeletionSuccess: true,
      workerDeleteRequestFired: true,
      endpointUrl: null,
      responseCode: null,
      responsePayload: null,
      retryFailureState: null,
      source: "coachKidStore.unlinkParentAthleteFromCoachSession.after_local_unlink",
      timestamp: new Date().toISOString(),
    });
    console.log("[PARENT_ATHLETE_DELETE_AUDIT]", {
      athleteId: kidId,
      sharedAthleteId,
      linkedInviteIds: [normalizeInviteLinkToken(linkToken)].filter(Boolean),
      deletedLocally: true,
      publishedDeletionEvent: true,
      retiredInviteIds: [],
      removedSharedAthleteId: true,
      removedWriterLinks: false,
      workerDeleteEndpointCalled: true,
      source: "coachKidStore.unlinkParentAthleteFromCoachSession.after_local_unlink",
      timestamp: new Date().toISOString(),
    });
  }
}

export type WriterSessionSnapshotOk = {
  linkTokenNorm: string;
  athletes: SyncedSharedAthlete[];
  /** Present when a successful GET `/v1/sessions/:token` was merged for this invite. */
  session?: CoachWeeklySyncSessionResponse;
  /** Same ordering inputs as `sortCoachWriterLinksNewestFirst` (competition hydration). */
  writerLinkUpdatedAt?: string;
  writerLinkCreatedAt?: string;
};

function sharedAthleteIdsFromKids(kidsById: KidsById): string[] {
  return Object.values(kidsById)
    .map((kid) => (kid?.sharedAthleteId ?? "").trim())
    .filter(Boolean)
    .sort();
}

let previousCoachHydrateRemoteAthleteIds: string[] | null = null;

function sortWriterSessionSnapshotsNewestFirst(
  snaps: WriterSessionSnapshotOk[],
): WriterSessionSnapshotOk[] {
  return [...snaps].sort((a, b) => {
    const uA = a.writerLinkUpdatedAt ?? "";
    const uB = b.writerLinkUpdatedAt ?? "";
    const c = uB.localeCompare(uA);
    if (c !== 0) return c;
    const cA = a.writerLinkCreatedAt ?? "";
    const cB = b.writerLinkCreatedAt ?? "";
    return cB.localeCompare(cA);
  });
}

/**
 * Walk writer sessions in traversal order (newest invite first on coach roster refresh) and use
 * the first session whose roster lists the athlete — matches `KidDetailScreen` coach sync.
 */
export function pickRemoteSharedCompetitionsForLinkedAthlete(
  sessionsInWriterLinkTraversalOrder: CoachWeeklySyncSessionResponse[],
  sharedAthleteId: string,
): SyncedSharedCompetition[] {
  const sid = sharedAthleteId.trim();
  if (!sid) {
    console.log("[COMP_SYNC_TRACE] pickRemoteSharedCompetitionsForLinkedAthlete", {
      targetAthleteId: sid,
      sessionCount: sessionsInWriterLinkTraversalOrder.length,
      totalCompetitionsInSession: null,
      filteredCompetitionsCount: 0,
      idsSelected: [] as string[],
      reason: "emptySharedAthleteId",
    });
    return [];
  }
  for (const session of sessionsInWriterLinkTraversalOrder) {
    const totalComps = Array.isArray(session.competitions) ? session.competitions.length : 0;
    const athleteInSession = session.athletes.some((a) => a.id.trim() === sid);
    const filtered = athleteInSession
      ? session.competitions.filter((c) => c.sharedAthleteId === sid)
      : [];
    console.log("[COMP_SYNC_TRACE] pickRemoteSharedCompetitionsForLinkedAthlete", {
      targetAthleteId: sid,
      totalCompetitionsInSession: totalComps,
      filteredCompetitionsCount: filtered.length,
      idsSelected: filtered.map((c) => c.id),
      athleteInSession,
    });
    if (athleteInSession) {
      return filtered;
    }
  }
  console.log("[COMP_SYNC_TRACE] pickRemoteSharedCompetitionsForLinkedAthlete", {
    targetAthleteId: sid,
    sessionCount: sessionsInWriterLinkTraversalOrder.length,
    totalCompetitionsInSession: null,
    filteredCompetitionsCount: 0,
    idsSelected: [] as string[],
    reason: "noSessionListedAthlete",
  });
  return [];
}

/**
 * Walk writer sessions in traversal order, collect all valid aggregates for the athlete,
 * and return the one with the newest `updatedAt` (traversal order breaks ties).
 */
export function pickRemoteCompetitionAggregateForLinkedAthlete(
  sessionsInWriterLinkTraversalOrder: CoachWeeklySyncSessionResponse[],
  sharedAthleteId: string,
): SyncedCompetitionAggregateArtifact | null {
  const sid = sharedAthleteId.trim();
  if (!sid) return null;

  const candidates: SyncedCompetitionAggregateArtifact[] = [];
  const traversalOrderUpdatedAts: string[] = [];
  let athleteListedInAnySession = false;

  for (const session of sessionsInWriterLinkTraversalOrder) {
    const athleteInSession = session.athletes.some((a) => a.id.trim() === sid);
    if (!athleteInSession) continue;

    athleteListedInAnySession = true;

    const candidate = session.competitionAggregateByAthleteId?.[sid];
    if (
      candidate &&
      isValidSyncedCompetitionAggregateArtifact(candidate) &&
      candidate.sharedAthleteId.trim() === sid
    ) {
      candidates.push(candidate);
      traversalOrderUpdatedAts.push(candidate.updatedAt);
    }
  }

  if (candidates.length === 0) {
    if (__DEV__ && athleteListedInAnySession) {
      console.log("[COMP_AGG_TRACE] stale_local_proof_possible", {
        athleteId: sid,
      });
    }
    return null;
  }

  let selected = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.updatedAt.localeCompare(selected.updatedAt) > 0) {
      selected = c;
    }
  }

  if (__DEV__) {
    console.log("[COMP_AGG_TRACE] selected_candidate", {
      athleteId: sid,
      selectedUpdatedAt: selected.updatedAt,
      candidateCount: candidates.length,
      traversalOrderUpdatedAts,
    });
    console.log("[COMP_AGGREGATE_TRACE]", {
      stage: "coach_hydrate_candidate_selected",
      sharedAthleteId: sid,
      candidateCount: candidates.length,
      traversalOrderUpdatedAts,
      incoming: {
        updatedAt: selected.updatedAt,
        totalCompetitions: selected.totalCompetitions,
        totalMatches: selected.totalMatches,
        wins: selected.wins,
        losses: selected.losses,
        submissionRate: selected.submissionRate,
        fastestSubmission: selected.fastestSubmissionSeconds,
      },
    });
  }

  return selected;
}

/**
 * Walk writer sessions in traversal order, collect all valid canonical topology artifacts for the
 * athlete, and return the one with the newest `updatedAt` (traversal order breaks ties).
 */
export function pickRemoteCompetitionTopologyForLinkedAthlete(
  sessionsInWriterLinkTraversalOrder: CoachWeeklySyncSessionResponse[],
  sharedAthleteId: string,
): SyncedCompetitionTopologyArtifact | null {
  const sid = sharedAthleteId.trim();
  if (!sid) return null;

  const candidates: SyncedCompetitionTopologyArtifact[] = [];
  const traversalOrderUpdatedAts: string[] = [];
  for (const session of sessionsInWriterLinkTraversalOrder) {
    const athleteInSession = session.athletes.some((a) => a.id.trim() === sid);
    if (!athleteInSession) continue;

    const candidate = session.competitionTopologyByAthleteId?.[sid];
    if (
      candidate &&
      isValidSyncedCompetitionTopologyArtifact(candidate) &&
      candidate.sharedAthleteId.trim() === sid
    ) {
      candidates.push(candidate);
      traversalOrderUpdatedAts.push(candidate.updatedAt);
      if (__DEV__) {
        for (const competition of candidate.competitions) {
          console.log("[COACH_TOPOLOGY_ACCEPTANCE_TRACE]", {
            sharedCompetitionId: competition.sharedCompetitionId,
            incomingUpdatedAt: candidate.updatedAt,
            existingUpdatedAt: null,
            incomingMatchCount: competition.matches.length,
            existingMatchCount: null,
            overwriteAccepted: false,
            rejectionReason: null,
            equalitySkipped: false,
            cacheWritePerformed: false,
            invalidateTriggered: false,
            sharedAthleteId: sid,
            selectionStage: "remote_topology_candidate_seen",
            candidateIndex: candidates.length - 1,
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    if (__DEV__) {
      console.log("[COACH_TOPOLOGY_ACCEPTANCE_TRACE]", {
        sharedCompetitionId: null,
        incomingUpdatedAt: null,
        existingUpdatedAt: null,
        incomingMatchCount: null,
        existingMatchCount: null,
        overwriteAccepted: false,
        rejectionReason: "no_remote_topology_candidates",
        equalitySkipped: false,
        cacheWritePerformed: false,
        invalidateTriggered: false,
        sharedAthleteId: sid,
      });
    }
    return null;
  }

  let selected = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (candidate.updatedAt.localeCompare(selected.updatedAt) > 0) {
      selected = candidate;
    }
  }
  if (__DEV__) {
    for (const competition of selected.competitions) {
      console.log("[COACH_TOPOLOGY_ACCEPTANCE_TRACE]", {
        sharedCompetitionId: competition.sharedCompetitionId,
        incomingUpdatedAt: selected.updatedAt,
        existingUpdatedAt: null,
        incomingMatchCount: competition.matches.length,
        existingMatchCount: null,
        overwriteAccepted: false,
        rejectionReason: null,
        equalitySkipped: false,
        cacheWritePerformed: false,
        invalidateTriggered: false,
        sharedAthleteId: sid,
        selectionStage: "remote_topology_candidate_selected",
        candidateCount: candidates.length,
        traversalOrderUpdatedAts,
      });
    }
  }
  return selected;
}

/**
 * Walk writer sessions in traversal order, collect all valid training proofs for the athlete,
 * and return the one with the newest `updatedAt` (traversal order breaks ties).
 */
export function pickRemoteTrainingProofForLinkedAthlete(
  sessionsInWriterLinkTraversalOrder: CoachWeeklySyncSessionResponse[],
  sharedAthleteId: string,
): SyncedTrainingProofArtifact | null {
  const sid = sharedAthleteId.trim();
  if (!sid) return null;

  const candidates: SyncedTrainingProofArtifact[] = [];
  const traversalOrderUpdatedAts: string[] = [];
  let athleteListedInAnySession = false;

  for (const session of sessionsInWriterLinkTraversalOrder) {
    const athleteInSession = session.athletes.some((a) => a.id.trim() === sid);
    if (!athleteInSession) continue;

    athleteListedInAnySession = true;

    const candidate = session.trainingProofByAthleteId?.[sid];
    if (
      candidate &&
      isValidSyncedTrainingProofArtifact(candidate) &&
      candidate.sharedAthleteId.trim() === sid
    ) {
      candidates.push(candidate);
      traversalOrderUpdatedAts.push(candidate.updatedAt);
    }
  }

  if (candidates.length === 0) {
    if (__DEV__ && athleteListedInAnySession) {
      console.log("[TRAINING_PROOF_HYDRATE] stale_local_proof_possible", {
        athleteId: sid,
      });
    }
    return null;
  }

  let selected = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.updatedAt.localeCompare(selected.updatedAt) > 0) {
      selected = c;
    }
  }

  if (__DEV__) {
    console.log("[TRAINING_PROOF_HYDRATE] selected_candidate", {
      athleteId: sid,
      selectedUpdatedAt: selected.updatedAt,
      candidateCount: candidates.length,
      traversalOrderUpdatedAts,
    });
  }

  return selected;
}

export function pickPublishedWeeklyParentFeedbackForSharedAthlete(
  sessionsInWriterLinkTraversalOrder: CoachWeeklySyncSessionResponse[],
  sharedAthleteId: string,
): SyncedWeeklyMessagePayload["parentFeedback"] | null {
  const sid = sharedAthleteId.trim();
  if (!sid) return null;
  for (const session of sessionsInWriterLinkTraversalOrder) {
    if (session.athletes.some((a) => a.id.trim() === sid)) {
      return session.weeklyByAthleteId?.[sid]?.parentFeedback ?? null;
    }
  }
  return null;
}

/**
 * Applies remote roster athletes onto a draft `KidsById` map (no persistence).
 * Upserts **each** remote athlete id independently; sibling ids sharing one invite remain distinct.
 * When several rows claim the **same** `sharedAthleteId`, updates whichever row
 * {@link buildCanonicalSharedAthletePrimaryRowMap} treats as primary for that reconcile pass.
 */
export function mergeWriterSessionRosterIntoKidsDraft(
  kidsDraft: KidsById,
  successfulSnapshots: WriterSessionSnapshotOk[],
  nowIso: string,
): KidsById {
  const rosterResolutionCtx = {
    activeWriterInviteTokenNorms: new Set(successfulSnapshots.map((s) => s.linkTokenNorm)),
    reconcileSource: "reconcileCoachKidRosterFromWriterSessions" as const,
  };

  const next: KidsById = { ...kidsDraft };
  const byShared = buildCanonicalSharedAthletePrimaryRowMap(next, rosterResolutionCtx);

  for (const snap of successfulSnapshots) {
    const token = snap.linkTokenNorm;
    for (const a of snap.athletes) {
      const remoteId = typeof a.id === "string" ? a.id.trim() : "";
      if (!remoteId) continue;

      const id = remoteId;
      if (__DEV__) {
        logHydrationPipelineCanonicalReconcile({
          sourceSubsystem: "coachKidStore.reconcileCoachKidRosterFromWriterSessions",
          inviteTokenNorm: token,
          remoteAthleteId: remoteId,
          attemptedSharedAthleteId: remoteId,
          enforcedSharedAthleteId: id,
          breachCorrected: false,
          skippedRemoteRow: false,
          kidsById: next,
          namesById: namesByIdFromSyncedAthletes(snap.athletes),
        });
      }

      const existing = byShared.get(id);
      if (existing) {
        if (isKidCoachArchived(existing)) {
          continue;
        }
        const existingTok = normalizeInviteLinkToken(existing.sharedFromInviteTokenNorm);
        const needsToken = !existingTok || existingTok !== token;
        if (existing.name !== a.name || needsToken) {
          const updated: Kid = {
            ...existing,
            name: a.name,
            sharedFromInviteTokenNorm: token,
            updatedAt: nowIso,
          };
          next[existing.id] = updated;
          byShared.set(id, updated);
        }
        continue;
      }

      const collapseTarget = findUniqueLocalOnlyKidForRemoteAthlete(next, a.name);
      if (collapseTarget) {
        const updated = applySharedAthleteToKidRow(collapseTarget, a, token, nowIso);
        next[collapseTarget.id] = updated;
        byShared.set(id, updated);
        if (__DEV__) {
          console.log("[bjj-coach-kid-roster] reconcile attach collapse", {
            existingKidId: collapseTarget.id,
            sharedAthleteId: id,
            remoteName: a.name,
          });
        }
        continue;
      }

      const localId = `kid_shared_${id}` as KidId;
      const rowAtId = next[localId];
      if (rowAtId) {
        if (isKidCoachArchived(rowAtId)) {
          continue;
        }
        const updated: Kid = {
          ...rowAtId,
          name: a.name,
          sharedAthleteId: id,
          sharedFromInviteTokenNorm: token,
          updatedAt: nowIso,
        };
        next[localId] = updated;
        byShared.set(id, updated);
        continue;
      }

      next[localId] = {
        id: localId,
        name: a.name,
        sharedAthleteId: id,
        sharedFromInviteTokenNorm: token,
        createdAt: a.createdAt,
        updatedAt: nowIso,
      };
      logIdentityMintTrace("fallback_create", {
        sourceFlow: "coach_writer_session_reconcile",
        callerFunction: "coachKidStore.mergeWriterSessionRosterIntoKidsDraft",
        athleteName: a.name,
        existingSharedId: null,
        newlyMintedSharedId: id,
        inviteToken: token,
        linkedKidId: localId,
        idKind: "shared_ath",
        extra: { kidRowId: localId, remoteCreatedAt: a.createdAt },
      });
      logAthleteLineageTrace({
        operation: "reconcile_candidate",
        source: "coach_roster_reconcile",
        athleteName: a.name,
        sharedAthleteId: id,
        linkedKidId: localId,
        token,
        route: "coachKidStore.mergeWriterSessionRosterIntoKidsDraft",
        extra: { remoteCreatedAt: a.createdAt },
      });
      byShared.set(id, next[localId]);
      if (__DEV__) {
        console.log("[bjj-coach-kid-roster] reconcile kid_shared insert", {
          localId,
          sharedAthleteId: id,
          remoteName: a.name,
        });
      }
    }
  }

  return next;
}

/**
 * Coach roster: merge athletes from each **successful** writer session GET, then prune stale linked rows.
 * - When every active writer session was fetched successfully, prunes any `sharedAthleteId` not in the
 *   union of remote athletes (same as legacy merge + `pruneOrphansWhenAuthoritative`).
 * - When some GETs failed, prunes only rows tagged with `sharedFromInviteTokenNorm` for a session we
 *   did fetch whose athlete list no longer contains that id — so one dead invite fetch does not block
 *   pruning another invite’s removed athletes.
 */
export async function reconcileCoachKidRosterFromWriterSessions(opts: {
  successfulSnapshots: WriterSessionSnapshotOk[];
  totalActiveWriterCount: number;
}): Promise<KidsById> {
  const { successfulSnapshots, totalActiveWriterCount } = opts;
  if (successfulSnapshots.length === 0) {
    return getKidsById();
  }

  const kids = await getKidsById();
  const existingLocalAthleteIds = sharedAthleteIdsFromKids(kids);
  const nowIso = new Date().toISOString();
  const next = mergeWriterSessionRosterIntoKidsDraft(kids, successfulSnapshots, nowIso);
  const afterMergeAthleteIds = sharedAthleteIdsFromKids(next);

  await setKidsById(next);

  const allFetched =
    totalActiveWriterCount > 0 && successfulSnapshots.length === totalActiveWriterCount;

  const remoteUnionIds = new Set<string>();
  for (const snap of successfulSnapshots) {
    for (const a of snap.athletes) {
      const id = typeof a.id === "string" ? a.id.trim() : "";
      if (id) remoteUnionIds.add(id);
    }
  }

  const current = await getKidsById();
  const toDelete = new Set<KidId>();
  const preserveReasons: Record<string, string> = {};

  if (allFetched) {
    for (const k of Object.values(current)) {
      if (isKidCoachArchived(k)) continue;
      const sid = k.sharedAthleteId?.trim();
      if (!sid || remoteUnionIds.has(sid)) continue;
      toDelete.add(k.id);
      preserveReasons[sid] = "not_preserved_all_writers_fetched_missing_from_remote_union";
    }
  } else {
    for (const snap of successfulSnapshots) {
      const idsInSnap = new Set(
        snap.athletes
          .map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
          .filter(Boolean),
      );
      for (const k of Object.values(current)) {
        if (isKidCoachArchived(k)) continue;
        const sid = k.sharedAthleteId?.trim();
        if (!sid || idsInSnap.has(sid)) continue;
        const t = normalizeInviteLinkToken(k.sharedFromInviteTokenNorm);
        if (t === snap.linkTokenNorm) {
          toDelete.add(k.id);
          preserveReasons[sid] = "not_preserved_fetched_invite_missing_from_that_remote_session";
        } else if (!preserveReasons[sid]) {
          preserveReasons[sid] = t
            ? "preserved_partial_fetch_different_invite_not_authoritative"
            : "preserved_partial_fetch_missing_invite_token";
        }
      }
    }
  }

  const prunedAthleteIds = Object.values(current)
    .filter((kid) => toDelete.has(kid.id))
    .map((kid) => (kid.sharedAthleteId ?? "").trim())
    .filter(Boolean)
    .sort();
  const prunedAthleteSet = new Set(prunedAthleteIds);
  const currentSharedAthleteIds = sharedAthleteIdsFromKids(current);
  const preservedAthleteIds = currentSharedAthleteIds
    .filter((id) => !prunedAthleteSet.has(id))
    .sort();
  const missingRemoteButPreservedIds = preservedAthleteIds
    .filter((id) => !remoteUnionIds.has(id))
    .sort();
  for (const id of missingRemoteButPreservedIds) {
    if (!preserveReasons[id]) {
      preserveReasons[id] = allFetched
        ? "preserved_no_delete_candidate_detected"
        : "preserved_partial_writer_fetch_not_authoritative";
    }
  }
  const newlyAddedAthleteIds = afterMergeAthleteIds
    .filter((id) => !existingLocalAthleteIds.includes(id))
    .sort();
  if (__DEV__) {
    console.log("[CANONICAL_RETIREMENT_HYDRATION]", {
      payloadAthleteIds: [...remoteUnionIds].sort(),
      removedAthleteIdsComparedToPreviousHydrate: [],
      pruneResults: {
        prunedAthleteIds,
        preservedAthleteIds,
        missingRemoteButPreservedIds,
      },
      source: "reconcileCoachKidRosterFromWriterSessions",
      timestamp: new Date().toISOString(),
    });
    console.log("[REMOTE_RECONCILE_DECISION]", {
      remoteIds: [...remoteUnionIds].sort(),
      localIds: currentSharedAthleteIds,
      prunedIds: prunedAthleteIds,
      preservedIds: preservedAthleteIds,
      preserveReasons,
      remoteMissingButLocalPreserved: missingRemoteButPreservedIds,
      reconcileSource: "reconcileCoachKidRosterFromWriterSessions",
      writerSessionFetchSucceeded: successfulSnapshots.length > 0,
      allWriterSessionsFetched: allFetched,
      timestamp: new Date().toISOString(),
    });
    console.log("[COACH_RECONCILE_PRUNING]", {
      existingLocalAthleteIds,
      incomingRemoteAthleteIds: [...remoteUnionIds].sort(),
      preservedAthleteIds,
      prunedAthleteIds,
      newlyAddedAthleteIds,
      missingRemoteButPreservedIds,
      preserveReasons,
      reconcileSource: "reconcileCoachKidRosterFromWriterSessions",
      writerSessionFetchSucceeded: successfulSnapshots.length > 0,
      allWriterSessionsFetched: allFetched,
      totalActiveWriterCount,
      successfulSnapshotCount: successfulSnapshots.length,
      timestamp: new Date().toISOString(),
    });
  }

  for (const oid of toDelete) {
    await deleteKidPilot(oid);
  }

  await pruneCoachCompetitionAggregatesAfterRosterReconcile({
    totalActiveWriterCount,
    remoteUnionIds,
    allFetched,
  });
  await pruneCoachCompetitionTopologyAfterRosterReconcile({
    totalActiveWriterCount,
    remoteUnionIds,
    allFetched,
  });
  await pruneCoachTrainingProofAfterRosterReconcile({
    totalActiveWriterCount,
    remoteUnionIds,
    allFetched,
  });

  return getKidsById();
}

async function pruneCoachCompetitionAggregatesAfterRosterReconcile(opts: {
  totalActiveWriterCount: number;
  remoteUnionIds: Set<string>;
  allFetched: boolean;
}): Promise<void> {
  const { totalActiveWriterCount, remoteUnionIds, allFetched } = opts;
  if (!allFetched || totalActiveWriterCount <= 0) return;
  await pruneCoachCompetitionAggregates(remoteUnionIds);
}

async function pruneCoachTrainingProofAfterRosterReconcile(opts: {
  totalActiveWriterCount: number;
  remoteUnionIds: Set<string>;
  allFetched: boolean;
}): Promise<void> {
  const { totalActiveWriterCount, remoteUnionIds, allFetched } = opts;
  if (!allFetched || totalActiveWriterCount <= 0) return;
  await pruneCoachTrainingProof(remoteUnionIds);
}

async function pruneCoachCompetitionTopologyAfterRosterReconcile(opts: {
  totalActiveWriterCount: number;
  remoteUnionIds: Set<string>;
  allFetched: boolean;
}): Promise<void> {
  const { totalActiveWriterCount, remoteUnionIds, allFetched } = opts;
  if (!allFetched || totalActiveWriterCount <= 0) return;
  await pruneCoachCompetitionTopology(remoteUnionIds);
}

async function pruneCoachMatchBreakdownArtifactsAfterRosterReconcile(opts: {
  totalActiveWriterCount: number;
  remoteUnionIds: Set<string>;
  allFetched: boolean;
}): Promise<void> {
  const { totalActiveWriterCount, remoteUnionIds, allFetched } = opts;
  if (!allFetched || totalActiveWriterCount <= 0) return;
  await pruneCoachMatchBreakdownArtifactSets(remoteUnionIds);
}

/**
 * Hydrates local bounded competition aggregate artifacts from successful writer session GETs.
 * Overwrite-only; no competition rows, Summary, or signals side effects.
 */
export async function reconcileCoachCompetitionAggregatesFromWriterSessions(opts: {
  successfulSnapshots: WriterSessionSnapshotOk[];
  totalActiveWriterCount: number;
}): Promise<void> {
  const { successfulSnapshots, totalActiveWriterCount } = opts;
  if (totalActiveWriterCount <= 0 || successfulSnapshots.length === 0) return;

  const withSession = successfulSnapshots.filter(
    (s): s is WriterSessionSnapshotOk & { session: CoachWeeklySyncSessionResponse } =>
      Boolean(s.session),
  );
  if (withSession.length === 0) return;

  if (__DEV__) {
    console.log("[COMP_AGG_TRACE] hydrate_start", {
      snapshotCount: withSession.length,
    });
  }

  const sorted = sortWriterSessionSnapshotsNewestFirst(withSession);
  const sessionsOrdered: CoachWeeklySyncSessionResponse[] = sorted
    .map((s) => s.session)
    .filter((s): s is CoachWeeklySyncSessionResponse => Boolean(s));

  const athleteListedInFetchedSessions = (athleteId: string) =>
    sessionsOrdered.some((sess) => sess.athletes.some((a) => a.id.trim() === athleteId));

  const kids = await getKidsById();
  const aggregateResolutionCtx = {
    activeWriterInviteTokenNorms: new Set(successfulSnapshots.map((s) => s.linkTokenNorm)),
    reconcileSource: "reconcileCoachCompetitionAggregatesFromWriterSessions" as const,
  };
  const primaryRosterRows = buildCanonicalSharedAthletePrimaryRowMap(kids, aggregateResolutionCtx);

  for (const k of primaryRosterRows.values()) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    const sharedAthleteId = k.sharedAthleteId?.trim() ?? "";
    if (!sharedAthleteId) continue;
    if (!athleteListedInFetchedSessions(sharedAthleteId)) continue;

    const artifact = pickRemoteCompetitionAggregateForLinkedAthlete(
      sessionsOrdered,
      sharedAthleteId,
    );
    if (artifact) {
      if (__DEV__) {
        console.log("[COMP_AGGREGATE_TRACE]", {
          stage: "coach_hydrate_reconcile_write",
          sharedAthleteId,
          rosterKidId: k.id,
          incoming: {
            updatedAt: artifact.updatedAt,
            totalCompetitions: artifact.totalCompetitions,
            totalMatches: artifact.totalMatches,
            wins: artifact.wins,
            losses: artifact.losses,
            submissionRate: artifact.submissionRate,
            fastestSubmission: artifact.fastestSubmissionSeconds,
          },
        });
      }
      await writeCoachCompetitionAggregate(artifact);
    } else if (__DEV__) {
      console.log("[COMP_AGG_TRACE] hydrate_missing", {
        sharedAthleteId,
        rosterKidId: k.id,
      });
    }
  }
}

/**
 * Hydrates parent-published canonical topology from successful writer session GETs.
 * Newest-wins full overwrite only; no competition rows, projections, or UI side effects.
 */
export async function reconcileCoachCompetitionTopologyFromWriterSessions(opts: {
  successfulSnapshots: WriterSessionSnapshotOk[];
  totalActiveWriterCount: number;
}): Promise<void> {
  const { successfulSnapshots, totalActiveWriterCount } = opts;
  const competitionTopologyTraceId = __DEV__
    ? createCompetitionTopologyTraceId("coach-hydrate")
    : undefined;
  if (totalActiveWriterCount <= 0 || successfulSnapshots.length === 0) return;

  const withSession = successfulSnapshots.filter(
    (s): s is WriterSessionSnapshotOk & { session: CoachWeeklySyncSessionResponse } =>
      Boolean(s.session),
  );
  if (withSession.length === 0) return;

  const sorted = sortWriterSessionSnapshotsNewestFirst(withSession);
  const sessionsOrdered: CoachWeeklySyncSessionResponse[] = sorted
    .map((s) => s.session)
    .filter((s): s is CoachWeeklySyncSessionResponse => Boolean(s));
  logCompetitionTopologyTrace("[COMP_TOPOLOGY_HYDRATE]", "hydrate_receipt", {
    traceId: competitionTopologyTraceId,
    successfulSnapshotCount: successfulSnapshots.length,
    sessionCount: sessionsOrdered.length,
    topologyAthleteKeyCount: sessionsOrdered.reduce(
      (sum, session) => sum + Object.keys(session.competitionTopologyByAthleteId ?? {}).length,
      0,
    ),
  });

  const athleteListedInFetchedSessions = (athleteId: string) =>
    sessionsOrdered.some((session) =>
      session.athletes.some((athlete) => athlete.id.trim() === athleteId),
    );

  const kids = await getKidsById();
  const primaryRosterRows = buildCanonicalSharedAthletePrimaryRowMap(kids, {
    activeWriterInviteTokenNorms: new Set(successfulSnapshots.map((s) => s.linkTokenNorm)),
    reconcileSource: "reconcileCoachCompetitionTopologyFromWriterSessions",
  });

  for (const kid of primaryRosterRows.values()) {
    if (!kid?.id || isKidCoachArchived(kid)) continue;
    const sharedAthleteId = kid.sharedAthleteId?.trim() ?? "";
    if (!sharedAthleteId || !athleteListedInFetchedSessions(sharedAthleteId)) continue;

    const artifact = pickRemoteCompetitionTopologyForLinkedAthlete(
      sessionsOrdered,
      sharedAthleteId,
    );
    if (!artifact) {
      if (__DEV__) {
        console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_missing", {
          traceId: competitionTopologyTraceId,
          sharedAthleteId,
          rosterKidId: kid.id,
        });
      }
      continue;
    }

    const result = await writeCoachCompetitionTopology(artifact, competitionTopologyTraceId);
    if (__DEV__) {
      for (const competition of artifact.competitions) {
        console.log("[COACH_TOPOLOGY_ACCEPTANCE_TRACE]", {
          sharedCompetitionId: competition.sharedCompetitionId,
          incomingUpdatedAt: artifact.updatedAt,
          existingUpdatedAt: null,
          incomingMatchCount: competition.matches.length,
          existingMatchCount: null,
          overwriteAccepted: result === "hydrate_store_overwrite",
          rejectionReason:
            result === "hydrate_skipped_stale"
              ? "writeCoachCompetitionTopology_returned_hydrate_skipped_stale"
              : result === "hydrate_invalid"
                ? "writeCoachCompetitionTopology_returned_hydrate_invalid"
                : null,
          equalitySkipped: result === "hydrate_skipped_stale",
          cacheWritePerformed: result === "hydrate_store_overwrite",
          invalidateTriggered: result === "hydrate_store_overwrite",
          sharedAthleteId,
          selectionStage: "reconcile_write_result",
          writeResult: result,
        });
      }
    }
    if (__DEV__ && result === "hydrate_store_overwrite") {
      console.log("[COMP_TOPOLOGY_HYDRATE] hydrate_ok", {
        sharedAthleteId,
        traceId: competitionTopologyTraceId,
        updatedAt: artifact.updatedAt,
      });
    }
  }
}

/**
 * Hydrates local bounded training proof artifacts from successful writer session GETs.
 * Overwrite-only; no Session[] transport, Summary, or signals side effects.
 */
export async function reconcileCoachTrainingProofFromWriterSessions(opts: {
  successfulSnapshots: WriterSessionSnapshotOk[];
  totalActiveWriterCount: number;
}): Promise<void> {
  const { successfulSnapshots, totalActiveWriterCount } = opts;
  if (totalActiveWriterCount <= 0 || successfulSnapshots.length === 0) return;

  const withSession = successfulSnapshots.filter(
    (s): s is WriterSessionSnapshotOk & { session: CoachWeeklySyncSessionResponse } =>
      Boolean(s.session),
  );
  if (withSession.length === 0) return;

  if (__DEV__) {
    console.log("[TRAINING_PROOF_HYDRATE] hydrate_start", {
      snapshotCount: withSession.length,
    });
  }

  const sorted = sortWriterSessionSnapshotsNewestFirst(withSession);
  const sessionsOrdered: CoachWeeklySyncSessionResponse[] = sorted
    .map((s) => s.session)
    .filter((s): s is CoachWeeklySyncSessionResponse => Boolean(s));

  const athleteListedInFetchedSessions = (athleteId: string) =>
    sessionsOrdered.some((sess) => sess.athletes.some((a) => a.id.trim() === athleteId));

  const kids = await getKidsById();
  const proofResolutionCtx = {
    activeWriterInviteTokenNorms: new Set(successfulSnapshots.map((s) => s.linkTokenNorm)),
    reconcileSource: "reconcileCoachTrainingProofFromWriterSessions" as const,
  };
  const primaryRosterRows = buildCanonicalSharedAthletePrimaryRowMap(kids, proofResolutionCtx);

  for (const k of primaryRosterRows.values()) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    const sharedAthleteId = k.sharedAthleteId?.trim() ?? "";
    if (!sharedAthleteId) continue;
    if (!athleteListedInFetchedSessions(sharedAthleteId)) continue;

    const artifact = pickRemoteTrainingProofForLinkedAthlete(sessionsOrdered, sharedAthleteId);
    if (artifact) {
      if (__DEV__) {
        const existing = peekCoachTrainingProof(sharedAthleteId);
        console.log("[TRAINING_PROOF_COACH_RECEIVE]", {
          athleteId: sharedAthleteId,
          incomingCount: artifact.currentWeekSessionCount,
          incomingUpdatedAt: artifact.updatedAt,
          existingCount: existing?.currentWeekSessionCount ?? null,
          existingUpdatedAt: existing?.updatedAt ?? null,
          overwriteApplied: null,
          overwriteReason: "reconcile_before_writeCoachTrainingProof",
        });
      }
      await writeCoachTrainingProof(artifact);
    } else if (__DEV__) {
      console.log("[TRAINING_PROOF_HYDRATE] hydrate_missing", {
        sharedAthleteId,
        rosterKidId: k.id,
      });
    }
  }
}

/**
 * Hydrates local `kidCompetitionStore` from successful writer session GETs. Uses
 * {@link upsertSharedCompetitionsForKid} as the only merge primitive. Intended to run immediately
 * after {@link reconcileCoachKidRosterFromWriterSessions} with the same `successfulSnapshots` array.
 */
export async function reconcileCoachLinkedCompetitionEntriesFromWriterSessions(opts: {
  successfulSnapshots: WriterSessionSnapshotOk[];
  totalActiveWriterCount: number;
}): Promise<void> {
  const { successfulSnapshots, totalActiveWriterCount } = opts;
  if (totalActiveWriterCount <= 0) {
    console.log("[COMP_SYNC_TRACE] reconcileCoachLinkedCompetitionEntriesFromWriterSessions", {
      earlyExit: "totalActiveWriterCount<=0",
      totalActiveWriterCount,
      successfulSnapshotCount: successfulSnapshots.length,
    });
    return;
  }
  if (successfulSnapshots.length === 0) {
    console.log("[COMP_SYNC_TRACE] reconcileCoachLinkedCompetitionEntriesFromWriterSessions", {
      earlyExit: "noSuccessfulSnapshots",
      totalActiveWriterCount,
    });
    return;
  }

  const withSession = successfulSnapshots.filter(
    (s): s is WriterSessionSnapshotOk & { session: CoachWeeklySyncSessionResponse } =>
      Boolean(s.session),
  );
  if (withSession.length === 0) {
    console.log("[COMP_SYNC_TRACE] reconcileCoachLinkedCompetitionEntriesFromWriterSessions", {
      earlyExit: "noSnapshotsWithSessionPayload",
      successfulSnapshotCount: successfulSnapshots.length,
      totalActiveWriterCount,
    });
    return;
  }

  const sorted = sortWriterSessionSnapshotsNewestFirst(withSession);
  const sessionsOrdered: CoachWeeklySyncSessionResponse[] = [];
  for (const s of sorted) {
    if (s.session) sessionsOrdered.push(s.session);
  }

  const athleteListedInFetchedSessions = (athleteId: string) =>
    sessionsOrdered.some((sess) => sess.athletes.some((a) => a.id.trim() === athleteId));

  const kids = await getKidsById();
  const compResolutionCtx = {
    activeWriterInviteTokenNorms: new Set(successfulSnapshots.map((s) => s.linkTokenNorm)),
    reconcileSource: "reconcileCoachLinkedCompetitionEntriesFromWriterSessions" as const,
  };
  const primaryRosterRows = buildCanonicalSharedAthletePrimaryRowMap(kids, compResolutionCtx);
  for (const k of primaryRosterRows.values()) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    const sharedAthleteId = k.sharedAthleteId?.trim() ?? "";
    if (!sharedAthleteId) continue;

    const rosterKidFound = Boolean(k.id);
    const athleteOnFetchedSessions = athleteListedInFetchedSessions(sharedAthleteId);
    const remote = pickRemoteSharedCompetitionsForLinkedAthlete(sessionsOrdered, sharedAthleteId);
    console.log("[COMP_SYNC_TRACE] reconcileCoachLinkedCompetitionEntriesFromWriterSessions", {
      sharedAthleteId,
      rosterKidId: k.id,
      rosterKidFound,
      athleteListedInWriterSessions: athleteOnFetchedSessions,
      remoteCompetitionCountSelected: remote.length,
    });
    logCompSave("RECONCILE", {
      athleteId: k.id,
      sharedAthleteId,
      canonicalPayloadIds: remote.map((r) => r.id),
      operationKind: "canonical",
      surface: "reconcileCoachLinkedCompetitionEntriesFromWriterSessions",
      localStoreAffected: "kidCompetitionStore via upsertSharedCompetitionsForKid",
      remoteCompetitionCountSelected: remote.length,
    });
    await upsertSharedCompetitionsForKid(k.id, sharedAthleteId, remote);
  }
}

export type CoachInviteSessionAthletesByTokenEntry = {
  names: string[];
  fetchFailed: boolean;
};

export type CoachWriterSessionRefreshResult = {
  successfulSnapshots: WriterSessionSnapshotOk[];
  writerLinks: CoachLink[];
  inviteSessionAthletesByToken: Record<string, CoachInviteSessionAthletesByTokenEntry>;
};

/**
 * Coach lane: one entry point for writer `coachSyncFetchSession` GETs, weekly cache writes,
 * roster reconciliation, and shared competition hydration. Safe no-op when sync is not configured
 * or this profile has no writer invites.
 */
export async function refreshCoachWriterSessionsAndReconcileStores(): Promise<CoachWriterSessionRefreshResult> {
  const inviteSessionAthletesByToken: Record<string, CoachInviteSessionAthletesByTokenEntry> = {};
  const successfulSnapshots: WriterSessionSnapshotOk[] = [];

  const links = await getCoachLinks();
  const writerLinks = dedupeActiveCoachWriterLinks(links);
  const knownLocalSharedAthleteIds = sharedAthleteIdsFromKids(await getKidsById());

  if (!isCoachSyncConfigured()) {
    if (__DEV__) {
      console.log("[REMOTE_HYDRATION_PROVENANCE]", {
        source: "local_fallback",
        fetchSuccess: false,
        fetchFailure: false,
        payloadAthleteIds: [],
        payloadTimestamps: {},
        stalePayloadIndicators: {
          reusedLocalRosterIds: knownLocalSharedAthleteIds,
        },
        failureReason: "coach_sync_not_configured",
        timestamp: new Date().toISOString(),
      });
      console.log("[LOCAL_FALLBACK_REPLAY]", {
        fetchFailed: false,
        reconcileSkipped: true,
        reusedLocalRosterIds: knownLocalSharedAthleteIds,
        localRosterCount: knownLocalSharedAthleteIds.length,
        remoteRosterCount: 0,
        failureReason: "coach_sync_not_configured",
        source: "coachKidStore.refreshCoachWriterSessionsAndReconcileStores",
        timestamp: new Date().toISOString(),
      });
    }
    console.log("[COMP_SYNC_TRACE] refreshCoachWriterSessionsAndReconcileStores", {
      earlyExit: "coachSyncNotConfigured",
      writerLinkCount: writerLinks.length,
      sessionsFetchedOkCount: 0,
      tokensFetched: [] as string[],
      perSession: [] as { tokenNorm: string; competitionsCount: number; athleteIds: string[] }[],
      athleteIdsUnion: [] as string[],
    });
    return { successfulSnapshots, writerLinks, inviteSessionAthletesByToken };
  }

  for (const link of writerLinks) {
    const weeklySync = link.weeklySync!;
    const tokenKey = normalizeInviteLinkToken(weeklySync.linkToken);
    try {
      const session = await coachSyncFetchSession(weeklySync.linkToken, weeklySync.apiBaseUrl);
      const returnedAthleteIds = session.athletes
        .map((athlete) => athlete.id.trim())
        .filter(Boolean);
      const returnedAthleteIdSet = new Set(returnedAthleteIds);
      if (__DEV__) {
        console.log("[REMOTE_HYDRATION_PROVENANCE]", {
          source: "remote",
          fetchSuccess: true,
          fetchFailure: false,
          payloadAthleteIds: returnedAthleteIds,
          payloadTimestamps: {
            weeklyUpdatedAt: session.weekly?.updatedAt ?? null,
            aggregateUpdatedAtByAthlete: Object.fromEntries(
              Object.entries(session.competitionAggregateByAthleteId ?? {}).map(([id, artifact]) => [
                id,
                artifact.updatedAt,
              ]),
            ),
            topologyUpdatedAtByAthlete: Object.fromEntries(
              Object.entries(session.competitionTopologyByAthleteId ?? {}).map(([id, artifact]) => [
                id,
                artifact.updatedAt,
              ]),
            ),
            proofUpdatedAtByAthlete: Object.fromEntries(
              Object.entries(session.trainingProofByAthleteId ?? {}).map(([id, artifact]) => [
                id,
                artifact.updatedAt,
              ]),
            ),
          },
          stalePayloadIndicators: {
            missingPreviouslyKnownAthleteIds: knownLocalSharedAthleteIds.filter(
              (id) => !returnedAthleteIdSet.has(id),
            ),
          },
          writerTokenTail: tokenKey.slice(-8),
          timestamp: new Date().toISOString(),
        });
        console.log("[WRITER_SESSION_HYDRATE_AUDIT]", {
          writerTokenTail: tokenKey.slice(-8),
          linkedInviteIds: [tokenKey],
          sharedAthleteIds: returnedAthleteIds,
          returnedAthleteIds,
          returnedCompetitionCounts: session.competitions?.length ?? 0,
          returnedWeeklyCounts: Object.keys(session.weeklyByAthleteId ?? {}).length,
          returnedTrainingProofCounts: Object.keys(session.trainingProofByAthleteId ?? {}).length,
          returnedTopologyCounts: Object.keys(session.competitionTopologyByAthleteId ?? {}).length,
          returnedAggregateCounts: Object.keys(session.competitionAggregateByAthleteId ?? {}).length,
          missingPreviouslyKnownAthleteIds: knownLocalSharedAthleteIds.filter(
            (id) => !returnedAthleteIdSet.has(id),
          ),
          payloadByteSize: JSON.stringify(session).length,
          timestamp: new Date().toISOString(),
        });
      }
      if (__DEV__) {
        logHydrationPipelineWatchAthletes({
          stage: "2_weekly_sync_ingestion",
          sourceSubsystem: "coachKidStore.refreshCoachWriterSessionsAndReconcileStores",
          dataOrigin: "remote",
          inviteTokenHint: tokenKey,
          presentAthleteIds: athleteIdSetFromSynced(session.athletes),
          namesById: namesByIdFromSyncedAthletes(session.athletes),
          allAthleteIdsInStage: session.athletes.map((a) => a.id),
          stageMeta: { linkTokenNorm: tokenKey },
        });
      }
      const nowIso = new Date().toISOString();
      await setCachedWeeklyForLinkToken(
        weeklySync.linkToken,
        session.weekly,
        nowIso,
        session.weeklyByAthleteId ?? {},
        session.athletes,
        session,
        tokenKey,
      );
      successfulSnapshots.push({
        linkTokenNorm: tokenKey,
        athletes: session.athletes,
        session,
        writerLinkUpdatedAt: link.updatedAt,
        writerLinkCreatedAt: link.createdAt,
      });
      const names = session.athletes
        .map((a) => (typeof a.name === "string" ? a.name.trim() : ""))
        .filter(Boolean);
      names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      inviteSessionAthletesByToken[tokenKey] = { names, fetchFailed: false };
    } catch (error) {
      if (__DEV__) {
        console.log("[REMOTE_HYDRATION_PROVENANCE]", {
          source: "local_fallback",
          fetchSuccess: false,
          fetchFailure: true,
          payloadAthleteIds: [],
          payloadTimestamps: {},
          stalePayloadIndicators: {
            reusedLocalRosterIds: knownLocalSharedAthleteIds,
          },
          failureReason: error instanceof Error ? error.message : String(error),
          writerTokenTail: tokenKey.slice(-8),
          timestamp: new Date().toISOString(),
        });
        console.log("[WRITER_SESSION_HYDRATE_AUDIT]", {
          writerTokenTail: tokenKey.slice(-8),
          linkedInviteIds: [tokenKey],
          sharedAthleteIds: [],
          returnedAthleteIds: [],
          returnedCompetitionCounts: 0,
          returnedWeeklyCounts: 0,
          returnedTrainingProofCounts: 0,
          returnedTopologyCounts: 0,
          returnedAggregateCounts: 0,
          missingPreviouslyKnownAthleteIds: knownLocalSharedAthleteIds,
          payloadByteSize: 0,
          fetchFailed: true,
          failureReason: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
      inviteSessionAthletesByToken[tokenKey] = { names: [], fetchFailed: true };
    }
  }

  const perSession = successfulSnapshots.map((snap) => {
    const sess = snap.session;
    const competitionsCount = sess?.competitions?.length ?? 0;
    const athleteIds =
      sess?.athletes
        ?.map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
        .filter(Boolean) ?? [];
    return {
      tokenNorm: snap.linkTokenNorm,
      competitionsCount,
      athleteIds,
    };
  });
  const athleteIdsUnion = [
    ...new Set(perSession.flatMap((p) => p.athleteIds)),
  ];
  if (__DEV__) {
    const sortedUnion = [...athleteIdsUnion].sort();
    const removedComparedToPrevious =
      previousCoachHydrateRemoteAthleteIds?.filter((id) => !sortedUnion.includes(id)) ?? [];
    console.log("[CANONICAL_RETIREMENT_HYDRATION]", {
      payloadAthleteIds: sortedUnion,
      removedAthleteIdsComparedToPreviousHydrate: removedComparedToPrevious,
      pruneResults: null,
      source: "refreshCoachWriterSessionsAndReconcileStores.remote_payload_union",
      successfulSnapshotCount: successfulSnapshots.length,
      writerLinkCount: writerLinks.length,
      timestamp: new Date().toISOString(),
    });
    if (successfulSnapshots.length > 0) {
      previousCoachHydrateRemoteAthleteIds = sortedUnion;
    }
  }
  console.log("[COMP_SYNC_TRACE] refreshCoachWriterSessionsAndReconcileStores", {
    writerLinkCount: writerLinks.length,
    sessionsFetchedOkCount: successfulSnapshots.length,
    tokensFetched: successfulSnapshots.map((s) => s.linkTokenNorm),
    perSession,
    athleteIdsUnion,
    willRunRosterAndCompetitionReconcile:
      writerLinks.length > 0 && successfulSnapshots.length > 0,
  });

  if (writerLinks.length > 0 && successfulSnapshots.length > 0) {
    const kidsAfterRoster = await reconcileCoachKidRosterFromWriterSessions({
      successfulSnapshots,
      totalActiveWriterCount: writerLinks.length,
    });
    if (__DEV__) {
      logHydrationPipelineWatchAthletes({
        stage: "10_stale_canonical_reconciliation",
        sourceSubsystem: "coachKidStore.reconcileCoachKidRosterFromWriterSessions:post",
        dataOrigin: "local_storage",
        kidsById: kidsAfterRoster,
        canonicalCtx: {
          activeWriterInviteTokenNorms: new Set(successfulSnapshots.map((s) => s.linkTokenNorm)),
          reconcileSource: "reconcileCoachKidRosterFromWriterSessions",
        },
        presentAthleteIds: new Set(
          Object.values(kidsAfterRoster)
            .map((k) => (k?.sharedAthleteId ?? "").trim())
            .filter(Boolean),
        ),
        namesById: namesByIdFromSyncedAthletes(
          successfulSnapshots.flatMap((s) => s.athletes),
        ),
        stageMeta: { successfulSnapshotCount: successfulSnapshots.length },
      });
    }
    await reconcileCoachLinkedCompetitionEntriesFromWriterSessions({
      successfulSnapshots,
      totalActiveWriterCount: writerLinks.length,
    });
    await reconcileCoachCompetitionAggregatesFromWriterSessions({
      successfulSnapshots,
      totalActiveWriterCount: writerLinks.length,
    });
    await reconcileCoachCompetitionTopologyFromWriterSessions({
      successfulSnapshots,
      totalActiveWriterCount: writerLinks.length,
    });
    await reconcileCoachTrainingProofFromWriterSessions({
      successfulSnapshots,
      totalActiveWriterCount: writerLinks.length,
    });
    await reconcileCoachMatchBreakdownArtifacts({
      successfulSnapshots,
      totalActiveWriterCount: writerLinks.length,
    });
    await pruneCoachMatchBreakdownArtifactsAfterRosterReconcile({
      totalActiveWriterCount: writerLinks.length,
      remoteUnionIds: new Set(athleteIdsUnion),
      allFetched: successfulSnapshots.length === writerLinks.length,
    });
    if (__DEV__) {
      console.log("[COACH_SYNC_HYDRATION] reconcile_complete_before_bump", {
        successfulSnapshotCount: successfulSnapshots.length,
        writerLinkCount: writerLinks.length,
        athleteIdsUnion,
      });
    }
    bumpCoachSyncHydrationVersion({
      reason: "refreshCoachWriterSessionsAndReconcileStores_complete",
    });
  } else if (writerLinks.length > 0) {
    if (__DEV__) {
      console.log("[REMOTE_HYDRATION_PROVENANCE]", {
        source: "local_fallback",
        fetchSuccess: false,
        fetchFailure: true,
        payloadAthleteIds: [],
        payloadTimestamps: {},
        stalePayloadIndicators: {
          reusedLocalRosterIds: knownLocalSharedAthleteIds,
        },
        failureReason: "writer_links_present_but_no_successful_session_fetches",
        timestamp: new Date().toISOString(),
      });
      console.log("[LOCAL_FALLBACK_REPLAY]", {
        fetchFailed: true,
        reconcileSkipped: true,
        reusedLocalRosterIds: knownLocalSharedAthleteIds,
        localRosterCount: knownLocalSharedAthleteIds.length,
        remoteRosterCount: 0,
        failureReason: "writer_links_present_but_no_successful_session_fetches",
        source: "coachKidStore.refreshCoachWriterSessionsAndReconcileStores",
        timestamp: new Date().toISOString(),
      });
    }
    logCacheProvenance({
      key: StorageKeys.coachWeeklySyncCacheByToken,
      source: "coachKidStore.refreshCoachWriterSessionsAndReconcileStores",
      readKind: "memoryRead",
      entityCounts: {
        writerLinkCount: writerLinks.length,
        sessionsFetchedOkCount: successfulSnapshots.length,
      },
      extra: {
        reconcilePreservedLocalTruth: true,
        reason: "writerLinksButNoSuccessfulSessionFetches",
      },
    });
    console.log("[COMP_SYNC_TRACE] refreshCoachWriterSessionsAndReconcileStores", {
      skipReconcile: "writerLinksButNoSuccessfulSessionFetches",
      writerLinkCount: writerLinks.length,
      sessionsFetchedOkCount: successfulSnapshots.length,
    });
  }

  return { successfulSnapshots, writerLinks, inviteSessionAthletesByToken };
}

/**
 * Upsert roster rows for athletes returned from linked sync sessions (parent roster refresh).
 * Does not remove local-only kids (no `sharedAthleteId`).
 * When `pruneOrphansWhenAuthoritative` is true, every writer session fetch succeeded and `remote`
 * is the exact union of server athletes — local rows with a `sharedAthleteId` not in that set are
 * removed via `deleteKidPilot` (competitions, weekly focus, etc. for that kid id).
 */
export async function mergeRemoteSharedAthletesIntoKids(
  remote: SyncedSharedAthlete[],
  options?: { pruneOrphansWhenAuthoritative?: boolean },
): Promise<KidsById> {
  const kids = await getKidsById();
  const next: KidsById = { ...kids };
  const nowIso = new Date().toISOString();

  const byShared = buildCanonicalSharedAthletePrimaryRowMap(next, {
    reconcileSource: "mergeRemoteSharedAthletesIntoKids",
  });

  for (const a of remote) {
    const existing = byShared.get(a.id);
    if (existing) {
      if (!isKidCoachArchived(existing) && existing.name !== a.name) {
        const updated: Kid = {
          ...existing,
          name: a.name,
          updatedAt: nowIso,
        };
        next[existing.id] = updated;
        byShared.set(a.id, updated);
      }
      continue;
    }

    const localId = `kid_shared_${a.id}` as KidId;
    if (next[localId]) continue;

    next[localId] = {
      id: localId,
      name: a.name,
      sharedAthleteId: a.id,
      createdAt: a.createdAt,
      updatedAt: nowIso,
    };
    logIdentityMintTrace("fallback_create", {
      sourceFlow: "coach_merge_remote_roster",
      callerFunction: "coachKidStore.mergeRemoteSharedAthletesIntoKids",
      athleteName: a.name,
      newlyMintedSharedId: a.id,
      linkedKidId: localId,
      inviteToken: null,
      idKind: "shared_ath",
      extra: { remoteCreatedAt: a.createdAt },
    });
    logAthleteLineageTrace({
      operation: "create",
      source: "coach_roster_reconcile",
      athleteName: a.name,
      sharedAthleteId: a.id,
      linkedKidId: localId,
      route: "coachKidStore.mergeRemoteSharedAthletesIntoKids",
      extra: { remoteCreatedAt: a.createdAt },
    });
    byShared.set(a.id, next[localId]);
  }

  await setKidsById(next);

  if (options?.pruneOrphansWhenAuthoritative) {
    const remoteIds = new Set(remote.map((r) => r.id));
    const current = await getKidsById();
    const orphanIds = Object.values(current)
      .filter(
        (k) =>
          !isKidCoachArchived(k) &&
          typeof k.sharedAthleteId === "string" &&
          k.sharedAthleteId.trim() !== "" &&
          !remoteIds.has(k.sharedAthleteId.trim()),
      )
      .map((k) => k.id);
    if (__DEV__ && orphanIds.length > 0) {
      console.log("[bjj-coach-kid-roster] prune orphaned shared athletes", {
        orphanIds,
        remoteAthleteIdCount: remoteIds.size,
      });
    }
    for (const oid of orphanIds) {
      await deleteKidPilot(oid);
    }
    return getKidsById();
  }

  return next;
}

/** Collapse whitespace; trim. Used for roster grouping labels. */
export function normalizeKidHouseholdLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Metadata-only: set or clear `householdLabel` and bump `updatedAt`.
 * Preserves `id`, `name`, `createdAt`. Does not touch weekly focus, training, competition, etc.
 * Cleared / whitespace-only input omits `householdLabel` so the kid appears under "No household".
 */
export async function updateKidHouseholdLabel(
  kidId: KidId,
  householdLabelRaw: string,
): Promise<Kid | null> {
  const kids = await getKidsById();
  const existing = kids[kidId];
  if (!existing) return null;

  const normalized = normalizeKidHouseholdLabel(householdLabelRaw);
  const nowIso = new Date().toISOString();

  const syncFields: Pick<
    Kid,
    | "sharedAthleteId"
    | "sharedFromInviteTokenNorm"
    | "isParentManagedChildProfile"
    | "coachArchivedAt"
  > = {};
  if (existing.sharedAthleteId?.trim()) {
    syncFields.sharedAthleteId = existing.sharedAthleteId;
  }
  if (existing.sharedFromInviteTokenNorm?.trim()) {
    syncFields.sharedFromInviteTokenNorm = existing.sharedFromInviteTokenNorm;
  }
  if (existing.isParentManagedChildProfile) {
    syncFields.isParentManagedChildProfile = true;
  }
  if (existing.coachArchivedAt?.trim()) {
    syncFields.coachArchivedAt = existing.coachArchivedAt;
  }
  const next: Kid = normalized
    ? {
        id: existing.id,
        name: existing.name,
        createdAt: existing.createdAt,
        updatedAt: nowIso,
        householdLabel: normalized,
        ...syncFields,
      }
    : {
        id: existing.id,
        name: existing.name,
        createdAt: existing.createdAt,
        updatedAt: nowIso,
        ...syncFields,
      };

  await setKidsById({ ...kids, [kidId]: next });
  return next;
}

/** Remove all weekly focus log rows for one kid (pilot roster hard-delete). */
export async function deleteKidWeeklyFocusEntriesForKid(kidId: KidId): Promise<void> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const next = all.filter((e) => e.kidId !== kidId);
  const capped = capEntriesByKid(next);
  await setKidWeeklyFocusEntriesRaw(capped);
}

/** Remove one weekly focus / check-in log row (pilot). */
export async function deleteKidWeeklyFocusEntryById(
  entryId: string,
  expectedKidId: KidId,
): Promise<boolean> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const found = all.find((e) => e.id === entryId);
  if (!found || found.kidId !== expectedKidId) return false;

  const next = all.filter((e) => e.id !== entryId);
  const capped = capEntriesByKid(next);
  await setKidWeeklyFocusEntriesRaw(capped);
  return true;
}

/**
 * Pilot hard-delete guardrail:
 * remove training sessions linked to a deleted kid so `bjj.sessions.v2` has no orphan kid-linked sessions.
 */
async function deleteKidTrainingSessionsForKid(kidId: KidId): Promise<void> {
  await deleteSessionsForKid(kidId);
}

/**
 * Hard-delete a kid from the pilot roster and all local weekly focus + competition data.
 * Order: competitions (with media) → weekly focus → roster (avoids orphan kidIds in history).
 */
export async function deleteKidPilot(kidId: KidId): Promise<boolean> {
  const kids = await getKidsById();
  const existing = kids[kidId];
  if (!existing) return false;

  const sharedAthleteId = existing.sharedAthleteId?.trim();
  if (sharedAthleteId) {
    await removeCoachCompetitionAggregate(sharedAthleteId);
    await removeCoachCompetitionTopology(sharedAthleteId);
    await removeCoachTrainingProof(sharedAthleteId);
  }

  const familyCompPick = await getFamilyCompetitionSelectedKidId();
  if (familyCompPick === kidId) {
    await clearFamilyCompetitionSelectedKidId();
  }

  await deleteAllKidCompetitionEntriesForKid(kidId);
  await deleteKidTrainingSessionsForKid(kidId);
  await deleteKidWeeklyFocusEntriesForKid(kidId);
  await deleteKidStandingGuidanceForKid(kidId);

  const { [kidId]: _removed, ...rest } = kids;
  await setKidsById(rest);
  return true;
}

/**
 * Coach-only soft archive: keeps sessions, competitions, weekly logs, and sync fields on disk.
 * Clears auxiliary pointers that would keep this kid as the “current” selection where applicable.
 */
export async function archiveKidForCoachRoster(kidId: KidId): Promise<Kid | null> {
  const trimmed = typeof kidId === "string" ? kidId.trim() : "";
  if (!trimmed) return null;

  const kids = await getKidsById();
  const existing = kids[trimmed];
  if (!existing) return null;
  if (isKidCoachArchived(existing)) return existing;

  const nowIso = new Date().toISOString();
  const next: Kid = { ...existing, coachArchivedAt: nowIso, updatedAt: nowIso };
  await setKidsById({ ...kids, [trimmed]: next });

  const familyCompPick = await getFamilyCompetitionSelectedKidId();
  if (familyCompPick === trimmed) {
    await clearFamilyCompetitionSelectedKidId();
  }
  await clearLastAthleteKidIdIfMatches(trimmed);

  return next;
}

export async function getKidWeeklyFocusEntriesForKid(
  kidId: KidId,
): Promise<KidWeeklyFocusEntry[]> {
  const all = await getKidWeeklyFocusEntriesRaw();
  return all
    .filter((e) => e.kidId === kidId)
    .slice()
    .sort(
      (a, b) =>
        b.weekStartYMD.localeCompare(a.weekStartYMD) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

/**
 * Most recent focus log for this kid in the given Monday-week (by createdAt).
 */
export async function getLatestKidWeeklyFocusForWeek(
  kidId: KidId,
  weekStartYMD: string,
): Promise<KidWeeklyFocusEntry | null> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const matches = all.filter(
    (e) => e.kidId === kidId && e.weekStartYMD === weekStartYMD,
  );
  if (!matches.length) return null;
  return matches.reduce((best, e) =>
    e.createdAt > best.createdAt ? e : best,
  );
}

export async function getKidWeeklyFocusEntryById(
  entryId: string,
): Promise<KidWeeklyFocusEntry | null> {
  const all = await getKidWeeklyFocusEntriesRaw();
  return all.find((e) => e.id === entryId) ?? null;
}

export type KidWeeklyFocusFocusUpdate =
  | {
      focusType: "template";
      templateId: string;
      title: string;
      systemKey?: string;
      metadata?: string;
      youtubeUrl?: string;
      missionResourceUrl?: string;
      missionResourceLabel?: string;
      familyResourceUrl?: string;
      familyResourceLabel?: string;
      familyCoachRecapNote?: string;
    }
  | {
      focusType: "custom";
      title: string;
      systemKey?: string;
      note?: string;
      youtubeUrl?: string;
      missionResourceUrl?: string;
      missionResourceLabel?: string;
      familyResourceUrl?: string;
      familyResourceLabel?: string;
      familyCoachRecapNote?: string;
    };

/**
 * In-place update of the focus fields on an existing log row (same id / week / timestamps for createdAt).
 */
export async function updateKidWeeklyFocusFocusById(
  entryId: string,
  expectedKidId: KidId,
  focus: KidWeeklyFocusFocusUpdate,
): Promise<KidWeeklyFocusEntry | null> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const idx = all.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;
  const existing = all[idx];
  if (existing.kidId !== expectedKidId) return null;

  const nowIso = new Date().toISOString();
  const nextSystemKey = Object.prototype.hasOwnProperty.call(focus, "systemKey")
    ? normalizePublishableSystemKey(focus.systemKey)
    : normalizePublishableSystemKey(existing.systemKey);

  const base = {
    id: existing.id,
    kidId: existing.kidId,
    weekStartYMD: existing.weekStartYMD,
    systemKey: nextSystemKey,
    createdAt: existing.createdAt,
    updatedAt: nowIso,
    coachOutcome: existing.coachOutcome,
    coachNotes: existing.coachNotes,
    sparringApplication: existing.sparringApplication,
  };

  const missionUrl =
    typeof focus.missionResourceUrl === "string" && focus.missionResourceUrl.trim()
      ? focus.missionResourceUrl.trim()
      : undefined;
  const missionLabel =
    typeof focus.missionResourceLabel === "string" && focus.missionResourceLabel.trim()
      ? focus.missionResourceLabel.trim()
      : undefined;
  const famUrl =
    typeof focus.familyResourceUrl === "string" && focus.familyResourceUrl.trim()
      ? focus.familyResourceUrl.trim()
      : undefined;
  const famLabel =
    typeof focus.familyResourceLabel === "string" && focus.familyResourceLabel.trim()
      ? focus.familyResourceLabel.trim()
      : undefined;
  const recap =
    "familyCoachRecapNote" in focus && typeof focus.familyCoachRecapNote === "string"
      ? focus.familyCoachRecapNote.trim()
        ? focus.familyCoachRecapNote.trim().slice(0, 2000)
        : undefined
      : existing.familyCoachRecapNote;

  const updated: KidWeeklyFocusEntry =
    focus.focusType === "template"
      ? {
          ...base,
          focusType: "template",
          templateId: focus.templateId,
          title: focus.title,
          metadata: focus.metadata,
          youtubeUrl: focus.youtubeUrl,
          missionResourceUrl: missionUrl,
          missionResourceLabel: missionLabel,
          familyResourceUrl: famUrl,
          familyResourceLabel: famLabel,
          familyCoachRecapNote: recap,
        }
      : {
          ...base,
          focusType: "custom",
          title: focus.title,
          note: focus.note,
          youtubeUrl: focus.youtubeUrl,
          missionResourceUrl: missionUrl,
          missionResourceLabel: missionLabel,
          familyResourceUrl: famUrl,
          familyResourceLabel: famLabel,
          familyCoachRecapNote: recap,
        };

  all[idx] = updated;
  const capped = capEntriesByKid(all);
  await setKidWeeklyFocusEntriesRaw(capped);
  return capped.find((e) => e.id === entryId) ?? updated;
}

/**
 * Append a new weekly focus log (never overwrites an existing row).
 * Check-in appends should pass `missionResourceUrl` / `missionResourceLabel` through from the
 * focus row so “latest by createdAt” reads do not drop the mission link.
 */
export async function appendKidWeeklyFocus(
  input: KidWeeklyFocusAppendInput,
): Promise<KidWeeklyFocusEntry> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const nowIso = new Date().toISOString();
  const id = newEntryId();

  const missionUrl =
    typeof input.missionResourceUrl === "string" && input.missionResourceUrl.trim()
      ? input.missionResourceUrl.trim()
      : undefined;
  const missionLabel =
    typeof input.missionResourceLabel === "string" && input.missionResourceLabel.trim()
      ? input.missionResourceLabel.trim()
      : undefined;
  const famUrl =
    typeof input.familyResourceUrl === "string" && input.familyResourceUrl.trim()
      ? input.familyResourceUrl.trim()
      : undefined;
  const famLabel =
    typeof input.familyResourceLabel === "string" && input.familyResourceLabel.trim()
      ? input.familyResourceLabel.trim()
      : undefined;
  const recapRaw = (input.familyCoachRecapNote ?? "").trim();
  const recap = recapRaw ? recapRaw.slice(0, 2000) : undefined;

  const created: KidWeeklyFocusEntry =
    input.focusType === "template"
      ? {
          id,
          kidId: input.kidId,
          weekStartYMD: input.weekStartYMD,
          systemKey: normalizePublishableSystemKey(input.systemKey),
          createdAt: nowIso,
          updatedAt: nowIso,
          focusType: "template",
          templateId: input.templateId,
          title: input.title,
          metadata: input.metadata,
          youtubeUrl: input.youtubeUrl,
          missionResourceUrl: missionUrl,
          missionResourceLabel: missionLabel,
          familyResourceUrl: famUrl,
          familyResourceLabel: famLabel,
          familyCoachRecapNote: recap,
          coachOutcome: input.coachOutcome,
          sparringApplication: input.sparringApplication,
          coachNotes: input.coachNotes,
        }
      : {
          id,
          kidId: input.kidId,
          weekStartYMD: input.weekStartYMD,
          systemKey: normalizePublishableSystemKey(input.systemKey),
          createdAt: nowIso,
          updatedAt: nowIso,
          focusType: "custom",
          title: input.title,
          note: input.note,
          youtubeUrl: input.youtubeUrl,
          missionResourceUrl: missionUrl,
          missionResourceLabel: missionLabel,
          familyResourceUrl: famUrl,
          familyResourceLabel: famLabel,
          familyCoachRecapNote: recap,
          coachOutcome: input.coachOutcome,
          sparringApplication: input.sparringApplication,
          coachNotes: input.coachNotes,
        };

  all.unshift(created);
  const capped = capEntriesByKid(all);
  await setKidWeeklyFocusEntriesRaw(capped);
  return capped.find((e) => e.id === id) ?? created;
}

export async function patchKidWeeklyFocusCoachFields(
  entryId: string,
  patch: {
    coachOutcome?: CoachOutcome;
    sparringApplication?: KidWeeklyFocusEntry["sparringApplication"];
    coachNotes?: string;
  },
): Promise<KidWeeklyFocusEntry | null> {
  const all = await getKidWeeklyFocusEntriesRaw();
  const idx = all.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;

  const existing = all[idx];
  const nowIso = new Date().toISOString();

  let nextCoachOutcome = existing.coachOutcome;
  if (Object.prototype.hasOwnProperty.call(patch, "coachOutcome")) {
    nextCoachOutcome = patch.coachOutcome;
  }

  let nextCoachNotes = existing.coachNotes;
  if (Object.prototype.hasOwnProperty.call(patch, "coachNotes")) {
    const raw = patch.coachNotes;
    nextCoachNotes = raw?.trim() ? raw.trim() : undefined;
  }

  let nextSparringApplication = existing.sparringApplication;
  if (Object.prototype.hasOwnProperty.call(patch, "sparringApplication")) {
    nextSparringApplication = patch.sparringApplication;
  }

  const updated: KidWeeklyFocusEntry = {
    ...existing,
    updatedAt: nowIso,
    coachOutcome: nextCoachOutcome,
    sparringApplication: nextSparringApplication,
    coachNotes: nextCoachNotes,
  };

  all[idx] = updated;
  const capped = capEntriesByKid(all);
  await setKidWeeklyFocusEntriesRaw(capped);
  return capped.find((e) => e.id === entryId) ?? updated;
}
