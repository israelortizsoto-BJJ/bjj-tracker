import type { KidsById } from "../types/coachKid";
import type { ParentAthlete } from "../storage/athleteStore";
import type { DeviceRole } from "../storage/deviceRoleStore";
import {
  duplicateSharedIdsByAthleteName as duplicateSharedIdsByAthleteNameImpl,
  runLineageIntegrityScan,
  type LineageIntegrityScanInput,
  type WeeklyKeyNameMapping,
  type WriterSessionAthletesSlice,
} from "./lineageIntegrityDetection";

export type { WeeklyKeyNameMapping };

export type AthleteLineageTracePayload = Record<string, unknown> & {
  operation?: string;
  source?: string;
  route?: string;
  athleteName?: string | null;
  sharedAthleteId?: string | null;
  previousSharedAthleteId?: string | null;
  linkedKidId?: string | null;
  token?: string | null;
  role?: DeviceRole | null;
  activeOperatingAthleteId?: string | null;
  parentAthletes?: readonly ParentAthlete[];
  operatingAthleteRoster?: readonly ParentAthlete[];
  writerSessions?: readonly WriterSessionAthletesSlice[];
};

let traceScanContext: Omit<LineageIntegrityScanInput, "route"> = {};

export function setLineageIntegrityTraceContext(
  ctx: Omit<LineageIntegrityScanInput, "route">,
): void {
  if (!__DEV__) return;
  traceScanContext = { ...traceScanContext, ...ctx };
}

export function logAthleteLineageTrace(payload: AthleteLineageTracePayload): void {
  if (!__DEV__) return;
  console.log("[ATHLETE LINEAGE TRACE]", payload);
  runLineageIntegrityScan({
    ...traceScanContext,
    route: typeof payload.route === "string" ? payload.route : "athleteLineageTrace",
    activeOperatingAthleteId:
      traceScanContext.activeOperatingAthleteId ??
      (typeof payload.sharedAthleteId === "string" ? payload.sharedAthleteId : null),
    role: traceScanContext.role ?? (payload.role as DeviceRole | null | undefined),
    kidsById: traceScanContext.kidsById,
    parentAthletes: traceScanContext.parentAthletes,
    operatingAthleteRoster: traceScanContext.operatingAthleteRoster,
    writerSessions: traceScanContext.writerSessions ?? payload.writerSessions,
  });
}

export function logAthleteLineageTraceFromKidsById(
  payload: AthleteLineageTracePayload & { kidsById?: KidsById },
): void {
  if (!__DEV__) return;
  const kidsById = payload.kidsById;
  if (kidsById) {
    traceScanContext = { ...traceScanContext, kidsById };
  }
  logAthleteLineageTrace(payload);
}

export function duplicateSharedIdsByAthleteName(
  mappings: readonly WeeklyKeyNameMapping[],
): Record<string, string[]> {
  return duplicateSharedIdsByAthleteNameImpl(mappings);
}
