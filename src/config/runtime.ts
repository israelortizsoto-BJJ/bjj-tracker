import Constants from "expo-constants";

export type AppVariant = "dev" | "prod";

/**
 * Reads the app variant from app.config.ts -> extra.appVariant
 */
export function getAppVariant(): AppVariant {
  const raw =
    (Constants.expoConfig?.extra as any)?.appVariant ??
    (Constants.manifest2?.extra as any)?.appVariant ??
    (Constants.manifest as any)?.extra?.appVariant;

  return raw === "dev" ? "dev" : "prod";
}

export function isDev(): boolean {
  return getAppVariant() === "dev";
}

/**
 * Build-time gate (app.config.ts -> extra.showCoachShareProfileEntry).
 * Set SHOW_COACH_SHARE_PROFILE_ENTRY=1 at build time for internal TestFlight, etc.
 */
export function isCoachShareProfileEntryVisible(): boolean {
  const raw =
    (Constants.expoConfig?.extra as any)?.showCoachShareProfileEntry ??
    (Constants.manifest2?.extra as any)?.showCoachShareProfileEntry ??
    (Constants.manifest as any)?.extra?.showCoachShareProfileEntry;

  return raw === true || raw === "1";
}
