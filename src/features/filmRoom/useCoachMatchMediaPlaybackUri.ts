import { useCallback, useEffect, useRef, useState } from "react";

import { coachSyncResolveMatchMediaAttachment } from "../../services/coachMatchMediaResolutionApi";
import { resolveCoachMatchMediaSessionTarget } from "../../services/resolveCoachMatchMediaSessionTarget";
import { getCoachMatchMediaAttachment } from "../../storage/coachMatchMediaAttachmentStore";
import {
  decideCoachMatchMediaDeliveryFailure,
  resolveCoachMatchMediaPlaybackOnce,
  type CoachMatchMediaDeliveryFailureKind,
  type CoachMatchMediaPlaybackDependencies,
  type CoachMatchMediaPlaybackIdentity,
} from "./coachMatchMediaPlaybackResolve";

export {
  classifyCoachMatchMediaPlayerDeliveryError,
  classifyCoachMatchMediaResolveError,
  decideCoachMatchMediaDeliveryFailure,
  isCoachMatchMediaUrlExpired,
  parseCoachMatchMediaPlaybackIdentity,
  resolveCoachMatchMediaPlaybackOnce,
  type CoachMatchMediaDeliveryFailureKind,
  type CoachMatchMediaPlaybackDependencies,
  type CoachMatchMediaPlaybackIdentity,
  type CoachMatchMediaResolveAttemptResult,
} from "./coachMatchMediaPlaybackResolve";

export type CoachMatchMediaPlaybackStatus =
  | "idle"
  | "loading"
  | "ready"
  | "removed"
  | "missing"
  | "unavailable";

export type CoachMatchMediaPlaybackState = {
  status: CoachMatchMediaPlaybackStatus;
  /** Memory-only playable URI. Never persist, route, or log. */
  videoUri: string | null;
  canRetry: boolean;
  message: string | null;
};

const PRODUCTION_DEPS: CoachMatchMediaPlaybackDependencies = {
  getAttachment: getCoachMatchMediaAttachment,
  resolveSessionTarget: resolveCoachMatchMediaSessionTarget,
  resolveAttachment: coachSyncResolveMatchMediaAttachment,
  now: () => Date.now(),
};

const UNAVAILABLE_MESSAGE = "Video unavailable";
const REMOVED_MESSAGE = "Video removed";
const MISSING_MESSAGE = "No match video attached";

function emptyState(status: CoachMatchMediaPlaybackStatus = "idle"): CoachMatchMediaPlaybackState {
  return {
    status,
    videoUri: null,
    canRetry: false,
    message: null,
  };
}

/**
 * Upstream Film Room bridge: hydrate → on-demand resolve → memory-only URI.
 * Clears capability on unmount, identity change, expiry, and delivery failure.
 */
export function useCoachMatchMediaPlaybackUri(
  identity: CoachMatchMediaPlaybackIdentity | null,
  dependencies: Partial<CoachMatchMediaPlaybackDependencies> = {},
): CoachMatchMediaPlaybackState & {
  retry: () => void;
  reportDeliveryFailure: (kind?: CoachMatchMediaDeliveryFailureKind) => void;
} {
  const depsRef = useRef({ ...PRODUCTION_DEPS, ...dependencies });
  depsRef.current = { ...PRODUCTION_DEPS, ...dependencies };

  const [state, setState] = useState<CoachMatchMediaPlaybackState>(() => emptyState());
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const memoryRef = useRef<{
    url: string | null;
    expiresAt: string | null;
    revision: number | null;
    identityKey: string | null;
    autoReresolveUsed: boolean;
  }>({
    url: null,
    expiresAt: null,
    revision: null,
    identityKey: null,
    autoReresolveUsed: false,
  });
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);

  const identityKey = identity
    ? [
        identity.sharedAthleteId,
        identity.sharedCompetitionId,
        identity.matchLineageKey,
        identity.matchMediaAssetId,
        String(identity.expectedRevision),
      ].join("\0")
    : null;

  const clearMemory = useCallback(() => {
    memoryRef.current.url = null;
    memoryRef.current.expiresAt = null;
    memoryRef.current.revision = null;
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const scheduleExpiry = useCallback(
    (expiresAt: string, onExpired: () => void) => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
      const expiresMs = Date.parse(expiresAt);
      if (!Number.isFinite(expiresMs)) {
        onExpired();
        return;
      }
      const delay = Math.max(0, expiresMs - depsRef.current.now());
      expiryTimerRef.current = setTimeout(onExpired, delay);
    },
    [],
  );

  const runResolve = useCallback(
    async (opts: { allowAutoReresolve: boolean }) => {
      const currentIdentity = identityRef.current;
      const currentKey = currentIdentity
        ? [
            currentIdentity.sharedAthleteId,
            currentIdentity.sharedCompetitionId,
            currentIdentity.matchLineageKey,
            currentIdentity.matchMediaAssetId,
            String(currentIdentity.expectedRevision),
          ].join("\0")
        : null;
      if (!currentIdentity || !currentKey) {
        clearMemory();
        setState(emptyState("idle"));
        return;
      }
      const generation = ++generationRef.current;
      clearMemory();
      setState({
        status: "loading",
        videoUri: null,
        canRetry: false,
        message: null,
      });

      let result = await resolveCoachMatchMediaPlaybackOnce(
        currentIdentity,
        depsRef.current,
      );

      const classifiedForAuto =
        result.status === "unavailable" &&
        result.httpStatus === 401 &&
        opts.allowAutoReresolve &&
        !memoryRef.current.autoReresolveUsed;

      if (classifiedForAuto) {
        memoryRef.current.autoReresolveUsed = true;
        result = await resolveCoachMatchMediaPlaybackOnce(
          currentIdentity,
          depsRef.current,
        );
      }

      if (generation !== generationRef.current) return;

      if (result.status === "ready") {
        memoryRef.current.url = result.url;
        memoryRef.current.expiresAt = result.expiresAt;
        memoryRef.current.revision = result.revision;
        memoryRef.current.identityKey = currentKey;
        setState({
          status: "ready",
          videoUri: result.url,
          canRetry: false,
          message: null,
        });
        scheduleExpiry(result.expiresAt, () => {
          if (generation !== generationRef.current) return;
          clearMemory();
          if (!memoryRef.current.autoReresolveUsed) {
            memoryRef.current.autoReresolveUsed = true;
            void runResolve({ allowAutoReresolve: false });
            return;
          }
          setState({
            status: "unavailable",
            videoUri: null,
            canRetry: true,
            message: UNAVAILABLE_MESSAGE,
          });
        });
        return;
      }

      clearMemory();
      if (result.status === "removed") {
        setState({
          status: "removed",
          videoUri: null,
          canRetry: false,
          message: REMOVED_MESSAGE,
        });
        return;
      }
      if (result.status === "missing") {
        setState({
          status: "missing",
          videoUri: null,
          canRetry: false,
          message: MISSING_MESSAGE,
        });
        return;
      }
      setState({
        status: "unavailable",
        videoUri: null,
        canRetry: result.retryable,
        message: UNAVAILABLE_MESSAGE,
      });
    },
    [clearMemory, scheduleExpiry],
  );

  useEffect(() => {
    memoryRef.current.autoReresolveUsed = false;
    memoryRef.current.identityKey = identityKey;
    if (!identityKey) {
      generationRef.current += 1;
      clearMemory();
      setState(emptyState("idle"));
      return;
    }
    void runResolve({ allowAutoReresolve: true });
    return () => {
      generationRef.current += 1;
      clearMemory();
    };
  }, [clearMemory, identityKey, runResolve]);

  const retry = useCallback(() => {
    memoryRef.current.autoReresolveUsed = false;
    clearMemory();
    void runResolve({ allowAutoReresolve: true });
  }, [clearMemory, runResolve]);

  const reportDeliveryFailure = useCallback(
    (_kind: CoachMatchMediaDeliveryFailureKind = "delivery") => {
      // All delivery-failure kinds share one automatic re-resolution budget.
      // expo-av does not reliably expose HTTP status; fail-safe path is identical.
      const decision = decideCoachMatchMediaDeliveryFailure({
        hasActiveUrl: Boolean(memoryRef.current.url),
        autoReresolveUsed: memoryRef.current.autoReresolveUsed,
      });
      if (decision === "ignore") return;
      // Discard the failed capability immediately — never reuse it.
      clearMemory();
      if (decision === "auto_reresolve") {
        memoryRef.current.autoReresolveUsed = true;
        void runResolve({ allowAutoReresolve: false });
        return;
      }
      setState({
        status: "unavailable",
        videoUri: null,
        canRetry: true,
        message: UNAVAILABLE_MESSAGE,
      });
    },
    [clearMemory, runResolve],
  );

  return {
    ...state,
    retry,
    reportDeliveryFailure,
  };
}
