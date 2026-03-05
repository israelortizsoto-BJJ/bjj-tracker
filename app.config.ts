import appJson from "./app.json";
import type { ExpoConfig } from "expo/config";

const base = appJson.expo as ExpoConfig;
const APP_VARIANT = process.env.APP_VARIANT ?? "prod";
const isDev = APP_VARIANT === "dev";

const PROD_BUNDLE_ID = "com.ortizdigitalstudio.matmind";
const DEV_BUNDLE_ID = "com.ortizdigitalstudio.matmind.dev";

const PROD_NAME = (base.name ?? "MatMind Jiu Jitsu") as string;

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
  },
});
