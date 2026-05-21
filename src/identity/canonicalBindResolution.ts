import { normalizeAthleteNameForLineage } from "./lineageIntegrityDetection";
import type { ParentAthlete } from "../storage/athleteStore";
import { isKidCoachArchived, type Kid, type KidsById } from "../types/coachKid";
import type { SyncedSharedAthlete } from "../types/coachWeeklySync";

export type CanonicalBindFlowSource =
  | "parent_relink_kid"
  | "parent_bind_parent_athlete"
  | "parent_attach"
  | "parent_add_athlete";

export type CanonicalBindDecision =
  /** Canonical id already on invite session roster — no mint. */
  | "bind_existing_session"
  /** Local canonical `shared_ath_*` must be re-attached to session (bind POST). */
  | "bind_existing_canonical"
  /** No local canonical conflict — server may mint. */
  | "mint_new"
  /** DEV: refuse automatic mint when local lineage would split. */
  | "blocked_duplicate_risk";

export type ResolveCanonicalBindInput = {
  athleteName: string;
  inviteTokenNorm: string;
  sessionAthletes: readonly SyncedSharedAthlete[];
  parentAthletes: readonly ParentAthlete[];
  kidsById: KidsById;
  flowSource: CanonicalBindFlowSource;
  linkedKidId?: string | null;
  parentAthleteId?: string | null;
};

export type ResolveCanonicalBindResult = {
  decision: CanonicalBindDecision;
  canonicalSharedAthleteId: string | null;
  bindSource: string | null;
  sessionAthlete: SyncedSharedAthlete | null;
  /** Name-only collisions (soft warning; never used as sole bind truth). */
  softNameDuplicateSharedIds: string[];
};

export class IdentityDuplicateRiskBlockedError extends Error {
  readonly code = "IDENTITY_DUPLICATE_RISK_BLOCKED" as const;
  readonly canonicalSharedAthleteId: string;
  readonly flowSource: CanonicalBindFlowSource;

  constructor(
    message: string,
    opts: { canonicalSharedAthleteId: string; flowSource: CanonicalBindFlowSource },
  ) {
    super(message);
    this.name = "IdentityDuplicateRiskBlockedError";
    this.canonicalSharedAthleteId = opts.canonicalSharedAthleteId;
    this.flowSource = opts.flowSource;
  }
}

const SHARED_ATH_PREFIX = "shared_ath_";

export function isSharedAthleteLineageId(id: string | null | undefined): boolean {
  const t = (id ?? "").trim();
  return t.startsWith(SHARED_ATH_PREFIX) && t.length > SHARED_ATH_PREFIX.length;
}

function sessionAthleteById(
  sessionAthletes: readonly SyncedSharedAthlete[],
  id: string,
): SyncedSharedAthlete | null {
  const want = id.trim();
  if (!want) return null;
  return (
    sessionAthletes.find((a) => (typeof a.id === "string" ? a.id.trim() : "") === want) ?? null
  );
}

function sessionAthleteByNormalizedName(
  sessionAthletes: readonly SyncedSharedAthlete[],
  athleteName: string,
): SyncedSharedAthlete | null {
  const norm = normalizeAthleteNameForLineage(athleteName);
  if (!norm) return null;
  return (
    sessionAthletes.find(
      (a) => normalizeAthleteNameForLineage(a.name ?? "") === norm,
    ) ?? null
  );
}

function collectSoftNameDuplicateSharedIds(
  athleteName: string,
  parentAthletes: readonly ParentAthlete[],
  kidsById: KidsById,
  excludeId?: string | null,
): string[] {
  const norm = normalizeAthleteNameForLineage(athleteName);
  if (!norm) return [];
  const exclude = (excludeId ?? "").trim();
  const ids = new Set<string>();

  for (const a of parentAthletes) {
    const sid = a.id.trim();
    if (!sid || !isSharedAthleteLineageId(sid)) continue;
    if (sid === exclude) continue;
    if (normalizeAthleteNameForLineage(a.name ?? "") === norm) ids.add(sid);
  }

  for (const k of Object.values(kidsById)) {
    if (!k?.id || isKidCoachArchived(k)) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (!sid || !isSharedAthleteLineageId(sid)) continue;
    if (sid === exclude) continue;
    if (normalizeAthleteNameForLineage(k.name ?? "") === norm) ids.add(sid);
  }

  return [...ids].sort();
}

function priorLineageFromKids(
  kidsById: KidsById,
  opts: {
    athleteName: string;
    inviteTokenNorm: string;
    linkedKidId?: string | null;
  },
): { sharedId: string; bindSource: string } | null {
  const norm = normalizeAthleteNameForLineage(opts.athleteName);
  const linkedKidId = (opts.linkedKidId ?? "").trim();

  if (linkedKidId) {
    const kid = kidsById[linkedKidId];
    const sid = (kid?.sharedAthleteId ?? "").trim();
    if (kid && sid && isSharedAthleteLineageId(sid)) {
      return { sharedId: sid, bindSource: "linked_kid_sharedAthleteId" };
    }
  }

  const nameMatches: Kid[] = [];
  for (const k of Object.values(kidsById)) {
    if (!k?.id || isKidCoachArchived(k)) continue;
    if (norm && normalizeAthleteNameForLineage(k.name ?? "") !== norm) continue;
    nameMatches.push(k);
  }

  for (const k of nameMatches) {
    const sid = (k.sharedAthleteId ?? "").trim();
    if (!sid || !isSharedAthleteLineageId(sid)) continue;
    const token = (k.sharedFromInviteTokenNorm ?? "").trim();
    if (opts.inviteTokenNorm && token === opts.inviteTokenNorm) {
      return { sharedId: sid, bindSource: "prior_invite_kid_name_match" };
    }
  }

  for (const k of nameMatches) {
    const sid = (k.sharedAthleteId ?? "").trim();
    if (sid && isSharedAthleteLineageId(sid)) {
      return { sharedId: sid, bindSource: "prior_coach_kid_name_match" };
    }
  }

  return null;
}

function priorLineageFromParentAthletes(
  parentAthletes: readonly ParentAthlete[],
  opts: { athleteName: string; parentAthleteId?: string | null },
): { sharedId: string; bindSource: string } | null {
  const parentAthleteId = (opts.parentAthleteId ?? "").trim();
  if (parentAthleteId) {
    const row = parentAthletes.find((a) => a.id.trim() === parentAthleteId);
    if (row && isSharedAthleteLineageId(row.id)) {
      return { sharedId: row.id.trim(), bindSource: "parent_athlete_row_id" };
    }
  }

  const norm = normalizeAthleteNameForLineage(opts.athleteName);
  if (!norm) return null;

  for (const a of parentAthletes) {
    const sid = a.id.trim();
    if (!isSharedAthleteLineageId(sid)) continue;
    if (normalizeAthleteNameForLineage(a.name ?? "") === norm) {
      return { sharedId: sid, bindSource: "parent_athlete_store_name_match" };
    }
  }

  return null;
}

/**
 * Bind-first resolution on the parent authority plane before `POST /v1/sessions/:token/athletes`.
 * Does not reconcile historical duplicates — only chooses bind vs mint for this request.
 */
export function resolveCanonicalBindBeforeSessionAthletePost(
  input: ResolveCanonicalBindInput,
): ResolveCanonicalBindResult {
  const athleteName = input.athleteName.trim();
  const inviteTokenNorm = input.inviteTokenNorm.trim();

  const onSessionByName = sessionAthleteByNormalizedName(input.sessionAthletes, athleteName);
  if (onSessionByName) {
    return {
      decision: "bind_existing_session",
      canonicalSharedAthleteId: onSessionByName.id.trim(),
      bindSource: "session_roster_normalized_name",
      sessionAthlete: onSessionByName,
      softNameDuplicateSharedIds: collectSoftNameDuplicateSharedIds(
        athleteName,
        input.parentAthletes,
        input.kidsById,
        onSessionByName.id.trim(),
      ),
    };
  }

  let canonicalId: string | null = null;
  let bindSource: string | null = null;

  const fromKid = priorLineageFromKids(input.kidsById, {
    athleteName,
    inviteTokenNorm,
    linkedKidId: input.linkedKidId,
  });
  if (fromKid) {
    canonicalId = fromKid.sharedId;
    bindSource = fromKid.bindSource;
  }

  if (!canonicalId) {
    const fromParent = priorLineageFromParentAthletes(input.parentAthletes, {
      athleteName,
      parentAthleteId: input.parentAthleteId,
    });
    if (fromParent) {
      canonicalId = fromParent.sharedId;
      bindSource = fromParent.bindSource;
    }
  }

  if (canonicalId) {
    const onSession = sessionAthleteById(input.sessionAthletes, canonicalId);
    if (onSession) {
      return {
        decision: "bind_existing_session",
        canonicalSharedAthleteId: canonicalId,
        bindSource: bindSource ?? "session_roster_exact_id",
        sessionAthlete: onSession,
        softNameDuplicateSharedIds: collectSoftNameDuplicateSharedIds(
          athleteName,
          input.parentAthletes,
          input.kidsById,
          canonicalId,
        ),
      };
    }

    return {
      decision: "bind_existing_canonical",
      canonicalSharedAthleteId: canonicalId,
      bindSource: bindSource ?? "local_canonical_lineage",
      sessionAthlete: null,
      softNameDuplicateSharedIds: collectSoftNameDuplicateSharedIds(
        athleteName,
        input.parentAthletes,
        input.kidsById,
        canonicalId,
      ),
    };
  }

  return {
    decision: "mint_new",
    canonicalSharedAthleteId: null,
    bindSource: null,
    sessionAthlete: null,
    softNameDuplicateSharedIds: collectSoftNameDuplicateSharedIds(
      athleteName,
      input.parentAthletes,
      input.kidsById,
    ),
  };
}
