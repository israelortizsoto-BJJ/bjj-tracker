export type SyncedCoachOutcome = "not_yet" | "close" | "hit";

export type SyncedWeeklyParentFeedback = {
  viewedAt?: string;
  acknowledgedAt?: string;
};

/**
 * Remote weekly message published by coach devices; parents read-only in MVP.
 * Explicit fields only — no coach private notes.
 */
export type SyncedWeeklyMessagePayload = {
  weekStartYMD: string;
  /** Stable Level 1 taxonomy id used for deterministic signal routing. */
  systemKey?: string;
  /** Hero + Read together headline */
  headline: string;
  /** Hero + Read together body (family-facing text only) */
  body: string;
  /** Optional line for Read together “class” step */
  classLine?: string;
  /** Optional line for Read together “program” step */
  programLine?: string;
  /** Optional link for “Mission of the week” on parent Read together (publish lane only). */
  missionResourceUrl?: string;
  missionResourceLabel?: string;
  /** Optional link for “Study the move” on parent Read together (publish lane only). */
  familyResourceUrl?: string;
  familyResourceLabel?: string;
  /** Optional parent-safe recap of what coach emphasized with the athlete (not private check-ins). */
  familyCoachRecapNote?: string;
  /** Parent-safe coach progress signal, mapped from the coach weekly check-in. */
  coachOutcome?: SyncedCoachOutcome;
  /** Parent read/acknowledge signal for the currently published weekly note. */
  parentFeedback?: SyncedWeeklyParentFeedback;
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

/** Parent-published bounded match intelligence for coach Summary (no raw match lineage). */
export type SyncedCompetitionAggregateArtifact = {
  sharedAthleteId: string;
  updatedAt: string;

  totalCompetitions: number;
  totalMatches: number;

  wins: number;
  losses: number;

  winRate: number | null;
  submissionRate: number | null;

  fastestSubmissionSeconds: number | null;
  averageMatchSeconds: number | null;

  dominantWinStyle: "submission-heavy" | "points-heavy" | "mixed" | null;

  latestCompetitionName?: string;
  latestCompetitionDate?: string;
};

export type CoachWeeklySyncPutCompetitionAggregateBody = SyncedCompetitionAggregateArtifact;

export type SyncedCompetitionTopologyFinishType =
  | "submission"
  | "points"
  | "ref_decision"
  | "dq"
  | "injury"
  | "unknown"
  | null;

export type SyncedCompetitionParentMediaRef = {
  kind: "image" | "video";
  assetId?: string | null;
  uri?: string | null;
};

export type SyncedCompetitionMatchTopology = {
  matchLineageKey: string;
  ordinal: number;
  result: "win" | "loss" | null;
  finishType: SyncedCompetitionTopologyFinishType;
  durationSeconds: number | null;
  submissionType?: string | null;
  pointsFor?: number | null;
  pointsAgainst?: number | null;
  parentMediaRefs?: SyncedCompetitionParentMediaRef[];
};

export type SyncedCompetitionTopology = {
  sharedCompetitionId: SharedCompetitionId;
  sharedAthleteId: SharedAthleteId;
  competitionLineageKey: string;
  updatedAt: string;
  matches: SyncedCompetitionMatchTopology[];
};

/** Parent-published canonical structural match rows. Coach consumers remain inert until Phase 2. */
export type SyncedCompetitionTopologyArtifact = {
  schemaVersion: 1;
  sharedAthleteId: SharedAthleteId;
  updatedAt: string;
  competitions: SyncedCompetitionTopology[];
};

/** Read-only durable attachment metadata; never a delivery capability. */
export type SyncedMatchMediaAttachmentProjection =
  | {
      sharedAthleteId: SharedAthleteId;
      sharedCompetitionId: SharedCompetitionId;
      matchLineageKey: string;
      revision: number;
      state: "attached";
      matchMediaAssetId: string;
      publishedAt: string;
      updatedAt: string;
    }
  | {
      sharedAthleteId: SharedAthleteId;
      sharedCompetitionId: SharedCompetitionId;
      matchLineageKey: string;
      revision: number;
      state: "tombstoned";
      tombstonedAt: string;
      updatedAt: string;
    };

export type SyncedMatchMediaAttachmentProjectionSet = {
  schemaVersion: 1;
  sharedAthleteId: SharedAthleteId;
  attachments: SyncedMatchMediaAttachmentProjection[];
};

export type CoachWeeklySyncPutCompetitionTopologyBody = SyncedCompetitionTopologyArtifact;

export type SyncedTrainingProofRankedItem = {
  key: string;
  label: string;
  count: number;
};

/** Parent-published bounded training proof for coach Summary (no Session[] transport). */
export type SyncedTrainingProofArtifact = {
  sharedAthleteId: string;
  updatedAt: string;
  currentWeekSessionCount: number;
  lastTrainingDateYMD: string | null;
  dominantSystemKey: string | null;
  topSystems: SyncedTrainingProofRankedItem[];
  topTechniques: SyncedTrainingProofRankedItem[];
  weeklyGoalMet: boolean;
};

export type CoachWeeklySyncPutTrainingProofBody = SyncedTrainingProofArtifact;

export type SyncedCoachMatchBreakdownArtifact = {
  sharedAthleteId: SharedAthleteId;
  sharedCompetitionId: SharedCompetitionId;
  matchLineageKey: string;
  coachNote?: string;
  /**
   * Remote companion audio id (worker R2). Domain metadata only.
   * Never a URL, localUri, or audio bytes.
   */
  mediaId?: string;
  durationMs?: number;
  mimeType?: string;
  updatedAt: string;
};

export type SyncedCoachMatchBreakdownArtifactSet = {
  schemaVersion: 1;
  sharedAthleteId: SharedAthleteId;
  updatedAt: string;
  artifacts: SyncedCoachMatchBreakdownArtifact[];
};

export type CoachMatchBreakdownArtifactFieldClassification =
  | "valid"
  | "omitted"
  | "malformed";

export type CoachMatchBreakdownArtifactAthleteEntryClassification =
  | "populated"
  | "empty"
  | "malformed";

export type CoachMatchBreakdownArtifactParseEvidence = {
  fieldClassification: CoachMatchBreakdownArtifactFieldClassification;
  athleteEntryClassificationById: Record<
    SharedAthleteId,
    CoachMatchBreakdownArtifactAthleteEntryClassification
  >;
};

export type CoachWeeklySyncPutCoachMatchBreakdownArtifactsBody =
  SyncedCoachMatchBreakdownArtifactSet;

export type CoachWeeklySyncSessionResponse = {
  schemaVersion?: number;
  coach: CoachWeeklySyncCoachSummary;
  weekly: SyncedWeeklyMessagePayload | null;
  /** Per-athlete weekly docs; absent or empty on older workers — use `resolveWeeklyDoc` when scoping by athlete. */
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null>;
  athletes: SyncedSharedAthlete[];
  competitions: SyncedSharedCompetition[];
  /** Per-athlete bounded competition match intelligence; parent writer only. */
  competitionAggregateByAthleteId?: Record<string, SyncedCompetitionAggregateArtifact>;
  /** Per-athlete canonical competition topology; parent writer only. Inert until Phase 2. */
  competitionTopologyByAthleteId?: Record<string, SyncedCompetitionTopologyArtifact>;
  /** Optional Worker read-time projection; Coach hydrates via coachMatchMediaAttachmentStore. */
  matchMediaAttachmentsByAthleteId?: Record<string, SyncedMatchMediaAttachmentProjectionSet>;
  /** Per-athlete bounded training proof; parent writer only. */
  trainingProofByAthleteId?: Record<string, SyncedTrainingProofArtifact>;
  /** Per-athlete coach-owned match breakdown overlays. Parents consume read-only. */
  coachMatchBreakdownArtifacts?: Record<string, SyncedCoachMatchBreakdownArtifactSet>;
  /** Parser evidence retained separately from the accepted artifact map. */
  coachMatchBreakdownArtifactEvidence?: CoachMatchBreakdownArtifactParseEvidence;
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
  /** Stable Level 1 taxonomy id used for deterministic signal routing. */
  systemKey?: string;
  headline: string;
  body: string;
  classLine?: string;
  programLine?: string;
  missionResourceUrl?: string | null;
  missionResourceLabel?: string | null;
  familyResourceUrl?: string | null;
  familyResourceLabel?: string | null;
  /** App sends `""` to clear; omitting the key is treated as “keep previous” on the worker. */
  familyCoachRecapNote?: string;
  /** Parent-safe coach progress signal, mapped from the coach weekly check-in. */
  coachOutcome?: SyncedCoachOutcome;
  /** When set, worker stores this snapshot under that athlete id instead of invite-level `weekly`. */
  sharedAthleteId?: string;
};

/** Parent overlay publish on the existing `PUT …/weekly` lane (parent writer only). */
export type CoachWeeklySyncParentWeeklyOverlayBody = {
  parentFeedback: SyncedWeeklyParentFeedback;
  sharedAthleteId?: string;
};

export type CoachWeeklySyncWeeklyPutBody =
  | CoachWeeklySyncPublishBody
  | CoachWeeklySyncParentWeeklyOverlayBody;

export type CoachWeeklySyncRedeemParentWriterResponse = {
  parentWriterSecret: string;
};

export type CoachWeeklySyncCreateAthleteBody = {
  name: string;
  /**
   * When set, worker re-attaches this canonical `shared_ath_*` to the invite roster instead of minting.
   * Client must resolve lineage locally before POST (Build 33.3).
   */
  bindSharedAthleteId?: string;
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
