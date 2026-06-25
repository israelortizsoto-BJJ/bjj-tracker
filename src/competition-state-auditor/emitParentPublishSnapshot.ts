import { getKidCompetitionEntriesWithMatchDetailForSharedAthlete } from "../storage/competitionStore";
import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  type CompetitionDomainBlock,
  type ParentPublishLane,
  type ParentPublishSnapshot,
  type PublishOutcome,
} from "./competitionStateAuditorContract";
import { persistCompetitionStateSnapshot } from "./competitionStateAuditorRing";
import {
  projectCompetitionDomainBlock,
  projectCompetitionDomainBlockFromIds,
  type CompetitionDomainBlockInputRow,
} from "./projectCompetitionDomainBlock";

export type EmitParentPublishSnapshotOptions = {
  sharedAthleteId: string;
  transitionId: string;
  publishLane: ParentPublishLane;
  publishOutcome: PublishOutcome;
  skipReason?: string;
  httpStatus?: number | null;
  linkTokenTail?: string;
  generation?: string;
  operationSharedCompetitionIds?: readonly string[];
  domainRows?: readonly CompetitionDomainBlockInputRow[];
  domain?: CompetitionDomainBlock;
  capturedAt?: string;
  readCanonicalEntries?: typeof getKidCompetitionEntriesWithMatchDetailForSharedAthlete;
};

async function resolveDomain(
  options: EmitParentPublishSnapshotOptions,
): Promise<CompetitionDomainBlock> {
  if (options.domain) return options.domain;
  if (options.domainRows) return projectCompetitionDomainBlock(options.domainRows);
  if (options.operationSharedCompetitionIds?.length) {
    return projectCompetitionDomainBlockFromIds(options.operationSharedCompetitionIds);
  }
  const readCanonical =
    options.readCanonicalEntries ?? getKidCompetitionEntriesWithMatchDetailForSharedAthlete;
  const entries = await readCanonical(options.sharedAthleteId);
  return projectCompetitionDomainBlock(
    entries.map((entry) => ({
      sharedCompetitionId: entry.sharedCompetitionId ?? "",
      entryId: entry.id,
      shellUpdatedAt: entry.updatedAt ?? null,
      matches: entry.matches ?? [],
    })),
  );
}

export async function buildParentPublishSnapshot(
  options: EmitParentPublishSnapshotOptions,
): Promise<ParentPublishSnapshot | null> {
  const sharedAthleteId = options.sharedAthleteId.trim();
  const transitionId = options.transitionId.trim();
  if (!sharedAthleteId || !transitionId) return null;

  const domain = await resolveDomain(options);
  const operationSharedCompetitionIds = [
    ...new Set(
      (options.operationSharedCompetitionIds ?? domain.sharedCompetitionIds)
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "parent_publish",
    transitionId,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    deviceRole: "parent",
    sharedAthleteId,
    ...(options.linkTokenTail ? { linkTokenTail: options.linkTokenTail } : {}),
    publishLane: options.publishLane,
    publishOutcome: options.publishOutcome,
    ...(options.skipReason ? { skipReason: options.skipReason } : {}),
    ...(options.httpStatus !== undefined ? { httpStatus: options.httpStatus } : {}),
    ...(options.generation ? { generation: options.generation } : {}),
    domain,
    operationSharedCompetitionIds,
  };
}

export async function emitParentPublishSnapshot(
  options: EmitParentPublishSnapshotOptions,
): Promise<void> {
  const snapshot = await buildParentPublishSnapshot(options);
  if (snapshot) persistCompetitionStateSnapshot(snapshot);
}

export function scheduleParentPublishSnapshot(options: EmitParentPublishSnapshotOptions): void {
  void emitParentPublishSnapshot(options);
}
