import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSharedMatchMediaPublicationClientEnabled } from "../../config/sharedMatchMediaUploadFlags.ts";
import { publishParentMatchMediaAttachment } from "../sharedMatchMediaPublicationApi.ts";

const input = {
  linkToken: "a".repeat(48),
  parentWriterSecret: "parent-secret",
  sharedAthleteId: "shared_ath_1",
  sharedCompetitionId: "shared_comp_1",
  matchLineageKey: "match_1",
  matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
  objectVersion: "sealed-object-version-1",
  expectedRevision: 0 as const,
  apiBaseUrlOverride: "https://worker.test",
};

describe("Parent Match Media publication client", () => {
  it("is independently disabled unless its exact client flag is 1", () => {
    assert.equal(isSharedMatchMediaPublicationClientEnabled(undefined), false);
    assert.equal(isSharedMatchMediaPublicationClientEnabled("0"), false);
    assert.equal(isSharedMatchMediaPublicationClientEnabled("true"), false);
    assert.equal(isSharedMatchMediaPublicationClientEnabled("1"), true);
  });

  it("sends exact persisted identity with Parent authority and revision zero", async () => {
    const result = await publishParentMatchMediaAttachment({
      ...input,
      dependencies: {
        resolveApiBaseUrl: () => "https://worker.test",
        http: async (request) => {
          assert.equal(request.method, "PUT");
          assert.equal(
            request.url,
            `https://worker.test/v1/sessions/${input.linkToken}/match-media/attachments`,
          );
          assert.equal(request.headers.Authorization, "Bearer parent-secret");
          assert.match(request.headers["Idempotency-Key"] ?? "", /match-media-publication-v1/);
          assert.deepEqual(JSON.parse(String(request.body)), {
            sharedAthleteId: input.sharedAthleteId,
            sharedCompetitionId: input.sharedCompetitionId,
            matchLineageKey: input.matchLineageKey,
            matchMediaAssetId: input.matchMediaAssetId,
            objectVersion: input.objectVersion,
            expectedRevision: 0,
          });
          return { status: 201, json: { outcome: "attached", attachment: { revision: 1 } } };
        },
      },
    });
    assert.deepEqual(result, { outcome: "attached", revision: 1 });
  });

  it("maps replay and revision conflict without inferring attachment state", async () => {
    const replay = await publishParentMatchMediaAttachment({
      ...input,
      dependencies: {
        resolveApiBaseUrl: () => "https://worker.test",
        http: async () => ({ status: 200, json: { outcome: "idempotent", attachment: { revision: 1 } } }),
      },
    });
    assert.deepEqual(replay, { outcome: "idempotent", revision: 1 });
    const conflict = await publishParentMatchMediaAttachment({
      ...input,
      dependencies: {
        resolveApiBaseUrl: () => "https://worker.test",
        http: async () => ({ status: 409, json: { error: "Revision conflict", currentRevision: 2 } }),
      },
    });
    assert.deepEqual(conflict, { outcome: "conflict", currentRevision: 2 });
  });
});
