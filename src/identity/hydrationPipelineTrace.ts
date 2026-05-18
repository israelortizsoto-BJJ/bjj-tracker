import type { ParentAthlete } from "../storage/athleteStore";
import type { KidsById } from "../types/coachKid";
import type { SyncedSharedAthlete } from "../types/coachWeeklySync";

export function logHydrationPipelineWatchAthletes(_payload: Record<string, unknown>): void {}

export function logHydrationPipelineCanonicalReconcile(
  _payload: Record<string, unknown>,
): void {}

export function logHydrationPipelineWeeklyInvariantFilter(
  _payload: Record<string, unknown>,
): void {}

export function athleteIdSetFromParent(athletes: readonly ParentAthlete[]): Set<string> {
  const ids = new Set<string>();
  for (const a of athletes) {
    const id = a.id?.trim();
    if (id) ids.add(id);
  }
  return ids;
}

export function athleteIdSetFromSynced(
  athletes: readonly SyncedSharedAthlete[] | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(athletes)) return ids;
  for (const a of athletes) {
    const id = typeof a.id === "string" ? a.id.trim() : "";
    if (id) ids.add(id);
  }
  return ids;
}

export function namesByIdFromParentAthletes(
  athletes: readonly ParentAthlete[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of athletes) {
    const id = a.id?.trim();
    if (!id) continue;
    map.set(id, (a.name ?? "").trim());
  }
  return map;
}

export function namesByIdFromKids(kidsById: KidsById): Map<string, string> {
  const map = new Map<string, string>();
  for (const k of Object.values(kidsById)) {
    if (!k) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (!sid) continue;
    map.set(sid, (k.name ?? "").trim());
  }
  return map;
}

export function namesByIdFromSyncedAthletes(
  athletes: readonly SyncedSharedAthlete[] | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(athletes)) return map;
  for (const a of athletes) {
    const id = typeof a.id === "string" ? a.id.trim() : "";
    if (!id) continue;
    map.set(id, (a.name ?? "").trim());
  }
  return map;
}
