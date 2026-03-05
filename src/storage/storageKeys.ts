// app/storage/storageKeys.ts

export const STORAGE_VERSION = 2 as const;

export const StorageKeys = {
  storageVersion: "bjj.storage.version",
  sessions: "bjj.sessions.v2",
  profile: "bjj.profile.v2",
} as const;