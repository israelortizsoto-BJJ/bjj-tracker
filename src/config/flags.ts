import { isDev } from "./runtime";

export type DevFlagKey =
  | "enableHiddenTabs"
  | "enableCoachShareScaffold"
  | "enableDebugTools";

export type DevFlags = Record<DevFlagKey, boolean>;

export const DEFAULT_DEV_FLAGS: DevFlags = {
  enableHiddenTabs: false,
  enableCoachShareScaffold: false,
  enableDebugTools: false,
};

export const DEV_FLAGS_STORAGE_KEY = "mm:v1:devFlags";

/**
 * Hard guard: in prod, flags are always OFF.
 * In dev, flags can be enabled via Dev Settings UI (stored in AsyncStorage later).
 */
export function applyDevGuard(flags: DevFlags): DevFlags {
  return isDev() ? flags : DEFAULT_DEV_FLAGS;
}
