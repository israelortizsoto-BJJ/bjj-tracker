export type MatchMediaBinding = {
  playableUri: string;
  matchMediaAssetId: string;
  attachmentRevision: number;
  matchLineageKey: string;
  sharedAthleteId: string;
  sharedCompetitionId: string;
  playerGenerationToken: string;
};

export type MatchMediaBindingCandidate = MatchMediaBinding & { expiresAt: string };

export type MatchMediaBindingLifecycleDeps = {
  now(): number;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(handle: unknown): void;
  cancelConfirmedVideoPause(reason: string): void;
  requestConfirmedVideoPause(): Promise<{ positionMillis: number }>;
  unload(): Promise<void> | void;
  onChange(state: { candidate: MatchMediaBindingCandidate | null; active: MatchMediaBinding | null }): void;
};

export function createMatchMediaBindingLifecycle(deps: MatchMediaBindingLifecycleDeps) {
  let candidate: MatchMediaBindingCandidate | null = null;
  let active: MatchMediaBinding | null = null;
  let timer: unknown = null;
  let disposed = false;

  const publish = () => deps.onChange({ candidate, active });
  const clearTimer = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
  };
  const invalidate = (reason: string, unload = false) => {
    clearTimer();
    deps.cancelConfirmedVideoPause(reason);
    candidate = null;
    active = null;
    publish();
    if (unload) void deps.unload();
  };
  const hasCompleteCandidate = (next: MatchMediaBindingCandidate): boolean =>
    Boolean(
      next.playableUri.trim() &&
      next.matchMediaAssetId.trim() &&
      Number.isSafeInteger(next.attachmentRevision) &&
      next.attachmentRevision > 0 &&
      next.matchLineageKey.trim() &&
      next.sharedAthleteId.trim() &&
      next.sharedCompetitionId.trim() &&
      next.playerGenerationToken.trim(),
    );

  return {
    accept(next: MatchMediaBindingCandidate): boolean {
      if (disposed) return false;
      const expiry = Date.parse(next.expiresAt);
      if (!hasCompleteCandidate(next) || !Number.isFinite(expiry) || expiry <= deps.now()) {
        invalidate("Shared editor media delivery is expired.");
        return false;
      }
      invalidate("Shared editor media source replaced.", true);
      candidate = next;
      publish();
      timer = deps.setTimer(() => {
        if (candidate?.playerGenerationToken !== next.playerGenerationToken) return;
        invalidate("Shared editor media delivery expired.", true);
      }, expiry - deps.now());
      return true;
    },
    markLoaded(token: string): void {
      if (disposed || candidate?.playerGenerationToken !== token) return;
      active = candidate;
      publish();
    },
    invalidate(reason: string, unload = false): void {
      invalidate(reason, unload);
    },
    handleNativeError(token: string): boolean {
      if (disposed || candidate?.playerGenerationToken !== token) return false;
      invalidate("Shared editor media native error.", true);
      return true;
    },
    getActive(): MatchMediaBinding | null {
      return active;
    },
    hasCandidate(): boolean {
      return candidate !== null;
    },
    async requestConfirmedBoundPause(): Promise<{ positionMillis: number; binding: MatchMediaBinding }> {
      const before = active;
      if (disposed || !before) throw new Error("No loaded shared Match media binding.");
      const confirmation = await deps.requestConfirmedVideoPause();
      if (
        disposed ||
        active !== before ||
        active?.playerGenerationToken !== before.playerGenerationToken
      ) {
        throw new Error("Shared Match media binding changed during pause confirmation.");
      }
      return { positionMillis: confirmation.positionMillis, binding: active };
    },
    dispose(): void {
      disposed = true;
      if (candidate || active) invalidate("Shared editor media component unmounted.", true);
    },
  };
}
