import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let hydrationVersion = 0;

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  }
}

export function getCoachSyncHydrationVersion(): number {
  return hydrationVersion;
}

export function bumpCoachSyncHydrationVersion(): void {
  hydrationVersion += 1;
  if (__DEV__) {
    console.log("[COACH_SYNC_HYDRATION] version_bump");
  }
  emit();
}

export function subscribeCoachSyncHydration(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCoachSyncHydrationVersion(): number {
  return useSyncExternalStore(
    subscribeCoachSyncHydration,
    getCoachSyncHydrationVersion,
    getCoachSyncHydrationVersion,
  );
}
