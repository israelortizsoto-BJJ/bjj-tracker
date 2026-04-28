import type {
  CoachWeeklySyncSessionResponse,
  SyncedSharedAthlete,
  SyncedWeeklyMessagePayload,
} from "../types/coachWeeklySync";

export type ResolveWeeklyDocSession = Pick<CoachWeeklySyncSessionResponse, "weekly"> & {
  weeklyByAthleteId?: Record<string, SyncedWeeklyMessagePayload | null> | null;
};

export type ParentWeeklySessionSnapshot = ResolveWeeklyDocSession & {
  /** From GET /sessions; used to validate roster kid `sharedAthleteId` against the same GET payload. */
  athletes?: SyncedSharedAthlete[] | null;
};

/**
 * Deterministic weekly scope: kid row `sharedAthleteId` from storage (`loadedKidsById`) must appear
 * on the session GET roster (`sessionAthletes`). Same invite/session plane as `weeklySessionSnapshot`.
 */
export function sharedAthleteIdFromRosterForSession(
  rosterKidId: string | null,
  kidRowSharedAthleteId: string | null | undefined,
  sessionAthletes: SyncedSharedAthlete[] | null | undefined,
): string | null {
  const kidId = typeof rosterKidId === "string" ? rosterKidId.trim() : "";
  if (!kidId) return null;
  const raw = typeof kidRowSharedAthleteId === "string" ? kidRowSharedAthleteId.trim() : "";
  if (!raw) return null;
  const roster = Array.isArray(sessionAthletes) ? sessionAthletes : [];
  const ids = new Set(
    roster
      .map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
      .filter((id) => id.length > 0),
  );
  return ids.has(raw) ? raw : null;
}

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
 * Resolves the weekly doc for a parent view: per-athlete doc first, else invite-level `weekly`.
 * No field-level merge between invite and athlete (avoids invite/null wiping athlete URLs).
 * Never throws.
 */
export function resolveWeeklyDoc(
  session: ResolveWeeklyDocSession,
  sharedAthleteId: string | null | undefined,
): SyncedWeeklyMessagePayload | null {
  try {
    const id = typeof sharedAthleteId === "string" ? sharedAthleteId.trim() : "";

    if (__DEV__ && id) {
      const map = session?.weeklyByAthleteId ?? {};

      console.log("[WEEKLY PIPELINE TRACE]", {
        athleteId: id,
        hasAthleteDoc: !!map[id],
        mission: map[id]?.missionResourceUrl ?? null,
        available: Object.keys(map),
      });

      if (!(id in map)) {
        console.log("[weekly-doc-missing-athlete]", {
          requested: id,
          available: Object.keys(map),
        });
      } else if (map[id] == null) {
        console.warn("[ATHLETE DOC EMPTY]", {
          sharedAthleteId: id,
        });
      }
    }

    const map = session.weeklyByAthleteId;

    if (id && map && typeof map === "object" && !Array.isArray(map)) {
      if (Object.prototype.hasOwnProperty.call(map, id)) {
        const athleteDoc = map[id];
        if (athleteDoc != null && isValidWeeklyDoc(athleteDoc)) {
          return athleteDoc;
        }
      }
    }

    const inviteDoc = session.weekly;
    if (inviteDoc != null && isValidWeeklyDoc(inviteDoc)) {
      return inviteDoc;
    }
    return null;
  } catch {
    return null;
  }
}

/** True if invite-level or any per-athlete slot has a valid weekly doc. */
export function sessionSnapshotHasUsableWeeklyDoc(
  session: ResolveWeeklyDocSession | null | undefined,
): boolean {
  if (!session) return false;
  if (session.weekly != null && isValidWeeklyDoc(session.weekly)) {
    return true;
  }
  const m = session.weeklyByAthleteId;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    for (const v of Object.values(m)) {
      if (v != null && isValidWeeklyDoc(v)) return true;
    }
  }
  return false;
}
