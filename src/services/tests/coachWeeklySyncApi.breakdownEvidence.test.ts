import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCoachMatchBreakdownArtifactsField } from "../coachMatchBreakdownArtifactParser";

const UPDATED_AT = "2026-06-23T12:00:00.000Z";

function artifactSet(sharedAthleteId: string, artifactCount: number) {
  return {
    schemaVersion: 1 as const,
    sharedAthleteId,
    updatedAt: UPDATED_AT,
    artifacts: Array.from({ length: artifactCount }, (_, index) => ({
      sharedAthleteId,
      sharedCompetitionId: `shared_comp_${index + 1}`,
      matchLineageKey: `match_${index + 1}`,
      coachNote: `Note ${index + 1}`,
      updatedAt: UPDATED_AT,
    })),
  };
}

describe("coach match breakdown parser evidence", () => {
  it("distinguishes an omitted field from a malformed field", () => {
    const omitted = parseCoachMatchBreakdownArtifactsField(undefined, false);
    const malformed = parseCoachMatchBreakdownArtifactsField(null, true);

    assert.deepEqual(omitted, {
      artifactsByAthleteId: {},
      evidence: {
        fieldClassification: "omitted",
        athleteEntryClassificationById: {},
      },
    });
    assert.deepEqual(malformed, {
      artifactsByAthleteId: {},
      evidence: {
        fieldClassification: "malformed",
        athleteEntryClassificationById: {},
      },
    });
  });

  it("preserves populated, empty, and malformed athlete entry classifications", () => {
    const populated = artifactSet("shared_ath_populated", 1);
    const empty = artifactSet("shared_ath_empty", 0);
    const malformed = {
      ...artifactSet("different_athlete", 1),
      sharedAthleteId: "different_athlete",
    };

    const result = parseCoachMatchBreakdownArtifactsField(
      {
        shared_ath_populated: populated,
        shared_ath_empty: empty,
        shared_ath_malformed: malformed,
      },
      true,
    );

    assert.deepEqual(Object.keys(result.artifactsByAthleteId).sort(), [
      "shared_ath_empty",
      "shared_ath_populated",
    ]);
    assert.deepEqual(result.evidence, {
      fieldClassification: "malformed",
      athleteEntryClassificationById: {
        shared_ath_populated: "populated",
        shared_ath_empty: "empty",
        shared_ath_malformed: "malformed",
      },
    });
  });

  it("classifies an empty artifact map as valid", () => {
    const result = parseCoachMatchBreakdownArtifactsField({}, true);

    assert.deepEqual(result, {
      artifactsByAthleteId: {},
      evidence: {
        fieldClassification: "valid",
        athleteEntryClassificationById: {},
      },
    });
  });
});
