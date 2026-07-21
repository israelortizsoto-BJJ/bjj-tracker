import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  handleCreateSharedMatchMediaUploadIntent,
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
} {
  const records = new Map<string, string>();
  const multipartKeys: string[] = [];
  const aborts: string[] = [];
  const dependencies: SharedMatchMediaUploadDependencies = {
    enabled: true,
    metadataStore: {
      get: async (key) => records.get(key) ?? null,
      putIfAbsent: async (key, value) => {
        if (records.has(key)) return false;
        records.set(key, value);
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
    },
    readParentSession: async () => validSession,
    now: () => new Date("2026-07-20T12:00:00.000Z"),
    randomUuid: () => "11111111-2222-4333-8444-555555555555",
    ...overrides,
  };
  return { dependencies, records, multipartKeys, aborts };
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
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
    assert.equal(records.size, 1);

    const stored = JSON.parse([...records.values()][0]!) as {
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
