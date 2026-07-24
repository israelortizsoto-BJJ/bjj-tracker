import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { SharedMatchMediaUploadClientError } from "../../../services/sharedMatchMediaUploadApi.ts";
import type { SyncedMatchMediaAttachmentProjection } from "../../../types/coachWeeklySync.ts";
import {
  classifyCoachMatchMediaPlayerDeliveryError,
  classifyCoachMatchMediaResolveError,
  decideCoachMatchMediaDeliveryFailure,
  isCoachMatchMediaUrlExpired,
  parseCoachMatchMediaPlaybackIdentity,
  resolveCoachMatchMediaPlaybackOnce,
} from "../coachMatchMediaPlaybackResolve.ts";

const identity = {
  sharedAthleteId: "shared_ath_1",
  sharedCompetitionId: "shared_comp_1",
  matchLineageKey: "match_1",
  matchMediaAssetId: "mma_11111111-2222-4333-8444-555555555555",
  expectedRevision: 2,
};

function attached(
  revision: number,
  overrides: Partial<Extract<SyncedMatchMediaAttachmentProjection, { state: "attached" }>> = {},
): SyncedMatchMediaAttachmentProjection {
  return {
    sharedAthleteId: identity.sharedAthleteId,
    sharedCompetitionId: identity.sharedCompetitionId,
    matchLineageKey: identity.matchLineageKey,
    revision,
    state: "attached",
    matchMediaAssetId: identity.matchMediaAssetId,
    publishedAt: "2026-07-24T12:00:00.000Z",
    updatedAt: "2026-07-24T12:00:00.000Z",
    ...overrides,
  };
}

function tombstoned(revision: number): SyncedMatchMediaAttachmentProjection {
  return {
    sharedAthleteId: identity.sharedAthleteId,
    sharedCompetitionId: identity.sharedCompetitionId,
    matchLineageKey: identity.matchLineageKey,
    revision,
    state: "tombstoned",
    tombstonedAt: "2026-07-24T13:00:00.000Z",
    updatedAt: "2026-07-24T13:00:00.000Z",
  };
}

describe("useCoachMatchMediaPlaybackUri helpers", () => {
  it("parses route identity and rejects incomplete params", () => {
    assert.deepEqual(
      parseCoachMatchMediaPlaybackIdentity({
        ...identity,
        expectedRevision: "2",
      }),
      identity,
    );
    assert.equal(
      parseCoachMatchMediaPlaybackIdentity({
        ...identity,
        matchMediaAssetId: "",
      }),
      null,
    );
    assert.equal(
      parseCoachMatchMediaPlaybackIdentity({
        ...identity,
        expectedRevision: "0",
      }),
      null,
    );
  });

  it("treats expiresAt as a hard capability boundary", () => {
    assert.equal(
      isCoachMatchMediaUrlExpired("2026-07-24T12:00:00.000Z", Date.parse("2026-07-24T11:59:59.000Z")),
      false,
    );
    assert.equal(
      isCoachMatchMediaUrlExpired("2026-07-24T12:00:00.000Z", Date.parse("2026-07-24T12:00:00.000Z")),
      true,
    );
  });

  it("classifies opaque denial vs network without inventing attachment mutation", () => {
    assert.deepEqual(
      classifyCoachMatchMediaResolveError(
        new SharedMatchMediaUploadClientError("Not found", 404),
      ),
      {
        reason: "denial",
        retryable: true,
        httpStatus: 404,
        allowAutoReresolve: false,
      },
    );
    assert.deepEqual(
      classifyCoachMatchMediaResolveError(
        new SharedMatchMediaUploadClientError("Unauthorized", 401),
      ),
      {
        reason: "denial",
        retryable: true,
        httpStatus: 401,
        allowAutoReresolve: true,
      },
    );
    assert.equal(
      classifyCoachMatchMediaResolveError(new Error("network down")).reason,
      "network",
    );
  });

  it("classifies player error strings without requiring HTTP status", () => {
    assert.equal(classifyCoachMatchMediaPlayerDeliveryError("HTTP 401 Unauthorized"), "unauthorized");
    assert.equal(classifyCoachMatchMediaPlayerDeliveryError("token expired"), "expired");
    assert.equal(classifyCoachMatchMediaPlayerDeliveryError("403 Forbidden"), "expired");
    assert.equal(classifyCoachMatchMediaPlayerDeliveryError("decoder failed"), "delivery");
    assert.equal(classifyCoachMatchMediaPlayerDeliveryError(""), "delivery");
  });

  it("delivery-failure decision permits exactly one automatic re-resolution", () => {
    assert.equal(
      decideCoachMatchMediaDeliveryFailure({
        hasActiveUrl: true,
        autoReresolveUsed: false,
      }),
      "auto_reresolve",
    );
    assert.equal(
      decideCoachMatchMediaDeliveryFailure({
        hasActiveUrl: true,
        autoReresolveUsed: true,
      }),
      "unavailable",
    );
    // Repeated player callbacks after the URI is discarded must not resolve again.
    assert.equal(
      decideCoachMatchMediaDeliveryFailure({
        hasActiveUrl: false,
        autoReresolveUsed: false,
      }),
      "ignore",
    );
    assert.equal(
      decideCoachMatchMediaDeliveryFailure({
        hasActiveUrl: false,
        autoReresolveUsed: true,
      }),
      "ignore",
    );
  });

  it("does not resolve tombstoned or missing attachments", async () => {
    const removed = await resolveCoachMatchMediaPlaybackOnce(identity, {
      now: () => Date.now(),
      getAttachment: async () => tombstoned(3),
      resolveSessionTarget: async () => {
        throw new Error("should not resolve session");
      },
      resolveAttachment: async () => {
        throw new Error("should not resolve attachment");
      },
    });
    assert.deepEqual(removed, { status: "removed" });

    const missing = await resolveCoachMatchMediaPlaybackOnce(identity, {
      now: () => Date.now(),
      getAttachment: async () => null,
      resolveSessionTarget: async () => {
        throw new Error("should not resolve session");
      },
      resolveAttachment: async () => {
        throw new Error("should not resolve attachment");
      },
    });
    assert.deepEqual(missing, { status: "missing" });
  });

  it("resolves against the current hydrated row with full identity + expectedRevision", async () => {
    let seenBody: Record<string, unknown> | null = null;
    const result = await resolveCoachMatchMediaPlaybackOnce(
      {
        ...identity,
        // Stale route revision/asset — hydrated row must win.
        matchMediaAssetId: "mma_stale",
        expectedRevision: 1,
      },
      {
        now: () => Date.parse("2026-07-24T12:00:00.000Z"),
        getAttachment: async () =>
          attached(4, {
            matchMediaAssetId: "mma_current",
          }),
        resolveSessionTarget: async () => ({
          linkToken: "a".repeat(48),
          coachWriterSecret: "coach-secret",
          apiBaseUrl: "https://worker.test",
        }),
        resolveAttachment: async (input) => {
          seenBody = {
            sharedAthleteId: input.sharedAthleteId,
            sharedCompetitionId: input.sharedCompetitionId,
            matchLineageKey: input.matchLineageKey,
            matchMediaAssetId: input.matchMediaAssetId,
            expectedRevision: input.expectedRevision,
            linkToken: input.linkToken,
            coachWriterSecret: input.coachWriterSecret,
            apiBaseUrlOverride: input.apiBaseUrlOverride,
          };
          return {
            matchMediaAssetId: "mma_current",
            revision: 4,
            url: "https://worker.test/content?sig=abc",
            expiresAt: "2026-07-24T12:15:00.000Z",
            mimeType: "video/mp4",
            byteLength: 1024,
            acceptRanges: true,
          };
        },
      },
    );
    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.url, "https://worker.test/content?sig=abc");
      assert.equal(result.revision, 4);
    }
    assert.deepEqual(seenBody, {
      sharedAthleteId: identity.sharedAthleteId,
      sharedCompetitionId: identity.sharedCompetitionId,
      matchLineageKey: identity.matchLineageKey,
      matchMediaAssetId: "mma_current",
      expectedRevision: 4,
      linkToken: "a".repeat(48),
      coachWriterSecret: "coach-secret",
      apiBaseUrlOverride: "https://worker.test",
    });
  });

  it("surfaces opaque denial and network failure without mutating attachment state", async () => {
    let attachmentReads = 0;
    const denial = await resolveCoachMatchMediaPlaybackOnce(identity, {
      now: () => Date.now(),
      getAttachment: async () => {
        attachmentReads += 1;
        return attached(2);
      },
      resolveSessionTarget: async () => ({
        linkToken: "a".repeat(48),
        coachWriterSecret: "coach-secret",
        apiBaseUrl: "https://worker.test",
      }),
      resolveAttachment: async () => {
        throw new SharedMatchMediaUploadClientError("Not found", 404);
      },
    });
    assert.deepEqual(denial, {
      status: "unavailable",
      reason: "denial",
      retryable: true,
      httpStatus: 404,
    });
    assert.equal(attachmentReads, 1);

    const network = await resolveCoachMatchMediaPlaybackOnce(identity, {
      now: () => Date.now(),
      getAttachment: async () => attached(2),
      resolveSessionTarget: async () => ({
        linkToken: "a".repeat(48),
        coachWriterSecret: "coach-secret",
        apiBaseUrl: "https://worker.test",
      }),
      resolveAttachment: async () => {
        throw new Error("offline");
      },
    });
    assert.equal(network.status, "unavailable");
    if (network.status === "unavailable") {
      assert.equal(network.reason, "network");
      assert.equal(network.retryable, true);
    }
  });

  it("retry issues a fresh resolve and does not reuse a prior URL", async () => {
    let calls = 0;
    const deps = {
      now: () => Date.parse("2026-07-24T12:00:00.000Z"),
      getAttachment: async () => attached(2),
      resolveSessionTarget: async () => ({
        linkToken: "a".repeat(48),
        coachWriterSecret: "coach-secret",
        apiBaseUrl: "https://worker.test",
      }),
      resolveAttachment: async () => {
        calls += 1;
        return {
          matchMediaAssetId: identity.matchMediaAssetId,
          revision: 2,
          url: `https://worker.test/content?n=${calls}`,
          expiresAt: "2026-07-24T12:15:00.000Z",
          mimeType: "video/mp4",
          byteLength: 1024,
          acceptRanges: true,
        };
      },
    };
    const first = await resolveCoachMatchMediaPlaybackOnce(identity, deps);
    const second = await resolveCoachMatchMediaPlaybackOnce(identity, deps);
    assert.equal(calls, 2);
    assert.equal(first.status, "ready");
    assert.equal(second.status, "ready");
    if (first.status === "ready" && second.status === "ready") {
      assert.notEqual(first.url, second.url);
    }
  });

  it("hook source clears failed URI, caps auto re-resolve, and exposes explicit Retry", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const hookSource = readFileSync(
      path.join(here, "../useCoachMatchMediaPlaybackUri.ts"),
      "utf8",
    );
    const resolveSource = readFileSync(
      path.join(here, "../coachMatchMediaPlaybackResolve.ts"),
      "utf8",
    );
    assert.match(hookSource, /decideCoachMatchMediaDeliveryFailure/);
    assert.match(hookSource, /autoReresolveUsed/);
    assert.match(hookSource, /reportDeliveryFailure/);
    assert.match(hookSource, /canRetry: true/);
    assert.match(hookSource, /Video unavailable/);
    assert.match(hookSource, /autoReresolveUsed = false/);
    assert.match(resolveSource, /"auto_reresolve"/);
    assert.match(resolveSource, /"unavailable"/);
    assert.match(resolveSource, /"ignore"/);
    for (const source of [hookSource, resolveSource]) {
      assert.doesNotMatch(source, /AsyncStorage/);
      assert.doesNotMatch(source, /\.setItem\s*\(/);
      assert.doesNotMatch(source, /console\.log/);
      assert.doesNotMatch(source, /storageObjectKey|objectKey/);
    }
  });
});
