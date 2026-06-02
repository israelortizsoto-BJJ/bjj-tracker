import type { CompetitionMatchOverlayAnnotation } from "./projectCompetitionCompeteView";
import { readMatchBreakdownOverlay } from "./readMatchBreakdownOverlay";

/** Read-only overlay materialization for ephemeral competition projections. */
export async function hydrateCompetitionMatchOverlayAnnotations(input: {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKeys: readonly string[];
}): Promise<CompetitionMatchOverlayAnnotation[]> {
  const sharedAthleteId = input.sharedAthleteId.trim();
  const sharedCompetitionId = input.sharedCompetitionId.trim();
  const matchLineageKeys = [...new Set(input.matchLineageKeys.map((key) => key.trim()))].filter(
    Boolean,
  );
  if (!sharedAthleteId || !sharedCompetitionId || matchLineageKeys.length === 0) return [];

  const canonicalMatchLineageKeys = new Set(matchLineageKeys);
  const overlays = await Promise.all(
    matchLineageKeys.map((matchLineageKey) =>
      readMatchBreakdownOverlay(
        { sharedAthleteId, sharedCompetitionId, matchLineageKey },
        { canonicalMatchLineageKeys },
      ),
    ),
  );
  return overlays.filter((overlay): overlay is NonNullable<typeof overlay> => overlay !== null);
}
