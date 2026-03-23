import Constants from "expo-constants";

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

/**
 * Base URL for the narrow weekly-sync worker (no trailing slash), e.g.
 * `https://matmind-coach-sync.<account>.workers.dev`
 */
export function getCoachSyncApiBaseUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_COACH_SYNC_BASE_URL;
  if (typeof fromEnv === "string") {
    const t = fromEnv.trim().replace(/\/+$/, "");
    if (t) return t;
  }
  const fromExtra = readExtraValue("coachSyncBaseUrl");
  if (typeof fromExtra === "string") {
    const t = fromExtra.trim().replace(/\/+$/, "");
    if (t) return t;
  }
  return null;
}

export function isCoachSyncConfigured(): boolean {
  return getCoachSyncApiBaseUrl() !== null;
}
