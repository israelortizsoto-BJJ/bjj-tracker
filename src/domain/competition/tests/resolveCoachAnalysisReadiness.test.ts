import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CoachAnalysisReadinessLinkEvidence,
} from "../coachAnalysisReadinessTypes";
import { resolveCoachAnalysisReadinessForAthlete } from "../resolveCoachAnalysisReadiness";

const ATHLETE_ID = "shared_ath_1";

function successLink(input: {
  linkKey: string;
  fieldClassification?: "valid" | "omitted" | "malformed";
  athleteEntries?: Record<
    string,
    "populated" | "empty" | "malformed"
  >;
  updatedAtByAthleteId?: Record<string, string>;
}): CoachAnalysisReadinessLinkEvidence {
  return {
    linkKey: input.linkKey,
    status: "success",
    artifactEvidence: {
      fieldClassification: input.fieldClassification ?? "valid",
      athleteEntryClassificationById: input.athleteEntries ?? {},
    },
    artifactSetUpdatedAtByAthleteId: input.updatedAtByAthleteId,
  };
}

const pendingLink = (
  linkKey: string,
): CoachAnalysisReadinessLinkEvidence => ({
  linkKey,
  status: "pending",
});

const failedLink = (
  linkKey: string,
): CoachAnalysisReadinessLinkEvidence => ({
  linkKey,
  status: "failed",
});

describe("resolveCoachAnalysisReadinessForAthlete", () => {
  it("resolves READY from a populated athlete entry", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          athleteEntries: { [ATHLETE_ID]: "populated" },
          updatedAtByAthleteId: {
            [ATHLETE_ID]: "2026-06-24T12:00:00.000Z",
          },
        }),
      ],
    });

    assert.deepEqual(result, {
      state: "READY",
      artifactSetUpdatedAt: "2026-06-24T12:00:00.000Z",
    });
  });

  it("resolves EMPTY_READY only from an explicit empty athlete entry", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          athleteEntries: { [ATHLETE_ID]: "empty" },
        }),
      ],
    });

    assert.deepEqual(result, { state: "EMPTY_READY" });
  });

  it("resolves FAILED when all completed evidence failed", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [failedLink("A"), failedLink("B")],
    });

    assert.deepEqual(result, { state: "FAILED" });
  });

  it("resolves PENDING when no conclusive evidence exists and a link is pending", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [pendingLink("A"), failedLink("B")],
    });

    assert.deepEqual(result, { state: "PENDING" });
  });

  it("does not treat an omitted athlete key as authoritative empty", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [successLink({ linkKey: "A" })],
    });

    assert.deepEqual(result, { state: "FAILED" });
  });

  it("resolves FAILED for a malformed artifact field without valid athlete evidence", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          fieldClassification: "malformed",
        }),
      ],
    });

    assert.deepEqual(result, { state: "FAILED" });
  });

  it("resolves FAILED for a malformed athlete entry", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          fieldClassification: "malformed",
          athleteEntries: { [ATHLETE_ID]: "malformed" },
        }),
      ],
    });

    assert.deepEqual(result, { state: "FAILED" });
  });

  it("keeps a valid athlete READY when an unrelated sibling entry made the field malformed", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          fieldClassification: "malformed",
          athleteEntries: {
            [ATHLETE_ID]: "populated",
            shared_ath_broken: "malformed",
          },
          updatedAtByAthleteId: {
            [ATHLETE_ID]: "2026-06-24T12:00:00.000Z",
          },
        }),
      ],
    });

    assert.equal(result.state, "READY");
  });

  it("frozen scenario: A populated succeeds and B fails", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          athleteEntries: { [ATHLETE_ID]: "populated" },
        }),
        failedLink("B"),
      ],
    });

    assert.deepEqual(result, { state: "READY" });
  });

  it("frozen scenario: A empty and B populated resolves READY", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          athleteEntries: { [ATHLETE_ID]: "empty" },
        }),
        successLink({
          linkKey: "B",
          athleteEntries: { [ATHLETE_ID]: "populated" },
        }),
      ],
    });

    assert.deepEqual(result, { state: "READY" });
  });

  it("frozen scenario: A and B populated use the newest artifact timestamp", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          athleteEntries: { [ATHLETE_ID]: "populated" },
          updatedAtByAthleteId: {
            [ATHLETE_ID]: "2026-06-23T12:00:00.000Z",
          },
        }),
        successLink({
          linkKey: "B",
          athleteEntries: { [ATHLETE_ID]: "populated" },
          updatedAtByAthleteId: {
            [ATHLETE_ID]: "2026-06-24T12:00:00.000Z",
          },
        }),
      ],
    });

    assert.deepEqual(result, {
      state: "READY",
      artifactSetUpdatedAt: "2026-06-24T12:00:00.000Z",
    });
  });

  it("frozen scenario: A omits and B populates resolves READY", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          fieldClassification: "omitted",
        }),
        successLink({
          linkKey: "B",
          athleteEntries: { [ATHLETE_ID]: "populated" },
        }),
      ],
    });

    assert.deepEqual(result, { state: "READY" });
  });

  it("frozen scenario: A omits and B fails resolves FAILED", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          fieldClassification: "omitted",
        }),
        failedLink("B"),
      ],
    });

    assert.deepEqual(result, { state: "FAILED" });
  });

  it("frozen scenario: A malformed and B succeeds resolves from B", () => {
    const result = resolveCoachAnalysisReadinessForAthlete({
      sharedAthleteId: ATHLETE_ID,
      links: [
        successLink({
          linkKey: "A",
          fieldClassification: "malformed",
          athleteEntries: { [ATHLETE_ID]: "malformed" },
        }),
        successLink({
          linkKey: "B",
          athleteEntries: { [ATHLETE_ID]: "populated" },
        }),
      ],
    });

    assert.deepEqual(result, { state: "READY" });
  });
});
