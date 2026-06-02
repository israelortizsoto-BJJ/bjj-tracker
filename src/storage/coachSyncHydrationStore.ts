import { useSyncExternalStore } from "react";

import { logCompCacheInvalidation } from "../dev/competitionMutationDevLog";

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

export function bumpCoachSyncHydrationVersion(context?: {
  reason?: string;
  sharedAthleteId?: string;
  competitionId?: string;
}): void {
  hydrationVersion += 1;
  if (__DEV__) {
    logCompCacheInvalidation({
      operationKind: "canonical",
      localStoreAffected: "useCoachSyncHydrationVersion subscribers (useAthleteData, useActiveAthlete)",
      phaseDetail: context?.reason ?? "coach_sync_hydration_bump",
      sharedAthleteId: context?.sharedAthleteId ?? null,
      competitionId: context?.competitionId ?? null,
      hydrationVersionNext: hydrationVersion,
    });
    console.log("[COACH_SYNC_HYDRATION] version_bump", context ?? {});
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
