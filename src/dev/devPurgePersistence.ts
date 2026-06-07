import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  PERSISTENCE_AUDIT_HIGH_RISK_KEYS,
  logAsyncStorageInventory,
} from "./persistenceAudit";

function timestamp(): string {
  return new Date().toISOString();
}

/**
 * DEV-only manual forensic purge. This is intentionally not called by app bootstrap.
 */
export async function purgeHighRiskPersistenceKeys(): Promise<void> {
  if (!__DEV__) {
    console.warn("purgeHighRiskPersistenceKeys is DEV-only and did not run.");
    return;
  }

  const keys = [...PERSISTENCE_AUDIT_HIGH_RISK_KEYS];
  const before = await AsyncStorage.multiGet(keys);
  const removedKeys = before
    .filter(([, value]) => value != null)
    .map(([key]) => key);

  console.log("[PERSISTENCE_PURGE_BEGIN]", {
    removedKeys,
    timestamp: timestamp(),
  });

  await AsyncStorage.multiRemove(keys);

  const after = await AsyncStorage.multiGet(keys);
  const remainingKeys = after
    .filter(([, value]) => value != null)
    .map(([key]) => key);

  console.log("[PERSISTENCE_PURGE_COMPLETE]", {
    removedKeys,
    remainingKeys,
    timestamp: timestamp(),
  });

  await logAsyncStorageInventory("manual_purge_after");
}
