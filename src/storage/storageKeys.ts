// src/storage/storageKeys.ts.
/** Bump when `ensureStorageUpToDate` adds steps; v3 introduces `summaryIdentityByScope` on profile JSON. */
export const STORAGE_VERSION = 5 as const;

export const StorageKeys = {
  storageVersion: "bjj.storage.version",
  sessions: "bjj.sessions.v2",
  /** JSON may include nested `summaryIdentityByScope` (see `SUMMARY_IDENTITY_ACCOUNT_SCOPE`) and legacy summary fields. */
  profile: "bjj.profile.v2",

  coachLinks: "mm:v1:coachLinks",
  coachesById: "mm:v1:coachesById",
  packsById: "mm:v1:packsById",
  packEnrollments: "mm:v1:packEnrollments",
  assignmentsById: "mm:v1:assignmentsById",
  completionReceiptsQueue: "mm:v1:completionReceiptsQueue",
  coachPilotPreviewTemplate: "mm:v1:coachPilotPreviewTemplate",
  coachPilotPreviewItems: "mm:v1:coachPilotPreviewItems",

  // Coach-side kid tracking pilot (local-only)
  coachKidsById: "mm:v1:coachKidsById",
  kidWeeklyFocusEntries: "mm:v1:kidWeeklyFocusEntries",
  kidCompetitionEntries: "mm:v1:kidCompetitionEntries",
  kidStandingGuidanceByKidId: "mm:v1:kidStandingGuidanceByKidId",
  kidCurrentStateAssessmentByKidId: "mm:v1:kidCurrentStateAssessmentByKidId",
  /** Family-facing Competition lane only: last explicit child choice on this device. */
  familyCompetitionSelectedKidId: "mm:v1:familyCompetitionSelectedKidId",

  /** Parent This Week: last explicitly selected roster athlete (`Kid.id`), local device only. */
  lastAthleteId: "mm:v1:lastAthleteId",

  /** Stable pseudo-profile id for locally stored Coach Share rows (parent device). */
  parentProfileLocalId: "mm:v1:parentProfileLocalId",

  /** Last fetched weekly sync payload per link token (parent read cache). */
  coachWeeklySyncCacheByToken: "mm:v1:coachWeeklySyncCacheByToken",

  /** Coach lane: parent-published competition aggregate artifacts keyed by `sharedAthleteId`. */
  coachCompetitionAggregatesByAthleteId: "mm:v1:coachCompetitionAggregatesByAthleteId",

  /** Coach lane: parent-published canonical competition topology keyed by `sharedAthleteId`. */
  coachCompetitionTopologyByAthleteId: "mm:v1:coachCompetitionTopologyByAthleteId",

  /** Coach lane: annotation-only match overlays keyed by athlete + competition + match lineage. */
  coachMatchBreakdownOverlayByLineage: "mm:v1:coachMatchBreakdownOverlayByLineage",

  /** Parent/coach read cache: remote coach-owned match breakdown artifacts keyed by athlete. */
  coachMatchBreakdownArtifactsByAthleteId: "mm:v1:coachMatchBreakdownArtifactsByAthleteId",

  /** P6-owned per-athlete readiness for authoritative coach analysis hydration. */
  coachAnalysisReadinessByAthleteId: "mm:v1:coachAnalysisReadinessByAthleteId",

  /** Coach lane: parent-published training proof artifacts keyed by `sharedAthleteId`. */
  coachTrainingProofByAthleteId: "mm:v1:coachTrainingProofByAthleteId",

  /** Dev lane: parent last-seen `weekly.updatedAt` per invite token (local only). */
  parentWeeklyLastSeenByToken: "mm:v1:parentWeeklyLastSeenByToken",

  /** Pilot: who this install is for — local only, not server RBAC. */
  deviceRole: "mm:v1:deviceRole",

  /** Parent Summary: local-only athletes (not coach roster). */
  parentAthletes: "mm:v1:parentAthletes",
  /** Parent Summary: last selected athlete id from `parentAthletes`. */
  parentActiveAthleteId: "mm:v1:parentActiveAthleteId",

  /**
   * Parent-local Shared Match Media upload_complete records keyed by athlete +
   * competition + match lineage. Never a delivery URI or verification/publication state.
   */
  sharedMatchMediaUploadsByLineage: "mm:v1:sharedMatchMediaUploadsByLineage",
} as const;
