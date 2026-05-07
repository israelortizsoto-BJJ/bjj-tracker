import { useMemo } from "react";

import type { KidsById } from "../types/coachKid";
import type { ParentWeeklySessionSnapshot } from "../coach/resolveWeeklyDoc";

import { resolveIdentity, type IdentityState } from "./resolveIdentity";

export type { IdentityState, IdentityStatus, ResolveIdentityInput, WeeklyDoc } from "./resolveIdentity";

/** Resolves weekly identity from parent `athleteStore` id + snapshot (pure memo). */
export function useIdentity(
  activeAthleteId: string | null | undefined,
  kidsById: KidsById | null | undefined,
  weeklySessionSnapshot: ParentWeeklySessionSnapshot | null | undefined,
): IdentityState {
  return useMemo(
    () =>
      resolveIdentity({
        activeAthleteId,
        kidsById,
        weeklySessionSnapshot,
      }),
    [activeAthleteId, kidsById, weeklySessionSnapshot],
  );
}
