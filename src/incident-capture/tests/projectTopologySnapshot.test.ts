import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SyncedCompetitionTopologyArtifact } from "../../types/coachWeeklySync";

import {
  MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION,
  TOPOLOGY_SNAPSHOT_CONTRACT_VERSION,
} from "../topologySnapshotContract";
import { projectTopologySnapshot } from "../projectTopologySnapshot";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const OAI = "shared_ath_alice";

function artifact(updatedAt: string, matchKeys: string[]): SyncedCompetitionTopologyArtifact {
  return {
    schemaVersion: 1,
    sharedAthleteId: OAI,
    updatedAt,
    competitions: [
      {
        sharedCompetitionId: "comp_1",
        sharedAthleteId: OAI,
        competitionLineageKey: "lineage_comp_1",
        updatedAt: "2026-06-18T10:00:00.000Z",
        matches: matchKeys.map((matchLineageKey, index) => ({
          matchLineageKey,
          ordinal: index + 1,
          result: "win" as const,
          finishType: "points" as const,
          durationSeconds: 120,
        })),
      },
    ],
  };
}

describe("projectTopologySnapshot", () => {
  it("maps memory_not_loaded peek outcome", () => {
    const snapshot = projectTopologySnapshot({
      capturedAt: CAPTURED_AT,
      syncConfigured: true,
      captureMode: "coach_substrate_probe",
      athleteDomain: {
        sharedAthleteId: OAI,
        memoryLoaded: false,
        peekOutcome: "memory_not_loaded",
        peekArtifact: null,
        diskArtifact: null,
        competitionProbes: [],
      },
    });

    assert.equal(snapshot.contractVersion, TOPOLOGY_SNAPSHOT_CONTRACT_VERSION);
    assert.equal(snapshot.athleteDomain.memoryLoaded, false);
    assert.equal(snapshot.athleteDomain.peekOutcome, "memory_not_loaded");
    assert.equal(snapshot.athleteDomain.peekArtifactUpdatedAt, null);
    assert.equal(snapshot.athleteDomain.diskPresent, false);
  });

  it("maps peek hit with substrate counts", () => {
    const peekArtifact = artifact("2026-06-19T11:00:00.000Z", ["mlk_a", "mlk_b"]);
    const snapshot = projectTopologySnapshot({
      capturedAt: CAPTURED_AT,
      syncConfigured: true,
      captureMode: "coach_substrate_probe",
      athleteDomain: {
        sharedAthleteId: OAI,
        memoryLoaded: true,
        peekOutcome: "hit",
        peekArtifact,
        diskArtifact: peekArtifact,
        competitionProbes: [
          {
            sharedCompetitionId: "comp_1",
            competitionLineageKey: "lineage_comp_1",
            updatedAt: "2026-06-18T10:00:00.000Z",
            matchLineageKeys: ["mlk_a", "mlk_b"],
            projectionSource: "topology_projection_used",
          },
        ],
      },
    });

    assert.equal(snapshot.athleteDomain.peekOutcome, "hit");
    assert.equal(snapshot.athleteDomain.peekCompetitionCount, 1);
    assert.equal(snapshot.athleteDomain.peekMatchCount, 2);
    assert.equal(snapshot.athleteDomain.diskPresent, true);
    assert.equal(snapshot.athleteDomain.competitions[0]?.projectionSource, "topology_projection_used");
    assert.deepEqual(snapshot.athleteDomain.competitions[0]?.matchLineageKeys, ["mlk_a", "mlk_b"]);
  });

  it("maps peek miss when memory is loaded but athlete artifact absent", () => {
    const snapshot = projectTopologySnapshot({
      capturedAt: CAPTURED_AT,
      syncConfigured: true,
      captureMode: "coach_substrate_probe",
      athleteDomain: {
        sharedAthleteId: OAI,
        memoryLoaded: true,
        peekOutcome: "miss",
        peekArtifact: null,
        diskArtifact: null,
        competitionProbes: [],
      },
    });

    assert.equal(snapshot.athleteDomain.peekOutcome, "miss");
    assert.equal(snapshot.athleteDomain.peekCompetitionCount, 0);
    assert.equal(snapshot.athleteDomain.peekMatchCount, 0);
  });

  it("flags memoryDiskDiverged when peek and disk counts differ", () => {
    const peekArtifact = artifact("2026-06-19T11:00:00.000Z", ["mlk_a"]);
    const diskArtifact = artifact("2026-06-19T12:00:00.000Z", ["mlk_a", "mlk_b"]);
    const snapshot = projectTopologySnapshot({
      capturedAt: CAPTURED_AT,
      syncConfigured: true,
      captureMode: "coach_substrate_probe",
      athleteDomain: {
        sharedAthleteId: OAI,
        memoryLoaded: true,
        peekOutcome: "hit",
        peekArtifact,
        diskArtifact,
        competitionProbes: [
          {
            sharedCompetitionId: "comp_1",
            competitionLineageKey: "lineage_comp_1",
            updatedAt: "2026-06-18T10:00:00.000Z",
            matchLineageKeys: ["mlk_a"],
            projectionSource: "fallback_cardinality_guard",
          },
        ],
      },
    });

    assert.equal(snapshot.athleteDomain.memoryDiskDiverged, true);
    assert.equal(snapshot.athleteDomain.diskMatchCount, 2);
    assert.equal(snapshot.athleteDomain.peekMatchCount, 1);
    assert.equal(
      snapshot.athleteDomain.competitions[0]?.projectionSource,
      "fallback_cardinality_guard",
    );
  });

  it("caps matchLineageKeys per competition", () => {
    const keys = Array.from(
      { length: MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION + 5 },
      (_, index) => `mlk_${index}`,
    );
    const snapshot = projectTopologySnapshot({
      capturedAt: CAPTURED_AT,
      syncConfigured: true,
      captureMode: "coach_substrate_probe",
      athleteDomain: {
        sharedAthleteId: OAI,
        memoryLoaded: true,
        peekOutcome: "hit",
        peekArtifact: artifact("2026-06-19T11:00:00.000Z", keys),
        diskArtifact: null,
        competitionProbes: [
          {
            sharedCompetitionId: "comp_1",
            competitionLineageKey: "lineage_comp_1",
            updatedAt: "2026-06-18T10:00:00.000Z",
            matchLineageKeys: keys,
            projectionSource: "topology_projection_used",
          },
        ],
      },
    });

    assert.equal(
      snapshot.athleteDomain.competitions[0]?.matchLineageKeys.length,
      MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION,
    );
    assert.equal(
      snapshot.athleteDomain.competitions[0]?.matchCount,
      MAX_MATCH_LINEAGE_KEYS_PER_COMPETITION,
    );
  });

  it("exports keys only without match result or media fields", () => {
    const snapshot = projectTopologySnapshot({
      capturedAt: CAPTURED_AT,
      syncConfigured: true,
      captureMode: "coach_substrate_probe",
      athleteDomain: {
        sharedAthleteId: OAI,
        memoryLoaded: true,
        peekOutcome: "hit",
        peekArtifact: artifact("2026-06-19T11:00:00.000Z", ["mlk_a"]),
        diskArtifact: null,
        competitionProbes: [
          {
            sharedCompetitionId: "comp_1",
            competitionLineageKey: "lineage_comp_1",
            updatedAt: "2026-06-18T10:00:00.000Z",
            matchLineageKeys: ["mlk_a"],
            projectionSource: "topology_projection_used",
          },
        ],
      },
    });

    const competition = snapshot.athleteDomain.competitions[0];
    assert.ok(competition);
    assert.equal(Object.keys(competition).sort().join(","), [
      "competitionLineageKey",
      "matchCount",
      "matchLineageKeys",
      "projectionSource",
      "sharedCompetitionId",
      "updatedAt",
    ].sort().join(","));
  });
});
