// app/domain/metrics.ts
// Pure domain computations for Training insights.
// No React. No storage. No navigation.

import type { Session } from "../types"; // <-- adjust if your Session type lives elsewhere

export type TopSystemMetric = { systemId: string; count: number };
export type Focus14dMetric = { systemId: string; count: number };
export type GiNoGi14dMetric = { gi: number; nogi: number; primary: string };

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

// --- Exported metrics ---

export function computeTopSystemThisWeek(weekSessionsRaw: Session[]): TopSystemMetric | null {
  const counts = countSystemsFromSessions(weekSessionsRaw);
  const picked = pickTopKeyDeterministic(counts);
  return picked ? { systemId: picked.key, count: picked.count } : null;
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