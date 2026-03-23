// src/storage/storageKeys.ts.
export const STORAGE_VERSION = 2 as const;

export const StorageKeys = {
  storageVersion: "bjj.storage.version",
  sessions: "bjj.sessions.v2",
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
  /** Family-facing Competition lane only: last explicit child choice on this device. */
  familyCompetitionSelectedKidId: "mm:v1:familyCompetitionSelectedKidId",

  /** Stable pseudo-profile id for locally stored Coach Share rows (parent device). */
  parentProfileLocalId: "mm:v1:parentProfileLocalId",

  /** Last fetched weekly sync payload per link token (parent read cache). */
  coachWeeklySyncCacheByToken: "mm:v1:coachWeeklySyncCacheByToken",
} as const;
