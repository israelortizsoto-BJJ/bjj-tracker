import type { KidsById } from "../types/coachKid";

export type AthleteLineageTracePayload = Record<string, unknown>;

export function logAthleteLineageTrace(_payload: AthleteLineageTracePayload): void {}

export function logAthleteLineageTraceFromKidsById(
  _payload: AthleteLineageTracePayload & { kidsById?: KidsById },
): void {}

export type WeeklyKeyNameMapping = {
  sharedAthleteId: string;
  athleteName: string | null;
};

export function duplicateSharedIdsByAthleteName(
  _mappings: readonly WeeklyKeyNameMapping[],
): Record<string, string[]> {
  return {};
}
