import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDeviceRole } from "../deviceRole/DeviceRoleProvider";
import {
  buildAthleteAuthoritySnapshot,
  linkedKidIdForParentAthlete,
  traceAthleteAuthoritySnapshotDev,
} from "../identity/buildAthleteAuthoritySnapshot";
import { logAuthorityTelemetryDev, takeDevAuthorityRepoFetchOrdinal } from "../identity/authorityTelemetry";
import { logHydrationPipelineWatchAthletes, namesByIdFromParentAthletes } from "../identity/hydrationPipelineTrace";
import type {
  AthleteAuthorityBootstrapState,
  AthleteAuthoritySnapshot,
  AuthoritySnapshotSourceTrigger,
} from "../identity/types";
import {
  subscribeActiveAthleteChanges,
  type ParentAthlete,
} from "../storage/athleteStore";
import { clearActiveKidId, setActiveKidId } from "../state/activeKidStore";
import type { KidsById } from "../types/coachKid";

export type { AthleteAuthorityBootstrapState } from "../identity/types";

export type UseActiveAthleteResult = {
  hydrationReady: boolean;
  /**
   * Set when `hydrationReady` is true. Distinguishes empty vs multi-athlete unresolved vs coach network-degraded bootstrap.
   */
  authorityBootstrapState: AthleteAuthorityBootstrapState | undefined;
  /** Coach: linked `ParentAthlete` rows the user may pick when bootstrap is unresolved or after a failed sync refresh. */
  coachOperatingAthleteChoices: ParentAthlete[];
  athleteId: string;
  athlete: ParentAthlete | null;
  /**
   * LAAG-derived operating membership for UI surfaces (Summary switcher, multi-athlete pickers).
   * Prefer this over `athletes` for roster visibility.
   */
  operatingAthleteRoster: ParentAthlete[];
  /**
   * Raw `parentAthletes` storage projection. Do not use for operating roster membership UI.
   * @deprecated Use `operatingAthleteRoster` for switcher / membership cardinality.
   */
  athletes: ParentAthlete[];
  linkedKidId: string | null;
  kidsById: KidsById;
  /**
   * User-triggered hydration refresh (e.g. Summary pull-to-refresh).
   * Runs `buildAthleteAuthoritySnapshot` with `soft_refresh` trigger — coach reconcile
   * stays inside authority build; parent path does not reconcile coach writer sessions.
   */
  refreshActiveAthleteAuthority: () => Promise<void>;
};

type FetchSnapshotResult = {
  snap: AthleteAuthoritySnapshot;
  fetchParallelDepth: number;
  repoFetchOrdinal: number;
};

function athleteTraceStoreSourceReason(
  trigger: AuthoritySnapshotSourceTrigger | undefined,
): { source: string; reason: string } {
  switch (trigger) {
    case "focus_effect":
      return { source: "hydration", reason: "focus_effect" };
    case "active_athlete_store_subscription":
      return { source: "session_restore", reason: "active_athlete_store_subscription" };
    case "soft_refresh":
      return { source: "hydration", reason: "soft_refresh" };
    default:
      return {
        source: "fallback_resolution",
        reason: trigger != null && trigger !== "" ? String(trigger) : "unknown",
      };
  }
}

export { linkedKidIdForParentAthlete } from "../identity/buildAthleteAuthoritySnapshot";
export type { LinkedKidForParentAthleteOptions } from "../identity/buildAthleteAuthoritySnapshot";

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
  const [operatingAthleteRoster, setOperatingAthleteRoster] = useState<ParentAthlete[]>([]);
  const [athleteId, setAthleteIdState] = useState("");
  const [kidsById, setKidsById] = useState<KidsById>({});
  const prevBootstrapLabelRef = useRef<string | null>(null);
  const snapshotGenerationRef = useRef(0);
  const lastAppliedSnapshotGenerationRef = useRef(0);
  const parallelHydrationRef = useRef(0);
  const storeTracePrevAthleteIdRef = useRef<string | null>(null);

  const applyStorageSnapshot = useCallback(
    (
      snap: AthleteAuthoritySnapshot,
      parentRole: typeof role,
      fetchCtx: { fetchParallelDepth: number; repoFetchOrdinal: number },
    ) => {
      let idToApply = typeof snap.resolvedId === "string" ? snap.resolvedId.trim() : "";
      if (
        idToApply &&
        !snap.operatingAthleteRoster.some((a) => a.id.trim() === idToApply)
      ) {
        if (__DEV__) {
          console.warn(
            "[authority] snapshot resolvedId absent from operatingAthleteRoster — rejecting OAI",
            { idToApply, rosterIds: snap.operatingAthleteRoster.map((a) => a.id) },
          );
        }
        idToApply = "";
      }

      const incomingGen = snap.meta?.snapshotGeneration ?? 0;
      const prevApplied = lastAppliedSnapshotGenerationRef.current;
      const staleGenerationApply =
        __DEV__ && incomingGen > 0 && prevApplied > 0 && incomingGen < prevApplied;
      const linkedAfterApply = linkedKidIdForParentAthlete(snap.loadedKids, idToApply);

      const prevTraceId = storeTracePrevAthleteIdRef.current;
      const prevAthleteIdNorm =
        prevTraceId && prevTraceId.trim() ? prevTraceId.trim() : null;
      const nextAthleteIdNorm = idToApply.trim() ? idToApply.trim() : null;
      if (prevAthleteIdNorm !== nextAthleteIdNorm) {
        const { source, reason } = athleteTraceStoreSourceReason(snap.meta?.sourceTrigger);
        const nameRow = nextAthleteIdNorm
          ? (snap.operatingAthleteRoster.find((a) => a.id.trim() === nextAthleteIdNorm) ??
            snap.sorted.find((a) => a.id.trim() === nextAthleteIdNorm))
          : undefined;
        console.log("[ATHLETE TRACE][STORE UPDATE]", {
          source,
          reason,
          athleteName: nameRow?.name?.trim() || null,
          selectedAthleteId: nextAthleteIdNorm,
          sharedAthleteId: nextAthleteIdNorm,
          linkedKidId: linkedAfterApply,
          previousAthleteId: prevAthleteIdNorm,
          nextAthleteId: nextAthleteIdNorm,
        });
      }
      storeTracePrevAthleteIdRef.current = nextAthleteIdNorm;

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
        traceAthleteAuthoritySnapshotDev({
          hydrationPhase: "apply",
          snapshot: snap,
          appliedResolvedAthleteId: idToApply,
          previousSnapshotGeneration: prevApplied,
          staleGenerationApply,
          parallelHydrationDepth: fetchCtx.fetchParallelDepth,
          repoFetchOrdinal: fetchCtx.repoFetchOrdinal,
        });
        logAuthorityTelemetryDev({
          category: "hydration",
          event: "hydration_snapshot_applied",
          hydrationPhase: "apply_complete",
          snapshotGeneration: incomingGen || undefined,
          previousSnapshotGeneration: prevApplied || undefined,
          parentSnapshotGeneration: prevApplied || undefined,
          triggerSource: snap.meta?.sourceTrigger,
          authorityStatus: snap.authorityBootstrapState,
          athleteId: idToApply || null,
          linkedKidId: linkedAfterApply,
          role: snap.meta?.role ?? parentRole,
          staleSuppressed: false,
          staleGenerationApply,
          parallelHydrationDepth: fetchCtx.fetchParallelDepth,
          repoFetchOrdinal: fetchCtx.repoFetchOrdinal,
        });
        logAuthorityTelemetryDev({
          category: "generation",
          event: "generation_apply_committed",
          snapshotGeneration: incomingGen || undefined,
          previousSnapshotGeneration: prevApplied || undefined,
          triggerSource: snap.meta?.sourceTrigger,
          staleGenerationApply,
          parallelHydrationDepth: fetchCtx.fetchParallelDepth,
          repoFetchOrdinal: fetchCtx.repoFetchOrdinal,
        });
        if (incomingGen > 0) {
          lastAppliedSnapshotGenerationRef.current = incomingGen;
        }
      }

      if (__DEV__) {
        logHydrationPipelineWatchAthletes({
          stage: "9_active_athlete_resolution",
          sourceSubsystem: "useActiveAthlete.applyStorageSnapshot",
          dataOrigin: "derived",
          kidsById: snap.loadedKids,
          presentAthleteIds: idToApply ? new Set([idToApply]) : new Set(),
          renderedAthleteIds: idToApply ? new Set([idToApply]) : new Set(),
          namesById: namesByIdFromParentAthletes(snap.sorted),
          allAthleteIdsInStage: snap.operatingAthleteRoster.map((a) => a.id),
          stageMeta: {
            role: parentRole,
            authorityBootstrapState: snap.authorityBootstrapState,
            linkedKidId: linkedAfterApply,
            staleGenerationApply,
          },
        });
      }

      setAthletes(snap.sorted);
      setOperatingAthleteRoster(snap.operatingAthleteRoster);
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

  const fetchIdentitySnapshot = useCallback(
    async (sourceTrigger: AuthoritySnapshotSourceTrigger): Promise<FetchSnapshotResult> => {
      const repoFetchOrdinal = takeDevAuthorityRepoFetchOrdinal();
      let depthAtStart = 0;
      let gen = 0;
      if (__DEV__) {
        snapshotGenerationRef.current += 1;
        gen = snapshotGenerationRef.current;
        parallelHydrationRef.current += 1;
        depthAtStart = parallelHydrationRef.current;
        const parentGen = lastAppliedSnapshotGenerationRef.current;
        logAuthorityTelemetryDev({
          category: "hydration",
          event: "hydration_fetch_started",
          hydrationPhase: "fetch_start",
          snapshotGeneration: gen,
          parentSnapshotGeneration: parentGen,
          triggerSource: sourceTrigger,
          role,
          parallelHydrationDepth: depthAtStart,
          repoFetchOrdinal,
        });
      }
      try {
        const snap = await buildAthleteAuthoritySnapshot({
          parentRole: role,
          observability: __DEV__
            ? {
                snapshotGeneration: gen,
                sourceTrigger,
                role,
              }
            : undefined,
        });
        if (__DEV__) {
          const parentGen = lastAppliedSnapshotGenerationRef.current;
          traceAthleteAuthoritySnapshotDev({
            hydrationPhase: "build",
            snapshot: snap,
            previousSnapshotGeneration: parentGen,
            parallelHydrationDepth: depthAtStart,
            repoFetchOrdinal,
          });
          logAuthorityTelemetryDev({
            category: "hydration",
            event: "hydration_build_resolved",
            hydrationPhase: "build_complete",
            snapshotGeneration: snap.meta?.snapshotGeneration,
            parentSnapshotGeneration: parentGen,
            triggerSource: sourceTrigger,
            authorityStatus: snap.authorityBootstrapState,
            athleteId: snap.resolvedId.trim() || null,
            role,
            parallelHydrationDepth: depthAtStart,
            repoFetchOrdinal,
          });
        }
        return { snap, fetchParallelDepth: depthAtStart, repoFetchOrdinal };
      } finally {
        if (__DEV__) {
          parallelHydrationRef.current -= 1;
        }
      }
    },
    [role],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const { snap, fetchParallelDepth, repoFetchOrdinal } =
          await fetchIdentitySnapshot("focus_effect");
        if (cancelled) {
          if (__DEV__) {
            const g = snap.meta?.snapshotGeneration;
            logAuthorityTelemetryDev({
              category: "hydration",
              event: "hydration_skipped",
              hydrationPhase: "cancelled",
              snapshotGeneration: g,
              triggerSource: "focus_effect",
              transitionReason: "snapshot_ready_but_focus_lost_before_apply",
              authorityStatus: snap.authorityBootstrapState,
              repoFetchOrdinal,
            });
            logAuthorityTelemetryDev({
              category: "hydration",
              event: "snapshot_ignored",
              snapshotGeneration: g,
              triggerSource: "focus_effect",
              transitionReason: "focus_cleanup_race",
              repoFetchOrdinal,
            });
          }
          return;
        }
        applyStorageSnapshot(snap, role, { fetchParallelDepth, repoFetchOrdinal });
      })();

      return () => {
        cancelled = true;
      };
    }, [applyStorageSnapshot, fetchIdentitySnapshot, role]),
  );

  useEffect(() => {
    return subscribeActiveAthleteChanges(() => {
      void (async () => {
        const { snap, fetchParallelDepth, repoFetchOrdinal } = await fetchIdentitySnapshot(
          "active_athlete_store_subscription",
        );
        applyStorageSnapshot(snap, role, { fetchParallelDepth, repoFetchOrdinal });
      })();
    });
  }, [applyStorageSnapshot, fetchIdentitySnapshot, role]);

  const resolvedAthleteId = athleteId.trim();

  const athlete = useMemo(() => {
    const id = resolvedAthleteId;
    if (!id) return null;
    const rosterRow = operatingAthleteRoster.find((a) => a.id.trim() === id) ?? null;
    if (!rosterRow) return null;
    const overlayRow = athletes.find((a) => a.id.trim() === id);
    /** Roster confirms membership; `sorted` overlays profile-only fields without admitting non-roster ids. */
    return overlayRow ? { ...overlayRow, ...rosterRow } : rosterRow;
  }, [resolvedAthleteId, operatingAthleteRoster, athletes]);

  const linkedKidId = useMemo(
    () =>
      resolvedAthleteId ? linkedKidIdForParentAthlete(kidsById, resolvedAthleteId) : null,
    [kidsById, resolvedAthleteId],
  );

  const refreshActiveAthleteAuthority = useCallback(async () => {
    const { snap, fetchParallelDepth, repoFetchOrdinal } =
      await fetchIdentitySnapshot("soft_refresh");
    applyStorageSnapshot(snap, role, { fetchParallelDepth, repoFetchOrdinal });
  }, [applyStorageSnapshot, fetchIdentitySnapshot, role]);

  return {
    hydrationReady,
    authorityBootstrapState: hydrationReady ? authorityBootstrapState : undefined,
    coachOperatingAthleteChoices: hydrationReady ? coachOperatingAthleteChoices : [],
    athleteId: resolvedAthleteId,
    athlete,
    operatingAthleteRoster: hydrationReady ? operatingAthleteRoster : [],
    athletes,
    linkedKidId,
    kidsById,
    refreshActiveAthleteAuthority,
  };
}
