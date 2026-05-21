/**
 * TEMP: coach Summary / Compete hydration diagnostics — remove after regression is closed.
 */
import type { ParentAthlete } from "../storage/athleteStore";
import type { KidsById } from "../types/coachKid";

export type CoachHydrationResolveStage =
  | "authority_snapshot_selection"
  | "summary_hydration"
  | "summary_resolve"
  | "competition_resolve"
  | "coach_athlete_lookup"
  | "active_athlete_apply";

export function logCoachHydrationResolveTrace(
  stage: CoachHydrationResolveStage,
  payload: {
    sharedAthleteId?: string | null;
    resolvedAthleteId?: string | null;
    storedActiveAthleteId?: string | null;
    authorityBootstrapState?: string | null;
    authorityWinner?: string | null;
    inviteId?: string | null;
    projectionExists?: boolean;
    coachProjectionExists?: boolean;
    sessionAthleteId?: string | null;
    linkedKidId?: string | null;
    athleteSourceMap?: Record<string, string>;
    hydrateRejectionReason?: string | null;
    nullReturnReason?: string | null;
    extra?: Record<string, unknown>;
  },
): void {
  if (!__DEV__) return;
  console.log("[COACH_HYDRATE_TRACE]", {
    stage,
    at: new Date().toISOString(),
    ...payload,
  });
}

export function coachAthleteSourceMapDev(
  sorted: readonly ParentAthlete[],
  kidsById: KidsById,
  linkedIdSet: Set<string>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const a of sorted) {
    const id = a.id.trim();
    if (!id) continue;
    map[id] = linkedIdSet.has(id) ? "parent_row_linked" : "parent_row_unlinked";
  }
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (!sid) continue;
    const invite = (k.sharedFromInviteTokenNorm ?? "").trim();
    map[`kid:${k.id}`] = `kid_shared:${sid}${invite ? `:invite:${invite.slice(-8)}` : ""}`;
  }
  return map;
}
