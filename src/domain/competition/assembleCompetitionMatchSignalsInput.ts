import type { MatchSignalsCompetitionRow } from "../../lib/signals/competitionMatchBucketAggregate";
import {
  selectCompetitionAnalysisForAnalytics,
  type CompetitionAnalyticsSelection,
  type SelectCompetitionAnalysisForAnalyticsInput,
} from "./selectCompetitionAnalysisForAnalytics";

export function assembleCompetitionMatchSignalsInput(
  input: SelectCompetitionAnalysisForAnalyticsInput,
  options?: { eligibilityEnabled?: boolean },
): CompetitionAnalyticsSelection & {
  entries: readonly MatchSignalsCompetitionRow[];
} {
  return selectCompetitionAnalysisForAnalytics(input, options);
}
