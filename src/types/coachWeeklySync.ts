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

/** Stable id from sync worker; links parent-created athletes to coach roster hydration. */
export type SharedAthleteId = string;

export type SyncedSharedAthlete = {
  id: SharedAthleteId;
  name: string;
  createdAt: string;
};

export type SharedCompetitionId = string;

export type SyncedSharedCompetition = {
  id: SharedCompetitionId;
  sharedAthleteId: SharedAthleteId;
  tournamentName: string;
  eventDate: string;
  result?: "gold" | "silver" | "bronze" | "participated" | "dnf" | "other";
  eventStatus?: "upcoming" | "completed" | "cancelled" | "unknown";
  format?: "gi" | "nogi" | "both";
  organizationOrPromoter?: string;
  createdAt: string;
  updatedAt: string;
};

export type CoachWeeklySyncSessionResponse = {
  schemaVersion?: number;
  coach: CoachWeeklySyncCoachSummary;
  weekly: SyncedWeeklyMessagePayload | null;
  athletes: SyncedSharedAthlete[];
  competitions: SyncedSharedCompetition[];
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

export type CoachWeeklySyncRedeemParentWriterResponse = {
  parentWriterSecret: string;
};

export type CoachWeeklySyncCreateAthleteBody = {
  name: string;
};

export type CoachWeeklySyncCreateAthleteResponse = {
  athlete: SyncedSharedAthlete;
};

export type CoachWeeklySyncCreateCompetitionBody = {
  sharedAthleteId: SharedAthleteId;
  tournamentName: string;
  eventDate: string;
  result?: SyncedSharedCompetition["result"];
  eventStatus?: SyncedSharedCompetition["eventStatus"];
  format?: SyncedSharedCompetition["format"];
  organizationOrPromoter?: string;
};

export type CoachWeeklySyncCreateCompetitionResponse = {
  competition: SyncedSharedCompetition;
};

export type CoachWeeklySyncUpdateCompetitionBody = Partial<
  Omit<CoachWeeklySyncCreateCompetitionBody, "sharedAthleteId">
>;
