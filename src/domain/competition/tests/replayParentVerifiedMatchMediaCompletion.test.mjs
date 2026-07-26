import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  releaseSynchronousReplayAttempt,
  runOneParentVerifiedCompletionReplay,
  tryAcquireSynchronousReplayAttempt,
} from "../parentVerifiedCompletionReplayController.ts";

const identity = {
  sharedAthleteId: "shared_ath_1",
  sharedCompetitionId: "shared_comp_1",
  matchLineageKey: "match_1",
};

const record = {
  ...identity,
  matchMediaAssetId: "mma_1",
  objectVersion: "version_1",
  uploadSessionId: "session_1",
  status: "upload_complete",
  localSourceUri: "file:///only-this-record.mp4",
};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

describe("explicit Parent verified-completion replay caller", () => {
  it("acquires a synchronous caller guard before a second immediate submission", () => {
    const ref = { current: false };
    assert.equal(tryAcquireSynchronousReplayAttempt(ref), true);
    assert.equal(tryAcquireSynchronousReplayAttempt(ref), false);
    releaseSynchronousReplayAttempt(ref);
    assert.equal(tryAcquireSynchronousReplayAttempt(ref), true);
  });

  it("is inert outside development or when its exact replay gate is off", async () => {
    let loads = 0;
    for (const [isDevelopment, replayEnabled, reason] of [[false, true, "not_development"], [true, false, "replay_flag_off"]]) {
      const result = await runOneParentVerifiedCompletionReplay(identity, {
        isDevelopment: () => isDevelopment,
        replayEnabled: () => replayEnabled,
        loadRecord: async () => { loads += 1; return record; },
        replay: async () => { throw new Error("must not replay"); },
        createTraceId: () => "must-not-mint",
      });
      assert.deepEqual(result, { outcome: "replay_blocked", reason });
    }
    assert.equal(loads, 0);
  });

  it("fails closed for missing, incomplete, or identity-inconsistent records before replay", async () => {
    let calls = 0;
    const base = {
      isDevelopment: () => true,
      replayEnabled: () => true,
      replay: async () => { calls += 1; throw new Error("must not replay"); },
      createTraceId: () => "must-not-mint",
    };
    assert.deepEqual(await runOneParentVerifiedCompletionReplay(identity, { ...base, loadRecord: async () => null }), { outcome: "record_missing" });
    const incomplete = { ...record, objectVersion: "" };
    const invalid = await runOneParentVerifiedCompletionReplay(identity, { ...base, loadRecord: async () => incomplete });
    assert.equal(invalid.outcome, "record_invalid");
    const mismatched = { ...record, sharedCompetitionId: "other_comp" };
    const inconsistent = await runOneParentVerifiedCompletionReplay(identity, { ...base, loadRecord: async () => mismatched });
    assert.equal(inconsistent.outcome, "record_invalid");
    assert.equal(calls, 0);
  });

  it("replays exactly one stored record with its canonical association and local URI", async () => {
    const calls = [];
    const result = await runOneParentVerifiedCompletionReplay(identity, {
      isDevelopment: () => true,
      replayEnabled: () => true,
      loadRecord: async () => record,
      createTraceId: () => "verified-completion-replay-test",
      replay: async (input) => {
        calls.push(input);
        return { ok: true, result: { serverReportedVerified: false } };
      },
    });
    assert.deepEqual(calls, [{ ...identity, localUri: record.localSourceUri, replayVerifiedCompletion: true, traceTrigger: "verified_completion_replay", traceId: "verified-completion-replay-test" }]);
    assert.deepEqual(result, { outcome: "replay_unverified", traceId: "verified-completion-replay-test" });
  });

  it("reports verified publication state without retrying or expanding to another lineage", async () => {
    let calls = 0;
    const result = await runOneParentVerifiedCompletionReplay(identity, {
      isDevelopment: () => true,
      replayEnabled: () => true,
      loadRecord: async (requested) => { assert.deepEqual(requested, identity); return record; },
      createTraceId: () => "trace-one",
      replay: async () => {
        calls += 1;
        return { ok: true, result: { serverReportedVerified: true }, publication: { outcome: "attached" } };
      },
    });
    assert.equal(calls, 1);
    assert.deepEqual(result, { outcome: "replay_verified", traceId: "trace-one", publication: "attempted_succeeded" });
  });

  it("blocks a remount-equivalent concurrent call for the same lineage before another read or replay", async () => {
    const recordRead = deferred();
    let reads = 0;
    let replays = 0;
    const dependencies = {
      isDevelopment: () => true,
      replayEnabled: () => true,
      loadRecord: async () => { reads += 1; return recordRead.promise; },
      createTraceId: () => "same-lineage",
      replay: async () => { replays += 1; return { ok: true, result: { serverReportedVerified: false } }; },
    };
    const first = runOneParentVerifiedCompletionReplay(identity, dependencies);
    const second = await runOneParentVerifiedCompletionReplay(identity, dependencies);
    assert.deepEqual(second, { outcome: "replay_blocked", reason: "replay_already_in_flight" });
    assert.equal(reads, 1);
    recordRead.resolve(record);
    assert.deepEqual(await first, { outcome: "replay_unverified", traceId: "same-lineage" });
    assert.equal(replays, 1);
  });

  it("does not block different exact lineages and releases after success or thrown failure", async () => {
    const other = { ...identity, matchLineageKey: "match_2" };
    const otherRecord = { ...record, ...other, localSourceUri: "file:///other.mp4" };
    let replayCalls = 0;
    const successDependencies = {
      isDevelopment: () => true,
      replayEnabled: () => true,
      loadRecord: async (requested) => requested.matchLineageKey === "match_2" ? otherRecord : record,
      createTraceId: () => `trace-${++replayCalls}`,
      replay: async () => ({ ok: true, result: { serverReportedVerified: false } }),
    };
    const [first, second] = await Promise.all([
      runOneParentVerifiedCompletionReplay(identity, successDependencies),
      runOneParentVerifiedCompletionReplay(other, successDependencies),
    ]);
    assert.equal(first.outcome, "replay_unverified");
    assert.equal(second.outcome, "replay_unverified");
    const failureDependencies = {
      ...successDependencies,
      replay: async () => { throw new Error("network failed"); },
    };
    const failed = await runOneParentVerifiedCompletionReplay(identity, failureDependencies);
    assert.deepEqual(failed, { outcome: "replay_failed", message: "network failed" });
    const retry = await runOneParentVerifiedCompletionReplay(identity, successDependencies);
    assert.equal(retry.outcome, "replay_unverified");
  });

  it("keeps the explicit replay bit out of Parent selection and post-save wiring", () => {
    const parentEditor = readFileSync(path.join(repoRoot, "app/(tabs)/this-week/kid/[kidId]/competition/edit.tsx"), "utf8");
    const caller = readFileSync(path.join(repoRoot, "src/domain/competition/parentVerifiedCompletionReplayController.ts"), "utf8");
    const route = readFileSync(path.join(repoRoot, "app/dev/verified-completion-replay.tsx"), "utf8");
    const screen = readFileSync(path.join(repoRoot, "src/dev/VerifiedCompletionReplayDevScreen.tsx"), "utf8");
    assert.doesNotMatch(parentEditor, /replayVerifiedCompletion/);
    assert.match(caller, /replayVerifiedCompletion: true/);
    assert.match(caller, /traceTrigger: "verified_completion_replay"/);
    assert.match(caller, /inFlightLineageKeys/);
    assert.match(caller, /replay_already_in_flight/);
    assert.match(route, /if \(!__DEV__\) return null/);
    assert.match(screen, /sharedMatchMediaVerifiedCompletionReplayClientEnabled/);
    assert.match(screen, /useRef/);
    assert.match(screen, /tryAcquireSynchronousReplayAttempt\(inFlightRef\)/);
    assert.match(screen, /releaseSynchronousReplayAttempt\(inFlightRef\)/);
  });
});
