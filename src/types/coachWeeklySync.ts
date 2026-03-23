/**
 * Remote weekly message published by coach devices; parents read-only in MVP.
 * Explicit fields only — no coach private notes / outcomes.
 */
export type SyncedWeeklyMessagePayload = {
  weekStartYMD: string;
  /** Hero + Read together headline */
  headline: string;
  /** Hero + Read together body (family-facing text only) */
  body: string;
  /** Optional line for Read together “class” step */
  classLine?: string;
  /** Optional line for Read together “program” step */
  programLine?: string;
  updatedAt: string;
};

export type CoachWeeklySyncCoachSummary = {
  id: string;
  displayName: string;
  academyName?: string;
};

export type CoachWeeklySyncSessionResponse = {
  coach: CoachWeeklySyncCoachSummary;
  weekly: SyncedWeeklyMessagePayload | null;
};

export type CoachWeeklySyncCreateSessionBody = {
  coachDisplayName: string;
  academyName?: string;
};

export type CoachWeeklySyncCreateSessionResponse = {
  linkToken: string;
  writerSecret: string;
  coachId: string;
};

export type CoachWeeklySyncPublishBody = {
  weekStartYMD: string;
  headline: string;
  body: string;
  classLine?: string;
  programLine?: string;
};
