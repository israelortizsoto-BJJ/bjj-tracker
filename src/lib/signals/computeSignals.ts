import { calendarDaysBetweenYMD, toDateKey } from "../../_domain/dateKey";
import type { TrainingSkillBucket } from "../../ai-coach/skillBucketText";
import { getPlacementLabel } from "../../features/competition/placementLabel";
import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type { Session, TechniqueEntry } from "../../types";
import type { KidCompetitionEntry } from "../../types/coachKid";
import {
  deriveCompetitionBucketHistorySignals,
  type BucketOutcomeTrend,
  type CompetitionBucketHistoryRow,
} from "./competitionBucketHistory";

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

/** Last N labeled competition outcomes, oldest → newest (for interpreting placement trends). */
export type CompetitionRecentResultSignal = {
  eventDateYMD: string;
  /** Athlete-facing label: "1st" … "DNF". */
  resultLabel: string;
};

export type CompetitionPlacementTrend =
  | "improving"
  | "plateau"
  | "decline"
  | "inconsistent";

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
    lastCompetitionName: string | null;
    lastCompetitionMatchCount: number;
    lastCompetitionWins: number;
    lastCompetitionLosses: number;
    podiumCountLast30Days: number;
    podiumCountLast90Days: number;
    /** Up to five most recent labeled events, chronological (oldest first). */
    recentResults: CompetitionRecentResultSignal[];
    /** Counting backward from most recent labeled event. */
    podiumStreak: number;
    /** Counting backward from most recent labeled event among non‑podium tiers. */
    nonPodiumStreak: number;
    /** Modal placement label among `recentResults` (null if empty). */
    mostCommonResult: string | null;
    /** Derived from ≥3 labeled events in `recentResults`; avoids thin-data guesses. */
    placementTrend: CompetitionPlacementTrend | null;
    /** Labeled competitions with inferred skill bucket (match/event notes only). Chronological. */
    bucketHistory: CompetitionBucketHistoryRow[];
    /** Per-bucket placement trajectory when that bucket has ≥3 tagged events and a stable pattern. */
    bucketOutcomeTrends: Partial<Record<TrainingSkillBucket, BucketOutcomeTrend>>;
  };
  confidence: number;
  alignment: number;
  hasData: boolean;
};

const WEEKLY_SESSION_GOAL = 3;
const MAX_STREAK_WEEKS_LOOKBACK = 12;
const MULTI_EVENT_RECENT_CAP = 5;
const MULTI_EVENT_TREND_MIN = 3;

type KnownCompetitionStoredTier =
  | "gold"
  | "silver"
  | "bronze"
  | "participated"
  | "dnf"
  | "other";

function parseKnownCompetitionStoredTier(
  competition: CompetitionEntry,
): KnownCompetitionStoredTier | null {
  const raw = cleanText(competition.result).toLowerCase();
  if (
    raw === "gold" ||
    raw === "silver" ||
    raw === "bronze" ||
    raw === "participated" ||
    raw === "dnf" ||
    raw === "other"
  ) {
    return raw;
  }
  return null;
}

function ordinalForStoredTier(tier: KnownCompetitionStoredTier): number {
  switch (tier) {
    case "dnf":
      return 0;
    case "other":
      return 1;
    case "participated":
      return 2;
    case "bronze":
      return 3;
    case "silver":
      return 4;
    case "gold":
      return 5;
    default:
      return -1;
  }
}

function isPodiumStoredTier(tier: KnownCompetitionStoredTier): boolean {
  return tier === "gold" || tier === "silver" || tier === "bronze";
}

/** Copy for Snapshot / parent weekly shells (thin UI cue). */
export function resolveCompetitionTrendCopy(trend: CompetitionPlacementTrend | null): {
  snapshotLine: string | null;
  thisWeekLine: string | null;
} {
  switch (trend) {
    case "improving":
      return {
        snapshotLine: "Trend: improving",
        thisWeekLine: "Recent trend: improving",
      };
    case "plateau":
      return {
        snapshotLine: "Trend: plateau",
        thisWeekLine: "Recent trend: plateau",
      };
    case "decline":
      return {
        snapshotLine: "Trend: decline",
        thisWeekLine: "Recent trend: decline",
      };
    case "inconsistent":
      return {
        snapshotLine: "Trend: inconsistent",
        thisWeekLine: "Recent trend: inconsistent",
      };
    default:
      return { snapshotLine: null, thisWeekLine: null };
  }
}

/** Second sentence appended to deterministic draft competition cues when a placement pattern is clear. */
export function multiEventCoachPatternFragment(trend: CompetitionPlacementTrend): string {
  switch (trend) {
    case "improving":
      return (
        "Pattern across recent events: placements are stepping up — reinforce what is working and keep building " +
        "match confidence deliberately."
      );
    case "plateau":
      return (
        "Pattern across recent events: results are clustered at one tier — pick one breakout focus that targets " +
        "the specific moments costing the upgrade."
      );
    case "decline":
      return (
        "Pattern across recent events: tiers have slipped lately — tighten fundamentals, trim the plan slightly, " +
        "and rebuild crisp execution reps."
      );
    case "inconsistent":
      return (
        "Pattern across recent events: outcomes are bouncing — stabilize core positional control and pre-match routines " +
        "so performances feel repeatable."
      );
    default:
      return "";
  }
}

function derivePlacementTrendFromOrdinalRun(ordinals: readonly number[]): CompetitionPlacementTrend | null {
  if (ordinals.length < MULTI_EVENT_TREND_MIN) return null;
  if (ordinals.some((o) => !Number.isFinite(o) || o < 0)) return null;

  const plateau = ordinals.every((o) => o === ordinals[0]);

  let improving = true;
  let declining = true;
  for (let i = 0; i < ordinals.length - 1; i++) {
    if (ordinals[i + 1] <= ordinals[i]) improving = false;
    if (ordinals[i + 1] >= ordinals[i]) declining = false;
  }

  if (plateau) return "plateau";
  if (improving) return "improving";
  if (declining) return "decline";
  return "inconsistent";
}

/**
 * Multi-event competition analytics from existing entries only (labeled results only — skips unknown tiers).
 */
export function computeMultiEventCompetitionMetrics(
  competitions: readonly CompetitionEntry[],
): Pick<
  SignalOutput["competition"],
  | "recentResults"
  | "podiumStreak"
  | "nonPodiumStreak"
  | "mostCommonResult"
  | "placementTrend"
> {
  const labeledSortedNewestFirst = competitions
    .map((entry) => {
      const date = toDateKey(entry.eventDate);
      const tier = date ? parseKnownCompetitionStoredTier(entry) : null;
      return { entry, date, tier };
    })
    .filter(
      (
        row,
      ): row is {
        entry: CompetitionEntry;
        date: string;
        tier: KnownCompetitionStoredTier;
      } => Boolean(row.date && row.tier),
    )
    .sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return cleanText(b.entry.createdAt ?? "").localeCompare(cleanText(a.entry.createdAt ?? ""));
    });

  let podiumStreak = 0;
  let nonPodiumStreak = 0;
  for (const row of labeledSortedNewestFirst) {
    if (isPodiumStoredTier(row.tier)) {
      if (nonPodiumStreak > 0) break;
      podiumStreak += 1;
    } else {
      if (podiumStreak > 0) break;
      nonPodiumStreak += 1;
    }
  }

  const cappedNewestFirst = labeledSortedNewestFirst.slice(0, MULTI_EVENT_RECENT_CAP);

  const chronoDetailed = cappedNewestFirst
    .slice()
    .reverse()
    .map((row) => ({
      eventDateYMD: row.date,
      resultLabel: competitionResultDisplayFromStored(row.tier)!,
      ordinal: ordinalForStoredTier(row.tier),
    }));

  const recentResults: CompetitionRecentResultSignal[] = chronoDetailed.map(
    ({ eventDateYMD, resultLabel }) => ({ eventDateYMD, resultLabel }),
  );

  const labelFrequency: Record<string, number> = {};
  for (const item of recentResults) {
    increment(labelFrequency, item.resultLabel);
  }

  let mostCommonResult: string | null = null;
  let mostCommonHit = 0;
  const labelsSortedStable = [...Object.keys(labelFrequency)].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  for (const lbl of labelsSortedStable) {
    const c = labelFrequency[lbl] ?? 0;
    if (!mostCommonResult || c > mostCommonHit) {
      mostCommonResult = lbl;
      mostCommonHit = c;
    }
  }

  const placementTrend = derivePlacementTrendFromOrdinalRun(chronoDetailed.map((r) => r.ordinal));

  return {
    recentResults,
    podiumStreak,
    nonPodiumStreak,
    mostCommonResult: recentResults.length === 0 ? null : mostCommonResult,
    placementTrend,
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Stored `result` codes → athlete-facing placement copy (signals feed summary UI only). */
function competitionResultDisplayFromStored(value: unknown): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (lower === "dnf") return "DNF";
  if (lower === "other") return "Other";
  if (
    lower === "gold" ||
    lower === "silver" ||
    lower === "bronze" ||
    lower === "participated"
  ) {
    return getPlacementLabel(lower);
  }
  return cleaned;
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

function pickLatestCompetitionEntry(
  competitions: readonly CompetitionEntry[],
): CompetitionEntry | null {
  let best: CompetitionEntry | null = null;
  let bestDate = "";

  for (const competition of competitions) {
    const date = toDateKey(competition.eventDate);
    if (!date) continue;

    if (!best || date > bestDate) {
      best = competition;
      bestDate = date;
      continue;
    }

    if (date === bestDate) {
      const prevCreated = cleanText(best!.createdAt);
      const nextCreated = cleanText(competition.createdAt);
      if (nextCreated > prevCreated) {
        best = competition;
      }
    }
  }

  return best;
}

function countWinsLossesFromEntryMatches(
  entry: CompetitionEntry,
): { matchCount: number; wins: number; losses: number } {
  const matches = Array.isArray(entry.matches) ? entry.matches : [];
  let wins = 0;
  let losses = 0;
  for (const match of matches) {
    const normalized = normalizeMatchResult(match.matchResult);
    if (normalized === "win") wins += 1;
    else if (normalized === "loss") losses += 1;
  }
  return { matchCount: matches.length, wins, losses };
}

function resolveLatestCompetitionSnapshot(
  competitions: readonly CompetitionEntry[],
): {
  date: string;
  result: string | null;
  tournamentName: string | null;
  matchCount: number;
  wins: number;
  losses: number;
} | null {
  const entry = pickLatestCompetitionEntry(competitions);
  if (!entry) return null;

  const date = toDateKey(entry.eventDate);
  if (!date) return null;

  const { matchCount, wins, losses } = countWinsLossesFromEntryMatches(entry);

  return {
    date,
    result: competitionResultDisplayFromStored(entry.result),
    tournamentName: cleanText(entry.tournamentName) || null,
    matchCount,
    wins,
    losses,
  };
}

function countPodiumFinishesInRollingDays(
  competitions: readonly CompetitionEntry[],
  referenceYMD: string,
  windowDays: number,
): number {
  let count = 0;

  for (const competition of competitions) {
    const date = toDateKey(competition.eventDate);
    if (!date || date > referenceYMD) continue;

    const span = calendarDaysBetweenYMD(date, referenceYMD);
    if (span === null || span > windowDays) continue;

    const tier = cleanText(competition.result).toLowerCase();
    if (tier === "gold" || tier === "silver" || tier === "bronze") {
      count += 1;
    }
  }

  return count;
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
  const normalizedMatches = matches.map((match) => ({
    ...match,
    matchResult: normalizeMatchResult(match.matchResult),
  }));
  const validMatches = normalizedMatches.filter(
    (match) => match.matchResult === "win" || match.matchResult === "loss",
  );
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
  const latestSnapshot = resolveLatestCompetitionSnapshot(competitions);
  const lastCompetitionDate =
    competitionCount === 0 ? null : latestSnapshot ? latestSnapshot.date : null;
  const lastCompetitionResult =
    competitionCount === 0 ? null : latestSnapshot ? latestSnapshot.result : null;
  const lastCompetitionName =
    competitionCount === 0 ? null : latestSnapshot ? latestSnapshot.tournamentName : null;
  const lastCompetitionMatchCount =
    competitionCount === 0 ? 0 : latestSnapshot ? latestSnapshot.matchCount : 0;
  const lastCompetitionWins =
    competitionCount === 0 ? 0 : latestSnapshot ? latestSnapshot.wins : 0;
  const lastCompetitionLosses =
    competitionCount === 0 ? 0 : latestSnapshot ? latestSnapshot.losses : 0;
  const podiumCountLast30Days = countPodiumFinishesInRollingDays(competitions, referenceDate, 30);
  const podiumCountLast90Days = countPodiumFinishesInRollingDays(competitions, referenceDate, 90);
  const multiEventMetrics = computeMultiEventCompetitionMetrics(competitions);
  const bucketHistorySignals = deriveCompetitionBucketHistorySignals(competitions);

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
      lastCompetitionName,
      lastCompetitionMatchCount,
      lastCompetitionWins,
      lastCompetitionLosses,
      podiumCountLast30Days,
      podiumCountLast90Days,
      recentResults: multiEventMetrics.recentResults,
      podiumStreak: multiEventMetrics.podiumStreak,
      nonPodiumStreak: multiEventMetrics.nonPodiumStreak,
      mostCommonResult: multiEventMetrics.mostCommonResult,
      placementTrend: multiEventMetrics.placementTrend,
      bucketHistory: bucketHistorySignals.bucketHistory,
      bucketOutcomeTrends: bucketHistorySignals.bucketOutcomeTrends,
    },
    confidence,
    alignment,
    hasData,
  };
}
