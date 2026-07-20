/**
 * AudioAdapter — forwards playback I/O to an existing expo-av Audio.Sound engine.
 *
 * Mirrors CoachVoiceNoteField / MatchCard Sound calls only:
 * playAsync / pauseAsync / setPositionAsync / stopAsync / unloadAsync.
 * Does not own UI, hydration, or media URL resolution.
 */

export type AudioEngine = {
  playAsync: () => Promise<unknown>;
  pauseAsync: () => Promise<unknown>;
  setPositionAsync?: (positionMillis: number) => Promise<unknown>;
  stopAsync?: () => Promise<unknown>;
  unloadAsync: () => Promise<unknown>;
  getStatusAsync?: () => Promise<AudioEngineStatus>;
};

export type AudioEngineStatus = {
  isLoaded: boolean;
  positionMillis?: number;
  durationMillis?: number | null;
  isPlaying?: boolean;
  didJustFinish?: boolean;
  error?: string | null;
};

export type AudioAdapter = {
  /** True when getEngine currently returns a live engine. */
  isBound: () => boolean;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  unload: () => Promise<void>;
  getPositionMs: () => Promise<number | null>;
  getDurationMs: () => Promise<number | null>;
};

/**
 * @param getEngine Returns the live Audio.Sound, or null when unbound.
 * Unbound engines no-op — preserves existing runtime until a wiring slice.
 */
export function createAudioAdapter(getEngine: () => AudioEngine | null): AudioAdapter {
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
        // Match existing commentary pause/play swallow paths.
      }
    },

    async pause() {
      const engine = getEngine();
      if (!engine) return;
      try {
        await engine.pauseAsync();
      } catch {
        // Match existing commentary pause swallow.
      }
    },

    async seek(positionMs: number) {
      const engine = getEngine();
      if (!engine?.setPositionAsync) return;
      try {
        await engine.setPositionAsync(positionMs);
      } catch {
        // No existing audio seek path; swallow if engine rejects.
      }
    },

    async unload() {
      const engine = getEngine();
      if (!engine) return;
      try {
        await engine.stopAsync?.();
      } catch {
        // ignore — matches unloadPlayback
      }
      try {
        await engine.unloadAsync();
      } catch {
        // ignore — matches unloadPlayback
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
  };
}
