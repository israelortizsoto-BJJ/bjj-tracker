import Constants from "expo-constants";

export type AppVariant = "dev" | "prod";

/**
 * Build-time / native `extra` can surface through different manifest shapes (embedded config
 * vs Expo Updates: `manifest2.extra` and `manifest2.extra.expoClient.extra`). Walk buckets
 * in a stable order so gates don’t depend on a single resolution path.
 */
function readExtraValue(key: string): unknown {
  const fromExpoConfig = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(fromExpoConfig, key)) return fromExpoConfig[key];

  const m2e = (Constants.manifest2 as { extra?: Record<string, unknown> } | null)?.extra;
  if (m2e && Object.prototype.hasOwnProperty.call(m2e, key)) return m2e[key];

  const m2ClientExtra = (m2e as { expoClient?: { extra?: Record<string, unknown> } } | undefined)?.expoClient
    ?.extra;
  if (m2ClientExtra && Object.prototype.hasOwnProperty.call(m2ClientExtra, key)) return m2ClientExtra[key];

  const m1 = ((Constants.manifest as { extra?: Record<string, unknown> } | null)?.extra ?? {}) as Record<
    string,
    unknown
  >;
  if (Object.prototype.hasOwnProperty.call(m1, key)) return m1[key];

  return undefined;
}

/** Normalizes flags from env strings, plist/JSON, or JS `extra` (e.g. number 1 from native). */
function coerceTruthyBuildFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    return t === "1" || t === "true" || t === "yes";
  }
  return false;
}

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
  const raw = readExtraValue("appVariant");

  return raw === "dev" ? "dev" : "prod";
}

export function isDev(): boolean {
  return getAppVariant() === "dev" || isMatMindDevBinary();
}

/**
 * Build-time gate (app.config.ts -> extra.showCoachShareProfileEntry), plus internal dev lane.
 * Set SHOW_COACH_SHARE_PROFILE_ENTRY=1 and/or EXPO_PUBLIC_SHOW_COACH_SHARE_PROFILE_ENTRY=1 at
 * build time for internal TestFlight. The EXPO_PUBLIC_* form is inlined into the JS bundle by
 * Metro and survives manifest / expo-updates resolution quirks.
 * MatMind Dev / dev-bundle installs always see the Profile entry for QA.
 */
export function isCoachShareProfileEntryVisible(): boolean {
  if (coerceTruthyBuildFlag(process.env.EXPO_PUBLIC_SHOW_COACH_SHARE_PROFILE_ENTRY)) {
    return true;
  }
  if (coerceTruthyBuildFlag(readExtraValue("showCoachShareProfileEntry"))) return true;
  return isDev();
}

/**
 * When true, Profile shows pilot role switch and the Developer Settings row.
 * Omit internal flags on feedback builds so testers do not see these entries.
 * Internal builds may set EXPO_PUBLIC_INTERNAL_PROFILE_CONTROLS=1 or extra.internalProfileControls.
 */
export function showInternalProfileControls(): boolean {
  if (isDev()) return true;
  if (coerceTruthyBuildFlag(process.env.EXPO_PUBLIC_INTERNAL_PROFILE_CONTROLS)) return true;
  if (coerceTruthyBuildFlag(readExtraValue("internalProfileControls"))) return true;
  return false;
}
