import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDeviceRole } from "../deviceRole/DeviceRoleProvider";
import {
  getActiveAthleteId,
  getAthletes,
  subscribeActiveAthleteChanges,
  type ParentAthlete,
} from "../storage/athleteStore";
import { getKidsById } from "../storage/coachKidStore";
import { clearActiveKidId, setActiveKidId } from "../state/activeKidStore";
import type { KidsById } from "../types/coachKid";

export type UseActiveAthleteResult = {
  hydrationReady: boolean;
  athleteId: string;
  athlete: ParentAthlete | null;
  athletes: ParentAthlete[];
  linkedKidId: string | null;
  kidsById: KidsById;
};

export function linkedKidIdForParentAthlete(
  kidsById: KidsById,
  athleteId: string,
): string | null {
  const aid = typeof athleteId === "string" ? athleteId.trim() : "";
  if (!aid) return null;
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if ((k.sharedAthleteId ?? "").trim() === aid) return k.id;
  }
  return null;
}

/**
 * Parent identity: `athleteStore` is source of truth; `linkedKidId` is the coach roster row when linked.
 */
export function useActiveAthlete(): UseActiveAthleteResult {
  const { role } = useDeviceRole();
  const [hydrationReady, setHydrationReady] = useState(false);
  const [athletes, setAthletes] = useState<ParentAthlete[]>([]);
  const [athleteId, setAthleteIdState] = useState("");
  const [kidsById, setKidsById] = useState<KidsById>({});
  const lastKnownAthleteIdRef = useRef<string | null>(null);

  const applyStorageSnapshot = useCallback(
    (
      sorted: ParentAthlete[],
      resolvedId: string,
      loadedKids: KidsById,
      parentRole: typeof role,
    ) => {
      let idToApply = typeof resolvedId === "string" ? resolvedId.trim() : "";
      const fallbackRaw = lastKnownAthleteIdRef.current;
      const fallback =
        typeof fallbackRaw === "string" && fallbackRaw.trim() !== ""
          ? fallbackRaw.trim()
          : "";

      if (!idToApply && fallback && sorted.some((a) => a.id === fallback)) {
        if (__DEV__) {
          console.warn("⚠️ Ignoring empty athleteId transition");
        }
        idToApply = fallback;
      }

      lastKnownAthleteIdRef.current = idToApply ? idToApply : null;

      if (__DEV__) {
        const lk = linkedKidIdForParentAthlete(loadedKids, idToApply);
        console.log("[IDENTITY FLOW] athleteId", idToApply || "(none)");
        console.log("[IDENTITY FLOW] kidId (nullable)", lk ?? "(none)");
      }

      setAthletes(sorted);
      setKidsById(loadedKids);
      setAthleteIdState(idToApply);

      if (parentRole === "parent") {
        const lk = linkedKidIdForParentAthlete(loadedKids, idToApply);
        if (lk) setActiveKidId(lk);
        else clearActiveKidId();
      }

      setHydrationReady(true);
    },
    [],
  );

  const fetchIdentitySnapshot = useCallback(async () => {
    const [list, storedId, loadedKids] = await Promise.all([
      getAthletes(),
      getActiveAthleteId(),
      getKidsById(),
    ]);

    const sorted = [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );

    const activeExists = storedId != null && sorted.some((a) => a.id === storedId);
    const resolvedId = activeExists && storedId ? storedId.trim() : "";

    return { sorted, resolvedId, loadedKids };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const snap = await fetchIdentitySnapshot();
        if (cancelled) return;
        applyStorageSnapshot(snap.sorted, snap.resolvedId, snap.loadedKids, role);
      })();

      return () => {
        cancelled = true;
      };
    }, [applyStorageSnapshot, fetchIdentitySnapshot, role]),
  );

  useEffect(() => {
    return subscribeActiveAthleteChanges(() => {
      void (async () => {
        const snap = await fetchIdentitySnapshot();
        applyStorageSnapshot(snap.sorted, snap.resolvedId, snap.loadedKids, role);
      })();
    });
  }, [applyStorageSnapshot, fetchIdentitySnapshot, role]);

  const resolvedAthleteId =
    athleteId.trim() ||
    (typeof lastKnownAthleteIdRef.current === "string"
      ? lastKnownAthleteIdRef.current.trim()
      : "");

  const athlete = useMemo(
    () => athletes.find((a) => a.id === resolvedAthleteId) ?? null,
    [athletes, resolvedAthleteId],
  );

  const linkedKidId = useMemo(
    () =>
      resolvedAthleteId
        ? linkedKidIdForParentAthlete(kidsById, resolvedAthleteId)
        : null,
    [kidsById, resolvedAthleteId],
  );

  return {
    hydrationReady,
    athleteId: resolvedAthleteId,
    athlete,
    athletes,
    linkedKidId,
    kidsById,
  };
}
