import { useMemo } from "react";

import type { KidsById } from "../types/coachKid";
import type { ParentWeeklySessionSnapshot } from "../coach/resolveWeeklyDoc";
import { useActiveKidId } from "../state/activeKidStore";

import { resolveIdentity, type IdentityState } from "./resolveIdentity";

export type { IdentityState, IdentityStatus, ResolveIdentityInput, WeeklyDoc } from "./resolveIdentity";

/**
 * Subscribes to `useActiveKidId` and resolves identity against the provided
 * `kidsById` and `weeklySessionSnapshot` (caller supplies the latter from its own source of truth).
 */
export function useIdentity(
  kidsById: KidsById | null | undefined,
  weeklySessionSnapshot: ParentWeeklySessionSnapshot | null | undefined,
): IdentityState {
  const activeKidId = useActiveKidId();

  return useMemo(
    () =>
      resolveIdentity({
        activeKidId,
        kidsById,
        weeklySessionSnapshot,
      }),
    [activeKidId, kidsById, weeklySessionSnapshot],
  );
}
