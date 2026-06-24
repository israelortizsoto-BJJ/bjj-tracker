import { useEffect, useRef, useState } from "react";

import { competitionAnalyticsEligibilityEnabled } from "../config/competitionAnalyticsFlags";
import { resolveCompetitionAnalyticsSelection } from "../domain/competition/resolveCompetitionAnalyticsSelection";
import type { CompetitionAnalyticsSelectionSource } from "../domain/competition/selectCompetitionAnalysisForAnalytics";
import type { MatchSignalsCompetitionRow } from "../lib/signals/competitionMatchBucketAggregate";
import type { KidCompetitionEntryWithMatchDetail } from "../storage/competitionStore";
import type { DeviceRole } from "../storage/deviceRoleStore";
import type { ParentWeeklySessionSnapshot } from "../coach/resolveWeeklyDoc";

export type UseSummaryCompetitionFocusInputParams = {
  deviceRole: DeviceRole | null;
  sharedAthleteId: string;
  legacyCompetitions: readonly KidCompetitionEntryWithMatchDetail[];
  competitionSliceFingerprint: string;
  hydrationVersion: number;
  weeklySessionSnapshot: ParentWeeklySessionSnapshot | null;
};

export type SummaryCompetitionFocusInputState = {
  entries: readonly MatchSignalsCompetitionRow[];
  source: CompetitionAnalyticsSelectionSource;
};

export function weeklySessionSnapshotFingerprint(
  snapshot: ParentWeeklySessionSnapshot | null,
): string {
  if (!snapshot) return "none";
  const athleteCount = snapshot.athletes?.length ?? 0;
  const weeklyUpdatedAt = snapshot.weekly?.updatedAt?.trim() ?? "";
  const weeklyKeys = Object.keys(snapshot.weeklyByAthleteId ?? {})
    .sort()
    .join(",");
  return `${athleteCount}:${weeklyUpdatedAt}:${weeklyKeys}`;
}

type ResolveSelection = typeof resolveCompetitionAnalyticsSelection;

function legacyFocusState(
  legacyCompetitions: readonly MatchSignalsCompetitionRow[],
): SummaryCompetitionFocusInputState {
  return {
    entries: legacyCompetitions,
    source: "legacy",
  };
}

export function shouldApplyFocusInputGeneration(
  completedGeneration: number,
  latestGeneration: number,
): boolean {
  return completedGeneration === latestGeneration;
}

/**
 * Summary pilot: async assembly for competition focus analytics input.
 * Parent role only; coach pass-through is handled in the resolver.
 */
export function useSummaryCompetitionFocusInput(
  params: UseSummaryCompetitionFocusInputParams,
  options?: {
    resolveSelection?: ResolveSelection;
    eligibilityEnabled?: boolean;
  },
): SummaryCompetitionFocusInputState {
  const resolveSelection = options?.resolveSelection ?? resolveCompetitionAnalyticsSelection;
  const eligibilityEnabled =
    options?.eligibilityEnabled ?? competitionAnalyticsEligibilityEnabled;

  const [state, setState] = useState<SummaryCompetitionFocusInputState>(() =>
    legacyFocusState(params.legacyCompetitions),
  );
  const loadGenerationRef = useRef(0);

  const weeklyFingerprint = weeklySessionSnapshotFingerprint(
    params.weeklySessionSnapshot,
  );

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    setState(legacyFocusState(params.legacyCompetitions));

    let cancelled = false;

    void (async () => {
      try {
        const selection = await resolveSelection(
          {
            deviceRole: params.deviceRole,
            sharedAthleteId: params.sharedAthleteId,
            legacyCompetitions: params.legacyCompetitions,
          },
          { eligibilityEnabled },
        );
        if (cancelled || !shouldApplyFocusInputGeneration(generation, loadGenerationRef.current)) return;
        setState({
          entries: selection.entries,
          source: selection.source,
        });
      } catch {
        if (cancelled || !shouldApplyFocusInputGeneration(generation, loadGenerationRef.current)) return;
        setState(legacyFocusState(params.legacyCompetitions));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    eligibilityEnabled,
    params.competitionSliceFingerprint,
    params.deviceRole,
    params.sharedAthleteId,
    params.hydrationVersion,
    weeklyFingerprint,
  ]);

  return state;
}
