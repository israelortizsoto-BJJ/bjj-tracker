import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { SyncedCoachMatchBreakdownArtifactSet } from "../../types/coachWeeklySync";
import { COMPETITION_SNAPSHOT_CONTRACT_VERSION } from "../competitionSnapshotContract";
import { projectCompetitionSnapshot } from "../projectCompetitionSnapshot";

const CAPTURED_AT = "2026-06-23T12:00:00.000Z";

function match(id: string, coachNote?: string): CompetitionDetailMatchSnapshot {
  return {
    id,
    matchResult: "win",
    outcome: "Points",
    submissionTime: null,
    ...(coachNote ? { coachNote } : {}),
    imageUri: null,
    videoUri: null,
    imageAssetId: null,
    videoAssetId: null,
  };
}

function artifactSet(
  artifacts: SyncedCoachMatchBreakdownArtifactSet["artifacts"],
): SyncedCoachMatchBreakdownArtifactSet {
  return {
    schemaVersion: 1,
    sharedAthleteId: "ath_1",
    updatedAt: "2026-06-23T11:00:00.000Z",
    artifacts,
  };
}

describe("projectCompetitionSnapshot", () => {
  it("classifies missing local artifact cache", () => {
    const out = projectCompetitionSnapshot({
      capturedAt: CAPTURED_AT,
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      artifactSet: null,
      competitions: [
        {
          sharedCompetitionId: "comp_1",
          entryId: "entry_1",
          matches: [match("match_1")],
        },
      ],
    });

    assert.equal(out.contractVersion, COMPETITION_SNAPSHOT_CONTRACT_VERSION);
    assert.equal(out.visibleCompetitionCount, 1);
    assert.equal(out.competitions[0]?.firstFailureLayer, "local_artifact_missing");
    assert.deepEqual(out.competitions[0]?.entryMatchIds, ["match_1"]);
  });

  it("classifies annotation rejection when artifact lineage is not in entry match ids", () => {
    const out = projectCompetitionSnapshot({
      capturedAt: CAPTURED_AT,
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      artifactSet: artifactSet([
        {
          sharedAthleteId: "ath_1",
          sharedCompetitionId: "comp_1",
          matchLineageKey: "artifact_match_1",
          coachNote: "Keep the underhook.",
          updatedAt: "2026-06-23T11:00:00.000Z",
        },
      ]),
      competitions: [
        {
          sharedCompetitionId: "comp_1",
          entryId: "entry_1",
          matches: [match("entry_match_1")],
        },
      ],
    });

    const row = out.competitions[0];
    assert.equal(row?.firstFailureLayer, "annotation_rejected");
    assert.deepEqual(row?.localArtifactLineageKeys, ["artifact_match_1"]);
    assert.equal(row?.annotationAcceptedCount, 0);
    assert.deepEqual(row?.annotationRejectReasons, ["lineage_key_not_in_match_set"]);
  });

  it("classifies successful attachment as none_detected", () => {
    const out = projectCompetitionSnapshot({
      capturedAt: CAPTURED_AT,
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      artifactSet: artifactSet([
        {
          sharedAthleteId: "ath_1",
          sharedCompetitionId: "comp_1",
          matchLineageKey: "match_1",
          coachNote: "Keep the underhook.",
          updatedAt: "2026-06-23T11:00:00.000Z",
        },
      ]),
      competitions: [
        {
          sharedCompetitionId: "comp_1",
          entryId: "entry_1",
          matches: [match("match_1"), match("match_2")],
        },
      ],
    });

    const row = out.competitions[0];
    assert.equal(row?.firstFailureLayer, "none_detected");
    assert.equal(row?.annotationAcceptedCount, 1);
    assert.deepEqual(row?.annotationAcceptedLineageKeys, ["match_1"]);
    assert.equal(row?.mergeMatchedCount, 1);
    assert.deepEqual(row?.mergeMatchedLineageKeys, ["match_1"]);
    assert.equal(row?.projectedCoachNoteCount, 1);
  });
});
