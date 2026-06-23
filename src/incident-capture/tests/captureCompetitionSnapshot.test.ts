import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { captureCompetitionSnapshot } from "../captureCompetitionSnapshot";

const CAPTURED_AT = "2026-06-23T12:00:00.000Z";

describe("captureCompetitionSnapshot", () => {
  it("reads local entries and artifact set without worker or topology inputs", async () => {
    let entriesReadFor: string | null = null;
    let artifactReadFor: string | null = null;

    const out = await captureCompetitionSnapshot({
      capturedAt: CAPTURED_AT,
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      sourceTrigger: "export",
      getEntriesWithMatchDetail: async (sharedAthleteId) => {
        entriesReadFor = sharedAthleteId;
        return [
          {
            id: "entry_1",
            kidId: "kid_1",
            sharedAthleteId,
            sharedCompetitionId: "comp_1",
            tournamentName: "Dream BJJ",
            eventDate: "2026-04-25",
            createdAt: "2026-04-25T00:00:00.000Z",
            updatedAt: "2026-04-25T00:00:00.000Z",
            matches: [
              {
                id: "match_1",
                matchResult: "win",
                outcome: "Points",
                submissionTime: null,
                imageUri: null,
                videoUri: null,
                imageAssetId: null,
                videoAssetId: null,
              },
            ],
          },
        ];
      },
      getArtifactSet: async (sharedAthleteId) => {
        artifactReadFor = sharedAthleteId;
        return {
          schemaVersion: 1,
          sharedAthleteId,
          updatedAt: "2026-06-23T11:00:00.000Z",
          artifacts: [
            {
              sharedAthleteId,
              sharedCompetitionId: "comp_1",
              matchLineageKey: "match_1",
              coachNote: "Keep the underhook.",
              updatedAt: "2026-06-23T11:00:00.000Z",
            },
          ],
        };
      },
    });

    assert.equal(entriesReadFor, "ath_1");
    assert.equal(artifactReadFor, "ath_1");
    assert.equal(out.sharedAthleteId, "ath_1");
    assert.equal(out.visibleCompetitionCount, 1);
    assert.equal(out.competitions[0]?.firstFailureLayer, "none_detected");
    assert.equal(out.competitions[0]?.projectedCoachNoteCount, 1);
  });
});
