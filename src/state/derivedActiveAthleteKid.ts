import { useEffect, useMemo, useState } from "react";

import { getLastAthleteKidId } from "../storage/lastAthleteIdStore";
import type { CoachLink } from "../types/coachShare";
import type { Kid, KidId, KidsById } from "../types/coachKid";

import { getActiveKidId, setActiveKidId, useActiveKidId } from "./activeKidStore";

/** Invite-linked roster kid ids for parent weekly plane (sorted by name); `null` if token missing (use whole roster pool). */
export function eligibleParentWeeklyKidIds(
  kidsById: KidsById,
  _coachLinks: CoachLink[],
  inviteTokenNorm: string,
): string[] | null {
  const norm = typeof inviteTokenNorm === "string" ? inviteTokenNorm.trim() : "";
  if (!norm) return null;
  const rows = Object.values(kidsById)
    .filter(
      (k): k is Kid => Boolean(k?.id) && Boolean((k.sharedAthleteId ?? "").trim()),
    )
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
  return rows.map((k) => k.id);
}

export type DerivedActiveAthleteKidInput = {
  explicitKidId: string | undefined;
  persistedLastKidId: string | null;
  kidsById: KidsById;
  /**
   * If `null`, the pool is all roster ids (name-sorted).
   * If `[]`, there is no eligible athlete.
   * Otherwise restrict to ids that still exist on `kidsById`.
   */
  eligibleKidIds: string[] | null;
};

function sortedRosterKidIds(kidsById: KidsById): KidId[] {
  return Object.values(kidsById)
    .filter((k): k is Kid => Boolean(k?.id))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
    .map((k) => k.id);
}

export function activeAthletePoolKidIds(kidsById: KidsById, eligibleKidIds: string[] | null): KidId[] {
  return resolvePool(eligibleKidIds, kidsById);
}

function resolvePool(eligibleKidIds: string[] | null, kidsById: KidsById): KidId[] {
  if (eligibleKidIds == null) {
    return sortedRosterKidIds(kidsById);
  }
  return eligibleKidIds
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0 && kidsById[id]);
}

/** Deterministic active athlete **roster kid id** (not weekly `sharedAthleteId`). */
export function resolveDerivedActiveAthleteKidId(input: DerivedActiveAthleteKidInput): KidId | null {
  try {
    const kidsById = input.kidsById && typeof input.kidsById === "object" && !Array.isArray(input.kidsById)
      ? input.kidsById
      : {};

    const pool = resolvePool(input.eligibleKidIds, kidsById);
    if (pool.length === 0) return null;

    const ex = typeof input.explicitKidId === "string" ? input.explicitKidId.trim() : "";
    if (ex && pool.includes(ex)) return ex;

    const last =
      typeof input.persistedLastKidId === "string" ? input.persistedLastKidId.trim() : "";
    if (last && pool.includes(last)) return last;

    const fallback = pool[0];
    if (__DEV__ && fallback == null) {
      console.error("[derived-athlete-kid] invariant: non-empty pool but no first id", {
        poolLength: pool.length,
      });
    }
    return fallback ?? null;
  } catch {
    return null;
  }
}

export type DerivedActiveAthleteKidState = {
  kidId: KidId | null;
  /**
   * False until AsyncStorage last-athlete key has been read and `setActiveKidId`
   * has been applied for the resolved kid (when the pool is non-empty).
   */
  persistenceHydrated: boolean;
};

/**
 * Resolves guaranteed **Kid.id** for parent This Week: explicit active store → persisted last → first eligible roster kid.
 */
export function useDerivedActiveAthleteKidId(
  kidsById: KidsById,
  eligibleKidIds: string[] | null,
): DerivedActiveAthleteKidState {
  const explicit = useActiveKidId();
  const [persistReady, setPersistReady] = useState<
    undefined | { lastAthleteKidId: string | null }
  >(undefined);

  /** Sync persisted last-athlete key + active store BEFORE flipping hydration (avoids a “no athlete” frame). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lastAthleteKidId = await getLastAthleteKidId();
      if (cancelled) return;

      const resolved = resolveDerivedActiveAthleteKidId({
        explicitKidId: getActiveKidId(),
        persistedLastKidId: lastAthleteKidId,
        kidsById,
        eligibleKidIds,
      });
      if (resolved) {
        setActiveKidId(resolved);
      }
      if (!cancelled) {
        setPersistReady({ lastAthleteKidId });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kidsById, eligibleKidIds]);

  const persistenceHydrated = persistReady !== undefined;
  const persistedLast = persistReady?.lastAthleteKidId ?? null;

  const kidId = useMemo(
    () =>
      persistenceHydrated
        ? resolveDerivedActiveAthleteKidId({
            explicitKidId: explicit,
            persistedLastKidId: persistedLast,
            kidsById,
            eligibleKidIds,
          })
        : null,
    [explicit, persistedLast, kidsById, eligibleKidIds, persistenceHydrated],
  );

  useEffect(() => {
    if (!persistenceHydrated || !kidId) return;
    if (explicit !== kidId) {
      setActiveKidId(kidId);
    }
  }, [explicit, kidId, persistenceHydrated]);

  return { kidId, persistenceHydrated };
}

