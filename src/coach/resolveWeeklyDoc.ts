import type { CompetitionTrainingSkillFocus } from "../ai-coach/competitionTrainingSkillFocus";
import { recommendedFocusAreaFromTrainingSkillFocus } from "../ai-coach/competitionTrainingSkillFocus";
import type {
  CoachWeeklySyncSessionResponse,
  SyncedSharedAthlete,
  SyncedWeeklyMessagePayload,
} from "../types/coachWeeklySync";

/** Athlete weekly note plus optional derived training emphasis (never overwrites coach copy). */
export type ResolvedSyncedWeeklyDoc = SyncedWeeklyMessagePayload & {
  recommendedFocusArea?: string;
};

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

/**
 * When there is no roster `Kid` row yet, the parent device athlete id (`pa_*`) may still match
 * `session.athletes` after the athlete is added to the worker session.
 */
export function sharedAthleteIdFromParentAthleteForSession(
  parentAthleteId: string | null | undefined,
  sessionAthletes: SyncedSharedAthlete[] | null | undefined,
): string | null {
  const raw = typeof parentAthleteId === "string" ? parentAthleteId.trim() : "";
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
 * Resolves the weekly doc for a parent view using athlete scope when available.
 * Per-athlete `weeklyByAthleteId[id]` is preferred; when that slot is missing or empty, falls back to
 * invite-level `weekly` so parents still see a coach message when only legacy invite data exists.
 * When `trainingSkillFocus` is present, merges `recommendedFocusArea` onto the resolved doc — augments coach copy only.
 * Never throws.
 */
export function resolveWeeklyDoc(
  session: ResolveWeeklyDocSession,
  sharedAthleteId: string | null | undefined,
  trainingSkillFocus?: CompetitionTrainingSkillFocus | null,
): ResolvedSyncedWeeklyDoc | null {
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
          const recommendedFocusArea = recommendedFocusAreaFromTrainingSkillFocus(
            trainingSkillFocus ?? null,
          );
          if (recommendedFocusArea) {
            return { ...athleteDoc, recommendedFocusArea };
          }
          return athleteDoc;
        }
      }
    }

    const inviteWeekly = session?.weekly;
    if (
      id &&
      inviteWeekly != null &&
      isValidWeeklyDoc(inviteWeekly)
    ) {
      const recommendedFocusArea = recommendedFocusAreaFromTrainingSkillFocus(
        trainingSkillFocus ?? null,
      );
      if (recommendedFocusArea) {
        return { ...inviteWeekly, recommendedFocusArea };
      }
      return inviteWeekly;
    }

    return null;
  } catch {
    return null;
  }
}

/** True if any per-athlete slot or invite-level `weekly` has a valid weekly doc. */
export function sessionSnapshotHasUsableWeeklyDoc(
  session: ResolveWeeklyDocSession | null | undefined,
): boolean {
  if (!session) return false;
  const m = session.weeklyByAthleteId;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    for (const v of Object.values(m)) {
      if (v != null && isValidWeeklyDoc(v)) return true;
    }
  }
  const w = session.weekly;
  return w != null && isValidWeeklyDoc(w);
}
