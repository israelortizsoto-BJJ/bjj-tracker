import type {
  CoachWeeklySyncSessionResponse,
  SyncedSharedAthlete,
  SyncedWeeklyMessagePayload,
} from "../../types/coachWeeklySync";

type WeeklyDoc = SyncedWeeklyMessagePayload | null;

type InvariantParams = {
  weeklyByAthleteId: Record<string, WeeklyDoc> | null | undefined;
  athletes?: SyncedSharedAthlete[] | null;
  session?: { athletes?: SyncedSharedAthlete[] } | CoachWeeklySyncSessionResponse | null;
};

type InvariantResult = {
  weeklyByAthleteId: Record<string, WeeklyDoc>;
  athletes: SyncedSharedAthlete[];
};

const FALLBACK_NAME = "";
const FALLBACK_CREATED_AT = "";

function normalizeWeeklyMap(
  weeklyByAthleteId: InvariantParams["weeklyByAthleteId"],
): Record<string, WeeklyDoc> {
  if (!weeklyByAthleteId || typeof weeklyByAthleteId !== "object" || Array.isArray(weeklyByAthleteId)) {
    return {};
  }

  const normalized: Record<string, WeeklyDoc> = {};
  for (const [rawId, doc] of Object.entries(weeklyByAthleteId)) {
    if (typeof rawId !== "string") continue;
    const id = rawId.trim();
    if (!id) continue;
    normalized[id] = doc ?? null;
  }
  return normalized;
}

function normalizeAthleteId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toAthleteStub(id: string): SyncedSharedAthlete {
  return {
    id,
    name: FALLBACK_NAME,
    createdAt: FALLBACK_CREATED_AT,
  };
}

function normalizeAthleteList(raw: SyncedSharedAthlete[] | null | undefined): SyncedSharedAthlete[] {
  if (!Array.isArray(raw)) return [];
  const normalized: SyncedSharedAthlete[] = [];
  const seen = new Set<string>();

  for (const athlete of raw) {
    const id = normalizeAthleteId(athlete?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      ...athlete,
      id,
    });
  }

  return normalized;
}

export function enforceWeeklyAthleteInvariant(params: InvariantParams): InvariantResult {
  const normalizedWeeklyByAthleteId = normalizeWeeklyMap(params.weeklyByAthleteId);
  const weeklyIds = Object.keys(normalizedWeeklyByAthleteId);

  /** Empty array is not an authoritative roster (legacy/partial payloads); keep weekly map keys. */
  const hasSessionAthletes =
    Array.isArray(params.session?.athletes) && params.session!.athletes!.length > 0;
  const authoritativeAthletes = hasSessionAthletes ? params.session?.athletes : params.athletes;
  const normalizedAthletes = normalizeAthleteList(authoritativeAthletes);

  const athleteById = new Map(normalizedAthletes.map((athlete) => [athlete.id, athlete]));
  const shouldMergeWeeklyIds = !hasSessionAthletes;

  if (normalizedAthletes.length === 0 && !hasSessionAthletes) {
    for (const id of weeklyIds) {
      athleteById.set(id, toAthleteStub(id));
    }
  } else if (shouldMergeWeeklyIds) {
    for (const id of weeklyIds) {
      if (!athleteById.has(id)) {
        athleteById.set(id, toAthleteStub(id));
      }
    }
  }

  const athletes = Array.from(athleteById.values());
  const validAthleteIds = new Set(athletes.map((athlete) => athlete.id));
  const weeklyByAthleteId = Object.fromEntries(
    Object.entries(normalizedWeeklyByAthleteId).filter(([id]) => validAthleteIds.has(id)),
  );

  return {
    weeklyByAthleteId,
    athletes,
  };
}
