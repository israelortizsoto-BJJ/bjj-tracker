import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SyncedCompetitionTopologyArtifact } from "../../types/coachWeeklySync";
import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { KidCompetitionEntry } from "../../types/coachKid";

import { AUTHORITY_SNAPSHOT_CONTRACT_VERSION } from "../authoritySnapshotContract";
import { captureTopologySnapshot } from "../captureTopologySnapshot";
import { TOPOLOGY_SNAPSHOT_CONTRACT_VERSION } from "../topologySnapshotContract";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const OAI = "shared_ath_alice";

function coachAuthority() {
  return {
    contractVersion: AUTHORITY_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: CAPTURED_AT,
    deviceRole: "coach" as const,
    resolvedOperatingAthleteId: OAI,
    parentActiveAthleteId: OAI,
    authorityBootstrapState: "ready" as const,
    coachSessionRefreshDegraded: false,
    operatingAthleteRosterCount: 1,
    linkedSharedAthleteIds: [OAI],
  };
}

function topologyArtifact(matchCount: number): SyncedCompetitionTopologyArtifact {
  return {
    schemaVersion: 1,
    sharedAthleteId: OAI,
    updatedAt: "2026-06-19T11:00:00.000Z",
    competitions: [
      {
        sharedCompetitionId: "comp_1",
        sharedAthleteId: OAI,
        competitionLineageKey: "lineage_comp_1",
        updatedAt: "2026-06-18T10:00:00.000Z",
        matches: Array.from({ length: matchCount }, (_, index) => ({
          matchLineageKey: `mlk_${index}`,
          ordinal: index + 1,
          result: "win" as const,
          finishType: "points" as const,
          durationSeconds: 90,
        })),
      },
    ],
  };
}

function shell(): KidCompetitionEntry {
  return {
    id: "entry_1",
    kidId: "kid_1",
    tournamentName: "Open",
    eventDate: "2026-06-01",
    createdAt: CAPTURED_AT,
    updatedAt: CAPTURED_AT,
    sharedAthleteId: OAI,
    sharedCompetitionId: "comp_1",
  };
}

function matchSnapshot(id: string, matchResult: "win" | "loss"): CompetitionDetailMatchSnapshot {
  return {
    id,
    matchResult,
    outcome: "Points",
    submissionTime: null,
    imageUri: null,
    videoUri: null,
    imageAssetId: null,
    videoAssetId: null,
  };
}

describe("captureTopologySnapshot", () => {
  it("rejects non-coach authority deviceRole", async () => {
    await assert.rejects(
      () =>
        captureTopologySnapshot({
          authority: {
            ...coachAuthority(),
            deviceRole: "parent",
          },
        }),
      /deviceRole must be coach/,
    );
  });

  it("captures memory_not_loaded before disk hydration", async () => {
    const callOrder: string[] = [];
    const diskArtifact = topologyArtifact(2);

    const snapshot = await captureTopologySnapshot({
      authority: coachAuthority(),
      capturedAt: CAPTURED_AT,
      isSyncConfigured: () => true,
      isMemoryLoaded: () => {
        callOrder.push("memoryLoaded");
        return false;
      },
      peekOutcome: (athleteId) => {
        callOrder.push("peek");
        assert.equal(athleteId, OAI);
        return { outcome: "memory_not_loaded", artifact: null };
      },
      readDiskArtifact: async (athleteId) => {
        callOrder.push("disk");
        assert.equal(athleteId, OAI);
        return diskArtifact;
      },
      getCompetitionShells: async () => [shell()],
      getEntriesWithMatchDetail: async () => [
        {
          ...shell(),
          matches: [matchSnapshot("mlk_0", "win"), matchSnapshot("mlk_1", "win")],
        },
      ],
    });

    assert.deepEqual(callOrder, ["memoryLoaded", "peek", "disk"]);
    assert.equal(snapshot.athleteDomain.memoryLoaded, false);
    assert.equal(snapshot.athleteDomain.peekOutcome, "memory_not_loaded");
    assert.equal(snapshot.athleteDomain.diskPresent, true);
    assert.equal(snapshot.athleteDomain.diskMatchCount, 2);
    assert.equal(snapshot.contractVersion, TOPOLOGY_SNAPSHOT_CONTRACT_VERSION);
  });

  it("captures peek hit with projectionSource mapping", async () => {
    const peekArtifact = topologyArtifact(2);

    const snapshot = await captureTopologySnapshot({
      authority: coachAuthority(),
      capturedAt: CAPTURED_AT,
      isSyncConfigured: () => true,
      isMemoryLoaded: () => true,
      peekOutcome: () => ({ outcome: "hit", artifact: peekArtifact }),
      readDiskArtifact: async () => peekArtifact,
      getCompetitionShells: async () => [shell()],
      getEntriesWithMatchDetail: async () => [
        {
          ...shell(),
          matches: [matchSnapshot("mlk_0", "win")],
        },
      ],
    });

    assert.equal(snapshot.athleteDomain.peekOutcome, "hit");
    assert.equal(
      snapshot.athleteDomain.competitions[0]?.projectionSource,
      "topology_projection_used",
    );
  });

  it("captures peek miss with fallback_missing_topology projection", async () => {
    const snapshot = await captureTopologySnapshot({
      authority: coachAuthority(),
      capturedAt: CAPTURED_AT,
      isSyncConfigured: () => true,
      isMemoryLoaded: () => true,
      peekOutcome: () => ({ outcome: "miss", artifact: null }),
      readDiskArtifact: async () => null,
      getCompetitionShells: async () => [shell()],
      getEntriesWithMatchDetail: async () => [
        {
          ...shell(),
          matches: [matchSnapshot("mlk_0", "win")],
        },
      ],
    });

    assert.equal(snapshot.athleteDomain.peekOutcome, "miss");
    assert.equal(
      snapshot.athleteDomain.competitions[0]?.projectionSource,
      "fallback_missing_topology",
    );
  });

  it("maps fallback_cardinality_guard when topology rows are fewer than fallback detail", async () => {
    const peekArtifact = topologyArtifact(1);

    const snapshot = await captureTopologySnapshot({
      authority: coachAuthority(),
      capturedAt: CAPTURED_AT,
      isSyncConfigured: () => true,
      isMemoryLoaded: () => true,
      peekOutcome: () => ({ outcome: "hit", artifact: peekArtifact }),
      readDiskArtifact: async () => peekArtifact,
      getCompetitionShells: async () => [shell()],
      getEntriesWithMatchDetail: async () => [
        {
          ...shell(),
          matches: [matchSnapshot("mlk_0", "win"), matchSnapshot("mlk_1", "loss")],
        },
      ],
    });

    assert.equal(
      snapshot.athleteDomain.competitions[0]?.projectionSource,
      "fallback_cardinality_guard",
    );
  });
});
