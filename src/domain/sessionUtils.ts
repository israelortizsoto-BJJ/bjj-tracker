import { toDateKey } from "../_domain/dateKey";
import type { DeviceRole } from "../storage/deviceRoleStore";
import { SUMMARY_IDENTITY_ACCOUNT_SCOPE, type SummaryIdentityScope } from "../types/summaryIdentityScope";
import type { Session } from "../types";

/** Matches `app/(tabs)/training.tsx` `refresh()` session scoping (kid route vs athlete/kid vs account). */
export type TrainingRefreshScopeInput = {
  deviceRole: DeviceRole | null;
  /** Parent athlete id (`sharedAthleteId` on sessions). */
  athleteId: string;
  /** Deep-link kid route param: strict kid-id match only. */
  kidIdParam?: string;
  /** Linked roster kid from `useActiveAthlete` / Summary. */
  linkedKidId?: string;
};

/** __DEV__ only: mirrors `filterSessionsLikeTrainingRefresh` drop reasons for Operator Mode logs. */
function devTrainingRefreshDropReason(
  s: Session,
  input: TrainingRefreshScopeInput,
): string {
  const athleteScopeTrim = input.athleteId.trim();
  const kidParam =
    typeof input.kidIdParam === "string" && input.kidIdParam.trim()
      ? input.kidIdParam.trim()
      : undefined;
  const linked =
    typeof input.linkedKidId === "string" && input.linkedKidId.trim()
      ? input.linkedKidId.trim()
      : undefined;
  const effectiveKidId = kidParam ?? linked;

  if (kidParam) {
    if ((s.kidId ?? "").trim() !== kidParam) return "kid_param_mismatch";
    if (input.deviceRole === "parent" && s.trainingLoggedByRole === "coach") {
      return "parent_hides_coach_logged_session";
    }
    return "unknown_drop";
  }

  if (athleteScopeTrim || effectiveKidId) {
    const byShared =
      !!athleteScopeTrim && (s.sharedAthleteId ?? "").trim() === athleteScopeTrim;
    const byKid = !!effectiveKidId && (s.kidId ?? "").trim() === effectiveKidId;
    if (!byShared && !byKid) return "neither_shared_athlete_nor_linked_kid";
    if (input.deviceRole === "parent" && s.trainingLoggedByRole === "coach") {
      return "parent_hides_coach_logged_session";
    }
    return "unknown_drop";
  }

  if ((s.kidId ?? "").trim()) return "account_scope_strips_kid_sessions";
  return "unknown_drop";
}

export function filterSessionsLikeTrainingRefresh(
  normalized: Session[],
  input: TrainingRefreshScopeInput,
): Session[] {
  const athleteScopeTrim = input.athleteId.trim();
  const kidParam =
    typeof input.kidIdParam === "string" && input.kidIdParam.trim()
      ? input.kidIdParam.trim()
      : undefined;
  const linked =
    typeof input.linkedKidId === "string" && input.linkedKidId.trim()
      ? input.linkedKidId.trim()
      : undefined;
  const effectiveKidId = kidParam ?? linked;

  if (kidParam) {
    const out = normalized.filter((s) => {
      if ((s.kidId ?? "").trim() !== kidParam) return false;
      if (input.deviceRole === "parent" && s.trainingLoggedByRole === "coach") return false;
      return true;
    });
    if (__DEV__) {
      const dropped = normalized.filter((s) => !out.some((k) => k.id === s.id));
      const reasons = dropped.map((s) => devTrainingRefreshDropReason(s, input));
      const reasonDropped =
        reasons.length === 0
          ? "none"
          : [...new Set(reasons)].length === 1
            ? reasons[0]!
            : `mixed:${[...new Set(reasons)].join(",")}`;
      console.log("[SUMMARY_SESSION_FILTER]", {
        athleteId: athleteScopeTrim || null,
        incomingSessionCount: normalized.length,
        outgoingSessionCount: out.length,
        droppedSessionIds: dropped.map((s) => s.id),
        reasonDropped,
      });
    }
    return out;
  }

  if (athleteScopeTrim || effectiveKidId) {
    const out = normalized.filter((s) => {
      const byShared =
        !!athleteScopeTrim && (s.sharedAthleteId ?? "").trim() === athleteScopeTrim;
      const byKid = !!effectiveKidId && (s.kidId ?? "").trim() === effectiveKidId;
      if (!byShared && !byKid) return false;
      if (input.deviceRole === "parent" && s.trainingLoggedByRole === "coach") return false;
      return true;
    });
    if (__DEV__) {
      const dropped = normalized.filter((s) => !out.some((k) => k.id === s.id));
      const reasons = dropped.map((s) => devTrainingRefreshDropReason(s, input));
      const reasonDropped =
        reasons.length === 0
          ? "none"
          : [...new Set(reasons)].length === 1
            ? reasons[0]!
            : `mixed:${[...new Set(reasons)].join(",")}`;
      console.log("[SUMMARY_SESSION_FILTER]", {
        athleteId: athleteScopeTrim || null,
        incomingSessionCount: normalized.length,
        outgoingSessionCount: out.length,
        droppedSessionIds: dropped.map((s) => s.id),
        reasonDropped,
      });
    }
    return out;
  }

  const out = normalized.filter((s) => !(s.kidId ?? "").trim());
  if (__DEV__) {
    const dropped = normalized.filter((s) => !out.some((k) => k.id === s.id));
    const reasons = dropped.map((s) => devTrainingRefreshDropReason(s, input));
    const reasonDropped =
      reasons.length === 0
        ? "none"
        : [...new Set(reasons)].length === 1
          ? reasons[0]!
          : `mixed:${[...new Set(reasons)].join(",")}`;
    console.log("[SUMMARY_SESSION_FILTER]", {
      athleteId: athleteScopeTrim || null,
      incomingSessionCount: normalized.length,
      outgoingSessionCount: out.length,
      droppedSessionIds: dropped.map((s) => s.id),
      reasonDropped,
    });
  }
  return out;
}

/** Local calendar YYYY-MM-DD (matches Training `todayYMD`). */
function todayYMDLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Mirrors Training session normalization (`loadSessions` + `toDateKey` fallback)
 * before kid scoping filters.
 */
export function normalizeSessionsLikeTraining(sessions: Session[]): Session[] {
  const today = todayYMDLocal();
  return sessions.map((s) => ({
    ...s,
    date: toDateKey(s.date) || today,
  }));
}

/**
 * Same filtering rules as `app/(tabs)/training.tsx` (`refresh`): kid view vs account-level sessions.
 */
export function filterSessionsForTrainingScope(
  normalized: Session[],
  scope: SummaryIdentityScope,
  deviceRole: DeviceRole | null
): Session[] {
  if (!scope.trim() || scope === SUMMARY_IDENTITY_ACCOUNT_SCOPE) {
    return filterSessionsLikeTrainingRefresh(normalized, {
      deviceRole,
      athleteId: "",
    });
  }
  return filterSessionsLikeTrainingRefresh(normalized, {
    deviceRole,
    athleteId: "",
    linkedKidId: scope.trim(),
  });
}

export function safeParseSessions(raw: string | null): Session[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

export function buildSessionsByDate(sessions: Session[]): Record<string, Session[]> {
  const grouped: Record<string, Session[]> = {};
  for (const session of sessions) {
    const date = typeof session.date === "string" ? session.date.trim() : "";
    if (!date) continue;
    grouped[date] = grouped[date] ? [...grouped[date], session] : [session];
  }
  return grouped;
}

export function addDaysYMD(ymd: string, days: number): string {
  const d = new Date(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeekMondayYMD(ymd: string): string {
  const d = new Date(ymd);
  const day = d.getUTCDay(); // Sun=0 ... Sat=6
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
