import AsyncStorage from "@react-native-async-storage/async-storage";

import { logKeyRead, logKeyWrite } from "../dev/persistenceAudit";
import { StorageKeys } from "./storageKeys";

export type DeviceRole = "coach" | "parent";

export async function getDeviceRole(): Promise<DeviceRole | null> {
  const raw = await AsyncStorage.getItem(StorageKeys.deviceRole);
  logKeyRead({
    key: StorageKeys.deviceRole,
    raw,
    source: "deviceRoleStore.getDeviceRole",
  });
  if (raw === "coach" || raw === "parent") return raw;
  return null;
}

export async function persistDeviceRole(role: DeviceRole): Promise<void> {
  logKeyWrite({
    key: StorageKeys.deviceRole,
    raw: role,
    source: "deviceRoleStore.persistDeviceRole",
  });
  await AsyncStorage.setItem(StorageKeys.deviceRole, role);
}
