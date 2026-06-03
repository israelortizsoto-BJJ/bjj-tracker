import Constants from "expo-constants";

import { getAppVariant } from "./runtime";
import type { DeviceRole } from "../storage/deviceRoleStore";

type SyncBaseUrlTraceRole = DeviceRole | "unknown";

let syncBaseUrlTraceRole: SyncBaseUrlTraceRole = "unknown";

function isExtraValuePresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

/** Same layer order as `runtime.ts`, but empty strings do not block embedded manifest values. */
function readExtraValue(key: string): unknown {
  const m2e = (Constants.manifest2 as { extra?: Record<string, unknown> } | null)?.extra;
  const m2ClientExtra = (m2e as { expoClient?: { extra?: Record<string, unknown> } } | undefined)?.expoClient
    ?.extra;

  const layers: Record<string, unknown>[] = [
    (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>,
    (m2e ?? {}) as Record<string, unknown>,
    (m2ClientExtra ?? {}) as Record<string, unknown>,
    ((Constants.manifest as { extra?: Record<string, unknown> } | null)?.extra ?? {}) as Record<string, unknown>,
  ];

  for (const bucket of layers) {
    if (!Object.prototype.hasOwnProperty.call(bucket, key)) continue;
    const v = bucket[key];
    if (isExtraValuePresent(v)) return v;
  }

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

export function setSyncBaseUrlTraceRole(role: DeviceRole | null): void {
  syncBaseUrlTraceRole = role ?? "unknown";
}

export function logSyncBaseUrlTrace(input: {
  baseUrl: string | null;
  endpoint: string;
  role?: SyncBaseUrlTraceRole;
}): void {
  console.log("[SYNC_BASE_URL_TRACE]", {
    baseUrl: input.baseUrl,
    endpoint: input.endpoint,
    runtimeEnv: getAppVariant(),
    role: input.role ?? syncBaseUrlTraceRole,
  });
}
