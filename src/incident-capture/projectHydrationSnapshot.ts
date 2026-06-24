import type { AuthoritySnapshotSourceTrigger } from "../identity/types";
import type { CoachWriterSessionRefreshResult } from "../storage/coachKidStore";
import type { DeviceRole } from "../storage/deviceRoleStore";
import type { CoachAnalysisReadinessRecord } from "../domain/competition/coachAnalysisReadinessTypes";

import {
  HYDRATION_SNAPSHOT_CONTRACT_VERSION,
  type HydrationCacheLinkEvidence,
  type HydrationAnalysisReadinessEvidence,
  type HydrationSnapshot,
  type HydrationSnapshotCaptureMode,
  type HydrationTriggerClass,
} from "./hydrationSnapshotContract";

export type ProjectHydrationSnapshotContext = {
  deviceRole: DeviceRole | null;
  syncConfigured: boolean;
  captureMode: HydrationSnapshotCaptureMode;
  hydrationVersion: number;
  lastBumpReason?: string;
  lastBumpAt?: string;
  sourceTrigger?: AuthoritySnapshotSourceTrigger;
  capturedAt?: string;
  writerSessionRefresh?: CoachWriterSessionRefreshResult | null;
  reconcileAttempted?: boolean;
  coachSessionRefreshDegraded?: boolean;
  cacheLinks?: HydrationCacheLinkEvidence[];
  activeLinkCount?: number;
  sessionCachePresentCount?: number;
  parentWeeklyFetchSource?: "cache" | "network" | "none";
  parentOverlayArtifactsPresent?: boolean;
  readOnlyCoachWriterLinkCount?: number;
  readOnlyCoachSessionsFetchedOkCount?: number;
  analysisReadiness?: readonly CoachAnalysisReadinessRecord[];
  currentArtifactStoreUpdatedAtByAthleteId?: Readonly<
    Record<string, string | null>
  >;
};

function projectAnalysisReadiness(
  records: readonly CoachAnalysisReadinessRecord[],
  currentArtifactStoreUpdatedAtByAthleteId: Readonly<
    Record<string, string | null>
  >,
): HydrationAnalysisReadinessEvidence[] {
  return records
    .map((record) => ({
      sharedAthleteId: record.sharedAthleteId,
      state: record.state,
      generation: record.generation,
      startedAt: record.startedAt,
      resolvedAt: record.resolvedAt ?? null,
      hydrationSource:
        record.hydrationSource === "coach_writer_sessions"
          ? ("coach_reconcile" as const)
          : ("parent_session_refresh" as const),
      artifactSetUpdatedAt: record.artifactSetUpdatedAt ?? null,
      currentArtifactStoreUpdatedAt:
        currentArtifactStoreUpdatedAtByAthleteId[
          record.sharedAthleteId
        ] ?? null,
      lastConfirmedState: record.lastConfirmedState ?? null,
      lastConfirmedAt: record.lastConfirmedAt ?? null,
      lastConfirmedArtifactSetUpdatedAt:
        record.lastConfirmedArtifactSetUpdatedAt ?? null,
    }))
    .sort((a, b) => a.sharedAthleteId.localeCompare(b.sharedAthleteId));
}

export function hydrationTriggerClassFromSourceTrigger(
  sourceTrigger?: AuthoritySnapshotSourceTrigger,
): HydrationTriggerClass | undefined {
  if (!sourceTrigger) return undefined;
  switch (sourceTrigger) {
    case "focus_effect":
      return "focus";
    case "soft_refresh":
      return "pull";
    case "active_athlete_store_subscription":
      return "boot";
    case "coach_sync_hydration":
      return "invalidation";
    default:
      if (sourceTrigger === "export") return "export";
      if (sourceTrigger === "save") return "save";
      return "unknown";
  }
}

function coachFieldsFromRefresh(
  refresh: CoachWriterSessionRefreshResult,
  ctx: ProjectHydrationSnapshotContext,
): Pick<
  HydrationSnapshot,
  | "writerLinkCount"
  | "sessionsFetchedOkCount"
  | "allSessionsFetched"
  | "coachSessionRefreshDegraded"
  | "reconcileAttempted"
  | "reconcileCompleted"
  | "earlyExitReason"
  | "skipReconcileReason"
  | "reconcileFinishedAt"
  | "stageRosterCompleted"
  | "stageShellsCompleted"
  | "stageAggregateCompleted"
  | "stageTopologyCompleted"
  | "stageTrainingProofCompleted"
  | "stageBreakdownCompleted"
  | "stageBreakdownPruneCompleted"
> {
  const writerLinkCount = refresh.writerLinks.length;
  const sessionsFetchedOkCount = refresh.successfulSnapshots.length;
  const allSessionsFetched = writerLinkCount > 0 && sessionsFetchedOkCount === writerLinkCount;
  const outcome = refresh.hydrationOutcome;

  const base: Pick<
    HydrationSnapshot,
    | "writerLinkCount"
    | "sessionsFetchedOkCount"
    | "allSessionsFetched"
    | "coachSessionRefreshDegraded"
    | "reconcileAttempted"
    | "reconcileCompleted"
  > = {
    writerLinkCount,
    sessionsFetchedOkCount,
    allSessionsFetched,
    coachSessionRefreshDegraded: ctx.coachSessionRefreshDegraded === true,
    reconcileAttempted: ctx.reconcileAttempted === true,
    reconcileCompleted: outcome.reconcileCompleted,
  };

  if (ctx.captureMode === "read_only_state") {
    return base;
  }

  return {
    ...base,
    ...(outcome.earlyExitReason ? { earlyExitReason: outcome.earlyExitReason } : {}),
    ...(outcome.skipReconcileReason ? { skipReconcileReason: outcome.skipReconcileReason } : {}),
    ...(outcome.reconcileFinishedAt ? { reconcileFinishedAt: outcome.reconcileFinishedAt } : {}),
    ...(outcome.stageRosterCompleted ? { stageRosterCompleted: true } : {}),
    ...(outcome.stageShellsCompleted ? { stageShellsCompleted: true } : {}),
    ...(outcome.stageAggregateCompleted ? { stageAggregateCompleted: true } : {}),
    ...(outcome.stageTopologyCompleted ? { stageTopologyCompleted: true } : {}),
    ...(outcome.stageTrainingProofCompleted ? { stageTrainingProofCompleted: true } : {}),
    ...(outcome.stageBreakdownCompleted ? { stageBreakdownCompleted: true } : {}),
    ...(outcome.stageBreakdownPruneCompleted ? { stageBreakdownPruneCompleted: true } : {}),
  };
}

function readOnlyCoachFetchFields(ctx: ProjectHydrationSnapshotContext): Pick<
  HydrationSnapshot,
  "writerLinkCount" | "sessionsFetchedOkCount" | "allSessionsFetched"
> | null {
  if (ctx.readOnlyCoachWriterLinkCount === undefined) return null;
  const writerLinkCount = ctx.readOnlyCoachWriterLinkCount;
  const sessionsFetchedOkCount = ctx.readOnlyCoachSessionsFetchedOkCount ?? 0;
  return {
    writerLinkCount,
    sessionsFetchedOkCount,
    allSessionsFetched: writerLinkCount > 0 && sessionsFetchedOkCount === writerLinkCount,
  };
}

/** Maps hydration substrate to the frozen Tier 1 export contract. */
export function projectHydrationSnapshot(ctx: ProjectHydrationSnapshotContext): HydrationSnapshot {
  const hydrationTriggerClass = hydrationTriggerClassFromSourceTrigger(ctx.sourceTrigger);
  const bumpFields = {
    ...(ctx.lastBumpReason ? { lastBumpReason: ctx.lastBumpReason } : {}),
    ...(ctx.lastBumpAt ? { lastBumpAt: ctx.lastBumpAt } : {}),
  };
  const triggerFields = {
    ...(ctx.sourceTrigger ? { sourceTrigger: ctx.sourceTrigger } : {}),
    ...(hydrationTriggerClass ? { hydrationTriggerClass } : {}),
  };

  const base: HydrationSnapshot = {
    contractVersion: HYDRATION_SNAPSHOT_CONTRACT_VERSION,
    capturedAt: ctx.capturedAt ?? new Date().toISOString(),
    deviceRole: ctx.deviceRole,
    syncConfigured: ctx.syncConfigured,
    captureMode: ctx.captureMode,
    hydrationVersion: ctx.hydrationVersion,
    analysisReadiness: projectAnalysisReadiness(
      ctx.analysisReadiness ?? [],
      ctx.currentArtifactStoreUpdatedAtByAthleteId ?? {},
    ),
    ...bumpFields,
    ...triggerFields,
  };

  if (ctx.deviceRole === "parent") {
    return {
      ...base,
      ...(ctx.activeLinkCount !== undefined ? { activeLinkCount: ctx.activeLinkCount } : {}),
      ...(ctx.sessionCachePresentCount !== undefined
        ? { sessionCachePresentCount: ctx.sessionCachePresentCount }
        : {}),
      ...(ctx.cacheLinks && ctx.cacheLinks.length > 0 ? { cacheLinks: ctx.cacheLinks } : {}),
      ...(ctx.parentWeeklyFetchSource
        ? { parentWeeklyFetchSource: ctx.parentWeeklyFetchSource }
        : {}),
      ...(ctx.parentOverlayArtifactsPresent !== undefined
        ? { parentOverlayArtifactsPresent: ctx.parentOverlayArtifactsPresent }
        : {}),
      reconcileAttempted: false,
    };
  }

  if (ctx.deviceRole === "coach") {
    const readOnlyFetch = readOnlyCoachFetchFields(ctx);
    if (ctx.captureMode === "shared_authority_reconcile" && ctx.writerSessionRefresh) {
      return {
        ...base,
        ...coachFieldsFromRefresh(ctx.writerSessionRefresh, ctx),
        ...(ctx.cacheLinks && ctx.cacheLinks.length > 0 ? { cacheLinks: ctx.cacheLinks } : {}),
      };
    }

    return {
      ...base,
      ...(readOnlyFetch ?? {}),
      reconcileAttempted: ctx.reconcileAttempted === true,
      ...(ctx.coachSessionRefreshDegraded !== undefined
        ? { coachSessionRefreshDegraded: ctx.coachSessionRefreshDegraded }
        : {}),
      ...(ctx.cacheLinks && ctx.cacheLinks.length > 0 ? { cacheLinks: ctx.cacheLinks } : {}),
    };
  }

  return base;
}
