import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  activeParentWeeklyLinksWithSecret,
  dedupeActiveParentWeeklyLinksByInviteToken,
} from "../coachShare/coachLinkBinding";
import { normalizeInviteLinkToken } from "../coachShare/inviteLinkToken";
import { logKeyRead, logKeyWrite } from "../dev/persistenceAudit";
import { buildCanonicalSharedAthletePrimaryRowMap } from "../identity/canonicalSharedAthleteOwner";
import { logAthleteLineageTrace } from "../identity/athleteLineageTrace";
import { logIdentityBindInterceptTrace } from "../identity/identityBindInterceptTrace";
import { classifySharedIdKind, logIdentityMintTrace } from "../identity/identityMintTrace";
import { resolveCanonicalBindBeforeLocalAthletePost } from "../identity/parentLocalAthleteCanonicalIntercept";
import {
  athleteIdSetFromParent,
  logHydrationPipelineWatchAthletes,
  namesByIdFromParentAthletes,
} from "../identity/hydrationPipelineTrace";
import { runLineageIntegrityScan } from "../identity/lineageIntegrityDetection";
import { coachSyncDeleteSessionAthlete } from "../services/coachWeeklySyncApi";
import { isKidCoachArchived, type Kid, type KidsById } from "../types/coachKid";

import { clearKidSharedAthleteLink, getKidsById } from "./coachKidStore";
import { getCoachLinks } from "./coachShareStore";
import { StorageKeys } from "./storageKeys";

export type OnboardingVersion = "v1" | "v2";

/** Explicit pre-coach operating scope; only `local_only` is recognized in LAAG Phase 1. */
export type ParentAthleteOperatingScope = "local_only";

export type ParentAthlete = {
  id: string;
  name: string;
  /**
   * When `"local_only"`, the athlete may appear in `operatingAthleteRoster` without a canonical
   * linked `Kid`. Orphan rows without this flag are excluded (soft convergence; storage untouched).
   */
  operatingScope?: ParentAthleteOperatingScope;
  household?: string;
  /** IBJJF-style rank token (e.g. `grey_white`, `blue`) from `ATHLETE_BELT_RANK_OPTIONS`. */
  beltRank?: string;
  stripes?: number;
  /** Maturity layer: `beginner` | `developing` | `experienced` — independent of belt. */
  experienceLevel?: string;
  trainingAgeMonths?: number;
  /** Independent of belt rank and experience level. */
  isCompetitor?: boolean;
  competitionIntent?: string;
  declaredSkills?: string[];
  onboardingVersion?: OnboardingVersion;
};

function readOptionalTrimmedString(row: object, key: string): string | undefined {
  if (!(key in row)) return undefined;
  const v = (row as Record<string, unknown>)[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function readOptionalFiniteInt(row: object, key: string): number | undefined {
  if (!(key in row)) return undefined;
  const v = (row as Record<string, unknown>)[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.trunc(v);
  return n >= 0 ? n : undefined;
}

function readOptionalBoolean(row: object, key: string): boolean | undefined {
  if (!(key in row)) return undefined;
  const v = (row as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : undefined;
}

function readOptionalStringArray(row: object, key: string): string[] | undefined {
  if (!(key in row)) return undefined;
  const v = (row as Record<string, unknown>)[key];
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t) out.push(t);
  }
  return out;
}

function readOptionalOnboardingVersion(row: object): OnboardingVersion | undefined {
  if (!("onboardingVersion" in row)) return undefined;
  const v = (row as Record<string, unknown>).onboardingVersion;
  if (v === "v1" || v === "v2") return v;
  return undefined;
}

function readOptionalOperatingScope(row: object): ParentAthleteOperatingScope | undefined {
  if (!("operatingScope" in row)) return undefined;
  const v = (row as Record<string, unknown>).operatingScope;
  return v === "local_only" ? "local_only" : undefined;
}

function safeParseAthletes(raw: string | null): ParentAthlete[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const next: ParentAthlete[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const id = "id" in row && typeof row.id === "string" ? row.id.trim() : "";
      const name = "name" in row && typeof row.name === "string" ? row.name.trim() : "";
      if (!id || !name) continue;
      const household =
        "household" in row && typeof row.household === "string"
          ? row.household.trim() || undefined
          : undefined;
      const beltRank = readOptionalTrimmedString(row, "beltRank");
      const stripes = readOptionalFiniteInt(row, "stripes");
      const experienceLevel = readOptionalTrimmedString(row, "experienceLevel");
      const trainingAgeMonths = readOptionalFiniteInt(row, "trainingAgeMonths");
      const isCompetitor = readOptionalBoolean(row, "isCompetitor");
      const competitionIntent = readOptionalTrimmedString(row, "competitionIntent");
      const declaredSkills = readOptionalStringArray(row, "declaredSkills");
      const onboardingVersion = readOptionalOnboardingVersion(row);
      const operatingScope = readOptionalOperatingScope(row);
      const athlete: ParentAthlete = {
        id,
        name,
        ...(operatingScope ? { operatingScope } : {}),
        ...(household ? { household } : {}),
        ...(beltRank ? { beltRank } : {}),
        ...(stripes !== undefined ? { stripes } : {}),
        ...(experienceLevel ? { experienceLevel } : {}),
        ...(trainingAgeMonths !== undefined ? { trainingAgeMonths } : {}),
        ...(isCompetitor !== undefined ? { isCompetitor } : {}),
        ...(competitionIntent ? { competitionIntent } : {}),
        ...(declaredSkills !== undefined ? { declaredSkills } : {}),
        ...(onboardingVersion ? { onboardingVersion } : {}),
      };
      next.push(athlete);
    }
    return next;
  } catch {
    return [];
  }
}

function newAthleteId(): string {
  return `pa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

export type CanonicalProjectionTracePayload = {
  athleteName?: string | null;
  paId?: string | null;
  sharedAthleteId?: string | null;
  flowSource: string;
  relinkSource?: string | null;
  projectionReason: string;
  linkedKidId?: string | null;
  extra?: Record<string, unknown>;
};

function logCanonicalProjectionTrace(
  tag: "[CANONICAL_PROJECTION]" | "[CANONICAL_PARENT_UPSERT]" | "[CANONICAL_PARENT_REWRITE]",
  payload: CanonicalProjectionTracePayload,
): void {
  if (!__DEV__) return;
  console.log(tag, {
    ...payload,
    at: new Date().toISOString(),
  });
}

/**
 * Identity-merge bind: rewrite a `ParentAthlete` row's id to the canonical `sharedAthleteId` so
 * `linkedKidIdForParentAthlete` and Summary / Compete operating planes converge. Preserves metadata.
 */
export async function rewriteParentAthleteIdToSharedAthleteId(
  parentAthleteOldId: string,
  newSharedAthleteId: string,
  trace?: Pick<CanonicalProjectionTracePayload, "flowSource" | "relinkSource" | "projectionReason" | "linkedKidId">,
): Promise<{ rewrote: boolean; wasActive: boolean }> {
  const oldId = parentAthleteOldId.trim();
  const newId = newSharedAthleteId.trim();
  if (!oldId || !newId || oldId === newId) {
    return { rewrote: false, wasActive: false };
  }
  const all = await getAthletes();
  const target = all.find((a) => a.id === oldId);
  if (!target) {
    return { rewrote: false, wasActive: false };
  }
  const next = all
    .filter((a) => a.id !== oldId && a.id !== newId)
    .concat({ ...target, id: newId });
  await AsyncStorage.setItem(StorageKeys.parentAthletes, JSON.stringify(next));
  const active = await getActiveAthleteId();
  const wasActive = (active ?? "").trim() === oldId;
  if (wasActive) {
    await setActiveAthleteId(newId);
  }
  logCanonicalProjectionTrace("[CANONICAL_PARENT_REWRITE]", {
    athleteName: target.name,
    paId: oldId,
    sharedAthleteId: newId,
    flowSource: trace?.flowSource ?? "canonical_parent_rewrite",
    relinkSource: trace?.relinkSource ?? null,
    projectionReason: trace?.projectionReason ?? "parent_athlete_id_reissue_to_shared",
    linkedKidId: trace?.linkedKidId ?? null,
    extra: { wasActiveOai: wasActive },
  });
  logIdentityMintTrace("bind_existing", {
    sourceFlow: trace?.flowSource ?? "parent_athlete_id_reissue_to_shared",
    callerFunction: "athleteStore.rewriteParentAthleteIdToSharedAthleteId",
    athleteName: target.name,
    existingSharedId: oldId,
    newlyMintedSharedId: newId,
    localAthleteId: oldId,
    linkedKidId: trace?.linkedKidId ?? null,
    idKind: "shared_ath",
    extra: { wasActiveOai: wasActive, projectionReason: trace?.projectionReason },
  });
  return { rewrote: true, wasActive };
}

async function validateCanonicalProjectionIntegrityDev(route: string): Promise<void> {
  if (!__DEV__) return;
  const [parentAthletes, kidsById, activeOperatingAthleteId] = await Promise.all([
    getAthletes(),
    getKidsById(),
    getActiveAthleteId(),
  ]);
  const linkedIdSet = new Set<string>();
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (sid) linkedIdSet.add(sid);
  }
  const operatingAthleteRoster = parentAthletes.filter((a) => {
    const id = a.id.trim();
    if (linkedIdSet.has(id)) return true;
    return a.operatingScope === "local_only";
  });
  runLineageIntegrityScan({
    route,
    activeOperatingAthleteId: (activeOperatingAthleteId ?? "").trim() || null,
    parentAthletes,
    operatingAthleteRoster,
    kidsById,
  });
}

/**
 * After a canonical kid bind/relink, project the same `sharedAthleteId` into `parentAthletes`.
 * Safe upsert/rewrite only — no duplicate-human merge or unrelated row mutation.
 */
export async function projectParentCanonicalAthleteForLinkedKid(input: {
  updatedKid: Kid;
  previousSharedAthleteId?: string | null;
  flowSource: string;
  relinkSource?: string;
  projectionReason?: string;
}): Promise<{ rewroteParentId: boolean; upsertedCanonicalRow: boolean }> {
  const newSid = (input.updatedKid.sharedAthleteId ?? "").trim();
  const prevSid = (input.previousSharedAthleteId ?? "").trim();
  const kidName = (input.updatedKid.name ?? "").trim();
  const projectionReason =
    input.projectionReason ?? "linked_kid_canonical_bind_projection";

  logCanonicalProjectionTrace("[CANONICAL_PROJECTION]", {
    athleteName: kidName || null,
    paId: prevSid || null,
    sharedAthleteId: newSid || null,
    flowSource: input.flowSource,
    relinkSource: input.relinkSource ?? null,
    projectionReason,
    linkedKidId: input.updatedKid.id,
    extra: { previousSharedAthleteId: prevSid || null },
  });

  if (!newSid) {
    return { rewroteParentId: false, upsertedCanonicalRow: false };
  }

  let rewroteParentId = false;
  if (prevSid && prevSid !== newSid) {
    const existing = await getAthletes();
    if (existing.some((a) => a.id.trim() === prevSid)) {
      const rewrite = await rewriteParentAthleteIdToSharedAthleteId(prevSid, newSid, {
        flowSource: input.flowSource,
        relinkSource: input.relinkSource,
        projectionReason,
        linkedKidId: input.updatedKid.id,
      });
      rewroteParentId = rewrite.rewrote;
    }
  }

  const kidsById = await getKidsById();
  const before = await getAthletes();
  const hadCanonicalRow = before.some((a) => a.id.trim() === newSid);
  await ensureOperatingAthletesFromCoachLinkedKids(kidsById);
  const after = await getAthletes();
  const upsertedCanonicalRow = !hadCanonicalRow && after.some((a) => a.id.trim() === newSid);

  if (upsertedCanonicalRow) {
    const row = after.find((a) => a.id.trim() === newSid);
    logCanonicalProjectionTrace("[CANONICAL_PARENT_UPSERT]", {
      athleteName: row?.name ?? kidName ?? null,
      paId: prevSid || null,
      sharedAthleteId: newSid,
      flowSource: input.flowSource,
      relinkSource: input.relinkSource ?? null,
      projectionReason,
      linkedKidId: input.updatedKid.id,
    });
  }

  await validateCanonicalProjectionIntegrityDev(
    `athleteStore.projectParentCanonicalAthleteForLinkedKid:${input.flowSource}`,
  );

  return { rewroteParentId, upsertedCanonicalRow };
}

export async function getAthletes(): Promise<ParentAthlete[]> {
  try {
    const raw = await AsyncStorage.getItem(StorageKeys.parentAthletes);
    logKeyRead({
      key: StorageKeys.parentAthletes,
      raw,
      source: "athleteStore.getAthletes",
    });
    const list = safeParseAthletes(raw);
    if (__DEV__) {
      logHydrationPipelineWatchAthletes({
        stage: "5_hydration_restore",
        sourceSubsystem: "athleteStore.getAthletes",
        dataOrigin: "local_storage",
        presentAthleteIds: athleteIdSetFromParent(list),
        namesById: namesByIdFromParentAthletes(list),
        allAthleteIdsInStage: list.map((a) => a.id),
        stageMeta: { parentAthleteCount: list.length },
      });
      for (const a of list) {
        logAthleteLineageTrace({
          operation: "restore",
          source: "athlete_store",
          athleteName: a.name,
          sharedAthleteId: a.id,
          localAthleteId: a.id,
          route: "athleteStore.getAthletes",
        });
      }
    }
    return list;
  } catch {
    return [];
  }
}

/**
 * Coach roster plane (`coachKidsById`) can hold linked rows with `sharedAthleteId` before the operating
 * plane (`parentAthletes`) has a matching row. Upserts `ParentAthlete` rows with `id === sharedAthleteId`
 * so `linkedKidIdForParentAthlete` and Summary / Compete resolve. Idempotent; preserves unrelated athletes.
 */
export async function ensureOperatingAthletesFromCoachLinkedKids(
  kidsById: KidsById,
): Promise<void> {
  const existing = await getAthletes();
  const byId = new Map<string, ParentAthlete>();
  for (const a of existing) {
    byId.set(a.id, a);
  }

  let changed = false;
  const recoveredSharedAthleteIds: string[] = [];
  const recoveredKidIds: string[] = [];
  const alreadyExistingAthleteIds: string[] = [];
  const newlyProjectedAthleteIds: string[] = [];

  const primaryByShared = buildCanonicalSharedAthletePrimaryRowMap(kidsById, {
    reconcileSource: "ensureOperatingAthletesFromCoachLinkedKids",
  });

  for (const k of primaryByShared.values()) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (!sid) continue;

    const rosterName = (k.name ?? "").trim();
    const displayName = rosterName || "Athlete";

    const prev = byId.get(sid);
    if (prev) {
      alreadyExistingAthleteIds.push(sid);
      if (rosterName && prev.name !== rosterName) {
        byId.set(sid, { ...prev, name: rosterName });
        changed = true;
      }
    } else {
      recoveredSharedAthleteIds.push(sid);
      recoveredKidIds.push(k.id);
      newlyProjectedAthleteIds.push(sid);
      byId.set(sid, { id: sid, name: displayName });
      logCanonicalProjectionTrace("[CANONICAL_PARENT_UPSERT]", {
        athleteName: displayName,
        paId: null,
        sharedAthleteId: sid,
        flowSource: "coach_hydration_projection",
        projectionReason: "ensure_operating_athletes_from_linked_kids",
        linkedKidId: k.id,
        extra: { reconcileSource: "ensureOperatingAthletesFromCoachLinkedKids" },
      });
      logIdentityMintTrace("fallback_create", {
        sourceFlow: "coach_hydration_projection",
        callerFunction: "athleteStore.ensureOperatingAthletesFromCoachLinkedKids",
        athleteName: displayName,
        existingSharedId: null,
        newlyMintedSharedId: sid,
        linkedKidId: k.id,
        idKind: classifySharedIdKind(sid),
      });
      logAthleteLineageTrace({
        operation: "fallback_projection",
        source: "hydration_pipeline",
        athleteName: displayName,
        sharedAthleteId: sid,
        linkedKidId: k.id,
        route: "athleteStore.ensureOperatingAthletesFromCoachLinkedKids",
      });
      changed = true;
    }
  }

  if (__DEV__) {
    console.log("[BOOTSTRAP_RECOVERY_SOURCE]", {
      recoveredSharedAthleteIds,
      recoveredKidIds,
      alreadyExistingAthleteIds,
      newlyProjectedAthleteIds,
      timestamp: new Date().toISOString(),
    });
  }

  if (!changed) return;

  const next = Array.from(byId.values());
  if (__DEV__) {
    logHydrationPipelineWatchAthletes({
      stage: "6_parent_athletes_derivation",
      sourceSubsystem: "athleteStore.ensureOperatingAthletesFromCoachLinkedKids",
      dataOrigin: "derived",
      kidsById,
      presentAthleteIds: athleteIdSetFromParent(next),
      namesById: namesByIdFromParentAthletes(next),
      allAthleteIdsInStage: next.map((a) => a.id),
      stageMeta: { wroteParentAthletes: true },
    });
  }
  try {
    const raw = JSON.stringify(next);
    logKeyWrite({
      key: StorageKeys.parentAthletes,
      raw,
      source: "athleteStore.ensureOperatingAthletesFromCoachLinkedKids",
      extra: {
        athleteCount: next.length,
        derivedFromCoachKids: true,
      },
    });
    await AsyncStorage.setItem(StorageKeys.parentAthletes, raw);
    if (__DEV__) {
      logHydrationPipelineWatchAthletes({
        stage: "4_storage_persistence",
        sourceSubsystem: "athleteStore.ensureOperatingAthletesFromCoachLinkedKids",
        dataOrigin: "local_storage",
        kidsById,
        presentAthleteIds: athleteIdSetFromParent(next),
        namesById: namesByIdFromParentAthletes(next),
        allAthleteIdsInStage: next.map((a) => a.id),
      });
      for (const a of next) {
        logAthleteLineageTrace({
          operation: "persist",
          source: "athlete_store",
          athleteName: a.name,
          sharedAthleteId: a.id,
          localAthleteId: a.id,
          route: "athleteStore.ensureOperatingAthletesFromCoachLinkedKids",
        });
      }
    }
  } catch {
    /* ignore */
  }
}

export async function addAthlete(input: {
  name: string;
  household?: string;
  /** Prefer this coach link when resolving canonical bind during invite onboarding. */
  preferredCoachLinkId?: string | null;
}): Promise<ParentAthlete> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw new Error("Name is required");
  }
  const householdRaw =
    typeof input.household === "string" ? input.household.trim() : "";

  const [existing, kidsById] = await Promise.all([getAthletes(), getKidsById()]);
  const intercept = await resolveCanonicalBindBeforeLocalAthletePost({
    athleteName: name,
    parentAthletes: existing,
    kidsById,
    preferredCoachLinkId: input.preferredCoachLinkId,
  });

  if (intercept.intercepted && intercept.canonicalSharedAthleteId) {
    const canonicalId = intercept.canonicalSharedAthleteId;
    const prev = existing.find((a) => a.id.trim() === canonicalId);
    let athlete: ParentAthlete;
    if (prev) {
      const { operatingScope: _localOnly, ...rest } = prev;
      athlete = {
        ...rest,
        id: canonicalId,
        name,
        ...(householdRaw ? { household: householdRaw } : {}),
      };
    } else {
      athlete = {
        id: canonicalId,
        name,
        ...(householdRaw ? { household: householdRaw } : {}),
      };
    }

    logIdentityBindInterceptTrace("projection_created", {
      sourceFlow: "parent_add_athlete",
      callerFunction: "athleteStore.addAthlete",
      athleteName: name,
      inviteToken: intercept.inviteTokenNorm,
      coachLinkId: intercept.coachLinkId,
      canonicalSharedAthleteId: canonicalId,
      bindDecision: intercept.bindDecision,
      bindSource: intercept.bindSource,
      extra: { upsertedExistingRow: Boolean(prev) },
    });
    logIdentityMintTrace("bind_existing", {
      sourceFlow: "parent_add_athlete_canonical_projection",
      callerFunction: "athleteStore.addAthlete",
      athleteName: name,
      existingSharedId: canonicalId,
      newlyMintedSharedId: null,
      inviteToken: intercept.inviteTokenNorm,
      idKind: "shared_ath",
      extra: {
        bindDecision: intercept.bindDecision,
        bindSource: intercept.bindSource,
        preMintIntercept: true,
      },
    });

    const next = prev
      ? existing.map((a) => (a.id.trim() === canonicalId ? athlete : a))
      : [...existing, athlete];
    try {
      await AsyncStorage.setItem(StorageKeys.parentAthletes, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return athlete;
  }

  const mintedId = newAthleteId();
  const athlete: ParentAthlete = {
    id: mintedId,
    name,
    operatingScope: "local_only",
    ...(householdRaw ? { household: householdRaw } : {}),
  };
  if (intercept.inviteTokenNorm) {
    logIdentityBindInterceptTrace("fallback_mint_allowed", {
      sourceFlow: "parent_add_athlete",
      callerFunction: "athleteStore.addAthlete",
      athleteName: name,
      inviteToken: intercept.inviteTokenNorm,
      coachLinkId: intercept.coachLinkId,
      bindDecision: intercept.bindDecision ?? "mint_new",
      extra: { localPaId: mintedId },
    });
  }
  logIdentityMintTrace("mint", {
    sourceFlow: "parent_local_athlete_create",
    callerFunction: "athleteStore.addAthlete",
    athleteName: name,
    newlyMintedSharedId: mintedId,
    inviteToken: intercept.inviteTokenNorm,
    idKind: "pa_",
    extra: {
      operatingScope: "local_only",
      inviteActive: Boolean(intercept.inviteTokenNorm),
      canonicalInterceptAttempted: intercept.resolution != null,
    },
  });
  const next = [...existing, athlete];
  try {
    await AsyncStorage.setItem(StorageKeys.parentAthletes, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return athlete;
}

export type ParentAthleteUpdate = Partial<Omit<ParentAthlete, "id">>;

export async function updateAthlete(id: string, patch: ParentAthleteUpdate): Promise<ParentAthlete | null> {
  const trimmedId = typeof id === "string" ? id.trim() : "";
  if (!trimmedId) return null;

  const existing = await getAthletes();
  const idx = existing.findIndex((a) => a.id === trimmedId);
  if (idx === -1) return null;

  const prev = existing[idx];
  const merged: ParentAthlete = { ...prev };

  const entries = Object.entries(patch) as [keyof ParentAthleteUpdate, ParentAthleteUpdate[keyof ParentAthleteUpdate]][];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    (merged as Record<string, unknown>)[key as string] = value;
  }

  const next = [...existing];
  next[idx] = merged;

  try {
    await AsyncStorage.setItem(StorageKeys.parentAthletes, JSON.stringify(next));
  } catch {
    /* ignore */
  }

  return merged;
}

export type DeleteAthleteInput = {
  athleteId: string;
  canonicalSharedAthleteId?: string | null;
};

export async function deleteAthlete(input: DeleteAthleteInput): Promise<boolean> {
  const trimmedId = typeof input.athleteId === "string" ? input.athleteId.trim() : "";
  if (!trimmedId) return false;

  const [existing, coachLinks] = await Promise.all([
    getAthletes(),
    getCoachLinks(),
  ]);
  const target = existing.find((a) => a.id === trimmedId) ?? null;
  const next = existing.filter((a) => a.id !== trimmedId);
  if (next.length === existing.length) return false;

  const retirementSharedAthleteId =
    typeof input.canonicalSharedAthleteId === "string"
      ? input.canonicalSharedAthleteId.trim() || null
      : null;
  const resolutionSource = retirementSharedAthleteId
    ? "explicit_ui_context"
    : "unresolved_local_only";
  const parentWriterLinks = dedupeActiveParentWeeklyLinksByInviteToken(
    activeParentWeeklyLinksWithSecret(coachLinks),
  );
  const shouldAttemptRemoteRetirement =
    Boolean(retirementSharedAthleteId) && parentWriterLinks.length > 0;

  if (__DEV__) {
    console.log("[CANONICAL_RETIREMENT_RESOLUTION]", {
      athleteId: trimmedId,
      canonicalSharedAthleteId: retirementSharedAthleteId,
      remoteRetirementEligible: shouldAttemptRemoteRetirement,
      writerSessionPresent: parentWriterLinks.length > 0,
      remoteDeleteAttempted: shouldAttemptRemoteRetirement,
      resolutionSource,
      timestamp: new Date().toISOString(),
    });
  }

  let workerDeleteRequestFired = false;
  let retirementEndpointUrl: string | null = null;
  let remoteDeleteSucceeded = false;
  let remoteDeleteIdempotent = false;
  let remoteDeleteAttemptCount = 0;
  let remoteDeleteSuccessCount = 0;
  let remoteDeleteFailureCount = 0;

  if (shouldAttemptRemoteRetirement) {
    for (const link of parentWriterLinks) {
      const weeklySync = link.weeklySync;
      const token = weeklySync.linkToken.trim();
      const parentWriterSecret = weeklySync.parentWriterSecret?.trim() ?? "";
      if (!token || !parentWriterSecret) continue;
      const endpointUrl = `${weeklySync.apiBaseUrl.replace(/\/+$/, "")}/v1/sessions/${encodeURIComponent(
        token,
      )}/athletes/${encodeURIComponent(retirementSharedAthleteId!)}`;
      retirementEndpointUrl = endpointUrl;
      if (__DEV__) {
        console.log("[CANONICAL_RETIREMENT_REQUEST]", {
          sharedAthleteId: retirementSharedAthleteId,
          writerTokenTail: normalizeInviteLinkToken(token).slice(-8),
          endpointUrl,
          requestPhase: "start",
          responseCode: null,
          retryFailureState: null,
          timestamp: new Date().toISOString(),
        });
      }
      try {
        workerDeleteRequestFired = true;
        remoteDeleteAttemptCount += 1;
        const deleteResult = await coachSyncDeleteSessionAthlete(
          token,
          retirementSharedAthleteId!,
          parentWriterSecret,
          weeklySync.apiBaseUrl,
        );
        remoteDeleteSuccessCount += 1;
        remoteDeleteIdempotent = remoteDeleteIdempotent || deleteResult.idempotent;
        if (__DEV__) {
          console.log("[CANONICAL_RETIREMENT_REQUEST]", {
            sharedAthleteId: retirementSharedAthleteId,
            writerTokenTail: normalizeInviteLinkToken(token).slice(-8),
            endpointUrl,
            requestPhase: "end",
            responseCode: "ok_or_already_retired",
            retryFailureState: null,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        remoteDeleteFailureCount += 1;
        if (__DEV__) {
          console.log("[CANONICAL_RETIREMENT_REQUEST]", {
            sharedAthleteId: retirementSharedAthleteId,
            writerTokenTail: normalizeInviteLinkToken(token).slice(-8),
            endpointUrl,
            requestPhase: "end",
            responseCode: error instanceof Error && "status" in error
              ? (error as { status?: unknown }).status ?? null
              : null,
            retryFailureState: "remote_retirement_failed_local_delete_continues",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    remoteDeleteSucceeded =
      remoteDeleteAttemptCount > 0 &&
      remoteDeleteFailureCount === 0 &&
      remoteDeleteSuccessCount === remoteDeleteAttemptCount;
  } else if (__DEV__) {
    console.log("[CANONICAL_RETIREMENT_SKIPPED]", {
      athleteId: trimmedId,
      canonicalSharedAthleteId: retirementSharedAthleteId,
      writerSessionPresent: parentWriterLinks.length > 0,
      reason: retirementSharedAthleteId
        ? "writer_session_missing"
        : "canonical_shared_athlete_id_missing",
      localOnlyAthlete: !retirementSharedAthleteId,
      timestamp: new Date().toISOString(),
    });
    console.log("[CANONICAL_RETIREMENT_REQUEST]", {
      sharedAthleteId: retirementSharedAthleteId,
      writerTokenTail: null,
      endpointUrl: null,
      requestPhase: "skipped",
      responseCode: null,
      retryFailureState: null,
      skipReason: "no_parent_writer_session_for_athlete",
      timestamp: new Date().toISOString(),
    });
  }

  if (retirementSharedAthleteId && remoteDeleteSucceeded) {
    const kidsById = await getKidsById();
    const affectedKidIds = Object.values(kidsById)
      .filter((kid) => (kid.sharedAthleteId ?? "").trim() === retirementSharedAthleteId)
      .map((kid) => kid.id);
    let clearedLinkageCount = 0;
    for (const kidId of affectedKidIds) {
      const cleared = await clearKidSharedAthleteLink(kidId);
      if (cleared) clearedLinkageCount += 1;
    }
    if (__DEV__) {
      console.log("[CANONICAL_LINKAGE_RETIREMENT]", {
        canonicalSharedAthleteId: retirementSharedAthleteId,
        affectedKidIds,
        clearedLinkageCount,
        remoteDeleteSucceeded,
        remoteDeleteIdempotent,
        skippedBecauseRemoteFailed: false,
        timestamp: new Date().toISOString(),
      });
    }
  } else if (retirementSharedAthleteId && __DEV__) {
    console.log("[CANONICAL_LINKAGE_RETIREMENT]", {
      canonicalSharedAthleteId: retirementSharedAthleteId,
      affectedKidIds: [],
      clearedLinkageCount: 0,
      remoteDeleteSucceeded,
      remoteDeleteIdempotent,
      skippedBecauseRemoteFailed: shouldAttemptRemoteRetirement && !remoteDeleteSucceeded,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const raw = JSON.stringify(next);
    logKeyWrite({
      key: StorageKeys.parentAthletes,
      raw,
      source: "athleteStore.deleteAthlete",
      extra: {
        deletedAthleteId: trimmedId,
        remainingAthleteCount: next.length,
      },
    });
    await AsyncStorage.setItem(StorageKeys.parentAthletes, raw);
  } catch {
    return false;
  }

  if (__DEV__) {
    console.log("[REMOTE_DELETE_PROPAGATION]", {
      sharedAthleteId: retirementSharedAthleteId ?? trimmedId,
      localDeletionSuccess: true,
      workerDeleteRequestFired,
      endpointUrl: retirementEndpointUrl,
      responseCode: null,
      responsePayload: null,
      retryFailureState: null,
      source: "athleteStore.deleteAthlete",
      timestamp: new Date().toISOString(),
    });
    console.log("[PARENT_ATHLETE_DELETE_AUDIT]", {
      athleteId: trimmedId,
      sharedAthleteId: retirementSharedAthleteId,
      linkedInviteIds: [],
      deletedLocally: true,
      publishedDeletionEvent: workerDeleteRequestFired,
      retiredInviteIds: [],
      removedSharedAthleteId: Boolean(retirementSharedAthleteId),
      removedWriterLinks: false,
      workerDeleteEndpointCalled: workerDeleteRequestFired,
      source: "athleteStore.deleteAthlete",
      athleteName: target?.name ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  const current = await getActiveAthleteId();
  const currentNorm = (current ?? "").trim();
  if (currentNorm === trimmedId) {
    if (next.length > 0) {
      await setActiveAthleteId(next[0].id);
    } else {
      await setActiveAthleteId(null, { allowClear: true });
    }
  }

  return true;
}

export async function getActiveAthleteId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(StorageKeys.parentActiveAthleteId);
    logKeyRead({
      key: StorageKeys.parentActiveAthleteId,
      raw,
      source: "athleteStore.getActiveAthleteId",
    });
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

type ActiveAthleteChangeListener = () => void;
const activeAthleteChangeListeners = new Set<ActiveAthleteChangeListener>();

/** Subscribers run after `setActiveAthleteId` mutates storage (same JS tick as the write await). */
export function subscribeActiveAthleteChanges(listener: ActiveAthleteChangeListener): () => void {
  activeAthleteChangeListeners.add(listener);
  return () => {
    activeAthleteChangeListeners.delete(listener);
  };
}

/** After storage repair mutates OAI / roster without a selection change, force authority snapshot rebuild. */
export function notifyActiveAthleteChanged(): void {
  for (const listener of activeAthleteChangeListeners) {
    try {
      listener();
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export type SetActiveAthleteIdOptions = {
  /** Allow removing the persisted active athlete (e.g. last profile deleted). */
  allowClear?: boolean;
};

export async function setActiveAthleteId(
  athleteId: string | null,
  options?: SetActiveAthleteIdOptions,
): Promise<void> {
  const allowClear = options?.allowClear === true;
  const wantClear =
    athleteId == null || (typeof athleteId === "string" && athleteId.trim() === "");

  if (wantClear && !allowClear) {
    if (__DEV__) {
      console.warn("⚠️ Ignoring empty athleteId transition");
    }
    return;
  }

  const prevRaw = await getActiveAthleteId();
  const prevNorm = (prevRaw ?? "").trim();

  try {
    if (athleteId == null) {
      logKeyWrite({
        key: StorageKeys.parentActiveAthleteId,
        raw: null,
        source: "athleteStore.setActiveAthleteId",
        extra: { operation: "removeItem" },
      });
      await AsyncStorage.removeItem(StorageKeys.parentActiveAthleteId);
    } else {
      const trimmed = athleteId.trim();
      if (!trimmed) {
        logKeyWrite({
          key: StorageKeys.parentActiveAthleteId,
          raw: null,
          source: "athleteStore.setActiveAthleteId",
          extra: { operation: "removeItem_empty" },
        });
        await AsyncStorage.removeItem(StorageKeys.parentActiveAthleteId);
      } else {
        logKeyWrite({
          key: StorageKeys.parentActiveAthleteId,
          raw: trimmed,
          source: "athleteStore.setActiveAthleteId",
        });
        await AsyncStorage.setItem(StorageKeys.parentActiveAthleteId, trimmed);
      }
    }
  } catch {
    /* ignore */
  }

  const nextRaw = await getActiveAthleteId();
  const nextNorm = (nextRaw ?? "").trim();

  if (__DEV__ && prevNorm !== nextNorm) {
    const from = prevNorm || "(none)";
    const to = nextNorm || "(none)";
    console.log(`[ATHLETE SWITCH] from ${from} → ${to}`);
  }

  if (prevNorm !== nextNorm) {
    console.log("[ATHLETE TRACE][STORE UPDATE]", {
      source: "selector_press",
      reason: "setActiveAthleteId",
      athleteName: null,
      selectedAthleteId: nextNorm || null,
      sharedAthleteId: nextNorm || null,
      linkedKidId: null,
      previousAthleteId: prevNorm || null,
      nextAthleteId: nextNorm || null,
    });
    logAthleteLineageTrace({
      operation: "attach",
      source: "athlete_store",
      sharedAthleteId: nextNorm || null,
      previousSharedAthleteId: prevNorm || null,
      route: "athleteStore.setActiveAthleteId",
    });
    notifyActiveAthleteChanged();
  }
}
