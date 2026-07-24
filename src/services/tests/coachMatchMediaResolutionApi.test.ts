import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { coachSyncResolveMatchMediaAttachment } from "../coachMatchMediaResolutionApi.ts";

const input = {
  linkToken: "a".repeat(48),
  coachWriterSecret: "coach-secret",
  sharedAthleteId: "shared_ath_1",
  sharedCompetitionId: "shared_comp_1",
  matchLineageKey: "match_1",
  matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
  expectedRevision: 1,
  apiBaseUrlOverride: "https://worker.test",
};

const resolvePayload = {
  matchMediaAssetId: input.matchMediaAssetId,
  revision: 1,
  url: `https://worker.test/v1/sessions/${input.linkToken}/match-media/assets/${input.matchMediaAssetId}/content?exp=1&sig=abc`,
  expiresAt: "2026-07-24T12:15:00.000Z",
  mimeType: "video/mp4",
  byteLength: 1024,
  acceptRanges: true,
};

describe("Coach Match media resolution client", () => {
  it("POSTs Coach-authorized resolve with exact identity fields", async () => {
    const result = await coachSyncResolveMatchMediaAttachment({
      ...input,
      dependencies: {
        resolveApiBaseUrl: () => "https://worker.test",
        http: async (request) => {
          assert.equal(request.method, "POST");
          assert.equal(
            request.url,
            `https://worker.test/v1/sessions/${input.linkToken}/match-media/attachments/resolve`,
          );
          assert.equal(request.headers.Authorization, "Bearer coach-secret");
          assert.deepEqual(JSON.parse(String(request.body)), {
            sharedAthleteId: input.sharedAthleteId,
            sharedCompetitionId: input.sharedCompetitionId,
            matchLineageKey: input.matchLineageKey,
            matchMediaAssetId: input.matchMediaAssetId,
            expectedRevision: 1,
          });
          return { status: 200, json: resolvePayload };
        },
      },
    });
    assert.deepEqual(result, resolvePayload);
  });

  it("omits expectedRevision when not provided", async () => {
    await coachSyncResolveMatchMediaAttachment({
      linkToken: input.linkToken,
      coachWriterSecret: input.coachWriterSecret,
      sharedAthleteId: input.sharedAthleteId,
      sharedCompetitionId: input.sharedCompetitionId,
      matchLineageKey: input.matchLineageKey,
      matchMediaAssetId: input.matchMediaAssetId,
      apiBaseUrlOverride: input.apiBaseUrlOverride,
      dependencies: {
        resolveApiBaseUrl: () => "https://worker.test",
        http: async (request) => {
          assert.deepEqual(JSON.parse(String(request.body)), {
            sharedAthleteId: input.sharedAthleteId,
            sharedCompetitionId: input.sharedCompetitionId,
            matchLineageKey: input.matchLineageKey,
            matchMediaAssetId: input.matchMediaAssetId,
          });
          return { status: 200, json: resolvePayload };
        },
      },
    });
  });

  it("does not import AsyncStorage and does not cache or persist the response", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(here, "../coachMatchMediaResolutionApi.ts"),
      "utf8",
    );
    assert.doesNotMatch(source, /AsyncStorage/);
    assert.doesNotMatch(source, /from ["']@react-native-async-storage/);
    assert.doesNotMatch(source, /\.setItem\s*\(/);
    assert.doesNotMatch(source, /\.multiSet\s*\(/);

    let httpCalls = 0;
    const first = await coachSyncResolveMatchMediaAttachment({
      ...input,
      dependencies: {
        resolveApiBaseUrl: () => "https://worker.test",
        http: async () => {
          httpCalls += 1;
          return {
            status: 200,
            json: { ...resolvePayload, url: `${resolvePayload.url}&n=${httpCalls}` },
          };
        },
      },
    });
    const second = await coachSyncResolveMatchMediaAttachment({
      ...input,
      dependencies: {
        resolveApiBaseUrl: () => "https://worker.test",
        http: async () => {
          httpCalls += 1;
          return {
            status: 200,
            json: { ...resolvePayload, url: `${resolvePayload.url}&n=${httpCalls}` },
          };
        },
      },
    });
    assert.equal(httpCalls, 2);
    assert.notEqual(first.url, second.url);
  });

  it("surfaces opaque worker denials without inventing attachment state", async () => {
    await assert.rejects(
      () =>
        coachSyncResolveMatchMediaAttachment({
          ...input,
          dependencies: {
            resolveApiBaseUrl: () => "https://worker.test",
            http: async () => ({ status: 404, json: { error: "Not found" } }),
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Not found/);
        assert.equal(
          (error as { status?: number }).status,
          404,
        );
        return true;
      },
    );
  });
});
