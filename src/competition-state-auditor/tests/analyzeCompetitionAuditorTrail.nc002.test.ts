import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeCompetitionAuditorSnapshots,
  formatCompetitionAuditorReadout,
} from "../analyzeCompetitionAuditorTrail";
import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  type CompetitionStateSnapshot,
  type ParentCanonicalSnapshot,
  type ParentPublishSnapshot,
  type WorkerPersistSnapshot,
} from "../competitionStateAuditorContract";
import { projectCompetitionDomainBlockFromIds } from "../projectCompetitionDomainBlock";

const ATHLETE = "athlete_nc_002";
const TX = "tx-nc-002";
const CAPTURED_AT = "2026-06-25T12:00:00.000Z";

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `comp_${index + 1}`);
}

function parentCanonical(count: number): ParentCanonicalSnapshot {
  const domain = projectCompetitionDomainBlockFromIds(ids(count));
  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "parent_canonical",
    transitionId: TX,
    capturedAt: CAPTURED_AT,
    deviceRole: "parent",
    sharedAthleteId: ATHLETE,
    generation: count,
    domain,
    localOnlyCompetitionIds: [],
  };
}

function parentPublish(count: number, lane: ParentPublishSnapshot["publishLane"]): ParentPublishSnapshot {
  const domain = projectCompetitionDomainBlockFromIds(ids(count));
  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "parent_publish",
    transitionId: TX,
    capturedAt: CAPTURED_AT,
    deviceRole: "parent",
    sharedAthleteId: ATHLETE,
    publishLane: lane,
    publishOutcome: "ok",
    domain,
    operationSharedCompetitionIds: domain.sharedCompetitionIds,
  };
}

function workerPersist(count: number): WorkerPersistSnapshot {
  const domain = projectCompetitionDomainBlockFromIds(ids(count));
  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "worker_persist",
    transitionId: TX,
    parentTransitionId: TX,
    capturedAt: CAPTURED_AT,
    deviceRole: "worker",
    sharedAthleteId: ATHLETE,
    persistLane: "topology_put",
    domain,
    beforeCompetitionCount: count - 1,
    afterCompetitionCount: count,
    sessionCompetitionCount: count,
  };
}

describe("analyzeCompetitionAuditorSnapshots NC-002", () => {
  it("detects publish divergence when parent has 5 and publish carries 4", () => {
    const snapshots: CompetitionStateSnapshot[] = [
      parentCanonical(5),
      parentPublish(4, "topology_put"),
      workerPersist(4),
    ];
    const analysis = analyzeCompetitionAuditorSnapshots({
      snapshots,
      sharedAthleteId: ATHLETE,
      transitionId: TX,
      analyzedAt: CAPTURED_AT,
    });

    assert.equal(analysis.parentContainedFive, true);
    assert.equal(analysis.parentPublishedFive, false);
    assert.equal(analysis.workerPersistedFive, false);
    assert.equal(analysis.firstDivergingBoundary, "parent_canonical→parent_publish");
    assert.equal(analysis.diffs[0]?.firstDivergence?.missingIds.length, 1);
    assert.match(formatCompetitionAuditorReadout(analysis), /parent_contained_five=true/);
    assert.match(formatCompetitionAuditorReadout(analysis), /parent_published_five=false/);
    assert.match(formatCompetitionAuditorReadout(analysis), /first_diverging_boundary=parent_canonical→parent_publish/);
  });

  it("detects worker persist divergence when publish has 5 and worker stores 4", () => {
    const snapshots: CompetitionStateSnapshot[] = [
      parentCanonical(5),
      parentPublish(5, "topology_put"),
      workerPersist(4),
    ];
    const analysis = analyzeCompetitionAuditorSnapshots({
      snapshots,
      sharedAthleteId: ATHLETE,
      transitionId: TX,
      analyzedAt: CAPTURED_AT,
    });

    assert.equal(analysis.parentContainedFive, true);
    assert.equal(analysis.parentPublishedFive, true);
    assert.equal(analysis.workerPersistedFive, false);
    assert.equal(analysis.firstDivergingBoundary, "parent_publish→worker_persist");
    assert.equal(analysis.diffs[1]?.firstDivergence?.missingIds[0], "comp_5");
  });

  it("reports aligned chain when all three boundaries carry 5", () => {
    const snapshots: CompetitionStateSnapshot[] = [
      parentCanonical(5),
      parentPublish(5, "topology_put"),
      workerPersist(5),
    ];
    const analysis = analyzeCompetitionAuditorSnapshots({
      snapshots,
      sharedAthleteId: ATHLETE,
      transitionId: TX,
      analyzedAt: CAPTURED_AT,
    });

    assert.equal(analysis.parentContainedFive, true);
    assert.equal(analysis.parentPublishedFive, true);
    assert.equal(analysis.workerPersistedFive, true);
    assert.equal(analysis.firstDivergingBoundary, "none");
  });
});
