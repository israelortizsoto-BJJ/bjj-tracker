// app/storage/migrations/index.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_VERSION, StorageKeys } from "../storageKeys";

/**
 * Ensure local storage schema is upgraded to STORAGE_VERSION.
 * Safe to call on every app start.
 */
export async function ensureStorageUpToDate(): Promise<void> {
  const raw = await AsyncStorage.getItem(StorageKeys.storageVersion);
  const currentVersion = raw ? Number(raw) : 0;

  // If corrupted, reset to 0 and continue.
  if (raw !== null && !Number.isFinite(currentVersion)) {
    await AsyncStorage.setItem(StorageKeys.storageVersion, "0");
  }

  // v1 -> v2: rescue legacy keys into contract keys (no overwrite)
  if (currentVersion < 2) {
    // Sessions: only copy forward if new key is empty
    const newSessions = await AsyncStorage.getItem(StorageKeys.sessions);
    if (!newSessions) {
      const legacyCandidates = ["bjj.sessions.v1", "bjj_sessions_v1"];

      for (const legacyKey of legacyCandidates) {
        const legacy = await AsyncStorage.getItem(legacyKey);
        if (legacy) {
          await AsyncStorage.setItem(StorageKeys.sessions, legacy);
          break;
        }
      }
    }

    // Profile: only copy forward if new key is empty
    const newProfile = await AsyncStorage.getItem(StorageKeys.profile);
    if (!newProfile) {
      const legacyProfileCandidates = ["bjj_profile_v1"];

      for (const legacyKey of legacyProfileCandidates) {
        const legacy = await AsyncStorage.getItem(legacyKey);
        if (legacy) {
          await AsyncStorage.setItem(StorageKeys.profile, legacy);
          break;
        }
      }
    }
  }

  // Always stamp latest version at end
  await AsyncStorage.setItem(StorageKeys.storageVersion, String(STORAGE_VERSION));
}
