import { toDateKey } from "../../_domain/dateKey";
import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { Session, TechniqueEntry } from "../../types";
import type { KidCompetitionEntry } from "../../types/coachKid";

export type CompetitionEntry = Partial<KidCompetitionEntry> & {
  matches?: readonly Partial<CompetitionDetailMatchSnapshot>[] | null;
};

export type SignalInput = {
  sessions?: readonly Session[] | null;
  competitions?: readonly CompetitionEntry[] | null;
  coachData?: unknown;
  declaredInput?: unknown;
  connectionState?: { isCoachConnected?: boolean | null } | null;
  referenceDate?: string | Date | null;
};

export type RankedSignalItem = {
  key: string;
  label: string;
  count: number;
};

export type SignalOutput = {
  frequency: {
    weeklySessionCount: number;
    weekTotals4w: number[];
    trendDelta: number;
  };
  techniques: {
    topTechniques: RankedSignalItem[];
    techniqueFrequency: Record<string, number>;
  };
  systems: {
    topSystem: string | null;
    systemFrequency: Record<string, number>;
  };
  consistency: {
    currentWeekCount: number;
    streak: number;
    goalMet: boolean;
  };
  patterns: {
    topSystem: string | null;
    topTechnique: string | null;
  };
  competition: {
    totalMatches: number;
    winRate: number;
  };
  confidence: number;
  alignment: number;
};

const WEEKLY_SESSION_GOAL = 3;
const MAX_STREAK_WEEKS_LOOKBACK = 12;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dateToYMD(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function resolveReferenceDate(referenceDate: SignalInput["referenceDate"]): string {
  if (referenceDate instanceof Date) return dateToYMD(referenceDate);

  const normalized = toDateKey(typeof referenceDate === "string" ? referenceDate : undefined);
  return normalized || dateToYMD(new Date());
}

function startOfWeekMondayYMD(ymd: string): string {
  const [year, month, dayOfMonth] = ymd.split("-").map(Number);
  if (!year || !month || !dayOfMonth) return "";

  const date = new Date(year, month - 1, dayOfMonth);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);

  return dateToYMD(date);
}

function addDaysYMD(ymd: string, delta: number): string {
  const [year, month, dayOfMonth] = ymd.split("-").map(Number);
  if (!year || !month || !dayOfMonth) return "";

  const date = new Date(year, month - 1, dayOfMonth);
  date.setDate(date.getDate() + delta);

  return dateToYMD(date);
}

function increment(frequency: Record<string, number>, key: string) {
  if (!key) return;
  frequency[key] = (frequency[key] ?? 0) + 1;
}

function rankFrequency(frequency: Record<string, number>): RankedSignalItem[] {
  return Object.entries(frequency)
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function techniqueKeyFromEntry(entry: Partial<TechniqueEntry>): string {
  return (
    cleanText(entry.techniqueId) ||
    cleanText(entry.technique) ||
    cleanText(entry.customTechnique) ||
    cleanText(entry.finish) ||
    cleanText(entry.position)
  );
}

function collectTechniqueFrequency(sessions: readonly Session[]): Record<string, number> {
  const frequency: Record<string, number> = {};

  for (const session of sessions) {
    const entries = Array.isArray(session.techniques) ? session.techniques : [];

    if (entries.length > 0) {
      for (const entry of entries) {
        increment(frequency, techniqueKeyFromEntry(entry));
      }
      continue;
    }

    increment(
      frequency,
      techniqueKeyFromEntry({
        techniqueId: session.techniqueId,
        technique: session.technique,
        customTechnique: session.customTechnique,
        finish: session.finish,
        position: session.position,
      }),
    );
  }

  return frequency;
}

function collectSystemFrequency(sessions: readonly Session[]): Record<string, number> {
  const frequency: Record<string, number> = {};

  for (const session of sessions) {
    increment(frequency, cleanText(session.system));
  }

  return frequency;
}

function isInCurrentWeek(session: Session, weekStart: string, weekEnd: string): boolean {
  const dateKey = toDateKey(session.date);
  if (!dateKey || !weekStart || !weekEnd) return false;
  return dateKey >= weekStart && dateKey <= weekEnd;
}

function collectWeeklySessionCounts(sessions: readonly Session[]): Record<string, number> {
  const weekCounts: Record<string, number> = {};

  for (const session of sessions) {
    const dateKey = toDateKey(session.date);
    if (!dateKey) continue;

    const weekStart = startOfWeekMondayYMD(dateKey);
    if (!weekStart) continue;

    weekCounts[weekStart] = (weekCounts[weekStart] ?? 0) + 1;
  }

  return weekCounts;
}

function computeCompletedWeeklyStreak(
  weekCounts: Record<string, number>,
  currentWeekStart: string,
): number {
  if (!currentWeekStart) return 0;

  let streak = 0;
  let cursorWeekStart = addDaysYMD(currentWeekStart, -7);
  const earliestWeekStart = addDaysYMD(
    currentWeekStart,
    -7 * MAX_STREAK_WEEKS_LOOKBACK,
  );

  while (cursorWeekStart && cursorWeekStart >= earliestWeekStart) {
    if (streak >= MAX_STREAK_WEEKS_LOOKBACK) break;

    const weekCount = weekCounts[cursorWeekStart] ?? 0;
    if (weekCount < WEEKLY_SESSION_GOAL) break;

    streak += 1;
    cursorWeekStart = addDaysYMD(cursorWeekStart, -7);
  }

  return streak;
}

function collectMatches(competitions: readonly CompetitionEntry[]) {
  return competitions.flatMap((competition) =>
    Array.isArray(competition.matches) ? [...competition.matches] : [],
  );
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

export function computeSignals(input: SignalInput = {}): SignalOutput {
  const sessions = Array.isArray(input.sessions) ? input.sessions : [];
  const competitions = Array.isArray(input.competitions) ? input.competitions : [];

  const referenceDate = resolveReferenceDate(input.referenceDate);
  const weekStart = startOfWeekMondayYMD(referenceDate);
  const weekEnd = weekStart ? addDaysYMD(weekStart, 6) : "";
  const weeklySessionCount = sessions.filter((session) =>
    isInCurrentWeek(session, weekStart, weekEnd),
  ).length;
  const weeklySessionCounts = collectWeeklySessionCounts(sessions);
  const weekTotals4w = Array.from({ length: 4 }, (_, index) => {
    const weekKey = addDaysYMD(weekStart, -7 * index);
    return weekKey ? (weeklySessionCounts[weekKey] ?? 0) : 0;
  });
  const trendDelta = weekTotals4w[0] - weekTotals4w[1];
  const streak = computeCompletedWeeklyStreak(weeklySessionCounts, weekStart);

  const techniqueFrequency = collectTechniqueFrequency(sessions);
  const topTechniques = rankFrequency(techniqueFrequency).slice(0, 3);

  const systemFrequency = collectSystemFrequency(sessions);
  const topSystem = rankFrequency(systemFrequency)[0]?.label ?? null;
  const topTechnique = topTechniques[0]?.label ?? null;

  const matches = collectMatches(competitions);
  const totalMatches = matches.length;
  const wins = matches.filter((match) => match.matchResult === "win").length;
  const winRate = totalMatches > 0 ? clampPercent((wins / totalMatches) * 100) : 0;

  const goalMet = weeklySessionCount >= WEEKLY_SESSION_GOAL;
  const confidence = clampPercent(
    (Math.min(weeklySessionCount, WEEKLY_SESSION_GOAL) / WEEKLY_SESSION_GOAL) * 70 +
      (goalMet ? 30 : 0),
  );

  const hasDeclaredInput = hasMeaningfulValue(input.declaredInput);
  const hasActivity = sessions.length > 0 || totalMatches > 0;
  const alignment = clampPercent((hasDeclaredInput ? 50 : 0) + (hasActivity ? 50 : 0));

  return {
    frequency: {
      weeklySessionCount,
      weekTotals4w,
      trendDelta,
    },
    techniques: {
      topTechniques,
      techniqueFrequency,
    },
    systems: {
      topSystem,
      systemFrequency,
    },
    consistency: {
      currentWeekCount: weeklySessionCount,
      streak,
      goalMet,
    },
    patterns: {
      topSystem,
      topTechnique,
    },
    competition: {
      totalMatches,
      winRate,
    },
    confidence,
    alignment,
  };
}
