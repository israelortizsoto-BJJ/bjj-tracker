import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveCompetitionTrainingSkillFocus,
  type CompetitionTrainingSkillFocus,
} from "../../../ai-coach/competitionTrainingSkillFocus";
import {
  aggregateCompetitionMatchSignals,
  inferPrimaryTrainingSkillBucketForCompetitionEntry,
  type MatchSignalsCompetitionRow,
} from "../../../lib/signals/competitionMatchBucketAggregate";
import {
  deriveCompetitionBucketHistorySignals,
  type BucketOutcomeTrend,
  type CompetitionBucketHistoryRow,
} from "../../../lib/signals/competitionBucketHistory";
import type {
  CompetitionDetailMatchSnapshot,
  KidCompetitionEntryWithMatchDetail,
} from "../../../storage/competitionStore";
import type {
  SyncedCoachMatchBreakdownArtifactSet,
  SyncedCompetitionTopologyArtifact,
} from "../../../types/coachWeeklySync";
import type {
  CompetitionAnalysisSource,
} from "../competitionAnalysisProjectionTypes";
import { assembleCompetitionMatchSignalsInput } from "../assembleCompetitionMatchSignalsInput";
import {
  projectSharedCompetitionAnalysis,
  type ProjectSharedCompetitionAnalysisInput,
} from "../projectSharedCompetitionAnalysis";

Object.defineProperty(globalThis, "__DEV__", {
  configurable: true,
  value: false,
});

type BucketCounts = Record<string, number>;

type AnalyticsEvidence = {
  lossBuckets: BucketCounts;
  winBuckets: BucketCounts;
  primaryBucket: string | null;
  trainingFocus: {
    summaryLabel: string | null;
    highConfidence: boolean;
  } | null;
  bucketHistory: CompetitionBucketHistoryRow[];
  bucketOutcomeTrends: Partial<Record<string, BucketOutcomeTrend>>;
};

type FixtureExpectation = {
  classification: "expected_authority_divergence" | "parity";
  legacyBucket: string | null;
  projectedBucket: string | null;
  legacyFocusBucket?: string | null;
  projectedFocusBucket?: string | null;
  projectedSources: CompetitionAnalysisSource[];
};

function match(
  id: string,
  coachNote?: string,
): CompetitionDetailMatchSnapshot {
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

function entry(input?: {
  matches?: CompetitionDetailMatchSnapshot[];
  linked?: boolean;
}): KidCompetitionEntryWithMatchDetail {
  const linked = input?.linked ?? true;
  return {
    id: linked ? "shared-comp-comp_1" : "entry_local",
    kidId: "kid_1",
    ...(linked
      ? {
          sharedAthleteId: "ath_1",
          sharedCompetitionId: "comp_1",
        }
      : {}),
    tournamentName: "Dream BJJ",
    eventDate: "2026-04-25",
    result: "bronze",
    createdAt: "2026-04-25T12:00:00.000Z",
    updatedAt: "2026-04-25T12:00:00.000Z",
    matches: input?.matches ?? [match("match_1"), match("match_2")],
  };
}

function artifactSet(
  rows: readonly { matchLineageKey: string; coachNote: string }[],
): SyncedCoachMatchBreakdownArtifactSet {
  return {
    schemaVersion: 1,
    sharedAthleteId: "ath_1",
    updatedAt: "2026-06-23T12:00:00.000Z",
    artifacts: rows.map((row) => ({
      sharedAthleteId: "ath_1",
      sharedCompetitionId: "comp_1",
      matchLineageKey: row.matchLineageKey,
      coachNote: row.coachNote,
      updatedAt: "2026-06-23T12:00:00.000Z",
    })),
  };
}

function topology(
  matchLineageKeys: readonly string[] = ["match_1", "match_2"],
): SyncedCompetitionTopologyArtifact {
  return {
    schemaVersion: 1,
    sharedAthleteId: "ath_1",
    updatedAt: "2026-06-23T12:00:00.000Z",
    competitions: [
      {
        sharedCompetitionId: "comp_1",
        sharedAthleteId: "ath_1",
        competitionLineageKey: "competition_lineage_1",
        updatedAt: "2026-06-23T12:00:00.000Z",
        matches: matchLineageKeys.map((matchLineageKey, ordinal) => ({
          matchLineageKey,
          ordinal,
          result: "loss",
          finishType: "points",
          durationSeconds: null,
        })),
      },
    ],
  };
}

function historyScaffold(
  row: MatchSignalsCompetitionRow,
): MatchSignalsCompetitionRow[] {
  return [
    {
      ...row,
      id: `${String(row.id ?? "entry")}_bronze`,
      eventDate: "2026-04-01",
      result: "bronze",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      ...row,
      id: `${String(row.id ?? "entry")}_silver`,
      eventDate: "2026-05-01",
      result: "silver",
      createdAt: "2026-05-01T12:00:00.000Z",
    },
    {
      ...row,
      id: `${String(row.id ?? "entry")}_gold`,
      eventDate: "2026-06-01",
      result: "gold",
      createdAt: "2026-06-01T12:00:00.000Z",
    },
  ];
}

function sortedCounts(values: ReadonlyMap<string, number>): BucketCounts {
  return Object.fromEntries(
    [...values.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function focusEvidence(
  focus: CompetitionTrainingSkillFocus | null,
): AnalyticsEvidence["trainingFocus"] {
  return focus
    ? {
        summaryLabel: focus.summaryLabel,
        highConfidence: focus.highConfidence,
      }
    : null;
}

function evaluateAnalytics(
  rows: readonly MatchSignalsCompetitionRow[],
): AnalyticsEvidence {
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  const aggregate = aggregateCompetitionMatchSignals(rows);
  const historyRows = historyScaffold(row);
  const focus = deriveCompetitionTrainingSkillFocus({
    competitionsWithMatches: historyRows,
  });
  const history = deriveCompetitionBucketHistorySignals(historyRows);

  return {
    lossBuckets: sortedCounts(aggregate.lossBuckets),
    winBuckets: sortedCounts(aggregate.winBuckets),
    primaryBucket: inferPrimaryTrainingSkillBucketForCompetitionEntry(row),
    trainingFocus: focusEvidence(focus),
    bucketHistory: history.bucketHistory,
    bucketOutcomeTrends: history.bucketOutcomeTrends,
  };
}

function assertBucketEvidence(
  evidence: AnalyticsEvidence,
  expectedBucket: string | null,
  expectedFocusBucket: string | null = expectedBucket,
): void {
  assert.deepEqual(evidence.winBuckets, {});
  if (!expectedBucket) {
    assert.deepEqual(evidence.lossBuckets, {});
    assert.equal(evidence.primaryBucket, null);
    assert.deepEqual(evidence.bucketHistory, []);
    assert.deepEqual(evidence.bucketOutcomeTrends, {});
  } else {
    assert.deepEqual(evidence.lossBuckets, { [expectedBucket]: 2 });
    assert.equal(evidence.primaryBucket, expectedBucket);
    assert.deepEqual(
      evidence.bucketHistory.map(({ bucket, result }) => ({ bucket, result })),
      [
        { bucket: expectedBucket, result: "3rd" },
        { bucket: expectedBucket, result: "2nd" },
        { bucket: expectedBucket, result: "1st" },
      ],
    );
    assert.deepEqual(evidence.bucketOutcomeTrends, {
      [expectedBucket]: "improving",
    });
  }

  if (!expectedFocusBucket) {
    assert.equal(evidence.trainingFocus, null);
  } else {
    assert.deepEqual(evidence.trainingFocus, {
      summaryLabel:
        expectedFocusBucket === "guard_retention"
          ? "Guard Retention"
          : "Positional Control And Scoring",
      highConfidence: true,
    });
  }
}

function runFixture(input: {
  projectionInput: ProjectSharedCompetitionAnalysisInput;
  expectation: FixtureExpectation;
}): void {
  const legacyRows = input.projectionInput.competitions.map(({ entry: legacyEntry }) =>
    legacyEntry,
  );
  const projectedRows = projectSharedCompetitionAnalysis(input.projectionInput);
  const artifactSetUpdatedAt =
    input.projectionInput.artifactSet?.updatedAt ?? null;
  const readinessRecord = {
    sharedAthleteId: input.projectionInput.sharedAthleteId,
    state: artifactSetUpdatedAt ? ("READY" as const) : ("EMPTY_READY" as const),
    generation: 1,
    startedAt: "2026-06-24T12:00:00.000Z",
    resolvedAt: "2026-06-24T12:01:00.000Z",
    hydrationSource: "coach_writer_sessions" as const,
    ...(artifactSetUpdatedAt
      ? { artifactSetUpdatedAt }
      : {}),
  };
  const selectionInput = {
    readinessRecord,
    projectedCompetitionAnalysis: {
      entries: projectedRows,
      artifactStoreUpdatedAt: artifactSetUpdatedAt,
    },
    legacyCompetitionEntries: legacyRows,
  };
  const rollbackSelection = assembleCompetitionMatchSignalsInput(
    selectionInput,
    { eligibilityEnabled: false },
  );
  const projectionSelection = assembleCompetitionMatchSignalsInput(
    selectionInput,
    { eligibilityEnabled: true },
  );
  const projectedAnalyticsRows = projectionSelection.entries;

  const legacy = evaluateAnalytics(legacyRows);
  const rollback = evaluateAnalytics(rollbackSelection.entries);
  const projected = evaluateAnalytics(projectedAnalyticsRows);

  assert.equal(rollbackSelection.source, "legacy");
  assert.equal(rollbackSelection.entries, legacyRows);
  assert.deepEqual(rollback, legacy);
  assert.equal(
    projectionSelection.source,
    artifactSetUpdatedAt
      ? "projection_ready"
      : "projection_empty_ready",
  );
  assertBucketEvidence(
    legacy,
    input.expectation.legacyBucket,
    input.expectation.legacyFocusBucket,
  );
  assertBucketEvidence(
    projected,
    input.expectation.projectedBucket,
    input.expectation.projectedFocusBucket,
  );
  assert.deepEqual(
    projectedRows[0]?.matches.map((projectedMatch) => projectedMatch.analysisSource),
    input.expectation.projectedSources,
  );

  if (input.expectation.classification === "parity") {
    assert.deepEqual(projected, legacy);
  } else {
    assert.notDeepEqual(projected, legacy);
  }
}

const GUARD_NOTE = "Needs guard retention";
const POSITIONING_NOTE = "Needs takedown timing";

describe("Shared Competition Analysis analytics parity", () => {
  it("preserves embedded-only analytics", () => {
    runFixture({
      projectionInput: {
        deviceRole: "parent",
        sharedAthleteId: "ath_1",
        competitions: [
          {
            entry: entry({
              matches: [
                match("match_1", GUARD_NOTE),
                match("match_2", GUARD_NOTE),
              ],
            }),
          },
        ],
      },
      expectation: {
        classification: "parity",
        legacyBucket: "guard_retention",
        projectedBucket: "guard_retention",
        projectedSources: [
          "embedded_compatibility",
          "embedded_compatibility",
        ],
      },
    });
  });

  it("exposes artifact-only analysis as an expected authority divergence", () => {
    runFixture({
      projectionInput: {
        deviceRole: "parent",
        sharedAthleteId: "ath_1",
        competitions: [{ entry: entry() }],
        artifactSet: artifactSet([
          { matchLineageKey: "match_1", coachNote: GUARD_NOTE },
          { matchLineageKey: "match_2", coachNote: GUARD_NOTE },
        ]),
      },
      expectation: {
        classification: "expected_authority_divergence",
        legacyBucket: null,
        legacyFocusBucket: "positioning",
        projectedBucket: "guard_retention",
        projectedSources: ["coach_artifact", "coach_artifact"],
      },
    });
  });

  it("exposes overlay-only Coach analysis as an expected authority divergence", () => {
    runFixture({
      projectionInput: {
        deviceRole: "coach",
        sharedAthleteId: "ath_1",
        competitions: [
          {
            entry: entry(),
            coachOverlayAnnotations: [
              { matchLineageKey: "match_1", coachNote: GUARD_NOTE },
              { matchLineageKey: "match_2", coachNote: GUARD_NOTE },
            ],
          },
        ],
        topologyArtifact: topology(),
      },
      expectation: {
        classification: "expected_authority_divergence",
        legacyBucket: null,
        legacyFocusBucket: "positioning",
        projectedBucket: "guard_retention",
        projectedSources: ["coach_overlay", "coach_overlay"],
      },
    });
  });

  it("does not double count identical embedded and artifact analysis", () => {
    runFixture({
      projectionInput: {
        deviceRole: "parent",
        sharedAthleteId: "ath_1",
        competitions: [
          {
            entry: entry({
              matches: [
                match("match_1", GUARD_NOTE),
                match("match_2", GUARD_NOTE),
              ],
            }),
          },
        ],
        artifactSet: artifactSet([
          { matchLineageKey: "match_1", coachNote: GUARD_NOTE },
          { matchLineageKey: "match_2", coachNote: GUARD_NOTE },
        ]),
      },
      expectation: {
        classification: "parity",
        legacyBucket: "guard_retention",
        projectedBucket: "guard_retention",
        projectedSources: ["coach_artifact", "coach_artifact"],
      },
    });
  });

  it("replaces conflicting embedded analysis with artifact authority", () => {
    runFixture({
      projectionInput: {
        deviceRole: "parent",
        sharedAthleteId: "ath_1",
        competitions: [
          {
            entry: entry({
              matches: [
                match("match_1", GUARD_NOTE),
                match("match_2", GUARD_NOTE),
              ],
            }),
          },
        ],
        artifactSet: artifactSet([
          { matchLineageKey: "match_1", coachNote: POSITIONING_NOTE },
          { matchLineageKey: "match_2", coachNote: POSITIONING_NOTE },
        ]),
      },
      expectation: {
        classification: "expected_authority_divergence",
        legacyBucket: "guard_retention",
        projectedBucket: "positioning",
        projectedSources: ["coach_artifact", "coach_artifact"],
      },
    });
  });

  it("replaces conflicting embedded analysis with Coach overlay authority", () => {
    runFixture({
      projectionInput: {
        deviceRole: "coach",
        sharedAthleteId: "ath_1",
        competitions: [
          {
            entry: entry({
              matches: [
                match("match_1", GUARD_NOTE),
                match("match_2", GUARD_NOTE),
              ],
            }),
            coachOverlayAnnotations: [
              { matchLineageKey: "match_1", coachNote: POSITIONING_NOTE },
              { matchLineageKey: "match_2", coachNote: POSITIONING_NOTE },
            ],
          },
        ],
        topologyArtifact: topology(),
      },
      expectation: {
        classification: "expected_authority_divergence",
        legacyBucket: "guard_retention",
        projectedBucket: "positioning",
        projectedSources: ["coach_overlay", "coach_overlay"],
      },
    });
  });

  it("preserves embedded analytics when artifact lineage does not match", () => {
    runFixture({
      projectionInput: {
        deviceRole: "parent",
        sharedAthleteId: "ath_1",
        competitions: [
          {
            entry: entry({
              matches: [
                match("match_1", GUARD_NOTE),
                match("match_2", GUARD_NOTE),
              ],
            }),
          },
        ],
        artifactSet: artifactSet([
          { matchLineageKey: "other_1", coachNote: POSITIONING_NOTE },
          { matchLineageKey: "other_2", coachNote: POSITIONING_NOTE },
        ]),
      },
      expectation: {
        classification: "parity",
        legacyBucket: "guard_retention",
        projectedBucket: "guard_retention",
        projectedSources: [
          "embedded_compatibility",
          "embedded_compatibility",
        ],
      },
    });
  });

  it("preserves unlinked embedded analytics", () => {
    runFixture({
      projectionInput: {
        deviceRole: "coach",
        sharedAthleteId: "",
        competitions: [
          {
            entry: entry({
              linked: false,
              matches: [
                match("local_1", GUARD_NOTE),
                match("local_2", GUARD_NOTE),
              ],
            }),
            coachOverlayAnnotations: [
              { matchLineageKey: "local_1", coachNote: POSITIONING_NOTE },
              { matchLineageKey: "local_2", coachNote: POSITIONING_NOTE },
            ],
          },
        ],
        topologyArtifact: topology(["local_1", "local_2"]),
      },
      expectation: {
        classification: "parity",
        legacyBucket: "guard_retention",
        projectedBucket: "guard_retention",
        projectedSources: [
          "embedded_compatibility",
          "embedded_compatibility",
        ],
      },
    });
  });

  it("preserves embedded analytics when Coach topology is missing", () => {
    runFixture({
      projectionInput: {
        deviceRole: "coach",
        sharedAthleteId: "ath_1",
        competitions: [
          {
            entry: entry({
              matches: [
                match("match_1", GUARD_NOTE),
                match("match_2", GUARD_NOTE),
              ],
            }),
            coachOverlayAnnotations: [
              { matchLineageKey: "match_1", coachNote: POSITIONING_NOTE },
              { matchLineageKey: "match_2", coachNote: POSITIONING_NOTE },
            ],
          },
        ],
        topologyArtifact: null,
      },
      expectation: {
        classification: "parity",
        legacyBucket: "guard_retention",
        projectedBucket: "guard_retention",
        projectedSources: [
          "embedded_compatibility",
          "embedded_compatibility",
        ],
      },
    });
  });

  it("preserves embedded analytics under the production cardinality fallback", () => {
    runFixture({
      projectionInput: {
        deviceRole: "coach",
        sharedAthleteId: "ath_1",
        competitions: [
          {
            entry: entry({
              matches: [
                match("match_1", GUARD_NOTE),
                match("match_2", GUARD_NOTE),
              ],
            }),
            coachOverlayAnnotations: [
              { matchLineageKey: "match_1", coachNote: POSITIONING_NOTE },
            ],
          },
        ],
        topologyArtifact: topology(["match_1"]),
      },
      expectation: {
        classification: "parity",
        legacyBucket: "guard_retention",
        projectedBucket: "guard_retention",
        projectedSources: [
          "embedded_compatibility",
          "embedded_compatibility",
        ],
      },
    });
  });
});
