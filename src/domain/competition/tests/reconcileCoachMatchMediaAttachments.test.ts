import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, beforeEach, describe, it } from "node:test";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { reconcileCoachMatchMediaAttachments } from "../reconcileCoachMatchMediaAttachments";
import {
  applyCoachMatchMediaAttachment,
  getCoachMatchMediaAttachment,
  getCoachMatchMediaAttachmentSet,
} from "../../../storage/coachMatchMediaAttachmentStore";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedMatchMediaAttachmentProjection,
} from "../../../types/coachWeeklySync";

const ATHLETE = "shared_ath_1";
const COMP = "shared_comp_1";
const MATCH = "match_lineage_1";
const UPDATED = "2026-07-24T12:00:00.000Z";

const storage = new Map<string, string>();
const originalGetItem = AsyncStorage.getItem;
const originalSetItem = AsyncStorage.setItem;

function attached(
  revision: number,
  overrides: Partial<Extract<SyncedMatchMediaAttachmentProjection, { state: "attached" }>> = {},
): SyncedMatchMediaAttachmentProjection {
  return {
    sharedAthleteId: ATHLETE,
    sharedCompetitionId: COMP,
    matchLineageKey: MATCH,
    revision,
    state: "attached",
    matchMediaAssetId: `mma_asset_r${revision}`,
    publishedAt: UPDATED,
    updatedAt: UPDATED,
    ...overrides,
  };
}

function tombstoned(revision: number): SyncedMatchMediaAttachmentProjection {
  return {
    sharedAthleteId: ATHLETE,
    sharedCompetitionId: COMP,
    matchLineageKey: MATCH,
    revision,
    state: "tombstoned",
    tombstonedAt: UPDATED,
    updatedAt: UPDATED,
  };
}

function session(
  overrides: Partial<CoachWeeklySyncSessionResponse> = {},
): CoachWeeklySyncSessionResponse {
  return {
    coach: { id: "coach_1", displayName: "Coach" },
    weekly: null,
    athletes: [{ id: ATHLETE, name: "Athlete", createdAt: UPDATED }],
    competitions: [],
    ...overrides,
  };
}

function snapshot(
  sessionPayload: CoachWeeklySyncSessionResponse,
  linkMeta: {
    linkTokenNorm?: string;
    writerLinkUpdatedAt?: string;
    writerLinkCreatedAt?: string;
  } = {},
) {
  return {
    linkTokenNorm: linkMeta.linkTokenNorm ?? "token_a",
    session: sessionPayload,
    writerLinkUpdatedAt: linkMeta.writerLinkUpdatedAt ?? "2026-07-24T12:00:00.000Z",
    writerLinkCreatedAt: linkMeta.writerLinkCreatedAt ?? "2026-07-24T11:00:00.000Z",
  };
}

beforeEach(() => {
  storage.clear();
  (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
  AsyncStorage.getItem = async (key: string) => storage.get(key) ?? null;
  AsyncStorage.setItem = async (key: string, value: string) => {
    storage.set(key, value);
  };
});

after(() => {
  AsyncStorage.getItem = originalGetItem;
  AsyncStorage.setItem = originalSetItem;
});

describe("reconcileCoachMatchMediaAttachments", () => {
  it("applies newer revisions from writer sessions", async () => {
    await applyCoachMatchMediaAttachment(attached(1));

    await reconcileCoachMatchMediaAttachments({
      totalActiveWriterCount: 1,
      successfulSnapshots: [
        snapshot(
          session({
            matchMediaAttachmentsByAthleteId: {
              [ATHLETE]: {
                schemaVersion: 1,
                sharedAthleteId: ATHLETE,
                attachments: [attached(4)],
              },
            },
          }),
        ),
      ],
    });

    assert.equal(
      (
        await getCoachMatchMediaAttachment({
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMP,
          matchLineageKey: MATCH,
        })
      )?.revision,
      4,
    );
  });

  it("rejects stale remote revisions while keeping local", async () => {
    await applyCoachMatchMediaAttachment(attached(5));

    await reconcileCoachMatchMediaAttachments({
      totalActiveWriterCount: 1,
      successfulSnapshots: [
        snapshot(
          session({
            matchMediaAttachmentsByAthleteId: {
              [ATHLETE]: {
                schemaVersion: 1,
                sharedAthleteId: ATHLETE,
                attachments: [attached(2)],
              },
            },
          }),
        ),
      ],
    });

    assert.equal(
      (
        await getCoachMatchMediaAttachment({
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMP,
          matchLineageKey: MATCH,
        })
      )?.revision,
      5,
    );
  });

  it("no-ops identical equal-revision replay and preserves equal-revision conflicts", async () => {
    await applyCoachMatchMediaAttachment(attached(1, { matchMediaAssetId: "mma_keep" }));
    await applyCoachMatchMediaAttachment(
      attached(1, {
        matchLineageKey: "conflict_match",
        matchMediaAssetId: "mma_conflict_local",
        publishedAt: "2026-07-24T15:00:00.000Z",
      }),
    );

    await reconcileCoachMatchMediaAttachments({
      totalActiveWriterCount: 1,
      successfulSnapshots: [
        snapshot(
          session({
            matchMediaAttachmentsByAthleteId: {
              [ATHLETE]: {
                schemaVersion: 1,
                sharedAthleteId: ATHLETE,
                attachments: [
                  attached(1, { matchMediaAssetId: "mma_keep" }),
                  attached(1, {
                    matchLineageKey: "conflict_match",
                    matchMediaAssetId: "mma_conflict_remote",
                  }),
                ],
              },
            },
          }),
        ),
      ],
    });

    const conflictRow = await getCoachMatchMediaAttachment({
      sharedAthleteId: ATHLETE,
      sharedCompetitionId: COMP,
      matchLineageKey: "conflict_match",
    });
    assert.equal(conflictRow?.state, "attached");
    assert.equal(
      (conflictRow as Extract<SyncedMatchMediaAttachmentProjection, { state: "attached" }>)
        .matchMediaAssetId,
      "mma_conflict_local",
    );
    const keepRow = await getCoachMatchMediaAttachment({
      sharedAthleteId: ATHLETE,
      sharedCompetitionId: COMP,
      matchLineageKey: MATCH,
    });
    assert.equal(keepRow?.state, "attached");
    assert.equal(
      (keepRow as Extract<SyncedMatchMediaAttachmentProjection, { state: "attached" }>)
        .matchMediaAssetId,
      "mma_keep",
    );
  });

  it("applies tombstones and preserves on omission / empty map / missing athlete / absent match", async () => {
    await applyCoachMatchMediaAttachment(attached(1));
    await applyCoachMatchMediaAttachment(
      attached(1, {
        matchLineageKey: "match_keep",
        matchMediaAssetId: "mma_keep_match",
      }),
    );

    await reconcileCoachMatchMediaAttachments({
      totalActiveWriterCount: 1,
      successfulSnapshots: [
        snapshot(
          session({
            matchMediaAttachmentsByAthleteId: {
              [ATHLETE]: {
                schemaVersion: 1,
                sharedAthleteId: ATHLETE,
                attachments: [tombstoned(2)],
              },
            },
          }),
        ),
      ],
    });

    assert.equal(
      (
        await getCoachMatchMediaAttachment({
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMP,
          matchLineageKey: MATCH,
        })
      )?.state,
      "tombstoned",
    );
    assert.equal(
      (
        await getCoachMatchMediaAttachment({
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMP,
          matchLineageKey: "match_keep",
        })
      )?.state,
      "attached",
    );

    const beforeOmission = await getCoachMatchMediaAttachmentSet(ATHLETE);

    await reconcileCoachMatchMediaAttachments({
      totalActiveWriterCount: 3,
      successfulSnapshots: [
        snapshot(session({}), { linkTokenNorm: "omit" }),
        snapshot(session({ matchMediaAttachmentsByAthleteId: {} }), {
          linkTokenNorm: "empty",
        }),
        snapshot(
          session({
            matchMediaAttachmentsByAthleteId: {
              shared_ath_other: {
                schemaVersion: 1,
                sharedAthleteId: "shared_ath_other",
                attachments: [],
              },
            },
          }),
          { linkTokenNorm: "other_athlete" },
        ),
      ],
    });

    assert.deepEqual(await getCoachMatchMediaAttachmentSet(ATHLETE), beforeOmission);
  });

  it("wires after topology in coachKidStore with unlink/delete/prune clearing hooks", () => {
    const kidStore = readFileSync("src/storage/coachKidStore.ts", "utf8");
    const topologyIdx = kidStore.indexOf(
      "await reconcileCoachCompetitionTopologyFromWriterSessions(",
    );
    const mediaIdx = kidStore.indexOf("await reconcileCoachMatchMediaAttachments(");
    const trainingIdx = kidStore.indexOf(
      "await reconcileCoachTrainingProofFromWriterSessions(",
    );
    assert.ok(topologyIdx > 0);
    assert.ok(mediaIdx > topologyIdx);
    assert.ok(trainingIdx > mediaIdx);

    assert.match(kidStore, /removeCoachMatchMediaAttachments\(sid\)/);
    assert.match(kidStore, /removeCoachMatchMediaAttachments\(sharedAthleteId\)/);
    assert.match(kidStore, /pruneCoachMatchMediaAttachmentsAfterRosterReconcile/);
    assert.match(kidStore, /pruneCoachMatchMediaAttachments\(remoteUnionIds\)/);
    assert.doesNotMatch(
      kidStore,
      /removeCoachMatchMediaAttachments\([^\)]*activeAthlete/,
    );
  });
});
