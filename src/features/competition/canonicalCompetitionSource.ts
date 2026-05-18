import {
  getKidCompetitionEntriesWithMatchDetailForKid,
  getKidCompetitionEntriesWithMatchDetailForSharedAthlete,
  type KidCompetitionEntryWithMatchDetail,
} from "@/src/storage/competitionStore";

export async function loadCanonicalAthleteCompetitionSlice(
  athleteId: string,
  linkedKidId: string,
): Promise<KidCompetitionEntryWithMatchDetail[]> {
  const trimmedAthleteId = athleteId.trim();
  if (!trimmedAthleteId) return [];
  const lk = linkedKidId.trim();
  if (lk) {
    return getKidCompetitionEntriesWithMatchDetailForKid(lk);
  }
  return getKidCompetitionEntriesWithMatchDetailForSharedAthlete(trimmedAthleteId);
}

export function canonicalCompetitionSliceFingerprint(
  competitions: readonly KidCompetitionEntryWithMatchDetail[],
): string {
  if (!competitions.length) return "empty";
  return competitions
    .map((c) => `${c.id}:${c.updatedAt}:${c.matches?.length ?? 0}`)
    .sort()
    .join("|");
}
