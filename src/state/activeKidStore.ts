import { useSyncExternalStore } from "react";

type ActiveKidId = string | undefined;
type Listener = () => void;

let activeKidId: ActiveKidId;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getActiveKidId(): ActiveKidId {
  return activeKidId;
}

export function setActiveKidId(nextKidId: string | null | undefined) {
  const normalized = typeof nextKidId === "string" && nextKidId.trim() ? nextKidId.trim() : undefined;
  if (normalized === activeKidId) return;
  activeKidId = normalized;
  emit();
}

export function clearActiveKidId() {
  setActiveKidId(undefined);
}

export function subscribeToActiveKidId(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useActiveKidId() {
  return useSyncExternalStore(subscribeToActiveKidId, getActiveKidId, getActiveKidId);
}
