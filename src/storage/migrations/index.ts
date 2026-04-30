// app/storage/migrations/index.ts

import AsyncStorage from "@react-native-async-storage/async-storage";

import { SUMMARY_IDENTITY_ACCOUNT_SCOPE } from "../../types/summaryIdentityScope";
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

  // v2 -> v3: move legacy `summaryIdentity*` on profile JSON into `summaryIdentityByScope.__account__` only.
  if (currentVersion < 3) {
    const profileRaw = await AsyncStorage.getItem(StorageKeys.profile);
    if (profileRaw) {
      try {
        const parsed = JSON.parse(profileRaw) as Record<string, unknown>;
        const rawMap = parsed.summaryIdentityByScope;
        const scopeMapShell =
          rawMap &&
          typeof rawMap === "object" &&
          !Array.isArray(rawMap)
            ? ({ ...(rawMap as Record<string, unknown>) } as Record<string, unknown>)
            : {};

        const accountBucketPresent = scopeMapShell[SUMMARY_IDENTITY_ACCOUNT_SCOPE] !== undefined;

        const legacyInputs = parsed.summaryIdentityInputs;
        const legacyMode = parsed.summaryIdentityMode;
        const hasLegacyIdentity = legacyInputs !== undefined || legacyMode !== undefined;

        if (!accountBucketPresent && hasLegacyIdentity) {
          const nextAccount: Record<string, unknown> = {};
          if (legacyInputs !== undefined) nextAccount.summaryIdentityInputs = legacyInputs;
          if (legacyMode !== undefined) nextAccount.summaryIdentityMode = legacyMode;

          scopeMapShell[SUMMARY_IDENTITY_ACCOUNT_SCOPE] = nextAccount;
          parsed.summaryIdentityByScope = scopeMapShell;

          await AsyncStorage.setItem(StorageKeys.profile, JSON.stringify(parsed));
        }
      } catch {
        // Ignore corrupt profile blob; stamping version still proceeds.
      }
    }
  }

  // Always stamp latest version at end
  await AsyncStorage.setItem(StorageKeys.storageVersion, String(STORAGE_VERSION));
}
