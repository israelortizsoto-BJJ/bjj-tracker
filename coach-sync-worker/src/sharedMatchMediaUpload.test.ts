import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  handleAbortSharedMatchMediaUpload,
  handleCompleteSharedMatchMediaUpload,
  handleCreateSharedMatchMediaUploadIntent,
  handleInspectSharedMatchMediaUpload,
  handleUploadSharedMatchMediaPart,
  type MatchMediaParentSession,
  type SharedMatchMediaUploadDependencies,
} from "./sharedMatchMediaUpload.ts";

const TOKEN = "a".repeat(48);
const PARENT_SECRET = "parent-secret";

const validSession: MatchMediaParentSession = {
  parentWriterSecret: PARENT_SECRET,
  athletes: [{ id: "shared_ath_1" }],
  competitions: [{ id: "shared_comp_1", sharedAthleteId: "shared_ath_1" }],
  competitionTopologyByAthleteId: {
    shared_ath_1: {
      competitions: [
        {
          sharedCompetitionId: "shared_comp_1",
          matches: [{ matchLineageKey: "match_1" }],
        },
      ],
    },
  },
};

function request(
  overrides: Partial<{
    secret: string;
    idempotencyKey: string;
    body: Record<string, unknown>;
  }> = {},
): Request {
  return new Request(`https://worker.test/v1/sessions/${TOKEN}/match-media/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${overrides.secret ?? PARENT_SECRET}`,
      "Content-Type": "application/json",
      "Idempotency-Key": overrides.idempotencyKey ?? "upload-match-1",
    },
    body: JSON.stringify(
      overrides.body ?? {
        sharedAthleteId: "shared_ath_1",
        sharedCompetitionId: "shared_comp_1",
        matchLineageKey: "match_1",
        declaredMimeType: "video/mp4",
        declaredByteCount: 12_345_678,
        declaredSha256: "b".repeat(64),
      },
    ),
  });
}

function harness(
  overrides: Partial<SharedMatchMediaUploadDependencies> = {},
): {
  dependencies: SharedMatchMediaUploadDependencies;
  records: Map<string, string>;
  multipartKeys: string[];
  aborts: string[];
  uploadedParts: Array<{ partNumber: number; sha256: string }>;
  completions: Array<ReadonlyArray<{ partNumber: number; etag: string }>>;
} {
  const records = new Map<string, string>();
  const versions = new Map<string, number>();
  const multipartKeys: string[] = [];
  const aborts: string[] = [];
  const uploadedParts: Array<{ partNumber: number; sha256: string }> = [];
  const completions: Array<ReadonlyArray<{ partNumber: number; etag: string }>> = [];
  const dependencies: SharedMatchMediaUploadDependencies = {
    enabled: true,
    metadataStore: {
      get: async (key) => records.get(key) ?? null,
      putIfAbsent: async (key, value) => {
        if (records.has(key)) return false;
        records.set(key, value);
        versions.set(key, 1);
        return true;
      },
      getVersioned: async (key) => {
        const value = records.get(key);
        return value === undefined
          ? null
          : { value, version: `v${versions.get(key) ?? 1}` };
      },
      compareAndSwap: async (key, version, value) => {
        if (version !== `v${versions.get(key) ?? 1}` || !records.has(key)) return false;
        records.set(key, value);
        versions.set(key, (versions.get(key) ?? 1) + 1);
        return true;
      },
    },
    bucket: {
      createMultipartUpload: async (key) => {
        multipartKeys.push(key);
        return {
          uploadId: `r2-upload-${multipartKeys.length}`,
          abort: async () => {
            aborts.push(key);
          },
        };
      },
      resumeMultipartUpload: (key, uploadId) => ({
        uploadId,
        abort: async () => {
          aborts.push(key);
        },
        uploadPart: async (partNumber, _value, options) => {
          uploadedParts.push({ partNumber, sha256: options.sha256 });
          return { partNumber, etag: `etag-${partNumber}-${options.sha256.slice(0, 8)}` };
        },
        complete: async (parts) => {
          completions.push(parts);
          return {
            version: "object-version-1",
            etag: "completed-provider-etag",
            size: 12_345_678,
            uploaded: new Date("2026-07-20T12:05:00.000Z"),
          };
        },
      }),
      head: async () => null,
    },
    readParentSession: async () => validSession,
    now: () => new Date("2026-07-20T12:00:00.000Z"),
    randomUuid: () => "11111111-2222-4333-8444-555555555555",
    ...overrides,
  };
  return { dependencies, records, multipartKeys, aborts, uploadedParts, completions };
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function createUpload(state: ReturnType<typeof harness>) {
  const created = await handleCreateSharedMatchMediaUploadIntent(request(), TOKEN, state.dependencies);
  const body = await payload(created);
  return {
    assetId: (body.asset as Record<string, string>).matchMediaAssetId,
    uploadSessionId: (body.uploadSession as Record<string, string>).uploadSessionId,
  };
}

function partRequest(
  byteCount: number,
  sha256 = "c".repeat(64),
  secret = PARENT_SECRET,
): Request {
  return new Request("https://worker.test/part", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Length": String(byteCount),
      "X-MatMind-Part-Bytes": String(byteCount),
      "X-MatMind-Part-SHA256": sha256,
    },
    body: new Uint8Array([1]),
  });
}

function authorizedRequest(method = "GET", secret = PARENT_SECRET): Request {
  return new Request("https://worker.test/upload", {
    method,
    headers: { Authorization: `Bearer ${secret}` },
  });
}

describe("Shared Match Media Upload Foundation", () => {
  it("creates a Match-bound immutable asset and real multipart upload session", async () => {
    const { dependencies, records, multipartKeys } = harness();

    const result = await handleCreateSharedMatchMediaUploadIntent(
      request(),
      TOKEN,
      dependencies,
    );
    const body = await payload(result);
    const asset = body.asset as Record<string, unknown>;
    const uploadSession = body.uploadSession as Record<string, unknown>;

    assert.equal(result.status, 201);
    assert.equal(asset.matchMediaAssetId, "mma_11111111-2222-4333-8444-555555555555");
    assert.equal(asset.sharedAthleteId, "shared_ath_1");
    assert.equal(asset.sharedCompetitionId, "shared_comp_1");
    assert.equal(asset.matchLineageKey, "match_1");
    assert.equal(asset.status, "upload_pending");
    assert.equal(uploadSession.protocol, "r2_multipart");
    assert.equal(multipartKeys[0], `match-media/assets/${asset.matchMediaAssetId}/original`);
    assert.equal(records.size, 2);

    const storedRaw = [...records.values()].find((value) => value.includes("requestFingerprint"));
    const stored = JSON.parse(storedRaw!) as {
      asset: Record<string, unknown>;
      uploadSession: Record<string, unknown>;
    };
    assert.equal(stored.asset.creatorAuthority, "parent");
    assert.equal(stored.asset.status, "upload_pending");
    assert.equal(stored.uploadSession.providerUploadId, "r2-upload-1");
    assert.equal("providerUploadId" in uploadSession, false);
  });

  it("replays the same immutable asset and session for the same idempotency key", async () => {
    let uuidCalls = 0;
    const state = harness({
      randomUuid: () => {
        uuidCalls += 1;
        return `${uuidCalls}1111111-2222-4333-8444-555555555555`;
      },
    });

    const first = await handleCreateSharedMatchMediaUploadIntent(
      request(),
      TOKEN,
      state.dependencies,
    );
    const second = await handleCreateSharedMatchMediaUploadIntent(
      request(),
      TOKEN,
      state.dependencies,
    );
    const firstBody = await payload(first);
    const secondBody = await payload(second);

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.deepEqual(secondBody.asset, firstBody.asset);
    assert.deepEqual(secondBody.uploadSession, firstBody.uploadSession);
    assert.equal(secondBody.idempotentReplay, true);
    assert.equal(state.multipartKeys.length, 1);
    assert.equal(uuidCalls, 1);
  });

  it("rejects reuse of an idempotency key for a different intent", async () => {
    const { dependencies, multipartKeys } = harness();
    await handleCreateSharedMatchMediaUploadIntent(request(), TOKEN, dependencies);

    const result = await handleCreateSharedMatchMediaUploadIntent(
      request({
        body: {
          sharedAthleteId: "shared_ath_1",
          sharedCompetitionId: "shared_comp_1",
          matchLineageKey: "match_1",
          declaredMimeType: "video/mp4",
          declaredByteCount: 99,
        },
      }),
      TOKEN,
      dependencies,
    );

    assert.equal(result.status, 409);
    assert.equal(multipartKeys.length, 1);
  });

  it("aborts the losing multipart session during a concurrent idempotency race", async () => {
    const state = harness();
    let competingRecord: string | null = null;
    state.dependencies.metadataStore.putIfAbsent = async (key, value) => {
      if (!competingRecord) {
        competingRecord = value.replace("r2-upload-1", "r2-upload-winner");
        state.records.set(key, competingRecord);
      }
      return false;
    };

    const result = await handleCreateSharedMatchMediaUploadIntent(
      request(),
      TOKEN,
      state.dependencies,
    );
    const body = await payload(result);

    assert.equal(result.status, 200);
    assert.equal(body.idempotentReplay, true);
    assert.equal(state.multipartKeys.length, 1);
    assert.deepEqual(state.aborts, state.multipartKeys);
  });

  it("rejects a Match that is not in Parent canonical topology", async () => {
    const { dependencies, records, multipartKeys } = harness();
    const result = await handleCreateSharedMatchMediaUploadIntent(
      request({
        body: {
          sharedAthleteId: "shared_ath_1",
          sharedCompetitionId: "shared_comp_1",
          matchLineageKey: "missing_match",
          declaredMimeType: "video/mp4",
          declaredByteCount: 100,
        },
      }),
      TOKEN,
      dependencies,
    );

    assert.equal(result.status, 404);
    assert.equal(records.size, 0);
    assert.equal(multipartKeys.length, 0);
  });

  it("rejects a competition bound to a different athlete", async () => {
    const { dependencies, multipartKeys } = harness();
    const result = await handleCreateSharedMatchMediaUploadIntent(
      request({
        body: {
          sharedAthleteId: "shared_ath_other",
          sharedCompetitionId: "shared_comp_1",
          matchLineageKey: "match_1",
          declaredMimeType: "video/mp4",
          declaredByteCount: 100,
        },
      }),
      TOKEN,
      dependencies,
    );

    assert.equal(result.status, 404);
    assert.equal(multipartKeys.length, 0);
  });

  it("rejects a request without Parent writer authority", async () => {
    const { dependencies, records, multipartKeys } = harness();
    const result = await handleCreateSharedMatchMediaUploadIntent(
      request({ secret: "coach-or-unknown-secret" }),
      TOKEN,
      dependencies,
    );

    assert.equal(result.status, 401);
    assert.equal(records.size, 0);
    assert.equal(multipartKeys.length, 0);
  });

  it("returns an inert not-found response when the independent flag is disabled", async () => {
    let sessionReads = 0;
    const { dependencies, records, multipartKeys } = harness({
      enabled: false,
      readParentSession: async () => {
        sessionReads += 1;
        return validSession;
      },
    });
    const result = await handleCreateSharedMatchMediaUploadIntent(
      request(),
      TOKEN,
      dependencies,
    );

    assert.equal(result.status, 404);
    assert.equal(sessionReads, 0);
    assert.equal(records.size, 0);
    assert.equal(multipartKeys.length, 0);
  });
});

describe("Shared Match Media resumable upload parts", () => {
  const firstPartBytes = 6 * 1024 * 1024;

  it("uploads an authorized part, transitions to uploading, and redacts provider identity", async () => {
    const state = harness();
    const ids = await createUpload(state);
    const uploaded = await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    );
    const inspected = await handleInspectSharedMatchMediaUpload(
      authorizedRequest(), TOKEN, ids.uploadSessionId, ids.assetId, state.dependencies,
    );
    const text = await inspected.text();

    assert.equal(uploaded.status, 201);
    assert.equal(state.uploadedParts.length, 1);
    assert.match(text, /"status":"uploading"/);
    assert.match(text, /"partNumber":1/);
    assert.match(text, new RegExp(`"uploadedByteCount":${firstPartBytes}`));
    assert.doesNotMatch(text, /providerUploadId|storageObjectKey|r2-upload|match-media\/assets/);
  });

  it("acknowledges multiple distinct parts", async () => {
    const state = harness();
    const ids = await createUpload(state);
    const finalBytes = 12_345_678 - firstPartBytes;
    assert.equal((await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes, "c".repeat(64)), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    )).status, 201);
    assert.equal((await handleUploadSharedMatchMediaPart(
      partRequest(finalBytes, "d".repeat(64)), TOKEN, ids.uploadSessionId, ids.assetId, 2, state.dependencies,
    )).status, 201);
    const inspected = await payload(await handleInspectSharedMatchMediaUpload(
      authorizedRequest(), TOKEN, ids.uploadSessionId, ids.assetId, state.dependencies,
    ));
    const session = inspected.uploadSession as { acknowledgedParts: unknown[]; uploadedByteCount: number };
    assert.equal(session.acknowledgedParts.length, 2);
    assert.equal(session.uploadedByteCount, 12_345_678);
  });

  it("makes identical retries idempotent and rejects conflicting retries", async () => {
    const state = harness();
    const ids = await createUpload(state);
    await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    );
    const replay = await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    );
    const conflict = await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes, "d".repeat(64)), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    );
    assert.equal(replay.status, 200);
    assert.equal((await payload(replay)).idempotentReplay, true);
    assert.equal(conflict.status, 409);
    assert.equal(state.uploadedParts.length, 1);
  });

  it("concurrent identical requests reserve once and converge on retry", async () => {
    const state = harness();
    const ids = await createUpload(state);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    state.dependencies.bucket.resumeMultipartUpload = (key, uploadId) => ({
      uploadId,
      abort: async () => {
        state.aborts.push(key);
      },
      uploadPart: async (partNumber, _value, options) => {
        state.uploadedParts.push({ partNumber, sha256: options.sha256 });
        await gate;
        return { partNumber, etag: "etag-race" };
      },
      complete: async () => {
        throw new Error("not used");
      },
    });
    const first = handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    );
    await Promise.resolve();
    await Promise.resolve();
    const concurrentPromise = handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    );
    await Promise.resolve();
    release();
    const [firstResult, concurrent] = await Promise.all([first, concurrentPromise]);
    assert.deepEqual([firstResult.status, concurrent.status].sort(), [200, 201]);
    assert.equal((await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    )).status, 200);
    assert.ok(state.uploadedParts.length >= 1 && state.uploadedParts.length <= 2);
  });

  it("denies unauthorized and incorrect athlete, competition, or Match bindings", async () => {
    const state = harness();
    const ids = await createUpload(state);
    assert.equal((await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes, "c".repeat(64), "wrong"), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    )).status, 401);
    const wrongBinding: MatchMediaParentSession = {
      ...validSession,
      athletes: [{ id: "other" }],
      competitions: [{ id: "other", sharedAthleteId: "other" }],
      competitionTopologyByAthleteId: {},
    };
    state.dependencies.readParentSession = async () => wrongBinding;
    assert.equal((await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    )).status, 404);
  });

  it("keeps unknown assets and feature-disabled inspection opaque", async () => {
    const state = harness();
    const ids = await createUpload(state);
    assert.equal((await handleInspectSharedMatchMediaUpload(
      authorizedRequest(), TOKEN, ids.uploadSessionId, "mma_unknown", state.dependencies,
    )).status, 404);
    state.dependencies.enabled = false;
    assert.equal((await handleInspectSharedMatchMediaUpload(
      authorizedRequest(), TOKEN, ids.uploadSessionId, ids.assetId, state.dependencies,
    )).status, 404);
  });

  it("rejects expired sessions before provider access", async () => {
    const state = harness();
    const ids = await createUpload(state);
    state.dependencies.now = () => new Date("2026-07-27T12:00:00.000Z");
    assert.equal((await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    )).status, 410);
    assert.equal(state.uploadedParts.length, 0);
  });

  it("aborts safely, remains idempotent, and rejects later parts", async () => {
    const state = harness();
    const ids = await createUpload(state);
    const first = await handleAbortSharedMatchMediaUpload(
      authorizedRequest("DELETE"), TOKEN, ids.uploadSessionId, ids.assetId, state.dependencies,
    );
    const second = await handleAbortSharedMatchMediaUpload(
      authorizedRequest("DELETE"), TOKEN, ids.uploadSessionId, ids.assetId, state.dependencies,
    );
    const laterPart = await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(laterPart.status, 409);
    assert.equal(state.aborts.length, 1);
  });
});

describe("Shared Match Media upload completion", () => {
  const firstPartBytes = 6 * 1024 * 1024;
  const finalPartBytes = 12_345_678 - firstPartBytes;

  async function uploadAll(state: ReturnType<typeof harness>) {
    const ids = await createUpload(state);
    await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes, "c".repeat(64)), TOKEN, ids.uploadSessionId, ids.assetId, 1, state.dependencies,
    );
    await handleUploadSharedMatchMediaPart(
      partRequest(finalPartBytes, "d".repeat(64)), TOKEN, ids.uploadSessionId, ids.assetId, 2, state.dependencies,
    );
    return ids;
  }

  it("reconciles ordered parts and bytes before completing one immutable object", async () => {
    const state = harness();
    const ids = await uploadAll(state);
    const result = await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, ids.uploadSessionId, ids.assetId, state.dependencies,
    );
    const body = await result.text();
    assert.equal(result.status, 201);
    assert.deepEqual(state.completions[0]?.map((part) => part.partNumber), [1, 2]);
    assert.match(body, /"status":"upload_complete"/);
    assert.match(body, /"completedByteCount":12345678/);
    assert.match(body, /"objectVersion":"object-version-1"/);
    assert.doesNotMatch(body, /providerVersion|providerEtag|storageObjectKey|match-media\/assets|r2-upload/);
  });

  it("rejects missing parts and incorrect acknowledged byte totals", async () => {
    const missing = harness();
    const missingIds = await createUpload(missing);
    await handleUploadSharedMatchMediaPart(
      partRequest(firstPartBytes), TOKEN, missingIds.uploadSessionId, missingIds.assetId, 1, missing.dependencies,
    );
    assert.equal((await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, missingIds.uploadSessionId, missingIds.assetId, missing.dependencies,
    )).status, 409);

    const wrong = harness();
    const wrongIds = await uploadAll(wrong);
    const sessionKey = [...wrong.records.keys()].find((key) => key.includes("upload-sessions"))!;
    const stored = JSON.parse(wrong.records.get(sessionKey)!) as { acknowledgedParts: Record<string, { byteCount: number }> };
    stored.acknowledgedParts["2"]!.byteCount -= 1;
    wrong.records.set(sessionKey, JSON.stringify(stored));
    assert.equal((await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, wrongIds.uploadSessionId, wrongIds.assetId, wrong.dependencies,
    )).status, 409);
    assert.equal(wrong.completions.length, 0);
  });

  it("rejects expired, aborted, unauthorized, and incorrectly rebound uploads", async () => {
    const expired = harness();
    const expiredIds = await uploadAll(expired);
    expired.dependencies.now = () => new Date("2026-07-27T12:00:00.000Z");
    assert.equal((await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, expiredIds.uploadSessionId, expiredIds.assetId, expired.dependencies,
    )).status, 410);

    const aborted = harness();
    const abortedIds = await uploadAll(aborted);
    await handleAbortSharedMatchMediaUpload(
      authorizedRequest("DELETE"), TOKEN, abortedIds.uploadSessionId, abortedIds.assetId, aborted.dependencies,
    );
    assert.equal((await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, abortedIds.uploadSessionId, abortedIds.assetId, aborted.dependencies,
    )).status, 409);

    const denied = harness();
    const deniedIds = await uploadAll(denied);
    assert.equal((await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST", "wrong"), TOKEN, deniedIds.uploadSessionId, deniedIds.assetId, denied.dependencies,
    )).status, 401);
    denied.dependencies.readParentSession = async () => ({ ...validSession, competitionTopologyByAthleteId: {} });
    assert.equal((await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, deniedIds.uploadSessionId, deniedIds.assetId, denied.dependencies,
    )).status, 404);
  });

  it("makes duplicate completion idempotent without calling R2 again", async () => {
    const state = harness();
    const ids = await uploadAll(state);
    const first = await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, ids.uploadSessionId, ids.assetId, state.dependencies,
    );
    const duplicate = await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, ids.uploadSessionId, ids.assetId, state.dependencies,
    );
    const duplicateBody = await payload(duplicate);
    assert.equal(first.status, 201);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicateBody.idempotentReplay, true);
    assert.equal(
      (duplicateBody.uploadSession as { objectVersion?: string }).objectVersion,
      "object-version-1",
    );
    assert.equal(state.completions.length, 1);
  });

  it("recovers provider-success metadata gaps and fails deterministically otherwise", async () => {
    const recovered = harness();
    const recoveredIds = await uploadAll(recovered);
    recovered.dependencies.bucket.resumeMultipartUpload = () => ({
      uploadId: "private",
      abort: async () => {},
      uploadPart: async () => { throw new Error("not used"); },
      complete: async () => { throw new Error("NoSuchUpload"); },
    });
    recovered.dependencies.bucket.head = async () => ({
      version: "recovered-version",
      etag: "recovered-etag",
      size: 12_345_678,
      uploaded: new Date("2026-07-20T12:06:00.000Z"),
    });
    assert.equal((await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, recoveredIds.uploadSessionId, recoveredIds.assetId, recovered.dependencies,
    )).status, 201);

    const failed = harness();
    const failedIds = await uploadAll(failed);
    failed.dependencies.bucket.resumeMultipartUpload = recovered.dependencies.bucket.resumeMultipartUpload;
    assert.equal((await handleCompleteSharedMatchMediaUpload(
      authorizedRequest("POST"), TOKEN, failedIds.uploadSessionId, failedIds.assetId, failed.dependencies,
    )).status, 503);
  });
});
