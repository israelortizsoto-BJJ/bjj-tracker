import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDeviceRole } from "../deviceRole/DeviceRoleProvider";
import {
  buildAthleteAuthoritySnapshot,
  linkedKidIdForParentAthlete,
  traceAthleteAuthoritySnapshotDev,
} from "../identity/buildAthleteAuthoritySnapshot";
import { logAuthorityTelemetryDev, takeDevAuthorityRepoFetchOrdinal } from "../identity/authorityTelemetry";
import { setLineageIntegrityTraceContext } from "../identity/athleteLineageTrace";
import { runLineageIntegrityScan } from "../identity/lineageIntegrityDetection";
import { logCoachHydrationResolveTrace } from "../identity/coachHydrationResolveTrace";
import { logHydrationPipelineWatchAthletes, namesByIdFromParentAthletes } from "../identity/hydrationPipelineTrace";
import type {
  AthleteAuthorityBootstrapState,
  AthleteAuthoritySnapshot,
  AuthoritySnapshotSourceTrigger,
} from "../identity/types";
import {
  setActiveAthleteId,
  subscribeActiveAthleteChanges,
  type ParentAthlete,
} from "../storage/athleteStore";
import { useCoachSyncHydrationVersion } from "../storage/coachSyncHydrationStore";
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

type FetchIdentitySnapshotOptions = {
  skipCoachWriterSessionRefresh?: boolean;
};

/** Coalesce reactive rebuilds across multiple `useActiveAthlete` hook instances. */
let reactiveSnapshotFetchInFlight: Promise<FetchSnapshotResult> | null = null;

/** Last coach sync version applied module-wide (reconcile already ran before the bump). */
let coachSyncHydrationVersionHandled = 0;

function authoritySnapshotApplyDigest(
  snap: AthleteAuthoritySnapshot,
  idToApply: string,
): string {
  const kidSig = Object.keys(snap.loadedKids)
    .sort()
    .map((kidId) => {
      const k = snap.loadedKids[kidId];
      return `${kidId}:${(k?.sharedAthleteId ?? "").trim()}`;
    })
    .join("|");
  return [
    snap.authorityBootstrapState,
    idToApply.trim(),
    snap.sorted.map((a) => a.id.trim()).join(","),
    snap.operatingAthleteRoster.map((a) => a.id.trim()).join(","),
    snap.coachOperatingAthleteChoices.map((a) => a.id.trim()).join(","),
    kidSig,
  ].join(";");
}

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
    case "coach_sync_hydration":
      return { source: "hydration", reason: "coach_sync_hydration" };
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
  const { role, loading: roleLoading } = useDeviceRole();
  const coachSyncHydrationVersion = useCoachSyncHydrationVersion();
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
  const roleLoadingRef = useRef(roleLoading);
  roleLoadingRef.current = roleLoading;
  const prevCoachSyncHydrationVersionRef = useRef(coachSyncHydrationVersion);
  const lastAppliedDigestRef = useRef("");
  const roleRef = useRef(role);
  roleRef.current = role;

  const applyStorageSnapshot = useCallback(
    (
      snap: AthleteAuthoritySnapshot,
      parentRole: typeof role,
      fetchCtx: { fetchParallelDepth: number; repoFetchOrdinal: number },
    ) => {
      if (roleLoadingRef.current) {
        return;
      }

      let idToApply = typeof snap.resolvedId === "string" ? snap.resolvedId.trim() : "";
      const rosterRejectsResolved =
        Boolean(idToApply) &&
        !snap.operatingAthleteRoster.some((a) => a.id.trim() === idToApply);
      if (rosterRejectsResolved) {
        if (__DEV__) {
          console.warn(
            "[authority] snapshot resolvedId absent from operatingAthleteRoster — rejecting OAI",
            { idToApply, rosterIds: snap.operatingAthleteRoster.map((a) => a.id) },
          );
          logCoachHydrationResolveTrace("active_athlete_apply", {
            sharedAthleteId: idToApply,
            resolvedAthleteId: snap.resolvedId.trim() || null,
            authorityBootstrapState: snap.authorityBootstrapState,
            authorityWinner: "rejected_by_operating_roster_guard",
            projectionExists: snap.sorted.some((a) => a.id.trim() === idToApply),
            coachProjectionExists: snap.operatingAthleteRoster.length > 0,
            hydrateRejectionReason: "resolvedId_not_in_operatingAthleteRoster",
            nullReturnReason: "cleared_active_operating_athlete_id",
            athleteSourceMap: Object.fromEntries(
              snap.operatingAthleteRoster.map((a) => [a.id.trim(), "operating_roster"]),
            ),
          });
        }
        idToApply = "";
      }

      const soleOperatingAthleteId =
        snap.operatingAthleteRoster.length === 1
          ? snap.operatingAthleteRoster[0]?.id.trim() ?? ""
          : "";
      const shouldRepairToSoleOperatingAthlete =
        Boolean(soleOperatingAthleteId) &&
        snap.authorityBootstrapState === "ready" &&
        (!idToApply || rosterRejectsResolved);
      if (shouldRepairToSoleOperatingAthlete) {
        if (__DEV__ && rosterRejectsResolved) {
          logCoachHydrationResolveTrace("active_athlete_apply", {
            sharedAthleteId: soleOperatingAthleteId,
            resolvedAthleteId: snap.resolvedId.trim() || null,
            authorityBootstrapState: snap.authorityBootstrapState,
            authorityWinner: "sole_operating_roster_repair",
            projectionExists: snap.sorted.some((a) => a.id.trim() === soleOperatingAthleteId),
            coachProjectionExists: snap.operatingAthleteRoster.length > 0,
            hydrateRejectionReason: "resolvedId_not_in_operatingAthleteRoster",
            nullReturnReason: null,
          });
        }
        if (soleOperatingAthleteId !== idToApply) {
          void setActiveAthleteId(soleOperatingAthleteId);
        }
        idToApply = soleOperatingAthleteId;
      }

      const incomingGen = snap.meta?.snapshotGeneration ?? 0;
      const prevApplied = lastAppliedSnapshotGenerationRef.current;
      const staleGenerationApply =
        incomingGen > 0 && prevApplied > 0 && incomingGen < prevApplied;
      if (staleGenerationApply) {
        if (__DEV__) {
          logAuthorityTelemetryDev({
            category: "hydration",
            event: "hydration_skipped",
            hydrationPhase: "apply_suppressed",
            snapshotGeneration: incomingGen,
            previousSnapshotGeneration: prevApplied,
            triggerSource: snap.meta?.sourceTrigger,
            transitionReason: "stale_snapshot_generation",
          });
        }
        setHydrationReady(true);
        return;
      }

      const applyDigest = authoritySnapshotApplyDigest(snap, idToApply);
      if (applyDigest === lastAppliedDigestRef.current) {
        if (__DEV__) {
          logAuthorityTelemetryDev({
            category: "hydration",
            event: "hydration_skipped",
            hydrationPhase: "apply_suppressed",
            snapshotGeneration: incomingGen || undefined,
            triggerSource: snap.meta?.sourceTrigger,
            transitionReason: "snapshot_digest_unchanged",
          });
        }
        setHydrationReady(true);
        return;
      }
      const linkedAfterApply = linkedKidIdForParentAthlete(snap.loadedKids, idToApply);
      if (__DEV__ && parentRole === "coach") {
        const kid =
          idToApply != null && idToApply !== ""
            ? Object.values(snap.loadedKids).find(
                (k) => (k?.sharedAthleteId ?? "").trim() === idToApply,
              )
            : undefined;
        logCoachHydrationResolveTrace("coach_athlete_lookup", {
          sharedAthleteId: idToApply || null,
          resolvedAthleteId: snap.resolvedId.trim() || null,
          storedActiveAthleteId: idToApply || null,
          authorityBootstrapState: snap.authorityBootstrapState,
          linkedKidId: linkedAfterApply,
          inviteId: kid?.sharedFromInviteTokenNorm?.trim() || null,
          projectionExists: Boolean(
            idToApply && snap.sorted.some((a) => a.id.trim() === idToApply),
          ),
          coachProjectionExists: snap.operatingAthleteRoster.length > 0,
          sessionAthleteId: idToApply || null,
        });
        logCoachHydrationResolveTrace("summary_resolve", {
          sharedAthleteId: idToApply || null,
          resolvedAthleteId: snap.resolvedId.trim() || null,
          authorityBootstrapState: snap.authorityBootstrapState,
          linkedKidId: linkedAfterApply,
          nullReturnReason: idToApply ? null : "empty_operating_athlete_after_apply",
        });
      }

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
        setLineageIntegrityTraceContext({
          role: parentRole,
          activeOperatingAthleteId: idToApply || null,
          parentAthletes: snap.sorted,
          operatingAthleteRoster: snap.operatingAthleteRoster,
          kidsById: snap.loadedKids,
        });
        runLineageIntegrityScan({
          route: "useActiveAthlete.applyStorageSnapshot",
          role: parentRole,
          activeOperatingAthleteId: idToApply || null,
          parentAthletes: snap.sorted,
          operatingAthleteRoster: snap.operatingAthleteRoster,
          kidsById: snap.loadedKids,
        });
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

      lastAppliedDigestRef.current = applyDigest;

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
    async (
      sourceTrigger: AuthoritySnapshotSourceTrigger,
      fetchOpts?: FetchIdentitySnapshotOptions,
    ): Promise<FetchSnapshotResult> => {
      const skipCoachWriterSessionRefresh = fetchOpts?.skipCoachWriterSessionRefresh === true;
      const runFetch = async (): Promise<FetchSnapshotResult> => {
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
            skipCoachWriterSessionRefresh,
          });
        }
        try {
          const snap = await buildAthleteAuthoritySnapshot({
            parentRole: role,
            skipCoachWriterSessionRefresh,
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
              skipCoachWriterSessionRefresh,
            });
          }
          return { snap, fetchParallelDepth: depthAtStart, repoFetchOrdinal };
        } finally {
          if (__DEV__) {
            parallelHydrationRef.current -= 1;
          }
        }
      };

      if (skipCoachWriterSessionRefresh) {
        if (reactiveSnapshotFetchInFlight) {
          return reactiveSnapshotFetchInFlight;
        }
        const promise = runFetch();
        reactiveSnapshotFetchInFlight = promise;
        try {
          return await promise;
        } finally {
          if (reactiveSnapshotFetchInFlight === promise) {
            reactiveSnapshotFetchInFlight = null;
          }
        }
      }

      return runFetch();
    },
    [role],
  );

  useFocusEffect(
    useCallback(() => {
      if (roleLoadingRef.current) {
        return;
      }

      let cancelled = false;
      void (async () => {
        const { snap, fetchParallelDepth, repoFetchOrdinal } =
          await fetchIdentitySnapshot("focus_effect");
        if (cancelled || roleLoadingRef.current) {
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
        applyStorageSnapshot(snap, roleRef.current, { fetchParallelDepth, repoFetchOrdinal });
      })();

      return () => {
        cancelled = true;
      };
    }, [applyStorageSnapshot, fetchIdentitySnapshot]),
  );

  useEffect(() => {
    if (role !== "coach") {
      prevCoachSyncHydrationVersionRef.current = coachSyncHydrationVersion;
      return;
    }

    if (!hydrationReady) {
      prevCoachSyncHydrationVersionRef.current = coachSyncHydrationVersion;
      return;
    }

    if (prevCoachSyncHydrationVersionRef.current === coachSyncHydrationVersion) {
      return;
    }
    if (coachSyncHydrationVersionHandled === coachSyncHydrationVersion) {
      prevCoachSyncHydrationVersionRef.current = coachSyncHydrationVersion;
      return;
    }
    prevCoachSyncHydrationVersionRef.current = coachSyncHydrationVersion;

    let cancelled = false;
    void (async () => {
      const targetVersion = coachSyncHydrationVersion;
      const { snap, fetchParallelDepth, repoFetchOrdinal } = await fetchIdentitySnapshot(
        "coach_sync_hydration",
        { skipCoachWriterSessionRefresh: true },
      );
      if (cancelled || roleLoadingRef.current) return;
      applyStorageSnapshot(snap, roleRef.current, { fetchParallelDepth, repoFetchOrdinal });
      coachSyncHydrationVersionHandled = targetVersion;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyStorageSnapshot,
    coachSyncHydrationVersion,
    fetchIdentitySnapshot,
    hydrationReady,
    role,
  ]);

  useEffect(() => {
    return subscribeActiveAthleteChanges(() => {
      if (roleLoadingRef.current) return;
      void (async () => {
        const { snap, fetchParallelDepth, repoFetchOrdinal } = await fetchIdentitySnapshot(
          "active_athlete_store_subscription",
          { skipCoachWriterSessionRefresh: true },
        );
        if (roleLoadingRef.current) return;
        applyStorageSnapshot(snap, roleRef.current, { fetchParallelDepth, repoFetchOrdinal });
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
    if (roleLoadingRef.current) return;
    const { snap, fetchParallelDepth, repoFetchOrdinal } =
      await fetchIdentitySnapshot("soft_refresh");
    if (roleLoadingRef.current) return;
    applyStorageSnapshot(snap, roleRef.current, { fetchParallelDepth, repoFetchOrdinal });
  }, [applyStorageSnapshot, fetchIdentitySnapshot]);

  const consumerHydrationReady = hydrationReady && !roleLoading;

  return {
    hydrationReady: consumerHydrationReady,
    authorityBootstrapState: consumerHydrationReady ? authorityBootstrapState : undefined,
    coachOperatingAthleteChoices: consumerHydrationReady ? coachOperatingAthleteChoices : [],
    athleteId: resolvedAthleteId,
    athlete,
    operatingAthleteRoster: consumerHydrationReady ? operatingAthleteRoster : [],
    athletes,
    linkedKidId,
    kidsById,
    refreshActiveAthleteAuthority,
  };
}
