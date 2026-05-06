import type { KidsById } from "../types/coachKid";
import type {
  ParentWeeklySessionSnapshot,
  ResolvedSyncedWeeklyDoc,
} from "../coach/resolveWeeklyDoc";
import { resolveWeeklyDoc } from "../coach/resolveWeeklyDoc";

export type WeeklyDoc = ResolvedSyncedWeeklyDoc;

export type IdentityStatus = "loading" | "no_kid" | "no_athlete" | "no_weekly" | "ready";

export type IdentityState = {
  status: IdentityStatus;
  kidId: string | null;
  sharedAthleteId: string | null;
  weeklyDoc: WeeklyDoc | null;
};

export type ResolveIdentityInput = {
  activeKidId: string | null | undefined;
  kidsById: KidsById | null | undefined;
  weeklySessionSnapshot: ParentWeeklySessionSnapshot | null | undefined;
};

function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeKidsById(kidsById: KidsById | null | undefined): KidsById {
  if (!kidsById || typeof kidsById !== "object" || Array.isArray(kidsById)) {
    return {};
  }
  return kidsById;
}

function findKidRow(kids: KidsById, normalizedKidId: string): { key: string; row: KidsById[string] } | null {
  if (!normalizedKidId) return null;
  if (Object.prototype.hasOwnProperty.call(kids, normalizedKidId)) {
    const row = kids[normalizedKidId];
    if (row && typeof row === "object") return { key: normalizedKidId, row };
    return null;
  }
  for (const key of Object.keys(kids)) {
    if (key.trim() === normalizedKidId) {
      const row = kids[key];
      if (row && typeof row === "object") return { key, row };
      return null;
    }
  }
  return null;
}

function weeklyMap(snapshot: ParentWeeklySessionSnapshot): Record<string, WeeklyDoc | null> {
  try {
    const raw = snapshot.weeklyByAthleteId;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw as Record<string, WeeklyDoc | null>;
  } catch {
    return {};
  }
}

/** True when the normalized athlete id matches a map key (trim-aware). */
function athletePresentInWeeklyMap(
  map: Record<string, WeeklyDoc | null>,
  normalizedAthleteId: string,
): boolean {
  if (!normalizedAthleteId) return false;
  try {
    if (Object.prototype.hasOwnProperty.call(map, normalizedAthleteId)) return true;
    for (const key of Object.keys(map)) {
      if (key.trim() === normalizedAthleteId) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

const loadingState: IdentityState = {
  status: "loading",
  kidId: null,
  sharedAthleteId: null,
  weeklyDoc: null,
};

/**
 * Deterministic identity resolution for the active kid + weekly session plane.
 * Pure: no side effects, does not throw; always returns a safe object.
 */
export function resolveIdentity(input: ResolveIdentityInput): IdentityState {
  try {
    const kidId = normalizeId(input.activeKidId);
    if (!kidId) {
      return {
        status: "no_kid",
        kidId: null,
        sharedAthleteId: null,
        weeklyDoc: null,
      };
    }

    const kids = safeKidsById(input.kidsById);
    const found = findKidRow(kids, kidId);
    if (!found) {
      return {
        status: "no_kid",
        kidId,
        sharedAthleteId: null,
        weeklyDoc: null,
      };
    }

    const sharedAthleteId = normalizeId(found.row.sharedAthleteId);
    if (!sharedAthleteId) {
      return {
        status: "no_athlete",
        kidId,
        sharedAthleteId: null,
        weeklyDoc: null,
      };
    }

    const session = input.weeklySessionSnapshot;
    if (session == null) {
      return {
        ...loadingState,
        kidId,
        sharedAthleteId,
      };
    }

    const map = weeklyMap(session);
    if (!athletePresentInWeeklyMap(map, sharedAthleteId)) {
      return {
        status: "no_weekly",
        kidId,
        sharedAthleteId,
        weeklyDoc: null,
      };
    }

    return {
      status: "ready",
      kidId,
      sharedAthleteId,
      weeklyDoc: resolveWeeklyDoc(session, sharedAthleteId),
    };
  } catch {
    return { ...loadingState };
  }
}
