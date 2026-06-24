import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { KidCompetitionResult } from "../../types/coachKid";

export type CompetitionAnalysisSource =
  | "coach_artifact"
  | "coach_overlay"
  | "embedded_compatibility"
  | "none";

export type CompetitionAnalysisMatch = {
  matchId: string;
  matchResult: CompetitionDetailMatchSnapshot["matchResult"];
  outcome: CompetitionDetailMatchSnapshot["outcome"];
  submissionTime: string | null;
  submissionType?: string | null;
  resolvedCoachAnalysis: string | null;
  analysisSource: CompetitionAnalysisSource;
};

export type CompetitionAnalysisRow = {
  entryId: string;
  sharedCompetitionId: string | null;
  eventDate: string;
  result: KidCompetitionResult | null;
  createdAt: string;
  competitionCoachNotes: string | null;
  matches: CompetitionAnalysisMatch[];
};
