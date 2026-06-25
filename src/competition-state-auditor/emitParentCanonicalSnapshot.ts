import { getCompetitionVersion } from "../storage/kidCompetitionStore";
import {
  getKidCompetitionEntriesWithMatchDetailForSharedAthlete,
  type KidCompetitionEntryWithMatchDetail,
} from "../storage/competitionStore";
import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  type ParentCanonicalSnapshot,
} from "./competitionStateAuditorContract";
import { persistCompetitionStateSnapshot } from "./competitionStateAuditorRing";
import { projectCompetitionDomainBlock } from "./projectCompetitionDomainBlock";

export type EmitParentCanonicalSnapshotOptions = {
  sharedAthleteId: string;
  transitionId: string;
  capturedAt?: string;
  readEntries?: (sharedAthleteId: string) => Promise<KidCompetitionEntryWithMatchDetail[]>;
};

function mapEntries(entries: readonly KidCompetitionEntryWithMatchDetail[]) {
  return entries.map((entry) => ({
    sharedCompetitionId: entry.sharedCompetitionId ?? "",
    entryId: entry.id,
    shellUpdatedAt: entry.updatedAt ?? null,
    matches: entry.matches ?? [],
  }));
}

export async function buildParentCanonicalSnapshot(
  options: EmitParentCanonicalSnapshotOptions,
): Promise<ParentCanonicalSnapshot | null> {
  const sharedAthleteId = options.sharedAthleteId.trim();
  if (!sharedAthleteId || !options.transitionId.trim()) return null;

  const readEntries =
    options.readEntries ?? getKidCompetitionEntriesWithMatchDetailForSharedAthlete;
  const entries = await readEntries(sharedAthleteId);
  const rows = mapEntries(entries);
  const domain = projectCompetitionDomainBlock(rows);
  const localOnlyCompetitionIds = rows
    .filter((row) => !row.sharedCompetitionId.trim())
    .map((row) => row.entryId)
    .filter((id): id is string => Boolean(id));

  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "parent_canonical",
    transitionId: options.transitionId,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    deviceRole: "parent",
    sharedAthleteId,
    generation: getCompetitionVersion(),
    domain,
    localOnlyCompetitionIds,
  };
}

export async function emitParentCanonicalSnapshot(
  options: EmitParentCanonicalSnapshotOptions,
): Promise<void> {
  const snapshot = await buildParentCanonicalSnapshot(options);
  if (snapshot) persistCompetitionStateSnapshot(snapshot);
}

/** Fire-and-forget S1 emission. */
export function scheduleParentCanonicalSnapshot(
  options: EmitParentCanonicalSnapshotOptions,
): void {
  void emitParentCanonicalSnapshot(options);
}
