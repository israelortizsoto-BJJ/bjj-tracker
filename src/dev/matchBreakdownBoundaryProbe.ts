/**
 * Investigation-only Match Breakdown boundary probes (approved subset: B1, B3, B5, B7).
 * Safe to delete after QA.
 *
 * ## Frozen common schema (every `[MB_BOUNDARY_PROBE]` line)
 *
 * | Field | Type | Required | Source |
 * |-------|------|----------|--------|
 * | `qaRunId` | string \| null | yes | `setMatchBreakdownQaRunId`, `extra.mbQaRunId`, or `EXPO_PUBLIC_MB_QA_RUN_ID` |
 * | `buildId` | string | yes | expo ios.buildNumber / android.versionCode |
 * | `emittedAt` | string (ISO) | yes | probe helper at emit time |
 * | `probeId` | `"B1"` \| `"B3"` \| `"B5"` \| `"B7"` | yes | call site |
 * | `outcome` | `"pass"` \| `"fail"` \| `"skip"` | yes | call site |
 * | `deviceRole` | `"coach"` \| `"parent"` \| `"worker"` \| null | yes | call site |
 * | `traceId` | string \| null | yes | coach overlay forensic trace (null on parent fetch) |
 * | `sharedAthleteId` | string \| null | yes | correlation envelope |
 * | `sharedCompetitionId` | string \| null | yes | correlation envelope |
 * | `matchLineageKey` | string \| null | yes | target match for QA join |
 * | `…` | unknown | no | probe-specific boundary fields |
 *
 * ## QA setup
 *
 * Before a run, set the same `qaRunId` on coach and parent devices, e.g.:
 * `EXPO_PUBLIC_MB_QA_RUN_ID=build82-20260626-a` or `setMatchBreakdownQaRunId("build82-20260626-a")`.
 */

export type MatchBreakdownBoundaryProbeOutcome = "pass" | "fail" | "skip";

/** Approved probe subset for Build 82 investigation. */
export type MatchBreakdownBoundaryProbeId = "B1" | "B3" | "B5" | "B7";

export type MatchBreakdownBoundaryProbeBase = {
  probeId: MatchBreakdownBoundaryProbeId;
  outcome: MatchBreakdownBoundaryProbeOutcome;
  deviceRole: "coach" | "parent" | "worker" | null;
  traceId: string | null;
  sharedAthleteId: string | null;
  sharedCompetitionId: string | null;
  matchLineageKey: string | null;
};

let configuredQaRunId: string | null = null;

/** Set once per QA experiment to group probes across coach + parent devices. */
export function setMatchBreakdownQaRunId(id: string | null): void {
  configuredQaRunId = id?.trim() || null;
}

export function readMatchBreakdownQaRunId(): string | null {
  if (configuredQaRunId) return configuredQaRunId;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require("expo-constants").default as {
      expoConfig?: { extra?: Record<string, unknown> };
    };
    const fromExtra = Constants.expoConfig?.extra?.mbQaRunId;
    if (typeof fromExtra === "string" && fromExtra.trim()) return fromExtra.trim();
  } catch {
    // expo-constants unavailable
  }
  const fromEnv = process.env.EXPO_PUBLIC_MB_QA_RUN_ID;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return null;
}

export function logMatchBreakdownBoundaryProbe(
  payload: MatchBreakdownBoundaryProbeBase & Record<string, unknown>,
): void {
  console.log("[MB_BOUNDARY_PROBE]", {
    qaRunId: readMatchBreakdownQaRunId(),
    buildId: readMatchBreakdownProbeBuildId(),
    emittedAt: new Date().toISOString(),
    ...payload,
  });
}

export function readMatchBreakdownProbeBuildId(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require("expo-constants").default as {
      expoConfig?: {
        ios?: { buildNumber?: string | number };
        android?: { versionCode?: string | number };
      };
    };
    const expoConfig = Constants.expoConfig;
    const iosBuild = expoConfig?.ios?.buildNumber;
    const androidBuild = expoConfig?.android?.versionCode;
    if (iosBuild != null && String(iosBuild).trim()) return String(iosBuild);
    if (androidBuild != null && String(androidBuild).trim()) return String(androidBuild);
  } catch {
    // expo-constants unavailable (tests, non-RN runtime)
  }
  return "unknown";
}
