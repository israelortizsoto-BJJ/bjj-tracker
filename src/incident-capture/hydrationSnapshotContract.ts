import type { DeviceRole } from "../storage/deviceRoleStore";

/** Frozen Tier 1 Hydration Snapshot contract version. */
export const HYDRATION_SNAPSHOT_CONTRACT_VERSION = "1" as const;

export type HydrationSnapshotCaptureMode = "shared_authority_reconcile" | "read_only_state";

export type HydrationTriggerClass =
  | "focus"
  | "pull"
  | "boot"
  | "save"
  | "invalidation"
  | "export"
  | "unknown";

export type HydrationEarlyExitReason = "coachSyncNotConfigured" | "noWriterLinks";

export type HydrationSkipReconcileReason = "writerLinksButNoSuccessfulSessionFetches";

export type HydrationReconcileOutcome = {
  reconcileAttempted: boolean;
  reconcileCompleted: boolean;
  earlyExitReason?: HydrationEarlyExitReason;
  skipReconcileReason?: HydrationSkipReconcileReason;
  reconcileFinishedAt?: string;
  stageRosterCompleted?: boolean;
  stageShellsCompleted?: boolean;
  stageAggregateCompleted?: boolean;
  stageTopologyCompleted?: boolean;
  stageTrainingProofCompleted?: boolean;
  stageBreakdownCompleted?: boolean;
  stageBreakdownPruneCompleted?: boolean;
};

export type HydrationCacheLinkEvidence = {
  linkTokenTail: string;
  fetchedAt: string | null;
  sessionPresent: boolean;
  dataSource?: "network" | "cache" | "none";
};

export type HydrationAnalysisReadinessEvidence = {
  sharedAthleteId: string;
  state: "PENDING" | "READY" | "EMPTY_READY" | "FAILED";
  generation: number;
  startedAt: string;
  resolvedAt: string | null;
  hydrationSource:
    | "coach_reconcile"
    | "parent_session_refresh"
    | "persisted_replay";
  artifactSetUpdatedAt: string | null;
  currentArtifactStoreUpdatedAt: string | null;
  lastConfirmedState: "READY" | "EMPTY_READY" | null;
  lastConfirmedAt: string | null;
  lastConfirmedArtifactSetUpdatedAt: string | null;
};

/** Production-safe, redacted hydration evidence for incident capture (Tier 1). */
export type HydrationSnapshot = {
  contractVersion: typeof HYDRATION_SNAPSHOT_CONTRACT_VERSION;
  capturedAt: string;
  deviceRole: DeviceRole | null;
  syncConfigured: boolean;
  captureMode: HydrationSnapshotCaptureMode;
  hydrationVersion: number;
  writerLinkCount?: number;
  sessionsFetchedOkCount?: number;
  allSessionsFetched?: boolean;
  coachSessionRefreshDegraded?: boolean;
  reconcileAttempted?: boolean;
  reconcileCompleted?: boolean;
  earlyExitReason?: HydrationEarlyExitReason;
  skipReconcileReason?: HydrationSkipReconcileReason;
  reconcileFinishedAt?: string;
  lastBumpReason?: string;
  lastBumpAt?: string;
  stageRosterCompleted?: boolean;
  stageShellsCompleted?: boolean;
  stageAggregateCompleted?: boolean;
  stageTopologyCompleted?: boolean;
  stageTrainingProofCompleted?: boolean;
  stageBreakdownCompleted?: boolean;
  stageBreakdownPruneCompleted?: boolean;
  sourceTrigger?: string;
  hydrationTriggerClass?: HydrationTriggerClass;
  cacheLinks?: HydrationCacheLinkEvidence[];
  activeLinkCount?: number;
  sessionCachePresentCount?: number;
  parentWeeklyFetchSource?: "cache" | "network" | "none";
  parentOverlayArtifactsPresent?: boolean;
  analysisReadiness: HydrationAnalysisReadinessEvidence[];
};
