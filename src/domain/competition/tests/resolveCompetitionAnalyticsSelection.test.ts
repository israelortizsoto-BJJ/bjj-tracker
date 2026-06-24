import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CompetitionDetailMatchSnapshot,
  KidCompetitionEntryWithMatchDetail,
} from "../../../storage/competitionStore";
import type {
  SyncedCoachMatchBreakdownArtifactSet,
} from "../../../types/coachWeeklySync";
import type { CoachAnalysisReadinessRecord } from "../coachAnalysisReadinessTypes";
import {
  resetSummaryPilotAnalyticsSelectionTraceForDev,
  resolveCompetitionAnalyticsSelection,
  SUMMARY_PILOT_ANALYTICS_SELECTION_TRACE,
} from "../resolveCompetitionAnalyticsSelection";

const ATHLETE_ID = "ath_1";
const ARTIFACT_UPDATED_AT = "2026-06-24T12:00:00.000Z";
const GUARD_NOTE = "Needs guard retention";

function match(id: string, coachNote?: string): CompetitionDetailMatchSnapshot {
  return {
    id,
    matchResult: "loss",
    outcome: "Points",
    submissionTime: null,
    ...(coachNote ? { coachNote } : {}),
    imageUri: null,
    videoUri: null,
    imageAssetId: null,
    videoAssetId: null,
  };
}

function legacyEntry(
  matches: CompetitionDetailMatchSnapshot[] = [
    match("match_1"),
    match("match_2"),
  ],
): KidCompetitionEntryWithMatchDetail {
  return {
    id: "shared-comp-comp_1",
    kidId: "kid_1",
    sharedAthleteId: ATHLETE_ID,
    sharedCompetitionId: "comp_1",
    tournamentName: "Dream BJJ",
    eventDate: "2026-06-24",
    result: "silver",
    createdAt: "2026-06-24T10:00:00.000Z",
    updatedAt: "2026-06-24T10:00:00.000Z",
    matches,
  };
}

function artifactSet(coachNote: string): SyncedCoachMatchBreakdownArtifactSet {
  return {
    schemaVersion: 1,
    sharedAthleteId: ATHLETE_ID,
    updatedAt: ARTIFACT_UPDATED_AT,
    artifacts: [
      {
        sharedAthleteId: ATHLETE_ID,
        sharedCompetitionId: "comp_1",
        matchLineageKey: "match_1",
        coachNote,
        updatedAt: ARTIFACT_UPDATED_AT,
      },
      {
        sharedAthleteId: ATHLETE_ID,
        sharedCompetitionId: "comp_1",
        matchLineageKey: "match_2",
        coachNote,
        updatedAt: ARTIFACT_UPDATED_AT,
      },
    ],
  };
}

function readiness(
  input: Partial<CoachAnalysisReadinessRecord> & {
    state: CoachAnalysisReadinessRecord["state"];
  },
): CoachAnalysisReadinessRecord {
  return {
    sharedAthleteId: ATHLETE_ID,
    generation: 1,
    startedAt: "2026-06-24T11:00:00.000Z",
    hydrationSource: "parent_session_refresh",
    ...input,
  };
}

describe("resolveCompetitionAnalyticsSelection", () => {
  it("returns legacy entries when eligibility is disabled", async () => {
    const legacyCompetitions = [legacyEntry()];
    const out = await resolveCompetitionAnalyticsSelection(
      {
        deviceRole: "parent",
        sharedAthleteId: ATHLETE_ID,
        legacyCompetitions,
      },
      {
        eligibilityEnabled: false,
        deps: {
          getReadiness: async () =>
            readiness({
              state: "READY",
              artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
            }),
          getArtifactSet: async () => artifactSet(GUARD_NOTE),
        },
      },
    );

    assert.equal(out.source, "legacy");
    assert.equal(out.entries, legacyCompetitions);
  });

  it("passes coach role through as legacy without store reads", async () => {
    const legacyCompetitions = [legacyEntry()];
    let reads = 0;
    const out = await resolveCompetitionAnalyticsSelection(
      {
        deviceRole: "coach",
        sharedAthleteId: ATHLETE_ID,
        legacyCompetitions,
      },
      {
        eligibilityEnabled: true,
        deps: {
          getReadiness: async () => {
            reads += 1;
            return readiness({
              state: "READY",
              artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
            });
          },
          getArtifactSet: async () => {
            reads += 1;
            return artifactSet(GUARD_NOTE);
          },
        },
      },
    );

    assert.equal(reads, 0);
    assert.equal(out.source, "legacy");
    assert.equal(out.entries, legacyCompetitions);
  });

  it("falls back to legacy when readiness is missing", async () => {
    const legacyCompetitions = [legacyEntry()];
    const out = await resolveCompetitionAnalyticsSelection(
      {
        deviceRole: "parent",
        sharedAthleteId: ATHLETE_ID,
        legacyCompetitions,
      },
      {
        eligibilityEnabled: true,
        deps: {
          getReadiness: async () => null,
          getArtifactSet: async () => artifactSet(GUARD_NOTE),
        },
      },
    );

    assert.equal(out.source, "legacy");
    assert.equal(out.entries, legacyCompetitions);
  });

  it("selects projection for parent READY with matching artifact timestamp", async () => {
    const legacyCompetitions = [legacyEntry()];
    const out = await resolveCompetitionAnalyticsSelection(
      {
        deviceRole: "parent",
        sharedAthleteId: ATHLETE_ID,
        legacyCompetitions,
      },
      {
        eligibilityEnabled: true,
        deps: {
          getReadiness: async () =>
            readiness({
              state: "READY",
              artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
            }),
          getArtifactSet: async () => artifactSet(GUARD_NOTE),
        },
      },
    );

    assert.equal(out.source, "projection_ready");
    assert.equal(out.entries[0]?.matches?.[0]?.coachNote, GUARD_NOTE);
    assert.notEqual(out.entries, legacyCompetitions);
  });

  it("falls back to legacy for parent READY with mismatched artifact timestamp", async () => {
    const legacyCompetitions = [legacyEntry()];
    const out = await resolveCompetitionAnalyticsSelection(
      {
        deviceRole: "parent",
        sharedAthleteId: ATHLETE_ID,
        legacyCompetitions,
      },
      {
        eligibilityEnabled: true,
        deps: {
          getReadiness: async () =>
            readiness({
              state: "READY",
              artifactSetUpdatedAt: "2026-06-24T11:59:00.000Z",
            }),
          getArtifactSet: async () => artifactSet(GUARD_NOTE),
        },
      },
    );

    assert.equal(out.source, "legacy");
    assert.equal(out.entries, legacyCompetitions);
  });

  it("selects projection for parent EMPTY_READY", async () => {
    const legacyCompetitions = [legacyEntry()];
    const out = await resolveCompetitionAnalyticsSelection(
      {
        deviceRole: "parent",
        sharedAthleteId: ATHLETE_ID,
        legacyCompetitions,
      },
      {
        eligibilityEnabled: true,
        deps: {
          getReadiness: async () => readiness({ state: "EMPTY_READY" }),
          getArtifactSet: async () => null,
        },
      },
    );

    assert.equal(out.source, "projection_empty_ready");
    assert.equal(out.entries[0]?.matches?.[0]?.coachNote ?? undefined, undefined);
  });

  it("emits dev selection trace only when athlete or source changes", async () => {
    const originalDev = (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__;
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
    resetSummaryPilotAnalyticsSelectionTraceForDev();

    const logs: unknown[][] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      if (args[0] === SUMMARY_PILOT_ANALYTICS_SELECTION_TRACE) {
        logs.push(args);
      }
    };

    try {
      const legacyCompetitions = [legacyEntry()];
      const deps = {
        getReadiness: async () =>
          readiness({
            state: "READY",
            artifactSetUpdatedAt: ARTIFACT_UPDATED_AT,
          }),
        getArtifactSet: async () => artifactSet(GUARD_NOTE),
      };
      const baseInput = {
        deviceRole: "parent" as const,
        sharedAthleteId: ATHLETE_ID,
        legacyCompetitions,
      };

      await resolveCompetitionAnalyticsSelection(baseInput, {
        eligibilityEnabled: true,
        deps,
      });
      await resolveCompetitionAnalyticsSelection(baseInput, {
        eligibilityEnabled: true,
        deps,
      });

      assert.equal(logs.length, 1);
      assert.deepEqual(logs[0]?.[1], {
        athleteId: ATHLETE_ID,
        source: "projection_ready",
        readinessState: "READY",
        artifactTimestamp: ARTIFACT_UPDATED_AT,
        readinessTimestamp: ARTIFACT_UPDATED_AT,
        eligibilityEnabled: true,
      });

      await resolveCompetitionAnalyticsSelection(
        {
          ...baseInput,
          sharedAthleteId: "ath_2",
        },
        {
          eligibilityEnabled: true,
          deps: {
            getReadiness: async () => null,
            getArtifactSet: async () => null,
          },
        },
      );

      assert.equal(logs.length, 2);
      assert.equal(
        (logs[1]?.[1] as { source?: string })?.source,
        "legacy",
      );
    } finally {
      console.log = originalLog;
      (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = originalDev;
      resetSummaryPilotAnalyticsSelectionTraceForDev();
    }
  });
});
