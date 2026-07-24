/**
 * VideoAdapter — forwards playback I/O to an existing expo-av Video engine.
 *
 * Mirrors MatchMediaAttachments video calls only:
 * playAsync / pauseAsync / setPositionAsync.
 * Does not own UI, hydration, or media resolution.
 */

export type VideoEngine = {
  playAsync: () => Promise<unknown>;
  pauseAsync: () => Promise<unknown>;
  setPositionAsync: (positionMillis: number) => Promise<unknown>;
  getStatusAsync?: () => Promise<VideoEngineStatus>;
};

export type VideoEngineStatus = {
  isLoaded: boolean;
  positionMillis?: number;
  durationMillis?: number | null;
  isPlaying?: boolean;
  didJustFinish?: boolean;
  error?: string | null;
};

export type VideoAdapter = {
  /** True when getEngine currently returns a live engine. */
  isBound: () => boolean;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  unload: () => Promise<void>;
  getPositionMs: () => Promise<number | null>;
  getDurationMs: () => Promise<number | null>;
  /**
   * Strict pause path for capture-boundary callers. Unlike `pause()`, this does
   * not swallow native failure and returns the status produced by this exact
   * `pauseAsync()` request together with the bound engine identity.
   */
  requestPauseConfirmation: () => Promise<VideoPauseConfirmationRequest>;
  /** True only while the engine that served a request remains the live engine. */
  isPauseConfirmationCurrent: (request: VideoPauseConfirmationRequest) => boolean;
};

export type VideoPauseConfirmationRequest = {
  engine: VideoEngine;
  status: VideoEngineStatus | null;
};

function asVideoEngineStatus(value: unknown): VideoEngineStatus | null {
  if (!value || typeof value !== "object" || !("isLoaded" in value)) return null;
  const status = value as VideoEngineStatus;
  return typeof status.isLoaded === "boolean" ? status : null;
}

/**
 * @param getEngine Returns the live Video ref/engine, or null when unbound.
 * Unbound engines no-op — preserves existing runtime until a wiring slice.
 */
export function createVideoAdapter(getEngine: () => VideoEngine | null): VideoAdapter {
  return {
    isBound() {
      return getEngine() !== null;
    },

    async play() {
      const engine = getEngine();
      if (!engine) return;
      try {
        await engine.playAsync();
      } catch {
        // Match existing MatchMediaAttachments.playVideo swallow.
      }
    },

    async pause() {
      const engine = getEngine();
      if (!engine) return;
      try {
        await engine.pauseAsync();
      } catch {
        // Match existing MatchMediaAttachments.pauseVideo swallow.
      }
    },

    async seek(positionMs: number) {
      const engine = getEngine();
      if (!engine) return;
      try {
        await engine.setPositionAsync(positionMs);
      } catch {
        // Match existing MatchMediaAttachments.replayVideo swallow.
      }
    },

    async unload() {
      const engine = getEngine();
      if (!engine) return;
      try {
        await engine.pauseAsync();
      } catch {
        // Match existing MatchMediaAttachments pause swallow.
      }
    },

    async getPositionMs() {
      const engine = getEngine();
      if (!engine?.getStatusAsync) return null;
      try {
        const status = await engine.getStatusAsync();
        if (!status.isLoaded) return null;
        return typeof status.positionMillis === "number" ? status.positionMillis : null;
      } catch {
        return null;
      }
    },

    async getDurationMs() {
      const engine = getEngine();
      if (!engine?.getStatusAsync) return null;
      try {
        const status = await engine.getStatusAsync();
        if (!status.isLoaded) return null;
        return typeof status.durationMillis === "number" ? status.durationMillis : null;
      } catch {
        return null;
      }
    },

    async requestPauseConfirmation() {
      const engine = getEngine();
      if (!engine) {
        throw new Error("Video pause confirmation requires a bound video engine.");
      }
      const status = await engine.pauseAsync();
      return { engine, status: asVideoEngineStatus(status) };
    },

    isPauseConfirmationCurrent(request) {
      return getEngine() === request.engine;
    },
  };
}
