export type CoachMatchBreakdownOverlayIdentity = {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
};

/** Coach-owned interpretation only. Canonical competition facts must never enter this row. */
export type CoachMatchBreakdownOverlay = CoachMatchBreakdownOverlayIdentity & {
  coachNote?: string;
  dictatedReflection?: string;
  analysis?: string;
  updatedAt: string;
};

/** Null or empty text clears one annotation field without touching canonical topology. */
export type CoachMatchBreakdownOverlayPatch = {
  coachNote?: string | null;
  dictatedReflection?: string | null;
  analysis?: string | null;
};
