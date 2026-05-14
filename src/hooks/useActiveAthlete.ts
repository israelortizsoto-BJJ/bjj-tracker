import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDeviceRole } from "../deviceRole/DeviceRoleProvider";
import { isCoachSyncConfigured } from "../config/coachSync";
import {
  ensureOperatingAthletesFromCoachLinkedKids,
  getActiveAthleteId,
  getAthletes,
  setActiveAthleteId,
  subscribeActiveAthleteChanges,
  type ParentAthlete,
} from "../storage/athleteStore";
import {
  getKidsById,
  refreshCoachWriterSessionsAndReconcileStores,
  type CoachWriterSessionRefreshResult,
} from "../storage/coachKidStore";
import { clearActiveKidId, setActiveKidId } from "../state/activeKidStore";
import { isKidCoachArchived, type KidsById } from "../types/coachKid";

export type AthleteAuthorityBootstrapState =
  | "ready"
  | "empty"
  | "coach_unresolved"
  | "coach_disconnected";

export type UseActiveAthleteResult = {
  hydrationReady: boolean;
  /**
   * Set when `hydrationReady` is true. Distinguishes coach roster empty vs unresolved vs network-degraded bootstrap.
   */
  authorityBootstrapState: AthleteAuthorityBootstrapState | undefined;
  /** Coach: linked `ParentAthlete` rows the user may pick when bootstrap is unresolved or after a failed sync refresh. */
  coachOperatingAthleteChoices: ParentAthlete[];
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

function coachLinkedSharedAthleteIdSet(kidsById: KidsById): Set<string> {
  const ids = new Set<string>();
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (sid) ids.add(sid);
  }
  return ids;
}

type IdentitySnapshot = {
  sorted: ParentAthlete[];
  resolvedId: string;
  loadedKids: KidsById;
  authorityBootstrapState: AthleteAuthorityBootstrapState;
  coachOperatingAthleteChoices: ParentAthlete[];
};

/**
 * Parent identity: `athleteStore` is source of truth; `linkedKidId` is the coach roster row when linked.
 */
export function useActiveAthlete(): UseActiveAthleteResult {
  const { role } = useDeviceRole();
  const [hydrationReady, setHydrationReady] = useState(false);
  const [authorityBootstrapState, setAuthorityBootstrapState] = useState<
    AthleteAuthorityBootstrapState | undefined
  >(undefined);
  const [coachOperatingAthleteChoices, setCoachOperatingAthleteChoices] = useState<ParentAthlete[]>(
    [],
  );
  const [athletes, setAthletes] = useState<ParentAthlete[]>([]);
  const [athleteId, setAthleteIdState] = useState("");
  const [kidsById, setKidsById] = useState<KidsById>({});
  const lastKnownAthleteIdRef = useRef<string | null>(null);
  const prevBootstrapLabelRef = useRef<string | null>(null);

  const applyStorageSnapshot = useCallback(
    (
      snap: IdentitySnapshot,
      parentRole: typeof role,
    ) => {
      let idToApply = typeof snap.resolvedId === "string" ? snap.resolvedId.trim() : "";
      const fallbackRaw = lastKnownAthleteIdRef.current;
      const fallback =
        typeof fallbackRaw === "string" && fallbackRaw.trim() !== ""
          ? fallbackRaw.trim()
          : "";

      const suppressLastKnownFallback =
        snap.authorityBootstrapState === "coach_unresolved" ||
        (snap.authorityBootstrapState === "coach_disconnected" &&
          snap.coachOperatingAthleteChoices.length > 0);

      if (suppressLastKnownFallback) {
        lastKnownAthleteIdRef.current = null;
      } else if (!idToApply && fallback && snap.sorted.some((a) => a.id === fallback)) {
        if (__DEV__) {
          // TEMP Phase 2 bootstrap stabilization
          console.warn("[coach-bootstrap] ignoring empty athleteId transition (single-gen guard)");
        }
        idToApply = fallback;
      }

      lastKnownAthleteIdRef.current = idToApply ? idToApply : null;

      if (__DEV__) {
        const label = `${snap.authorityBootstrapState}:${idToApply || "none"}:choices=${snap.coachOperatingAthleteChoices.length}`;
        if (prevBootstrapLabelRef.current !== label) {
          prevBootstrapLabelRef.current = label;
          // TEMP Phase 2 bootstrap stabilization
          console.log("[coach-bootstrap] state transition", {
            role: parentRole,
            authorityBootstrapState: snap.authorityBootstrapState,
            resolvedId: idToApply || null,
            choiceCount: snap.coachOperatingAthleteChoices.length,
          });
        }
      }

      setAthletes(snap.sorted);
      setKidsById(snap.loadedKids);
      setAthleteIdState(idToApply);
      setAuthorityBootstrapState(snap.authorityBootstrapState);
      setCoachOperatingAthleteChoices(snap.coachOperatingAthleteChoices);

      if (parentRole === "parent") {
        const lk = linkedKidIdForParentAthlete(snap.loadedKids, idToApply);
        if (lk) setActiveKidId(lk);
        else clearActiveKidId();
      }

      setHydrationReady(true);
    },
    [],
  );

  const buildIdentitySnapshot = useCallback(
    async (parentRole: typeof role): Promise<IdentitySnapshot> => {
      const refreshResult: CoachWriterSessionRefreshResult =
        parentRole === "coach"
          ? await refreshCoachWriterSessionsAndReconcileStores()
          : { successfulSnapshots: [], writerLinks: [], inviteSessionAthletesByToken: {} };

      const loadedKids = await getKidsById();

      if (parentRole === "coach") {
        await ensureOperatingAthletesFromCoachLinkedKids(loadedKids);
      }

      const [list, storedRaw] = await Promise.all([
        getAthletes(),
        getActiveAthleteId(),
      ]);

      const sorted = [...list].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );

      const storedNorm = (storedRaw ?? "").trim();
      const linkedIdSet = coachLinkedSharedAthleteIdSet(loadedKids);
      const linkedAthletes = sorted.filter((a) => linkedIdSet.has(a.id));

      const storedInParentList = Boolean(storedNorm && sorted.some((a) => a.id === storedNorm));
      const storedLinkedCoach =
        parentRole === "coach" && storedNorm ? linkedIdSet.has(storedNorm) : false;

      const coachSessionRefreshDegraded =
        parentRole === "coach" &&
        isCoachSyncConfigured() &&
        refreshResult.writerLinks.length > 0 &&
        refreshResult.successfulSnapshots.length === 0;

      let resolvedId = "";
      let authorityBootstrapState: AthleteAuthorityBootstrapState = "ready";
      let coachOperatingAthleteChoices: ParentAthlete[] = [];

      if (parentRole === "parent") {
        if (storedInParentList) {
          resolvedId = storedNorm;
          authorityBootstrapState = "ready";
        } else if (sorted.length === 0) {
          resolvedId = "";
          authorityBootstrapState = "empty";
        } else {
          resolvedId = "";
          authorityBootstrapState = "ready";
        }
      } else {
        if (storedInParentList && storedLinkedCoach) {
          resolvedId = storedNorm;
          authorityBootstrapState = "ready";
        } else if (storedInParentList && !storedLinkedCoach) {
          if (__DEV__) {
            // TEMP Phase 2 bootstrap stabilization
            console.warn("[coach-bootstrap] stored OAI not linked on current roster; holding OAI", {
              storedNorm,
            });
          }
          resolvedId = storedNorm;
          authorityBootstrapState = "ready";
        } else {
          resolvedId = "";

          if (linkedAthletes.length === 0) {
            coachOperatingAthleteChoices = [];
            if (coachSessionRefreshDegraded) {
              authorityBootstrapState = "coach_disconnected";
            } else {
              authorityBootstrapState = "empty";
            }
          } else if (linkedAthletes.length >= 2) {
            authorityBootstrapState = "coach_unresolved";
            coachOperatingAthleteChoices = linkedAthletes;
          } else {
            const only = linkedAthletes[0];
            if (coachSessionRefreshDegraded) {
              authorityBootstrapState = "coach_disconnected";
              coachOperatingAthleteChoices = linkedAthletes;
            } else {
              resolvedId = only.id;
              await setActiveAthleteId(only.id);
              authorityBootstrapState = "ready";
              coachOperatingAthleteChoices = [];
            }
          }
        }
      }

      return {
        sorted,
        resolvedId,
        loadedKids,
        authorityBootstrapState,
        coachOperatingAthleteChoices,
      };
    },
    [],
  );

  const fetchIdentitySnapshot = useCallback(async () => {
    return buildIdentitySnapshot(role);
  }, [buildIdentitySnapshot, role]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const snap = await fetchIdentitySnapshot();
        if (cancelled) return;
        applyStorageSnapshot(snap, role);
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
        applyStorageSnapshot(snap, role);
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
    authorityBootstrapState: hydrationReady ? authorityBootstrapState : undefined,
    coachOperatingAthleteChoices: hydrationReady ? coachOperatingAthleteChoices : [],
    athleteId: resolvedAthleteId,
    athlete,
    athletes,
    linkedKidId,
    kidsById,
  };
}
