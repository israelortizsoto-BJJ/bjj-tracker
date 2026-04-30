import { toDateKey } from "../_domain/dateKey";
import type { DeviceRole } from "../storage/deviceRoleStore";
import { SUMMARY_IDENTITY_ACCOUNT_SCOPE, type SummaryIdentityScope } from "../types/summaryIdentityScope";
import type { Session } from "../types";

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
    return normalized.filter((s) => !(s.kidId ?? "").trim());
  }
  const kidIdParam = scope.trim();
  return normalized.filter((s) => {
    if ((s.kidId ?? "").trim() !== kidIdParam) return false;
    if (deviceRole === "parent" && s.trainingLoggedByRole === "coach") return false;
    return true;
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
