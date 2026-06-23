import type { AuthoritySnapshotSourceTrigger } from "../identity/types";
import {
  getKidCompetitionEntriesWithMatchDetailForSharedAthlete,
  type KidCompetitionEntryWithMatchDetail,
} from "../storage/competitionStore";
import { getCoachMatchBreakdownArtifactSet } from "../storage/coachMatchBreakdownArtifactStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../types/coachWeeklySync";

import type { CompetitionSnapshot } from "./competitionSnapshotContract";
import { projectCompetitionSnapshot } from "./projectCompetitionSnapshot";

export type CaptureCompetitionSnapshotOptions = {
  deviceRole: "parent" | "coach";
  sharedAthleteId: string;
  sourceTrigger?: AuthoritySnapshotSourceTrigger;
  /** Test hook — defaults to `new Date().toISOString()`. */
  capturedAt?: string;
  getEntriesWithMatchDetail?: (
    sharedAthleteId: string,
  ) => Promise<KidCompetitionEntryWithMatchDetail[]>;
  getArtifactSet?: (
    sharedAthleteId: string,
  ) => Promise<SyncedCoachMatchBreakdownArtifactSet | null>;
};

/**
 * Read-only local snapshot of the coach-breakdown attachment path.
 * Does not publish, reconcile, hydrate worker sessions, or mutate competition state.
 */
export async function captureCompetitionSnapshot(
  options: CaptureCompetitionSnapshotOptions,
): Promise<CompetitionSnapshot> {
  const sharedAthleteId = options.sharedAthleteId.trim();
  const readEntries =
    options.getEntriesWithMatchDetail ?? getKidCompetitionEntriesWithMatchDetailForSharedAthlete;
  const readArtifactSet = options.getArtifactSet ?? getCoachMatchBreakdownArtifactSet;

  const [entries, artifactSet] = await Promise.all([
    sharedAthleteId ? readEntries(sharedAthleteId) : Promise.resolve([]),
    sharedAthleteId ? readArtifactSet(sharedAthleteId) : Promise.resolve(null),
  ]);

  return projectCompetitionSnapshot({
    capturedAt: options.capturedAt,
    deviceRole: options.deviceRole,
    sharedAthleteId,
    artifactSet,
    competitions: entries.map((entry) => ({
      sharedCompetitionId: entry.sharedCompetitionId ?? "",
      entryId: entry.id,
      matches: entry.matches,
    })),
  });
}
