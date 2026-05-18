import type { KidCompetitionEntryWithMatchDetail } from "@/src/storage/competitionStore";

export function devLogCompetitionSummaryTrace(_payload: Record<string, unknown>): void {}

export function devLogCompetitionSourceParity(_payload: Record<string, unknown>): void {}

export type CompeteTabCompetitionDevSnapshot = {
  athleteId: string;
  linkedKidId: string | null;
  visibleCompetitionCount: number;
  visibleMatchCount: number;
  latestCompetitionId: string | null;
  dataPipeline: string;
};

export function devGetCompeteTabCompetitionSnapshot(): CompeteTabCompetitionDevSnapshot | null {
  return null;
}

export function devPickLatestCompetitionEntryLikeComputeSignals<
  T extends { eventDate: string; createdAt: string },
>(_competitions: readonly T[]): T | null {
  return null;
}

export function devCompetitionSourceMatchTotal(
  competitions: readonly KidCompetitionEntryWithMatchDetail[],
): number {
  let total = 0;
  for (const c of competitions) {
    if (Array.isArray(c.matches)) total += c.matches.length;
  }
  return total;
}
