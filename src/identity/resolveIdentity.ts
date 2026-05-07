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
  /** Parent `athleteStore` id (`pa_*`). Drives weekly `sharedAthleteId` plane. */
  activeAthleteId: string | null | undefined;
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

function findLinkedKidBySharedAthleteId(
  kids: KidsById,
  normalizedAthleteId: string,
): { key: string; row: KidsById[string] } | null {
  if (!normalizedAthleteId) return null;
  for (const key of Object.keys(kids)) {
    const row = kids[key];
    if (!row || typeof row !== "object") continue;
    const sid = normalizeId(row.sharedAthleteId);
    if (sid === normalizedAthleteId) {
      const kidKey = normalizeId(row.id) || key.trim();
      if (kidKey) return { key: kidKey, row };
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
    const sharedAthleteId = normalizeId(input.activeAthleteId);
    if (!sharedAthleteId) {
      return {
        status: "no_athlete",
        kidId: null,
        sharedAthleteId: null,
        weeklyDoc: null,
      };
    }

    const kids = safeKidsById(input.kidsById);
    const linked = findLinkedKidBySharedAthleteId(kids, sharedAthleteId);
    const kidId = linked ? normalizeId(linked.key) : null;

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
