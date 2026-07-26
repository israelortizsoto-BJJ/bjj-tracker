import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { inspectParentVerifiedCompletionReplayPrerequisites } from "../parentVerifiedCompletionReplayPrerequisiteInspector.ts";

const input = {
  sharedAthleteId: "athlete_1",
  sharedCompetitionId: "competition_1",
  matchLineageKey: "lineage_1",
  uploadSessionId: "session_1",
  matchMediaAssetId: "asset_1",
  objectVersion: "version_1",
};
const record = { ...input, status: "upload_complete", localSourceUri: "file:///private.mp4" };
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function dependencies(overrides = {}) {
  return {
    isDevelopment: () => true,
    loadRecord: async () => record,
    hasLocalParentWriterCredentials: async () => true,
    ...overrides,
  };
}

describe("Parent verified-completion replay prerequisite inspector", () => {
  it("is inert outside development and does not read local stores", async () => {
    let reads = 0;
    const result = await inspectParentVerifiedCompletionReplayPrerequisites(input, dependencies({
      isDevelopment: () => false,
      loadRecord: async () => { reads += 1; return record; },
    }));
    assert.equal(result.outcome, "inspection_blocked");
    assert.equal(result.reason, "not_development");
    assert.equal(reads, 0);
  });

  it("reports only a ready boolean set for one exact local record and never returns sensitive values", async () => {
    const result = await inspectParentVerifiedCompletionReplayPrerequisites(input, dependencies());
    assert.equal(result.outcome, "ready_for_separately_authorized_device_inspection");
    assert.deepEqual(result.checks, {
      recordExists: true, uploadComplete: true, associationMatches: true,
      uploadSessionIdMatches: true, matchMediaAssetIdMatches: true, objectVersionMatches: true,
      localSourceUriPresent: true, localParentWriterCredentialsAvailable: true,
      liveParentAuthorityAndTopologyUnverified: true,
    });
    assert.doesNotMatch(JSON.stringify(result), /private\.mp4|session_1|asset_1|version_1/);
  });

  it("fails closed for a missing, mismatched, incomplete, or locally unauthorized prerequisite", async () => {
    const missing = await inspectParentVerifiedCompletionReplayPrerequisites(input, dependencies({ loadRecord: async () => null }));
    assert.equal(missing.outcome, "record_missing");
    const mismatch = await inspectParentVerifiedCompletionReplayPrerequisites(input, dependencies({
      loadRecord: async () => ({ ...record, objectVersion: "other", localSourceUri: "" }),
      hasLocalParentWriterCredentials: async () => false,
    }));
    assert.equal(mismatch.outcome, "prerequisites_not_met");
    assert.equal(mismatch.checks.objectVersionMatches, false);
    assert.equal(mismatch.checks.localSourceUriPresent, false);
    assert.equal(mismatch.checks.localParentWriterCredentialsAvailable, false);
    const incomplete = await inspectParentVerifiedCompletionReplayPrerequisites({ ...input, uploadSessionId: " " }, dependencies());
    assert.deepEqual(incomplete, {
      outcome: "inspection_blocked", reason: "incomplete_explicit_identity",
      checks: {
        recordExists: false, uploadComplete: false, associationMatches: false,
        uploadSessionIdMatches: false, matchMediaAssetIdMatches: false, objectVersionMatches: false,
        localSourceUriPresent: false, localParentWriterCredentialsAvailable: false,
        liveParentAuthorityAndTopologyUnverified: true,
      },
    });
  });

  it("keeps the DEV UI on the local inspector boundary rather than the replay sender", () => {
    const route = readFileSync(path.join(repoRoot, "app/dev/verified-completion-replay-prerequisites.tsx"), "utf8");
    const screen = readFileSync(path.join(repoRoot, "src/dev/VerifiedCompletionReplayPrerequisiteInspectorDevScreen.tsx"), "utf8");
    assert.match(route, /if \(!__DEV__\) return null/);
    assert.match(screen, /inspectOneParentVerifiedCompletionReplayPrerequisites/);
    assert.doesNotMatch(screen, /replayOneParentVerifiedMatchMediaCompletion/);
    assert.doesNotMatch(screen, /\bfetch\s*\(/);
  });
});
