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
