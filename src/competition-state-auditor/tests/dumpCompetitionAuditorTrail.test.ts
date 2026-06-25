import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  type ParentCanonicalSnapshot,
  type ParentPublishSnapshot,
  type WorkerPersistSnapshot,
} from "../competitionStateAuditorContract";
import { projectCompetitionDomainBlockFromIds } from "../projectCompetitionDomainBlock";
import { selectPhaseABoundarySnapshots } from "../selectPhaseABoundarySnapshots";

const ATHLETE = "athlete_dump";
const TX = "tx-dump";

function canonical(count: number): ParentCanonicalSnapshot {
  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "parent_canonical",
    transitionId: TX,
    capturedAt: "2026-06-25T12:00:00.000Z",
    deviceRole: "parent",
    sharedAthleteId: ATHLETE,
    generation: count,
    domain: projectCompetitionDomainBlockFromIds(
      Array.from({ length: count }, (_, i) => `comp_${i + 1}`),
    ),
    localOnlyCompetitionIds: [],
  };
}

function publish(count: number): ParentPublishSnapshot {
  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "parent_publish",
    transitionId: TX,
    capturedAt: "2026-06-25T12:00:01.000Z",
    deviceRole: "parent",
    sharedAthleteId: ATHLETE,
    publishLane: "topology_put",
    publishOutcome: "ok",
    domain: projectCompetitionDomainBlockFromIds(
      Array.from({ length: count }, (_, i) => `comp_${i + 1}`),
    ),
    operationSharedCompetitionIds: Array.from({ length: count }, (_, i) => `comp_${i + 1}`),
  };
}

function worker(count: number): WorkerPersistSnapshot {
  return {
    contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
    snapshotKind: "worker_persist",
    transitionId: TX,
    parentTransitionId: TX,
    capturedAt: "2026-06-25T12:00:02.000Z",
    deviceRole: "worker",
    sharedAthleteId: ATHLETE,
    persistLane: "topology_put",
    domain: projectCompetitionDomainBlockFromIds(
      Array.from({ length: count }, (_, i) => `comp_${i + 1}`),
    ),
    beforeCompetitionCount: count - 1,
    afterCompetitionCount: count,
    sessionCompetitionCount: count,
  };
}

describe("selectPhaseABoundarySnapshots", () => {
  it("returns S1 then S2 then S3 for the active transition", () => {
    const selected = selectPhaseABoundarySnapshots({
      snapshots: [canonical(5), publish(5), worker(4)],
      sharedAthleteId: ATHLETE,
      transitionId: TX,
    });

    assert.equal(selected.s1?.snapshotKind, "parent_canonical");
    assert.equal(selected.s2?.snapshotKind, "parent_publish");
    assert.equal(selected.s3?.snapshotKind, "worker_persist");
    assert.equal(selected.s1?.domain.competitionCount, 5);
    assert.equal(selected.s3?.domain.competitionCount, 4);
  });
});
