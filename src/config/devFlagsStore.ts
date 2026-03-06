import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_DEV_FLAGS,
  DEV_FLAGS_STORAGE_KEY,
  type DevFlags,
  applyDevGuard,
} from "./flags";

export async function loadDevFlags(): Promise<DevFlags> {
  try {
    const raw = await AsyncStorage.getItem(DEV_FLAGS_STORAGE_KEY);
    if (!raw) return applyDevGuard(DEFAULT_DEV_FLAGS);
    const parsed = JSON.parse(raw) as Partial<DevFlags>;
    return applyDevGuard({ ...DEFAULT_DEV_FLAGS, ...parsed } as DevFlags);
  } catch {
    return applyDevGuard(DEFAULT_DEV_FLAGS);
  }
}

export async function saveDevFlags(flags: DevFlags): Promise<void> {
  await AsyncStorage.setItem(DEV_FLAGS_STORAGE_KEY, JSON.stringify(flags));
}
