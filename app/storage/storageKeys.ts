// app/storage/storageKeys.ts
/**
 * Storage contract for AsyncStorage.
 * Centralizing keys prevents typos and drift.
 * Versioning enables safe upgrades.
 */

export const STORAGE_VERSION = 2;

export const StorageKeys = {
  // Version key
  storageVersion: "mm_storage_version",

  // Core entities
  profile: "mm_profile",
  sessions: "mm_sessions",

  // Future
  settings: "mm_settings",
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
