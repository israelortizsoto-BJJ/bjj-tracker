import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { captureCompetitionSnapshot } from "../captureCompetitionSnapshot";

const CAPTURED_AT = "2026-06-23T12:00:00.000Z";
(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;

describe("captureCompetitionSnapshot", () => {
  it("keeps parent capture detail-backed without reading coach topology", async () => {
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
      getTopologyArtifact: () => {
        throw new Error("parent capture must not read coach topology");
      },
    });

    assert.equal(entriesReadFor, "ath_1");
    assert.equal(artifactReadFor, "ath_1");
    assert.equal(out.sharedAthleteId, "ath_1");
    assert.equal(out.visibleCompetitionCount, 1);
    assert.equal(out.competitions[0]?.firstFailureLayer, "none_detected");
    assert.equal(out.competitions[0]?.projectedCoachNoteCount, 1);
  });

  it("uses the coach topology projection as the structural match substrate", async () => {
    const out = await captureCompetitionSnapshot({
      capturedAt: CAPTURED_AT,
      deviceRole: "coach",
      sharedAthleteId: "ath_1",
      getEntriesWithMatchDetail: async (sharedAthleteId) => [
        {
          id: "shared-comp-comp_1",
          kidId: "kid_1",
          sharedAthleteId,
          sharedCompetitionId: "comp_1",
          tournamentName: "Dream BJJ",
          eventDate: "2026-04-25",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:00:00.000Z",
          matches: [],
        },
      ],
      getTopologyArtifact: (sharedAthleteId) => ({
        schemaVersion: 1,
        sharedAthleteId,
        updatedAt: "2026-06-23T10:00:00.000Z",
        competitions: [
          {
            sharedAthleteId,
            sharedCompetitionId: "comp_1",
            competitionLineageKey: "competition-lineage-comp_1",
            updatedAt: "2026-06-23T10:00:00.000Z",
            matches: [
              {
                matchLineageKey: "match-lineage-comp_1-slot-1",
                ordinal: 0,
                result: "win",
                finishType: "points",
                durationSeconds: 300,
              },
            ],
          },
        ],
      }),
      getArtifactSet: async (sharedAthleteId) => ({
        schemaVersion: 1,
        sharedAthleteId,
        updatedAt: "2026-06-23T11:00:00.000Z",
        artifacts: [
          {
            sharedAthleteId,
            sharedCompetitionId: "comp_1",
            matchLineageKey: "match-lineage-comp_1-slot-1",
            coachNote: "Keep the underhook.",
            updatedAt: "2026-06-23T11:00:00.000Z",
          },
        ],
      }),
    });

    assert.equal(out.competitions[0]?.entryMatchCount, 1);
    assert.deepEqual(out.competitions[0]?.entryMatchIds, [
      "match-lineage-comp_1-slot-1",
    ]);
    assert.equal(out.competitions[0]?.annotationAcceptedCount, 1);
    assert.equal(out.competitions[0]?.mergeMatchedCount, 1);
    assert.equal(out.competitions[0]?.projectedCoachNoteCount, 1);
    assert.equal(out.competitions[0]?.firstFailureLayer, "none_detected");
  });

  it("preserves coach detail fallback when topology is absent", async () => {
    const out = await captureCompetitionSnapshot({
      capturedAt: CAPTURED_AT,
      deviceRole: "coach",
      sharedAthleteId: "ath_1",
      getEntriesWithMatchDetail: async (sharedAthleteId) => [
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
              id: "fallback_match_1",
              matchResult: "loss",
              outcome: "Points",
              submissionTime: null,
              imageUri: null,
              videoUri: null,
              imageAssetId: null,
              videoAssetId: null,
            },
          ],
        },
      ],
      getTopologyArtifact: () => null,
      getArtifactSet: async () => null,
    });

    assert.equal(out.competitions[0]?.entryMatchCount, 1);
    assert.deepEqual(out.competitions[0]?.entryMatchIds, ["fallback_match_1"]);
  });
});
