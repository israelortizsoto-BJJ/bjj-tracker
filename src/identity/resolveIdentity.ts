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

    const weeklyDoc = resolveWeeklyDoc(session, sharedAthleteId);
    if (!weeklyDoc) {
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
      weeklyDoc,
    };
  } catch {
    return { ...loadingState };
  }
}
