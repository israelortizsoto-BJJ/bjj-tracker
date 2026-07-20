/**
 * PlaybackCoordinator v0 — public playback API shell.
 *
 * Owns play / pause / seek / replay / unload intent, snapshot truth, and
 * lifecycle termination (unload resets snapshot to idle).
 * Video status ownership: expo-av onPlaybackStatusUpdate → applyVideoStatus
 * (playbackState, currentTimeMs, durationMs, finish → paused).
 * Audio status ownership: Audio.Sound status → applyAudioStatus
 * (playbackState, currentTimeMs, durationMs, finish → idle — coach authoring).
 * Delegates engine I/O to VideoAdapter + AudioAdapter.
 *
 * v0 constraints (certified):
 * - Forward existing playback calls only
 * - Do not synchronize video and commentary timelines
 * - Do not modify Film Room UI, hydration, or media resolution
 *
 * Adapters no-op when unbound. Bind exactly one engine per coordinator instance:
 * - MatchMediaAttachments: video bound, audio unbound
 * - CoachVoiceNoteField: audio bound, video unbound
 * - MatchCard (parent commentary): audio bound, video unbound
 */

import type { AudioAdapter, AudioEngineStatus } from "./AudioAdapter";
import type { VideoAdapter, VideoEngineStatus } from "./VideoAdapter";

export type PlaybackState = "idle" | "loading" | "playing" | "paused";

export type PlaybackSnapshot = {
  playbackState: PlaybackState;
  currentTimeMs: number;
  durationMs: number | null;
};

/** Optional pre-play hook. Sessions may install for arbitration; unset = no-op. */
export type PlayIntentHandler = () => void | Promise<void>;

export type PlaybackCoordinator = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  replay: () => Promise<void>;
  unload: () => Promise<void>;
  /**
   * Install or clear a play-intent listener invoked before play/replay engine I/O.
   * Does not encode session or peer knowledge — callers own arbitration.
   */
  setPlayIntentHandler: (handler: PlayIntentHandler | null) => void;
  /** Push video engine status into snapshot truth. No-ops when not loaded. */
  applyVideoStatus: (status: VideoEngineStatus) => void;
  /** Push audio engine status into snapshot truth. No-ops when not loaded. */
  applyAudioStatus: (status: AudioEngineStatus) => void;
  getSnapshot: () => PlaybackSnapshot;
  subscribe: (listener: (snapshot: PlaybackSnapshot) => void) => () => void;
};

export type PlaybackCoordinatorDeps = {
  video: VideoAdapter;
  audio: AudioAdapter;
};

export function createPlaybackCoordinator(deps: PlaybackCoordinatorDeps): PlaybackCoordinator {
  const { video, audio } = deps;

  let snapshot: PlaybackSnapshot = {
    playbackState: "idle",
    currentTimeMs: 0,
    durationMs: null,
  };
  let playIntentHandler: PlayIntentHandler | null = null;

  const listeners = new Set<(snapshot: PlaybackSnapshot) => void>();

  async function notifyPlayIntent() {
    if (!playIntentHandler) return;
    await playIntentHandler();
  }

  function publish(next: PlaybackSnapshot) {
    snapshot = next;
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function setPlaybackState(playbackState: PlaybackState) {
    publish({ ...snapshot, playbackState });
  }

  function applyVideoStatus(status: VideoEngineStatus) {
    if (!status.isLoaded) return;

    const currentTimeMs =
      typeof status.positionMillis === "number" ? status.positionMillis : snapshot.currentTimeMs;
    const durationMs =
      typeof status.durationMillis === "number" ? status.durationMillis : snapshot.durationMs;

    // Finish matches MatchMediaAttachments → onPause (paused, not idle).
    let playbackState: PlaybackState = snapshot.playbackState;
    if (status.didJustFinish) {
      playbackState = "paused";
    } else if (typeof status.isPlaying === "boolean") {
      playbackState = status.isPlaying ? "playing" : "paused";
    }

    publish({ playbackState, currentTimeMs, durationMs });
  }

  function applyAudioStatus(status: AudioEngineStatus) {
    if (!status.isLoaded) return;

    const currentTimeMs =
      typeof status.positionMillis === "number" ? status.positionMillis : snapshot.currentTimeMs;
    const durationMs =
      typeof status.durationMillis === "number" ? status.durationMillis : snapshot.durationMs;

    // Finish matches CoachVoiceNoteField (idle + unload), not video (paused).
    let playbackState: PlaybackState = snapshot.playbackState;
    if (status.didJustFinish) {
      playbackState = "idle";
    } else if (typeof status.isPlaying === "boolean") {
      playbackState = status.isPlaying ? "playing" : "paused";
    }

    publish({ playbackState, currentTimeMs, durationMs });
  }

  async function refreshClockFromAdapters() {
    // Video is the primary Film Room artifact; fall back to audio position.
    const videoPosition = await video.getPositionMs();
    const audioPosition = await audio.getPositionMs();
    const currentTimeMs =
      videoPosition !== null ? videoPosition : audioPosition !== null ? audioPosition : snapshot.currentTimeMs;

    const videoDuration = await video.getDurationMs();
    const audioDuration = await audio.getDurationMs();
    const durationMs =
      videoDuration !== null ? videoDuration : audioDuration !== null ? audioDuration : snapshot.durationMs;

    publish({ ...snapshot, currentTimeMs, durationMs });
  }

  return {
    async play() {
      // Forward intent only. Unbound adapters no-op.
      // Bind exactly one engine per session until a later wiring slice —
      // do not bind both (would fan-out play without timeline sync).
      await notifyPlayIntent();
      await video.play();
      await audio.play();
      setPlaybackState("playing");
      await refreshClockFromAdapters();
    },

    async pause() {
      await video.pause();
      await audio.pause();
      setPlaybackState("paused");
      await refreshClockFromAdapters();
    },

    async seek(positionMs: number) {
      // Today only video exercises seek (replay → 0). Audio seek is forward-only.
      await video.seek(positionMs);
      await audio.seek(positionMs);
      publish({ ...snapshot, currentTimeMs: positionMs });
      await refreshClockFromAdapters();
    },

    async replay() {
      // Existing MatchMediaAttachments.replayVideo = seek(0) + play.
      // Replay begins playback — same exclusivity intent path as play.
      await notifyPlayIntent();
      await video.seek(0);
      await audio.seek(0);
      await video.play();
      await audio.play();
      publish({ ...snapshot, playbackState: "playing", currentTimeMs: 0 });
      await refreshClockFromAdapters();
    },

    async unload() {
      await video.unload();
      await audio.unload();
      publish({
        playbackState: "idle",
        currentTimeMs: 0,
        durationMs: null,
      });
    },

    setPlayIntentHandler(handler) {
      playIntentHandler = handler;
    },

    applyVideoStatus,

    applyAudioStatus,

    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
