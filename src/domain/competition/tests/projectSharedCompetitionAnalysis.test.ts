import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CompetitionDetailMatchSnapshot,
  KidCompetitionEntryWithMatchDetail,
} from "../../../storage/competitionStore";
import type {
  SyncedCoachMatchBreakdownArtifactSet,
  SyncedCompetitionTopologyArtifact,
} from "../../../types/coachWeeklySync";
import {
  mergeCoachBreakdownIntoMatches,
  overlayAnnotationsFromCoachMatchBreakdownArtifactSet,
} from "../mergeCoachBreakdownIntoMatches";
import {
  competitionOverlayAnnotationsFromEmbeddedMatches,
  projectCompetitionCompeteView,
  selectCompetitionOverlayAnnotations,
} from "../projectCompetitionCompeteView";
import { projectSharedCompetitionAnalysis } from "../projectSharedCompetitionAnalysis";

Object.defineProperty(globalThis, "__DEV__", {
  configurable: true,
  value: false,
});

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

function entry(input?: {
  matches?: CompetitionDetailMatchSnapshot[];
  linked?: boolean;
  legacySharedIdOnly?: boolean;
}): KidCompetitionEntryWithMatchDetail {
  const linked = input?.linked ?? true;
  return {
    id: linked ? "shared-comp-comp_1" : "entry_local",
    kidId: "kid_1",
    ...(linked
      ? {
          sharedAthleteId: "ath_1",
          ...(input?.legacySharedIdOnly ? {} : { sharedCompetitionId: "comp_1" }),
        }
      : {}),
    tournamentName: "Dream BJJ",
    eventDate: "2026-04-25",
    result: "silver",
    createdAt: "2026-04-25T12:00:00.000Z",
    updatedAt: "2026-04-25T12:00:00.000Z",
    matches: input?.matches ?? [match("match_1")],
  };
}

function artifactSet(
  matchLineageKey: string,
  coachNote: string,
): SyncedCoachMatchBreakdownArtifactSet {
  return {
    schemaVersion: 1,
    sharedAthleteId: "ath_1",
    updatedAt: "2026-06-23T12:00:00.000Z",
    artifacts: [
      {
        sharedAthleteId: "ath_1",
        sharedCompetitionId: "comp_1",
        matchLineageKey,
        coachNote,
        updatedAt: "2026-06-23T12:00:00.000Z",
      },
    ],
  };
}

function topology(
  matchLineageKeys: readonly string[] = ["match_1"],
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

function firstMatch(
  output: ReturnType<typeof projectSharedCompetitionAnalysis>,
) {
  const projected = output[0]?.matches[0];
  assert.ok(projected);
  return projected;
}

describe("projectSharedCompetitionAnalysis", () => {
  it("preserves embedded-only analysis as compatibility evidence", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      competitions: [{ entry: entry({ matches: [match("match_1", "Embedded note")] }) }],
    });

    assert.deepEqual(firstMatch(output), {
      matchId: "match_1",
      matchResult: "loss",
      outcome: "Points",
      submissionTime: null,
      resolvedCoachAnalysis: "Embedded note",
      analysisSource: "embedded_compatibility",
    });
  });

  it("uses artifact-only analysis through the production artifact and merge helpers", () => {
    const detailEntry = entry();
    const artifacts = artifactSet("match_1", "Artifact note");
    const annotations = overlayAnnotationsFromCoachMatchBreakdownArtifactSet({
      artifactSet: artifacts,
      sharedAthleteId: "ath_1",
      sharedCompetitionId: "comp_1",
      matchLineageKeys: ["match_1"],
    });
    const productionMatches = mergeCoachBreakdownIntoMatches({
      matches: detailEntry.matches,
      overlayAnnotations: annotations,
      sharedAthleteId: "ath_1",
      sharedCompetitionId: "comp_1",
    });

    const output = projectSharedCompetitionAnalysis({
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      competitions: [{ entry: detailEntry }],
      artifactSet: artifacts,
    });

    assert.equal(firstMatch(output).resolvedCoachAnalysis, productionMatches[0]?.coachNote);
    assert.equal(firstMatch(output).analysisSource, "coach_artifact");
  });

  it("uses coach overlay analysis through the production topology projection", () => {
    const detailEntry = entry();
    const overlayAnnotations = [
      { matchLineageKey: "match_1", coachNote: "Overlay note" },
    ];
    const topologyArtifact = topology();
    const production = projectCompetitionCompeteView({
      shell: detailEntry,
      topologyArtifact,
      overlayAnnotations,
      fallbackMatches: detailEntry.matches,
    });

    const output = projectSharedCompetitionAnalysis({
      deviceRole: "coach",
      sharedAthleteId: "ath_1",
      competitions: [{ entry: detailEntry, coachOverlayAnnotations: overlayAnnotations }],
      topologyArtifact,
    });

    assert.equal(firstMatch(output).resolvedCoachAnalysis, production.matches[0]?.coachNote);
    assert.equal(firstMatch(output).analysisSource, "coach_overlay");
  });

  it("does not duplicate identical embedded and artifact analysis", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      competitions: [{ entry: entry({ matches: [match("match_1", "Same note")] }) }],
      artifactSet: artifactSet("match_1", "Same note"),
    });

    assert.equal(output[0]?.matches.length, 1);
    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Same note");
    assert.equal(firstMatch(output).analysisSource, "coach_artifact");
  });

  it("gives artifact analysis precedence over conflicting embedded analysis", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      competitions: [{ entry: entry({ matches: [match("match_1", "Embedded note")] }) }],
      artifactSet: artifactSet("match_1", "Artifact note"),
    });

    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Artifact note");
    assert.equal(firstMatch(output).analysisSource, "coach_artifact");
  });

  it("gives coach overlay analysis precedence over conflicting embedded analysis", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "coach",
      sharedAthleteId: "ath_1",
      competitions: [
        {
          entry: entry({ matches: [match("match_1", "Embedded note")] }),
          coachOverlayAnnotations: [
            { matchLineageKey: "match_1", coachNote: "Overlay note" },
          ],
        },
      ],
      topologyArtifact: topology(),
    });

    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Overlay note");
    assert.equal(firstMatch(output).analysisSource, "coach_overlay");
  });

  it("keeps embedded compatibility analysis when artifact lineage does not match", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      competitions: [{ entry: entry({ matches: [match("match_1", "Embedded note")] }) }],
      artifactSet: artifactSet("other_match", "Unattached artifact note"),
    });

    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Embedded note");
    assert.equal(firstMatch(output).analysisSource, "embedded_compatibility");
  });

  it("preserves production detail fallback when topology is missing", () => {
    const detailEntry = entry({ matches: [match("match_1", "Embedded note")] });
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "coach",
      sharedAthleteId: "ath_1",
      competitions: [
        {
          entry: detailEntry,
          coachOverlayAnnotations: [
            { matchLineageKey: "match_1", coachNote: "Overlay note" },
          ],
        },
      ],
      topologyArtifact: null,
    });

    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Embedded note");
    assert.equal(firstMatch(output).analysisSource, "embedded_compatibility");
  });

  it("preserves production cardinality fallback instead of attaching overlays", () => {
    const detailEntry = entry({
      matches: [match("match_1", "Embedded one"), match("match_2", "Embedded two")],
    });
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "coach",
      sharedAthleteId: "ath_1",
      competitions: [
        {
          entry: detailEntry,
          coachOverlayAnnotations: [
            { matchLineageKey: "match_1", coachNote: "Overlay note" },
          ],
        },
      ],
      topologyArtifact: topology(["match_1"]),
    });

    assert.deepEqual(
      output[0]?.matches.map((projected) => [
        projected.resolvedCoachAnalysis,
        projected.analysisSource,
      ]),
      [
        ["Embedded one", "embedded_compatibility"],
        ["Embedded two", "embedded_compatibility"],
      ],
    );
  });

  it("uses detail and embedded compatibility analysis for unlinked competitions", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "coach",
      sharedAthleteId: "",
      competitions: [
        {
          entry: entry({
            linked: false,
            matches: [match("local_match", "Local note")],
          }),
          coachOverlayAnnotations: [
            { matchLineageKey: "local_match", coachNote: "Ignored overlay" },
          ],
        },
      ],
      topologyArtifact: topology(["local_match"]),
    });

    assert.equal(output[0]?.sharedCompetitionId, null);
    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Local note");
    assert.equal(firstMatch(output).analysisSource, "embedded_compatibility");
  });

  it("uses the shared Coach annotation selector for hydrated and compatibility inputs", () => {
    const fallbackMatches = [match("match_1", "Embedded note")];
    const hydrated = [{ matchLineageKey: "match_1", coachNote: "Overlay note" }];
    const embeddedAnnotations =
      competitionOverlayAnnotationsFromEmbeddedMatches(fallbackMatches);

    assert.deepEqual(
      selectCompetitionOverlayAnnotations({
        hydratedAnnotations: hydrated,
        embeddedAnnotations,
      }),
      {
        annotations: hydrated,
        source: "hydrated_annotations",
      },
    );
    assert.deepEqual(
      selectCompetitionOverlayAnnotations({
        hydratedAnnotations: [],
        embeddedAnnotations,
      }),
      {
        annotations: [{ matchLineageKey: "match_1", coachNote: "Embedded note" }],
        source: "embedded_compatibility",
      },
    );
  });

  it("classifies explicit shared worker identity as linked", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      competitions: [{ entry: entry() }],
      artifactSet: artifactSet("match_1", "Artifact note"),
    });

    assert.equal(output[0]?.sharedCompetitionId, "comp_1");
    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Artifact note");
    assert.equal(firstMatch(output).analysisSource, "coach_artifact");
  });

  it("recovers legacy shared-comp worker identity for linked projection", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "parent",
      sharedAthleteId: "ath_1",
      competitions: [{ entry: entry({ legacySharedIdOnly: true }) }],
      artifactSet: artifactSet("match_1", "Artifact note"),
    });

    assert.equal(output[0]?.sharedCompetitionId, "comp_1");
    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Artifact note");
    assert.equal(firstMatch(output).analysisSource, "coach_artifact");
  });

  it("does not treat missing linked athlete scope as local authority", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "parent",
      sharedAthleteId: "",
      competitions: [{ entry: entry({ matches: [match("match_1", "Embedded note")] }) }],
      artifactSet: artifactSet("match_1", "Artifact note"),
    });

    assert.equal(output[0]?.sharedCompetitionId, "comp_1");
    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Embedded note");
    assert.equal(firstMatch(output).analysisSource, "embedded_compatibility");
  });

  it("does not apply linked Coach inputs under a mismatched athlete scope", () => {
    const output = projectSharedCompetitionAnalysis({
      deviceRole: "coach",
      sharedAthleteId: "ath_2",
      competitions: [
        {
          entry: entry({ matches: [match("match_1", "Embedded note")] }),
          coachOverlayAnnotations: [
            { matchLineageKey: "match_1", coachNote: "Overlay note" },
          ],
        },
      ],
      topologyArtifact: topology(),
    });

    assert.equal(output[0]?.sharedCompetitionId, "comp_1");
    assert.equal(firstMatch(output).resolvedCoachAnalysis, "Embedded note");
    assert.equal(firstMatch(output).analysisSource, "embedded_compatibility");
  });
});
