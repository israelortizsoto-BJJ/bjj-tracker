import { getWorkerCompetitionIdForEntry } from "../../storage/kidCompetitionStore";
import type { KidCompetitionEntry, KidsById } from "../../types/coachKid";

export function athleteIdForFamilyRemoteUpdate(
  existing: KidCompetitionEntry | null,
  kidRowSharedAthleteId: string | undefined,
): string {
  return (existing?.sharedAthleteId ?? kidRowSharedAthleteId)?.trim() ?? "";
}

export function workerCompetitionIdForEntry(
  existing: KidCompetitionEntry | null,
): string {
  return existing ? getWorkerCompetitionIdForEntry(existing) : "";
}

export function rosterSharedAthleteId(kids: KidsById, kidId: string): string | undefined {
  const v = kids[kidId]?.sharedAthleteId?.trim();
  return v || undefined;
}
