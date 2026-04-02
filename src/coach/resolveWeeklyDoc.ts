import type {
  CoachWeeklySyncSessionResponse,
  SyncedWeeklyMessagePayload,
} from "../types/coachWeeklySync";

export type ResolveWeeklyDocSession = Pick<CoachWeeklySyncSessionResponse, "weekly"> & {
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null> | null;
};

function isValidWeeklyDoc(v: unknown): v is SyncedWeeklyMessagePayload {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.weekStartYMD === "string" &&
    typeof o.headline === "string" &&
    typeof o.body === "string" &&
    typeof o.updatedAt === "string"
  );
}

/**
 * Picks the per-athlete weekly doc when present and valid; otherwise invite-level `weekly` if valid.
 * Invalid `weekly` is never returned. Never throws.
 */
export function resolveWeeklyDoc(
  session: ResolveWeeklyDocSession,
  sharedAthleteId: string | null | undefined,
): SyncedWeeklyMessagePayload | null {
  try {
    const id = typeof sharedAthleteId === "string" ? sharedAthleteId.trim() : "";
    const map = session.weeklyByAthleteId;

    if (
      id &&
      map &&
      typeof map === "object" &&
      !Array.isArray(map) &&
      Object.prototype.hasOwnProperty.call(map, id)
    ) {
      const candidate = map[id];
      if (candidate != null && isValidWeeklyDoc(candidate)) {
        return candidate;
      }
    }

    const weekly = session.weekly;

    if (weekly != null && isValidWeeklyDoc(weekly)) {
      return weekly;
    }

    return null;
  } catch {
    return null;
  }
}
