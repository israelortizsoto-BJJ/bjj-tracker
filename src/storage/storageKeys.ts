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
} as const;