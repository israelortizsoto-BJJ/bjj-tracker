import { isCoachSyncConfigured } from "../config/coachSync";
import {
  ensureOperatingAthletesFromCoachLinkedKids,
  getActiveAthleteId,
  getAthletes,
  setActiveAthleteId,
  type ParentAthlete,
} from "../storage/athleteStore";
import {
  getKidsById,
  refreshCoachWriterSessionsAndReconcileStores,
  type CoachWriterSessionRefreshResult,
} from "../storage/coachKidStore";
import type { DeviceRole } from "../storage/deviceRoleStore";
import { isKidCoachArchived, type KidsById } from "../types/coachKid";
import {
  coachAthleteSourceMapDev,
  logCoachHydrationResolveTrace,
} from "./coachHydrationResolveTrace";
import { runLineageIntegrityScan } from "./lineageIntegrityDetection";
import { setLineageIntegrityTraceContext } from "./athleteLineageTrace";
import type {
  AthleteAuthorityBootstrapState,
  AthleteAuthoritySnapshot,
  BuildAthleteAuthoritySnapshotOptions,
} from "./types";

export type LinkedKidForParentAthleteOptions = Record<string, never>;

export function linkedKidIdForParentAthlete(
  kidsById: KidsById,
  athleteId: string,
): string | null {
  const aid = typeof athleteId === "string" ? athleteId.trim() : "";
  if (!aid) return null;
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if ((k.sharedAthleteId ?? "").trim() === aid) return k.id;
  }
  return null;
}

export function traceAthleteAuthoritySnapshotDev(_payload: Record<string, unknown>): void {}

function coachLinkedSharedAthleteIdSet(kidsById: KidsById): Set<string> {
  const ids = new Set<string>();
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (sid) ids.add(sid);
  }
  return ids;
}

function deriveOperatingAthleteRoster(
  parentRole: DeviceRole | null,
  sorted: ParentAthlete[],
  linkedIdSet: Set<string>,
): ParentAthlete[] {
  if (parentRole === "coach") {
    return sorted.filter((a) => linkedIdSet.has(a.id.trim()));
  }
  return sorted.filter((a) => {
    const id = a.id.trim();
    if (linkedIdSet.has(id)) return true;
    return a.operatingScope === "local_only";
  });
}

async function buildSnapshotCore(
  parentRole: DeviceRole | null,
  observability?: BuildAthleteAuthoritySnapshotOptions["observability"],
  skipCoachWriterSessionRefresh = false,
): Promise<AthleteAuthoritySnapshot> {
  const refreshResult: CoachWriterSessionRefreshResult =
    parentRole === "coach" && !skipCoachWriterSessionRefresh
      ? await refreshCoachWriterSessionsAndReconcileStores()
      : { successfulSnapshots: [], writerLinks: [], inviteSessionAthletesByToken: {} };

  const loadedKids = await getKidsById();

  if (parentRole === "coach" || parentRole === "parent") {
    await ensureOperatingAthletesFromCoachLinkedKids(loadedKids);
  }

  const [list, storedRaw] = await Promise.all([getAthletes(), getActiveAthleteId()]);

  const sorted = [...list].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const storedNorm = (storedRaw ?? "").trim();
  const linkedIdSet = coachLinkedSharedAthleteIdSet(loadedKids);
  const operatingAthleteRoster = deriveOperatingAthleteRoster(parentRole, sorted, linkedIdSet);
  const linkedAthletes = operatingAthleteRoster;

  const storedInParentList = Boolean(storedNorm && sorted.some((a) => a.id === storedNorm));
  const storedLinkedCoach =
    parentRole === "coach" && storedNorm ? linkedIdSet.has(storedNorm) : false;

  const coachSessionRefreshDegraded =
    parentRole === "coach" &&
    isCoachSyncConfigured() &&
    refreshResult.writerLinks.length > 0 &&
    refreshResult.successfulSnapshots.length === 0;

  let resolvedId = "";
  let authorityBootstrapState: AthleteAuthorityBootstrapState = "ready";
  let coachOperatingAthleteChoices: ParentAthlete[] = [];

  if (parentRole === "parent") {
    if (storedInParentList) {
      resolvedId = storedNorm;
      authorityBootstrapState = "ready";
    } else if (operatingAthleteRoster.length === 0) {
      resolvedId = "";
      authorityBootstrapState = "empty";
    } else if (operatingAthleteRoster.length >= 2) {
      resolvedId = "";
      authorityBootstrapState = "parent_unresolved";
    } else {
      resolvedId = operatingAthleteRoster[0]?.id.trim() ?? "";
      authorityBootstrapState = resolvedId ? "ready" : "empty";
    }
  } else if (parentRole === "coach") {
    const coachProjectionExists = sorted.some((a) => linkedIdSet.has(a.id.trim()));
    if (storedInParentList && storedLinkedCoach) {
      resolvedId = storedNorm;
      authorityBootstrapState = "ready";
      if (__DEV__) {
        logCoachHydrationResolveTrace("authority_snapshot_selection", {
          sharedAthleteId: storedNorm,
          resolvedAthleteId: resolvedId,
          storedActiveAthleteId: storedNorm,
          authorityBootstrapState,
          authorityWinner: "stored_linked_coach",
          projectionExists: true,
          coachProjectionExists,
          athleteSourceMap: coachAthleteSourceMapDev(sorted, loadedKids, linkedIdSet),
        });
      }
    } else if (storedInParentList && !storedLinkedCoach) {
      // Stale local OAI (e.g. legacy `pa_*`) after canonical `shared_ath_*` bind — must not resolve as ready.
      resolvedId = "";
      if (linkedAthletes.length === 0) {
        coachOperatingAthleteChoices = [];
        authorityBootstrapState = coachSessionRefreshDegraded
          ? "coach_disconnected"
          : "empty";
        if (__DEV__) {
          logCoachHydrationResolveTrace("authority_snapshot_selection", {
            sharedAthleteId: null,
            resolvedAthleteId: null,
            storedActiveAthleteId: storedNorm,
            authorityBootstrapState,
            authorityWinner: "stale_oai_rejected_no_linked_roster",
            projectionExists: false,
            coachProjectionExists,
            hydrateRejectionReason: "stored_oai_not_in_linked_roster_and_no_linked_athletes",
            athleteSourceMap: coachAthleteSourceMapDev(sorted, loadedKids, linkedIdSet),
          });
        }
      } else if (linkedAthletes.length >= 2) {
        authorityBootstrapState = "coach_unresolved";
        coachOperatingAthleteChoices = linkedAthletes;
        if (__DEV__) {
          logCoachHydrationResolveTrace("authority_snapshot_selection", {
            sharedAthleteId: null,
            resolvedAthleteId: null,
            storedActiveAthleteId: storedNorm,
            authorityBootstrapState,
            authorityWinner: "stale_oai_rejected_multi_linked",
            projectionExists: false,
            coachProjectionExists,
            hydrateRejectionReason: "stored_oai_not_in_linked_roster",
            athleteSourceMap: coachAthleteSourceMapDev(sorted, loadedKids, linkedIdSet),
          });
        }
      } else {
        const only = linkedAthletes[0];
        if (coachSessionRefreshDegraded) {
          authorityBootstrapState = "coach_disconnected";
          coachOperatingAthleteChoices = linkedAthletes;
          if (__DEV__) {
            logCoachHydrationResolveTrace("authority_snapshot_selection", {
              sharedAthleteId: only?.id ?? null,
              resolvedAthleteId: null,
              storedActiveAthleteId: storedNorm,
              authorityBootstrapState,
              authorityWinner: "stale_oai_rejected_sync_degraded",
              coachProjectionExists,
              hydrateRejectionReason: "stored_oai_not_in_linked_roster",
            });
          }
        } else if (only) {
          resolvedId = only.id;
          await setActiveAthleteId(only.id);
          authorityBootstrapState = "ready";
          coachOperatingAthleteChoices = [];
          if (__DEV__) {
            logCoachHydrationResolveTrace("authority_snapshot_selection", {
              sharedAthleteId: only.id,
              resolvedAthleteId: resolvedId,
              storedActiveAthleteId: storedNorm,
              authorityBootstrapState,
              authorityWinner: "stale_oai_migrated_to_single_linked_shared",
              projectionExists: true,
              coachProjectionExists,
              hydrateRejectionReason: "stored_oai_not_in_linked_roster",
              athleteSourceMap: coachAthleteSourceMapDev(sorted, loadedKids, linkedIdSet),
            });
          }
        }
      }
    } else {
      resolvedId = "";

      if (linkedAthletes.length === 0) {
        coachOperatingAthleteChoices = [];
        authorityBootstrapState = coachSessionRefreshDegraded
          ? "coach_disconnected"
          : "empty";
      } else if (linkedAthletes.length >= 2) {
        authorityBootstrapState = "coach_unresolved";
        coachOperatingAthleteChoices = linkedAthletes;
      } else {
        const only = linkedAthletes[0];
        if (coachSessionRefreshDegraded) {
          authorityBootstrapState = "coach_disconnected";
          coachOperatingAthleteChoices = linkedAthletes;
        } else if (only) {
          resolvedId = only.id;
          await setActiveAthleteId(only.id);
          authorityBootstrapState = "ready";
          coachOperatingAthleteChoices = [];
        }
      }
      if (__DEV__) {
        logCoachHydrationResolveTrace("authority_snapshot_selection", {
          sharedAthleteId: (resolvedId || linkedAthletes[0]?.id) ?? null,
          resolvedAthleteId: resolvedId || null,
          storedActiveAthleteId: storedNorm || null,
          authorityBootstrapState,
          authorityWinner: resolvedId ? "auto_single_linked" : authorityBootstrapState,
          coachProjectionExists,
          athleteSourceMap: coachAthleteSourceMapDev(sorted, loadedKids, linkedIdSet),
        });
      }
    }
  } else {
    authorityBootstrapState = sorted.length === 0 ? "empty" : "ready";
    resolvedId = storedInParentList ? storedNorm : "";
  }

  const snapshot = {
    sorted,
    operatingAthleteRoster,
    resolvedId,
    loadedKids,
    authorityBootstrapState,
    coachOperatingAthleteChoices,
    meta: observability,
  };

  if (__DEV__) {
    const writerSessions = refreshResult.successfulSnapshots.map((snap) => ({
      linkTokenNorm: snap.linkTokenNorm,
      athletes: snap.athletes,
    }));
    setLineageIntegrityTraceContext({
      role: parentRole,
      activeOperatingAthleteId: resolvedId.trim() || null,
      parentAthletes: sorted,
      operatingAthleteRoster,
      kidsById: loadedKids,
      writerSessions,
    });
    runLineageIntegrityScan({
      route: "buildAthleteAuthoritySnapshot",
      role: parentRole,
      activeOperatingAthleteId: resolvedId.trim() || null,
      parentAthletes: sorted,
      operatingAthleteRoster,
      kidsById: loadedKids,
      writerSessions,
    });
  }

  return snapshot;
}

export async function buildAthleteAuthoritySnapshot(
  options: BuildAthleteAuthoritySnapshotOptions,
): Promise<AthleteAuthoritySnapshot> {
  return buildSnapshotCore(
    options.parentRole,
    options.observability,
    options.skipCoachWriterSessionRefresh === true,
  );
}
