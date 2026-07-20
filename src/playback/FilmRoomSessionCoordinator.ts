/**
 * FilmRoomSessionCoordinator — session-scoped composition + exclusivity v0
 * + active participant authority v0
 * + session playhead publication v0
 * + seek authority v0
 * + synchronization fan-out v0.
 *
 * Holds identity for a Film Room session and a registration set of
 * field-local PlaybackCoordinator instances.
 *
 * Exclusivity v0 (relationship arbitration only):
 * - On play intent from a registered participant, pause every other
 *   registered participant that is currently playing.
 * - Initiating participant continues its own play/replay path unchanged.
 * - Already-paused / idle participants are ignored.
 *
 * Active participant authority v0:
 * - On successful play intent, record the initiator as the active participant.
 * - Clear only when that participant unregisters or the session is destroyed.
 * - Pause does not clear active participant (paused leader remains leader).
 *
 * Session playhead publication v0:
 * - Session owns canonical { currentTimeMs, playbackState }.
 * - Only the active participant's field snapshot may update the session playhead.
 * - Inactive participant measurements are ignored.
 * - Playhead remains the sole temporal source for sync fan-out.
 *
 * Seek authority v0:
 * - Session owns seek intent via requestSeek(timeMs).
 * - Routes only to the active participant's existing seek() API.
 * - Does not write session playhead from the seek request; playhead continues
 *   to update exclusively via active-participant snapshot publication.
 * - requestSeek remains leader-only; inactive routing is sync fan-out only.
 *
 * Synchronization fan-out v0:
 * - After a session playhead update, compare active vs registered participants.
 * - For every inactive participant, route currentTimeMs through the same
 *   field seek() API requestSeek uses for the leader (internal equivalent;
 *   requestSeek itself stays leader-only).
 * - Propagation only — sync does not own playhead, playback state, or engines.
 * - No already-synchronized skip, drift correction, timers, polling, or
 *   continuous reconciliation. No play/pause fan-out (exclusivity governs that).
 *
 * Blast radius:
 * - Touches: FilmRoomSessionCoordinator.applyPlayheadFromActive only.
 * - Invokes: PlaybackCoordinator.seek() on inactive registered participants.
 * - Does not modify: PlaybackCoordinator ownership, requestSeek leader contract,
 *   playhead publisher rule, exclusivity, or active-participant authority.
 * - Side effect: inactive field clocks move; their snapshot publishes remain
 *   ignored for session playhead (active publisher rule unchanged).
 *
 * Still out of scope:
 * - drift correction, shared clock, continuous reconciliation
 * - replay routing, auto-resume, React Context
 * - session playhead subscribe API (consumers poll getPlayhead for now)
 * - intercepting field-local seek/replay (replay remains field-owned)
 * - transcript / waveform following
 *
 * Field coordinators remain single-engine and surface-owned. They do not
 * know about peers. Arbitration and sync propagation originate only here.
 */

import type {
  PlaybackCoordinator,
  PlaybackSnapshot,
  PlaybackState,
} from "./PlaybackCoordinator";

/** Surface role of a registered field coordinator within one Film Room session. */
export type FilmRoomParticipantType = "video" | "coach_audio";

/** Canonical session playhead — sole temporal source for sync fan-out. */
export type FilmRoomPlayhead = {
  currentTimeMs: number;
  playbackState: PlaybackState;
};

export type FilmRoomSessionCoordinator = {
  readonly sessionId: string;
  register: (
    fieldCoordinator: PlaybackCoordinator,
    participantType: FilmRoomParticipantType,
  ) => void;
  unregister: (
    fieldCoordinator: PlaybackCoordinator,
    participantType: FilmRoomParticipantType,
  ) => void;
  participants: () => readonly PlaybackCoordinator[];
  /** Session leader after a successful play intent; null when none. */
  getActiveParticipant: () => PlaybackCoordinator | null;
  /** Canonical session playhead; follows the active participant only. */
  getPlayhead: () => FilmRoomPlayhead;
  /**
   * Session-owned seek intent. Routes to the active participant only.
   * Inactive participants follow via sync fan-out after playhead publication.
   * No-ops when destroyed or when there is no active participant.
   */
  requestSeek: (timeMs: number) => Promise<void>;
  /** Ends session lifetime. Clears membership; emits no playback calls. */
  destroy: () => void;
};

export type FilmRoomSessionCoordinatorDeps = {
  /** Optional stable id; when omitted a unique session id is generated. */
  sessionId?: string;
};

function generateSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `film-room-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type FilmRoomSessionEvent =
  | "FILMROOM_SESSION_CREATED"
  | "FILMROOM_PARTICIPANT_REGISTERED"
  | "FILMROOM_PARTICIPANT_UNREGISTERED"
  | "FILMROOM_SESSION_DESTROYED"
  | "FILMROOM_PLAY_REQUESTED"
  | "FILMROOM_PARTICIPANT_PAUSED_BY_SESSION"
  | "FILMROOM_ACTIVE_PARTICIPANT_CHANGED"
  | "FILMROOM_PLAYHEAD_UPDATED"
  | "FILMROOM_SEEK_REQUESTED"
  | "FILMROOM_SEEK_ROUTED"
  | "FILMROOM_SYNC_PROPAGATED";

type FilmRoomSessionEventPayload = {
  sessionId: string;
  participantCount: number;
  /** Membership events only. */
  participantType?: FilmRoomParticipantType | null;
  /** Exclusivity events. */
  initiatingParticipantType?: FilmRoomParticipantType | null;
  affectedParticipantType?: FilmRoomParticipantType | null;
  /** Active participant authority events. */
  previousParticipantType?: FilmRoomParticipantType | null;
  newParticipantType?: FilmRoomParticipantType | null;
  /** Session playhead publication + seek authority events. */
  activeParticipantType?: FilmRoomParticipantType | null;
  currentTimeMs?: number;
  playbackState?: PlaybackState;
  /** Seek authority events. */
  requestedTimeMs?: number;
  /** Synchronization fan-out events. */
  sourceParticipantType?: FilmRoomParticipantType | null;
  destinationParticipantType?: FilmRoomParticipantType | null;
};

function emitSessionEvent(event: FilmRoomSessionEvent, payload: FilmRoomSessionEventPayload) {
  if (!__DEV__) return;
  console.log(`[${event}]`, payload);
}

export function createFilmRoomSessionCoordinator(
  deps: FilmRoomSessionCoordinatorDeps = {},
): FilmRoomSessionCoordinator {
  const sessionId = deps.sessionId ?? generateSessionId();
  const registered = new Map<PlaybackCoordinator, FilmRoomParticipantType>();
  const snapshotUnsubscribers = new Map<PlaybackCoordinator, () => void>();
  let activeParticipant: PlaybackCoordinator | null = null;
  let playhead: FilmRoomPlayhead = {
    currentTimeMs: 0,
    playbackState: "idle",
  };
  let destroyed = false;

  function applyPlayheadFromActive(source: PlaybackCoordinator, snapshot: PlaybackSnapshot) {
    if (destroyed) return;
    // Exactly one publisher: only the active participant may update.
    if (source !== activeParticipant) return;

    const next: FilmRoomPlayhead = {
      currentTimeMs: snapshot.currentTimeMs,
      playbackState: snapshot.playbackState,
    };
    if (
      playhead.currentTimeMs === next.currentTimeMs &&
      playhead.playbackState === next.playbackState
    ) {
      return;
    }

    playhead = next;
    emitSessionEvent("FILMROOM_PLAYHEAD_UPDATED", {
      sessionId,
      activeParticipantType: registered.get(source) ?? null,
      currentTimeMs: playhead.currentTimeMs,
      playbackState: playhead.playbackState,
      participantCount: registered.size,
    });

    // Smallest interception after playhead update: propagate time only.
    // Sync does not write playhead, change playback state, or become an owner.
    propagateSyncToInactive(source, playhead.currentTimeMs);
  }

  /**
   * Internal seek routing equivalent to requestSeek's leader path, aimed at
   * one registered participant. Does not emit SEEK_* (those remain leader API).
   */
  async function routeSeekToParticipant(
    target: PlaybackCoordinator,
    timeMs: number,
  ): Promise<void> {
    if (destroyed) return;
    if (!registered.has(target)) return;
    await target.seek(timeMs);
  }

  /**
   * Session-driven sync fan-out v0. Originates only from playhead publication.
   * requestSeek stays leader-only; inactive clocks follow via this path.
   */
  function propagateSyncToInactive(
    source: PlaybackCoordinator,
    currentTimeMs: number,
  ) {
    if (destroyed) return;

    const sourceParticipantType = registered.get(source) ?? null;

    for (const [participant, participantType] of registered) {
      if (participant === activeParticipant) continue;

      void (async () => {
        await routeSeekToParticipant(participant, currentTimeMs);
        if (destroyed) return;
        if (!registered.has(participant)) return;

        emitSessionEvent("FILMROOM_SYNC_PROPAGATED", {
          sessionId,
          sourceParticipantType,
          destinationParticipantType: participantType,
          currentTimeMs,
          participantCount: registered.size,
        });
      })();
    }
  }

  function setActiveParticipant(next: PlaybackCoordinator | null) {
    if (activeParticipant === next) return;

    const previous = activeParticipant;
    const previousParticipantType = previous ? (registered.get(previous) ?? null) : null;
    const newParticipantType = next ? (registered.get(next) ?? null) : null;

    activeParticipant = next;
    emitSessionEvent("FILMROOM_ACTIVE_PARTICIPANT_CHANGED", {
      sessionId,
      previousParticipantType,
      newParticipantType,
      participantCount: registered.size,
    });

    // Seed playhead from the new leader so session truth follows immediately.
    if (next) {
      applyPlayheadFromActive(next, next.getSnapshot());
    }
  }

  async function handlePlayIntent(initiating: PlaybackCoordinator) {
    if (destroyed) return;
    const initiatingType = registered.get(initiating);
    if (initiatingType === undefined) return;

    const participantCount = registered.size;
    emitSessionEvent("FILMROOM_PLAY_REQUESTED", {
      sessionId,
      initiatingParticipantType: initiatingType,
      affectedParticipantType: null,
      participantCount,
    });

    for (const [participant, participantType] of registered) {
      if (participant === initiating) continue;
      // Ignore already-paused / idle — only interrupt active playback.
      if (participant.getSnapshot().playbackState !== "playing") continue;

      await participant.pause();
      emitSessionEvent("FILMROOM_PARTICIPANT_PAUSED_BY_SESSION", {
        sessionId,
        initiatingParticipantType: initiatingType,
        affectedParticipantType: participantType,
        participantCount,
      });
    }

    // Successful play intent: initiator becomes session leader.
    // Pause of peers does not clear this — only unregister/destroy do.
    setActiveParticipant(initiating);
  }

  function installPlayIntentHandler(fieldCoordinator: PlaybackCoordinator) {
    fieldCoordinator.setPlayIntentHandler(() => handlePlayIntent(fieldCoordinator));
  }

  function clearPlayIntentHandler(fieldCoordinator: PlaybackCoordinator) {
    fieldCoordinator.setPlayIntentHandler(null);
  }

  /**
   * Smallest interception: reuse field subscribe() already published by
   * PlaybackCoordinator.publish. No engine or field-authority changes.
   */
  function installSnapshotForwarder(fieldCoordinator: PlaybackCoordinator) {
    const unsubscribe = fieldCoordinator.subscribe((snapshot) => {
      applyPlayheadFromActive(fieldCoordinator, snapshot);
    });
    snapshotUnsubscribers.set(fieldCoordinator, unsubscribe);
  }

  function clearSnapshotForwarder(fieldCoordinator: PlaybackCoordinator) {
    const unsubscribe = snapshotUnsubscribers.get(fieldCoordinator);
    if (!unsubscribe) return;
    unsubscribe();
    snapshotUnsubscribers.delete(fieldCoordinator);
  }

  emitSessionEvent("FILMROOM_SESSION_CREATED", {
    sessionId,
    participantType: null,
    participantCount: 0,
  });

  return {
    sessionId,

    register(fieldCoordinator, participantType) {
      if (destroyed) return;
      registered.set(fieldCoordinator, participantType);
      installPlayIntentHandler(fieldCoordinator);
      installSnapshotForwarder(fieldCoordinator);
      emitSessionEvent("FILMROOM_PARTICIPANT_REGISTERED", {
        sessionId,
        participantType,
        participantCount: registered.size,
      });
    },

    unregister(fieldCoordinator, participantType) {
      if (destroyed) return;
      if (!registered.has(fieldCoordinator)) return;
      clearPlayIntentHandler(fieldCoordinator);
      clearSnapshotForwarder(fieldCoordinator);
      // Clear active before membership delete so previous type remains resolvable.
      if (activeParticipant === fieldCoordinator) {
        setActiveParticipant(null);
      }
      registered.delete(fieldCoordinator);
      emitSessionEvent("FILMROOM_PARTICIPANT_UNREGISTERED", {
        sessionId,
        participantType,
        participantCount: registered.size,
      });
    },

    participants() {
      return Array.from(registered.keys());
    },

    getActiveParticipant() {
      return activeParticipant;
    },

    getPlayhead() {
      return playhead;
    },

    /**
     * Smallest interception for seek intent: session-owned API only.
     * Leader-only routing. Inactive participants follow via sync fan-out after
     * the active seek publishes a playhead update — not from this method.
     * Does not wrap field seek/replay; does not move engine ownership.
     */
    async requestSeek(timeMs) {
      if (destroyed) return;

      const activeParticipantType = activeParticipant
        ? (registered.get(activeParticipant) ?? null)
        : null;

      emitSessionEvent("FILMROOM_SEEK_REQUESTED", {
        sessionId,
        activeParticipantType,
        requestedTimeMs: timeMs,
        participantCount: registered.size,
      });

      // No leader → intent recorded, nothing routed.
      if (!activeParticipant) return;

      const target = activeParticipant;
      await routeSeekToParticipant(target, timeMs);

      // Route confirmation only after the active field seek API returns.
      // Playhead is not written here — active snapshot publication remains sole source.
      emitSessionEvent("FILMROOM_SEEK_ROUTED", {
        sessionId,
        activeParticipantType: registered.get(target) ?? null,
        requestedTimeMs: timeMs,
        participantCount: registered.size,
      });
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const fieldCoordinator of registered.keys()) {
        clearPlayIntentHandler(fieldCoordinator);
        clearSnapshotForwarder(fieldCoordinator);
      }
      // Clear active before membership clear so previous type remains resolvable.
      if (activeParticipant !== null) {
        setActiveParticipant(null);
      }
      registered.clear();
      emitSessionEvent("FILMROOM_SESSION_DESTROYED", {
        sessionId,
        participantType: null,
        participantCount: 0,
      });
    },
  };
}
