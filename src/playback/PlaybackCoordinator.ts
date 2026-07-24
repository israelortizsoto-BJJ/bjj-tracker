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
 * Adapters no-op when unbound. Runtime invariant (EX-1 closed):
 * a coordinator may have at most one live engine bound (video XOR audio).
 * Dual-binding is rejected fail-fast via assertSingleEngineBound.
 * Call-site convention remains:
 * - MatchMediaAttachments: video bound, audio unbound
 * - CoachVoiceNoteField: audio bound, video unbound
 * - FilmRoomCoachCommentaryControls (parent Film Room): audio bound, video unbound
 */

import type { AudioAdapter, AudioEngineStatus } from "./AudioAdapter";
import type { VideoAdapter, VideoEngineStatus } from "./VideoAdapter";

/** Narrow failure surface for a request-correlated native video pause. */
export class PlaybackVideoPauseConfirmationError extends Error {
  readonly code:
    | "VIDEO_PAUSE_CONFIRMATION_SUPERSEDED"
    | "VIDEO_PAUSE_CONFIRMATION_TIMEOUT"
    | "VIDEO_PAUSE_CONFIRMATION_CANCELLED"
    | "VIDEO_PAUSE_CONFIRMATION_REPLACED"
    | "VIDEO_PAUSE_CONFIRMATION_INVALID_STATUS";

  constructor(
    code: PlaybackVideoPauseConfirmationError["code"],
    message: string,
  ) {
    super(message);
    this.name = "PlaybackVideoPauseConfirmationError";
    this.code = code;
  }
}

export type ConfirmedVideoPause = {
  positionMillis: number;
};

export type ConfirmedVideoPauseOptions = {
  /** Bounded native-operation wait; callers may only shorten it for focused UI needs. */
  timeoutMs?: number;
};

const DEFAULT_VIDEO_PAUSE_CONFIRMATION_TIMEOUT_MS = 750;

/** Thrown when both video and audio adapters report a live engine. */
export class PlaybackCoordinatorDualBindError extends Error {
  readonly code = "PLAYBACK_COORDINATOR_DUAL_BIND" as const;

  constructor() {
    super(
      "PlaybackCoordinator invariant violated: video and audio engines must not be bound simultaneously (video XOR audio).",
    );
    this.name = "PlaybackCoordinatorDualBindError";
  }
}

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
  /**
   * Strict capture-boundary pause. Resolves only from the native status returned
   * by this exact `pauseAsync()` request; ordinary `pause()` remains unchanged.
   */
  requestConfirmedVideoPause: (options?: ConfirmedVideoPauseOptions) => Promise<ConfirmedVideoPause>;
  /** Reject a pending strict pause when its bound player is being replaced or unmounted. */
  cancelConfirmedVideoPause: (reason?: string) => void;
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
  let nextVideoPauseRequestId = 0;
  let pendingVideoPause:
    | {
        id: number;
        timer: ReturnType<typeof setTimeout>;
        reject: (reason: Error) => void;
      }
    | null = null;

  const listeners = new Set<(snapshot: PlaybackSnapshot) => void>();

  /**
   * Repository-enforced single-engine invariant.
   * Binding is lifecycle-driven via adapter getEngine closures; both adapter
   * objects remain present, but at most one may report isBound() === true.
   */
  function assertSingleEngineBound() {
    if (video.isBound() && audio.isBound()) {
      throw new PlaybackCoordinatorDualBindError();
    }
  }

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

  function clearPendingVideoPause(
    pending: NonNullable<typeof pendingVideoPause>,
  ): boolean {
    if (pendingVideoPause !== pending) return false;
    clearTimeout(pending.timer);
    pendingVideoPause = null;
    return true;
  }

  function rejectPendingVideoPause(
    pending: NonNullable<typeof pendingVideoPause>,
    error: Error,
  ) {
    if (!clearPendingVideoPause(pending)) return;
    pending.reject(error);
  }

  function cancelConfirmedVideoPause(reason = "Video player was replaced or unmounted.") {
    const pending = pendingVideoPause;
    if (!pending) return;
    rejectPendingVideoPause(
      pending,
      new PlaybackVideoPauseConfirmationError(
        "VIDEO_PAUSE_CONFIRMATION_CANCELLED",
        reason,
      ),
    );
  }

  function applyVideoStatus(status: VideoEngineStatus) {
    assertSingleEngineBound();
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
    assertSingleEngineBound();
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
    assertSingleEngineBound();
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
      // Dual-bind is rejected before any engine I/O (EX-1).
      assertSingleEngineBound();
      await notifyPlayIntent();
      await video.play();
      await audio.play();
      setPlaybackState("playing");
      await refreshClockFromAdapters();
    },

    async pause() {
      assertSingleEngineBound();
      await video.pause();
      await audio.pause();
      setPlaybackState("paused");
      await refreshClockFromAdapters();
    },

    requestConfirmedVideoPause(options = {}) {
      assertSingleEngineBound();
      const timeoutMs = options.timeoutMs ?? DEFAULT_VIDEO_PAUSE_CONFIRMATION_TIMEOUT_MS;
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > DEFAULT_VIDEO_PAUSE_CONFIRMATION_TIMEOUT_MS) {
        return Promise.reject(
          new RangeError(
            `Video pause confirmation timeout must be a positive integer no greater than ${DEFAULT_VIDEO_PAUSE_CONFIRMATION_TIMEOUT_MS}.`,
          ),
        );
      }

      const previous = pendingVideoPause;
      if (previous) {
        rejectPendingVideoPause(
          previous,
          new PlaybackVideoPauseConfirmationError(
            "VIDEO_PAUSE_CONFIRMATION_SUPERSEDED",
            "Video pause confirmation was superseded by a newer request.",
          ),
        );
      }

      return new Promise<ConfirmedVideoPause>((resolve, reject) => {
        const id = ++nextVideoPauseRequestId;
        let pending: NonNullable<typeof pendingVideoPause>;
        const timer = setTimeout(() => {
          rejectPendingVideoPause(
            pending,
            new PlaybackVideoPauseConfirmationError(
              "VIDEO_PAUSE_CONFIRMATION_TIMEOUT",
              "Timed out waiting for request-correlated native video pause confirmation.",
            ),
          );
        }, timeoutMs);
        pending = {
          id,
          timer,
          reject,
        };
        pendingVideoPause = pending;

        void (async () => {
          try {
            const request = await video.requestPauseConfirmation();
            if (pendingVideoPause !== pending) return;
            if (!video.isPauseConfirmationCurrent(request)) {
              rejectPendingVideoPause(
                pending,
                new PlaybackVideoPauseConfirmationError(
                  "VIDEO_PAUSE_CONFIRMATION_REPLACED",
                  "Video player changed before native pause confirmation arrived.",
                ),
              );
              return;
            }
            const status = request.status;
            if (
              !status?.isLoaded ||
              status.isPlaying !== false ||
              typeof status.positionMillis !== "number" ||
              !Number.isFinite(status.positionMillis) ||
              status.positionMillis < 0
            ) {
              rejectPendingVideoPause(
                pending,
                new PlaybackVideoPauseConfirmationError(
                  "VIDEO_PAUSE_CONFIRMATION_INVALID_STATUS",
                  "Native pause request did not return a loaded, paused status with a valid position.",
                ),
              );
              return;
            }
            if (!clearPendingVideoPause(pending)) return;
            resolve({ positionMillis: status.positionMillis });
          } catch (error) {
            if (!clearPendingVideoPause(pending)) return;
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        })();
      });
    },

    cancelConfirmedVideoPause,

    async seek(positionMs: number) {
      // Today only video exercises seek (replay → 0). Audio seek is forward-only.
      assertSingleEngineBound();
      await video.seek(positionMs);
      await audio.seek(positionMs);
      publish({ ...snapshot, currentTimeMs: positionMs });
      await refreshClockFromAdapters();
    },

    async replay() {
      // Existing MatchMediaAttachments.replayVideo = seek(0) + play.
      // Replay begins playback — same exclusivity intent path as play.
      assertSingleEngineBound();
      await notifyPlayIntent();
      await video.seek(0);
      await audio.seek(0);
      await video.play();
      await audio.play();
      publish({ ...snapshot, playbackState: "playing", currentTimeMs: 0 });
      await refreshClockFromAdapters();
    },

    async unload() {
      cancelConfirmedVideoPause();
      assertSingleEngineBound();
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
