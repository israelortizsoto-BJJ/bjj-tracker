import { calendarDaysBetweenYMD, localTodayDateKey, toDateKey } from "../../_domain/dateKey";
import { addDaysYMD, startOfWeekMondayYMD } from "../../domain/sessionUtils";
import type { RankedSignalItem } from "../../lib/signals/computeSignals";
import type { Session, TechniqueEntry } from "../../types";
import type { SyncedTrainingProofArtifact } from "../../types/coachWeeklySync";

const WEEKLY_SESSION_GOAL = 3;
const TOP_TECHNIQUES_ROLLING_DAYS = 14;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSystemKey(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/_/g, " ").trim();
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
      let added = false;
      for (const entry of entries) {
        const key = techniqueKeyFromEntry(entry);
        if (!key) continue;
        increment(frequency, key);
        added = true;
      }
      if (added) continue;
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

function filterParentSessionsForAthlete(
  sessions: readonly Session[],
  sharedAthleteId: string,
): Session[] {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return [];
  return sessions.filter((session) => {
    if ((session.sharedAthleteId ?? "").trim() !== athleteId) return false;
    if (session.trainingLoggedByRole === "coach") return false;
    return true;
  });
}

function sessionsInCurrentWeek(
  sessions: readonly Session[],
  referenceYMD: string,
): Session[] {
  const weekStart = startOfWeekMondayYMD(referenceYMD);
  if (!weekStart) return [];
  const weekEnd = addDaysYMD(weekStart, 6);
  if (!weekEnd) return [];
  return sessions.filter((session) => {
    const dateKey = toDateKey(session.date);
    return dateKey >= weekStart && dateKey <= weekEnd;
  });
}

function sessionsInRollingDays(
  sessions: readonly Session[],
  referenceYMD: string,
  windowDays: number,
): Session[] {
  return sessions.filter((session) => {
    const dateKey = toDateKey(session.date);
    if (!dateKey || dateKey > referenceYMD) return false;
    const span = calendarDaysBetweenYMD(dateKey, referenceYMD);
    return span !== null && span <= windowDays;
  });
}

function resolveLastTrainingDateYMD(sessions: readonly Session[]): string | null {
  let best: string | null = null;
  for (const session of sessions) {
    const dateKey = toDateKey(session.date);
    if (!dateKey) continue;
    if (!best || dateKey > best) best = dateKey;
  }
  return best;
}

/**
 * Parent-only: bounded training proof from local sessions (no Session[] on the wire).
 * Pure session dominance — no competition influence.
 */
export function buildTrainingProofArtifact(
  sharedAthleteId: string,
  sessions: readonly Session[],
  referenceDate?: string | Date | null,
): SyncedTrainingProofArtifact {
  const athleteId = sharedAthleteId.trim();
  const referenceYMD =
    referenceDate instanceof Date
      ? localTodayDateKey(referenceDate)
      : toDateKey(typeof referenceDate === "string" ? referenceDate : undefined) ||
        localTodayDateKey();

  const parentSessions = filterParentSessionsForAthlete(sessions, athleteId);
  const currentWeekSessions = sessionsInCurrentWeek(parentSessions, referenceYMD);
  const rollingTechniqueSessions = sessionsInRollingDays(
    parentSessions,
    referenceYMD,
    TOP_TECHNIQUES_ROLLING_DAYS,
  );

  const currentWeekSessionCount = currentWeekSessions.length;
  const systemDistribution = collectSystemDistribution(parentSessions);
  const rankedSystems = rankFrequency(systemDistribution).slice(0, 3);
  const topTechniques = rankFrequency(collectTechniqueFrequency(rollingTechniqueSessions)).slice(
    0,
    3,
  );

  const dominantFromDistribution = normalizeSystemKey(rankedSystems[0]?.key);
  const dominantSystemKey = dominantFromDistribution.length > 0 ? dominantFromDistribution : null;

  return {
    sharedAthleteId: athleteId,
    updatedAt: new Date().toISOString(),
    currentWeekSessionCount,
    lastTrainingDateYMD: resolveLastTrainingDateYMD(parentSessions),
    dominantSystemKey,
    topSystems: rankedSystems,
    topTechniques,
    weeklyGoalMet: currentWeekSessionCount >= WEEKLY_SESSION_GOAL,
  };
}
