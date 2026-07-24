import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMatchMediaBindingLifecycle, type MatchMediaBindingCandidate } from "../matchMediaBindingLifecycle.ts";

const candidate = (token: string, expiresAt: string): MatchMediaBindingCandidate => ({
  playableUri: `https://media/${token}`,
  matchMediaAssetId: "asset",
  attachmentRevision: 1,
  matchLineageKey: "match",
  sharedAthleteId: "athlete",
  sharedCompetitionId: "competition",
  playerGenerationToken: token,
  expiresAt,
});

describe("shared Match media binding lifecycle", () => {
  it("expires candidates deterministically and defeats a pending bound pause", async () => {
    let now = 100;
    let fireTimer: () => void = () => {};
    let cancelled = 0;
    let unloaded = 0;
    let resolvePause!: (value: { positionMillis: number }) => void;
    const pending = new Promise<{ positionMillis: number }>((resolve) => { resolvePause = resolve; });
    const states: Array<{ candidate: unknown; active: unknown }> = [];
    const lifecycle = createMatchMediaBindingLifecycle({
      now: () => now,
      setTimer: (callback) => { fireTimer = callback; return callback; },
      clearTimer: () => { fireTimer = () => {}; },
      cancelConfirmedVideoPause: () => { cancelled += 1; },
      requestConfirmedVideoPause: () => pending,
      unload: () => { unloaded += 1; },
      onChange: (state) => states.push(state),
    });
    assert.equal(lifecycle.accept(candidate("A", new Date(200).toISOString())), true);
    lifecycle.markLoaded("A");
    const pause = lifecycle.requestConfirmedBoundPause();
    now = 200;
    fireTimer();
    resolvePause({ positionMillis: 42 });
    await assert.rejects(pause);
    assert.equal(lifecycle.getActive(), null);
    assert.equal(unloaded, 2);
    assert.ok(cancelled >= 2);
    lifecycle.markLoaded("A");
    assert.equal(lifecycle.getActive(), null);
    assert.ok(states.some((state) => state.candidate === null && state.active === null));
  });

  it("replaces timers by generation and leaves the newer generation intact", () => {
    let now = 100;
    const timers: Array<() => void> = [];
    const lifecycle = createMatchMediaBindingLifecycle({
      now: () => now,
      setTimer: (callback) => { timers.push(callback); return callback; },
      clearTimer: () => {},
      cancelConfirmedVideoPause: () => {}, requestConfirmedVideoPause: async () => ({ positionMillis: 1 }),
      unload: () => {}, onChange: () => {},
    });
    lifecycle.accept(candidate("A", new Date(200).toISOString()));
    lifecycle.accept(candidate("B", new Date(300).toISOString()));
    timers[0]?.();
    lifecycle.markLoaded("B");
    assert.equal(lifecycle.getActive()?.playerGenerationToken, "B");
    now = 300;
    timers[1]?.();
    assert.equal(lifecycle.getActive(), null);
  });

  it("ignores a stale native error while a replacement generation confirms its pause", async () => {
    let resolvePause!: (value: { positionMillis: number }) => void;
    const pending = new Promise<{ positionMillis: number }>((resolve) => { resolvePause = resolve; });
    let unloads = 0;
    let cancellations = 0;
    const lifecycle = createMatchMediaBindingLifecycle({
      now: () => 100, setTimer: (callback) => callback, clearTimer: () => {},
      cancelConfirmedVideoPause: () => { cancellations += 1; }, requestConfirmedVideoPause: () => pending,
      unload: () => { unloads += 1; }, onChange: () => {},
    });
    lifecycle.accept(candidate("A", new Date(200).toISOString()));
    lifecycle.markLoaded("A");
    lifecycle.accept(candidate("B", new Date(300).toISOString()));
    lifecycle.markLoaded("B");
    const pause = lifecycle.requestConfirmedBoundPause();
    const cancellationsBeforeStaleError = cancellations;
    const unloadsBeforeStaleError = unloads;
    assert.equal(lifecycle.handleNativeError("A"), false);
    assert.equal(unloads, unloadsBeforeStaleError);
    assert.equal(cancellations, cancellationsBeforeStaleError);
    resolvePause({ positionMillis: 73 });
    assert.deepEqual(await pause, { positionMillis: 73, binding: lifecycle.getActive() });
    assert.equal(lifecycle.getActive()?.playerGenerationToken, "B");
  });

  it("invalidates only the matching native error and rejects its pending pause", async () => {
    let resolvePause!: (value: { positionMillis: number }) => void;
    const pending = new Promise<{ positionMillis: number }>((resolve) => { resolvePause = resolve; });
    let unloads = 0;
    let cancellations = 0;
    const lifecycle = createMatchMediaBindingLifecycle({
      now: () => 100, setTimer: (callback) => callback, clearTimer: () => {},
      cancelConfirmedVideoPause: () => { cancellations += 1; }, requestConfirmedVideoPause: () => pending,
      unload: () => { unloads += 1; }, onChange: () => {},
    });
    lifecycle.accept(candidate("B", new Date(300).toISOString()));
    lifecycle.markLoaded("B");
    const pause = lifecycle.requestConfirmedBoundPause();
    const unloadsBeforeCurrentError = unloads;
    assert.equal(lifecycle.handleNativeError("B"), true);
    assert.equal(lifecycle.getActive(), null);
    assert.equal(unloads, unloadsBeforeCurrentError + 1);
    assert.ok(cancellations >= 2);
    resolvePause({ positionMillis: 73 });
    await assert.rejects(pause);
  });

  it("rejects incomplete and expired deliveries without creating a capability", () => {
    const lifecycle = createMatchMediaBindingLifecycle({
      now: () => 100, setTimer: () => { throw new Error("must not schedule"); }, clearTimer: () => {},
      cancelConfirmedVideoPause: () => {}, requestConfirmedVideoPause: async () => ({ positionMillis: 1 }),
      unload: () => {}, onChange: () => {},
    });
    const valid = candidate("A", new Date(200).toISOString());
    for (const invalid of [
      { ...valid, expiresAt: "not-a-date" }, { ...valid, expiresAt: new Date(100).toISOString() },
      { ...valid, playableUri: "" }, { ...valid, matchMediaAssetId: "" },
      { ...valid, attachmentRevision: 0 }, { ...valid, sharedAthleteId: "" },
      { ...valid, sharedCompetitionId: "" }, { ...valid, matchLineageKey: "" },
    ]) assert.equal(lifecycle.accept(invalid), false);
    assert.equal(lifecycle.getActive(), null);
  });

  it("authoritative invalidation and disposal defeat every pending identity replacement", async () => {
    const replacements = [
      "scope", "athlete", "competition", "lineage", "hydration", "gate", "asset", "revision", "delivery",
    ];
    for (const replacement of replacements) {
      let resolvePause!: (value: { positionMillis: number }) => void;
      const pending = new Promise<{ positionMillis: number }>((resolve) => { resolvePause = resolve; });
      const lifecycle = createMatchMediaBindingLifecycle({
        now: () => 100, setTimer: (callback) => callback, clearTimer: () => {}, cancelConfirmedVideoPause: () => {},
        requestConfirmedVideoPause: () => pending, unload: () => {}, onChange: () => {},
      });
      lifecycle.accept(candidate("A", new Date(200).toISOString()));
      lifecycle.markLoaded("A");
      const pause = lifecycle.requestConfirmedBoundPause();
      lifecycle.invalidate(`${replacement} changed.`, true);
      resolvePause({ positionMillis: 1 });
      await assert.rejects(pause);
    }
  });

  it("never pairs a pending pause with a replacement binding identity", async () => {
    const replacements: Array<Partial<MatchMediaBindingCandidate>> = [
      { playableUri: "https://media/refresh" },
      { matchMediaAssetId: "asset-next" },
      { attachmentRevision: 2 },
      { matchLineageKey: "match-next" },
      { sharedAthleteId: "athlete-next" },
      { sharedCompetitionId: "competition-next" },
    ];
    for (const [index, replacement] of replacements.entries()) {
      let resolvePause!: (value: { positionMillis: number }) => void;
      const pending = new Promise<{ positionMillis: number }>((resolve) => { resolvePause = resolve; });
      const lifecycle = createMatchMediaBindingLifecycle({
        now: () => 100, setTimer: (callback) => callback, clearTimer: () => {}, cancelConfirmedVideoPause: () => {},
        requestConfirmedVideoPause: () => pending, unload: () => {}, onChange: () => {},
      });
      lifecycle.accept(candidate("A", new Date(200).toISOString()));
      lifecycle.markLoaded("A");
      const pause = lifecycle.requestConfirmedBoundPause();
      lifecycle.accept({ ...candidate(`B-${index}`, new Date(300).toISOString()), ...replacement });
      lifecycle.markLoaded(`B-${index}`);
      resolvePause({ positionMillis: 9 });
      await assert.rejects(pause);
      assert.equal(lifecycle.getActive()?.playerGenerationToken, `B-${index}`);
    }
  });

  it("makes callbacks and late confirmation harmless after disposal", async () => {
    let resolvePause!: (value: { positionMillis: number }) => void;
    const pending = new Promise<{ positionMillis: number }>((resolve) => { resolvePause = resolve; });
    let publications = 0;
    const lifecycle = createMatchMediaBindingLifecycle({
      now: () => 100, setTimer: (callback) => callback, clearTimer: () => {}, cancelConfirmedVideoPause: () => {},
      requestConfirmedVideoPause: () => pending, unload: () => {}, onChange: () => { publications += 1; },
    });
    lifecycle.accept(candidate("A", new Date(200).toISOString()));
    lifecycle.markLoaded("A");
    const pause = lifecycle.requestConfirmedBoundPause();
    lifecycle.dispose();
    const afterDispose = publications;
    lifecycle.markLoaded("A");
    assert.equal(lifecycle.handleNativeError("A"), false);
    assert.equal(lifecycle.accept(candidate("B", new Date(300).toISOString())), false);
    assert.equal(publications, afterDispose);
    resolvePause({ positionMillis: 2 });
    await assert.rejects(pause);
  });

  it("does not retire a legacy-only player when no shared candidate exists", () => {
    let unloads = 0;
    const lifecycle = createMatchMediaBindingLifecycle({
      now: () => 100, setTimer: (callback) => callback, clearTimer: () => {}, cancelConfirmedVideoPause: () => {},
      requestConfirmedVideoPause: async () => ({ positionMillis: 1 }), unload: () => { unloads += 1; }, onChange: () => {},
    });
    lifecycle.dispose();
    assert.equal(unloads, 0);
  });
});
