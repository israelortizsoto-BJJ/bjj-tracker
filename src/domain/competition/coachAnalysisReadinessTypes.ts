import type { CoachMatchBreakdownArtifactParseEvidence } from "../../types/coachWeeklySync";

export type CoachAnalysisReadinessState =
  | "READY"
  | "EMPTY_READY"
  | "FAILED"
  | "PENDING";

export type CoachAnalysisConfirmedReadinessState = Extract<
  CoachAnalysisReadinessState,
  "READY" | "EMPTY_READY"
>;

export type CoachAnalysisReadinessHydrationSource =
  | "coach_writer_sessions"
  | "parent_session_refresh";

export type CoachAnalysisReadinessRecord = {
  sharedAthleteId: string;
  state: CoachAnalysisReadinessState;
  generation: number;
  startedAt: string;
  resolvedAt?: string;
  hydrationSource: CoachAnalysisReadinessHydrationSource;
  artifactSetUpdatedAt?: string;
  lastConfirmedState?: CoachAnalysisConfirmedReadinessState;
  lastConfirmedAt?: string;
  lastConfirmedArtifactSetUpdatedAt?: string;
};

export type CoachAnalysisReadinessLinkEvidence =
  | {
      linkKey: string;
      status: "pending";
    }
  | {
      linkKey: string;
      status: "failed";
    }
  | {
      linkKey: string;
      status: "success";
      artifactEvidence: CoachMatchBreakdownArtifactParseEvidence;
      artifactSetUpdatedAtByAthleteId?: Readonly<Record<string, string>>;
    };

export type CoachAnalysisReadinessResolution = {
  state: CoachAnalysisReadinessState;
  artifactSetUpdatedAt?: string;
};

export type CoachAnalysisTerminalReadinessResolution = {
  state: Exclude<CoachAnalysisReadinessState, "PENDING">;
  artifactSetUpdatedAt?: string;
};
