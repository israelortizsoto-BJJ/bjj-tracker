import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SyncedMatchMediaAttachmentProjection } from "../../types/coachWeeklySync";
import { StorageKeys } from "../storageKeys";
import {
  applyCoachMatchMediaAttachment,
  applyCoachMatchMediaAttachmentSet,
  getCoachMatchMediaAttachment,
  getCoachMatchMediaAttachmentSet,
  pruneCoachMatchMediaAttachments,
  removeCoachMatchMediaAttachments,
  toProjectionSafeMatchMediaAttachment,
} from "../coachMatchMediaAttachmentStore";

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

function tombstoned(
  revision: number,
  overrides: Partial<Extract<SyncedMatchMediaAttachmentProjection, { state: "tombstoned" }>> = {},
): SyncedMatchMediaAttachmentProjection {
  return {
    sharedAthleteId: ATHLETE,
    sharedCompetitionId: COMP,
    matchLineageKey: MATCH,
    revision,
    state: "tombstoned",
    tombstonedAt: UPDATED,
    updatedAt: UPDATED,
    ...overrides,
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

describe("coachMatchMediaAttachmentStore", () => {
  it("writes attached metadata and replaces on newer revision", async () => {
    const first = await applyCoachMatchMediaAttachment(attached(1));
    assert.equal(first.status, "written");
    assert.deepEqual(await getCoachMatchMediaAttachment({
      sharedAthleteId: ATHLETE,
      sharedCompetitionId: COMP,
      matchLineageKey: MATCH,
    }), attached(1));

    const next = await applyCoachMatchMediaAttachment(attached(2, {
      matchMediaAssetId: "mma_asset_r2",
      updatedAt: "2026-07-24T13:00:00.000Z",
      publishedAt: "2026-07-24T13:00:00.000Z",
    }));
    assert.equal(next.status, "written");
    if (next.status === "written") {
      assert.equal(next.previousRevision, 1);
      assert.equal(next.incomingRevision, 2);
    }
    assert.equal(
      (await getCoachMatchMediaAttachment({
        sharedAthleteId: ATHLETE,
        sharedCompetitionId: COMP,
        matchLineageKey: MATCH,
      }))?.state,
      "attached",
    );
    assert.equal(
      (
        await getCoachMatchMediaAttachment({
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMP,
          matchLineageKey: MATCH,
        }) as Extract<SyncedMatchMediaAttachmentProjection, { state: "attached" }>
      ).matchMediaAssetId,
      "mma_asset_r2",
    );
  });

  it("rejects stale revisions", async () => {
    await applyCoachMatchMediaAttachment(attached(3));
    const stale = await applyCoachMatchMediaAttachment(attached(2));
    assert.deepEqual(stale, {
      status: "rejected_stale",
      sharedAthleteId: ATHLETE,
      sharedCompetitionId: COMP,
      matchLineageKey: MATCH,
      incomingRevision: 2,
      existingRevision: 3,
    });
    assert.equal(
      (await getCoachMatchMediaAttachment({
        sharedAthleteId: ATHLETE,
        sharedCompetitionId: COMP,
        matchLineageKey: MATCH,
      }))?.revision,
      3,
    );
  });

  it("treats equal-revision identical payloads as no-ops", async () => {
    await applyCoachMatchMediaAttachment(attached(1));
    const replay = await applyCoachMatchMediaAttachment(attached(1));
    assert.equal(replay.status, "noop_identical");
  });

  it("preserves existing record on equal-revision conflicting payloads", async () => {
    await applyCoachMatchMediaAttachment(attached(1, { matchMediaAssetId: "mma_keep" }));
    const conflict = await applyCoachMatchMediaAttachment(
      attached(1, { matchMediaAssetId: "mma_other", publishedAt: "2026-07-24T14:00:00.000Z" }),
    );
    assert.equal(conflict.status, "preserved_equal_revision_conflict");
    assert.deepEqual(
      await getCoachMatchMediaAttachment({
        sharedAthleteId: ATHLETE,
        sharedCompetitionId: COMP,
        matchLineageKey: MATCH,
      }),
      attached(1, { matchMediaAssetId: "mma_keep" }),
    );
  });

  it("applies explicit tombstones as authoritative removals of active media", async () => {
    await applyCoachMatchMediaAttachment(attached(1));
    const outcome = await applyCoachMatchMediaAttachment(tombstoned(2));
    assert.equal(outcome.status, "written");
    assert.deepEqual(
      await getCoachMatchMediaAttachment({
        sharedAthleteId: ATHLETE,
        sharedCompetitionId: COMP,
        matchLineageKey: MATCH,
      }),
      tombstoned(2),
    );
  });

  it("does not delete absent matches when applying a partial set", async () => {
    await applyCoachMatchMediaAttachment(attached(1));
    await applyCoachMatchMediaAttachment(
      attached(1, {
        matchLineageKey: "match_lineage_2",
        matchMediaAssetId: "mma_other_match",
      }),
    );

    await applyCoachMatchMediaAttachmentSet({
      schemaVersion: 1,
      sharedAthleteId: ATHLETE,
      attachments: [attached(2)],
    });

    const set = await getCoachMatchMediaAttachmentSet(ATHLETE);
    assert.equal(set?.attachments.length, 2);
    assert.equal(
      set?.attachments.find((row) => row.matchLineageKey === "match_lineage_2")?.revision,
      1,
    );
    assert.equal(
      set?.attachments.find((row) => row.matchLineageKey === MATCH)?.revision,
      2,
    );
  });

  it("clears on remove and prune", async () => {
    await applyCoachMatchMediaAttachment(attached(1));
    await applyCoachMatchMediaAttachment(
      attached(1, {
        sharedAthleteId: "shared_ath_2",
        matchMediaAssetId: "mma_ath2",
      }),
    );

    await removeCoachMatchMediaAttachments(ATHLETE);
    assert.equal(await getCoachMatchMediaAttachmentSet(ATHLETE), null);
    assert.ok(await getCoachMatchMediaAttachmentSet("shared_ath_2"));

    await pruneCoachMatchMediaAttachments(new Set([ATHLETE]));
    assert.equal(await getCoachMatchMediaAttachmentSet("shared_ath_2"), null);
  });

  it("persists only projection-safe fields and strips unsafe media data", async () => {
    const unsafe = {
      ...attached(1),
      objectKey: "attachments/secret.bin",
      objectVersion: "ver-1",
      signedUrl: "https://evil.example/video",
      credential: "tok_secret",
    } as unknown as SyncedMatchMediaAttachmentProjection;

    const safe = toProjectionSafeMatchMediaAttachment(unsafe);
    assert.deepEqual(safe, attached(1));
    assert.equal(safe && "objectKey" in safe, false);
    assert.equal(safe && "signedUrl" in safe, false);

    await applyCoachMatchMediaAttachment(unsafe);
    const persistedRaw = storage.get(StorageKeys.coachMatchMediaAttachmentsByAthleteId);
    assert.ok(persistedRaw);
    assert.equal(persistedRaw.includes("signedUrl"), false);
    assert.equal(persistedRaw.includes("objectKey"), false);
    assert.equal(persistedRaw.includes("objectVersion"), false);
    assert.equal(persistedRaw.includes("credential"), false);
    assert.equal(persistedRaw.includes("mma_asset_r1"), true);
  });
});
