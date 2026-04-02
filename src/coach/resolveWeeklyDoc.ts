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

/** Why we did not use a per-athlete doc (invite-level `weekly` is the fallback). */
function fallbackReason(id: string, map: ResolveWeeklyDocSession["weeklyByAthleteId"]): string {
  if (!id) return "no_shared_athlete_id";
  if (!map || typeof map !== "object" || Array.isArray(map)) return "no_map";
  if (!Object.prototype.hasOwnProperty.call(map, id)) return "missing_key";
  const raw = map[id];
  if (raw == null) return "null_value";
  return "invalid_athlete_doc";
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

    const reason = fallbackReason(id, map);
    const weekly = session.weekly;

    if (weekly != null && isValidWeeklyDoc(weekly)) {
      if (__DEV__) {
        console.log("[resolveWeeklyDoc] fallback used", {
          reason,
          sharedAthleteId: id || null,
          result: "invite_weekly",
        });
      }
      return weekly;
    }

    if (__DEV__) {
      console.log("[resolveWeeklyDoc] fallback used", {
        reason,
        sharedAthleteId: id || null,
        result: "null",
        weeklyPresent: weekly != null,
        weeklyValid: false,
      });
    }
    return null;
  } catch {
    if (__DEV__) {
      console.log("[resolveWeeklyDoc] fallback used", {
        reason: "exception",
        sharedAthleteId:
          typeof sharedAthleteId === "string" ? sharedAthleteId.trim() || null : null,
        result: "null",
      });
    }
    return null;
  }
}
