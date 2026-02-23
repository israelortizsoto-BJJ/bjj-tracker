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

  // v0 -> v1 baseline migration (no-op for now)
  if (currentVersion < 1) {
    // future: add real steps here
  }

  // Always stamp latest version at end
  await AsyncStorage.setItem(StorageKeys.storageVersion, String(STORAGE_VERSION));
}
