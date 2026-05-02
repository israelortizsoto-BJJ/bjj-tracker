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
  gear: {
    giCount: number;
    nogiCount: number;
    giPercentage: number | null;
    nogiPercentage: number | null;
    total: number;
    hasLowData: boolean;
  };
  consistency: {
    currentWeekCount: number;
    streak: number | null;
    goalMet: boolean;
  };
  patterns: {
    topSystem: string | null;
    topTechnique: string | null;
  };
  competition: {
    totalMatches: number;
    competitionCount: number;
    completedMatchCount: number;
    wins: number;
    losses: number;
    record: { wins: number; losses: number };
    winRate: number | null;
    submissionRate: number | null;
    fastestSubmission: string | null;
    averageMatchTime: string | null;
    winStyle: "submission-heavy" | "points-heavy" | "mixed" | null;
    methodFrequency: Record<string, number>;
    lastCompetitionDate: string | null;
    lastCompetitionResult: string | null;
  };
  confidence: number;
  alignment: number;
  hasData: boolean;
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
  const candidates = [
    cleanText(entry.customTechnique),
    cleanText(entry.technique),
    cleanText(entry.techniqueId),
    cleanText(entry.finish),
    cleanText(entry.grips),
    cleanText(entry.position),
  ];

  const selected = candidates.find((candidate) => candidate.length > 0);
  return selected ? selected : "";
}

function collectTechniqueFrequency(sessions: readonly Session[]): Record<string, number> {
  const frequency: Record<string, number> = {};

  for (const session of sessions) {
    const entries = Array.isArray(session.techniques) ? session.techniques : [];

    if (entries.length > 0) {
      let addedEntryTechnique = false;
      for (const entry of entries) {
        const key = techniqueKeyFromEntry(entry);
        if (!key) continue;
        increment(frequency, key);
        addedEntryTechnique = true;
      }
      if (addedEntryTechnique) continue;
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

function computeGearSignal(sessions: readonly Session[]): SignalOutput["gear"] {
  let giCount = 0;
  let nogiCount = 0;
  const total = sessions.length;

  for (const session of sessions) {
    giCount += session.gear === "gi" ? 1 : 0;
    nogiCount += session.gear === "nogi" ? 1 : 0;
  }

  const giPercentage = total === 0 ? null : Math.round((giCount / total) * 100);
  const nogiPercentage = total === 0 ? null : Math.round((nogiCount / total) * 100);
  const hasLowData = total > 0 && total < 3;

  return {
    giCount,
    nogiCount,
    giPercentage,
    nogiPercentage,
    total,
    hasLowData,
  };
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

function normalizeMatchResult(value: unknown): "win" | "loss" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "win") return "win";
  if (normalized === "loss") return "loss";
  return null;
}

function normalizeMatchOutcome(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isSubmissionOutcome(value: unknown): boolean {
  return normalizeMatchOutcome(value) === "submission";
}

function isPointsStyleOutcome(value: unknown): boolean {
  const outcome = normalizeMatchOutcome(value);
  return outcome === "points" || outcome === "ref decision";
}

function parseMatchTimeSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;

  const parts = text.split(":");
  if (parts.length === 1) {
    const seconds = Number(parts[0]);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
  }
  if (parts.length !== 2) return null;

  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
  return Math.round(minutes * 60 + seconds);
}

function formatMatchTime(totalSeconds: number | null): string | null {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return null;
  }
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function resolveWinStyle(input: {
  submissionWins: number;
  pointsStyleWins: number;
}): "submission-heavy" | "points-heavy" | "mixed" | null {
  const { submissionWins, pointsStyleWins } = input;
  const categorizedWins = submissionWins + pointsStyleWins;
  if (categorizedWins === 0) return null;
  if (submissionWins > pointsStyleWins) return "submission-heavy";
  if (pointsStyleWins > submissionWins) return "points-heavy";
  return "mixed";
}

function resolveLastCompetition(competitions: readonly CompetitionEntry[]): {
  date: string;
  result: string | null;
} | null {
  let latest: { date: string; result: string | null } | null = null;

  for (const competition of competitions) {
    const date = toDateKey(competition.eventDate);
    if (!date) continue;

    if (latest && date <= latest.date) continue;

    const result = cleanText(competition.result);
    latest = {
      date,
      result: result.length > 0 ? result : null,
    };
  }

  return latest;
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
  const hasData = sessions.length > 0 || competitions.length > 0;

  const referenceDate = resolveReferenceDate(input.referenceDate);
  const weekStart = startOfWeekMondayYMD(referenceDate);
  const weeklySessionCount = sessions.length;
  const weeklySessionCounts = collectWeeklySessionCounts(sessions);
  const weekTotals4w = Array.from({ length: 4 }, (_, index) => {
    const weekKey = addDaysYMD(weekStart, -7 * index);
    return weekKey ? (weeklySessionCounts[weekKey] ?? 0) : 0;
  });
  const trendDelta = weekTotals4w[0] - weekTotals4w[1];
  const streak =
    sessions.length === 0 ? null : computeCompletedWeeklyStreak(weeklySessionCounts, weekStart);

  const techniqueFrequency = collectTechniqueFrequency(sessions);
  const topTechniques = rankFrequency(techniqueFrequency).slice(0, 3);

  const systemFrequency = collectSystemFrequency(sessions);
  const rankedSystems = rankFrequency(systemFrequency);
  const topSystem = rankedSystems.length > 0 ? rankedSystems[0].label : null;
  const topTechnique = topTechniques.length > 0 ? topTechniques[0].label : null;
  const gear = computeGearSignal(sessions);

  const matches = collectMatches(competitions);
  console.log("[MATCHES RAW]", matches);
  const normalizedMatches = matches.map((match) => ({
    ...match,
    matchResult: normalizeMatchResult(match.matchResult),
  }));
  const validMatches = normalizedMatches.filter(
    (match) => match.matchResult === "win" || match.matchResult === "loss",
  );
  console.log("[MATCHES VALID]", validMatches);
  const competitionCount = competitions.length;
  const totalMatches = matches.length;
  const wins = validMatches.filter((match) => match.matchResult === "win").length;
  const losses = validMatches.filter((match) => match.matchResult === "loss").length;
  const completedMatchCount = validMatches.length;
  const methodFrequency: Record<string, number> = {};
  for (const match of normalizedMatches) {
    increment(methodFrequency, normalizeMatchOutcome(match.outcome));
  }

  const winningMatches = validMatches.filter((match) => match.matchResult === "win");
  const submissionWins = winningMatches.filter((match) =>
    isSubmissionOutcome(match.outcome),
  ).length;
  const pointsStyleWins = winningMatches.filter((match) =>
    isPointsStyleOutcome(match.outcome),
  ).length;
  const submissionRate =
    wins === 0 ? null : clampPercent((submissionWins / wins) * 100);
  const submissionWinTimes = winningMatches
    .filter((match) => isSubmissionOutcome(match.outcome))
    .map((match) => parseMatchTimeSeconds(match.submissionTime))
    .filter((seconds): seconds is number => seconds !== null);
  const fastestSubmission =
    submissionWinTimes.length === 0
      ? null
      : formatMatchTime(Math.min(...submissionWinTimes));
  const timedMatchSeconds = validMatches
    .map((match) => parseMatchTimeSeconds(match.submissionTime))
    .filter((seconds): seconds is number => seconds !== null);
  const averageMatchTime =
    timedMatchSeconds.length === 0
      ? null
      : formatMatchTime(
          timedMatchSeconds.reduce((sum, seconds) => sum + seconds, 0) /
            timedMatchSeconds.length,
        );
  const winStyle = resolveWinStyle({ submissionWins, pointsStyleWins });
  const winRate =
    completedMatchCount === 0 ? null : Math.round((wins / completedMatchCount) * 100);
  const lastCompetition = resolveLastCompetition(competitions);
  const lastCompetitionDate =
    competitionCount === 0 ? null : lastCompetition ? lastCompetition.date : null;
  const lastCompetitionResult =
    competitionCount === 0 ? null : lastCompetition ? lastCompetition.result : null;

  const goalMet = weeklySessionCount >= WEEKLY_SESSION_GOAL;
  const confidence = clampPercent(
    (Math.min(weeklySessionCount, WEEKLY_SESSION_GOAL) / WEEKLY_SESSION_GOAL) * 70 +
      (goalMet ? 30 : 0),
  );

  const hasDeclaredInput = hasMeaningfulValue(input.declaredInput);
  const alignment = clampPercent((hasDeclaredInput ? 50 : 0) + (hasData ? 50 : 0));

  if (__DEV__) {
    console.log("[SIGNAL GEAR]", gear);
    console.log("[SIGNAL COMPUTE]", {
      sessionCount: sessions.length,
      competitionCount,
      totalMatches,
      completedMatchCount,
      topSystem,
      topTechnique,
      weeklySessionCount,
      winRate,
    });
  }

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
    gear,
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
      competitionCount,
      completedMatchCount,
      wins,
      losses,
      record: { wins, losses },
      winRate,
      submissionRate,
      fastestSubmission,
      averageMatchTime,
      winStyle,
      methodFrequency,
      lastCompetitionDate,
      lastCompetitionResult,
    },
    confidence,
    alignment,
    hasData,
  };
}
