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
  declaredInput?: {
    skills?: unknown;
    declaredSkills?: unknown;
    system?: unknown;
    trainingFocus?: string | null;
    experienceLevel?: string | null;
    isCompetitor?: boolean | null;
  } | null;
  connectionState?: { isCoachConnected?: boolean | null } | null;
  referenceDate?: string | Date | null;
  /** Optional identity tags for diagnostics / future scoping — never required to compute aggregates. */
  athleteId?: string | null;
  kidId?: string | null;
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
    systemBreakdown: Array<{ system: string; score: number }>;
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
  contradictionFlags: {
    declaredVsObserved: boolean;
    observedVsCompetition: boolean;
  };
  identityState: "stable" | "emerging" | "conflicted";
  /** Normalized dominant system from adjustedSystemBreakdown (lowercase, underscores → spaces). Empty → null. */
  dominantObservedSystem: string | null;
  /** Normalized declared focus system from declaredInput (lowercase, underscores → spaces). */
  declaredFocusSystem: string | null;
  /** True when the top adjusted system score is below the dominanceThreshold (0.9 with comps, 0.75 without). */
  isWeakDominance: boolean;
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

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function saturation(count: number, scale: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return 1 - Math.exp(-count / scale);
}

function dominantShare(frequency: Record<string, number>): number {
  const counts = Object.values(frequency).filter((count) => count > 0);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return 0;
  return Math.max(...counts) / total;
}

function sessionDateSpanDays(sessions: readonly Session[]): number {
  const dates = sessions
    .map((session) => toDateKey(session.date))
    .filter((date): date is string => Boolean(date))
    .sort();

  if (dates.length <= 1) return dates.length;

  const span = calendarDaysBetweenYMD(dates[0], dates[dates.length - 1]);
  return span === null ? 0 : span + 1;
}

function maxConfidenceForEvidence(input: {
  sessionCount: number;
  competitionCount: number;
  completedMatchCount: number;
  hasCoachEvidence: boolean;
}): number {
  const sessionCap = 34 + saturation(input.sessionCount, 16) * 50;
  const competitionLift =
    input.competitionCount > 0
      ? saturation(input.competitionCount, 3) * 7 + saturation(input.completedMatchCount, 8) * 5
      : 0;
  const coachLift = input.hasCoachEvidence ? 4 : 0;

  return Math.min(98, sessionCap + competitionLift + coachLift);
}

function computeCalibratedConfidence(input: {
  alignment: number;
  sessions: readonly Session[];
  competitionCount: number;
  completedMatchCount: number;
  systemFrequency: Record<string, number>;
  techniqueFrequency: Record<string, number>;
  streak: number | null;
  hasCoachEvidence: boolean;
}): number {
  const sessionCount = input.sessions.length;
  if (sessionCount === 0 && input.competitionCount === 0) return 0;

  const alignmentQuality = clampUnit(input.alignment / 100);
  const evidenceUnits =
    sessionCount + input.competitionCount * 2 + input.completedMatchCount * 0.5;
  const sampleWeight = 0.34 + saturation(evidenceUnits, 12) * 0.58;
  const hasTraining = sessionCount > 0;
  const hasCompetition = input.competitionCount > 0 || input.completedMatchCount > 0;
  const diversityWeight = Math.min(
    1,
    0.9 + (hasTraining && hasCompetition ? 0.05 : 0) + (input.hasCoachEvidence ? 0.03 : 0),
  );

  const repeatedPatternShare = Math.max(
    dominantShare(input.systemFrequency),
    dominantShare(input.techniqueFrequency),
  );
  const consistencyEvidence =
    repeatedPatternShare * saturation(sessionCount, 10) +
    Math.min(input.streak ?? 0, 6) * 0.025;
  const consistencyWeight = 0.82 + clampUnit(consistencyEvidence) * 0.18;

  const spanDays = sessionDateSpanDays(input.sessions);
  const temporalWeight = 0.82 + saturation(spanDays, 56) * 0.18;

  const raw =
    alignmentQuality *
    100 *
    sampleWeight *
    diversityWeight *
    consistencyWeight *
    temporalWeight;

  return clampPercent(
    Math.min(
      raw,
      maxConfidenceForEvidence({
        sessionCount,
        competitionCount: input.competitionCount,
        completedMatchCount: input.completedMatchCount,
        hasCoachEvidence: input.hasCoachEvidence,
      }),
    ),
  );
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSystemKey(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/_/g, " ").trim();
}

function extractDeclaredSystem(declaredInput: unknown): string | null {
  if (!declaredInput || typeof declaredInput !== "object") return null;
  const declaredRecord = declaredInput as {
    skills?: unknown;
    declaredSkills?: unknown;
    system?: unknown;
    trainingFocus?: string | null;
  };
  const trainingFocusSystem = normalizeSystemKey(declaredRecord.trainingFocus);
  if (trainingFocusSystem.length > 0) return trainingFocusSystem;
  const rawSkills = Array.isArray(declaredRecord.skills)
    ? declaredRecord.skills
    : Array.isArray(declaredRecord.declaredSkills)
      ? declaredRecord.declaredSkills
      : [];
  if (rawSkills.length > 0) {
    const firstSkill = rawSkills
      .map((entry) => normalizeSystemKey(entry))
      .find((entry) => entry.length > 0);
    if (firstSkill) return firstSkill;
  }
  const fallbackSystem = normalizeSystemKey(declaredRecord.system);
  return fallbackSystem.length > 0 ? fallbackSystem : null;
}

function strongestCoachWeaknessSystem(coachData: unknown): string | null {
  if (!coachData || typeof coachData !== "object") return null;
  const aggregate = coachData as Record<string, { weakness?: unknown }>;
  const systems = Object.keys(aggregate).sort((a, b) => a.localeCompare(b));
  let bestSystem: string | null = null;
  let bestWeakness = 0;
  for (const system of systems) {
    const weaknessRaw = aggregate[system]?.weakness;
    const weakness =
      typeof weaknessRaw === "number" && Number.isFinite(weaknessRaw) ? weaknessRaw : 0;
    if (weakness > bestWeakness) {
      bestWeakness = weakness;
      bestSystem = normalizeSystemKey(system);
    }
  }
  return bestWeakness > 0 && bestSystem ? bestSystem : null;
}

function collectCompetitionSignalSystems(coachData: unknown): Set<string> {
  const systems = new Set<string>();
  if (!coachData || typeof coachData !== "object") return systems;

  const aggregate = coachData as Record<
    string,
    { strength?: unknown; weakness?: unknown; focus?: unknown }
  >;

  for (const [rawSystem, signal] of Object.entries(aggregate)) {
    const system = normalizeSystemKey(rawSystem);
    if (!system) continue;
    const strength =
      typeof signal?.strength === "number" && Number.isFinite(signal.strength)
        ? signal.strength
        : 0;
    const weakness =
      typeof signal?.weakness === "number" && Number.isFinite(signal.weakness)
        ? signal.weakness
        : 0;
    const focus =
      typeof signal?.focus === "number" && Number.isFinite(signal.focus)
        ? signal.focus
        : 0;
    if (strength > 0 || weakness > 0 || focus > 0) {
      systems.add(system);
    }
  }

  return systems;
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

function collectSystemDistribution(sessions: readonly Session[]): Record<string, number> {
  const frequency: Record<string, number> = {};

  for (const session of sessions) {
    const entries = Array.isArray(session.techniques) ? session.techniques : [];
    const validSystemKeys = entries
      .map((entry) => cleanText(entry.position))
      .filter((key) => key.length > 0);

    if (validSystemKeys.length > 0) {
      const weight = 1 / validSystemKeys.length;
      for (const key of validSystemKeys) {
        frequency[key] = (frequency[key] ?? 0) + weight;
      }
      continue;
    }

    const fallbackSystem = cleanText(session.system);
    if (!fallbackSystem) continue;
    frequency[fallbackSystem] = (frequency[fallbackSystem] ?? 0) + 1;
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
  if (__DEV__) {
    console.log("[SIGNALS INPUT]", {
      athleteId: input.athleteId ?? null,
      kidId: input.kidId ?? null,
      sessionCount: Array.isArray(input.sessions) ? input.sessions.length : 0,
      competitionCount: Array.isArray(input.competitions) ? input.competitions.length : 0,
    });
  }

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
  const systemDistribution = collectSystemDistribution(sessions);
  const rankedSystems = rankFrequency(systemDistribution);
  const totalSystemScore = rankedSystems.reduce((sum, item) => sum + item.count, 0);
  const systemBreakdown = rankedSystems.map((item) => ({
    system: item.label,
    score: totalSystemScore > 0 ? item.count / totalSystemScore : 0,
  }));
  const topSystem = rankedSystems.length > 0 ? rankedSystems[0].label : null;
  let adjustedSystemBreakdown = [...systemBreakdown];
  let dominantObservedSystem = normalizeSystemKey(
    [...adjustedSystemBreakdown]
      .sort((a, b) => b.score - a.score || a.system.localeCompare(b.system))[0]?.system,
  );
  if (competitions.length > 0) {
    const competitionSignalSystems = collectCompetitionSignalSystems(input.coachData);
    if (
      competitions.length > 0 &&
      competitionSignalSystems.size === 0 &&
      dominantObservedSystem
    ) {
      competitionSignalSystems.add(dominantObservedSystem);
      console.log("[COMPETITION FALLBACK APPLIED]", {
        dominantObservedSystem,
        competitionCount: competitions.length,
      });
      if (
        competitions.length > 0 &&
        systemBreakdown.length === 1 &&
        dominantObservedSystem
      ) {
        adjustedSystemBreakdown = adjustedSystemBreakdown.map((row) => {
          const normalizedSystem = normalizeSystemKey(row.system);
          if (normalizedSystem !== dominantObservedSystem) return row;
          return { ...row, score: row.score * 0.65 };
        });
        adjustedSystemBreakdown.push({
          system: "competition.exposed",
          score: 0.35,
        });
        const syntheticTotal = adjustedSystemBreakdown.reduce((sum, row) => sum + row.score, 0);
        if (syntheticTotal > 0) {
          adjustedSystemBreakdown = adjustedSystemBreakdown.map((row) => ({
            ...row,
            score: row.score / syntheticTotal,
          }));
        }
        console.log("[COMPETITION SYNTHETIC SYSTEM]", {
          addedSystem: "competition.exposed",
          adjustedSystemBreakdown,
        });
      }
    }
    adjustedSystemBreakdown = adjustedSystemBreakdown.map((row) => {
      const normalizedSystem = normalizeSystemKey(row.system);
      if (!competitionSignalSystems.has(normalizedSystem)) return row;
      return {
        ...row,
        score: row.score * 1.3,
      };
    });

    const adjustedTotal = adjustedSystemBreakdown.reduce((sum, row) => sum + row.score, 0);
    if (adjustedTotal > 0) {
      adjustedSystemBreakdown = adjustedSystemBreakdown.map((row) => ({
        ...row,
        score: row.score / adjustedTotal,
      }));
    }

    const secondPassCompetitionMultiplier = 2.4;
    const secondPassNonTopAdditiveBoost = 0.25;
    const currentTopSystem = normalizeSystemKey(
      [...adjustedSystemBreakdown]
        .sort((a, b) => b.score - a.score || a.system.localeCompare(b.system))[0]?.system,
    );
    adjustedSystemBreakdown = adjustedSystemBreakdown.map((row) => {
      const normalizedSystem = normalizeSystemKey(row.system);
      if (!competitionSignalSystems.has(normalizedSystem)) return row;
      const boostedScore = row.score * secondPassCompetitionMultiplier;
      return {
        ...row,
        score:
          normalizedSystem !== currentTopSystem
            ? boostedScore + secondPassNonTopAdditiveBoost
            : boostedScore,
      };
    });

    const secondPassAdjustedTotal = adjustedSystemBreakdown.reduce((sum, row) => sum + row.score, 0);
    if (secondPassAdjustedTotal > 0) {
      adjustedSystemBreakdown = adjustedSystemBreakdown.map((row) => ({
        ...row,
        score: row.score / secondPassAdjustedTotal,
      }));
    }
  }
  dominantObservedSystem = normalizeSystemKey(
    [...adjustedSystemBreakdown]
      .sort((a, b) => b.score - a.score || a.system.localeCompare(b.system))[0]?.system,
  );

  const topSystemRow = [...adjustedSystemBreakdown].sort(
    (a, b) => b.score - a.score || a.system.localeCompare(b.system),
  )[0];
  const topScore = typeof topSystemRow?.score === "number" ? topSystemRow.score : 0;
  const dominanceThreshold = competitions.length > 0 ? 0.9 : 0.75;
  const isWeakDominance = topScore < dominanceThreshold;

  console.log("[DOMINANCE QUALITY]", {
    dominantObservedSystem,
    topScore,
    dominanceThreshold,
    isWeakDominance,
  });

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
  const contradictionFlags = {
    declaredVsObserved: false,
    observedVsCompetition: false,
  };

  const declaredFocusSystem = extractDeclaredSystem(input.declaredInput);
  if (
    declaredFocusSystem &&
    dominantObservedSystem &&
    (declaredFocusSystem !== dominantObservedSystem || isWeakDominance)
  ) {
    contradictionFlags.declaredVsObserved = true;
  }

  const coachWeaknessSystem = strongestCoachWeaknessSystem(input.coachData);
  const hasCompetitionOrCoachSignals =
    competitions.length > 0 || hasMeaningfulValue(input.coachData);
  if (
    hasCompetitionOrCoachSignals &&
    coachWeaknessSystem &&
    dominantObservedSystem &&
    (coachWeaknessSystem !== dominantObservedSystem || isWeakDominance)
  ) {
    contradictionFlags.observedVsCompetition = true;
  }

  let identityState: "stable" | "emerging" | "conflicted";
  if (contradictionFlags.declaredVsObserved && contradictionFlags.observedVsCompetition) {
    identityState = "conflicted";
  } else if (contradictionFlags.declaredVsObserved || contradictionFlags.observedVsCompetition) {
    identityState = "emerging";
  } else {
    identityState = "stable";
  }

  const hasDeclaredInput = hasMeaningfulValue(input.declaredInput);
  const alignment = clampPercent((hasDeclaredInput ? 50 : 0) + (hasData ? 50 : 0));
  let adjustedAlignment = alignment;
  if (contradictionFlags.declaredVsObserved) {
    adjustedAlignment *= 0.85;
  }
  if (contradictionFlags.observedVsCompetition) {
    adjustedAlignment *= 0.7;
  }
  const hasCoachEvidence =
    hasMeaningfulValue(input.coachData) ||
    input.connectionState?.isCoachConnected === true;
  const confidence = computeCalibratedConfidence({
    alignment,
    sessions,
    competitionCount,
    completedMatchCount,
    systemFrequency,
    techniqueFrequency,
    streak,
    hasCoachEvidence,
  });
  let adjustedConfidence = confidence;
  if (contradictionFlags.declaredVsObserved) {
    adjustedConfidence *= 0.8;
  }
  if (contradictionFlags.observedVsCompetition) {
    adjustedConfidence *= 0.6;
  }
  const goalMet = weeklySessionCount >= WEEKLY_SESSION_GOAL;

  if (__DEV__) {
    console.log("[SYSTEM DOMINANCE DEBUG]:", {
      before: systemBreakdown,
      after: adjustedSystemBreakdown,
      dominantObservedSystem,
    });
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
      systemBreakdown,
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
    contradictionFlags,
    identityState,
    dominantObservedSystem: dominantObservedSystem.length > 0 ? dominantObservedSystem : null,
    declaredFocusSystem,
    isWeakDominance,
    confidence: adjustedConfidence,
    alignment: adjustedAlignment,
    hasData,
  };
}
