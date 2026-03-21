import Constants from "expo-constants";

export type AppVariant = "dev" | "prod";

/**
 * MatMind Dev native targets use a `.dev` bundle id / package suffix (see app.config.ts).
 * When `extra.appVariant` is missing at runtime (some dev-client / manifest paths), this
 * still identifies the internal dev binary so Profile can expose Dev Settings / Coach Share.
 */
function isMatMindDevBinary(): boolean {
  const iosId = Constants.expoConfig?.ios?.bundleIdentifier;
  const androidPkg = Constants.expoConfig?.android?.package;
  return (
    (typeof iosId === "string" && iosId.endsWith(".dev")) ||
    (typeof androidPkg === "string" && androidPkg.endsWith(".dev"))
  );
}

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
  return getAppVariant() === "dev" || isMatMindDevBinary();
}

/**
 * Build-time gate (app.config.ts -> extra.showCoachShareProfileEntry), plus internal dev lane.
 * Set SHOW_COACH_SHARE_PROFILE_ENTRY=1 at build time for internal TestFlight, etc.
 * MatMind Dev / dev-bundle installs always see the Profile entry for QA.
 */
export function isCoachShareProfileEntryVisible(): boolean {
  const raw =
    (Constants.expoConfig?.extra as any)?.showCoachShareProfileEntry ??
    (Constants.manifest2?.extra as any)?.showCoachShareProfileEntry ??
    (Constants.manifest as any)?.extra?.showCoachShareProfileEntry;

  if (raw === true || raw === "1") return true;
  return isDev();
}
