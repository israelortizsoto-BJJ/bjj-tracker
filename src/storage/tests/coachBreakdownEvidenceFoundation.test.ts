import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  CoachWeeklySyncSessionResponse,
  SyncedCoachMatchBreakdownArtifactSet,
} from "../../types/coachWeeklySync";
import {
  getCoachMatchBreakdownArtifactSet,
  writeCoachMatchBreakdownArtifactSet,
} from "../coachMatchBreakdownArtifactStore";
import {
  getCachedWeeklyForLinkToken,
  setCachedWeeklyForLinkToken,
} from "../coachWeeklySyncCacheStore";

const UPDATED_AT = "2026-06-23T12:00:00.000Z";
const LINK_TOKEN = "test-link-token";
const storage = new Map<string, string>();
const originalGetItem = AsyncStorage.getItem;
const originalSetItem = AsyncStorage.setItem;

function artifactSet(
  sharedAthleteId: string,
  updatedAt = UPDATED_AT,
): SyncedCoachMatchBreakdownArtifactSet {
  return {
    schemaVersion: 1,
    sharedAthleteId,
    updatedAt,
    artifacts: [
      {
        sharedAthleteId,
        sharedCompetitionId: "shared_comp_1",
        matchLineageKey: "match_1",
        coachNote: "Stay patient",
        updatedAt,
      },
    ],
  };
}

function session(
  overrides: Partial<CoachWeeklySyncSessionResponse> = {},
): CoachWeeklySyncSessionResponse {
  return {
    coach: { id: "coach_1", displayName: "Coach" },
    weekly: null,
    athletes: [
      {
        id: "shared_ath_1",
        name: "Athlete",
        createdAt: UPDATED_AT,
      },
    ],
    competitions: [],
    coachMatchBreakdownArtifacts: {},
    coachMatchBreakdownArtifactEvidence: {
      fieldClassification: "valid",
      athleteEntryClassificationById: {},
    },
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

describe("coach match breakdown artifact write outcomes", () => {
  it("returns written without changing accepted-write arbitration", async () => {
    const outcome = await writeCoachMatchBreakdownArtifactSet(
      artifactSet("shared_ath_1"),
    );

    assert.deepEqual(outcome, {
      status: "written",
      sharedAthleteId: "shared_ath_1",
      incomingUpdatedAt: UPDATED_AT,
      previousUpdatedAt: null,
      artifactCount: 1,
    });
    assert.deepEqual(
      await getCoachMatchBreakdownArtifactSet("shared_ath_1"),
      artifactSet("shared_ath_1"),
    );
  });

  it("returns rejected_stale and preserves the newer artifact set", async () => {
    const newer = artifactSet("shared_ath_1", "2026-06-24T12:00:00.000Z");
    const older = artifactSet("shared_ath_1", "2026-06-22T12:00:00.000Z");
    await writeCoachMatchBreakdownArtifactSet(newer);

    const outcome = await writeCoachMatchBreakdownArtifactSet(older);

    assert.deepEqual(outcome, {
      status: "rejected_stale",
      sharedAthleteId: "shared_ath_1",
      incomingUpdatedAt: older.updatedAt,
      existingUpdatedAt: newer.updatedAt,
      artifactCount: 1,
    });
    assert.deepEqual(
      await getCoachMatchBreakdownArtifactSet("shared_ath_1"),
      newer,
    );
  });

  it("continues accepting equal-timestamp writes", async () => {
    const first = artifactSet("shared_ath_1");
    const replay = {
      ...artifactSet("shared_ath_1"),
      artifacts: [
        {
          ...artifactSet("shared_ath_1").artifacts[0],
          coachNote: "Updated at the same timestamp",
        },
      ],
    };
    await writeCoachMatchBreakdownArtifactSet(first);

    const outcome = await writeCoachMatchBreakdownArtifactSet(replay);

    assert.deepEqual(outcome, {
      status: "written",
      sharedAthleteId: "shared_ath_1",
      incomingUpdatedAt: UPDATED_AT,
      previousUpdatedAt: UPDATED_AT,
      artifactCount: 1,
    });
    assert.deepEqual(
      await getCoachMatchBreakdownArtifactSet("shared_ath_1"),
      replay,
    );
  });

  it("accepts legacy v1 and v2 alignment while dropping only malformed v2 alignment", async () => {
    const v2: SyncedCoachMatchBreakdownArtifactSet = {
      ...artifactSet("shared_ath_1"),
      schemaVersion: 2,
      artifacts: [{
        ...artifactSet("shared_ath_1").artifacts[0]!,
        alignment: {
          commentaryStartVideoMs: 0,
          matchMediaAssetId: "asset-1",
          attachmentRevision: 1,
        },
      }],
    };
    await writeCoachMatchBreakdownArtifactSet(v2);
    assert.deepEqual(
      (await getCoachMatchBreakdownArtifactSet("shared_ath_1"))?.artifacts[0]?.alignment,
      v2.artifacts[0]?.alignment,
    );

    const malformed: SyncedCoachMatchBreakdownArtifactSet = {
      ...v2,
      artifacts: [{ ...v2.artifacts[0]!, alignment: { commentaryStartVideoMs: -1, matchMediaAssetId: "asset-1", attachmentRevision: 1 } }],
    };
    await writeCoachMatchBreakdownArtifactSet(malformed);
    const retained = await getCoachMatchBreakdownArtifactSet("shared_ath_1");
    assert.equal(retained?.artifacts[0]?.alignment, undefined);
    assert.equal(retained?.artifacts[0]?.coachNote, "Stay patient");
  });

  it("returns rejected_invalid before any persistence write", async () => {
    const invalid = artifactSet("");

    const outcome = await writeCoachMatchBreakdownArtifactSet(invalid);

    assert.deepEqual(outcome, {
      status: "rejected_invalid",
      sharedAthleteId: null,
      reason: "empty_sharedAthleteId",
      artifactCount: 1,
    });
    assert.equal(storage.size, 0);
  });
});

describe("coach weekly cache write outcomes", () => {
  it("collects artifact outcomes and preserves parser evidence through cache reads", async () => {
    const artifact = artifactSet("shared_ath_1");
    const fullSession = session({
      coachMatchBreakdownArtifacts: {
        shared_ath_1: artifact,
      },
      coachMatchBreakdownArtifactEvidence: {
        fieldClassification: "valid",
        athleteEntryClassificationById: {
          shared_ath_1: "populated",
        },
      },
    });

    const outcome = await setCachedWeeklyForLinkToken(
      LINK_TOKEN,
      null,
      UPDATED_AT,
      {},
      fullSession.athletes,
      fullSession,
    );

    assert.equal(outcome.status, "written");
    assert.deepEqual(outcome.artifactWriteOutcomes, [
      {
        status: "written",
        sharedAthleteId: "shared_ath_1",
        incomingUpdatedAt: UPDATED_AT,
        previousUpdatedAt: null,
        artifactCount: 1,
      },
    ]);
    const cached = await getCachedWeeklyForLinkToken(LINK_TOKEN);
    assert.deepEqual(
      cached?.session?.coachMatchBreakdownArtifactEvidence,
      fullSession.coachMatchBreakdownArtifactEvidence,
    );
  });

  it("does not clear an existing artifact set when the session field is omitted", async () => {
    const existing = artifactSet("shared_ath_1");
    await writeCoachMatchBreakdownArtifactSet(existing);
    const omittedSession = session({
      coachMatchBreakdownArtifacts: undefined,
      coachMatchBreakdownArtifactEvidence: {
        fieldClassification: "omitted",
        athleteEntryClassificationById: {},
      },
    });

    const outcome = await setCachedWeeklyForLinkToken(
      LINK_TOKEN,
      null,
      UPDATED_AT,
      {},
      omittedSession.athletes,
      omittedSession,
    );

    assert.deepEqual(outcome.artifactWriteOutcomes, []);
    assert.deepEqual(
      await getCoachMatchBreakdownArtifactSet("shared_ath_1"),
      existing,
    );
  });
});
