import type { SyncedCoachMatchBreakdownArtifactSet } from "../types/coachWeeklySync";

/** TEMP TRACE — Parent competition overlay hydration (Phase 0). Remove when root cause is fixed. */
export function coachMatchBreakdownCountForCompetition(input: {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  coachMatchBreakdownArtifacts?: Record<string, SyncedCoachMatchBreakdownArtifactSet>;
}): number {
  const athleteId = input.sharedAthleteId.trim();
  const competitionId = input.sharedCompetitionId.trim();
  if (!athleteId || !competitionId) return 0;
  const set = input.coachMatchBreakdownArtifacts?.[athleteId];
  if (!set) return 0;
  return set.artifacts.filter(
    (artifact) => artifact.sharedCompetitionId.trim() === competitionId,
  ).length;
}

/** TEMP TRACE — logs competition shell + overlay artifact counts at hydration boundaries. */
export function logParentCompPayload(
  stage: string,
  comp: Record<string, unknown>,
  coachMatchBreakdownArtifacts?: Record<string, SyncedCoachMatchBreakdownArtifactSet>,
): void {
  const competitionId =
    typeof comp.id === "string"
      ? comp.id
      : typeof comp.sharedCompetitionId === "string"
        ? comp.sharedCompetitionId
        : null;
  const sharedAthleteId =
    typeof comp.sharedAthleteId === "string" ? comp.sharedAthleteId : "";
  const coachMatchBreakdownArtifactsForComp = coachMatchBreakdownCountForCompetition({
    sharedAthleteId,
    sharedCompetitionId: competitionId ?? "",
    coachMatchBreakdownArtifacts,
  });
  const onCompOverlayCount =
    (Array.isArray(comp.coachMatchBreakdowns) ? comp.coachMatchBreakdowns.length : null) ??
    (Array.isArray(comp.matchBreakdowns) ? comp.matchBreakdowns.length : null) ??
    0;

  console.log(
    "[PARENT_COMP_PAYLOAD]",
    JSON.stringify(
      {
        stage,
        competitionId,
        sharedAthleteId: sharedAthleteId || null,
        overlayCount: onCompOverlayCount,
        coachMatchBreakdownArtifactsForComp,
        overlayKeys: Object.keys(comp).filter(
          (key) =>
            key.toLowerCase().includes("overlay") || key.toLowerCase().includes("breakdown"),
        ),
        keys: Object.keys(comp),
      },
      null,
      2,
    ),
  );
}
