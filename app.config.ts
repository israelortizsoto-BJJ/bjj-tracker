import appJson from "./app.json" assert { type: "json" };
import type { ExpoConfig } from "expo/config";

const base = appJson.expo as ExpoConfig;

/** Used at config-eval time (Node). Prefer APP_VARIANT / EXPO_PUBLIC_APP_VARIANT; if unset, treat `NODE_ENV === "development"` as dev so `expo start` matches Metro `__DEV__` semantics. */
function resolveAppVariant(): "dev" | "prod" {
  const raw = (process.env.APP_VARIANT ?? process.env.EXPO_PUBLIC_APP_VARIANT ?? "").trim().toLowerCase();
  if (raw === "dev") return "dev";
  if (raw === "prod") return "prod";
  if (process.env.NODE_ENV === "development") return "dev";
  return "prod";
}

const APP_VARIANT = resolveAppVariant();
const isDev = APP_VARIANT === "dev";

const PROD_BUNDLE_ID = "com.ortizdigitalstudio.matmind";
const DEV_BUNDLE_ID = "com.ortizdigitalstudio.matmind.dev";

const PROD_NAME = (base.name ?? "MatMind Jiu Jitsu") as string;

const showCoachShareProfileEntry =
  process.env.SHOW_COACH_SHARE_PROFILE_ENTRY === "1" ||
  process.env.EXPO_PUBLIC_SHOW_COACH_SHARE_PROFILE_ENTRY === "1";

/** Pilot / internal builds: Profile Dev Settings + role switch (see showInternalProfileControls). */
const internalProfileControls =
  process.env.EXPO_PUBLIC_INTERNAL_PROFILE_CONTROLS === "1";

const coachSyncBaseUrl = (process.env.EXPO_PUBLIC_COACH_SYNC_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

export default (): ExpoConfig => ({
  ...base,

  // Keep target naming stable across variants
  name: PROD_NAME,

  // Schemes CAN differ safely
  scheme: isDev ? "matmind-dev" : (base.scheme ?? "matmind"),

  ios: {
    ...base.ios,
    bundleIdentifier: isDev
      ? DEV_BUNDLE_ID
      : (base.ios?.bundleIdentifier ?? PROD_BUNDLE_ID),
    infoPlist: {
      ...(base.ios?.infoPlist ?? {}),
      CFBundleDisplayName: isDev ? "MatMind Dev" : PROD_NAME,
    },
  },

  android: {
    ...base.android,
    package: isDev
      ? `${base.android?.package ?? PROD_BUNDLE_ID}.dev`
      : (base.android?.package ?? PROD_BUNDLE_ID),
  },

  extra: {
    ...base.extra,
    appVariant: APP_VARIANT,
    internalProfileControls,
    showCoachShareProfileEntry,
    // Omit when unset so dev-client + Metro does not overwrite embedded EAS `extra` with "".
    ...(coachSyncBaseUrl ? { coachSyncBaseUrl } : {}),
  },
});
