import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  __setCompetitionStateAuditorRingStorageForTests,
  appendCompetitionStateSnapshot,
  loadCompetitionStateAuditorRing,
} from "../competitionStateAuditorRing";
import {
  COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
  COMPETITION_STATE_AUDITOR_RING_MAX,
  type ParentCanonicalSnapshot,
} from "../competitionStateAuditorContract";
import { projectCompetitionDomainBlockFromIds } from "../projectCompetitionDomainBlock";

describe("competitionStateAuditorRing", () => {
  it("keeps only the most recent snapshots", async () => {
    const store = new Map<string, string>();
    __setCompetitionStateAuditorRingStorageForTests({
      getItem: async (key) => store.get(key) ?? null,
      setItem: async (key, value) => {
        store.set(key, value);
      },
    });

    for (let index = 0; index < COMPETITION_STATE_AUDITOR_RING_MAX + 3; index += 1) {
      const snapshot: ParentCanonicalSnapshot = {
        contractVersion: COMPETITION_STATE_AUDITOR_CONTRACT_VERSION,
        snapshotKind: "parent_canonical",
        transitionId: `tx-${index}`,
        capturedAt: `2026-06-25T12:00:0${index % 10}.000Z`,
        deviceRole: "parent",
        sharedAthleteId: "athlete_ring",
        generation: index,
        domain: projectCompetitionDomainBlockFromIds([`comp_${index}`]),
        localOnlyCompetitionIds: [],
      };
      await appendCompetitionStateSnapshot(snapshot);
    }

    const ring = await loadCompetitionStateAuditorRing();
    assert.equal(ring.snapshots.length, COMPETITION_STATE_AUDITOR_RING_MAX);
    assert.equal(ring.snapshots[0]?.transitionId, "tx-3");
    assert.equal(ring.snapshots.at(-1)?.transitionId, `tx-${COMPETITION_STATE_AUDITOR_RING_MAX + 2}`);

    __setCompetitionStateAuditorRingStorageForTests(null);
  });
});
