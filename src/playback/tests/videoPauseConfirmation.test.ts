// @ts-nocheck -- this Node strip-types test is outside the root Expo typecheck contract.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { createAudioAdapter } from "../AudioAdapter.ts";
import {
  createPlaybackCoordinator,
  PlaybackVideoPauseConfirmationError,
} from "../PlaybackCoordinator.ts";
import { createVideoAdapter, type VideoEngine, type VideoEngineStatus } from "../VideoAdapter.ts";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function pausedStatus(positionMillis: number): VideoEngineStatus {
  return { isLoaded: true, isPlaying: false, positionMillis, durationMillis: 20_000 };
}

function createVideoEngine(pause: () => Promise<unknown>): VideoEngine {
  return {
    playAsync: async () => undefined,
    pauseAsync: pause,
    setPositionAsync: async () => undefined,
    getStatusAsync: async () => pausedStatus(0),
  };
}

function createCoordinator(getEngine: () => VideoEngine | null) {
  return createPlaybackCoordinator({
    video: createVideoAdapter(getEngine),
    audio: createAudioAdapter(() => null),
  });
}

function assertConfirmationCode(
  error: unknown,
  code: PlaybackVideoPauseConfirmationError["code"],
) {
  assert.ok(error instanceof PlaybackVideoPauseConfirmationError);
  assert.equal(error.code, code);
}

describe("request-correlated native video pause confirmation", () => {
  it("returns the position from the status produced by its exact native pause request", async () => {
    const engine = createVideoEngine(async () => pausedStatus(4321));
    const coordinator = createCoordinator(() => engine);

    assert.deepEqual(await coordinator.requestConfirmedVideoPause(), { positionMillis: 4321 });
  });

  it("propagates native pause failure while ordinary pause retains its legacy swallow behavior", async () => {
    const nativeFailure = new Error("native pause failed");
    const engine = createVideoEngine(async () => {
      throw nativeFailure;
    });
    const coordinator = createCoordinator(() => engine);

    await assert.rejects(() => coordinator.requestConfirmedVideoPause(), nativeFailure);
    await coordinator.pause();
    assert.equal(coordinator.getSnapshot().playbackState, "paused");
  });

  it("times out and cleans up when the native request never returns a status", async () => {
    const never = deferred<unknown>();
    const coordinator = createCoordinator(() => createVideoEngine(() => never.promise));

    await assert.rejects(
      () => coordinator.requestConfirmedVideoPause({ timeoutMs: 10 }),
      (error: unknown) => {
        assertConfirmationCode(error, "VIDEO_PAUSE_CONFIRMATION_TIMEOUT");
        return true;
      },
    );

    // Cleanup permits a later independent request.
    const succeeding = createVideoEngine(async () => pausedStatus(9));
    const next = createCoordinator(() => succeeding);
    assert.deepEqual(await next.requestConfirmedVideoPause(), { positionMillis: 9 });
  });

  it("ignores stale, unrelated callback status while waiting for its native response", async () => {
    const pause = deferred<unknown>();
    const engine = createVideoEngine(() => pause.promise);
    const coordinator = createCoordinator(() => engine);
    coordinator.applyVideoStatus(pausedStatus(99)); // pre-request status cannot establish confirmation

    const request = coordinator.requestConfirmedVideoPause({ timeoutMs: 100 });
    coordinator.applyVideoStatus(pausedStatus(100)); // unrelated later callback is not request proof
    pause.resolve(pausedStatus(101));

    assert.deepEqual(await request, { positionMillis: 101 });
  });

  it("rejects loaded-playing, unloaded, and missing-position native results", async () => {
    for (const status of [
      { isLoaded: true, isPlaying: true, positionMillis: 1 },
      { isLoaded: false, isPlaying: false, positionMillis: 1 },
      { isLoaded: true, isPlaying: false },
    ]) {
      const engine = createVideoEngine(async () => status);
      const coordinator = createCoordinator(() => engine);
      await assert.rejects(
        () => coordinator.requestConfirmedVideoPause(),
        (error: unknown) => {
          assertConfirmationCode(error, "VIDEO_PAUSE_CONFIRMATION_INVALID_STATUS");
          return true;
        },
      );
    }
  });

  it("rejects a response from a player that was replaced before it arrived", async () => {
    const pause = deferred<unknown>();
    const first = createVideoEngine(() => pause.promise);
    const second = createVideoEngine(async () => pausedStatus(8));
    let current: VideoEngine | null = first;
    const coordinator = createCoordinator(() => current);

    const request = coordinator.requestConfirmedVideoPause({ timeoutMs: 100 });
    current = second;
    pause.resolve(pausedStatus(7));

    await assert.rejects(request, (error: unknown) => {
      assertConfirmationCode(error, "VIDEO_PAUSE_CONFIRMATION_REPLACED");
      return true;
    });
  });

  it("rejects on lifecycle cancellation and supersedes an older request deterministically", async () => {
    const firstPause = deferred<unknown>();
    const secondPause = deferred<unknown>();
    let call = 0;
    const engine = createVideoEngine(() => (++call === 1 ? firstPause.promise : secondPause.promise));
    const coordinator = createCoordinator(() => engine);

    const first = coordinator.requestConfirmedVideoPause({ timeoutMs: 100 });
    const second = coordinator.requestConfirmedVideoPause({ timeoutMs: 100 });
    await assert.rejects(first, (error: unknown) => {
      assertConfirmationCode(error, "VIDEO_PAUSE_CONFIRMATION_SUPERSEDED");
      return true;
    });
    secondPause.resolve(pausedStatus(12));
    assert.deepEqual(await second, { positionMillis: 12 });

    const pending = coordinator.requestConfirmedVideoPause({ timeoutMs: 100 });
    coordinator.cancelConfirmedVideoPause("component unmounted");
    await assert.rejects(pending, (error: unknown) => {
      assertConfirmationCode(error, "VIDEO_PAUSE_CONFIRMATION_CANCELLED");
      return true;
    });
  });

  it("rejects a pending request when coordinator unload handles component replacement or unmount", async () => {
    const firstPause = deferred<unknown>();
    let pauseCall = 0;
    const engine = createVideoEngine(() => {
      pauseCall += 1;
      return pauseCall === 1 ? firstPause.promise : Promise.resolve(pausedStatus(0));
    });
    const coordinator = createCoordinator(() => engine);

    const pending = coordinator.requestConfirmedVideoPause({ timeoutMs: 100 });
    const unloading = coordinator.unload();
    await assert.rejects(pending, (error: unknown) => {
      assertConfirmationCode(error, "VIDEO_PAUSE_CONFIRMATION_CANCELLED");
      return true;
    });
    await unloading;
  });

  it("keeps MatchMediaAttachments replacement and unmount cleanup routed through coordinator unload", () => {
    const source = readFileSync(new URL("../../components/MatchMediaAttachments.tsx", import.meta.url), "utf8");
    assert.match(source, /useEffect\(\(\) => \{\s*void playbackRef\.current\.unload\(\);\s*\}, \[videoUri\]\)/s);
    assert.match(source, /return \(\) => \{\s*void playbackRef\.current\.unload\(\);\s*\};/s);
  });
});
