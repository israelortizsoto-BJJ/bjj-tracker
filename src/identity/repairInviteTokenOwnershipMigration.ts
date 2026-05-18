import type { ParentAthlete } from "../storage/athleteStore";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedWeeklyMessagePayload,
} from "../types/coachWeeklySync";

export async function repairInviteTokenOwnershipConflicts(): Promise<void> {}

export async function repairInviteTokenOwnershipCompletion(): Promise<void> {}

export function remapWeeklyByAthleteIdKeys(
  weeklyBy: Record<string, SyncedWeeklyMessagePayload | null | undefined>,
  staleToCanonical: Map<string, string>,
): { weeklyBy: Record<string, SyncedWeeklyMessagePayload | null | undefined> } {
  const next: Record<string, SyncedWeeklyMessagePayload | null | undefined> = {
    ...weeklyBy,
  };
  for (const [stale, canonical] of staleToCanonical) {
    if (!(stale in next)) continue;
    const doc = next[stale];
    delete next[stale];
    if (doc != null && next[canonical] == null) {
      next[canonical] = doc;
    }
  }
  return { weeklyBy: next };
}

export function remapWeeklySyncSessionAthleteIds(
  session: CoachWeeklySyncSessionResponse | null | undefined,
  staleToCanonical: Map<string, string>,
  residualStaleIds: Set<string>,
): { session: CoachWeeklySyncSessionResponse | undefined } {
  if (!session) return { session: undefined };

  const { weeklyBy } = remapWeeklyByAthleteIdKeys(
    session.weeklyByAthleteId ?? {},
    staleToCanonical,
  );

  const athletes = Array.isArray(session.athletes) ? [...session.athletes] : [];
  const remappedAthletes = athletes.map((a) => {
    const id = typeof a.id === "string" ? a.id.trim() : "";
    const canonical = staleToCanonical.get(id);
    return canonical ? { ...a, id: canonical } : a;
  });

  const remainingStale = new Set(residualStaleIds);
  for (const key of Object.keys(weeklyBy)) {
    if (remainingStale.has(key)) remainingStale.delete(key);
  }
  for (const a of remappedAthletes) {
    const id = typeof a.id === "string" ? a.id.trim() : "";
    if (remainingStale.has(id)) remainingStale.delete(id);
  }
  if (remainingStale.size > 0) {
    return { session: undefined };
  }

  const weeklyByAthleteId: Record<string, SyncedWeeklyMessagePayload | null> = {};
  for (const [key, value] of Object.entries(weeklyBy)) {
    weeklyByAthleteId[key] = value ?? null;
  }

  return {
    session: {
      ...session,
      weeklyByAthleteId,
      athletes: remappedAthletes,
    },
  };
}

export function pruneParentAthletesList(
  all: ParentAthlete[],
  opts: {
    staleSharedAthleteIds: Set<string>;
    lineageTargets: { canonicalId: string; canonicalName: string }[];
  },
): { athletes: ParentAthlete[] } {
  const canonicalIds = new Set(opts.lineageTargets.map((t) => t.canonicalId.trim()));
  const canonicalNames = new Map(
    opts.lineageTargets.map((t) => [t.canonicalId.trim(), t.canonicalName.trim().toLowerCase()]),
  );

  const athletes = all.filter((a) => {
    const id = a.id.trim();
    if (opts.staleSharedAthleteIds.has(id)) return false;
    if (id.startsWith("pa_")) {
      const name = (a.name ?? "").trim().toLowerCase();
      for (const [canonicalId, canonicalName] of canonicalNames) {
        if (name && name === canonicalName && canonicalIds.has(canonicalId)) {
          return false;
        }
      }
    }
    return true;
  });

  return { athletes };
}
