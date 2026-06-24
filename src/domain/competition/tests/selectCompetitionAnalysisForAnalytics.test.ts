import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CoachAnalysisReadinessRecord } from "../coachAnalysisReadinessTypes";
import type { CompetitionAnalysisRow } from "../competitionAnalysisProjectionTypes";
import {
  selectCompetitionAnalysisForAnalytics,
  type SelectCompetitionAnalysisForAnalyticsInput,
} from "../selectCompetitionAnalysisForAnalytics";

const ARTIFACT_UPDATED_AT = "2026-06-24T12:00:00.000Z";

const legacyEntries = [
  {
    id: "entry_legacy",
    matches: [{ id: "match_1", coachNote: "Legacy analysis" }],
  },
];

const projectedEntries: CompetitionAnalysisRow[] = [
  {
    entryId: "entry_1",
    sharedCompetitionId: "comp_1",
    eventDate: "2026-06-24",
    result: "gold",
    createdAt: "2026-06-24T10:00:00.000Z",
    competitionCoachNotes: null,
    matches: [
      {
        matchId: "match_1",
        matchResult: "loss",
        outcome: "Points",
        submissionTime: null,
        resolvedCoachAnalysis: "Projected analysis",
        analysisSource: "coach_artifact",
      },
    ],
  },
];

function readiness(
  input: Partial<CoachAnalysisReadinessRecord> & {
    state: CoachAnalysisReadinessRecord["state"];
  },
): CoachAnalysisReadinessRecord {
  return {
    sharedAthleteId: "ath_1",
    generation: 2,
    startedAt: "2026-06-24T11:00:00.000Z",
    hydrationSource: "parent_session_refresh",
    ...input,
  };
}

function selectionInput(
  readinessRecord: CoachAnalysisReadinessRecord | null,
  artifactStoreUpdatedAt: string | null = ARTIFACT_UPDATED_AT,
): SelectCompetitionAnalysisForAnalyticsInput {
  return {
    readinessRecord,
    projectedCompetitionAnalysis: {
      entries: projectedEntries,
      artifactStoreUpdatedAt,
    },
    legacyCompetitionEntries: legacyEntries,
  };
}

describe("selectCompetitionAnalysisForAnalytics", () => {
  it("selects projection for READY with a matching artifact timestamp", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(
        readiness({
          state: "READY",
          artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
        }),
      ),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "projection_ready");
    assert.equal(out.entries[0]?.matches?.[0]?.coachNote, "Projected analysis");
  });

  it("falls back to legacy for READY with a missing artifact timestamp", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(readiness({ state: "READY" })),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "legacy");
    assert.equal(out.entries, legacyEntries);
  });

  it("falls back to legacy for READY with a mismatched artifact timestamp", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(
        readiness({
          state: "READY",
          artifactSetUpdatedAt: "2026-06-24T11:59:00.000Z",
        }),
      ),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "legacy");
  });

  it("selects compatibility projection for EMPTY_READY", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(readiness({ state: "EMPTY_READY" }), null),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "projection_empty_ready");
  });

  it("uses last confirmed READY authority after FAILED", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(
        readiness({
          state: "FAILED",
          lastConfirmedState: "READY",
          lastConfirmedArtifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
        }),
      ),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "last_confirmed");
  });

  it("falls back to legacy after FAILED without confirmed authority", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(readiness({ state: "FAILED" })),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "legacy");
  });

  it("falls back to legacy when last confirmed READY no longer matches the artifact store", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(
        readiness({
          state: "FAILED",
          lastConfirmedState: "READY",
          lastConfirmedArtifactSetUpdatedAt:
            "2026-06-24T11:59:00.000Z",
        }),
      ),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "legacy");
  });

  it("uses last confirmed EMPTY_READY authority while PENDING", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(
        readiness({
          state: "PENDING",
          lastConfirmedState: "EMPTY_READY",
        }),
        null,
      ),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "last_confirmed");
  });

  it("falls back to legacy while PENDING without confirmed authority", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(readiness({ state: "PENDING" })),
      { eligibilityEnabled: true },
    );

    assert.equal(out.source, "legacy");
  });

  it("returns the original legacy entries when the rollback flag is disabled", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(
        readiness({
          state: "READY",
          artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
        }),
      ),
      { eligibilityEnabled: false },
    );

    assert.equal(out.source, "legacy");
    assert.equal(out.entries, legacyEntries);
  });

  it("defaults the production rollback flag to the legacy path", () => {
    const out = selectCompetitionAnalysisForAnalytics(
      selectionInput(
        readiness({
          state: "READY",
          artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
        }),
      ),
    );

    assert.equal(out.source, "legacy");
    assert.equal(out.entries, legacyEntries);
  });
});
