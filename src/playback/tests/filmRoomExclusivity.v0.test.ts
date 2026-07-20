import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAudioAdapter, type AudioEngine } from "../AudioAdapter.ts";
import { createFilmRoomSessionCoordinator } from "../FilmRoomSessionCoordinator.ts";
import {
  createPlaybackCoordinator,
  PlaybackCoordinatorDualBindError,
} from "../PlaybackCoordinator.ts";
import { createVideoAdapter, type VideoEngine } from "../VideoAdapter.ts";

Object.defineProperty(globalThis, "__DEV__", {
  configurable: true,
  value: true,
});

function createFieldCoordinator() {
  return createPlaybackCoordinator({
    video: createVideoAdapter(() => null),
    audio: createAudioAdapter(() => null),
  });
}

function createFakeVideoEngine(): VideoEngine {
  let positionMillis = 0;
  return {
    playAsync: async () => undefined,
    pauseAsync: async () => undefined,
    setPositionAsync: async (next) => {
      positionMillis = next;
    },
    getStatusAsync: async () => ({
      isLoaded: true,
      positionMillis,
      durationMillis: 1000,
      isPlaying: false,
    }),
  };
}

function createFakeAudioEngine(): AudioEngine {
  let positionMillis = 0;
  return {
    playAsync: async () => undefined,
    pauseAsync: async () => undefined,
    setPositionAsync: async (next) => {
      positionMillis = next;
    },
    stopAsync: async () => undefined,
    unloadAsync: async () => undefined,
    getStatusAsync: async () => ({
      isLoaded: true,
      positionMillis,
      durationMillis: 1000,
      isPlaying: false,
    }),
  };
}

/** Allow void-propagated inactive seeks from sync fan-out to settle. */
async function settleFanOut() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function trackSeekCalls(coordinator: ReturnType<typeof createFieldCoordinator>) {
  const calls: number[] = [];
  const original = coordinator.seek.bind(coordinator);
  coordinator.seek = async (positionMs: number) => {
    calls.push(positionMs);
    return original(positionMs);
  };
  return calls;
}

describe("PlaybackCoordinator single-engine invariant (EX-1)", () => {
  it("allows a single video engine bind", async () => {
    const videoEngine = createFakeVideoEngine();
    const coordinator = createPlaybackCoordinator({
      video: createVideoAdapter(() => videoEngine),
      audio: createAudioAdapter(() => null),
    });

    await coordinator.play();
    assert.equal(coordinator.getSnapshot().playbackState, "playing");

    await coordinator.pause();
    assert.equal(coordinator.getSnapshot().playbackState, "paused");

    await coordinator.seek(250);
    assert.equal(coordinator.getSnapshot().currentTimeMs, 250);

    await coordinator.unload();
    assert.deepEqual(coordinator.getSnapshot(), {
      playbackState: "idle",
      currentTimeMs: 0,
      durationMs: null,
    });
  });

  it("allows a single audio engine bind", async () => {
    const audioEngine = createFakeAudioEngine();
    const coordinator = createPlaybackCoordinator({
      video: createVideoAdapter(() => null),
      audio: createAudioAdapter(() => audioEngine),
    });

    await coordinator.play();
    assert.equal(coordinator.getSnapshot().playbackState, "playing");

    await coordinator.unload();
    assert.equal(coordinator.getSnapshot().playbackState, "idle");
  });

  it("rejects intent when video and audio engines are both bound", async () => {
    const coordinator = createPlaybackCoordinator({
      video: createVideoAdapter(() => createFakeVideoEngine()),
      audio: createAudioAdapter(() => createFakeAudioEngine()),
    });

    await assert.rejects(() => coordinator.play(), PlaybackCoordinatorDualBindError);
    await assert.rejects(() => coordinator.pause(), PlaybackCoordinatorDualBindError);
    await assert.rejects(() => coordinator.seek(100), PlaybackCoordinatorDualBindError);
    await assert.rejects(() => coordinator.replay(), PlaybackCoordinatorDualBindError);
    await assert.rejects(() => coordinator.unload(), PlaybackCoordinatorDualBindError);

    // Dual-bind never mutates snapshot ownership via intent.
    assert.deepEqual(coordinator.getSnapshot(), {
      playbackState: "idle",
      currentTimeMs: 0,
      durationMs: null,
    });
  });

  it("rejects status application when both engines are bound", () => {
    const coordinator = createPlaybackCoordinator({
      video: createVideoAdapter(() => createFakeVideoEngine()),
      audio: createAudioAdapter(() => createFakeAudioEngine()),
    });

    assert.throws(
      () =>
        coordinator.applyVideoStatus({
          isLoaded: true,
          positionMillis: 10,
          isPlaying: true,
        }),
      PlaybackCoordinatorDualBindError,
    );
    assert.throws(
      () =>
        coordinator.applyAudioStatus({
          isLoaded: true,
          positionMillis: 20,
          isPlaying: true,
        }),
      PlaybackCoordinatorDualBindError,
    );
  });

  it("allows both adapters unbound (zero engines)", async () => {
    const coordinator = createFieldCoordinator();
    await coordinator.play();
    assert.equal(coordinator.getSnapshot().playbackState, "playing");
    await coordinator.unload();
    assert.equal(coordinator.getSnapshot().playbackState, "idle");
  });

  it("rejects when a second engine becomes bound after a valid single bind", async () => {
    let audioEngine: AudioEngine | null = null;
    const videoEngine = createFakeVideoEngine();
    const coordinator = createPlaybackCoordinator({
      video: createVideoAdapter(() => videoEngine),
      audio: createAudioAdapter(() => audioEngine),
    });

    await coordinator.play();
    assert.equal(coordinator.getSnapshot().playbackState, "playing");

    // Lifecycle dual-bind: second engine appears while first remains live.
    audioEngine = createFakeAudioEngine();
    await assert.rejects(() => coordinator.pause(), PlaybackCoordinatorDualBindError);
  });
});

describe("Film Room exclusivity v0", () => {
  it("pauses other playing participants on play intent; leaves initiator playing", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "match-1" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    assert.equal(video.getSnapshot().playbackState, "playing");
    assert.equal(coachAudio.getSnapshot().playbackState, "idle");

    await coachAudio.play();
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");
    assert.equal(video.getSnapshot().playbackState, "paused");

    session.destroy();
  });

  it("ignores already-paused participants", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "match-2" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    await video.pause();
    assert.equal(video.getSnapshot().playbackState, "paused");

    await coachAudio.play();
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");
    assert.equal(video.getSnapshot().playbackState, "paused");

    session.destroy();
  });

  it("applies exclusivity on replay the same as play", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "match-3" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await coachAudio.play();
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");

    await video.replay();
    assert.equal(video.getSnapshot().playbackState, "playing");
    assert.equal(coachAudio.getSnapshot().playbackState, "paused");

    session.destroy();
  });

  it("does not couple coordinators outside a session", async () => {
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();

    await video.play();
    await coachAudio.play();

    assert.equal(video.getSnapshot().playbackState, "playing");
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");
  });

  it("clears play-intent handler on unregister and destroy", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "match-4" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    session.unregister(video, "video");

    await coachAudio.play();
    // Video was unregistered — session must not pause it anymore.
    assert.equal(video.getSnapshot().playbackState, "playing");
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");

    session.register(video, "video");
    session.destroy();

    await video.play();
    await coachAudio.play();
    assert.equal(video.getSnapshot().playbackState, "playing");
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");
  });
});

describe("Film Room active participant authority v0", () => {
  it("records exactly one active participant on successful play intent", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "active-1" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    assert.equal(session.getActiveParticipant(), null);

    await video.play();
    assert.equal(session.getActiveParticipant(), video);

    await coachAudio.play();
    assert.equal(session.getActiveParticipant(), coachAudio);
    // Exclusivity unchanged: previous player paused, initiator playing.
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");

    session.destroy();
  });

  it("does not clear active participant on pause", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "active-2" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    assert.equal(session.getActiveParticipant(), video);

    await video.pause();
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(session.getActiveParticipant(), video);

    // Peer pause via exclusivity also leaves prior leader until replaced.
    await video.play();
    await coachAudio.play();
    assert.equal(session.getActiveParticipant(), coachAudio);
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(session.getActiveParticipant(), coachAudio);

    session.destroy();
  });

  it("clears active participant on unregister of the leader only", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "active-3" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    assert.equal(session.getActiveParticipant(), video);

    session.unregister(coachAudio, "coach_audio");
    assert.equal(session.getActiveParticipant(), video);

    session.unregister(video, "video");
    assert.equal(session.getActiveParticipant(), null);

    session.destroy();
  });

  it("clears active participant on session destroy", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "active-4" });
    const video = createFieldCoordinator();
    session.register(video, "video");

    await video.play();
    assert.equal(session.getActiveParticipant(), video);

    session.destroy();
    assert.equal(session.getActiveParticipant(), null);
  });

  it("keeps field coordinators unaware of peers (no cross references)", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "active-5" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    await coachAudio.play();

    // Session owns relationship + active identity; surfaces only expose local snapshot.
    assert.equal(session.getActiveParticipant(), coachAudio);
    assert.equal(typeof (video as { getActiveParticipant?: unknown }).getActiveParticipant, "undefined");
    assert.equal(
      typeof (coachAudio as { getActiveParticipant?: unknown }).getActiveParticipant,
      "undefined",
    );
    assert.ok(!("participants" in video));
    assert.ok(!("participants" in coachAudio));

    session.destroy();
  });
});

describe("Film Room session playhead publication v0", () => {
  it("follows the active participant and ignores inactive measurements", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "playhead-1" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    assert.deepEqual(session.getPlayhead(), { currentTimeMs: 0, playbackState: "idle" });

    await video.play();
    assert.equal(session.getActiveParticipant(), video);
    assert.equal(session.getPlayhead().playbackState, "playing");

    video.applyVideoStatus({
      isLoaded: true,
      positionMillis: 1500,
      isPlaying: true,
    });
    assert.deepEqual(session.getPlayhead(), {
      currentTimeMs: 1500,
      playbackState: "playing",
    });

    // Leadership switch: coach becomes sole publisher.
    await coachAudio.play();
    assert.equal(session.getActiveParticipant(), coachAudio);
    assert.equal(session.getPlayhead().playbackState, "playing");
    assert.equal(video.getSnapshot().playbackState, "paused");

    const playheadAfterSwitch = session.getPlayhead();

    // Inactive video measurement must not publish the session playhead.
    video.applyVideoStatus({
      isLoaded: true,
      positionMillis: 9999,
      isPlaying: false,
    });
    assert.deepEqual(session.getPlayhead(), playheadAfterSwitch);
    assert.equal(video.getSnapshot().currentTimeMs, 9999);

    // Active coach measurement updates session playhead.
    coachAudio.applyAudioStatus({
      isLoaded: true,
      positionMillis: 420,
      isPlaying: true,
    });
    assert.deepEqual(session.getPlayhead(), {
      currentTimeMs: 420,
      playbackState: "playing",
    });
    // Session playhead remains the only source — inactive measurement above did not publish.
    assert.notEqual(9999, session.getPlayhead().currentTimeMs);

    session.destroy();
  });

  it("emits FILMROOM_PLAYHEAD_UPDATED only for the active participant", async () => {
    const events: Array<{ event: string; activeParticipantType?: string | null }> = [];
    const originalLog = console.log;
    console.log = ((...args: unknown[]) => {
      const tag = typeof args[0] === "string" ? args[0] : "";
      if (tag === "[FILMROOM_PLAYHEAD_UPDATED]") {
        const payload = args[1] as { activeParticipantType?: string | null };
        events.push({
          event: "FILMROOM_PLAYHEAD_UPDATED",
          activeParticipantType: payload.activeParticipantType,
        });
      }
    }) as typeof console.log;

    try {
      const session = createFilmRoomSessionCoordinator({ sessionId: "playhead-2" });
      const video = createFieldCoordinator();
      const coachAudio = createFieldCoordinator();
      session.register(video, "video");
      session.register(coachAudio, "coach_audio");

      await video.play();
      video.applyVideoStatus({
        isLoaded: true,
        positionMillis: 100,
        isPlaying: true,
      });

      await coachAudio.play();
      coachAudio.applyAudioStatus({
        isLoaded: true,
        positionMillis: 200,
        isPlaying: true,
      });
      await settleFanOut();

      // Inactive measurement must not emit playhead updates.
      const beforeInactive = events.length;
      video.applyVideoStatus({
        isLoaded: true,
        positionMillis: 7777,
        isPlaying: false,
      });
      assert.equal(events.length, beforeInactive);
      assert.equal(video.getSnapshot().currentTimeMs, 7777);
      assert.equal(session.getPlayhead().currentTimeMs, 200);
      assert.notEqual(video.getSnapshot().currentTimeMs, session.getPlayhead().currentTimeMs);

      // Exactly one publisher identity in emitted updates: never both at once.
      assert.ok(events.length > 0);
      for (const event of events) {
        assert.ok(
          event.activeParticipantType === "video" ||
            event.activeParticipantType === "coach_audio",
        );
      }
      assert.equal(events[events.length - 1]?.activeParticipantType, "coach_audio");

      session.destroy();
    } finally {
      console.log = originalLog;
    }
  });

  it("does not change exclusivity or field playback behavior", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "playhead-3" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    await coachAudio.play();
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(session.getActiveParticipant(), coachAudio);
    assert.equal(session.getPlayhead().playbackState, "playing");

    await coachAudio.pause();
    assert.equal(coachAudio.getSnapshot().playbackState, "paused");
    assert.equal(session.getActiveParticipant(), coachAudio);
    assert.equal(session.getPlayhead().playbackState, "paused");

    session.destroy();
  });
});

describe("Film Room seek authority v0", () => {
  it("routes seek intent only to the active participant", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "seek-1" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    const videoSeeks = trackSeekCalls(video);
    const coachSeeks = trackSeekCalls(coachAudio);
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    assert.equal(session.getActiveParticipant(), video);

    await session.requestSeek(2500);
    assert.ok(videoSeeks.includes(2500));
    assert.equal(video.getSnapshot().currentTimeMs, 2500);
    // requestSeek is leader-only; inactive may still move via sync fan-out after playhead update.
    await settleFanOut();
    assert.equal(coachAudio.getSnapshot().currentTimeMs, 2500);

    // Leadership switch: only the new active receives requestSeek routing.
    const coachSeeksBeforeSwitch = coachSeeks.length;
    await coachAudio.play();
    await session.requestSeek(800);
    assert.ok(coachSeeks.slice(coachSeeksBeforeSwitch).includes(800));
    assert.equal(coachAudio.getSnapshot().currentTimeMs, 800);
    await settleFanOut();
    // Sync fan-out then aligns the inactive leader clock — not requestSeek itself.
    assert.equal(video.getSnapshot().currentTimeMs, 800);

    session.destroy();
  });

  it("does not route when there is no active participant", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "seek-2" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    const videoSeeks = trackSeekCalls(video);
    const coachSeeks = trackSeekCalls(coachAudio);
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    assert.equal(session.getActiveParticipant(), null);
    await session.requestSeek(1000);
    await settleFanOut();

    assert.deepEqual(videoSeeks, []);
    assert.deepEqual(coachSeeks, []);
    assert.deepEqual(session.getPlayhead(), { currentTimeMs: 0, playbackState: "idle" });

    session.destroy();
  });

  it("does not change playback state", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "seek-3" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    assert.equal(video.getSnapshot().playbackState, "playing");
    assert.equal(session.getPlayhead().playbackState, "playing");

    await session.requestSeek(1200);
    await settleFanOut();
    assert.equal(video.getSnapshot().playbackState, "playing");
    assert.equal(session.getPlayhead().playbackState, "playing");
    // Sync moves inactive clock only — not playback state (exclusivity governs play/pause).
    assert.equal(coachAudio.getSnapshot().playbackState, "idle");
    assert.equal(coachAudio.getSnapshot().currentTimeMs, 1200);

    await video.pause();
    await session.requestSeek(3400);
    await settleFanOut();
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(session.getPlayhead().playbackState, "paused");
    assert.equal(session.getActiveParticipant(), video);
    assert.equal(coachAudio.getSnapshot().playbackState, "idle");

    session.destroy();
  });

  it("keeps session playhead updates on the measurement publication path", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "seek-4" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    await session.requestSeek(1500);
    // Field seek publishes a snapshot; session still only accepts active publisher.
    assert.equal(session.getPlayhead().currentTimeMs, 1500);

    await coachAudio.play();
    const playheadAfterSwitch = session.getPlayhead();

    // Inactive measurement must still be ignored after seek authority lands.
    video.applyVideoStatus({
      isLoaded: true,
      positionMillis: 9999,
      isPlaying: false,
    });
    assert.deepEqual(session.getPlayhead(), playheadAfterSwitch);

    // Active measurement remains the sole playhead publisher.
    coachAudio.applyAudioStatus({
      isLoaded: true,
      positionMillis: 640,
      isPlaying: true,
    });
    assert.deepEqual(session.getPlayhead(), {
      currentTimeMs: 640,
      playbackState: "playing",
    });

    session.destroy();
  });

  it("emits FILMROOM_SEEK_REQUESTED and FILMROOM_SEEK_ROUTED with required fields", async () => {
    const events: Array<{
      event: string;
      sessionId?: string;
      activeParticipantType?: string | null;
      requestedTimeMs?: number;
    }> = [];
    const originalLog = console.log;
    console.log = ((...args: unknown[]) => {
      const tag = typeof args[0] === "string" ? args[0] : "";
      if (tag === "[FILMROOM_SEEK_REQUESTED]" || tag === "[FILMROOM_SEEK_ROUTED]") {
        const payload = args[1] as {
          sessionId?: string;
          activeParticipantType?: string | null;
          requestedTimeMs?: number;
        };
        events.push({
          event: tag.slice(1, -1),
          sessionId: payload.sessionId,
          activeParticipantType: payload.activeParticipantType,
          requestedTimeMs: payload.requestedTimeMs,
        });
      }
    }) as typeof console.log;

    try {
      const session = createFilmRoomSessionCoordinator({ sessionId: "seek-5" });
      const video = createFieldCoordinator();
      const coachAudio = createFieldCoordinator();
      session.register(video, "video");
      session.register(coachAudio, "coach_audio");

      // No active: requested only, never routed.
      await session.requestSeek(500);
      assert.equal(events.length, 1);
      assert.deepEqual(events[0], {
        event: "FILMROOM_SEEK_REQUESTED",
        sessionId: "seek-5",
        activeParticipantType: null,
        requestedTimeMs: 500,
      });

      await video.play();
      events.length = 0;
      await session.requestSeek(2750);

      assert.deepEqual(events, [
        {
          event: "FILMROOM_SEEK_REQUESTED",
          sessionId: "seek-5",
          activeParticipantType: "video",
          requestedTimeMs: 2750,
        },
        {
          event: "FILMROOM_SEEK_ROUTED",
          sessionId: "seek-5",
          activeParticipantType: "video",
          requestedTimeMs: 2750,
        },
      ]);

      session.destroy();
    } finally {
      console.log = originalLog;
    }
  });

  it("preserves exclusivity and active-participant boundaries", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "seek-6" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    await session.requestSeek(400);
    await settleFanOut();
    await coachAudio.play();

    assert.equal(session.getActiveParticipant(), coachAudio);
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(session.getPlayhead().playbackState, "playing");

    await session.requestSeek(50);
    await settleFanOut();
    assert.equal(coachAudio.getSnapshot().currentTimeMs, 50);
    assert.equal(video.getSnapshot().currentTimeMs, 50);
    assert.equal(session.getActiveParticipant(), coachAudio);
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");

    session.destroy();
  });
});

describe("Film Room synchronization fan-out v0", () => {
  it("propagates session playhead time to inactive participants via field seek", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "sync-1" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    const coachSeeks = trackSeekCalls(coachAudio);
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    video.applyVideoStatus({
      isLoaded: true,
      positionMillis: 1800,
      isPlaying: true,
    });
    await settleFanOut();

    assert.equal(session.getPlayhead().currentTimeMs, 1800);
    assert.ok(coachSeeks.includes(1800));
    assert.equal(coachAudio.getSnapshot().currentTimeMs, 1800);
    // Sync does not start inactive playback.
    assert.equal(coachAudio.getSnapshot().playbackState, "idle");

    session.destroy();
  });

  it("does not let sync become a playhead authority", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "sync-2" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    video.applyVideoStatus({
      isLoaded: true,
      positionMillis: 900,
      isPlaying: true,
    });
    await settleFanOut();
    assert.equal(session.getPlayhead().currentTimeMs, 900);

    // Inactive clock moved by fan-out; further inactive measurement still ignored.
    coachAudio.applyAudioStatus({
      isLoaded: true,
      positionMillis: 5555,
      isPlaying: false,
    });
    assert.equal(session.getPlayhead().currentTimeMs, 900);
    assert.equal(session.getActiveParticipant(), video);

    session.destroy();
  });

  it("originates only from FilmRoomSessionCoordinator playhead updates", async () => {
    const events: Array<{
      event: string;
      sessionId?: string;
      sourceParticipantType?: string | null;
      destinationParticipantType?: string | null;
      currentTimeMs?: number;
    }> = [];
    const originalLog = console.log;
    console.log = ((...args: unknown[]) => {
      const tag = typeof args[0] === "string" ? args[0] : "";
      if (tag === "[FILMROOM_SYNC_PROPAGATED]") {
        const payload = args[1] as {
          sessionId?: string;
          sourceParticipantType?: string | null;
          destinationParticipantType?: string | null;
          currentTimeMs?: number;
        };
        events.push({
          event: "FILMROOM_SYNC_PROPAGATED",
          sessionId: payload.sessionId,
          sourceParticipantType: payload.sourceParticipantType,
          destinationParticipantType: payload.destinationParticipantType,
          currentTimeMs: payload.currentTimeMs,
        });
      }
    }) as typeof console.log;

    try {
      const session = createFilmRoomSessionCoordinator({ sessionId: "sync-3" });
      const video = createFieldCoordinator();
      const coachAudio = createFieldCoordinator();
      session.register(video, "video");
      session.register(coachAudio, "coach_audio");

      // No active publisher → no playhead update → no sync.
      video.applyVideoStatus({
        isLoaded: true,
        positionMillis: 100,
        isPlaying: true,
      });
      await settleFanOut();
      assert.equal(events.length, 0);

      await video.play();
      events.length = 0;
      video.applyVideoStatus({
        isLoaded: true,
        positionMillis: 2200,
        isPlaying: true,
      });
      await settleFanOut();

      assert.deepEqual(events, [
        {
          event: "FILMROOM_SYNC_PROPAGATED",
          sessionId: "sync-3",
          sourceParticipantType: "video",
          destinationParticipantType: "coach_audio",
          currentTimeMs: 2200,
        },
      ]);

      // Field coordinators still have no session/sync API surface.
      assert.equal(typeof (video as { requestSeek?: unknown }).requestSeek, "undefined");
      assert.ok(!("propagateSync" in video));

      session.destroy();
    } finally {
      console.log = originalLog;
    }
  });

  it("preserves exclusivity: sync never fans out play/pause", async () => {
    const session = createFilmRoomSessionCoordinator({ sessionId: "sync-4" });
    const video = createFieldCoordinator();
    const coachAudio = createFieldCoordinator();
    session.register(video, "video");
    session.register(coachAudio, "coach_audio");

    await video.play();
    await coachAudio.play();
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");

    coachAudio.applyAudioStatus({
      isLoaded: true,
      positionMillis: 300,
      isPlaying: true,
    });
    await settleFanOut();

    assert.equal(video.getSnapshot().currentTimeMs, 300);
    assert.equal(video.getSnapshot().playbackState, "paused");
    assert.equal(coachAudio.getSnapshot().playbackState, "playing");
    assert.equal(session.getActiveParticipant(), coachAudio);

    session.destroy();
  });
});