import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { diffCompetitionBoundarySnapshots } from "../diffCompetitionBoundarySnapshots";
import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  type ParentCanonicalSnapshot,
  type ParentPublishSnapshot,
} from "../competitionStateAuditorContract";
import { projectCompetitionDomainBlockFromIds } from "../projectCompetitionDomainBlock";

describe("projectCompetitionDomainBlock", () => {
  it("sorts sharedCompetitionIds for stable diffing", () => {
    const domain = projectCompetitionDomainBlockFromIds(["comp_b", "comp_a", "comp_c"]);
    assert.deepEqual(domain.sharedCompetitionIds, ["comp_a", "comp_b", "comp_c"]);
    assert.equal(domain.competitionCount, 3);
  });
});

describe("diffCompetitionBoundarySnapshots", () => {
  it("flags missing competition ids across boundaries", () => {
    const upstream: ParentCanonicalSnapshot = {
      contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
      snapshotKind: "parent_canonical",
      transitionId: "tx-1",
      capturedAt: "2026-06-25T12:00:00.000Z",
      deviceRole: "parent",
      sharedAthleteId: "athlete_1",
      generation: 1,
      domain: projectCompetitionDomainBlockFromIds(["comp_1", "comp_2"]),
      localOnlyCompetitionIds: [],
    };
    const downstream: ParentPublishSnapshot = {
      contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
      snapshotKind: "parent_publish",
      transitionId: "tx-1",
      capturedAt: "2026-06-25T12:00:00.000Z",
      deviceRole: "parent",
      sharedAthleteId: "athlete_1",
      publishLane: "topology_put",
      publishOutcome: "ok",
      domain: projectCompetitionDomainBlockFromIds(["comp_1"]),
      operationSharedCompetitionIds: ["comp_1"],
    };

    const diff = diffCompetitionBoundarySnapshots({
      layer: "parent_canonical→parent_publish",
      upstream,
      downstream,
    });

    assert.deepEqual(diff.firstDivergence?.missingIds, ["comp_2"]);
    assert.equal(diff.firstDivergence?.extraIds.length, 0);
  });
});
