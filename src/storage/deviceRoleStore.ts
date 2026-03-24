import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "./storageKeys";

export type DeviceRole = "coach" | "parent";

export async function getDeviceRole(): Promise<DeviceRole | null> {
  const raw = await AsyncStorage.getItem(StorageKeys.deviceRole);
  if (raw === "coach" || raw === "parent") return raw;
  return null;
}

export async function persistDeviceRole(role: DeviceRole): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.deviceRole, role);
}
