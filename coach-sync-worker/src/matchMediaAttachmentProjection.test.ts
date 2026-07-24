import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { attachmentRecordKey } from "../../shared-match-media-publication/src/index.ts";
import {
  isAttachmentProjectionFeatureEnabled,
  projectMatchMediaAttachmentsByAthlete,
  type AttachmentProjectionBucket,
  type ProjectionTopologyArtifact,
} from "./matchMediaAttachmentProjection.ts";

const athlete = "shared_ath_1";
const competition = "shared_comp_1";
const match = "match_1";

const topology: Record<string, ProjectionTopologyArtifact> = {
  [athlete]: {
    sharedAthleteId: athlete,
    competitions: [
      { sharedAthleteId: athlete, sharedCompetitionId: competition, matches: [{ matchLineageKey: match, ordinal: 1 }] },
    ],
  },
};

function attached(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    sharedAthleteId: athlete,
    sharedCompetitionId: competition,
    matchLineageKey: match,
    revision: 1,
    state: "attached",
    matchMediaAssetId: "mma_1",
    objectVersion: "object-v1",
    publishedAt: "2026-07-24T10:00:00.000Z",
    updatedAt: "2026-07-24T10:00:00.000Z",
    ...overrides,
  });
}

function bucket(records: Record<string, string>): AttachmentProjectionBucket & { reads: number } {
  let reads = 0;
  return {
    get: async (key) => {
      reads += 1;
      const value = records[key];
      return value ? { text: async () => value } : null;
    },
    get reads() { return reads; },
  };
}

describe("Match Media Attachment session projection", () => {
  it("is independently closed unless the exact flag is 1", async () => {
    const store = bucket({});
    assert.equal(isAttachmentProjectionFeatureEnabled(undefined), false);
    assert.equal(isAttachmentProjectionFeatureEnabled("0"), false);
    assert.equal(isAttachmentProjectionFeatureEnabled("1"), true);
    assert.deepEqual(await projectMatchMediaAttachmentsByAthlete({ enabled: false, bucket: store, topologyByAthleteId: topology }), {});
    assert.equal(store.reads, 0);
  });

  it("projects only topology-owned safe metadata and excludes object version", async () => {
    const key = attachmentRecordKey({ sharedAthleteId: athlete, sharedCompetitionId: competition, matchLineageKey: match });
    const projected = await projectMatchMediaAttachmentsByAthlete({ enabled: true, bucket: bucket({ [key]: attached() }), topologyByAthleteId: topology });
    assert.deepEqual(projected, {
      [athlete]: {
        schemaVersion: 1,
        sharedAthleteId: athlete,
        attachments: [{
          sharedAthleteId: athlete,
          sharedCompetitionId: competition,
          matchLineageKey: match,
          revision: 1,
          state: "attached",
          matchMediaAssetId: "mma_1",
          publishedAt: "2026-07-24T10:00:00.000Z",
          updatedAt: "2026-07-24T10:00:00.000Z",
        }],
      },
    });
  });

  it("omits absent, malformed, and foreign lineage records fail-closed", async () => {
    const key = attachmentRecordKey({ sharedAthleteId: athlete, sharedCompetitionId: competition, matchLineageKey: match });
    for (const value of ["not-json", attached({ sharedCompetitionId: "foreign_comp" })]) {
      assert.deepEqual(
        await projectMatchMediaAttachmentsByAthlete({ enabled: true, bucket: bucket({ [key]: value }), topologyByAthleteId: topology }),
        {},
      );
    }
  });

  it("preserves tombstones and returns deterministic replay ordering", async () => {
    const key = attachmentRecordKey({ sharedAthleteId: athlete, sharedCompetitionId: competition, matchLineageKey: match });
    const tombstone = JSON.stringify({
      schemaVersion: 1, sharedAthleteId: athlete, sharedCompetitionId: competition, matchLineageKey: match,
      revision: 2, state: "tombstoned", tombstonedAt: "2026-07-24T11:00:00.000Z", updatedAt: "2026-07-24T11:00:00.000Z",
    });
    const store = bucket({ [key]: tombstone });
    const first = await projectMatchMediaAttachmentsByAthlete({ enabled: true, bucket: store, topologyByAthleteId: topology });
    const second = await projectMatchMediaAttachmentsByAthlete({ enabled: true, bucket: store, topologyByAthleteId: topology });
    assert.deepEqual(first, second);
    assert.equal(first[athlete]?.attachments[0]?.state, "tombstoned");
    assert.equal("matchMediaAssetId" in (first[athlete]?.attachments[0] ?? {}), false);
  });
});
