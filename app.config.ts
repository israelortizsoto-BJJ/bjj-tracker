import appJson from "./app.json";
import type { ExpoConfig } from "expo/config";

const base = appJson.expo as ExpoConfig;
const APP_VARIANT = process.env.APP_VARIANT ?? "prod";
const isDev = APP_VARIANT === "dev";

const PROD_BUNDLE_ID = "com.ortizdigitalstudio.matmind";
const DEV_BUNDLE_ID = "com.ortizdigitalstudio.matmind.dev";

export default (): ExpoConfig => ({
  ...base,
  name: isDev ? "MatMind Dev" : (base.name ?? "MatMind Jiu Jitsu"),
  scheme: isDev ? "matmind-dev" : (base.scheme ?? "matmind"),
  ios: {
    ...base.ios,
    bundleIdentifier: isDev
      ? DEV_BUNDLE_ID
      : (base.ios?.bundleIdentifier ?? PROD_BUNDLE_ID),
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
