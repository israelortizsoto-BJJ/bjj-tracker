import { captureWorkerPersistSnapshotFromResponse } from "./captureWorkerPersistSnapshotFromHeader";
import { MATMIND_TRANSITION_HEADER } from "./competitionStateAuditorContract";
import { scheduleParentPublishSnapshot } from "./emitParentPublishSnapshot";
import type { CompetitionDomainBlockInputRow } from "./projectCompetitionDomainBlock";
import type { ParentPublishLane, PublishOutcome } from "./competitionStateAuditorContract";

export function competitionAuditRequestHeaders(
  transitionId?: string,
): Record<string, string> {
  const trimmed = transitionId?.trim();
  return trimmed ? { [MATMIND_TRANSITION_HEADER]: trimmed } : {};
}

export function recordParentPublishAudit(input: {
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
}): void {
  scheduleParentPublishSnapshot(input);
}

export function recordCoachSyncCompetitionResponse(input: {
  response: Pick<Response, "headers">;
  sharedAthleteId: string;
  transitionId: string;
  publishLane: ParentPublishLane;
  publishOutcome: PublishOutcome;
  httpStatus: number;
  linkTokenTail?: string;
  operationSharedCompetitionIds?: readonly string[];
  domainRows?: readonly CompetitionDomainBlockInputRow[];
  generation?: string;
  skipReason?: string;
}): void {
  recordParentPublishAudit({
    sharedAthleteId: input.sharedAthleteId,
    transitionId: input.transitionId,
    publishLane: input.publishLane,
    publishOutcome: input.publishOutcome,
    httpStatus: input.httpStatus,
    linkTokenTail: input.linkTokenTail,
    operationSharedCompetitionIds: input.operationSharedCompetitionIds,
    domainRows: input.domainRows,
    generation: input.generation,
    skipReason: input.skipReason,
  });
  if (input.publishOutcome === "ok") {
    captureWorkerPersistSnapshotFromResponse(input.response);
  }
}
