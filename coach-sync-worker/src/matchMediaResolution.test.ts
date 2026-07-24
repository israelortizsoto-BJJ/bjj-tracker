import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MATCH_MEDIA_CONTENT_TTL_SECONDS,
  attachmentRecordKey,
  handleMatchMediaAssetContent,
  handleResolveMatchMediaAttachment,
  isResolutionFeatureEnabled,
  matchMediaAssetStorageObjectKey,
  matchMediaContentHmacPrefix,
  signMatchMediaContentAccess,
  type MatchMediaCoachSession,
  type MatchMediaResolutionDependencies,
  type ResolutionMediaBucket,
  type ResolutionR2Object,
} from "./matchMediaResolution.ts";

const TOKEN = "a".repeat(48);
const COACH_SECRET = "coach-writer-secret";
const ASSET_ID = "mma_11111111-2222-4333-8444-555555555555";
const OBJECT_VERSION = "object-version-1";
const ATHLETE = "shared_ath_1";
const COMPETITION = "shared_comp_1";
const MATCH = "match_1";
const ORIGIN = "https://worker.test";
const FIXED_NOW = new Date("2026-07-24T12:00:00.000Z");

const validSession: MatchMediaCoachSession = {
  writerSecret: COACH_SECRET,
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
  contentType?: string;
};

function bytesOf(entry: FakeEntry): Uint8Array {
  return typeof entry.body === "string"
    ? new TextEncoder().encode(entry.body)
    : entry.body;
}

function makeR2Object(
  entry: FakeEntry,
  range?: { offset: number; length: number },
): ResolutionR2Object {
  const all = bytesOf(entry);
  const slice = range
    ? all.subarray(range.offset, range.offset + range.length)
    : all;
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(slice);
        controller.close();
      },
    }),
    // R2 ranged gets retain full-object size for Content-Range totals.
    size: all.byteLength,
    httpEtag: entry.etag,
    etag: entry.etag,
    httpMetadata: entry.contentType
      ? { contentType: entry.contentType }
      : undefined,
    text: async () => new TextDecoder().decode(all),
    writeHttpMetadata(headers) {
      if (entry.contentType) headers.set("Content-Type", entry.contentType);
    },
  };
}

function createFakeBucket() {
  const objects = new Map<string, FakeEntry>();
  let etagCounter = 0;

  const bucket: ResolutionMediaBucket & {
    putJson(key: string, value: unknown): void;
    putBytes(
      key: string,
      body: Uint8Array,
      version: string,
      contentType?: string,
    ): void;
    setVersion(key: string, version: string): void;
    delete(key: string): void;
    keys(): string[];
  } = {
    putJson(key, value) {
      etagCounter += 1;
      objects.set(key, {
        body: JSON.stringify(value),
        etag: `"json-${etagCounter}"`,
        version: `meta-${etagCounter}`,
        contentType: "application/json",
      });
    },
    putBytes(key, body, version, contentType = "video/mp4") {
      etagCounter += 1;
      objects.set(key, {
        body,
        etag: `"bytes-${etagCounter}"`,
        version,
        contentType,
      });
    },
    setVersion(key, version) {
      const existing = objects.get(key);
      if (!existing) throw new Error(`missing ${key}`);
      objects.set(key, { ...existing, version });
    },
    delete(key) {
      objects.delete(key);
    },
    keys() {
      return [...objects.keys()];
    },
    get: async (key, options) => {
      const entry = objects.get(key);
      if (!entry) return null;
      return makeR2Object(entry, options?.range);
    },
    head: async (key) => {
      const entry = objects.get(key);
      if (!entry) return null;
      return {
        size: bytesOf(entry).byteLength,
        version: entry.version,
        httpMetadata: entry.contentType
          ? { contentType: entry.contentType }
          : undefined,
      };
    },
  };

  return bucket;
}

function attachedRecord(overrides?: {
  revision?: number;
  matchMediaAssetId?: string;
  objectVersion?: string;
  state?: "attached" | "tombstoned";
}) {
  const state = overrides?.state ?? "attached";
  if (state === "tombstoned") {
    return {
      schemaVersion: 1 as const,
      sharedAthleteId: ATHLETE,
      sharedCompetitionId: COMPETITION,
      matchLineageKey: MATCH,
      revision: overrides?.revision ?? 2,
      state: "tombstoned" as const,
      tombstonedAt: "2026-07-24T11:00:00.000Z",
      updatedAt: "2026-07-24T11:00:00.000Z",
    };
  }
  return {
    schemaVersion: 1 as const,
    sharedAthleteId: ATHLETE,
    sharedCompetitionId: COMPETITION,
    matchLineageKey: MATCH,
    revision: overrides?.revision ?? 1,
    state: "attached" as const,
    matchMediaAssetId: overrides?.matchMediaAssetId ?? ASSET_ID,
    objectVersion: overrides?.objectVersion ?? OBJECT_VERSION,
    publishedAt: "2026-07-24T10:00:00.000Z",
    updatedAt: "2026-07-24T10:00:00.000Z",
  };
}

function seedHappyPath(bucket: ReturnType<typeof createFakeBucket>) {
  const attachmentKey = attachmentRecordKey({
    sharedAthleteId: ATHLETE,
    sharedCompetitionId: COMPETITION,
    matchLineageKey: MATCH,
  });
  bucket.putJson(attachmentKey, attachedRecord());
  const assetKey = matchMediaAssetStorageObjectKey(ASSET_ID);
  bucket.putBytes(
    assetKey,
    new TextEncoder().encode("0123456789ABCDEF"),
    OBJECT_VERSION,
    "video/mp4",
  );
  return { attachmentKey, assetKey };
}

function deps(input: {
  enabled?: boolean;
  bucket: ReturnType<typeof createFakeBucket>;
  session?: MatchMediaCoachSession | null;
  now?: () => Date;
}): MatchMediaResolutionDependencies {
  const session = input.session === undefined ? validSession : input.session;
  return {
    enabled: input.enabled ?? true,
    mediaBucket: input.bucket,
    readCoachSession: async () => session,
    now: input.now ?? (() => FIXED_NOW),
    requestOrigin: ORIGIN,
  };
}

function resolveRequest(body: Record<string, unknown>, secret = COACH_SECRET) {
  return new Request(
    `${ORIGIN}/v1/sessions/${TOKEN}/match-media/attachments/resolve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

const resolveBody = {
  sharedAthleteId: ATHLETE,
  sharedCompetitionId: COMPETITION,
  matchLineageKey: MATCH,
  matchMediaAssetId: ASSET_ID,
};

describe("Match media resolution feature flag", () => {
  it("enables only for exact string 1", () => {
    assert.equal(isResolutionFeatureEnabled(undefined), false);
    assert.equal(isResolutionFeatureEnabled("0"), false);
    assert.equal(isResolutionFeatureEnabled("true"), false);
    assert.equal(isResolutionFeatureEnabled("1"), true);
  });

  it("uses an HMAC prefix distinct from commentary media-content", () => {
    assert.equal(matchMediaContentHmacPrefix(), "match-media-content");
    assert.notEqual(matchMediaContentHmacPrefix(), "media-content");
  });
});

describe("Coach Match media resolve", () => {
  it("flag-off resolve is opaque without exposing resource existence", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    const res = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ enabled: false, bucket }),
    );
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "Not found" });
  });

  it("valid Coach resolve returns a fresh 15-minute URI and contract fields only", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    const keysBefore = bucket.keys().slice().sort();
    const res = await handleResolveMatchMediaAttachment(
      resolveRequest({ ...resolveBody, expectedRevision: 1 }),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(json.matchMediaAssetId, ASSET_ID);
    assert.equal(json.revision, 1);
    assert.equal(json.mimeType, "video/mp4");
    assert.equal(json.byteLength, 16);
    assert.equal(json.acceptRanges, true);
    assert.equal(
      json.expiresAt,
      new Date(
        Math.floor(FIXED_NOW.getTime() / 1000) * 1000 +
          MATCH_MEDIA_CONTENT_TTL_SECONDS * 1000,
      ).toISOString(),
    );
    const url = String(json.url);
    assert.match(
      url,
      new RegExp(
        `/v1/sessions/${TOKEN}/match-media/assets/${ASSET_ID}/content\\?`,
      ),
    );
    assert.match(url, /exp=/);
    assert.match(url, /sig=/);
    assert.equal(
      Object.keys(json).sort().join(","),
      [
        "acceptRanges",
        "byteLength",
        "expiresAt",
        "matchMediaAssetId",
        "mimeType",
        "revision",
        "url",
      ].join(","),
    );
    assert.deepEqual(bucket.keys().slice().sort(), keysBefore);
  });

  it("wrong bearer is denied", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    const res = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody, "wrong-secret"),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(res.status, 401);
  });

  it("retired/missing session is opaque", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    const res = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket, session: null }),
    );
    assert.equal(res.status, 404);
  });

  it("topology denial is opaque for foreign athlete/competition/match", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    for (const body of [
      { ...resolveBody, sharedAthleteId: "foreign_ath" },
      { ...resolveBody, sharedCompetitionId: "foreign_comp" },
      { ...resolveBody, matchLineageKey: "foreign_match" },
    ]) {
      const res = await handleResolveMatchMediaAttachment(
        resolveRequest(body),
        TOKEN,
        deps({ bucket }),
      );
      assert.equal(res.status, 404);
    }
  });

  it("malformed or missing attachment is opaque", async () => {
    const bucket = createFakeBucket();
    const assetKey = matchMediaAssetStorageObjectKey(ASSET_ID);
    bucket.putBytes(
      assetKey,
      new TextEncoder().encode("bytes"),
      OBJECT_VERSION,
    );
    const missing = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(missing.status, 404);

    bucket.putJson(
      attachmentRecordKey({
        sharedAthleteId: ATHLETE,
        sharedCompetitionId: COMPETITION,
        matchLineageKey: MATCH,
      }),
      { not: "an-attachment" },
    );
    const malformed = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(malformed.status, 404);
  });

  it("tombstone and superseded-asset denial are opaque", async () => {
    const bucket = createFakeBucket();
    const attachmentKey = attachmentRecordKey({
      sharedAthleteId: ATHLETE,
      sharedCompetitionId: COMPETITION,
      matchLineageKey: MATCH,
    });
    bucket.putJson(attachmentKey, attachedRecord({ state: "tombstoned" }));
    bucket.putBytes(
      matchMediaAssetStorageObjectKey(ASSET_ID),
      new TextEncoder().encode("bytes"),
      OBJECT_VERSION,
    );
    const tombstone = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(tombstone.status, 404);

    bucket.putJson(
      attachmentKey,
      attachedRecord({
        revision: 2,
        matchMediaAssetId: "mma_superseded_asset_00000000000000000000",
        objectVersion: "object-version-2",
      }),
    );
    const superseded = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(superseded.status, 404);
  });

  it("missing object and version-drift denial are opaque", async () => {
    const bucket = createFakeBucket();
    const attachmentKey = attachmentRecordKey({
      sharedAthleteId: ATHLETE,
      sharedCompetitionId: COMPETITION,
      matchLineageKey: MATCH,
    });
    bucket.putJson(attachmentKey, attachedRecord());
    const missingObject = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(missingObject.status, 404);

    const assetKey = matchMediaAssetStorageObjectKey(ASSET_ID);
    bucket.putBytes(
      assetKey,
      new TextEncoder().encode("0123456789ABCDEF"),
      "drifted-version",
    );
    const drift = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(drift.status, 404);
  });

  it("stale expectedRevision with the same active asset succeeds and returns current revision", async () => {
    const bucket = createFakeBucket();
    const attachmentKey = attachmentRecordKey({
      sharedAthleteId: ATHLETE,
      sharedCompetitionId: COMPETITION,
      matchLineageKey: MATCH,
    });
    bucket.putJson(attachmentKey, attachedRecord({ revision: 3 }));
    bucket.putBytes(
      matchMediaAssetStorageObjectKey(ASSET_ID),
      new TextEncoder().encode("0123456789ABCDEF"),
      OBJECT_VERSION,
    );
    const res = await handleResolveMatchMediaAttachment(
      resolveRequest({ ...resolveBody, expectedRevision: 1 }),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as { revision: number };
    assert.equal(json.revision, 3);
  });

  it("re-resolve succeeds while attachment remains current", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    const first = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    const second = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
  });

  it("concurrent resolves mint independent URLs without durable state", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    let tick = 0;
    const sharedDeps = deps({
      bucket,
      now: () => new Date(FIXED_NOW.getTime() + tick * 1000),
    });
    tick = 0;
    const a = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      sharedDeps,
    );
    tick = 1;
    const b = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      sharedDeps,
    );
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const urlA = String(((await a.json()) as { url: string }).url);
    const urlB = String(((await b.json()) as { url: string }).url);
    assert.notEqual(urlA, urlB);
    assert.equal(
      bucket.keys().filter((k) => k.includes("resolution")).length,
      0,
    );
  });
});

describe("Coach Match media content", () => {
  async function mintUrl(
    bucket: ReturnType<typeof createFakeBucket>,
    now = FIXED_NOW,
  ): Promise<string> {
    seedHappyPath(bucket);
    const res = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket, now: () => now }),
    );
    assert.equal(res.status, 200);
    return String(((await res.json()) as { url: string }).url);
  }

  it("flag-off content is opaque", async () => {
    const bucket = createFakeBucket();
    const url = await mintUrl(bucket);
    const res = await handleMatchMediaAssetContent(
      new Request(url, { method: "GET" }),
      TOKEN,
      ASSET_ID,
      deps({ enabled: false, bucket }),
    );
    assert.equal(res.status, 404);
  });

  it("successful full and Range content delivery", async () => {
    const bucket = createFakeBucket();
    const url = await mintUrl(bucket);
    const full = await handleMatchMediaAssetContent(
      new Request(url, { method: "GET" }),
      TOKEN,
      ASSET_ID,
      deps({ bucket }),
    );
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("Accept-Ranges"), "bytes");
    assert.equal(full.headers.get("Content-Type"), "video/mp4");
    assert.equal(await full.text(), "0123456789ABCDEF");

    const ranged = await handleMatchMediaAssetContent(
      new Request(url, {
        method: "GET",
        headers: { Range: "bytes=0-3" },
      }),
      TOKEN,
      ASSET_ID,
      deps({ bucket }),
    );
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("Content-Range"), "bytes 0-3/16");
    assert.equal(await ranged.text(), "0123");
  });

  it("expired signature returns 401", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    const expUnix = Math.floor(FIXED_NOW.getTime() / 1000) - 30;
    const sig = await signMatchMediaContentAccess(
      COACH_SECRET,
      TOKEN,
      ASSET_ID,
      expUnix,
    );
    const url = `${ORIGIN}/v1/sessions/${TOKEN}/match-media/assets/${ASSET_ID}/content?exp=${expUnix}&sig=${sig}`;
    const res = await handleMatchMediaAssetContent(
      new Request(url, { method: "GET" }),
      TOKEN,
      ASSET_ID,
      deps({ bucket }),
    );
    assert.equal(res.status, 401);
  });

  it("wrong bearer-bound signature returns 401", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    const expUnix =
      Math.floor(FIXED_NOW.getTime() / 1000) + MATCH_MEDIA_CONTENT_TTL_SECONDS;
    const sig = await signMatchMediaContentAccess(
      "other-secret",
      TOKEN,
      ASSET_ID,
      expUnix,
    );
    const url = `${ORIGIN}/v1/sessions/${TOKEN}/match-media/assets/${ASSET_ID}/content?exp=${expUnix}&sig=${sig}`;
    const res = await handleMatchMediaAssetContent(
      new Request(url, { method: "GET" }),
      TOKEN,
      ASSET_ID,
      deps({ bucket }),
    );
    assert.equal(res.status, 401);
  });

  it("does not leak object keys, secrets, or versions in resolve response", async () => {
    const bucket = createFakeBucket();
    seedHappyPath(bucket);
    const res = await handleResolveMatchMediaAttachment(
      resolveRequest(resolveBody),
      TOKEN,
      deps({ bucket }),
    );
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal("storageObjectKey" in json, false);
    assert.equal("objectKey" in json, false);
    assert.equal("sig" in json, false);
    assert.equal("writerSecret" in json, false);
    assert.equal("objectVersion" in json, false);
    assert.doesNotMatch(
      JSON.stringify(json),
      /shared-match-media\/attachments/,
    );
    assert.doesNotMatch(
      JSON.stringify(json),
      /match-media\/assets\/.*\/original/,
    );
  });
});
