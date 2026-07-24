import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PRODUCTION_VERIFICATION_CONTRACT_VERSION,
  admitVerification,
  createConditionalObjectVerificationRecordStore,
  recordStoreKey,
  transitionVerificationTerminal,
  type ProductionVerificationRecord,
} from "../../shared-match-media-production-verification/src/index.ts";
import { PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING } from "../../shared-match-media-production-verification/src/storageBucketBinding.ts";
import {
  attachmentRecordKey,
  handlePublishMatchMediaAttachment,
  isPublicationFeatureEnabled,
  matchMediaAssetStorageObjectKey,
  type MatchMediaPublicationDependencies,
  type PublicationMediaBucket,
} from "./matchMediaPublication.ts";
import { createR2ConditionalObjectStore } from "./productionVerification/r2ConditionalObjectStore.ts";
import type { MatchMediaParentSession } from "./sharedMatchMediaUpload.ts";

const TOKEN = "a".repeat(48);
const PARENT_SECRET = "parent-secret";
const ASSET_ID = "mma_11111111-2222-4333-8444-555555555555";
const OBJECT_VERSION = "sealed-provider-version-1";
const ATHLETE = "shared_ath_1";
const COMPETITION = "shared_comp_1";
const MATCH = "match_1";

const validSession: MatchMediaParentSession = {
  parentWriterSecret: PARENT_SECRET,
  athletes: [{ id: ATHLETE }],
  competitions: [{ id: COMPETITION, sharedAthleteId: ATHLETE }],
  competitionTopologyByAthleteId: {
    [ATHLETE]: {
      competitions: [
        {
          sharedCompetitionId: COMPETITION,
          matches: [{ matchLineageKey: MATCH }],
        },
      ],
    },
  },
};

type FakeEntry = {
  body: string | Uint8Array;
  etag: string;
  version: string;
  customMetadata?: Record<string, string>;
};

function createFakeBucket() {
  const objects = new Map<string, FakeEntry>();
  let etagCounter = 0;
  let mediaByteMutations = 0;

  const bucket: PublicationMediaBucket & {
    putBytes(key: string, body: Uint8Array, version: string): void;
    snapshot(key: string): FakeEntry | undefined;
    mediaByteMutations(): number;
    setVersion(key: string, version: string): void;
  } = {
    putBytes(key, body, version) {
      etagCounter += 1;
      objects.set(key, {
        body,
        etag: `"bytes-${etagCounter}"`,
        version,
      });
    },
    snapshot(key) {
      return objects.get(key);
    },
    mediaByteMutations() {
      return mediaByteMutations;
    },
    setVersion(key, version) {
      const existing = objects.get(key);
      if (!existing) throw new Error(`missing ${key}`);
      objects.set(key, { ...existing, version });
    },
    get: async (key) => {
      const entry = objects.get(key);
      if (!entry) return null;
      const body =
        typeof entry.body === "string"
          ? entry.body
          : new TextDecoder().decode(entry.body);
      return {
        text: async () => body,
        etag: entry.etag,
      };
    },
    put: async (key, value, options) => {
      const existing = objects.get(key);
      if ("etagDoesNotMatch" in options.onlyIf) {
        if (existing) return null;
        etagCounter += 1;
        const etag = `"json-${etagCounter}"`;
        objects.set(key, {
          body: value,
          etag,
          version: `meta-${etagCounter}`,
          customMetadata: options.customMetadata,
        });
        return { etag };
      }
      if (!existing || existing.etag !== options.onlyIf.etagMatches) return null;
      etagCounter += 1;
      const etag = `"json-${etagCounter}"`;
      objects.set(key, {
        body: value,
        etag,
        version: `meta-${etagCounter}`,
        customMetadata: options.customMetadata,
      });
      return { etag };
    },
    head: async (key) => {
      const entry = objects.get(key);
      if (!entry) return null;
      return { version: entry.version };
    },
  };

  const originalPut = bucket.put.bind(bucket);
  bucket.put = async (key, value, options) => {
    if (key.startsWith("match-media/assets/") && key.endsWith("/original")) {
      mediaByteMutations += 1;
    }
    return originalPut(key, value, options);
  };

  return bucket;
}

async function seedVerifiedRecord(
  bucket: PublicationMediaBucket,
  overrides?: Partial<{
    athleteId: string;
    competitionId: string;
    matchLineageKey: string;
    matchMediaAssetId: string;
    objectVersion: string;
    state: "verified" | "rejected" | "failed" | "verifying";
  }>,
): Promise<ProductionVerificationRecord> {
  const matchMediaAssetId = overrides?.matchMediaAssetId ?? ASSET_ID;
  const objectVersion = overrides?.objectVersion ?? OBJECT_VERSION;
  const storageObjectKey = matchMediaAssetStorageObjectKey(matchMediaAssetId);
  const store = createConditionalObjectVerificationRecordStore(
    createR2ConditionalObjectStore(bucket),
  );
  const deps = {
    store,
    now: () => new Date("2026-07-23T12:00:00.000Z"),
    randomId: () => "publication-test-id",
  };
  const admitted = await admitVerification(
    {
      contractVersion: PRODUCTION_VERIFICATION_CONTRACT_VERSION,
      storageBucketBinding: PRODUCTION_MEDIA_STORAGE_BUCKET_BINDING,
      matchMediaAssetId,
      objectVersion,
      storageObjectKey,
      declaredByteCount: 64,
      declaredMimeType: "video/mp4",
      athleteId: overrides?.athleteId ?? ATHLETE,
      competitionId: overrides?.competitionId ?? COMPETITION,
      matchLineageKey: overrides?.matchLineageKey ?? MATCH,
    },
    deps,
  );
  const targetState = overrides?.state ?? "verified";
  if (targetState === "verifying") return admitted.record;
  if (targetState === "verified") {
    return transitionVerificationTerminal(
      {
        admissionKeyHash: admitted.record.admissionKeyHash,
        targetState: "verified",
      },
      deps,
    );
  }
  return transitionVerificationTerminal(
    {
      admissionKeyHash: admitted.record.admissionKeyHash,
      targetState,
      terminalReasonCode:
        targetState === "rejected" ? "MIME_NOT_ALLOWED" : "STORAGE_READ_TRANSIENT",
    },
    deps,
  );
}

function publishRequest(
  overrides: Partial<{
    secret: string;
    idempotencyKey: string;
    body: Record<string, unknown>;
  }> = {},
): Request {
  return new Request(
    `https://worker.test/v1/sessions/${TOKEN}/match-media/attachments`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${overrides.secret ?? PARENT_SECRET}`,
        "Content-Type": "application/json",
        "Idempotency-Key": overrides.idempotencyKey ?? "publish-match-1",
      },
      body: JSON.stringify(
        overrides.body ?? {
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMPETITION,
          matchLineageKey: MATCH,
          matchMediaAssetId: ASSET_ID,
          expectedRevision: 0,
        },
      ),
    },
  );
}

function harness(
  overrides: Partial<MatchMediaPublicationDependencies> = {},
): {
  dependencies: MatchMediaPublicationDependencies;
  bucket: ReturnType<typeof createFakeBucket>;
} {
  const bucket = createFakeBucket();
  bucket.putBytes(
    matchMediaAssetStorageObjectKey(ASSET_ID),
    new Uint8Array([1, 2, 3, 4]),
    OBJECT_VERSION,
  );
  return {
    bucket,
    dependencies: {
      enabled: true,
      mediaBucket: bucket,
      readParentSession: async () => validSession,
      now: () => new Date("2026-07-23T15:00:00.000Z"),
      ...overrides,
    },
  };
}

describe("isPublicationFeatureEnabled", () => {
  it("enables only on exact string 1", () => {
    assert.equal(isPublicationFeatureEnabled("1"), true);
    assert.equal(isPublicationFeatureEnabled("0"), false);
    assert.equal(isPublicationFeatureEnabled(undefined), false);
    assert.equal(isPublicationFeatureEnabled("true"), false);
  });
});

describe("Match Media Publication Worker route", () => {
  it("is unreachable when the independent publication flag is off", async () => {
    const { dependencies, bucket } = harness({ enabled: false });
    await seedVerifiedRecord(bucket);
    const response = await handlePublishMatchMediaAttachment(
      publishRequest(),
      TOKEN,
      dependencies,
    );
    assert.equal(response.status, 404);
    assert.equal(await attachmentBody(bucket), null);
    assert.equal(bucket.mediaByteMutations(), 0);
  });

  it("denies missing or invalid Parent authority", async () => {
    const { dependencies, bucket } = harness();
    await seedVerifiedRecord(bucket);

    const missing = await handlePublishMatchMediaAttachment(
      new Request(
        `https://worker.test/v1/sessions/${TOKEN}/match-media/attachments`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "x",
          },
          body: JSON.stringify({
            sharedAthleteId: ATHLETE,
            sharedCompetitionId: COMPETITION,
            matchLineageKey: MATCH,
            matchMediaAssetId: ASSET_ID,
            expectedRevision: 0,
          }),
        },
      ),
      TOKEN,
      dependencies,
    );
    assert.equal(missing.status, 401);

    const wrong = await handlePublishMatchMediaAttachment(
      publishRequest({ secret: "wrong-secret" }),
      TOKEN,
      dependencies,
    );
    assert.equal(wrong.status, 401);
    assert.equal(await attachmentBody(bucket), null);
  });

  it("denies Match lineage ownership failures opaquely", async () => {
    const { dependencies, bucket } = harness();
    await seedVerifiedRecord(bucket);
    const response = await handlePublishMatchMediaAttachment(
      publishRequest({
        body: {
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMPETITION,
          matchLineageKey: "match-other",
          matchMediaAssetId: ASSET_ID,
          expectedRevision: 0,
        },
      }),
      TOKEN,
      dependencies,
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "Match not found");
    assert.equal(await attachmentBody(bucket), null);
  });

  it("denies missing or ineligible verification", async () => {
    {
      const { dependencies, bucket } = harness();
      const response = await handlePublishMatchMediaAttachment(
        publishRequest(),
        TOKEN,
        dependencies,
      );
      assert.equal(response.status, 422);
      assert.equal((await response.json()).reasonCode, "MEDIA_NOT_VERIFIED");
      assert.equal(await attachmentBody(bucket), null);
    }
    {
      const { dependencies, bucket } = harness();
      await seedVerifiedRecord(bucket, { state: "verifying" });
      const response = await handlePublishMatchMediaAttachment(
        publishRequest(),
        TOKEN,
        dependencies,
      );
      assert.equal(response.status, 422);
      assert.equal((await response.json()).reasonCode, "MEDIA_NOT_VERIFIED");
    }
    {
      const { dependencies, bucket } = harness();
      await seedVerifiedRecord(bucket, { state: "rejected" });
      const response = await handlePublishMatchMediaAttachment(
        publishRequest(),
        TOKEN,
        dependencies,
      );
      assert.equal(response.status, 422);
      assert.equal((await response.json()).reasonCode, "MEDIA_NOT_VERIFIED");
    }
  });

  it("denies verification provenance lineage mismatches", async () => {
    const { dependencies, bucket } = harness();
    await seedVerifiedRecord(bucket, { athleteId: "shared_ath_other" });
    const response = await handlePublishMatchMediaAttachment(
      publishRequest(),
      TOKEN,
      dependencies,
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).reasonCode, "ATHLETE_LINEAGE_MISMATCH");
    assert.equal(await attachmentBody(bucket), null);
  });

  it("binds sealed verified providerVersion and rejects HEAD mismatch", async () => {
    const { dependencies, bucket } = harness();
    const record = await seedVerifiedRecord(bucket);
    assert.equal(record.objectVersion, OBJECT_VERSION);
    assert.equal(record.state, "verified");

    const created = await handlePublishMatchMediaAttachment(
      publishRequest(),
      TOKEN,
      dependencies,
    );
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.outcome, "attached");
    assert.equal(createdBody.reasonCode, "FIRST_ATTACHMENT");
    assert.equal(createdBody.attachment.objectVersion, OBJECT_VERSION);
    assert.equal(createdBody.attachment.matchMediaAssetId, ASSET_ID);
    assert.equal(createdBody.attachment.revision, 1);

    bucket.setVersion(matchMediaAssetStorageObjectKey(ASSET_ID), "head-drifted");
    const drifted = await handlePublishMatchMediaAttachment(
      publishRequest({
        idempotencyKey: "publish-after-drift",
        body: {
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMPETITION,
          matchLineageKey: MATCH,
          matchMediaAssetId: ASSET_ID,
          expectedRevision: 1,
          objectVersion: OBJECT_VERSION,
        },
      }),
      TOKEN,
      {
        ...dependencies,
        now: () => new Date("2026-07-23T15:01:00.000Z"),
      },
    );
    // HEAD version no longer admits the sealed verification identity.
    assert.equal(drifted.status, 422);
    assert.equal((await drifted.json()).reasonCode, "MEDIA_NOT_VERIFIED");
  });

  it("treats client objectVersion as assertion-only against sealed authority", async () => {
    const { dependencies, bucket } = harness();
    await seedVerifiedRecord(bucket);
    const mismatch = await handlePublishMatchMediaAttachment(
      publishRequest({
        body: {
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMPETITION,
          matchLineageKey: MATCH,
          matchMediaAssetId: ASSET_ID,
          expectedRevision: 0,
          objectVersion: "client-forged-version",
        },
      }),
      TOKEN,
      dependencies,
    );
    assert.equal(mismatch.status, 422);
    assert.equal((await mismatch.json()).reasonCode, "OBJECT_VERSION_MISMATCH");
    assert.equal(await attachmentBody(bucket), null);

    const matching = await handlePublishMatchMediaAttachment(
      publishRequest({
        body: {
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMPETITION,
          matchLineageKey: MATCH,
          matchMediaAssetId: ASSET_ID,
          expectedRevision: 0,
          objectVersion: OBJECT_VERSION,
        },
      }),
      TOKEN,
      dependencies,
    );
    assert.equal(matching.status, 201);
    assert.equal((await matching.json()).attachment.objectVersion, OBJECT_VERSION);
  });

  it("supports first attachment, identical replay, stale revision, and replacement", async () => {
    const { dependencies, bucket } = harness();
    await seedVerifiedRecord(bucket);

    const first = await handlePublishMatchMediaAttachment(
      publishRequest(),
      TOKEN,
      dependencies,
    );
    assert.equal(first.status, 201);
    const firstJson = await first.json();
    assert.equal(firstJson.reasonCode, "FIRST_ATTACHMENT");
    const rawAfterFirst = await attachmentBody(bucket);

    const replay = await handlePublishMatchMediaAttachment(
      publishRequest({ idempotencyKey: "publish-replay" }),
      TOKEN,
      dependencies,
    );
    assert.equal(replay.status, 200);
    const replayJson = await replay.json();
    assert.equal(replayJson.outcome, "idempotent");
    assert.equal(replayJson.reasonCode, "IDENTICAL_ATTACHMENT_REPLAY");
    assert.equal(await attachmentBody(bucket), rawAfterFirst);

    const stale = await handlePublishMatchMediaAttachment(
      publishRequest({
        idempotencyKey: "publish-stale",
        body: {
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMPETITION,
          matchLineageKey: MATCH,
          matchMediaAssetId: ASSET_ID,
          expectedRevision: 0,
        },
      }),
      TOKEN,
      {
        ...dependencies,
        now: () => new Date("2026-07-23T15:02:00.000Z"),
      },
    );
    // Identical media short-circuits before stale revision when replaying same attach.
    assert.equal(stale.status, 200);
    assert.equal((await stale.json()).reasonCode, "IDENTICAL_ATTACHMENT_REPLAY");

    const replacementAsset = "mma_22222222-2222-4333-8444-555555555555";
    const replacementVersion = "sealed-provider-version-2";
    bucket.putBytes(
      matchMediaAssetStorageObjectKey(replacementAsset),
      new Uint8Array([9, 9, 9]),
      replacementVersion,
    );
    await seedVerifiedRecord(bucket, {
      matchMediaAssetId: replacementAsset,
      objectVersion: replacementVersion,
    });

    const staleReplace = await handlePublishMatchMediaAttachment(
      publishRequest({
        idempotencyKey: "publish-stale-replace",
        body: {
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMPETITION,
          matchLineageKey: MATCH,
          matchMediaAssetId: replacementAsset,
          expectedRevision: 0,
        },
      }),
      TOKEN,
      {
        ...dependencies,
        now: () => new Date("2026-07-23T15:03:00.000Z"),
      },
    );
    assert.equal(staleReplace.status, 409);
    assert.equal((await staleReplace.json()).reasonCode, "STALE_REVISION");
    assert.equal(await attachmentBody(bucket), rawAfterFirst);

    const replaced = await handlePublishMatchMediaAttachment(
      publishRequest({
        idempotencyKey: "publish-replace",
        body: {
          sharedAthleteId: ATHLETE,
          sharedCompetitionId: COMPETITION,
          matchLineageKey: MATCH,
          matchMediaAssetId: replacementAsset,
          expectedRevision: 1,
        },
      }),
      TOKEN,
      {
        ...dependencies,
        now: () => new Date("2026-07-23T15:04:00.000Z"),
      },
    );
    assert.equal(replaced.status, 200);
    const replacedJson = await replaced.json();
    assert.equal(replacedJson.outcome, "replaced");
    assert.equal(replacedJson.reasonCode, "ATTACHMENT_REPLACED");
    assert.equal(replacedJson.attachment.revision, 2);
    assert.equal(replacedJson.attachment.matchMediaAssetId, replacementAsset);
    assert.equal(replacedJson.attachment.objectVersion, replacementVersion);
  });

  it("converges concurrent first-attachment CAS without double-write corruption", async () => {
    const { dependencies, bucket } = harness();
    await seedVerifiedRecord(bucket);

    const results = await Promise.all([
      handlePublishMatchMediaAttachment(
        publishRequest({ idempotencyKey: "race-a" }),
        TOKEN,
        dependencies,
      ),
      handlePublishMatchMediaAttachment(
        publishRequest({ idempotencyKey: "race-b" }),
        TOKEN,
        {
          ...dependencies,
          now: () => new Date("2026-07-23T15:00:01.000Z"),
        },
      ),
    ]);
    const statuses = results.map((result) => result.status).sort();
    assert.ok(statuses.includes(201) || statuses.every((status) => status === 200));
    for (const result of results) {
      assert.ok([200, 201].includes(result.status));
      const body = await result.json();
      assert.ok(
        ["FIRST_ATTACHMENT", "IDENTICAL_ATTACHMENT_REPLAY"].includes(body.reasonCode),
      );
      assert.equal(body.attachment.revision, 1);
    }
    const stored = JSON.parse((await attachmentBody(bucket))!) as {
      revision: number;
      matchMediaAssetId: string;
    };
    assert.equal(stored.revision, 1);
    assert.equal(stored.matchMediaAssetId, ASSET_ID);
  });

  it("does not mutate verification records or media bytes", async () => {
    const { dependencies, bucket } = harness();
    const record = await seedVerifiedRecord(bucket);
    const verificationKey = recordStoreKey(record.admissionKeyHash);
    const verificationBefore = bucket.snapshot(verificationKey);
    const mediaKey = matchMediaAssetStorageObjectKey(ASSET_ID);
    const mediaBefore = bucket.snapshot(mediaKey);
    assert.ok(verificationBefore);
    assert.ok(mediaBefore);

    await handlePublishMatchMediaAttachment(publishRequest(), TOKEN, dependencies);

    const verificationAfter = bucket.snapshot(verificationKey);
    const mediaAfter = bucket.snapshot(mediaKey);
    assert.deepEqual(verificationAfter, verificationBefore);
    assert.deepEqual(mediaAfter, mediaBefore);
    assert.equal(bucket.mediaByteMutations(), 0);
  });

  it("has no projection, Coach, client, resolution, or playback side-effect imports", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./matchMediaPublication.ts", import.meta.url), "utf8"),
    );
    for (const forbidden of [
      "PlaybackCoordinator",
      "FilmRoom",
      "parentMediaRefs",
      "CoachMatchMediaProjection",
      "resolveMedia",
      "signedUrl",
      "bumpCoachSyncHydrationVersion",
      "sharedMatchMediaUploadClientEnabled",
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }
  });
});

async function attachmentBody(
  bucket: ReturnType<typeof createFakeBucket>,
): Promise<string | null> {
  const key = attachmentRecordKey({
    sharedAthleteId: ATHLETE,
    sharedCompetitionId: COMPETITION,
    matchLineageKey: MATCH,
  });
  const object = await bucket.get(key);
  return object ? object.text() : null;
}
