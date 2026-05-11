import AsyncStorage from "@react-native-async-storage/async-storage";

import { StorageKeys } from "./storageKeys";

export type OnboardingVersion = "v1" | "v2";

export type ParentAthlete = {
  id: string;
  name: string;
  household?: string;
  /** IBJJF-style rank token (e.g. `grey_white`, `blue`) from `ATHLETE_BELT_RANK_OPTIONS`. */
  beltRank?: string;
  stripes?: number;
  /** Maturity layer: `beginner` | `developing` | `experienced` — independent of belt. */
  experienceLevel?: string;
  trainingAgeMonths?: number;
  /** Independent of belt rank and experience level. */
  isCompetitor?: boolean;
  competitionIntent?: string;
  declaredSkills?: string[];
  onboardingVersion?: OnboardingVersion;
};

function readOptionalTrimmedString(row: object, key: string): string | undefined {
  if (!(key in row)) return undefined;
  const v = (row as Record<string, unknown>)[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function readOptionalFiniteInt(row: object, key: string): number | undefined {
  if (!(key in row)) return undefined;
  const v = (row as Record<string, unknown>)[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.trunc(v);
  return n >= 0 ? n : undefined;
}

function readOptionalBoolean(row: object, key: string): boolean | undefined {
  if (!(key in row)) return undefined;
  const v = (row as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : undefined;
}

function readOptionalStringArray(row: object, key: string): string[] | undefined {
  if (!(key in row)) return undefined;
  const v = (row as Record<string, unknown>)[key];
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t) out.push(t);
  }
  return out;
}

function readOptionalOnboardingVersion(row: object): OnboardingVersion | undefined {
  if (!("onboardingVersion" in row)) return undefined;
  const v = (row as Record<string, unknown>).onboardingVersion;
  if (v === "v1" || v === "v2") return v;
  return undefined;
}

function safeParseAthletes(raw: string | null): ParentAthlete[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const next: ParentAthlete[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const id = "id" in row && typeof row.id === "string" ? row.id.trim() : "";
      const name = "name" in row && typeof row.name === "string" ? row.name.trim() : "";
      if (!id || !name) continue;
      const household =
        "household" in row && typeof row.household === "string"
          ? row.household.trim() || undefined
          : undefined;
      const beltRank = readOptionalTrimmedString(row, "beltRank");
      const stripes = readOptionalFiniteInt(row, "stripes");
      const experienceLevel = readOptionalTrimmedString(row, "experienceLevel");
      const trainingAgeMonths = readOptionalFiniteInt(row, "trainingAgeMonths");
      const isCompetitor = readOptionalBoolean(row, "isCompetitor");
      const competitionIntent = readOptionalTrimmedString(row, "competitionIntent");
      const declaredSkills = readOptionalStringArray(row, "declaredSkills");
      const onboardingVersion = readOptionalOnboardingVersion(row);
      const athlete: ParentAthlete = {
        id,
        name,
        ...(household ? { household } : {}),
        ...(beltRank ? { beltRank } : {}),
        ...(stripes !== undefined ? { stripes } : {}),
        ...(experienceLevel ? { experienceLevel } : {}),
        ...(trainingAgeMonths !== undefined ? { trainingAgeMonths } : {}),
        ...(isCompetitor !== undefined ? { isCompetitor } : {}),
        ...(competitionIntent ? { competitionIntent } : {}),
        ...(declaredSkills !== undefined ? { declaredSkills } : {}),
        ...(onboardingVersion ? { onboardingVersion } : {}),
      };
      next.push(athlete);
    }
    return next;
  } catch {
    return [];
  }
}

function newAthleteId(): string {
  return `pa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function getAthletes(): Promise<ParentAthlete[]> {
  try {
    const raw = await AsyncStorage.getItem(StorageKeys.parentAthletes);
    return safeParseAthletes(raw);
  } catch {
    return [];
  }
}

export async function addAthlete(input: {
  name: string;
  household?: string;
}): Promise<ParentAthlete> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw new Error("Name is required");
  }
  const householdRaw =
    typeof input.household === "string" ? input.household.trim() : "";
  const athlete: ParentAthlete = {
    id: newAthleteId(),
    name,
    ...(householdRaw ? { household: householdRaw } : {}),
  };
  const existing = await getAthletes();
  const next = [...existing, athlete];
  try {
    await AsyncStorage.setItem(StorageKeys.parentAthletes, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return athlete;
}

export type ParentAthleteUpdate = Partial<Omit<ParentAthlete, "id">>;

export async function updateAthlete(id: string, patch: ParentAthleteUpdate): Promise<ParentAthlete | null> {
  const trimmedId = typeof id === "string" ? id.trim() : "";
  if (!trimmedId) return null;

  const existing = await getAthletes();
  const idx = existing.findIndex((a) => a.id === trimmedId);
  if (idx === -1) return null;

  const prev = existing[idx];
  const merged: ParentAthlete = { ...prev };

  const entries = Object.entries(patch) as [keyof ParentAthleteUpdate, ParentAthleteUpdate[keyof ParentAthleteUpdate]][];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    (merged as Record<string, unknown>)[key as string] = value;
  }

  const next = [...existing];
  next[idx] = merged;

  try {
    await AsyncStorage.setItem(StorageKeys.parentAthletes, JSON.stringify(next));
  } catch {
    /* ignore */
  }

  return merged;
}

export async function deleteAthlete(id: string): Promise<boolean> {
  const trimmedId = typeof id === "string" ? id.trim() : "";
  if (!trimmedId) return false;

  const existing = await getAthletes();
  const next = existing.filter((a) => a.id !== trimmedId);
  if (next.length === existing.length) return false;

  try {
    await AsyncStorage.setItem(StorageKeys.parentAthletes, JSON.stringify(next));
  } catch {
    return false;
  }

  const current = await getActiveAthleteId();
  const currentNorm = (current ?? "").trim();
  if (currentNorm === trimmedId) {
    if (next.length > 0) {
      await setActiveAthleteId(next[0].id);
    } else {
      await setActiveAthleteId(null, { allowClear: true });
    }
  }

  return true;
}

export async function getActiveAthleteId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(StorageKeys.parentActiveAthleteId);
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

type ActiveAthleteChangeListener = () => void;
const activeAthleteChangeListeners = new Set<ActiveAthleteChangeListener>();

/** Subscribers run after `setActiveAthleteId` mutates storage (same JS tick as the write await). */
export function subscribeActiveAthleteChanges(listener: ActiveAthleteChangeListener): () => void {
  activeAthleteChangeListeners.add(listener);
  return () => {
    activeAthleteChangeListeners.delete(listener);
  };
}

function notifyActiveAthleteChanged(): void {
  for (const listener of activeAthleteChangeListeners) {
    try {
      listener();
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export type SetActiveAthleteIdOptions = {
  /** Allow removing the persisted active athlete (e.g. last profile deleted). */
  allowClear?: boolean;
};

export async function setActiveAthleteId(
  athleteId: string | null,
  options?: SetActiveAthleteIdOptions,
): Promise<void> {
  const allowClear = options?.allowClear === true;
  const wantClear =
    athleteId == null || (typeof athleteId === "string" && athleteId.trim() === "");

  if (wantClear && !allowClear) {
    if (__DEV__) {
      console.warn("⚠️ Ignoring empty athleteId transition");
    }
    return;
  }

  const prevRaw = await getActiveAthleteId();
  const prevNorm = (prevRaw ?? "").trim();

  try {
    if (athleteId == null) {
      await AsyncStorage.removeItem(StorageKeys.parentActiveAthleteId);
    } else {
      const trimmed = athleteId.trim();
      if (!trimmed) {
        await AsyncStorage.removeItem(StorageKeys.parentActiveAthleteId);
      } else {
        await AsyncStorage.setItem(StorageKeys.parentActiveAthleteId, trimmed);
      }
    }
  } catch {
    /* ignore */
  }

  const nextRaw = await getActiveAthleteId();
  const nextNorm = (nextRaw ?? "").trim();

  if (__DEV__ && prevNorm !== nextNorm) {
    const from = prevNorm || "(none)";
    const to = nextNorm || "(none)";
    console.log(`[ATHLETE SWITCH] from ${from} → ${to}`);
  }

  if (prevNorm !== nextNorm) {
    notifyActiveAthleteChanged();
  }
}
