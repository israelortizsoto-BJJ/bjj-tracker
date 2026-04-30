// app/domain/metrics.ts
// Pure domain computations for Training insights.
// No React. No storage. No navigation.

import type { Session } from "../types"; // <-- adjust if your Session type lives elsewhere
import type { CompetitionDetailMatchSnapshot } from "../storage/competitionStore";

export type TopSystemMetric = { systemId: string; count: number };
export type Focus14dMetric = { systemId: string; count: number };
export type GiNoGi14dMetric = { gi: number; nogi: number; primary: string };
export type TopTechniqueMetric = { techniqueId: string; count: number };

/** Archetype mode for identity naming (summary / profile). */
export type SummaryIdentityMode = "parent" | "coach" | "competitor" | "hobbyist";

/** Metric bundle used for confidence scoring on the Summary identity header. */
export type SummaryConfidenceMetrics = {
  sessionsThisWeek: number;
  topSystem: TopSystemMetric | null;
  topTechnique: TopTechniqueMetric | null;
  currentFocus: Focus14dMetric | null;
  giNoGi: GiNoGi14dMetric | null;
};

/** Base display name before optional system · intent · technique segments. */
export function baseIdentityName(mode: SummaryIdentityMode): string {
  if (mode === "parent") return "Progress Guide";
  if (mode === "coach") return "Room Builder";
  if (mode === "competitor") return "Pressure Passing Competitor";
  return "Mat Explorer";
}

/** Stored profile fields used to infer summary archetype mode (no UI imports). */
export type SummaryIdentityInputsShape = {
  role?: string;
  competition?: string;
};

/**
 * Infer summary mode from identity builder answers — defaults to hobbyist.
 */
export function deriveSummaryIdentityMode(inputs: SummaryIdentityInputsShape): SummaryIdentityMode {
  if (inputs.role === "parent") return "parent";
  if (inputs.role === "coach") return "coach";
  if (inputs.competition === "active_competitor") return "competitor";
  return "hobbyist";
}

export function normalizeSummaryIdentityMode(value: unknown): SummaryIdentityMode | null {
  if (value === "parent" || value === "coach" || value === "competitor" || value === "hobbyist") {
    return value;
  }
  return null;
}

/**
 * Hydrate mode from persisted profile (`summaryIdentityMode`) when valid and
 * summary identity selections are absent; otherwise prefer inputs-derived mode
 * (fallback hobbyist via deriveSummaryIdentityMode).
 */
export function resolveSummaryIdentityMode(
  summaryIdentityModeFromProfile: unknown,
  inputs: SummaryIdentityInputsShape
): SummaryIdentityMode {
  const fromInputs = deriveSummaryIdentityMode(inputs);
  const hasModeInputs =
    (inputs.role ?? "").trim().length > 0 || (inputs.competition ?? "").trim().length > 0;
  if (hasModeInputs) return fromInputs;
  return normalizeSummaryIdentityMode(summaryIdentityModeFromProfile) ?? fromInputs;
}

/**
 * Concatenates base · system · intent · technique, omitting empty segments.
 */
export function deriveIdentityDisplayName(
  mode: SummaryIdentityMode,
  segments: {
    systemLabel?: string | null | undefined;
    intentLabel?: string | null | undefined;
    techniqueLabel?: string | null | undefined;
  }
): string {
  const base = baseIdentityName(mode);
  const ordered = [
    base,
    segments.systemLabel,
    segments.intentLabel,
    segments.techniqueLabel,
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  return ordered.join(" · ");
}

/**
 * Confidence tier for Summary identity UX (sessions + metric richness).
 */
export function computeConfidence(metrics: SummaryConfidenceMetrics): number {
  const w = metrics.sessionsThisWeek ?? 0;
  if (w <= 0) return 0;

  const richness = [
    metrics.topSystem,
    metrics.topTechnique,
    metrics.currentFocus,
    metrics.giNoGi,
  ].filter(Boolean).length;

  const consistentTier = w >= 4 || (w >= 2 && richness >= 2);
  if (consistentTier) return 68;
  return 30;
}

// --- Internal helpers (UTC-safe to match YYYY-MM-DD parsing behavior) ---

function ymdShift(ymd: string, deltaDays: number): string {
  // "YYYY-MM-DD" is parsed as UTC in JS engines; stay in UTC to avoid tz drift.
  const d = new Date(ymd);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function pickTopKeyDeterministic(counts: Record<string, number>): { key: string; count: number } | null {
  let bestKey = "";
  let bestCount = 0;

  // deterministic: highest count, then alphabetical
  for (const key of Object.keys(counts).sort()) {
    const c = counts[key] ?? 0;
    if (c > bestCount) {
      bestCount = c;
      bestKey = key;
    }
  }

  return bestKey ? { key: bestKey, count: bestCount } : null;
}

function countSystemsFromSessions(list: Session[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of list) {
    const key = (s.system ?? "").trim();
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
function countTechniquesFromSessions(list: Session[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of list) {
    if (Array.isArray(s.techniques) && s.techniques.length > 0) {
      for (const t of s.techniques) {
        const key = (t?.techniqueId ?? "").trim();
        if (!key) continue;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      continue;
    }

    const key = (s.techniqueId ?? "").trim();
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
// --- Exported metrics ---

export function computeTopSystemThisWeek(weekSessionsRaw: Session[]): TopSystemMetric | null {
  const counts = countSystemsFromSessions(weekSessionsRaw);
  const picked = pickTopKeyDeterministic(counts);
  return picked ? { systemId: picked.key, count: picked.count } : null;
}
export function computeTopTechniqueThisWeek(
  weekSessionsRaw: Session[]
): TopTechniqueMetric | null {
  const counts = countTechniquesFromSessions(weekSessionsRaw);
  const picked = pickTopKeyDeterministic(counts);
  return picked ? { techniqueId: picked.key, count: picked.count } : null;
}
export function computeCurrentFocus14d(
  sessionsByDate: Record<string, Session[]>,
  todayYMD: string
): Focus14dMetric | null {
  const counts: Record<string, number> = {};

  for (let i = 0; i < 14; i++) {
    const day = ymdShift(todayYMD, -i);
    const list = sessionsByDate[day] ?? [];

    for (const s of list) {
      const key = (s.system ?? "").trim();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  const picked = pickTopKeyDeterministic(counts);
  return picked ? { systemId: picked.key, count: picked.count } : null;
}

export function computeGiNoGi14d(
  sessionsByDate: Record<string, Session[]>,
  todayYMD: string
): GiNoGi14dMetric | null {
  let gi = 0;
  let nogi = 0;

  for (let i = 0; i < 14; i++) {
    const day = ymdShift(todayYMD, -i);
    const list = sessionsByDate[day] ?? [];

    for (const s of list) {
      const g = (s.gear ?? "").toString().toLowerCase().trim();
      if (g === "gi") gi += 1;
      else if (g === "no-gi" || g === "nogi") nogi += 1;
    }
  }

  const total = gi + nogi;
  if (total === 0) return null;

  const primary = gi === nogi ? "Gi & No-Gi" : gi > nogi ? "Gi" : "No-Gi";
  return { gi, nogi, primary };
}

export function computeWeekCount(
  sessionsByDate: Record<string, Session[]>,
  weekStartYMD: string
): number {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = ymdShift(weekStartYMD, i);
    count += sessionsByDate[d]?.length ?? 0;
  }
  return count;
}

/** Total sessions logged across all dates (flattened buckets). */
export function computeTotalSessionCount(sessionsByDate: Record<string, Session[]>): number {
  let n = 0;
  for (const day of Object.keys(sessionsByDate)) {
    n += sessionsByDate[day]?.length ?? 0;
  }
  return n;
}

export const METRIC_TILE_COMPETITION_RECORD_PLACEHOLDER = "Not tracked yet" as const;

export function computeCompetitionRecord(
  filteredMatches: CompetitionDetailMatchSnapshot[],
): string {
  if (filteredMatches.length === 0) return METRIC_TILE_COMPETITION_RECORD_PLACEHOLDER;
  let wins = 0;
  let losses = 0;
  for (const match of filteredMatches) {
    if (match.matchResult === "win") wins += 1;
    else if (match.matchResult === "loss") losses += 1;
  }
  if (wins === 0 && losses === 0) return METRIC_TILE_COMPETITION_RECORD_PLACEHOLDER;
  return `${wins}-${losses}`;
}

export function computeWinRate(filteredMatches: CompetitionDetailMatchSnapshot[]): number {
  const total = filteredMatches.length;
  if (total === 0) return 0;
  let wins = 0;
  for (const match of filteredMatches) {
    if (match.matchResult === "win") wins += 1;
  }
  return Math.round((wins / total) * 100);
}

export function computeSubmissionRate(filteredMatches: CompetitionDetailMatchSnapshot[]): number {
  const total = filteredMatches.length;
  if (total === 0) return 0;
  let submissions = 0;
  for (const match of filteredMatches) {
    if (match.matchResult === "win" && match.outcome === "Submission") submissions += 1;
  }
  return Math.round((submissions / total) * 100);
}

export function computeCompetitionInsight(matches: CompetitionDetailMatchSnapshot[]): string {
  if (!matches.length) return "";

  let winSub = 0;
  let winPoints = 0;
  let lossSub = 0;
  let lossPoints = 0;

  for (const m of matches) {
    if (m.matchResult === "win") {
      if (m.outcome === "Submission") winSub++;
      else winPoints++;
    } else if (m.matchResult === "loss") {
      if (m.outcome === "Submission") lossSub++;
      else lossPoints++;
    }
  }

  const totalWins = winSub + winPoints;
  const totalLosses = lossSub + lossPoints;

  if (totalWins === 0 && totalLosses === 0) return "";

  // WIN PATTERNS
  if (totalWins > 0 && winSub / totalWins >= 0.6) {
    return "Strong finishing ability — keep attacking submissions.";
  }

  if (totalWins > 0 && winPoints / totalWins >= 0.6) {
    return "Winning on control — look to increase submission threats.";
  }

  // LOSS PATTERNS
  if (totalLosses > 0 && lossSub / totalLosses >= 0.6) {
    return "Focus on submission defense — you're getting caught late.";
  }

  if (totalLosses > 0 && lossPoints / totalLosses >= 0.6) {
    return "Matches are close — sharpen scoring and urgency.";
  }

  // DEFAULT
  return "Balanced game — refine both control and finishing.";
}

function submissionTimeToSeconds(raw: string | null): number | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const mmssMatch = value.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!mmssMatch) return null;
  const minutes = Number(mmssMatch[1]);
  const seconds = Number(mmssMatch[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

export function computeFastestSub(filteredMatches: CompetitionDetailMatchSnapshot[]): string {
  let best: number | null = null;
  for (const match of filteredMatches) {
    if (match.matchResult !== "win" || match.outcome !== "Submission") continue;
    const parsed = submissionTimeToSeconds(match.submissionTime);
    if (parsed == null) continue;
    if (best == null || parsed < best) best = parsed;
  }
  if (best == null) return "—";
  const minutes = Math.floor(best / 60);
  const seconds = best % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatGiNoGiMetricTile(metric: GiNoGi14dMetric | null): string {
  if (!metric) return "—";
  return `${metric.primary} (${metric.gi}/${metric.nogi})`;
}

export function computeCompletedWeekStreak(
  sessionsByDate: Record<string, Session[]>,
  currentWeekStartYMD: string,
  weeklyGoal: number,
  maxWeeksLookback = 12
): number {
  let streak = 0;

  // start at last *completed* week
  let cursorWeekStart = ymdShift(currentWeekStartYMD, -7);

  for (let w = 0; w < maxWeeksLookback; w++) {
    const weekCount = computeWeekCount(sessionsByDate, cursorWeekStart);
    if (weekCount < weeklyGoal) break;

    streak += 1;
    cursorWeekStart = ymdShift(cursorWeekStart, -7);
  }

  return streak;
}

export function computeLastWeekTotal(
  sessionsByDate: Record<string, Session[]>,
  viewedWeekStartYMD: string
): number {
  const lastWeekStart = ymdShift(viewedWeekStartYMD, -7);
  return computeWeekCount(sessionsByDate, lastWeekStart);
}
export function computeWeekTotals(
  sessionsByDate: Record<string, Session[]>,
  currentWeekStartYMD: string,
  weeks = 4
): number[] {
  const totals: number[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = ymdShift(currentWeekStartYMD, -7 * w);
    totals.push(computeWeekCount(sessionsByDate, weekStart));
  }
  return totals;
}

/** Co-occurrence of two technique taxonomy IDs in one session (earlier slot → later slot). */
export type TechniquePairCount = { pair: [string, string]; count: number };

function techniqueIdsFromSessionTechniquesOrdered(session: Session): string[] {
  const list = session.techniques;
  if (!Array.isArray(list) || list.length === 0) return [];
  const keys: string[] = [];
  for (const t of list) {
    const key = (t?.techniqueId ?? "").trim();
    if (!key) continue;
    keys.push(key);
  }
  return keys;
}

function pairKey(a: string, b: string): string {
  return JSON.stringify([a, b] as [string, string]);
}

function pickTopTechniquePairsDeterministic(
  counts: Record<string, number>,
  limit: number
): TechniquePairCount[] {
  const rows: TechniquePairCount[] = Object.entries(counts).map(([key, count]) => ({
    pair: JSON.parse(key) as [string, string],
    count,
  }));
  rows.sort((x, y) => {
    if (y.count !== x.count) return y.count - x.count;
    const ax = x.pair[0];
    const bx = y.pair[0];
    if (ax !== bx) return ax < bx ? -1 : 1;
    const ay = x.pair[1];
    const by = y.pair[1];
    return ay < by ? -1 : ay > by ? 1 : 0;
  });
  return rows.slice(0, limit);
}

/**
 * Multi-technique insight: most common ordered pairs (A → B) from `techniques[]`
 * in list order (all index pairs with the first entry before the second).
 */
export function getTopTechniquePairs(sessions: Session[]): TechniquePairCount[] {
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    const keys = techniqueIdsFromSessionTechniquesOrdered(s);
    if (keys.length < 2) continue;
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = keys[i]!;
        const b = keys[j]!;
        const k = pairKey(a, b);
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
  }
  return pickTopTechniquePairsDeterministic(counts, 3);
}
